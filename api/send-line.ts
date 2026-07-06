// api/send-line.ts
// 管理者アプリからLINEメッセージを送信するエンドポイント

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.status(405).send("Method Not Allowed");
    return;
  }

  const { lineUserIds, message } = req.body;
  if (!message || !lineUserIds || !Array.isArray(lineUserIds) || lineUserIds.length === 0) {
    res.status(400).json({ error: "lineUserIds と message は必須です" });
    return;
  }

  const ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!ACCESS_TOKEN) {
    res.status(500).json({ error: "LINE_CHANNEL_ACCESS_TOKEN が設定されていません" });
    return;
  }

  const results = [];
  for (const lineUserId of lineUserIds) {
    try {
      const body = JSON.stringify({
        to: lineUserId,
        messages: [{ type: "text", text: message }],
      });
      const response = await fetch("https://api.line.me/v2/bot/message/push", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${ACCESS_TOKEN}`,
        },
        body,
      });
      const ok = response.status === 200;
      results.push({ lineUserId, ok });
    } catch (err) {
      results.push({ lineUserId, ok: false });
    }
  }

  const successCount = results.filter(r => r.ok).length;
  res.status(200).json({ successCount, total: lineUserIds.length, results });
}
