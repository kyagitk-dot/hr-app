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

const CARRIER_KEYWORDS: Record<string, string> = {
  docomo: "docomo",
  ドコモ: "docomo",
  ahamo: "ahamo",
  アハモ: "ahamo",
  au: "au",
  エーユー: "au",
  softbank: "softbank",
  ソフトバンク: "softbank",
  ymobile: "ymobile",
  ワイモバイル: "ymobile",
  uq: "uq",
  uqモバイル: "uq",
};

const FIELD_KEYWORDS: Record<string, string> = {
  新規契約: "newContract",
  新規: "newContract",
  機種変更: "deviceChange",
  機変: "deviceChange",
  mnp転入: "mnpIn",
  mnp転出: "mnpOut",
  転出: "mnpOut",
  転入: "mnpIn",
  mnp: "mnpIn",
  光回線: "netLine",
  ネット回線: "netLine",
  インターネット: "netLine",
  ひかり: "netLine",
  ネット: "netLine",
  wifi: "netLine",
  "wi-fi": "netLine",
  光: "netLine",
  クレジット: "creditCard",
  クレカ: "creditCard",
  カード: "creditCard",
  電気: "energy",
  ガス: "energy",
};

// 周辺機器は「件数」ではなく「金額（円）」で別集計する
const PERIPHERAL_KEYWORDS = ["周辺機器", "アクセサリ", "機器", "付属品"];

const FIELD_LABELS: Record<string, string> = {
  newContract: "新規",
  deviceChange: "機変",
  mnpIn: "MNP転入",
  netLine: "ネット",
  creditCard: "クレカ",
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

function verifySignature(body: string, signature: string): boolean {
  const hash = crypto
    .createHmac("sha256", CHANNEL_SECRET)
    .update(body)
    .digest("base64");
  return hash === signature;
}

const todayStr = () => new Date().toLocaleDateString("sv-SE");

function parseReportText(text: string) {
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
  const storeMatch = text.match(/(.+?店)で/);
  if (storeMatch) storeName = storeMatch[1];

  return {
    carrierId: carrierId || "other",
    entry,
    peripheralAmount,
    agency: "",
    storeName,
  };
}

function totalOfEntry(e: any): number {
  return [
    "newContract",
    "deviceChange",
    "mnpIn",
    "mnpOut",
    "netLine",
    "creditCard",
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
          await replyMessage(
            replyToken,
            "はじめまして！まずアプリに登録しているメールアドレスを送ってください（例：example@company.com）"
          );
        }
        continue;
      }

      const linkData = linkSnap.data()!;
      const uid = linkData.uid;
      const displayName = linkData.displayName;

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
            "netLine",
            "creditCard",
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

      // ── リッチメニュー：ランキングを見る ───────────────
      if (text.includes("ランキング")) {
        const now = new Date();
        const snap = await db.collectionGroup("daily").get();
        const totals: Record<string, { name: string; total: number }> = {};
        snap.forEach((doc) => {
          const d = doc.data();
          const dDate = new Date(d.date);
          if (
            dDate.getFullYear() !== now.getFullYear() ||
            dDate.getMonth() !== now.getMonth()
          )
            return;
          const t = (d.entries || []).reduce(
            (s: number, e: any) => s + totalOfEntry(e),
            0
          );
          if (!totals[d.uid]) totals[d.uid] = { name: d.displayName, total: 0 };
          totals[d.uid].total += t;
        });
        const ranked = Object.values(totals).sort((a, b) => b.total - a.total);
        if (ranked.length === 0) {
          await replyMessage(replyToken, "今月のデータはまだありません。");
        } else {
          const lines = ranked
            .slice(0, 5)
            .map((r, i) => `${i + 1}位 ${r.name}：${r.total}件`)
            .join("\n");
          await replyMessage(replyToken, `【今月のランキング】\n${lines}`);
        }
        continue;
      }

      // ── リッチメニュー：今日の報告を修正 ───────────────
      if (text.includes("修正")) {
        await replyMessage(
          replyToken,
          "修正したい内容を、もう一度同じ形式で送ってください。同じキャリアの件数は上書きされます。\n\n例：docomo新規5件"
        );
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

      // ── 件数報告として解析 ──────────────────────────────
      const parsed = parseReportText(text);
      if (!parsed) {
        await replyMessage(
          replyToken,
          "うまく読み取れませんでした。例：「〇〇店でdocomo新規3件、ネット回線1件」のように送ってください。"
        );
        continue;
      }

      const date = todayStr();
      const ref = db
        .collection("salesReports")
        .doc(uid)
        .collection("daily")
        .doc(date);
      const snap = await ref.get();

      const existing = snap.exists ? snap.data()! : { entries: [], peripheralTotal: 0 };
      const entries: any[] = existing.entries || [];
      const idx = entries.findIndex((e) => e.carrierId === parsed.carrierId);

      const emptyEntry = (carrierId: string) => ({
        carrierId,
        newContract: 0,
        deviceChange: 0,
        mnpIn: 0,
        mnpOut: 0,
        netLine: 0,
        creditCard: 0,
        energy: 0,
      });

      if (Object.keys(parsed.entry).length > 0) {
        if (idx >= 0) {
          entries[idx] = { ...entries[idx], ...parsed.entry };
        } else {
          entries.push({ ...emptyEntry(parsed.carrierId), ...parsed.entry });
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
        `記録しました！\n${parts.join("\n")}\nアプリでも確認できます。`
      );
    }

    res.status(200).send("OK");
  } catch (err: any) {
    console.error("Webhook error:", err);
    res.status(200).send("OK");
  }
}

