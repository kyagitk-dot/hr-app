import { useState, useCallback, useEffect } from "react";

// ─── Design tokens ───────────────────────────────────────────────
const C = {
  purple: { 50: "#EEEDFE", 100: "#CECBF6", 200: "#AFA9EC", 400: "#7F77DD", 600: "#534AB7", 800: "#3C3489", 900: "#26215C" },
  teal:   { 50: "#E1F5EE", 200: "#5DCAA5", 400: "#1D9E75", 800: "#085041" },
  amber:  { 50: "#FAEEDA", 200: "#EF9F27", 400: "#BA7517", 800: "#633806" },
  coral:  { 50: "#FAECE7", 200: "#F0997B", 400: "#D85A30", 800: "#712B13" },
  green:  { 50: "#EAF3DE", 400: "#639922", 800: "#27500A" },
  gray:   { 50: "#F4F3EF", 100: "#E8E7E2", 200: "#D3D1C7", 400: "#888780", 600: "#5F5E5A", 800: "#2C2C2A" },
};

// ─── useMediaQuery hook ───────────────────────────────────────────
const useIsMobile = () => {
  const [mobile, setMobile] = useState(() => window.innerWidth < 640);
  useEffect(() => {
    const fn = () => setMobile(window.innerWidth < 640);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);
  return mobile;
};

// ─── Seed data ────────────────────────────────────────────────────
const PERIODS = [
  { id: "2026H1", label: "2026年度 上半期", active: true },
  { id: "2025H2", label: "2025年度 下半期", active: false },
  { id: "2025H1", label: "2025年度 上半期", active: false },
];
const DEPARTMENTS = ["エンジニアリング", "デザイン", "プロダクト", "営業", "マーケティング"];
const GRADES = ["ジュニア", "ミドル", "シニア", "リード", "マネージャー"];
const CRITERIA = ["業務遂行力", "チームワーク", "主体性", "専門スキル", "コミュニケーション"];
const MANAGER_ACCOUNT = { id: "u0", name: "山田 太郎", dept: "エンジニアリング", grade: "マネージャー", role: "manager", email: "yamada@example.com", password: "manager123" };
const SEED_USERS = [
  { id: "u1", name: "田中 花子", dept: "エンジニアリング", grade: "シニア",   role: "member", managerId: "u0", email: "tanaka@example.com",   password: "tanaka123" },
  { id: "u2", name: "佐藤 健一", dept: "デザイン",         grade: "ミドル",   role: "member", managerId: "u0", email: "sato@example.com",     password: "sato123" },
  { id: "u3", name: "鈴木 美里", dept: "プロダクト",       grade: "ジュニア", role: "member", managerId: "u0", email: "suzuki@example.com",   password: "suzuki123" },
  { id: "u4", name: "木村 大輔", dept: "エンジニアリング", grade: "ミドル",   role: "member", managerId: "u0", email: "kimura@example.com",   password: "kimura123" },
  { id: "u5", name: "伊藤 結衣", dept: "営業",             grade: "リード",   role: "member", managerId: "u0", email: "ito@example.com",      password: "ito123" },
  { id: "u6", name: "渡辺 翔",   dept: "マーケティング",   grade: "ジュニア", role: "member", managerId: "u0", email: "watanabe@example.com", password: "watanabe123" },
];
const SEED_GOALS = {
  u1: [
    { id: "g1", title: "新機能リリース（Q1）",      deadline: "2026/03/31", weight: 40, progress: 100, status: "done" },
    { id: "g2", title: "コードレビュー文化の定着",  deadline: "2026/06/30", weight: 30, progress: 70,  status: "wip" },
    { id: "g3", title: "技術ブログ6記事執筆",       deadline: "2026/06/30", weight: 30, progress: 50,  status: "wip" },
  ],
  u2: [
    { id: "g4", title: "デザインシステム構築",       deadline: "2026/04/30", weight: 60, progress: 85, status: "wip" },
    { id: "g5", title: "ユーザビリティテスト実施",  deadline: "2026/06/30", weight: 40, progress: 30, status: "wip" },
  ],
  u3: [
    { id: "g6", title: "ロードマップ策定",  deadline: "2026/03/31", weight: 50, progress: 100, status: "done" },
    { id: "g7", title: "KPI指標整備",       deadline: "2026/06/30", weight: 50, progress: 40,  status: "wip" },
  ],
};
const SEED_EVALS = {
  u1: {
    managerScores:  { 業務遂行力: 4, チームワーク: 3, 主体性: 5, 専門スキル: 4, コミュニケーション: 4 },
    managerComment: "技術的な課題に対して主体的に取り組み、チーム全体の生産性向上に貢献しました。",
    managerImprove: "他メンバーへの知識共有をさらに積極的に行うとよいでしょう。",
    selfScores:     { 業務遂行力: 4, チームワーク: 4, 主体性: 4, 専門スキル: 4, コミュニケーション: 3 },
    selfComment:    "今期は新機能の設計と実装をリードし、リリースを予定通り完了できました。",
    selfImprove:    "来期はチームへの技術共有をより積極的に行いたいと思います。",
    status: "done",
  },
  u2: {
    managerScores:  { 業務遂行力: 4, チームワーク: 4, 主体性: 3, 専門スキル: 5, コミュニケーション: 4 },
    managerComment: "デザインシステムの構築を着実に進めており、品質への拘りが感じられます。",
    managerImprove: "スケジュール管理を意識するとさらに良くなります。",
    selfScores:     { 業務遂行力: 3, チームワーク: 4, 主体性: 3, 専門スキル: 5, コミュニケーション: 4 },
    selfComment:    "デザインシステムの基盤を作ることができました。",
    selfImprove:    "進捗管理と報告の頻度を上げたいと思います。",
    status: "done",
  },
};

// ─── Helpers ──────────────────────────────────────────────────────
const avg = (scores) => {
  const vals = Object.values(scores);
  return vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) : "-";
};
const initials = (name) => name.split(" ").map(p => p[0]).join("").slice(0, 2);
const avatarPalettes = {
  purple: { bg: C.purple[50], color: C.purple[800] },
  teal:   { bg: C.teal[50],   color: C.teal[800] },
  coral:  { bg: C.coral[50],  color: C.coral[800] },
  amber:  { bg: C.amber[50],  color: C.amber[800] },
  green:  { bg: C.green[50],  color: C.green[800] },
};
const avatarColorNames = Object.keys(avatarPalettes);
const getAvatarPalette = (idx) => avatarPalettes[avatarColorNames[idx % avatarColorNames.length]];

