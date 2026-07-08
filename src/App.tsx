import { useState, useEffect } from "react";
import { auth, db } from "./firebase";
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updatePassword,
  updateEmail,
  EmailAuthProvider,
  reauthenticateWithCredential,
} from "firebase/auth";
import {
  doc, getDoc, setDoc, updateDoc, collection,
  deleteDoc, onSnapshot, collectionGroup,
} from "firebase/firestore";

const C = {
  purple: { 50:"#EEEDFE",100:"#CECBF6",200:"#AFA9EC",400:"#7F77DD",600:"#534AB7",800:"#3C3489",900:"#26215C" },
  teal:   { 50:"#E1F5EE",200:"#5DCAA5",400:"#1D9E75",800:"#085041" },
  amber:  { 50:"#FAEEDA",200:"#EF9F27",400:"#BA7517",800:"#633806" },
  coral:  { 50:"#FAECE7",200:"#F0997B",400:"#D85A30",800:"#712B13" },
  green:  { 50:"#EAF3DE",400:"#639922",800:"#27500A" },
  gray:   { 50:"#F4F3EF",100:"#E8E7E2",200:"#D3D1C7",400:"#888780",600:"#5F5E5A",800:"#2C2C2A" },
  blue:   { 50:"#E6F1FB",400:"#378ADD",800:"#0C447C" },
};

const GRADE_CRITERIA = {
  G1:[
    {no:1,category:"成果",item:"端末販売の日次・月次目標（台数・付帯）を安定して達成している",points:8},
    {no:2,category:"成果",item:"光回線・保険・アクセサリ等の付帯商材を、指示に沿って案内できている",points:7},
    {no:3,category:"成果",item:"手続き漏れ・入力ミス・契約不備がなく、クレームを防止している",points:5},
    {no:4,category:"スキル",item:"主要機種の基本スペック・料金プランの仕組みを正確に説明できる",points:8},
    {no:5,category:"スキル",item:"光回線・SIMカード・オプションの基礎知識を理解し、案内に使えている",points:7},
    {no:6,category:"スキル",item:"接客の基本動作（挨拶・ニーズヒアリング・説明・クロージング）を実践できている",points:8},
    {no:7,category:"スキル",item:"端末操作・システム入力・書類作成を正確に行えている",points:5},
    {no:8,category:"スキル",item:"指導・フィードバックを素直に受け止め、次の接客に反映できている",points:5},
    {no:9,category:"行動",item:"誠実に行動し、個人情報保護・コンプライアンスを遵守している",points:8},
    {no:10,category:"行動",item:"店舗スタッフ・他の応援スタッフと協力し、店舗全体に貢献している",points:7},
    {no:11,category:"行動",item:"指示待ちにならず、空き時間に学習・声かけ・整備など自ら動けている",points:5},
    {no:12,category:"改善",item:"日々の接客を振り返り、翌日の改善行動につなげている",points:7},
  ],
  G2:[
    {no:1,category:"成果",item:"端末・光回線・付帯商材のKPI（台数・件数・収益）を安定して達成している",points:10},
    {no:2,category:"成果",item:"単価向上（ハイエンド端末・複数商材提案）に取り組み、成果を出している",points:8},
    {no:3,category:"成果",item:"契約不備・解約・クレームを最小限に抑え、品質を維持している",points:7},
    {no:4,category:"スキル",item:"機種・料金プラン・割引施策を深く理解し、顧客に最適提案ができる",points:8},
    {no:5,category:"スキル",item:"光回線・保険・端末保証・アクセサリ等の複合提案ができている",points:8},
    {no:6,category:"スキル",item:"顧客のニーズ・懸念を的確に把握し、納得感のある説明・クロージングができる",points:8},
    {no:7,category:"スキル",item:"自分の数字・進捗を把握し、目標達成に向けて行動を管理できている",points:7},
    {no:8,category:"行動",item:"顧客視点でアフターフォロー（乗り換え提案・満足度確認）を行っている",points:7},
    {no:9,category:"行動",item:"店舗スタッフと連携し、応援としてポジティブな影響を与えている",points:7},
    {no:10,category:"行動",item:"困難な案件・クレーム対応でも諦めず、やり切る姿勢を持っている",points:5},
    {no:11,category:"改善",item:"自分の苦手な商材・提案パターンを分析し、改善行動を実践している",points:5},
    {no:12,category:"改善",item:"トークスクリプト・成功事例を蓄積し、自己成長につなげている",points:5},
  ],
  G3:[
    {no:1,category:"成果",item:"担当案件・チームのKPI（台数・光件数・付帯率・収益）を主担当として達成している",points:15},
    {no:2,category:"成果",item:"ハイエンド端末・光回線・複合商材の高単価提案で収益貢献している",points:10},
    {no:3,category:"成果",item:"品質・顧客満足・解約防止を両立しながら、安定した販売運営ができている",points:8},
    {no:4,category:"スキル",item:"最新機種・料金改定・新サービスをいち早くキャッチアップし、提案に活かせている",points:8},
    {no:5,category:"スキル",item:"顧客の潜在ニーズを引き出し、光回線・保険・副商材を自然な流れで提案できる",points:8},
    {no:6,category:"スキル",item:"課題分析・原因特定・改善策立案を行い、自チームの販売力を高めている",points:7},
    {no:7,category:"行動",item:"店長・店舗スタッフと密に連携し、店舗全体の目標達成に向けて働きかけている",points:7},
    {no:8,category:"行動",item:"困難な顧客・クレーム案件でも当事者意識を持ち、最後まで対応できている",points:5},
    {no:9,category:"行動",item:"後輩・新人スタッフへの指導・ロープレ・フォローを積極的に行っている",points:5},
    {no:10,category:"組織貢献",item:"成功トーク・提案手法を言語化・共有し、チーム全体のスキル底上げをしている",points:5},
    {no:11,category:"組織貢献",item:"他店舗・本部との情報共有・横展開に積極的に関わっている",points:5},
    {no:12,category:"組織貢献",item:"店舗環境整備・ディスプレイ改善・業務フロー見直しに貢献している",points:3},
  ],
  G4:[
    {no:1,category:"成果",item:"担当エリア・チームの販売KPI（台数・光件数・付帯収益・達成率）を達成している",points:15},
    {no:2,category:"成果",item:"収益性を意識した施策（高単価化・付帯率向上・解約防止）を推進し、成果を出している",points:10},
    {no:3,category:"成果",item:"品質・顧客満足・コンプライアンスを総合的に管理し、安定した運営を行っている",points:8},
    {no:4,category:"スキル",item:"市場動向・競合情報・メーカー施策を踏まえた判断・提案ができる",points:7},
    {no:5,category:"スキル",item:"人員配置・シフト・目標設定を最適化し、チーム全体の生産性を高められる",points:7},
    {no:6,category:"行動",item:"会社・エリアの方針をメンバーに分かりやすく伝え、現場実行につなげている",points:8},
    {no:7,category:"行動",item:"公平性・模範性を持って組織をリードし、チームの士気を高めている",points:7},
    {no:8,category:"組織貢献",item:"販売手法・接客トーク・業務フローの仕組み化・標準化を進めている",points:8},
    {no:9,category:"組織貢献",item:"他店舗・本部・メーカーと連携し、組織全体の課題解決に貢献している",points:5},
    {no:10,category:"マネジメント",item:"メンバーの目標設定・進捗管理・個別フィードバックを適切に行っている",points:8},
    {no:11,category:"マネジメント",item:"スタッフの育成・モチベーション管理・人材定着に取り組んでいる",points:7},
    {no:12,category:"マネジメント",item:"次期リーダー候補の発掘・育成を意識した組織づくりができている",points:5},
  ],
  G5:[
    {no:1,category:"成果",item:"担当部門・エリア全体のKGI/KPI（売上・光収益・付帯率・継続率）を中長期視点で達成している",points:15},
    {no:2,category:"成果",item:"新商材・新施策・新チャネルを推進し、事業成長に結びつけている",points:10},
    {no:3,category:"成果",item:"収益・コスト・リスクを統合的にマネジメントし、部門の安定経営に貢献している",points:8},
    {no:4,category:"スキル",item:"通信業界の市場動向・規制変化・競合戦略を踏まえ、事業戦略を設計・修正できる",points:8},
    {no:5,category:"スキル",item:"メーカー・通信キャリア・店舗本部との交渉・連携を主導できる",points:7},
    {no:6,category:"行動",item:"経営層・他部門・重要パートナーを巻き込み、全社的な影響力を発揮している",points:8},
    {no:7,category:"行動",item:"変化を恐れず、販売モデル変革・DX推進など難しい改革を推進できている",points:7},
    {no:8,category:"組織貢献",item:"全社最適の視点で意思決定・資源配分を行い、部門間シナジーを生み出している",points:7},
    {no:9,category:"組織貢献",item:"業界ナレッジ・ベストプラクティスを組織に還元し、全体レベルを引き上げている",points:5},
    {no:10,category:"マネジメント",item:"管理職・エリアマネージャー層を育成し、強いマネジメントラインを構築している",points:10},
    {no:11,category:"マネジメント",item:"後継者育成・組織設計・人材配置を通じて、持続可能な販売組織を作っている",points:8},
    {no:12,category:"マネジメント",item:"スタッフの採用・定着・エンゲージメント向上に取り組み、人的資本を高めている",points:7},
  ],
};

const GRADE_DEFS_DEFAULT = {
  G1:"指示・手順に沿って基本業務を正確に遂行する等級",
  G2:"独力で担当業務を回し、安定して成果を出す等級",
  G3:"担当領域・案件・小規模チームを主導する等級",
  G4:"チーム成果と人材育成を両立するマネジメント等級",
  G5:"部門戦略・収益・組織づくりを担う上位マネジメント等級",
};

const RANK_DEFS = [
  {rank:"S",range:"90〜100点",label:"卓越",color:C.purple},
  {rank:"A",range:"80〜89点",label:"期待超過",color:C.teal},
  {rank:"B",range:"70〜79点",label:"期待達成",color:C.blue},
  {rank:"C",range:"60〜69点",label:"一部未達",color:C.amber},
  {rank:"D",range:"59点以下",label:"未達",color:C.coral},
];

const DEPARTMENTS_DEFAULT = ["営業1部","営業2部","管理部","経営企画","マーケティング","エンジニアリング"];
const GRADES = ["G1","G2","G3","G4","G5"];
const PERIODS_DEFAULT = [{id:"2026H1",label:"2026年度 上半期",active:true}];

// ── 販売実績 定数 ──────────────────────────────────────────────
const CARRIERS_SALES = [
  {id:"docomo",label:"docomo"},
  {id:"ahamo",label:"ahamo"},
  {id:"au",label:"au"},
  {id:"softbank",label:"SoftBank"},
  {id:"ymobile",label:"ワイモバイル"},
  {id:"uq",label:"UQモバイル"},
  {id:"other",label:"その他格安SIM"},
];
const CARRIER_COLORS_S = {
  docomo:"#e24b4a",ahamo:"#534ab7",au:"#ef9f27",softbank:"#ba7517",
  ymobile:"#378add",uq:"#1d9e75",other:"#888780",
};
const SALES_FIELDS = [
  {key:"newContract",label:"新規契約"},
  {key:"deviceChange",label:"機種変更"},
  {key:"mnpIn",label:"MNP転入"},
  {key:"portIn",label:"番号移行"},
  {key:"netLine",label:"ネット回線"},
  {key:"creditCard",label:"クレカ"},
  {key:"energy",label:"電気・ガス"},
];
const toDateStr = (d) => d.toLocaleDateString("sv-SE");
const todayStr = () => toDateStr(new Date());
const salesTotal = (e) => SALES_FIELDS.reduce((s,f)=>s+(e[f.key]||0),0);
const emptyEntry = (carrierId) => SALES_FIELDS.reduce((o,f)=>({...o,[f.key]:0}),{carrierId});

const calcScore = (scores, grade) => {
  const criteria = GRADE_CRITERIA[grade]||[];
  let total = 0;
  criteria.forEach(c=>{ const s=scores[c.no]||0; if(s>0) total+=(c.points*s)/5; });
  return Math.round(total);
};
const calcRank = (score) => score>=90?"S":score>=80?"A":score>=70?"B":score>=60?"C":"D";
const rankColor = (rank) => ({S:C.purple,A:C.teal,B:C.blue,C:C.amber,D:C.coral}[rank]||C.gray);
const initials = (name) => name?name.split(" ").map(p=>p[0]).join("").slice(0,2):"?";
const avatarColors = [C.purple,C.teal,C.coral,C.amber,C.green];
const getAvatarColor = (idx) => avatarColors[idx%avatarColors.length];
const categoryColor = (cat) => ({"成果":C.teal,"スキル":C.blue,"行動":C.purple,"改善":C.amber,"組織貢献":C.green,"マネジメント":C.coral}[cat]||C.gray);

const useIsMobile = () => {
  const [mobile,setMobile] = useState(()=>typeof window!=="undefined"&&window.innerWidth<640);
  useEffect(()=>{ const fn=()=>setMobile(window.innerWidth<640); window.addEventListener("resize",fn); return ()=>window.removeEventListener("resize",fn); },[]);
  return mobile;
};

const Avatar = ({name,idx,size=36}) => { const p=getAvatarColor(idx); return <div style={{width:size,height:size,borderRadius:"50%",background:p[50],color:p[800],display:"flex",alignItems:"center",justifyContent:"center",fontSize:size*0.34,fontWeight:500,flexShrink:0}}>{initials(name)}</div>; };
const RankBadge = ({rank,size="sm"}) => { if(!rank) return null; const c=rankColor(rank); return <span style={{fontSize:size==="lg"?15:11,padding:size==="lg"?"4px 12px":"2px 8px",borderRadius:20,background:c[50],color:c[800],fontWeight:600,border:`1px solid ${c[200]}`}}>{rank}</span>; };
const Badge = ({type,children}) => { const s={done:{bg:C.green[50],color:C.green[800]},wip:{bg:C.amber[50],color:C.amber[800]},none:{bg:C.gray[100],color:C.gray[600]},info:{bg:C.purple[50],color:C.purple[800]}}[type]||{bg:C.gray[100],color:C.gray[600]}; return <span style={{fontSize:11,padding:"2px 9px",borderRadius:20,background:s.bg,color:s.color,fontWeight:500,whiteSpace:"nowrap"}}>{children}</span>; };
const ScoreBar = ({score,max=100}) => <div style={{height:6,background:C.gray[100],borderRadius:3,overflow:"hidden",flex:1}}><div style={{height:"100%",width:`${Math.min((score/max)*100,100)}%`,background:score>=80?C.teal[400]:score>=60?C.purple[400]:score>=40?C.amber[200]:C.coral[400],borderRadius:3,transition:"width 0.4s"}}/></div>;
const Card = ({children,style}) => <div style={{background:"#fff",border:`0.5px solid ${C.gray[100]}`,borderRadius:12,padding:"14px 16px",marginBottom:12,...style}}>{children}</div>;
const CardTitle = ({children,action}) => <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}><div style={{fontSize:13,fontWeight:500,color:C.gray[800]}}>{children}</div>{action}</div>;
const MetricCard = ({label,value,sub,accent}) => <div style={{background:accent?accent[50]:C.gray[50],borderRadius:10,padding:"12px 14px",border:accent?`1px solid ${accent[200]}`:"none"}}><div style={{fontSize:11,color:accent?accent[600]:C.gray[400],marginBottom:3}}>{label}</div><div style={{fontSize:22,fontWeight:600,color:accent?accent[800]:C.gray[800]}}>{value}</div>{sub&&<div style={{fontSize:11,color:accent?accent[600]:C.gray[400],marginTop:1}}>{sub}</div>}</div>;
const Btn = ({children,onClick,primary,small,danger,disabled,style}) => <button onClick={onClick} disabled={disabled} style={{padding:small?"6px 12px":"8px 16px",fontSize:small?12:13,borderRadius:8,cursor:disabled?"not-allowed":"pointer",border:`0.5px solid ${danger?C.coral[400]:primary?C.purple[400]:C.gray[200]}`,background:primary?C.purple[400]:danger?C.coral[50]:"transparent",color:primary?"#fff":danger?C.coral[800]:C.gray[800],display:"inline-flex",alignItems:"center",gap:5,opacity:disabled?0.5:1,fontFamily:"inherit",...style}}>{children}</button>;
const Input = ({value,onChange,placeholder,type="text",style}) => <input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} style={{width:"100%",padding:"9px 11px",fontSize:14,border:`0.5px solid ${C.gray[200]}`,borderRadius:8,background:"#fff",color:C.gray[800],outline:"none",fontFamily:"inherit",boxSizing:"border-box",...style}}/>;
const SelectEl = ({value,onChange,options,style}) => <select value={value} onChange={e=>onChange(e.target.value)} style={{padding:"8px 10px",fontSize:13,borderRadius:8,border:`0.5px solid ${C.gray[200]}`,background:"#fff",color:C.gray[800],cursor:"pointer",outline:"none",fontFamily:"inherit",...style}}>{options.map(o=><option key={o.value??o} value={o.value??o}>{o.label??o}</option>)}</select>;
const Textarea = ({value,onChange,rows=3,placeholder}) => <textarea value={value} onChange={e=>onChange(e.target.value)} rows={rows} placeholder={placeholder} style={{width:"100%",padding:"9px 11px",fontSize:13,border:`0.5px solid ${C.gray[200]}`,borderRadius:8,background:"#fff",color:C.gray[800],resize:"vertical",fontFamily:"inherit",outline:"none",lineHeight:1.6,boxSizing:"border-box"}}/>;
const Modal = ({title,onClose,children}) => <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.4)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200,padding:16}} onClick={e=>e.target===e.currentTarget&&onClose()}><div style={{background:"#fff",borderRadius:14,width:"100%",maxWidth:480,maxHeight:"90vh",overflow:"auto"}}><div style={{padding:"14px 18px",borderBottom:`0.5px solid ${C.gray[100]}`,display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,background:"#fff"}}><div style={{fontSize:15,fontWeight:500,color:C.gray[800]}}>{title}</div><button onClick={onClose} style={{border:"none",background:"none",fontSize:20,cursor:"pointer",color:C.gray[400]}}>×</button></div><div style={{padding:"16px 18px"}}>{children}</div></div></div>;
const ScoreInput = ({value,onChange,readonly}) => <div style={{display:"flex",gap:4}}>{[1,2,3,4,5].map(n=><button key={n} onClick={()=>!readonly&&onChange&&onChange(value===n?0:n)} style={{width:32,height:32,borderRadius:6,border:"none",cursor:readonly?"default":"pointer",background:n<=value?C.purple[400]:C.gray[100],color:n<=value?"#fff":C.gray[400],fontSize:13,fontWeight:600,transition:"all 0.1s",fontFamily:"inherit"}}>{n}</button>)}</div>;

const NumInput = ({value,onChange,disabled}) => (
  <input type="number" min={0} value={value===0?"":value} placeholder="0" disabled={disabled}
    onChange={e=>onChange(parseInt(e.target.value||"0",10))}
    style={{width:"100%",height:32,padding:"0 8px",border:`0.5px solid ${C.gray[200]}`,borderRadius:6,fontSize:13,textAlign:"right",background:disabled?C.gray[50]:"#fff",color:C.gray[800],outline:"none",fontFamily:"inherit"}}/>
);

