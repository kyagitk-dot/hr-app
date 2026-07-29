// ================================================================
// api/line-webhook.ts
// Vercel Serverless Function
// ================================================================

import crypto from "crypto";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

if (!getApps().length) {
  const serviceAccount = JSON.parse(
    process.env.FIREBASE_SERVICE_ACCOUNT_KEY || "{}"
  );
  initializeApp({ credential: cert(serviceAccount) });
}
const db = getFirestore();

const CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET || "";
const ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN || "";
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "";

// ── AI解析関数（キーワード解析で認識できない場合のフォールバック）
async function parseWithAI(text: string): Promise<any | null> {
  if (!ANTHROPIC_API_KEY) return null;
  try {
    const prompt = `以下のメッセージは携帯ショップの販売報告です。内容を解析してJSONで返してください。

メッセージ：「${text}」

以下のJSON形式のみで返答してください（説明不要）：
{
  "carrierId": "docomo|ahamo|au|softbank|ymobile|uq|other|null",
  "storeName": "店舗名またはnull",
  "agency": "代理店名またはnull",
  "entry": {
    "newContract": 数値,
    "deviceChange": 数値,
    "mnpIn": 数値,
    "portIn": 数値,
    "netLine": 数値,
    "creditCardNormal": 数値,
    "creditCardGold": 数値,
    "energy": 数値
  },
  "peripheralAmount": 数値
}

キャリア対応：docomo/ドコモ→docomo、ahamo/アハモ→ahamo、au/AU→au、softbank/ソフトバンク/SB→softbank、ymobile/ワイモバイル/ワイモバ→ymobile、uq/UQモバイル→uq、その他格安SIM→other
項目対応：新規/新規契約→newContract、機変/機種変更→deviceChange、MNP転入/乗り換え/のりかえ→mnpIn、番号移行→portIn、ネット/光/固定回線→netLine、クレカノーマル/N/ノーマル→creditCardNormal、ゴールド→creditCardGold、電気/ガス→energy、周辺機器/アクセサリ→peripheralAmount
重要：「クレカ」「カード」「クレジット」など種別が不明な場合は "creditCardAmbiguous" フィールドに件数を入れてください。ノーマル・ゴールドが明示されている場合のみ各フィールドに入れてください。
件数が不明な項目は0にしてください。carrierId が判断できない場合は null にしてください。`;

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5",
        max_tokens: 500,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const data = await res.json();
    const raw = data.content?.[0]?.text || "";
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const parsed = JSON.parse(jsonMatch[0]);
    // entryから0の項目を除去
    const entry: any = {};
    for (const [k, v] of Object.entries(parsed.entry || {})) {
      if ((v as number) > 0) entry[k] = v;
    }
    // クレカ曖昧の場合はキャリアなしでも返す
    const hasAmbiguous = (entry.creditCardAmbiguous || 0) > 0;
    if (!hasAmbiguous && (!parsed.carrierId || parsed.carrierId === "null")) return null;
    return {
      carrierId: parsed.carrierId,
      storeName: parsed.storeName || "",
      agency: parsed.agency || "",
      entry,
      peripheralAmount: parsed.peripheralAmount || 0,
    };
  } catch {
    return null;
  }
}


const CARRIER_KEYWORDS: Record<string, string> = {
  docomo: "docomo",
  ドコモ: "docomo",
  どこも: "docomo",
  dm: "docomo",
  ahamo: "ahamo",
  アハモ: "ahamo",
  あはも: "ahamo",
  au: "au",
  エーユー: "au",
  kddi: "au",
  softbank: "softbank",
  ソフトバンク: "softbank",
  そふとばんく: "softbank",
  sb: "softbank",
  ymobile: "ymobile",
  "y!mobile": "ymobile",
  ワイモバイル: "ymobile",
  ワイモバ: "ymobile",
  わいもば: "ymobile",
  uqモバイル: "uq",
  uqモバ: "uq",
  ユーキュー: "uq",
  uq: "uq",
};

const FIELD_KEYWORDS: Record<string, string> = {
  新規契約: "newContract",
  新規: "newContract",
  機種変更: "deviceChange",
  機変: "deviceChange",
  きへん: "deviceChange",
  端末変更: "deviceChange",
  mnp転入: "mnpIn",
  mnp転出: "mnpOut",
  転出: "mnpOut",
  乗り換え: "mnpIn",
  のりかえ: "mnpIn",
  乗換え: "mnpIn",
  乗換: "mnpIn",
  転換: "mnpIn",
  転入: "mnpIn",
  mnp: "mnpIn",
  ポートイン: "mnpIn",
  番号移行: "portIn",
  番移: "portIn",
  光回線: "netLine",
  ネット回線: "netLine",
  インターネット: "netLine",
  ひかり: "netLine",
  ネット: "netLine",
  wifi: "netLine",
  "wi-fi": "netLine",
  光: "netLine",
  固定: "netLine",
  固定回線: "netLine",
  BB: "netLine",
  bb: "netLine",
  ブロードバンド: "netLine",
  フレッツ: "netLine",
  paypayカード: "creditCardAmbiguous",
  ペイペイカード: "creditCardNormal",
  ぺいぺいかーど: "creditCardNormal",
  ペイカ: "creditCardNormal",
  ぺいか: "creditCardNormal",
  クレジットカード: "creditCardNormal",
  クレジット: "creditCardAmbiguous",
  クレカ: "creditCardAmbiguous",
  クレカノーマル: "creditCardNormal",
  クレカn: "creditCardNormal",
  cc: "creditCardAmbiguous",
  カード: "creditCardNormal",
  クレカゴールド: "creditCardGold",
  ゴールドカード: "creditCardGold",
  クレカg: "creditCardGold",
  ゴールド: "creditCardGold",
  電気: "energy",
  ガス: "energy",
};

