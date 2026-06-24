import { useState, useCallback, useEffect } from "react";

const C = {
  purple: { 50: "#EEEDFE", 100: "#CECBF6", 200: "#AFA9EC", 400: "#7F77DD", 600: "#534AB7", 800: "#3C3489", 900: "#26215C" },
  teal:   { 50: "#E1F5EE", 200: "#5DCAA5", 400: "#1D9E75", 800: "#085041" },
  amber:  { 50: "#FAEEDA", 200: "#EF9F27", 400: "#BA7517", 800: "#633806" },
  coral:  { 50: "#FAECE7", 200: "#F0997B", 400: "#D85A30", 800: "#712B13" },
  green:  { 50: "#EAF3DE", 400: "#639922", 800: "#27500A" },
  gray:   { 50: "#F4F3EF", 100: "#E8E7E2", 200: "#D3D1C7", 400: "#888780", 600: "#5F5E5A", 800: "#2C2C2A" },
  blue:   { 50: "#E6F1FB", 400: "#378ADD", 800: "#0C447C" },
};

const GRADE_CRITERIA = {
  G1: [
    // 成果
    { no:1,  category:"成果", item:"端末販売の日次・月次目標（台数・付帯）を安定して達成している", points:8 },
    { no:2,  category:"成果", item:"光回線・保険・アクセサリ等の付帯商材を、指示に沿って案内できている", points:7 },
    { no:3,  category:"成果", item:"手続き漏れ・入力ミス・契約不備がなく、クレームを防止している", points:5 },
    // スキル
    { no:4,  category:"スキル", item:"主要機種の基本スペック・料金プランの仕組みを正確に説明できる", points:8 },
    { no:5,  category:"スキル", item:"光回線・SIMカード・オプションの基礎知識を理解し、案内に使えている", points:7 },
    { no:6,  category:"スキル", item:"接客の基本動作（挨拶・ニーズヒアリング・説明・クロージング）を実践できている", points:8 },
    { no:7,  category:"スキル", item:"端末操作・システム入力・書類作成を正確に行えている", points:5 },
    { no:8,  category:"スキル", item:"指導・フィードバックを素直に受け止め、次の接客に反映できている", points:5 },
    // 行動
    { no:9,  category:"行動", item:"誠実に行動し、個人情報保護・コンプライアンスを遵守している", points:8 },
    { no:10, category:"行動", item:"店舗スタッフ・他の応援スタッフと協力し、店舗全体に貢献している", points:7 },
    { no:11, category:"行動", item:"指示待ちにならず、空き時間に学習・声かけ・整備など自ら動けている", points:5 },
    // 改善
    { no:12, category:"改善", item:"日々の接客を振り返り、翌日の改善行動につなげている", points:7 },
  ],
  G2: [
    // 成果
    { no:1,  category:"成果", item:"端末・光回線・付帯商材のKPI（台数・件数・収益）を安定して達成している", points:10 },
    { no:2,  category:"成果", item:"単価向上（ハイエンド端末・複数商材提案）に取り組み、成果を出している", points:8 },
    { no:3,  category:"成果", item:"契約不備・解約・クレームを最小限に抑え、品質を維持している", points:7 },
    // スキル
    { no:4,  category:"スキル", item:"機種・料金プラン・割引施策を深く理解し、顧客に最適提案ができる", points:8 },
    { no:5,  category:"スキル", item:"光回線・保険・端末保証・アクセサリ等の複合提案ができている", points:8 },
    { no:6,  category:"スキル", item:"顧客のニーズ・懸念を的確に把握し、納得感のある説明・クロージングができる", points:8 },
    { no:7,  category:"スキル", item:"自分の数字・進捗を把握し、目標達成に向けて行動を管理できている", points:7 },
    // 行動
    { no:8,  category:"行動", item:"顧客視点でアフターフォロー（乗り換え提案・満足度確認）を行っている", points:7 },
    { no:9,  category:"行動", item:"店舗スタッフと連携し、応援としてポジティブな影響を与えている", points:7 },
    { no:10, category:"行動", item:"困難な案件・クレーム対応でも諦めず、やり切る姿勢を持っている", points:5 },
    // 改善
    { no:11, category:"改善", item:"自分の苦手な商材・提案パターンを分析し、改善行動を実践している", points:5 },
    { no:12, category:"改善", item:"トークスクリプト・成功事例を蓄積し、自己成長につなげている", points:5 },
  ],
  G3: [
    // 成果
    { no:1,  category:"成果", item:"担当案件・チームのKPI（台数・光件数・付帯率・収益）を主担当として達成している", points:15 },
    { no:2,  category:"成果", item:"ハイエンド端末・光回線・複合商材の高単価提案で収益貢献している", points:10 },
    { no:3,  category:"成果", item:"品質・顧客満足・解約防止を両立しながら、安定した販売運営ができている", points:8 },
    // スキル
    { no:4,  category:"スキル", item:"最新機種・料金改定・新サービスをいち早くキャッチアップし、提案に活かせている", points:8 },
    { no:5,  category:"スキル", item:"顧客の潜在ニーズを引き出し、光回線・保険・副商材を自然な流れで提案できる", points:8 },
    { no:6,  category:"スキル", item:"課題分析・原因特定・改善策立案を行い、自チームの販売力を高めている", points:7 },
    // 行動
    { no:7,  category:"行動", item:"店長・店舗スタッフと密に連携し、店舗全体の目標達成に向けて働きかけている", points:7 },
    { no:8,  category:"行動", item:"困難な顧客・クレーム案件でも当事者意識を持ち、最後まで対応できている", points:5 },
    { no:9,  category:"行動", item:"後輩・新人スタッフへの指導・ロープレ・フォローを積極的に行っている", points:5 },
    // 組織貢献
    { no:10, category:"組織貢献", item:"成功トーク・提案手法を言語化・共有し、チーム全体のスキル底上げをしている", points:5 },
    { no:11, category:"組織貢献", item:"他店舗・本部との情報共有・横展開に積極的に関わっている", points:5 },
    { no:12, category:"組織貢献", item:"店舗環境整備・ディスプレイ改善・業務フロー見直しに貢献している", points:3 },
  ],
  G4: [
    // 成果
    { no:1,  category:"成果", item:"担当エリア・チームの販売KPI（台数・光件数・付帯収益・達成率）を達成している", points:15 },
    { no:2,  category:"成果", item:"収益性を意識した施策（高単価化・付帯率向上・解約防止）を推進し、成果を出している", points:10 },
    { no:3,  category:"成果", item:"品質・顧客満足・コンプライアンスを総合的に管理し、安定した運営を行っている", points:8 },
    // スキル
    { no:4,  category:"スキル", item:"市場動向・競合情報・メーカー施策を踏まえた判断・提案ができる", points:7 },
    { no:5,  category:"スキル", item:"人員配置・シフト・目標設定を最適化し、チーム全体の生産性を高められる", points:7 },
    // 行動
    { no:6,  category:"行動", item:"会社・エリアの方針をメンバーに分かりやすく伝え、現場実行につなげている", points:8 },
    { no:7,  category:"行動", item:"公平性・模範性を持って組織をリードし、チームの士気を高めている", points:7 },
    // 組織貢献
    { no:8,  category:"組織貢献", item:"販売手法・接客トーク・業務フローの仕組み化・標準化を進めている", points:8 },
    { no:9,  category:"組織貢献", item:"他店舗・本部・メーカーと連携し、組織全体の課題解決に貢献している", points:5 },
    // マネジメント
    { no:10, category:"マネジメント", item:"メンバーの目標設定・進捗管理・個別フィードバックを適切に行っている", points:8 },
    { no:11, category:"マネジメント", item:"スタッフの育成・モチベーション管理・人材定着に取り組んでいる", points:7 },
    { no:12, category:"マネジメント", item:"次期リーダー候補の発掘・育成を意識した組織づくりができている", points:5 },
  ],
  G5: [
    // 成果
    { no:1,  category:"成果", item:"担当部門・エリア全体のKGI/KPI（売上・光収益・付帯率・継続率）を中長期視点で達成している", points:15 },
    { no:2,  category:"成果", item:"新商材・新施策・新チャネルを推進し、事業成長に結びつけている", points:10 },
    { no:3,  category:"成果", item:"収益・コスト・リスクを統合的にマネジメントし、部門の安定経営に貢献している", points:8 },
    // スキル
    { no:4,  category:"スキル", item:"通信業界の市場動向・規制変化・競合戦略を踏まえ、事業戦略を設計・修正できる", points:8 },
    { no:5,  category:"スキル", item:"メーカー・通信キャリア・店舗本部との交渉・連携を主導できる", points:7 },
    // 行動
    { no:6,  category:"行動", item:"経営層・他部門・重要パートナーを巻き込み、全社的な影響力を発揮している", points:8 },
    { no:7,  category:"行動", item:"変化を恐れず、販売モデル変革・DX推進など難しい改革を推進できている", points:7 },
    // 組織貢献
    { no:8,  category:"組織貢献", item:"全社最適の視点で意思決定・資源配分を行い、部門間シナジーを生み出している", points:7 },
    { no:9,  category:"組織貢献", item:"業界ナレッジ・ベストプラクティスを組織に還元し、全体レベルを引き上げている", points:5 },
    // マネジメント
    { no:10, category:"マネジメント", item:"管理職・エリアマネージャー層を育成し、強いマネジメントラインを構築している", points:10 },
    { no:11, category:"マネジメント", item:"後継者育成・組織設計・人材配置を通じて、持続可能な販売組織を作っている", points:8 },
    { no:12, category:"マネジメント", item:"スタッフの採用・定着・エンゲージメント向上に取り組み、人的資本を高めている", points:7 },
  ],
};

