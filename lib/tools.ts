// api/tools.ts
// 啓吾くんの「道具箱」
//   ・予定の照会（全員分／特定の人／自分）
//   ・完了処理（「A社の件終わった」）
//   ・自分の実績照会（今月・今日）
//   ・他人に入れた予定の 仮 → 了解 → 確定 の受け答え
// 予定は work_memos をそのまま使う（dueDate があるものが予定）。他人に入れた予定は status='pending'。

import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { COMPANY, ASSISTANT } from './assistant-config';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY!;
const ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN || '';
const MODEL = 'claude-haiku-4-5';
const DAY = ['日', '月', '火', '水', '木', '金', '土'];

const jstNow = () => new Date(Date.now() + 9 * 60 * 60 * 1000);
const ymd = (d: Date) => d.toISOString().slice(0, 10);
function fmtDate(s: string): string {
  const d = new Date(s + 'T00:00:00Z');
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}(${DAY[d.getUTCDay()]})`;
}

export async function pushText(to: string, text: string) {
  await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ACCESS_TOKEN}` },
    body: JSON.stringify({ to, messages: [{ type: 'text', text }] }),
  });
}

async function claude(system: string, user: string, maxTokens = 400): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, system, messages: [{ role: 'user', content: user }] }),
  });
  const data = await res.json();
  return (data.content ?? []).map((c: any) => c.text ?? '').join('').trim();
}

// ── LINE連携ユーザーの名前 ⇄ ID ─────────────────────
export async function lineDirectory(): Promise<{ nameToId: Record<string, string>; idToName: Record<string, string> }> {
  const snap = await getFirestore().collection('lineUsers').get();
  const nameToId: Record<string, string> = {};
  const idToName: Record<string, string> = {};
  snap.docs.forEach((d) => {
    const n = d.data().displayName;
    idToName[d.id] = n || d.id;
    if (n) nameToId[n] = d.id;
  });
  return { nameToId, idToName };
}
/** 「田中」「田中さん」→ 登録名（部分一致） */
export function resolveName(input: string | null, nameToId: Record<string, string>): string | null {
  if (!input) return null;
  const key = input.replace(/(さん|くん|君|ちゃん|氏)$/, '').trim();
  if (!key) return null;
  if (nameToId[key]) return key;
  const hit = Object.keys(nameToId).filter((n) => n.includes(key) || key.includes(n));
  return hit.length === 1 ? hit[0] : null;
}

// ── 予定の照会 ─────────────────────────────────────────
export async function querySchedules(text: string, userName: string): Promise<string> {
  const today = ymd(jstNow());
  const { nameToId } = await lineDirectory();
  const names = Object.keys(nameToId);
  const spec = await claude(
    `予定照会の依頼文から、対象者と期間を読み取ってJSONだけを返します。今日は ${today}、依頼者は「${userName}」。
登録されている社員名: ${names.join('、')}
{"who": "all" | "me" | "社員名", "from": "YYYY-MM-DD", "to": "YYYY-MM-DD"}
・「みんな」「全員」「全体」→ all、「自分」「私」「俺」→ me、人名があればその登録名（部分一致でよい）
・期間の指定がなければ今日から7日間。「今週」は今日〜日曜、「来週」は次の月曜〜日曜、「今月」は月末まで`,
    text, 200,
  );
  let who = 'all', from = today, to = ymd(new Date(jstNow().getTime() + 7 * 86400000));
  try { const j = JSON.parse(spec.match(/\{[\s\S]*\}/)![0]); who = j.who || who; from = j.from || from; to = j.to || to; } catch {}
  const target = who === 'me' ? userName : who === 'all' ? null : (resolveName(who, nameToId) || who);

  const db = getFirestore();
  const snap = await db.collection('work_memos').where('status', 'in', ['open', 'pending']).get();
  const rows = snap.docs.map((d) => d.data()).filter((m: any) =>
    m.dueDate && m.dueDate >= from && m.dueDate <= to && (!target || m.assignee === target || (!m.assignee && m.createdByName === target)),
  ).sort((a: any, b: any) => (a.dueDate as string).localeCompare(b.dueDate));

  const label = target ? `${target}さんの予定` : '全員の予定';
  if (!rows.length) return `${fmtDate(from)}〜${fmtDate(to)} の${label}は登録されていません。`;
  const lines = rows.map((m: any) =>
    `${fmtDate(m.dueDate)} ${target ? '' : `[${m.assignee || m.createdByName}] `}${m.title}${m.counterparty ? `（${m.counterparty}）` : ''}${m.status === 'pending' ? '（未確認）' : ''}`);
  return `📅 ${fmtDate(from)}〜${fmtDate(to)} の${label}\n${lines.join('\n')}`;
}

