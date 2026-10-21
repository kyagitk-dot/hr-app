import { useState, useEffect } from "react";
import { db } from "./firebase";
import { doc, setDoc, getDoc, getDocs, collection, onSnapshot, query, where } from "firebase/firestore";

// ── 業務日報（全社員）─────────────────────────────────────────
// 「次にやること」を期日つきで書き、期日になった日以降の日報で、結果（できた／途中／できなかった）を選ぶ。
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
const addDays = (s: string, n: number): string => { const d = new Date(s + "T00:00:00"); d.setDate(d.getDate() + n); return fmtDate(d); };
const mdOf = (s: string): string => { const p = String(s || "").split("-"); return p.length === 3 ? Number(p[1]) + "/" + Number(p[2]) : ""; };

const S = {
  card: { background: "#fff", border: "0.5px solid #E8E7E2", borderRadius: 12, padding: "14px 16px", marginBottom: 12 } as const,
  title: { fontSize: 14, fontWeight: 600, color: "#2C2C2A", marginBottom: 10 } as const,
  label: { fontSize: 12, color: "#5F5E5A", margin: "12px 0 4px" } as const,
  input: { width: "100%", padding: 8, fontSize: 14, border: "1px solid #D3D1C7", borderRadius: 8, boxSizing: "border-box", fontFamily: "inherit" } as const,
  dateInput: { padding: 6, fontSize: 13, border: "1px solid #D3D1C7", borderRadius: 8 } as const,
  btn: { padding: "8px 16px", fontSize: 13, border: "none", borderRadius: 8, background: "#534AB7", color: "#fff", cursor: "pointer" } as const,
  btnGhost: { padding: "6px 12px", fontSize: 12, border: "1px solid #D3D1C7", borderRadius: 8, background: "#fff", color: "#5F5E5A", cursor: "pointer" } as const,
  gray: { fontSize: 12, color: "#888780" } as const,
  err: { background: "#FAECE7", color: "#712B13", borderRadius: 8, padding: 10, fontSize: 13, marginBottom: 12 } as const,
  ok: { background: "#EAF3DE", color: "#27500A", borderRadius: 8, padding: 10, fontSize: 13, marginBottom: 12 } as const,
};

type Plan = { text: string; due: string };
type Item = { text: string; result: string; planId?: string; due?: string };
type Report = {
  id?: string; uid: string; displayName: string; date: string;
  review?: Item[]; blockers?: string[]; note?: string; doneToday?: string; remarks?: string; plans?: Plan[]; tomorrowItems?: string[];
  comments?: { by: string; at: string; text: string }[];
  updatedAt?: string;
};