// ── ナビゲーション用アイコン（統一された線画スタイル）──────────
const NavIcon = ({ name, size = 20, color = "currentColor" }) => {
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: color, strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" };
  switch (name) {
    case "home":
      return <svg {...common}><path d="M3 11.5L12 4l9 7.5"/><path d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9"/></svg>;
    case "edit":
      return <svg {...common}><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>;
    case "grid":
      return <svg {...common}><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>;
    case "spark":
      return <svg {...common}><path d="M12 3v4M12 17v4M5 5l2.5 2.5M16.5 16.5L19 19M3 12h4M17 12h4M5 19l2.5-2.5M16.5 7.5L19 5"/></svg>;
    case "chart":
      return <svg {...common}><path d="M4 19V10M10 19V5M16 19v-7M22 19H2"/></svg>;
    case "users":
      return <svg {...common}><circle cx="9" cy="8" r="3.2"/><path d="M3 19c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17" cy="9" r="2.6"/><path d="M14.5 13.2c2.4.4 4.3 2.5 4.5 5.3"/></svg>;
    case "settings":
      return <svg {...common}><circle cx="12" cy="12" r="3"/><path d="M19.4 13a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5v.2a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H4a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3h.1a1.7 1.7 0 0 0 1-1.5V4a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5h.1a1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9v.1a1.7 1.7 0 0 0 1.5 1H20a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>;
    case "linesend":
      return <svg {...common}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><line x1="9" y1="10" x2="15" y2="10"/></svg>;
    case "training":
      return <svg {...common}><circle cx="12" cy="12" r="9"/><path d="M12 8v4l3 3"/><path d="M9.5 3.5A8.5 8.5 0 0 1 20.5 12"/><path d="M14.5 20.5A8.5 8.5 0 0 1 3.5 12"/></svg>;
    case "interview":
      return <svg {...common}><path d="M8 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2h-2"/><rect x="8" y="2" width="8" height="4" rx="1"/><line x1="8" y1="11" x2="16" y2="11"/><line x1="8" y1="15" x2="13" y2="15"/></svg>;
  }
};

const BottomNav = ({nav,page,setPage}) => {
  // モバイルでは最大6項目に絞る（現在のページを優先表示）
  const MAX = 6;
  let displayNav = nav;
  if(nav.length > MAX){
    const currentIdx = nav.findIndex(n=>n.id===page);
    // 現在のページが含まれるようにスライス
    let start = Math.max(0, Math.min(currentIdx - 2, nav.length - MAX));
    displayNav = nav.slice(start, start + MAX);
  }
  return (
    <div style={{position:"fixed",bottom:0,left:0,right:0,background:"#fff",borderTop:`0.5px solid ${C.gray[100]}`,display:"flex",zIndex:100,paddingBottom:"env(safe-area-inset-bottom,0px)"}}>
      {displayNav.map(n=>(
        <button key={n.id} onClick={()=>setPage(n.id)} style={{flex:1,padding:"8px 2px 10px",border:"none",background:"none",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:2,color:page===n.id?C.purple[600]:C.gray[400],minWidth:0}}>
          <NavIcon name={n.icon} size={18}/>
          <span style={{fontSize:9,fontWeight:page===n.id?500:400,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",maxWidth:"100%"}}>{n.shortLabel||n.label}</span>
        </button>
      ))}
    </div>
  );
};

const Sidebar = ({nav,page,setPage,currentUser,activePeriod,onLogout}) => (
  <div style={{width:220,flexShrink:0,background:"#fff",borderRight:`0.5px solid ${C.gray[100]}`,display:"flex",flexDirection:"column",height:"100vh"}}>
    <div style={{padding:"18px 18px 14px",borderBottom:`0.5px solid ${C.gray[100]}`}}>
      <div style={{fontSize:16,fontWeight:800,color:C.purple[600],fontFamily:"'Montserrat','Helvetica Neue',sans-serif",letterSpacing:"-0.5px"}}>✦ STELLA</div>
      <div style={{fontSize:11,color:C.gray[400],marginTop:3}}>{activePeriod?.label}</div>
    </div>
    <nav style={{padding:"8px 0",flex:1,overflowY:"auto"}}>
      {nav.map(n=><button key={n.id} onClick={()=>setPage(n.id)} style={{display:"flex",alignItems:"center",gap:10,width:"100%",textAlign:"left",padding:"9px 18px",border:"none",cursor:"pointer",fontSize:13,background:page===n.id?C.purple[50]:"transparent",color:page===n.id?C.purple[800]:C.gray[600],fontWeight:page===n.id?500:400,borderRight:page===n.id?`2px solid ${C.purple[400]}`:"2px solid transparent",fontFamily:"inherit"}}><NavIcon name={n.icon} size={17}/>{n.label}</button>)}
    </nav>
    <div style={{padding:"12px 16px",borderTop:`0.5px solid ${C.gray[100]}`}}>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
        <Avatar name={currentUser.displayName||currentUser.email} idx={0} size={30}/>
        <div>
          <div style={{fontSize:12,fontWeight:500,color:C.gray[800]}}>{currentUser.displayName||currentUser.email}</div>
          <div style={{fontSize:10,color:C.gray[400]}}>{currentUser.role==="manager"?"マネージャー":currentUser.grade||""}</div>
        </div>
      </div>
      <button onClick={onLogout} style={{width:"100%",padding:"6px",fontSize:12,borderRadius:6,border:`0.5px solid ${C.gray[200]}`,background:"transparent",color:C.gray[600],cursor:"pointer",fontFamily:"inherit"}}>ログアウト</button>
    </div>
  </div>
);

const AppShell = ({nav,page,setPage,currentUser,activePeriod,onLogout,pageTitle,children}) => {
  const isMobile = useIsMobile();
  return (
    <div style={{position:"fixed",inset:0,display:"flex",fontFamily:"system-ui,-apple-system,sans-serif",background:"#f7f6f2",color:C.gray[800],overflow:"hidden"}}>
      {!isMobile&&<Sidebar nav={nav} page={page} setPage={setPage} currentUser={currentUser} activePeriod={activePeriod} onLogout={onLogout}/>}
      <div style={{flex:1,display:"flex",flexDirection:"column",minHeight:0,overflow:"hidden"}}>
        <div style={{padding:isMobile?"12px 16px":"13px 24px",background:"#fff",borderBottom:`0.5px solid ${C.gray[100]}`,display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
          <div style={{fontSize:isMobile?15:16,fontWeight:500,color:C.gray[800]}}>{pageTitle}</div>
          {isMobile?<button onClick={onLogout} style={{fontSize:12,border:"none",background:"none",color:C.gray[400],cursor:"pointer",fontFamily:"inherit"}}>ログアウト</button>:<div style={{fontSize:11,color:C.gray[400]}}>{activePeriod?.label}</div>}
        </div>
        <div style={{flex:1,overflowY:"auto",WebkitOverflowScrolling:"touch",padding:isMobile?"14px 14px 84px":"20px 24px"}}>{children}</div>
      </div>
      {isMobile&&<BottomNav nav={nav} page={page} setPage={setPage}/>}
    </div>
  );
};

const LoginPage = ({onLogin}) => {
  const [tab,setTab] = useState("login");
  const [email,setEmail] = useState("");
  const [password,setPassword] = useState("");
  const [showPw,setShowPw] = useState(false);
  const [error,setError] = useState("");
  const [loading,setLoading] = useState(false);
  const [regName,setRegName] = useState("");
  const [regDept,setRegDept] = useState(DEPARTMENTS_DEFAULT[0]);
  const [regGrade,setRegGrade] = useState("G1");

  const handleLogin = async () => {
    setError(""); setLoading(true);
    try { await signInWithEmailAndPassword(auth,email.trim(),password); }
    catch(e) { setError("メールアドレスまたはパスワードが正しくありません。"); }
    finally { setLoading(false); }
  };

  const handleRegister = async () => {
    if(!regName.trim()){setError("名前を入力してください");return;}
    if(!email.trim()||!password){setError("メールアドレスとパスワードを入力してください");return;}
    setError(""); setLoading(true);
    try {
      const {createUserWithEmailAndPassword} = await import("firebase/auth");
      const cred = await createUserWithEmailAndPassword(auth,email.trim(),password);
      await setDoc(doc(db,"users",cred.user.uid),{name:regName.trim(),email:email.trim(),role:"member",grade:regGrade,dept:regDept,status:"pending"});
      await signOut(auth);
      alert("登録申請を送信しました。管理者の承認をお待ちください。");
    } catch(e) {
      if(e.code==="auth/email-already-in-use") setError("このメールアドレスはすでに登録されています。");
      else if(e.code==="auth/weak-password") setError("パスワードは6文字以上にしてください。");
      else setError("登録に失敗しました："+e.message);
      setLoading(false);
    }
  };

  return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:C.gray[50],padding:16,fontFamily:"system-ui,-apple-system,sans-serif"}}>
      <div style={{width:"100%",maxWidth:380}}>
        <div style={{textAlign:"center",marginBottom:28}}>
          <div style={{fontSize:38,fontWeight:800,color:C.purple[600],marginBottom:4,fontFamily:"'Montserrat','Helvetica Neue',sans-serif",letterSpacing:"-1px"}}>✦ STELLA</div>
          <div style={{fontSize:13,color:C.gray[400]}}>販売実績 · 人事評価 · 研修管理</div>
        </div>
        <div style={{background:"#fff",borderRadius:14,border:`0.5px solid ${C.gray[100]}`,padding:"24px 20px"}}>
          <div style={{display:"flex",gap:4,background:C.gray[50],borderRadius:8,padding:3,marginBottom:20}}>
            {[{id:"login",label:"ログイン"},{id:"register",label:"初回登録"}].map(t=>(
              <button key={t.id} onClick={()=>{setTab(t.id);setError("");}} style={{flex:1,padding:"7px",fontSize:13,borderRadius:6,border:"none",cursor:"pointer",fontFamily:"inherit",background:tab===t.id?C.purple[400]:"transparent",color:tab===t.id?"#fff":C.gray[600],fontWeight:tab===t.id?500:400}}>{t.label}</button>
            ))}
          </div>
          <div style={{marginBottom:14}}>
            <div style={{fontSize:12,color:C.gray[600],marginBottom:5}}>メールアドレス</div>
            <Input value={email} onChange={setEmail} placeholder="your@example.com" type="email"/>
          </div>
          <div style={{marginBottom:tab==="register"?14:18}}>
            <div style={{fontSize:12,color:C.gray[600],marginBottom:5}}>パスワード</div>
            <div style={{position:"relative"}}>
              <Input value={password} onChange={setPassword} placeholder="パスワードを入力" type={showPw?"text":"password"} style={{paddingRight:52}}/>
              <button onClick={()=>setShowPw(v=>!v)} style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",border:"none",background:"none",cursor:"pointer",fontSize:12,color:C.gray[400]}}>{showPw?"隠す":"表示"}</button>
            </div>
          </div>
          {tab==="register"&&(
            <div style={{marginBottom:18,display:"flex",flexDirection:"column",gap:12}}>
              <div><div style={{fontSize:12,color:C.gray[600],marginBottom:5}}>名前</div><Input value={regName} onChange={setRegName} placeholder="例：山田 太郎"/></div>
              <div><div style={{fontSize:12,color:C.gray[600],marginBottom:5}}>部署</div><SelectEl value={regDept} onChange={setRegDept} options={DEPARTMENTS_DEFAULT} style={{width:"100%"}}/></div>
              <div><div style={{fontSize:12,color:C.gray[600],marginBottom:5}}>等級</div><SelectEl value={regGrade} onChange={setRegGrade} options={GRADES} style={{width:"100%"}}/></div>
            </div>
          )}
          {error&&<div style={{fontSize:12,color:C.coral[400],marginBottom:12,padding:"8px 12px",background:C.coral[50],borderRadius:8}}>{error}</div>}
          <button onClick={tab==="login"?handleLogin:handleRegister} disabled={loading} style={{width:"100%",padding:11,fontSize:14,fontWeight:500,background:loading?C.gray[200]:C.purple[400],color:"#fff",border:"none",borderRadius:8,cursor:loading?"not-allowed":"pointer",fontFamily:"inherit"}}>
            {loading?(tab==="login"?"ログイン中...":"登録中..."):(tab==="login"?"ログイン":"登録してログイン")}
          </button>
        </div>
      </div>
    </div>
  );
};

const Dashboard = ({users,evals,onNavigate,onSelectUser}) => {
  const isMobile = useIsMobile();
  const usersWithScore = users.map((u,i)=>{const e=evals[u.id]||{};const ms=calcScore(e.managerScores||{},u.grade);return {...u,idx:i,managerScore:ms,rank:e.managerScores&&Object.keys(e.managerScores).length?calcRank(ms):null,status:e.status||"none"};});
  const done = usersWithScore.filter(u=>u.status==="done").length;
  const scored = usersWithScore.filter(u=>u.rank);
  const avgScore = scored.length?Math.round(scored.reduce((a,u)=>a+u.managerScore,0)/scored.length):null;
  return (
    <div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10,marginBottom:14}}>
        <MetricCard label="対象メンバー" value={users.length} sub="名"/>
        <MetricCard label="評価完了" value={done} sub={`/ ${users.length} 名`}/>
        <MetricCard label="チーム平均点" value={avgScore??"-"} sub="/ 100点" accent={avgScore>=80?C.teal:avgScore>=60?C.purple:avgScore?C.amber:null}/>
        <MetricCard label="評価期間" value="2026H1" sub="上半期"/>
      </div>
      <Card><CardTitle>等級別構成</CardTitle><div style={{display:"flex",gap:8,flexWrap:"wrap"}}>{GRADES.map(g=>{const cnt=users.filter(u=>u.grade===g).length;if(!cnt)return null;return(<div key={g} style={{background:C.purple[50],borderRadius:8,padding:"6px 14px",textAlign:"center"}}><div style={{fontSize:18,fontWeight:700,color:C.purple[800]}}>{cnt}</div><div style={{fontSize:11,color:C.purple[600]}}>{g}</div></div>);})}</div></Card>
      <Card>
        <CardTitle action={<Btn small primary onClick={()=>onNavigate("evaluation")}>+ 評価を入力</Btn>}>メンバー一覧</CardTitle>
        {usersWithScore.map((u,i)=>(
          <div key={u.id} onClick={()=>{onSelectUser(u.id);onNavigate("evaluation");}} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 6px",borderRadius:8,cursor:"pointer",borderBottom:i<users.length-1?`0.5px solid ${C.gray[50]}`:"none"}} onMouseEnter={e=>e.currentTarget.style.background=C.gray[50]} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
            <Avatar name={u.name} idx={u.idx} size={34}/>
            <div style={{flex:1,minWidth:0}}><div style={{fontSize:13,fontWeight:500,color:C.gray[800],whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{u.name}</div><div style={{fontSize:11,color:C.gray[400]}}>{u.dept} · <span style={{color:C.purple[600],fontWeight:500}}>{u.grade}</span></div></div>
            {u.rank&&<div style={{display:"flex",alignItems:"center",gap:6}}>{!isMobile&&<ScoreBar score={u.managerScore}/>}<span style={{fontSize:14,fontWeight:600,color:C.gray[800],minWidth:36,textAlign:"right"}}>{u.managerScore}点</span><RankBadge rank={u.rank}/></div>}
            {!u.rank&&<Badge type={u.status==="done"?"done":"none"}>{u.status==="done"?"完了":"未評価"}</Badge>}
          </div>
        ))}
      </Card>
    </div>
  );
};

const EvaluationPage = ({users,evals,onSaveEval,selectedUserId,setSelectedUserId,gradeDefs}) => {
  const [tab,setTab] = useState("manager");
  const isMobile = useIsMobile();
  const [saving,setSaving] = useState(false);
  const user = users.find(u=>u.id===selectedUserId)||users[0];
  const eval_ = evals[user?.id]||{};
  const criteria = GRADE_CRITERIA[user?.grade]||[];
  const prefix = tab==="manager"?"manager":"self";
  const scores = eval_[prefix+"Scores"]||{};
  const totalScore = calcScore(scores,user?.grade);
  const rank = Object.keys(scores).length?calcRank(totalScore):null;
  const categoryGroups = criteria.reduce((acc,c)=>{if(!acc[c.category])acc[c.category]=[];acc[c.category].push(c);return acc;},{});
  const updateField = async (key,value) => { setSaving(true); await onSaveEval(user.id,{[key]:value}); setSaving(false); };
  return (
    <div>
      <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:14,flexWrap:"wrap"}}>
        <SelectEl value={selectedUserId||user?.id} onChange={setSelectedUserId} options={users.map(u=>({value:u.id,label:`${u.name}（${u.grade}）`}))} style={{flex:1,minWidth:140}}/>
        {saving&&<span style={{fontSize:12,color:C.gray[400]}}>保存中...</span>}
        <Btn small primary onClick={()=>updateField("status","done")} disabled={eval_.status==="done"}>提出する</Btn>
      </div>
      <div style={{background:C.purple[50],border:`1px solid ${C.purple[200]}`,borderRadius:10,padding:"10px 14px",marginBottom:12,fontSize:12,color:C.purple[800]}}><strong>{user?.grade}</strong> — {gradeDefs[user?.grade]}</div>
      <div style={{display:"flex",gap:6,background:C.gray[50],borderRadius:10,padding:4,marginBottom:14,width:"fit-content"}}>
        {["manager","self"].map(t=><button key={t} onClick={()=>setTab(t)} style={{padding:"7px 18px",fontSize:13,borderRadius:8,border:"none",cursor:"pointer",fontFamily:"inherit",background:tab===t?C.purple[50]:"transparent",color:tab===t?C.purple[800]:C.gray[400],fontWeight:tab===t?500:400}}>{t==="manager"?"上司評価":"自己評価"}</button>)}
      </div>
      {rank&&<Card style={{borderLeft:`3px solid ${rankColor(rank)[400]}`}}><div style={{display:"flex",alignItems:"center",gap:16}}><div><div style={{fontSize:11,color:C.gray[400],marginBottom:2}}>総合点</div><div style={{fontSize:28,fontWeight:700,color:C.gray[800]}}>{totalScore}<span style={{fontSize:14,fontWeight:400,color:C.gray[400]}}>/100</span></div></div><div><div style={{fontSize:11,color:C.gray[400],marginBottom:4}}>ランク</div><RankBadge rank={rank} size="lg"/></div><div style={{flex:1}}><ScoreBar score={totalScore}/><div style={{fontSize:11,color:C.gray[400],marginTop:4}}>{RANK_DEFS.find(r=>r.rank===rank)?.label} · {RANK_DEFS.find(r=>r.rank===rank)?.range}</div></div></div></Card>}
      {Object.entries(categoryGroups).map(([cat,items])=>{
        const cc=categoryColor(cat);
        return (
          <Card key={cat}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}><span style={{fontSize:11,padding:"2px 10px",borderRadius:12,background:cc[50],color:cc[800],fontWeight:500}}>{cat}</span><span style={{fontSize:11,color:C.gray[400]}}>配点 {items.reduce((a,c)=>a+c.points,0)}点</span></div>
            {items.map((c,i)=>{
              const sc=scores[c.no]||0;const itemScore=sc>0?Math.round((c.points*sc)/5):0;
              return (
                <div key={c.no} style={{marginBottom:i<items.length-1?16:0,paddingBottom:i<items.length-1?16:0,borderBottom:i<items.length-1?`0.5px solid ${C.gray[50]}`:"none"}}>
                  <div style={{display:"flex",alignItems:"start",justifyContent:"space-between",marginBottom:8,gap:8}}>
                    <div style={{flex:1}}><div style={{fontSize:12,color:C.gray[400],marginBottom:2}}>No.{c.no} · 配点{c.points}点</div><div style={{fontSize:13,color:C.gray[800],lineHeight:1.5}}>{c.item}</div></div>
                    <div style={{flexShrink:0,textAlign:"right"}}><ScoreInput value={sc} onChange={val=>{const newScores={...scores,[c.no]:val};updateField(prefix+"Scores",newScores);}} readonly={eval_.status==="done"}/>{sc>0&&<div style={{fontSize:11,color:C.purple[600],marginTop:3,textAlign:"right"}}>{itemScore}点獲得</div>}</div>
                  </div>
                  <Textarea rows={2} value={eval_[prefix+"Comments"]?.[c.no]||""} onChange={v=>updateField(prefix+"Comments",{...(eval_[prefix+"Comments"]||{}),[c.no]:v})} placeholder={tab==="manager"?"上司評価コメント・根拠を入力":"自己評価コメント・根拠を入力"}/>
                </div>
              );
            })}
          </Card>
        );
      })}
      <Card><CardTitle>昇格判定補助欄</CardTitle><div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:10}}>{[{key:"nextGrade",label:"次等級候補",placeholder:"例：G4候補"},{key:"requirements",label:"必須条件充足状況",placeholder:"充足 / 一部未充足 / 未充足"},{key:"nextRoleAdvance",label:"次等級期待役割の先取り",placeholder:"先取りあり / なし"},{key:"compliance",label:"コンプライアンス重大違反",placeholder:"なし / あり（詳細）"},{key:"promotion",label:"昇格推薦可否",placeholder:"推薦 / 見送り / 条件付き推薦"}].map(f=><div key={f.key}><div style={{fontSize:12,color:C.gray[400],marginBottom:4}}>{f.label}</div><Input value={eval_[f.key]||""} onChange={v=>updateField(f.key,v)} placeholder={f.placeholder}/></div>)}</div></Card>
      <Card><CardTitle>総合コメント・育成計画</CardTitle>{[{key:"strengths",label:"強み"},{key:"improvements",label:"次期の改善課題"},{key:"devTheme",label:"次期育成テーマ"},{key:"managerSupport",label:"上司支援事項"},{key:"secondaryComment",label:"二次評価者コメント"}].map(f=><div key={f.key} style={{marginBottom:10}}><div style={{fontSize:12,color:C.gray[400],marginBottom:4}}>{f.label}</div><Textarea value={eval_[f.key]||""} onChange={v=>updateField(f.key,v)} rows={2} placeholder={f.label}/></div>)}</Card>
    </div>
  );
};