// ── 完了処理 ───────────────────────────────────────────
export async function completeMemo(text: string, lineUserId: string, userName: string): Promise<string> {
  const db = getFirestore();
  const snap = await db.collection('work_memos').where('status', 'in', ['open', 'pending']).get();
  const mine = snap.docs.filter((d) => { const m = d.data(); return m.createdBy === lineUserId || m.assignee === userName; });
  if (!mine.length) return '未完了のメモや予定はありません。';
  const list = mine.map((d, i) => `${i + 1}. ${d.data().title}${d.data().counterparty ? `（${d.data().counterparty}）` : ''}${d.data().dueDate ? ` 期日${d.data().dueDate}` : ''}`).join('\n');
  const pick = await claude(
    `ユーザーが「終わった」と言っている件が、以下のどれに当たるかを判断し、番号だけを返してください。該当がなければ 0。
${list}`, text, 10,
  );
  const n = parseInt(pick.replace(/[^0-9]/g, ''), 10);
  if (!n || n > mine.length) return `どの件のことか分かりませんでした。今の未完了はこちらです。番号や名前で教えてください。\n${list}`;
  const doc = mine[n - 1];
  await doc.ref.update({ status: 'done', doneAt: FieldValue.serverTimestamp(), doneBy: userName });
  const m = doc.data();
  // 他人が入れた予定なら、入れた人にも知らせる
  if (m.createdBy && m.createdBy !== lineUserId) {
    try { await pushText(m.createdBy, `✅ ${userName}さんが「${m.title}」を完了にしました`); } catch {}
  }
  return `✅ 完了にしました：${m.title}${m.dueDate ? `（期日${m.dueDate}）` : ''}\nお疲れさまでした。`;
}

// ── メモ一覧の表示 ─────────────────────────────────────
export async function listMemos(lineUserId: string, userName: string): Promise<string> {
  const db = getFirestore();
  const snap = await db.collection('work_memos').where('status', 'in', ['open', 'pending']).get();
  const mine = snap.docs.filter((d) => { const m = d.data(); return m.createdBy === lineUserId || m.assignee === userName; });
  if (!mine.length) return `${userName}さんの未完了メモ・予定は今ありません。`;
  const lines = mine.map((d, i) => {
    const m = d.data();
    const parts = [m.title];
    if (m.counterparty) parts.push(`相手:${m.counterparty}`);
    if (m.dueDate) parts.push(`期日:${m.dueDate}`);
    if (m.assignee && m.assignee !== userName) parts.push(`担当:${m.assignee}`);
    if (m.status === 'pending') parts.push('（未確認）');
    return `${i + 1}. ${parts.join(' / ')}`;
  });
  return `📋 ${userName}さんの未完了メモ・予定（${mine.length}件）\n${lines.join('\n')}\n\n削除したいときは「1番を削除して」のように番号か内容で伝えてください。`;
}

