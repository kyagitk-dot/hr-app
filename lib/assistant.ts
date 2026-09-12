// api/assistant.ts
// LINEで来た「コマンドでも定型でもない文章」の入口。
//   1. 設定の変更（「7時にして」「声掛けいらない」）
//   2. 初回の設定ヒアリングへの回答
//   3. 仮の予定への返事（了解／変更／断り）
//   4. 件数報告 / 業務メモ / 予定照会 / 完了 / 実績 / 相談 の判定と振り分け
// を担当し、返信文を返す。件数報告なら isReport=true を返して既存の報告フローに渡す。
// すべてのやり取りを chat_logs に記録する（精度調査用、社長のみ確認）。

import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { classifyIntent, handleConsult, hasActiveConsult } from './consult';
import { handleWorkMemo } from './work-memo';
import { getSettings, saveSettings, parseSettingsFromText, onboardingQuestion, describeSettings } from './user-settings';
import { ASSISTANT } from './assistant-config';
import { handlePendingReply, querySchedules, completeMemo, myStats } from './tools';
import { logChat } from './chat-log';

const ONBOARD_PENDING = 'assistant_onboarding'; // ヒアリング回答待ち

export async function handleFreeText(
  text: string, lineUserId: string, userName: string, uid: string | null,
): Promise<{ reply: string | null; isReport: boolean }> {
  const db = getFirestore();
  const settings = await getSettings(lineUserId);

  const finish = async (reply: string | null, isReport: boolean, intent: string, meta?: Record<string, any>) => {
    await logChat({ lineUserId, userName, text, intent, reply, meta });
    return { reply, isReport };
  };

  // 「設定」「設定を見る」→ 現在の設定を表示
  if (/^(設定|設定を?見る|設定確認)$/.test(text.trim())) {
    return finish(`今の設定はこちらです。\n${describeSettings(settings)}\n\n変えたいときは「口調フランクにして」「まとめは7時に」「声掛けはいらない」のように送ってください。`, false, 'settings_view');
  }

  // 初回ヒアリングへの回答待ちなら、まず設定として読む
  const pendingSnap = await db.collection(ONBOARD_PENDING).doc(lineUserId).get();
  if (pendingSnap.exists) {
    const parsed = await parseSettingsFromText(text, settings, userName);
    await db.collection(ONBOARD_PENDING).doc(lineUserId).delete();
    if (parsed) {
      await saveSettings(lineUserId, { ...parsed.patch, onboarded: true });
      const after = await getSettings(lineUserId);
      return finish(`${parsed.reply}\n\n${describeSettings(after)}\n\nこれでいきますね。変えたくなったらいつでも言ってください。`, false, 'onboarding_answer', { patch: parsed.patch });
    }
    // 設定として読めなければ、既定値で確定して通常処理へ
    await saveSettings(lineUserId, { onboarded: true });
  }

  // 設定変更の発言か？（短い文だけ判定して無駄なAPI呼び出しを減らす）
  if (text.length <= 60 && /(呼び方|口調|フランク|丁寧|タメ口|時に|時ごろ|時にして|まとめ|声掛け|声かけ|いらない|平日|毎日|土日|週[1-3１-３])/.test(text)) {
    const parsed = await parseSettingsFromText(text, settings, userName);
    if (parsed) {
      await saveSettings(lineUserId, { ...parsed.patch, onboarded: true });
      return finish(parsed.reply, false, 'settings_change', { patch: parsed.patch });
    }
  }

  // 他人から入れられた仮の予定への返事（了解／変更／断り）
  const pendingReply = await handlePendingReply(text, lineUserId, userName);
  if (pendingReply) return finish(pendingReply, false, 'schedule_pending_reply');

  // 意図判定 → 振り分け
  const intent = await classifyIntent(text, await hasActiveConsult(lineUserId));
  if (intent === 'report') return finish(null, true, 'report');
  if (intent === 'schedule') return finish(await querySchedules(text, userName), false, 'schedule_query');
  if (intent === 'done') return finish(await completeMemo(text, lineUserId, userName), false, 'done');
  if (intent === 'stats') return finish(await myStats(text, uid, userName), false, 'stats');

  let reply = intent === 'memo'
    ? await handleWorkMemo(text, lineUserId, userName)
    : await handleConsult(text, lineUserId, userName, uid);

  // まだ設定を聞いていない人には、返事のあとに一度だけヒアリングを添える
  // （メモの聞き返し中に混ざらないよう、相談の返事か、メモの記録完了時だけ）
  if (!settings.onboarded && (intent === 'consult' || reply.startsWith('📝'))) {
    await db.collection(ONBOARD_PENDING).doc(lineUserId).set({ createdAt: FieldValue.serverTimestamp() });
    reply += `\n\n──\n${ASSISTANT.name}です。${onboardingQuestion(userName)}`;
  }
  return finish(reply, false, intent);
}