// ─── Shared UI primitives ─────────────────────────────────────────
const Avatar = ({ name, idx, size = 36 }) => {
  const p = getAvatarPalette(idx);
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: p.bg, color: p.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.34, fontWeight: 500, flexShrink: 0 }}>
      {initials(name)}
    </div>
  );
};

const Badge = ({ type, children }) => {
  const s = { done: { bg: C.green[50], color: C.green[800] }, wip: { bg: C.amber[50], color: C.amber[800] }, none: { bg: C.gray[100], color: C.gray[600] }, info: { bg: C.purple[50], color: C.purple[800] } }[type] || { bg: C.gray[100], color: C.gray[600] };
  return <span style={{ fontSize: 11, padding: "2px 9px", borderRadius: 20, background: s.bg, color: s.color, fontWeight: 500, whiteSpace: "nowrap" }}>{children}</span>;
};

const StarRating = ({ value, onChange, readonly }) => (
  <div style={{ display: "flex", gap: 2 }}>
    {[1,2,3,4,5].map(n => (
      <span key={n} onClick={() => !readonly && onChange?.(n)} style={{ fontSize: 22, cursor: readonly ? "default" : "pointer", color: n <= value ? C.amber[200] : C.gray[100], lineHeight: 1, userSelect: "none" }}>★</span>
    ))}
  </div>
);

const ProgressBar = ({ value, color = C.purple[400] }) => (
  <div style={{ height: 5, background: C.gray[100], borderRadius: 3, overflow: "hidden" }}>
    <div style={{ height: "100%", width: `${Math.min(value, 100)}%`, background: color, borderRadius: 3, transition: "width 0.4s ease" }} />
  </div>
);

const MetricCard = ({ label, value, sub }) => (
  <div style={{ background: C.gray[50], borderRadius: 10, padding: "12px 14px" }}>
    <div style={{ fontSize: 11, color: C.gray[400], marginBottom: 3 }}>{label}</div>
    <div style={{ fontSize: 22, fontWeight: 500, color: C.gray[800] }}>{value}</div>
    {sub && <div style={{ fontSize: 11, color: C.gray[400], marginTop: 1 }}>{sub}</div>}
  </div>
);

const Card = ({ children, style }) => (
  <div style={{ background: "#fff", border: `0.5px solid ${C.gray[100]}`, borderRadius: 12, padding: "14px 16px", marginBottom: 12, ...style }}>{children}</div>
);

const CardTitle = ({ children, action }) => (
  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
    <div style={{ fontSize: 13, fontWeight: 500, color: C.gray[800] }}>{children}</div>
    {action}
  </div>
);

const Btn = ({ children, onClick, primary, small, danger, disabled, style }) => (
  <button onClick={onClick} disabled={disabled} style={{
    padding: small ? "6px 12px" : "8px 16px", fontSize: small ? 12 : 13, borderRadius: 8, cursor: disabled ? "not-allowed" : "pointer",
    border: `0.5px solid ${danger ? C.coral[400] : primary ? C.purple[400] : C.gray[200]}`,
    background: primary ? C.purple[400] : danger ? C.coral[50] : "transparent",
    color: primary ? "#fff" : danger ? C.coral[800] : C.gray[800],
    display: "inline-flex", alignItems: "center", gap: 5, opacity: disabled ? 0.5 : 1,
    fontFamily: "inherit", ...style,
  }}>{children}</button>
);

const Input = ({ value, onChange, placeholder, type = "text", style }) => (
  <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
    style={{ width: "100%", padding: "9px 11px", fontSize: 14, border: `0.5px solid ${C.gray[200]}`, borderRadius: 8, background: "#fff", color: C.gray[800], outline: "none", fontFamily: "inherit", boxSizing: "border-box", ...style }} />
);

const SelectEl = ({ value, onChange, options, style }) => (
  <select value={value} onChange={e => onChange(e.target.value)}
    style={{ padding: "8px 10px", fontSize: 13, borderRadius: 8, border: `0.5px solid ${C.gray[200]}`, background: "#fff", color: C.gray[800], cursor: "pointer", outline: "none", fontFamily: "inherit", ...style }}>
    {options.map(o => <option key={o.value ?? o} value={o.value ?? o}>{o.label ?? o}</option>)}
  </select>
);

const Textarea = ({ value, onChange, rows = 3, placeholder }) => (
  <textarea value={value} onChange={e => onChange(e.target.value)} rows={rows} placeholder={placeholder}
    style={{ width: "100%", padding: "9px 11px", fontSize: 13, border: `0.5px solid ${C.gray[200]}`, borderRadius: 8, background: "#fff", color: C.gray[800], resize: "vertical", fontFamily: "inherit", outline: "none", lineHeight: 1.6, boxSizing: "border-box" }} />
);

const Modal = ({ title, onClose, children }) => (
  <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 16 }}
    onClick={e => e.target === e.currentTarget && onClose()}>
    <div style={{ background: "#fff", borderRadius: 14, width: "100%", maxWidth: 440, maxHeight: "90vh", overflow: "auto" }}>
      <div style={{ padding: "14px 18px", borderBottom: `0.5px solid ${C.gray[100]}`, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, background: "#fff" }}>
        <div style={{ fontSize: 15, fontWeight: 500, color: C.gray[800] }}>{title}</div>
        <button onClick={onClose} style={{ border: "none", background: "none", fontSize: 20, cursor: "pointer", color: C.gray[400], lineHeight: 1, padding: "0 4px" }}>×</button>
      </div>
      <div style={{ padding: "16px 18px" }}>{children}</div>
    </div>
  </div>
);