const GRADE_DEFS = {
  G1: "指示・手順に沿って基本業務を正確に遂行する等級",
  G2: "独力で担当業務を回し、安定して成果を出す等級",
  G3: "担当領域・案件・小規模チームを主導する等級",
  G4: "チーム成果と人材育成を両立するマネジメント等級",
  G5: "部門戦略・収益・組織づくりを担う上位マネジメント等級",
};

const RANK_DEFS = [
  { rank:"S", range:"90〜100点", label:"卓越", color: C.purple },
  { rank:"A", range:"80〜89点", label:"期待超過", color: C.teal },
  { rank:"B", range:"70〜79点", label:"期待達成", color: C.blue },
  { rank:"C", range:"60〜69点", label:"一部未達", color: C.amber },
  { rank:"D", range:"59点以下", label:"未達", color: C.coral },
];

const calcScore = (scores, grade) => {
  const criteria = GRADE_CRITERIA[grade] || [];
  let total = 0;
  criteria.forEach(c => {
    const s = scores[c.no] || 0;
    if (s > 0) total += (c.points * s) / 5;
  });
  return Math.round(total);
};

const calcRank = (score) => {
  if (score >= 90) return "S";
  if (score >= 80) return "A";
  if (score >= 70) return "B";
  if (score >= 60) return "C";
  return "D";
};

const rankColor = (rank) => {
  const m = { S: C.purple, A: C.teal, B: C.blue, C: C.amber, D: C.coral };
  return m[rank] || C.gray;
};

const initials = (name) => name ? name.split(" ").map(p => p[0]).join("").slice(0,2) : "?";
const avatarColors = [C.purple, C.teal, C.coral, C.amber, C.green];
const getAvatarColor = (idx) => avatarColors[idx % avatarColors.length];

const useIsMobile = () => {
  const [mobile, setMobile] = useState(() => typeof window !== "undefined" && window.innerWidth < 640);
  useEffect(() => {
    const fn = () => setMobile(window.innerWidth < 640);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);
  return mobile;
};

const MANAGER_ACCOUNT = { id:"u0", name:"山田 太郎", dept:"経営企画", grade:"G5", role:"manager", email:"yamada@example.com", password:"manager123" };
const SEED_USERS = [
  { id:"u1", name:"田中 花子", dept:"営業1部 催事チーム", grade:"G3", role:"member", managerId:"u0", email:"tanaka@example.com", password:"tanaka123" },
  { id:"u2", name:"鈴木 花子", dept:"営業2部", grade:"G2", role:"member", managerId:"u0", email:"suzuki@example.com", password:"suzuki123" },
  { id:"u3", name:"佐藤 次郎", dept:"管理部", grade:"G4", role:"member", managerId:"u0", email:"sato@example.com", password:"sato123" },
  { id:"u4", name:"高橋 三郎", dept:"営業1部", grade:"G1", role:"member", managerId:"u0", email:"takahashi@example.com", password:"takahashi123" },
  { id:"u5", name:"伊藤 四郎", dept:"経営企画", grade:"G5", role:"member", managerId:"u0", email:"ito@example.com", password:"ito123" },
];

const PERIODS = [
  { id:"2026H1", label:"2026年度 上半期", active:true },
  { id:"2025H2", label:"2025年度 下半期", active:false },
];
const DEPARTMENTS = ["営業1部","営業2部","管理部","経営企画","マーケティング","エンジニアリング"];
const GRADES = ["G1","G2","G3","G4","G5"];

// ── UI Primitives ──────────────────────────────────────────────
const Avatar = ({ name, idx, size=36 }) => {
  const p = getAvatarColor(idx);
  return <div style={{ width:size, height:size, borderRadius:"50%", background:p[50], color:p[800], display:"flex", alignItems:"center", justifyContent:"center", fontSize:size*0.34, fontWeight:500, flexShrink:0 }}>{initials(name)}</div>;
};

const RankBadge = ({ rank, size="sm" }) => {
  if (!rank) return null;
  const c = rankColor(rank);
  return <span style={{ fontSize:size==="lg"?15:11, padding:size==="lg"?"4px 12px":"2px 8px", borderRadius:20, background:c[50], color:c[800], fontWeight:600, border:`1px solid ${c[200]}` }}>{rank}</span>;
};

const Badge = ({ type, children }) => {
  const s = { done:{bg:C.green[50],color:C.green[800]}, wip:{bg:C.amber[50],color:C.amber[800]}, none:{bg:C.gray[100],color:C.gray[600]}, info:{bg:C.purple[50],color:C.purple[800]} }[type] || {bg:C.gray[100],color:C.gray[600]};
  return <span style={{ fontSize:11, padding:"2px 9px", borderRadius:20, background:s.bg, color:s.color, fontWeight:500, whiteSpace:"nowrap" }}>{children}</span>;
};

const ScoreBar = ({ score, max=100 }) => (
  <div style={{ height:6, background:C.gray[100], borderRadius:3, overflow:"hidden", flex:1 }}>
    <div style={{ height:"100%", width:`${Math.min((score/max)*100,100)}%`, background: score>=80?C.teal[400]:score>=60?C.purple[400]:score>=40?C.amber[200]:C.coral[400], borderRadius:3, transition:"width 0.4s" }} />
  </div>
);

const Card = ({ children, style }) => (
  <div style={{ background:"#fff", border:`0.5px solid ${C.gray[100]}`, borderRadius:12, padding:"14px 16px", marginBottom:12, ...style }}>{children}</div>
);

const CardTitle = ({ children, action }) => (
  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
    <div style={{ fontSize:13, fontWeight:500, color:C.gray[800] }}>{children}</div>
    {action}
  </div>
);

const MetricCard = ({ label, value, sub, accent }) => (
  <div style={{ background:accent?accent[50]:C.gray[50], borderRadius:10, padding:"12px 14px", border:accent?`1px solid ${accent[200]}`:"none" }}>
    <div style={{ fontSize:11, color:accent?accent[600]:C.gray[400], marginBottom:3 }}>{label}</div>
    <div style={{ fontSize:22, fontWeight:600, color:accent?accent[800]:C.gray[800] }}>{value}</div>
    {sub && <div style={{ fontSize:11, color:accent?accent[600]:C.gray[400], marginTop:1 }}>{sub}</div>}
  </div>
);

const Btn = ({ children, onClick, primary, small, danger, disabled, style }) => (
  <button onClick={onClick} disabled={disabled} style={{
    padding:small?"6px 12px":"8px 16px", fontSize:small?12:13, borderRadius:8,
    cursor:disabled?"not-allowed":"pointer",
    border:`0.5px solid ${danger?C.coral[400]:primary?C.purple[400]:C.gray[200]}`,
    background:primary?C.purple[400]:danger?C.coral[50]:"transparent",
    color:primary?"#fff":danger?C.coral[800]:C.gray[800],
    display:"inline-flex", alignItems:"center", gap:5, opacity:disabled?0.5:1,
    fontFamily:"inherit", ...style,
  }}>{children}</button>
);

const Input = ({ value, onChange, placeholder, type="text", style }) => (
  <input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}
    style={{ width:"100%", padding:"9px 11px", fontSize:14, border:`0.5px solid ${C.gray[200]}`, borderRadius:8, background:"#fff", color:C.gray[800], outline:"none", fontFamily:"inherit", boxSizing:"border-box", ...style }} />
);

const SelectEl = ({ value, onChange, options, style }) => (
  <select value={value} onChange={e=>onChange(e.target.value)}
    style={{ padding:"8px 10px", fontSize:13, borderRadius:8, border:`0.5px solid ${C.gray[200]}`, background:"#fff", color:C.gray[800], cursor:"pointer", outline:"none", fontFamily:"inherit", ...style }}>
    {options.map(o=><option key={o.value??o} value={o.value??o}>{o.label??o}</option>)}
  </select>
);

const Textarea = ({ value, onChange, rows=3, placeholder }) => (
  <textarea value={value} onChange={e=>onChange(e.target.value)} rows={rows} placeholder={placeholder}
    style={{ width:"100%", padding:"9px 11px", fontSize:13, border:`0.5px solid ${C.gray[200]}`, borderRadius:8, background:"#fff", color:C.gray[800], resize:"vertical", fontFamily:"inherit", outline:"none", lineHeight:1.6, boxSizing:"border-box" }} />
);

const Modal = ({ title, onClose, children, width=480 }) => (
  <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.4)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:200, padding:16 }}
    onClick={e=>e.target===e.currentTarget&&onClose()}>
    <div style={{ background:"#fff", borderRadius:14, width:"100%", maxWidth:width, maxHeight:"90vh", overflow:"auto" }}>
      <div style={{ padding:"14px 18px", borderBottom:`0.5px solid ${C.gray[100]}`, display:"flex", alignItems:"center", justifyContent:"space-between", position:"sticky", top:0, background:"#fff" }}>
        <div style={{ fontSize:15, fontWeight:500, color:C.gray[800] }}>{title}</div>
        <button onClick={onClose} style={{ border:"none", background:"none", fontSize:20, cursor:"pointer", color:C.gray[400] }}>×</button>
      </div>
      <div style={{ padding:"16px 18px" }}>{children}</div>
    </div>
  </div>
);

