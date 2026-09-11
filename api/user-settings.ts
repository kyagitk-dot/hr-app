// api/user-settings.ts
// 本人ごとの設定（呼び方・口調・まとめの時刻/曜日・声掛けの回数）を Firestore に持ち、
// 会話の中で聞いて保存する／自由文から変更を読み取る。

import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { ASSISTANT, DEFAULT_USER_SETTINGS, TONE_LABEL, DAY_LABEL } from './assistant-config';

const COLLECTION = 'assistant_settings';
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY!;
const MODEL = 'claude-haiku-4-5';

export type UserSettings = typeof DEFAULT_USER_SETTINGS;

export async function getSettings(lineUserId: string): Promise<UserSettings> {
  const snap = await getFirestore().collection(COLLECTION).doc(lineUserId).get();
  return { ...DEFAULT_USER_SETTINGS, ...(snap.exists ? (snap.data() as Partial<UserSettings>) : {}) };
}

export async function saveSettings(lineUserId: string, patch: Partial<UserSettings>) {
  await getFirestore().collection(COLLECTION).doc(lineUserId)
    .set({ ...patch, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
}

export function describeSettings(s: UserSettings): string {
  const days = s.briefDays.length === 7 ? '毎日' : s.briefDays.map((d) => DAY_LABEL[d]).join('・') + '曜';
  const nudge = s.nudgePerWeek === 0 ? 'なし' : `週${s.nudgePerWeek}回くらい`;
  return [
    `・呼び方: ${s.nickname || '名前＋さん'}`,
    `・口調: ${TONE_LABEL[s.tone]}`,
    `・朝のまとめ: ${days} ${s.briefHour}時ごろ`,
    `・声掛け: ${nudge}`,
  ].join('\n');
}

/** 初回に本人へ投げる設定ヒアリングの文 */
export function onboardingQuestion(userName: string): string {
  return `ところで、${userName}さんとのやり取りの仕方をちょっとだけ教えてください。
1. 呼び方はどうしましょう？（「${userName}さん」のままでOKなら「そのままで」）
2. 口調は丁寧がいいですか、フランクがいいですか？
3. 予定や相談のまとめは、朝の何時ごろに届くとちょうどいいですか？
4. しばらく連絡がないとき、私から声をかけてもいいですか？（週1回・週2回・いらない、など）
まとめて一言で返してもらえれば大丈夫です。あとからいつでも「口調フランクにして」「まとめは7時にして」で変えられます。`;
}

/**
 * 自由文から設定の変更を読み取る。設定に関する内容がなければ null。
 * 例：「7時にして」「声掛けはいらない」「フランクでいいよ」「呼び方はコウでいい」
 */
export async function parseSettingsFromText(text: string, current: UserSettings, userName: string): Promise<{ patch: Partial<UserSettings>; reply: string } | null> {
  const system = `あなたは${ASSISTANT.name}というAIアシスタントの設定係です。ユーザー「${userName}」さんの発言から、以下の設定の変更希望を読み取ってJSONで返します。
現在の設定: ${JSON.stringify(current)}

設定項目:
- nickname: 呼び方（文字列。「そのままで」「今のまま」なら現在値を維持。「さん」「くん」など敬称も含めて保存）
- tone: "polite"(丁寧) | "normal"(ふつう) | "casual"(フランク・タメ口)
- briefHour: 朝のまとめの時刻 0〜23 の整数（「朝7時」→7、「昼」→12、「夜8時」→20）
- briefDays: 送る曜日の配列（0=日,1=月,...,6=土）。「平日だけ」→[1,2,3,4,5]、「毎日」→[0,1,2,3,4,5,6]、「土日はいらない」→平日
- nudgePerWeek: 声掛けの週あたり回数 0〜3（「いらない」「なし」→0、「週1」→1、「週2」→2、「たまに」→1、「好きなだけ」→3）

ルール:
- 発言に含まれる項目だけ patch に入れる。含まれない項目は入れない
- 設定に関する内容が全くなければ {"patch": null, "reply": null} を返す
- reply には変更を確認する短い一言（例「了解、朝7時にしますね」）。複数変わったら1文にまとめる
必ずJSONだけを返してください：{"patch": {...} | null, "reply": "..." | null}`;
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: MODEL, max_tokens: 400, system, messages: [{ role: 'user', content: text }] }),
  });
  const data = await res.json();
  const raw = (data.content ?? []).map((c: any) => c.text ?? '').join('');
  try {
    const j = JSON.parse(raw.match(/\{[\s\S]*\}/)![0]);
    if (!j.patch || Object.keys(j.patch).length === 0) return null;
    const patch: Partial<UserSettings> = {};
    if (typeof j.patch.nickname === 'string' && j.patch.nickname.trim()) patch.nickname = j.patch.nickname.trim();
    if (['polite', 'normal', 'casual'].includes(j.patch.tone)) patch.tone = j.patch.tone;
    if (Number.isInteger(j.patch.briefHour) && j.patch.briefHour >= 0 && j.patch.briefHour <= 23) patch.briefHour = j.patch.briefHour;
    if (Array.isArray(j.patch.briefDays)) patch.briefDays = j.patch.briefDays.filter((d: any) => Number.isInteger(d) && d >= 0 && d <= 6);
    if (Number.isInteger(j.patch.nudgePerWeek)) patch.nudgePerWeek = Math.max(0, Math.min(3, j.patch.nudgePerWeek));
    if (Object.keys(patch).length === 0) return null;
    return { patch, reply: j.reply || '設定を更新しました。' };
  } catch {
    return null;
  }
}

/** 本人設定を反映した「人格」の説明文（各AI呼び出しの system に差し込む） */
export function personaFor(s: UserSettings, userName: string): string {
  const call = s.nickname || `${userName}さん`;
  const tone =
    s.tone === 'polite' ? '丁寧語で、落ち着いた話し方。' :
    s.tone === 'casual' ? 'タメ口でフランク。友達の先輩のように気さくに。' :
    '基本は丁寧だけど堅くない、話しやすい先輩の口調。';
  return `あなたの名前は「${ASSISTANT.name}」。${ASSISTANT.persona}
相手のことは「${call}」と呼ぶ。口調: ${tone}`;
}
