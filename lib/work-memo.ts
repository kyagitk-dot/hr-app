// api/work-memo.ts
// Stella "業務メモモード" — LINEでつぶやいた経理・営業メモをClaudeで解析し、Firestoreに記録する
// 経験豊富な秘書のように、記録する前に「本当に必要なこと」を最大2回まで聞き返す
// line-webhook.ts から handleWorkMemo() を呼び出して使う

import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { COMPANY, ASSISTANT } from './assistant-config';
import { notifyAssignee } from './tools';

// ── 設定 ─────────────────────────────────────────────
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY!;
const MODEL = 'claude-sonnet-5'; // メモ解析だけ精度重視でSonnet（相談・判定はHaikuのまま）
const COLLECTION = 'work_memos';                 // 記録先
const PENDING_COLLECTION = 'work_memo_pending';  // 聞き返し中の一時保存
const MAX_ROUNDS = 2;                            // 聞き返しの最大回数

// ── 型 ───────────────────────────────────────────────
export type MemoType = 'accounting' | 'sales' | 'task' | 'note';

export interface WorkMemo {
  type: MemoType;
  title: string;               // 一言で言うと何か
  counterparty: string | null; // 取引先・相手
  dueDate: string | null;      // YYYY-MM-DD
  assignee: string | null;     // 担当者名
  amount: number | null;       // 金額（円）
  priority: 'high' | 'normal' | 'low';
  background: string | null;   // 背景・目的
  needs: string | null;        // 進めるために必要なもの（資料・承認・誰かの確認など）
  nextAction: string | null;   // 次にやること
  recurring: boolean;          // 定例っぽいか
  question: string | null;     // 聞き返す文（複数の質問は1つのメッセージにまとめる）
  insight: string | null;      // 記録時に添える一言（気づき・注意点）
}