// ─── Login ────────────────────────────────────────────────────────
const LoginPage = ({ users, onLogin }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = () => {
    setError("");
    const match = [MANAGER_ACCOUNT, ...users].find(u => u.email === email.trim() && u.password === password);
    if (match) onLogin(match);
    else setError("メールアドレスまたはパスワードが正しくありません。");
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: C.gray[50], padding: 16, fontFamily: "system-ui,-apple-system,sans-serif" }}>
      <div style={{ width: "100%", maxWidth: 360 }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontSize: 22, fontWeight: 600, color: C.purple[600], marginBottom: 4 }}>✦ 評価ポータル</div>
          <div style={{ fontSize: 13, color: C.gray[400] }}>アカウントにサインインしてください</div>
        </div>
        <div style={{ background: "#fff", borderRadius: 14, border: `0.5px solid ${C.gray[100]}`, padding: "24px 20px" }}>
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, color: C.gray[600], marginBottom: 5 }}>メールアドレス</div>
            <Input value={email} onChange={setEmail} placeholder="your@example.com" type="email" />
          </div>
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 12, color: C.gray[600], marginBottom: 5 }}>パスワード</div>
            <div style={{ position: "relative" }}>
              <Input value={password} onChange={setPassword} placeholder="パスワードを入力" type={showPw ? "text" : "password"} style={{ paddingRight: 52 }} />
              <button onClick={() => setShowPw(v => !v)} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", border: "none", background: "none", cursor: "pointer", fontSize: 12, color: C.gray[400] }}>{showPw ? "隠す" : "表示"}</button>
            </div>
          </div>
          {error && <div style={{ fontSize: 12, color: C.coral[400], marginBottom: 12, padding: "8px 12px", background: C.coral[50], borderRadius: 8 }}>{error}</div>}
          <button onClick={handleLogin} style={{ width: "100%", padding: 11, fontSize: 14, fontWeight: 500, background: C.purple[400], color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontFamily: "inherit" }}>ログイン</button>
        </div>
        <div style={{ marginTop: 16, background: "#fff", borderRadius: 12, border: `0.5px solid ${C.gray[100]}`, padding: "14px 18px" }}>
          <div style={{ fontSize: 11, fontWeight: 500, color: C.gray[400], marginBottom: 8 }}>デモ用アカウント</div>
          {[
            { label: "マネージャー", email: "yamada@example.com", pw: "manager123", color: C.purple[600] },
            { label: "従業員（田中）", email: "tanaka@example.com", pw: "tanaka123", color: C.teal[400] },
            { label: "従業員（佐藤）", email: "sato@example.com",   pw: "sato123",   color: C.teal[400] },
          ].map(a => (
            <div key={a.email} style={{ marginBottom: 6, fontSize: 12, color: C.gray[600] }}>
              <span style={{ color: a.color, fontWeight: 500 }}>{a.label}：</span>
              <button onClick={() => { setEmail(a.email); setPassword(a.pw); }}
                style={{ background: "none", border: "none", color: C.purple[400], cursor: "pointer", fontSize: 12, padding: 0, textDecoration: "underline", fontFamily: "inherit" }}>
                {a.email}
              </button>
              {" / "}{a.pw}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ─── Bottom nav (mobile) ──────────────────────────────────────────
const BottomNav = ({ nav, page, setPage }) => (
  <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "#fff", borderTop: `0.5px solid ${C.gray[100]}`, display: "flex", zIndex: 100, paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
    {nav.map(n => (
      <button key={n.id} onClick={() => setPage(n.id)} style={{
        flex: 1, padding: "8px 4px 10px", border: "none", background: "none", cursor: "pointer",
        display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
        color: page === n.id ? C.purple[600] : C.gray[400],
      }}>
        <span style={{ fontSize: 20 }}>{n.icon}</span>
        <span style={{ fontSize: 10, fontWeight: page === n.id ? 500 : 400 }}>{n.shortLabel || n.label}</span>
      </button>
    ))}
  </div>
);

// ─── Sidebar (desktop) ────────────────────────────────────────────
const Sidebar = ({ nav, page, setPage, currentUser, activePeriod, onLogout }) => (
  <div style={{ width: 210, flexShrink: 0, background: "#fff", borderRight: `0.5px solid ${C.gray[100]}`, display: "flex", flexDirection: "column", height: "100vh" }}>
    <div style={{ padding: "18px 18px 14px", borderBottom: `0.5px solid ${C.gray[100]}` }}>
      <div style={{ fontSize: 15, fontWeight: 600, color: C.purple[600] }}>✦ 評価ポータル</div>
      <div style={{ fontSize: 11, color: C.gray[400], marginTop: 3 }}>{activePeriod?.label}</div>
    </div>
    <nav style={{ padding: "8px 0", flex: 1, overflowY: "auto" }}>
      {nav.map(n => (
        <button key={n.id} onClick={() => setPage(n.id)} style={{
          display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left",
          padding: "9px 18px", border: "none", cursor: "pointer", fontSize: 13,
          background: page === n.id ? C.purple[50] : "transparent",
          color: page === n.id ? C.purple[800] : C.gray[600],
          fontWeight: page === n.id ? 500 : 400,
          borderRight: page === n.id ? `2px solid ${C.purple[400]}` : "2px solid transparent",
          fontFamily: "inherit",
        }}>
          <span style={{ fontSize: 15 }}>{n.icon}</span>{n.label}
        </button>
      ))}
    </nav>
    <div style={{ padding: "12px 16px", borderTop: `0.5px solid ${C.gray[100]}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <Avatar name={currentUser.name} idx={SEED_USERS.findIndex(u => u.id === currentUser.id)} size={30} />
        <div>
          <div style={{ fontSize: 12, fontWeight: 500, color: C.gray[800] }}>{currentUser.name}</div>
          <div style={{ fontSize: 10, color: C.gray[400] }}>{currentUser.role === "manager" ? "マネージャー" : currentUser.dept}</div>
        </div>
      </div>
      <button onClick={onLogout} style={{ width: "100%", padding: "6px", fontSize: 12, borderRadius: 6, border: `0.5px solid ${C.gray[200]}`, background: "transparent", color: C.gray[600], cursor: "pointer", fontFamily: "inherit" }}>ログアウト</button>
    </div>
  </div>
);

// ─── Shell wrapper ────────────────────────────────────────────────
const AppShell = ({ nav, page, setPage, currentUser, activePeriod, onLogout, pageTitle, children }) => {
  const isMobile = useIsMobile();
  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "system-ui,-apple-system,sans-serif", background: "#f7f6f2", color: C.gray[800] }}>
      {!isMobile && <Sidebar nav={nav} page={page} setPage={setPage} currentUser={currentUser} activePeriod={activePeriod} onLogout={onLogout} />}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: isMobile ? "12px 16px" : "13px 24px", background: "#fff", borderBottom: `0.5px solid ${C.gray[100]}`, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div style={{ fontSize: isMobile ? 15 : 16, fontWeight: 500, color: C.gray[800] }}>{pageTitle}</div>
          {isMobile
            ? <button onClick={onLogout} style={{ fontSize: 12, border: "none", background: "none", color: C.gray[400], cursor: "pointer", fontFamily: "inherit" }}>ログアウト</button>
            : <div style={{ fontSize: 11, color: C.gray[400] }}>{activePeriod?.label}</div>
          }
        </div>
        <div style={{ flex: 1, overflow: "auto", padding: isMobile ? "14px 14px 80px" : "20px 24px" }}>
          {children}
        </div>
      </div>
      {isMobile && <BottomNav nav={nav} page={page} setPage={setPage} />}
    </div>
  );
};

// ─── Dashboard ────────────────────────────────────────────────────
const Dashboard = ({ users, evals, goals, onNavigate, onSelectUser }) => {
  const isMobile = useIsMobile();
  const statusOf = u => { const e = evals[u.id]; return e?.status === "done" ? "done" : e?.managerComment ? "wip" : "none"; };
  const statusLabel = { done: "評価済み", wip: "入力中", none: "未評価" };
  const allScores = users.flatMap(u => Object.values(evals[u.id]?.managerScores || {}));
  const teamAvg = allScores.length ? (allScores.reduce((a,b)=>a+b,0)/allScores.length).toFixed(1) : "-";
  const doneCount = users.filter(u => evals[u.id]?.status === "done").length;
  const selfCount = users.filter(u => evals[u.id]?.selfComment).length;

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 10, marginBottom: 14 }}>
        <MetricCard label="対象メンバー" value={users.length} sub="名" />
        <MetricCard label="評価完了" value={doneCount} sub={`/ ${users.length} 名`} />
        <MetricCard label="自己評価完了" value={selfCount} sub={`/ ${users.length} 名`} />
        <MetricCard label="チーム平均" value={teamAvg} sub="/ 5.0" />
      </div>
      <Card>
        <CardTitle action={<Btn small primary onClick={() => onNavigate("evaluation")}>+ 評価を入力</Btn>}>メンバー一覧</CardTitle>
        {users.map((u, i) => {
          const e = evals[u.id];
          const sc = e?.managerScores ? avg(e.managerScores) : "-";
          const gs = goals[u.id] || [];
          const gDone = gs.filter(g=>g.status==="done").length;
          const st = statusOf(u);
          return (
            <div key={u.id} onClick={() => { onSelectUser(u.id); onNavigate("evaluation"); }}
              style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 6px", borderRadius: 8, cursor: "pointer", borderBottom: i < users.length-1 ? `0.5px solid ${C.gray[50]}` : "none" }}
              onMouseEnter={e => e.currentTarget.style.background=C.gray[50]}
              onMouseLeave={e => e.currentTarget.style.background="transparent"}>
              <Avatar name={u.name} idx={i} size={34} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: C.gray[800], whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{u.name}</div>
                <div style={{ fontSize: 11, color: C.gray[400] }}>{u.dept}</div>
              </div>
              {!isMobile && <div style={{ fontSize: 11, color: C.gray[400] }}>目標 {gDone}/{gs.length}</div>}
              <div style={{ fontSize: 15, fontWeight: 500, color: C.purple[600], minWidth: 28, textAlign: "right" }}>{sc}</div>
              <Badge type={st}>{statusLabel[st]}</Badge>
            </div>
          );
        })}
      </Card>
    </div>
  );
};

// ─── Evaluation Form ──────────────────────────────────────────────
const EvaluationPage = ({ users, evals, setEvals, selectedUserId, setSelectedUserId }) => {
  const [tab, setTab] = useState("manager");
  const isMobile = useIsMobile();
  const user = users.find(u => u.id === selectedUserId) || users[0];
  const eval_ = evals[user.id] || {};

  const updateEval = useCallback((key, value) => {
    setEvals(prev => ({ ...prev, [user.id]: { ...prev[user.id], [key]: value } }));
  }, [user.id, setEvals]);

  const prefix = tab === "manager" ? "manager" : "self";
  const scores = eval_[prefix+"Scores"] || {};

  const tabBtn = (t, label) => (
    <button onClick={() => setTab(t)} style={{
      padding: "7px 18px", fontSize: 13, borderRadius: 8, border: "none", cursor: "pointer", fontFamily: "inherit",
      background: tab === t ? C.purple[50] : "transparent",
      color: tab === t ? C.purple[800] : C.gray[400],
      fontWeight: tab === t ? 500 : 400,
    }}>{label}</button>
  );

  return (
    <div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 14, flexWrap: "wrap" }}>
        <SelectEl value={selectedUserId || user.id} onChange={setSelectedUserId}
          options={users.map(u => ({ value: u.id, label: u.name }))} style={{ flex: 1, minWidth: 140 }} />
        <Badge type={eval_.status==="done" ? "done" : eval_.managerComment ? "wip" : "none"}>
          {eval_.status==="done" ? "評価済み" : eval_.managerComment ? "入力中" : "未評価"}
        </Badge>
        <Btn small primary onClick={() => updateEval("status","done")} disabled={eval_.status==="done"}>提出</Btn>
      </div>
      <div style={{ display: "flex", gap: 6, background: C.gray[50], borderRadius: 10, padding: 4, marginBottom: 14, width: "fit-content" }}>
        {tabBtn("manager","上司評価")}
        {tabBtn("self","自己評価")}
      </div>
      <Card>
        <CardTitle>評価項目スコア</CardTitle>
        {CRITERIA.map(c => (
          <div key={c} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: isMobile ? "wrap" : "nowrap" }}>
            <div style={{ fontSize: 13, color: C.gray[600], width: isMobile ? "100%" : 96, flexShrink: 0 }}>{c}</div>
            <StarRating value={scores[c]||0} onChange={val => updateEval(prefix+"Scores", {...scores,[c]:val})} />
            <span style={{ fontSize: 12, color: C.gray[400], minWidth: 16 }}>{scores[c]||"-"}</span>
          </div>
        ))}
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: `0.5px solid ${C.gray[100]}`, display: "flex", justifyContent: "space-between" }}>
          <span style={{ fontSize: 12, color: C.gray[400] }}>平均スコア</span>
          <span style={{ fontSize: 16, fontWeight: 500, color: C.purple[600] }}>{Object.keys(scores).length ? avg(scores) : "-"}</span>
        </div>
      </Card>
      <Card>
        <CardTitle>良かった点・強み</CardTitle>
        <Textarea rows={3} value={eval_[prefix+"Comment"]||""} onChange={v => updateEval(prefix+"Comment",v)} placeholder="具体的なエピソードを記入してください" />
      </Card>
      <Card>
        <CardTitle>改善点・期待すること</CardTitle>
        <Textarea rows={3} value={eval_[prefix+"Improve"]||""} onChange={v => updateEval(prefix+"Improve",v)} placeholder="来期に向けた改善点を記入してください" />
      </Card>
      {tab==="manager" && eval_.selfComment && (
        <Card style={{ borderLeft: `3px solid ${C.purple[400]}` }}>
          <CardTitle>本人の自己評価（参考）</CardTitle>
          <div style={{ fontSize: 13, color: C.gray[600], lineHeight: 1.7, marginBottom: 6 }}><strong style={{ color: C.gray[800] }}>良かった点：</strong>{eval_.selfComment}</div>
          <div style={{ fontSize: 13, color: C.gray[600], lineHeight: 1.7 }}><strong style={{ color: C.gray[800] }}>改善点：</strong>{eval_.selfImprove||"未記入"}</div>
        </Card>
      )}
    </div>
  );
};

// ─── Goals ────────────────────────────────────────────────────────
const GoalsPage = ({ users, goals, setGoals, selectedUserId, setSelectedUserId, readonly, currentUserId }) => {
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ title:"", deadline:"", weight:30, progress:0 });

  const uid = readonly ? currentUserId : (selectedUserId || (users[0]?.id));
  const user = users.find(u => u.id === uid) || users[0];
  const userGoals = goals[uid] || [];

  const weightedProgress = userGoals.length
    ? userGoals.reduce((a,g) => a + (g.progress*g.weight/100), 0) / (userGoals.reduce((a,g)=>a+g.weight,0)/100)
    : 0;

  const openNew = () => { setEditingId(null); setForm({title:"",deadline:"",weight:30,progress:0}); setShowModal(true); };
  const openEdit = g => { setEditingId(g.id); setForm({title:g.title,deadline:g.deadline,weight:g.weight,progress:g.progress}); setShowModal(true); };
  const save = () => {
    if (!form.title) return;
    setGoals(prev => {
      const list = prev[uid]||[];
      const upd = { ...form, status: form.progress>=100?"done":"wip" };
      if (editingId) return { ...prev, [uid]: list.map(g => g.id===editingId ? {...g,...upd} : g) };
      return { ...prev, [uid]: [...list, { id:"g"+Date.now(), ...upd }] };
    });
    setShowModal(false);
  };
  const del = id => setGoals(prev => ({ ...prev, [uid]: (prev[uid]||[]).filter(g=>g.id!==id) }));

  return (
    <div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 14, flexWrap: "wrap" }}>
        {!readonly && <SelectEl value={uid} onChange={setSelectedUserId} options={users.map(u=>({value:u.id,label:u.name}))} style={{ flex:1, minWidth:140 }} />}
        {!readonly && <Btn primary onClick={openNew}>+ 目標を追加</Btn>}
      </div>
      <div style={{ display: "grid", gridTemplateColumns:"repeat(3,1fr)", gap:10, marginBottom:14 }}>
        <MetricCard label="目標数" value={userGoals.length} sub="件" />
        <MetricCard label="達成済み" value={userGoals.filter(g=>g.status==="done").length} sub={`/ ${userGoals.length}`} />
        <MetricCard label="加重進捗" value={`${Math.round(weightedProgress)}%`} />
      </div>
      {userGoals.length===0 && (
        <div style={{ textAlign:"center", padding:"40px 20px", color:C.gray[400], fontSize:13 }}>
          {readonly ? "目標がまだ登録されていません。マネージャーに依頼してください。" : "「+ 目標を追加」から登録してください。"}
        </div>
      )}
      {userGoals.map(g => {
        const bc = g.progress>=100 ? C.green[400] : g.progress>=50 ? C.purple[400] : C.amber[200];
        return (
          <Card key={g.id}>
            <div style={{ display:"flex", alignItems:"start", justifyContent:"space-between", marginBottom:8, gap:8 }}>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:14, fontWeight:500, color:C.gray[800], marginBottom:2 }}>{g.title}</div>
                <div style={{ fontSize:11, color:C.gray[400] }}>期限: {g.deadline} · 重み: {g.weight}%</div>
              </div>
              <div style={{ display:"flex", gap:5, alignItems:"center", flexShrink:0 }}>
                <Badge type={g.status==="done"?"done":"wip"}>{g.status==="done"?"達成":"進行中"}</Badge>
                {!readonly && <><Btn small onClick={()=>openEdit(g)}>編集</Btn><Btn small danger onClick={()=>del(g.id)}>削除</Btn></>}
              </div>
            </div>
            <ProgressBar value={g.progress} color={bc} />
            {readonly ? (
              <div style={{ marginTop:8 }}>
                <input type="range" min={0} max={100} step={5} value={g.progress}
                  onChange={e => setGoals(prev => ({ ...prev, [uid]: (prev[uid]||[]).map(gg => gg.id===g.id ? {...gg,progress:+e.target.value,status:+e.target.value>=100?"done":"wip"} : gg) }))}
                  style={{ width:"100%" }} />
                <div style={{ fontSize:11, color:C.gray[400], textAlign:"right" }}>{g.progress}%</div>
              </div>
            ) : (
              <div style={{ fontSize:11, color:C.gray[400], textAlign:"right", marginTop:4 }}>{g.progress}%</div>
            )}
          </Card>
        );
      })}
      {showModal && (
        <Modal title={editingId?"目標を編集":"目標を追加"} onClose={()=>setShowModal(false)}>
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            <div><div style={{ fontSize:12, color:C.gray[400], marginBottom:4 }}>目標タイトル</div><Input value={form.title} onChange={v=>setForm(f=>({...f,title:v}))} placeholder="例：新機能のリリース" /></div>
            <div><div style={{ fontSize:12, color:C.gray[400], marginBottom:4 }}>期限</div><Input value={form.deadline} onChange={v=>setForm(f=>({...f,deadline:v}))} placeholder="例：2026/06/30" /></div>
            <div>
              <div style={{ fontSize:12, color:C.gray[400], marginBottom:4 }}>重み（%）</div>
              <input type="range" min={5} max={100} step={5} value={form.weight} onChange={e=>setForm(f=>({...f,weight:+e.target.value}))} style={{ width:"100%" }} />
              <div style={{ fontSize:12, color:C.gray[600], textAlign:"right" }}>{form.weight}%</div>
            </div>
            <div>
              <div style={{ fontSize:12, color:C.gray[400], marginBottom:4 }}>進捗（%）</div>
              <input type="range" min={0} max={100} step={5} value={form.progress} onChange={e=>setForm(f=>({...f,progress:+e.target.value}))} style={{ width:"100%" }} />
              <div style={{ fontSize:12, color:C.gray[600], textAlign:"right" }}>{form.progress}%</div>
            </div>
            <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
              <Btn onClick={()=>setShowModal(false)}>キャンセル</Btn>
              <Btn primary onClick={save}>保存</Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

// ─── Results ──────────────────────────────────────────────────────
const ResultsPage = ({ users, evals }) => {
  const isMobile = useIsMobile();
  const usersWithData = users.map((u,i) => ({ ...u, idx:i, managerAvg: evals[u.id]?.managerScores ? avg(evals[u.id].managerScores) : null }));
  const criteriaAvgs = CRITERIA.map(c => {
    const vals = users.map(u=>evals[u.id]?.managerScores?.[c]).filter(Boolean);
    return { name:c, avg: vals.length ? (vals.reduce((a,b)=>a+b,0)/vals.length).toFixed(1) : "-" };
  });
  const scores = usersWithData.map(u=>Number(u.managerAvg)).filter(Boolean);
  const teamAvg = scores.length ? (scores.reduce((a,b)=>a+b,0)/scores.length).toFixed(1) : "-";

  return (
    <div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:10, marginBottom:14 }}>
        <MetricCard label="評価完了" value={users.filter(u=>evals[u.id]?.status==="done").length} sub={`/ ${users.length} 名`} />
        <MetricCard label="チーム平均" value={teamAvg} sub="/ 5.0" />
        <MetricCard label="最高スコア" value={scores.length ? Math.max(...scores).toFixed(1) : "-"} />
        <MetricCard label="最低スコア" value={scores.length ? Math.min(...scores).toFixed(1) : "-"} />
      </div>
      <Card>
        <CardTitle>評価項目別 平均スコア</CardTitle>
        {criteriaAvgs.map(c => (
          <div key={c.name} style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
            <div style={{ fontSize:12, color:C.gray[600], width:80, flexShrink:0 }}>{c.name}</div>
            <div style={{ flex:1, height:6, background:C.gray[100], borderRadius:3, overflow:"hidden" }}>
              <div style={{ height:"100%", width:`${(Number(c.avg)/5)*100}%`, background:C.purple[400], borderRadius:3 }} />
            </div>
            <span style={{ fontSize:13, fontWeight:500, color:C.gray[800], minWidth:24, textAlign:"right" }}>{c.avg}</span>
          </div>
        ))}
      </Card>
      <Card>
        <CardTitle>メンバー別スコア</CardTitle>
        {usersWithData.map(u => (
          <div key={u.id} style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
            <Avatar name={u.name} idx={u.idx} size={26} />
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:12, color:C.gray[800], marginBottom:3, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{u.name}</div>
              {u.managerAvg && <div style={{ height:4, background:C.gray[100], borderRadius:2, overflow:"hidden" }}><div style={{ height:"100%", width:`${(Number(u.managerAvg)/5)*100}%`, background:C.purple[400], borderRadius:2 }} /></div>}
            </div>
            <span style={{ fontSize:13, fontWeight:500, color:C.gray[800], minWidth:26, textAlign:"right" }}>{u.managerAvg||"-"}</span>
            <Badge type={evals[u.id]?.status==="done"?"done":evals[u.id]?.managerComment?"wip":"none"}>
              {evals[u.id]?.status==="done"?"完了":evals[u.id]?.managerComment?"入力中":"未"}
            </Badge>
          </div>
        ))}
      </Card>
      {!isMobile && (
        <Card>
          <CardTitle>詳細一覧</CardTitle>
          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
              <thead>
                <tr style={{ borderBottom:`0.5px solid ${C.gray[100]}` }}>
                  <th style={{ textAlign:"left", padding:"6px 8px", color:C.gray[400], fontWeight:400 }}>名前</th>
                  {CRITERIA.map(c=><th key={c} style={{ textAlign:"center", padding:"6px 8px", color:C.gray[400], fontWeight:400 }}>{c}</th>)}
                  <th style={{ textAlign:"center", padding:"6px 8px", color:C.gray[400], fontWeight:400 }}>平均</th>
                </tr>
              </thead>
              <tbody>
                {usersWithData.map(u => {
                  const ms = evals[u.id]?.managerScores||{};
                  return (
                    <tr key={u.id} style={{ borderBottom:`0.5px solid ${C.gray[50]}` }}>
                      <td style={{ padding:"8px", color:C.gray[800], fontWeight:500 }}>{u.name}</td>
                      {CRITERIA.map(c=><td key={c} style={{ textAlign:"center", padding:"8px", color:ms[c]?C.gray[800]:C.gray[200] }}>{ms[c]||"-"}</td>)}
                      <td style={{ textAlign:"center", padding:"8px", fontWeight:500, color:C.purple[600] }}>{u.managerAvg||"-"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
};

// ─── AI Analysis ─────────────────────────────────────────────────
const AIPage = ({ users, evals, goals }) => {
  const [target, setTarget] = useState("all");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const buildPrompt = () => {
    if (target === "all") {
      const scores = users.map(u => { const ms=evals[u.id]?.managerScores; return ms ? `${u.name}（${u.dept}）: ${CRITERIA.map(c=>`${c}=${ms[c]||"-"}`).join("、")}` : `${u.name}: 未評価`; }).join("\n");
      const goalSummary = users.map(u => { const gs=goals[u.id]||[]; return `${u.name}: 目標${gs.length}件中${gs.filter(g=>g.status==="done").length}件達成`; }).join("、");
      return `以下の人事評価データ（2026年度上半期）を分析し、チームの強み・課題・推奨アクションを含めて300字程度で日本語でサマリーしてください。\n\n【評価スコア（各5点満点）】\n${scores}\n\n【目標達成状況】\n${goalSummary}`;
    }
    const u = users.find(u=>u.id===target);
    const e = evals[u.id]||{};
    const gs = goals[u.id]||[];
    return `以下の評価データを分析し、強み・課題・来期への具体的な推奨アクションを300字程度の日本語でまとめてください。\n\n【対象者】${u.name}（${u.dept} · ${u.grade}）\n\n【上司評価スコア（5点満点）】\n${CRITERIA.map(c=>`${c}: ${e.managerScores?.[c]||"-"}`).join("、")}\n上司コメント: ${e.managerComment||"なし"}\n\n【自己評価スコア】\n${CRITERIA.map(c=>`${c}: ${e.selfScores?.[c]||"-"}`).join("、")}\n自己コメント: ${e.selfComment||"なし"}\n\n【目標達成状況】\n${gs.map(g=>`・${g.title}（進捗${g.progress}%）`).join("\n")||"なし"}`;
  };

  const run = async () => {
    setLoading(true); setError(null); setResult(null);
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ model:"claude-sonnet-4-6", max_tokens:1000, messages:[{role:"user",content:buildPrompt()}] }),
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
            options={[{value:"all",label:"チーム全体"},...users.map(u=>({value:u.id,label:u.name}))]}
            style={{ flex:1, minWidth:140 }} />
          <Btn primary onClick={run} disabled={loading}>{loading?"分析中...":"✦ 分析を実行"}</Btn>
        </div>
      </Card>
      {loading && <div style={{ background:C.purple[50], border:`0.5px solid ${C.purple[200]}`, borderRadius:12, padding:"20px", display:"flex", gap:10, alignItems:"center" }}><span style={{fontSize:18}}>✦</span><span style={{fontSize:13,color:C.purple[800]}}>評価データを解析中...</span></div>}
      {error && <div style={{ background:C.coral[50], border:`0.5px solid ${C.coral[200]}`, borderRadius:12, padding:"16px 18px", fontSize:13, color:C.coral[800] }}>{error}</div>}
      {result && (
        <div style={{ background:C.purple[50], border:`0.5px solid ${C.purple[200]}`, borderRadius:12, padding:"18px 20px" }}>
          <div style={{ display:"flex", gap:6, alignItems:"center", marginBottom:10 }}>
            <span style={{fontSize:14}}>✦</span>
            <span style={{fontSize:12,fontWeight:500,color:C.purple[800]}}>AI分析サマリー — {target==="all"?"チーム全体":users.find(u=>u.id===target)?.name} · 2026年度上半期</span>
          </div>
          <div style={{ fontSize:13, color:C.purple[900], lineHeight:1.8, whiteSpace:"pre-wrap" }}>{result}</div>
        </div>
      )}
      {!loading && !result && !error && (
        <div style={{ textAlign:"center", padding:"40px 20px", color:C.gray[400], fontSize:13, background:C.gray[50], borderRadius:12 }}>
          分析対象を選んで「分析を実行」を押してください。
        </div>
      )}
    </div>
  );
};

// ─── User Management ──────────────────────────────────────────────
const UserManagePage = ({ users, setUsers }) => {
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ name:"", dept:DEPARTMENTS[0], grade:GRADES[0], email:"", password:"" });

  const openNew = () => { setEditingId(null); setForm({name:"",dept:DEPARTMENTS[0],grade:GRADES[0],email:"",password:""}); setShowModal(true); };
  const openEdit = u => { setEditingId(u.id); setForm({name:u.name,dept:u.dept,grade:u.grade,email:u.email||"",password:u.password||""}); setShowModal(true); };
  const save = () => {
    if (!form.name.trim()) return;
    setUsers(prev => {
      if (editingId) return prev.map(u => u.id===editingId ? {...u,...form} : u);
      return [...prev, { id:"u"+Date.now(), ...form, role:"member", managerId:"u0" }];
    });
    setShowModal(false);
  };
  const remove = id => { if (window.confirm("削除しますか？")) setUsers(prev=>prev.filter(u=>u.id!==id)); };

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:14 }}>
        <Btn primary onClick={openNew}>+ メンバーを追加</Btn>
      </div>
      <Card>
        {users.map((u,i) => (
          <div key={u.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 0", borderBottom: i<users.length-1?`0.5px solid ${C.gray[50]}`:"none" }}>
            <Avatar name={u.name} idx={i} size={32} />
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:13, fontWeight:500, color:C.gray[800] }}>{u.name}</div>
              <div style={{ fontSize:11, color:C.gray[400] }}>{u.dept} · {u.grade}</div>
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
            <div><div style={{fontSize:12,color:C.gray[400],marginBottom:4}}>グレード</div><SelectEl value={form.grade} onChange={v=>setForm(f=>({...f,grade:v}))} options={GRADES} style={{width:"100%"}} /></div>
            <div><div style={{fontSize:12,color:C.gray[400],marginBottom:4}}>メールアドレス</div><Input value={form.email} onChange={v=>setForm(f=>({...f,email:v}))} placeholder="user@example.com" type="email" /></div>
            <div><div style={{fontSize:12,color:C.gray[400],marginBottom:4}}>パスワード</div><Input value={form.password} onChange={v=>setForm(f=>({...f,password:v}))} placeholder="初期パスワード" type="text" /></div>
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

// ─── Period Management ────────────────────────────────────────────
const PeriodPage = ({ periods, setPeriods }) => {
  const [showModal, setShowModal] = useState(false);
  const [label, setLabel] = useState("");
  const add = () => { if (!label.trim()) return; setPeriods(prev=>[...prev,{id:"p"+Date.now(),label,active:false}]); setShowModal(false); setLabel(""); };
  return (
    <div>
      <div style={{display:"flex",justifyContent:"flex-end",marginBottom:14}}><Btn primary onClick={()=>setShowModal(true)}>+ 評価期間を追加</Btn></div>
      <Card>
        {periods.map((p,i) => (
          <div key={p.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 0",borderBottom:i<periods.length-1?`0.5px solid ${C.gray[50]}`:"none"}}>
            <div style={{flex:1,fontSize:14,color:C.gray[800],fontWeight:p.active?500:400}}>{p.label}</div>
            {p.active ? <Badge type="done">現在の期間</Badge> : <Btn small onClick={()=>setPeriods(prev=>prev.map(x=>({...x,active:x.id===p.id})))}>アクティブにする</Btn>}
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

// ─── Employee View ────────────────────────────────────────────────
const EmployeeView = ({ currentUser, evals, setEvals, goals, setGoals, periods, onLogout }) => {
  const [page, setPage] = useState("myeval");
  const activePeriod = periods.find(p=>p.active)||periods[0];
  const eval_ = evals[currentUser.id]||{};
  const updateEval = (key,value) => setEvals(prev=>({...prev,[currentUser.id]:{...prev[currentUser.id],[key]:value}}));

  const EMP_NAV = [
    { id:"myeval",  label:"自分の評価", shortLabel:"評価", icon:"✎" },
    { id:"mygoals", label:"目標・進捗",  shortLabel:"目標", icon:"◎" },
  ];
  const pageTitles = { myeval:"自分の評価", mygoals:"目標・進捗" };

  return (
    <AppShell nav={EMP_NAV} page={page} setPage={setPage} currentUser={currentUser} activePeriod={activePeriod} onLogout={onLogout} pageTitle={pageTitles[page]}>
      {page==="myeval" && (
        <div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10,marginBottom:14}}>
            <MetricCard label="上司評価 平均" value={eval_.managerScores?avg(eval_.managerScores):"-"} sub="/ 5.0" />
            <MetricCard label="自己評価 平均" value={eval_.selfScores?avg(eval_.selfScores):"-"} sub="/ 5.0" />
          </div>
          {eval_.managerScores ? (
            <Card>
              <CardTitle>上司からの評価</CardTitle>
              {CRITERIA.map(c=>(
                <div key={c} style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
                  <div style={{fontSize:13,color:C.gray[600],flex:1}}>{c}</div>
                  <StarRating value={eval_.managerScores[c]||0} readonly />
                  <span style={{fontSize:12,color:C.gray[400],minWidth:16}}>{eval_.managerScores[c]||"-"}</span>
                </div>
              ))}
              {eval_.managerComment && <div style={{marginTop:12,paddingTop:12,borderTop:`0.5px solid ${C.gray[100]}`}}><div style={{fontSize:12,color:C.gray[400],marginBottom:4}}>フィードバック</div><div style={{fontSize:13,color:C.gray[800],lineHeight:1.7}}>{eval_.managerComment}</div></div>}
              {eval_.managerImprove && <div style={{marginTop:8}}><div style={{fontSize:12,color:C.gray[400],marginBottom:4}}>改善への期待</div><div style={{fontSize:13,color:C.gray[800],lineHeight:1.7}}>{eval_.managerImprove}</div></div>}
            </Card>
          ) : (
            <Card><CardTitle>上司からの評価</CardTitle><div style={{textAlign:"center",padding:"20px 0",color:C.gray[400],fontSize:13}}>まだ上司評価が入力されていません。</div></Card>
          )}
          <Card>
            <CardTitle action={eval_.status!=="done"&&<Btn small primary onClick={()=>updateEval("status","done")}>提出する</Btn>}>自己評価を入力</CardTitle>
            {CRITERIA.map(c=>(
              <div key={c} style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
                <div style={{fontSize:13,color:C.gray[600],flex:1}}>{c}</div>
                <StarRating value={(eval_.selfScores||{})[c]||0} onChange={val=>updateEval("selfScores",{...(eval_.selfScores||{}),[c]:val})} readonly={eval_.status==="done"} />
                <span style={{fontSize:12,color:C.gray[400],minWidth:16}}>{(eval_.selfScores||{})[c]||"-"}</span>
              </div>
            ))}
            <div style={{marginTop:12}}><div style={{fontSize:12,color:C.gray[400],marginBottom:4}}>良かった点</div><Textarea value={eval_.selfComment||""} onChange={v=>updateEval("selfComment",v)} rows={3} placeholder="今期の成果を記入してください" /></div>
            <div style={{marginTop:10}}><div style={{fontSize:12,color:C.gray[400],marginBottom:4}}>来期の改善点</div><Textarea value={eval_.selfImprove||""} onChange={v=>updateEval("selfImprove",v)} rows={3} placeholder="来期に向けた取り組みを記入してください" /></div>
          </Card>
        </div>
      )}
      {page==="mygoals" && (
        <GoalsPage users={SEED_USERS} goals={goals} setGoals={setGoals} selectedUserId={currentUser.id} setSelectedUserId={()=>{}} readonly currentUserId={currentUser.id} />
      )}
    </AppShell>
  );
};

// ─── Manager NAV ──────────────────────────────────────────────────
const MANAGER_NAV = [
  { id:"dashboard",  label:"ダッシュボード", shortLabel:"ホーム", icon:"⊞" },
  { id:"evaluation", label:"評価フォーム",   shortLabel:"評価",   icon:"✎" },
  { id:"goals",      label:"目標管理",       shortLabel:"目標",   icon:"◎" },
  { id:"results",    label:"結果・集計",     shortLabel:"集計",   icon:"▦" },
  { id:"ai",         label:"AI分析",         shortLabel:"AI",     icon:"✦" },
  { id:"users",      label:"メンバー管理",   shortLabel:"管理",   icon:"⚉" },
  { id:"periods",    label:"評価期間",       shortLabel:"期間",   icon:"◷" },
];

// ─── App ──────────────────────────────────────────────────────────
export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [page, setPage] = useState("dashboard");
  const [users, setUsers] = useState(SEED_USERS);
  const [evals, setEvals] = useState(SEED_EVALS);
  const [goals, setGoals] = useState(SEED_GOALS);
  const [periods, setPeriods] = useState(PERIODS);
  const [selectedUserId, setSelectedUserId] = useState(SEED_USERS[0].id);

  const activePeriod = periods.find(p=>p.active)||periods[0];
  const handleLogin = user => { setCurrentUser(user); setPage("dashboard"); };
  const handleLogout = () => setCurrentUser(null);

  if (!currentUser) return <LoginPage users={users} onLogin={handleLogin} />;

  if (currentUser.role==="member") {
    return <EmployeeView currentUser={currentUser} evals={evals} setEvals={setEvals} goals={goals} setGoals={setGoals} periods={periods} onLogout={handleLogout} />;
  }

  const pageTitles = { dashboard:"ダッシュボード", evaluation:"評価フォーム", goals:"目標管理", results:"結果・集計", ai:"AI分析", users:"メンバー管理", periods:"評価期間管理" };

  return (
    <AppShell nav={MANAGER_NAV} page={page} setPage={setPage} currentUser={currentUser} activePeriod={activePeriod} onLogout={handleLogout} pageTitle={pageTitles[page]}>
      {page==="dashboard" && <Dashboard users={users} evals={evals} goals={goals} onNavigate={setPage} onSelectUser={setSelectedUserId} />}
      {page==="evaluation" && <EvaluationPage users={users} evals={evals} setEvals={setEvals} selectedUserId={selectedUserId} setSelectedUserId={setSelectedUserId} />}
      {page==="goals" && <GoalsPage users={users} goals={goals} setGoals={setGoals} selectedUserId={selectedUserId} setSelectedUserId={setSelectedUserId} />}
      {page==="results" && <ResultsPage users={users} evals={evals} />}
      {page==="ai" && <AIPage users={users} evals={evals} goals={goals} />}
      {page==="users" && <UserManagePage users={users} setUsers={setUsers} />}
      {page==="periods" && <PeriodPage periods={periods} setPeriods={setPeriods} />}
    </AppShell>
  );
}
