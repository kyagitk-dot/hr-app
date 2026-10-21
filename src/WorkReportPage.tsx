import { useState, useEffect } from "react";
import { db } from "./firebase";
import { doc, setDoc, getDoc, getDocs, collection, onSnapshot, query, where } from "firebase/firestore";

// ── 業務日報（全社員）─────────────────────────────────────────
// 前回の「明日やること」に対して、結果（できた／途中／できなかった）を選ぶ。
// 進み具合は自己評価の%ではなく、約束の結果から自動で計算する。
// 保存先: work_reports/{日付}_{uid}（既存の daily とは別のコレクション）

const COL = "work_reports";
const SLOTS = 3;
const SCORE: Record<string, number> = { done: 1, partial: 0.5, not: 0 };
const RESULT_LABEL: Record<string, string> = { done: "できた", partial: "途中", not: "できなかった" };
const RESULT_COLOR: Record<string, string> = { done: "#3B6D11", partial: "#BA7517", not: "#A32D2D" };
const BLOCKERS = ["時間が足りない", "人手が足りない", "在庫・物が足りない", "判断・確認待ち", "特になし"];

const pad = (n: number) => String(n).padStart(2, "0");
const fmtDate = (d: Date): string => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
const todayStr = (): string => fmtDate(new Date());
const daysAgo = (n: number): string => { const d = new Date(); d.setDate(d.getDate() - n); return fmtDate(d); };

const S = {
  card: { background: "#fff", border: "0.5px solid #E8E7E2", borderRadius: 12, padding: "14px 16px", marginBottom: 12 } as const,
  title: { fontSize: 14, fontWeight: 600, color: "#2C2C2A", marginBottom: 10 } as const,
  label: { fontSize: 12, color: "#5F5E5A", margin: "12px 0 4px" } as const,
  input: { width: "100%", padding: 8, fontSize: 14, border: "1px solid #D3D1C7", borderRadius: 8, boxSizing: "border-box", fontFamily: "inherit" } as const,
  btn: { padding: "8px 16px", fontSize: 13, border: "none", borderRadius: 8, background: "#534AB7", color: "#fff", cursor: "pointer" } as const,
  btnGhost: { padding: "6px 12px", fontSize: 12, border: "1px solid #D3D1C7", borderRadius: 8, background: "#fff", color: "#5F5E5A", cursor: "pointer" } as const,
  gray: { fontSize: 12, color: "#888780" } as const,
  err: { background: "#FAECE7", color: "#712B13", borderRadius: 8, padding: 10, fontSize: 13, marginBottom: 12 } as const,
  ok: { background: "#EAF3DE", color: "#27500A", borderRadius: 8, padding: 10, fontSize: 13, marginBottom: 12 } as const,
};

type Item = { text: string; result: string };
type Report = {
  id?: string; uid: string; displayName: string; date: string;
  review?: Item[]; blockers?: string[]; note?: string; tomorrowItems?: string[];
  comments?: { by: string; at: string; text: string }[];
  updatedAt?: string;
};

const explain = (e: any): string => {
  const code = String(e?.code || "");
  if (code.includes("permission")) {
    return "保存・読み取りの権限がありません。Firebaseのセキュリティルールに work_reports の許可がまだ入っていない可能性があります。管理者（八木さん）に伝えてください。";
  }
  return "エラーが発生しました: " + String(e?.message || e);
};

// 約束の達成率：できた=1、途中=0.5、できなかった=0 の平均（since 以降の日報だけ）
function calc(rows: Report[], since: string): { rate: number | null; n: number } {
  let sum = 0; let n = 0;
  for (const r of rows) {
    if (String(r.date) < since) continue;
    for (const x of r.review || []) {
      if (x && SCORE[x.result] !== undefined) { sum += SCORE[x.result]; n += 1; }
    }
  }
  return { rate: n ? Math.round((sum / n) * 100) : null, n };
}
const pct = (v: { rate: number | null; n: number }): string => (v.rate === null ? "—" : v.rate + "%（" + v.n + "件）");