// ── Claude呼び出し ────────────────────────────────────
async function parseMemo(
  history: { role: 'user' | 'assistant'; content: string }[],
  senderName: string,
  round: number,
): Promise<WorkMemo> {
  const jst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const today = jst.toISOString().slice(0, 10);
  const weekday = ['日', '月', '火', '水', '木', '金', '土'][jst.getUTCDay()];
  const canAsk = round < MAX_ROUNDS;

  const system = `あなたは「${ASSISTANT.name}」。${COMPANY.name}（${COMPANY.business}）の社長・${COMPANY.presidentName}の右腕となる、経験豊富な業務アシスタントです。
社員がLINEで送ってきた経理・営業に関するメモを受け取り、構造化して記録します。
今日は ${today}（${weekday}）です。送信者は「${senderName}」です。

【あなたの姿勢】
ただ記録するのではなく、「この件をきちんと前に進めるには何を把握しておくべきか」を考えてください。
優秀な秘書なら、記録する前にこう考えます：
- この件の目的・背景は何か？（なぜ今それをやるのか）
- 期日は本当にそれでいいか？逆算して先に必要な準備はないか？
- 進めるのに必要なものは揃っているか？（資料、金額の根拠、誰かの承認や確認）
- 誰が動くのか、相手は誰か、優先度はどれくらいか
- 金額が絡むなら、いくらか・支払い方法・請求書の有無
- 過去に似た案件があったなら、同じ落とし穴はないか
ただし、聞くのは「答えによって進め方が変わる」ことだけ。形式的な確認や、送信者が明らかに把握していそうな些末なことは聞かないでください。

【聞き返しのルール】
- ${canAsk ? `聞き返しはあと${MAX_ROUNDS - round}回できます。必要なら question に、聞きたいことを1〜3個まとめて1つの自然な日本語メッセージにして入れてください（箇条書き可）。` : '聞き返しはもうできません。question は必ず null にし、分かっている情報だけで記録してください。'}
- 十分に情報が揃っている、または送信者が「そのまま登録」「これでいい」と言ったら question は null
- 送信者が答えを返してきたら、それを反映して更新したJSONを返す

【出力】
必ず以下のJSONだけを返してください。前置きやMarkdownの\`\`\`は不要です。
{
  "type": "accounting" | "sales" | "task" | "note",
  "title": "内容を一言で",
  "counterparty": "取引先や相手。不明ならnull",
  "dueDate": "YYYY-MM-DD または null",
  "assignee": "担当者名。『自分が』『俺が』等や担当の記載がなければ送信者名",
  "amount": 金額の数値 または null,
  "priority": "high" | "normal" | "low",
  "background": "目的・背景。不明ならnull",
  "needs": "進めるために必要なもの。不明ならnull",
  "nextAction": "次にやる具体的な行動。不明ならnull",
  "recurring": true | false,
  "question": "聞き返すメッセージ または null",
  "insight": "記録時に添える一言（注意点・提案・気づき）。なければnull"
}

【分類ルール】
- 「来週」「月末」「25日」などの相対表現は今日を基準に具体的な日付にする
- 経理系（支払い・請求・入金・締め・給与・税金）は accounting
- 取引先・案件・見積もり・提案・商談は sales
- 期日のある作業依頼は task、それ以外の情報共有は note
- note には基本的に聞き返さない（明らかに重要な抜けがある場合のみ）

【相手（counterparty）と場所の区別 ※間違えやすいので注意】
- counterparty に入れるのは「人」か「会社・団体」だけ（例：田中さん、A社、docomo代理店）
- 店舗名・地名・イベント会場・モール名は相手ではない（例：北花田、イオン、コロワ甲子園、ヨドバシ梅田）。場所は title か background に入れ、counterparty には入れない
- 例：「北花田で来週法人の提案」→ counterparty は null、title は「北花田での法人提案」
- 例：「A社の佐藤さんに見積もり」→ counterparty は「A社 佐藤さん」
- 判断に迷う固有名詞は counterparty に入れず、question で「〇〇は相手（人・会社）ですか、場所ですか？」と確認する

【訂正への対応】
- 送信者が「相手が違う」「日付が違う」のように訂正してきたら、指摘された項目だけを直し、他の項目や会話に出ていない人名・会社名を勝手に補わない
- 何に直すべきか分からなければ、推測せずに question で「相手は誰にしますか？」と聞く`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    // Sonnet 5 は返答前に自動で思考する分もトークンを消費するため、上限は多めに取る
    body: JSON.stringify({ model: MODEL, max_tokens: 4000, system, messages: history }),
  });
  const data = await res.json();
  if (!res.ok || data.error) {
    console.error('parseMemo API error:', res.status, JSON.stringify(data.error ?? data).slice(0, 500));
    throw new Error('api error: ' + (data.error?.message ?? res.status));
  }
  const raw = (data.content ?? []).filter((c: any) => c.type === 'text').map((c: any) => c.text ?? '').join('');
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('no json: ' + raw.slice(0, 100));
  const memo = JSON.parse(jsonMatch[0]) as WorkMemo;
  if (!canAsk) memo.question = null;
  return memo;
}

// ── 返信文 ────────────────────────────────────────────
const TYPE_LABEL: Record<MemoType, string> = { accounting: '経理', sales: '営業', task: 'タスク', note: 'メモ' };
const PRIORITY_LABEL = { high: '高', normal: '中', low: '低' };

function formatSaved(memo: WorkMemo): string {
  const lines = [`📝 記録しました（${TYPE_LABEL[memo.type]}／優先度:${PRIORITY_LABEL[memo.priority] || '中'}）`, `・${memo.title}`];
  if (memo.counterparty) lines.push(`・相手: ${memo.counterparty}`);
  if (memo.dueDate) lines.push(`・期日: ${memo.dueDate}`);
  if (memo.assignee) lines.push(`・担当: ${memo.assignee}`);
  if (memo.amount != null) lines.push(`・金額: ${memo.amount.toLocaleString()}円`);
  if (memo.background) lines.push(`・背景: ${memo.background}`);
  if (memo.needs) lines.push(`・必要: ${memo.needs}`);
  if (memo.nextAction) lines.push(`・次: ${memo.nextAction}`);
  if (memo.recurring) lines.push('※ 定例っぽいので、あとで「毎月」に登録するか確認します');
  if (memo.insight) lines.push(`\n💡 ${memo.insight}`);
  return lines.join('\n');
}

