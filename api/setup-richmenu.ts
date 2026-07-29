// api/setup-richmenu.ts
// リッチメニューをAPIで更新するエンドポイント
// 一度だけ実行すればOK

export default async function handler(req: any, res: any) {
  const ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN || "";
  if (!ACCESS_TOKEN) { res.status(500).json({error:"LINE_CHANNEL_ACCESS_TOKEN未設定"}); return; }

  try {
    // 1. 既存のリッチメニューを全削除
    const listRes = await fetch("https://api.line.me/v2/bot/richmenu/list", {
      headers: { "Authorization": `Bearer ${ACCESS_TOKEN}` }
    });
    const listData = await listRes.json();
    for (const menu of listData.richmenus || []) {
      await fetch(`https://api.line.me/v2/bot/richmenu/${menu.richMenuId}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${ACCESS_TOKEN}` }
      });
    }

    // 2. 新しいリッチメニューを作成
    const menuRes = await fetch("https://api.line.me/v2/bot/richmenu", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${ACCESS_TOKEN}` },
      body: JSON.stringify({
        size: { width: 2500, height: 843 },
        selected: true,
        name: "販売実績メニュー",
        chatBarText: "メニュー",
        areas: [
          { bounds: { x: 0,    y: 0, width: 833, height: 843 }, action: { type: "message", label: "入店報告",       text: "入店報告" } },
          { bounds: { x: 833,  y: 0, width: 834, height: 843 }, action: { type: "message", label: "今日の実績",     text: "今日の実績" } },
          { bounds: { x: 1667, y: 0, width: 833, height: 843 }, action: { type: "message", label: "ランキング",     text: "ランキング" } },
          { bounds: { x: 0,    y: 421, width: 833, height: 422 }, action: { type: "message", label: "修正",         text: "修正" } },
          { bounds: { x: 833,  y: 421, width: 834, height: 422 }, action: { type: "message", label: "追加報告",     text: "追加報告" } },
          { bounds: { x: 1667, y: 421, width: 833, height: 422 }, action: { type: "message", label: "退店報告",     text: "退店報告" } },
        ]
      })
    });
    const menuData = await menuRes.json();
    const richMenuId = menuData.richMenuId;
    if (!richMenuId) { res.status(500).json({error:"リッチメニュー作成失敗", detail: menuData}); return; }

    // 3. 画像をSVGで生成してアップロード
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="2500" height="843">
      <defs>
        <style>
          .bg1 { fill: #534AB7; }
          .bg2 { fill: #3C3489; }
          .bg3 { fill: #7F77DD; }
          .bg4 { fill: #1D9E75; }
          .bg5 { fill: #378ADD; }
          .bg6 { fill: #D85A30; }
          .label { fill: white; font-family: 'Hiragino Sans', 'Noto Sans JP', sans-serif; font-weight: bold; text-anchor: middle; dominant-baseline: middle; }
          .icon { fill: white; opacity: 0.9; }
          .divider { stroke: rgba(255,255,255,0.3); stroke-width: 2; }
        </style>
      </defs>

      <!-- 上段背景 -->
      <rect x="0"    y="0" width="833"  height="421" class="bg1"/>
      <rect x="833"  y="0" width="834"  height="421" class="bg2"/>
      <rect x="1667" y="0" width="833"  height="421" class="bg3"/>
      <!-- 下段背景 -->
      <rect x="0"    y="421" width="833"  height="422" class="bg4"/>
      <rect x="833"  y="421" width="834"  height="422" class="bg5"/>
      <rect x="1667" y="421" width="833"  height="422" class="bg6"/>

      <!-- 区切り線 -->
      <line x1="833"  y1="0" x2="833"  y2="843" class="divider"/>
      <line x1="1667" y1="0" x2="1667" y2="843" class="divider"/>
      <line x1="0"    y1="421" x2="2500" y2="421" class="divider"/>

      <!-- アイコン（上段） -->
      <text x="416"  y="180" font-size="80" text-anchor="middle" dominant-baseline="middle">🏪</text>
      <text x="1250" y="180" font-size="80" text-anchor="middle" dominant-baseline="middle">📊</text>
      <text x="2083" y="180" font-size="80" text-anchor="middle" dominant-baseline="middle">🏆</text>

      <!-- ラベル（上段） -->
      <text x="416"  y="320" font-size="52" class="label">入店報告</text>
      <text x="1250" y="320" font-size="52" class="label">今日の実績</text>
      <text x="2083" y="320" font-size="52" class="label">ランキング</text>

      <!-- アイコン（下段） -->
      <text x="416"  y="590" font-size="72" text-anchor="middle" dominant-baseline="middle">✏️</text>
      <text x="1250" y="590" font-size="72" text-anchor="middle" dominant-baseline="middle">➕</text>
      <text x="2083" y="590" font-size="72" text-anchor="middle" dominant-baseline="middle">🏁</text>

      <!-- ラベル（下段） -->
      <text x="416"  y="730" font-size="52" class="label">報告を修正</text>
      <text x="1250" y="730" font-size="52" class="label">追加報告</text>
      <text x="2083" y="730" font-size="52" class="label">退店報告</text>
    </svg>`;

    // SVGをPNGに変換してアップロード（SVGのままでは不可なのでbase64で送る）
    // LINE APIはJPEG/PNGのみ受け付けるため、シンプルなPNGを生成
    // ここではSVGをテキストとして返してフロントで確認
    
    // 4. デフォルトメニューに設定
    await fetch(`https://api.line.me/v2/bot/user/all/richmenu/${richMenuId}`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${ACCESS_TOKEN}` }
    });

    res.status(200).json({ 
      success: true, 
      richMenuId,
      message: "リッチメニューの構造を更新しました。画像は別途アップロードが必要です。",
      svgPreview: svg.substring(0, 200) + "..."
    });
  } catch(e: any) {
    res.status(500).json({ error: e.message });
  }
}
