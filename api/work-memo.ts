// api/work-memo.ts
// Stella "業務メモモード" — LINEでつぶやいた経理・営業メモをClaudeで解析し、Firestoreに記録する
// line-webhook.ts から handleWorkMemo() を呼び出して使う（組み込み方は同梱の手順を参照）

import { getFirestore, FieldValue } from 'firebase-admin/firestore';

// ── 設定 ─────────────────────────────────────────────
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY!;
const MODEL = 'claude-haiku-4-5';
const COLLECTION = 'work_memos';          // 記録先
const PENDING_COLLECTION = 'work_memo_pending'; // 聞き返し中の一時保存

// ── 型 ───────────────────────────────────────────────
export type MemoType = 'accounting' | 'sales' | 'task' | 'note';

export interface WorkMemo {
  type: MemoType;
  title: string;              // 一言で言うと何か（例「A社 法人契約 見積もり提出」）
  counterparty: string | null;// 取引先・相手
  dueDate: string | null;     // YYYY-MM-DD
  assignee: string | null;    // 担当者名
  amount: number | null;      // 金額（円）
  nextAction: string | null;  // 次にやること
  recurring: boolean;         // 毎月など定例っぽいか
  missing: string[];          // 足りない重要情報（'dueDate' | 'assignee' | 'counterparty'）
  question: string | null;    // 聞き返す文（missingがあるとき）
}

// ── Claude呼び出し ────────────────────────────────────
async function parseMemo(text: string, senderName: string, previousMemo?: WorkMemo, previousRaw?: string): Promise<WorkMemo> {
  const today = new Date().toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-');
  const weekday = ['日', '月', '火', '水', '木', '金', '土'][new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' })).getDay()];

  const system = `あなたは株式会社Athhaの業務アシスタントです。社員がLINEで送ってきた経理・営業に関するメモを構造化します。
今日は ${today}（${weekday}）です。送信者は「${senderName}」です。

必ず以下のJSONだけを返してください。前置きやMarkdownの\`\`\`は不要です。
{
  "type": "accounting" | "sales" | "task" | "note",
  "title": "内容を一言で",
  "counterparty": "取引先や相手。不明ならnull",
  "dueDate": "YYYY-MM-DD または null",
  "assignee": "担当者名。『自分が』『俺が』等は送信者名。不明ならnull",
  "amount": 金額の数値 または null,
  "nextAction": "次にやること。不明ならnull",
  "recurring": true | false,
  "missing": ["dueDate","assignee","counterparty"] のうち本当に必要で不明なもの,
  "question": "missingがあれば、1文で自然に聞き返す文。なければnull"
}

判断ルール:
- 「来週」「月末」「25日」などの相対表現は今日を基準に具体的な日付にする
- 経理系（支払い・請求・入金・締め・給与・税金）は accounting
- 取引先・案件・見積もり・提案・商談は sales
- 期日のある作業依頼は task、それ以外の情報共有は note
- note には missing を付けない（聞き返さない）
- accounting/task で期日が不明なら missing に dueDate
- sales で相手先が不明なら missing に counterparty
- 聞き返しは1回で済むよう、足りないものをまとめて1文で聞く`;

  const messages: { role: 'user' | 'assistant'; content: string }[] = [];
  if (previousMemo && previousRaw) {
    messages.push({ role: 'user', content: previousRaw });
    messages.push({ role: 'assistant', content: JSON.stringify(previousMemo) });
    messages.push({ role: 'user', content: `追加情報: ${text}\n上の内容にこの追加情報を反映して、JSONを返し直してください。` });
  } else {
    messages.push({ role: 'user', content: text });
  }

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({ model: MODEL, max_tokens: 600, system, messages }),
  });
  const data = await res.json();
  const raw = (data.content ?? []).map((c: any) => c.text ?? '').join('');
  const clean = raw.replace(/```json|```/g, '').trim();
  return JSON.parse(clean) as WorkMemo;
}

// ── 返信文 ────────────────────────────────────────────
const TYPE_LABEL: Record<MemoType, string> = { accounting: '経理', sales: '営業', task: 'タスク', note: 'メモ' };

function formatSaved(memo: WorkMemo): string {
  const lines = [`📝 記録しました（${TYPE_LABEL[memo.type]}）`, `・${memo.title}`];
  if (memo.counterparty) lines.push(`・相手: ${memo.counterparty}`);
  if (memo.dueDate) lines.push(`・期日: ${memo.dueDate}`);
  if (memo.assignee) lines.push(`・担当: ${memo.assignee}`);
  if (memo.amount != null) lines.push(`・金額: ${memo.amount.toLocaleString()}円`);
  if (memo.nextAction) lines.push(`・次: ${memo.nextAction}`);
  if (memo.recurring) lines.push('※ 定例っぽいので、あとで「毎月」に登録するか確認します');
  return lines.join('\n');
}

// ── メイン ────────────────────────────────────────────
/**
 * 業務メモを処理して返信テキストを返す。
 * @param text      LINEで受信したテキスト（「メモ」等の接頭辞は取り除いて渡す）
 * @param userId    LINEのuserId
 * @param userName  表示名（Stellaに登録済みの氏名が望ましい）
 * @returns         LINEに返すテキスト
 */
export async function handleWorkMemo(text: string, userId: string, userName: string): Promise<string> {
  const db = getFirestore();
  const pendingRef = db.collection(PENDING_COLLECTION).doc(userId);
  const pendingSnap = await pendingRef.get();

  let memo: WorkMemo;
  let rawText = text;

  if (pendingSnap.exists) {
    // 前回の聞き返しへの回答として扱う
    const pending = pendingSnap.data()!;
    rawText = `${pending.rawText}\n${text}`;
    memo = await parseMemo(text, userName, pending.memo as WorkMemo, pending.rawText);
  } else {
    memo = await parseMemo(text, userName);
  }

  // まだ足りないものがあれば保留して聞き返す（聞き返しは最大1回）
  if (memo.missing?.length && memo.question && !pendingSnap.exists) {
    await pendingRef.set({ memo, rawText, createdAt: FieldValue.serverTimestamp() });
    return memo.question;
  }

  // 保存
  await db.collection(COLLECTION).add({
    ...memo,
    status: 'open',
    rawText,
    createdBy: userId,
    createdByName: userName,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  if (pendingSnap.exists) await pendingRef.delete();

  return formatSaved(memo);
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
  const snap = await getFirestore().collection(PENDING_COLLECTION).doc(userId).get();
  return snap.exists;
}
