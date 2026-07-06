// api/analyze.ts
// Vercel Serverless Function - AIの分析をサーバー側で実行（APIキーを安全に保管）

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.status(405).send("Method Not Allowed");
    return;
  }

  const { prompt } = req.body;
  if (!prompt) {
    res.status(400).json({ error: "prompt is required" });
    return;
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY || "",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1000,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const data = await response.json();
    const text = data.content?.map((i: any) => i.text || "").join("\n");

    if (text) {
      res.status(200).json({ result: text });
    } else {
      res.status(500).json({ error: "分析結果を取得できませんでした。" });
    }
  } catch (err: any) {
    console.error("AI analyze error:", err);
    res.status(500).json({ error: "通信エラーが発生しました。" });
  }
}
