// lib/restaurant.ts
// 飲食店モード：飲食店の管理者が LINE で日報（売上・客数・食材費・人件費）を送ると記録し、
// 「今月どう？」などで進捗・FL比率を返す。携帯販売の仕組みとは別系統で動く。
//   ・対象者は restaurant_users コレクションに登録された LINE ユーザーのみ
//   ・日報は restaurant_reports/{lineUserId}/daily/{YYYY-MM-DD}

import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY!;
const MODEL = 'claude-sonnet-5';

export type DailyReport = {
  date: string;
  sales?: number;      // 売上
  customers?: number;  // 客数
  foodCost?: number;   // 食材費・仕入れ
  laborCost?: number;  // 人件費
  note?: string;
};

const jstNow = () => new Date(Date.now() + 9 * 60 * 60 * 1000);
const jstToday = () => jstNow().toISOString().slice(0, 10);
const yen = (n: number) => `${Math.round(n).toLocaleString('ja-JP')}円`;

/** この人が飲食店モードの対象か */
export async function isRestaurantUser(lineUserId: string): Promise<boolean> {
  const snap = await getFirestore().collection('restaurant_users').doc(lineUserId).get();
  return snap.exists && snap.data()?.active !== false;
}

async function claude(system: string, user: string): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: MODEL, max_tokens: 4000, system, messages: [{ role: 'user', content: user }] }),
  });
  const data = await res.json();
  if (!res.ok || data.error) {
    console.error('restaurant claude error:', res.status, JSON.stringify(data.error ?? data).slice(0, 400));
    throw new Error('api error');
  }
  return (data.content ?? []).filter((c: any) => c.type === 'text').map((c: any) => c.text ?? '').join('').trim();
}

/** 日報の文を解析して {date, sales, customers, foodCost, laborCost} を得る */
async function parseDaily(text: string): Promise<DailyReport | null> {
  const system = `飲食店の日報メッセージから数値を読み取り、JSONだけを返してください（前置き・Markdown不要）。今日は ${jstToday()} です。
{"isReport": true/false, "date": "YYYY-MM-DD", "sales": 数値かnull, "customers": 数値かnull, "foodCost": 数値かnull, "laborCost": 数値かnull, "note": "補足かnull"}
ルール:
- 売上・客数・食材費(仕入れ)・人件費のいずれかの数値が含まれていれば isReport は true。含まれなければ false
- 「32万」は320000、「3.2万」は32000のように円単位の数値へ直す
- 日付の指定がなければ today を使う。「昨日」なら前日
- 質問文（「今月どう？」など）は isReport を false にする`;
  try {
    const raw = await claude(system, text);
    const j = JSON.parse(raw.match(/\{[\s\S]*\}/)![0]);
    if (!j.isReport) return null;
    return { date: j.date || jstToday(), sales: j.sales ?? undefined, customers: j.customers ?? undefined, foodCost: j.foodCost ?? undefined, laborCost: j.laborCost ?? undefined, note: j.note ?? undefined };
  } catch (e) {
    console.error('parseDaily', e);
    return null;
  }
}

/** 日報を保存して確認メッセージを返す */
async function saveDaily(lineUserId: string, r: DailyReport): Promise<string> {
  const ref = getFirestore().collection('restaurant_reports').doc(lineUserId).collection('daily').doc(r.date);
  const prev = (await ref.get()).data() || {};
  const merged: any = { date: r.date, updatedAt: FieldValue.serverTimestamp() };
  for (const k of ['sales', 'customers', 'foodCost', 'laborCost', 'note'] as const) {
    const v = (r as any)[k];
    if (v !== undefined && v !== null) merged[k] = v; else if (prev[k] !== undefined) merged[k] = prev[k];
  }
  await ref.set(merged, { merge: true });

  const lines = [`📝 ${r.date} の日報を記録しました`];
  if (merged.sales != null) lines.push(`・売上: ${yen(merged.sales)}`);
  if (merged.customers != null) lines.push(`・客数: ${merged.customers}人`);
  if (merged.sales != null && merged.customers) lines.push(`・客単価: ${yen(merged.sales / merged.customers)}`);
  if (merged.foodCost != null) lines.push(`・食材費: ${yen(merged.foodCost)}`);
  if (merged.laborCost != null) lines.push(`・人件費: ${yen(merged.laborCost)}`);
  if (merged.sales && (merged.foodCost != null || merged.laborCost != null)) {
    const fl = ((merged.foodCost || 0) + (merged.laborCost || 0)) / merged.sales * 100;
    lines.push(`・FL比率: ${fl.toFixed(1)}%${fl > 60 ? ' ⚠️ 60%を超えています' : ''}`);
  }
  const missing = (['sales', 'customers', 'foodCost', 'laborCost'] as const).filter(k => merged[k] == null);
  const LABEL: any = { sales: '売上', customers: '客数', foodCost: '食材費', laborCost: '人件費' };
  if (missing.length) lines.push(`\n未入力: ${missing.map(k => LABEL[k]).join('・')}（あとから送れば追記されます）`);
  return lines.join('\n');
}

