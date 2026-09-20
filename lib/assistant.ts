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
import { ASSISTANT, COMPANY } from './assistant-config';
import { handlePendingReply, querySchedules, completeMemo, myStats, listMemos, deleteMemo } from './tools';
import { logChat } from './chat-log';
import { createRelay, deliverRelays } from './relay';
import { handleRestaurant } from './restaurant';
import { sendDeferredNow } from './push';

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

  // 本人が話しかけてきたので、「次に話しかけてきたとき」の伝言があれば先に渡す
  try { await deliverRelays(lineUserId, 'next'); } catch (e) { console.error('deliverRelays(next)', e); }

  // 管理者用: LINEからブリーフィングを手動配信する
  if (COMPANY.adminNames.includes(userName) && /^(ブリーフィング|ブリーフ|今日のまとめ|全体まとめ)/.test(text.trim())) {
    const all = /(全員|みんな|全社|全員に)/.test(text);
    const base = process.env.BRIEF_BASE_URL || 'https://hr-app-xy1n.vercel.app';
    const tok = process.env.LINE_CHANNEL_ACCESS_TOKEN || '';
    const url = all ? `${base}/api/morning-brief?force=1` : `${base}/api/morning-brief?only=${encodeURIComponent(lineUserId)}`;
    try {
      const r = await fetch(url, { method: 'POST', headers: { 'x-brief-token': tok, 'Content-Type': 'application/json' } });
      if (!r.ok) throw new Error('status ' + r.status);
      const j: any = await r.json().catch(() => ({}));
      const who = (j?.sentTo || []).join('、');
      return finish(all
        ? `全員にブリーフィングを送りました。${who ? `\n送信先: ${who}` : ''}`
        : 'ブリーフィングをこのトークに送りました。全員に送るなら「ブリーフィング全員」と送ってください。', false, 'brief_manual', { all });
    } catch (e) {
      console.error('manual brief failed', e);
      return finish('ブリーフィングの送信に失敗しました。しばらくしてからもう一度お試しください。', false, 'brief_manual_error');
    }
  }

  // 飲食店モード（登録された人だけ）: 日報・月次の問い合わせならここで返す
  try {
    const rep = await handleRestaurant(text, lineUserId, userName);
    if (rep) return finish(rep, false, 'restaurant');
  } catch (e) { console.error('handleRestaurant', e); }

  // 「今送って」→ 夜間に保留した自分発の通知を即送信
  if (/^(今送って|今すぐ送って|夜でも送って|送っていいよ?|送ってください)[。！!]?$/.test(text.trim())) {
    const n = await sendDeferredNow(lineUserId);
    return finish(n > 0 ? `了解です、${n}件を今送りました。` : '今は保留中の通知はありません。', false, 'send_deferred_now', { n });
  }

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
  if (intent === 'list') return finish(await listMemos(lineUserId, userName), false, 'list');
  if (intent === 'delete') return finish(await deleteMemo(text, lineUserId, userName), false, 'delete');
  if (intent === 'relay') return finish(await createRelay(text, lineUserId, userName), false, 'relay');

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
