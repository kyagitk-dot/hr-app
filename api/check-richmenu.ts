// api/check-richmenu.ts
// 現在のリッチメニュー一覧を確認

export default async function handler(req: any, res: any) {
  const ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN || "";
  
  try {
    // リッチメニュー一覧取得
    const listRes = await fetch("https://api.line.me/v2/bot/richmenu/list", {
      headers: { "Authorization": `Bearer ${ACCESS_TOKEN}` }
    });
    const listData = await listRes.json();

    // デフォルトリッチメニュー取得
    const defaultRes = await fetch("https://api.line.me/v2/bot/user/all/richmenu", {
      headers: { "Authorization": `Bearer ${ACCESS_TOKEN}` }
    });
    const defaultData = await defaultRes.json();

    res.status(200).json({
      richmenus: listData.richmenus?.map((m: any) => ({
        id: m.richMenuId,
        name: m.name,
        selected: m.selected,
      })),
      defaultRichMenuId: defaultData.richMenuId,
    });
  } catch(e: any) {
    res.status(500).json({ error: e.message });
  }
}
