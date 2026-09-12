// lib/chat-log.ts
// 啓吾くんの会話を全件 chat_logs に記録する。精度調査・デバッグ用。他の社員には見せない（社長のみ確認）。

import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const COLLECTION = 'chat_logs';

export interface ChatLogEntry {
  lineUserId: string;
  userName: string;
  text: string;          // 本人が送ったもの
  intent?: string | null; // report | memo | consult | schedule | done | stats | settings | onboarding など
  reply: string | null;   // 啓吾くんの返事
  meta?: Record<string, any>; // その他参考情報（エラー内容など）
}

export async function logChat(entry: ChatLogEntry): Promise<void> {
  try {
    // Firestoreはundefinedの値を拒否するため、値がある項目だけを組み立てる
    const payload: Record<string, any> = {
      lineUserId: entry.lineUserId,
      userName: entry.userName,
      text: entry.text,
      reply: entry.reply,
      createdAt: FieldValue.serverTimestamp(),
    };
    if (entry.intent !== undefined && entry.intent !== null) payload.intent = entry.intent;
    if (entry.meta !== undefined && entry.meta !== null) payload.meta = entry.meta;
    await getFirestore().collection(COLLECTION).add(payload);
  } catch (err) {
    console.error('logChat error:', err);
  }
}
