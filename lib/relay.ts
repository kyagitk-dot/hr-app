// lib/relay.ts
// 伝言：「〇〇さんが入店報告したら△△と伝えて」「〇〇さんに次に話しかけてきたとき△△と伝えて」を預かり、
// そのタイミングで本人に届ける。届けたら依頼者にも報告する（夜間は push.ts のルールで保留）。

import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { ASSISTANT, COMPANY } from './assistant-config';
import { lineDirectory, resolveName } from './tools';
import { pushOrDefer, rawPush } from './push';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY!;
const MODEL = 'claude-haiku-4-5';
const COLLECTION = 'relay_messages';
export type RelayTrigger = 'checkin' | 'next';

async function claude(system: string, user: string): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: MODEL, max_tokens: 400, system, messages: [{ role: 'user', content: user }] }),
  });
  const data = await res.json();
  return (data.content ?? []).filter((c: any) => c.type === 'text').map((c: any) => c.text ?? '').join('').trim();
}

/** 伝言を預かる（assistant.ts から intent='relay' で呼ばれる） */
export async function createRelay(text: string, fromLineId: string, fromName: string): Promise<string> {
  const { nameToId } = await lineDirectory();
  const names = Object.keys(nameToId).filter((n) => n !== fromName);
  const today = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const system = `あなたは「${ASSISTANT.name}」。${COMPANY.name}の社員「${fromName}」さんから預かった伝言を整理します。今日は ${today} です。
社員一覧: ${names.join('、')}
以下のJSONだけを返してください（前置き・Markdown不要）：
{"toName": "伝える相手の名前（社員一覧の中から選ぶ。特定できなければnull）", "trigger": "checkin" | "next", "message": "相手に伝える文"}
ルール:
- trigger: 「入店報告したら」「入店したら」「出勤したら」「店に着いたら」→ checkin。「次に話しかけてきたら」「今度連絡してきたら」や指定なし → next
- message: 依頼者の言葉を、相手に向けた自然な日本語に直す。数字・店舗名・固有名詞は変えない。依頼者の名前は入れない（別途「〇〇さんからの伝言」と添える）
- 「${ASSISTANT.name}」（あなた自身）は相手にしない`;
  const raw = await claude(system, text);
  let j: any = null;
  try { j = JSON.parse(raw.match(/\{[\s\S]*\}/)![0]); } catch {}
  if (!j || !j.message) return '伝言の内容をうまく読み取れませんでした。「〇〇さんが入店報告したら△△と伝えて」の形で送ってください。';
  const name = resolveName(j.toName, nameToId);
  if (!name) return '誰に伝えるか分かりませんでした。相手の名前を入れてもう一度送ってください。\n例：岡坂さんが入店報告したら「目標まで残り25台」と伝えて';
  const trigger: RelayTrigger = j.trigger === 'checkin' ? 'checkin' : 'next';
  await getFirestore().collection(COLLECTION).add({
    toLineId: nameToId[name], toName: name, fromLineId, fromName,
    message: String(j.message), trigger, status: 'waiting', createdAt: FieldValue.serverTimestamp(),
  });
  return `📨 伝言を預かりました。\n・宛先: ${name}さん\n・渡すタイミング: ${trigger === 'checkin' ? '次に入店報告があったとき' : '次に話しかけてきたとき'}\n・内容: ${j.message}\n\n渡したらお知らせします。`;
}

/**
 * 本人の行動をきっかけに、預かっている伝言を渡す。
 * trigger='checkin'（入店報告完了時）は checkin/next の両方、'next'（何か話しかけてきた時）は next だけ渡す。
 * 本人が操作している最中なので夜間でもそのまま送る。依頼者への報告は夜間ルールに従う。
 */
export async function deliverRelays(lineUserId: string, trigger: RelayTrigger): Promise<number> {
  const db = getFirestore();
  const snap = await db.collection(COLLECTION).where('toLineId', '==', lineUserId).get();
  const docs = snap.docs.filter((d) => d.data().status === 'waiting' && (trigger === 'checkin' || d.data().trigger === 'next'));
  for (const d of docs) {
    const r = d.data();
    try {
      await rawPush(lineUserId, `📨 ${r.fromName}さんからの伝言です\n\n${r.message}`);
      await d.ref.update({ status: 'delivered', deliveredAt: FieldValue.serverTimestamp() });
      if (r.fromLineId) await pushOrDefer(r.fromLineId, `✅ ${r.toName}さんに伝言を渡しました。\n「${r.message}」`, null);
    } catch (e) {
      console.error('deliverRelays error:', e);
    }
  }
  return docs.length;
}