// ── メモの削除（本人からの明示的な依頼のときだけ、実際にFirestoreから削除する）──
export async function deleteMemo(text: string, lineUserId: string, userName: string): Promise<string> {
  const db = getFirestore();
  const snap = await db.collection('work_memos').where('status', 'in', ['open', 'pending']).get();
  const mine = snap.docs.filter((d) => { const m = d.data(); return m.createdBy === lineUserId || m.assignee === userName; });
  if (!mine.length) return '削除できる未完了メモ・予定は今ありません。';

  const isAll = /全部|すべて|全て/.test(text);
  const list = mine.map((d, i) => `${i + 1}. ${d.data().title}${d.data().dueDate ? `（期日${d.data().dueDate}）` : ''}`).join('\n');

  if (isAll) {
    for (const d of mine) await d.ref.delete();
    return `🗑️ ${userName}さんの未完了メモ・予定を${mine.length}件、すべて削除しました。\n\n${list}`;
  }

  const pick = await claude(
    `ユーザーが「削除して」と言っている件が、以下のどれに当たるかを判断し、番号だけを返してください。該当がなければ 0。複数なら最初の1つ。\n${list}`, text, 10,
  );
  const n = parseInt(pick.replace(/[^0-9]/g, ''), 10);
  if (!n || n > mine.length) return `どの件のことか分かりませんでした。今の未完了メモ・予定はこちらです。番号か内容で教えてください。\n${list}`;
  const doc = mine[n - 1];
  const title = doc.data().title;
  await doc.ref.delete();
  return `🗑️ 削除しました：${title}`;
}

// ── 自分の実績 ─────────────────────────────────────────
const ITEM_KEYS = ['newContract', 'deviceChange', 'mnpIn', 'portIn', 'netLine', 'creditCardNormal', 'creditCardGold', 'energy', 'gas'];
const ITEM_LABEL: Record<string, string> = { newContract: '新規', deviceChange: '機変', mnpIn: 'MNP', portIn: '番号移行', netLine: 'ネット', creditCardNormal: 'クレカN', creditCardGold: 'クレカG', energy: '電気', gas: 'ガス' };
export async function myStats(text: string, uid: string | null, userName: string): Promise<string> {
  if (!uid || uid.startsWith('guest_')) return '実績の照会は社員登録済みのアカウントでのみ使えます。';
  const now = jstNow();
  const thisMonth = ymd(now).slice(0, 7);
  const wantLast = /先月/.test(text);
  const month = wantLast ? ymd(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1))).slice(0, 7) : thisMonth;
  const todayOnly = /今日|本日/.test(text) && !/今月|先月/.test(text);
  const db = getFirestore();
  const snap = await db.collection('salesReports').doc(uid).collection('daily')
    .where('date', '>=', todayOnly ? ymd(now) : `${month}-01`).where('date', '<=', todayOnly ? ymd(now) : `${month}-31`).get();
  const sum: Record<string, number> = {}; let total = 0; let peripheral = 0; const days = new Set<string>();
  snap.docs.forEach((d) => { const r = d.data(); days.add(r.date); peripheral += r.peripheralTotal || 0;
    (r.entries || []).forEach((e: any) => ITEM_KEYS.forEach((k) => { const v = e[k] || 0; if (v) { sum[k] = (sum[k] || 0) + v; total += v; } })); });
  const label = todayOnly ? '今日' : `${month.replace('-', '年')}月`;
  if (!total && !peripheral) return `${label}の実績はまだ登録されていません。`;
  const items = ITEM_KEYS.filter((k) => sum[k]).map((k) => `${ITEM_LABEL[k]}${sum[k]}`).join(' / ');
  return `📊 ${userName}さんの${label}の実績\n合計 ${total}件（稼働${days.size}日）\n${items}${peripheral ? `\n周辺機器 ${peripheral.toLocaleString()}円` : ''}`;
}

