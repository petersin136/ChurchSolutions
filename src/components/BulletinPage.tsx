"use client";

import { useState, useEffect, useCallback, useRef, Fragment, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { LayoutDashboard, Pencil, FolderOpen, Settings, Newspaper, Printer, FileDown, Eye, Save, Archive, Edit3, type LucideIcon } from "lucide-react";
import { UnifiedPageLayout } from "@/components/layout/UnifiedPageLayout";
import { Pagination } from "@/components/common/Pagination";
import KakaoShareCard from "@/components/bulletin/KakaoShareCard";
import { initKakao, shareTextToKakao } from "@/lib/kakao";
import { downloadElementAsImage } from "@/utils/captureElement";
import { supabase } from "@/lib/supabase";
import { loadBulletinFromSupabase, saveBulletinToSupabase } from "@/lib/supabase-db";
import { getChurchId } from "@/lib/tenant";

function useIsMobile(bp = 768) {
  const [m, setM] = useState(false);
  useEffect(() => {
    const c = () => setM(window.innerWidth <= bp);
    c();
    window.addEventListener("resize", c);
    return () => window.removeEventListener("resize", c);
  }, [bp]);
  return m;
}

const C = {
  navy: "#1a1f36", navyLight: "#252b48", navyHover: "#2d3460",
  bg: "#f9fafb", card: "#fff", border: "#e5e7eb", borderLight: "#f3f4f6",
  text: "#1f2937", textMuted: "#6b7280", textFaint: "#9ca3af",
  blue: "#3b82f6", blueBg: "#dbeafe", blueDark: "#1d4ed8",
  accent: "#3b82f6", accentLight: "#dbeafe", accentBg: "#dbeafe",
  purple: "#8b5cf6", purpleBg: "#ede9fe", green: "#10b981", greenBg: "#d1fae5",
  yellow: "#f59e0b", yellowBg: "#fef3c7", red: "#ef4444", redBg: "#fee2e2",
  orange: "#f97316", orangeBg: "#ffedd5", pink: "#ec4899", pinkBg: "#fce7f3",
  teal: "#14b8a6", tealBg: "#ccfbf1", indigo: "#6366f1", indigoBg: "#e0e7ff",
};

const TODAY = new Date();
const DAYS = ["일", "월", "화", "수", "목", "금", "토"];
function getSunday() {
  const d = new Date(TODAY);
  d.setDate(d.getDate() - d.getDay());
  return d;
}
function getNextSunday() {
  const d = getSunday();
  d.setDate(d.getDate() + 7);
  return d;
}
function fd(d: Date) {
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
}
function fds(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function extractYoutubeId(url: string): string | null {
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/))([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : null;
}

const nextSun = getNextSunday();
const BULLETIN_DATE_STR = fd(nextSun);
const BULLETIN_KEY = fds(nextSun);

/* ---------- Types ---------- */
interface BulletinSettings {
  church: string;
  churchSub: string;
  pastor: string;
  worshipTime: string;
  address: string;
  phone: string;
  account: string;
  deadline: string;
  pastorTitle?: string;
  associate?: string;
  staffList?: string;
}

interface PastorSection {
  sermonTitle: string;
  sermonPassage: string;
  sermonTheme: string;
  column: string;
  pastorNotice: string;
  submitted: boolean;
  submittedAt: string;
}
interface WorshipSection {
  worshipOrder: string;
  praise: string;
  special: string;
  submitted: boolean;
  submittedAt: string;
}
interface GeneralSection {
  content: string;
  birthday: string;
  servants: string;
  offering: string;
  schedule: string;
  submitted: boolean;
  submittedAt: string;
}

interface DepartmentsSection {
  enabled: string[];
  data: Record<string, string>;
}

interface CurrentBulletin {
  key: string;
  date: string;
  template: string;
  coverDecor?: string;
  coverImage?: string;
  coverImageOpacity?: number;
  youtubeUrl?: string;
  pastor: PastorSection;
  worship: WorshipSection;
  general: GeneralSection;
  departments: DepartmentsSection;
  savedAt?: string;
  sermonTitle?: string;
}

interface BulletinDB {
  settings: BulletinSettings;
  current: CurrentBulletin;
  history: CurrentBulletin[];
}

type SectionKey = "cover" | "worship" | "sermon" | "churchNews" | "departments" | "info";

const DEPARTMENTS: { key: string; name: string }[] = [
  { key: "jangnyeon", name: "장년부" },
  { key: "yeojeondoboe", name: "여전도회" },
  { key: "namjeondoboe", name: "남전도회" },
  { key: "cheongnyeon", name: "청년부" },
  { key: "junggo", name: "중고등부" },
  { key: "chodeung", name: "초등부 (주일학교)" },
  { key: "yuchi", name: "유치부" },
  { key: "youngah", name: "영아부" },
  { key: "sungga", name: "성가대" },
  { key: "seonkyo", name: "선교부" },
  { key: "gyoyuk", name: "교육부" },
  { key: "bongsa", name: "봉사부" },
  { key: "gita", name: "기타" },
];

const SECTIONS: Record<SectionKey, { name: string; desc: string }> = {
  cover: { name: "① 표지", desc: "표지 면에 표시됩니다" },
  worship: { name: "② 예배 순서", desc: "예배 순서 면에 표시됩니다" },
  sermon: { name: "③ 말씀 / 칼럼", desc: "말씀/칼럼 면에 표시됩니다" },
  churchNews: { name: "④ 교회 소식", desc: "교회 전체 소식, 봉사자, 헌금, 일정, 생일" },
  departments: { name: "⑤ 부서별 소식", desc: "부서를 선택하면 입력란이 표시됩니다" },
  info: { name: "⑥ 교회 안내", desc: "교회 안내 면에 표시됩니다" },
};

function getSectionSubmitted(db: BulletinDB, key: SectionKey): boolean {
  switch (key) {
    case "cover":
    case "sermon":
      return !!db.current.pastor?.submitted;
    case "worship":
      return !!db.current.worship?.submitted;
    case "churchNews":
      return !!db.current.general?.submitted;
    case "departments":
    case "info":
      return false;
    default:
      return false;
  }
}

type OutputMode = "print" | "online";
type PrintFormat = "fold2" | "fold3";

const TEMPLATES = [
  {
    id: "natural-botanical", name: "보태니컬", desc: "자연의 따뜻함이 느껴지는 디자인",
    headerBg: "#ffffff", headerTextColor: "#2d3b2d", accent: "#4a6741", accentLight: "#ecf2e8",
    gold: "#8b7355", bodyBg: "#ffffff", sectionBg: "#f8faf6", borderColor: "#d4ddd0",
    decorStyle: "botanical" as const, coverLayout: "center" as const,
  },
  {
    id: "classic-gold", name: "클래식 골드", desc: "격조 있는 전통 디자인",
    headerBg: "#fffdf7", headerTextColor: "#3d2e1a", accent: "#7a6841", accentLight: "#f5f0e4",
    gold: "#b8973a", bodyBg: "#fffef9", sectionBg: "#faf7f0", borderColor: "#e0d5be",
    decorStyle: "gold-line" as const, coverLayout: "center" as const,
  },
  {
    id: "modern-minimal", name: "모던 미니멀", desc: "깔끔한 여백의 미학",
    headerBg: "#ffffff", headerTextColor: "#1a1a1a", accent: "#333333", accentLight: "#f0f0f0",
    gold: "#999999", bodyBg: "#ffffff", sectionBg: "#fafafa", borderColor: "#e5e5e5",
    decorStyle: "minimal" as const, coverLayout: "center" as const,
  },
  {
    id: "soft-watercolor", name: "소프트 수채화", desc: "은은한 수채화 느낌의 디자인",
    headerBg: "#fdfcfa", headerTextColor: "#4a5c3e", accent: "#6b8f5e", accentLight: "#f0f5ed",
    gold: "#a89470", bodyBg: "#fefefe", sectionBg: "#f7f9f5", borderColor: "#dde5d8",
    decorStyle: "watercolor" as const, coverLayout: "center" as const,
  },
  {
    id: "warm-earth", name: "따뜻한 어스톤", desc: "편안한 흙빛 톤의 디자인",
    headerBg: "#faf8f5", headerTextColor: "#4a3728", accent: "#8b6e4e", accentLight: "#f3ede6",
    gold: "#a68b5b", bodyBg: "#fffdf9", sectionBg: "#f8f5f0", borderColor: "#ddd5c9",
    decorStyle: "earth" as const, coverLayout: "center" as const,
  },
  {
    id: "fresh-modern", name: "프레시 모던", desc: "산뜻한 현대적 디자인",
    headerBg: "#f8fcff", headerTextColor: "#1a3a4a", accent: "#2a7d8f", accentLight: "#e6f3f7",
    gold: "#5a9aaa", bodyBg: "#ffffff", sectionBg: "#f5fafb", borderColor: "#cfe3e8",
    decorStyle: "fresh" as const, coverLayout: "center" as const,
  },
] as const;
type Tpl = (typeof TEMPLATES)[number];
type DecorStyle = Tpl["decorStyle"];
type CoverLayout = Tpl["coverLayout"];

const DECOR_OPTIONS = [
  { id: "none", name: "없음", desc: "장식 없이 깔끔하게", category: "general" as const },
  { id: "botanical", name: "보태니컬", desc: "나뭇잎 라인", category: "general" as const },
  { id: "gold-line", name: "골드 라인", desc: "우아한 테두리", category: "general" as const },
  { id: "minimal", name: "미니멀", desc: "코너 라인", category: "general" as const },
  { id: "watercolor", name: "수채화", desc: "수채화 터치", category: "general" as const },
  { id: "earth", name: "어스톤", desc: "자연 곡선", category: "general" as const },
  { id: "fresh", name: "프레시", desc: "모던 원형", category: "general" as const },
  { id: "vine", name: "덩굴", desc: "우아한 덩굴 장식", category: "general" as const },
  { id: "wheat", name: "밀이삭", desc: "추수감사 느낌", category: "general" as const },
  { id: "dove", name: "비둘기", desc: "평화의 상징", category: "general" as const },
  { id: "wave", name: "물결", desc: "은은한 파도", category: "general" as const },
  { id: "corner-floral", name: "코너 플로럴", desc: "꽃 코너 장식", category: "general" as const },
  { id: "diamond", name: "다이아몬드", desc: "기하학 패턴", category: "general" as const },
  { id: "olive-branch", name: "올리브 가지", desc: "평화의 올리브", category: "general" as const },
  { id: "light-rays", name: "빛줄기", desc: "은은한 빛 표현", category: "general" as const },
  { id: "frame-classic", name: "클래식 프레임", desc: "전통 액자 테두리", category: "general" as const },
  { id: "dots", name: "도트", desc: "점 패턴 장식", category: "general" as const },
  { id: "cross-pattern", name: "십자 패턴", desc: "반복 십자 장식", category: "general" as const },
  { id: "ribbon", name: "리본", desc: "우아한 리본", category: "general" as const },
  { id: "stained-glass", name: "스테인드글라스", desc: "교회 창문 느낌", category: "general" as const },
  { id: "advent", name: "대림절", desc: "강림의 소망", category: "season" as const },
  { id: "christmas", name: "성탄절", desc: "기쁜 성탄", category: "season" as const },
  { id: "lent", name: "사순절", desc: "고난과 회개", category: "season" as const },
  { id: "easter", name: "부활절", desc: "부활의 기쁨", category: "season" as const },
  { id: "pentecost", name: "성령강림절", desc: "성령의 불", category: "season" as const },
  { id: "thanksgiving", name: "추수감사절", desc: "감사의 계절", category: "season" as const },
  { id: "harvest", name: "맥추감사절", desc: "첫열매 감사", category: "season" as const },
  { id: "newyear", name: "송구영신", desc: "새해 은혜", category: "season" as const },
  { id: "children", name: "어린이주일", desc: "사랑의 어린이", category: "season" as const },
  { id: "parents", name: "어버이주일", desc: "부모님 감사", category: "season" as const },
  { id: "teachers", name: "스승의주일", desc: "은사에 감사", category: "season" as const },
  { id: "creation", name: "환경주일", desc: "창조세계 보전", category: "season" as const },
  { id: "bible", name: "성서주일", desc: "말씀의 능력", category: "season" as const },
  { id: "mission", name: "세계선교주일", desc: "열방을 향해", category: "season" as const },
  { id: "reformation", name: "종교개혁주일", desc: "오직 믿음", category: "season" as const },
  { id: "anniversary", name: "교회기념주일", desc: "교회 설립 감사", category: "season" as const },
] as const;
type DecorOptionId = (typeof DECOR_OPTIONS)[number]["id"];

function defaultDB(): BulletinDB {
  return {
    settings: {
      church: "",
      churchSub: "",
      pastor: "",
      worshipTime: "",
      address: "",
      phone: "",
      account: "",
      deadline: "목요일",
      pastorTitle: "담임목사",
      associate: "",
      staffList: "",
    },
    current: {
      key: BULLETIN_KEY,
      date: BULLETIN_DATE_STR,
      template: "natural-botanical",
      coverDecor: "botanical",
      coverImage: "",
      coverImageOpacity: 0.3,
      youtubeUrl: "",
      pastor: {
        sermonTitle: "산상수훈의 참된 복",
        sermonPassage: "마태복음 5:1-12",
        sermonTheme: "예수님이 말씀하시는 참된 복의 의미",
        column: "사랑하는 성도 여러분,\n\n이번 주 말씀은 산상수훈의 첫 부분인 팔복에 관한 말씀입니다. 예수님께서는 산 위에서 제자들과 무리들에게 복 있는 자가 누구인지 선포하셨습니다.\n\n세상이 말하는 복과 하나님이 말씀하시는 복은 다릅니다. 세상은 부유하고 건강하며 성공한 자가 복 있다 하지만, 예수님은 심령이 가난한 자, 애통하는 자, 의에 주리고 목마른 자가 복이 있다고 하셨습니다.\n\n이번 한 주간도 말씀 안에서 참된 복을 누리시길 기도합니다.",
        pastorNotice: "다음 주일(2/22)은 사순절 첫째 주일입니다. 특별 새벽기도회가 시작됩니다.",
        submitted: true,
        submittedAt: fds(TODAY),
      },
      worship: {
        worshipOrder: "묵도\n찬송 ………… 23장\n기도 ………… 박철수 장로\n성경봉독 ………… 마태복음 5:1-12\n찬양 ………… 찬양팀\n설교 ………… 담임목사\n봉헌 ………… 찬송 50장\n축도",
        praise: "주 하나님 지으신 모든 세계, 은혜 아니면",
        special: "특송 - 최은정 권사",
        submitted: true,
        submittedAt: fds(TODAY),
      },
      departments: {
        enabled: ["cheongnyeon", "chodeung", "seonkyo"],
        data: {
          cheongnyeon: "▸ 청년 예배: 주일 오후 2시 (청년부실)\n▸ 수요 성경공부: 수요일 저녁 7시 30분\n▸ 2월 MT: 2/28-3/1 양평 수련원\n▸ 새가족환영회: 3/1(주일) 예배 후",
          chodeung: "▸ 주일학교: 오전 9시 30분 (유초등부/중고등부)\n▸ 교사 기도회: 주일 오전 9시\n▸ 겨울 성경학교: 2/21-22 (토-주일)\n▸ 부활절 특별 프로그램 준비위원 모집",
          seonkyo: "▸ 필리핀 단기선교: 3/15-22 (신청마감 2/28)\n▸ 선교 기도편지: 김OO 선교사 (태국)\n▸ 다문화 한국어 교실: 매주 토 오전 10시\n▸ 지역사회 봉사: 매월 셋째 토요일",
        },
      },
      general: {
        content: "▸ 당회 결정: 주차장 확장 공사 (3월 중)\n▸ 새가족 소개: 이정훈/김미선 가정\n▸ 교회 창립 30주년 기념 준비위원 모집\n▸ 주중 새벽기도회: 월-토 오전 5시 30분",
        birthday: "김영수 장로(2/15), 이미경 집사(2/17), 박지현 권사(2/19), 최동현 집사(2/20)",
        servants: "안내: 김철수, 이영희\n주차: 박준호, 정민수\n음향: 최진우\n영상: 한소영\n꽃꽂이: 임윤정 권사",
        offering: "십일조 8,520,000원\n감사헌금 2,150,000원\n건축헌금 1,200,000원\n선교헌금 850,000원\n합계 12,720,000원",
        schedule: "월-토: 새벽기도 05:30\n화: 구역예배 (각 구역)\n수: 수요예배 19:30\n금: 금요기도회 20:00\n토: 청소년부 모임 14:00",
        submitted: true,
        submittedAt: fds(TODAY),
      },
    },
    history: [],
  };
}

/** 초기화 후 또는 저장 없을 때 — 본문/내용 비움 */
function defaultEmptyDB(): BulletinDB {
  return {
    settings: {
      church: "",
      churchSub: "",
      pastor: "",
      worshipTime: "",
      address: "",
      phone: "",
      account: "",
      deadline: "",
      pastorTitle: "담임목사",
      associate: "",
      staffList: "",
    },
    current: {
      key: BULLETIN_KEY,
      date: BULLETIN_DATE_STR,
      template: "natural-botanical",
      coverDecor: "botanical",
      coverImage: "",
      coverImageOpacity: 0.3,
      youtubeUrl: "",
      pastor: { sermonTitle: "", sermonPassage: "", sermonTheme: "", column: "", pastorNotice: "", submitted: false, submittedAt: "" },
      worship: { worshipOrder: "", praise: "", special: "", submitted: false, submittedAt: "" },
      departments: { enabled: [], data: {} },
      general: { content: "", birthday: "", servants: "", offering: "", schedule: "", submitted: false, submittedAt: "" },
    },
    history: [],
  };
}

const BULLETIN_STORAGE_KEY = "bulletin_db";
function loadBulletin(): BulletinDB {
  if (typeof window === "undefined") return defaultEmptyDB();
  const s = localStorage.getItem(BULLETIN_STORAGE_KEY);
  const db = s ? JSON.parse(s) : defaultEmptyDB();
  const defCurrent = defaultEmptyDB().current;
  if (!db.current) {
    db.current = defCurrent;
  } else {
    db.current = { ...defCurrent, ...db.current };
    const cur = db.current as Record<string, unknown>;
    if (!cur.departments || !Array.isArray((cur.departments as { enabled: string[] }).enabled)) {
      cur.departments = { enabled: [], data: {} };
    }
    const dept = cur.departments as { enabled: string[]; data: Record<string, string> };
    if (!cur.youth && !cur.education && !cur.mission) {
      // already migrated or new
    } else {
      if (cur.youth && (cur.youth as { content?: string }).content) {
        if (!dept.enabled.includes("cheongnyeon")) dept.enabled.push("cheongnyeon");
        dept.data = dept.data || {};
        dept.data.cheongnyeon = (cur.youth as { content: string }).content;
      }
      if (cur.education && (cur.education as { content?: string }).content) {
        if (!dept.enabled.includes("gyoyuk")) dept.enabled.push("gyoyuk");
        dept.data = dept.data || {};
        dept.data.gyoyuk = (cur.education as { content: string }).content;
      }
      if (cur.mission && (cur.mission as { content?: string }).content) {
        if (!dept.enabled.includes("seonkyo")) dept.enabled.push("seonkyo");
        dept.data = dept.data || {};
        dept.data.seonkyo = (cur.mission as { content: string }).content;
      }
    }
    delete cur.youth;
    delete cur.education;
    delete cur.mission;
  }
  if (!Array.isArray(db.history)) db.history = [];
  if (db.current.coverImage === undefined) db.current.coverImage = defCurrent.coverImage ?? "";
  if (db.current.coverImageOpacity === undefined) db.current.coverImageOpacity = defCurrent.coverImageOpacity ?? 0.3;
  return db;
}
function saveBulletin(db: BulletinDB) {
  if (typeof window !== "undefined") localStorage.setItem(BULLETIN_STORAGE_KEY, JSON.stringify(db));
}

/* ---------- UI ---------- */
function Card({ children, style, id }: { children: ReactNode; style?: CSSProperties; id?: string }) {
  return <div id={id} style={{ background: C.card, borderRadius: 16, border: `1px solid ${C.border}`, overflow: "hidden", marginBottom: 16, ...style }}>{children}</div>;
}

function Btn({ children, variant = "primary", size = "md", onClick, style }: { children?: ReactNode; variant?: "primary" | "secondary" | "ghost" | "danger" | "accent"; size?: "sm" | "md"; onClick?: () => void; style?: CSSProperties }) {
  const base: CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", transition: "all 0.2s", whiteSpace: "nowrap" };
  const sizes: Record<string, CSSProperties> = { sm: { padding: "6px 12px", fontSize: 12 }, md: { padding: "8px 16px", fontSize: 13 } };
  const variants: Record<string, CSSProperties> = {
    primary: { background: C.accent, color: "#fff" },
    secondary: { background: C.borderLight, color: C.text, border: `1px solid ${C.border}` },
    ghost: { background: "transparent", color: C.textMuted },
    danger: { background: C.red, color: "#fff" },
    accent: { background: C.orange, color: "#fff" },
  };
  return <button onClick={onClick} style={{ ...base, ...sizes[size], ...variants[variant], ...style }}>{children}</button>;
}

function FormField({ label, children, labelStyle }: { label: string; children: ReactNode; labelStyle?: CSSProperties }) {
  return <div style={{ marginBottom: 14 }}><label style={{ display: "block", fontSize: 12, fontWeight: 600, color: C.text, marginBottom: 4, ...labelStyle }}>{label}</label>{children}</div>;
}

function FInput({ value, onChange, placeholder, type = "text", style, maxLength }: { value: string; onChange: (v: string) => void; placeholder?: string; type?: string; style?: CSSProperties; maxLength?: number }) {
  return <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} type={type} maxLength={maxLength} style={{ width: "100%", padding: "9px 12px", border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 13, fontFamily: "inherit", background: C.bg, outline: "none", ...style }} />;
}

function FTextarea({ value, onChange, placeholder, style, maxLength }: { value: string; onChange: (v: string) => void; placeholder?: string; style?: CSSProperties; maxLength?: number }) {
  return <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} maxLength={maxLength} style={{ width: "100%", padding: "9px 12px", border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 13, fontFamily: "inherit", background: C.bg, outline: "none", resize: "vertical", minHeight: 70, ...style }} />;
}

function FSelect({ value, onChange, children, style }: { value: string; onChange: (v: string) => void; children: ReactNode; style?: CSSProperties }) {
  return <select value={value} onChange={e => onChange(e.target.value)} style={{ width: "100%", padding: "9px 12px", border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 13, fontFamily: "inherit", background: C.bg, outline: "none", cursor: "pointer", ...style }}>{children}</select>;
}

/* ── 주보용 인라인 SVG 아이콘 (Lucide 스타일) ── */
const bulletinIcon = (path: string, color: string, size = 15) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:5px;flex-shrink:0;">${path}</svg>`;

const BI = {
  worship: (c: string) => bulletinIcon(
    '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
    c
  ),
  sermon: (c: string) => bulletinIcon(
    '<path d="M12 20h9"/><path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838.838-2.872a2 2 0 0 1 .506-.855z"/>',
    c
  ),
  news: (c: string) => bulletinIcon(
    '<path d="m3 11 18-5v12L3 13v-2z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>',
    c
  ),
  church: (c: string) => bulletinIcon(
    '<path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/><path d="M12 9v4"/><path d="M10 11h4"/><path d="m2 22 4-11h12l4 11"/><path d="M10 22v-4h4v4"/>',
    c, 14
  ),
  wallet: (c: string) => bulletinIcon(
    '<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 1 0 0V7"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>',
    c, 13
  ),
  mapPin: (c: string) => bulletinIcon(
    '<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>',
    c, 13
  ),
  phone: (c: string) => bulletinIcon(
    '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92"/>',
    c, 13
  ),
  music: (c: string) => bulletinIcon(
    '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
    c, 13
  ),
  mic: (c: string) => bulletinIcon(
    '<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/>',
    c, 13
  ),
  gift: (c: string) => bulletinIcon(
    '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13"/><path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7"/><path d="M7.5 8a2.5 2.5 0 0 1 0-5A4.8 8 0 0 1 12 8a4.8 8 0 0 1 4.5-5 2.5 2.5 0 0 1 0 5"/>',
    c, 13
  ),
  users: (c: string) => bulletinIcon(
    '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    c, 13
  ),
  calendar: (c: string) => bulletinIcon(
    '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>',
    c, 13
  ),
  offering: (c: string) => bulletinIcon(
    '<circle cx="8" cy="8" r="6"/><path d="M18.09 10.37A6 6 0 1 1 10.34 18"/><path d="M7 6h1v4"/><path d="m16.71 13.88.7.71-2.82 2.82"/>',
    c, 13
  ),
  weekly: (c: string) => bulletinIcon(
    '<rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/>',
    c, 14
  ),
  cross: (c: string) => `<div style="position:relative;width:28px;height:36px;margin:0 auto 12px;opacity:0.7;"><div style="position:absolute;left:50%;top:0;transform:translateX(-50%);width:1.5px;height:100%;background:${c};"></div><div style="position:absolute;top:28%;left:0;width:100%;height:1.5px;background:${c};"></div></div>`,
};

const resizeCoverImage = (file: File, maxW = 800, maxH = 600, quality = 0.7): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let w = img.width, h = img.height;
        if (w > maxW) { h = h * maxW / w; w = maxW; }
        if (h > maxH) { w = w * maxH / h; h = maxH; }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

const simpleHash = (str: string): string => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
};

const COVER_BUCKET = "bulletin-covers";

