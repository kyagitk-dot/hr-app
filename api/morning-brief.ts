// api/morning-brief.ts
// 毎朝のブリーフィング — work_memos（業務メモ）を読み、期日が近いもの・停滞しているものを
// Claudeでまとめて、管理者(manager)のLINEにプッシュする。
// GitHub Actions (.github/workflows/morning-brief.yml) から毎朝8時(JST)に叩かれる。

import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

if (!getApps().length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || "{}");
  initializeApp({ credential: cert(serviceAccount) });
}
const db = getFirestore();

const ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN || "";
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "";

// ── 日付ユーティリティ（JST）──────────────────────────
function jstToday(): string {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
function daysBetween(a: string, b: string): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
}

// ── LINE push ─────────────────────────────────────────
async function pushText(to: string, text: string) {
  await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${ACCESS_TOKEN}` },
    body: JSON.stringify({ to, messages: [{ type: "text", text }] }),
  });
}

// ── メモを分類 ────────────────────────────────────────
type Memo = {
  id: string; type: string; title: string; counterparty: string | null; dueDate: string | null;
  assignee: string | null; amount: number | null; nextAction: string | null;
  createdByName: string; createdAt: any; recurring?: boolean;
};

function describe(m: Memo, today: string): string {
  const parts = [m.title];
  if (m.counterparty) parts.push(`相手:${m.counterparty}`);
  if (m.assignee) parts.push(`担当:${m.assignee}`);
  if (m.dueDate) {
    const d = daysBetween(today, m.dueDate);
    parts.push(d < 0 ? `期日:${m.dueDate}(${-d}日超過)` : d === 0 ? "期日:今日" : `期日:${m.dueDate}(あと${d}日)`);
  }
  if (m.amount != null) parts.push(`金額:${m.amount.toLocaleString()}円`);
  if (m.nextAction) parts.push(`次:${m.nextAction}`);
  return "- " + parts.join(" / ");
}

export default async function handler(req: any, res: any) {
  // 認証：GitHub Actionsから LINE_CHANNEL_ACCESS_TOKEN をヘッダーで渡す（新しいシークレット不要）
  const auth = req.headers["x-brief-token"];
  if (!ACCESS_TOKEN || auth !== ACCESS_TOKEN) {
    res.status(401).send("Unauthorized");
    return;
  }

  try {
    const today = jstToday();

    // 未完了メモを取得
    const snap = await db.collection("work_memos").where("status", "==", "open").get();
    const memos: Memo[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));

    // 分類
    const overdue = memos.filter((m) => m.dueDate && daysBetween(today, m.dueDate) < 0);
    const dueSoon = memos.filter((m) => m.dueDate && daysBetween(today, m.dueDate) >= 0 && daysBetween(today, m.dueDate) <= 3);
    const later = memos.filter((m) => m.dueDate && daysBetween(today, m.dueDate) > 3);
    const noDue = memos.filter((m) => !m.dueDate);
    const stalled = noDue.filter((m) => {
      const created = m.createdAt?.toDate ? m.createdAt.toDate() : null;
      return created && daysBetween(created.toISOString().slice(0, 10), today) >= 7;
    });

    // ブリーフィング本文
    let brief: string;
    if (memos.length === 0) {
      brief = `おはようございます。${today} のブリーフィングです。\n\n登録されている業務メモはありません。「メモ 〇〇」で送ってもらえれば、ここに載せていきます。`;
    } else {
      const facts = [
        `今日: ${today}`,
        `未完了メモ: ${memos.length}件`,
        overdue.length ? `\n【期日超過】\n${overdue.map((m) => describe(m, today)).join("\n")}` : "",
        dueSoon.length ? `\n【3日以内】\n${dueSoon.map((m) => describe(m, today)).join("\n")}` : "",
        later.length ? `\n【それ以降】\n${later.map((m) => describe(m, today)).join("\n")}` : "",
        noDue.length ? `\n【期日なし】\n${noDue.map((m) => describe(m, today)).join("\n")}` : "",
        stalled.length ? `\n【7日以上動きなし】\n${stalled.map((m) => describe(m, today)).join("\n")}` : "",
      ].filter(Boolean).join("\n");

      brief = facts; // AIが使えないときのフォールバック

      if (ANTHROPIC_API_KEY) {
        try {
          const prompt = `あなたは株式会社Athhaの社長・八木幸平の右腕となる業務アシスタントです。
以下は今日時点の未完了業務メモの一覧です。これをもとに、朝のブリーフィングをLINEメッセージとして書いてください。

【条件】
- 冒頭は「おはようございます。${today}のブリーフィングです。」
- 優先順位：期日超過 → 今日・3日以内 → 停滞 → その他
- 各項目は1行で簡潔に。担当者名と期日は必ず残す
- 最後に「今日やるべきことトップ3」を提案（データが少なければ1〜2個でよい）
- 全体で400字以内。絵文字は最小限（見出しに1つ程度）。Markdown記法は使わない
- 事実にないことは書かない

【メモ一覧】
${facts}`;
          const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
            body: JSON.stringify({ model: "claude-haiku-4-5", max_tokens: 800, messages: [{ role: "user", content: prompt }] }),
          });
          const aiData = await aiRes.json();
          const text = aiData.content?.[0]?.text?.trim();
          if (text) brief = text;
        } catch (err) {
          console.error("AI brief error:", err);
        }
      }
    }

    // 送信先：role が manager のユーザーのLINE
    const managersSnap = await db.collection("users").where("role", "==", "manager").get();
    const managerUids = managersSnap.docs.map((d) => d.id);
    const sentTo: string[] = [];
    if (managerUids.length > 0) {
      const lineSnap = await db.collection("lineUsers").where("uid", "in", managerUids.slice(0, 10)).get();
      for (const doc of lineSnap.docs) {
        await pushText(doc.id, brief);
        sentTo.push(doc.data().displayName || doc.id);
      }
    }

    // 記録
    await db.collection("morning_briefs").add({
      date: today, brief, memoCount: memos.length,
      overdue: overdue.length, dueSoon: dueSoon.length, stalled: stalled.length,
      sentTo, createdAt: new Date(),
    });

    res.status(200).json({ ok: true, date: today, memoCount: memos.length, sentTo });
  } catch (err: any) {
    console.error("morning-brief error:", err);
    res.status(500).json({ ok: false, error: String(err) });
  }
}