const ResultsPage = ({users,evals}) => {
  const isMobile = useIsMobile();
  const rows = users.map((u,i)=>{const e=evals[u.id]||{};const ms=e.managerScores&&Object.keys(e.managerScores).length?calcScore(e.managerScores,u.grade):null;const ss=e.selfScores&&Object.keys(e.selfScores).length?calcScore(e.selfScores,u.grade):null;return{...u,idx:i,ms,ss,rank:ms!==null?calcRank(ms):null};});
  const gradeAvgs = GRADES.map(g=>{const ug=rows.filter(u=>u.grade===g&&u.ms!==null);return{grade:g,avg:ug.length?Math.round(ug.reduce((a,u)=>a+u.ms,0)/ug.length):null,count:ug.length};});
  const rankCounts = ["S","A","B","C","D"].map(r=>({rank:r,count:rows.filter(u=>u.rank===r).length}));
  const scores = rows.map(u=>u.ms).filter(Boolean);
  return (
    <div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10,marginBottom:14}}>
        <MetricCard label="評価完了" value={rows.filter(u=>u.rank).length} sub={`/ ${users.length} 名`}/>
        <MetricCard label="チーム平均点" value={scores.length?Math.round(scores.reduce((a,b)=>a+b,0)/scores.length):"-"} sub="/ 100点"/>
      </div>
      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:12,marginBottom:12}}>
        <Card><CardTitle>ランク別分布</CardTitle>{rankCounts.map(r=>{const c=rankColor(r.rank);return(<div key={r.rank} style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}><RankBadge rank={r.rank}/><div style={{flex:1,height:6,background:C.gray[100],borderRadius:3,overflow:"hidden"}}><div style={{height:"100%",width:`${users.length?r.count/users.length*100:0}%`,background:c[400],borderRadius:3}}/></div><span style={{fontSize:13,fontWeight:500,color:C.gray[800],minWidth:20}}>{r.count}名</span></div>);})}</Card>
        <Card><CardTitle>等級別 平均点</CardTitle>{gradeAvgs.filter(g=>g.count>0).map(g=><div key={g.grade} style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}><span style={{fontSize:12,color:C.purple[600],fontWeight:600,width:24}}>{g.grade}</span><div style={{flex:1,height:6,background:C.gray[100],borderRadius:3,overflow:"hidden"}}><div style={{height:"100%",width:`${g.avg}%`,background:C.purple[400],borderRadius:3}}/></div><span style={{fontSize:13,fontWeight:500,color:C.gray[800],minWidth:44}}>{g.avg}点</span></div>)}</Card>
      </div>
      <Card><CardTitle>メンバー別スコア一覧</CardTitle><div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}><thead><tr style={{borderBottom:`0.5px solid ${C.gray[100]}`}}>{["名前","等級","上司評価点","自己評価点","ランク","状態"].map(h=><th key={h} style={{textAlign:"left",padding:"6px 8px",color:C.gray[400],fontWeight:400,whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead><tbody>{rows.map(u=><tr key={u.id} style={{borderBottom:`0.5px solid ${C.gray[50]}`}}><td style={{padding:"8px",color:C.gray[800],fontWeight:500}}><div style={{display:"flex",alignItems:"center",gap:8}}><Avatar name={u.name} idx={u.idx} size={24}/>{u.name}</div></td><td style={{padding:"8px"}}><span style={{color:C.purple[600],fontWeight:600}}>{u.grade}</span></td><td style={{padding:"8px",fontWeight:500,color:C.gray[800]}}>{u.ms!==null?`${u.ms}点`:"-"}</td><td style={{padding:"8px",color:C.gray[600]}}>{u.ss!==null?`${u.ss}点`:"-"}</td><td style={{padding:"8px"}}><RankBadge rank={u.rank}/></td><td style={{padding:"8px"}}><Badge type={evals[u.id]?.status==="done"?"done":u.ms!==null?"wip":"none"}>{evals[u.id]?.status==="done"?"完了":u.ms!==null?"入力中":"未"}</Badge></td></tr>)}</tbody></table></div></Card>
    </div>
  );
};

const AIPage = ({users,evals,gradeDefs}) => {
  const [target,setTarget] = useState("all");
  const [loading,setLoading] = useState(false);
  const [result,setResult] = useState(null);
  const [error,setError] = useState(null);
  const buildPrompt = () => {
    if(target==="all"){const rows=users.map(u=>{const e=evals[u.id]||{};const ms=e.managerScores&&Object.keys(e.managerScores).length?calcScore(e.managerScores,u.grade):null;return`${u.name}（${u.grade}·${u.dept}）: ${ms!==null?`${ms}点 ランク${calcRank(ms)}`:"未評価"}`;}).join("\n");return`以下のG1〜G5等級制・100点満点の人事評価データを分析し、チームの強み・課題・推奨アクションを300字程度の日本語でサマリーしてください。\n\n【評価結果】\n${rows}`;}
    const u=users.find(u=>u.id===target);const e=evals[u.id]||{};const criteria=GRADE_CRITERIA[u.grade]||[];const ms=e.managerScores||{};const scoreDetail=criteria.map(c=>`・${c.item}（配点${c.points}点）: 評価${ms[c.no]||"-"}点`).join("\n");const totalMs=calcScore(ms,u.grade);
    return`以下の個人評価データを分析し、強み・課題・来期の推奨アクションを300字程度の日本語でまとめてください。\n\n【対象者】${u.name}（${u.grade}·${u.dept}）\n【上司評価 総合点】${totalMs}点 / ランク${calcRank(totalMs)}\n\n【項目別スコア】\n${scoreDetail}\n\n【強み】${e.strengths||"未記入"}\n【改善課題】${e.improvements||"未記入"}\n【昇格推薦】${e.promotion||"未入力"}`;
  };
  const [analysisType,setAnalysisType] = useState("eval");
  const ANALYSIS_TYPES = [
    {id:"eval",label:"人事評価"},
    {id:"sales",label:"販売実績"},
    {id:"interview",label:"面談記録"},
    {id:"training",label:"研修PDCA"},
  ];
  const run = async () => {
    setLoading(true);setError(null);setResult(null);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({prompt: buildPrompt()}),
      });
      const data = await res.json();
      if(data.result) setResult(data.result);
      else setError(data.error || "分析結果を取得できませんでした。");
    } catch {
      setError("通信エラーが発生しました。");
    } finally {
      setLoading(false);
    }
  };
  return (
    <div>
      <Card>
        <CardTitle>分析の種類</CardTitle>
        <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:12}}>{ANALYSIS_TYPES.map(t=>(<button key={t.id} onClick={()=>setAnalysisType(t.id)} style={{padding:"6px 14px",borderRadius:20,fontSize:12,fontFamily:"inherit",border:analysisType===t.id?`1.5px solid ${C.purple[400]}`:`0.5px solid ${C.gray[200]}`,background:analysisType===t.id?C.purple[50]:"#fff",color:analysisType===t.id?C.purple[800]:C.gray[600],fontWeight:analysisType===t.id?500:400,cursor:"pointer"}}>{t.label}</button>))}</div>
        <div style={{display:"flex",gap:10,flexWrap:"wrap"}}><SelectEl value={target} onChange={setTarget} options={[{value:"all",label:"チーム全体"},...users.map(u=>({value:u.id,label:`${u.name}（${u.grade}）`}))]} style={{flex:1,minWidth:140}}/><Btn primary onClick={run} disabled={loading}>{loading?"分析中...":"✦ AI分析を実行"}</Btn></div>
      </Card>
      {loading&&<div style={{background:C.purple[50],border:`0.5px solid ${C.purple[200]}`,borderRadius:12,padding:"20px",display:"flex",gap:10,alignItems:"center"}}><span style={{fontSize:18}}>✦</span><span style={{fontSize:13,color:C.purple[800]}}>評価データを解析中...</span></div>}
      {error&&<div style={{background:C.coral[50],border:`0.5px solid ${C.coral[200]}`,borderRadius:12,padding:"16px 18px",fontSize:13,color:C.coral[800]}}>{error}</div>}
      {result&&<div style={{background:C.purple[50],border:`0.5px solid ${C.purple[200]}`,borderRadius:12,padding:"18px 20px"}}><div style={{display:"flex",gap:6,alignItems:"center",marginBottom:10}}><span style={{fontSize:14}}>✦</span><span style={{fontSize:12,fontWeight:500,color:C.purple[800]}}>AI分析サマリー — {target==="all"?"チーム全体":users.find(u=>u.id===target)?.name}</span></div><div style={{fontSize:13,color:C.purple[900],lineHeight:1.8,whiteSpace:"pre-wrap"}}>{result}</div></div>}
      {!loading&&!result&&!error&&<div style={{textAlign:"center",padding:"40px 20px",color:C.gray[400],fontSize:13,background:C.gray[50],borderRadius:12}}>分析対象を選んで「AI分析を実行」を押してください。</div>}
      <Card style={{marginTop:12}}><CardTitle>評価ランク基準</CardTitle><div style={{display:"flex",flexDirection:"column",gap:6}}>{RANK_DEFS.map(r=><div key={r.rank} style={{display:"flex",alignItems:"center",gap:10}}><RankBadge rank={r.rank}/><span style={{fontSize:12,color:C.gray[600]}}>{r.range}</span><span style={{fontSize:12,color:C.gray[800],fontWeight:500}}>{r.label}</span></div>)}</div></Card>
    </div>
  );
};

const UserManagePage = ({users,onAddUser,onUpdateUser,onDeleteUser,departments}) => {
  const [showModal,setShowModal] = useState(false);
  const [editingId,setEditingId] = useState(null);
  const [form,setForm] = useState({name:"",dept:departments[0]||"",grade:"G1",email:"",password:"",isManager:false});
  const [saving,setSaving] = useState(false);
  const [showBuddyModal,setShowBuddyModal] = useState(false);
  const [buddyTarget,setBuddyTarget] = useState(null); // バディを設定するメンバー
  const [selectedBuddy,setSelectedBuddy] = useState(""); // 選んだバディ上司のUID
  const openNew = ()=>{setEditingId(null);setForm({name:"",dept:departments[0]||"",grade:"G1",email:"",password:"",isManager:false});setShowModal(true);};
  const openEdit = u=>{setEditingId(u.id);setForm({name:u.name,dept:u.dept,grade:u.grade,email:u.email||"",password:"",isManager:u.role==="manager"});setShowModal(true);};
  const save = async()=>{
    if(!form.name.trim())return;
    setSaving(true);
    if(editingId){
      await setDoc(doc(db,"users",editingId),{name:form.name,dept:form.dept,grade:form.grade,status:"approved",role:form.isManager?"manager":"member"},{merge:true});
    } else {
      await onAddUser(form);
    }
    setSaving(false);setShowModal(false);
  };
  const approveUser = async(id)=>{
    await setDoc(doc(db,"users",id),{status:"approved"},{merge:true});
  };
  const remove = async id=>{if(window.confirm("削除しますか？"))await onDeleteUser(id);};

  const openBuddyModal = (u)=>{
    setBuddyTarget(u);
    setSelectedBuddy(u.buddyUid||"");
    setShowBuddyModal(true);
  };
  const saveBuddy = async()=>{
    if(!buddyTarget) return;
    // メンバー側にバディ上司のUIDを保存
    await setDoc(doc(db,"users",buddyTarget.id),{buddyUid:selectedBuddy||null},{merge:true});
    // バディ上司側に担当メンバーリストを更新
    if(selectedBuddy){
      const buddySnap = await getDoc(doc(db,"users",selectedBuddy));
      const buddyData = buddySnap.data()||{};
      const buddyOf = buddyData.buddyOf||[];
      if(!buddyOf.includes(buddyTarget.id)){
        await setDoc(doc(db,"users",selectedBuddy),{buddyOf:[...buddyOf,buddyTarget.id]},{merge:true});
      }
    }
    // 以前のバディ上司から削除
    const prevBuddyUid = buddyTarget.buddyUid;
    if(prevBuddyUid && prevBuddyUid !== selectedBuddy){
      const prevSnap = await getDoc(doc(db,"users",prevBuddyUid));
      const prevData = prevSnap.data()||{};
      const prevBuddyOf = (prevData.buddyOf||[]).filter(id=>id!==buddyTarget.id);
      await setDoc(doc(db,"users",prevBuddyUid),{buddyOf:prevBuddyOf},{merge:true});
    }
    setShowBuddyModal(false);
  };

  return (
    <div>
      {users.filter(u=>u.status==="pending").length>0&&(
        <div style={{marginBottom:16}}>
          <div style={{fontSize:13,fontWeight:500,color:C.coral[800],marginBottom:8,padding:"8px 12px",background:C.coral[50],borderRadius:8}}>承認待ち {users.filter(u=>u.status==="pending").length} 名</div>
          {users.filter(u=>u.status==="pending").map((u,i)=>(
            <div key={u.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",background:C.amber[50],borderRadius:8,marginBottom:6}}>
              <Avatar name={u.name} idx={i} size={32}/>
              <div style={{flex:1}}><div style={{fontSize:13,fontWeight:500,color:C.gray[800]}}>{u.name}</div><div style={{fontSize:11,color:C.gray[400]}}>{u.email} · {u.dept} · {u.grade}</div></div>
              <Btn small primary onClick={()=>approveUser(u.id)}>承認</Btn>
              <Btn small onClick={()=>openEdit(u)}>編集</Btn>
            </div>
          ))}
        </div>
      )}
      <div style={{display:"flex",justifyContent:"flex-end",marginBottom:14}}><Btn primary onClick={openNew}>+ メンバーを追加</Btn></div>
      <Card>
        {users.map((u,i)=>{
          const buddyUser = u.buddyUid ? users.find(b=>b.id===u.buddyUid) : null;
          return (
          <div key={u.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 0",borderBottom:i<users.length-1?`0.5px solid ${C.gray[50]}`:"none"}}>
            <Avatar name={u.name} idx={i} size={32}/>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:13,fontWeight:500,color:C.gray[800]}}>{u.name}</div>
              <div style={{fontSize:11,color:C.gray[400]}}>{u.dept} · <span style={{color:C.purple[600],fontWeight:500}}>{u.grade}</span>{u.role==="manager"&&<span style={{marginLeft:6,fontSize:10,padding:"1px 6px",borderRadius:10,background:C.purple[50],color:C.purple[800],fontWeight:600}}>管理者</span>}</div>
              {buddyUser&&<div style={{fontSize:11,color:C.teal[800],marginTop:2}}>👥 バディ上司：{buddyUser.name}</div>}
              {u.buddyOf?.length>0&&<div style={{fontSize:11,color:C.blue[800],marginTop:2}}>📋 担当メンバー：{u.buddyOf.map(id=>users.find(m=>m.id===id)?.name||"").filter(Boolean).join("、")}</div>}
            </div>
            <Btn small onClick={()=>openBuddyModal(u)}>バディ設定</Btn>
            <Btn small onClick={()=>openEdit(u)}>編集</Btn>
            <Btn small danger onClick={()=>remove(u.id)}>削除</Btn>
          </div>
          );
        })}
      </Card>

      {/* バディ設定モーダル */}
      {showBuddyModal&&buddyTarget&&<Modal title={`${buddyTarget.name}のバディ上司を設定`} onClose={()=>setShowBuddyModal(false)}>
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <div style={{fontSize:13,color:C.gray[600]}}>バディ上司に設定したメンバーは、{buddyTarget.name}さんの研修PDCAを入力できるようになります。</div>
          <div>
            <div style={{fontSize:12,color:C.gray[400],marginBottom:6}}>バディ上司を選択</div>
            <SelectEl value={selectedBuddy} onChange={setSelectedBuddy} options={[{value:"",label:"未設定"},...users.filter(u=>u.id!==buddyTarget.id).map(u=>({value:u.id,label:`${u.name}（${u.grade}）`}))]} style={{width:"100%"}}/>
          </div>
          <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
            <Btn onClick={()=>setShowBuddyModal(false)}>キャンセル</Btn>
            <Btn primary onClick={saveBuddy}>保存</Btn>
          </div>
        </div>
      </Modal>}
      {showModal&&<Modal title={editingId?"メンバーを編集":"メンバーを追加"} onClose={()=>setShowModal(false)}>
        <div style={{display:"flex",flexDirection:"column",gap:13}}>
          <div><div style={{fontSize:12,color:C.gray[400],marginBottom:4}}>名前</div><Input value={form.name} onChange={v=>setForm(f=>({...f,name:v}))} placeholder="例：山田 太郎"/></div>
          <div><div style={{fontSize:12,color:C.gray[400],marginBottom:4}}>部署</div><SelectEl value={form.dept} onChange={v=>setForm(f=>({...f,dept:v}))} options={departments} style={{width:"100%"}}/></div>
          <div><div style={{fontSize:12,color:C.gray[400],marginBottom:4}}>等級</div><SelectEl value={form.grade} onChange={v=>setForm(f=>({...f,grade:v}))} options={GRADES} style={{width:"100%"}}/></div>
          {editingId&&<div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 12px",background:form.isManager?C.purple[50]:C.gray[50],borderRadius:8,border:`0.5px solid ${form.isManager?C.purple[200]:C.gray[200]}`}}>
            <div>
              <div style={{fontSize:13,fontWeight:500,color:form.isManager?C.purple[800]:C.gray[800]}}>管理者権限</div>
              <div style={{fontSize:11,color:C.gray[400],marginTop:2}}>ONにすると管理者画面が使えるようになります</div>
            </div>
            <button onClick={()=>setForm(f=>({...f,isManager:!f.isManager}))} style={{width:44,height:24,borderRadius:12,border:"none",cursor:"pointer",background:form.isManager?C.purple[400]:C.gray[200],position:"relative",transition:"background 0.2s",flexShrink:0}}>
              <div style={{width:18,height:18,borderRadius:"50%",background:"#fff",position:"absolute",top:3,left:form.isManager?23:3,transition:"left 0.2s"}}/>
            </button>
          </div>}
          {!editingId&&<><div><div style={{fontSize:12,color:C.gray[400],marginBottom:4}}>メールアドレス</div><Input value={form.email} onChange={v=>setForm(f=>({...f,email:v}))} placeholder="user@example.com" type="email"/></div><div><div style={{fontSize:12,color:C.gray[400],marginBottom:4}}>初期パスワード</div><Input value={form.password} onChange={v=>setForm(f=>({...f,password:v}))} placeholder="6文字以上"/></div></>}
          <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:4}}><Btn onClick={()=>setShowModal(false)}>キャンセル</Btn><Btn primary onClick={save} disabled={saving}>{saving?"保存中...":"保存"}</Btn></div>
        </div>
      </Modal>}
    </div>
  );
};

