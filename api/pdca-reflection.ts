// api/pdca-reflection.ts
// 週次・月次PDCA自動振り返り生成エンドポイント

import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

if (!getApps().length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || "{}");
  initializeApp({ credential: cert(serviceAccount) });
}

const db = getFirestore();
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "";
const LINE_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN || "";

async function sendLine(lineUserId: string, message: string) {
  await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${LINE_ACCESS_TOKEN}` },
    body: JSON.stringify({ to: lineUserId, messages: [{ type: "text", text: message }] }),
  });
}

async function generateReflectionText(name: string, records: any[], label: string): Promise<string> {
  const recordSummary = records.map(r =>
    `【${r.title}】Plan:${r.plan||"未入力"} / Do:${r.do_||"未入力"} / Check:${r.check||"未入力"} / Act:${r.act||"未入力"}`
  ).join("\n");

  const prompt = `${name}さんの${label}研修PDCA振り返りレポートを生成してください。

${recordSummary}

以下の構成で250字以内で日本語で作成してください：
1. 📊 ${label}のポイント（取り組みの総括）
2. 💡 気づき・成長した点
3. 🎯 来${label === "週次" ? "週" : "月"}への目標
前向きで具体的な内容にしてください。`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5",
      max_tokens: 600,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  const data = await res.json();
  return data.content?.[0]?.text || "";
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") { res.status(405).send("Method Not Allowed"); return; }

  const { type, label } = req.body;

  try {
    // 全ユーザーを取得
    const usersSnap = await db.collection("users").where("status", "==", "approved").get();

    for (const userDoc of usersSnap.docs) {
      const uid = userDoc.id;
      const userData = userDoc.data();

      // PDCAレコードを取得（進行中のもの）
      const recordsSnap = await db.collection("trainingPDCA").doc(uid).collection("records")
        .where("status", "==", "進行中").get();

      if (recordsSnap.empty) continue;

      const records = recordsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const reflectionText = await generateReflectionText(userData.name || "", records, label || "週次");
      if (!reflectionText) continue;

      // LINEで送信
      const lineSnap = await db.collection("lineUsers").where("uid", "==", uid).limit(1).get();
      if (!lineSnap.empty) {
        const lineUserId = lineSnap.docs[0].id;
        const message = `【${label || "週次"}振り返りレポート】\n${userData.name}さん\n\n${reflectionText}`;
        await sendLine(lineUserId, message);
      }
    }

    res.status(200).json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "振り返り生成に失敗しました" });
  }
}
