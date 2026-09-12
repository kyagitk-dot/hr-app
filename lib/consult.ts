// api/consult.ts
// Stella "相談モード" — 「メモ」でも件数報告でもない自由な文章を受け取り、
// 社員一人ひとりのお手伝いAIとして相談に乗り、アドバイスする。
// 相談内容は本人とAIの間だけ。AIが「社長に伝えるべき」と判断したものだけ、要約して管理者に届く。
// assistant.ts から classifyIntent() / handleConsult() を呼び出して使う

import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { handleWorkMemo } from './work-memo';
import { COMPANY, ASSISTANT } from './assistant-config';
import { getSettings, personaFor } from './user-settings';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY!;
const ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN || '';
const MODEL = 'claude-haiku-4-5';
const SESSION_COLLECTION = 'consult_sessions';   // 会話の続き（本人ごと）
const ESCALATION_COLLECTION = 'consult_escalations';
const SESSION_TTL_MS = 2 * 60 * 60 * 1000;       // 2時間会話がなければ新しい相談として扱う
const MAX_TURNS = 12;                            // 履歴として持つ最大ターン数

type Turn = { role: 'user' | 'assistant'; content: string };

async function claude(system: string, messages: Turn[], maxTokens = 800): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, system, messages }),
  });
  const data = await res.json();
  return (data.content ?? []).map((c: any) => c.text ?? '').join('').trim();
}

async function pushText(to: string, text: string) {
  await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ACCESS_TOKEN}` },
    body: JSON.stringify({ to, messages: [{ type: 'text', text }] }),
  });
}

// ── 自由文の意図を判定 ─────────────────────────────────
// report  : 件数報告（キャリア名や「新規3件」など販売件数の報告）
// memo    : 予定・約束・支払い・案件の動きなど「記録しておくべきこと」
// consult : 相談・質問・悩み・雑談など「返事がほしいこと」
export type Intent = 'report' | 'memo' | 'consult' | 'schedule' | 'done' | 'stats' | 'list' | 'delete';
export async function classifyIntent(text: string, inSession: boolean): Promise<Intent> {
  const system = `${COMPANY.name}（${COMPANY.business}）の社員がLINEで送ってきた文章を分類します。次のどれか1語だけを返してください。
report  : 販売件数の報告。キャリア名（docomo/au/SoftBank/ワイモバイル/UQなど）や「新規3件」「MNP1」「機変2 クレカ1」のように、項目と件数だけを並べた短い文。店舗名が付くこともある
memo    : 予定・約束・期日・支払い・請求・取引先とのやり取りの記録など、「覚えておいてほしい事実や予定」を書いている文。「来週A社に見積もり」「25日に家賃の支払い」「明日B社と打ち合わせ」など
schedule: 予定を「見たい・教えて」という照会。「今週の予定は？」「田中さんの来週の予定」「みんな何入ってる？」など
done    : 何かが「終わった・完了した・済んだ」という報告。「A社の件終わった」「家賃払った」など
stats   : 自分の販売実績を知りたい。「今月の実績は？」「今日何件だっけ」など
list    : 自分の未完了メモ・予定を「見せて」「一覧」「何がある」と確認したい文
delete  : メモや予定を「消して」「削除して」「取り消して」と明確に頼んでいる文（相談で頼んでいても delete にする）
consult : 質問・相談・悩み・意見を求めている・雑談・報告への返事など、「返事や助言がほしい」文
判断のコツ：件数と項目名だけの無機質な文は report。文章になっていて予定や約束を語っていれば memo（他人に予定を入れる依頼「田中さんに来週B社訪問入れて」も memo）。問いかけや気持ちが入っていれば consult。
${inSession ? '注意：この人は直前まで相談中です。件数報告でなければ consult にしてください。' : '迷ったら consult。'}`;
  const out = (await claude(system, [{ role: 'user', content: text }], 5)).toLowerCase();
  for (const k of ['report', 'memo', 'schedule', 'done', 'stats', 'list', 'delete'] as Intent[]) if (out.startsWith(k)) return k;
  return 'consult';
}

// ── 本人の状況をFirestoreから集める（アドバイスの材料）─────
async function gatherContext(lineUserId: string, uid: string | null): Promise<string> {
  const db = getFirestore();
  const parts: string[] = [];
  try {
    const memoSnap = await db.collection('work_memos')
      .where('status', '==', 'open').where('createdBy', '==', lineUserId).limit(15).get();
    if (!memoSnap.empty) {
      parts.push('【本人が登録している未完了メモ】\n' + memoSnap.docs.map((d) => {
        const m = d.data();
        return `- ${m.title}${m.dueDate ? `（期日${m.dueDate}）` : ''}${m.counterparty ? ` 相手:${m.counterparty}` : ''}`;
      }).join('\n'));
    }
  } catch {}
  if (uid && !uid.startsWith('guest_')) {
    try {
      const today = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const rep = await db.collection('salesReports').doc(uid).collection('daily').doc(today).get();
      if (rep.exists) {
        const d = rep.data()!;
        const total = (d.entries || []).reduce((s: number, e: any) =>
          s + ['newContract','deviceChange','mnpIn','portIn','netLine','creditCardNormal','creditCardGold','energy','gas']
            .reduce((a, k) => a + (e[k] || 0), 0), 0);
        parts.push(`【今日の実績】${d.storeName || ''} 合計${total}件`);
      }
    } catch {}
  }
  return parts.join('\n\n');
}

// ── 相談に返答 ─────────────────────────────────────────
export async function handleConsult(text: string, lineUserId: string, userName: string, uid: string | null): Promise<string> {
  const db = getFirestore();
  const ref = db.collection(SESSION_COLLECTION).doc(lineUserId);
  const snap = await ref.get();

  let history: Turn[] = [];
  if (snap.exists) {
    const s = snap.data()!;
    const last = s.updatedAt?.toMillis ? s.updatedAt.toMillis() : 0;
    if (Date.now() - last < SESSION_TTL_MS) history = s.history || [];
  }
  history.push({ role: 'user', content: text });
  if (history.length > MAX_TURNS) history = history.slice(-MAX_TURNS);

  const context = await gatherContext(lineUserId, uid);
  const jst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const today = jst.toISOString().slice(0, 10);

  const settings = await getSettings(lineUserId);
  const system = `${personaFor(settings, userName)}