// 日報から「次にやること」を取り出す（旧形式の tomorrowItems は、翌日を期日として読む）
const plansOf = (r: any): Plan[] => {
  const base: any[] = r && r.plans && r.plans.length ? r.plans : ((r && r.tomorrowItems) || []).map((t: any) => ({ text: String(t), due: addDays(String(r.date), 1) }));
  return base.map((p: any) => ({ text: String(p.text || ""), due: String(p.due || addDays(String(r.date), 1)) }));
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

// ── 社員用：期日になった約束の結果を選び、詰まりと、次の約束（期日つき）を書く ──
export function MyWorkReport({ uid, displayName, hideSwitcher = false }: { uid: string; displayName: string; hideSwitcher?: boolean }) {
  const emptyPlans = (d: string): Plan[] => [0, 1, 2].map(() => ({ text: "", due: addDays(d, 1) }));
  const [date, setDate] = useState<string>(todayStr());
  const [review, setReview] = useState<Item[]>([]);
  const [blockers, setBlockers] = useState<string[]>([]);
  const [note, setNote] = useState(""); // 今日できたこと
  const [remarks, setRemarks] = useState("");
  const [plans, setPlans] = useState<Plan[]>(emptyPlans(todayStr()));
  const [later, setLater] = useState<Plan[]>([]);
  const [comments, setComments] = useState<Report["comments"]>([]);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [view, setView] = useState<"mine" | "all">("mine");
  const [mine, setMine] = useState<Report[]>([]);

  // 日付を変えたら、その日の自分の日報（なければ、結果が未入力の約束）を読み込む
  useEffect(() => {
    let alive = true;
    setMsg(null);
    (async () => {
      try {
        const all = await getDocs(query(collection(db, COL), where("uid", "==", uid)));
        const rowsAll: any[] = all.docs.map((x) => x.data() as any);
        const snap = await getDoc(doc(db, COL, date + "_" + uid));
        if (!alive) return;
        const padPlans = (arr: Plan[]): Plan[] => { const a = arr.slice(0, SLOTS); while (a.length < SLOTS) a.push({ text: "", due: addDays(date, 1) }); return a; };
        // すでに結果を選んだ約束は除く。期日が今日以前のものを「結果を選ぶ約束」、期日前のものを「まだ期日前の約束」にする
        const reviewed = new Set<string>();
        for (const r of rowsAll) {
          if (String(r.date) === date) continue;
          for (const x of r.review || []) { if (x && x.planId) reviewed.add(String(x.planId)); }
        }
        const pending: Item[] = []; const upcoming: Plan[] = [];
        for (const r of rowsAll) {
          if (String(r.date) >= date) continue;
          plansOf(r).forEach((p, idx) => {
            const id = String(r.date) + "#" + idx;
            if (!p.text || reviewed.has(id)) return;
            if (p.due <= date) pending.push({ text: p.text, due: p.due, planId: id, result: "" });
            else upcoming.push(p);
          });
        }
        pending.sort((a, b) => String(a.due).localeCompare(String(b.due)));
        upcoming.sort((a, b) => String(a.due).localeCompare(String(b.due)));
        setLater(upcoming);
        if (snap.exists()) {
          const d: any = snap.data();
          setReview((d.review || []).map((x: any) => ({ text: String(x.text || ""), result: String(x.result || ""), planId: x.planId ? String(x.planId) : undefined, due: x.due ? String(x.due) : undefined })));
          setBlockers(d.blockers || []); setNote(d.doneToday || ""); setRemarks(d.remarks || ""); setPlans(padPlans(plansOf(d))); setComments(d.comments || []);
        } else {
          setReview(pending); setBlockers([]); setNote(""); setRemarks(""); setPlans(padPlans([])); setComments([]);
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
    if (unanswered > 0) { setMsg({ kind: "err", text: "期日になった約束の結果を、すべて選んでください（あと" + unanswered + "件）" }); return; }
    const pl = plans.map((p) => ({ text: p.text.trim(), due: p.due || addDays(date, 1) })).filter((p) => p.text);
    if (!review.length && !pl.length && !note.trim()) { setMsg({ kind: "err", text: "今日できたこと、または次にやることを入力してください" }); return; }
    try {
      const ref = doc(db, COL, date + "_" + uid);
      const prev = await getDoc(ref);
      const keep: any = prev.exists() ? prev.data() : {};
      await setDoc(ref, {
        uid, displayName, date,
        review: review.map((x) => ({ text: x.text, result: x.result, planId: x.planId || "", due: x.due || "" })),
        blockers, doneToday: note.trim(), remarks: remarks.trim(), plans: pl,
        comments: keep.comments || [],
        createdAt: keep.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      setMsg({ kind: "ok", text: "保存しました（同じ日に保存し直すと上書きされます）" });
    } catch (e) { setMsg({ kind: "err", text: explain(e) }); }
  };

  const switcher = hideSwitcher ? null : (
    <div style={{ marginBottom: 12 }}>
      <Chip on={view === "mine"} label="自分の日報" onClick={() => setView("mine")} />
      <Chip on={view === "all"} label="みんなの日報" onClick={() => setView("all")} />
    </div>
  );
  if (view === "all" && !hideSwitcher) {
    return (
      <div>
        {switcher}
        <AllWorkReports managerName={displayName} users={[]} canComment={false} showRates={false} />
      </div>
    );
  }

  const r7 = calc(mine, daysAgo(6));
  const r30 = calc(mine, daysAgo(29));

  return (
    <div>
      {switcher}
      <div style={S.card}>
        <div style={S.title}>約束の達成率（自動で計算されます）</div>
        <div style={{ fontSize: 14, color: "#2C2C2A" }}>直近7日：{pct(r7)}　／　直近30日：{pct(r30)}</div>
        <div style={{ ...S.gray, marginTop: 6 }}>期日になった約束の結果から計算します（できた＝1、途中＝0.5、できなかった＝0）</div>
      </div>

      <div style={S.card}>
        <div style={S.title}>日報を書く</div>
        {msg && <div style={msg.kind === "ok" ? S.ok : S.err}>{msg.text}</div>}
        <div style={S.label}>日付</div>
        <input type="date" value={date} max={todayStr()} onChange={(e) => setDate(e.target.value || todayStr())} style={S.dateInput} />
        <MySalesLine uid={uid} date={date} />

        {review.length > 0 ? (
          <div>
            <div style={S.label}>期日になった約束は、どうなりましたか？</div>
            <div style={{ ...S.gray, marginBottom: 8 }}>途中＝手は付けたが、まだ終わっていない。続ける場合は、下の「次にやること」に新しい期日で書き直してください</div>
            {review.map((x, i) => (
              <div key={i} style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 14, color: "#2C2C2A", marginBottom: 6 }}>{x.text}<span style={S.gray}>　期日 {mdOf(x.due || "")}</span></div>
                <div>
                  {["done", "partial", "not"].map((k) => (
                    <Chip key={k} on={x.result === k} label={RESULT_LABEL[k]} onClick={() => setReview(review.map((y, j) => (j === i ? { ...y, result: k } : y)))} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ ...S.gray, marginTop: 12 }}>結果を選ぶ約束はありません（期日になった約束が、ここに並びます）</div>
        )}

        {later.length > 0 && (
          <div>
            <div style={S.label}>まだ期日前の約束</div>
            {later.map((p, i) => (<div key={i} style={{ fontSize: 13, color: "#5F5E5A" }}>{p.text}（期日 {mdOf(p.due)}）</div>))}
          </div>
        )}

        <div style={S.label}>今日できたこと（できたことを書く。なければ空欄でOK）</div>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} style={{ ...S.input, minHeight: 64 }} placeholder="例：A社へ見積書を送付した／新人の同行指導をした" />

        <div style={S.label}>詰まっていること（当てはまるものを選ぶ）</div>
        <div>{BLOCKERS.map((b) => <Chip key={b} on={blockers.includes(b)} label={b} onClick={() => toggleBlocker(b)} />)}</div>


        <div style={S.label}>次にやること（1〜3個。期日を決めてください）</div>
        <div style={{ ...S.gray, marginBottom: 6 }}>期日になった日以降の日報で、結果を選びます。期日の前の日に書いても大丈夫です</div>
        {plans.map((p, i) => (
          <div key={i} style={{ display: "flex", gap: 6, marginBottom: 6 }}>
            <input value={p.text} onChange={(e) => setPlans(plans.map((y, j) => (j === i ? { ...y, text: e.target.value } : y)))} style={{ ...S.input, flex: 1 }} placeholder={"やること" + (i + 1) + "（何ができたら完了か、一言添えると分かりやすい）"} />
            <input type="date" value={p.due} min={date} onChange={(e) => setPlans(plans.map((y, j) => (j === i ? { ...y, due: e.target.value || addDays(date, 1) } : y)))} style={S.dateInput} />
          </div>
        ))}

        <div style={S.label}>備考（任意）</div>
        <input value={remarks} onChange={(e) => setRemarks(e.target.value)} style={S.input} placeholder="例：明日は直行直帰／在庫は〇〇店に確認済み" />

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
            <div style={{ fontSize: 12, color: "#5F5E5A" }}>次にやること：{plansOf(r).map((p) => p.text + "（" + mdOf(p.due) + "）").join(" / ") || "—"}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── 管理者用：全員の達成率・その日の日報・コメント・未提出 ──
export function AllWorkReports({ managerName, users, canComment = true, showRates = true }: { managerName: string; users: any[]; canComment?: boolean; showRates?: boolean }) {
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
      {showRates && (<div style={S.card}>
        <div style={S.title}>約束の達成率（全員・自動計算）</div>
        <div style={{ ...S.gray, marginBottom: 8 }}>できた＝1、途中＝0.5、できなかった＝0 の平均です。簡単な約束ばかりでも上がるので、約束の中身も合わせて見てください。</div>
        {members.length === 0 && <div style={S.gray}>メンバーの情報を読み込めていません</div>}
        {members.map((u: any) => {
          const own = recent.filter((r) => r.uid === u.id);
          return (
            <div key={u.id} style={{ display: "flex", justifyContent: "space-between", borderTop: "0.5px solid #E8E7E2", padding: "6px 0", fontSize: 13 }}>
              <span style={{ color: "#2C2C2A" }}>{u.name || u.email}</span>
              <span style={{ color: "#5F5E5A" }}>7日 {pct(calc(own, daysAgo(6)))}　30日 {pct(calc(own, daysAgo(29)))}</span>
            </div>
          );
        })}
      </div>)}

      <div style={S.card}>
        <div style={S.title}>日報一覧</div>
        {msg && <div style={msg.kind === "ok" ? S.ok : S.err}>{msg.text}</div>}
        <div style={S.label}>日付</div>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value || todayStr())} style={S.dateInput} />
        {showRates ? (<div style={{ ...S.gray, marginTop: 8 }}>提出 {rows.length}件 / 未提出 {notYet.length}名 / 詰まり・できなかった項目あり {stuck}名</div>) : (<div style={{ ...S.gray, marginTop: 8 }}>提出 {rows.length}件</div>)}
      </div>

      {rows.map((r) => (
        <div key={r.id} style={S.card}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#2C2C2A" }}>{r.displayName}　<span style={S.gray}>約束の結果：{pct(calc([r], "0000-00-00"))}</span></div>
          <div style={S.label}>期日になった約束の結果</div>
          {(r.review || []).length === 0 && <div style={{ fontSize: 13, color: "#888780" }}>この日に結果を選ぶ約束はありませんでした</div>}
          {(r.review || []).map((x, i) => (
            <div key={i} style={{ fontSize: 14, marginBottom: 4 }}>{x.text}{x.due ? "（期日 " + mdOf(x.due) + "）" : ""}<Tag result={x.result} /></div>
          ))}
          <div style={S.label}>詰まっていること</div>
          <div style={{ fontSize: 14 }}>{(r.blockers || []).join("、") || "—"}</div>
          {r.doneToday ? (<div><div style={S.label}>今日できたこと</div><div style={{ fontSize: 14, whiteSpace: "pre-wrap" }}>{r.doneToday}</div></div>) : null}
          <div style={S.label}>次にやること</div>
          <div style={{ fontSize: 14 }}>{plansOf(r).filter((p) => p.text).map((p) => p.text + "（期日 " + mdOf(p.due) + "）").join(" / ") || "—"}</div>
          {r.remarks ? (<div><div style={S.label}>備考</div><div style={{ fontSize: 14, whiteSpace: "pre-wrap" }}>{r.remarks}</div></div>) : null}
          {(r.comments || []).map((c, i) => (
            <div key={i} style={{ background: "#F4F3EF", borderRadius: 8, padding: 8, fontSize: 13, marginTop: 8 }}>
              <div style={S.gray}>{c.by} / {String(c.at).slice(0, 16).replace("T", " ")}</div>
              <div style={{ whiteSpace: "pre-wrap" }}>{c.text}</div>
            </div>
          ))}
          {canComment && (<div style={{ marginTop: 10, display: "flex", gap: 6 }}>
            <input value={drafts[r.id || ""] || ""} onChange={(e) => setDrafts((p) => ({ ...p, [r.id || ""]: e.target.value }))} placeholder="コメントを書く" style={{ flex: 1, padding: 8, fontSize: 14, border: "1px solid #D3D1C7", borderRadius: 8 }} />
            <button style={S.btnGhost} onClick={() => addComment(r)}>送信</button>
          </div>)}
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

// ── 管理者用：自分の日報を書く／全員の日報を管理する、の切り替え ──
export function ManagerWorkReport({ uid, displayName, users }: { uid: string; displayName: string; users: any[] }) {
  const [view, setView] = useState<"all" | "mine">("all");
  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <Chip on={view === "all"} label="全員の日報（管理）" onClick={() => setView("all")} />
        <Chip on={view === "mine"} label="自分の日報を書く" onClick={() => setView("mine")} />
      </div>
      {view === "all" ? (
        <AllWorkReports managerName={displayName} users={users} />
      ) : (
        <MyWorkReport uid={uid} displayName={displayName} hideSwitcher={true} />
      )}
    </div>
  );
}