function Chip({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} style={{
      padding: "6px 12px", fontSize: 13, borderRadius: 16, cursor: "pointer", marginRight: 6, marginBottom: 6,
      border: on ? "1px solid #534AB7" : "1px solid #D3D1C7", background: on ? "#EEEDFE" : "#fff", color: on ? "#3C3489" : "#5F5E5A",
    }}>{label}</button>
  );
}

function Tag({ result }: { result: string }) {
  const c = RESULT_COLOR[result] || "#888780";
  return <span style={{ fontSize: 12, color: c, border: "1px solid " + c, borderRadius: 10, padding: "1px 8px", marginLeft: 6 }}>{RESULT_LABEL[result] || "未回答"}</span>;
}

// 自分のその日の販売実績（読み取りのみ）
function MySalesLine({ uid, date }: { uid: string; date: string }) {
  const [text, setText] = useState<string>("");
  useEffect(() => {
    let alive = true;
    getDoc(doc(db, "salesReports", uid, "daily", date)).then((snap) => {
      if (!alive) return;
      if (!snap.exists()) { setText(""); return; }
      const d: any = snap.data();
      const store = d.storeName ? String(d.storeName) : "（店舗未入力）";
      let total = 0;
      for (const e of d.entries || []) for (const [k, v] of Object.entries(e)) { if (k !== "carrierId" && typeof v === "number") total += v; }
      setText(store + " / 件数 " + total + "件");
    }).catch(() => { if (alive) setText(""); });
    return () => { alive = false; };
  }, [uid, date]);
  return text ? <div style={{ ...S.gray, marginTop: 8 }}>📊 この日の販売実績：{text}</div> : null;
}