あなたは${COMPANY.name}（${COMPANY.business}）の社員一人ひとりを支えるアシスタントです。
今話しているのは「${userName}」さんです。今日は ${today} です。

【役割】
- 仕事の相談・質問・悩みに、実務的で具体的なアドバイスをする（接客、契約手続き、見積もり、取引先対応、経理の手順、社内の人間関係、モチベーションなど）
- 仕事以外の話題でも、普通のAIアシスタントとして何でも答える（雑談、調べもの、文章作成など）
- まず相手の状況をきちんと理解する。情報が足りなければ、1〜2個だけ質問してから答える
- 一般論で終わらせず、「明日からこう動く」まで落とす
- 重要：あなたには「メモや予定を削除する」「登録する」などデータを直接操作する力はありません。「削除しました」「登録しました」のように、やっていないことをやったと答えるのは絶対に禁止です。削除や登録を頼まれたら、実行はせず「メモの削除は『削除して』とだけ送ってもらえれば処理します」のように、正しい送り方を案内してください
- LINEなので、1回の返事は300字程度まで。読みやすく、箇条書きは最小限。絵文字は使わない
- 会社の制度や数字など、あなたが知らないことは知ったかぶりせず「社長か上司に確認したほうがいい」と伝える
- 相談内容は本人とあなたの間だけのもの。ただし、下記の場合は escalate を true にする

【会社の前提知識】
${ASSISTANT.glossary}

【社長（${COMPANY.presidentName}）に伝えるべき場合 = escalate: true】
${ASSISTANT.escalationRules}
- それ以外は false。本人が話したくないことを勝手に社長に流さない

${context ? `【${userName}さんの状況】\n${context}\n` : ''}
【出力形式】
必ず以下のJSONだけを返してください（前置き・Markdown不要）：
{"reply": "本人への返事", "escalate": true|false, "summary": "escalateがtrueのとき、社長向けの要約（本人のプライバシーに配慮し、事実と必要な対応だけを3行以内で）。falseならnull"}`;

  const raw = await claude(system, history, 900);
  let reply = raw;
  let escalate = false;
  let summary: string | null = null;
  try {
    const m = raw.match(/\{[\s\S]*\}/);
    if (m) {
      const j = JSON.parse(m[0]);
      reply = j.reply || raw;
      escalate = !!j.escalate;
      summary = j.summary || null;
    }
  } catch {}

  history.push({ role: 'assistant', content: reply });
  await ref.set({ history, userName, updatedAt: FieldValue.serverTimestamp() });

  // エスカレーション：要約だけを管理者へ
  if (escalate && summary) {
    try {
      await db.collection(ESCALATION_COLLECTION).add({
        lineUserId, userName, summary, createdAt: FieldValue.serverTimestamp(),
      });
      const lineSnap = await getFirestore().collection('lineUsers').get();
      for (const d of lineSnap.docs) {
        if (COMPANY.adminNames.includes(d.data().displayName)) {
          await pushText(d.id, `🔔【社長への連絡】${userName}さんの相談から\n\n${summary}\n\n※本人には「社長に共有した」と伝えています`);
        }
      }
      reply += '\n\n（この件は社長にも要点だけ共有しました）';
    } catch (err) {
      console.error('escalation error:', err);
    }
  }

  return reply;
}

/** 相談セッションが続いているか */
export async function hasActiveConsult(lineUserId: string): Promise<boolean> {
  const snap = await getFirestore().collection(SESSION_COLLECTION).doc(lineUserId).get();
  if (!snap.exists) return false;
  const last = snap.data()!.updatedAt?.toMillis ? snap.data()!.updatedAt.toMillis() : 0;
  return Date.now() - last < SESSION_TTL_MS;
}