const resizeCoverImageAsBlob = (
  file: File, maxW = 800, maxH = 600, quality = 0.75
): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        let w = img.width, h = img.height;
        if (w > maxW) { h = h * maxW / w; w = maxW; }
        if (h > maxH) { w = w * maxH / h; h = maxH; }
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
        canvas.toBlob(
          blob => blob ? resolve(blob) : reject(new Error("blob failed")),
          "image/jpeg",
          quality
        );
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

const deleteCoverImage = async (churchId: string) => {
  if (!supabase) throw new Error("Supabase not configured");
  const { data: files, error } = await supabase.storage
    .from(COVER_BUCKET)
    .list(churchId);
  console.log("[deleteCoverImage] list result:", churchId, files, error);
  if (files && files.length > 0) {
    const paths = files.map(f => `${churchId}/${f.name}`);
    console.log("[deleteCoverImage] removing:", paths);
    const { error: rmError } = await supabase.storage
      .from(COVER_BUCKET)
      .remove(paths);
    console.log("[deleteCoverImage] remove result:", rmError);
  }
};

const uploadCoverImage = async (file: File, churchId: string): Promise<string> => {
  if (!supabase) throw new Error("Supabase not configured");
  const resized = await resizeCoverImageAsBlob(file, 800, 600, 0.75);
  console.log("[uploadCoverImage] before deleteCoverImage, churchId:", churchId);
  await deleteCoverImage(churchId);
  console.log("[uploadCoverImage] after deleteCoverImage");
  const fileName = `${churchId}/cover_${Date.now()}.jpg`;
  const { error } = await supabase.storage
    .from(COVER_BUCKET)
    .upload(fileName, resized, {
      contentType: "image/jpeg",
      upsert: true
    });
  if (error) throw error;
  const { data } = supabase.storage
    .from(COVER_BUCKET)
    .getPublicUrl(fileName);
  return data.publicUrl;
};

/* ── 테마별 표지 장식 SVG ── */
const getDecorSVG = (style: string, color: string, gold: string): { topRight: string; bottomLeft: string; topLeft?: string; bottomRight?: string } => {
  const o = "0.4";
  switch (style) {
    case "botanical":
      return {
        topRight: `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120" style="position:absolute;top:0;right:0;opacity:${o};"><path d="M120 0 C90 10, 60 40, 50 80 C45 60, 55 35, 80 20 C60 30, 40 50, 35 80 C30 55, 45 30, 70 10 C55 15, 35 35, 25 65" fill="none" stroke="${color}" stroke-width="1"/><path d="M95 0 C85 15, 75 25, 60 35 M110 0 C95 20, 80 35, 65 45 M120 15 C105 30, 90 40, 75 48" fill="none" stroke="${color}" stroke-width="0.8"/></svg>`,
        bottomLeft: `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100" style="position:absolute;bottom:0;left:0;opacity:${o};transform:rotate(180deg);"><path d="M100 0 C70 15, 50 40, 45 75 C40 55, 50 30, 75 15 C55 25, 35 45, 30 70" fill="none" stroke="${color}" stroke-width="1"/></svg>`,
      };
    case "gold-line":
      return {
        topRight: `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80" style="position:absolute;top:12px;right:12px;opacity:0.6;"><rect x="0" y="0" width="80" height="80" rx="0" fill="none" stroke="${gold}" stroke-width="0.8"/><rect x="4" y="4" width="72" height="72" rx="0" fill="none" stroke="${gold}" stroke-width="0.5"/></svg>`,
        bottomLeft: `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80" style="position:absolute;bottom:12px;left:12px;opacity:0.6;"><rect x="0" y="0" width="80" height="80" rx="0" fill="none" stroke="${gold}" stroke-width="0.8"/><rect x="4" y="4" width="72" height="72" rx="0" fill="none" stroke="${gold}" stroke-width="0.5"/></svg>`,
        topLeft: `<div style="position:absolute;top:10px;left:10px;right:10px;bottom:10px;border:0.5px solid ${gold};opacity:0.5;pointer-events:none;"></div>`,
      };
    case "minimal":
      return {
        topRight: `<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 60 60" style="position:absolute;top:16px;right:16px;opacity:0.5;"><line x1="60" y1="0" x2="60" y2="60" stroke="${color}" stroke-width="1"/><line x1="0" y1="0" x2="60" y2="0" stroke="${color}" stroke-width="1"/></svg>`,
        bottomLeft: `<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 60 60" style="position:absolute;bottom:16px;left:16px;opacity:0.5;"><line x1="0" y1="0" x2="0" y2="60" stroke="${color}" stroke-width="1"/><line x1="0" y1="60" x2="60" y2="60" stroke="${color}" stroke-width="1"/></svg>`,
      };
    case "watercolor":
      return {
        topRight: `<svg xmlns="http://www.w3.org/2000/svg" width="140" height="140" viewBox="0 0 140 140" style="position:absolute;top:-10px;right:-10px;opacity:0.25;"><circle cx="100" cy="40" r="60" fill="${color}"/><circle cx="120" cy="20" r="40" fill="${gold}"/><circle cx="80" cy="60" r="35" fill="${color}"/></svg>`,
        bottomLeft: `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120" style="position:absolute;bottom:-10px;left:-10px;opacity:0.25;"><circle cx="30" cy="90" r="50" fill="${color}"/><circle cx="10" cy="110" r="35" fill="${gold}"/></svg>`,
      };
    case "earth":
      return {
        topRight: `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100" style="position:absolute;top:0;right:0;opacity:0.35;"><path d="M100 0 Q60 5, 40 40 Q35 55, 38 70" fill="none" stroke="${color}" stroke-width="1.5"/><path d="M100 0 Q70 10, 55 35 Q50 45, 52 60" fill="none" stroke="${gold}" stroke-width="1"/><circle cx="38" cy="72" r="2" fill="${color}"/><circle cx="52" cy="62" r="1.5" fill="${gold}"/></svg>`,
        bottomLeft: `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80" style="position:absolute;bottom:0;left:0;opacity:0.35;"><path d="M0 80 Q30 75, 45 50 Q50 40, 48 25" fill="none" stroke="${color}" stroke-width="1.5"/><circle cx="48" cy="23" r="2" fill="${color}"/></svg>`,
      };
    case "fresh":
      return {
        topRight: `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100" style="position:absolute;top:0;right:0;opacity:0.3;"><circle cx="85" cy="15" r="30" fill="none" stroke="${color}" stroke-width="1"/><circle cx="85" cy="15" r="18" fill="none" stroke="${gold}" stroke-width="0.8"/><circle cx="85" cy="15" r="6" fill="${color}" opacity="0.6"/></svg>`,
        bottomLeft: `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80" style="position:absolute;bottom:0;left:0;opacity:0.3;"><circle cx="15" cy="65" r="25" fill="none" stroke="${color}" stroke-width="1"/><circle cx="15" cy="65" r="12" fill="none" stroke="${gold}" stroke-width="0.8"/></svg>`,
      };
    case "vine":
      return {
        topRight: `<svg xmlns="http://www.w3.org/2000/svg" width="130" height="130" viewBox="0 0 130 130" style="position:absolute;top:0;right:0;opacity:${o};"><path d="M130 0 C110 20, 100 40, 95 65 C93 50, 98 35, 110 25 M95 65 C90 50, 80 40, 65 35 C75 38, 82 45, 88 55 M130 30 C115 35, 105 45, 100 60" fill="none" stroke="${color}" stroke-width="1"/><circle cx="95" cy="67" r="2" fill="${color}" opacity="0.6"/><circle cx="65" cy="33" r="1.5" fill="${color}" opacity="0.6"/></svg>`,
        bottomLeft: `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100" style="position:absolute;bottom:0;left:0;opacity:${o};transform:rotate(180deg);"><path d="M100 0 C80 15, 70 35, 65 60 C63 45, 68 30, 80 20 M65 60 C60 45, 50 35, 35 30" fill="none" stroke="${color}" stroke-width="1"/></svg>`,
      };
    case "wheat":
      return {
        topRight: `<svg xmlns="http://www.w3.org/2000/svg" width="110" height="110" viewBox="0 0 110 110" style="position:absolute;top:0;right:0;opacity:0.35;"><path d="M90 10 L70 90" fill="none" stroke="${gold}" stroke-width="0.8"/><ellipse cx="90" cy="15" rx="4" ry="8" fill="none" stroke="${gold}" stroke-width="0.6" transform="rotate(-15 90 15)"/><ellipse cx="85" cy="30" rx="4" ry="8" fill="none" stroke="${gold}" stroke-width="0.6" transform="rotate(-10 85 30)"/><ellipse cx="80" cy="45" rx="4" ry="8" fill="none" stroke="${gold}" stroke-width="0.6" transform="rotate(-5 80 45)"/><ellipse cx="95" cy="25" rx="4" ry="8" fill="none" stroke="${gold}" stroke-width="0.6" transform="rotate(15 95 25)"/><ellipse cx="90" cy="40" rx="4" ry="8" fill="none" stroke="${gold}" stroke-width="0.6" transform="rotate(10 90 40)"/></svg>`,
        bottomLeft: `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80" style="position:absolute;bottom:0;left:0;opacity:0.35;transform:scaleX(-1);"><path d="M60 5 L40 75" fill="none" stroke="${gold}" stroke-width="0.8"/><ellipse cx="60" cy="10" rx="3" ry="7" fill="none" stroke="${gold}" stroke-width="0.6" transform="rotate(-15 60 10)"/><ellipse cx="55" cy="25" rx="3" ry="7" fill="none" stroke="${gold}" stroke-width="0.6"/></svg>`,
      };
    case "dove":
      return {
        topRight: `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="80" viewBox="0 0 100 80" style="position:absolute;top:10px;right:10px;opacity:0.3;"><path d="M70 40 C65 30, 55 25, 45 28 C50 22, 60 18, 70 22 C65 15, 55 12, 45 15 L30 25 C25 28, 22 35, 25 42 L35 38 C30 45, 35 50, 42 48 L50 42 C55 45, 65 43, 70 40Z" fill="${color}" opacity="0.6"/><path d="M25 42 C20 38, 10 40, 5 45" fill="none" stroke="${color}" stroke-width="0.8"/></svg>`,
        bottomLeft: "",
      };
    case "wave":
      return {
        topRight: "",
        bottomLeft: `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="60" viewBox="0 0 200 60" style="position:absolute;bottom:0;left:0;right:0;width:100%;opacity:0.25;"><path d="M0 40 C30 20, 60 50, 90 30 C120 10, 150 45, 180 25 C195 18, 200 20, 200 25 L200 60 L0 60Z" fill="${color}"/></svg>`,
      };
    case "corner-floral":
      return {
        topRight: `<svg xmlns="http://www.w3.org/2000/svg" width="90" height="90" viewBox="0 0 90 90" style="position:absolute;top:8px;right:8px;opacity:${o};"><circle cx="75" cy="15" r="6" fill="none" stroke="${color}" stroke-width="0.8"/><circle cx="75" cy="15" r="2" fill="${color}" opacity="0.5"/><path d="M75 9 C75 5, 72 2, 68 2 M81 15 C85 15, 88 12, 88 8 M75 21 C75 25, 78 28, 82 28 M69 15 C65 15, 62 18, 62 22" fill="none" stroke="${color}" stroke-width="0.6"/><path d="M60 8 L90 8 M82 0 L82 30" fill="none" stroke="${color}" stroke-width="0.3"/></svg>`,
        bottomLeft: `<svg xmlns="http://www.w3.org/2000/svg" width="90" height="90" viewBox="0 0 90 90" style="position:absolute;bottom:8px;left:8px;opacity:${o};transform:rotate(180deg);"><circle cx="75" cy="15" r="6" fill="none" stroke="${color}" stroke-width="0.8"/><circle cx="75" cy="15" r="2" fill="${color}" opacity="0.5"/><path d="M75 9 C75 5, 72 2, 68 2 M81 15 C85 15, 88 12, 88 8" fill="none" stroke="${color}" stroke-width="0.6"/></svg>`,
      };
    case "diamond":
      return {
        topRight: `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80" style="position:absolute;top:10px;right:10px;opacity:0.35;"><rect x="20" y="20" width="40" height="40" fill="none" stroke="${color}" stroke-width="0.8" transform="rotate(45 40 40)"/><rect x="28" y="28" width="24" height="24" fill="none" stroke="${gold}" stroke-width="0.5" transform="rotate(45 40 40)"/></svg>`,
        bottomLeft: `<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 60 60" style="position:absolute;bottom:10px;left:10px;opacity:0.35;"><rect x="15" y="15" width="30" height="30" fill="none" stroke="${color}" stroke-width="0.8" transform="rotate(45 30 30)"/></svg>`,
      };
    case "olive-branch":
      return {
        topRight: `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="60" viewBox="0 0 120 60" style="position:absolute;top:10px;right:10px;opacity:${o};"><path d="M10 50 C30 45, 50 35, 70 30 C90 25, 100 20, 115 10" fill="none" stroke="${color}" stroke-width="1"/><ellipse cx="35" cy="42" rx="6" ry="3" fill="none" stroke="${color}" stroke-width="0.6" transform="rotate(-15 35 42)"/><ellipse cx="55" cy="33" rx="6" ry="3" fill="none" stroke="${color}" stroke-width="0.6" transform="rotate(-12 55 33)"/><ellipse cx="75" cy="26" rx="6" ry="3" fill="none" stroke="${color}" stroke-width="0.6" transform="rotate(-10 75 26)"/><ellipse cx="95" cy="18" rx="6" ry="3" fill="none" stroke="${color}" stroke-width="0.6" transform="rotate(-8 95 18)"/></svg>`,
        bottomLeft: "",
      };
    case "light-rays":
      return {
        topRight: `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120" style="position:absolute;top:-20px;right:-20px;opacity:0.25;"><line x1="60" y1="60" x2="120" y2="0" stroke="${gold}" stroke-width="1"/><line x1="60" y1="60" x2="120" y2="30" stroke="${gold}" stroke-width="0.8"/><line x1="60" y1="60" x2="120" y2="60" stroke="${gold}" stroke-width="0.6"/><line x1="60" y1="60" x2="90" y2="0" stroke="${gold}" stroke-width="0.8"/><line x1="60" y1="60" x2="60" y2="0" stroke="${gold}" stroke-width="0.6"/></svg>`,
        bottomLeft: "",
      };
    case "frame-classic":
      return {
        topLeft: `<div style="position:absolute;top:8px;left:8px;right:8px;bottom:8px;border:1px solid ${color};opacity:0.3;pointer-events:none;"></div><div style="position:absolute;top:12px;left:12px;right:12px;bottom:12px;border:0.5px solid ${color};opacity:0.25;pointer-events:none;"></div>`,
        topRight: "",
        bottomLeft: "",
      };
    case "dots":
      return {
        topRight: `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80" style="position:absolute;top:10px;right:10px;opacity:0.3;">${Array.from({ length: 16 }, (_, i) => `<circle cx="${15 + (i % 4) * 18}" cy="${15 + Math.floor(i / 4) * 18}" r="1.5" fill="${color}"/>`).join("")}</svg>`,
        bottomLeft: `<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 60 60" style="position:absolute;bottom:10px;left:10px;opacity:0.3;">${Array.from({ length: 9 }, (_, i) => `<circle cx="${12 + (i % 3) * 18}" cy="${12 + Math.floor(i / 3) * 18}" r="1.5" fill="${color}"/>`).join("")}</svg>`,
      };
    case "cross-pattern":
      return {
        topRight: `<svg xmlns="http://www.w3.org/2000/svg" width="70" height="70" viewBox="0 0 70 70" style="position:absolute;top:10px;right:10px;opacity:0.25;">${Array.from({ length: 9 }, (_, i) => { const x = 12 + (i % 3) * 22, y = 12 + Math.floor(i / 3) * 22; return `<line x1="${x}" y1="${y - 5}" x2="${x}" y2="${y + 5}" stroke="${color}" stroke-width="0.8"/><line x1="${x - 5}" y1="${y}" x2="${x + 5}" y2="${y}" stroke="${color}" stroke-width="0.8"/>`; }).join("")}</svg>`,
        bottomLeft: "",
      };
    case "ribbon":
      return {
        topRight: `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="40" viewBox="0 0 100 40" style="position:absolute;top:15px;right:0;opacity:0.3;"><path d="M100 15 C80 15, 70 10, 60 15 C50 20, 40 15, 20 18 C10 19, 5 22, 0 20" fill="none" stroke="${gold}" stroke-width="1.5"/><path d="M100 20 C80 20, 70 15, 60 20 C50 25, 40 20, 20 23" fill="none" stroke="${gold}" stroke-width="0.8"/></svg>`,
        bottomLeft: "",
      };
    case "stained-glass":
      return {
        topRight: `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="100" viewBox="0 0 80 100" style="position:absolute;top:5px;right:10px;opacity:0.3;"><path d="M40 0 L40 80 M40 0 C20 20, 10 50, 20 80 M40 0 C60 20, 70 50, 60 80 M20 80 C30 85, 50 85, 60 80" fill="none" stroke="${color}" stroke-width="0.8"/><path d="M40 20 C30 30, 30 40, 40 45 C50 40, 50 30, 40 20" fill="${color}" opacity="0.25"/></svg>`,
        bottomLeft: "",
      };
    case "advent":
      return {
        topRight: `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120" style="position:absolute;top:0;right:0;opacity:0.7;"><circle cx="60" cy="60" r="48" fill="none" stroke="#581C87" stroke-width="1.5"/><circle cx="60" cy="60" r="42" fill="none" stroke="#581C87" stroke-width="0.6" stroke-dasharray="4 3"/><path d="M30 70 C40 65, 50 62, 60 65 C70 68, 80 65, 90 62" fill="none" stroke="#166534" stroke-width="1.2"/><path d="M35 74 C45 69, 55 66, 60 69 C70 72, 80 69, 85 66" fill="none" stroke="#166534" stroke-width="0.8"/><rect x="38" y="42" width="5" height="16" rx="1.5" fill="#581C87" opacity="0.8"/><rect x="57" y="36" width="5" height="22" rx="1.5" fill="#581C87" opacity="0.8"/><rect x="76" y="42" width="5" height="16" rx="1.5" fill="#581C87" opacity="0.8"/><path d="M40.5 42 C40.5 37, 38 34, 40.5 30 C43 34, 40.5 37, 40.5 42" fill="#F59E0B" opacity="0.9"/><path d="M59.5 36 C59.5 31, 57 28, 59.5 24 C62 28, 59.5 31, 59.5 36" fill="#F59E0B" opacity="0.9"/><path d="M78.5 42 C78.5 37, 76 34, 78.5 30 C81 34, 78.5 37, 78.5 42" fill="#F59E0B" opacity="0.9"/></svg>`,
        bottomLeft: `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80" style="position:absolute;bottom:0;left:0;opacity:0.7;"><path d="M5 70 C15 60, 25 55, 40 58 C50 60, 60 55, 75 50" fill="none" stroke="#166534" stroke-width="1"/><circle cx="20" cy="62" r="3" fill="#581C87" opacity="0.7"/><circle cx="50" cy="56" r="2.5" fill="#581C87" opacity="0.7"/></svg>`,
      };
    case "christmas":
      return {
        topRight: `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120" style="position:absolute;top:0;right:0;opacity:0.7;"><polygon points="60,8 65,28 88,28 70,42 76,62 60,48 44,62 50,42 32,28 55,28" fill="#D4A017" opacity="0.9" stroke="#D4A017" stroke-width="1"/><polygon points="40,100 60,55 80,100" fill="#166534" opacity="0.8" stroke="#166534" stroke-width="0.8"/><polygon points="46,100 60,65 74,100" fill="#22c55e" opacity="0.7" stroke="#22c55e" stroke-width="0.5"/><circle cx="48" cy="78" r="4" fill="#DC2626" opacity="0.9"/><circle cx="72" cy="82" r="3.5" fill="#DC2626" opacity="0.9"/><circle cx="58" cy="88" r="3" fill="#DC2626" opacity="0.9"/><rect x="56" y="100" width="8" height="10" rx="1" fill="#78350F" opacity="0.8"/></svg>`,
        bottomLeft: `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="50" viewBox="0 0 100 50" style="position:absolute;bottom:0;left:0;opacity:0.7;"><polygon points="15,12 18,18 24,18 19,22 21,28 15,24 9,28 11,22 6,18 12,18" fill="#D4A017" opacity="0.9"/><polygon points="45,10 48,16 54,16 49,20 51,26 45,22 39,26 41,20 36,16 42,16" fill="#D4A017" opacity="0.9"/><rect x="30" y="28" width="24" height="18" rx="2" fill="#DC2626" opacity="0.9"/><line x1="30" y1="37" x2="54" y2="37" stroke="#D4A017" stroke-width="2"/><line x1="42" y1="28" x2="42" y2="46" stroke="#D4A017" stroke-width="2"/></svg>`,
      };
    case "lent":
      return {
        topRight: `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100" style="position:absolute;top:5px;right:5px;opacity:0.7;"><line x1="50" y1="8" x2="50" y2="85" stroke="#581C87" stroke-width="2.5"/><line x1="22" y1="30" x2="78" y2="30" stroke="#581C87" stroke-width="2"/><path d="M28 12 C33 16, 37 13, 42 17 C47 13, 52 17, 57 13 C62 17, 67 13, 72 17" fill="none" stroke="#78350F" stroke-width="1.2"/><path d="M28 20 C33 24, 37 20, 42 24 C47 20, 52 24, 57 20 C62 24, 67 20, 72 24" fill="none" stroke="#78350F" stroke-width="0.8"/><circle cx="50" cy="55" r="2" fill="#4C1D95" opacity="0.7"/><circle cx="50" cy="65" r="1.5" fill="#4C1D95" opacity="0.7"/><circle cx="50" cy="73" r="1" fill="#4C1D95" opacity="0.6"/></svg>`,
        bottomLeft: `<svg xmlns="http://www.w3.org/2000/svg" width="70" height="35" viewBox="0 0 70 35" style="position:absolute;bottom:5px;left:5px;opacity:0.7;"><path d="M5 18 C12 14, 18 20, 25 14 C32 20, 38 14, 45 20 C52 14, 58 20, 65 16" fill="none" stroke="#581C87" stroke-width="1"/></svg>`,
      };
    case "easter":
      return {
        topRight: `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120" style="position:absolute;top:0;right:0;opacity:0.7;"><path d="M60 50 C54 32, 42 26, 48 12 C54 26, 52 32, 60 50" fill="#FEFCE8" stroke="#D4A017" stroke-width="0.8"/><path d="M60 50 C66 32, 78 26, 72 12 C66 26, 68 32, 60 50" fill="#FEFCE8" stroke="#D4A017" stroke-width="0.8"/><path d="M60 50 C48 38, 36 38, 28 26 C40 35, 48 38, 60 50" fill="#FEFCE8" stroke="#D4A017" stroke-width="0.8"/><path d="M60 50 C72 38, 84 38, 92 26 C80 35, 72 38, 60 50" fill="#FEFCE8" stroke="#D4A017" stroke-width="0.8"/><line x1="60" y1="50" x2="60" y2="80" stroke="#65A30D" stroke-width="1.5"/><path d="M60 58 C54 54, 48 57, 44 52" fill="none" stroke="#65A30D" stroke-width="0.8"/><path d="M60 65 C66 61, 72 64, 76 59" fill="none" stroke="#65A30D" stroke-width="0.8"/>${Array.from({ length: 12 }, (_, i) => `<line x1="60" y1="50" x2="${60 + 42 * Math.cos(i * Math.PI / 6)}" y2="${50 + 42 * Math.sin(i * Math.PI / 6)}" stroke="#FDE047" stroke-width="0.4" opacity="0.8"/>`).join("")}</svg>`,
        bottomLeft: `<svg xmlns="http://www.w3.org/2000/svg" width="70" height="70" viewBox="0 0 70 70" style="position:absolute;bottom:0;left:0;opacity:0.7;"><path d="M15 55 C20 45, 30 42, 35 48 C38 42, 42 45, 45 50" fill="none" stroke="#65A30D" stroke-width="0.8"/><path d="M30 48 C28 42, 32 38, 35 42" fill="#FEFCE8" stroke="#D4A017" stroke-width="0.5"/></svg>`,
      };
    case "pentecost":
      return {
        topRight: `<svg xmlns="http://www.w3.org/2000/svg" width="110" height="120" viewBox="0 0 110 120" style="position:absolute;top:0;right:0;opacity:0.7;"><path d="M55 90 C50 68, 38 55, 42 32 C45 48, 50 52, 55 65 C60 52, 65 48, 68 32 C72 55, 60 68, 55 90" fill="#DC2626" opacity="0.6"/><path d="M55 90 C52 72, 42 60, 46 40" fill="none" stroke="#DC2626" stroke-width="1.5"/><path d="M55 90 C58 72, 68 60, 64 40" fill="none" stroke="#DC2626" stroke-width="1.5"/><path d="M38 85 C35 65, 25 55, 30 38" fill="none" stroke="#EA580C" stroke-width="1"/><path d="M72 85 C75 65, 85 55, 80 38" fill="none" stroke="#EA580C" stroke-width="1"/><path d="M46 80 C44 68, 38 60, 40 48" fill="none" stroke="#F59E0B" stroke-width="0.8"/><path d="M64 80 C66 68, 72 60, 70 48" fill="none" stroke="#F59E0B" stroke-width="0.8"/></svg>`,
        bottomLeft: `<svg xmlns="http://www.w3.org/2000/svg" width="70" height="45" viewBox="0 0 70 45" style="position:absolute;bottom:0;left:5px;opacity:0.7;"><path d="M20 35 C18 25, 12 20, 15 10 C17 18, 19 22, 20 30" fill="none" stroke="#DC2626" stroke-width="1"/><path d="M35 38 C33 28, 28 22, 30 14 C32 22, 34 26, 35 34" fill="none" stroke="#EA580C" stroke-width="0.8"/><path d="M50 35 C48 27, 44 22, 46 15" fill="none" stroke="#F59E0B" stroke-width="0.7"/></svg>`,
      };
    case "thanksgiving":
      return {
        topRight: `<svg xmlns="http://www.w3.org/2000/svg" width="130" height="110" viewBox="0 0 130 110" style="position:absolute;top:0;right:0;opacity:0.7;"><path d="M90 10 L72 95" fill="none" stroke="#D4A017" stroke-width="1"/><ellipse cx="90" cy="18" rx="6" ry="11" fill="#D4A017" opacity="0.7" stroke="#D4A017" stroke-width="0.7" transform="rotate(-12 90 18)"/><ellipse cx="84" cy="35" rx="6" ry="11" fill="#D4A017" opacity="0.7" stroke="#D4A017" stroke-width="0.7" transform="rotate(-6 84 35)"/><ellipse cx="80" cy="52" rx="6" ry="11" fill="#D4A017" opacity="0.6" stroke="#D4A017" stroke-width="0.7"/><ellipse cx="96" cy="26" rx="6" ry="11" fill="#D4A017" opacity="0.7" stroke="#D4A017" stroke-width="0.7" transform="rotate(12 96 26)"/><ellipse cx="90" cy="44" rx="6" ry="11" fill="#D4A017" opacity="0.6" stroke="#D4A017" stroke-width="0.7" transform="rotate(6 90 44)"/><path d="M105 75 C100 68, 92 72, 96 62 C100 56, 108 60, 106 66" fill="none" stroke="#EA580C" stroke-width="0.8"/><path d="M112 82 C108 78, 104 80, 108 74 C112 70, 116 74, 114 78" fill="#92400E" opacity="0.7"/><circle cx="110" cy="90" r="5" fill="#DC2626" opacity="0.7" stroke="#DC2626" stroke-width="0.5"/><circle cx="100" cy="88" r="4" fill="#A16207" opacity="0.7" stroke="#A16207" stroke-width="0.5"/></svg>`,
        bottomLeft: `<svg xmlns="http://www.w3.org/2000/svg" width="90" height="55" viewBox="0 0 90 55" style="position:absolute;bottom:0;left:0;opacity:0.7;"><path d="M5 48 C15 38, 30 35, 42 40 C50 32, 62 36, 70 42 C78 38, 85 40, 90 45" fill="none" stroke="#D4A017" stroke-width="1"/><circle cx="25" cy="42" r="4" fill="#EA580C" opacity="0.7"/><circle cx="55" cy="38" r="3.5" fill="#A16207" opacity="0.7"/><circle cx="80" cy="42" r="3" fill="#92400E" opacity="0.7"/></svg>`,
      };
    case "harvest":
      return {
        topRight: `<svg xmlns="http://www.w3.org/2000/svg" width="110" height="110" viewBox="0 0 110 110" style="position:absolute;top:0;right:0;opacity:0.7;"><path d="M75 15 C70 28, 58 35, 52 50 C50 38, 55 28, 65 20" fill="#166534" opacity="0.6" stroke="#166534" stroke-width="0.8"/><path d="M85 22 C80 35, 68 42, 62 55 C60 43, 65 33, 75 25" fill="#15803D" opacity="0.6" stroke="#15803D" stroke-width="0.8"/><circle cx="58" cy="62" r="5" fill="#7C3AED" opacity="0.7" stroke="#7C3AED" stroke-width="0.7"/><circle cx="66" cy="66" r="5" fill="#7C3AED" opacity="0.7" stroke="#7C3AED" stroke-width="0.7"/><circle cx="62" cy="72" r="5" fill="#7C3AED" opacity="0.7" stroke="#7C3AED" stroke-width="0.7"/><circle cx="70" cy="74" r="4.5" fill="#7C3AED" opacity="0.6" stroke="#7C3AED" stroke-width="0.7"/><circle cx="55" cy="68" r="4.5" fill="#7C3AED" opacity="0.6" stroke="#7C3AED" stroke-width="0.7"/><circle cx="74" cy="68" r="4" fill="#7C3AED" opacity="0.6" stroke="#7C3AED" stroke-width="0.7"/></svg>`,
        bottomLeft: "",
      };
    case "newyear":
      return {
        topRight: `<svg xmlns="http://www.w3.org/2000/svg" width="110" height="110" viewBox="0 0 110 110" style="position:absolute;top:0;right:0;opacity:0.7;">${Array.from({ length: 16 }, (_, i) => `<line x1="55" y1="55" x2="${55 + 48 * Math.cos(i * Math.PI / 8)}" y2="${55 + 48 * Math.sin(i * Math.PI / 8)}" stroke="#D4A017" stroke-width="${i % 2 === 0 ? "1" : "0.5"}" opacity="${i % 2 === 0 ? "0.9" : "0.7"}"/>`).join("")}<circle cx="55" cy="55" r="18" fill="none" stroke="#D4A017" stroke-width="1.2"/><circle cx="55" cy="55" r="12" fill="none" stroke="#FDE047" stroke-width="0.6"/><circle cx="55" cy="55" r="4" fill="#F59E0B" opacity="0.9"/></svg>`,
        bottomLeft: `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80" style="position:absolute;bottom:0;left:0;opacity:0.7;"><path d="M20 20 L20 65 M12 20 L28 20 L28 65 L12 65" fill="none" stroke="#D4A017" stroke-width="0.8"/><path d="M20 42 C24 38, 28 40, 30 36" fill="none" stroke="#FDE047" stroke-width="0.6"/>${Array.from({ length: 5 }, (_, i) => `<line x1="20" y1="${25 + i * 10}" x2="${40 + i * 5}" y2="${20 + i * 8}" stroke="#F59E0B" stroke-width="0.3" opacity="0.7"/>`).join("")}</svg>`,
      };
    case "children":
      return {
        topRight: `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120" style="position:absolute;top:0;right:0;opacity:0.7;"><ellipse cx="28" cy="32" rx="12" ry="16" fill="#EF4444" opacity="0.9"/><line x1="28" y1="48" x2="26" y2="72" stroke="#9CA3AF" stroke-width="0.8"/><ellipse cx="55" cy="26" rx="12" ry="16" fill="#3B82F6" opacity="0.9"/><line x1="55" y1="42" x2="53" y2="68" stroke="#9CA3AF" stroke-width="0.8"/><ellipse cx="82" cy="34" rx="12" ry="16" fill="#22C55E" opacity="0.9"/><line x1="82" y1="50" x2="80" y2="75" stroke="#9CA3AF" stroke-width="0.8"/><ellipse cx="42" cy="20" rx="12" ry="16" fill="#FACC15" opacity="0.9"/><line x1="42" y1="36" x2="40" y2="58" stroke="#9CA3AF" stroke-width="0.8"/><polygon points="95,6 97,12 103,12 98,16 100,22 95,18 90,22 92,16 87,12 93,12" fill="#F59E0B" opacity="0.9"/><polygon points="18,10 20,14 25,14 21,17 22,22 18,19 14,22 15,17 11,14 16,14" fill="#F59E0B" opacity="0.9"/></svg>`,
        bottomLeft: `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="40" viewBox="0 0 100 40" style="position:absolute;bottom:0;left:0;opacity:0.7;"><defs><linearGradient id="rainbow-ch" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#EF4444"/><stop offset="25%" stop-color="#FACC15"/><stop offset="50%" stop-color="#22C55E"/><stop offset="75%" stop-color="#3B82F6"/><stop offset="100%" stop-color="#7C3AED"/></linearGradient></defs><path d="M0 32 Q25 8, 50 20 T100 28" fill="none" stroke="url(#rainbow-ch)" stroke-width="3"/></svg>`,
      };
    case "parents":
      return {
        topRight: `<svg xmlns="http://www.w3.org/2000/svg" width="110" height="110" viewBox="0 0 110 110" style="position:absolute;top:0;right:0;opacity:0.7;"><ellipse cx="55" cy="38" rx="8" ry="6" fill="#E11D48" opacity="0.9" transform="rotate(-20 55 38)"/><ellipse cx="50" cy="42" rx="8" ry="6" fill="#FB7185" opacity="0.9" transform="rotate(10 50 42)"/><ellipse cx="60" cy="42" rx="8" ry="6" fill="#E11D48" opacity="0.9" transform="rotate(-10 60 42)"/><ellipse cx="48" cy="46" rx="8" ry="6" fill="#FB7185" opacity="0.9" transform="rotate(5 48 46)"/><ellipse cx="62" cy="46" rx="8" ry="6" fill="#E11D48" opacity="0.9" transform="rotate(-5 62 46)"/><ellipse cx="55" cy="48" rx="8" ry="6" fill="#FB7185" opacity="0.9"/><path d="M55 54 L55 92" fill="none" stroke="#16A34A" stroke-width="2"/><ellipse cx="52" cy="72" rx="5" ry="3" fill="#22C55E" opacity="0.9" transform="rotate(-25 52 72)"/><ellipse cx="58" cy="78" rx="5" ry="3" fill="#22C55E" opacity="0.9" transform="rotate(20 58 78)"/></svg>`,
        bottomLeft: `<svg xmlns="http://www.w3.org/2000/svg" width="70" height="70" viewBox="0 0 70 70" style="position:absolute;bottom:0;left:0;opacity:0.7;"><g transform="scale(0.8) translate(7,7)"><ellipse cx="44" cy="30" rx="6.4" ry="4.8" fill="#E11D48" opacity="0.9" transform="rotate(-20 44 30)"/><ellipse cx="40" cy="33" rx="6.4" ry="4.8" fill="#FB7185" opacity="0.9" transform="rotate(10 40 33)"/><ellipse cx="48" cy="33" rx="6.4" ry="4.8" fill="#E11D48" opacity="0.9" transform="rotate(-10 48 33)"/><ellipse cx="38" cy="37" rx="6.4" ry="4.8" fill="#FB7185" opacity="0.9" transform="rotate(5 38 37)"/><ellipse cx="50" cy="37" rx="6.4" ry="4.8" fill="#E11D48" opacity="0.9" transform="rotate(-5 50 37)"/><ellipse cx="44" cy="38" rx="6.4" ry="4.8" fill="#FB7185" opacity="0.9"/><path d="M44 43 L44 68" fill="none" stroke="#16A34A" stroke-width="1.6"/><ellipse cx="42" cy="57" rx="4" ry="2.4" fill="#22C55E" opacity="0.9" transform="rotate(-25 42 57)"/><ellipse cx="46" cy="62" rx="4" ry="2.4" fill="#22C55E" opacity="0.9" transform="rotate(20 46 62)"/></g></svg>`,
      };
    case "teachers":
      return {
        topRight: `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100" style="position:absolute;top:5px;right:5px;opacity:0.7;"><rect x="25" y="30" width="50" height="40" rx="2" fill="#f5e6c8" opacity="0.8" stroke="#2563EB" stroke-width="1"/><line x1="50" y1="30" x2="50" y2="70" stroke="#2563EB" stroke-width="0.8"/><line x1="30" y1="42" x2="46" y2="42" stroke="#1E3A5F" stroke-width="0.4"/><line x1="30" y1="48" x2="46" y2="48" stroke="#1E3A5F" stroke-width="0.4"/><line x1="30" y1="54" x2="46" y2="54" stroke="#1E3A5F" stroke-width="0.4"/><line x1="54" y1="42" x2="70" y2="42" stroke="#1E3A5F" stroke-width="0.4"/><line x1="54" y1="48" x2="70" y2="48" stroke="#1E3A5F" stroke-width="0.4"/><path d="M70 20 L78 68" stroke="#D4A017" stroke-width="1.2" stroke-linecap="round"/><path d="M78 68 L76 72 L80 72Z" fill="#D4A017" opacity="0.9"/></svg>`,
        bottomLeft: "",
      };
    case "creation":
      return {
        topRight: `<svg xmlns="http://www.w3.org/2000/svg" width="110" height="110" viewBox="0 0 110 110" style="position:absolute;top:0;right:0;opacity:0.7;"><circle cx="55" cy="55" r="35" fill="#e8f5e9" opacity="0.8" stroke="#16A34A" stroke-width="1"/><path d="M40 55 C42 42, 50 38, 55 35 C60 38, 68 42, 70 55 C68 62, 60 65, 55 68 C50 65, 42 62, 40 55Z" fill="#16A34A" opacity="0.7" stroke="#16A34A" stroke-width="0.8"/><line x1="55" y1="35" x2="55" y2="68" stroke="#16A34A" stroke-width="0.6"/><path d="M55 45 C50 42, 44 44, 42 48" fill="none" stroke="#16A34A" stroke-width="0.5"/><path d="M55 52 C60 49, 66 51, 68 55" fill="none" stroke="#16A34A" stroke-width="0.5"/><path d="M30 40 C25 35, 28 28, 35 30 C32 25, 38 22, 40 28" fill="none" stroke="#0EA5E9" stroke-width="0.6"/><path d="M75 70 C80 65, 82 58, 78 55 C82 52, 85 56, 83 62" fill="none" stroke="#0EA5E9" stroke-width="0.6"/></svg>`,
        bottomLeft: `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="40" viewBox="0 0 80 40" style="position:absolute;bottom:0;left:0;opacity:0.7;"><path d="M10 35 C18 28, 28 32, 35 25 C42 32, 52 28, 60 32 C68 28, 75 32, 80 35" fill="none" stroke="#16A34A" stroke-width="0.8"/><path d="M25 30 C23 24, 27 20, 30 24" fill="#78350F" opacity="0.7"/><path d="M55 28 C53 22, 57 18, 60 22" fill="#78350F" opacity="0.7"/></svg>`,
      };
    case "bible":
      return {
        topRight: `<svg xmlns="http://www.w3.org/2000/svg" width="110" height="90" viewBox="0 0 110 90" style="position:absolute;top:5px;right:5px;opacity:0.7;"><path d="M55 20 C40 22, 20 25, 15 30 L15 75 C20 70, 40 68, 55 65" fill="#f5e6c8" opacity="0.6" stroke="#92400E" stroke-width="0.8"/><path d="M55 20 C70 22, 90 25, 95 30 L95 75 C90 70, 70 68, 55 65" fill="#f5e6c8" opacity="0.6" stroke="#92400E" stroke-width="0.8"/><line x1="55" y1="20" x2="55" y2="65" stroke="#92400E" stroke-width="0.6"/><line x1="25" y1="38" x2="48" y2="36" stroke="#D4A017" stroke-width="0.4"/><line x1="25" y1="45" x2="48" y2="43" stroke="#D4A017" stroke-width="0.4"/><line x1="25" y1="52" x2="48" y2="50" stroke="#D4A017" stroke-width="0.4"/><line x1="62" y1="36" x2="85" y2="38" stroke="#D4A017" stroke-width="0.4"/><line x1="62" y1="43" x2="85" y2="45" stroke="#D4A017" stroke-width="0.4"/><line x1="62" y1="50" x2="85" y2="52" stroke="#D4A017" stroke-width="0.4"/>${Array.from({ length: 6 }, (_, i) => `<line x1="55" y1="15" x2="${55 + 25 * Math.cos(-Math.PI / 2 + i * Math.PI / 5 - Math.PI / 2)}" y2="${15 + 25 * Math.sin(-Math.PI / 2 + i * Math.PI / 5 - Math.PI / 2)}" stroke="#78350F" stroke-width="0.4" opacity="0.7"/>`).join("")}</svg>`,
        bottomLeft: "",
      };
    case "mission":
      return {
        topRight: `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100" style="position:absolute;top:5px;right:5px;opacity:0.7;"><circle cx="50" cy="50" r="32" fill="none" stroke="#2563EB" stroke-width="1"/><ellipse cx="50" cy="50" rx="14" ry="32" fill="none" stroke="#2563EB" stroke-width="0.6"/><line x1="18" y1="50" x2="82" y2="50" stroke="#DC2626" stroke-width="0.5"/><path d="M22 35 C35 33, 65 33, 78 35" fill="none" stroke="#16A34A" stroke-width="0.4"/><path d="M22 65 C35 67, 65 67, 78 65" fill="none" stroke="#16A34A" stroke-width="0.4"/><line x1="50" y1="8" x2="50" y2="22" stroke="#D4A017" stroke-width="1.2"/><line x1="44" y1="14" x2="56" y2="14" stroke="#D4A017" stroke-width="1"/></svg>`,
        bottomLeft: `<svg xmlns="http://www.w3.org/2000/svg" width="60" height="30" viewBox="0 0 60 30" style="position:absolute;bottom:8px;left:8px;opacity:0.7;"><path d="M5 25 C15 18, 25 22, 35 15 C45 22, 55 18, 60 22" fill="none" stroke="#2563EB" stroke-width="0.8"/></svg>`,
      };
    case "reformation":
      return {
        topRight: `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="110" viewBox="0 0 100 110" style="position:absolute;top:0;right:0;opacity:0.7;"><rect x="30" y="40" width="40" height="55" rx="2" fill="#f5e6c8" opacity="0.6" stroke="#DC2626" stroke-width="1"/><line x1="50" y1="40" x2="50" y2="95" stroke="#DC2626" stroke-width="0.6"/><line x1="36" y1="52" x2="46" y2="52" stroke="#1C1917" stroke-width="0.3"/><line x1="36" y1="58" x2="46" y2="58" stroke="#1C1917" stroke-width="0.3"/><line x1="54" y1="52" x2="64" y2="52" stroke="#1C1917" stroke-width="0.3"/><line x1="54" y1="58" x2="64" y2="58" stroke="#1C1917" stroke-width="0.3"/><rect x="46" y="15" width="8" height="30" rx="2" fill="#D4A017" opacity="0.8" stroke="#D4A017" stroke-width="0.6"/><path d="M50 15 C47 8, 42 5, 45 0 C48 5, 47 8, 50 12 C53 8, 52 5, 55 0 C58 5, 53 8, 50 15" fill="#DC2626" opacity="0.8" stroke="#DC2626" stroke-width="0.5"/><path d="M50 15 C48 10, 44 8, 46 3" fill="none" stroke="#D4A017" stroke-width="0.6"/><path d="M50 15 C52 10, 56 8, 54 3" fill="none" stroke="#D4A017" stroke-width="0.6"/></svg>`,
        bottomLeft: "",
      };
    case "anniversary":
      return {
        topRight: `<svg xmlns="http://www.w3.org/2000/svg" width="110" height="110" viewBox="0 0 110 110" style="position:absolute;top:0;right:0;opacity:0.7;"><circle cx="55" cy="55" r="40" fill="none" stroke="#D4A017" stroke-width="1.2"/><circle cx="55" cy="55" r="35" fill="none" stroke="#D4A017" stroke-width="0.5" stroke-dasharray="3 4"/><circle cx="55" cy="55" r="44" fill="none" stroke="#7C3AED" stroke-width="0.6"/>${Array.from({ length: 8 }, (_, i) => { const a = i * Math.PI / 4; return `<polygon points="${55 + 30 * Math.cos(a)},${55 + 30 * Math.sin(a)} ${55 + 34 * Math.cos(a - 0.15)},${55 + 34 * Math.sin(a - 0.15)} ${55 + 38 * Math.cos(a)},${55 + 38 * Math.sin(a)} ${55 + 34 * Math.cos(a + 0.15)},${55 + 34 * Math.sin(a + 0.15)}" fill="#D4A017" opacity="0.9"/>`; }).join("")}<path d="M55 20 C50 12, 42 18, 48 24 C42 18, 48 10, 55 16 C62 10, 68 18, 62 24 C68 18, 60 12, 55 20" fill="#EC4899" opacity="0.8" stroke="#7C3AED" stroke-width="0.6"/></svg>`,
        bottomLeft: `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="40" viewBox="0 0 80 40" style="position:absolute;bottom:5px;left:5px;opacity:0.7;"><path d="M5 35 C15 28, 25 32, 35 25 C45 32, 55 28, 65 32 C72 28, 78 30, 80 35" fill="none" stroke="#D4A017" stroke-width="0.8"/>${Array.from({ length: 5 }, (_, i) => `<circle cx="${10 + i * 18}" cy="${28 + Math.sin(i) * 5}" r="1.5" fill="#7C3AED" opacity="0.7"/>`).join("")}</svg>`,
      };
    default:
      return { topRight: "", bottomLeft: "" };
  }
};

