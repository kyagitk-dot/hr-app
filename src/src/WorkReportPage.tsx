import { useState, useEffect } from "react";
import { db } from "./firebase";
import { doc, setDoc, getDoc, collection, onSnapshot, query, where } from "firebase/firestore";

// ── 業務日報（全社員）──────────────────────────────────────────
// 保存先: work_reports/{日付}_{uid}（既存の daily とは別のコレクション）

const COL = "work_reports";
const todayStr = (): string => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
};

const S = {
  card: { background: "#fff", border: "0.5px solid #E8E7E2", borderRadius: 12, padding: "14px 16px", marginBottom: 12 } as const,
  title: { fontSize: 14, fontWeight: 600, color: "#2C2C2A", marginBottom: 10 } as const,
  label: { fontSize: 12, color: "#5F5E5A", margin: "10px 0 4px" } as const,
  area: { width: "100%", minHeight: 80, padding: 8, fontSize: 14, border: "1px solid #D3D1C7", borderRadius: 8, boxSizing: "border-box", fontFamily: "inherit" } as const,
  btn: { padding: "8px 16px", fontSize: 13, border: "none", borderRadius: 8, background: "#534AB7", color: "#fff", cursor: "pointer" } as const,
  btnGhost: { padding: "6px 12px", fontSize: 12, border: "1px solid #D3D1C7", borderRadius: 8, background: "#fff", color: "#5F5E5A", cursor: "pointer" } as const,
  gray: { fontSize: 12, color: "#888780" } as const,
  err: { background: "#FAECE7", color: "#712B13", borderRadius: 8, padding: 10, fontSize: 13, marginBottom: 12 } as const,
  ok: { background: "#EAF3DE", color: "#27500A", borderRadius: 8, padding: 10, fontSize: 13, marginBottom: 12 } as const,
};