// 周辺機器は「件数」ではなく「金額（円）」で別集計する
const PERIPHERAL_KEYWORDS = ["周辺機器", "アクセサリ", "機器", "付属品"];

const FIELD_LABELS: Record<string, string> = {
  newContract: "新規",
  deviceChange: "機変",
  mnpIn: "MNP転入",
  portIn: "番号移行",
  netLine: "ネット",
  creditCardNormal: "クレカ(N)",
  creditCardGold: "クレカ(G)",
  energy: "電気/ガス",
};

const CARRIER_LABELS: Record<string, string> = {
  docomo: "docomo",
  ahamo: "ahamo",
  au: "au",
  softbank: "SoftBank",
  ymobile: "ワイモバイル",
  uq: "UQモバイル",
  other: "その他",
};

async function replyMessage(replyToken: string, text: string) {
  await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ACCESS_TOKEN}`,
    },
    body: JSON.stringify({
      replyToken,
      messages: [{ type: "text", text }],
    }),
  });
}

async function pushMessage(to: string, message: any) {
  await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ACCESS_TOKEN}`,
    },
    body: JSON.stringify({
      to,
      messages: [message],
    }),
  });
}

function verifySignature(body: string, signature: string): boolean {
  const hash = crypto
    .createHmac("sha256", CHANNEL_SECRET)
    .update(body)
    .digest("base64");
  return hash === signature;
}

const todayStr = () => new Date().toLocaleDateString("sv-SE");

// テキストから日付を抽出する関数
// 「7月6日」「7/6」「6日」などに対応
function extractDateFromText(text: string): { date: string; cleanText: string } {
  // 全角数字を半角に変換
  text = text.replace(/[０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0));
  text = text.replace(/　/g, " ");
  const now = new Date();
  const year = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  // 「7月6日」「7月06日」
  const jpFull = text.match(/(\d{1,2})月(\d{1,2})日/);
  if (jpFull) {
    const month = String(parseInt(jpFull[1])).padStart(2, "0");
    const day = String(parseInt(jpFull[2])).padStart(2, "0");
    const date = `${year}-${month}-${day}`;
    const cleanText = text.replace(jpFull[0], "").trim();
    return { date, cleanText };
  }

  // 「7/6」「07/06」
  const slashFull = text.match(/(\d{1,2})\/(\d{1,2})/);
  if (slashFull) {
    const month = String(parseInt(slashFull[1])).padStart(2, "0");
    const day = String(parseInt(slashFull[2])).padStart(2, "0");
    const date = `${year}-${month}-${day}`;
    const cleanText = text.replace(slashFull[0], "").trim();
    return { date, cleanText };
  }

  // 「6日」（月は現在月）
  const jpDay = text.match(/^(\d{1,2})日[\s　]/);
  if (jpDay) {
    const month = String(currentMonth).padStart(2, "0");
    const day = String(parseInt(jpDay[1])).padStart(2, "0");
    const date = `${year}-${month}-${day}`;
    const cleanText = text.replace(jpDay[0], "").trim();
    return { date, cleanText };
  }

  return { date: todayStr(), cleanText: text };
}

function parseReportText(text: string) {
  // 全角数字・英字を半角に変換
  text = text.replace(/[０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0));
  text = text.replace(/[Ａ-Ｚａ-ｚ]/g, s => String.fromCharCode(s.charCodeAt(s.length - 1) - 0xFEE0));
  // 全角スペースを半角に
  text = text.replace(/　/g, " ");
  const lower = text.toLowerCase();

  let carrierId: string | null = null;
  for (const [kw, id] of Object.entries(CARRIER_KEYWORDS)) {
    if (lower.includes(kw.toLowerCase())) {
      carrierId = id;
      break;
    }
  }

  const entry: Record<string, number> = {};
  for (const [kw, key] of Object.entries(FIELD_KEYWORDS)) {
    const re = new RegExp(`${kw}[^0-9]{0,3}([0-9]+)`, "i");
    const m = lower.match(re);
    if (m) entry[key] = parseInt(m[1], 10);
  }

  // 周辺機器は金額（円）として別枠で抽出する
  let peripheralAmount = 0;
  for (const kw of PERIPHERAL_KEYWORDS) {
    const re = new RegExp(`${kw}[^0-9]{0,5}([0-9,]+)\\s*円?`, "i");
    const m = text.match(re);
    if (m) {
      peripheralAmount = parseInt(m[1].replace(/,/g, ""), 10);
      break;
    }
  }

  if (!carrierId && Object.keys(entry).length === 0 && peripheralAmount === 0) {
    return null;
  }

  let storeName = "";
  let agency = "";

  // 「〇〇店で」「〇〇店舗で」パターン
  const storeMatch = text.match(/(.+?(?:店|店舗))(?:で|にて|の)/);
  if (storeMatch) storeName = storeMatch[1];

  // 「〇〇エージェント」「〇〇代理店」パターン
  const agencyMatch = text.match(/(.+?(?:エージェント|代理店|ショップ|テクノロジー|サービス))/);
  if (agencyMatch) agency = agencyMatch[1];

  // 店舗名も代理店名もない場合はフラグを立てる
  const noStore = !storeName && !agency;

  return {
    carrierId: carrierId || null,
    noCarrier: !carrierId && Object.keys(entry).length > 0,
    noStore,
    entry,
    peripheralAmount,
    agency,
    storeName,
  };
}