/* ---------- Preview HTML (Multi-Mode Bulletin) ---------- */
function prepData(db: BulletinDB) {
  const c = db.current, s = db.settings;
  const tpl = TEMPLATES.find(t => t.id === c.template) || TEMPLATES[0];
  const esc = (x: string) => (x || "").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const escBr = (s: string) => esc(s).replace(/\n/g, "<br>");
  const nl = (x: string) => esc(x).replace(/\n/g, "<br>");
  const orderLines = (c.worship?.worshipOrder || "").split("\n").filter(l => l.trim());
  const orderRows = orderLines.map(l => {
    const parts = l.split("…").filter(p => p.trim());
    if (parts.length >= 2)
      return `<tr><td class="bp-o-item">${esc(parts[0].trim())}</td><td class="bp-o-dots"></td><td class="bp-o-detail">${esc(parts[parts.length - 1].trim())}</td></tr>`;
    return `<tr><td class="bp-o-item" colspan="3">${esc(l.trim())}</td></tr>`;
  }).join("");
  const ads: { dept: string; text: string }[] = [];
  if (c.general?.content) ads.push({ dept: "교회 소식", text: c.general.content });
  if (c.pastor?.pastorNotice) ads.push({ dept: "특별 공지", text: c.pastor.pastorNotice });
  const departmentItems: { key: string; name: string; text: string }[] = [];
  const enabled = c.departments?.enabled || [];
  const data = c.departments?.data || {};
  DEPARTMENTS.forEach(({ key, name }) => {
    if (enabled.includes(key) && data[key]?.trim()) {
      departmentItems.push({ key, name, text: data[key].trim() });
    }
  });
  const bdays = (c.general?.birthday || "").split(",").map(b => b.trim()).filter(Boolean);
  const decorStyle = (c.coverDecor ?? tpl.decorStyle) as DecorStyle | "none";
  return { c, s, tpl, decorStyle, esc, escBr, nl, orderRows, ads, bdays, departmentItems };
}

/** 화면 미리보기용 패널 고정 높이(px). 인쇄 시에는 @media print의 100vh 사용. */
const PREVIEW_PANEL_HEIGHT_PX = 480;

/** 패널별 전체 글자수 합산 상한 (미리보기 넘침 방지) */
const NEWS_TOTAL_MAX = 350;
const DEPT_TOTAL_MAX = 400;
const WORSHIP_TOTAL_MAX = 300;
const SERMON_TOTAL_MAX = 500;
/** 4면: 예배순서+칼럼 한 면 합산 상한 */
const FOUR_WORSHIP_TOTAL_MAX = 450;
/** 4면: 교회소식+부서별소식 한 면 합산 상한 */
const FOUR_NEWS_TOTAL_MAX = 450;