const SettingsPage = ({currentUser,departments,setDepartments,gradeDefs,setGradeDefs,periods,setPeriods,onSaveSettings}) => {
  const [tab,setTab] = useState("account");
  const [saved,setSaved] = useState("");
  const showSaved = msg=>{setSaved(msg||"保存しました");setTimeout(()=>setSaved(""),2500);};
  const [newEmail,setNewEmail] = useState(currentUser.email||"");
  const [oldPw,setOldPw] = useState("");
  const [newPw,setNewPw] = useState("");
  const [pwError,setPwError] = useState("");
  const [newDept,setNewDept] = useState("");
  const [localGradeDefs,setLocalGradeDefs] = useState({...gradeDefs});
  const [newPeriodLabel,setNewPeriodLabel] = useState("");
  const saveAccount = async()=>{ try{ if(newEmail!==currentUser.email)await updateEmail(auth.currentUser,newEmail.trim()); showSaved("アカウント情報を更新しました"); }catch(e){showSaved("エラー："+e.message);} };
  const savePassword = async()=>{ setPwError(""); if(newPw.length<6){setPwError("6文字以上必要です");return;} try{ const cred=EmailAuthProvider.credential(currentUser.email,oldPw); await reauthenticateWithCredential(auth.currentUser,cred); await updatePassword(auth.currentUser,newPw); setOldPw("");setNewPw("");showSaved("パスワードを変更しました"); }catch(e){setPwError("現在のパスワードが正しくありません");} };
  const addDept = ()=>{if(newDept.trim()&&!departments.includes(newDept.trim())){const d=[...departments,newDept.trim()];setDepartments(d);onSaveSettings({departments:d});setNewDept("");showSaved("部署を追加しました");}};
  const removeDept = d=>{const nd=departments.filter(x=>x!==d);setDepartments(nd);onSaveSettings({departments:nd});};
  const saveGradeDefs = ()=>{setGradeDefs({...localGradeDefs});onSaveSettings({gradeDefs:localGradeDefs});showSaved("等級定義を保存しました");};
  const addPeriod = ()=>{if(!newPeriodLabel.trim())return;const np=[...periods,{id:"p"+Date.now(),label:newPeriodLabel.trim(),active:false}];setPeriods(np);onSaveSettings({periods:np});setNewPeriodLabel("");showSaved("評価期間を追加しました");};
  const removePeriod = id=>{const np=periods.filter(p=>p.id!==id);setPeriods(np);onSaveSettings({periods:np});};
  const setActivePeriod = id=>{const np=periods.map(p=>({...p,active:p.id===id}));setPeriods(np);onSaveSettings({periods:np});showSaved("アクティブ期間を変更しました");};
  const tabStyle = t=>({padding:"8px 16px",fontSize:13,borderRadius:8,border:"none",cursor:"pointer",fontFamily:"inherit",background:tab===t?C.purple[50]:"transparent",color:tab===t?C.purple[800]:C.gray[600],fontWeight:tab===t?500:400});
  return (
    <div>
      {saved&&<div style={{background:C.green[50],border:`1px solid ${C.green[400]}`,borderRadius:8,padding:"8px 14px",marginBottom:12,fontSize:13,color:C.green[800]}}>✓ {saved}</div>}
      <div style={{display:"flex",gap:6,background:C.gray[50],borderRadius:10,padding:4,marginBottom:16,flexWrap:"wrap"}}>
        {[{id:"account",label:"アカウント"},{id:"password",label:"パスワード"},{id:"departments",label:"部署"},{id:"grades",label:"等級定義"},{id:"periods",label:"評価期間"}].map(t=><button key={t.id} style={tabStyle(t.id)} onClick={()=>setTab(t.id)}>{t.label}</button>)}
      </div>
      {tab==="account"&&<Card><CardTitle>アカウント情報</CardTitle><div style={{display:"flex",flexDirection:"column",gap:12}}><div><div style={{fontSize:12,color:C.gray[400],marginBottom:4}}>メールアドレス</div><Input value={newEmail} onChange={setNewEmail} placeholder="your@example.com" type="email"/></div><Btn primary onClick={saveAccount}>保存する</Btn></div></Card>}
      {tab==="password"&&<Card><CardTitle>パスワード変更</CardTitle><div style={{display:"flex",flexDirection:"column",gap:12}}><div><div style={{fontSize:12,color:C.gray[400],marginBottom:4}}>現在のパスワード</div><Input value={oldPw} onChange={setOldPw} placeholder="現在のパスワード" type="password"/></div><div><div style={{fontSize:12,color:C.gray[400],marginBottom:4}}>新しいパスワード</div><Input value={newPw} onChange={setNewPw} placeholder="新しいパスワード（6文字以上）" type="password"/></div>{pwError&&<div style={{fontSize:12,color:C.coral[400],padding:"8px 12px",background:C.coral[50],borderRadius:8}}>{pwError}</div>}<Btn primary onClick={savePassword}>パスワードを変更する</Btn></div></Card>}
      {tab==="departments"&&<Card><CardTitle>部署リスト</CardTitle><div style={{display:"flex",gap:8,marginBottom:14}}><Input value={newDept} onChange={setNewDept} placeholder="新しい部署名" style={{flex:1}}/><Btn primary onClick={addDept}>追加</Btn></div><div style={{display:"flex",flexDirection:"column",gap:6}}>{departments.map(d=><div key={d} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 12px",background:C.gray[50],borderRadius:8}}><span style={{fontSize:13,color:C.gray[800]}}>{d}</span><Btn small danger onClick={()=>removeDept(d)}>削除</Btn></div>)}</div></Card>}
      {tab==="grades"&&<Card><CardTitle action={<Btn small primary onClick={saveGradeDefs}>保存する</Btn>}>等級定義の編集</CardTitle><div style={{display:"flex",flexDirection:"column",gap:12}}>{GRADES.map(g=><div key={g}><div style={{fontSize:12,color:C.purple[600],fontWeight:600,marginBottom:4}}>{g}</div><Textarea rows={2} value={localGradeDefs[g]||""} onChange={v=>setLocalGradeDefs(prev=>({...prev,[g]:v}))} placeholder={`${g}の等級定義`}/></div>)}</div></Card>}
      {tab==="periods"&&<Card><CardTitle>評価期間の管理</CardTitle><div style={{display:"flex",gap:8,marginBottom:14}}><Input value={newPeriodLabel} onChange={setNewPeriodLabel} placeholder="例：2026年度 下半期" style={{flex:1}}/><Btn primary onClick={addPeriod}>追加</Btn></div><div style={{display:"flex",flexDirection:"column",gap:6}}>{periods.map(p=><div key={p.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 12px",background:p.active?C.purple[50]:C.gray[50],borderRadius:8,border:p.active?`1px solid ${C.purple[200]}`:"none"}}><div style={{flex:1,fontSize:13,color:C.gray[800],fontWeight:p.active?500:400}}>{p.label}</div>{p.active?<Badge type="info">現在の期間</Badge>:<Btn small onClick={()=>setActivePeriod(p.id)}>アクティブにする</Btn>}{!p.active&&<Btn small danger onClick={()=>removePeriod(p.id)}>削除</Btn>}</div>)}</div></Card>}
    </div>
  );
};

// ── 販売実績 入力フォーム ──────────────────────────────────────
const SalesInputForm = ({uid, displayName}) => {
  const [date,setDate] = useState(todayStr());
  const [agency,setAgency] = useState("");
  const [storeName,setStoreName] = useState("");
  const [carrierId,setCarrierId] = useState("docomo");
  const [entries,setEntries] = useState(CARRIERS_SALES.map(c=>emptyEntry(c.id)));
  const [peripheralAmount,setPeripheralAmount] = useState(0);
  const [saving,setSaving] = useState(false);
  const [savedAt,setSavedAt] = useState(null);
  const [loading,setLoading] = useState(true);

  useEffect(()=>{
    if(!uid)return;
    setLoading(true);
    getDoc(doc(db,"salesReports",uid,"daily",date)).then(snap=>{
      if(snap.exists()){
        const d=snap.data();
        setAgency(d.agency||"");setStoreName(d.storeName||"");
        const merged=CARRIERS_SALES.map(c=>{const found=(d.entries||[]).find(e=>e.carrierId===c.id);return found||emptyEntry(c.id);});
        setEntries(merged);setPeripheralAmount(d.peripheralTotal||0);setSavedAt(d.updatedAt?.toDate?.()||null);
      } else {
        setAgency("");setStoreName("");setEntries(CARRIERS_SALES.map(c=>emptyEntry(c.id)));setPeripheralAmount(0);setSavedAt(null);
      }
    }).finally(()=>setLoading(false));
  },[uid,date]);

  const updateEntry = (cId,field,val) => setEntries(prev=>prev.map(e=>e.carrierId===cId?{...e,[field]:Math.max(0,val)}:e));
  const save = async()=>{
    setSaving(true);
    const ref=doc(db,"salesReports",uid,"daily",date);
    const snap=await getDoc(ref);
    await setDoc(ref,{uid,displayName,date,agency,storeName,entries,peripheralTotal:peripheralAmount,createdAt:snap.exists()?snap.data().createdAt:new Date(),updatedAt:new Date()});
    setSavedAt(new Date());setSaving(false);
  };
  const current=entries.find(e=>e.carrierId===carrierId)||emptyEntry(carrierId);
  const isToday=date===todayStr();

  if(loading)return <div style={{padding:"2rem",textAlign:"center",color:C.gray[400],fontSize:13}}>読み込み中...</div>;
  return (
    <div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16,flexWrap:"wrap",gap:8}}>
        <div>
          <div style={{fontSize:15,fontWeight:500,color:C.gray[800]}}>日次販売報告</div>
          {savedAt&&<div style={{fontSize:11,color:C.gray[400],marginTop:2}}>保存済 {savedAt.toLocaleTimeString("ja-JP",{hour:"2-digit",minute:"2-digit"})}</div>}
        </div>
        <button onClick={save} disabled={saving||!isToday} style={{padding:"8px 20px",background:isToday?C.purple[400]:C.gray[200],color:"#fff",border:"none",borderRadius:8,fontSize:13,fontWeight:500,cursor:isToday?"pointer":"default",fontFamily:"inherit"}}>
          {saving?"保存中...":"保存"}
        </button>
      </div>
      {!isToday&&<div style={{padding:"8px 12px",background:C.amber[50],borderRadius:8,fontSize:12,color:C.amber[800],marginBottom:12}}>過去日の報告は閲覧のみです</div>}
      <Card>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
          <div>
            <div style={{fontSize:11,color:C.gray[400],marginBottom:4}}>日付</div>
            <input type="date" value={date} onChange={e=>setDate(e.target.value)} style={{width:"100%",height:34,padding:"0 8px",border:`0.5px solid ${C.gray[200]}`,borderRadius:6,fontSize:13,color:C.gray[800],background:"#fff",fontFamily:"inherit"}}/>
          </div>
          <div>
            <div style={{fontSize:11,color:C.gray[400],marginBottom:4}}>代理店名</div>
            <input value={agency} onChange={e=>setAgency(e.target.value)} placeholder="例：〇〇エージェント" disabled={!isToday} style={{width:"100%",height:34,padding:"0 8px",border:`0.5px solid ${C.gray[200]}`,borderRadius:6,fontSize:13,color:C.gray[800],background:isToday?"#fff":C.gray[50],fontFamily:"inherit",boxSizing:"border-box"}}/>
          </div>
          <div>
            <div style={{fontSize:11,color:C.gray[400],marginBottom:4}}>店舗名</div>
            <input value={storeName} onChange={e=>setStoreName(e.target.value)} placeholder="例：△△店" disabled={!isToday} style={{width:"100%",height:34,padding:"0 8px",border:`0.5px solid ${C.gray[200]}`,borderRadius:6,fontSize:13,color:C.gray[800],background:isToday?"#fff":C.gray[50],fontFamily:"inherit",boxSizing:"border-box"}}/>
          </div>
        </div>
      </Card>
      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:12}}>
        {CARRIERS_SALES.map(c=>{
          const entry=entries.find(e=>e.carrierId===c.id)||emptyEntry(c.id);
          const total=salesTotal(entry);const selected=carrierId===c.id;
          return(
            <button key={c.id} onClick={()=>setCarrierId(c.id)} style={{padding:"6px 12px",borderRadius:20,fontSize:12,fontFamily:"inherit",border:selected?`1.5px solid ${CARRIER_COLORS_S[c.id]}`:`0.5px solid ${C.gray[200]}`,background:selected?CARRIER_COLORS_S[c.id]+"18":"#fff",color:selected?CARRIER_COLORS_S[c.id]:C.gray[600],fontWeight:selected?500:400,cursor:"pointer"}}>
              {c.label}{total>0&&<span style={{marginLeft:5,fontWeight:600}}>{total}</span>}
            </button>
          );
        })}
      </div>
      <Card>
        <div style={{fontSize:12,fontWeight:500,color:C.gray[400],marginBottom:10}}>モバイル</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:14}}>
          {SALES_FIELDS.slice(0,4).map(f=><div key={f.key}><div style={{fontSize:11,color:C.gray[400],marginBottom:3}}>{f.label}</div><NumInput value={current[f.key]||0} disabled={!isToday} onChange={v=>updateEntry(carrierId,f.key,v)}/></div>)}
        </div>
        <div style={{fontSize:12,fontWeight:500,color:C.gray[400],marginBottom:10}}>付帯商材</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
          {SALES_FIELDS.slice(4).map(f=><div key={f.key}><div style={{fontSize:11,color:C.gray[400],marginBottom:3}}>{f.label}</div><NumInput value={current[f.key]||0} disabled={!isToday} onChange={v=>updateEntry(carrierId,f.key,v)}/></div>)}
        </div>
      </Card>
      <Card>
        <div style={{fontSize:12,fontWeight:500,color:C.gray[400],marginBottom:10}}>周辺機器（金額・本日合計）</div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <input type="number" min={0} value={peripheralAmount===0?"":peripheralAmount} placeholder="0" disabled={!isToday}
            onChange={e=>setPeripheralAmount(Math.max(0,parseInt(e.target.value||"0",10)))}
            style={{flex:1,height:36,padding:"0 10px",border:`0.5px solid ${C.gray[200]}`,borderRadius:6,fontSize:14,textAlign:"right",background:isToday?"#fff":C.gray[50],color:C.gray[800],outline:"none",fontFamily:"inherit"}}/>
          <span style={{fontSize:13,color:C.gray[400]}}>円</span>
        </div>
        <div style={{fontSize:11,color:C.gray[400],marginTop:6}}>キャリアを問わず、本日の周辺機器売上の合計金額を入力してください</div>
      </Card>
      <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:8}}>
        {["newContract","deviceChange","mnpIn","portIn"].map((k,i)=>{
          const labels=["新規","機変","MNP転入","番号移行"];
          const total=entries.reduce((s,e)=>s+(e[k]||0),0);
          return(<div key={k} style={{background:C.gray[50],borderRadius:8,padding:"10px 12px"}}><div style={{fontSize:10,color:C.gray[400],marginBottom:2}}>{labels[i]}</div><div style={{fontSize:20,fontWeight:600,color:C.gray[800]}}>{total}</div></div>);
        })}
        <div style={{background:C.purple[50],borderRadius:8,padding:"10px 12px"}}><div style={{fontSize:10,color:C.purple[600],marginBottom:2}}>周辺機器</div><div style={{fontSize:20,fontWeight:600,color:C.purple[800]}}>{peripheralAmount.toLocaleString()}円</div></div>
      </div>
    </div>
  );
};

// ── 販売実績 自分の実績 ───────────────────────────────────────
const SalesMemberStats = ({uid, allReports}) => {
  const [period,setPeriod] = useState("month");
  const now = new Date();
  const myReports = allReports.filter(r=>r.uid===uid);
  const filtered = myReports.filter(r=>{
    const d=new Date(r.date);
    if(period==="week"){const w=new Date();w.setDate(w.getDate()-7);return d>=w;}
    return d.getFullYear()===now.getFullYear()&&d.getMonth()===now.getMonth();
  });
  const dailyTotals = filtered.map(r=>({date:r.date.slice(5),total:(r.entries||[]).reduce((s,e)=>s+salesTotal(e),0)})).sort((a,b)=>a.date.localeCompare(b.date));
  const monthTotal = filtered.reduce((s,r)=>s+(r.entries||[]).reduce((s2,e)=>s2+salesTotal(e),0),0);
  const ranking = Object.entries(allReports.reduce((acc,r)=>{
    const d=new Date(r.date);if(d.getFullYear()!==now.getFullYear()||d.getMonth()!==now.getMonth())return acc;
    if(!acc[r.uid])acc[r.uid]={uid:r.uid,name:r.displayName,total:0};
    acc[r.uid].total+=(r.entries||[]).reduce((s,e)=>s+salesTotal(e),0);return acc;
  },{})).map(([,v])=>v).sort((a,b)=>b.total-a.total);
  const myRank=ranking.findIndex(r=>r.uid===uid)+1;
  const maxBar=ranking[0]?.total||1;
  return (
    <div>
      <div style={{display:"flex",gap:6,marginBottom:14}}>
        {[{id:"week",label:"直近7日"},{id:"month",label:"今月"}].map(p=>(
          <button key={p.id} onClick={()=>setPeriod(p.id)} style={{padding:"6px 14px",borderRadius:20,fontSize:12,fontFamily:"inherit",border:period===p.id?`1.5px solid ${C.purple[400]}`:`0.5px solid ${C.gray[200]}`,background:period===p.id?C.purple[50]:"#fff",color:period===p.id?C.purple[800]:C.gray[600],cursor:"pointer"}}>{p.label}</button>
        ))}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:14}}>
        <div style={{background:C.purple[50],borderRadius:10,padding:"12px 14px"}}><div style={{fontSize:11,color:C.purple[600],marginBottom:3}}>合計件数</div><div style={{fontSize:24,fontWeight:600,color:C.purple[800]}}>{monthTotal}</div></div>
        <div style={{background:C.teal[50],borderRadius:10,padding:"12px 14px"}}><div style={{fontSize:11,color:C.teal[800],marginBottom:3}}>稼働日数</div><div style={{fontSize:24,fontWeight:600,color:C.teal[800]}}>{filtered.length}日</div></div>
        <div style={{background:C.amber[50],borderRadius:10,padding:"12px 14px"}}><div style={{fontSize:11,color:C.amber[800],marginBottom:3}}>今月順位</div><div style={{fontSize:24,fontWeight:600,color:C.amber[800]}}>{myRank>0?`${myRank}位`:"-"}</div></div>
      </div>
      <Card>
        <CardTitle>日別件数</CardTitle>
        {dailyTotals.length===0?(
          <div style={{textAlign:"center",padding:"20px",color:C.gray[400],fontSize:13}}>データがありません</div>
        ):(
          <div style={{display:"flex",alignItems:"flex-end",gap:4,height:80,overflowX:"auto"}}>
            {dailyTotals.map(d=>{
                      const maxVal=Math.max(...dailyTotals.map(x=>x.total),1);
              const h=Math.max((d.total/maxVal)*70,4);
              return(
                <div key={d.date} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2,minWidth:28}}>
                  <div style={{fontSize:9,color:C.gray[400]}}>{d.total}</div>
                  <div style={{width:20,height:h,background:C.purple[400],borderRadius:"3px 3px 0 0"}}/>
                  <div style={{fontSize:9,color:C.gray[400],writingMode:"vertical-rl",transform:"rotate(180deg)"}}>{d.date}</div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
      <Card>
        <CardTitle>今月ランキング</CardTitle>
        {ranking.slice(0,10).map((r,i)=>(
          <div key={r.uid} style={{display:"flex",alignItems:"center",gap:10,marginBottom:10,background:r.uid===uid?C.purple[50]:"transparent",borderRadius:8,padding:"6px 8px"}}>
            <div style={{width:22,height:22,borderRadius:"50%",flexShrink:0,background:i===0?"#fbbf24":i===1?"#9ca3af":i===2?"#cd7c2f":C.gray[100],display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:600,color:i<3?"#fff":C.gray[600]}}>{i+1}</div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:12,fontWeight:r.uid===uid?600:400,color:C.gray[800]}}>{r.name}{r.uid===uid&&" (自分)"}</div>
              <div style={{height:4,background:C.gray[100],borderRadius:2,marginTop:3}}><div style={{height:"100%",width:`${(r.total/maxBar)*100}%`,background:C.purple[400],borderRadius:2}}/></div>
            </div>
            <div style={{fontSize:13,fontWeight:600,color:C.gray[800],minWidth:36,textAlign:"right"}}>{r.total}</div>
          </div>
        ))}
      </Card>
    </div>
  );
};

