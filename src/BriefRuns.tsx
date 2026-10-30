import { useState, useEffect } from "react";
import { db } from "./firebase";
import { collection, query, orderBy, limit, getDocs, where } from "firebase/firestore";

// ── 管理者用：ブリーフィングの配信記録（brief_runs）──────────────────
// 届かなかった日の原因を調べるための画面。ブリーフィングの実行ごとに1件、記録が入る。
// （記録は api/morning-brief.ts が書く。この画面は読むだけ）

const S = {
  card: { background: "#fff", border: "0.5px solid #E8E7E2", borderRadius: 12, padding: "14px 16px", marginBottom: 12 } as const,
  title: { fontSize: 14, fontWeight: 600, color: "#2C2C2A", marginBottom: 10 } as const,
  gray: { fontSize: 12, color: "#888780" } as const,
  err: { background: "#FAECE7", color: "#712B13", borderRadius: 8, padding: 10, fontSize: 13, marginBottom: 12 } as const,
};

type Run = {
  id: string; date: string; via: string; inWindow: boolean; force: boolean; only: string; memoCount: number;
  sentTo: string[]; failed: string[]; nudged: string[]; skipped: Record<string, number>; time: string;
};

// 日本時間の「日付」と「時刻」にする
const jst = (v: any): { date: string; time: string } => {
  const d: Date = v && typeof v.toDate === "function" ? v.toDate() : new Date(v);
  const s = d.toLocaleString("sv-SE", { timeZone: "Asia/Tokyo" });
  return { date: s.slice(0, 10), time: s.slice(11, 16) };
};
const addD = (s: string, n: number): string => {
  const d = new Date(s + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const skipText = (m: Record<string, number>): string => Object.keys(m || {}).map((k) => k + " " + m[k]).join(" / ");

export function BriefRunsPage() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [unauth, setUnauth] = useState<{ date: string; secret: boolean; header: boolean }[]>([]);
  const [msg, setMsg] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const snap = await getDocs(query(collection(db, "brief_runs"), orderBy("createdAt", "desc"), limit(200)));
        const rows: Run[] = snap.docs.map((d) => {
          const x: any = d.data();
          const t = jst(x.createdAt);
          return {
            id: d.id, date: String(x.date || t.date), via: String(x.via || ""), inWindow: !!x.inWindow, force: !!x.force,
            only: String(x.only || ""), memoCount: Number(x.memoCount || 0), sentTo: x.sentTo || [], failed: x.failed || [],
            nudged: x.nudged || [], skipped: x.skipped || {}, time: t.time,
          };
        });
        let un: { date: string; secret: boolean; header: boolean }[] = [];
        try {
          const us = await getDocs(query(collection(db, "brief_runs"), where("kind", "==", "unauthorized")));
          un = us.docs.map((d) => { const x: any = d.data(); return { date: String(x.date || ""), secret: !!x.hasSecretEnv, header: !!x.hasAuthHeader }; }).sort((a, b) => b.date.localeCompare(a.date));
        } catch (e) { /* 読めなくても、本体の記録は表示する */ }
        if (!alive) return;
        setRuns(rows); setUnauth(un); setLoaded(true);
      } catch (e: any) {
        if (!alive) return;
        const code = String(e && e.code ? e.code : "");
        setMsg(code.indexOf("permission") >= 0
          ? "配信記録を読む権限がありません。Firebaseのセキュリティルールに、brief_runs の読み取り（管理者のみ）を追加してください。"
          : "読み込みに失敗しました: " + String(e && e.message ? e.message : e));
        setLoaded(true);
      }
    })();
    return () => { alive = false; };
  }, []);

  const todayJ = jst(new Date()).date;
  const days: string[] = [];
  for (let i = 0; i < 14; i++) days.push(addD(todayJ, -i));
  const byDate: Record<string, Run[]> = {};
  for (const r of runs) { if (!byDate[r.date]) byDate[r.date] = []; byDate[r.date].push(r); }

  return (
    <div>
      <div style={S.card}>
        <div style={S.title}>ブリーフィングの配信状況（直近14日）</div>
        {msg && <div style={S.err}>{msg}</div>}
        {!loaded && <div style={S.gray}>読み込み中…</div>}
        {loaded && !msg && (
          <div>
            <div style={{ ...S.gray, marginBottom: 8 }}>毎日10時台にVercel Cronが呼び出し、その日の未完了メモ・期日の約束がある人へ送ります。記録は、この機能を入れた日から残ります。</div>
            {days.map((d) => {
              const rs = byDate[d] || [];
              const cron = rs.filter((r) => r.via === "vercel-cron").length;
              const other = rs.length - cron;
              const sent = new Set<string>();
              let failedN = 0;
              for (const r of rs) { for (const n of r.sentTo) sent.add(n); failedN += r.failed.length; }
              let status = "記録なし";
              let color = "#888780";
              if (rs.length > 0 && sent.size > 0) { status = "送信 " + sent.size + "名"; color = "#3B6D11"; }
              else if (rs.length > 0) { status = "実行はあったが送信なし"; color = "#BA7517"; }
              return (
                <div key={d} style={{ borderTop: "0.5px solid #E8E7E2", padding: "6px 0", fontSize: 13 }}>
                  <span style={{ color: "#2C2C2A" }}>{d}</span>
                  <span style={{ color, marginLeft: 10 }}>{status}</span>
                  <span style={{ ...S.gray, marginLeft: 10 }}>Vercel Cron {cron}回 / その他 {other}回{failedN ? " / 失敗 " + failedN + "件" : ""}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {unauth.length > 0 && (
        <div style={S.card}>
          <div style={S.title}>認証で断った呼び出し（Vercel Cron）</div>
          <div style={{ fontSize: 13, color: "#712B13", lineHeight: 1.8 }}>{unauth.map((u) => (<div key={u.date}>{u.date}：サーバーのCRON_SECRET「{u.secret ? "あり" : "なし"}」／ Cronが送ってきた認証ヘッダー「{u.header ? "あり" : "なし"}」</div>))}</div>
          <div style={{ ...S.gray, marginTop: 6 }}>Vercel Cronの呼び出しが認証に失敗した日です。CRON_SECRET の設定を確認してください。</div>
        </div>
      )}

      <div style={S.card}>
        <div style={S.title}>実行の記録（新しい順・最大50件）</div>
        {loaded && runs.length === 0 && !msg && <div style={S.gray}>まだ記録がありません</div>}
        {runs.slice(0, 50).map((r) => (
          <div key={r.id} style={{ borderTop: "0.5px solid #E8E7E2", padding: "8px 0", fontSize: 12, color: "#5F5E5A", lineHeight: 1.7 }}>
            <div style={{ color: "#2C2C2A", fontWeight: 600 }}>{r.date} {r.time}　{r.via}　{r.inWindow ? "時間帯内" : "時間帯の外"}{r.force ? "　全員(強制)" : ""}{r.only ? "　個別" : ""}</div>
            <div>未完了メモ {r.memoCount}件 / 送信 {r.sentTo.join("、") || "なし"}{r.failed.length ? " / 失敗 " + r.failed.join("、") : ""}{r.nudged.length ? " / 声掛け " + r.nudged.join("、") : ""}</div>
            {skipText(r.skipped) ? <div>送らなかった理由：{skipText(r.skipped)}</div> : null}
          </div>
        ))}
      </div>
    </div>
  );
}