/** 月次の集計を返す（month は YYYY-MM） */
export async function monthlySummary(lineUserId: string, month: string): Promise<string> {
  const snap = await getFirestore().collection('restaurant_reports').doc(lineUserId).collection('daily').get();
  const rows = snap.docs.map(d => d.data() as any).filter(r => String(r.date).startsWith(month)).sort((a, b) => a.date.localeCompare(b.date));
  if (!rows.length) return `${month} の日報はまだありません。`;
  const sum = (k: string) => rows.reduce((t, r) => t + (r[k] || 0), 0);
  const sales = sum('sales'), customers = sum('customers'), food = sum('foodCost'), labor = sum('laborCost');
  const days = rows.filter(r => r.sales != null).length;
  const out = [`📊 ${month} の実績（${days}日分）`, `・売上: ${yen(sales)}`, `・客数: ${customers}人`];
  if (customers) out.push(`・客単価: ${yen(sales / customers)}`);
  if (days) out.push(`・1日平均: ${yen(sales / days)}`);
  if (sales) {
    if (food) out.push(`・原価率: ${(food / sales * 100).toFixed(1)}%`);
    if (labor) out.push(`・人件費率: ${(labor / sales * 100).toFixed(1)}%`);
    if (food || labor) {
      const fl = (food + labor) / sales * 100;
      out.push(`・FL比率: ${fl.toFixed(1)}%${fl > 60 ? ' ⚠️' : ''}`);
    }
  }
  // 着地見込み（今月なら）
  const today = jstToday();
  if (month === today.slice(0, 7) && days) {
    const dim = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate();
    out.push(`・このペースでの着地見込み: ${yen(sales / days * dim)}`);
  }
  return out.join('\n');
}

/** 未入力の日を探す（直近14日） */
export async function missingDays(lineUserId: string): Promise<string[]> {
  const snap = await getFirestore().collection('restaurant_reports').doc(lineUserId).collection('daily').get();
  const have = new Set(snap.docs.filter(d => (d.data() as any).sales != null).map(d => d.id));
  const out: string[] = [];
  for (let i = 1; i <= 14; i++) {
    const d = new Date(jstNow().getTime() - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    if (!have.has(d)) out.push(d);
  }
  return out;
}

/**
 * 飲食店モードの入口。処理したら返信文、対象外なら null を返す。
 */
export async function handleRestaurant(text: string, lineUserId: string): Promise<string | null> {
  if (!(await isRestaurantUser(lineUserId))) return null;
  const t = text.trim();

  // 月次の問い合わせ
  if (/(今月|先月|今月の|売上|実績).*(どう|どんな|教えて|状況|進捗)|^(今月|先月)(どう|は)?[？?]?$/.test(t)) {
    const now = jstNow();
    const isLast = /先月/.test(t);
    const d = new Date(now.getTime());
    if (isLast) d.setUTCMonth(d.getUTCMonth() - 1);
    return await monthlySummary(lineUserId, d.toISOString().slice(0, 7));
  }

  // 未入力の確認
  if (/(未入力|抜け|入れ忘れ|入力してない)/.test(t)) {
    const miss = await missingDays(lineUserId);
    return miss.length ? `未入力の日（直近14日）:\n${miss.join('\n')}` : '直近14日の未入力はありません。';
  }

  // 日報として読めるか
  const r = await parseDaily(t);
  if (r) return await saveDaily(lineUserId, r);

  return null; // 日報でも問い合わせでもない → 通常の相談・メモへ
}