// ── 他人に入れた予定：本人への通知と、了解／返事の処理 ──
/** メモ保存直後に呼ぶ。担当者が別の社員なら pending にして本人へ通知する */
export async function notifyAssignee(memoId: string, memo: any, requesterLineId: string, requesterName: string): Promise<string | null> {
  if (!memo.assignee || memo.assignee === requesterName) return null;
  const { nameToId } = await lineDirectory();
  const name = resolveName(memo.assignee, nameToId);
  if (!name) return null;
  const db = getFirestore();
  await db.collection('work_memos').doc(memoId).update({ assignee: name, status: 'pending', requestedBy: requesterLineId, requestedByName: requesterName });
  await db.collection('schedule_pending').doc(nameToId[name]).set({ memoId, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  const when = memo.dueDate ? `${fmtDate(memo.dueDate)} ` : '';
  await pushText(nameToId[name], `📅 ${requesterName}さんから予定の依頼です\n${when}${memo.title}${memo.counterparty ? `（${memo.counterparty}）` : ''}${memo.nextAction ? `\n次: ${memo.nextAction}` : ''}\n\nOKなら「了解」、都合が悪ければそのまま返事してください（${requesterName}さんに伝えます）`);
  return `${name}さんに通知しました。了解の返事が来たら確定になります。`;
}

/** 本人に仮の予定があるとき、その返事を処理する。処理したら返信文、無関係なら null */
export async function handlePendingReply(text: string, lineUserId: string, userName: string): Promise<string | null> {
  const db = getFirestore();
  const pend = await db.collection('schedule_pending').doc(lineUserId).get();
  if (!pend.exists) return null;
  const memoRef = db.collection('work_memos').doc(pend.data()!.memoId);
  const memoSnap = await memoRef.get();
  if (!memoSnap.exists || memoSnap.data()!.status !== 'pending') { await pend.ref.delete(); return null; }
  const m = memoSnap.data()!;
  const t = text.trim();
  if (/^(了解|りょうかい|OK|ok|オッケー|大丈夫|いいよ|承知|はい)[。！!]?$/.test(t)) {
    await memoRef.update({ status: 'open', confirmedAt: FieldValue.serverTimestamp() });
    await pend.ref.delete();
    if (m.requestedBy) { try { await pushText(m.requestedBy, `✅ ${userName}さんが了解しました：${m.dueDate ? fmtDate(m.dueDate) + ' ' : ''}${m.title}`); } catch {} }
    return `了解、確定しました：${m.dueDate ? fmtDate(m.dueDate) + ' ' : ''}${m.title}`;
  }
  // 了解以外 → 判断はAIに（変更希望／断り／無関係）
  const j = await claude(
    `「${m.title}${m.dueDate ? '（' + m.dueDate + '）' : ''}」という予定の依頼に対する本人の返事を分類し、JSONだけを返してください。
{"kind": "change" | "decline" | "unrelated", "newDate": "YYYY-MM-DD または null", "comment": "依頼者に伝える一言"}
change=日時変更の希望、decline=できない・断り、unrelated=この予定とは無関係の話。今日は ${ymd(jstNow())}。`,
    t, 200,
  );
  let kind = 'unrelated', newDate: string | null = null, comment = t;
  try { const o = JSON.parse(j.match(/\{[\s\S]*\}/)![0]); kind = o.kind || kind; newDate = o.newDate || null; comment = o.comment || t; } catch {}
  if (kind === 'unrelated') return null;
  await pend.ref.delete();
  if (kind === 'change') {
    await memoRef.update({ dueDate: newDate || m.dueDate, status: 'open', confirmedAt: FieldValue.serverTimestamp(), changeNote: comment });
    if (m.requestedBy) { try { await pushText(m.requestedBy, `🔁 ${userName}さんから変更の希望：${m.title}\n${comment}${newDate ? `\n→ ${fmtDate(newDate)} に変更して登録しました` : ''}`); } catch {} }
    return newDate ? `${fmtDate(newDate)} に変更して登録しました。${m.requestedByName || '依頼者'}さんにも伝えています。` : `${m.requestedByName || '依頼者'}さんに伝えました。`;
  }
  await memoRef.update({ status: 'cancelled', cancelNote: comment });
  if (m.requestedBy) { try { await pushText(m.requestedBy, `❌ ${userName}さんは対応が難しいとのこと：${m.title}\n${comment}`); } catch {} }
  return `${m.requestedByName || '依頼者'}さんに伝えました。`;
}
