// api/morning-brief.ts
// 毎時動くスケジューラー（GitHub Actions から毎時0分に呼ばれる）
//   ・本人設定の時刻・曜日に合わせて「自分のメモだけ」のまとめを送る
//   ・admin には全社まとめ（全体版）
//   ・声掛け：本人設定の回数に応じて、しばらく使っていない人に一言
// 会社固有の設定は assistant-config.ts、本人の設定は user-settings.ts を参照。

import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { COMPANY, ASSISTANT } from "../lib/assistant-config";
import { getSettings, personaFor, UserSettings } from "../lib/user-settings";
import { flushDeferred } from "../lib/push";

if (!getApps().length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || "{}");
  initializeApp({ credential: cert(serviceAccount) });
}
const db = getFirestore();

const ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN || "";
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "";

// ── 日付ユーティリティ（JST）──────────────────────────
const jstNow = () => new Date(Date.now() + 9 * 60 * 60 * 1000);
const jstToday = () => jstNow().toISOString().slice(0, 10);
function daysBetween(a: string, b: string): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
}
// 声掛けの週回数 → 曜日
const NUDGE_DAYS: Record<number, number[]> = { 0: [], 1: [3], 2: [2, 5], 3: [1, 3, 5] };

// ── LINE push ─────────────────────────────────────────
async function pushText(to: string, text: string) {
  await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${ACCESS_TOKEN}` },
    body: JSON.stringify({ to, messages: [{ type: "text", text }] }),
  });
}

async function claude(system: string, user: string, maxTokens = 900): Promise<string | null> {
  if (!ANTHROPIC_API_KEY) return null;
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: "claude-haiku-4-5", max_tokens: maxTokens, system, messages: [{ role: "user", content: user }] }),
    });
    const data = await res.json();
    return data.content?.[0]?.text?.trim() || null;
  } catch (err) {
    console.error("claude error:", err);
    return null;
  }
}

// ── 型 ────────────────────────────────────────────────
type Memo = {
  id: string; type: string; title: string; counterparty: string | null; dueDate: string | null;
  assignee: string | null; amount: number | null; nextAction: string | null; priority?: string;
  createdBy: string; createdByName: string; createdAt: any; recurring?: boolean;
};

function describe(m: Memo, today: string, withOwner: boolean): string {
  const parts = [m.title];
  if (withOwner) parts.push(`登録:${m.createdByName || "不明"}`);
  if (m.counterparty) parts.push(`相手:${m.counterparty}`);
  if (m.assignee) parts.push(`担当:${m.assignee}`);
  if (m.dueDate) {
    const d = daysBetween(today, m.dueDate);
    parts.push(d < 0 ? `期日:${m.dueDate}(${-d}日超過)` : d === 0 ? "期日:今日" : `期日:${m.dueDate}(あと${d}日)`);
  }
  if (m.priority === "high") parts.push("優先度:高");
  if (m.amount != null) parts.push(`金額:${m.amount.toLocaleString()}円`);
  if (m.nextAction) parts.push(`次:${m.nextAction}`);
  return "- " + parts.join(" / ");
}

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
    `今日: ${today}`, `未完了メモ: ${memos.length}件`,
    sec("期日超過", overdue), sec("3日以内", dueSoon), sec("それ以降", later), sec("期日なし", noDue), sec("7日以上動きなし", stalled),
  ].filter(Boolean).join("\n");
}

async function writeBrief(facts: string, today: string, mode: "personal" | "overall", name: string, settings: UserSettings): Promise<string> {
  const role = mode === "personal"
    ? `以下は${name}さんが関わる未完了業務メモの一覧です。`
    : `あなたは社長・${COMPANY.presidentName}の右腕でもあります。以下は会社全体の未完了業務メモの一覧です（誰が登録したか・誰の担当かも含みます）。`;
  const extra = mode === "personal"
    ? "- 最後に「今日やること」を1〜3個提案"
    : "- 人ごとの偏りや、放置されている案件・期日遅れがあれば指摘する\n- 最後に「社長が今日確認・判断すべきこと」を1〜3個提案";
  const system = `${personaFor(settings, name)}\n所属: ${COMPANY.name}（${COMPANY.business}）`;
  const prompt = `${role}
これをもとに、朝のブリーフィングをLINEメッセージとして書いてください。

【条件】
- 冒頭は挨拶と「${today}のブリーフィングです」
- 優先順位：期日超過 → 今日・3日以内 → 停滞 → その他
- 各項目は1行で簡潔に。担当者名と期日は必ず残す
${extra}
- 全体で${mode === "personal" ? "300" : "500"}字以内。絵文字は最小限。Markdown記法は使わない
- 事実にないことは書かない

【メモ一覧】
${facts}`;
  return (await claude(system, prompt)) || facts;
}

export default async function handler(req: any, res: any) {
  const auth = req.headers["x-brief-token"];
  if (!ACCESS_TOKEN || auth !== ACCESS_TOKEN) { res.status(401).send("Unauthorized"); return; }

  try {
    const now = jstNow();
    const today = jstToday();
    const hour = now.getUTCHours();
    const dow = now.getUTCDay();
    const force = req.query?.force === "1"; // テスト用：時刻・曜日を無視して全員に送る
    // only を渡すと、そのLINEユーザーにだけ送る（LINEからの手動実行用）
    const only = typeof req.query?.only === "string" ? req.query.only : "";

    // 夜間に保留していた通知をまとめて送る（夜間帯は flushDeferred 側で何もしない）
    let flushed = 0;
    try { flushed = await flushDeferred(); } catch (e) { console.error("flushDeferred", e); }

    // 未完了メモ
    const snap = await db.collection("work_memos").where("status", "==", "open").get();
    const memos: Memo[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));

    // LINE連携ユーザー
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
    const adminUids = new Set<string>();
    for (const role of COMPANY.adminRoles) {
      const s = await db.collection("users").where("role", "==", role).get();
      s.docs.forEach((d) => adminUids.add(d.id));
    }
    const adminLineIds = Object.keys(lineUid).filter((id) => adminUids.has(lineUid[id]) || COMPANY.briefingNames.includes(lineName[id]));

    // 個人版の対象メモ（登録者本人＋担当者名が一致する人）
    const personal: Record<string, Memo[]> = {};
    for (const m of memos) {
      const targets = new Set<string>();
      if (m.createdBy) targets.add(m.createdBy);
      if (m.assignee && nameToLine[m.assignee]) targets.add(nameToLine[m.assignee]);
      for (const t of targets) (personal[t] ||= []).push(m);
    }

    // 直近3日の活動（声掛け判定用）
    const since = new Date(Date.now() - 3 * 86400000);
    const active = new Set<string>();
    (await db.collection("work_memos").where("createdAt", ">=", since).get()).docs.forEach((d) => { const cb = d.data().createdBy; if (cb) active.add(cb); });
    (await db.collection("consult_sessions").where("updatedAt", ">=", since).get()).docs.forEach((d) => active.add(d.id));
    (await db.collection("nudges").where("createdAt", ">=", since).get()).docs.forEach((d) => active.add(d.data().lineUserId));

    const sentTo: string[] = [];
    const nudged: string[] = [];

    for (const lineId of Object.keys(lineName)) {
      if ((lineUid[lineId] || "").startsWith("guest_")) continue;
      if (only && lineId !== only) continue; // 指定された人にだけ送る
      const name = lineName[lineId];
      const settings = await getSettings(lineId);
      const isAdmin = adminLineIds.includes(lineId);
      const itsTime = force || !!only || (settings.briefHour === hour && settings.briefDays.includes(dow));
      if (!itsTime) continue;

      if (isAdmin) {
        // 全体版
        const overall = memos.length
          ? await writeBrief(buildFacts(memos, today, true), today, "overall", name, settings)
          : `おはようございます。${today} のブリーフィングです。\n\n登録されている業務メモはありません。予定や約束をこのLINEに送ってもらえれば、ここに載せていきます。`;
        await pushText(lineId, overall);
        sentTo.push(`${name}(全体版)`);
        continue;
      }

      if (personal[lineId]) {
        // 個人版
        const brief = await writeBrief(buildFacts(personal[lineId], today, false), today, "personal", name, settings);
        await pushText(lineId, brief);
        sentTo.push(name);
        continue;
      }

      // 声掛け（メモがなく、3日以上動きがなく、本人の希望回数に合う曜日）
      const nudgeToday = !only && (force || NUDGE_DAYS[settings.nudgePerWeek]?.includes(dow));
      if (!nudgeToday || active.has(lineId)) continue;
      const system = `${personaFor(settings, name)}\n所属: ${COMPANY.name}（${COMPANY.business}）`;
      const msg = (await claude(system,
        `ここ数日やり取りがない${name}さんに、LINEで軽く声をかけてください。押しつけがましくなく、返事しやすい一言にして、「予定のメモも仕事の相談も、このLINEにそのまま送ればいい」ことを自然に伝えてください。100字以内。絵文字なし。本文だけを返してください。`, 200))
        || `${name}さん、おはようございます。最近、気になっていることや抱えている予定はありませんか？\n仕事の相談でも予定のメモでも、このLINEにそのまま送ってもらえれば、記録したりアドバイスしたりします。`;
      await pushText(lineId, msg);
      await db.collection("nudges").add({ lineUserId: lineId, name, message: msg, createdAt: new Date() });
      nudged.push(name);
    }

    if (sentTo.length || nudged.length) {
      await db.collection("morning_briefs").add({ date: today, hour, memoCount: memos.length, sentTo, nudged, createdAt: new Date() });
    }
    res.status(200).json({ ok: true, flushed, date: today, hour, memoCount: memos.length, sentTo, nudged });
  } catch (err: any) {
    console.error("scheduler error:", err);
    res.status(500).json({ ok: false, error: String(err) });
  }
}
