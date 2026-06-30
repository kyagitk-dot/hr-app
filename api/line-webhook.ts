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
  転入: "mnpIn",
  mnp転出: "mnpOut",
  転出: "mnpOut",
  ネット: "netLine",
  光: "netLine",
  周辺機器: "peripheral",
  機器: "peripheral",
  クレカ: "creditCard",
  クレジット: "creditCard",
  電気: "energy",
  ガス: "energy",
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
  if (!carrierId) return null;

  const entry: Record<string, number> = {};
  for (const [kw, key] of Object.entries(FIELD_KEYWORDS)) {
    const re = new RegExp(`${kw}[^0-9]{0,3}([0-9]+)`, "i");
    const m = lower.match(re);
    if (m) entry[key] = parseInt(m[1], 10);
  }
  if (Object.keys(entry).length === 0) return null;

  let storeName = "";
  const storeMatch = text.match(/(.+?店)で/);
  if (storeMatch) storeName = storeMatch[1];

  return { carrierId, entry, agency: "", storeName };
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
            (s: number, e: any) =>
              s +
              [
                "newContract",
                "deviceChange",
                "mnpIn",
                "mnpOut",
                "netLine",
                "peripheral",
                "creditCard",
                "energy",
              ].reduce((s2, k) => s2 + (e[k] || 0), 0),
            0
          );
          await replyMessage(replyToken, `本日の合計：${total}件です。`);
        }
        continue;
      }

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

      const existing = snap.exists ? snap.data()! : { entries: [] };
      const entries: any[] = existing.entries || [];
      const idx = entries.findIndex((e) => e.carrierId === parsed.carrierId);

      const emptyEntry = (carrierId: string) => ({
        carrierId,
        newContract: 0,
        deviceChange: 0,
        mnpIn: 0,
        mnpOut: 0,
        netLine: 0,
        peripheral: 0,
        creditCard: 0,
        energy: 0,
      });

      if (idx >= 0) {
        entries[idx] = { ...entries[idx], ...parsed.entry };
      } else {
        entries.push({ ...emptyEntry(parsed.carrierId), ...parsed.entry });
      }

      await ref.set(
        {
          uid,
          displayName,
          date,
          agency: parsed.agency || existing.agency || "",
          storeName: parsed.storeName || existing.storeName || "",
          entries,
          updatedAt: new Date(),
          createdAt: existing.createdAt || new Date(),
        },
        { merge: true }
      );

      const total = Object.values(parsed.entry).reduce(
        (a: number, b) => a + (b as number),
        0
      );
      await replyMessage(
        replyToken,
        `記録しました！今回の入力：${total}件\nアプリでも確認できます。`
      );
    }

    res.status(200).send("OK");
  } catch (err: any) {
    console.error("Webhook error:", err);
    res.status(200).send("OK");
  }
}
