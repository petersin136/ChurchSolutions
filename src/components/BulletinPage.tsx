"use client";

import { useState, useEffect, useCallback, useRef, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { LayoutDashboard, Pencil, FolderOpen, Settings, Newspaper, Printer, FileDown, Eye, FileText, Save, Archive, Edit3, type LucideIcon } from "lucide-react";
import { UnifiedPageLayout } from "@/components/layout/UnifiedPageLayout";
import { Pagination } from "@/components/common/Pagination";
import KakaoShareCard from "@/components/bulletin/KakaoShareCard";
import { initKakao, shareTextToKakao } from "@/lib/kakao";
import { downloadElementAsImage } from "@/utils/captureElement";

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
interface ContentSection {
  content: string;
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

interface CurrentBulletin {
  key: string;
  date: string;
  template: string;
  pastor: PastorSection;
  worship: WorshipSection;
  youth: ContentSection;
  education: ContentSection;
  mission: ContentSection;
  general: GeneralSection;
  savedAt?: string;
  sermonTitle?: string;
}

interface BulletinDB {
  settings: BulletinSettings;
  current: CurrentBulletin;
  history: CurrentBulletin[];
}

type SectionKey = "pastor" | "worship" | "youth" | "education" | "mission" | "general";
const SECTIONS: Record<SectionKey, { name: string; icon: string }> = {
  pastor: { name: "담임목사", icon: "⛪" },
  worship: { name: "예배/찬양", icon: "🎵" },
  youth: { name: "청년부", icon: "🧑‍🤝‍🧑" },
  education: { name: "교육부", icon: "📚" },
  mission: { name: "선교부", icon: "🌍" },
  general: { name: "총무/행정", icon: "📋" },
};

type OutputMode = "print" | "online" | "kakao";
type PrintFormat = "fold2" | "fold3";

const TEMPLATES = [
  { id: "classic-navy", name: "클래식 네이비", desc: "전통적인 격조있는 디자인",
    headerBg: "linear-gradient(180deg,#1a2744,#2c4a7c)", accent: "#1e3a5f", accentLight: "#e8eef6",
    gold: "#c5a55a", bodyBg: "#fff", sectionBg: "#f5f7fa" },
  { id: "elegant-wine", name: "우아한 버건디", desc: "품격있는 따뜻한 디자인",
    headerBg: "linear-gradient(180deg,#3d1225,#6b2d4a)", accent: "#5a1e3a", accentLight: "#f6e8ee",
    gold: "#c9a96e", bodyBg: "#fffdf9", sectionBg: "#faf5f0" },
  { id: "nature-olive", name: "내추럴 올리브", desc: "자연의 편안한 디자인",
    headerBg: "linear-gradient(180deg,#2d3b2d,#4a6741)", accent: "#3a5a2e", accentLight: "#ecf2e8",
    gold: "#8b7355", bodyBg: "#fcfdf9", sectionBg: "#f2f5ef" },
];
type Tpl = (typeof TEMPLATES)[number];

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
    },
    current: {
      key: BULLETIN_KEY,
      date: BULLETIN_DATE_STR,
      template: "classic-navy",
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
      youth: { content: "▸ 청년 예배: 주일 오후 2시 (청년부실)\n▸ 수요 성경공부: 수요일 저녁 7시 30분\n▸ 2월 MT: 2/28-3/1 양평 수련원\n▸ 새가족환영회: 3/1(주일) 예배 후", submitted: true, submittedAt: fds(TODAY) },
      education: { content: "▸ 주일학교: 오전 9시 30분 (유초등부/중고등부)\n▸ 교사 기도회: 주일 오전 9시\n▸ 겨울 성경학교: 2/21-22 (토-주일)\n▸ 부활절 특별 프로그램 준비위원 모집", submitted: true, submittedAt: fds(TODAY) },
      mission: { content: "▸ 필리핀 단기선교: 3/15-22 (신청마감 2/28)\n▸ 선교 기도편지: 김OO 선교사 (태국)\n▸ 다문화 한국어 교실: 매주 토 오전 10시\n▸ 지역사회 봉사: 매월 셋째 토요일", submitted: true, submittedAt: fds(TODAY) },
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
    },
    current: {
      key: BULLETIN_KEY,
      date: BULLETIN_DATE_STR,
      template: "classic-navy",
      pastor: { sermonTitle: "", sermonPassage: "", sermonTheme: "", column: "", pastorNotice: "", submitted: false, submittedAt: "" },
      worship: { worshipOrder: "", praise: "", special: "", submitted: false, submittedAt: "" },
      youth: { content: "", submitted: false, submittedAt: "" },
      education: { content: "", submitted: false, submittedAt: "" },
      mission: { content: "", submitted: false, submittedAt: "" },
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
  if (!db.current) db.current = defaultEmptyDB().current;
  if (!Array.isArray(db.history)) db.history = [];
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

function FormField({ label, children }: { label: string; children: ReactNode }) {
  return <div style={{ marginBottom: 14 }}><label style={{ display: "block", fontSize: 12, fontWeight: 600, color: C.text, marginBottom: 4 }}>{label}</label>{children}</div>;
}

function FInput({ value, onChange, placeholder, type = "text", style }: { value: string; onChange: (v: string) => void; placeholder?: string; type?: string; style?: CSSProperties }) {
  return <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} type={type} style={{ width: "100%", padding: "9px 12px", border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 13, fontFamily: "inherit", background: C.bg, outline: "none", ...style }} />;
}

function FTextarea({ value, onChange, placeholder, style }: { value: string; onChange: (v: string) => void; placeholder?: string; style?: CSSProperties }) {
  return <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={{ width: "100%", padding: "9px 12px", border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 13, fontFamily: "inherit", background: C.bg, outline: "none", resize: "vertical", minHeight: 70, ...style }} />;
}

function FSelect({ value, onChange, children }: { value: string; onChange: (v: string) => void; children: ReactNode }) {
  return <select value={value} onChange={e => onChange(e.target.value)} style={{ width: "100%", padding: "9px 12px", border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 13, fontFamily: "inherit", background: C.bg, outline: "none", cursor: "pointer" }}>{children}</select>;
}

/* ---------- Preview HTML (Multi-Mode Bulletin) ---------- */
function prepData(db: BulletinDB) {
  const c = db.current, s = db.settings;
  const tpl = TEMPLATES.find(t => t.id === c.template) || TEMPLATES[0];
  const esc = (x: string) => (x || "").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const nl = (x: string) => esc(x).replace(/\n/g, "<br>");
  const orderLines = (c.worship?.worshipOrder || "").split("\n").filter(l => l.trim());
  const orderRows = orderLines.map(l => {
    const parts = l.split("…").filter(p => p.trim());
    if (parts.length >= 2)
      return `<tr><td class="bp-o-item">${esc(parts[0].trim())}</td><td class="bp-o-dots"></td><td class="bp-o-detail">${esc(parts[parts.length - 1].trim())}</td></tr>`;
    return `<tr><td class="bp-o-item" colspan="3">${esc(l.trim())}</td></tr>`;
  }).join("");
  const ads: { dept: string; text: string }[] = [];
  if (c.youth?.content) ads.push({ dept: "청년부", text: c.youth.content });
  if (c.education?.content) ads.push({ dept: "교육부", text: c.education.content });
  if (c.mission?.content) ads.push({ dept: "선교부", text: c.mission.content });
  if (c.general?.content) ads.push({ dept: "교회 소식", text: c.general.content });
  if (c.pastor?.pastorNotice) ads.push({ dept: "특별 공지", text: c.pastor.pastorNotice });
  const bdays = (c.general?.birthday || "").split(",").map(b => b.trim()).filter(Boolean);
  return { c, s, tpl, esc, nl, orderRows, ads, bdays };
}

/* 6면: section index 0=cover(면1), 1=flap(면2), 2=worship(면3), 3=sermon(면4), 4=news(면5), 5=back(면6) */
function getTriFoldSectionHTML(db: BulletinDB, index: number): string {
  const { c, s, tpl, esc, nl, orderRows, ads, bdays } = prepData(db);
  switch (index) {
    case 0:
      return `<div class="tp tp-cover" style="background:${tpl.headerBg}; height:100%; width:100%; min-height:100%; display:flex; flex-direction:column; justify-content:center; align-items:center; -webkit-print-color-adjust:exact; print-color-adjust:exact; color-adjust:exact;"><div class="tp-bg" style="background:${tpl.headerBg}"></div><div class="tp-cover-inner">
    <div class="tp-cross">&#10013;</div><div class="tp-cname">${esc(s.church)}</div><div class="tp-csub">${esc(s.churchSub || "")}</div>
    <div class="tp-cdiv" style="background:${tpl.gold}"></div>
    ${c.pastor?.sermonTitle ? `<div class="tp-stitle">${esc(c.pastor.sermonTitle)}</div>` : ""}
    ${c.pastor?.sermonPassage ? `<div class="tp-spass">${esc(c.pastor.sermonPassage)}</div>` : ""}
    <div class="tp-cdiv" style="background:${tpl.gold}"></div>
    <div class="tp-date">${esc(c.date || BULLETIN_DATE_STR)} 주일예배</div><div class="tp-time">${esc(s.worshipTime)}</div>
    <div class="tp-pastor">담임목사 ${esc(s.pastor)}</div></div></div>`;
    case 1:
      return `<div class="tp tp-flap"><div class="tp-hd" style="border-color:${tpl.accent};color:${tpl.accent}">주간 안내</div><div class="tp-bd">
    ${c.general?.servants ? `<div class="tp-label" style="color:${tpl.accent}">&#128101; 금주 봉사자</div><div class="tp-val">${nl(c.general.servants)}</div>` : ""}
    ${c.general?.schedule ? `<div class="tp-label" style="color:${tpl.accent}">&#128197; 금주 일정</div><div class="tp-val">${nl(c.general.schedule)}</div>` : ""}
    ${c.general?.offering ? `<div class="tp-label" style="color:${tpl.accent}">&#128176; 헌금 보고</div><div class="tp-val">${nl(c.general.offering)}</div>` : ""}
  </div></div>`;
    case 2:
      return `<div class="tp tp-worship"><div class="tp-hd" style="border-color:${tpl.accent};color:${tpl.accent}">&#128214; 예배 순서</div><div class="tp-bd">
    ${orderRows ? `<table class="tp-otbl">${orderRows}</table>` : '<div class="tp-empty">예배 순서를 입력하세요</div>'}
    ${c.worship?.praise ? `<div class="tp-note">&#127925; 찬양: ${esc(c.worship.praise)}</div>` : ""}
    ${c.worship?.special ? `<div class="tp-note">&#127908; ${esc(c.worship.special)}</div>` : ""}
  </div></div>`;
    case 3:
      return `<div class="tp tp-sermon"><div class="tp-hd" style="border-color:${tpl.accent};color:${tpl.accent}">&#9997;&#65039; 말씀 / 칼럼</div><div class="tp-bd">
    ${c.pastor?.sermonTitle ? `<div class="tp-sermon-box" style="border-color:${tpl.gold}"><div class="tp-sermon-t" style="color:${tpl.accent}">${esc(c.pastor.sermonTitle)}</div>${c.pastor.sermonPassage ? `<div class="tp-sermon-p">${esc(c.pastor.sermonPassage)}</div>` : ""}${c.pastor.sermonTheme ? `<div class="tp-sermon-th">${esc(c.pastor.sermonTheme)}</div>` : ""}</div>` : ""}
    ${c.pastor?.column ? `<div class="tp-column" style="border-left-color:${tpl.gold}"><div class="tp-col-txt">${nl(c.pastor.column)}</div></div>` : ""}
  </div></div>`;
    case 4:
      return `<div class="tp tp-news"><div class="tp-hd" style="border-color:${tpl.accent};color:${tpl.accent}">&#128226; 광고 및 소식</div><div class="tp-bd">
    ${ads.length ? ads.map(a => `<div class="tp-ad" style="border-left-color:${tpl.accent}"><div class="tp-ad-dept" style="color:${tpl.accent}">${esc(a.dept)}</div><div class="tp-ad-txt">${nl(a.text)}</div></div>`).join("") : '<div class="tp-empty">광고를 입력하세요</div>'}
    ${bdays.length ? `<div class="tp-bday"><div class="tp-label" style="color:${tpl.accent}">&#127874; 금주 생일</div><div class="tp-bday-list">${bdays.map(b => `<span class="tp-bday-tag" style="background:${tpl.accentLight};color:${tpl.accent}">${esc(b)}</span>`).join("")}</div></div>` : ""}
  </div></div>`;
    case 5:
      return `<div class="tp tp-back"><div class="tp-hd" style="border-color:${tpl.accent};color:${tpl.accent}">교회 안내</div><div class="tp-bd">
    <div class="tp-label" style="color:${tpl.accent}">&#127974; 헌금 계좌</div><div class="tp-val">${esc(s.account || "")}</div>
    <div class="tp-label" style="color:${tpl.accent}">&#128205; 주소</div><div class="tp-val">${esc(s.address || "")}</div>
    <div class="tp-label" style="color:${tpl.accent}">&#9742; 전화</div><div class="tp-val">${esc(s.phone || "")}</div>
    <div class="tp-church-badge" style="background:${tpl.accent}">${esc(s.church)}</div></div></div>`;
    default:
      return "";
  }
}

/* 3면 접지 (Tri-fold) - 겉면 3패널 + 속면 3패널 */
function buildTriFold(db: BulletinDB): string {
  const back = getTriFoldSectionHTML(db, 5), cover = getTriFoldSectionHTML(db, 0), flap = getTriFoldSectionHTML(db, 1);
  const worship = getTriFoldSectionHTML(db, 2), sermon = getTriFoldSectionHTML(db, 3), news = getTriFoldSectionHTML(db, 4);
  return `<div class="bp-tri">
    <div class="bp-spread bp-tri-out" style="display:grid;grid-template-columns:1fr 1fr 1fr;width:100%;height:100%;">
      <div class="bp-cell">${back}</div>
      <div class="bp-cell">${cover}</div>
      <div class="bp-cell">${flap}</div>
    </div>
    <div class="bp-spread bp-tri-in" style="display:grid;grid-template-columns:1fr 1fr 1fr;width:100%;height:100%;">
      <div class="bp-cell">${worship}</div>
      <div class="bp-cell">${sermon}</div>
      <div class="bp-cell">${news}</div>
    </div>
  </div>`;
}

/* 4면: section index 0=표지(p1), 1=예배순서(p2), 2=광고(p3), 3=교회안내(p4) */
function getHalfFoldSectionHTML(db: BulletinDB, index: number): string {
  const { c, s, tpl, esc, nl, orderRows, ads, bdays } = prepData(db);
  switch (index) {
    case 0:
      return `<div class="bp bp-1" style="background:${tpl.headerBg}; height:100%; width:100%; min-height:100%; display:flex; flex-direction:column; justify-content:center; align-items:center; -webkit-print-color-adjust:exact; print-color-adjust:exact; color-adjust:exact;"><div class="bp-cover-bg" style="background:${tpl.headerBg}"></div><div class="bp-cover-content">
    <div class="bp-cross">&#10013;</div><div class="bp-church-name">${esc(s.church)}</div><div class="bp-church-sub">${esc(s.churchSub || "")}</div>
    <div class="bp-cdiv" style="background:${tpl.gold}"></div>
    ${c.pastor?.sermonTitle ? `<div class="bp-sermon-box"><div class="bp-sermon-title">${esc(c.pastor.sermonTitle)}</div>${c.pastor.sermonPassage ? `<div class="bp-sermon-passage">${esc(c.pastor.sermonPassage)}</div>` : ""}${c.pastor.sermonTheme ? `<div class="bp-sermon-theme">${esc(c.pastor.sermonTheme)}</div>` : ""}</div>` : ""}
    <div class="bp-cdiv" style="background:${tpl.gold}"></div>
    <div class="bp-date-line">${esc(c.date || BULLETIN_DATE_STR)} 주일예배</div><div class="bp-time-line">${esc(s.worshipTime)}</div>
    <div class="bp-pastor-line">담임목사 ${esc(s.pastor)}</div></div></div>`;
    case 1:
      return `<div class="bp bp-2"><div class="bp-page-hd" style="border-bottom-color:${tpl.accent}">&#128214; 예배 순서</div><div class="bp-page-bd">
    ${orderRows ? `<table class="bp-otbl">${orderRows}</table>` : '<div class="bp-empty">예배 순서를 입력하세요</div>'}
    ${c.worship?.praise ? `<div class="bp-note">&#127925; 찬양: ${esc(c.worship.praise)}</div>` : ""}
    ${c.worship?.special ? `<div class="bp-note">&#127908; ${esc(c.worship.special)}</div>` : ""}
    ${c.pastor?.column ? `<div class="bp-colbox" style="border-left-color:${tpl.gold}"><div class="bp-col-hd" style="color:${tpl.accent}">&#9997;&#65039; 목사님 칼럼</div><div class="bp-col-txt">${nl(c.pastor.column)}</div></div>` : ""}
  </div></div>`;
    case 2:
      return `<div class="bp bp-3"><div class="bp-page-hd" style="border-bottom-color:${tpl.accent}">&#128226; 광고 및 소식</div><div class="bp-page-bd">
    ${ads.length ? `<div class="bp-adlist">${ads.map(a => `<div class="bp-ad" style="border-left-color:${tpl.accent}"><div class="bp-ad-dept" style="color:${tpl.accent}">${esc(a.dept)}</div><div class="bp-ad-txt">${nl(a.text)}</div></div>`).join("")}</div>` : '<div class="bp-empty">광고를 입력하세요</div>'}
    ${bdays.length ? `<div class="bp-bday-sec"><div class="bp-sub-hd" style="color:${tpl.accent}">&#127874; 금주 생일</div><div class="bp-bday-list">${bdays.map(b => `<span class="bp-bday-tag" style="background:${tpl.accentLight};color:${tpl.accent}">${esc(b)}</span>`).join("")}</div></div>` : ""}
  </div></div>`;
    case 3:
      return `<div class="bp bp-4"><div class="bp-page-hd" style="border-bottom-color:${tpl.accent}">&#128203; 교회 안내</div><div class="bp-page-bd">
    <div class="bp-igrid">
      ${c.general?.servants ? `<div class="bp-icell"><div class="bp-ititle" style="color:${tpl.accent}">&#128101; 금주 봉사자</div><div class="bp-itxt">${nl(c.general.servants)}</div></div>` : ""}
      ${c.general?.schedule ? `<div class="bp-icell"><div class="bp-ititle" style="color:${tpl.accent}">&#128197; 금주 일정</div><div class="bp-itxt">${nl(c.general.schedule)}</div></div>` : ""}
    </div>
    ${c.general?.offering ? `<div class="bp-offering"><div class="bp-ititle" style="color:${tpl.accent}">&#128176; 헌금 보고</div><div class="bp-itxt">${nl(c.general.offering)}</div></div>` : ""}
    <div class="bp-acct"><div class="bp-ititle" style="color:${tpl.accent}">&#127974; 헌금 계좌</div><div class="bp-itxt">${esc(s.account || "")}</div></div>
    <div class="bp-cfooter" style="background:${tpl.headerBg}"><div class="bp-cf-name">${esc(s.church)}</div><div class="bp-cf-det">&#128205; ${esc(s.address || "")}</div><div class="bp-cf-det">&#9742; ${esc(s.phone || "")}</div></div>
  </div></div>`;
    default:
      return "";
  }
}

/* 2면 접지 (Half-fold) - 표지/내지좌/내지우/뒷면 */
function buildHalfFold(db: BulletinDB): string {
  const p1 = getHalfFoldSectionHTML(db, 0), p2 = getHalfFoldSectionHTML(db, 1), p3 = getHalfFoldSectionHTML(db, 2), p4 = getHalfFoldSectionHTML(db, 3);
  return `<div class="bp-four-face">
    <div class="bp-spread" style="display:grid;grid-template-columns:1fr 1fr;width:100%;height:100%;">
      <div class="bp-cell">${p4}</div>
      <div class="bp-cell">${p1}</div>
    </div>
    <div class="bp-spread" style="display:grid;grid-template-columns:1fr 1fr;width:100%;height:100%;">
      <div class="bp-cell">${p2}</div>
      <div class="bp-cell">${p3}</div>
    </div>
  </div>`;
}

/* 온라인/PDF용 (모바일 친화적 카드형) */
function buildOnlineHTML(db: BulletinDB): string {
  const { c, s, tpl, esc, nl, orderRows, ads, bdays } = prepData(db);
  return `<div class="bp-online" style="--ac:${tpl.accent};--al:${tpl.accentLight};--gold:${tpl.gold}">
    <div class="ol-header" style="background:${tpl.headerBg}"><div class="ol-cross">&#10013;</div>
      <div class="ol-church">${esc(s.church)}</div><div class="ol-sub">${esc(s.churchSub || "")}</div>
      <div class="ol-date">${esc(c.date || BULLETIN_DATE_STR)} 주일예배 · ${esc(s.worshipTime)}</div></div>
    ${c.pastor?.sermonTitle ? `<div class="ol-sermon"><div class="ol-sermon-t">${esc(c.pastor.sermonTitle)}</div>
      ${c.pastor.sermonPassage ? `<div class="ol-sermon-p">${esc(c.pastor.sermonPassage)}</div>` : ""}
      ${c.pastor.sermonTheme ? `<div class="ol-sermon-th">${esc(c.pastor.sermonTheme)}</div>` : ""}</div>` : ""}
    <div class="ol-body">
      <div class="ol-sec"><div class="ol-sec-t">&#128214; 예배 순서</div>
        ${orderRows ? `<table class="bp-otbl">${orderRows}</table>` : '<div class="bp-empty">예배 순서 없음</div>'}
        ${c.worship?.praise ? `<div class="ol-note">&#127925; ${esc(c.worship.praise)}</div>` : ""}
        ${c.worship?.special ? `<div class="ol-note">&#127908; ${esc(c.worship.special)}</div>` : ""}</div>
      ${c.pastor?.column ? `<div class="ol-sec"><div class="ol-sec-t">&#9997;&#65039; 목사님 칼럼</div><div class="ol-col-txt">${nl(c.pastor.column)}</div></div>` : ""}
      ${ads.length ? `<div class="ol-sec"><div class="ol-sec-t">&#128226; 광고 및 소식</div>
        ${ads.map(a => `<div class="ol-ad"><div class="ol-ad-dept">${esc(a.dept)}</div><div class="ol-ad-txt">${nl(a.text)}</div></div>`).join("")}</div>` : ""}
      ${bdays.length ? `<div class="ol-sec"><div class="ol-sec-t">&#127874; 금주 생일</div><div class="ol-bdays">${bdays.map(b => `<span class="ol-bday">${esc(b)}</span>`).join("")}</div></div>` : ""}
      <div class="ol-sec ol-info-sec">
        ${c.general?.servants ? `<div class="ol-info-item"><strong>&#128101; 봉사자</strong><br>${nl(c.general.servants)}</div>` : ""}
        ${c.general?.schedule ? `<div class="ol-info-item"><strong>&#128197; 일정</strong><br>${nl(c.general.schedule)}</div>` : ""}
        ${c.general?.offering ? `<div class="ol-info-item"><strong>&#128176; 헌금</strong><br>${nl(c.general.offering)}</div>` : ""}
      </div>
    </div>
    <div class="ol-footer" style="background:${tpl.accent}"><div>${esc(s.church)}</div><div>${esc(s.address || "")} · &#9742; ${esc(s.phone || "")}</div><div>${esc(s.account || "")}</div></div>
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
  const [currentPageHistory, setCurrentPageHistory] = useState(1);
  const listRefHistory = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const dashPreviewRef = useRef<HTMLDivElement>(null);
  const [previewView, setPreviewView] = useState<BulletinView>("all");
  const [previewScale, setPreviewScale] = useState(mob ? 0.45 : 0.75);
  const [outputMode, setOutputMode] = useState<OutputMode>("print");
  const [printFormat, setPrintFormat] = useState<PrintFormat>("fold3");
  const kakaoCardRef = useRef<HTMLDivElement>(null);
  const [dashPreviewScale, setDashPreviewScale] = useState(0.6);
  const [showFullPreview, setShowFullPreview] = useState(false);
  const [fullPreviewHtml, setFullPreviewHtml] = useState("");
  const [showDashPanelMobile, setShowDashPanelMobile] = useState(false);

  const bulletinFormatDisplay: BulletinFormat = outputMode === "online" ? "온라인" : printFormat === "fold3" ? "6면" : "4면";
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
  const zoomIn = () => setPreviewScale(s => Math.min(s + 0.1, 2.0));
  const zoomOut = () => setPreviewScale(s => Math.max(s - 0.1, 0.25));
  const zoomReset = () => setPreviewScale(mob ? 0.45 : 0.75);

  useEffect(() => {
    saveBulletin(db);
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
    if (outputMode === "kakao" && kakaoCardRef.current) return kakaoCardRef.current;
    const byId = document.getElementById("bulletin-print-area");
    if (byId) return byId;
    const el = document.querySelector("[data-bulletin-preview]") as HTMLElement;
    return el || previewRef.current;
  }, [outputMode]);

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
    setDb(prev => ({ ...prev, current: JSON.parse(JSON.stringify(h)) }));
    setActiveSub("edit");
    showToast("불러왔습니다");
  };

  const secEntries = Object.entries(SECTIONS) as [SectionKey, { name: string; icon: string }][];
  const submittedCount = secEntries.filter(([k]) => db.current[k]?.submitted).length;
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

  const handlePDF = useCallback(() => {
    if (typeof saveFields === "function") saveFields();
    setTimeout(() => {
      window.print();
      showToast("인쇄 대화상자에서 'PDF로 저장'을 선택하세요");
    }, 300);
  }, [showToast]);

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
            const getPreviewStyle = (): { width: number; minHeight: number; padding: number } => {
              switch (bulletinFormatDisplay) {
                case "6면": return { width: 1134, minHeight: 637, padding: 30 };
                case "4면": return { width: 756, minHeight: 1274, padding: 0 };
                case "온라인": return { width: 595, minHeight: 842, padding: 24 };
              }
            };
            const ps = getPreviewStyle();
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
                        const s = db.current[k];
                        const done = !!s?.submitted;
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
                  <div className="flex items-center justify-center gap-2 px-4 pt-3 pb-2">
                    <div className="inline-flex items-center bg-white border border-gray-200 rounded-lg p-0.5 shadow-sm">
                      {(["6면", "4면", "온라인"] as BulletinFormat[]).map((format) => (
                        <button
                          key={format}
                          type="button"
                          onClick={() => setBulletinFormat(format)}
                          className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
                            bulletinFormatDisplay === format
                              ? "bg-gray-900 text-white shadow-sm"
                              : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                          }`}
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
                        onClick={handlePDF}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
                      >
                        <FileText size={13} /> PDF
                      </button>
                      <button
                        type="button"
                        onClick={handleDownloadCard}
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
                          onClick={() => setDashPreviewScale(s => Math.max(0.3, s - 0.1))}
                          className="w-7 h-7 flex items-center justify-center text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-l-lg transition-colors text-sm"
                        >
                          −
                        </button>
                        <span className="w-10 text-center text-xs text-gray-600 font-medium border-x border-gray-200">
                          {Math.round(dashPreviewScale * 100)}%
                        </span>
                        <button
                          type="button"
                          onClick={() => setDashPreviewScale(s => Math.min(2.0, s + 0.1))}
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
                <div className="flex-1 overflow-auto bg-white" style={{ minHeight: 0 }}>
                  <div
                    className="bulletin-preview-display"
                    id="bulletin-print-container"
                    style={{
                      minHeight: "calc(100vh - 170px)",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      padding: "24px 16px",
                      backgroundColor: "#ffffff",
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
                        transform: `scale(${dashPreviewScale})`,
                        transformOrigin: "top center",
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
            );
          })()}

          {activeSub === "edit" && (
            <div className="flex" style={{ height: "calc(100vh - 120px)", minHeight: 0, gap: 20, flexDirection: mob ? "column" : "row" }}>
              <div style={{ overflowY: "auto", paddingRight: mob ? 0 : 10, flex: mob ? "none" : "0 0 auto", width: mob ? "100%" : 400, minWidth: 0 }}>
                <Card>
                  <div style={{ padding: "14px 18px", borderBottom: `1px solid ${C.borderLight}`, fontWeight: 600, fontSize: 14, color: "#111827" }}>출력 형식</div>
                  <div style={{ padding: 18 }}>
                    <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
                      {(["print", "online", "kakao"] as OutputMode[]).map(m => (
                        <button key={m} onClick={() => { setOutputMode(m); if (m !== "print") setPreviewView("all"); }} style={{
                          flex: 1, minWidth: 90, padding: "10px 8px", border: `1px solid ${outputMode === m ? (m === "kakao" ? "#FEE500" : "#111827") : "#e5e7eb"}`, borderRadius: 8,
                          background: outputMode === m ? (m === "kakao" ? "#FFFDE7" : "#111827") : "#ffffff", cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 500,
                          color: outputMode === m ? (m === "kakao" ? "#3C1E1E" : "#ffffff") : "#6b7280", textAlign: "center",
                        }}>{m === "print" ? "인쇄용" : m === "online" ? "온라인/PDF" : "카카오톡"}</button>
                      ))}
                    </div>
                    {outputMode === "print" && (
                      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
                        {(["fold3", "fold2"] as PrintFormat[]).map(f => (
                          <button key={f} onClick={() => { setPrintFormat(f); setPreviewView("all"); }} style={{
                            flex: 1, padding: "10px 8px", border: `1px solid ${printFormat === f ? "#111827" : "#e5e7eb"}`, borderRadius: 8,
                            background: printFormat === f ? "#111827" : "#ffffff", cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 500,
                            color: printFormat === f ? "#ffffff" : "#6b7280", textAlign: "center",
                          }}>{f === "fold3" ? "3면 접지 (삼접지)" : "2면 접지 (반접지)"}</button>
                        ))}
                      </div>
                    )}
                    <div style={{ fontSize: 12, fontWeight: 500, color: "#9ca3af", marginBottom: 8 }}>디자인</div>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      {TEMPLATES.map(t => (
                        <div key={t.id} onClick={() => setCurrent(c => ({ ...c, template: t.id }))} style={{ width: mob ? 90 : 110, cursor: "pointer", borderRadius: 10, border: `2px solid ${db.current.template === t.id ? C.accent : C.border}`, overflow: "hidden", transition: "border .15s" }}>
                          <div style={{ height: 50, background: t.headerBg, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 9, fontWeight: 600, letterSpacing: 1 }}>&#10013; {t.name}</div>
                          <div style={{ padding: "5px 6px", textAlign: "center", fontSize: 9, color: C.textMuted, background: C.bg }}>{t.desc}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </Card>

                <Card id="sec-pastor">
                  <div style={{ padding: "14px 18px", borderBottom: `1px solid ${C.borderLight}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontWeight: 600, fontSize: 14, color: "#111827" }}>담임목사</span>
                    <span style={{ fontSize: 12, padding: "2px 8px", borderRadius: 6, background: db.current.pastor?.submitted ? "#f3f4f6" : "#fef2f2", color: db.current.pastor?.submitted ? "#6b7280" : "#ef4444" }}>{db.current.pastor?.submitted ? "제출" : "미제출"}</span>
                  </div>
                  <div style={{ padding: 18 }}>
                    <FormField label="설교 제목"><FInput value={db.current.pastor?.sermonTitle || ""} onChange={v => setCurrent(c => ({ ...c, pastor: { ...c.pastor, sermonTitle: v } }))} placeholder="이번 주 설교 제목" /></FormField>
                    <div style={{ display: "grid", gridTemplateColumns: mob ? "1fr" : "1fr 1fr", gap: 10 }}>
                      <FormField label="성경 본문"><FInput value={db.current.pastor?.sermonPassage || ""} onChange={v => setCurrent(c => ({ ...c, pastor: { ...c.pastor, sermonPassage: v } }))} placeholder="마태복음 5:1-12" /></FormField>
                      <FormField label="설교 주제"><FInput value={db.current.pastor?.sermonTheme || ""} onChange={v => setCurrent(c => ({ ...c, pastor: { ...c.pastor, sermonTheme: v } }))} placeholder="설교 핵심 주제" /></FormField>
                    </div>
                    <FormField label="목사님 칼럼"><FTextarea value={db.current.pastor?.column || ""} onChange={v => setCurrent(c => ({ ...c, pastor: { ...c.pastor, column: v } }))} placeholder="이번 주 칼럼" style={{ minHeight: 100 }} /></FormField>
                    <FormField label="특별 공지"><FTextarea value={db.current.pastor?.pastorNotice || ""} onChange={v => setCurrent(c => ({ ...c, pastor: { ...c.pastor, pastorNotice: v } }))} placeholder="특별 공지 (선택)" /></FormField>
                  </div>
                </Card>

                <Card id="sec-worship">
                  <div style={{ padding: "14px 18px", borderBottom: `1px solid ${C.borderLight}` }}><span style={{ fontWeight: 600, fontSize: 14, color: "#111827" }}>예배 / 찬양</span></div>
                  <div style={{ padding: 18 }}>
                    <FormField label="예배 순서"><FTextarea value={db.current.worship?.worshipOrder || ""} onChange={v => setCurrent(c => ({ ...c, worship: { ...c.worship, worshipOrder: v } }))} placeholder="묵도&#10;찬송 ………… 00장" style={{ minHeight: 150 }} /></FormField>
                    <FormField label="찬양곡"><FInput value={db.current.worship?.praise || ""} onChange={v => setCurrent(c => ({ ...c, worship: { ...c.worship, praise: v } }))} placeholder="찬양곡 목록" /></FormField>
                    <FormField label="특송/특별순서"><FInput value={db.current.worship?.special || ""} onChange={v => setCurrent(c => ({ ...c, worship: { ...c.worship, special: v } }))} placeholder="특송 - OOO" /></FormField>
                  </div>
                </Card>

                <Card id="sec-youth"><div style={{ padding: "14px 18px", borderBottom: `1px solid ${C.borderLight}` }}><span style={{ fontWeight: 600, fontSize: 14, color: "#111827" }}>청년부</span></div><div style={{ padding: 18 }}><FormField label="청년부 광고"><FTextarea value={db.current.youth?.content || ""} onChange={v => setCurrent(c => ({ ...c, youth: { ...c.youth, content: v } }))} placeholder="청년부 행사, 모임 안내" /></FormField></div></Card>
                <Card id="sec-education"><div style={{ padding: "14px 18px", borderBottom: `1px solid ${C.borderLight}` }}><span style={{ fontWeight: 600, fontSize: 14, color: "#111827" }}>교육부</span></div><div style={{ padding: 18 }}><FormField label="교육부 광고"><FTextarea value={db.current.education?.content || ""} onChange={v => setCurrent(c => ({ ...c, education: { ...c.education, content: v } }))} placeholder="주일학교, 교사 모임" /></FormField></div></Card>
                <Card id="sec-mission"><div style={{ padding: "14px 18px", borderBottom: `1px solid ${C.borderLight}` }}><span style={{ fontWeight: 600, fontSize: 14, color: "#111827" }}>선교부</span></div><div style={{ padding: 18 }}><FormField label="선교부 광고"><FTextarea value={db.current.mission?.content || ""} onChange={v => setCurrent(c => ({ ...c, mission: { ...c.mission, content: v } }))} placeholder="선교 소식, 단기선교" /></FormField></div></Card>

                <Card id="sec-general">
                  <div style={{ padding: "14px 18px", borderBottom: `1px solid ${C.borderLight}` }}><span style={{ fontWeight: 600, fontSize: 14, color: "#111827" }}>총무/행정</span></div>
                  <div style={{ padding: 18 }}>
                    <FormField label="교회 소식/일반 광고"><FTextarea value={db.current.general?.content || ""} onChange={v => setCurrent(c => ({ ...c, general: { ...c.general, content: v } }))} placeholder="교회 전체 소식" /></FormField>
                    <FormField label="이번 주 생일자"><FInput value={db.current.general?.birthday || ""} onChange={v => setCurrent(c => ({ ...c, general: { ...c.general, birthday: v } }))} placeholder="김OO 집사, 이OO 권사" /></FormField>
                    <FormField label="주간 봉사자"><FTextarea value={db.current.general?.servants || ""} onChange={v => setCurrent(c => ({ ...c, general: { ...c.general, servants: v } }))} placeholder="안내: OOO&#10;주차: OOO" /></FormField>
                    <FormField label="지난주 헌금"><FInput value={db.current.general?.offering || ""} onChange={v => setCurrent(c => ({ ...c, general: { ...c.general, offering: v } }))} placeholder="십일조 0,000,000원" /></FormField>
                    <FormField label="금주 교회 일정"><FTextarea value={db.current.general?.schedule || ""} onChange={v => setCurrent(c => ({ ...c, general: { ...c.general, schedule: v } }))} placeholder="월: 새벽기도 05:30" /></FormField>
                  </div>
                </Card>
              </div>

              <div className="flex-1 flex flex-col overflow-hidden min-w-0" style={{ marginTop: mob ? 20 : 0 }}>
                <div className="flex-shrink-0 bg-gray-50 border-b border-gray-200 px-3 py-2 space-y-2">
                  <div className="flex items-center justify-center gap-3 flex-wrap">
                    <div className="inline-flex items-center bg-white border border-gray-200 rounded-lg p-0.5 shadow-sm">
                      {(["6면", "4면", "온라인"] as BulletinFormat[]).map((format) => (
                        <button
                          key={format}
                          type="button"
                          onClick={() => setBulletinFormat(format)}
                          className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                            bulletinFormatDisplay === format
                              ? "bg-gray-900 text-white shadow-sm"
                              : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                          }`}
                        >
                          {format}
                        </button>
                      ))}
                    </div>
                    {outputMode === "print" && (
                      <div className="inline-flex items-center bg-white border border-gray-200 rounded-lg p-0.5 shadow-sm">
                        {(printFormat === "fold3" ? VIEW_FOLD3 : VIEW_FOLD2).map((v) => (
                          <button
                            key={v}
                            type="button"
                            onClick={() => setPreviewView(v)}
                            className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                              previewView === v
                                ? "bg-blue-600 text-white shadow-sm"
                                : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                            }`}
                          >
                            {VIEW_LABEL[v]}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <button type="button" onClick={handlePrint} className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 shadow-sm">
                        <Printer size={12} /> 인쇄
                      </button>
                      <button type="button" onClick={handlePDF} className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 shadow-sm">
                        <FileText size={12} /> PDF
                      </button>
                      <button type="button" onClick={handleDownloadCard} className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 shadow-sm">
                        카카오 이미지
                      </button>
                      <button type="button" onClick={handleKakaoShare} className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-white bg-yellow-400 border border-yellow-400 rounded-lg hover:bg-yellow-500 shadow-sm">
                        카카오 공유
                      </button>
                    </div>
                    <div className="inline-flex items-center bg-white border border-gray-200 rounded-lg shadow-sm">
                      <button type="button" onClick={zoomOut} className="w-6 h-6 flex items-center justify-center text-gray-500 hover:text-gray-700 rounded-l-lg text-xs">−</button>
                      <span className="w-9 text-center text-xs text-gray-600 font-medium border-x border-gray-200">{Math.round(previewScale * 100)}%</span>
                      <button type="button" onClick={zoomIn} className="w-6 h-6 flex items-center justify-center text-gray-500 hover:text-gray-700 rounded-r-lg text-xs">+</button>
                    </div>
                  </div>
                </div>

                <div className="flex-1 overflow-auto min-h-0">
                {outputMode === "kakao" ? (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, width: "100%" }}>
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
                      designTheme={db.current.template === "elegant-wine" ? "burgundy" : db.current.template === "nature-olive" ? "olive" : "navy"}
                    />
                    <p style={{ fontSize: 12, color: C.textFaint, textAlign: "center", margin: 0 }}>
                      이미지를 다운로드한 후 카카오톡 단체방에 공유하세요
                    </p>
                  </div>
                ) : (
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
                    <div className="bulletin-preview-scale flex-shrink-0" style={{ transform: `scale(${previewScale})`, transformOrigin: "top center", transition: "transform 0.15s ease" }}>
                      <div id="bulletin-print-area" ref={previewRef} data-bview={previewView} data-bulletin-preview className="bulletin bulletin-preview-inner bulletin-page-content" style={{ flexShrink: 0 }} />
                    </div>
                  </div>
                )}
                </div>
              </div>
            </div>
          )}

          {activeSub === "history" && (
            <div ref={listRefHistory}><Card>
              <div style={{ padding: "14px 18px", borderBottom: `1px solid ${C.borderLight}` }}><span style={{ fontWeight: 600, fontSize: 14, color: "#111827" }}>지난 주보 목록</span></div>
              <div style={{ padding: 18 }}>
                {db.history.length === 0 ? <div style={{ color: "#9ca3af", textAlign: "center", padding: 40, fontSize: 14 }}>저장된 주보가 없습니다. 편집에서 저장하면 여기에 표시됩니다.</div> : db.history.slice().reverse().slice((currentPageHistory - 1) * 10, currentPageHistory * 10).map(h => (
                  <div key={h.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, padding: "12px 0", borderBottom: `1px solid #f3f4f6` }}>
                    <div style={{ flex: 1 }}><div style={{ fontSize: 14, fontWeight: 600, color: "#374151" }}>{h.date || h.key}</div><div style={{ fontSize: 12, color: "#9ca3af" }}>{h.sermonTitle || "제목 없음"} · 저장: {h.savedAt || ""}</div></div>
                    <button type="button" onClick={() => loadHistory(h.key)} style={{ padding: "8px 16px", fontSize: 13, fontWeight: 500, backgroundColor: "#111827", border: "none", borderRadius: 8, color: "#ffffff", cursor: "pointer" }}>불러오기</button>
                  </div>
                ))}
              </div>
              <Pagination totalItems={db.history.length} itemsPerPage={10} currentPage={currentPageHistory} onPageChange={(p) => { setCurrentPageHistory(p); listRefHistory.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }} />
            </Card></div>
          )}

          {activeSub === "settings" && (
            <div style={{ maxWidth: 600 }}>
              <Card>
                <div style={{ padding: "14px 18px", borderBottom: `1px solid ${C.borderLight}` }}><span style={{ fontWeight: 600, fontSize: 14, color: "#111827" }}>교회 기본 정보</span></div>
                <div style={{ padding: 18 }}>
                  <FormField label="교회명"><FInput value={db.settings.church} onChange={v => setDb(prev => ({ ...prev, settings: { ...prev.settings, church: v } }))} /></FormField>
                  <FormField label="교회 영문명/부제"><FInput value={db.settings.churchSub} onChange={v => setDb(prev => ({ ...prev, settings: { ...prev.settings, churchSub: v } }))} /></FormField>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <FormField label="담임목사"><FInput value={db.settings.pastor} onChange={v => setDb(prev => ({ ...prev, settings: { ...prev.settings, pastor: v } }))} /></FormField>
                    <FormField label="주일예배 시간"><FInput value={db.settings.worshipTime} onChange={v => setDb(prev => ({ ...prev, settings: { ...prev.settings, worshipTime: v } }))} /></FormField>
                  </div>
                  <FormField label="교회 주소"><FInput value={db.settings.address} onChange={v => setDb(prev => ({ ...prev, settings: { ...prev.settings, address: v } }))} /></FormField>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <FormField label="전화번호"><FInput value={db.settings.phone} onChange={v => setDb(prev => ({ ...prev, settings: { ...prev.settings, phone: v } }))} /></FormField>
                    <FormField label="헌금 계좌"><FInput value={db.settings.account} onChange={v => setDb(prev => ({ ...prev, settings: { ...prev.settings, account: v } }))} /></FormField>
                  </div>
                  <FormField label="마감 요일"><FSelect value={db.settings.deadline} onChange={v => setDb(prev => ({ ...prev, settings: { ...prev.settings, deadline: v } }))}><option>수요일</option><option>목요일</option><option>금요일</option></FSelect></FormField>
                  <hr style={{ margin: "20px 0", border: "none", borderTop: `1px solid #f3f4f6` }} />
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button type="button" onClick={() => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(db, null, 2)], { type: "application/json" })); a.download = `주보시스템_백업_${fds(TODAY)}.json`; a.click(); showToast("백업 완료"); }} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px", backgroundColor: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 13, fontWeight: 500, color: "#374151", cursor: "pointer" }}>백업</button>
                    <button type="button" onClick={() => document.getElementById("bulletin-restore")?.click()} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px", backgroundColor: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 13, fontWeight: 500, color: "#374151", cursor: "pointer" }}>복원</button>
                    <input id="bulletin-restore" type="file" accept=".json" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (!f) return; const r = new FileReader(); r.onload = ev => { try { const d = JSON.parse(ev.target?.result as string); if (d.settings && d.current) { setDb(d); showToast("복원 완료"); } else showToast("올바른 파일이 아닙니다"); } catch { showToast("파일 오류"); } }; r.readAsText(f); e.target.value = ""; }} />
                    <button type="button" onClick={() => { if (!confirm("초기화하시겠습니까?")) return; localStorage.removeItem(BULLETIN_STORAGE_KEY); setDb(loadBulletin()); setActiveSub("dash"); showToast("초기화 완료"); }} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px", backgroundColor: "#ffffff", border: "1px solid #ef4444", borderRadius: 8, fontSize: 13, fontWeight: 500, color: "#ef4444", cursor: "pointer" }}>초기화</button>
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
                onClick={() => { setShowFullPreview(false); setTimeout(() => handlePDF(), 100); }}
              >
                PDF 저장
              </button>
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
        .bulletin-page-content .bp-tri .bp-spread { box-shadow:0 3px 20px rgba(0,0,0,.1); border-radius:2px; overflow:hidden; }
        .bulletin-page-content .tp { width:240px; min-height:530px; background:#fff; border-right:1px dashed #d0d0d0; box-sizing:border-box; position:relative; overflow:hidden; }
        .bulletin-page-content .tp:last-child { border-right:none; }
        .bulletin-page-content .tp-cover { display:flex; align-items:center; justify-content:center; }
        .bulletin-page-content .tp-bg { position:absolute; inset:0; }
        .bulletin-page-content .tp-cover-inner { position:relative; z-index:1; text-align:center; color:#fff; padding:32px 18px; width:100%; }
        .bulletin-page-content .tp-cross { font-size:28px; opacity:.4; margin-bottom:14px; }
        .bulletin-page-content .tp-cname { font-size:22px; font-weight:800; letter-spacing:5px; margin-bottom:2px; }
        .bulletin-page-content .tp-csub { font-size:9px; opacity:.5; letter-spacing:3px; text-transform:uppercase; }
        .bulletin-page-content .tp-cdiv { width:36px; height:1.5px; margin:16px auto; opacity:.6; }
        .bulletin-page-content .tp-stitle { font-size:16px; font-weight:700; letter-spacing:1px; line-height:1.5; }
        .bulletin-page-content .tp-spass { font-size:10px; opacity:.65; margin-top:4px; }
        .bulletin-page-content .tp-date { font-size:10px; opacity:.75; letter-spacing:1px; }
        .bulletin-page-content .tp-time { font-size:9px; opacity:.5; margin-top:2px; }
        .bulletin-page-content .tp-pastor { font-size:10px; opacity:.6; margin-top:18px; letter-spacing:2px; }
        .bulletin-page-content .tp-hd { font-size:11.5px; font-weight:800; padding:9px 14px; border-bottom:2px solid; letter-spacing:.8px; background:#fafbfc; font-family:'Inter','Noto Sans KR',sans-serif; }
        .bulletin-page-content .tp-bd { padding:10px 14px 14px; font-size:9.5px; line-height:1.6; color:#333; }
        .bulletin-page-content .tp-label { font-size:9px; font-weight:700; letter-spacing:.4px; margin-top:10px; margin-bottom:3px; font-family:'Inter','Noto Sans KR',sans-serif; }
        .bulletin-page-content .tp-label:first-child { margin-top:0; }
        .bulletin-page-content .tp-val { font-size:9px; line-height:1.6; color:#555; }
        .bulletin-page-content .tp-church-badge { margin-top:auto; padding:10px; border-radius:4px; color:#fff; text-align:center; font-size:11px; font-weight:700; letter-spacing:2px; position:absolute; bottom:14px; left:14px; right:14px; }
        .bulletin-page-content .tp-note { font-size:9px; color:#666; margin-top:6px; }
        .bulletin-page-content .tp-sermon-box { background:#f5f7fa; border-radius:5px; padding:10px; margin-bottom:10px; border-left:3px solid; }
        .bulletin-page-content .tp-sermon-t { font-size:13px; font-weight:800; margin-bottom:3px; }
        .bulletin-page-content .tp-sermon-p { font-size:9.5px; color:#4a6fa5; }
        .bulletin-page-content .tp-sermon-th { font-size:8.5px; color:#888; margin-top:2px; font-style:italic; }
        .bulletin-page-content .tp-column { border-left:3px solid; padding:10px; margin-top:8px; background:linear-gradient(135deg,#faf5ef,#f3ebe0); border-radius:4px; }
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
        .bulletin-page-content .bp-four-face .bp-spread { display:grid; grid-template-columns:1fr 1fr; width:100%; height:50%; min-height:600px; box-shadow:0 1px 3px rgba(0,0,0,0.1); border-radius:4px; overflow:hidden; box-sizing:border-box; }
        .bulletin-page-content .bp-four-face .bp-cell .bp { box-shadow:none; border:none; }
        .bulletin-page-content .bp-four-face .bp-cell .bp-2 { border-right:none; }
        .bulletin-page-content .bp-1 { display:flex; align-items:center; justify-content:center; }
        .bulletin-page-content .bp-cover-bg { position:absolute; inset:0; opacity:.96; }
        .bulletin-page-content .bp-cover-content { position:relative; z-index:1; text-align:center; color:#fff; padding:36px 24px; width:100%; }
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
        .bulletin-page-content .bp-cfooter { border-radius:5px; padding:11px; color:#fff; text-align:center; }
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
        .bulletin-page-content .ol-header { padding:28px 24px; color:#fff; text-align:center; position:relative; }
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
        .bulletin-page-content .ol-footer { padding:16px 20px; color:#fff; font-size:10px; text-align:center; line-height:1.8; opacity:.9; }

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
