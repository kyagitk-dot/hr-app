// lib/chat-log.ts
// 启吾くんの会話を全件 chat_logs に記録する。精度調査・デバッグ用。他の社員には見せない（社長のみが確認）。

import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const COLLECTION = 'chat_logs';

export interface ChatLogEntry {
  lineUserId: string;
  userName: string;
  text: string;          // 本人が送ったもの
  intent?: string | null; // report | memo | consult | schedule | done | stats | settings | onboarding など
  reply: string | null;   // 启吾くんの返事
  meta?: Record<string, any>; // その他参考情報（エラー内容など）
}

export async function logChat(entry: ChatLogEntry): Promise<void> {
  try {
    await getFirestore().collection(COLLECTION).add({
      ...entry,
      createdAt: FieldValue.serverTimestamp(),
    });
  } catch (err) {
    console.error('logChat error:', err);
  }
}
