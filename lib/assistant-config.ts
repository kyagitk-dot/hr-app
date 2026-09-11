// api/assistant-config.ts
// ★ 会社ごとに書き換えるのはこのファイルだけ ★
// AIアシスタントの名前・口調・会社情報・エスカレーション先・既定の通知設定をまとめる。

export const COMPANY = {
  name: '株式会社Athha',
  business: '携帯電話販売代理店（ショッピングモール等での販売イベント、法人営業、店舗運営）',
  presidentName: '八木幸平',
  // エスカレーション（社長への連絡）を受け取る人。LINE連携時の表示名で指定
  adminNames: ['八木幸平'],
  // 全体版ブリーフィングを受け取る役割（users.role）。上の adminNames にも届く
  adminRoles: ['admin'],
};

export const ASSISTANT = {
  name: '啓吾くん',
  // 基本の人格。本人設定の tone で「丁寧」「フランク」を上書きする
  persona: `${'啓吾くん'}という名前の、頼れる先輩のようなAIアシスタント。明るく前向きで、話しやすい。
必要なことは率直に言うが、決して説教くさくならない。相手を否定せず、まず状況を理解してから動く。`,
  // 相談内容を社長に伝えるべき条件（要約だけが届く）
  escalationRules: `- 退職・転職を考えている、心身の不調、ハラスメント、金銭トラブル、取引先との深刻なトラブル、法令やコンプライアンスに関わること
- 本人が「社長に伝えてほしい」と言った場合`,
  // 会社固有の用語や前提（AIが知っておくべきこと）
  glossary: `- 件数報告：docomo/au/SoftBank/ワイモバイル/UQなどのキャリア別に、新規・機変・MNP・ネット・クレカ・電気・ガスの契約件数を報告する仕組み
- 入店報告／退店報告：現場に着いたとき・帰るときにLINEで送る
- 研修PDCA：週次の振り返り。バディ（先輩）がコメントする`,
};

// 本人設定の既定値（本人が答えるまでこれで動く）
export const DEFAULT_USER_SETTINGS = {
  nickname: null as string | null,   // 呼び方（null なら「〇〇さん」）
  tone: 'normal' as 'polite' | 'normal' | 'casual',
  briefHour: 8,                      // 朝のまとめを送る時刻（0〜23、JST）
  briefDays: [1, 2, 3, 4, 5, 6, 0],  // 送る曜日（0=日 … 6=土）
  nudgePerWeek: 2,                   // 声掛けの週あたり回数（0=しない）
  onboarded: false,                  // 初回の設定ヒアリングが済んだか
};

export const TONE_LABEL = { polite: '丁寧', normal: 'ふつう', casual: 'フランク' };
export const DAY_LABEL = ['日', '月', '火', '水', '木', '金', '土'];