// ── 販売実績 管理者ダッシュボード ─────────────────────────────
const SalesManagerDash = ({allReports}) => {
  const [tab,setTab] = useState("daily");
  const [filterAgency,setFilterAgency] = useState("");
  const [filterStore,setFilterStore] = useState("");
  const [filterCarrier,setFilterCarrier] = useState("all");
  const [filterPerson,setFilterPerson] = useState("all");
  const [periodMode,setPeriodMode] = useState("month"); // "month" | "range"
  const [dateFrom,setDateFrom] = useState(new Date().toLocaleDateString("sv-SE").slice(0,7)+"-01");
  const [dateTo,setDateTo] = useState(new Date().toLocaleDateString("sv-SE"));
  const [deleting,setDeleting] = useState(null);
  const now = new Date();

  const deleteReport = async (uid, date) => {
    if (!window.confirm(`${date} の報告データを削除しますか？この操作は取り消せません。`)) return;
    setDeleting(`${uid}_${date}`);
    try {
      await deleteDoc(doc(db, "salesReports", uid, "daily", date));
    } finally {
      setDeleting(null);
    }
  };

  // 期間フィルター
  const periodFiltered = allReports.filter(r=>{
    if(periodMode==="month"){
      const d=new Date(r.date);
      return d.getFullYear()===now.getFullYear()&&d.getMonth()===now.getMonth();
    } else {
      return r.date>=dateFrom && r.date<=dateTo;
    }
  });

  // 人一覧
  const personList = [...new Map(periodFiltered.map(r=>[r.uid,{uid:r.uid,name:r.displayName}])).values()].sort((a,b)=>a.name.localeCompare(b.name));

  const filtered = periodFiltered.filter(r=>
    (!filterAgency||(r.agency||"").includes(filterAgency))&&
    (!filterStore||(r.storeName||"").includes(filterStore))&&
    (filterPerson==="all"||r.uid===filterPerson)
  );

  const dailyRows = filtered.flatMap(r=>(r.entries||[]).filter(e=>filterCarrier==="all"||e.carrierId===filterCarrier).map((e,idx)=>({uid:r.uid,date:r.date,name:r.displayName,agency:r.agency,store:r.storeName,carrier:e.carrierId,peripheralTotal:idx===0?(r.peripheralTotal||0):0,...e}))).sort((a,b)=>b.date.localeCompare(a.date));
  const carrierTotals = CARRIERS_SALES.map(c=>{const rows=filtered.flatMap(r=>(r.entries||[]).filter(e=>e.carrierId===c.id));return{carrier:c.label,total:rows.reduce((s,e)=>s+salesTotal(e),0),color:CARRIER_COLORS_S[c.id]};}).sort((a,b)=>b.total-a.total);
  const peripheralMonthTotal = filtered.reduce((s,r)=>s+(r.peripheralTotal||0),0);
  const agencyTotals = Object.entries(filtered.reduce((acc,r)=>{const key=`${r.agency||"未入力"}__${r.storeName||"未入力"}`;if(!acc[key])acc[key]={agency:r.agency||"未入力",store:r.storeName||"未入力",total:0};acc[key].total+=(r.entries||[]).reduce((s,e)=>s+salesTotal(e),0);return acc;},{})).map(([,v])=>v).sort((a,b)=>b.total-a.total);
  const memberRanking = Object.entries(filtered.reduce((acc,r)=>{if(!acc[r.uid])acc[r.uid]={name:r.displayName,total:0,days:new Set()};acc[r.uid].total+=(r.entries||[]).reduce((s,e)=>s+salesTotal(e),0);acc[r.uid].days.add(r.date);return acc;},{})).map(([uid,v])=>({uid,...v,days:v.days.size})).sort((a,b)=>b.total-a.total);
  const maxMember=memberRanking[0]?.total||1;

  // Excel出力
  const exportExcel = () => {
    const XLSX = (window as any).XLSX;
    if(!XLSX){alert("Excel出力ライブラリの読み込み中です。しばらくお待ちください。");return;}
    const wb = XLSX.utils.book_new();
    const today = new Date().toLocaleDateString("ja-JP");
    const periodLabel = periodMode==="month"
      ? `${now.getFullYear()}年${now.getMonth()+1}月`
      : `${dateFrom} 〜 ${dateTo}`;
    const personLabel = filterPerson==="all" ? "全スタッフ" : (personList.find(p=>p.uid===filterPerson)?.name||"");

    // スタイル定義
    const headerStyle = {font:{bold:true,color:{rgb:"FFFFFF"},sz:11},fill:{fgColor:{rgb:"4A4A6A"}},alignment:{horizontal:"center",vertical:"center"},border:{bottom:{style:"thin",color:{rgb:"CCCCCC"}}}};
    const subHeaderStyle = {font:{bold:true,color:{rgb:"333333"},sz:10},fill:{fgColor:{rgb:"F0F0F0"}},alignment:{horizontal:"center"},border:{bottom:{style:"thin",color:{rgb:"CCCCCC"}},top:{style:"thin",color:{rgb:"CCCCCC"}}}};
    const cellStyle = {font:{sz:10,color:{rgb:"333333"}},alignment:{vertical:"center"},border:{bottom:{style:"thin",color:{rgb:"EEEEEE"}}}};
    const numStyle = {font:{sz:10,color:{rgb:"333333"}},alignment:{horizontal:"right",vertical:"center"},border:{bottom:{style:"thin",color:{rgb:"EEEEEE"}}}};
    const totalStyle = {font:{bold:true,sz:10,color:{rgb:"4A4A6A"}},fill:{fgColor:{rgb:"EEEEF8"}},alignment:{horizontal:"right"},border:{top:{style:"medium",color:{rgb:"4A4A6A"}}}};
    const titleStyle = {font:{bold:true,sz:14,color:{rgb:"4A4A6A"}},alignment:{horizontal:"left"}};
    const infoStyle = {font:{sz:9,color:{rgb:"888888"}}};

    const applyStyle = (ws: any, data: any[][], styles: any[][]) => {
      data.forEach((row, r) => {
        row.forEach((_, c) => {
          const cellRef = XLSX.utils.encode_cell({r, c});
          if(!ws[cellRef]) ws[cellRef] = {v:"", t:"s"};
          if(styles[r]?.[c]) ws[cellRef].s = styles[r][c];
        });
      });
    };

    // ── 日別明細シート ──────────────────────────────────────
    const dailyData = [
      [`販売実績レポート`, "", "", "", "", "", "", "", "", "", "", "", ""],
      [`対象期間：${periodLabel}　　対象：${personLabel}　　出力日：${today}`, "", "", "", "", "", "", "", "", "", "", "", ""],
      [],
      ["日付","氏名","店舗","キャリア","新規契約","機種変更","MNP転入","番号移行","ネット回線","クレカ","電気・ガス","合計件数","周辺機器(円)"],
      ...dailyRows.map(r=>[
        r.date, r.name, r.store||"",
        CARRIERS_SALES.find(c=>c.id===r.carrier)?.label||r.carrier,
        r.newContract||0, r.deviceChange||0, r.mnpIn||0, r.portIn||0,
        r.netLine||0, r.creditCard||0, r.energy||0,
        salesTotal(r), r.peripheralTotal||0
      ]),
      [],
      ["合計", "", "", "",
        dailyRows.reduce((s,r)=>s+(r.newContract||0),0),
        dailyRows.reduce((s,r)=>s+(r.deviceChange||0),0),
        dailyRows.reduce((s,r)=>s+(r.mnpIn||0),0),
        dailyRows.reduce((s,r)=>s+(r.portIn||0),0),
        dailyRows.reduce((s,r)=>s+(r.netLine||0),0),
        dailyRows.reduce((s,r)=>s+(r.creditCard||0),0),
        dailyRows.reduce((s,r)=>s+(r.energy||0),0),
        dailyRows.reduce((s,r)=>s+salesTotal(r),0),
        dailyRows.reduce((s,r)=>s+(r.peripheralTotal||0),0),
      ],
    ];
    const ws1 = XLSX.utils.aoa_to_sheet(dailyData);
    ws1["!cols"] = [{wch:12},{wch:12},{wch:14},{wch:14},{wch:8},{wch:8},{wch:8},{wch:8},{wch:10},{wch:8},{wch:10},{wch:8},{wch:12}];
    ws1["!merges"] = [{s:{r:0,c:0},e:{r:0,c:12}},{s:{r:1,c:0},e:{r:1,c:12}}];
    // スタイル適用
    const totalRow = dailyData.length - 1;
    const headerRow = 3;
    dailyData[headerRow].forEach((_,c)=>{ const ref=XLSX.utils.encode_cell({r:headerRow,c}); if(ws1[ref]) ws1[ref].s=subHeaderStyle; });
    dailyData.slice(4, totalRow).forEach((_,ri)=>{ dailyData[4+ri].forEach((_,c)=>{ const ref=XLSX.utils.encode_cell({r:4+ri,c}); if(ws1[ref]) ws1[ref].s=c<4?cellStyle:numStyle; }); });
    dailyData[totalRow].forEach((_,c)=>{ const ref=XLSX.utils.encode_cell({r:totalRow,c}); if(ws1[ref]) ws1[ref].s=totalStyle; });
    const t0=XLSX.utils.encode_cell({r:0,c:0}); if(ws1[t0]) ws1[t0].s=titleStyle;
    const i0=XLSX.utils.encode_cell({r:1,c:0}); if(ws1[i0]) ws1[i0].s=infoStyle;
    XLSX.utils.book_append_sheet(wb, ws1, "日別明細");

    // ── キャリア別集計シート ────────────────────────────────
    const totalCarrier = carrierTotals.reduce((s,c)=>s+c.total,0);
    const carrierData = [
      ["キャリア別集計", "", ""],
      [`対象期間：${periodLabel}　　出力日：${today}`, "", ""],
      [],
      ["キャリア","合計件数","構成比(%)"],
      ...carrierTotals.map(c=>[c.carrier, c.total, totalCarrier>0?Math.round((c.total/totalCarrier)*100):0]),
      [],
      ["周辺機器売上合計(円)", peripheralMonthTotal, ""],
    ];
    const ws2 = XLSX.utils.aoa_to_sheet(carrierData);
    ws2["!cols"] = [{wch:18},{wch:12},{wch:12}];
    ws2["!merges"] = [{s:{r:0,c:0},e:{r:0,c:2}},{s:{r:1,c:0},e:{r:1,c:2}}];
    [3].forEach(r=>{ carrierData[r].forEach((_,c)=>{ const ref=XLSX.utils.encode_cell({r,c}); if(ws2[ref]) ws2[ref].s=subHeaderStyle; }); });
    carrierData.slice(4,carrierData.length-2).forEach((_,ri)=>{ carrierData[4+ri].forEach((_,c)=>{ const ref=XLSX.utils.encode_cell({r:4+ri,c}); if(ws2[ref]) ws2[ref].s=c===0?cellStyle:numStyle; }); });
    const ct0=XLSX.utils.encode_cell({r:0,c:0}); if(ws2[ct0]) ws2[ct0].s=titleStyle;
    XLSX.utils.book_append_sheet(wb, ws2, "キャリア別集計");

    // ── 店舗別集計シート ────────────────────────────────────
    const agencyData = [
      ["店舗別集計", ""],
      [`対象期間：${periodLabel}　　出力日：${today}`, ""],
      [],
      ["店舗","合計件数"],
      ...agencyTotals.map(a=>[a.store||a.agency, a.total]),
      [],
      ["合計", agencyTotals.reduce((s,a)=>s+a.total,0)],
    ];
    const ws3 = XLSX.utils.aoa_to_sheet(agencyData);
    ws3["!cols"] = [{wch:20},{wch:12}];
    ws3["!merges"] = [{s:{r:0,c:0},e:{r:0,c:1}},{s:{r:1,c:0},e:{r:1,c:1}}];
    [3].forEach(r=>{ agencyData[r].forEach((_,c)=>{ const ref=XLSX.utils.encode_cell({r,c}); if(ws3[ref]) ws3[ref].s=subHeaderStyle; }); });
    const at0=XLSX.utils.encode_cell({r:0,c:0}); if(ws3[at0]) ws3[at0].s=titleStyle;
    XLSX.utils.book_append_sheet(wb, ws3, "店舗別集計");

    // ── スタッフ別集計シート ────────────────────────────────
    const memberData = [
      ["スタッフ別集計", "", "", ""],
      [`対象期間：${periodLabel}　　出力日：${today}`, "", "", ""],
      [],
      ["氏名","合計件数","稼働日数","1日平均"],
      ...memberRanking.map(r=>[r.name, r.total, r.days, r.days>0?Math.round((r.total/r.days)*10)/10:0]),
      [],
      ["合計", memberRanking.reduce((s,r)=>s+r.total,0), "", ""],
    ];
    const ws4 = XLSX.utils.aoa_to_sheet(memberData);
    ws4["!cols"] = [{wch:14},{wch:10},{wch:10},{wch:10}];
    ws4["!merges"] = [{s:{r:0,c:0},e:{r:0,c:3}},{s:{r:1,c:0},e:{r:1,c:3}}];
    [3].forEach(r=>{ memberData[r].forEach((_,c)=>{ const ref=XLSX.utils.encode_cell({r,c}); if(ws4[ref]) ws4[ref].s=subHeaderStyle; }); });
    const mt0=XLSX.utils.encode_cell({r:0,c:0}); if(ws4[mt0]) ws4[mt0].s=titleStyle;
    XLSX.utils.book_append_sheet(wb, ws4, "スタッフ別集計");

    const period = periodMode==="month"
      ? `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,"0")}`
      : `${dateFrom}_${dateTo}`;
    XLSX.writeFile(wb, `販売実績レポート_${period}.xlsx`);
  };

  // XLSXライブラリを動的に読み込む（スタイル対応版）
  if(!(window as any).XLSX){
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
    document.head.appendChild(script);
  }

  const tabStyle=t=>({padding:"7px 14px",fontSize:12,borderRadius:8,border:"none",cursor:"pointer",fontFamily:"inherit",background:tab===t?C.purple[50]:"transparent",color:tab===t?C.purple[800]:C.gray[600],fontWeight:tab===t?500:400});
  return (
    <div>
      <Card>
        {/* 期間フィルター */}
        <div style={{display:"flex",gap:6,marginBottom:10}}>
          {[{id:"month",label:"今月"},{id:"range",label:"期間指定"}].map(m=>(
            <button key={m.id} onClick={()=>setPeriodMode(m.id)} style={{padding:"5px 12px",borderRadius:20,fontSize:12,fontFamily:"inherit",border:periodMode===m.id?`1.5px solid ${C.purple[400]}`:`0.5px solid ${C.gray[200]}`,background:periodMode===m.id?C.purple[50]:"#fff",color:periodMode===m.id?C.purple[800]:C.gray[600],cursor:"pointer"}}>{m.label}</button>
          ))}
        </div>
        {periodMode==="range"&&(
          <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:10}}>
            <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} style={{height:32,padding:"0 8px",border:`0.5px solid ${C.gray[200]}`,borderRadius:6,fontSize:12,fontFamily:"inherit"}}/>
            <span style={{fontSize:12,color:C.gray[400]}}>〜</span>
            <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} style={{height:32,padding:"0 8px",border:`0.5px solid ${C.gray[200]}`,borderRadius:6,fontSize:12,fontFamily:"inherit"}}/>
          </div>
        )}
        <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
          <input value={filterAgency} onChange={e=>setFilterAgency(e.target.value)} placeholder="代理店で絞り込み" style={{flex:1,minWidth:100,height:32,padding:"0 8px",border:`0.5px solid ${C.gray[200]}`,borderRadius:6,fontSize:12,color:C.gray[800],fontFamily:"inherit"}}/>
          <input value={filterStore} onChange={e=>setFilterStore(e.target.value)} placeholder="店舗で絞り込み" style={{flex:1,minWidth:100,height:32,padding:"0 8px",border:`0.5px solid ${C.gray[200]}`,borderRadius:6,fontSize:12,color:C.gray[800],fontFamily:"inherit"}}/>
          <select value={filterCarrier} onChange={e=>setFilterCarrier(e.target.value)} style={{height:32,padding:"0 8px",border:`0.5px solid ${C.gray[200]}`,borderRadius:6,fontSize:12,color:C.gray[800],fontFamily:"inherit"}}>
            <option value="all">全キャリア</option>
            {CARRIERS_SALES.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
          <select value={filterPerson} onChange={e=>setFilterPerson(e.target.value)} style={{height:32,padding:"0 8px",border:`0.5px solid ${C.gray[200]}`,borderRadius:6,fontSize:12,color:C.gray[800],fontFamily:"inherit"}}>
            <option value="all">全員</option>
            {personList.map(p=><option key={p.uid} value={p.uid}>{p.name}</option>)}
          </select>
          <button onClick={exportExcel} style={{height:32,padding:"0 12px",background:C.teal[400],color:"#fff",border:"none",borderRadius:6,fontSize:12,cursor:"pointer",fontFamily:"inherit",fontWeight:500,flexShrink:0}}>📥 Excel出力</button>
        </div>
      </Card>
      <div style={{display:"flex",gap:4,background:C.gray[50],borderRadius:10,padding:4,marginBottom:14,flexWrap:"wrap"}}>
        {[{id:"daily",label:"日別一覧"},{id:"carrier",label:"キャリア別"},{id:"agency",label:"代理店・店舗別"},{id:"ranking",label:"メンバー別"}].map(t=><button key={t.id} style={tabStyle(t.id)} onClick={()=>setTab(t.id)}>{t.label}</button>)}
      </div>
      {tab==="daily"&&(
        <Card>
          <CardTitle>日別一覧（今月）</CardTitle>
          <div style={{fontSize:11,color:C.gray[400],marginBottom:8}}>削除ボタンはその日の報告（全キャリア分）をまとめて削除します</div>
          {dailyRows.length===0?<div style={{textAlign:"center",padding:"20px",color:C.gray[400],fontSize:13}}>データがありません</div>:(
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                <thead><tr style={{borderBottom:`0.5px solid ${C.gray[100]}`}}>{["日付","氏名","代理店","店舗","キャリア","新規","機変","MNP転入","番号移行","ネット","CC","電気/G","計","周辺機器",""].map(h=><th key={h} style={{textAlign:"left",padding:"6px 8px",color:C.gray[400],fontWeight:400,whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead>
                <tbody>{dailyRows.map((r,i)=>{
                  const isFirstOfDay = i===0 || dailyRows[i-1].uid!==r.uid || dailyRows[i-1].date!==r.date;
                  const key = `${r.uid}_${r.date}`;
                  return(
                  <tr key={i} style={{borderBottom:`0.5px solid ${C.gray[50]}`}}>
                    <td style={{padding:"6px 8px",whiteSpace:"nowrap"}}>{r.date}</td>
                    <td style={{padding:"6px 8px",fontWeight:500,color:C.gray[800]}}>{r.name}</td>
                    <td style={{padding:"6px 8px",color:C.gray[600]}}>{r.agency||"-"}</td>
                    <td style={{padding:"6px 8px",color:C.gray[600]}}>{r.store||"-"}</td>
                    <td style={{padding:"6px 8px"}}><span style={{fontSize:10,padding:"1px 6px",borderRadius:10,background:CARRIER_COLORS_S[r.carrier]+"20",color:CARRIER_COLORS_S[r.carrier],fontWeight:500}}>{CARRIERS_SALES.find(c=>c.id===r.carrier)?.label}</span></td>
                    {["newContract","deviceChange","mnpIn","portIn","netLine","creditCard","energy"].map(k=><td key={k} style={{padding:"6px 8px",textAlign:"right",color:r[k]>0?C.gray[800]:C.gray[200]}}>{r[k]||0}</td>)}
                    <td style={{padding:"6px 8px",textAlign:"right",fontWeight:600,color:C.purple[800]}}>{salesTotal(r)}</td>
                    <td style={{padding:"6px 8px",textAlign:"right",color:r.peripheralTotal>0?C.gray[800]:C.gray[200]}}>{r.peripheralTotal?r.peripheralTotal.toLocaleString()+"円":"-"}</td>
                    <td style={{padding:"6px 8px"}}>
                      {isFirstOfDay&&<button onClick={()=>deleteReport(r.uid,r.date)} disabled={deleting===key} style={{border:`0.5px solid ${C.coral[400]}`,background:C.coral[50],color:C.coral[800],borderRadius:6,padding:"3px 8px",fontSize:10,cursor:deleting===key?"default":"pointer",fontFamily:"inherit"}}>{deleting===key?"削除中":"削除"}</button>}
                    </td>
                  </tr>
                  );
                })}</tbody>
              </table>
            </div>
          )}
        </Card>
      )}
      {tab==="carrier"&&(
        <div>
          <Card>
            <CardTitle>キャリア別集計（今月）</CardTitle>
            {carrierTotals.map(c=>(
              <div key={c.carrier} style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
                <div style={{width:80,fontSize:12,color:C.gray[800],fontWeight:500,flexShrink:0}}>{c.carrier}</div>
                <div style={{flex:1,height:8,background:C.gray[100],borderRadius:4}}><div style={{height:"100%",width:`${carrierTotals[0]?.total?(c.total/carrierTotals[0].total)*100:0}%`,background:c.color,borderRadius:4}}/></div>
                <div style={{fontSize:14,fontWeight:600,color:C.gray[800],minWidth:40,textAlign:"right"}}>{c.total}</div>
              </div>
            ))}
          </Card>
          <Card>
            <CardTitle>周辺機器売上（今月）</CardTitle>
            <div style={{fontSize:28,fontWeight:700,color:C.purple[800]}}>{peripheralMonthTotal.toLocaleString()}<span style={{fontSize:14,fontWeight:400,color:C.gray[400]}}>円</span></div>
          </Card>
        </div>
      )}
      {tab==="agency"&&(
        <Card>
          <CardTitle>代理店・店舗別集計（今月）</CardTitle>
          {agencyTotals.length===0?<div style={{textAlign:"center",padding:"20px",color:C.gray[400],fontSize:13}}>データがありません</div>:agencyTotals.map((a,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
              <div style={{flex:1,minWidth:0}}><div style={{fontSize:12,fontWeight:500,color:C.gray[800]}}>{a.agency}</div><div style={{fontSize:11,color:C.gray[400]}}>{a.store}</div></div>
              <div style={{flex:1,height:6,background:C.gray[100],borderRadius:3}}><div style={{height:"100%",width:`${agencyTotals[0]?.total?(a.total/agencyTotals[0].total)*100:0}%`,background:C.teal[400],borderRadius:3}}/></div>
              <div style={{fontSize:14,fontWeight:600,color:C.gray[800],minWidth:36,textAlign:"right"}}>{a.total}</div>
            </div>
          ))}
        </Card>
      )}
      {tab==="ranking"&&(
        <Card>
          <CardTitle>メンバー別ランキング（今月）</CardTitle>
          {memberRanking.map((r,i)=>(
            <div key={r.uid} style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
              <div style={{width:22,height:22,borderRadius:"50%",flexShrink:0,background:i===0?"#fbbf24":i===1?"#9ca3af":i===2?"#cd7c2f":C.gray[100],display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:600,color:i<3?"#fff":C.gray[600]}}>{i+1}</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:12,fontWeight:500,color:C.gray[800]}}>{r.name}</div>
                <div style={{height:5,background:C.gray[100],borderRadius:3,marginTop:3}}><div style={{height:"100%",width:`${(r.total/maxMember)*100}%`,background:C.purple[400],borderRadius:3}}/></div>
              </div>
              <div style={{textAlign:"right",flexShrink:0}}><div style={{fontSize:14,fontWeight:600,color:C.gray[800]}}>{r.total}件</div><div style={{fontSize:10,color:C.gray[400]}}>{r.days}日稼働</div></div>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
};

const SalesPage = ({currentUser, userProfile, isManager, allReports}) => {
  const [tab,setTab] = useState("input");
  const tabs = isManager
    ?[{id:"input",label:"日次入力"},{id:"mystats",label:"自分の実績"},{id:"dashboard",label:"管理ダッシュボード"}]
    :[{id:"input",label:"日次入力"},{id:"mystats",label:"自分の実績"}];
  const tabStyle = t=>({padding:"7px 16px",fontSize:13,borderRadius:8,border:"none",cursor:"pointer",fontFamily:"inherit",background:tab===t?C.purple[400]:"transparent",color:tab===t?"#fff":C.gray[600],fontWeight:tab===t?500:400});
  return (
    <div>
      <div style={{display:"flex",gap:4,background:C.gray[50],borderRadius:10,padding:4,marginBottom:16}}>
        {tabs.map(t=><button key={t.id} style={tabStyle(t.id)} onClick={()=>setTab(t.id)}>{t.label}</button>)}
      </div>
      {tab==="input"&&<SalesInputForm uid={currentUser.uid} displayName={userProfile?.name||currentUser.email}/>}
      {tab==="mystats"&&<SalesMemberStats uid={currentUser.uid} allReports={allReports}/>}
      {tab==="dashboard"&&isManager&&<SalesManagerDash allReports={allReports}/>}
    </div>
  );
};

const EmployeeView = ({currentUser,userProfile,onLogout,onSaveEval,periods,gradeDefs,allReports}) => {
  const [page,setPage] = useState("myeval");
  const [evalData,setEvalData] = useState({});
  const activePeriod = periods.find(p=>p.active)||periods[0];
  const criteria = GRADE_CRITERIA[userProfile?.grade]||[];
  const selfScores = evalData.selfScores||{};
  const totalSelf = calcScore(selfScores,userProfile?.grade);
  const selfRank = Object.keys(selfScores).length?calcRank(totalSelf):null;
  const managerScores = evalData.managerScores||{};
  const totalManager = calcScore(managerScores,userProfile?.grade);
  const managerRank = Object.keys(managerScores).length?calcRank(totalManager):null;

  useEffect(()=>{
    if(!currentUser?.uid||!userProfile?.id)return;
    const unsub = onSnapshot(doc(db,"evals",userProfile.id),snap=>{if(snap.exists())setEvalData(snap.data());});
    return unsub;
  },[currentUser?.uid,userProfile?.id]);

  const updateField = async(key,value)=>{ await setDoc(doc(db,"evals",userProfile.id),{[key]:value},{merge:true}); };
  const categoryGroups = criteria.reduce((acc,c)=>{if(!acc[c.category])acc[c.category]=[];acc[c.category].push(c);return acc;},{});

  const EMP_NAV = [
    {id:"myeval",label:"自己評価",shortLabel:"評価",icon:"edit"},
    {id:"myresult",label:"評価結果",shortLabel:"結果",icon:"grid"},
    {id:"sales",label:"販売実績",shortLabel:"実績",icon:"chart"},
    {id:"mytraining",label:"研修PDCA",shortLabel:"研修",icon:"training"},
    ...(userProfile?.buddyOf?.length>0?[{id:"buddytraining",label:"バディ入力",shortLabel:"バディ",icon:"users"}]:[]),
  ];
  const pageTitles = {myeval:"自己評価を入力",myresult:"評価結果",sales:"販売実績",mytraining:"研修PDCA",buddytraining:"バディ担当 研修PDCA"};

  return (
    <AppShell nav={EMP_NAV} page={page} setPage={setPage} currentUser={{...currentUser,displayName:userProfile?.name,role:"member",grade:userProfile?.grade}} activePeriod={activePeriod} onLogout={onLogout} pageTitle={pageTitles[page]}>
      {page==="sales"&&<SalesPage currentUser={currentUser} userProfile={userProfile} isManager={false} allReports={allReports}/>}
      {page==="myeval"&&(
        <div>
          <div style={{background:C.purple[50],border:`1px solid ${C.purple[200]}`,borderRadius:10,padding:"10px 14px",marginBottom:12,fontSize:12,color:C.purple[800]}}><strong>{userProfile?.grade}</strong> — {gradeDefs[userProfile?.grade]}</div>
          {selfRank&&<Card style={{borderLeft:`3px solid ${rankColor(selfRank)[400]}`}}><div style={{display:"flex",alignItems:"center",gap:16}}><div><div style={{fontSize:11,color:C.gray[400],marginBottom:2}}>自己評価 総合点</div><div style={{fontSize:24,fontWeight:700,color:C.gray[800]}}>{totalSelf}<span style={{fontSize:12,color:C.gray[400]}}>/100</span></div></div><div><div style={{fontSize:11,color:C.gray[400],marginBottom:4}}>ランク</div><RankBadge rank={selfRank} size="lg"/></div></div></Card>}
          {Object.entries(categoryGroups).map(([cat,items])=>{
            const cc=categoryColor(cat);
            return(<Card key={cat}><div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}><span style={{fontSize:11,padding:"2px 10px",borderRadius:12,background:cc[50],color:cc[800],fontWeight:500}}>{cat}</span></div>{items.map((c,i)=><div key={c.no} style={{marginBottom:i<items.length-1?14:0,paddingBottom:i<items.length-1?14:0,borderBottom:i<items.length-1?`0.5px solid ${C.gray[50]}`:"none"}}><div style={{display:"flex",alignItems:"start",justifyContent:"space-between",marginBottom:6,gap:8}}><div style={{flex:1}}><div style={{fontSize:11,color:C.gray[400],marginBottom:2}}>No.{c.no} · 配点{c.points}点</div><div style={{fontSize:13,color:C.gray[800],lineHeight:1.5}}>{c.item}</div></div><ScoreInput value={selfScores[c.no]||0} onChange={val=>updateField("selfScores",{...selfScores,[c.no]:val})} readonly={evalData.status==="done"}/></div><Textarea rows={2} value={evalData.selfComments?.[c.no]||""} onChange={v=>updateField("selfComments",{...(evalData.selfComments||{}),[c.no]:v})} placeholder="自己評価コメント・根拠を入力"/></div>)}</Card>);
          })}
          {evalData.status!=="done"&&<Btn primary onClick={()=>updateField("status","done")} style={{width:"100%",justifyContent:"center",marginTop:4}}>自己評価を提出する</Btn>}
          {evalData.status==="done"&&<div style={{textAlign:"center",padding:"10px",fontSize:13,color:C.green[400]}}>✓ 提出済みです</div>}
        </div>
      )}
      {page==="myresult"&&(
        <div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
            <MetricCard label="上司評価 総合点" value={managerRank?`${totalManager}点`:"-"} sub="/ 100点" accent={managerRank?rankColor(managerRank):null}/>
            <MetricCard label="自己評価 総合点" value={selfRank?`${totalSelf}点`:"-"} sub="/ 100点"/>
          </div>
          {managerRank&&<Card style={{borderLeft:`3px solid ${rankColor(managerRank)[400]}`}}><div style={{display:"flex",alignItems:"center",gap:12,marginBottom:12}}><div style={{fontSize:11,color:C.gray[400]}}>上司評価ランク</div><RankBadge rank={managerRank} size="lg"/></div><CardTitle>項目別スコア（上司評価）</CardTitle>{criteria.map(c=><div key={c.no} style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}><div style={{fontSize:12,color:C.gray[600],flex:1,lineHeight:1.4}}>{c.item}</div><div style={{flexShrink:0,display:"flex",alignItems:"center",gap:6}}><span style={{fontSize:13,fontWeight:500,color:C.gray[800]}}>{managerScores[c.no]||"-"}/5</span><span style={{fontSize:11,color:C.gray[400]}}>({Math.round((c.points*(managerScores[c.no]||0))/5)}点)</span></div></div>)}</Card>}
          {!managerRank&&<div style={{textAlign:"center",padding:"40px 20px",color:C.gray[400],fontSize:13,background:C.gray[50],borderRadius:12}}>まだ上司評価が入力されていません。</div>}
          {evalData.strengths&&<Card><CardTitle>強み</CardTitle><div style={{fontSize:13,color:C.gray[800],lineHeight:1.7}}>{evalData.strengths}</div></Card>}
          {evalData.improvements&&<Card><CardTitle>次期の改善課題</CardTitle><div style={{fontSize:13,color:C.gray[800],lineHeight:1.7}}>{evalData.improvements}</div></Card>}
          {evalData.promotion&&<Card><CardTitle>昇格推薦可否</CardTitle><div style={{fontSize:14,fontWeight:500,color:C.purple[800]}}>{evalData.promotion}</div></Card>}
        </div>
      )}
      {page==="mytraining"&&<EmployeeTrainingPage uid={currentUser.uid}/>}
      {page==="buddytraining"&&userProfile?.buddyOf?.map(memberId=><BuddyTrainingPage key={memberId} memberId={memberId}/>)}
    </AppShell>
  );
};

// ── バディ上司用 研修PDCA入力ページ ───────────────────────────
const BuddyTrainingPage = ({memberId}) => {
  const [memberName, setMemberName] = useState("");
  const [records, setRecords] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({title:"",startDate:new Date().toLocaleDateString("sv-SE"),endDate:"",plan:"",do_:"",check:"",act:"",status:"進行中"});
  const [saving, setSaving] = useState(false);
  const STATUSES = ["進行中","完了","中断"];

  useEffect(()=>{
    if(!memberId) return;
    getDoc(doc(db,"users",memberId)).then(snap=>{
      if(snap.exists()) setMemberName(snap.data().name||"");
    });
    const unsub = onSnapshot(collection(db,"trainingPDCA",memberId,"records"),snap=>{
      const recs = snap.docs.map(d=>({id:d.id,...d.data()}));
      recs.sort((a,b)=>(b.startDate||"").localeCompare(a.startDate||""));
      setRecords(recs);
    });
    return unsub;
  },[memberId]);

  const openNew = ()=>{setEditingId(null);setForm({title:"",startDate:new Date().toLocaleDateString("sv-SE"),endDate:"",plan:"",do_:"",check:"",act:"",status:"進行中"});setShowForm(true);};
  const openEdit = (r)=>{setEditingId(r.id);setForm({title:r.title||"",startDate:r.startDate||"",endDate:r.endDate||"",plan:r.plan||"",do_:r.do_||"",check:r.check||"",act:r.act||"",status:r.status||"進行中"});setShowForm(true);};

  const save = async()=>{
    if(!form.title.trim()||!form.plan.trim()){alert("研修名と計画（Plan）は必須です");return;}
    setSaving(true);
    const data={title:form.title,startDate:form.startDate,endDate:form.endDate,plan:form.plan,do_:form.do_,check:form.check,act:form.act,status:form.status,updatedAt:new Date()};
    if(editingId){await setDoc(doc(db,"trainingPDCA",memberId,"records",editingId),data,{merge:true});}
    else{await setDoc(doc(collection(db,"trainingPDCA",memberId,"records")),{...data,createdAt:new Date()});}
    setShowForm(false);setSaving(false);
  };

  const deleteRecord = async(id)=>{if(!window.confirm("この研修記録を削除しますか？"))return;await deleteDoc(doc(db,"trainingPDCA",memberId,"records",id));};
  const statusColor=(s)=>s==="完了"?C.teal:s==="中断"?C.coral:C.blue;

  return (
    <div style={{marginBottom:20}}>
      <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:12,flexWrap:"wrap"}}>
        <div style={{fontSize:14,fontWeight:600,color:C.gray[800]}}>👥 {memberName}さんの研修PDCA</div>
        <Btn primary small onClick={openNew}>+ 研修を追加</Btn>
      </div>
      {showForm&&<Modal title={editingId?"研修PDCAを編集":"研修PDCAを追加"} onClose={()=>setShowForm(false)}>
        <div style={{display:"flex",flexDirection:"column",gap:13}}>
          <div><div style={{fontSize:12,color:C.gray[400],marginBottom:4}}>研修名 *</div><input value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} placeholder="例：新人研修・OJT" style={{width:"100%",height:36,padding:"0 10px",border:`0.5px solid ${C.gray[200]}`,borderRadius:8,fontSize:14,color:C.gray[800],fontFamily:"inherit",boxSizing:"border-box"}}/></div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
            <div><div style={{fontSize:12,color:C.gray[400],marginBottom:4}}>開始日</div><input type="date" value={form.startDate} onChange={e=>setForm(f=>({...f,startDate:e.target.value}))} style={{width:"100%",height:36,padding:"0 8px",border:`0.5px solid ${C.gray[200]}`,borderRadius:8,fontSize:13,fontFamily:"inherit"}}/></div>
            <div><div style={{fontSize:12,color:C.gray[400],marginBottom:4}}>終了日</div><input type="date" value={form.endDate} onChange={e=>setForm(f=>({...f,endDate:e.target.value}))} style={{width:"100%",height:36,padding:"0 8px",border:`0.5px solid ${C.gray[200]}`,borderRadius:8,fontSize:13,fontFamily:"inherit"}}/></div>
            <div><div style={{fontSize:12,color:C.gray[400],marginBottom:4}}>ステータス</div><SelectEl value={form.status} onChange={v=>setForm(f=>({...f,status:v}))} options={STATUSES.map(s=>({value:s,label:s}))}/></div>
          </div>
          <div><div style={{fontSize:12,color:C.blue[800],fontWeight:600,marginBottom:4}}>📋 Plan（計画）*</div><Textarea value={form.plan} onChange={v=>setForm(f=>({...f,plan:v}))} rows={3} placeholder="例：docomo端末の提案力を高めるため、週2回のロープレを実施する。"/></div>
          <div><div style={{fontSize:12,color:C.teal[800],fontWeight:600,marginBottom:4}}>✅ Do（実行）</div><Textarea value={form.do_} onChange={v=>setForm(f=>({...f,do_:v}))} rows={3} placeholder="例：週2回のロープレを3週間実施。先輩からフィードバックをもらった。"/></div>
          <div><div style={{fontSize:12,color:C.amber[800],fontWeight:600,marginBottom:4}}>🔍 Check（評価）</div><Textarea value={form.check} onChange={v=>setForm(f=>({...f,check:v}))} rows={3} placeholder="例：新規2件・MNP1件を達成。光回線の提案が苦手であることが判明。"/></div>
          <div><div style={{fontSize:12,color:C.purple[600],fontWeight:600,marginBottom:4}}>🔄 Act（改善）</div><Textarea value={form.act} onChange={v=>setForm(f=>({...f,act:v}))} rows={3} placeholder="例：来月は光回線の提案に特化した練習を追加する。"/></div>
          <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}><Btn onClick={()=>setShowForm(false)}>キャンセル</Btn><Btn primary onClick={save} disabled={saving}>{saving?"保存中...":"保存"}</Btn></div>
        </div>
      </Modal>}
      {records.length===0?(
        <div style={{textAlign:"center",padding:"2rem 1rem",color:C.gray[400],fontSize:13,background:C.gray[50],borderRadius:12}}>まだ研修記録がありません。「+ 研修を追加」から追加してください。</div>
      ):(
        records.map(r=>(
          <Card key={r.id} style={{borderLeft:`3px solid ${statusColor(r.status)[400]}`}}>
            <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:10}}>
              <div>
                <div style={{fontSize:13,fontWeight:600,color:C.gray[800],marginBottom:3}}>{r.title}</div>
                <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                  <span style={{fontSize:11,padding:"2px 8px",borderRadius:12,background:statusColor(r.status)[50],color:statusColor(r.status)[800],fontWeight:600}}>{r.status}</span>
                  <span style={{fontSize:11,color:C.gray[400]}}>{r.startDate}{r.endDate?` 〜 ${r.endDate}`:""}</span>
                </div>
              </div>
              <div style={{display:"flex",gap:4}}>
                <button onClick={()=>openEdit(r)} style={{border:`0.5px solid ${C.gray[200]}`,background:"#fff",borderRadius:6,padding:"3px 8px",fontSize:11,cursor:"pointer",color:C.gray[600],fontFamily:"inherit"}}>編集</button>
                <button onClick={()=>deleteRecord(r.id)} style={{border:"none",background:"none",cursor:"pointer",color:C.gray[400],fontSize:14}}>×</button>
              </div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
              {[["📋 Plan",r.plan,C.blue],["✅ Do",r.do_,C.teal],["🔍 Check",r.check,C.amber],["🔄 Act",r.act,C.purple]].map(([label,val,color])=>(
                <div key={label} style={{background:color[50],borderRadius:6,padding:"8px 10px"}}>
                  <div style={{fontSize:10,fontWeight:600,color:color[800],marginBottom:3}}>{label}</div>
                  <div style={{fontSize:12,color:C.gray[800],lineHeight:1.5,whiteSpace:"pre-wrap"}}>{val||<span style={{color:C.gray[300]}}>未入力</span>}</div>
                </div>
              ))}
            </div>
            {r.employeeComment&&<div style={{marginTop:8,background:C.purple[50],borderRadius:6,padding:"8px 10px"}}><div style={{fontSize:10,fontWeight:600,color:C.purple[600],marginBottom:3}}>💬 本人コメント</div><div style={{fontSize:12,color:C.purple[900],lineHeight:1.5}}>{r.employeeComment}</div></div>}
          </Card>
        ))
      )}
    </div>
  );
};

