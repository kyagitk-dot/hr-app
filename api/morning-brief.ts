// api/morning-brief.ts
// 毎朝のブリーフィング — work_memos（業務メモ）を読み、
//   ・社員それぞれに「自分のメモだけ」のブリーフィング
//   ・admin には全員分をまとめた全体版
// を Claude で作って LINE にプッシュする。
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

// 全体版ブリーフィングを受け取る人（LINE連携時の表示名）。role が admin のユーザーにも届く
const ADMIN_NAMES = ["八木幸平"];

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

// ── 型 ────────────────────────────────────────────────
type Memo = {
  id: string; type: string; title: string; counterparty: string | null; dueDate: string | null;
  assignee: string | null; amount: number | null; nextAction: string | null;
  createdBy: string; createdByName: string; createdAt: any; recurring?: boolean;
};

// ── メモ1件を1行に ─────────────────────────────────────
function describe(m: Memo, today: string, withOwner: boolean): string {
  const parts = [m.title];
  if (withOwner) parts.push(`登録:${m.createdByName || "不明"}`);
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

// ── メモ一覧を分類してテキスト化 ─────────────────────
function buildFacts(memos: Memo[], today: string, withOwner: boolean): string {
  const overdue = memos.filter((m) => m.dueDate && daysBetween(today, m.dueDate) < 0);
  const dueSoon = memos.filter((m) => m.dueDate && daysBetween(today, m.dueDate) >= 0 && daysBetween(today, m.dueDate) <= 3);
  const later = memos.filter((m) => m.dueDate && daysBetween(today, m.dueDate) > 3);
  const noDue = memos.filter((m) => !m.dueDate);
  const stalled = noDue.filter((m) => {
    const created = m.createdAt?.toDate ? m.createdAt.toDate() : null;
    return created && daysBetween(created.toISOString().slice(0, 10), today) >= 7;
  });
  const sec = (label: string, list: Memo[]) =>
    list.length ? `\n【${label}】\n${list.map((m) => describe(m, today, withOwner)).join("\n")}` : "";
  return [
    `今日: ${today}`,
    `未完了メモ: ${memos.length}件`,
    sec("期日超過", overdue),
    sec("3日以内", dueSoon),
    sec("それ以降", later),
    sec("期日なし", noDue),
    sec("7日以上動きなし", stalled),
  ].filter(Boolean).join("\n");
}

// ── Claudeでブリーフィング文を生成（失敗時はfactsをそのまま返す）──
async function writeBrief(facts: string, today: string, mode: "personal" | "overall", name: string): Promise<string> {
  if (!ANTHROPIC_API_KEY) return facts;
  const role =
    mode === "personal"
      ? `あなたは株式会社Athhaの社員「${name}」さん専属の業務アシスタントです。以下は${name}さんが関わる未完了業務メモの一覧です。`
      : `あなたは株式会社Athhaの社長・${name}の右腕となる業務アシスタントです。以下は会社全体の未完了業務メモの一覧です（誰が登録したか・誰の担当かも含みます）。`;
  const extra =
    mode === "personal"
      ? "- 最後に「今日やること」を1〜3個提案"
      : "- 人ごとの偏りや、放置されている案件・期日遅れがあれば指摘する\n- 最後に「社長が今日確認・判断すべきこと」を1〜3個提案";
  const prompt = `${role}
これをもとに、朝のブリーフィングをLINEメッセージとして書いてください。

【条件】
- 冒頭は「おはようございます。${today}のブリーフィングです。」
- 優先順位：期日超過 → 今日・3日以内 → 停滞 → その他
- 各項目は1行で簡潔に。担当者名と期日は必ず残す
${extra}
- 全体で${mode === "personal" ? "300" : "500"}字以内。絵文字は最小限。Markdown記法は使わない
- 事実にないことは書かない

【メモ一覧】
${facts}`;
  try {
    const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: "claude-haiku-4-5", max_tokens: 900, messages: [{ role: "user", content: prompt }] }),
    });
    const aiData = await aiRes.json();
    const text = aiData.content?.[0]?.text?.trim();
    return text || facts;
  } catch (err) {
    console.error("AI brief error:", err);
    return facts;
  }
}

export default async function handler(req: any, res: any) {
  // 認証：GitHub Actionsから LINE_CHANNEL_ACCESS_TOKEN をヘッダーで渡す
  const auth = req.headers["x-brief-token"];
  if (!ACCESS_TOKEN || auth !== ACCESS_TOKEN) {
    res.status(401).send("Unauthorized");
    return;
  }

  try {
    const today = jstToday();

    // 未完了メモ
    const snap = await db.collection("work_memos").where("status", "==", "open").get();
    const memos: Memo[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));

    // LINE連携ユーザー（lineUserId → 名前 / uid、名前 → lineUserId）
    const lineSnap = await db.collection("lineUsers").get();
    const lineName: Record<string, string> = {};
    const lineUid: Record<string, string> = {};
    const nameToLine: Record<string, string> = {};
    lineSnap.docs.forEach((d) => {
      const data = d.data();
      lineName[d.id] = data.displayName || d.id;
      lineUid[d.id] = data.uid || "";
      if (data.displayName) nameToLine[data.displayName] = d.id;
    });

    // admin（全体版の宛先）
    const adminsSnap = await db.collection("users").where("role", "==", "admin").get();
    const adminUids = new Set(adminsSnap.docs.map((d) => d.id));
    const adminLineIds = Object.keys(lineUid).filter((id) => adminUids.has(lineUid[id]) || ADMIN_NAMES.includes(lineName[id]));

    // 個人版：登録者本人 ＋ 担当者名が一致する人 に振り分け
    const personal: Record<string, Memo[]> = {};
    for (const m of memos) {
      const targets = new Set<string>();
      if (m.createdBy) targets.add(m.createdBy);
      if (m.assignee && nameToLine[m.assignee]) targets.add(nameToLine[m.assignee]);
      for (const t of targets) (personal[t] ||= []).push(m);
    }

    const sentTo: string[] = [];

    // 個人版を送信（adminは全体版を受け取るので個人版は送らない）
    for (const lineId of Object.keys(personal)) {
      if (adminLineIds.includes(lineId)) continue;
      const name = lineName[lineId] || "あなた";
      const facts = buildFacts(personal[lineId], today, false);
      const brief = await writeBrief(facts, today, "personal", name);
      await pushText(lineId, brief);
      sentTo.push(name);
    }

    // 全体版をadminに送信
    if (adminLineIds.length > 0) {
      const overall = memos.length
        ? await writeBrief(buildFacts(memos, today, true), today, "overall", lineName[adminLineIds[0]] || "社長")
        : `おはようございます。${today} のブリーフィングです。\n\n登録されている業務メモはありません。「メモ 〇〇」で送ってもらえれば、ここに載せていきます。`;
      for (const lineId of adminLineIds) {
        await pushText(lineId, overall);
        sentTo.push(`${lineName[lineId]}(全体版)`);
      }
    }

    await db.collection("morning_briefs").add({
      date: today, memoCount: memos.length, sentTo, createdAt: new Date(),
    });

    res.status(200).json({ ok: true, date: today, memoCount: memos.length, sentTo });
  } catch (err: any) {
    console.error("morning-brief error:", err);
    res.status(500).json({ ok: false, error: String(err) });
  }
}