type Report = {
  id?: string; uid: string; displayName: string; date: string;
  done: string; issues: string; tomorrow: string;
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

// 自分のその日の販売実績（読み取りのみ）
function MySalesLine({ uid, date }: { uid: string; date: string }) {
  const [text, setText] = useState<string>("");
  useEffect(() => {
    let alive = true;
    getDoc(doc(db, "salesReports", uid, "daily", date)).then((snap) => {
      if (!alive) return;
      if (!snap.exists()) { setText("この日の販売実績の入力はありません"); return; }
      const d: any = snap.data();
      const store = d.storeName ? String(d.storeName) : "（店舗未入力）";
      let total = 0;
      for (const e of d.entries || []) for (const [k, v] of Object.entries(e)) { if (k !== "carrierId" && typeof v === "number") total += v; }
      setText(store + " / 件数 " + total + "件");
    }).catch(() => { if (alive) setText(""); });
    return () => { alive = false; };
  }, [uid, date]);
  return text ? <div style={{ ...S.gray, marginBottom: 8 }}>📊 {text}</div> : null;
}

// ── 社員用：自分の日報を書く／過去分を見る ──
export function MyWorkReport({ uid, displayName }: { uid: string; displayName: string }) {
  const [date, setDate] = useState<string>(todayStr());
  const [done, setDone] = useState("");
  const [issues, setIssues] = useState("");
  const [tomorrow, setTomorrow] = useState("");
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [mine, setMine] = useState<Report[]>([]);
  const [comments, setComments] = useState<Report["comments"]>([]);

  // 日付を変えたら、その日の自分の日報を読み込む
  useEffect(() => {
    let alive = true;
    setMsg(null);
    getDoc(doc(db, COL, date + "_" + uid)).then((snap) => {
      if (!alive) return;
      const d: any = snap.exists() ? snap.data() : {};
      setDone(d.done || ""); setIssues(d.issues || ""); setTomorrow(d.tomorrow || ""); setComments(d.comments || []);
    }).catch((e) => { if (alive) setMsg({ kind: "err", text: explain(e) }); });
    return () => { alive = false; };
  }, [date, uid]);

  // 自分の過去の日報（新しい順）
  useEffect(() => {
    const q = query(collection(db, COL), where("uid", "==", uid));
    const unsub = onSnapshot(q, (snap) => {
      const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Report[];
      rows.sort((a, b) => String(b.date).localeCompare(String(a.date)));
      setMine(rows);
    }, (e) => setMsg({ kind: "err", text: explain(e) }));
    return () => unsub();
  }, [uid]);

  const save = async () => {
    if (!done.trim() && !issues.trim() && !tomorrow.trim()) { setMsg({ kind: "err", text: "どれか1つは入力してください" }); return; }
    try {
      const ref = doc(db, COL, date + "_" + uid);
      const prev = await getDoc(ref);
      const keep: any = prev.exists() ? prev.data() : {};
      await setDoc(ref, {
        uid, displayName, date, done, issues, tomorrow,
        comments: keep.comments || [],
        createdAt: keep.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      setMsg({ kind: "ok", text: "保存しました（同じ日に保存し直すと上書きされます）" });
    } catch (e) { setMsg({ kind: "err", text: explain(e) }); }
  };

  return (
    <div>
      <div style={S.card}>
        <div style={S.title}>日報を書く</div>
        {msg && <div style={msg.kind === "ok" ? S.ok : S.err}>{msg.text}</div>}
        <div style={S.label}>日付</div>
        <input type="date" value={date} max={todayStr()} onChange={(e) => setDate(e.target.value || todayStr())} style={{ padding: 6, fontSize: 14, border: "1px solid #D3D1C7", borderRadius: 8 }} />
        <MySalesLine uid={uid} date={date} />
        <div style={S.label}>今日やったこと</div>
        <textarea value={done} onChange={(e) => setDone(e.target.value)} style={S.area} placeholder="例：A社へ見積書を送付、新人の同行指導" />
        <div style={S.label}>課題・困っていること</div>
        <textarea value={issues} onChange={(e) => setIssues(e.target.value)} style={S.area} placeholder="例：在庫の確認に時間がかかった" />
        <div style={S.label}>明日やること</div>
        <textarea value={tomorrow} onChange={(e) => setTomorrow(e.target.value)} style={S.area} placeholder="例：B社の訪問準備" />
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
            <div style={{ fontSize: 13, fontWeight: 600, color: "#2C2C2A" }}>{r.date}</div>
            <div style={{ fontSize: 12, color: "#5F5E5A" }}>{String(r.done || "").slice(0, 60)}{(r.done || "").length > 60 ? "…" : ""}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── 管理者用：全員の日報を読む／コメントを付ける／今日の未提出を見る ──
export function AllWorkReports({ managerName, users }: { managerName: string; users: any[] }) {
  const [date, setDate] = useState<string>(todayStr());
  const [rows, setRows] = useState<Report[]>([]);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    const q = query(collection(db, COL), where("date", "==", date));
    const unsub = onSnapshot(q, (snap) => {
      setRows(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Report[]);
    }, (e) => setMsg({ kind: "err", text: explain(e) }));
    return () => unsub();
  }, [date]);

  const submittedUids = new Set(rows.map((r) => r.uid));
  const notYet = (users || []).filter((u: any) => u && u.id && !submittedUids.has(u.id) && u.status !== "rejected");

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
        <div style={S.title}>日報一覧</div>
        {msg && <div style={msg.kind === "ok" ? S.ok : S.err}>{msg.text}</div>}
        <div style={S.label}>日付</div>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value || todayStr())} style={{ padding: 6, fontSize: 14, border: "1px solid #D3D1C7", borderRadius: 8 }} />
        <div style={{ ...S.gray, marginTop: 8 }}>提出 {rows.length}件 / 未提出 {notYet.length}名</div>
      </div>

      {rows.map((r) => (
        <div key={r.id} style={S.card}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#2C2C2A" }}>{r.displayName}</div>
          <div style={S.label}>やったこと</div>
          <div style={{ whiteSpace: "pre-wrap", fontSize: 14 }}>{r.done || "—"}</div>
          <div style={S.label}>課題</div>
          <div style={{ whiteSpace: "pre-wrap", fontSize: 14 }}>{r.issues || "—"}</div>
          <div style={S.label}>明日やること</div>
          <div style={{ whiteSpace: "pre-wrap", fontSize: 14 }}>{r.tomorrow || "—"}</div>
          {(r.comments || []).map((c, i) => (
            <div key={i} style={{ background: "#F4F3EF", borderRadius: 8, padding: 8, fontSize: 13, marginTop: 8 }}>
              <div style={S.gray}>{c.by} / {String(c.at).slice(0, 16).replace("T", " ")}</div>
              <div style={{ whiteSpace: "pre-wrap" }}>{c.text}</div>
            </div>
          ))}
          <div style={{ marginTop: 10, display: "flex", gap: 6 }}>
            <input
              value={drafts[r.id || ""] || ""}
              onChange={(e) => setDrafts((p) => ({ ...p, [r.id || ""]: e.target.value }))}
              placeholder="コメントを書く"
              style={{ flex: 1, padding: 8, fontSize: 14, border: "1px solid #D3D1C7", borderRadius: 8 }}
            />
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