/* 6면: section index 0=cover(면1), 1=churchNews(면2), 2=worship(면3), 3=sermon(면4), 4=departments(면5), 5=back(면6) */
function getTriFoldSectionHTML(db: BulletinDB, index: number): string {
  const { c, s, tpl, decorStyle, esc, escBr, nl, orderRows, ads, bdays, departmentItems } = prepData(db);
  switch (index) {
    case 0: {
      const decor = decorStyle === "none"
        ? { topRight: "", bottomLeft: "" }
        : getDecorSVG(decorStyle, tpl.accent, tpl.gold);
      const hasCover = !!c.coverImage;
      const photoLayer = hasCover ? `
        <div style="width:100%;flex:0 0 35%;overflow:hidden;position:relative;">
          <img src="${c.coverImage}" style="width:100%;height:100%;object-fit:cover;display:block;opacity:${c.coverImageOpacity ?? 0.3};" />
        </div>` : "";
      return `<div class="tp tp-cover" style="background-color:${tpl.headerBg}; border-bottom:2px solid ${tpl.borderColor}; height:100%; width:100%; min-height:100%; display:flex; flex-direction:column; position:relative; overflow:hidden; -webkit-print-color-adjust:exact; print-color-adjust:exact; color-adjust:exact;">
    <div class="tp-bg" style="background-color:${tpl.headerBg}"></div>
    ${decor.topRight}${decor.bottomLeft}${decor.topLeft || ""}${decor.bottomRight || ""}
    <div class="tp-cover-inner" style="color:${tpl.headerTextColor};position:relative;z-index:3;display:flex;flex-direction:column;align-items:center;width:100%;height:100%;padding:0;text-shadow:${hasCover ? 'none' : '0 1px 8px rgba(0,0,0,0.3)'};">
      <div style="flex:0 0 ${hasCover ? '12%' : '18%'};"></div>
      <div style="text-align:center;padding:0 16px;margin-bottom:10px;">
        <div style="font-size:18px;font-weight:900;color:${hasCover ? '#1a1a1a' : tpl.headerTextColor};letter-spacing:3px;white-space:nowrap;">${esc(s.church)}</div>
        ${s.churchSub ? `<div style="font-size:8px;color:${hasCover ? '#555' : tpl.headerTextColor};opacity:0.8;margin-top:3px;">${esc(s.churchSub)}</div>` : ""}
      </div>
      ${photoLayer}
      ${hasCover ? "" : `<div style="width:50px;height:1px;background:${tpl.gold};margin:8px auto;opacity:0.5;"></div>`}
      ${hasCover ? "" : BI.cross(tpl.headerTextColor)}
      ${c.pastor?.sermonTitle ? `<div style="font-size:11px;font-weight:700;margin-top:16px;margin-bottom:3px;text-align:center;padding:0 16px;">${esc(c.pastor.sermonTitle)}</div>` : ""}
      ${c.pastor?.sermonPassage ? `<div style="font-size:8px;opacity:0.8;margin-bottom:4px;padding:0 16px;">${esc(c.pastor.sermonPassage)}</div>` : ""}
      <div style="width:35px;height:1px;background:${tpl.gold};margin:4px auto;opacity:0.4;"></div>
      <div style="font-size:9px;opacity:0.85;margin-top:12px;">${esc(c.date || BULLETIN_DATE_STR)} 주일예배</div>
      <div style="margin-top:24px;text-align:center;font-size:8px;opacity:0.75;padding:0 16px 10px;">
        <div style="font-size:9px;font-weight:800;opacity:0.9;">${esc(s.pastor)}</div>
        ${s.staffList ? `<div style="font-size:6.5px;opacity:0.55;margin-top:1px;letter-spacing:0.5px;">${s.staffList.split("\n").map(l => esc(l.trim())).filter(Boolean).join(" · ")}</div>` : ""}
        <div style="margin-top:2px;">${escBr(s.worshipTime || "")}</div>
      </div>
    </div></div>`;
    }
    case 1:
      return `<div class="tp tp-flap" style="height:100%;overflow:hidden;"><div class="tp-hd" style="display:flex;align-items:center;gap:6px;padding-bottom:8px;border-bottom:1.5px solid ${tpl.borderColor};margin-bottom:10px;">${BI.news(tpl.accent)}<span style="font-size:13px;font-weight:700;color:${tpl.headerTextColor};letter-spacing:0.3px;">교회 소식</span></div><div class="tp-bd">
    ${c.general?.content ? `<div class="tp-label" style="color:${tpl.accent}">${BI.news(tpl.accent)} 교회 소식</div><div class="tp-val">${nl(c.general.content)}</div>` : ""}
    ${c.general?.servants ? `<div class="tp-label" style="color:${tpl.accent}">${BI.users(tpl.accent)} 금주 봉사자</div><div class="tp-val">${nl(c.general.servants)}</div>` : ""}
    ${c.general?.offering ? `<div class="tp-label" style="color:${tpl.accent}">${BI.offering(tpl.accent)} 헌금 보고</div><div class="tp-val">${nl(c.general.offering)}</div>` : ""}
    ${c.general?.schedule ? `<div class="tp-label" style="color:${tpl.accent}">${BI.calendar(tpl.accent)} 금주 일정</div><div class="tp-val">${nl(c.general.schedule)}</div>` : ""}
    ${bdays.length ? `<div class="tp-label" style="color:${tpl.accent}">${BI.gift(tpl.accent)} 이번 주 생일</div><div class="tp-bday-list">${bdays.map(b => `<span class="tp-bday-tag" style="background:${tpl.accentLight};color:${tpl.accent}">${esc(b)}</span>`).join("")}</div>` : ""}
  </div></div>`;
    case 2:
      return `<div class="tp tp-worship" style="height:100%;overflow:hidden;"><div class="tp-hd" style="display:flex;align-items:center;gap:6px;padding-bottom:8px;border-bottom:1.5px solid ${tpl.borderColor};margin-bottom:10px;">${BI.worship(tpl.accent)}<span style="font-size:13px;font-weight:700;color:${tpl.headerTextColor};letter-spacing:0.3px;">예배 순서</span></div><div class="tp-bd">
    ${orderRows ? `<table class="tp-otbl">${orderRows}</table>` : '<div class="tp-empty">예배 순서를 입력하세요</div>'}
    ${c.worship?.praise ? `<div class="tp-note">${BI.music(tpl.accent)} 찬양: ${esc(c.worship.praise)}</div>` : ""}
    ${c.worship?.special ? `<div class="tp-note">${BI.mic(tpl.accent)} ${esc(c.worship.special)}</div>` : ""}
  </div></div>`;
    case 3:
      return `<div class="tp tp-sermon" style="height:100%;overflow:hidden;"><div class="tp-hd" style="display:flex;align-items:center;gap:6px;padding-bottom:8px;border-bottom:1.5px solid ${tpl.borderColor};margin-bottom:10px;">${BI.sermon(tpl.accent)}<span style="font-size:13px;font-weight:700;color:${tpl.headerTextColor};letter-spacing:0.3px;">말씀 / 칼럼</span></div><div class="tp-bd">
    ${c.pastor?.sermonTitle ? `<div class="tp-sermon-box" style="border-color:${tpl.gold}"><div class="tp-sermon-t" style="color:${tpl.accent}">${esc(c.pastor.sermonTitle)}</div>${c.pastor.sermonPassage ? `<div class="tp-sermon-p">${esc(c.pastor.sermonPassage)}</div>` : ""}${c.pastor.sermonTheme ? `<div class="tp-sermon-th">${esc(c.pastor.sermonTheme)}</div>` : ""}</div>` : ""}
    ${c.pastor?.column ? `<div class="tp-column" style="border-left-color:${tpl.gold}"><div class="tp-col-txt">${nl(c.pastor.column)}</div></div>` : ""}
  </div></div>`;
    case 4:
      return `<div class="tp tp-news" style="height:100%;overflow:hidden;"><div class="tp-hd" style="display:flex;align-items:center;gap:6px;padding-bottom:8px;border-bottom:1.5px solid ${tpl.borderColor};margin-bottom:10px;">${BI.news(tpl.accent)}<span style="font-size:13px;font-weight:700;color:${tpl.headerTextColor};letter-spacing:0.3px;">부서별 소식</span></div><div class="tp-bd">
    ${departmentItems.length ? departmentItems.map(d => `<div class="tp-ad" style="border-left-color:${tpl.accent}"><div class="tp-ad-dept" style="color:${tpl.accent}">▶ ${esc(d.name)}</div><div class="tp-ad-txt">${nl(d.text)}</div></div>`).join("") : '<div class="tp-empty">부서를 선택하고 내용을 입력하세요</div>'}
  </div></div>`;
    case 5:
      return `<div class="tp tp-back" style="height:100%;overflow:hidden;"><div class="tp-hd" style="display:flex;align-items:center;gap:6px;padding-bottom:8px;border-bottom:1.5px solid ${tpl.borderColor};margin-bottom:10px;">${BI.church(tpl.accent)}<span style="font-size:13px;font-weight:700;color:${tpl.headerTextColor};letter-spacing:0.3px;">교회 안내</span></div><div class="tp-bd">
    <div class="tp-label" style="color:${tpl.accent}">${BI.wallet(tpl.accent)} 헌금 계좌</div><div class="tp-val">${escBr(s.account || "")}</div>
    <div class="tp-label" style="color:${tpl.accent}">${BI.mapPin(tpl.accent)} 주소</div><div class="tp-val">${escBr(s.address || "")}</div>
    <div class="tp-label" style="color:${tpl.accent}">${BI.phone(tpl.accent)} 전화</div><div class="tp-val">${esc(s.phone || "")}</div>
    <div class="tp-church-badge" style="background:${tpl.accent}">${esc(s.church)}</div></div></div>`;
    default:
      return "";
  }
}

/* 3면 접지 (Tri-fold) - 겉면: 교회 소식 | 교회 안내 | 표지, 속면: 예배 순서 | 말씀/칼럼 | 부서별 소식 */
function buildTriFold(db: BulletinDB): string {
  const churchNews = getTriFoldSectionHTML(db, 1), back = getTriFoldSectionHTML(db, 5), cover = getTriFoldSectionHTML(db, 0);
  const worship = getTriFoldSectionHTML(db, 2), sermon = getTriFoldSectionHTML(db, 3), deptNews = getTriFoldSectionHTML(db, 4);
  return `<div class="bp-tri">
    <div class="bp-spread bp-tri-out" style="display:grid;grid-template-columns:1fr 1fr 1fr;width:100%;height:${PREVIEW_PANEL_HEIGHT_PX}px;overflow:hidden;">
      <div class="bp-cell" style="max-height:${PREVIEW_PANEL_HEIGHT_PX}px;overflow:hidden;position:relative;">${churchNews}</div>
      <div class="bp-cell" style="max-height:${PREVIEW_PANEL_HEIGHT_PX}px;overflow:hidden;position:relative;">${back}</div>
      <div class="bp-cell" style="max-height:${PREVIEW_PANEL_HEIGHT_PX}px;overflow:hidden;position:relative;">${cover}</div>
    </div>
    <div class="bp-spread bp-tri-in" style="display:grid;grid-template-columns:1fr 1fr 1fr;width:100%;height:${PREVIEW_PANEL_HEIGHT_PX}px;overflow:hidden;">
      <div class="bp-cell" style="max-height:${PREVIEW_PANEL_HEIGHT_PX}px;overflow:hidden;position:relative;">${worship}</div>
      <div class="bp-cell" style="max-height:${PREVIEW_PANEL_HEIGHT_PX}px;overflow:hidden;position:relative;">${sermon}</div>
      <div class="bp-cell" style="max-height:${PREVIEW_PANEL_HEIGHT_PX}px;overflow:hidden;position:relative;">${deptNews}</div>
    </div>
  </div>`;
}

/* 4면: section index 0=표지(p1), 1=예배순서(p2), 2=교회/부서소식(p3), 3=교회안내(p4) */
function getHalfFoldSectionHTML(db: BulletinDB, index: number): string {
  const { c, s, tpl, decorStyle, esc, escBr, nl, orderRows, ads, bdays, departmentItems } = prepData(db);
  switch (index) {
    case 0: {
      const decor = decorStyle === "none"
        ? { topRight: "", bottomLeft: "" }
        : getDecorSVG(decorStyle, tpl.accent, tpl.gold);
      const hasCover = !!c.coverImage;
      const photoLayer = hasCover ? `
        <div style="width:100%;flex:0 0 35%;overflow:hidden;position:relative;">
          <img src="${c.coverImage}" style="width:100%;height:100%;object-fit:cover;display:block;opacity:${c.coverImageOpacity ?? 0.3};" />
        </div>` : "";
      return `<div class="bp bp-1" style="background-color:${tpl.headerBg}; border-bottom:2px solid ${tpl.borderColor}; height:100%; width:100%; min-height:100%; display:flex; flex-direction:column; position:relative; overflow:hidden; -webkit-print-color-adjust:exact; print-color-adjust:exact; color-adjust:exact;">
    <div class="bp-cover-bg" style="background-color:${tpl.headerBg}"></div>
    ${decor.topRight}${decor.bottomLeft}${decor.topLeft || ""}${decor.bottomRight || ""}
    <div class="bp-cover-content" style="color:${tpl.headerTextColor};position:relative;z-index:3;display:flex;flex-direction:column;align-items:center;width:100%;height:100%;padding:0;text-shadow:${hasCover ? 'none' : '0 1px 8px rgba(0,0,0,0.3)'};">
      <div style="flex:0 0 ${hasCover ? '9%' : '18%'};"></div>
      <div style="text-align:center;padding:0 20px;margin-bottom:10px;">
        <div style="font-size:20px;font-weight:900;color:${hasCover ? '#1a1a1a' : tpl.headerTextColor};letter-spacing:3px;white-space:nowrap;">${esc(s.church)}</div>
        ${s.churchSub ? `<div style="font-size:8px;color:${hasCover ? '#555' : tpl.headerTextColor};opacity:0.8;margin-top:3px;">${esc(s.churchSub)}</div>` : ""}
      </div>
      ${photoLayer}
      ${hasCover ? "" : `<div style="width:60px;height:1.5px;background:${tpl.gold};margin:8px auto;opacity:0.5;"></div>`}
      ${hasCover ? "" : BI.cross(tpl.headerTextColor)}
      ${c.pastor?.sermonTitle ? `<div style="font-size:12px;font-weight:700;margin-top:20px;margin-bottom:4px;text-align:center;padding:0 20px;">${esc(c.pastor.sermonTitle)}</div>` : ""}
      ${c.pastor?.sermonPassage ? `<div style="font-size:10px;opacity:0.8;margin-bottom:6px;padding:0 20px;">${esc(c.pastor.sermonPassage)}</div>` : ""}
      <div style="width:40px;height:1px;background:${tpl.gold};margin:4px auto;opacity:0.4;"></div>
      <div style="font-size:10px;opacity:0.85;margin-top:14px;">${esc(c.date || BULLETIN_DATE_STR)} 주일예배</div>
      <div style="font-size:9px;opacity:0.75;margin-top:2px;">${escBr(s.worshipTime || "")}</div>
      <div style="margin-top:28px;padding-top:8px;font-size:9px;opacity:0.75;text-align:center;">
        <div style="font-size:10px;font-weight:800;opacity:0.9;">${esc(s.pastor)}</div>
        ${s.staffList ? `<div style="font-size:7px;opacity:0.55;margin-top:1px;letter-spacing:0.5px;">${s.staffList.split("\n").map(l => esc(l.trim())).filter(Boolean).join(" · ")}</div>` : ""}
      </div>
    </div></div>`;
    }
    case 1:
      return `<div class="bp bp-2" style="height:100%;overflow:hidden;"><div class="bp-page-hd" style="display:flex;align-items:center;gap:6px;padding-bottom:8px;border-bottom:1.5px solid ${tpl.borderColor};margin-bottom:10px;">${BI.worship(tpl.accent)}<span style="font-size:13px;font-weight:700;color:${tpl.headerTextColor};letter-spacing:0.3px;">예배 순서</span></div><div class="bp-page-bd">
    ${orderRows ? `<table class="bp-otbl">${orderRows}</table>` : '<div class="bp-empty">예배 순서를 입력하세요</div>'}
    ${c.worship?.praise ? `<div class="bp-note">${BI.music(tpl.accent)} 찬양: ${esc(c.worship.praise)}</div>` : ""}
    ${c.worship?.special ? `<div class="bp-note">${BI.mic(tpl.accent)} ${esc(c.worship.special)}</div>` : ""}
    ${c.pastor?.column ? `<div class="bp-colbox" style="border-left-color:${tpl.gold}"><div class="bp-col-hd" style="color:${tpl.accent}">${BI.sermon(tpl.accent)} 목사님 칼럼</div><div class="bp-col-txt">${nl(c.pastor.column)}</div></div>` : ""}
  </div></div>`;
    case 2:
      return `<div class="bp bp-3" style="height:100%;overflow:hidden;"><div class="bp-page-hd" style="display:flex;align-items:center;gap:6px;padding-bottom:8px;border-bottom:1.5px solid ${tpl.borderColor};margin-bottom:10px;">${BI.news(tpl.accent)}<span style="font-size:13px;font-weight:700;color:${tpl.headerTextColor};letter-spacing:0.3px;">교회 소식 / 부서별 소식</span></div><div class="bp-page-bd">
    ${c.general?.content ? `<div class="bp-ad" style="border-left-color:${tpl.accent}"><div class="bp-ad-dept" style="color:${tpl.accent}">교회 소식</div><div class="bp-ad-txt">${nl(c.general.content)}</div></div>` : ""}
    ${c.general?.servants ? `<div class="bp-ad" style="border-left-color:${tpl.accent}"><div class="bp-ad-dept" style="color:${tpl.accent}">금주 봉사자</div><div class="bp-ad-txt">${nl(c.general.servants)}</div></div>` : ""}
    ${c.general?.offering ? `<div class="bp-ad" style="border-left-color:${tpl.accent}"><div class="bp-ad-dept" style="color:${tpl.accent}">헌금 보고</div><div class="bp-ad-txt">${nl(c.general.offering)}</div></div>` : ""}
    ${c.general?.schedule ? `<div class="bp-ad" style="border-left-color:${tpl.accent}"><div class="bp-ad-dept" style="color:${tpl.accent}">금주 일정</div><div class="bp-ad-txt">${nl(c.general.schedule)}</div></div>` : ""}
    ${bdays.length ? `<div class="bp-bday-sec"><div class="bp-sub-hd" style="color:${tpl.accent}">${BI.gift(tpl.accent)} 이번 주 생일</div><div class="bp-bday-list">${bdays.map(b => `<span class="bp-bday-tag" style="background:${tpl.accentLight};color:${tpl.accent}">${esc(b)}</span>`).join("")}</div></div>` : ""}
    ${departmentItems.length ? departmentItems.map(d => `<div class="bp-ad" style="border-left-color:${tpl.accent}"><div class="bp-ad-dept" style="color:${tpl.accent}">▶ ${esc(d.name)}</div><div class="bp-ad-txt">${nl(d.text)}</div></div>`).join("") : ""}
  </div></div>`;
    case 3:
      return `<div class="bp bp-4" style="height:100%;overflow:hidden;"><div class="bp-page-hd" style="display:flex;align-items:center;gap:6px;padding-bottom:8px;border-bottom:1.5px solid ${tpl.borderColor};margin-bottom:10px;">${BI.church(tpl.accent)}<span style="font-size:13px;font-weight:700;color:${tpl.headerTextColor};letter-spacing:0.3px;">교회 안내</span></div><div class="bp-page-bd">
    <div class="bp-igrid">
      ${c.general?.servants ? `<div class="bp-icell"><div class="bp-ititle" style="color:${tpl.accent}">${BI.users(tpl.accent)} 금주 봉사자</div><div class="bp-itxt">${nl(c.general.servants)}</div></div>` : ""}
      ${c.general?.schedule ? `<div class="bp-icell"><div class="bp-ititle" style="color:${tpl.accent}">${BI.calendar(tpl.accent)} 금주 일정</div><div class="bp-itxt">${nl(c.general.schedule)}</div></div>` : ""}
    </div>
    ${c.general?.offering ? `<div class="bp-offering"><div class="bp-ititle" style="color:${tpl.accent}">${BI.offering(tpl.accent)} 헌금 보고</div><div class="bp-itxt">${nl(c.general.offering)}</div></div>` : ""}
    <div class="bp-acct"><div class="bp-ititle" style="color:${tpl.accent}">${BI.wallet(tpl.accent)} 헌금 계좌</div><div class="bp-itxt">${escBr(s.account || "")}</div></div>
    <div class="bp-cfooter" style="background-color:${tpl.headerBg}; color:${tpl.headerTextColor}; border-top:2px solid ${tpl.borderColor}"><div class="bp-cf-name">${esc(s.church)}</div><div class="bp-cf-det">${BI.mapPin(tpl.accent)} ${escBr(s.address || "")}</div><div class="bp-cf-det">${BI.phone(tpl.accent)} ${esc(s.phone || "")}</div></div>
  </div></div>`;
    default:
      return "";
  }
}

/* 2면 접지 (Half-fold) - 표지/내지좌/내지우/뒷면 */
function buildHalfFold(db: BulletinDB): string {
  const p1 = getHalfFoldSectionHTML(db, 0), p2 = getHalfFoldSectionHTML(db, 1), p3 = getHalfFoldSectionHTML(db, 2), p4 = getHalfFoldSectionHTML(db, 3);
  return `<div class="bp-four-face">
    <div class="bp-spread" style="display:grid;grid-template-columns:1fr 1fr;width:100%;height:${PREVIEW_PANEL_HEIGHT_PX}px;overflow:hidden;">
      <div class="bp-cell" style="max-height:${PREVIEW_PANEL_HEIGHT_PX}px;overflow:hidden;position:relative;">${p4}</div>
      <div class="bp-cell" style="max-height:${PREVIEW_PANEL_HEIGHT_PX}px;overflow:hidden;position:relative;">${p1}</div>
    </div>
    <div class="bp-spread" style="display:grid;grid-template-columns:1fr 1fr;width:100%;height:${PREVIEW_PANEL_HEIGHT_PX}px;overflow:hidden;">
      <div class="bp-cell" style="max-height:${PREVIEW_PANEL_HEIGHT_PX}px;overflow:hidden;position:relative;">${p2}</div>
      <div class="bp-cell" style="max-height:${PREVIEW_PANEL_HEIGHT_PX}px;overflow:hidden;position:relative;">${p3}</div>
    </div>
  </div>`;
}