// ── Score Input Component ──────────────────────────────────────
const ScoreInput = ({ value, onChange, readonly }) => (
  <div style={{ display:"flex", gap:4 }}>
    {[1,2,3,4,5].map(n=>(
      <button key={n} onClick={()=>!readonly&&onChange&&onChange(value===n?0:n)}
        style={{
          width:32, height:32, borderRadius:6, border:"none", cursor:readonly?"default":"pointer",
          background: n<=value ? C.purple[400] : C.gray[100],
          color: n<=value ? "#fff" : C.gray[400],
          fontSize:13, fontWeight:600, transition:"all 0.1s", fontFamily:"inherit",
        }}>{n}</button>
    ))}
  </div>
);

// ── Category color ─────────────────────────────────────────────
const categoryColor = (cat) => {
  const m = { "成果":C.teal, "スキル":C.blue, "行動":C.purple, "改善":C.amber, "組織貢献":C.green, "マネジメント":C.coral };
  return m[cat] || C.gray;
};

// ── Login ──────────────────────────────────────────────────────
const LoginPage = ({ users, managerAccount, onLogin }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const handleLogin = () => {
    setError("");
    const allAccounts = [managerAccount||MANAGER_ACCOUNT, ...users];
    const match = allAccounts.find(u=>u.email===email.trim()&&u.password===password);
    if (match) onLogin(match);
    else setError("メールアドレスまたはパスワードが正しくありません。");
  };
  return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:C.gray[50], padding:16, fontFamily:"system-ui,-apple-system,sans-serif" }}>
      <div style={{ width:"100%", maxWidth:380 }}>
        <div style={{ textAlign:"center", marginBottom:28 }}>
          <div style={{ fontSize:24, fontWeight:700, color:C.purple[600], marginBottom:4 }}>✦ 人事評価ポータル</div>
          <div style={{ fontSize:13, color:C.gray[400] }}>G1〜G5等級対応 · 100点満点評価制度</div>
        </div>
        <div style={{ background:"#fff", borderRadius:14, border:`0.5px solid ${C.gray[100]}`, padding:"24px 20px" }}>
          <div style={{ marginBottom:14 }}>
            <div style={{ fontSize:12, color:C.gray[600], marginBottom:5 }}>メールアドレス</div>
            <Input value={email} onChange={setEmail} placeholder="your@example.com" type="email" />
          </div>
          <div style={{ marginBottom:18 }}>
            <div style={{ fontSize:12, color:C.gray[600], marginBottom:5 }}>パスワード</div>
            <div style={{ position:"relative" }}>
              <Input value={password} onChange={setPassword} placeholder="パスワードを入力" type={showPw?"text":"password"} style={{ paddingRight:52 }} />
              <button onClick={()=>setShowPw(v=>!v)} style={{ position:"absolute", right:10, top:"50%", transform:"translateY(-50%)", border:"none", background:"none", cursor:"pointer", fontSize:12, color:C.gray[400] }}>{showPw?"隠す":"表示"}</button>
            </div>
          </div>
          {error && <div style={{ fontSize:12, color:C.coral[400], marginBottom:12, padding:"8px 12px", background:C.coral[50], borderRadius:8 }}>{error}</div>}
          <button onClick={handleLogin} style={{ width:"100%", padding:11, fontSize:14, fontWeight:500, background:C.purple[400], color:"#fff", border:"none", borderRadius:8, cursor:"pointer", fontFamily:"inherit" }}>ログイン</button>
        </div>

      </div>
    </div>
  );
};

// ── Bottom Nav (mobile) ────────────────────────────────────────
const BottomNav = ({ nav, page, setPage }) => (
  <div style={{ position:"fixed", bottom:0, left:0, right:0, background:"#fff", borderTop:`0.5px solid ${C.gray[100]}`, display:"flex", zIndex:100, paddingBottom:"env(safe-area-inset-bottom,0px)" }}>
    {nav.map(n=>(
      <button key={n.id} onClick={()=>setPage(n.id)} style={{
        flex:1, padding:"8px 4px 10px", border:"none", background:"none", cursor:"pointer",
        display:"flex", flexDirection:"column", alignItems:"center", gap:2,
        color:page===n.id?C.purple[600]:C.gray[400],
      }}>
        <span style={{ fontSize:18 }}>{n.icon}</span>
        <span style={{ fontSize:10, fontWeight:page===n.id?500:400 }}>{n.shortLabel||n.label}</span>
      </button>
    ))}
  </div>
);

// ── Sidebar ────────────────────────────────────────────────────
const Sidebar = ({ nav, page, setPage, currentUser, activePeriod, onLogout }) => (
  <div style={{ width:220, flexShrink:0, background:"#fff", borderRight:`0.5px solid ${C.gray[100]}`, display:"flex", flexDirection:"column", height:"100vh" }}>
    <div style={{ padding:"18px 18px 14px", borderBottom:`0.5px solid ${C.gray[100]}` }}>
      <div style={{ fontSize:14, fontWeight:700, color:C.purple[600] }}>✦ 人事評価ポータル</div>
      <div style={{ fontSize:11, color:C.gray[400], marginTop:3 }}>{activePeriod?.label}</div>
    </div>
    <nav style={{ padding:"8px 0", flex:1, overflowY:"auto" }}>
      {nav.map(n=>(
        <button key={n.id} onClick={()=>setPage(n.id)} style={{
          display:"flex", alignItems:"center", gap:10, width:"100%", textAlign:"left",
          padding:"9px 18px", border:"none", cursor:"pointer", fontSize:13,
          background:page===n.id?C.purple[50]:"transparent",
          color:page===n.id?C.purple[800]:C.gray[600],
          fontWeight:page===n.id?500:400,
          borderRight:page===n.id?`2px solid ${C.purple[400]}`:"2px solid transparent",
          fontFamily:"inherit",
        }}>
          <span style={{ fontSize:15 }}>{n.icon}</span>{n.label}
        </button>
      ))}
    </nav>
    <div style={{ padding:"12px 16px", borderTop:`0.5px solid ${C.gray[100]}` }}>
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
        <Avatar name={currentUser.name} idx={0} size={30} />
        <div>
          <div style={{ fontSize:12, fontWeight:500, color:C.gray[800] }}>{currentUser.name}</div>
          <div style={{ fontSize:10, color:C.gray[400] }}>{currentUser.role==="manager"?"マネージャー":`${currentUser.grade} · ${currentUser.dept}`}</div>
        </div>
      </div>
      <button onClick={onLogout} style={{ width:"100%", padding:"6px", fontSize:12, borderRadius:6, border:`0.5px solid ${C.gray[200]}`, background:"transparent", color:C.gray[600], cursor:"pointer", fontFamily:"inherit" }}>ログアウト</button>
    </div>
  </div>
);

// ── App Shell ──────────────────────────────────────────────────
const AppShell = ({ nav, page, setPage, currentUser, activePeriod, onLogout, pageTitle, children }) => {
  const isMobile = useIsMobile();
  return (
    <div style={{ display:"flex", height:"100vh", fontFamily:"system-ui,-apple-system,sans-serif", background:"#f7f6f2", color:C.gray[800] }}>
      {!isMobile && <Sidebar nav={nav} page={page} setPage={setPage} currentUser={currentUser} activePeriod={activePeriod} onLogout={onLogout} />}
      <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
        <div style={{ padding:isMobile?"12px 16px":"13px 24px", background:"#fff", borderBottom:`0.5px solid ${C.gray[100]}`, display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0 }}>
          <div style={{ fontSize:isMobile?15:16, fontWeight:500, color:C.gray[800] }}>{pageTitle}</div>
          {isMobile
            ? <button onClick={onLogout} style={{ fontSize:12, border:"none", background:"none", color:C.gray[400], cursor:"pointer", fontFamily:"inherit" }}>ログアウト</button>
            : <div style={{ fontSize:11, color:C.gray[400] }}>{activePeriod?.label}</div>
          }
        </div>
        <div style={{ flex:1, overflow:"auto", padding:isMobile?"14px 14px 80px":"20px 24px" }}>
          {children}
        </div>
      </div>
      {isMobile && <BottomNav nav={nav} page={page} setPage={setPage} />}
    </div>
  );
};

