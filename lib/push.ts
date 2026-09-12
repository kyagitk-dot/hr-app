// lib/push.ts
// LINE push の共通入口（夜間ルール付き）。
//   ・夜間（QUIET_START〜QUIET_END, JST）は送らずに deferred_pushes に保留する
//   ・依頼した人（requestedBy）がいる通知は、その人が「今送って」と言えば即送信できる
//   ・保留分は朝のスケジューラーが flushDeferred() でまとめて送る
//   ・本人の操作への返事（reply）や、本人の行動をきっかけに渡すものは rawPush で直接送ってよい

import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN || '';
export const QUIET_START = 22; // この時刻から夜間扱い
export const QUIET_END = 7;    // この時刻になったら送る
const COLLECTION = 'deferred_pushes';

const jstHour = () => new Date(Date.now() + 9 * 60 * 60 * 1000).getUTCHours();
export const isQuietHour = (h: number = jstHour()) => h >= QUIET_START || h < QUIET_END;

export async function rawPush(to: string, text: string) {
  await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ACCESS_TOKEN}` },
    body: JSON.stringify({ to, messages: [{ type: 'text', text }] }),
  });
}

export type PushResult = { sent: boolean; note: string };

/**
 * 夜間でなければ即送信。夜間なら保留して、依頼者向けの案内文（note）を返す。
 * requestedBy: この通知を発生させた人の LINE userId（いれば「今送って」で即送信できる）
 */
export async function pushOrDefer(to: string, text: string, requestedBy?: string | null): Promise<PushResult> {
  if (!isQuietHour()) {
    await rawPush(to, text);
    return { sent: true, note: '' };
  }
  await getFirestore().collection(COLLECTION).add({
    to, text, requestedBy: requestedBy || null, createdAt: FieldValue.serverTimestamp(),
  });
  const note = requestedBy
    ? `\n\n🌙 今は夜間なので、相手への通知は朝${QUIET_END}時に送ります。今すぐ送るなら「今送って」と返してください。`
    : `\n\n🌙 夜間のため、通知は朝${QUIET_END}時に送ります。`;
  return { sent: false, note };
}

/** 依頼者が「今送って」と言ったとき：その人が発生させた保留分だけ即送信する */
export async function sendDeferredNow(requestedBy: string): Promise<number> {
  const db = getFirestore();
  const snap = await db.collection(COLLECTION).where('requestedBy', '==', requestedBy).get();
  let n = 0;
  for (const d of snap.docs) {
    const { to, text } = d.data();
    try { await rawPush(to, text); n++; } catch (e) { console.error('sendDeferredNow', e); }
    await d.ref.delete();
  }
  return n;
}

/** 保留分をまとめて送る（スケジューラーから毎時呼ぶ。夜間は何もしない） */
export async function flushDeferred(): Promise<number> {
  if (isQuietHour()) return 0;
  const db = getFirestore();
  const snap = await db.collection(COLLECTION).limit(200).get();
  let n = 0;
  for (const d of snap.docs) {
    const { to, text } = d.data();
    try { await rawPush(to, `（夜間に届いていたお知らせです）\n${text}`); n++; } catch (e) { console.error('flushDeferred', e); }
    await d.ref.delete();
  }
  return n;
}