// ── 社員用：前回の約束の結果を選び、今日の詰まりと明日の約束を書く ──
export function MyWorkReport({ uid, displayName }: { uid: string; displayName: string }) {
  const [date, setDate] = useState<string>(todayStr());
  const [review, setReview] = useState<Item[]>([]);
  const [blockers, setBlockers] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [tomorrow, setTomorrow] = useState<string[]>(["", "", ""]);
  const [prevDate, setPrevDate] = useState<string>("");
  const [comments, setComments] = useState<Report["comments"]>([]);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [mine, setMine] = useState<Report[]>([]);

  // 日付を変えたら、その日の自分の日報（なければ前回の約束）を読み込む
  useEffect(() => {
    let alive = true;
    setMsg(null);
    (async () => {
      try {
        const all = await getDocs(query(collection(db, COL), where("uid", "==", uid)));
        const rows = all.docs.map((x) => x.data() as any).filter((x) => String(x.date) < date).sort((a, b) => String(b.date).localeCompare(String(a.date)));
        const prev: any = rows[0] || null;
        const snap = await getDoc(doc(db, COL, date + "_" + uid));
        if (!alive) return;
        setPrevDate(prev ? String(prev.date) : "");
        const pad3 = (arr: any): string[] => { const a = (arr || []).map((x: any) => String(x)); while (a.length < SLOTS) a.push(""); return a.slice(0, SLOTS); };
        if (snap.exists()) {
          const d: any = snap.data();
          setReview((d.review || []).map((x: any) => ({ text: String(x.text || ""), result: String(x.result || "") })));
          setBlockers(d.blockers || []); setNote(d.note || ""); setTomorrow(pad3(d.tomorrowItems)); setComments(d.comments || []);
        } else {
          setReview(((prev && prev.tomorrowItems) || []).map((x: any) => ({ text: String(x), result: "" })));
          setBlockers([]); setNote(""); setTomorrow(["", "", ""]); setComments([]);
        }
      } catch (e) { if (alive) setMsg({ kind: "err", text: explain(e) }); }
    })();
    return () => { alive = false; };
  }, [date, uid]);

  // 自分の日報の一覧（達成率の計算と、過去分の表示に使う）
  useEffect(() => {
    const q = query(collection(db, COL), where("uid", "==", uid));
    const unsub = onSnapshot(q, (snap) => {
      const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Report[];
      rows.sort((a, b) => String(b.date).localeCompare(String(a.date)));
      setMine(rows);
    }, (e) => setMsg({ kind: "err", text: explain(e) }));
    return () => unsub();
  }, [uid]);

  const toggleBlocker = (b: string) => {
    if (b === "特になし") { setBlockers(blockers.includes(b) ? [] : [b]); return; }
    const rest = blockers.filter((x) => x !== "特になし");
    setBlockers(rest.includes(b) ? rest.filter((x) => x !== b) : rest.concat(b));
  };

  const save = async () => {
    const unanswered = review.filter((x) => !x.result).length;
    if (unanswered > 0) { setMsg({ kind: "err", text: "前回の約束の結果を、すべて選んでください（あと" + unanswered + "件）" }); return; }
    const tm = tomorrow.map((x) => x.trim()).filter(Boolean);
    if (!review.length && !tm.length && !note.trim()) { setMsg({ kind: "err", text: "明日やること、または一言を入力してください" }); return; }
    try {
      const ref = doc(db, COL, date + "_" + uid);
      const prev = await getDoc(ref);
      const keep: any = prev.exists() ? prev.data() : {};
      await setDoc(ref, {
        uid, displayName, date, review, blockers, note: note.trim(), tomorrowItems: tm,
        comments: keep.comments || [],
        createdAt: keep.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      setMsg({ kind: "ok", text: "保存しました（同じ日に保存し直すと上書きされます）" });
    } catch (e) { setMsg({ kind: "err", text: explain(e) }); }
  };

  const r7 = calc(mine, daysAgo(6));
  const r30 = calc(mine, daysAgo(29));

  return (
    <div>
      <div style={S.card}>
        <div style={S.title}>約束の達成率（自動で計算されます）</div>
        <div style={{ fontSize: 14, color: "#2C2C2A" }}>直近7日：{pct(r7)}　／　直近30日：{pct(r30)}</div>
        <div style={{ ...S.gray, marginTop: 6 }}>前回の「明日やること」の結果から計算します（できた＝1、途中＝0.5、できなかった＝0）</div>
      </div>

      <div style={S.card}>
        <div style={S.title}>日報を書く</div>
        {msg && <div style={msg.kind === "ok" ? S.ok : S.err}>{msg.text}</div>}
        <div style={S.label}>日付</div>
        <input type="date" value={date} max={todayStr()} onChange={(e) => setDate(e.target.value || todayStr())} style={{ padding: 6, fontSize: 14, border: "1px solid #D3D1C7", borderRadius: 8 }} />
        <MySalesLine uid={uid} date={date} />

        {review.length > 0 ? (
          <div>
            <div style={S.label}>前回（{prevDate || "—"}）の約束は、どうなりましたか？</div>
            <div style={{ ...S.gray, marginBottom: 8 }}>途中＝手は付けたが、まだ終わっていない</div>
            {review.map((x, i) => (
              <div key={i} style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 14, color: "#2C2C2A", marginBottom: 6 }}>{x.text}</div>
                <div>
                  {["done", "partial", "not"].map((k) => (
                    <Chip key={k} on={x.result === k} label={RESULT_LABEL[k]} onClick={() => setReview(review.map((y, j) => (j === i ? { ...y, result: k } : y)))} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ ...S.gray, marginTop: 12 }}>
            {prevDate ? "前回（" + prevDate + "）は「明日やること」の記入がありませんでした" : "前回の日報はまだありません（今日が最初の日報です）"}
          </div>
        )}

        <div style={S.label}>詰まっていること（当てはまるものを選ぶ）</div>
        <div>{BLOCKERS.map((b) => <Chip key={b} on={blockers.includes(b)} label={b} onClick={() => toggleBlocker(b)} />)}</div>

        <div style={S.label}>一言（任意）</div>
        <input value={note} onChange={(e) => setNote(e.target.value)} style={S.input} placeholder="例：在庫の確認に時間がかかった" />

        <div style={S.label}>明日やること（1〜3個。次の日報で、結果を選びます）</div>
        {tomorrow.map((t, i) => (
          <input key={i} value={t} onChange={(e) => setTomorrow(tomorrow.map((y, j) => (j === i ? e.target.value : y)))} style={{ ...S.input, marginBottom: 6 }} placeholder={"明日やること" + (i + 1) + "（何ができたら完了か、一言添えると分かりやすい）"} />
        ))}

        <div style={{ marginTop: 12 }}><button style={S.btn} onClick={save}>保存する</button></div>

        {comments && comments.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <div style={S.label}>管理者からのコメント</div>
            {comments.map((c, i) => (
              <div key={i} style={{ background: "#F4F3EF", borderRadius: 8, padding: 8, fontSize: 13, marginBottom: 6 }}>
                <div style={S.gray}>{c.by} / {String(c.at).slice(0, 16).replace("T", " ")}</div>
                <div style={{ whiteSpace: "pre-wrap" }}>{c.text}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={S.card}>
        <div style={S.title}>これまでの日報</div>
        {mine.length === 0 && <div style={S.gray}>まだ日報はありません</div>}
        {mine.slice(0, 30).map((r) => (
          <div key={r.id} style={{ borderTop: "0.5px solid #E8E7E2", padding: "8px 0", cursor: "pointer" }} onClick={() => setDate(r.date)}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#2C2C2A" }}>{r.date}　<span style={S.gray}>約束の結果：{pct(calc([r], "0000-00-00"))}</span></div>
            <div style={{ fontSize: 12, color: "#5F5E5A" }}>明日やること：{(r.tomorrowItems || []).join(" / ") || "—"}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── 管理者用：全員の達成率・その日の日報・コメント・未提出 ──
export function AllWorkReports({ managerName, users }: { managerName: string; users: any[] }) {
  const [date, setDate] = useState<string>(todayStr());
  const [rows, setRows] = useState<Report[]>([]);
  const [recent, setRecent] = useState<Report[]>([]);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  // 選んだ日の日報
  useEffect(() => {
    const q = query(collection(db, COL), where("date", "==", date));
    const unsub = onSnapshot(q, (snap) => {
      setRows(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Report[]);
    }, (e) => setMsg({ kind: "err", text: explain(e) }));
    return () => unsub();
  }, [date]);

  // 直近30日分（達成率の計算用）
  useEffect(() => {
    const q = query(collection(db, COL), where("date", ">=", daysAgo(29)));
    const unsub = onSnapshot(q, (snap) => {
      setRecent(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Report[]);
    }, () => { /* 権限エラーは上の一覧側で表示する */ });
    return () => unsub();
  }, []);

  const members = (users || []).filter((u: any) => u && u.id && u.status !== "rejected");
  const submittedUids = new Set(rows.map((r) => r.uid));
  const notYet = members.filter((u: any) => !submittedUids.has(u.id));
  const stuck = rows.filter((r) => (r.blockers || []).some((b) => b !== "特になし") || (r.review || []).some((x) => x.result === "not")).length;

  const addComment = async (r: Report) => {
    const text = (drafts[r.id || ""] || "").trim();
    if (!text || !r.id) return;
    try {
      const ref = doc(db, COL, r.id);
      const snap = await getDoc(ref);
      const cur: any = snap.exists() ? snap.data() : {};
      const next = [...(cur.comments || []), { by: managerName, at: new Date().toISOString(), text }];
      await setDoc(ref, { ...cur, comments: next }, { merge: true });
      setDrafts((p) => ({ ...p, [r.id as string]: "" }));
      setMsg({ kind: "ok", text: "コメントを追加しました" });
    } catch (e) { setMsg({ kind: "err", text: explain(e) }); }
  };

  return (
    <div>
      <div style={S.card}>
        <div style={S.title}>約束の達成率（全員・自動計算）</div>
        <div style={{ ...S.gray, marginBottom: 8 }}>できた＝1、途中＝0.5、できなかった＝0 の平均です。簡単な約束ばかりでも上がるので、中身も合わせて見てください。</div>
        {members.length === 0 && <div style={S.gray}>メンバーの情報を読み込めていません</div>}
        {members.map((u: any) => {
          const mine = recent.filter((r) => r.uid === u.id);
          return (
            <div key={u.id} style={{ display: "flex", justifyContent: "space-between", borderTop: "0.5px solid #E8E7E2", padding: "6px 0", fontSize: 13 }}>
              <span style={{ color: "#2C2C2A" }}>{u.name || u.email}</span>
              <span style={{ color: "#5F5E5A" }}>7日 {pct(calc(mine, daysAgo(6)))}　30日 {pct(calc(mine, daysAgo(29)))}</span>
            </div>
          );
        })}
      </div>

      <div style={S.card}>
        <div style={S.title}>日報一覧</div>
        {msg && <div style={msg.kind === "ok" ? S.ok : S.err}>{msg.text}</div>}
        <div style={S.label}>日付</div>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value || todayStr())} style={{ padding: 6, fontSize: 14, border: "1px solid #D3D1C7", borderRadius: 8 }} />
        <div style={{ ...S.gray, marginTop: 8 }}>提出 {rows.length}件 / 未提出 {notYet.length}名 / 詰まり・できなかった項目あり {stuck}名</div>
      </div>

      {rows.map((r) => (
        <div key={r.id} style={S.card}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#2C2C2A" }}>{r.displayName}　<span style={S.gray}>約束の結果：{pct(calc([r], "0000-00-00"))}</span></div>
          <div style={S.label}>前回の約束の結果</div>
          {(r.review || []).length === 0 && <div style={{ fontSize: 13, color: "#888780" }}>前回の約束はありませんでした</div>}
          {(r.review || []).map((x, i) => (
            <div key={i} style={{ fontSize: 14, marginBottom: 4 }}>{x.text}<Tag result={x.result} /></div>
          ))}
          <div style={S.label}>詰まっていること</div>
          <div style={{ fontSize: 14 }}>{(r.blockers || []).join("、") || "—"}</div>
          {r.note ? (<div><div style={S.label}>一言</div><div style={{ fontSize: 14, whiteSpace: "pre-wrap" }}>{r.note}</div></div>) : null}
          <div style={S.label}>明日やること</div>
          <div style={{ fontSize: 14 }}>{(r.tomorrowItems || []).join(" / ") || "—"}</div>
          {(r.comments || []).map((c, i) => (
            <div key={i} style={{ background: "#F4F3EF", borderRadius: 8, padding: 8, fontSize: 13, marginTop: 8 }}>
              <div style={S.gray}>{c.by} / {String(c.at).slice(0, 16).replace("T", " ")}</div>
              <div style={{ whiteSpace: "pre-wrap" }}>{c.text}</div>
            </div>
          ))}
          <div style={{ marginTop: 10, display: "flex", gap: 6 }}>
            <input value={drafts[r.id || ""] || ""} onChange={(e) => setDrafts((p) => ({ ...p, [r.id || ""]: e.target.value }))} placeholder="コメントを書く" style={{ flex: 1, padding: 8, fontSize: 14, border: "1px solid #D3D1C7", borderRadius: 8 }} />
            <button style={S.btnGhost} onClick={() => addComment(r)}>送信</button>
          </div>
        </div>
      ))}

      {notYet.length > 0 && (
        <div style={S.card}>
          <div style={S.title}>この日の未提出（{notYet.length}名）</div>
          <div style={{ fontSize: 13, color: "#5F5E5A", lineHeight: 1.8 }}>{notYet.map((u: any) => u.name || u.email).join("、")}</div>
        </div>
      )}
    </div>
  );
}