// ── Dashboard ──────────────────────────────────────────────────
const Dashboard = ({ users, evals, onNavigate, onSelectUser }) => {
  const isMobile = useIsMobile();
  const usersWithScore = users.map((u,i) => {
    const e = evals[u.id]||{};
    const ms = calcScore(e.managerScores||{}, u.grade);
    const ss = calcScore(e.selfScores||{}, u.grade);
    return { ...u, idx:i, managerScore:ms, selfScore:ss, rank:e.managerScores&&Object.keys(e.managerScores).length?calcRank(ms):null, status:e.status||"none" };
  });
  const done = usersWithScore.filter(u=>u.status==="done").length;
  const avgScore = usersWithScore.filter(u=>u.rank).length
    ? Math.round(usersWithScore.filter(u=>u.rank).reduce((a,u)=>a+u.managerScore,0)/usersWithScore.filter(u=>u.rank).length)
    : null;

  return (
    <div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:10, marginBottom:14 }}>
        <MetricCard label="対象メンバー" value={users.length} sub="名" />
        <MetricCard label="評価完了" value={done} sub={`/ ${users.length} 名`} />
        <MetricCard label="チーム平均点" value={avgScore??"-"} sub="/ 100点" accent={avgScore>=80?C.teal:avgScore>=60?C.purple:avgScore?C.amber:null} />
        <MetricCard label="評価期間" value="2026H1" sub="上半期" />
      </div>

      {/* Grade distribution */}
      <Card>
        <CardTitle>等級別構成</CardTitle>
        <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
          {GRADES.map(g => {
            const cnt = users.filter(u=>u.grade===g).length;
            if (!cnt) return null;
            return (
              <div key={g} style={{ background:C.purple[50], borderRadius:8, padding:"6px 14px", textAlign:"center" }}>
                <div style={{ fontSize:18, fontWeight:700, color:C.purple[800] }}>{cnt}</div>
                <div style={{ fontSize:11, color:C.purple[600] }}>{g}</div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card>
        <CardTitle action={<Btn small primary onClick={()=>onNavigate("evaluation")}>+ 評価を入力</Btn>}>メンバー一覧</CardTitle>
        {usersWithScore.map((u,i) => (
          <div key={u.id} onClick={()=>{onSelectUser(u.id);onNavigate("evaluation");}}
            style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 6px", borderRadius:8, cursor:"pointer", borderBottom:i<users.length-1?`0.5px solid ${C.gray[50]}`:"none" }}
            onMouseEnter={e=>e.currentTarget.style.background=C.gray[50]}
            onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
            <Avatar name={u.name} idx={u.idx} size={34} />
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:13, fontWeight:500, color:C.gray[800], whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{u.name}</div>
              <div style={{ fontSize:11, color:C.gray[400] }}>{u.dept} · <span style={{ color:C.purple[600], fontWeight:500 }}>{u.grade}</span></div>
            </div>
            {u.rank && (
              <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                {!isMobile && <ScoreBar score={u.managerScore} />}
                <span style={{ fontSize:14, fontWeight:600, color:C.gray[800], minWidth:36, textAlign:"right" }}>{u.managerScore}点</span>
                <RankBadge rank={u.rank} />
              </div>
            )}
            {!u.rank && <Badge type={u.status==="done"?"done":u.managerScores?"wip":"none"}>{u.status==="done"?"完了":"未評価"}</Badge>}
          </div>
        ))}
      </Card>
    </div>
  );
};

// ── Evaluation Form ────────────────────────────────────────────
const EvaluationPage = ({ users, evals, setEvals, selectedUserId, setSelectedUserId }) => {
  const [tab, setTab] = useState("manager");
  const isMobile = useIsMobile();
  const user = users.find(u=>u.id===selectedUserId)||users[0];
  const eval_ = evals[user?.id]||{};
  const criteria = GRADE_CRITERIA[user?.grade]||[];
  const prefix = tab==="manager"?"manager":"self";
  const scores = eval_[prefix+"Scores"]||{};

  const updateEval = useCallback((key,value) => {
    setEvals(prev=>({...prev,[user.id]:{...prev[user.id],[key]:value}}));
  },[user?.id,setEvals]);

  const totalScore = calcScore(scores, user?.grade);
  const rank = Object.keys(scores).length ? calcRank(totalScore) : null;

  const categoryGroups = criteria.reduce((acc,c) => {
    if (!acc[c.category]) acc[c.category]=[];
    acc[c.category].push(c);
    return acc;
  }, {});

  return (
    <div>
      <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:14, flexWrap:"wrap" }}>
        <SelectEl value={selectedUserId||user?.id} onChange={setSelectedUserId}
          options={users.map(u=>({value:u.id,label:`${u.name}（${u.grade}）`}))} style={{ flex:1, minWidth:140 }} />
        <Btn small primary onClick={()=>updateEval("status","done")} disabled={eval_.status==="done"}>提出する</Btn>
      </div>

      {/* Grade info */}
      <div style={{ background:C.purple[50], border:`1px solid ${C.purple[200]}`, borderRadius:10, padding:"10px 14px", marginBottom:12, fontSize:12, color:C.purple[800] }}>
        <strong>{user?.grade}</strong> — {GRADE_DEFS[user?.grade]}
      </div>

      {/* Tab */}
      <div style={{ display:"flex", gap:6, background:C.gray[50], borderRadius:10, padding:4, marginBottom:14, width:"fit-content" }}>
        {["manager","self"].map(t=>(
          <button key={t} onClick={()=>setTab(t)} style={{
            padding:"7px 18px", fontSize:13, borderRadius:8, border:"none", cursor:"pointer", fontFamily:"inherit",
            background:tab===t?C.purple[50]:"transparent",
            color:tab===t?C.purple[800]:C.gray[400],
            fontWeight:tab===t?500:400,
          }}>{t==="manager"?"上司評価":"自己評価"}</button>
        ))}
      </div>

      {/* Score summary */}
      {rank && (
        <Card style={{ borderLeft:`3px solid ${rankColor(rank)[400]}` }}>
          <div style={{ display:"flex", alignItems:"center", gap:16 }}>
            <div>
              <div style={{ fontSize:11, color:C.gray[400], marginBottom:2 }}>総合点</div>
              <div style={{ fontSize:28, fontWeight:700, color:C.gray[800] }}>{totalScore}<span style={{ fontSize:14, fontWeight:400, color:C.gray[400] }}>/100</span></div>
            </div>
            <div>
              <div style={{ fontSize:11, color:C.gray[400], marginBottom:4 }}>ランク</div>
              <RankBadge rank={rank} size="lg" />
            </div>
            <div style={{ flex:1 }}>
              <ScoreBar score={totalScore} />
              <div style={{ fontSize:11, color:C.gray[400], marginTop:4 }}>
                {RANK_DEFS.find(r=>r.rank===rank)?.label} · {RANK_DEFS.find(r=>r.rank===rank)?.range}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Criteria by category */}
      {Object.entries(categoryGroups).map(([cat, items]) => {
        const cc = categoryColor(cat);
        return (
          <Card key={cat}>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12 }}>
              <span style={{ fontSize:11, padding:"2px 10px", borderRadius:12, background:cc[50], color:cc[800], fontWeight:500 }}>{cat}</span>
              <span style={{ fontSize:11, color:C.gray[400] }}>配点 {items.reduce((a,c)=>a+c.points,0)}点</span>
            </div>
            {items.map((c,i) => {
              const sc = scores[c.no]||0;
              const itemScore = sc>0?Math.round((c.points*sc)/5):0;
              return (
                <div key={c.no} style={{ marginBottom:i<items.length-1?16:0, paddingBottom:i<items.length-1?16:0, borderBottom:i<items.length-1?`0.5px solid ${C.gray[50]}`:"none" }}>
                  <div style={{ display:"flex", alignItems:"start", justifyContent:"space-between", marginBottom:8, gap:8 }}>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:12, color:C.gray[400], marginBottom:2 }}>No.{c.no} · 配点{c.points}点</div>
                      <div style={{ fontSize:13, color:C.gray[800], lineHeight:1.5 }}>{c.item}</div>
                    </div>
                    <div style={{ flexShrink:0, textAlign:"right" }}>
                      <ScoreInput value={sc} onChange={val=>updateEval(prefix+"Scores",{...scores,[c.no]:val})} readonly={eval_.status==="done"} />
                      {sc>0 && <div style={{ fontSize:11, color:C.purple[600], marginTop:3, textAlign:"right" }}>{itemScore}点獲得</div>}
                    </div>
                  </div>
                  <Textarea
                    rows={2}
                    value={eval_[prefix+"Comments"]?.[c.no]||""}
                    onChange={v=>updateEval(prefix+"Comments",{...(eval_[prefix+"Comments"]||{}),[c.no]:v})}
                    placeholder={tab==="manager"?"上司評価コメント・根拠を入力":"自己評価コメント・根拠を入力"}
                  />
                </div>
              );
            })}
          </Card>
        );
      })}

      {/* 昇格判定補助欄 */}
      <Card>
        <CardTitle>昇格判定補助欄</CardTitle>
        <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:10 }}>
          {[
            { key:"nextGrade", label:"次等級候補", placeholder:"例：G4候補" },
            { key:"requirements", label:"必須条件充足状況", placeholder:"充足 / 一部未充足 / 未充足" },
            { key:"nextRoleAdvance", label:"次等級期待役割の先取り", placeholder:"先取りあり / なし" },
            { key:"compliance", label:"コンプライアンス重大違反", placeholder:"なし / あり（詳細）" },
            { key:"promotion", label:"昇格推薦可否", placeholder:"推薦 / 見送り / 条件付き推薦" },
          ].map(f=>(
            <div key={f.key}>
              <div style={{ fontSize:12, color:C.gray[400], marginBottom:4 }}>{f.label}</div>
              <Input value={eval_[f.key]||""} onChange={v=>updateEval(f.key,v)} placeholder={f.placeholder} />
            </div>
          ))}
        </div>
      </Card>

      {/* 総合コメント */}
      <Card>
        <CardTitle>総合コメント・育成計画</CardTitle>
        {[
          { key:"strengths", label:"強み", placeholder:"強みを記入" },
          { key:"improvements", label:"次期の改善課題", placeholder:"改善課題を記入" },
          { key:"devTheme", label:"次期育成テーマ", placeholder:"育成テーマを記入" },
          { key:"managerSupport", label:"上司支援事項", placeholder:"上司として支援する内容" },
          { key:"secondaryComment", label:"二次評価者コメント", placeholder:"二次評価者のコメント" },
        ].map(f=>(
          <div key={f.key} style={{ marginBottom:10 }}>
            <div style={{ fontSize:12, color:C.gray[400], marginBottom:4 }}>{f.label}</div>
            <Textarea value={eval_[f.key]||""} onChange={v=>updateEval(f.key,v)} rows={2} placeholder={f.placeholder} />
          </div>
        ))}
      </Card>

      {/* 自己評価参照 */}
      {tab==="manager" && eval_.selfScores && Object.keys(eval_.selfScores).length>0 && (
        <Card style={{ borderLeft:`3px solid ${C.teal[400]}` }}>
          <CardTitle>本人の自己評価（参考）</CardTitle>
          <div style={{ fontSize:13, color:C.gray[600] }}>
            自己評価点: <strong>{calcScore(eval_.selfScores,user?.grade)}点</strong> · ランク: <RankBadge rank={calcRank(calcScore(eval_.selfScores,user?.grade))} />
          </div>
        </Card>
      )}
    </div>
  );
};