function totalOfEntry(e: any): number {
  return [
    "newContract",
    "deviceChange",
    "mnpIn",
    "portIn",
    "netLine",
    "creditCardNormal",
    "creditCardGold",
    "energy",
  ].reduce((s, k) => s + (e[k] || 0), 0);
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.status(405).send("Method Not Allowed");
    return;
  }

  try {
    const signature = req.headers["x-line-signature"] as string;
    const rawBody = JSON.stringify(req.body);

    if (!signature || !verifySignature(rawBody, signature)) {
      res.status(401).send("Invalid signature");
      return;
    }

    const events = req.body.events || [];

    for (const event of events) {

      // ── 友だち追加時：社員か取引先か選択ボタンを送る ────
      if (event.type === "follow") {
        const lineUserId = event.source.userId;
        await pushMessage(lineUserId, {
          type: "template",
          altText: "ようこそ！社員・取引先を選択してください",
          template: {
            type: "confirm",
            text: "ようこそ！件数報告システムです。\nあなたはどちらですか？",
            actions: [
              { type: "postback", label: "社員", data: "type=employee" },
              { type: "postback", label: "取引先・業務委託", data: "type=guest" },
            ],
          },
        });
        continue;
      }

      // ── ボタンタップ（postback）───────────────────────
      if (event.type === "postback") {
        const lineUserId = event.source.userId;
        const data = event.postback.data;
        const replyToken = event.replyToken;
        if (data === "type=employee") {
          // 社員フラグを一時保存
          await db.collection("lineUsersPending").doc(lineUserId).set({type:"employee", updatedAt: new Date()});
          await replyMessage(replyToken, "社員の方はアプリに登録しているメールアドレスを送ってください。\n例：example@company.com");
        } else if (data === "type=guest") {
          // 取引先フラグを一時保存
          await db.collection("lineUsersPending").doc(lineUserId).set({type:"guest", updatedAt: new Date()});
          await replyMessage(replyToken, "取引先・業務委託の方はお名前を送ってください。\n例：田中太郎");
        }
        continue;
      }

      if (event.type !== "message" || event.message.type !== "text") continue;

      const lineUserId = event.source.userId;
      const text = (event.message.text as string).trim();
      const replyToken = event.replyToken;

      console.log("受信テキスト:", JSON.stringify(text), "文字数:", text.length);

      // ── 本人確認（紐付け）───────────────────────────────
      const linkSnap = await db.collection("lineUsers").doc(lineUserId).get();

      if (!linkSnap.exists) {
        const emailMatch = text.match(/[\w.-]+@[\w.-]+\.\w+/);
        if (emailMatch) {
          // 社員：メールアドレスで紐付け
          const email = emailMatch[0];
          const usersSnap = await db
            .collection("users")
            .where("email", "==", email)
            .limit(1)
            .get();

          if (usersSnap.empty) {
            await replyMessage(
              replyToken,
              "そのメールアドレスは社員登録されていません。アプリに登録済みのメールアドレスを送ってください。"
            );
          } else {
            const userDoc = usersSnap.docs[0];
            await db.collection("lineUsers").doc(lineUserId).set({
              uid: userDoc.id,
              email,
              displayName: userDoc.data().name || email,
              linkedAt: new Date(),
            });
            await replyMessage(
              replyToken,
              `${userDoc.data().name}さん、連携が完了しました！これから「docomo新規3件」のように送ると報告できます。`
            );
          }
        } else {
          // 未登録：pendingタイプを確認して分岐
          const pendingSnap = await db.collection("lineUsersPending").doc(lineUserId).get();
          const pendingType = pendingSnap.exists ? pendingSnap.data()!.type : null;

          const nameMatch = text.match(/^([^\s　！!？?。、\n]{2,10})$/);
          if (pendingType === "guest" && nameMatch) {
            // 取引先として登録
            const guestName = nameMatch[1];
            const guestUid = `guest_${lineUserId}`;
            await db.collection("lineUsers").doc(lineUserId).set({
              uid: guestUid,
              displayName: guestName,
              isGuest: true,
              linkedAt: new Date(),
            });
            await db.collection("lineUsersPending").doc(lineUserId).delete();
            await replyMessage(
              replyToken,
              `${guestName}さん、登録しました！\nこれから「〇〇店でdocomo新規3件」のように送ると報告できます。\n\n名前を変更したい場合は「名前変更：新しい名前」と送ってください。`
            );
          } else if (pendingType === "employee") {
            // 社員として登録を促す
            await replyMessage(replyToken, "アプリに登録しているメールアドレスを送ってください。\n例：example@company.com");
          } else {
            // pendingなし：選択ボタンを再送
            await pushMessage(lineUserId, {
              type: "template",
              altText: "社員・取引先を選択してください",
              template: {
                type: "confirm",
                text: "はじめまして！\nあなたはどちらですか？",
                actions: [
                  { type: "postback", label: "社員", data: "type=employee" },
                  { type: "postback", label: "取引先・業務委託", data: "type=guest" },
                ],
              },
            });
          }
        }
        continue;
      }

      const linkData = linkSnap.data()!;
      const uid = linkData.uid;
      const displayName = linkData.displayName;

      // 名前変更対応
      if (text === "名前変更" || text.startsWith("名前変更：") || text.startsWith("名前変更:")) {
        const newName = text.replace(/^名前変更[：:]\s*/, "").trim();
        if (newName && newName !== "名前変更") {
          await db.collection("lineUsers").doc(lineUserId).set({displayName: newName},{merge:true});
          await replyMessage(replyToken, `名前を「${newName}」に変更しました！`);
        } else {
          await replyMessage(replyToken, "新しいお名前を「名前変更：田中太郎」の形式で送ってください。");
        }
        continue;
      }

      // ── 研修後フィードバック ──────────────────────────────
      if (text.startsWith("研修後報告：") || text.startsWith("研修後報告:") || text.startsWith("研修報告：") || text.startsWith("研修報告:")) {
        const content = text.replace(/^研修[後]?報告[：:]\s*/, "").trim();
        if (!content) {
          await replyMessage(replyToken, "研修後の内容を入力してください。\n\n例：研修後報告：ロープレを実践して、MNP転入の手続き説明が5分以内にできるようになりました。お客様の不安を先に解消してからクロージングする方法も身につきました。");
          continue;
        }

        // AIでフィードバック生成
        try {
          const prompt = `以下は研修を受けたスタッフからの「研修後にできるようになったこと」の報告です。
内容を読んで、具体的で前向きなフィードバックを返してください。

【報告内容】
${content}

以下の構成で200字以内で日本語で返してください：
1. 💪 成長を認めるメッセージ（具体的に褒める）
2. 🌟 さらに伸ばすためのアドバイス（1点）
3. 🎯 次のチャレンジ提案（1点）
親しみやすく励ましのトーンで。`;

          const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {"Content-Type":"application/json","x-api-key": process.env.ANTHROPIC_API_KEY||"","anthropic-version":"2023-06-01"},
            body: JSON.stringify({model:"claude-haiku-4-5",max_tokens:600,messages:[{role:"user",content:prompt}]}),
          });
          const aiData = await aiRes.json();
          const feedback = aiData.content?.[0]?.text || "フィードバックを生成できませんでした。";

          // Firestoreに保存（lineUsers経由でuidを取得）
          const lineUserData = linkData;
          if (lineUserData?.uid && !lineUserData.uid.startsWith("guest_")) {
            const today = new Date().toLocaleDateString("sv-SE");
            await db.collection("trainingAfterReports").doc(lineUserData.uid).collection("reports").add({
              content,
              feedback,
              date: today,
              createdAt: new Date(),
            });
          }

          await replyMessage(replyToken, `【研修後フィードバック】\n\n${feedback}`);
        } catch {
          await replyMessage(replyToken, "フィードバックの生成に失敗しました。もう一度試してください。");
        }
        continue;
      }

      // ── リッチメニュー：フォーマットを見る ─────────────
      if (text.includes("フォーマット")) {
        await replyMessage(
          replyToken,
          "【報告の書き方】\n\n店舗名＋キャリア名＋件数を自由な文章で送ってください。\n\n例：\n〇〇店でdocomo新規3件、ネット回線1件\n\n複数キャリアを送りたい場合は、メッセージを分けて送ってください。"
        );
        continue;
      }

      // ── リッチメニュー：今日の実績を見る ───────────────
      if (text === "今日の実績") {
        const date = todayStr();
        const repSnap = await db
          .collection("salesReports")
          .doc(uid)
          .collection("daily")
          .doc(date)
          .get();
        if (!repSnap.exists) {
          await replyMessage(replyToken, "今日はまだ報告がありません。");
        } else {
          const data = repSnap.data()!;
          const entries: any[] = data.entries || [];
          const total = entries.reduce((s, e) => s + totalOfEntry(e), 0);

          const itemKeys = [
            "newContract",
            "deviceChange",
            "mnpIn",
            "portIn",
            "netLine",
            "creditCardNormal",
    "creditCardGold",
            "energy",
          ];

          const lines = entries
            .filter((e) => totalOfEntry(e) > 0)
            .map((e) => {
              const carrierLabel = CARRIER_LABELS[e.carrierId] || e.carrierId;
              const breakdown = itemKeys
                .filter((k) => (e[k] || 0) > 0)
                .map((k) => `${FIELD_LABELS[k]}${e[k]}件`)
                .join("、");
              return `■${carrierLabel}\n${breakdown}`;
            })
            .join("\n\n");

          const peripheralTotal = data.peripheralTotal || 0;
          const peripheralLine =
            peripheralTotal > 0
              ? `\n\n周辺機器：${peripheralTotal.toLocaleString()}円`
              : "";
          await replyMessage(
            replyToken,
            `【本日の実績】\n${lines}${peripheralLine}\n\n合計：${total}件`
          );
        }
        continue;
      }

      // ── 目標設定 ────────────────────────────────────────
      if (text.includes("目標")) {
        const date = todayStr();
        const goalEntry: Record<string, number> = {};
        for (const [kw, key] of Object.entries(FIELD_KEYWORDS)) {
          const re = new RegExp(`${kw}[^0-9]{0,3}([0-9]+)`, "i");
          const m = text.toLowerCase().match(re);
          if (m) goalEntry[key] = parseInt(m[1], 10);
        }
        if (Object.keys(goalEntry).length === 0) {
          await replyMessage(replyToken, "目標の件数が読み取れませんでした。\n\n例：目標 新規10件 MNP5件 ネット3件");
          continue;
        }
        await db.collection("goals").doc(uid).collection("daily").doc(date).set({
          uid, displayName, date, goals: goalEntry, updatedAt: new Date(),
        });
        const desc = Object.entries(goalEntry).map(([k,v])=>`${FIELD_LABELS[k]||k}：${v}件`).join("\n");
        await replyMessage(replyToken, `【本日の目標を設定しました】\n${desc}\n\n実績が入力されるとランキングに反映されます。`);
        continue;
      }

      // ── リッチメニュー：ランキングを見る ───────────────
      if (text.includes("ランキング")) {
        const date = todayStr();
        // 今日の実績を取得
        const repSnap = await db.collectionGroup("daily").get();
        const todayTotals: Record<string, {name:string; total:number}> = {};
        repSnap.forEach(doc => {
          const d = doc.data();
          if (d.date !== date) return;
          const t = (d.entries||[]).reduce((s:number,e:any)=>s+totalOfEntry(e),0);
          if (!todayTotals[d.uid]) todayTotals[d.uid] = {name:d.displayName, total:0};
          todayTotals[d.uid].total += t;
        });

        // 今日の目標を取得
        const goalSnap = await db.collectionGroup("daily").get();
        const todayGoals: Record<string, {name:string; goalTotal:number}> = {};
        goalSnap.forEach(doc => {
          const d = doc.data();
          if (!d.goals || d.date !== date) return;
          const g = Object.values(d.goals as Record<string,number>).reduce((s:number,v:number)=>s+v,0);
          todayGoals[d.uid] = {name:d.displayName, goalTotal:g};
        });

        // 目標設定者のみランキング対象
        const ranked = Object.entries(todayGoals).map(([uid,g])=>{
          const actual = todayTotals[uid]?.total || 0;
          const rate = g.goalTotal > 0 ? Math.round((actual/g.goalTotal)*100) : 0;
          const remaining = Math.max(0, g.goalTotal - actual);
          return {name:g.name, actual, goalTotal:g.goalTotal, rate, remaining};
        }).sort((a,b)=>b.rate-a.rate);

        if (ranked.length === 0) {
          await replyMessage(replyToken, "本日はまだ目標を設定しているメンバーがいません。\n\n「目標 新規10件」のように送ると目標設定できます。");
        } else {
          const lines = ranked.map((r,i)=>{
            const medal = i===0?"🥇":i===1?"🥈":i===2?"🥉":`${i+1}位`;
            return `${medal} ${r.name}\n　達成率：${r.rate}%（${r.actual}/${r.goalTotal}件）\n　残り：${r.remaining}件`;
          }).join("\n\n");
          await replyMessage(replyToken, `【本日のランキング】\n\n${lines}`);
        }
        continue;
      }

      // ── リッチメニュー：今日の報告を修正 ───────────────
      if (text.includes("修正して") || text === "修正") {
        if (text.includes("修正して")) {
          // 今日のデータを削除して入力し直せるようにする
          const date = todayStr();
          const ref = db.collection("salesReports").doc(uid).collection("daily").doc(date);
          const snap = await ref.get();
          if (snap.exists) {
            await ref.delete();
            await replyMessage(
              replyToken,
              "今日の報告をリセットしました！\nもう一度送り直してください。\n\n例：〇〇店でdocomo新規3件、ネット回線1件"
            );
          } else {
            await replyMessage(replyToken, "今日はまだ報告がないので、そのまま送ってください。");
          }
        } else {
          await replyMessage(
            replyToken,
            "修正方法は2つあります。\n\n①【上書き修正】\nもう一度同じキャリアの件数を送ると上書きされます。\n例：docomo新規5件\n\n②【全部やり直し】\n「修正して」と送ると今日の報告をリセットできます。"
          );
        }
        continue;
      }

      // ── リッチメニュー：未入力か確認 ───────────────────
      if (text.includes("未入力")) {
        const date = todayStr();
        const repSnap = await db
          .collection("salesReports")
          .doc(uid)
          .collection("daily")
          .doc(date)
          .get();
        if (!repSnap.exists) {
          await replyMessage(
            replyToken,
            "本日はまだ未入力です。「〇〇店でdocomo新規3件」のように送って報告してください。"
          );
        } else {
          await replyMessage(replyToken, "本日はすでに入力済みです。");
        }
        continue;
      }

      // ── リッチメニュー：追加報告 ─────────────────────────
      if (text === "追加報告") {
        // pending状態をセット（日付待ち）
        await db.collection("lineUsersPending").doc(lineUserId).set({
          type: "awaiting_date",
          updatedAt: new Date(),
        });
        await replyMessage(
          replyToken,
          "何日の報告ですか？\n\n例：7月6日\n例：今日\n例：7/6"
        );
        continue;
      }

      // ── pending：日付待ち状態の処理 ──────────────────────
      const pendingSnap2 = await db.collection("lineUsersPending").doc(lineUserId).get();
      const pendingType2 = pendingSnap2.exists ? pendingSnap2.data()!.type : null;

      // ── クレカ種別待ち ────────────────────────────────────
      if (pendingType2 === "awaiting_card_type") {
        const pendingData = pendingSnap2.data()!;
        const isNormal = text.includes("ノーマル") || text.includes("n") || text === "N" || text === "n" || text.includes("普通") || text.includes("通常");
        const isGold = text.includes("ゴールド") || text.includes("gold") || text === "G" || text === "g";
        if (isNormal || isGold) {
          const cardKey = isGold ? "creditCardGold" : "creditCardNormal";
          const cardLabel = isGold ? "ゴールド" : "ノーマル";
          const count = pendingData.ambiguousCount || 1;
          const parsed = pendingData.parsedData;
          const targetDate = pendingData.date || todayStr();
          // エントリーを修正して保存
          const ref = db.collection("salesReports").doc(uid).collection("daily").doc(targetDate);
          const snap2 = await ref.get();
          const existing2 = snap2.exists ? snap2.data()! : {entries:[], peripheralTotal:0};
          const entries2: any[] = existing2.entries || [];
          const safeCarrierId2 = parsed.carrierId || "other";
          const idx2 = entries2.findIndex((e:any)=>e.carrierId===safeCarrierId2);
          const emptyEntry2 = (carrierId:string)=>({carrierId,newContract:0,deviceChange:0,mnpIn:0,portIn:0,netLine:0,creditCardNormal:0,creditCardGold:0,energy:0});
          const newEntry = {...(idx2>=0?entries2[idx2]:emptyEntry2(safeCarrierId2)),[cardKey]:count,...(parsed.entry||{})};
          delete (newEntry as any).creditCardAmbiguous;
          if(idx2>=0) entries2[idx2]=newEntry; else entries2.push(newEntry);
          await ref.set({uid,displayName,date:targetDate,entries:entries2,peripheralTotal:existing2.peripheralTotal||0,agency:parsed.agency||existing2.agency||"",storeName:parsed.storeName||existing2.storeName||"",updatedAt:new Date(),createdAt:snap2.exists?existing2.createdAt:new Date()},{merge:true});
          await db.collection("lineUsersPending").doc(lineUserId).delete();
          const carrierLabel = CARRIER_LABELS[safeCarrierId2]||safeCarrierId2;
          await replyMessage(replyToken, `ありがとうございます！\n${targetDate===todayStr()?"":"【"+targetDate+"の報告】\n"}記録しました！\n${carrierLabel}\nクレカ（${cardLabel}）：${count}件\nアプリでも確認できます。`);
        } else {
          await replyMessage(replyToken, "「ノーマル」または「ゴールド」と返信してください。");
        }
        continue;
      }

      if (pendingType2 === "awaiting_date") {
        let targetDate = todayStr();
        if (text === "今日" || text === "本日") {
          targetDate = todayStr();
        } else {
          const { date: extracted } = extractDateFromText(text + " dummy");
          if (extracted !== todayStr() || text.match(/\d+月\d+日|\d+\/\d+/)) {
            targetDate = extracted;
          }
        }
        // 日付を保存して件数待ち状態へ
        await db.collection("lineUsersPending").doc(lineUserId).set({
          type: "awaiting_report",
          targetDate,
          updatedAt: new Date(),
        });
        const repSnap = await db.collection("salesReports").doc(uid).collection("daily").doc(targetDate).get();
        const existingTotal = repSnap.exists
          ? (repSnap.data()!.entries || []).reduce((s: number, e: any) => s + totalOfEntry(e), 0)
          : 0;
        const dateLabel = targetDate === todayStr() ? "今日" : targetDate;
        await replyMessage(
          replyToken,
          `${dateLabel}の報告ですね！${existingTotal > 0 ? `\n現在の合計：${existingTotal}件\n` : ""}\n報告内容を送ってください。\n\n例：〇〇店でdocomo新規3件 MNP1件\n例：au クレカ2件`
        );
        continue;
      }

      if (pendingType2 === "awaiting_report") {
        const targetDate = pendingSnap2.data()!.targetDate || todayStr();
        // pendingを削除して通常の報告処理へ（dateをoverrideする）
        await db.collection("lineUsersPending").doc(lineUserId).delete();
        // textをそのまま通常フローで処理するためにdateを上書き
        // ↓以下の通常報告フローで使うdateをtargetDateに設定
        const overrideDate = targetDate;

        const { cleanText: cleanTextForReport } = extractDateFromText(text);
        const parsedReport = parseReportText(cleanTextForReport) || parseReportText(text);
        if (!parsedReport || !parsedReport.carrierId) {
          await replyMessage(replyToken, "報告内容を読み取れませんでした。\n\n例：docomo新規3件 MNP1件\n例：au クレカ2件");
          continue;
        }

        const ref = db.collection("salesReports").doc(uid).collection("daily").doc(overrideDate);
        const snap = await ref.get();
        const existing = snap.exists ? snap.data()! : { entries: [], peripheralTotal: 0 };
        const entries: any[] = existing.entries || [];
        const safeCarrierId = parsedReport.carrierId || "other";
        const idx = entries.findIndex((e: any) => e.carrierId === safeCarrierId);
        const emptyEntry = (carrierId: string) => ({carrierId,newContract:0,deviceChange:0,mnpIn:0,portIn:0,netLine:0,creditCard:0,energy:0});
        if (idx >= 0) entries[idx] = {...entries[idx], ...parsedReport.entry};
        else entries.push({...emptyEntry(safeCarrierId), ...parsedReport.entry});

        await ref.set({
          uid, displayName,
          agency: parsedReport.agency || existing.agency || "",
          storeName: parsedReport.storeName || existing.storeName || "",
          date: overrideDate, entries,
          peripheralTotal: (existing.peripheralTotal || 0) + (parsedReport.peripheralAmount || 0),
          updatedAt: new Date(),
          createdAt: snap.exists ? existing.createdAt : new Date(),
        }, { merge: true });

        const parts = Object.entries(parsedReport.entry)
          .filter(([, v]) => (v as number) > 0)
          .map(([k, v]) => `${FIELD_LABELS[k] || k}：${v}件`);
        const dateLabel = overrideDate === todayStr() ? "今日" : overrideDate;
        await replyMessage(replyToken, `【${dateLabel}の報告】記録しました！\n${CARRIER_LABELS[safeCarrierId] || safeCarrierId}\n${parts.join("\n")}\nアプリでも確認できます。`);
        continue;
      }

      // ── 旧コマンド互換（実績／今日）─────────────────────
      if (text.includes("実績") || text.includes("今日")) {
        const date = todayStr();
        const repSnap = await db
          .collection("salesReports")
          .doc(uid)
          .collection("daily")
          .doc(date)
          .get();
        if (!repSnap.exists) {
          await replyMessage(replyToken, "今日はまだ報告がありません。");
        } else {
          const data = repSnap.data()!;
          const total = (data.entries || []).reduce(
            (s: number, e: any) => s + totalOfEntry(e),
            0
          );
          await replyMessage(replyToken, `本日の合計：${total}件です。`);
        }
        continue;
      }

      // ── 件数報告として解析（AI優先）────────────────────
      const { date, cleanText } = extractDateFromText(text);
      // まずAI解析を試みる
      let parsed = await parseWithAI(text);
      // AI失敗時のみキーワード解析にフォールバック
      if (!parsed) {
        parsed = parseReportText(cleanText) || parseReportText(text);
      }
      if (!parsed) {
        await replyMessage(
          replyToken,
          "うまく読み取れませんでした。例：「〇〇店でdocomo新規3件、ネット回線1件」のように送ってください。"
        );
        continue;
      }

      // キャリアが不明な場合は登録せず聞き返す
      if (parsed.noCarrier) {
        const itemDesc = Object.entries(parsed.entry)
          .map(([k, v]) => `${FIELD_LABELS[k]||k}${v}件`)
          .join("、");
        await replyMessage(
          replyToken,
          `「${itemDesc}」を受け取りましたが、キャリア名が含まれていません。\n\nどのキャリアですか？キャリア名を付けて送り直してください。\n\n例：docomo ${text}`
        );
        continue;
      }

      // キャリアはわかるが項目が読み取れなかった場合
      if (parsed.carrierId && Object.keys(parsed.entry).length === 0 && parsed.peripheralAmount === 0) {
        await replyMessage(
          replyToken,
          `「${CARRIER_LABELS[parsed.carrierId]||parsed.carrierId}」は認識できましたが、件数や項目が読み取れませんでした。\n\n以下のように送ってください。\n例：〇〇店でdocomo 新規3件 MNP1件`
        );
        continue;
      }

      // キャリアはわかるが項目が読み取れなかった場合
      if (parsed.carrierId && Object.keys(parsed.entry).length === 0 && parsed.peripheralAmount === 0) {
        await replyMessage(
          replyToken,
          `「${CARRIER_LABELS[parsed.carrierId]||parsed.carrierId}」は認識できましたが、件数や項目が読み取れませんでした。\n\n以下のように送ってください。\n例：〇〇店でdocomo 新規3件 MNP1件`
        );
        continue;
      }

      const ref = db
        .collection("salesReports")
        .doc(uid)
        .collection("daily")
        .doc(date);
      const snap = await ref.get();

      // ── クレカの種別が不明な場合は聞き返す ──────────────
      const ambiguousCountEarly = (parsed.entry as any)?.creditCardAmbiguous;
      if (ambiguousCountEarly && ambiguousCountEarly > 0) {
        // キャリア未指定なら今日の直前キャリアを引き継ぐ
        if (!parsed.carrierId && snap.exists) {
          const existingData = snap.data()!;
          if (existingData.entries?.length > 0) {
            parsed.carrierId = existingData.entries[existingData.entries.length - 1].carrierId;
          }
          if (existingData.storeName) parsed.storeName = existingData.storeName;
          if (existingData.agency) parsed.agency = existingData.agency;
        }
        await db.collection("lineUsersPending").doc(lineUserId).set({
          type: "awaiting_card_type",
          pendingText: text,
          ambiguousCount: ambiguousCountEarly,
          parsedData: parsed,
          date,
          updatedAt: new Date(),
        });
        await replyMessage(
          replyToken,
          `クレカ${ambiguousCountEarly}件を受け取りました！\nノーマルですか？ゴールドですか？\n\n「ノーマル」または「ゴールド」と返信してください。`
        );
        continue;
      }

      // 代理店名・店舗名がない場合の処理
      if (parsed.noStore) {
        // 今日すでに店舗名が登録済みなら引き継ぐ
        if (snap.exists) {
          const existingData = snap.data()!;
          if (existingData.storeName || existingData.agency) {
            parsed.storeName = existingData.storeName || "";
            parsed.agency = existingData.agency || "";
            // キャリアも未指定なら直前のキャリアを引き継ぐ
            if (!parsed.carrierId && existingData.entries?.length > 0) {
              parsed.carrierId = existingData.entries[existingData.entries.length - 1].carrierId;
            }
          } else {
            // 今日のデータはあるが店舗名がない→聞き返す
            const carrierLabel = CARRIER_LABELS[parsed.carrierId||""] || parsed.carrierId || "";
            const itemDesc = Object.entries(parsed.entry)
              .map(([k,v])=>`${FIELD_LABELS[k]||k}${v}件`)
              .join("、");
            await replyMessage(
              replyToken,
              `${carrierLabel ? `「${carrierLabel} ${itemDesc}」` : `「${itemDesc}」`}を受け取りましたが、代理店名・店舗名が含まれていません。\n\n店舗名を含めて送り直してください。\n\n例：〇〇店で${carrierLabel} ${itemDesc}`
            );
            continue;
          }
        } else {
          // 今日初めての報告で店舗名なし→聞き返す
          const carrierLabel = CARRIER_LABELS[parsed.carrierId||""] || parsed.carrierId || "";
          const itemDesc = Object.entries(parsed.entry)
            .map(([k,v])=>`${FIELD_LABELS[k]||k}${v}件`)
            .join("、");
          await replyMessage(
            replyToken,
            `${carrierLabel ? `「${carrierLabel} ${itemDesc}」` : `「${itemDesc}」`}を受け取りましたが、代理店名・店舗名が含まれていません。\n\n店舗名を含めて送り直してください。\n\n例：〇〇店で${carrierLabel} ${itemDesc}`
          );
          continue;
        }
      }

      const existing = snap.exists ? snap.data()! : { entries: [], peripheralTotal: 0 };
      const entries: any[] = existing.entries || [];

      // ── クレカの種別が不明な場合は聞き返す ──────────────
      const ambiguousCount = (parsed.entry as any)?.creditCardAmbiguous;
      if (ambiguousCount && ambiguousCount > 0) {
        // pending状態に保存してから聞き返す
        await db.collection("lineUsersPending").doc(lineUserId).set({
          type: "awaiting_card_type",
          pendingText: text,
          ambiguousCount,
          parsedData: parsed,
          date,
          updatedAt: new Date(),
        });
        await replyMessage(
          replyToken,
          `クレカ${ambiguousCount}件を受け取りました！\nノーマルですか？ゴールドですか？\n\n「ノーマル」または「ゴールド」と返信してください。`
        );
        continue;
      }

      const safeCarrierId = parsed.carrierId || "other";
      const idx = entries.findIndex((e) => e.carrierId === safeCarrierId);

      const emptyEntry = (carrierId: string) => ({
        carrierId,
        newContract: 0,
        deviceChange: 0,
        mnpIn: 0,
        portIn: 0,
        netLine: 0,
        creditCard: 0,
        energy: 0,
      });

      if (Object.keys(parsed.entry).length > 0) {
        if (idx >= 0) {
          entries[idx] = { ...entries[idx], ...parsed.entry };
        } else {
          entries.push({ ...emptyEntry(safeCarrierId), ...parsed.entry });
        }
      }

      const newPeripheralTotal =
        (existing.peripheralTotal || 0) + (parsed.peripheralAmount || 0);

      await ref.set(
        {
          uid,
          displayName,
          date,
          agency: parsed.agency || existing.agency || "",
          storeName: parsed.storeName || existing.storeName || "",
          entries,
          peripheralTotal: newPeripheralTotal,
          updatedAt: new Date(),
          createdAt: existing.createdAt || new Date(),
        },
        { merge: true }
      );

      const itemTotal = Object.values(parsed.entry).reduce(
        (a: number, b) => a + (b as number),
        0
      );
      const parts: string[] = [];
      if (itemTotal > 0) parts.push(`件数：${itemTotal}件`);
      if (parsed.peripheralAmount > 0)
        parts.push(`周辺機器：${parsed.peripheralAmount.toLocaleString()}円`);

      await replyMessage(
        replyToken,
        `${date !== todayStr() ? `【${date}の報告】\n` : ""}記録しました！\n${parts.join("\n")}\nアプリでも確認できます。`
      );
    }

    res.status(200).send("OK");
  } catch (err: any) {
    console.error("Webhook error:", err);
    res.status(200).send("OK");
  }
}