// ── メイン ────────────────────────────────────────────
/**
 * 業務メモを処理して返信テキストを返す。
 * @param text      LINEで受信したテキスト（「メモ」等の接頭辞は取り除いて渡す）
 * @param userId    LINEのuserId
 * @param userName  表示名（Stellaに登録済みの氏名が望ましい）
 */
export async function handleWorkMemo(text: string, userId: string, userName: string): Promise<string> {
  const db = getFirestore();
  const pendingRef = db.collection(PENDING_COLLECTION).doc(userId);
  const pendingSnap = await pendingRef.get();

  // 会話履歴（初回メモ → AIの質問 → 回答 → ...）を組み立てる
  let history: { role: 'user' | 'assistant'; content: string }[] = [];
  let round = 0;
  let rawText = text;

  if (pendingSnap.exists) {
    const pending = pendingSnap.data()!;
    history = pending.history || [];
    round = pending.round || 0;
    rawText = `${pending.rawText}\n${text}`;
    history.push({ role: 'user', content: text });
  } else {
    history.push({ role: 'user', content: text });
  }

  const skip = /^(そのまま登録|これでいい|登録して|ok|OK|大丈夫)$/.test(text.trim());
  const memo = await parseMemo(history, userName, skip ? MAX_ROUNDS : round);

  // 聞き返す
  if (memo.question && !skip) {
    history.push({ role: 'assistant', content: JSON.stringify(memo) });
    await pendingRef.set({
      history, round: round + 1, rawText, memo,
      createdAt: FieldValue.serverTimestamp(),
    });
    const tail = round + 1 >= MAX_ROUNDS ? '' : '\n（このまま登録する場合は「そのまま登録」と送ってください）';
    return memo.question + tail;
  }

  // 保存
  const saved = await db.collection(COLLECTION).add({
    ...memo,
    question: null,
    status: 'open',
    rawText,
    createdBy: userId,
    createdByName: userName,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  if (pendingSnap.exists) await pendingRef.delete();

  // 担当者が別の社員なら、仮の予定として本人に通知（了解で確定）
  let note: string | null = null;
  try { note = await notifyAssignee(saved.id, memo, userId, userName); } catch (err) { console.error('notifyAssignee error:', err); }
  return formatSaved(memo) + (note ? `\n\n📨 ${note}` : '');
}

/** 保留中の聞き返しを取り消す（ユーザーが「やめる」「キャンセル」と送ったとき用） */
export async function cancelPendingMemo(userId: string): Promise<boolean> {
  const ref = getFirestore().collection(PENDING_COLLECTION).doc(userId);
  const snap = await ref.get();
  if (!snap.exists) return false;
  await ref.delete();
  return true;
}

/** 保留中の聞き返しがあるか（line-webhook.ts の振り分けで使う） */
export async function hasPendingMemo(userId: string): Promise<boolean> {
  const ref = getFirestore().collection(PENDING_COLLECTION).doc(userId);
  const snap = await ref.get();
  if (!snap.exists) return false;
  // 30分以上返事がない聞き返しは打ち切り、入店報告などの決まった操作を優先できるようにする
  const createdAt = snap.data()!.createdAt?.toMillis ? snap.data()!.createdAt.toMillis() : 0;
  if (createdAt && Date.now() - createdAt > 30 * 60 * 1000) {
    await ref.delete();
    return false;
  }
  return true;
}