// ── Results ────────────────────────────────────────────────────
const ResultsPage = ({ users, evals }) => {
  const isMobile = useIsMobile();
  const rows = users.map((u,i) => {
    const e = evals[u.id]||{};
    const ms = e.managerScores&&Object.keys(e.managerScores).length?calcScore(e.managerScores,u.grade):null;
    const ss = e.selfScores&&Object.keys(e.selfScores).length?calcScore(e.selfScores,u.grade):null;
    return { ...u, idx:i, ms, ss, rank:ms!==null?calcRank(ms):null };
  });

  const gradeAvgs = GRADES.map(g => {
    const ug = rows.filter(u=>u.grade===g&&u.ms!==null);
    return { grade:g, avg:ug.length?Math.round(ug.reduce((a,u)=>a+u.ms,0)/ug.length):null, count:ug.length };
  });

  const rankCounts = ["S","A","B","C","D"].map(r=>({ rank:r, count:rows.filter(u=>u.rank===r).length }));

  return (
    <div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:10, marginBottom:14 }}>
        <MetricCard label="評価完了" value={rows.filter(u=>u.rank).length} sub={`/ ${users.length} 名`} />
        <MetricCard label="チーム平均点" value={rows.filter(u=>u.ms!==null).length?Math.round(rows.filter(u=>u.ms!==null).reduce((a,u)=>a+u.ms,0)/rows.filter(u=>u.ms!==null).length):"-"} sub="/ 100点" />
      </div>

      <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1fr 1fr", gap:12, marginBottom:12 }}>
        <Card>
          <CardTitle>ランク別分布</CardTitle>
          {rankCounts.map(r=>{
            const c = rankColor(r.rank);
            return (
              <div key={r.rank} style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
                <RankBadge rank={r.rank} />
                <div style={{ flex:1, height:6, background:C.gray[100], borderRadius:3, overflow:"hidden" }}>
                  <div style={{ height:"100%", width:`${users.length?r.count/users.length*100:0}%`, background:c[400], borderRadius:3 }} />
                </div>
                <span style={{ fontSize:13, fontWeight:500, color:C.gray[800], minWidth:20 }}>{r.count}名</span>
              </div>
            );
          })}
        </Card>
        <Card>
          <CardTitle>等級別 平均点</CardTitle>
          {gradeAvgs.filter(g=>g.count>0).map(g=>(
            <div key={g.grade} style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
              <span style={{ fontSize:12, color:C.purple[600], fontWeight:600, width:24 }}>{g.grade}</span>
              <div style={{ flex:1, height:6, background:C.gray[100], borderRadius:3, overflow:"hidden" }}>
                <div style={{ height:"100%", width:`${g.avg}%`, background:C.purple[400], borderRadius:3 }} />
              </div>
              <span style={{ fontSize:13, fontWeight:500, color:C.gray[800], minWidth:44 }}>{g.avg}点</span>
            </div>
          ))}
        </Card>
      </div>

      <Card>
        <CardTitle>メンバー別スコア一覧</CardTitle>
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
            <thead>
              <tr style={{ borderBottom:`0.5px solid ${C.gray[100]}` }}>
                {["名前","等級","上司評価点","自己評価点","ランク","状態"].map(h=>(
                  <th key={h} style={{ textAlign:"left", padding:"6px 8px", color:C.gray[400], fontWeight:400, whiteSpace:"nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(u=>(
                <tr key={u.id} style={{ borderBottom:`0.5px solid ${C.gray[50]}` }}>
                  <td style={{ padding:"8px", color:C.gray[800], fontWeight:500 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                      <Avatar name={u.name} idx={u.idx} size={24} />
                      {u.name}
                    </div>
                  </td>
                  <td style={{ padding:"8px" }}><span style={{ color:C.purple[600], fontWeight:600 }}>{u.grade}</span></td>
                  <td style={{ padding:"8px", fontWeight:500, color:C.gray[800] }}>{u.ms!==null?`${u.ms}点`:"-"}</td>
                  <td style={{ padding:"8px", color:C.gray[600] }}>{u.ss!==null?`${u.ss}点`:"-"}</td>
                  <td style={{ padding:"8px" }}><RankBadge rank={u.rank} /></td>
                  <td style={{ padding:"8px" }}><Badge type={evals[u.id]?.status==="done"?"done":u.ms!==null?"wip":"none"}>{evals[u.id]?.status==="done"?"完了":u.ms!==null?"入力中":"未"}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

// ── AI Analysis ────────────────────────────────────────────────
const AIPage = ({ users, evals }) => {
  const [target, setTarget] = useState("all");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const buildPrompt = () => {
    if (target==="all") {
      const rows = users.map(u=>{
        const e = evals[u.id]||{};
        const ms = e.managerScores&&Object.keys(e.managerScores).length?calcScore(e.managerScores,u.grade):null;
        return `${u.name}（${u.grade}·${u.dept}）: ${ms!==null?`${ms}点 ランク${calcRank(ms)}`:"未評価"}`;
      }).join("\n");
      return `以下のG1〜G5等級制・100点満点の人事評価データを分析し、チームの強み・課題・推奨アクションを300字程度の日本語でサマリーしてください。\n\n【評価結果】\n${rows}`;
    }
    const u = users.find(u=>u.id===target);
    const e = evals[u.id]||{};
    const criteria = GRADE_CRITERIA[u.grade]||[];
    const ms = e.managerScores||{};
    const scoreDetail = criteria.map(c=>`・${c.item}（配点${c.points}点）: 評価${ms[c.no]||"-"}点`).join("\n");
    const totalMs = calcScore(ms,u.grade);
    return `以下の個人評価データを分析し、強み・課題・来期の推奨アクションを300字程度の日本語でまとめてください。\n\n【対象者】${u.name}（${u.grade}·${u.dept}）\n【上司評価 総合点】${totalMs}点 / ランク${calcRank(totalMs)}\n\n【項目別スコア】\n${scoreDetail}\n\n【強み】${e.strengths||"未記入"}\n【改善課題】${e.improvements||"未記入"}\n【昇格推薦】${e.promotion||"未入力"}`;
  };

  const run = async () => {
    setLoading(true); setError(null); setResult(null);
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({ model:"claude-sonnet-4-6", max_tokens:1000, messages:[{role:"user",content:buildPrompt()}] }),
      });
      const data = await res.json();
      const text = data.content?.map(i=>i.text||"").join("\n");
      if (text) setResult(text); else setError("分析結果を取得できませんでした。");
    } catch { setError("通信エラーが発生しました。"); }
    finally { setLoading(false); }
  };

  return (
    <div>
      <Card>
        <CardTitle>分析対象を選択</CardTitle>
        <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
          <SelectEl value={target} onChange={setTarget}
            options={[{value:"all",label:"チーム全体"},...users.map(u=>({value:u.id,label:`${u.name}（${u.grade}）`}))]}
            style={{ flex:1, minWidth:140 }} />
          <Btn primary onClick={run} disabled={loading}>{loading?"分析中...":"✦ AI分析を実行"}</Btn>
        </div>
      </Card>
      {loading && <div style={{ background:C.purple[50], border:`0.5px solid ${C.purple[200]}`, borderRadius:12, padding:"20px", display:"flex", gap:10, alignItems:"center" }}><span style={{fontSize:18}}>✦</span><span style={{fontSize:13,color:C.purple[800]}}>評価データを解析中...</span></div>}
      {error && <div style={{ background:C.coral[50], border:`0.5px solid ${C.coral[200]}`, borderRadius:12, padding:"16px 18px", fontSize:13, color:C.coral[800] }}>{error}</div>}
      {result && (
        <div style={{ background:C.purple[50], border:`0.5px solid ${C.purple[200]}`, borderRadius:12, padding:"18px 20px" }}>
          <div style={{ display:"flex", gap:6, alignItems:"center", marginBottom:10 }}>
            <span style={{fontSize:14}}>✦</span>
            <span style={{fontSize:12,fontWeight:500,color:C.purple[800]}}>AI分析サマリー — {target==="all"?"チーム全体":users.find(u=>u.id===target)?.name}</span>
          </div>
          <div style={{ fontSize:13, color:C.purple[900], lineHeight:1.8, whiteSpace:"pre-wrap" }}>{result}</div>
        </div>
      )}
      {!loading&&!result&&!error && (
        <div style={{ textAlign:"center", padding:"40px 20px", color:C.gray[400], fontSize:13, background:C.gray[50], borderRadius:12 }}>
          分析対象を選んで「AI分析を実行」を押してください。
        </div>
      )}

      {/* Rank legend */}
      <Card style={{ marginTop:12 }}>
        <CardTitle>評価ランク基準</CardTitle>
        <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
          {RANK_DEFS.map(r=>(
            <div key={r.rank} style={{ display:"flex", alignItems:"center", gap:10 }}>
              <RankBadge rank={r.rank} />
              <span style={{ fontSize:12, color:C.gray[600] }}>{r.range}</span>
              <span style={{ fontSize:12, color:C.gray[800], fontWeight:500 }}>{r.label}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

// ── User Management ────────────────────────────────────────────
const UserManagePage = ({ users, setUsers }) => {
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ name:"", dept:DEPARTMENTS[0], grade:"G1", email:"", password:"" });

  const openNew = () => { setEditingId(null); setForm({name:"",dept:DEPARTMENTS[0],grade:"G1",email:"",password:""}); setShowModal(true); };
  const openEdit = u => { setEditingId(u.id); setForm({name:u.name,dept:u.dept,grade:u.grade,email:u.email||"",password:u.password||""}); setShowModal(true); };
  const save = () => {
    if (!form.name.trim()) return;
    setUsers(prev=>{
      if (editingId) return prev.map(u=>u.id===editingId?{...u,...form}:u);
      return [...prev,{id:"u"+Date.now(),...form,role:"member",managerId:"u0"}];
    });
    setShowModal(false);
  };
  const remove = id => { if(window.confirm("削除しますか？")) setUsers(prev=>prev.filter(u=>u.id!==id)); };

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:14 }}><Btn primary onClick={openNew}>+ メンバーを追加</Btn></div>
      <Card>
        {users.map((u,i)=>(
          <div key={u.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 0", borderBottom:i<users.length-1?`0.5px solid ${C.gray[50]}`:"none" }}>
            <Avatar name={u.name} idx={i} size={32} />
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:13, fontWeight:500, color:C.gray[800] }}>{u.name}</div>
              <div style={{ fontSize:11, color:C.gray[400] }}>{u.dept} · <span style={{ color:C.purple[600], fontWeight:500 }}>{u.grade}</span></div>
              {u.email && <div style={{ fontSize:11, color:C.gray[400] }}>{u.email}</div>}
            </div>
            <Btn small onClick={()=>openEdit(u)}>編集</Btn>
            <Btn small danger onClick={()=>remove(u.id)}>削除</Btn>
          </div>
        ))}
      </Card>
      {showModal && (
        <Modal title={editingId?"メンバーを編集":"メンバーを追加"} onClose={()=>setShowModal(false)}>
          <div style={{ display:"flex", flexDirection:"column", gap:13 }}>
            <div><div style={{fontSize:12,color:C.gray[400],marginBottom:4}}>名前</div><Input value={form.name} onChange={v=>setForm(f=>({...f,name:v}))} placeholder="例：山田 太郎" /></div>
            <div><div style={{fontSize:12,color:C.gray[400],marginBottom:4}}>部署</div><SelectEl value={form.dept} onChange={v=>setForm(f=>({...f,dept:v}))} options={DEPARTMENTS} style={{width:"100%"}} /></div>
            <div><div style={{fontSize:12,color:C.gray[400],marginBottom:4}}>等級</div><SelectEl value={form.grade} onChange={v=>setForm(f=>({...f,grade:v}))} options={GRADES} style={{width:"100%"}} /></div>
            <div><div style={{fontSize:12,color:C.gray[400],marginBottom:4}}>メールアドレス</div><Input value={form.email} onChange={v=>setForm(f=>({...f,email:v}))} placeholder="user@example.com" type="email" /></div>
            <div><div style={{fontSize:12,color:C.gray[400],marginBottom:4}}>パスワード</div><Input value={form.password} onChange={v=>setForm(f=>({...f,password:v}))} placeholder="初期パスワード" /></div>
            <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:4}}>
              <Btn onClick={()=>setShowModal(false)}>キャンセル</Btn>
              <Btn primary onClick={save}>保存</Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

// ── Period Management ──────────────────────────────────────────
const PeriodPage = ({ periods, setPeriods }) => {
  const [showModal, setShowModal] = useState(false);
  const [label, setLabel] = useState("");
  const add = () => { if(!label.trim()) return; setPeriods(prev=>[...prev,{id:"p"+Date.now(),label,active:false}]); setShowModal(false); setLabel(""); };
  return (
    <div>
      <div style={{display:"flex",justifyContent:"flex-end",marginBottom:14}}><Btn primary onClick={()=>setShowModal(true)}>+ 評価期間を追加</Btn></div>
      <Card>
        {periods.map((p,i)=>(
          <div key={p.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 0",borderBottom:i<periods.length-1?`0.5px solid ${C.gray[50]}`:"none"}}>
            <div style={{flex:1,fontSize:14,color:C.gray[800],fontWeight:p.active?500:400}}>{p.label}</div>
            {p.active?<Badge type="done">現在の期間</Badge>:<Btn small onClick={()=>setPeriods(prev=>prev.map(x=>({...x,active:x.id===p.id})))}>アクティブにする</Btn>}
          </div>
        ))}
      </Card>
      {showModal && (
        <Modal title="評価期間を追加" onClose={()=>setShowModal(false)}>
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            <div><div style={{fontSize:12,color:C.gray[400],marginBottom:4}}>期間名</div><Input value={label} onChange={setLabel} placeholder="例：2026年度 下半期" /></div>
            <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
              <Btn onClick={()=>setShowModal(false)}>キャンセル</Btn>
              <Btn primary onClick={add}>追加</Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

// ── Employee View ──────────────────────────────────────────────
const EmployeeView = ({ currentUser, evals, setEvals, periods, onLogout }) => {
  const [page, setPage] = useState("myeval");
  const activePeriod = periods.find(p=>p.active)||periods[0];
  const eval_ = evals[currentUser.id]||{};
  const updateEval = (key,value) => setEvals(prev=>({...prev,[currentUser.id]:{...prev[currentUser.id],[key]:value}}));
  const criteria = GRADE_CRITERIA[currentUser.grade]||[];
  const selfScores = eval_.selfScores||{};
  const totalSelf = calcScore(selfScores, currentUser.grade);
  const selfRank = Object.keys(selfScores).length?calcRank(totalSelf):null;
  const managerScores = eval_.managerScores||{};
  const totalManager = calcScore(managerScores, currentUser.grade);
  const managerRank = Object.keys(managerScores).length?calcRank(totalManager):null;

  const EMP_NAV = [
    { id:"myeval", label:"自分の評価", shortLabel:"評価", icon:"✎" },
    { id:"myresult", label:"評価結果", shortLabel:"結果", icon:"▦" },
  ];
  const pageTitles = { myeval:"自己評価を入力", myresult:"評価結果" };

  const categoryGroups = criteria.reduce((acc,c)=>{ if(!acc[c.category]) acc[c.category]=[]; acc[c.category].push(c); return acc; }, {});

  return (
    <AppShell nav={EMP_NAV} page={page} setPage={setPage} currentUser={currentUser} activePeriod={activePeriod} onLogout={onLogout} pageTitle={pageTitles[page]}>
      {page==="myeval" && (
        <div>
          <div style={{ background:C.purple[50], border:`1px solid ${C.purple[200]}`, borderRadius:10, padding:"10px 14px", marginBottom:12, fontSize:12, color:C.purple[800] }}>
            <strong>{currentUser.grade}</strong> — {GRADE_DEFS[currentUser.grade]}
          </div>
          {selfRank && (
            <Card style={{ borderLeft:`3px solid ${rankColor(selfRank)[400]}` }}>
              <div style={{ display:"flex", alignItems:"center", gap:16 }}>
                <div><div style={{ fontSize:11, color:C.gray[400], marginBottom:2 }}>自己評価 総合点</div><div style={{ fontSize:24, fontWeight:700, color:C.gray[800] }}>{totalSelf}<span style={{ fontSize:12, color:C.gray[400] }}>/100</span></div></div>
                <div><div style={{ fontSize:11, color:C.gray[400], marginBottom:4 }}>ランク</div><RankBadge rank={selfRank} size="lg" /></div>
              </div>
            </Card>
          )}
          {Object.entries(categoryGroups).map(([cat,items]) => {
            const cc = categoryColor(cat);
            return (
              <Card key={cat}>
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12 }}>
                  <span style={{ fontSize:11, padding:"2px 10px", borderRadius:12, background:cc[50], color:cc[800], fontWeight:500 }}>{cat}</span>
                </div>
                {items.map((c,i)=>(
                  <div key={c.no} style={{ marginBottom:i<items.length-1?14:0, paddingBottom:i<items.length-1?14:0, borderBottom:i<items.length-1?`0.5px solid ${C.gray[50]}`:"none" }}>
                    <div style={{ display:"flex", alignItems:"start", justifyContent:"space-between", marginBottom:6, gap:8 }}>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:11, color:C.gray[400], marginBottom:2 }}>No.{c.no} · 配点{c.points}点</div>
                        <div style={{ fontSize:13, color:C.gray[800], lineHeight:1.5 }}>{c.item}</div>
                      </div>
                      <ScoreInput value={selfScores[c.no]||0} onChange={val=>updateEval("selfScores",{...selfScores,[c.no]:val})} readonly={eval_.status==="done"} />
                    </div>
                    <Textarea rows={2} value={eval_.selfComments?.[c.no]||""} onChange={v=>updateEval("selfComments",{...(eval_.selfComments||{}),[c.no]:v})} placeholder="自己評価コメント・根拠を入力" />
                  </div>
                ))}
              </Card>
            );
          })}
          {eval_.status!=="done" && <Btn primary onClick={()=>updateEval("status","done")} style={{ width:"100%", justifyContent:"center", marginTop:4 }}>自己評価を提出する</Btn>}
          {eval_.status==="done" && <div style={{ textAlign:"center", padding:"10px", fontSize:13, color:C.green[400] }}>✓ 提出済みです</div>}
        </div>
      )}
      {page==="myresult" && (
        <div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:14 }}>
            <MetricCard label="上司評価 総合点" value={managerRank?`${totalManager}点`:"-"} sub="/ 100点" accent={managerRank?rankColor(managerRank):null} />
            <MetricCard label="自己評価 総合点" value={selfRank?`${totalSelf}点`:"-"} sub="/ 100点" />
          </div>
          {managerRank && (
            <Card style={{ borderLeft:`3px solid ${rankColor(managerRank)[400]}` }}>
              <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:12 }}>
                <div style={{ fontSize:11, color:C.gray[400] }}>上司評価ランク</div>
                <RankBadge rank={managerRank} size="lg" />
              </div>
              <CardTitle>項目別スコア（上司評価）</CardTitle>
              {criteria.map(c=>(
                <div key={c.no} style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
                  <div style={{ fontSize:12, color:C.gray[600], flex:1, lineHeight:1.4 }}>{c.item}</div>
                  <div style={{ flexShrink:0, display:"flex", alignItems:"center", gap:6 }}>
                    <span style={{ fontSize:13, fontWeight:500, color:C.gray[800] }}>{managerScores[c.no]||"-"}/5</span>
                    <span style={{ fontSize:11, color:C.gray[400] }}>({Math.round((c.points*(managerScores[c.no]||0))/5)}点)</span>
                  </div>
                </div>
              ))}
            </Card>
          )}
          {!managerRank && <div style={{ textAlign:"center", padding:"40px 20px", color:C.gray[400], fontSize:13, background:C.gray[50], borderRadius:12 }}>まだ上司評価が入力されていません。</div>}
          {eval_.strengths && <Card><CardTitle>強み</CardTitle><div style={{ fontSize:13, color:C.gray[800], lineHeight:1.7 }}>{eval_.strengths}</div></Card>}
          {eval_.improvements && <Card><CardTitle>次期の改善課題</CardTitle><div style={{ fontSize:13, color:C.gray[800], lineHeight:1.7 }}>{eval_.improvements}</div></Card>}
          {eval_.promotion && <Card><CardTitle>昇格推薦可否</CardTitle><div style={{ fontSize:14, fontWeight:500, color:C.purple[800] }}>{eval_.promotion}</div></Card>}
        </div>
      )}
    </AppShell>
  );
};

// ── Settings Page ──────────────────────────────────────────────
const SettingsPage = ({ currentUser, setCurrentUser, users, setUsers, departments, setDepartments, gradeDefs, setGradeDefs, periods, setPeriods, managerAccount, setManagerAccount }) => {
  const [tab, setTab] = useState("account");
  const [saved, setSaved] = useState("");

  const showSaved = (msg="保存しました") => { setSaved(msg); setTimeout(()=>setSaved(""), 2500); };

  // Account / Password
  const [newName, setNewName] = useState(currentUser.name);
  const [newEmail, setNewEmail] = useState(currentUser.email);
  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [pwError, setPwError] = useState("");

  const saveAccount = () => {
    if (!newName.trim()) return;
    const emailChanged = newEmail.trim() !== currentUser.email;
    const nameChanged = newName.trim() !== currentUser.name;
    if (emailChanged && [...users].some(u=>u.email===newEmail.trim())) {
      showSaved("そのメールアドレスはすでに使われています"); return;
    }
    setCurrentUser(prev=>({...prev, name:newName.trim(), email:newEmail.trim()}));
    setManagerAccount(prev=>({...prev, name:newName.trim(), email:newEmail.trim()}));
    showSaved("アカウント情報を更新しました");
  };
  const savePassword = () => {
    setPwError("");
    if (oldPw !== managerAccount.password) { setPwError("現在のパスワードが正しくありません"); return; }
    if (newPw.length < 4) { setPwError("新しいパスワードは4文字以上にしてください"); return; }
    setManagerAccount(prev=>({...prev, password:newPw}));
    setCurrentUser(prev=>({...prev, password:newPw}));
    setOldPw(""); setNewPw("");
    showSaved("パスワードを変更しました");
  };

  // Bulk user creation
  const [bulkText, setBulkText] = useState("");
  const [bulkError, setBulkError] = useState("");
  const parseBulk = () => {
    setBulkError("");
    const lines = bulkText.trim().split("\n").filter(l=>l.trim());
    const newUsers = [];
    for (const line of lines) {
      const parts = line.split(/[,\t]/).map(s=>s.trim());
      if (parts.length < 4) { setBulkError(`形式エラー：「${line}」\n形式：名前, メール, パスワード, 等級, 部署（任意）`); return; }
      const [name, email, password, grade, dept] = parts;
      if (!["G1","G2","G3","G4","G5"].includes(grade)) { setBulkError(`等級エラー：「${grade}」はG1〜G5のいずれかにしてください`); return; }
      if ([...users, ...newUsers, managerAccount].some(u=>u.email===email)) { setBulkError(`メール重複：「${email}」はすでに登録されています`); return; }
      newUsers.push({ id:"u"+Date.now()+Math.random(), name, email, password, grade, dept:dept||departments[0], role:"member", managerId:"u0" });
    }
    setUsers(prev=>[...prev, ...newUsers]);
    setBulkText("");
    showSaved(`${newUsers.length}名を追加しました`);
  };

  // Departments
  const [newDept, setNewDept] = useState("");
  const addDept = () => { if(newDept.trim()&&!departments.includes(newDept.trim())) { setDepartments(prev=>[...prev,newDept.trim()]); setNewDept(""); showSaved("部署を追加しました"); } };
  const removeDept = (d) => setDepartments(prev=>prev.filter(x=>x!==d));

  // Grade defs
  const [localGradeDefs, setLocalGradeDefs] = useState({...gradeDefs});
  const saveGradeDefs = () => { setGradeDefs({...localGradeDefs}); showSaved("等級定義を保存しました"); };

  // Periods
  const [newPeriodLabel, setNewPeriodLabel] = useState("");
  const addPeriod = () => { if(!newPeriodLabel.trim()) return; setPeriods(prev=>[...prev,{id:"p"+Date.now(),label:newPeriodLabel.trim(),active:false}]); setNewPeriodLabel(""); showSaved("評価期間を追加しました"); };
  const removePeriod = (id) => setPeriods(prev=>prev.filter(p=>p.id!==id));
  const setActivePeriod = (id) => { setPeriods(prev=>prev.map(p=>({...p,active:p.id===id}))); showSaved("アクティブ期間を変更しました"); };

  const tabStyle = (t) => ({
    padding:"8px 16px", fontSize:13, borderRadius:8, border:"none", cursor:"pointer", fontFamily:"inherit",
    background:tab===t?C.purple[50]:"transparent",
    color:tab===t?C.purple[800]:C.gray[600],
    fontWeight:tab===t?500:400,
  });

  return (
    <div>
      {saved && (
        <div style={{ background:C.green[50], border:`1px solid ${C.green[400]}`, borderRadius:8, padding:"8px 14px", marginBottom:12, fontSize:13, color:C.green[800], display:"flex", alignItems:"center", gap:6 }}>
          ✓ {saved}
        </div>
      )}

      <div style={{ display:"flex", gap:6, background:C.gray[50], borderRadius:10, padding:4, marginBottom:16, flexWrap:"wrap" }}>
        {[
          { id:"account", label:"アカウント" },
          { id:"password", label:"パスワード" },
          { id:"bulk", label:"社員一括登録" },
          { id:"departments", label:"部署" },
          { id:"grades", label:"等級定義" },
          { id:"periods", label:"評価期間" },
        ].map(t=>(
          <button key={t.id} style={tabStyle(t.id)} onClick={()=>setTab(t.id)}>{t.label}</button>
        ))}
      </div>

      {/* Account */}
      {tab==="account" && (
        <Card>
          <CardTitle>アカウント情報</CardTitle>
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            <div>
              <div style={{ fontSize:12, color:C.gray[400], marginBottom:4 }}>表示名</div>
              <Input value={newName} onChange={setNewName} placeholder="名前" />
            </div>
            <div>
              <div style={{ fontSize:12, color:C.gray[400], marginBottom:4 }}>メールアドレス</div>
              <Input value={newEmail} onChange={setNewEmail} placeholder="your@example.com" type="email" />
            </div>
            <Btn primary onClick={saveAccount}>保存する</Btn>
          </div>
        </Card>
      )}

      {/* Password */}
      {tab==="password" && (
        <Card>
          <CardTitle>パスワード変更</CardTitle>
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            <div>
              <div style={{ fontSize:12, color:C.gray[400], marginBottom:4 }}>現在のパスワード</div>
              <Input value={oldPw} onChange={setOldPw} placeholder="現在のパスワード" type="password" />
            </div>
            <div>
              <div style={{ fontSize:12, color:C.gray[400], marginBottom:4 }}>新しいパスワード</div>
              <Input value={newPw} onChange={setNewPw} placeholder="新しいパスワード（4文字以上）" type="password" />
            </div>
            {pwError && <div style={{ fontSize:12, color:C.coral[400], padding:"8px 12px", background:C.coral[50], borderRadius:8 }}>{pwError}</div>}
            <Btn primary onClick={savePassword}>パスワードを変更する</Btn>
          </div>
        </Card>
      )}

      {/* Bulk user creation */}
      {tab==="bulk" && (
        <div>
          <Card>
            <CardTitle>社員一括登録</CardTitle>
            <div style={{ fontSize:12, color:C.gray[400], marginBottom:10, lineHeight:1.8 }}>
              1行に1名ずつ入力してください。<br/>
              形式：<code style={{ background:C.gray[50], padding:"1px 6px", borderRadius:4 }}>名前, メール, パスワード, 等級, 部署（任意）</code><br/>
              等級はG1〜G5のいずれかを入力してください。
            </div>
            <div style={{ background:C.purple[50], borderRadius:8, padding:"10px 14px", marginBottom:12, fontSize:12, color:C.purple[800] }}>
              <strong>入力例：</strong><br/>
              田中 太郎, tanaka@example.com, pass1234, G2, 営業1部<br/>
              鈴木 花子, suzuki@example.com, pass5678, G3, 営業2部<br/>
              佐藤 次郎, sato@example.com, pass9012, G1
            </div>
            <Textarea
              rows={8}
              value={bulkText}
              onChange={setBulkText}
              placeholder={"田中 太郎, tanaka@example.com, pass1234, G2, 営業1部\n鈴木 花子, suzuki@example.com, pass5678, G3"}
            />
            {bulkError && <div style={{ fontSize:12, color:C.coral[400], padding:"8px 12px", background:C.coral[50], borderRadius:8, marginTop:8, whiteSpace:"pre-wrap" }}>{bulkError}</div>}
            <div style={{ marginTop:12 }}>
              <Btn primary onClick={parseBulk}>登録する</Btn>
            </div>
          </Card>
          <Card>
            <CardTitle>登録済み社員一覧（{users.length}名）</CardTitle>
            {users.map((u,i)=>(
              <div key={u.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 0", borderBottom:i<users.length-1?`0.5px solid ${C.gray[50]}`:"none" }}>
                <Avatar name={u.name} idx={i} size={28} />
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight:500, color:C.gray[800] }}>{u.name}</div>
                  <div style={{ fontSize:11, color:C.gray[400] }}>{u.email} · <span style={{ color:C.purple[600] }}>{u.grade}</span> · {u.dept}</div>
                </div>
                <div style={{ fontSize:11, color:C.gray[400] }}>PW: {u.password}</div>
              </div>
            ))}
          </Card>
        </div>
      )}

      {/* Departments */}
      {tab==="departments" && (
        <Card>
          <CardTitle>部署リスト</CardTitle>
          <div style={{ display:"flex", gap:8, marginBottom:14 }}>
            <Input value={newDept} onChange={setNewDept} placeholder="新しい部署名" style={{ flex:1 }} />
            <Btn primary onClick={addDept}>追加</Btn>
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
            {departments.map(d=>(
              <div key={d} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"8px 12px", background:C.gray[50], borderRadius:8 }}>
                <span style={{ fontSize:13, color:C.gray[800] }}>{d}</span>
                <Btn small danger onClick={()=>removeDept(d)}>削除</Btn>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Grade defs */}
      {tab==="grades" && (
        <Card>
          <CardTitle action={<Btn small primary onClick={saveGradeDefs}>保存する</Btn>}>等級定義の編集</CardTitle>
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            {["G1","G2","G3","G4","G5"].map(g=>(
              <div key={g}>
                <div style={{ fontSize:12, color:C.purple[600], fontWeight:600, marginBottom:4 }}>{g}</div>
                <Textarea
                  rows={2}
                  value={localGradeDefs[g]||""}
                  onChange={v=>setLocalGradeDefs(prev=>({...prev,[g]:v}))}
                  placeholder={`${g}の等級定義`}
                />
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Periods */}
      {tab==="periods" && (
        <Card>
          <CardTitle>評価期間の管理</CardTitle>
          <div style={{ display:"flex", gap:8, marginBottom:14 }}>
            <Input value={newPeriodLabel} onChange={setNewPeriodLabel} placeholder="例：2026年度 下半期" style={{ flex:1 }} />
            <Btn primary onClick={addPeriod}>追加</Btn>
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
            {periods.map(p=>(
              <div key={p.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 12px", background:p.active?C.purple[50]:C.gray[50], borderRadius:8, border:p.active?`1px solid ${C.purple[200]}`:"none" }}>
                <div style={{ flex:1, fontSize:13, color:C.gray[800], fontWeight:p.active?500:400 }}>{p.label}</div>
                {p.active
                  ? <Badge type="info">現在の期間</Badge>
                  : <Btn small onClick={()=>setActivePeriod(p.id)}>アクティブにする</Btn>
                }
                {!p.active && <Btn small danger onClick={()=>removePeriod(p.id)}>削除</Btn>}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};

// ── Manager Nav ────────────────────────────────────────────────
const MANAGER_NAV = [
  { id:"dashboard",  label:"ダッシュボード", shortLabel:"ホーム", icon:"⊞" },
  { id:"evaluation", label:"評価フォーム",   shortLabel:"評価",  icon:"✎" },
  { id:"results",    label:"結果・集計",     shortLabel:"集計",  icon:"▦" },
  { id:"ai",         label:"AI分析",         shortLabel:"AI",    icon:"✦" },
  { id:"users",      label:"メンバー管理",   shortLabel:"管理",  icon:"⚉" },
  { id:"settings",   label:"設定",           shortLabel:"設定",  icon:"⚙" },
];

// ── App ────────────────────────────────────────────────────────
export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [managerAccount, setManagerAccount] = useState(MANAGER_ACCOUNT);
  const [page, setPage] = useState("dashboard");
  const [users, setUsers] = useState(SEED_USERS);
  const [evals, setEvals] = useState({});
  const [periods, setPeriods] = useState(PERIODS);
  const [departments, setDepartments] = useState(DEPARTMENTS);
  const [gradeDefs, setGradeDefs] = useState({...GRADE_DEFS});
  const [selectedUserId, setSelectedUserId] = useState(SEED_USERS[0].id);

  const activePeriod = periods.find(p=>p.active)||periods[0];

  const handleLogin = user => {
    // マネージャーアカウントは最新のmanagerAccountと照合
    const allAccounts = [managerAccount, ...users];
    const match = allAccounts.find(u=>u.email===user.email&&u.password===user.password);
    if (match) { setCurrentUser(match); setPage("dashboard"); }
    else setCurrentUser(user);
  };
  const handleLogout = () => setCurrentUser(null);

  // LoginPageに最新のmanagerAccountを渡すためのログイン処理
  const handleLoginAttempt = (email, password) => {
    const allAccounts = [managerAccount, ...users];
    return allAccounts.find(u=>u.email===email.trim()&&u.password===password)||null;
  };

  if (!currentUser) return <LoginPage users={users} managerAccount={managerAccount} onLogin={(user)=>{setCurrentUser(user);setPage("dashboard");}} />;
  if (currentUser.role==="member") return <EmployeeView currentUser={currentUser} evals={evals} setEvals={setEvals} periods={periods} onLogout={handleLogout} />;

  const pageTitles = { dashboard:"ダッシュボード", evaluation:"評価フォーム", results:"結果・集計", ai:"AI分析", users:"メンバー管理", settings:"設定" };

  return (
    <AppShell nav={MANAGER_NAV} page={page} setPage={setPage} currentUser={currentUser} activePeriod={activePeriod} onLogout={handleLogout} pageTitle={pageTitles[page]}>
      {page==="dashboard"  && <Dashboard users={users} evals={evals} onNavigate={setPage} onSelectUser={setSelectedUserId} />}
      {page==="evaluation" && <EvaluationPage users={users} evals={evals} setEvals={setEvals} selectedUserId={selectedUserId} setSelectedUserId={setSelectedUserId} />}
      {page==="results"    && <ResultsPage users={users} evals={evals} />}
      {page==="ai"         && <AIPage users={users} evals={evals} />}
      {page==="users"      && <UserManagePage users={users} setUsers={setUsers} />}
      {page==="settings"   && (
        <SettingsPage
          currentUser={currentUser}
          setCurrentUser={setCurrentUser}
          users={users}
          setUsers={setUsers}
          departments={departments}
          setDepartments={setDepartments}
          gradeDefs={gradeDefs}
          setGradeDefs={setGradeDefs}
          periods={periods}
          setPeriods={setPeriods}
          managerAccount={managerAccount}
          setManagerAccount={setManagerAccount}
        />
      )}
    </AppShell>
  );
}