// ── 社員向け研修PDCAページ（閲覧＋コメントのみ）──────────────
const EmployeeTrainingPage = ({uid}) => {
  const [records, setRecords] = useState([]);
  const [commentInputs, setCommentInputs] = useState({});
  const [savingComment, setSavingComment] = useState(null);

  useEffect(()=>{
    if(!uid) return;
    const unsub = onSnapshot(
      collection(db,"trainingPDCA",uid,"records"),
      snap=>{
        const recs = snap.docs.map(d=>({id:d.id,...d.data()}));
        recs.sort((a,b)=>(b.startDate||"").localeCompare(a.startDate||""));
        setRecords(recs);
      }
    );
    return unsub;
  },[uid]);

  const saveComment = async(recordId, comment)=>{
    setSavingComment(recordId);
    await setDoc(doc(db,"trainingPDCA",uid,"records",recordId),{employeeComment:comment},{merge:true});
    setSavingComment(null);
  };

  const statusColor = (s)=>s==="完了"?C.teal:s==="中断"?C.coral:C.blue;

  return (
    <div>
      {records.length===0?(
        <div style={{textAlign:"center",padding:"3rem 1rem",color:C.gray[400],fontSize:14,background:C.gray[50],borderRadius:12}}>
          まだ研修PDCAが登録されていません。<br/>上司からの入力をお待ちください。
        </div>
      ):(
        <div>
          <div style={{fontSize:12,color:C.gray[400],marginBottom:10}}>研修PDCA（{records.length}件）</div>
          {records.map(r=>(
            <Card key={r.id} style={{borderLeft:`3px solid ${statusColor(r.status)[400]}`}}>
              <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:12}}>
                <div>
                  <div style={{fontSize:14,fontWeight:600,color:C.gray[800],marginBottom:4}}>{r.title}</div>
                  <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
                    <span style={{fontSize:11,padding:"2px 10px",borderRadius:12,background:statusColor(r.status)[50],color:statusColor(r.status)[800],fontWeight:600}}>{r.status}</span>
                    <span style={{fontSize:11,color:C.gray[400]}}>{r.startDate}{r.endDate?` 〜 ${r.endDate}`:""}</span>
                  </div>
                </div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
                {[["📋 Plan（計画）",r.plan,C.blue],["✅ Do（実行）",r.do_,C.teal],["🔍 Check（評価）",r.check,C.amber],["🔄 Act（改善）",r.act,C.purple]].map(([label,val,color])=>(
                  <div key={label} style={{background:color[50],borderRadius:8,padding:"10px 12px"}}>
                    <div style={{fontSize:11,fontWeight:600,color:color[800],marginBottom:4}}>{label}</div>
                    <div style={{fontSize:12,color:C.gray[800],lineHeight:1.6,whiteSpace:"pre-wrap"}}>{val||<span style={{color:C.gray[300]}}>未入力</span>}</div>
                  </div>
                ))}
              </div>
              <div style={{borderTop:`0.5px solid ${C.gray[100]}`,paddingTop:10}}>
                <div style={{fontSize:12,color:C.purple[600],fontWeight:500,marginBottom:6}}>💬 自分のコメント</div>
                {r.employeeComment&&<div style={{fontSize:13,color:C.gray[800],lineHeight:1.6,background:C.purple[50],borderRadius:8,padding:"8px 12px",marginBottom:8,whiteSpace:"pre-wrap"}}>{r.employeeComment}</div>}
                <div style={{display:"flex",gap:8}}>
                  <textarea
                    value={commentInputs[r.id]||""}
                    onChange={e=>setCommentInputs(prev=>({...prev,[r.id]:e.target.value}))}
                    placeholder="感想・質問・気づきを入力してください"
                    rows={2}
                    style={{flex:1,padding:"8px 10px",fontSize:13,border:`0.5px solid ${C.gray[200]}`,borderRadius:8,fontFamily:"inherit",resize:"vertical",outline:"none"}}
                  />
                  <Btn primary small onClick={()=>saveComment(r.id, commentInputs[r.id]||"")} disabled={savingComment===r.id||!commentInputs[r.id]?.trim()}>
                    {savingComment===r.id?"保存中":"送信"}
                  </Btn>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

// ── 研修PDCAページ ─────────────────────────────────────────────
const TrainingPDCAPage = ({users}) => {
  const [selectedUid, setSelectedUid] = useState(users[0]?.id||"");
  const [records, setRecords] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    title:"", startDate:new Date().toLocaleDateString("sv-SE"), endDate:"",
    plan:"", do_:"", check:"", act:"", status:"進行中"
  });
  const [saving, setSaving] = useState(false);
  const [sendingFeedback, setSendingFeedback] = useState(null);
  const [feedbackResult, setFeedbackResult] = useState(null);

  useEffect(()=>{
    if(!selectedUid) return;
    const unsub = onSnapshot(
      collection(db,"trainingPDCA",selectedUid,"records"),
      snap=>{
        const recs = snap.docs.map(d=>({id:d.id,...d.data()}));
        recs.sort((a,b)=>b.startDate?.localeCompare(a.startDate));
        setRecords(recs);
      }
    );
    return unsub;
  },[selectedUid]);

  const openNew = ()=>{
    setEditingId(null);
    setForm({title:"",startDate:new Date().toLocaleDateString("sv-SE"),endDate:"",plan:"",do_:"",check:"",act:"",status:"進行中"});
    setShowForm(true);
  };

  const openEdit = (r)=>{
    setEditingId(r.id);
    setForm({title:r.title||"",startDate:r.startDate||"",endDate:r.endDate||"",plan:r.plan||"",do_:r.do_||"",check:r.check||"",act:r.act||"",status:r.status||"進行中"});
    setShowForm(true);
  };

  const save = async()=>{
    if(!form.title.trim()||!form.plan.trim()){alert("研修名と計画（Plan）は必須です");return;}
    setSaving(true);
    const data = {title:form.title,startDate:form.startDate,endDate:form.endDate,plan:form.plan,do_:form.do_,check:form.check,act:form.act,status:form.status,updatedAt:new Date()};
    if(editingId){
      await setDoc(doc(db,"trainingPDCA",selectedUid,"records",editingId),data,{merge:true});
    } else {
      await setDoc(doc(collection(db,"trainingPDCA",selectedUid,"records")),{...data,createdAt:new Date()});
    }
    setShowForm(false);setSaving(false);
  };

  const deleteRecord = async(id)=>{
    if(!window.confirm("この研修記録を削除しますか？"))return;
    await deleteDoc(doc(db,"trainingPDCA",selectedUid,"records",id));
  };

  const sendAIFeedback = async(r)=>{
    setSendingFeedback(r.id);
    setFeedbackResult(null);
    try {
      const selectedUser = users.find(u=>u.id===selectedUid);

      const buddyPrompt = `以下の研修PDCAを分析し、バディ上司への指導用フィードバックを200字以内で作成してください。
メンバー名：${selectedUser?.name||""}　研修名：${r.title}　ステータス：${r.status}
Plan:${r.plan||"未入力"} / Do:${r.do_||"未入力"} / Check:${r.check||"未入力"} / Act:${r.act||"未入力"}
・メンバーの良かった点（1〜2点）・改善が必要な点と指導ポイント（1〜2点）・次回確認すべき点（1点）
客観的でプロフェッショナルなトーンで。`;

      const memberPrompt = `以下の研修PDCAを分析し、メンバー本人への励ましフィードバックを200字以内で作成してください。
研修名：${r.title}　ステータス：${r.status}
Plan:${r.plan||"未入力"} / Do:${r.do_||"未入力"} / Check:${r.check||"未入力"} / Act:${r.act||"未入力"}
・頑張れた点を褒める（1〜2点）・自分でできる改善アドバイス（1〜2点）・次のステップへの応援（1点）
親しみやすく前向きなトーンで。`;

      const [buddyAiRes, memberAiRes] = await Promise.all([
        fetch("/api/analyze",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({prompt:buddyPrompt})}),
        fetch("/api/analyze",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({prompt:memberPrompt})}),
      ]);
      const [buddyAI, memberAI] = await Promise.all([buddyAiRes.json(), memberAiRes.json()]);
      if(!buddyAI.result||!memberAI.result) throw new Error("AI分析失敗");

      const buddyMessage = `【研修PDCAフィードバック（指導用）】\n${selectedUser?.name||""}さん / ${r.title}\n\n${buddyAI.result}`;
      const memberMessage = `【研修PDCAフィードバック】\n${r.title}\n\n${memberAI.result}`;

      const buddyUid = selectedUser?.buddyUid;
      if(!buddyUid){setFeedbackResult({error:`${selectedUser?.name}さんにはバディ上司が設定されていません。`});return;}

      const buddyDocData = (await getDoc(doc(db,"users",buddyUid))).data();
      const [buddyLineSnap, memberLineSnap] = await Promise.all([
        import("firebase/firestore").then(({getDocs,query,where})=>getDocs(query(collection(db,"lineUsers"),where("uid","==",buddyUid)))),
        import("firebase/firestore").then(({getDocs,query,where})=>getDocs(query(collection(db,"lineUsers"),where("uid","==",selectedUid)))),
      ]);

      if(buddyLineSnap.empty){setFeedbackResult({error:`バディ上司（${buddyDocData?.name}）がLINEと連携していません。`});return;}

      await fetch("/api/send-line",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({lineUserIds:[buddyLineSnap.docs[0].id],message:buddyMessage})});
      if(!memberLineSnap.empty){
        await fetch("/api/send-line",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({lineUserIds:[memberLineSnap.docs[0].id],message:memberMessage})});
      }

      const memberSent = !memberLineSnap.empty ? "＋本人（別内容）" : "（本人はLINE未連携）";
      setFeedbackResult({success:`${buddyDocData?.name}さん${memberSent}にフィードバックを送信しました！`});
    } catch(e) {
      setFeedbackResult({error:"エラーが発生しました。"});
    } finally {
      setSendingFeedback(null);
    }
  };

  const selectedUser = users.find(u=>u.id===selectedUid);
  const statusColor = (s)=>s==="完了"?C.teal:s==="中断"?C.coral:C.blue;
  const STATUSES = ["進行中","完了","中断"];

  const PDCASection = ({label, value, color, placeholder}) => (
    <div style={{background:color[50],borderRadius:8,padding:"10px 12px"}}>
      <div style={{fontSize:11,fontWeight:600,color:color[800],marginBottom:4}}>{label}</div>
      <div style={{fontSize:13,color:C.gray[800],lineHeight:1.7,whiteSpace:"pre-wrap"}}>{value||<span style={{color:C.gray[300]}}>未入力</span>}</div>
    </div>
  );

  return (
    <div>
      <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:16,flexWrap:"wrap"}}>
        <SelectEl value={selectedUid} onChange={setSelectedUid} options={users.map(u=>({value:u.id,label:`${u.name}（${u.grade}）`}))} style={{flex:1,minWidth:140}}/>
        <Btn primary onClick={openNew}>+ 研修を追加</Btn>
      </div>

      {showForm&&<Modal title={editingId?"研修PDCAを編集":"研修PDCAを追加"} onClose={()=>setShowForm(false)}>
        <div style={{display:"flex",flexDirection:"column",gap:13}}>
          <div>
            <div style={{fontSize:12,color:C.gray[400],marginBottom:4}}>研修名 *</div>
            <input value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} placeholder="例：新人研修・OJT・製品トレーニング"
              style={{width:"100%",height:36,padding:"0 10px",border:`0.5px solid ${C.gray[200]}`,borderRadius:8,fontSize:14,color:C.gray[800],fontFamily:"inherit",boxSizing:"border-box"}}/>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
            <div>
              <div style={{fontSize:12,color:C.gray[400],marginBottom:4}}>開始日</div>
              <input type="date" value={form.startDate} onChange={e=>setForm(f=>({...f,startDate:e.target.value}))}
                style={{width:"100%",height:36,padding:"0 8px",border:`0.5px solid ${C.gray[200]}`,borderRadius:8,fontSize:13,fontFamily:"inherit"}}/>
            </div>
            <div>
              <div style={{fontSize:12,color:C.gray[400],marginBottom:4}}>終了日</div>
              <input type="date" value={form.endDate} onChange={e=>setForm(f=>({...f,endDate:e.target.value}))}
                style={{width:"100%",height:36,padding:"0 8px",border:`0.5px solid ${C.gray[200]}`,borderRadius:8,fontSize:13,fontFamily:"inherit"}}/>
            </div>
            <div>
              <div style={{fontSize:12,color:C.gray[400],marginBottom:4}}>ステータス</div>
              <SelectEl value={form.status} onChange={v=>setForm(f=>({...f,status:v}))} options={STATUSES.map(s=>({value:s,label:s}))}/>
            </div>
          </div>
          <div>
            <div style={{fontSize:12,color:C.blue[600],fontWeight:600,marginBottom:4}}>📋 Plan（計画）*</div>
            <Textarea value={form.plan} onChange={v=>setForm(f=>({...f,plan:v}))} rows={3} placeholder="例：docomo端末の提案力を高めるため、週2回のロープレを実施する。月末までに新規3件・MNP2件を目標とする。"/>
          </div>
          <div>
            <div style={{fontSize:12,color:C.teal[600],fontWeight:600,marginBottom:4}}>✅ Do（実行）</div>
            <Textarea value={form.do_} onChange={v=>setForm(f=>({...f,do_:v}))} rows={3} placeholder="例：週2回のロープレを3週間実施。先輩から料金プランの説明方法についてフィードバックをもらい、クロージングトークを改善した。"/>
          </div>
          <div>
            <div style={{fontSize:12,color:C.amber[700],fontWeight:600,marginBottom:4}}>🔍 Check（評価）</div>
            <Textarea value={form.check} onChange={v=>setForm(f=>({...f,check:v}))} rows={3} placeholder="例：新規2件・MNP1件を達成。目標には届かなかったが、光回線の提案が苦手であることが判明。お客様への料金説明は自信がついてきた。"/>
          </div>
          <div>
            <div style={{fontSize:12,color:C.purple[600],fontWeight:600,marginBottom:4}}>🔄 Act（改善）</div>
            <Textarea value={form.act} onChange={v=>setForm(f=>({...f,act:v}))} rows={3} placeholder="例：来月は光回線の提案に特化した練習を追加する。先輩の光回線商談に同席させてもらい、成功トークを学ぶ。"/>
          </div>
          <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
            <Btn onClick={()=>setShowForm(false)}>キャンセル</Btn>
            <Btn primary onClick={save} disabled={saving}>{saving?"保存中...":"保存"}</Btn>
          </div>
        </div>
      </Modal>}

      {records.length===0?(
        <div style={{textAlign:"center",padding:"3rem 1rem",color:C.gray[400],fontSize:14,background:C.gray[50],borderRadius:12}}>
          {selectedUser?.name}さんの研修記録はまだありません。<br/>「+ 研修を追加」から追加してください。
        </div>
      ):(
        <div>
          <div style={{fontSize:12,color:C.gray[400],marginBottom:10}}>{selectedUser?.name}さんの研修PDCA（{records.length}件）</div>
          {records.map(r=>(
            <Card key={r.id} style={{borderLeft:`3px solid ${statusColor(r.status)[400]}`}}>
              <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:12}}>
                <div>
                  <div style={{fontSize:14,fontWeight:600,color:C.gray[800],marginBottom:4}}>{r.title}</div>
                  <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
                    <span style={{fontSize:11,padding:"2px 10px",borderRadius:12,background:statusColor(r.status)[50],color:statusColor(r.status)[800],fontWeight:600}}>{r.status}</span>
                    <span style={{fontSize:11,color:C.gray[400]}}>{r.startDate}{r.endDate?` 〜 ${r.endDate}`:""}</span>
                  </div>
                </div>
                <div style={{display:"flex",gap:6}}>
                  <button onClick={()=>openEdit(r)} style={{border:`0.5px solid ${C.gray[200]}`,background:"#fff",borderRadius:6,padding:"4px 10px",fontSize:11,cursor:"pointer",color:C.gray[600],fontFamily:"inherit"}}>編集</button>
                  <button onClick={()=>deleteRecord(r.id)} style={{border:"none",background:"none",cursor:"pointer",color:C.gray[400],fontSize:16}}>×</button>
                </div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                <PDCASection label="📋 Plan（計画）" value={r.plan} color={C.blue} placeholder=""/>
                <PDCASection label="✅ Do（実行）" value={r.do_} color={C.teal} placeholder=""/>
                <PDCASection label="🔍 Check（評価）" value={r.check} color={C.amber} placeholder=""/>
                <PDCASection label="🔄 Act（改善）" value={r.act} color={C.purple} placeholder=""/>
              </div>
              <div style={{marginTop:10,display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
                <Btn small primary onClick={()=>sendAIFeedback(r)} disabled={sendingFeedback===r.id}>
                  {sendingFeedback===r.id?"AI分析中...":"✦ AIフィードバックをLINEで送る"}
                </Btn>
                {feedbackResult&&sendingFeedback===null&&(
                  <span style={{fontSize:12,color:feedbackResult.error?C.coral[800]:C.teal[800]}}>
                    {feedbackResult.error||feedbackResult.success}
                  </span>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
// ── 面談記録ページ ─────────────────────────────────────────────
const InterviewPage = ({users}) => {
  const [selectedUid, setSelectedUid] = useState(users[0]?.id||"");
  const [records, setRecords] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({date:new Date().toLocaleDateString("sv-SE"),content:"",score:"",nextAction:""});
  const [saving, setSaving] = useState(false);
  const isMobile = useIsMobile();

  useEffect(()=>{
    if(!selectedUid) return;
    const unsub = onSnapshot(
      collection(db,"interviews",selectedUid,"records"),
      snap=>{
        const recs = snap.docs.map(d=>({id:d.id,...d.data()}));
        recs.sort((a,b)=>b.date.localeCompare(a.date));
        setRecords(recs);
      }
    );
    return unsub;
  },[selectedUid]);

  const save = async()=>{
    if(!form.content.trim()){alert("内容を入力してください");return;}
    setSaving(true);
    await setDoc(doc(collection(db,"interviews",selectedUid,"records")),{
      date:form.date,
      content:form.content,
      score:form.score,
      nextAction:form.nextAction,
      createdAt:new Date(),
    });
    setForm({date:new Date().toLocaleDateString("sv-SE"),content:"",score:"",nextAction:""});
    setShowForm(false);
    setSaving(false);
  };

  const deleteRecord = async(id)=>{
    if(!window.confirm("この面談記録を削除しますか？"))return;
    await deleteDoc(doc(db,"interviews",selectedUid,"records",id));
  };

  const selectedUser = users.find(u=>u.id===selectedUid);
  const scoreColor = (s)=>{
    const n=parseInt(s);
    if(n>=4) return C.teal;
    if(n>=3) return C.blue;
    if(n>=2) return C.amber;
    return C.coral;
  };

  return (
    <div>
      {/* メンバー選択 */}
      <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:16,flexWrap:"wrap"}}>
        <SelectEl value={selectedUid} onChange={setSelectedUid} options={users.map(u=>({value:u.id,label:`${u.name}（${u.grade}）`}))} style={{flex:1,minWidth:140}}/>
        <Btn primary onClick={()=>setShowForm(true)}>+ 面談を記録</Btn>
      </div>

      {/* 入力フォーム（モーダル） */}
      {showForm&&<Modal title="面談記録を追加" onClose={()=>setShowForm(false)}>
        <div style={{display:"flex",flexDirection:"column",gap:13}}>
          <div>
            <div style={{fontSize:12,color:C.gray[400],marginBottom:4}}>日付</div>
            <input type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))}
              style={{width:"100%",height:36,padding:"0 10px",border:`0.5px solid ${C.gray[200]}`,borderRadius:8,fontSize:14,color:C.gray[800],fontFamily:"inherit"}}/>
          </div>
          <div>
            <div style={{fontSize:12,color:C.gray[400],marginBottom:4}}>面談内容</div>
            <Textarea value={form.content} onChange={v=>setForm(f=>({...f,content:v}))} rows={4} placeholder="面談の内容・気になった点・現状などを記録"/>
          </div>
          <div>
            <div style={{fontSize:12,color:C.gray[400],marginBottom:4}}>スコア（1〜5）</div>
            <div style={{display:"flex",gap:6}}>
              {[1,2,3,4,5].map(n=>(
                <button key={n} onClick={()=>setForm(f=>({...f,score:String(n)}))}
                  style={{width:40,height:40,borderRadius:8,border:"none",cursor:"pointer",fontFamily:"inherit",fontSize:14,fontWeight:600,
                  background:form.score===String(n)?C.purple[400]:C.gray[100],
                  color:form.score===String(n)?"#fff":C.gray[400]}}>{n}</button>
              ))}
            </div>
          </div>
          <div>
            <div style={{fontSize:12,color:C.gray[400],marginBottom:4}}>ネクストアクション</div>
            <Textarea value={form.nextAction} onChange={v=>setForm(f=>({...f,nextAction:v}))} rows={2} placeholder="次回までにやること・フォローアップ内容"/>
          </div>
          <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
            <Btn onClick={()=>setShowForm(false)}>キャンセル</Btn>
            <Btn primary onClick={save} disabled={saving}>{saving?"保存中...":"保存"}</Btn>
          </div>
        </div>
      </Modal>}

      {/* 面談記録一覧 */}
      {records.length===0?(
        <div style={{textAlign:"center",padding:"3rem 1rem",color:C.gray[400],fontSize:14,background:C.gray[50],borderRadius:12}}>
          {selectedUser?.name}さんの面談記録はまだありません。<br/>「+ 面談を記録」から追加してください。
        </div>
      ):(
        <div>
          <div style={{fontSize:12,color:C.gray[400],marginBottom:10}}>{selectedUser?.name}さんの面談記録（{records.length}件）</div>
          {records.map(r=>(
            <Card key={r.id} style={{borderLeft:`3px solid ${r.score?scoreColor(r.score)[400]:C.gray[200]}`}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <span style={{fontSize:13,fontWeight:500,color:C.gray[800]}}>{r.date}</span>
                  {r.score&&(
                    <span style={{fontSize:12,padding:"2px 10px",borderRadius:12,background:scoreColor(r.score)[50],color:scoreColor(r.score)[800],fontWeight:600}}>
                      スコア {r.score}
                    </span>
                  )}
                </div>
                <button onClick={()=>deleteRecord(r.id)} style={{border:"none",background:"none",cursor:"pointer",color:C.gray[400],fontSize:16}}>×</button>
              </div>
              <div style={{fontSize:13,color:C.gray[800],lineHeight:1.7,marginBottom:r.nextAction?10:0,whiteSpace:"pre-wrap"}}>{r.content}</div>
              {r.nextAction&&(
                <div style={{background:C.purple[50],borderRadius:8,padding:"8px 12px",marginTop:8}}>
                  <div style={{fontSize:11,color:C.purple[600],fontWeight:500,marginBottom:3}}>ネクストアクション</div>
                  <div style={{fontSize:13,color:C.purple[900],lineHeight:1.6,whiteSpace:"pre-wrap"}}>{r.nextAction}</div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

// ── LINE送信ページ ─────────────────────────────────────────────
const LineSendPage = () => {
  const [lineUsers, setLineUsers] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);
  const [sendMode, setSendMode] = useState("all"); // "all" | "select"

  const TEMPLATES = [
    {label:"挨拶・使い方説明", text:"お疲れ様です！\nこのLINEボットで日次の件数報告ができます。\n\n📱報告フォーマット：\n「〇〇店でdocomo新規3件 MNP1件」\nのように送ってください。\n\nご不明な点があればお知らせください。"},
    {label:"フォーマット案内", text:"【件数報告フォーマット】\n\n店舗名＋キャリア＋項目＋件数\n\n例①：〇〇店でdocomo新規3件 MNP1件\n例②：〇〇店でワイモバイル 機変2件 クレカ1件\n\nキャリア：docomo/ahamo/au/SoftBank/ワイモバイル/UQ\n項目：新規/機変/MNP転入/番号移行/ネット/クレカ/電気・ガス"},
    {label:"目標入力リマインド", text:"お疲れ様です！\n本日の目標をまだ入力していない方は入力をお願いします。\n\n例：目標 新規10件 MNP5件"},
    {label:"月末集計のお知らせ", text:"今月も残りわずかです！\n報告漏れがないか確認をお願いします。\n\n「今日の実績を見る」ボタンで本日の報告内容を確認できます。"},
  ];

  useEffect(()=>{
    const unsub = onSnapshot(collection(db,"lineUsers"),snap=>{
      setLineUsers(snap.docs.map(d=>({lineUserId:d.id,...d.data()})));
    });
    return unsub;
  },[]);

  const toggleSelect = (id)=>{
    setSelectedIds(prev=>prev.includes(id)?prev.filter(x=>x!==id):[...prev,id]);
  };

  const send = async()=>{
    if(!message.trim()){alert("メッセージを入力してください");return;}
    const targets = sendMode==="all" ? lineUsers.map(u=>u.lineUserId) : selectedIds;
    if(targets.length===0){alert("送信先を選択してください");return;}
    if(!window.confirm(`${targets.length}名にLINEを送信します。よろしいですか？`))return;
    setSending(true);setResult(null);
    try{
      const res = await fetch("/api/send-line",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({lineUserIds:targets,message}),
      });
      const data = await res.json();
      setResult(data);
    }catch{
      setResult({error:"通信エラーが発生しました。"});
    }finally{
      setSending(false);
    }
  };

  return (
    <div>
      <Card>
        <CardTitle>送信先</CardTitle>
        <div style={{display:"flex",gap:6,marginBottom:12}}>
          {[{id:"all",label:`全員（${lineUsers.length}名）`},{id:"select",label:"個別選択"}].map(m=>(
            <button key={m.id} onClick={()=>setSendMode(m.id)} style={{padding:"6px 14px",borderRadius:20,fontSize:12,fontFamily:"inherit",border:sendMode===m.id?`1.5px solid ${C.purple[400]}`:`0.5px solid ${C.gray[200]}`,background:sendMode===m.id?C.purple[50]:"#fff",color:sendMode===m.id?C.purple[800]:C.gray[600],cursor:"pointer"}}>{m.label}</button>
          ))}
        </div>
        {sendMode==="select"&&(
          <div style={{display:"flex",flexDirection:"column",gap:6,maxHeight:200,overflowY:"auto"}}>
            {lineUsers.length===0?<div style={{fontSize:13,color:C.gray[400]}}>LINE連携済みのユーザーがいません</div>:
            lineUsers.map(u=>(
              <label key={u.lineUserId} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 10px",background:selectedIds.includes(u.lineUserId)?C.purple[50]:C.gray[50],borderRadius:8,cursor:"pointer"}}>
                <input type="checkbox" checked={selectedIds.includes(u.lineUserId)} onChange={()=>toggleSelect(u.lineUserId)} style={{accentColor:C.purple[400]}}/>
                <span style={{fontSize:13,color:C.gray[800]}}>{u.displayName||"未設定"}</span>
                {u.isGuest&&<span style={{fontSize:10,padding:"1px 6px",borderRadius:10,background:C.amber[50],color:C.amber[800]}}>業務委託</span>}
              </label>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <CardTitle>テンプレート</CardTitle>
        <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:0}}>
          {TEMPLATES.map(t=>(
            <button key={t.label} onClick={()=>setMessage(t.text)} style={{padding:"6px 12px",borderRadius:8,fontSize:12,fontFamily:"inherit",border:`0.5px solid ${C.gray[200]}`,background:"#fff",color:C.gray[600],cursor:"pointer"}}>{t.label}</button>
          ))}
        </div>
      </Card>

      <Card>
        <CardTitle>メッセージ</CardTitle>
        <Textarea value={message} onChange={setMessage} rows={6} placeholder="送信するメッセージを入力してください"/>
        <div style={{display:"flex",justifyContent:"flex-end",marginTop:10}}>
          <Btn primary onClick={send} disabled={sending||!message.trim()}>
            {sending?"送信中...":`✉️ ${sendMode==="all"?`全員（${lineUsers.length}名）`:`選択した${selectedIds.length}名`}に送信`}
          </Btn>
        </div>
      </Card>

      {result&&(
        <div style={{background:result.error?C.coral[50]:C.green[50],border:`0.5px solid ${result.error?C.coral[200]:C.green[400]}`,borderRadius:12,padding:"14px 16px",fontSize:13,color:result.error?C.coral[800]:C.green[800]}}>
          {result.error?`エラー：${result.error}`:`✓ ${result.successCount}/${result.total}名に送信しました`}
        </div>
      )}
    </div>
  );
};

const MANAGER_NAV = [
  {id:"dashboard",label:"ダッシュボード",shortLabel:"ホーム",icon:"home"},
  {id:"evaluation",label:"評価フォーム",shortLabel:"評価",icon:"edit"},
  {id:"results",label:"結果・集計",shortLabel:"集計",icon:"grid"},
  {id:"ai",label:"AI分析",shortLabel:"AI",icon:"spark"},
  {id:"sales",label:"販売実績",shortLabel:"実績",icon:"chart"},
  {id:"interview",label:"面談記録",shortLabel:"面談",icon:"interview"},
  {id:"training",label:"研修PDCA",shortLabel:"研修",icon:"training"},
  {id:"linesend",label:"LINE送信",shortLabel:"LINE",icon:"linesend"},
  {id:"users",label:"メンバー管理",shortLabel:"管理",icon:"users"},
  {id:"settings",label:"設定",shortLabel:"設定",icon:"settings"},
];

export default function App() {
  const [authUser,setAuthUser] = useState(null);
  const [userProfile,setUserProfile] = useState(null);
  const [loading,setLoading] = useState(true);
  const [page,setPage] = useState("dashboard");
  const [users,setUsers] = useState([]);
  const [evals,setEvals] = useState({});
  const [allReports,setAllReports] = useState([]);
  const [settings,setSettings] = useState({departments:DEPARTMENTS_DEFAULT,gradeDefs:GRADE_DEFS_DEFAULT,periods:PERIODS_DEFAULT});
  const [selectedUserId,setSelectedUserId] = useState(null);

  useEffect(()=>{
    const unsub = onAuthStateChanged(auth, async user => {
      if(user){
        setAuthUser(user);
        const snap = await getDoc(doc(db,"users",user.uid));
        if(snap.exists()){
          const data = snap.data();
          if(data.status==="pending"){
            await signOut(auth);
            alert("承認待ちです。管理者の承認をお待ちください。");
          } else {
            setUserProfile({id:user.uid,...data});
          }
        }
      } else {
        setAuthUser(null);
        setUserProfile(null);
      }
      setLoading(false);
    });
    return unsub;
  },[]);

  useEffect(()=>{
    if(!authUser)return;
    const unsub = onSnapshot(doc(db,"settings","config"),snap=>{
      if(snap.exists()) setSettings(prev=>({...prev,...snap.data()}));
    });
    return unsub;
  },[authUser]);

  useEffect(()=>{
    if(!userProfile)return;
    const unsub = onSnapshot(collectionGroup(db,"daily"),snap=>{
      setAllReports(snap.docs.map(d=>({id:d.id,...d.data()})));
    });
    return unsub;
  },[userProfile]);

  useEffect(()=>{
    if(!userProfile||userProfile.role!=="manager")return;
    const unsub = onSnapshot(collection(db,"users"),snap=>{
      const u=snap.docs.map(d=>({id:d.id,...d.data()})).filter(u=>u.email!=="info.mooa01@gmail.com");
      setUsers(u);
      if(u.length&&!selectedUserId) setSelectedUserId(u[0].id);
    });
    return unsub;
  },[userProfile]);

  useEffect(()=>{
    if(!userProfile||userProfile.role!=="manager")return;
    const unsub = onSnapshot(collection(db,"evals"),snap=>{
      const e={};snap.docs.forEach(d=>{e[d.id]=d.data();});
      setEvals(e);
    });
    return unsub;
  },[userProfile]);

  const handleLogout = ()=>signOut(auth);
  const onSaveEval = async(userId,data)=>{ await setDoc(doc(db,"evals",userId),data,{merge:true}); };
  const onSaveSettings = async(data)=>{ await setDoc(doc(db,"settings","config"),data,{merge:true}); };
  const onAddUser = async(form)=>{ const newId="user_"+Date.now(); await setDoc(doc(db,"users",newId),{name:form.name,email:form.email,dept:form.dept,grade:form.grade,role:"member",tempPassword:form.password,needsSetup:true}); };
  const onUpdateUser = async(id,data)=>{ await updateDoc(doc(db,"users",id),data); };
  const onDeleteUser = async(id)=>{ await deleteDoc(doc(db,"users",id)); };

  const activePeriod = (settings.periods||PERIODS_DEFAULT).find(p=>p.active)||(settings.periods||PERIODS_DEFAULT)[0];
  const pageTitles = {dashboard:"ダッシュボード",evaluation:"評価フォーム",results:"結果・集計",ai:"AI分析",sales:"販売実績",interview:"面談記録",training:"研修PDCA",linesend:"LINE送信",users:"メンバー管理",settings:"設定"};

  if(loading) return <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"system-ui",color:C.gray[400],fontSize:14}}>読み込み中...</div>;
  if(!authUser) return <LoginPage onLogin={()=>{}}/>;
  if(userProfile?.role==="member") return <EmployeeView currentUser={authUser} userProfile={userProfile} onLogout={handleLogout} onSaveEval={onSaveEval} periods={settings.periods||PERIODS_DEFAULT} gradeDefs={settings.gradeDefs||GRADE_DEFS_DEFAULT} allReports={allReports}/>;

  return (
    <AppShell nav={MANAGER_NAV} page={page} setPage={setPage} currentUser={{...authUser,displayName:userProfile?.name||authUser.email,role:"manager"}} activePeriod={activePeriod} onLogout={handleLogout} pageTitle={pageTitles[page]}>
      {page==="dashboard"&&<Dashboard users={users} evals={evals} onNavigate={setPage} onSelectUser={setSelectedUserId}/>}
      {page==="evaluation"&&<EvaluationPage users={users} evals={evals} onSaveEval={onSaveEval} selectedUserId={selectedUserId} setSelectedUserId={setSelectedUserId} gradeDefs={settings.gradeDefs||GRADE_DEFS_DEFAULT}/>}
      {page==="results"&&<ResultsPage users={users} evals={evals}/>}
      {page==="ai"&&<AIPage users={users} evals={evals} gradeDefs={settings.gradeDefs||GRADE_DEFS_DEFAULT}/>}
      {page==="sales"&&<SalesPage currentUser={authUser} userProfile={userProfile} isManager={true} allReports={allReports}/>}
      {page==="interview"&&<InterviewPage users={users}/>}
      {page==="training"&&<TrainingPDCAPage users={users}/>}
      {page==="linesend"&&<LineSendPage/>}
      {page==="users"&&<UserManagePage users={users} onAddUser={onAddUser} onUpdateUser={onUpdateUser} onDeleteUser={onDeleteUser} departments={settings.departments||DEPARTMENTS_DEFAULT}/>}
      {page==="settings"&&<SettingsPage currentUser={authUser} departments={settings.departments||DEPARTMENTS_DEFAULT} setDepartments={d=>setSettings(s=>({...s,departments:d}))} gradeDefs={settings.gradeDefs||GRADE_DEFS_DEFAULT} setGradeDefs={g=>setSettings(s=>({...s,gradeDefs:g}))} periods={settings.periods||PERIODS_DEFAULT} setPeriods={p=>setSettings(s=>({...s,periods:p}))} onSaveSettings={onSaveSettings}/>}
    </AppShell>
  );
}