/* 온라인/PDF용 (모바일 친화적 카드형) — 간소화 + YouTube 영역 */
function buildOnlineHTML(db: BulletinDB): string {
  const { c, s, tpl, decorStyle, esc, escBr, nl, orderRows } = prepData(db);
  const decor = decorStyle === "none"
    ? { topRight: "", bottomLeft: "" }
    : getDecorSVG(decorStyle, tpl.accent, tpl.gold);
  const youtubeUrl = (c.youtubeUrl ?? "").trim();
  const youtubeVideoId = youtubeUrl ? extractYoutubeId(youtubeUrl) : null;
  return `<div class="bp-online" style="--ac:${tpl.accent};--al:${tpl.accentLight};--gold:${tpl.gold}">
    <div class="ol-header" style="background-color:${tpl.headerBg}; color:${tpl.headerTextColor}; border-bottom:2px solid ${tpl.borderColor}; position:relative; overflow:hidden; padding:24px;">
    ${decor.topRight}${decor.bottomLeft}${decor.topLeft || ""}${decor.bottomRight || ""}
    <div style="position:relative;z-index:2;text-align:center;text-shadow:${(c.coverImage || youtubeVideoId) ? 'none' : '0 1px 8px rgba(0,0,0,0.3)'};">
      <div style="text-align:center;padding:0 16px;margin-bottom:10px;">
        <div style="font-size:22px;font-weight:900;color:${(c.coverImage || youtubeVideoId) ? '#1a1a1a' : tpl.headerTextColor};letter-spacing:3px;white-space:nowrap;">${esc(s.church)}</div>
        ${s.churchSub ? `<div style="font-size:10px;color:${(c.coverImage || youtubeVideoId) ? '#555' : tpl.headerTextColor};opacity:0.8;margin-top:3px;">${esc(s.churchSub)}</div>` : ""}
      </div>
      ${youtubeVideoId ? `<div style="width:100%;overflow:hidden;margin:0 0 10px;max-height:200px;position:relative;border-radius:8px;"><a href="${esc(youtubeUrl)}" target="_blank" rel="noopener" style="display:block;position:relative;"><img src="https://img.youtube.com/vi/${youtubeVideoId}/maxresdefault.jpg" alt="예배 영상" style="width:100%;display:block;border-radius:8px;" onerror="this.src='https://img.youtube.com/vi/${youtubeVideoId}/hqdefault.jpg'" /><div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:68px;height:48px;background:rgba(255,0,0,0.85);border-radius:12px;display:flex;align-items:center;justify-content:center;"><div style="width:0;height:0;border-left:20px solid white;border-top:12px solid transparent;border-bottom:12px solid transparent;margin-left:4px;"></div></div></a></div>` : c.coverImage ? `<div style="width:100%;overflow:hidden;margin:0 0 10px;max-height:200px;position:relative;"><img src="${c.coverImage}" style="width:100%;height:100%;object-fit:cover;display:block;opacity:${c.coverImageOpacity ?? 0.3};" /></div>` : ""}
      ${(c.coverImage || youtubeVideoId) ? "" : `<div style="width:50px;height:1.5px;background:${tpl.gold};margin:8px auto;opacity:0.5;"></div>`}
      ${(c.coverImage || youtubeVideoId) ? "" : BI.cross(tpl.headerTextColor)}
      ${c.pastor?.sermonTitle ? `<div style="font-size:14px;font-weight:700;margin-top:${(c.coverImage || youtubeVideoId) ? '16px' : '0'};margin-bottom:4px;">${esc(c.pastor.sermonTitle)}</div>` : ""}
      <div style="font-size:10px;opacity:0.85;margin-top:12px;">${esc(c.date || BULLETIN_DATE_STR)} 주일예배 · ${escBr(s.worshipTime || "")}</div>
    </div></div>
    <div class="ol-sermon"><div class="ol-sec-t" style="display:flex;align-items:center;gap:6px;padding-bottom:8px;border-bottom:1.5px solid ${tpl.borderColor};margin-bottom:10px;">${BI.sermon(tpl.accent)}<span style="font-size:13px;font-weight:700;color:${tpl.headerTextColor};letter-spacing:0.3px;">설교 제목 / 성경 본문 / 설교 주제</span></div>${c.pastor?.sermonTitle ? `<div class="ol-sermon-t">${esc(c.pastor.sermonTitle)}</div>` : ""}${c.pastor?.sermonPassage ? `<div class="ol-sermon-p">${esc(c.pastor.sermonPassage)}</div>` : ""}${c.pastor?.sermonTheme ? `<div class="ol-sermon-th">${esc(c.pastor.sermonTheme)}</div>` : ""}${!c.pastor?.sermonTitle && !c.pastor?.sermonPassage && !c.pastor?.sermonTheme ? `<div class="bp-empty" style="font-size:12px;color:#9ca3af;">입력된 내용이 없습니다</div>` : ""}</div>
    <div class="ol-body">
      <div class="ol-sec"><div class="ol-sec-t" style="display:flex;align-items:center;gap:6px;padding-bottom:8px;border-bottom:1.5px solid ${tpl.borderColor};margin-bottom:10px;">${BI.worship(tpl.accent)}<span style="font-size:13px;font-weight:700;color:${tpl.headerTextColor};letter-spacing:0.3px;">예배 순서</span></div>${orderRows ? `<table class="bp-otbl">${orderRows}</table>` : '<div class="bp-empty">예배 순서 없음</div>'}${c.worship?.praise ? `<div class="ol-note">${BI.music(tpl.accent)} ${esc(c.worship.praise)}</div>` : ""}${c.worship?.special ? `<div class="ol-note">${BI.mic(tpl.accent)} ${esc(c.worship.special)}</div>` : ""}</div>
      <div class="ol-sec"><div class="ol-sec-t" style="display:flex;align-items:center;gap:6px;padding-bottom:8px;border-bottom:1.5px solid ${tpl.borderColor};margin-bottom:10px;">${BI.news(tpl.accent)}<span style="font-size:13px;font-weight:700;color:${tpl.headerTextColor};letter-spacing:0.3px;">교회 소식</span></div>${c.general?.content ? `<div class="ol-ad"><div class="ol-ad-dept">교회 소식</div><div class="ol-ad-txt">${nl(c.general.content)}</div></div>` : `<div class="bp-empty" style="font-size:12px;color:#9ca3af;">입력된 내용이 없습니다</div>`}</div>
    </div>
    <div class="ol-footer" style="background-color:${tpl.accent}; color:#ffffff;"><div>${esc(s.church)}</div><div>${escBr(s.address || "")} · ${BI.phone("#ffffff")} ${esc(s.phone || "")}</div><div>${escBr(s.account || "")}</div></div>
  </div>`;
}

function buildPreviewHTML(db: BulletinDB, mode: OutputMode, fmt: PrintFormat): string {
  if (mode === "online") return buildOnlineHTML(db);
  if (fmt === "fold3") return buildTriFold(db);
  return buildHalfFold(db);
}

type SubPage = "dash" | "edit" | "history" | "settings";
type BulletinFormat = "6면" | "4면" | "온라인";
type BulletinView = "all" | "cover" | "inner" | "back" | "outside" | "inside";
const VIEW_FOLD2: BulletinView[] = ["all", "cover", "inner", "back"];
const VIEW_FOLD3: BulletinView[] = ["all", "outside", "inside"];
const VIEW_LABEL: Record<BulletinView, string> = { all: "전체", cover: "표지", inner: "내지", back: "뒷면", outside: "겉면", inside: "속면" };
const PAGE_INFO: Record<SubPage, { title: string; desc: string }> = {
  dash: { title: "대시보드", desc: "이번 주 주보 제출 현황" },
  edit: { title: "주보 편집", desc: "내용 입력 시 실시간 미리보기" },
  history: { title: "지난 주보", desc: "이전에 만든 주보" },
  settings: { title: "설정", desc: "교회 기본 정보" },
};

const NAV_ITEMS: { id: SubPage; Icon: LucideIcon; label: string }[] = [
  { id: "dash", Icon: LayoutDashboard, label: "대시보드" },
  { id: "edit", Icon: Edit3, label: "주보 편집" },
  { id: "history", Icon: Archive, label: "지난 주보" },
  { id: "settings", Icon: Settings, label: "설정" },
];

export function BulletinPage() {
  const mob = useIsMobile();
  const [db, setDb] = useState<BulletinDB>(() => loadBulletin());
  const [supabaseLoaded, setSupabaseLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const cid = getChurchId();
        if (!cid) {
          setSupabaseLoaded(true);
          return;
        }
        const remote = await loadBulletinFromSupabase(cid);
        if (cancelled) return;
        if (remote && typeof remote === "object" && Object.keys(remote).length > 0) {
          console.log("[Bulletin] Supabase에서 데이터 로드됨");
          const remoteDb = remote as unknown as BulletinDB;
          setDb((prev) => {
            const merged: BulletinDB = {
              settings: { ...prev.settings, ...(remoteDb.settings || {}) },
              current: { ...prev.current, ...(remoteDb.current || {}) },
              history:
                remoteDb.history && remoteDb.history.length > 0
                  ? remoteDb.history
                  : prev.history,
            };
            saveBulletin(merged);
            return merged;
          });
        }
      } catch (e) {
        console.warn("[Bulletin] Supabase 로드 실패, localStorage 사용:", e);
      } finally {
        if (!cancelled) setSupabaseLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const [activeSub, setActiveSub] = useState<SubPage>(() => {
    if (typeof window !== "undefined") {
      const v = sessionStorage.getItem("bulletin-activeSub");
      if (v === "edit" || v === "history" || v === "settings" || v === "dash") return v;
      return "dash";
    }
    return "dash";
  });
  useEffect(() => {
    sessionStorage.setItem("bulletin-activeSub", activeSub);
  }, [activeSub]);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    cover: false, worship: false, sermon: false,
    churchNews: false, departments: false, info: false,
  });
  const toggleSection = (key: string) =>
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));
  const [currentPageHistory, setCurrentPageHistory] = useState(1);
  const listRefHistory = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const dashPreviewRef = useRef<HTMLDivElement>(null);
  const [previewView, setPreviewView] = useState<BulletinView>("all");
  const [previewScale, setPreviewScale] = useState(mob ? 0.45 : 1.0);
  const [previewZoomDraft, setPreviewZoomDraft] = useState<string | null>(null);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [outputMode, setOutputMode] = useState<OutputMode>("print");
  const [printFormat, setPrintFormat] = useState<PrintFormat>("fold3");
  const kakaoCardRef = useRef<HTMLDivElement>(null);
  const [dashPreviewScale, setDashPreviewScale] = useState(1.0);
  const [dashZoomDraft, setDashZoomDraft] = useState("");
  const [dashPanX, setDashPanX] = useState(0);
  const [dashPanY, setDashPanY] = useState(0);
  const [showFullPreview, setShowFullPreview] = useState(false);
  const [fullPreviewHtml, setFullPreviewHtml] = useState("");
  const [showDashPanelMobile, setShowDashPanelMobile] = useState(false);
  const [showFormatPanel, setShowFormatPanel] = useState(false);

  const bulletinFormatDisplay: BulletinFormat = outputMode === "online" ? "온라인" : printFormat === "fold3" ? "6면" : "4면";
  const getPreviewStyle = (): { width: number; minHeight: number; padding: number } => {
    switch (bulletinFormatDisplay) {
      case "6면": return { width: 1134, minHeight: 637, padding: 30 };
      case "4면": return { width: 756, minHeight: 1274, padding: 0 };
      case "온라인": return { width: 595, minHeight: 842, padding: 24 };
    }
  };
  const ps = getPreviewStyle();
  const setBulletinFormat = useCallback((f: BulletinFormat) => {
    if (f === "온라인") setOutputMode("online");
    else {
      setOutputMode("print");
      setPrintFormat(f === "6면" ? "fold3" : "fold2");
    }
    if (typeof sessionStorage !== "undefined") sessionStorage.setItem("bulletin-format", f);
  }, []);

  useEffect(() => {
    const s = typeof sessionStorage !== "undefined" ? sessionStorage.getItem("bulletin-format") : null;
    if (s === "온라인") setOutputMode("online");
    else if (s === "4면") { setOutputMode("print"); setPrintFormat("fold2"); }
    else if (s === "6면") { setOutputMode("print"); setPrintFormat("fold3"); }
  }, []);

  useEffect(() => {
    const styleId = "bulletin-print-media-style";
    const existing = document.getElementById(styleId);
    if (existing) existing.remove();

    const bulletinFormat = bulletinFormatDisplay;
    let pageSize: string;
    if (bulletinFormat === "6면") {
      pageSize = "size: 378mm 212mm; margin: 0;";
    } else if (bulletinFormat === "4면") {
      pageSize = "size: 254mm 212mm; margin: 0;";
    } else {
      pageSize = "size: A4 portrait; margin: 10mm;";
    }

    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = `
      @media print {
        @page { ${pageSize} }
        * {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
          color-adjust: exact !important;
        }
        html, body { margin: 0 !important; padding: 0 !important; }
        body > *:not(#bulletin-print-only) { display: none !important; }
        #bulletin-print-only {
          display: block !important;
          visibility: visible !important;
          position: static !important;
          left: auto !important;
          width: 100% !important;
          height: auto !important;
          background: white !important;
        }
        .bulletin-preview-display { display: none !important; }
        .print-spread {
          display: grid !important;
          width: 100% !important;
          height: 100vh !important;
          page-break-after: always !important;
          page-break-inside: avoid !important;
          break-inside: avoid !important;
          overflow: hidden !important;
          box-sizing: border-box !important;
        }
        .print-spread:last-child {
          page-break-after: auto !important;
        }
        .print-cell {
          height: 100% !important;
          overflow: hidden !important;
          padding: 6mm !important;
          border-right: 0.3pt solid #ccc !important;
          box-sizing: border-box !important;
          position: relative !important;
        }
        .print-cell:last-child {
          border-right: none !important;
        }
        .print-cell > * {
          height: 100% !important;
          min-height: 100% !important;
          box-sizing: border-box !important;
        }
        .print-cell .tp-cover {
          height: 100% !important;
          min-height: 100% !important;
          width: 100% !important;
          display: flex !important;
          flex-direction: column !important;
          justify-content: center !important;
          align-items: center !important;
        }
      }
    `;
    document.head.appendChild(style);
    return () => {
      const el = document.getElementById(styleId);
      if (el) el.remove();
    };
  }, [bulletinFormatDisplay]);
  const zoomIn = () => setPreviewScale(s => Math.min(parseFloat((s + 0.05).toFixed(2)), 2.0));
  const zoomOut = () => setPreviewScale(s => Math.max(parseFloat((s - 0.05).toFixed(2)), 0.25));
  const zoomReset = () => {
    setPreviewScale(mob ? 0.45 : 1.0);
    setPanX(0);
    setPanY(0);
  };
  const dashZoomReset = () => {
    setDashPreviewScale(1.0);
    setDashPanX(0);
    setDashPanY(0);
  };
  const defaultPreviewScale = mob ? 0.45 : 1.0;
  const previewPanZoomRef = useRef<HTMLDivElement>(null);
  const dashPanZoomRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const dashDragStartRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const touchStartRef = useRef<{ x: number; y: number; panX: number; panY: number; touches: number; pinchScale?: number; pinchDist?: number } | null>(null);
  const dashTouchStartRef = useRef<{ x: number; y: number; panX: number; panY: number; touches: number; pinchScale?: number; pinchDist?: number } | null>(null);
  const [previewDragging, setPreviewDragging] = useState(false);
  const [dashDragging, setDashDragging] = useState(false);

  const getTouchPoint = (e: React.TouchEvent) => ({ x: e.touches[0].clientX, y: e.touches[0].clientY });
  const getTouchDistance = (e: React.TouchEvent) =>
    e.touches.length >= 2
      ? Math.hypot(e.touches[1].clientX - e.touches[0].clientX, e.touches[1].clientY - e.touches[0].clientY)
      : 0;
  const getTouchCenter = (e: React.TouchEvent) =>
    e.touches.length >= 2
      ? { x: (e.touches[0].clientX + e.touches[1].clientX) / 2, y: (e.touches[0].clientY + e.touches[1].clientY) / 2 }
      : getTouchPoint(e);

  const onPreviewMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    dragStartRef.current = { x: e.clientX, y: e.clientY, panX, panY };
    setPreviewDragging(true);
  }, [panX, panY]);
  const onPreviewMouseMove = useCallback((e: MouseEvent) => {
    const start = dragStartRef.current;
    if (!start) return;
    setPanX(start.panX + e.clientX - start.x);
    setPanY(start.panY + e.clientY - start.y);
  }, []);
  const onPreviewMouseUp = useCallback(() => {
    dragStartRef.current = null;
    setPreviewDragging(false);
  }, []);
  useEffect(() => {
    if (!previewDragging) return;
    document.addEventListener("mousemove", onPreviewMouseMove);
    document.addEventListener("mouseup", onPreviewMouseUp);
    return () => {
      document.removeEventListener("mousemove", onPreviewMouseMove);
      document.removeEventListener("mouseup", onPreviewMouseUp);
    };
  }, [previewDragging, onPreviewMouseMove, onPreviewMouseUp]);

  const onPreviewWheel = useCallback((e: WheelEvent) => {
    if (!e.ctrlKey) return;
    e.preventDefault();
    setPreviewScale(s => Math.min(2, Math.max(0.25, s - e.deltaY * 0.002)));
  }, []);
  useEffect(() => {
    const el = previewPanZoomRef.current;
    if (!el) return;
    el.addEventListener("wheel", onPreviewWheel, { passive: false });
    return () => el.removeEventListener("wheel", onPreviewWheel);
  }, [onPreviewWheel]);
  useEffect(() => {
    const el = previewPanZoomRef.current;
    if (!el) return;
    const preventTouch = (e: TouchEvent) => { if (touchStartRef.current && e.touches.length >= 1) e.preventDefault(); };
    el.addEventListener("touchmove", preventTouch, { passive: false });
    return () => el.removeEventListener("touchmove", preventTouch);
  }, []);
  const onPreviewDoubleClick = useCallback(() => {
    setPreviewScale(defaultPreviewScale);
    setPanX(0);
    setPanY(0);
  }, [defaultPreviewScale]);

  const onPreviewTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, panX, panY, touches: 1 };
    } else if (e.touches.length >= 2) {
      const dist = getTouchDistance(e);
      const center = getTouchCenter(e);
      touchStartRef.current = { x: center.x, y: center.y, panX, panY, touches: 2, pinchScale: previewScale, pinchDist: dist };
    }
  }, [panX, panY, previewScale]);
  const onPreviewTouchMove = useCallback((e: React.TouchEvent) => {
    const start = touchStartRef.current;
    if (!start) return;
    if (e.touches.length === 1 && start.touches === 1) {
      e.preventDefault();
      setPanX(start.panX + e.touches[0].clientX - start.x);
      setPanY(start.panY + e.touches[0].clientY - start.y);
    } else if (e.touches.length >= 2 && start.touches === 2 && start.pinchDist != null && start.pinchScale != null) {
      e.preventDefault();
      const dist = getTouchDistance(e);
      const scale = (dist / start.pinchDist) * start.pinchScale;
      setPreviewScale(Math.min(2, Math.max(0.25, scale)));
    }
  }, []);
  const onPreviewTouchEnd = useCallback((e: React.TouchEvent) => {
    if (e.touches.length < 2) touchStartRef.current = null;
  }, []);

  const onDashMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    dashDragStartRef.current = { x: e.clientX, y: e.clientY, panX: dashPanX, panY: dashPanY };
    setDashDragging(true);
  }, [dashPanX, dashPanY]);
  const onDashMouseMove = useCallback((e: MouseEvent) => {
    const start = dashDragStartRef.current;
    if (!start) return;
    setDashPanX(start.panX + e.clientX - start.x);
    setDashPanY(start.panY + e.clientY - start.y);
  }, []);
  const onDashMouseUp = useCallback(() => {
    dashDragStartRef.current = null;
    setDashDragging(false);
  }, []);
  useEffect(() => {
    if (!dashDragging) return;
    document.addEventListener("mousemove", onDashMouseMove);
    document.addEventListener("mouseup", onDashMouseUp);
    return () => {
      document.removeEventListener("mousemove", onDashMouseMove);
      document.removeEventListener("mouseup", onDashMouseUp);
    };
  }, [dashDragging, onDashMouseMove, onDashMouseUp]);

  const onDashWheel = useCallback((e: WheelEvent) => {
    if (!e.ctrlKey) return;
    e.preventDefault();
    setDashPreviewScale(s => Math.min(2, Math.max(0.25, s - e.deltaY * 0.002)));
  }, []);
  useEffect(() => {
    const el = dashPanZoomRef.current;
    if (!el) return;
    el.addEventListener("wheel", onDashWheel, { passive: false });
    return () => el.removeEventListener("wheel", onDashWheel);
  }, [onDashWheel]);
  useEffect(() => {
    const el = dashPanZoomRef.current;
    if (!el) return;
    const preventTouch = (e: TouchEvent) => { if (dashTouchStartRef.current && e.touches.length >= 1) e.preventDefault(); };
    el.addEventListener("touchmove", preventTouch, { passive: false });
    return () => el.removeEventListener("touchmove", preventTouch);
  }, []);
  const onDashDoubleClick = useCallback(() => {
    dashZoomReset();
  }, []);
  const onDashTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      dashTouchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, panX: dashPanX, panY: dashPanY, touches: 1 };
    } else if (e.touches.length >= 2) {
      const dist = getTouchDistance(e);
      const center = getTouchCenter(e);
      dashTouchStartRef.current = { x: center.x, y: center.y, panX: dashPanX, panY: dashPanY, touches: 2, pinchScale: dashPreviewScale, pinchDist: dist };
    }
  }, [dashPanX, dashPanY, dashPreviewScale]);
  const onDashTouchMove = useCallback((e: React.TouchEvent) => {
    const start = dashTouchStartRef.current;
    if (!start) return;
    if (e.touches.length === 1 && start.touches === 1) {
      e.preventDefault();
      setDashPanX(start.panX + e.touches[0].clientX - start.x);
      setDashPanY(start.panY + e.touches[0].clientY - start.y);
    } else if (e.touches.length >= 2 && start.touches === 2 && start.pinchDist != null && start.pinchScale != null) {
      e.preventDefault();
      const dist = getTouchDistance(e);
      const scale = (dist / start.pinchDist) * start.pinchScale;
      setDashPreviewScale(Math.min(2, Math.max(0.25, scale)));
    }
  }, []);
  const onDashTouchEnd = useCallback((e: React.TouchEvent) => {
    if (e.touches.length < 2) dashTouchStartRef.current = null;
  }, []);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    saveBulletin(db);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      try {
        const cid = getChurchId();
        if (cid) {
          saveBulletinToSupabase(db as unknown as Record<string, unknown>, cid)
            .then((ok) => {
              if (ok) console.log("[Bulletin] Supabase 저장 완료");
            })
            .catch((e) => console.warn("[Bulletin] Supabase 저장 실패:", e));
        }
      } catch (e) {
        console.warn("[Bulletin] Supabase 저장 중 예외:", e);
      }
    }, 2000);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [db]);

  const [toasts, setToasts] = useState<{ id: number; msg: string }[]>([]);
  const showToast = useCallback((msg: string) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, msg }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 2500);
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined" && window.Kakao && !window.Kakao.isInitialized()) {
      window.Kakao.init("f4699f7c23c13caf0f5de8ec220151a7");
    }
  }, []);

  const getCaptureTarget = useCallback((): HTMLElement | null => {
    if (kakaoCardRef.current) return kakaoCardRef.current;
    const byId = document.getElementById("bulletin-print-area");
    if (byId) return byId;
    const el = document.querySelector("[data-bulletin-preview]") as HTMLElement;
    return el || previewRef.current;
  }, []);

  const handleDownloadCard = useCallback(async () => {
    const el = getCaptureTarget();
    if (!el) { showToast("미리보기를 먼저 확인해주세요"); return; }
    try {
      await downloadElementAsImage(el, `주보_카카오_${fds(TODAY)}.png`);
      showToast("이미지가 다운로드되었습니다");
    } catch { showToast("이미지 저장에 실패했습니다"); }
  }, [getCaptureTarget, showToast]);

  const handleKakaoShare = useCallback(async () => {
    const isMobile = typeof navigator !== "undefined" && /Android|iPhone|iPad/i.test(navigator.userAgent);
    initKakao();
    if (isMobile && typeof window !== "undefined" && window.Kakao?.isInitialized()) {
      window.Kakao.Share.sendDefault({
        objectType: "feed",
        content: {
          title: `${db.settings.church || "교회"} 주일예배`,
          description: `${db.current.date}\n설교: ${db.current.pastor?.sermonTitle || ""}\n본문: ${db.current.pastor?.sermonPassage || ""}`,
          imageUrl: window.location.origin + "/icons/icon-192x192.png",
          link: { mobileWebUrl: window.location.href, webUrl: window.location.href },
        },
      });
    } else {
      await handleDownloadCard();
      showToast("이미지가 다운로드되었습니다. 카카오톡에서 공유해주세요!");
    }
  }, [db, handleDownloadCard, showToast]);

  const handleNav = (id: SubPage) => {
    setActiveSub(id);
    if (id === "history") setCurrentPageHistory(1);
  };

  const scrollToSection = (sec: string) => {
    setActiveSub("edit");
    setTimeout(() => {
      const el = document.getElementById("sec-" + sec);
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  };

  const saveFields = useCallback(() => {
    // db.current에 이미 controlled input의 최신 값이 들어있으므로 DOM에서 읽을 필요 없음 — 단순히 localStorage에 저장
    saveBulletin(db);
  }, [db]);

  const updatePreview = useCallback(() => {
    saveFields();
    if (previewRef.current) {
      previewRef.current.innerHTML = buildPreviewHTML(db, outputMode, printFormat);
    }
  }, [db, saveFields, outputMode, printFormat]);

  useEffect(() => {
    const html = buildPreviewHTML(db, outputMode, printFormat);
    const t = setTimeout(() => {
      if (previewRef.current) previewRef.current.innerHTML = html;
      if (dashPreviewRef.current) dashPreviewRef.current.innerHTML = html;
    }, 0);
    return () => clearTimeout(t);
  }, [activeSub, db, outputMode, printFormat]);

  const setCurrent = useCallback((updater: (c: CurrentBulletin) => CurrentBulletin) => {
    setDb(prev => ({ ...prev, current: updater(prev.current) }));
  }, []);

  const saveToHistory = () => {
    setDb((prev) => {
      // prev.current에 이미 최신 데이터가 있으므로 DOM에서 읽지 않음
      const cur = {
        ...prev.current,
        savedAt: fds(TODAY),
      };
      const sermonTitle = cur.pastor?.sermonTitle || "제목없음";
      const key = cur.savedAt;
      const historyEntry = { ...cur, sermonTitle, key };

      const idx = prev.history.findIndex((h) => h.key === key);
      const newHistory = [...prev.history];
      if (idx >= 0) {
        newHistory[idx] = historyEntry;
      } else {
        newHistory.unshift(historyEntry);
      }

      const newDb = { ...prev, current: cur, history: newHistory };
      saveBulletin(newDb);
      return newDb;
    });
    showToast("주보가 저장되었습니다");
  };

  const loadHistory = (key: string) => {
    const h = db.history.find(x => x.key === key);
    if (!h) {
      showToast("찾을 수 없습니다");
      return;
    }
    const loaded = JSON.parse(JSON.stringify(h)) as CurrentBulletin & { youth?: { content?: string }; education?: { content?: string }; mission?: { content?: string } };
    if (loaded.coverImage === undefined) loaded.coverImage = "";
    if (loaded.coverImageOpacity === undefined) loaded.coverImageOpacity = 0.3;
    if (!loaded.departments || !Array.isArray(loaded.departments.enabled)) {
      loaded.departments = { enabled: [], data: {} };
    }
    const dept = loaded.departments;
    if (loaded.youth?.content) {
      if (!dept.enabled.includes("cheongnyeon")) dept.enabled.push("cheongnyeon");
      dept.data = dept.data || {}; dept.data.cheongnyeon = loaded.youth.content;
    }
    if (loaded.education?.content) {
      if (!dept.enabled.includes("gyoyuk")) dept.enabled.push("gyoyuk");
      dept.data = dept.data || {}; dept.data.gyoyuk = loaded.education.content;
    }
    if (loaded.mission?.content) {
      if (!dept.enabled.includes("seonkyo")) dept.enabled.push("seonkyo");
      dept.data = dept.data || {}; dept.data.seonkyo = loaded.mission.content;
    }
    const o = loaded as unknown as Record<string, unknown>;
    delete o.youth;
    delete o.education;
    delete o.mission;
    setDb(prev => ({ ...prev, current: loaded }));
    setActiveSub("edit");
    showToast("불러왔습니다");
  };

  const secEntries = Object.entries(SECTIONS) as [SectionKey, { name: string; desc: string }][];
  const submittedCount = secEntries.filter(([k]) => getSectionSubmitted(db, k)).length;
  const info = PAGE_INFO[activeSub];
  const dbRef = useRef(db);
  useEffect(() => { dbRef.current = db; }, [db]);

  const getBulletinStyles = () => {
    const el = document.getElementById("bulletin-print-styles");
    return el ? (el.textContent || el.innerHTML || "") : "";
  };

  const handlePreview = useCallback(() => {
    saveFields();
    setTimeout(() => {
      const el = document.getElementById("bulletin-print-area");
      setFullPreviewHtml(el?.innerHTML ?? "");
      setShowFullPreview(true);
    }, 300);
  }, [saveFields]);

  const handlePrint = useCallback(() => {
    if (typeof saveFields === "function") saveFields();
    setTimeout(() => window.print(), 300);
  }, []);

  const navSections = [{ sectionLabel: "주보", items: NAV_ITEMS.map((n) => ({ id: n.id, label: n.label, Icon: n.Icon })) }];

  return (
    <UnifiedPageLayout
      pageTitle="주보"
      pageSubtitle={new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" })}
      navSections={navSections}
      activeId={activeSub}
      onNav={(id) => handleNav(id as SubPage)}
      versionText="주보 v1.0"
      headerTitle={info.title}
      headerDesc={info.desc}
      headerActions={
        activeSub === "edit" ? (
          <button type="button" onClick={saveToHistory} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px", backgroundColor: "#111827", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 500, color: "#ffffff", cursor: "pointer" }}>
            <Save size={14} /> 저장
          </button>
        ) : null
      }
      SidebarIcon={Newspaper}
    >
        <div style={{ flex: 1, overflowY: "auto", padding: mob ? 12 : 20 }} className="bulletin-page-content">
          {activeSub === "dash" && (() => {
            return (
            <div className="flex" style={{ height: "calc(100vh - 120px)", minHeight: 0 }}>
              <div className={`${mob && !showDashPanelMobile ? "hidden" : ""} md:block w-[420px] flex-shrink-0 border-r border-gray-100 bg-white overflow-y-auto`}>
                <div className="p-6 space-y-5">
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { label: "이번 주 주보", value: BULLETIN_DATE_STR },
                      { label: "제출 현황", value: `${submittedCount}/6` },
                      { label: "작성률", value: "—" },
                      { label: "누적 주보", value: String(db.history.length) },
                    ].map((card, i) => (
                      <div key={i} className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                        <p className="text-[11px] text-gray-400 mb-1">{card.label}</p>
                        <p className="text-lg font-semibold text-gray-900">{card.value}</p>
                      </div>
                    ))}
                  </div>
                  <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                    <div className="flex justify-between items-center mb-3">
                      <h3 className="text-[13px] font-medium text-gray-900">부서별 제출 현황</h3>
                      <button type="button" onClick={() => showToast("마감 알림 (데모)")} className="text-[11px] text-blue-500 hover:text-blue-600">마감 알림</button>
                    </div>
                    <div className="space-y-2">
                      {secEntries.map(([k, v]) => {
                        const done = getSectionSubmitted(db, k);
                        return (
                          <div key={k} className="flex items-center justify-between py-2">
                            <div className="flex items-center gap-2">
                              <div className={`w-2 h-2 rounded-full ${done ? "bg-green-500" : "bg-red-400"}`} />
                              <span className="text-sm text-gray-700">{v.name}</span>
                            </div>
                            <span className={`text-[11px] px-2 py-0.5 rounded-full ${done ? "bg-green-50 text-green-600" : "bg-red-50 text-red-500"}`}>
                              {done ? "제출완료" : "미제출"}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                    <h3 className="text-[13px] font-medium text-gray-900 mb-3">최근 주보</h3>
                    {db.history.length === 0 ? (
                      <p className="text-[13px] text-gray-400">저장된 주보가 없습니다</p>
                    ) : (
                      <div className="space-y-2">
                        {db.history.slice(-5).reverse().map(h => (
                          <div key={h.key} className="flex items-center justify-between py-2">
                            <div><span className="text-sm text-gray-700">{h.date}</span><span className="text-[11px] text-gray-400 ml-1">{h.sermonTitle || "제목 없음"}</span></div>
                            <button type="button" onClick={() => loadHistory(h.key)} className="text-[11px] text-blue-500 hover:text-blue-600">불러오기</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex-1 flex flex-col overflow-hidden bg-white min-w-0">
                {mob && (
                  <button type="button" onClick={() => setShowDashPanelMobile(v => !v)} className="md:hidden w-full px-4 py-2 text-sm text-gray-600 bg-white border-b border-gray-100 flex-shrink-0">
                    대시보드 정보 보기
                  </button>
                )}
                {/* ── 대시보드 툴바 ── */}
                <div className="flex-shrink-0 border-b border-gray-200 bg-gray-50">
                  {/* 상단: 포맷 선택 */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "12px 16px 8px" }}>
                    <div className="inline-flex items-center bg-white border border-gray-200 rounded-lg p-0.5 shadow-sm">
                      {(["6면", "4면", "온라인"] as BulletinFormat[]).map((format) => (
                        <button
                          key={format}
                          type="button"
                          onClick={() => setBulletinFormat(format)}
                          style={{
                            padding: "6px 16px",
                            fontSize: 13,
                            fontWeight: 600,
                            borderRadius: 6,
                            transition: "all 0.15s",
                            ...(bulletinFormatDisplay === format
                              ? { background: "#111827", color: "#ffffff", boxShadow: "0 1px 2px rgba(0,0,0,0.1)" }
                              : { background: "transparent", color: "#6b7280", cursor: "pointer" }),
                          }}
                        >
                          {format}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 하단: 액션 버튼 + 줌 */}
                  <div className="flex items-center justify-between px-4 pb-3">
                    {/* 왼쪽: 액션 버튼들 */}
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={handlePrint}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
                      >
                        <Printer size={13} /> 인쇄
                      </button>
                      <button
                        type="button"
                        onClick={handleKakaoShare}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-yellow-400 border border-yellow-400 rounded-lg hover:bg-yellow-500 transition-colors shadow-sm"
                      >
                        카카오 공유
                      </button>
                    </div>

                    {/* 오른쪽: 줌 + 편집/미리보기 */}
                    <div className="flex items-center gap-3">
                      {/* 줌 컨트롤 */}
                      <div className="inline-flex items-center bg-white border border-gray-200 rounded-lg shadow-sm">
                        <button
                          type="button"
                          onClick={() => setDashPreviewScale(s => Math.max(0.25, parseFloat((s - 0.05).toFixed(2))))}
                          className="w-7 h-7 flex items-center justify-center text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-l-lg transition-colors text-sm"
                        >
                          −
                        </button>
                        <input
                          type="text"
                          value={dashZoomDraft || `${Math.round(dashPreviewScale * 100)}%`}
                          onChange={(e) => {
                            const raw = e.target.value.replace(/[^0-9]/g, "");
                            setDashZoomDraft(raw);
                            const num = parseInt(raw, 10);
                            if (!isNaN(num) && num >= 25 && num <= 200) {
                              setDashPreviewScale(num / 100);
                            }
                          }}
                          onFocus={(e) => {
                            setDashZoomDraft(String(Math.round(dashPreviewScale * 100)));
                            setTimeout(() => (e.target as HTMLInputElement).select(), 0);
                          }}
                          onBlur={() => {
                            const num = parseInt(dashZoomDraft, 10);
                            if (isNaN(num) || num < 25) setDashPreviewScale(0.25);
                            else if (num > 200) setDashPreviewScale(2.0);
                            setDashZoomDraft("");
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                          }}
                          className="w-12 text-center text-xs text-gray-600 font-medium bg-transparent outline-none"
                          style={{ height: "28px", padding: 0, border: "none", borderLeft: "1px solid #e5e7eb", borderRight: "1px solid #e5e7eb" }}
                        />
                        <button
                          type="button"
                          onClick={() => setDashPreviewScale(s => Math.min(2.0, parseFloat((s + 0.05).toFixed(2))))}
                          className="w-7 h-7 flex items-center justify-center text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-r-lg transition-colors text-sm"
                        >
                          +
                        </button>
                      </div>

                      {/* 미리보기 & 편집 */}
                      <button
                        type="button"
                        onClick={handlePreview}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
                      >
                        <Eye size={13} /> 미리보기
                      </button>
                      <button
                        type="button"
                        onClick={() => handleNav("edit")}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                      >
                        <Edit3 size={13} /> 편집
                      </button>
                    </div>
                  </div>
                </div>
                <div className="flex-1 overflow-auto bg-white" style={{ minHeight: 0, display: "flex", justifyContent: "center", alignItems: "flex-start", padding: "16px" }}>
                  <div
                    className="bulletin-preview-display"
                    id="bulletin-print-container"
                    style={{
                      width: "100%",
                      minHeight: "calc(100vh - 170px)",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      padding: "24px 16px",
                      backgroundColor: "#ffffff",
                    }}
                  >
                    <div
                      ref={dashPanZoomRef}
                      style={{
                        width: "100%",
                        height: "calc(100vh - 170px)",
                        minHeight: 400,
                        overflow: "hidden",
                        cursor: dashDragging ? "grabbing" : "grab",
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                      }}
                      onMouseDown={onDashMouseDown}
                      onDoubleClick={onDashDoubleClick}
                      onTouchStart={onDashTouchStart}
                      onTouchMove={onDashTouchMove}
                      onTouchEnd={onDashTouchEnd}
                      onTouchCancel={onDashTouchEnd}
                    >
                      <div
                        style={{
                          transform: `translate(${dashPanX}px, ${dashPanY}px) scale(${dashPreviewScale})`,
                          transformOrigin: "center center",
                          transition: dashDragging ? "none" : "transform 0.15s ease",
                          flexShrink: 0,
                        }}
                      >
                        <div
                          id="bulletin-print-area"
                          ref={dashPreviewRef}
                          className="bulletin-page-content"
                          style={{
                            width: ps.width,
                            minHeight: ps.minHeight,
                            padding: ps.padding,
                            backgroundColor: "#ffffff",
                            borderRadius: 4,
                            border: "1px solid #e5e7eb",
                            flexShrink: 0,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            );
          })()}

          {activeSub === "edit" && (
            <div className="flex" style={{ height: "calc(100vh - 120px)", minHeight: 0, gap: 20, flexDirection: mob ? "column" : "row" }}>
              <div style={{ overflowY: "auto", paddingRight: mob ? 0 : 10, flex: mob ? "none" : "0 0 auto", width: mob ? "100%" : 400, minWidth: 0 }}>
                {printFormat === "fold2" && (
                  <div style={{ fontSize: 12, color: "#f59e0b", padding: "8px 12px", background: "#fffbeb", borderRadius: 8, marginBottom: 8 }}>
                    4면 주보: 예배순서+칼럼이 한 면, 교회소식+부서소식이 한 면에 들어갑니다
                  </div>
                )}
                {/* 출력 형식 — 아코디언 스타일 통일 */}
                <div style={{ background: "#fff", borderRadius: 12, marginBottom: 8, border: "1px solid #e5e7eb", overflow: "hidden" }}>
                  <button
                    type="button"
                    onClick={() => setShowFormatPanel(prev => !prev)}
                    style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", background: "none", border: "none", cursor: "pointer", fontSize: 14, fontWeight: 700, color: "#1a1a1a" }}
                  >
                    <span>출력 형식</span>
                    <span style={{ transform: showFormatPanel ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.2s", display: "inline-flex" }}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "#999" }}><path d="m6 9 6 6 6-6"/></svg>
                    </span>
                  </button>
                  {showFormatPanel && (
                    <div style={{ padding: "0 16px 16px" }}>
                      <div className="space-y-4">
                      <div className="pt-3">
                        <div className="flex gap-1.5">
                          {[
                            { key: "print", label: "인쇄용" },
                            { key: "online", label: "온라인/카카오" },
                          ].map((m) => (
                            <button key={m.key} type="button" onClick={() => { setOutputMode(m.key as OutputMode); if (m.key !== "print") setPreviewView("all"); }}
                              style={{
                                flex: 1,
                                padding: "6px 12px",
                                fontSize: 12,
                                fontWeight: 600,
                                borderRadius: 8,
                                transition: "all 0.15s",
                                ...(outputMode === m.key ? { background: "#111827", color: "#ffffff" } : { background: "#f3f4f6", color: "#4b5563", cursor: "pointer" }),
                              }}
                            >{m.label}</button>
                          ))}
                        </div>
                      </div>

                      {outputMode === "print" && (
                        <div className="flex gap-1.5">
                          <button type="button" onClick={() => { setPrintFormat("fold3"); setPreviewView("all"); }}
                            style={{
                              flex: 1,
                              padding: "6px 12px",
                              fontSize: 12,
                              fontWeight: 600,
                              borderRadius: 8,
                              transition: "all 0.15s",
                              ...(printFormat === "fold3" ? { background: "#111827", color: "#ffffff" } : { background: "#f3f4f6", color: "#4b5563", cursor: "pointer" }),
                            }}
                          >3면 접지</button>
                          <button type="button" onClick={() => { setPrintFormat("fold2"); setPreviewView("all"); }}
                            style={{
                              flex: 1,
                              padding: "6px 12px",
                              fontSize: 12,
                              fontWeight: 600,
                              borderRadius: 8,
                              transition: "all 0.15s",
                              ...(printFormat === "fold2" ? { background: "#111827", color: "#ffffff" } : { background: "#f3f4f6", color: "#4b5563", cursor: "pointer" }),
                            }}
                          >2면 접지</button>
                        </div>
                      )}

                      {/* 표지 이미지 */}
                      <div className="mb-4">
                        <label className="block text-xs font-semibold text-gray-600 mb-2">표지 이미지</label>
                        {db.current.coverImage ? (
                          <div className="relative">
                            <img src={db.current.coverImage} alt="표지" className="w-full h-32 object-cover rounded-lg border" />
                            <div className="flex gap-2 mt-2">
                              <label className="flex-1 text-center text-xs py-1.5 bg-gray-100 rounded cursor-pointer hover:bg-gray-200 border">
                                변경
                                <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                                  const f = e.target.files?.[0]; if (!f) return;
                                  const churchId = simpleHash(db.settings.church || "default");
                                  try {
                                    const url = await uploadCoverImage(f, churchId);
                                    setDb((p) => ({ ...p, current: { ...p.current, coverImage: url } }));
                                    showToast("이미지가 업로드되었습니다");
                                  } catch (err) {
                                    console.error(err);
                                    showToast("업로드 실패");
                                  }
                                  e.target.value = "";
                                }} />
                              </label>
                              <button type="button" className="flex-1 text-xs py-1.5 bg-red-50 text-red-600 rounded hover:bg-red-100 border border-red-200"
                                onClick={async () => {
                                  const churchId = simpleHash(db.settings.church || "default");
                                  await deleteCoverImage(churchId);
                                  setDb((p) => ({ ...p, current: { ...p.current, coverImage: "" } }));
                                  showToast("이미지가 삭제되었습니다");
                                }}>
                                삭제
                              </button>
                            </div>
                            <div className="mt-2">
                              <label className="text-xs text-gray-500">투명도: {Math.round((db.current.coverImageOpacity ?? 0.3) * 100)}%</label>
                              <input type="range" min="10" max="80" value={Math.round((db.current.coverImageOpacity ?? 0.3) * 100)}
                                className="w-full h-1.5 mt-1"
                                onChange={(e) => setDb((p) => ({ ...p, current: { ...p.current, coverImageOpacity: parseInt(e.target.value, 10) / 100 } }))} />
                            </div>
                          </div>
                        ) : (
                          <label className="flex flex-col items-center justify-center h-28 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="1.5"><path d="M12 5v14M5 12h14" /></svg>
                            <span className="text-xs text-gray-400 mt-1">교회 사진 업로드</span>
                            <span className="text-[10px] text-gray-300">JPG, PNG (자동 리사이즈)</span>
                            <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                              const f = e.target.files?.[0]; if (!f) return;
                              const churchId = simpleHash(db.settings.church || "default");
                              try {
                                const url = await uploadCoverImage(f, churchId);
                                setDb((p) => ({ ...p, current: { ...p.current, coverImage: url } }));
                                showToast("이미지가 업로드되었습니다");
                              } catch (err) {
                                console.error(err);
                                showToast("업로드 실패");
                              }
                              e.target.value = "";
                            }} />
                          </label>
                        )}
                      </div>

                      <div>
                        <div className="text-[11px] font-medium text-gray-400 mb-2">컬러 테마</div>
                        <div className="grid grid-cols-6 gap-1.5">
                          {TEMPLATES.map((t) => (
                            <button key={t.id} type="button"
                              onClick={() => setDb((prev) => ({ ...prev, current: { ...prev.current, template: t.id } }))}
                              className={`rounded-lg border-2 p-1.5 transition-all ${db.current.template === t.id ? "border-blue-500 shadow-sm" : "border-gray-200 hover:border-gray-300"}`}
                            >
                              <div className="flex gap-0.5 justify-center mb-1">
                                <div className="w-3 h-3 rounded-full" style={{ background: t.accent }} />
                                <div className="w-3 h-3 rounded-full" style={{ background: t.gold }} />
                                <div className="w-3 h-3 rounded-full" style={{ background: t.accentLight }} />
                              </div>
                              <div className="text-[9px] text-gray-600 text-center truncate">{t.name}</div>
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <div className="text-[11px] font-medium text-gray-400 mb-2">표지 장식 (일반)</div>
                        <div className="grid grid-cols-5 gap-1.5">
                          {(DECOR_OPTIONS as readonly { id: string; name: string; desc?: string; category?: string }[]).filter(d => d.category === "general").map((d) => {
                            const currentDecor = db.current.coverDecor ?? (TEMPLATES.find(t => t.id === db.current.template) || TEMPLATES[0]).decorStyle;
                            const tpl = TEMPLATES.find(t => t.id === db.current.template) || TEMPLATES[0];
                            const previewHtml = d.id !== "none" ? (() => { try { const p = getDecorSVG(d.id, tpl.accent, tpl.gold); return (p.topRight || "") + (p.bottomLeft || ""); } catch { return ""; } })() : "";
                            return (
                              <button key={d.id} type="button"
                                onClick={() => setDb((prev) => ({ ...prev, current: { ...prev.current, coverDecor: d.id } }))}
                                className={`rounded-lg border-2 p-1 transition-all ${currentDecor === d.id ? "border-blue-500 shadow-sm" : "border-gray-200 hover:border-gray-300"}`}
                              >
                                <div className="w-full aspect-square rounded relative overflow-hidden mb-0.5"
                                  style={{ background: tpl.headerBg, border: `1px solid ${tpl.borderColor}` }}>
                                  {d.id !== "none" && previewHtml ? (
                                    <div className="absolute inset-0" style={{ opacity: 0.5 }} dangerouslySetInnerHTML={{ __html: previewHtml }} />
                                  ) : null}
                                </div>
                                <div className="text-[9px] text-gray-600 text-center truncate">{d.name}</div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] font-medium text-gray-400 mb-2">교회 절기 · 특별 주일</div>
                        <div className="grid grid-cols-4 gap-1.5">
                          {(DECOR_OPTIONS as readonly { id: string; name: string; desc?: string; category?: string }[]).filter(d => d.category === "season").map((d) => {
                            const currentDecor = db.current.coverDecor ?? (TEMPLATES.find(t => t.id === db.current.template) || TEMPLATES[0]).decorStyle;
                            const tpl = TEMPLATES.find(t => t.id === db.current.template) || TEMPLATES[0];
                            const previewHtml = (() => { try { const p = getDecorSVG(d.id, tpl.accent, tpl.gold); return (p.topRight || "") + (p.bottomLeft || ""); } catch { return ""; } })();
                            return (
                              <button key={d.id} type="button"
                                onClick={() => setDb((prev) => ({ ...prev, current: { ...prev.current, coverDecor: d.id } }))}
                                className={`rounded-lg border-2 p-1 transition-all ${currentDecor === d.id ? "border-blue-500 shadow-sm" : "border-gray-200 hover:border-gray-300"}`}
                              >
                                <div className="w-full aspect-square rounded relative overflow-hidden mb-0.5"
                                  style={{ background: tpl.headerBg, border: `1px solid ${tpl.borderColor}` }}>
                                  {previewHtml ? (
                                    <div className="absolute inset-0" style={{ opacity: 0.5 }} dangerouslySetInnerHTML={{ __html: previewHtml }} />
                                  ) : null}
                                </div>
                                <div className="text-[9px] text-gray-600 text-center truncate">{d.name}</div>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div style={{ marginTop: 16 }}>
                        <label className="block text-xs font-semibold text-gray-600 mb-2">YouTube 예배 링크</label>
                        <input
                          type="url"
                          placeholder="https://www.youtube.com/watch?v=..."
                          value={db.current.youtubeUrl ?? ""}
                          onChange={(e) => setCurrent((c) => ({ ...c, youtubeUrl: e.target.value }))}
                          style={{ width: "100%", padding: "8px 12px", fontSize: 13, border: "1px solid #d1d5db", borderRadius: 8, outline: "none" }}
                        />
                        {extractYoutubeId(db.current.youtubeUrl ?? "") && (
                          <div style={{ marginTop: 8, borderRadius: 8, overflow: "hidden", border: "1px solid #e5e7eb" }}>
                            <img src={`https://img.youtube.com/vi/${extractYoutubeId(db.current.youtubeUrl ?? "")}/mqdefault.jpg`} alt="YouTube 썸네일" style={{ width: "100%", display: "block" }} />
                          </div>
                        )}
                      </div>
                    </div>
                    </div>
                  )}
                </div>

                {(() => {
                  const displaySections = printFormat === "fold2"
                    ? [
                        { key: "cover", name: "① 표지", desc: SECTIONS.cover.desc },
                        { key: "worshipSermon", name: "② 예배 순서 / 말씀", desc: "예배 순서와 목사님 칼럼이 한 면에 표시됩니다", keys: ["worship", "sermon"] as const },
                        { key: "churchNewsDept", name: "③ 교회 소식 / 부서별", desc: "교회 소식과 부서별 소식이 한 면에 표시됩니다", keys: ["churchNews", "departments"] as const },
                        { key: "info", name: "④ 교회 안내", desc: SECTIONS.info.desc },
                      ]
                    : (Object.entries(SECTIONS) as [SectionKey, { name: string; desc: string }][]).map(([key, sec]) => ({ key, name: sec.name, desc: sec.desc }));
                  const renderSectionContent = (sectionKey: SectionKey) => {
                    switch (sectionKey) {
                      case "cover":
                        return (<>
                          <FormField label="설교 제목"><><FInput value={db.current.pastor?.sermonTitle || ""} onChange={v => setCurrent(c => ({ ...c, pastor: { ...c.pastor, sermonTitle: v } }))} placeholder="이번 주 설교 제목" maxLength={100} /><div style={{ fontSize: 11, color: (db.current.pastor?.sermonTitle?.length ?? 0) >= 90 ? "#ef4444" : "#999", marginTop: 4 }}>{(db.current.pastor?.sermonTitle?.length ?? 0)}/100</div></></FormField>
                          <FormField label="성경 본문"><><FInput value={db.current.pastor?.sermonPassage || ""} onChange={v => setCurrent(c => ({ ...c, pastor: { ...c.pastor, sermonPassage: v } }))} placeholder="마태복음 5:1-12" maxLength={100} /><div style={{ fontSize: 11, color: (db.current.pastor?.sermonPassage?.length ?? 0) >= 90 ? "#ef4444" : "#999", marginTop: 4 }}>{(db.current.pastor?.sermonPassage?.length ?? 0)}/100</div></></FormField>
                          <FormField label="설교 주제"><><FInput value={db.current.pastor?.sermonTheme || ""} onChange={v => setCurrent(c => ({ ...c, pastor: { ...c.pastor, sermonTheme: v } }))} placeholder="설교 핵심 주제" maxLength={100} /><div style={{ fontSize: 11, color: (db.current.pastor?.sermonTheme?.length ?? 0) >= 90 ? "#ef4444" : "#999", marginTop: 4 }}>{(db.current.pastor?.sermonTheme?.length ?? 0)}/100</div></></FormField>
                        </>);
                      case "churchNews":
                        return (() => {
                          const g = db.current.general;
                          const isFour = printFormat === "fold2";
                          const deptData = db.current.departments?.data ?? {};
                          const deptTotal = (db.current.departments?.enabled ?? []).reduce((sum: number, dKey: string) => sum + ((deptData[dKey] ?? "")?.length ?? 0), 0);
                          const newsTotal = (g?.content?.length ?? 0) + (g?.servants?.length ?? 0) + (g?.offering?.length ?? 0) + (g?.schedule?.length ?? 0) + (g?.birthday?.length ?? 0);
                          const newsCombinedTotal = isFour ? newsTotal + deptTotal : newsTotal;
                          const newsMax = isFour ? FOUR_NEWS_TOTAL_MAX : NEWS_TOTAL_MAX;
                          return (<>
                            <div style={{ fontSize: 11, color: newsCombinedTotal >= newsMax * 0.9 ? "#ef4444" : "#999", marginBottom: 8 }}>전체 {newsCombinedTotal}/{newsMax}{isFour ? " (교회소식+부서)" : ""}</div>
                            <FormField label="교회 전체 소식"><><FTextarea value={g?.content || ""} onChange={v => setCurrent(c => {
                              const other = (c.general?.servants?.length ?? 0) + (c.general?.offering?.length ?? 0) + (c.general?.schedule?.length ?? 0) + (c.general?.birthday?.length ?? 0) + (isFour ? (c.departments?.enabled ?? []).reduce((s: number, k: string) => s + ((c.departments?.data ?? {})[k]?.length ?? 0), 0) : 0);
                              const trimmed = v.length > newsMax - other ? v.slice(0, newsMax - other) : v;
                              return { ...c, general: { ...c.general, content: trimmed } };
                            })} placeholder="교회 전체 공지사항" maxLength={120} /><div style={{ fontSize: 11, color: (g?.content?.length ?? 0) >= 108 ? "#ef4444" : "#999", marginTop: 4 }}>{(g?.content?.length ?? 0)}/120</div></></FormField>
                            <FormField label="금주 봉사자"><><FTextarea value={g?.servants || ""} onChange={v => setCurrent(c => {
                              const other = (c.general?.content?.length ?? 0) + (c.general?.offering?.length ?? 0) + (c.general?.schedule?.length ?? 0) + (c.general?.birthday?.length ?? 0) + (isFour ? (c.departments?.enabled ?? []).reduce((s: number, k: string) => s + ((c.departments?.data ?? {})[k]?.length ?? 0), 0) : 0);
                              const trimmed = v.length > newsMax - other ? v.slice(0, newsMax - other) : v;
                              return { ...c, general: { ...c.general, servants: trimmed } };
                            })} placeholder="안내: OOO&#10;주차: OOO" maxLength={80} /><div style={{ fontSize: 11, color: (g?.servants?.length ?? 0) >= 72 ? "#ef4444" : "#999", marginTop: 4 }}>{(g?.servants?.length ?? 0)}/80</div></></FormField>
                            <FormField label="지난주 헌금"><><FInput value={g?.offering || ""} onChange={v => setCurrent(c => {
                              const other = (c.general?.content?.length ?? 0) + (c.general?.servants?.length ?? 0) + (c.general?.schedule?.length ?? 0) + (c.general?.birthday?.length ?? 0) + (isFour ? (c.departments?.enabled ?? []).reduce((s: number, k: string) => s + ((c.departments?.data ?? {})[k]?.length ?? 0), 0) : 0);
                              const trimmed = v.length > newsMax - other ? v.slice(0, newsMax - other) : v;
                              return { ...c, general: { ...c.general, offering: trimmed } };
                            })} placeholder="십일조 0,000,000원" maxLength={60} /><div style={{ fontSize: 11, color: (g?.offering?.length ?? 0) >= 54 ? "#ef4444" : "#999", marginTop: 4 }}>{(g?.offering?.length ?? 0)}/60</div></></FormField>
                            <FormField label="금주 교회 일정"><><FTextarea value={g?.schedule || ""} onChange={v => setCurrent(c => {
                              const other = (c.general?.content?.length ?? 0) + (c.general?.servants?.length ?? 0) + (c.general?.offering?.length ?? 0) + (c.general?.birthday?.length ?? 0) + (isFour ? (c.departments?.enabled ?? []).reduce((s: number, k: string) => s + ((c.departments?.data ?? {})[k]?.length ?? 0), 0) : 0);
                              const trimmed = v.length > newsMax - other ? v.slice(0, newsMax - other) : v;
                              return { ...c, general: { ...c.general, schedule: trimmed } };
                            })} placeholder="월: 새벽기도 05:30" maxLength={80} /><div style={{ fontSize: 11, color: (g?.schedule?.length ?? 0) >= 72 ? "#ef4444" : "#999", marginTop: 4 }}>{(g?.schedule?.length ?? 0)}/80</div></></FormField>
                            <FormField label="이번 주 생일자"><><FInput value={g?.birthday || ""} onChange={v => setCurrent(c => {
                              const other = (c.general?.content?.length ?? 0) + (c.general?.servants?.length ?? 0) + (c.general?.offering?.length ?? 0) + (c.general?.schedule?.length ?? 0) + (isFour ? (c.departments?.enabled ?? []).reduce((s: number, k: string) => s + ((c.departments?.data ?? {})[k]?.length ?? 0), 0) : 0);
                              const trimmed = v.length > newsMax - other ? v.slice(0, newsMax - other) : v;
                              return { ...c, general: { ...c.general, birthday: trimmed } };
                            })} placeholder="김OO 집사, 이OO 권사" maxLength={60} /><div style={{ fontSize: 11, color: (g?.birthday?.length ?? 0) >= 54 ? "#ef4444" : "#999", marginTop: 4 }}>{(g?.birthday?.length ?? 0)}/60</div></>                            </FormField>
                          </>);
                        })();
                      case "worship":
                        return (() => {
                          const w = db.current.worship;
                          const p = db.current.pastor;
                          const isFour = printFormat === "fold2";
                          const worshipOnly = (w?.worshipOrder?.length ?? 0) + (w?.praise?.length ?? 0) + (w?.special?.length ?? 0);
                          const worshipTotal = isFour ? worshipOnly + (p?.column?.length ?? 0) : worshipOnly;
                          const worshipMax = isFour ? FOUR_WORSHIP_TOTAL_MAX : WORSHIP_TOTAL_MAX;
                          return (<>
                            <div style={{ fontSize: 11, color: worshipTotal >= worshipMax * 0.9 ? "#ef4444" : "#999", marginBottom: 8 }}>전체 {worshipTotal}/{worshipMax}{isFour ? " (예배+칼럼)" : ""}</div>
                            <FormField label="예배 순서"><><FTextarea value={w?.worshipOrder || ""} onChange={v => setCurrent(c => {
                              const other = (c.worship?.praise?.length ?? 0) + (c.worship?.special?.length ?? 0) + (isFour ? (c.pastor?.column?.length ?? 0) : 0);
                              const max = isFour ? FOUR_WORSHIP_TOTAL_MAX : WORSHIP_TOTAL_MAX;
                              const trimmed = v.length > max - other ? v.slice(0, max - other) : v;
                              return { ...c, worship: { ...c.worship, worshipOrder: trimmed } };
                            })} placeholder="묵도&#10;찬송 ………… 00장" style={{ minHeight: 150 }} maxLength={isFour ? 450 : 300} /><div style={{ fontSize: 11, color: (w?.worshipOrder?.length ?? 0) >= (isFour ? 405 : 270) ? "#ef4444" : "#999", marginTop: 4 }}>{(w?.worshipOrder?.length ?? 0)}/{isFour ? 450 : 300}</div></></FormField>
                            <FormField label="찬양곡"><><FInput value={w?.praise || ""} onChange={v => setCurrent(c => {
                              const other = (c.worship?.worshipOrder?.length ?? 0) + (c.worship?.special?.length ?? 0) + (isFour ? (c.pastor?.column?.length ?? 0) : 0);
                              const max = isFour ? FOUR_WORSHIP_TOTAL_MAX : WORSHIP_TOTAL_MAX;
                              const trimmed = v.length > max - other ? v.slice(0, max - other) : v;
                              return { ...c, worship: { ...c.worship, praise: trimmed } };
                            })} placeholder="찬양곡 목록" /><div style={{ fontSize: 11, color: "#999", marginTop: 4 }}>{(w?.praise?.length ?? 0)}자</div></></FormField>
                            <FormField label="특송/특별순서"><><FInput value={w?.special || ""} onChange={v => setCurrent(c => {
                              const other = (c.worship?.worshipOrder?.length ?? 0) + (c.worship?.praise?.length ?? 0) + (isFour ? (c.pastor?.column?.length ?? 0) : 0);
                              const max = isFour ? FOUR_WORSHIP_TOTAL_MAX : WORSHIP_TOTAL_MAX;
                              const trimmed = v.length > max - other ? v.slice(0, max - other) : v;
                              return { ...c, worship: { ...c.worship, special: trimmed } };
                            })} placeholder="특송 - OOO" /><div style={{ fontSize: 11, color: "#999", marginTop: 4 }}>{(w?.special?.length ?? 0)}자</div></>                            </FormField>
                          </>);
                        })();
                      case "sermon":
                        return (() => {
                          const p = db.current.pastor;
                          const w = db.current.worship;
                          const isFour = printFormat === "fold2";
                          const worshipOnly = (w?.worshipOrder?.length ?? 0) + (w?.praise?.length ?? 0) + (w?.special?.length ?? 0);
                          const columnMax = isFour ? Math.max(0, FOUR_WORSHIP_TOTAL_MAX - worshipOnly) : 500;
                          const sermonTotal = (p?.column?.length ?? 0) + (p?.pastorNotice?.length ?? 0);
                          const fourWorshipTotal = worshipOnly + (p?.column?.length ?? 0);
                          return (<>
                            <div style={{ fontSize: 11, color: (isFour ? fourWorshipTotal >= FOUR_WORSHIP_TOTAL_MAX * 0.9 : sermonTotal >= SERMON_TOTAL_MAX * 0.9) ? "#ef4444" : "#999", marginBottom: 8 }}>{isFour ? `칼럼 (예배+칼럼 합계 ${fourWorshipTotal}/${FOUR_WORSHIP_TOTAL_MAX})` : `전체 ${sermonTotal}/${SERMON_TOTAL_MAX}`}</div>
                            <FormField label="목사님 칼럼"><><FTextarea value={p?.column || ""} onChange={v => setCurrent(c => {
                              const worshipOnlyC = (c.worship?.worshipOrder?.length ?? 0) + (c.worship?.praise?.length ?? 0) + (c.worship?.special?.length ?? 0);
                              const other = isFour ? 0 : (c.pastor?.pastorNotice?.length ?? 0);
                              const max = isFour ? Math.max(0, FOUR_WORSHIP_TOTAL_MAX - worshipOnlyC) : SERMON_TOTAL_MAX - other;
                              const trimmed = v.length > max ? v.slice(0, max) : v;
                              return { ...c, pastor: { ...c.pastor, column: trimmed } };
                            })} placeholder="이번 주 칼럼" style={{ minHeight: 100 }} maxLength={isFour ? 450 : 500} /><div style={{ fontSize: 11, color: (p?.column?.length ?? 0) >= (isFour ? columnMax * 0.9 : 450) ? "#ef4444" : "#999", marginTop: 4 }}>{(p?.column?.length ?? 0)}/{isFour ? columnMax : 500}</div></></FormField>
                            <FormField label="특별 공지"><><FTextarea value={p?.pastorNotice || ""} onChange={v => setCurrent(c => {
                              const other = (c.pastor?.column?.length ?? 0);
                              const trimmed = v.length > SERMON_TOTAL_MAX - other ? v.slice(0, SERMON_TOTAL_MAX - other) : v;
                              return { ...c, pastor: { ...c.pastor, pastorNotice: trimmed } };
                            })} placeholder="특별 공지 (선택)" maxLength={500} /><div style={{ fontSize: 11, color: (p?.pastorNotice?.length ?? 0) >= 450 ? "#ef4444" : "#999", marginTop: 4 }}>{(p?.pastorNotice?.length ?? 0)}/500</div></>                            </FormField>
                          </>);
                        })();
                      case "departments":
                        return (() => {
                          const enabled = db.current.departments?.enabled ?? [];
                          const deptData = db.current.departments?.data ?? {};
                          const g = db.current.general;
                          const newsTotal = (g?.content?.length ?? 0) + (g?.servants?.length ?? 0) + (g?.offering?.length ?? 0) + (g?.schedule?.length ?? 0) + (g?.birthday?.length ?? 0);
                          const deptTotal = enabled.reduce((sum, dKey) => sum + ((deptData[dKey] ?? "")?.length ?? 0), 0);
                          const isFour = printFormat === "fold2";
                          const combinedTotal = isFour ? newsTotal + deptTotal : deptTotal;
                          const deptMax = isFour ? FOUR_NEWS_TOTAL_MAX : DEPT_TOTAL_MAX;
                          return (<>
                            <div style={{ fontSize: 11, color: combinedTotal >= deptMax * 0.9 ? "#ef4444" : "#999", marginBottom: 8 }}>전체 {combinedTotal}/{deptMax}{isFour ? " (교회소식+부서)" : ""}</div>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
                              {DEPARTMENTS.map(({ key: dKey, name }) => {
                                const checked = enabled.includes(dKey);
                                return (
                                  <label key={dKey} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, cursor: "pointer" }}>
                                    <input type="checkbox" checked={checked} onChange={() => {
                                      const next = checked ? enabled.filter(k => k !== dKey) : [...enabled, dKey];
                                      setCurrent(c => ({ ...c, departments: { ...c.departments, enabled: next, data: c.departments?.data ?? {} } }));
                                    }} />
                                    <span>{name}</span>
                                  </label>
                                );
                              })}
                            </div>
                            {enabled.map(dKey => {
                              const dept = DEPARTMENTS.find(d => d.key === dKey);
                              if (!dept) return null;
                              return (
                                <div key={dKey} style={{ marginBottom: 12 }}>
                                  <div style={{ fontSize: 11, fontWeight: 600, color: "#555", marginBottom: 4 }}>—— {dept.name} ——</div>
                                  <FormField label="">
                                    <><FTextarea value={deptData[dKey] ?? ""} onChange={v => setCurrent(c => {
                                      const data = c.departments?.data ?? {};
                                      const newsOnly = (c.general?.content?.length ?? 0) + (c.general?.servants?.length ?? 0) + (c.general?.offering?.length ?? 0) + (c.general?.schedule?.length ?? 0) + (c.general?.birthday?.length ?? 0);
                                      const other = isFour ? newsOnly + (c.departments?.enabled ?? []).filter((k: string) => k !== dKey).reduce((s: number, k: string) => s + ((data[k] ?? "")?.length ?? 0), 0) : (c.departments?.enabled ?? []).filter((k: string) => k !== dKey).reduce((s: number, k: string) => s + ((data[k] ?? "")?.length ?? 0), 0);
                                      const trimmed = v.length > deptMax - other ? v.slice(0, deptMax - other) : v;
                                      return { ...c, departments: { ...c.departments, data: { ...data, [dKey]: trimmed } } };
                                    })} placeholder={`${dept.name} 소식 입력`} style={{ minHeight: 80 }} maxLength={150} /><div style={{ fontSize: 11, color: combinedTotal >= deptMax * 0.9 ? "#ef4444" : "#999", marginTop: 4 }}>{((deptData[dKey] ?? "")?.length ?? 0)}자{isFour ? "" : ` / 150`}</div></>
                                  </FormField>
                                </div>
                              );
                            })}
                          </>);
                        })();
                      case "info":
                        return (<>
                          <FormField label="헌금 계좌"><textarea className="w-full border rounded-lg p-2 text-sm" rows={2} value={db.settings.account || ""} onChange={e => setDb(p => ({ ...p, settings: { ...p.settings, account: e.target.value } }))} /></FormField>
                          <FormField label="교회 주소"><FInput value={db.settings.address || ""} onChange={v => setDb(p => ({ ...p, settings: { ...p.settings, address: v } }))} /></FormField>
                          <FormField label="전화번호"><FInput value={db.settings.phone || ""} onChange={v => setDb(p => ({ ...p, settings: { ...p.settings, phone: v } }))} /></FormField>
                          <p style={{ fontSize: 11, color: "#999", marginTop: 8 }}>※ 설정 페이지에서도 수정할 수 있습니다</p>
                        </>);
                      default:
                        return null;
                    }
                  };
                  const hrStyle = { border: "none" as const, borderTop: "1px solid #e5e7eb", margin: "12px 0" };
                  return displaySections.map((item) => {
                    const displayKey = item.key;
                    const name = item.name;
                    const desc = item.desc;
                    const keys = "keys" in item ? item.keys : undefined;
                    return (
                      <div key={displayKey} style={{ background: "#fff", borderRadius: 12, marginBottom: 8, border: "1px solid #e5e7eb", overflow: "hidden" }}>
                        <button type="button" onClick={() => toggleSection(displayKey)} style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", background: "none", border: "none", cursor: "pointer", fontSize: 14, fontWeight: 700, color: "#1a1a1a" }}>
                          <span>{name}</span>
                          <span style={{ transform: (openSections[displayKey] ?? false) ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.2s", display: "inline-flex" }}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "#999" }}><path d="m6 9 6 6 6-6"/></svg>
                          </span>
                        </button>
                        {(openSections[displayKey] ?? false) && (
                          <div style={{ padding: "0 16px 16px" }}>
                            <p style={{ fontSize: 11, color: "#888", marginBottom: 12 }}>{desc}</p>
                            {keys ? keys.map((k, i) => <Fragment key={k}>{i > 0 && <hr style={hrStyle} />}{renderSectionContent(k)}</Fragment>) : renderSectionContent(displayKey as SectionKey)}
                          </div>
                        )}
                      </div>
                    );
                  });
                })()}
              </div>

              <div className="flex-1 flex flex-col overflow-hidden min-w-0" style={{ marginTop: mob ? 20 : 0 }}>
                <div className="flex-shrink-0 bg-gray-50 border-b border-gray-200 px-3 py-2 space-y-2">
                  <div style={{ display: "flex", alignItems: "center", gap: 12, width: 412, margin: "0 auto" }}>
                    <div style={{ width: 200, minWidth: 200, display: "flex", justifyContent: "center" }}>
                      <div className="inline-flex items-center bg-white border border-gray-200 rounded-lg p-0.5 shadow-sm">
                        {(["6면", "4면", "온라인"] as BulletinFormat[]).map((format) => (
                          <button
                            key={format}
                            type="button"
                            onClick={() => setBulletinFormat(format)}
                            style={{
                              padding: "4px 12px",
                              fontSize: 12,
                              fontWeight: 600,
                              borderRadius: 6,
                              transition: "all 0.15s",
                              ...(bulletinFormatDisplay === format
                                ? { background: "#111827", color: "#ffffff", boxShadow: "0 1px 2px rgba(0,0,0,0.1)" }
                                : { background: "transparent", color: "#6b7280", cursor: "pointer" }),
                            }}
                          >
                            {format}
                          </button>
                        ))}
                      </div>
                    </div>
                    {/* 뷰 전환: 항상 표시, 온라인일 때는 비활성 */}
                    <div style={{ width: 200, minWidth: 200, display: "flex", justifyContent: "center", ...(outputMode !== "print" ? { opacity: 0.35, pointerEvents: "none" as const } : {}) }}>
                      <div className="inline-flex items-center bg-white border border-gray-200 rounded-lg p-0.5 shadow-sm">
                        {(printFormat === "fold3" ? VIEW_FOLD3 : VIEW_FOLD2).map((v) => (
                          <button
                            key={v}
                            type="button"
                            onClick={() => setPreviewView(v)}
                            style={{
                              padding: "4px 12px",
                              fontSize: 12,
                              fontWeight: 600,
                              borderRadius: 6,
                              transition: "all 0.15s",
                              cursor: outputMode === "print" ? "pointer" : "default",
                              ...(previewView === v && outputMode === "print"
                                ? { background: "#2563eb", color: "#ffffff", boxShadow: "0 1px 2px rgba(0,0,0,0.1)" }
                                : { background: "transparent", color: "#6b7280" }),
                            }}
                          >
                            {VIEW_LABEL[v]}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <button type="button" onClick={handlePrint} className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 shadow-sm">
                        <Printer size={12} /> 인쇄
                      </button>
                      <button type="button" onClick={handleKakaoShare} className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-white bg-yellow-400 border border-yellow-400 rounded-lg hover:bg-yellow-500 shadow-sm">
                        카카오 공유
                      </button>
                    </div>
                    <div className="inline-flex items-center bg-white border border-gray-200 rounded-lg shadow-sm">
                      <button type="button" onClick={zoomOut} className="w-6 h-6 flex items-center justify-center text-gray-500 hover:text-gray-700 rounded-l-lg text-xs">−</button>
                      <input
                        type="text"
                        value={previewZoomDraft !== null ? previewZoomDraft : `${Math.round(previewScale * 100)}%`}
                        onChange={(e) => {
                          const digits = e.target.value.replace(/[^0-9]/g, "");
                          const display = digits === "" ? "" : `${digits}%`;
                          setPreviewZoomDraft(display);
                          const num = parseInt(digits, 10);
                          if (!isNaN(num) && num >= 25 && num <= 200) {
                            setPreviewScale(num / 100);
                          }
                        }}
                        onBlur={(e) => {
                          const num = parseInt(e.target.value.replace(/[^0-9]/g, ""), 10);
                          if (isNaN(num) || num < 25) setPreviewScale(0.25);
                          else if (num > 200) setPreviewScale(2.0);
                          setPreviewZoomDraft(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                        }}
                        onFocus={(e) => {
                          setPreviewZoomDraft(`${Math.round(previewScale * 100)}%`);
                          (e.target as HTMLInputElement).select();
                        }}
                        className="w-12 text-center text-xs text-gray-600 font-medium border-x border-gray-200 bg-transparent outline-none"
                        style={{ height: "24px", padding: 0, border: "none", borderLeft: "1px solid #e5e7eb", borderRight: "1px solid #e5e7eb" }}
                      />
                      <button type="button" onClick={zoomIn} className="w-6 h-6 flex items-center justify-center text-gray-500 hover:text-gray-700 rounded-r-lg text-xs">+</button>
                    </div>
                  </div>
                </div>

                <div className="flex-1 overflow-auto min-h-0 bg-white" style={{ display: "flex", justifyContent: "center", alignItems: "flex-start", padding: "16px" }}>
                {/* 카카오 공유용 숨김 카드 (캡처 전용) */}
                {outputMode === "online" && (
                  <div style={{ position: "absolute", left: "-9999px", top: 0 }}>
                    <KakaoShareCard
                      ref={kakaoCardRef}
                      churchName={db.settings.church || "교회"}
                      worshipName="주일예배"
                      date={db.current.date || BULLETIN_DATE_STR}
                      time={db.settings.worshipTime || ""}
                      leader=""
                      preacher={db.settings.pastor || ""}
                      bibleVerse={db.current.pastor?.sermonPassage || ""}
                      sermonTitle={db.current.pastor?.sermonTitle || ""}
                      location={db.settings.address || ""}
                      message={db.current.pastor?.pastorNotice || ""}
                      designTheme={db.current.template === "warm-earth" ? "burgundy" : db.current.template === "natural-botanical" ? "olive" : "navy"}
                    />
                  </div>
                )}
                <div
                  className="bulletin-preview-display"
                  id="bulletin-print-container"
                  style={{
                    width: "100%",
                    minHeight: "calc(100vh - 140px)",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    padding: "24px 16px",
                    backgroundColor: "#ffffff",
                  }}
                >
                  <div
                    ref={previewPanZoomRef}
                    style={{
                      width: "100%",
                      height: "calc(100vh - 140px)",
                      minHeight: 400,
                      overflow: "hidden",
                      cursor: previewDragging ? "grabbing" : "grab",
                      display: "flex",
                      justifyContent: "center",
                      alignItems: "center",
                    }}
                    onMouseDown={onPreviewMouseDown}
                    onDoubleClick={onPreviewDoubleClick}
                    onTouchStart={onPreviewTouchStart}
                    onTouchMove={onPreviewTouchMove}
                    onTouchEnd={onPreviewTouchEnd}
                    onTouchCancel={onPreviewTouchEnd}
                  >
                    <div
                      className="bulletin-preview-scale flex-shrink-0"
                      style={{
                        transform: `translate(${panX}px, ${panY}px) scale(${previewScale})`,
                        transformOrigin: "center center",
                        transition: previewDragging ? "none" : "transform 0.15s ease",
                      }}
                    >
                      <div id="bulletin-print-area" ref={previewRef} data-bview={previewView} data-bulletin-preview className="bulletin bulletin-preview-inner bulletin-page-content" style={{ flexShrink: 0, width: ps.width, minHeight: ps.minHeight, padding: ps.padding }} />
                    </div>
                  </div>
                </div>
                </div>
              </div>
            </div>
          )}

          {activeSub === "history" && (
            <div ref={listRefHistory} style={{ width: "100%" }}>
              <Card style={{ padding: 0, display: "flex", flexDirection: "column", minHeight: "calc(100vh - 200px)" }}>
                {db.history.length === 0 ? (
                  <div style={{ color: "#9ca3af", textAlign: "center", padding: 40, fontSize: 14 }}>저장된 주보가 없습니다. 편집에서 저장하면 여기에 표시됩니다.</div>
                ) : (
                  <>
                    <div style={{ display: "grid", gridTemplateColumns: mob ? "1fr" : "180px 1fr 100px", padding: "12px 20px", borderBottom: "2px solid #e5e7eb", background: "#f9fafb" }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "#6b7280" }}>날짜</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "#6b7280" }}>설교 제목</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", textAlign: "right" }}>관리</span>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ padding: 0, overflow: "hidden" }}>
                        {db.history.slice().reverse().slice((currentPageHistory - 1) * 10, currentPageHistory * 10).map(h => (
                          <div key={h.key} style={{ display: "grid", gridTemplateColumns: mob ? "1fr" : "180px 1fr 100px", alignItems: "center", padding: mob ? "14px 16px" : "14px 20px", borderBottom: "1px solid #f3f4f6" }}>
                            <div style={{ fontSize: 15, fontWeight: 600, color: "#374151" }}>{h.date || h.key}</div>
                            <div style={{ fontSize: 13, color: "#6b7280" }}>{h.sermonTitle || "제목없음"} · 저장: {h.savedAt || ""}</div>
                            <div style={{ textAlign: mob ? "left" : "right" }}>
                              <button type="button" onClick={() => loadHistory(h.key)} style={{ padding: "8px 16px", minWidth: 70, fontSize: 13, fontWeight: 500, backgroundColor: "#111827", border: "none", borderRadius: 8, color: "#ffffff", cursor: "pointer", width: mob ? "100%" : undefined }}>불러오기</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
                {db.history.length > 0 && (
                  <div style={{ borderTop: "1px solid #e5e7eb", padding: "12px 20px", display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
                    <Pagination totalItems={db.history.length} itemsPerPage={10} currentPage={currentPageHistory} onPageChange={(p) => { setCurrentPageHistory(p); listRefHistory.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }} />
                  </div>
                )}
              </Card>
            </div>
          )}

          {activeSub === "settings" && (
            <div style={{ width: "100%" }}>
              <Card style={{ padding: 0, overflow: "hidden" }}>
                <div style={{ padding: "16px 28px", borderBottom: "1px solid #e5e7eb", background: "#f9fafb" }}>
                  <span style={{ fontSize: 16, fontWeight: 700, color: "#111827" }}>교회 기본 정보</span>
                </div>
                <div style={{ padding: mob ? 16 : 28, display: "flex", flexDirection: "column", gap: 16 }}>
                  <FormField label="교회명" labelStyle={{ fontSize: 14, fontWeight: 600, color: "#374151" }}><FInput value={db.settings.church} onChange={v => setDb(prev => ({ ...prev, settings: { ...prev.settings, church: v } }))} style={{ fontSize: 14 }} /></FormField>
                  <FormField label="교회 영문명/부제" labelStyle={{ fontSize: 14, fontWeight: 600, color: "#374151" }}><FInput value={db.settings.churchSub} onChange={v => setDb(prev => ({ ...prev, settings: { ...prev.settings, churchSub: v } }))} style={{ fontSize: 14 }} /></FormField>
                  <div style={{ display: "grid", gridTemplateColumns: mob ? "1fr" : "1fr 1fr", gap: 16 }}>
                    <FormField label="담임목사" labelStyle={{ fontSize: 14, fontWeight: 600, color: "#374151" }}><FInput value={db.settings.pastor} onChange={v => setDb(prev => ({ ...prev, settings: { ...prev.settings, pastor: v } }))} style={{ fontSize: 14 }} /></FormField>
                    <FormField label="주일예배 시간" labelStyle={{ fontSize: 14, fontWeight: 600, color: "#374151" }}>
                    <textarea
                      className="w-full border rounded-lg p-2"
                      style={{ fontSize: 14 }}
                      rows={2}
                      value={db.settings.worshipTime || ""}
                      onChange={e => setDb(p => ({ ...p, settings: { ...p.settings, worshipTime: e.target.value } }))}
                      placeholder="주일오전예배 11:00&#10;주일저녁예배 7:30"
                    />
                  </FormField>
                  </div>
                  <div className="space-y-1">
                    <label className="block font-medium" style={{ fontSize: 14, fontWeight: 600, color: "#374151" }}>교역자 / 부교역자</label>
                    <textarea
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      style={{ fontSize: 14 }}
                      rows={3}
                      placeholder="부목사 홍길동&#10;전도사 김영희&#10;교육전도사 이철수"
                      value={db.settings.staffList || ""}
                      onChange={(e) => setDb(p => ({ ...p, settings: { ...p.settings, staffList: e.target.value } }))}
                    />
                    <p className="text-xs text-gray-400">한 줄에 한 명씩 입력 (예: 부목사 홍길동)</p>
                  </div>
                  <FormField label="교회 주소" labelStyle={{ fontSize: 14, fontWeight: 600, color: "#374151" }}>
                    <textarea
                      className="w-full border rounded-lg p-2"
                      style={{ fontSize: 14 }}
                      rows={2}
                      value={db.settings.address || ""}
                      onChange={e => setDb(p => ({ ...p, settings: { ...p.settings, address: e.target.value } }))}
                    />
                  </FormField>
                  <div style={{ display: "grid", gridTemplateColumns: mob ? "1fr" : "1fr 1fr", gap: 16 }}>
                    <FormField label="전화번호" labelStyle={{ fontSize: 14, fontWeight: 600, color: "#374151" }}><FInput value={db.settings.phone} onChange={v => setDb(prev => ({ ...prev, settings: { ...prev.settings, phone: v } }))} style={{ fontSize: 14 }} /></FormField>
                    <FormField label="헌금 계좌" labelStyle={{ fontSize: 14, fontWeight: 600, color: "#374151" }}>
                    <textarea
                      className="w-full border rounded-lg p-2"
                      style={{ fontSize: 14 }}
                      rows={2}
                      value={db.settings.account || ""}
                      onChange={e => setDb(p => ({ ...p, settings: { ...p.settings, account: e.target.value } }))}
                      placeholder="국민은행 빛되는교회 000-00-0000000"
                    />
                  </FormField>
                  </div>
                  <FormField label="마감 요일" labelStyle={{ fontSize: 14, fontWeight: 600, color: "#374151" }}><FSelect value={db.settings.deadline} onChange={v => setDb(prev => ({ ...prev, settings: { ...prev.settings, deadline: v } }))} style={{ fontSize: 14 }}><option>수요일</option><option>목요일</option><option>금요일</option></FSelect></FormField>
                  <hr style={{ margin: "20px 0", border: "none", borderTop: `1px solid #f3f4f6` }} />
                  <div style={{ marginTop: 8 }}>
                    <button
                      type="button"
                      className="rounded transition-colors w-full"
                      style={{
                        backgroundColor: "#2563EB",
                        color: "#ffffff",
                        fontSize: 15,
                        fontWeight: 600,
                        padding: "12px 0",
                        borderRadius: 10,
                        marginTop: 8,
                        letterSpacing: "0.5px",
                        border: "none",
                        cursor: "pointer"
                      }}
                      onClick={() => {
                        saveBulletin(db);
                        showToast("설정이 저장되었습니다");
                      }}
                    >
                      저장
                    </button>
                  </div>
                </div>
              </Card>
            </div>
          )}
        </div>

      {showFullPreview && (
        <div className="fixed inset-0 z-[9999]" style={{ backgroundColor: "#ffffff" }}>
          <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200" style={{ backgroundColor: "#ffffff" }}>
            <span className="text-sm font-medium text-gray-800">주보 미리보기</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="px-3 py-1.5 text-xs font-medium rounded bg-gray-800 text-white hover:bg-gray-700"
                onClick={() => { setShowFullPreview(false); setTimeout(() => handlePrint(), 100); }}
              >
                인쇄
              </button>
              <button
                type="button"
                onClick={() => setShowFullPreview(false)}
                className="px-3 py-1.5 text-xs font-medium rounded border border-gray-300 text-gray-700 hover:bg-gray-100"
              >
                닫기
              </button>
            </div>
          </div>
          <div
            className="overflow-auto"
            style={{
              height: "calc(100vh - 52px)",
              backgroundColor: "#f9fafb",
              display: "flex",
              justifyContent: "center",
              alignItems: "flex-start",
              paddingTop: 32,
              paddingBottom: 32,
            }}
          >
            <div
              className="bulletin-page-content"
              style={{
                width: bulletinFormatDisplay === "6면" ? 1134
                  : bulletinFormatDisplay === "4면" ? 756
                  : 595,
                minHeight: bulletinFormatDisplay === "6면" ? 1274
                  : bulletinFormatDisplay === "4면" ? 1274
                  : 842,
                backgroundColor: "#ffffff",
                padding: bulletinFormatDisplay === "온라인" ? 40 : 0,
                border: "1px solid #e5e7eb",
                borderRadius: 4,
                flexShrink: 0,
                alignSelf: "flex-start",
                transformOrigin: "top center",
                transform: bulletinFormatDisplay === "6면" ? "scale(0.7)" : "none",
              }}
              dangerouslySetInnerHTML={{ __html: fullPreviewHtml || "" }}
            />
          </div>
        </div>
      )}

      <div style={{ position: "fixed", top: mob ? 8 : 20, right: mob ? 8 : 20, left: mob ? 8 : "auto", zIndex: 2000, display: "flex", flexDirection: "column", gap: 8 }}>
        {toasts.map(t => <div key={t.id} style={{ background: "#111827", color: "#fff", padding: "12px 20px", borderRadius: 8, fontSize: 13, fontWeight: 500 }}>{t.msg}</div>)}
      </div>

      {typeof document !== "undefined" &&
        createPortal(
          <div
            id="bulletin-print-only"
            className="bulletin-page-content"
            style={{
              position: "fixed",
              left: "-9999px",
              top: 0,
              visibility: "hidden",
              width: bulletinFormatDisplay === "6면" ? "378mm" : bulletinFormatDisplay === "4면" ? "254mm" : "210mm",
              height: bulletinFormatDisplay === "온라인" ? "297mm" : "212mm",
              background: "white",
            }}
          >
            {bulletinFormatDisplay === "6면" && (
              <>
                <div
                  className="print-spread"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr 1fr",
                    width: "378mm",
                    height: "212mm",
                    pageBreakAfter: "always",
                  }}
                >
                  <div className="print-cell" dangerouslySetInnerHTML={{ __html: getTriFoldSectionHTML(db, 5) }} />
                  <div className="print-cell" dangerouslySetInnerHTML={{ __html: getTriFoldSectionHTML(db, 0) }} />
                  <div className="print-cell" dangerouslySetInnerHTML={{ __html: getTriFoldSectionHTML(db, 1) }} />
                </div>
                <div
                  className="print-spread"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr 1fr",
                    width: "378mm",
                    height: "212mm",
                  }}
                >
                  <div className="print-cell" dangerouslySetInnerHTML={{ __html: getTriFoldSectionHTML(db, 2) }} />
                  <div className="print-cell" dangerouslySetInnerHTML={{ __html: getTriFoldSectionHTML(db, 3) }} />
                  <div className="print-cell" dangerouslySetInnerHTML={{ __html: getTriFoldSectionHTML(db, 4) }} />
                </div>
              </>
            )}
            {bulletinFormatDisplay === "4면" && (
              <>
                <div
                  className="print-spread"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    width: "254mm",
                    height: "212mm",
                    pageBreakAfter: "always",
                  }}
                >
                  <div className="print-cell" dangerouslySetInnerHTML={{ __html: getHalfFoldSectionHTML(db, 3) }} />
                  <div className="print-cell" dangerouslySetInnerHTML={{ __html: getHalfFoldSectionHTML(db, 0) }} />
                </div>
                <div
                  className="print-spread"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    width: "254mm",
                    height: "212mm",
                  }}
                >
                  <div className="print-cell" dangerouslySetInnerHTML={{ __html: getHalfFoldSectionHTML(db, 1) }} />
                  <div className="print-cell" dangerouslySetInnerHTML={{ __html: getHalfFoldSectionHTML(db, 2) }} />
                </div>
              </>
            )}
            {bulletinFormatDisplay === "온라인" && (
              <div
                className="bulletin-page-content"
                style={{ width: "210mm", minHeight: "297mm", padding: "15mm" }}
                dangerouslySetInnerHTML={{ __html: buildOnlineHTML(db) }}
              />
            )}
          </div>,
          document.body
        )}

      <style id="bulletin-print-styles">{`
        /* ==================== SHARED ==================== */
        .bulletin-page-content .bp-otbl { width:100%; border-collapse:collapse; }
        .bulletin-page-content .bp-otbl tr { border-bottom:1px dotted #ccc; }
        .bulletin-page-content .bp-otbl tr:last-child { border-bottom:none; }
        .bulletin-page-content .bp-o-item { padding:4px 0; font-weight:600; color:#222; white-space:nowrap; font-size:10px; }
        .bulletin-page-content .bp-o-dots { width:100%; padding:4px 2px; position:relative; }
        .bulletin-page-content .bp-o-dots::after { content:'\\00B7\\00B7\\00B7\\00B7\\00B7\\00B7\\00B7\\00B7\\00B7\\00B7\\00B7\\00B7\\00B7\\00B7\\00B7\\00B7\\00B7\\00B7'; position:absolute; inset:0; text-align:center; color:#bbb; overflow:hidden; font-size:8px; letter-spacing:1.5px; line-height:20px; }
        .bulletin-page-content .bp-o-detail { padding:4px 0; text-align:right; color:#555; white-space:nowrap; font-size:9.5px; }
        .bulletin-page-content .bp-empty { color:#aaa; text-align:center; padding:16px; font-size:9.5px; font-style:italic; }

        /* ==================== TRI-FOLD (3면 접지) ==================== */
        .bulletin-page-content .bp-tri { display:flex; flex-direction:column; align-items:center; gap:20px; padding:4px; font-family:'Noto Serif KR','Batang',Georgia,serif; }
        .bulletin-page-content .bp-tri .bp-spread { box-shadow:0 3px 20px rgba(0,0,0,.1); border-radius:2px; overflow:hidden; width:720px; }
        .bulletin-page-content .bp-spread { height:480px; overflow:hidden; }
        .bulletin-page-content .print-cell { height:480px; overflow:hidden; }
        .bulletin-page-content .tp { width:100%; min-height:530px; background:#fff; border-right:1px dashed #d0d0d0; box-sizing:border-box; position:relative; overflow:hidden; }
        .bulletin-page-content .tp:last-child { border-right:none; }
        .bulletin-page-content .tp-cover { display:flex; align-items:center; justify-content:center; }
        .bulletin-page-content .tp-bg { position:absolute; inset:0; }
        .bulletin-page-content .tp-cover-inner { position:relative; z-index:1; text-align:center; color:inherit; padding:32px 18px; width:100%; }
        .bulletin-page-content .tp-cross { font-size:28px; opacity:.4; margin-bottom:14px; }
        .bulletin-page-content .tp-cname { font-size:22px; font-weight:800; letter-spacing:5px; margin-bottom:2px; }
        .bulletin-page-content .tp-csub { font-size:9px; opacity:.5; letter-spacing:3px; text-transform:uppercase; }
        .bulletin-page-content .tp-cdiv { width:36px; height:1.5px; margin:16px auto; opacity:.6; }
        .bulletin-page-content .tp-stitle { font-size:16px; font-weight:700; letter-spacing:1px; line-height:1.5; }
        .bulletin-page-content .tp-spass { font-size:10px; opacity:.65; margin-top:4px; }
        .bulletin-page-content .tp-date { font-size:10px; opacity:.75; letter-spacing:1px; }
        .bulletin-page-content .tp-time { font-size:9px; opacity:.5; margin-top:2px; }
        .bulletin-page-content .tp-pastor { font-size:10px; opacity:.6; margin-top:18px; letter-spacing:2px; }
        .bulletin-page-content .tp-hd { font-size:11.5px; font-weight:800; padding:8px 8px; border-bottom:2px solid; letter-spacing:.8px; background:#fafbfc; font-family:'Inter','Noto Sans KR',sans-serif; }
        .bulletin-page-content .tp-bd { padding:8px 8px 10px; font-size:9.5px; line-height:1.6; color:#333; }
        .bulletin-page-content .tp-label { font-size:9px; font-weight:700; letter-spacing:.4px; margin-top:10px; margin-bottom:3px; font-family:'Inter','Noto Sans KR',sans-serif; }
        .bulletin-page-content .tp-label:first-child { margin-top:0; }
        .bulletin-page-content .tp-val { font-size:9px; line-height:1.6; color:#555; }
        .bulletin-page-content .tp-church-badge { margin-top:auto; padding:10px; border-radius:4px; color:inherit; text-align:center; font-size:11px; font-weight:700; letter-spacing:2px; position:absolute; bottom:14px; left:14px; right:14px; }
        .bulletin-page-content .tp-note { font-size:9px; color:#666; margin-top:6px; }
        .bulletin-page-content .tp-sermon-box { background:#f5f7fa; border-radius:5px; padding:6px 8px; margin-bottom:8px; border-left:3px solid; }
        .bulletin-page-content .tp-sermon-t { font-size:13px; font-weight:800; margin-bottom:3px; }
        .bulletin-page-content .tp-sermon-p { font-size:9.5px; color:#4a6fa5; }
        .bulletin-page-content .tp-sermon-th { font-size:8.5px; color:#888; margin-top:2px; font-style:italic; }
        .bulletin-page-content .tp-column { border-left:3px solid; padding:6px 8px; margin-top:8px; background:linear-gradient(135deg,#faf5ef,#f3ebe0); border-radius:4px; }
        .bulletin-page-content .tp-col-txt { font-size:9px; line-height:1.75; color:#444; }
        .bulletin-page-content .tp-ad { padding:6px 8px; margin-bottom:6px; background:#f8f9fa; border-radius:3px; border-left:3px solid; }
        .bulletin-page-content .tp-ad-dept { font-size:8px; font-weight:700; letter-spacing:.4px; font-family:'Inter','Noto Sans KR',sans-serif; }
        .bulletin-page-content .tp-ad-txt { font-size:9px; color:#444; line-height:1.5; margin-top:1px; }
        .bulletin-page-content .tp-bday { margin-top:10px; padding-top:8px; border-top:1px solid #eee; }
        .bulletin-page-content .tp-bday-list { display:flex; flex-wrap:wrap; gap:3px; margin-top:5px; }
        .bulletin-page-content .tp-bday-tag { padding:2px 6px; border-radius:8px; font-size:8.5px; font-weight:500; }

        /* --- TRI-FOLD VIEW TOGGLE (outside=겉면, inside=속면) --- */
        [data-bview="outside"] .bp-tri-in { display:none !important; }
        [data-bview="inside"] .bp-tri-out { display:none !important; }
        .bulletin-page-content .bp-cell { padding:16px; overflow:auto; box-sizing:border-box; border-right:1px dashed #e5e7eb; }
        .bulletin-page-content .bp-cell:last-child { border-right:none; }

        /* ==================== HALF-FOLD (2면 접지) ==================== */
        .bulletin-page-content .bp-wrap { display:flex; flex-direction:column; align-items:center; gap:16px; padding:4px; font-family:'Noto Serif KR','Batang',Georgia,serif; }
        .bulletin-page-content .bp { width:100%; min-height:280px; background:#fff; border:1px solid #ddd; box-shadow:0 2px 12px rgba(0,0,0,.06); overflow:hidden; position:relative; box-sizing:border-box; }
        .bulletin-page-content .bp-four-face { width:100%; height:100%; display:flex; flex-direction:column; font-family:'Noto Serif KR','Batang',Georgia,serif; }
        .bulletin-page-content .bp-four-face .bp-spread { display:grid; grid-template-columns:1fr 1fr; width:100%; height:50%; min-height:0; box-shadow:0 1px 3px rgba(0,0,0,0.1); border-radius:4px; overflow:hidden; box-sizing:border-box; }
        .bulletin-page-content .bp-four-face .bp-cell .bp { box-shadow:none; border:none; }
        .bulletin-page-content .bp-four-face .bp-cell .bp-2 { border-right:none; }
        .bulletin-page-content .bp-1 { display:flex; align-items:center; justify-content:center; }
        .bulletin-page-content .bp-cover-bg { position:absolute; inset:0; opacity:.96; }
        .bulletin-page-content .bp-cover-content { position:relative; z-index:1; text-align:center; color:inherit; padding:36px 24px; width:100%; }
        .bulletin-page-content .bp-cross { font-size:30px; opacity:.4; margin-bottom:14px; }
        .bulletin-page-content .bp-church-name { font-size:22px; font-weight:800; letter-spacing:5px; margin-bottom:2px; }
        .bulletin-page-content .bp-church-sub { font-size:9.5px; opacity:.5; letter-spacing:3px; text-transform:uppercase; }
        .bulletin-page-content .bp-cdiv { width:40px; height:1.5px; margin:16px auto; opacity:.5; }
        .bulletin-page-content .bp-sermon-box { margin:8px 0; }
        .bulletin-page-content .bp-sermon-title { font-size:16px; font-weight:700; letter-spacing:1px; line-height:1.5; }
        .bulletin-page-content .bp-sermon-passage { font-size:10.5px; opacity:.65; margin-top:4px; }
        .bulletin-page-content .bp-sermon-theme { font-size:9px; opacity:.45; margin-top:3px; font-style:italic; }
        .bulletin-page-content .bp-date-line { font-size:10px; opacity:.75; letter-spacing:1px; }
        .bulletin-page-content .bp-time-line { font-size:9px; opacity:.5; margin-top:2px; }
        .bulletin-page-content .bp-pastor-line { font-size:10px; opacity:.6; margin-top:18px; letter-spacing:2px; }
        .bulletin-page-content .bp-page-hd { font-size:12px; font-weight:800; padding:10px 16px; border-bottom:2px solid #1e3a5f; letter-spacing:.8px; background:#fafbfc; font-family:'Inter','Noto Sans KR',sans-serif; }
        .bulletin-page-content .bp-page-bd { padding:12px 16px 16px; font-size:10px; line-height:1.6; color:#333; }
        .bulletin-page-content .bp-note { font-size:9px; color:#666; margin-bottom:3px; }
        .bulletin-page-content .bp-colbox { background:linear-gradient(135deg,#faf5ef,#f3ebe0); border-radius:5px; padding:11px; margin-top:10px; border-left:3px solid; }
        .bulletin-page-content .bp-col-hd { font-size:10px; font-weight:800; margin-bottom:4px; }
        .bulletin-page-content .bp-col-txt { font-size:9px; line-height:1.7; color:#444; }
        .bulletin-page-content .bp-adlist { display:flex; flex-direction:column; gap:6px; margin-bottom:10px; }
        .bulletin-page-content .bp-ad { padding:6px 9px; background:#f8f9fa; border-radius:4px; border-left:3px solid; }
        .bulletin-page-content .bp-ad-dept { font-size:8px; font-weight:700; letter-spacing:.4px; font-family:'Inter','Noto Sans KR',sans-serif; }
        .bulletin-page-content .bp-ad-txt { font-size:9.5px; color:#444; line-height:1.5; }
        .bulletin-page-content .bp-bday-sec { margin-top:10px; padding-top:8px; border-top:1px solid #eee; }
        .bulletin-page-content .bp-sub-hd { font-size:10.5px; font-weight:800; margin-bottom:6px; }
        .bulletin-page-content .bp-bday-list { display:flex; flex-wrap:wrap; gap:3px; }
        .bulletin-page-content .bp-bday-tag { padding:2px 6px; border-radius:8px; font-size:9px; font-weight:500; }
        .bulletin-page-content .bp-igrid { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:10px; }
        .bulletin-page-content .bp-icell { background:#f8f9fa; border-radius:5px; padding:8px; }
        .bulletin-page-content .bp-ititle { font-size:9px; font-weight:700; letter-spacing:.3px; margin-bottom:3px; font-family:'Inter','Noto Sans KR',sans-serif; }
        .bulletin-page-content .bp-itxt { font-size:9px; line-height:1.6; color:#555; }
        .bulletin-page-content .bp-offering { background:#f8f9fa; border-radius:5px; padding:8px; margin-bottom:7px; }
        .bulletin-page-content .bp-acct { background:#f0f4f8; border-radius:5px; padding:8px; margin-bottom:10px; border:1px dashed #c8d6e5; }
        .bulletin-page-content .bp-cfooter { border-radius:5px; padding:11px; color:inherit; text-align:center; }
        .bulletin-page-content .bp-cf-name { font-size:11px; font-weight:700; letter-spacing:2px; margin-bottom:4px; }
        .bulletin-page-content .bp-cf-det { font-size:8.5px; opacity:.8; margin-top:1px; }

        /* --- HALF-FOLD VIEW TOGGLE (cover=표지, inner=내지, back=뒷면) --- */
        [data-bview="cover"] .bp-four-face .bp-spread:last-child { display:none !important; }
        [data-bview="cover"] .bp-four-face .bp-spread:first-child .bp-cell:first-child { display:none !important; }
        [data-bview="inner"] .bp-four-face .bp-spread:first-child { display:none !important; }
        [data-bview="back"] .bp-four-face .bp-spread:last-child { display:none !important; }
        [data-bview="back"] .bp-four-face .bp-spread:first-child .bp-cell:last-child { display:none !important; }

        /* ==================== ONLINE/PDF ==================== */
        .bulletin-page-content .bp-online { width:380px; background:#fff; border-radius:12px; overflow:hidden; box-shadow:0 4px 24px rgba(0,0,0,.08); font-family:'Inter','Noto Sans KR',sans-serif; }
        .bulletin-page-content .ol-header { padding:28px 24px; color:inherit; text-align:center; position:relative; }
        .bulletin-page-content .ol-cross { font-size:22px; opacity:.35; margin-bottom:10px; }
        .bulletin-page-content .ol-church { font-size:20px; font-weight:800; letter-spacing:3px; }
        .bulletin-page-content .ol-sub { font-size:9px; opacity:.5; letter-spacing:2px; margin-top:2px; }
        .bulletin-page-content .ol-date { font-size:10px; opacity:.7; margin-top:12px; letter-spacing:.5px; }
        .bulletin-page-content .ol-sermon { text-align:center; padding:18px 24px; background:var(--al,#e8eef6); }
        .bulletin-page-content .ol-sermon-t { font-size:18px; font-weight:800; color:var(--ac,#1e3a5f); letter-spacing:1px; }
        .bulletin-page-content .ol-sermon-p { font-size:11px; color:#666; margin-top:4px; }
        .bulletin-page-content .ol-sermon-th { font-size:10px; color:#999; margin-top:2px; font-style:italic; }
        .bulletin-page-content .ol-body { padding:16px 20px; }
        .bulletin-page-content .ol-sec { margin-bottom:18px; }
        .bulletin-page-content .ol-sec-t { font-size:13px; font-weight:800; color:var(--ac,#1e3a5f); margin-bottom:10px; padding-bottom:6px; border-bottom:2px solid var(--ac,#1e3a5f); letter-spacing:.5px; }
        .bulletin-page-content .ol-note { font-size:11px; color:#666; margin-top:6px; }
        .bulletin-page-content .ol-col-txt { font-size:12px; line-height:1.8; color:#444; background:var(--al,#f5f7fa); padding:14px; border-radius:8px; border-left:3px solid var(--gold,#c5a55a); }
        .bulletin-page-content .ol-ad { padding:10px 12px; margin-bottom:8px; background:#f8f9fa; border-radius:8px; border-left:3px solid var(--ac,#1e3a5f); }
        .bulletin-page-content .ol-ad-dept { font-size:10px; font-weight:700; color:var(--ac,#1e3a5f); letter-spacing:.3px; }
        .bulletin-page-content .ol-ad-txt { font-size:11.5px; color:#444; line-height:1.6; margin-top:2px; }
        .bulletin-page-content .ol-bdays { display:flex; flex-wrap:wrap; gap:5px; }
        .bulletin-page-content .ol-bday { background:var(--al,#e8eef6); padding:4px 10px; border-radius:12px; font-size:11px; font-weight:500; color:var(--ac,#1e3a5f); }
        .bulletin-page-content .ol-info-sec { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
        .bulletin-page-content .ol-info-item { background:#f8f9fa; padding:10px; border-radius:8px; font-size:11px; line-height:1.6; color:#555; }
        .bulletin-page-content .ol-info-item strong { display:block; margin-bottom:4px; color:var(--ac,#1e3a5f); font-size:10px; }
        .bulletin-page-content .ol-footer { padding:16px 20px; color:inherit; font-size:10px; text-align:center; line-height:1.8; opacity:.9; }

        /* 미리보기: 스프레드/표지 높이 채우기 */
        .bulletin-page-content .bp-spread > div { height: 100%; }
        .bulletin-page-content .bp-spread .tp-cover { height: 100%; min-height: 100%; }
        .bulletin-page-content .bp-four-face .bp-spread > div { height: 100%; overflow: hidden; box-sizing: border-box; }
        .bulletin-page-content .bp-four-face .bp-spread .tp-cover { height: 100%; min-height: 100%; display: flex; flex-direction: column; justify-content: center; align-items: center; }
        .bulletin-page-content .bp-four-face .bp-spread .bp-1 { height: 100%; min-height: 100%; display: flex; flex-direction: column; justify-content: center; align-items: center; }
      `}</style>
    </UnifiedPageLayout>
  );
}
