"use client";

import { useState, useMemo, useEffect, useCallback, useRef, type CSSProperties, type ReactNode } from "react";
import type { DB } from "@/types/db";
import { supabase } from "@/lib/supabase";
import { LayoutDashboard, Home, MessageCircle, Bell, Heart, User, ScrollText, TrendingUp, ClipboardList, Settings } from "lucide-react";

const iconStyle = { strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
const Icons = {
  Visit: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" {...iconStyle}><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  Counsel: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" {...iconStyle}><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>,
  Check: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" {...iconStyle}><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>,
  Bell: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" {...iconStyle}><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>,
  Prayer: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" {...iconStyle}><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>,
  Chart: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" {...iconStyle}><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
  Printer: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" {...iconStyle}><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/></svg>,
  Export: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" {...iconStyle}><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>,
  Memo: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" {...iconStyle}><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
  Lock: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" {...iconStyle}><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>,
  Hospital: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" {...iconStyle}><path d="M3 21h18M5 21V7l7-4 7 4v14"/><path d="M12 7v6M9 10h6"/></svg>,
  Sprout: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" {...iconStyle}><path d="M7 20h10M10 20c5.5-2.5 8-7 8-12a4 4 0 00-8 0c0 5 2.5 9.5 8 12"/><path d="M12 20c-3-2-5-5-5-8a3 3 0 016 0c0 3-2 6-5 8"/></svg>,
  Clipboard: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" {...iconStyle}><path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/><path d="M8 12h8M8 16h8"/></svg>,
  Alert: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" {...iconStyle}><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>,
  Party: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" {...iconStyle}><path d="M5 14l2 2 4-4"/><path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z"/></svg>,
  Home: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" {...iconStyle}><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  Users: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" {...iconStyle}><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>,
  Cross: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" {...iconStyle}><path d="M12 2v20M2 12h20"/></svg>,
  Target: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" {...iconStyle}><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>,
  Heart: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" {...iconStyle}><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>,
  Dollar: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" {...iconStyle}><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>,
  FileText: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" {...iconStyle}><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
  Search: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" {...iconStyle}><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>,
  Scroll: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" {...iconStyle}><path d="M8 3h8l4 4v12H4V7l4-4z"/><path d="M8 3v4h8V3"/></svg>,
  Phone: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" {...iconStyle}><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z"/></svg>,
  Package: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" {...iconStyle}><path d="M16.5 9.4l-9-5.19M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>,
  Folder: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" {...iconStyle}><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/></svg>,
  Save: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" {...iconStyle}><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>,
  Trash: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" {...iconStyle}><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>,
};
import { Pagination } from "@/components/common/Pagination";
import { CalendarDropdown } from "@/components/CalendarDropdown";

/* ---------- useIsMobile ---------- */
function useIsMobile(bp = 768) {
  const [m, setM] = useState(false);
  useEffect(() => { const c = () => setM(window.innerWidth <= bp); c(); window.addEventListener("resize", c); return () => window.removeEventListener("resize", c); }, [bp]);
  return m;
}

/* ============================================================
   심방/상담 기록 관리
   ============================================================ */

/* ---------- Colors ---------- */
const C = {
  navy: "#1a1f36", navyLight: "#252b48", navyHover: "#2d3460",
  bg: "#f9fafb", card: "#fff",
  border: "#e5e7eb", borderLight: "#f3f4f6",
  text: "#1f2937", textMuted: "#6b7280", textFaint: "#9ca3af",
  blue: "#3b82f6", blueBg: "#dbeafe", blueDark: "#1d4ed8",
  accent: "#3b82f6", accentLight: "#dbeafe", accentBg: "#dbeafe",
  purple: "#8b5cf6", purpleBg: "#ede9fe",
  green: "#10b981", greenBg: "#d1fae5",
  yellow: "#f59e0b", yellowBg: "#fef3c7",
  red: "#ef4444", redBg: "#fee2e2",
  orange: "#f97316", orangeBg: "#ffedd5",
  pink: "#ec4899", pinkBg: "#fce7f3",
  teal: "#14b8a6", tealBg: "#ccfbf1",
  indigo: "#6366f1", indigoBg: "#e0e7ff",
};

/* ---------- Helpers ---------- */
const todayStr = () => new Date().toISOString().slice(0, 10);
const uid = () => Math.random().toString(36).slice(2, 9);
const DAYS = ["일", "월", "화", "수", "목", "금", "토"];

function fmtDate(s: string) {
  if (!s) return "";
  const d = new Date(s);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}
function fmtDateFull(s: string) {
  if (!s) return "";
  const d = new Date(s);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (${DAYS[d.getDay()]})`;
}
function fmtShort(s: string) {
  if (!s) return "";
  const d = new Date(s);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}
function daysFromNow(s: string) {
  if (!s) return 999;
  const today = new Date(todayStr());
  const target = new Date(s);
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}
function relDate(s: string) {
  if (!s) return "";
  const diff = daysFromNow(s);
  if (diff === 0) return "오늘";
  if (diff === 1) return "내일";
  if (diff === -1) return "어제";
  if (diff < 0) return `${-diff}일 전`;
  return `${diff}일 후`;
}
function thisMonth(s: string) {
  const d = new Date(s), n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth();
}
function prevMonth(s: string) {
  const d = new Date(s), n = new Date();
  n.setMonth(n.getMonth() - 1);
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth();
}
function dateOffset(days: number) {
  const d = new Date(); d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

/* ---------- Types ---------- */
type VisitType = "sick" | "new_family" | "regular" | "crisis" | "celebration" | "routine";
type CounselType = "family" | "faith" | "career" | "health" | "finance" | "other";
type VisitStatus = "scheduled" | "completed" | "pending" | "cancelled";

interface VCMember {
  id: string; name: string; group: string; role: string; phone: string; note: string;
}
interface Visit {
  id: string; memberId: string; type: VisitType; date: string; time: string; location: string;
  summary: string; prayerNote: string; status: VisitStatus;
  followUpDate: string; followUpNote: string; followUpDone: boolean;
}
interface Counsel {
  id: string; memberId: string; type: CounselType; date: string;
  summary: string; confidential: boolean;
  followUpDate: string; followUpNote: string; followUpDone: boolean;
}
interface VCSettings { name: string; role: string; church: string; }

type PrayerCategory = "health" | "family" | "career" | "faith" | "settlement" | "mission" | "other";
type PrayerStatus = "active" | "answered";
interface Prayer {
  id: string; memberId: string; text: string; date: string; category: PrayerCategory; status: PrayerStatus;
}

type MemoCategory = "admin" | "assignment" | "connection" | "notable" | "other";
interface Memo {
  id: string; memberId: string; text: string; date: string; category: MemoCategory;
}

interface VCDB {
  settings: VCSettings; members: VCMember[]; visits: Visit[]; counsels: Counsel[];
  prayers?: Prayer[]; memos?: Memo[];
}

type IconComp = () => JSX.Element;
const VISIT_TYPES: Record<VisitType, { label: string; Icon: IconComp; color: string; bg: string }> = {
  sick: { label: "병문안", Icon: Icons.Hospital, color: C.red, bg: C.redBg },
  new_family: { label: "새가족", Icon: Icons.Sprout, color: C.green, bg: C.greenBg },
  regular: { label: "정기심방", Icon: Icons.Clipboard, color: C.accent, bg: C.accentLight },
  crisis: { label: "위기심방", Icon: Icons.Alert, color: C.orange, bg: C.orangeBg },
  celebration: { label: "경조사", Icon: Icons.Party, color: C.purple, bg: C.purpleBg },
  routine: { label: "일반방문", Icon: Icons.Home, color: C.textMuted, bg: C.borderLight },
};

const COUNSEL_TYPES: Record<CounselType, { label: string; Icon: IconComp; color: string; bg: string }> = {
  family: { label: "가정", Icon: Icons.Users, color: C.pink, bg: C.pinkBg },
  faith: { label: "신앙", Icon: Icons.Cross, color: C.indigo, bg: C.indigoBg },
  career: { label: "진로", Icon: Icons.Target, color: C.teal, bg: C.tealBg },
  health: { label: "건강", Icon: Icons.Heart, color: C.red, bg: C.redBg },
  finance: { label: "재정", Icon: Icons.Dollar, color: C.yellow, bg: C.yellowBg },
  other: { label: "기타", Icon: Icons.FileText, color: C.textMuted, bg: C.borderLight },
};

const STATUS_LABELS: Record<VisitStatus, string> = {
  scheduled: "예정", completed: "완료", pending: "보류", cancelled: "취소",
};
const STATUS_COLORS: Record<VisitStatus, { color: string; bg: string }> = {
  scheduled: { color: C.accent, bg: C.accentLight },
  completed: { color: C.green, bg: C.greenBg },
  pending: { color: C.yellow, bg: C.yellowBg },
  cancelled: { color: C.textMuted, bg: C.borderLight },
};

const PRAYER_CATEGORIES: Record<PrayerCategory, string> = {
  health: "건강", family: "가정", career: "진로", faith: "신앙", settlement: "정착", mission: "선교", other: "기타",
};
const PRAYER_STATUS_LABELS: Record<PrayerStatus, string> = { active: "기도 중", answered: "응답됨" };
const MEMO_CATEGORIES: Record<MemoCategory, string> = {
  admin: "행정", assignment: "배정", connection: "연결", notable: "특이사항", other: "기타",
};

/** 초기화 후 또는 저장 없을 때 — 심방/상담/기도/메모 비움 */
function buildEmpty(): VCDB {
  return {
    settings: { name: "", role: "", church: "" },
    members: [],
    visits: [],
    counsels: [],
    prayers: [],
    memos: [],
  };
}

/** Supabase visits 행 → Visit (camelCase) */
function mapVisitRow(row: Record<string, unknown>): Visit {
  return {
    id: String(row.id ?? ""),
    memberId: String(row.member_id ?? row.memberId ?? ""),
    type: (row.type as VisitType) ?? "routine",
    date: String(row.date ?? ""),
    time: String(row.time ?? ""),
    location: String(row.location ?? ""),
    summary: String(row.summary ?? ""),
    prayerNote: String(row.prayer_note ?? row.prayerNote ?? ""),
    status: (row.status as VisitStatus) ?? "scheduled",
    followUpDate: String(row.follow_up_date ?? row.followUpDate ?? ""),
    followUpNote: String(row.follow_up_note ?? row.followUpNote ?? ""),
    followUpDone: Boolean(row.follow_up_done ?? row.followUpDone),
  };
}

/** Visit → Supabase payload (snake_case) */
function visitToPayload(v: Visit): Record<string, unknown> {
  return {
    id: v.id,
    member_id: v.memberId,
    type: v.type,
    date: v.date,
    time: v.time,
    location: v.location,
    summary: v.summary,
    prayer_note: v.prayerNote,
    status: v.status,
    follow_up_date: v.followUpDate || null,
    follow_up_note: v.followUpNote || null,
    follow_up_done: v.followUpDone,
  };
}

/* ---------- DB Load / Save ---------- */
const VC_KEY = "visit_counsel_db";
function loadVC(): VCDB {
  if (typeof window === "undefined") return buildEmpty();
  const s = localStorage.getItem(VC_KEY);
  const db = s ? JSON.parse(s) : buildEmpty();
  if (!Array.isArray(db.prayers)) db.prayers = [];
  if (!Array.isArray(db.memos)) db.memos = [];
  return db;
}
function saveVC(db: VCDB) {
  if (typeof window !== "undefined") localStorage.setItem(VC_KEY, JSON.stringify(db));
}

/* ---------- UI Primitives ---------- */
function Card({ children, style, onClick }: { children: ReactNode; style?: CSSProperties; onClick?: () => void }) {
  return <div onClick={onClick} style={{ background: C.card, borderRadius: 16, border: `1px solid ${C.border}`, overflow: "hidden", transition: "all 0.2s", ...style }}>{children}</div>;
}

function Btn({ children, variant = "primary", size = "md", onClick, style, icon, disabled }: {
  children?: ReactNode; variant?: "primary" | "secondary" | "ghost" | "danger" | "accent"; size?: "sm" | "md";
  onClick?: (e?: React.MouseEvent) => void; style?: CSSProperties; icon?: ReactNode; disabled?: boolean;
}) {
  const base: CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, border: "none", borderRadius: 8, fontWeight: 600, cursor: disabled ? "not-allowed" : "pointer", fontFamily: "inherit", transition: "all 0.2s", whiteSpace: "nowrap", opacity: disabled ? 0.6 : 1 };
  const sizes: Record<string, CSSProperties> = { sm: { padding: "6px 12px", fontSize: 12 }, md: { padding: "8px 16px", fontSize: 13 } };
  const variants: Record<string, CSSProperties> = {
    primary: { background: C.accent, color: "#fff" },
    secondary: { background: C.borderLight, color: C.text, border: `1px solid ${C.border}` },
    ghost: { background: "transparent", color: C.textMuted },
    danger: { background: C.red, color: "#fff" },
    accent: { background: C.teal, color: "#fff" },
  };
  return <button type="button" disabled={disabled} onClick={disabled ? undefined : onClick} style={{ ...base, ...sizes[size], ...variants[variant], ...style }}>{icon}{children}</button>;
}

function Modal({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode }) {
  const mob = useIsMobile();
  const modalHeight = mob ? "92vh" : "85vh";
  if (!open) return null;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: mob ? "flex-end" : "center", justifyContent: "center", background: "rgba(0,0,0,0.4)", backdropFilter: "blur(8px)", padding: mob ? 0 : 20 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: mob ? "20px 20px 0 0" : 20, width: "100%", maxWidth: mob ? "100%" : 600, height: modalHeight, maxHeight: modalHeight, display: "flex", flexDirection: "column", overflow: "hidden", animation: "slideUp 0.3s ease" }}>
        {mob && <div style={{ width: 36, height: 4, background: C.border, borderRadius: 4, margin: "10px auto", flexShrink: 0 }} />}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: mob ? "12px 16px" : "16px 24px", borderBottom: `1px solid ${C.borderLight}`, flexShrink: 0 }}>
          <span style={{ fontSize: mob ? 15 : 17, fontWeight: 700 }}>{title}</span>
          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: "50%", background: C.borderLight, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, color: C.textMuted }}>✕</button>
        </div>
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: mob ? 16 : 24 }}>{children}</div>
        {footer && <div style={{ padding: mob ? "12px 16px" : "16px 24px", borderTop: `1px solid ${C.borderLight}`, display: "flex", gap: 10, justifyContent: "flex-end", flexShrink: 0 }}>{footer}</div>}
      </div>
    </div>
  );
}

function FormField({ label, children }: { label: React.ReactNode; children: ReactNode }) {
  return <div style={{ marginBottom: 16 }}><label style={{ display: "block", fontSize: 13, fontWeight: 600, color: C.navy, marginBottom: 6 }}>{label}</label>{children}</div>;
}

function FInput({ value, onChange, placeholder, type = "text", style }: { value: string; onChange: (v: string) => void; placeholder?: string; type?: string; style?: CSSProperties }) {
  return <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} type={type} style={{ width: "100%", padding: "10px 14px", border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 14, fontFamily: "inherit", background: C.bg, outline: "none", ...style }} />;
}

function FSelect({ value, onChange, children, style }: { value: string; onChange: (v: string) => void; children: ReactNode; style?: CSSProperties }) {
  return <select value={value} onChange={e => onChange(e.target.value)} style={{ width: "100%", padding: "10px 14px", border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 14, fontFamily: "inherit", background: C.bg, outline: "none", cursor: "pointer", ...style }}>{children}</select>;
}

function FTextarea({ value, onChange, placeholder, style }: { value: string; onChange: (v: string) => void; placeholder?: string; style?: CSSProperties }) {
  return <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={{ width: "100%", padding: "10px 14px", border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 14, fontFamily: "inherit", background: C.bg, outline: "none", resize: "vertical", minHeight: 80, ...style }} />;
}

function StatCard({ label, value, sub, icon, color, bg }: { label: string; value: string; sub?: string; icon: ReactNode; color: string; bg: string }) {
  const mob = useIsMobile();
  return (
    <div style={{ background: C.card, borderRadius: 16, border: `1px solid ${C.border}`, padding: mob ? 14 : 20, transition: "all 0.2s" }}>
      <div style={{ width: mob ? 34 : 42, height: mob ? 34 : 42, borderRadius: 12, background: bg, color, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: mob ? 10 : 14 }}>{icon}</div>
      <div style={{ fontSize: mob ? 22 : 28, fontWeight: 800, letterSpacing: -1 }}>{value}</div>
      <div style={{ fontSize: mob ? 12 : 13, color: C.textMuted, marginTop: 2 }}>{label}</div>
      {sub && <div style={{ fontSize: 12, fontWeight: 600, marginTop: 6, display: "inline-flex", alignItems: "center", gap: 3, padding: "2px 8px", borderRadius: 20, background: bg, color }}>{sub}</div>}
    </div>
  );
}

function Chip({ label, active, onClick, icon }: { label: string; active: boolean; onClick: () => void; icon?: ReactNode }) {
  return (
    <span onClick={onClick} style={{ padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer", border: `1px solid ${active ? C.accent : C.border}`, background: active ? C.accent : C.bg, color: active ? "#fff" : C.text, transition: "all 0.2s", display: "inline-flex", alignItems: "center", gap: 6 }}>
      {icon}
      {label}
    </span>
  );
}

/* ---------- Follow-up Helpers ---------- */
interface FollowUp {
  kind: "visit" | "counsel"; refId: string; memberId: string;
  date: string; note: string; done: boolean; originDate: string; originType: string;
}

function getAllFollowups(db: VCDB): FollowUp[] {
  const fus: FollowUp[] = [];
  (db.visits ?? []).forEach(v => { if (v.followUpDate) fus.push({ kind: "visit", refId: v.id, memberId: v.memberId, date: v.followUpDate, note: v.followUpNote, done: v.followUpDone, originDate: v.date, originType: VISIT_TYPES[v.type]?.label || v.type }); });
  (db.counsels ?? []).forEach(c => { if (c.followUpDate) fus.push({ kind: "counsel", refId: c.id, memberId: c.memberId, date: c.followUpDate, note: c.followUpNote, done: c.followUpDone, originDate: c.date, originType: COUNSEL_TYPES[c.type]?.label || c.type }); });
  return fus.sort((a, b) => a.date.localeCompare(b.date));
}

/* ============================================================
   SUB-COMPONENTS
   ============================================================ */

/* ----- Dashboard ----- */
function DashSub({ db, goPage, openVisitModal, openCounselModal, loading }: { db: VCDB; goPage: (p: SubPage) => void; openVisitModal: (id?: string) => void; openCounselModal: (id?: string) => void; loading?: boolean }) {
  const mob = useIsMobile();
  const getMember = (id: string) => (db.members ?? []).find(m => m.id === id) || { name: "(삭제됨)", group: "", role: "", id: "", phone: "", note: "" };

  const mv = (db.visits ?? []).filter(v => thisMonth(v.date));
  const mc = (db.counsels ?? []).filter(c => thisMonth(c.date));
  const pv = (db.visits ?? []).filter(v => prevMonth(v.date));
  const pc = (db.counsels ?? []).filter(c => prevMonth(c.date));
  const completed = mv.filter(v => v.status === "completed").length;
  const scheduled = mv.filter(v => v.status === "scheduled").length;
  const allFU = getAllFollowups(db).filter(f => !f.done);
  const overdueFU = allFU.filter(f => daysFromNow(f.date) < 0);
  const vDiff = mv.length - pv.length;
  const cDiff = mc.length - pc.length;

  // Chart data
  const typeCounts: Record<string, { count: number; isVisit: boolean }> = {};
  mv.forEach(v => { const l = VISIT_TYPES[v.type]?.label || v.type; typeCounts[l] = { count: (typeCounts[l]?.count || 0) + 1, isVisit: true }; });
  mc.forEach(c => { const l = "상담:" + (COUNSEL_TYPES[c.type]?.label || c.type); typeCounts[l] = { count: (typeCounts[l]?.count || 0) + 1, isVisit: false }; });
  const maxCnt = Math.max(...Object.values(typeCounts).map(v => v.count), 1);

  const urgentFU = allFU.filter(f => daysFromNow(f.date) <= 3).slice(0, 5);
  const recentV = [...(db.visits ?? [])].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3);
  const recentC = [...(db.counsels ?? [])].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3);
  const activePrayers = (db.prayers || []).filter(p => p.status === "active");

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 48 }}>
        <span style={{ display: "inline-block", width: 28, height: 28, borderRadius: "50%", border: "2px solid #1a1f36", borderTopColor: "transparent", animation: "spin 0.8s linear infinite" }} />
        <span style={{ marginLeft: 12, fontSize: 14, color: C.textMuted }}>대시보드 로딩 중…</span>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "grid", gridTemplateColumns: mob ? "1fr 1fr" : "repeat(5, 1fr)", gap: mob ? 10 : 16 }}>
        <StatCard icon={<Icons.Visit />} label="이번 달 심방" value={String(mv.length)} sub={`${vDiff >= 0 ? "▲" : "▼"} 전월 대비 ${Math.abs(vDiff)}건`} color={C.teal} bg={C.tealBg} />
        <StatCard icon={<Icons.Counsel />} label="이번 달 상담" value={String(mc.length)} sub={`${cDiff >= 0 ? "▲" : "▼"} 전월 대비 ${Math.abs(cDiff)}건`} color={C.pink} bg={C.pinkBg} />
        <StatCard icon={<Icons.Check />} label="완료 심방" value={String(completed)} sub={`예정 ${scheduled}건`} color={C.green} bg={C.greenBg} />
        <StatCard icon={<Icons.Bell />} label="기한 초과 조치" value={String(overdueFU.length)} sub={`${allFU.length}건 대기`} color={C.red} bg={C.redBg} />
        <div onClick={() => goPage("prayers")} style={{ cursor: "pointer" }}><StatCard icon={<Icons.Prayer />} label="활성 기도제목" value={String(activePrayers.length)} sub="건" color={C.purple} bg={C.purpleBg} /></div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: mob ? "1fr" : "2fr 1fr", gap: 20 }}>
        {/* Follow-up needed */}
        <Card>
          <div style={{ padding: mob ? "14px 16px" : "18px 22px", borderBottom: `1px solid ${C.borderLight}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: mob ? 14 : 16, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 6 }}><Icons.Bell /> 후속 조치 필요</span>
            <Btn variant="ghost" size="sm" onClick={() => goPage("followup")}>전체 보기 →</Btn>
          </div>
          <div style={{ padding: mob ? 14 : 22 }}>
            {urgentFU.length === 0 ? (
              <div style={{ textAlign: "center", padding: 20, color: C.textMuted, fontSize: 14, display: "inline-flex", alignItems: "center", gap: 6 }}>긴급한 후속 조치가 없습니다 <Icons.Check /></div>
            ) : urgentFU.map(f => {
              const m = getMember(f.memberId);
              const diff = daysFromNow(f.date);
              const cls = diff < 0 ? C.red : diff === 0 ? C.yellow : C.accent;
              const clsBg = diff < 0 ? C.redBg : diff === 0 ? C.yellowBg : C.accentLight;
              return (
                <div key={f.refId + f.kind} style={{ display: "flex", alignItems: "center", gap: 12, padding: 12, borderRadius: 8, marginBottom: 8, border: `1px solid ${C.borderLight}`, borderLeft: `3px solid ${cls}`, background: clsBg }}>
                  <span style={{ display: "flex", color: f.kind === "visit" ? C.teal : C.pink }}>{f.kind === "visit" ? <Icons.Visit /> : <Icons.Counsel />}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.name}</div>
                    <div style={{ fontSize: 12, color: C.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.note || f.originType}</div>
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: cls, flexShrink: 0 }}>{relDate(f.date)}</div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Chart */}
        <Card>
          <div style={{ padding: mob ? "14px 16px" : "18px 22px", borderBottom: `1px solid ${C.borderLight}` }}>
            <span style={{ fontSize: mob ? 14 : 16, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 6 }}><Icons.Chart /> 이번 달 유형별</span>
          </div>
          <div style={{ padding: mob ? 14 : 22 }}>
            {Object.keys(typeCounts).length === 0 ? (
              <div style={{ textAlign: "center", padding: 20, color: C.textMuted, fontSize: 14 }}>이번 달 기록이 없습니다</div>
            ) : Object.entries(typeCounts).map(([k, v]) => (
              <div key={k} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 600, width: 80, textAlign: "right", flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{k}</span>
                <div style={{ flex: 1, height: 28, background: C.borderLight, borderRadius: 14, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${(v.count / maxCnt) * 100}%`, background: v.isVisit ? C.teal : C.pink, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 10, minWidth: 32 }}>
                    <span style={{ fontSize: 11, color: "#fff", fontWeight: 700 }}>{v.count}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: mob ? "1fr" : "1fr 1fr", gap: 20 }}>
        {/* Recent visits */}
        <Card>
          <div style={{ padding: mob ? "14px 16px" : "18px 22px", borderBottom: `1px solid ${C.borderLight}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: mob ? 14 : 16, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 6 }}><Icons.Visit /> 최근 심방</span>
            <Btn variant="ghost" size="sm" onClick={() => goPage("visits")}>전체 →</Btn>
          </div>
          <div style={{ padding: mob ? 14 : 22 }}>
            {recentV.length === 0 ? (
              <div style={{ textAlign: "center", padding: 20, color: C.textMuted }}>심방 기록이 없습니다</div>
            ) : recentV.map(v => {
              const m = getMember(v.memberId);
              const vt = VISIT_TYPES[v.type] || VISIT_TYPES.routine;
              const st = STATUS_COLORS[v.status] || STATUS_COLORS.scheduled;
              return (
                <div key={v.id} onClick={() => openVisitModal(v.id)} style={{ display: "flex", alignItems: "flex-start", gap: mob ? 10 : 16, padding: "14px 0", borderBottom: `1px solid ${C.borderLight}`, cursor: "pointer" }}>
                  <div style={{ width: mob ? 40 : 48, height: mob ? 40 : 48, borderRadius: "50%", background: st.bg, color: st.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: mob ? 14 : 18, fontWeight: 700, flexShrink: 0 }}>{m.name[0]}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2, minWidth: 0 }}>
                      <span style={{ fontSize: mob ? 14 : 15, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.name}</span>
                      <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 12, background: vt.bg, color: vt.color, flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 4 }}><vt.Icon /> {vt.label}</span>
                    </div>
                    <div style={{ fontSize: 12, color: C.textMuted }}>{fmtDate(v.date)} {v.time || ""} · {v.location || ""}</div>
                    {v.summary && <div style={{ fontSize: 13, color: C.textMuted, marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v.summary}</div>}
                  </div>
                  <div style={{ flexShrink: 0, textAlign: "right" }}>
                    <div style={{ fontSize: 12, color: C.textMuted, fontWeight: 600 }}>{relDate(v.date)}</div>
                    <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 20, background: st.bg, color: st.color }}>{STATUS_LABELS[v.status]}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Recent counsels */}
        <Card>
          <div style={{ padding: mob ? "14px 16px" : "18px 22px", borderBottom: `1px solid ${C.borderLight}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: mob ? 14 : 16, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 6 }}><Icons.Counsel /> 최근 상담</span>
            <Btn variant="ghost" size="sm" onClick={() => goPage("counsels")}>전체 →</Btn>
          </div>
          <div style={{ padding: mob ? 14 : 22 }}>
            {recentC.length === 0 ? (
              <div style={{ textAlign: "center", padding: 20, color: C.textMuted }}>상담 기록이 없습니다</div>
            ) : recentC.map(c => {
              const m = getMember(c.memberId);
              const ct = COUNSEL_TYPES[c.type] || COUNSEL_TYPES.other;
              return (
                <div key={c.id} onClick={() => openCounselModal(c.id)} style={{ display: "flex", alignItems: "flex-start", gap: mob ? 10 : 16, padding: "14px 0", borderBottom: `1px solid ${C.borderLight}`, cursor: "pointer" }}>
                  <div style={{ width: mob ? 40 : 48, height: mob ? 40 : 48, borderRadius: "50%", background: ct.bg, color: ct.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: mob ? 14 : 18, fontWeight: 700, flexShrink: 0 }}>{m.name[0]}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2, minWidth: 0, flexWrap: "wrap" }}>
                      <span style={{ fontSize: mob ? 14 : 15, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.name}</span>
                      <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 12, background: ct.bg, color: ct.color, flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 4 }}><ct.Icon /> {ct.label}</span>
                      {c.confidential && <span style={{ fontSize: 11, color: C.red, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4 }}><Icons.Lock /> 비공개</span>}
                    </div>
                    <div style={{ fontSize: 12, color: C.textMuted }}>{fmtDate(c.date)}</div>
                    {c.summary && <div style={{ fontSize: 13, color: C.textMuted, marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.summary}</div>}
                  </div>
                  <div style={{ flexShrink: 0 }}><div style={{ fontSize: 12, color: C.textMuted, fontWeight: 600 }}>{relDate(c.date)}</div></div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ----- Visit List ----- */
function VisitListSub({ db, openVisitModal, loading }: { db: VCDB; openVisitModal: (id?: string) => void; loading?: boolean }) {
  const mob = useIsMobile();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<string>("all");
  const getMember = (id: string) => (db.members ?? []).find(m => m.id === id) || { name: "(삭제됨)", group: "", role: "", id: "", phone: "", note: "" };

  const list = useMemo(() => {
    let r = [...(db.visits ?? [])];
    if (filter !== "all") r = r.filter(v => v.type === filter);
    if (search) { const q = search.toLowerCase(); r = r.filter(v => { const m = getMember(v.memberId); return m.name.toLowerCase().includes(q) || (v.summary || "").toLowerCase().includes(q) || (v.location || "").toLowerCase().includes(q); }); }
    return r.sort((a, b) => b.date.localeCompare(a.date));
  }, [db.visits, search, filter]);

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 48 }}>
        <span style={{ display: "inline-block", width: 28, height: 28, borderRadius: "50%", border: "2px solid #1a1f36", borderTopColor: "transparent", animation: "spin 0.8s linear infinite" }} />
        <span style={{ marginLeft: 12, fontSize: 14, color: C.textMuted }}>심방 목록 로딩 중…</span>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", gap: mob ? 8 : 12, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: 1, minWidth: mob ? 0 : 200 }}>
          <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: C.textFaint, display: "flex" }}><Icons.Search /></span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="이름, 사유, 내용 검색..." style={{ width: "100%", height: mob ? 36 : 40, padding: "0 14px 0 38px", fontFamily: "inherit", fontSize: mob ? 13 : 14, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, outline: "none", color: C.text }} />
        </div>
        <Btn variant="primary" size="sm" onClick={() => openVisitModal()}>＋ 심방 등록</Btn>
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <Chip label="전체" active={filter === "all"} onClick={() => setFilter("all")} />
        {Object.entries(VISIT_TYPES).map(([k, v]) => <Chip key={k} icon={<v.Icon />} label={v.label} active={filter === k} onClick={() => setFilter(k)} />)}
      </div>
      <Card>
        <div style={{ padding: mob ? 14 : 22 }}>
          {list.length === 0 ? (
            <div style={{ textAlign: "center", padding: 48, color: C.textFaint }}><div style={{ opacity: 0.3, marginBottom: 12, display: "flex", justifyContent: "center" }}><Icons.Visit /></div><div style={{ fontSize: 14 }}>심방 기록이 없습니다</div></div>
          ) : list.map(v => {
            const m = getMember(v.memberId);
            const vt = VISIT_TYPES[v.type] || VISIT_TYPES.routine;
            const st = STATUS_COLORS[v.status] || STATUS_COLORS.scheduled;
            return (
              <div key={v.id} onClick={() => openVisitModal(v.id)} style={{ display: "flex", alignItems: "flex-start", gap: mob ? 10 : 16, padding: "14px 0", borderBottom: `1px solid ${C.borderLight}`, cursor: "pointer" }}>
                <div style={{ width: mob ? 40 : 48, height: mob ? 40 : 48, borderRadius: "50%", background: st.bg, color: st.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: mob ? 14 : 18, fontWeight: 700, flexShrink: 0 }}>{m.name[0]}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2, minWidth: 0 }}>
                    <span style={{ fontSize: mob ? 14 : 15, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.name}</span>
                    <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 12, background: vt.bg, color: vt.color, flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 4 }}><vt.Icon /> {vt.label}</span>
                  </div>
                  <div style={{ fontSize: 12, color: C.textMuted }}>{fmtDateFull(v.date)} {v.time || ""} · {v.location || ""}</div>
                  {v.summary && <div style={{ fontSize: 13, color: C.textMuted, marginTop: 4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{v.summary}</div>}
                  {v.prayerNote && <div style={{ fontSize: 12, color: C.purple, marginTop: 4, display: "flex", alignItems: "center", gap: 6 }}><Icons.Prayer /> {v.prayerNote}</div>}
                </div>
                <div style={{ flexShrink: 0, textAlign: "right" }}>
                  <div style={{ fontSize: 12, color: C.textMuted, fontWeight: 600 }}>{relDate(v.date)}</div>
                  <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 20, background: st.bg, color: st.color, marginTop: 4, display: "inline-block" }}>{STATUS_LABELS[v.status]}</span>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

const MAIN_VISIT_TYPES = ["정기", "위로", "새가족", "병문안", "경조사", "일반"];
const PAGE_SIZE = 10;

/* ----- 메인 DB 심방 목록 (70명 연동, 페이지네이션, 목장별) ----- */
function MainDBVisitList({
  mainDb,
  setMainDb,
  saveMain,
  toast,
}: {
  mainDb: DB;
  setMainDb: React.Dispatch<React.SetStateAction<DB>>;
  saveMain: () => void;
  toast: (m: string) => void;
}) {
  const mob = useIsMobile();
  const listRef = useRef<HTMLDivElement>(null);
  const [viewMode, setViewMode] = useState<"list" | "byGroup">("list");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [showAddModal, setShowAddModal] = useState(false);
  const [addDate, setAddDate] = useState(todayStr());
  const [addMemberId, setAddMemberId] = useState("");
  const [addType, setAddType] = useState("정기");
  const [addContent, setAddContent] = useState("");

  const getMember = (id: string) => mainDb.members.find(m => m.id === id) || { name: "(삭제됨)", group: "" };

  const filtered = useMemo(() => {
    let list = [...mainDb.visits].sort((a, b) => b.date.localeCompare(a.date));
    if (filterType !== "all") list = list.filter(v => v.type === filterType);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(v => {
        const m = getMember(v.memberId);
        return m.name.toLowerCase().includes(q) || (v.content || "").toLowerCase().includes(q);
      });
    }
    return list;
  }, [mainDb.visits, mainDb.members, filterType, search]);

  const byGroup = useMemo(() => {
    const map: Record<string, typeof filtered> = {};
    for (const v of filtered) {
      const g = getMember(v.memberId).group || "(목장 미배정)";
      if (!map[g]) map[g] = [];
      map[g].push(v);
    }
    for (const g of Object.keys(map)) map[g].sort((a, b) => b.date.localeCompare(a.date));
    return map;
  }, [filtered, mainDb.members]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageList = viewMode === "list" ? filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE) : filtered;
  const showPagination = viewMode === "list" && filtered.length > PAGE_SIZE;

  const saveNewVisit = () => {
    if (!addMemberId.trim()) { toast("성도를 선택하세요"); return; }
    const id = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `v-${Date.now()}`;
    setMainDb(prev => ({
      ...prev,
      visits: [{ id, date: addDate, memberId: addMemberId, type: addType, content: addContent.trim() }, ...prev.visits],
    }));
    saveMain();
    setShowAddModal(false);
    setAddMemberId(""); setAddDate(todayStr()); setAddType("정기"); setAddContent("");
    toast("심방이 등록되었습니다");
  };

  const renderRow = (v: (typeof mainDb.visits)[0]) => {
    const m = getMember(v.memberId);
    return (
      <div
        key={v.id}
        style={{ display: "flex", alignItems: "flex-start", gap: mob ? 10 : 16, padding: "14px 0", borderBottom: `1px solid ${C.borderLight}` }}
      >
        <div style={{ width: mob ? 40 : 48, height: mob ? 40 : 48, borderRadius: "50%", background: C.accentLight, color: C.accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: mob ? 14 : 18, fontWeight: 700, flexShrink: 0 }}>{m.name[0]}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2, minWidth: 0 }}>
            <span style={{ fontSize: mob ? 14 : 15, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.name}</span>
            <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 12, background: C.tealBg, color: C.teal, flexShrink: 0 }}>{v.type}</span>
          </div>
          <div style={{ fontSize: 12, color: C.textMuted }}>{fmtDateFull(v.date)}</div>
          {v.content && <div style={{ fontSize: 13, color: C.textMuted, marginTop: 4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{v.content}</div>}
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", gap: mob ? 8 : 12, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: 1, minWidth: mob ? 0 : 200 }}>
          <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: C.textFaint, display: "flex" }}><Icons.Search /></span>
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="이름, 내용 검색..." style={{ width: "100%", height: mob ? 36 : 40, padding: "0 14px 0 38px", fontFamily: "inherit", fontSize: mob ? 13 : 14, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, outline: "none", color: C.text }} />
        </div>
        <Btn variant="primary" size="sm" onClick={() => setShowAddModal(true)}>＋ 심방 등록</Btn>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <Chip label="전체 목록" active={viewMode === "list"} onClick={() => { setViewMode("list"); setPage(1); }} />
        <Chip label="목장별 보기" active={viewMode === "byGroup"} onClick={() => setViewMode("byGroup")} />
        <span style={{ fontSize: 12, color: C.textMuted, marginLeft: 8 }}>유형:</span>
        <Chip label="전체" active={filterType === "all"} onClick={() => { setFilterType("all"); setPage(1); }} />
        {MAIN_VISIT_TYPES.map(t => <Chip key={t} label={t} active={filterType === t} onClick={() => { setFilterType(t); setPage(1); }} />)}
      </div>
      <div ref={listRef}><Card>
        <div style={{ padding: mob ? 14 : 22 }}>
          {filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: 48, color: C.textFaint }}><div style={{ opacity: 0.3, marginBottom: 12, display: "flex", justifyContent: "center" }}><Icons.Visit /></div><div style={{ fontSize: 14 }}>심방 기록이 없습니다</div></div>
          ) : viewMode === "byGroup" ? (
            Object.entries(byGroup).sort(([a], [b]) => a.localeCompare(b)).map(([groupName, list]) => (
              <div key={groupName} style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.navy, marginBottom: 12, paddingBottom: 6, borderBottom: `2px solid ${C.accent}` }}>{groupName}</div>
                {list.map(v => renderRow(v))}
              </div>
            ))
          ) : (
            <>
              {pageList.map(v => renderRow(v))}
              {viewMode === "list" && (
                <Pagination totalItems={filtered.length} itemsPerPage={PAGE_SIZE} currentPage={currentPage} onPageChange={(p) => { setPage(p); listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }} />
              )}
            </>
          )}
        </div>
      </Card></div>

      {showAddModal && (
        <Modal open={true} onClose={() => setShowAddModal(false)} title="심방 등록" footer={
          <>
            <Btn variant="secondary" onClick={() => setShowAddModal(false)}>취소</Btn>
            <Btn onClick={saveNewVisit}>저장</Btn>
          </>
        }>
          <FormField label="날짜"><CalendarDropdown value={addDate} onChange={setAddDate} /></FormField>
          <FormField label="성도">
            <FSelect value={addMemberId} onChange={setAddMemberId} style={{ maxHeight: 200 }}>
              <option value="">선택</option>
              {(mainDb.members ?? []).map(m => (
                <option key={m.id} value={m.id}>{m.group ? `[${m.group}] ` : ""}{m.name} {m.role ? `(${m.role})` : ""}</option>
              ))}
            </FSelect>
          </FormField>
          <FormField label="유형">
            <FSelect value={addType} onChange={setAddType}>
              {MAIN_VISIT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </FSelect>
          </FormField>
          <FormField label="내용"><FTextarea value={addContent} onChange={setAddContent} placeholder="심방 내용을 입력하세요" /></FormField>
        </Modal>
      )}
    </div>
  );
}

/* ----- Counsel List ----- */
function CounselListSub({ db, openCounselModal }: { db: VCDB; openCounselModal: (id?: string) => void }) {
  const mob = useIsMobile();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<string>("all");
  const getMember = (id: string) => (db.members ?? []).find(m => m.id === id) || { name: "(삭제됨)", group: "", role: "", id: "", phone: "", note: "" };

  const list = useMemo(() => {
    let r = [...(db.counsels ?? [])];
    if (filter !== "all") r = r.filter(c => c.type === filter);
    if (search) { const q = search.toLowerCase(); r = r.filter(c => { const m = getMember(c.memberId); return m.name.toLowerCase().includes(q) || (c.summary || "").toLowerCase().includes(q); }); }
    return r.sort((a, b) => b.date.localeCompare(a.date));
  }, [db.counsels, search, filter]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", gap: mob ? 8 : 12, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: 1, minWidth: mob ? 0 : 200 }}>
          <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: C.textFaint, display: "flex" }}><Icons.Search /></span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="이름, 유형, 내용 검색..." style={{ width: "100%", height: mob ? 36 : 40, padding: "0 14px 0 38px", fontFamily: "inherit", fontSize: mob ? 13 : 14, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, outline: "none", color: C.text }} />
        </div>
        <Btn variant="primary" size="sm" onClick={() => openCounselModal()}>＋ 상담 등록</Btn>
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <Chip label="전체" active={filter === "all"} onClick={() => setFilter("all")} />
        {Object.entries(COUNSEL_TYPES).map(([k, v]) => <Chip key={k} icon={<v.Icon />} label={v.label} active={filter === k} onClick={() => setFilter(k)} />)}
      </div>
      <Card>
        <div style={{ padding: mob ? 14 : 22 }}>
          {list.length === 0 ? (
            <div style={{ textAlign: "center", padding: 48, color: C.textFaint }}><div style={{ opacity: 0.3, marginBottom: 12, display: "flex", justifyContent: "center" }}><Icons.Counsel /></div><div style={{ fontSize: 14 }}>상담 기록이 없습니다</div></div>
          ) : list.map(c => {
            const m = getMember(c.memberId);
            const ct = COUNSEL_TYPES[c.type] || COUNSEL_TYPES.other;
            return (
              <div key={c.id} onClick={() => openCounselModal(c.id)} style={{ display: "flex", alignItems: "flex-start", gap: mob ? 10 : 16, padding: "14px 0", borderBottom: `1px solid ${C.borderLight}`, cursor: "pointer" }}>
                <div style={{ width: mob ? 40 : 48, height: mob ? 40 : 48, borderRadius: "50%", background: ct.bg, color: ct.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: mob ? 14 : 18, fontWeight: 700, flexShrink: 0 }}>{m.name[0]}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2, minWidth: 0, flexWrap: "wrap" }}>
                    <span style={{ fontSize: mob ? 14 : 15, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.name}</span>
                    <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 12, background: ct.bg, color: ct.color, flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 4 }}><ct.Icon /> {ct.label}</span>
                    {c.confidential && <span style={{ fontSize: 11, color: C.red, fontWeight: 600, flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 4 }}><Icons.Lock /> 비공개</span>}
                  </div>
                  <div style={{ fontSize: 12, color: C.textMuted }}>{fmtDateFull(c.date)}</div>
                  {c.summary && <div style={{ fontSize: 13, color: C.textMuted, marginTop: 4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{c.summary}</div>}
                </div>
                <div style={{ flexShrink: 0, textAlign: "right" }}>
                  <div style={{ fontSize: 12, color: C.textMuted, fontWeight: 600 }}>{relDate(c.date)}</div>
                  {c.followUpDate && !c.followUpDone && <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 20, background: daysFromNow(c.followUpDate) < 0 ? C.redBg : C.accentLight, color: daysFromNow(c.followUpDate) < 0 ? C.red : C.accent, marginTop: 4, display: "inline-block" }}>재상담 {fmtShort(c.followUpDate)}</span>}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

/* ----- Follow Up ----- */
function FollowUpSub({ db, setDb, persist, toast, openVisitModal, openCounselModal }: { db: VCDB; setDb: React.Dispatch<React.SetStateAction<VCDB>>; persist: () => void; toast: (m: string) => void; openVisitModal: (id?: string) => void; openCounselModal: (id?: string) => void }) {
  const mob = useIsMobile();
  const [tab, setTab] = useState("all");
  const getMember = (id: string) => (db.members ?? []).find(m => m.id === id) || { name: "(삭제됨)", group: "", role: "", id: "", phone: "", note: "" };

  const allFU = getAllFollowups(db);
  const filtered = useMemo(() => {
    if (tab === "overdue") return allFU.filter(f => !f.done && daysFromNow(f.date) < 0);
    if (tab === "today") return allFU.filter(f => !f.done && f.date === todayStr());
    if (tab === "upcoming") return allFU.filter(f => !f.done && daysFromNow(f.date) > 0);
    if (tab === "done") return allFU.filter(f => f.done);
    return allFU.filter(f => !f.done);
  }, [allFU, tab]);

  const toggleFU = (kind: "visit" | "counsel", refId: string) => {
    setDb(prev => {
      const next = { ...prev };
      if (kind === "visit") {
        next.visits = prev.visits.map(v => v.id === refId ? { ...v, followUpDone: !v.followUpDone } : v);
      } else {
        next.counsels = prev.counsels.map(c => c.id === refId ? { ...c, followUpDone: !c.followUpDone } : c);
      }
      return next;
    });
    persist();
    toast("후속 조치 상태 변경");
  };

  const tabs = [{ id: "all", label: "전체" }, { id: "overdue", label: "기한 초과" }, { id: "today", label: "오늘" }, { id: "upcoming", label: "예정" }, { id: "done", label: "완료" }];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", gap: 2, background: C.borderLight, borderRadius: 8, padding: 3, overflow: "auto" }}>
        {tabs.map(t => (
          <div key={t.id} onClick={() => setTab(t.id)} style={{ flex: 1, padding: mob ? "8px 10px" : "8px 16px", textAlign: "center", fontSize: mob ? 12 : 13, fontWeight: 600, color: tab === t.id ? C.text : C.textMuted, background: tab === t.id ? "#fff" : "transparent", borderRadius: 6, cursor: "pointer", transition: "all 0.2s", whiteSpace: "nowrap", boxShadow: tab === t.id ? "0 1px 2px rgba(0,0,0,0.05)" : "none" }}>{t.label}</div>
        ))}
      </div>
      <Card>
        <div style={{ padding: mob ? 14 : 22 }}>
          {filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: 48, color: C.textFaint }}><div style={{ opacity: 0.3, marginBottom: 12, display: "flex", justifyContent: "center" }}><Icons.Bell /></div><div style={{ fontSize: 14 }}>해당하는 후속 조치가 없습니다</div></div>
          ) : filtered.map(f => {
            const m = getMember(f.memberId);
            const diff = daysFromNow(f.date);
            const borderColor = f.done ? C.border : diff < 0 ? C.red : diff === 0 ? C.yellow : C.accent;
            const bgColor = f.done ? "transparent" : diff < 0 ? C.redBg : diff === 0 ? C.yellowBg : C.accentLight;
            return (
              <div key={f.refId + f.kind} onClick={() => f.kind === "visit" ? openVisitModal(f.refId) : openCounselModal(f.refId)} style={{ display: "flex", alignItems: "center", gap: 12, padding: 12, borderRadius: 8, marginBottom: 8, border: `1px solid ${C.borderLight}`, borderLeft: `3px solid ${borderColor}`, background: bgColor, cursor: "pointer" }}>
                <span style={{ fontSize: 20, flexShrink: 0, display: "flex" }}>{f.kind === "visit" ? <Icons.Visit /> : <Icons.Counsel />}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.name} <span style={{ fontSize: 12, color: C.textFaint, fontWeight: 400 }}>· {f.originType}</span></div>
                  <div style={{ fontSize: 12, color: C.textMuted }}>{f.note || "후속 조치 필요"}</div>
                  <div style={{ fontSize: 11, color: C.textFaint, marginTop: 2 }}>원래 기록: {fmtDate(f.originDate)}</div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: diff < 0 ? C.red : diff === 0 ? C.yellow : C.accent, textAlign: "right" }}>{fmtDate(f.date)}<br /><span style={{ fontSize: 11 }}>{relDate(f.date)}</span></div>
                  <Btn size="sm" variant={f.done ? "secondary" : "primary"} onClick={e => { e?.stopPropagation(); toggleFU(f.kind, f.refId); }}>{f.done ? "↩ 되돌리기" : "✓ 완료"}</Btn>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

/* ----- Prayers ----- */
function PrayersSub({
  db,
  setDb,
  persist,
  toast,
  openMemberDetail,
  openPrayerModal,
}: {
  db: VCDB;
  setDb: React.Dispatch<React.SetStateAction<VCDB>>;
  persist: () => void;
  toast: (m: string) => void;
  openMemberDetail: (id: string) => void;
  openPrayerModal: () => void;
}) {
  const mob = useIsMobile();
  const [filter, setFilter] = useState<"all" | "active" | "answered">("all");
  const [search, setSearch] = useState("");
  const getMember = (id: string) => (db.members ?? []).find(m => m.id === id) || { name: "(삭제됨)", group: "", role: "", id: "", phone: "", note: "" };

  const list = useMemo(() => {
    let r = [...(db.prayers || [])];
    if (filter === "active") r = r.filter(p => p.status === "active");
    if (filter === "answered") r = r.filter(p => p.status === "answered");
    if (search) {
      const q = search.toLowerCase();
      r = r.filter(p => {
        const m = getMember(p.memberId);
        return m.name.toLowerCase().includes(q) || (p.text || "").toLowerCase().includes(q);
      });
    }
    return r.sort((a, b) => b.date.localeCompare(a.date));
  }, [db.prayers, filter, search]);

  const togglePrayerStatus = (id: string) => {
    setDb(prev => ({
      ...prev,
      prayers: (prev.prayers || []).map(p => p.id === id ? { ...p, status: p.status === "active" ? "answered" as const : "active" as const } : p),
    }));
    persist();
    toast("상태가 변경되었습니다");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", gap: mob ? 8 : 12, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: 1, minWidth: mob ? 0 : 200 }}>
          <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: C.textFaint, display: "flex" }}><Icons.Search /></span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="이름, 기도제목 검색..." style={{ width: "100%", height: mob ? 36 : 40, padding: "0 14px 0 38px", fontFamily: "inherit", fontSize: mob ? 13 : 14, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, outline: "none", color: C.text }} />
        </div>
        <Btn variant="primary" size="sm" onClick={openPrayerModal}>＋ 기도제목 등록</Btn>
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <Chip label="전체" active={filter === "all"} onClick={() => setFilter("all")} />
        <Chip label="기도 중" active={filter === "active"} onClick={() => setFilter("active")} />
        <Chip label="응답됨" active={filter === "answered"} onClick={() => setFilter("answered")} />
      </div>
      {list.length === 0 ? (
        <div style={{ textAlign: "center", padding: 48, color: C.textFaint }}><div style={{ opacity: 0.3, marginBottom: 12, display: "flex", justifyContent: "center" }}><Icons.Prayer /></div><div style={{ fontSize: 14 }}>기도제목이 없습니다</div></div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {list.map(p => {
            const m = getMember(p.memberId);
            const isActive = p.status === "active";
            return (
              <Card key={p.id} onClick={() => openMemberDetail(p.memberId)} style={{ cursor: "pointer" }}>
                <div style={{ padding: mob ? 14 : 22, display: "flex", alignItems: "flex-start", gap: mob ? 12 : 16 }}>
                  <div style={{ width: mob ? 40 : 48, height: mob ? 40 : 48, borderRadius: "50%", background: isActive ? C.purpleBg : C.greenBg, color: isActive ? C.purple : C.green, display: "flex", alignItems: "center", justifyContent: "center", fontSize: mob ? 14 : 18, fontWeight: 700, flexShrink: 0 }}>{m.name[0]}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, minWidth: 0, flexWrap: "wrap" }}>
                      <span style={{ fontSize: mob ? 14 : 15, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.name}</span>
                      <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 12, background: C.borderLight, color: C.textMuted, flexShrink: 0 }}>{PRAYER_CATEGORIES[p.category]}</span>
                      <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 12, background: isActive ? C.purpleBg : C.greenBg, color: isActive ? C.purple : C.green }}>{PRAYER_STATUS_LABELS[p.status]}</span>
                    </div>
                    <div style={{ fontSize: 13, color: C.text, lineHeight: 1.5 }}>{p.text}</div>
                    <div style={{ fontSize: 12, color: C.textMuted, marginTop: 6 }}>{fmtDate(p.date)}</div>
                  </div>
                  <Btn size="sm" variant="secondary" onClick={e => { e?.stopPropagation(); togglePrayerStatus(p.id); }}>{isActive ? "응답됨" : "되돌리기"}</Btn>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ----- Members ----- */
function MembersSub({ db, openMemberDetail }: { db: VCDB; openMemberDetail: (id: string) => void }) {
  const mob = useIsMobile();
  const [search, setSearch] = useState("");
  const members = useMemo(() => {
    const q = search.toLowerCase();
    return q ? (db.members ?? []).filter(m => (m.name || "").toLowerCase().includes(q) || (m.group || "").toLowerCase().includes(q)) : (db.members ?? []);
  }, [db.members, search]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ position: "relative" }}>
        <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: C.textFaint, display: "flex" }}><Icons.Search /></span>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="성도 이름 검색..." style={{ width: "100%", height: mob ? 36 : 40, padding: "0 14px 0 38px", fontFamily: "inherit", fontSize: mob ? 13 : 14, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, outline: "none", color: C.text }} />
      </div>
      {members.length === 0 ? (
        <div style={{ textAlign: "center", padding: 48, color: C.textFaint }}><div style={{ opacity: 0.3, marginBottom: 12, display: "flex", justifyContent: "center" }}><User size={40} strokeWidth={1.5} /></div><div style={{ fontSize: 14 }}>검색 결과가 없습니다</div></div>
      ) : members.map(m => {
        const vc = (db.visits ?? []).filter(v => v.memberId === m.id).length;
        const cc = (db.counsels ?? []).filter(c => c.memberId === m.id).length;
        const lastV = [...(db.visits ?? [])].filter(v => v.memberId === m.id).sort((a, b) => b.date.localeCompare(a.date))[0];
        const lastC = [...(db.counsels ?? [])].filter(c => c.memberId === m.id).sort((a, b) => b.date.localeCompare(a.date))[0];
        return (
          <Card key={m.id} onClick={() => openMemberDetail(m.id)} style={{ cursor: "pointer" }}>
            <div style={{ padding: mob ? 14 : 22 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <div style={{ width: mob ? 48 : 56, height: mob ? 48 : 56, borderRadius: "50%", background: C.accentLight, color: C.accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: mob ? 20 : 24, fontWeight: 700, flexShrink: 0 }}>{m.name[0]}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: mob ? 15 : 17, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.name} <span style={{ fontSize: 13, fontWeight: 400, color: C.textMuted }}>{m.role} · {m.group}</span></div>
                  <div style={{ fontSize: 13, color: C.textMuted, marginTop: 2, display: "flex", alignItems: "center", gap: 6 }}><Icons.Phone /> {m.phone}{m.note ? ` · ${m.note}` : ""}</div>
                  <div style={{ display: "flex", gap: mob ? 12 : 20, marginTop: 8 }}>
                    {[{ v: vc, l: "심방" }, { v: cc, l: "상담" }, { v: lastV ? fmtShort(lastV.date) : "-", l: "최근 심방" }, { v: lastC ? fmtShort(lastC.date) : "-", l: "최근 상담" }].map((s, i) => (
                      <div key={i} style={{ textAlign: "center" }}>
                        <div style={{ fontSize: mob ? 14 : 18, fontWeight: 800 }}>{s.v}</div>
                        <div style={{ fontSize: 11, color: C.textMuted }}>{s.l}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

/* ----- Timeline ----- */
function TimelineSub({ db, openVisitModal, openCounselModal }: { db: VCDB; openVisitModal: (id?: string) => void; openCounselModal: (id?: string) => void }) {
  const mob = useIsMobile();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const getMember = (id: string) => (db.members ?? []).find(m => m.id === id) || { name: "(삭제됨)", group: "", role: "", id: "", phone: "", note: "" };

  const all = useMemo(() => {
    type TLItem = (Visit | Counsel) & { _kind: "visit" | "counsel"; _date: string };
    let items: TLItem[] = [
      ...(db.visits ?? []).map(v => ({ ...v, _kind: "visit" as const, _date: v.date })),
      ...(db.counsels ?? []).map(c => ({ ...c, _kind: "counsel" as const, _date: c.date })),
    ];
    if (filter !== "all") items = items.filter(x => x._kind === filter);
    if (search) {
      const q = search.toLowerCase();
      items = items.filter(x => { const m = getMember(x.memberId); return m.name.toLowerCase().includes(q) || (x.summary || "").toLowerCase().includes(q); });
    }
    return items.sort((a, b) => b._date.localeCompare(a._date));
  }, [db, search, filter]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", gap: mob ? 8 : 12, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: 1, minWidth: mob ? 0 : 200 }}>
          <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: C.textFaint, display: "flex" }}><Icons.Search /></span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="검색..." style={{ width: "100%", height: mob ? 36 : 40, padding: "0 14px 0 38px", fontFamily: "inherit", fontSize: mob ? 13 : 14, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, outline: "none", color: C.text }} />
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <Chip label="전체" active={filter === "all"} onClick={() => setFilter("all")} />
          <Chip icon={<Icons.Visit />} label="심방" active={filter === "visit"} onClick={() => setFilter("visit")} />
          <Chip icon={<Icons.Counsel />} label="상담" active={filter === "counsel"} onClick={() => setFilter("counsel")} />
        </div>
      </div>
      <Card>
        <div style={{ padding: mob ? 14 : 22 }}>
          {all.length === 0 ? (
            <div style={{ textAlign: "center", padding: 48, color: C.textFaint }}><div style={{ opacity: 0.3, marginBottom: 12, display: "flex", justifyContent: "center" }}><Icons.Scroll /></div><div style={{ fontSize: 14 }}>기록이 없습니다</div></div>
          ) : (
            <div style={{ position: "relative", paddingLeft: 32 }}>
              <div style={{ position: "absolute", left: 10, top: 0, bottom: 0, width: 2, background: C.border }} />
              {all.map(item => {
                const m = getMember(item.memberId);
                const isVisit = item._kind === "visit";
                const dotColor = isVisit ? C.teal : C.pink;
                const vItem = isVisit ? (item as Visit & { _kind: "visit"; _date: string }) : null;
                const cItem = !isVisit ? (item as Counsel & { _kind: "counsel"; _date: string }) : null;
                const completed = isVisit && vItem?.status === "completed";
                return (
                  <div key={item.id + item._kind} style={{ position: "relative", paddingBottom: 24 }}>
                    <div style={{ position: "absolute", left: -28, top: 2, width: 16, height: 16, borderRadius: "50%", border: `3px solid ${completed ? C.green : dotColor}`, background: completed ? C.green : "#fff", zIndex: 1 }} />
                    <div style={{ fontSize: 12, color: C.textMuted, fontWeight: 600 }}>{fmtDateFull(item._date)} {vItem ? vItem.time || "" : ""}</div>
                    <div onClick={() => isVisit ? openVisitModal(item.id) : openCounselModal(item.id)} style={{ background: C.bg, borderRadius: 8, padding: "12px 16px", marginTop: 6, border: `1px solid ${C.borderLight}`, cursor: "pointer", transition: "all 0.2s" }}>
                      <div style={{ fontSize: 14, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display: "flex", alignItems: "center", gap: 6 }}>{isVisit ? <Icons.Visit /> : <Icons.Counsel />} {m.name} · {vItem ? (VISIT_TYPES[vItem.type]?.label || "") : ((COUNSEL_TYPES[cItem!.type]?.label || "") + " 상담")}{cItem?.confidential ? <><Icons.Lock /> </> : null}</div>
                      {item.summary && <div style={{ fontSize: 13, color: C.textMuted, marginTop: 4, lineHeight: 1.5 }}>{item.summary}</div>}
                      <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                        {vItem && <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 12, background: VISIT_TYPES[vItem.type]?.bg, color: VISIT_TYPES[vItem.type]?.color }}>{VISIT_TYPES[vItem.type]?.label}</span>}
                        {vItem && <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 12, background: STATUS_COLORS[vItem.status]?.bg, color: STATUS_COLORS[vItem.status]?.color }}>{STATUS_LABELS[vItem.status]}</span>}
                        {cItem && <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 12, background: COUNSEL_TYPES[cItem.type]?.bg, color: COUNSEL_TYPES[cItem.type]?.color }}>{COUNSEL_TYPES[cItem.type]?.label}</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

/* ----- Report ----- */
function ReportSub({ db, toast, loading }: { db: VCDB; toast: (m: string) => void; loading?: boolean }) {
  const mob = useIsMobile();
  const mv = (db.visits ?? []).filter(v => thisMonth(v.date));
  const mc = (db.counsels ?? []).filter(c => thisMonth(c.date));
  const completed = mv.filter(v => v.status === "completed");
  const allFU = getAllFollowups(db).filter(f => !f.done);
  const now = new Date();
  const getMember = (id: string) => (db.members ?? []).find(m => m.id === id) || { name: "(삭제됨)", group: "", role: "", id: "", phone: "", note: "" };

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 48 }}>
        <span style={{ display: "inline-block", width: 28, height: 28, borderRadius: "50%", border: "2px solid #1a1f36", borderTopColor: "transparent", animation: "spin 0.8s linear infinite" }} />
        <span style={{ marginLeft: 12, fontSize: 14, color: C.textMuted }}>보고서 로딩 중…</span>
      </div>
    );
  }

  const vTypes: Record<string, number> = {};
  mv.forEach(v => { const l = VISIT_TYPES[v.type]?.label || v.type; vTypes[l] = (vTypes[l] || 0) + 1; });
  const cTypes: Record<string, number> = {};
  mc.forEach(c => { const l = COUNSEL_TYPES[c.type]?.label || c.type; cTypes[l] = (cTypes[l] || 0) + 1; });

  const exportCSV = () => {
    let csv = "\uFEFF심방/상담 기록 보고서\n";
    csv += `교회,${db.settings.church}\n교역자,${db.settings.name} ${db.settings.role}\n출력일,${todayStr()}\n\n`;
    csv += "=== 심방 기록 ===\n이름,구역,직분,유형,날짜,시간,장소,상태,내용,기도제목\n";
    [...(db.visits ?? [])].sort((a, b) => b.date.localeCompare(a.date)).forEach(v => {
      const m = getMember(v.memberId);
      csv += `${m.name},${m.group},${m.role},${VISIT_TYPES[v.type]?.label || v.type},${v.date},${v.time || ""},${v.location || ""},${STATUS_LABELS[v.status]},"${(v.summary || "").replace(/"/g, '""')}","${(v.prayerNote || "").replace(/"/g, '""')}"\n`;
    });
    csv += "\n=== 상담 기록 ===\n이름,구역,직분,유형,날짜,비공개,내용\n";
    [...(db.counsels ?? [])].sort((a, b) => b.date.localeCompare(a.date)).forEach(c => {
      const m = getMember(c.memberId);
      csv += `${m.name},${m.group},${m.role},${COUNSEL_TYPES[c.type]?.label || c.type},${c.date},${c.confidential ? "비공개" : "공개"},"${(c.summary || "").replace(/"/g, '""')}"\n`;
    });
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `심방상담기록_${todayStr()}.csv`; a.click();
    toast("엑셀 파일이 다운로드되었습니다");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <Card>
        <div style={{ padding: mob ? "14px 16px" : "18px 22px", borderBottom: `1px solid ${C.borderLight}`, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
          <span style={{ fontSize: mob ? 14 : 16, fontWeight: 700 }}>월간 심방/상담 보고서</span>
          <div style={{ display: "flex", gap: 8 }}>
            <Btn variant="secondary" size="sm" onClick={() => window.print()} icon={<Icons.Printer />}>인쇄</Btn>
            <Btn variant="primary" size="sm" onClick={exportCSV} icon={<Icons.Export />}>엑셀</Btn>
          </div>
        </div>
        <div style={{ padding: mob ? 14 : 22 }}>
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: mob ? 16 : 20, fontWeight: 800 }}>{db.settings.church} · {db.settings.name} {db.settings.role}</div>
            <div style={{ fontSize: 14, color: C.textMuted }}>{now.getFullYear()}년 {now.getMonth() + 1}월 심방/상담 보고서</div>
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12, display: "inline-flex", alignItems: "center", gap: 8 }}><Icons.Chart /> 월간 요약</div>
          <div style={{ display: "grid", gridTemplateColumns: mob ? "1fr 1fr" : "repeat(4, 1fr)", gap: mob ? 10 : 16, marginBottom: 24 }}>
            <StatCard icon={<Icons.Visit />} label="심방 건수" value={String(mv.length)} color={C.teal} bg={C.tealBg} />
            <StatCard icon={<Icons.Check />} label="완료" value={String(completed.length)} color={C.green} bg={C.greenBg} />
            <StatCard icon={<Icons.Counsel />} label="상담 건수" value={String(mc.length)} color={C.pink} bg={C.pinkBg} />
            <StatCard icon={<Icons.Bell />} label="후속 조치 대기" value={String(allFU.length)} color={C.red} bg={C.redBg} />
          </div>

          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12, display: "inline-flex", alignItems: "center", gap: 8 }}><Icons.Visit /> 심방 유형별 현황</div>
          <div style={{ marginBottom: 24 }}>
            {Object.entries(vTypes).map(([k, v]) => (
              <div key={k} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600, width: 80 }}>{k}</span>
                <div style={{ flex: 1, height: 24, background: C.borderLight, borderRadius: 12, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${(v / Math.max(...Object.values(vTypes), 1)) * 100}%`, background: C.teal, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 8, minWidth: 28 }}>
                    <span style={{ fontSize: 11, color: "#fff", fontWeight: 700 }}>{v}건</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12, display: "inline-flex", alignItems: "center", gap: 8 }}><Icons.Counsel /> 상담 유형별 현황</div>
          <div style={{ marginBottom: 24 }}>
            {Object.entries(cTypes).map(([k, v]) => (
              <div key={k} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600, width: 80 }}>{k}</span>
                <div style={{ flex: 1, height: 24, background: C.borderLight, borderRadius: 12, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${(v / Math.max(...Object.values(cTypes), 1)) * 100}%`, background: C.pink, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 8, minWidth: 28 }}>
                    <span style={{ fontSize: 11, color: "#fff", fontWeight: 700 }}>{v}건</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12, display: "inline-flex", alignItems: "center", gap: 8 }}><Icons.Clipboard /> 심방 상세 내역</div>
          <div style={{ marginBottom: 24 }}>
            {completed.length ? completed.map(v => {
              const m = getMember(v.memberId);
              return <div key={v.id} style={{ padding: 12, background: C.bg, borderRadius: 8, marginBottom: 8 }}><div style={{ fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.name} · {VISIT_TYPES[v.type]?.label} · {fmtDate(v.date)}</div><div style={{ fontSize: 13, color: C.textMuted, marginTop: 4 }}>{v.summary || "기록 없음"}</div>{v.prayerNote && <div style={{ fontSize: 12, color: C.purple, marginTop: 4, display: "flex", alignItems: "center", gap: 6 }}><Icons.Prayer /> {v.prayerNote}</div>}</div>;
            }) : <div style={{ color: C.textFaint }}>완료된 심방 없음</div>}
          </div>

          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12, display: "inline-flex", alignItems: "center", gap: 8 }}><Icons.Bell /> 미완료 후속 조치</div>
          <div>
            {allFU.length ? allFU.map(f => {
              const m = getMember(f.memberId);
              return <div key={f.refId + f.kind} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, padding: "8px 12px", background: daysFromNow(f.date) < 0 ? C.redBg : C.bg, borderRadius: 8 }}><span style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}>{m.name}</span><span style={{ fontSize: 12, color: C.textMuted, flex: 1, minWidth: 0 }}>{f.note || f.originType}</span><span style={{ fontSize: 12, fontWeight: 600, color: daysFromNow(f.date) < 0 ? C.red : C.accent }}>{fmtDate(f.date)} ({relDate(f.date)})</span></div>;
            }) : <div style={{ color: C.textFaint }}>모든 후속 조치 완료</div>}
          </div>
        </div>
      </Card>
    </div>
  );
}

/* ----- Handover Report ----- */
function HandoverSub({ db, toast, getMember }: { db: VCDB; toast: (m: string) => void; getMember: (id: string) => VCMember }) {
  const mob = useIsMobile();
  const prayers = db.prayers || [];
  const memos = db.memos || [];
  const activePrayerCount = prayers.filter(p => p.status === "active").length;

  const exportHandoverCSV = () => {
    let csv = "\uFEFF성도,직분,구역,연락처,심방횟수,상담횟수,활성기도제목수,특이사항\n";
    (db.members ?? []).forEach(m => {
      const vc = (db.visits ?? []).filter(v => v.memberId === m.id).length;
      const cc = (db.counsels ?? []).filter(c => c.memberId === m.id).length;
      const pc = prayers.filter(p => p.memberId === m.id && p.status === "active").length;
      const memberMemos = memos.filter(me => me.memberId === m.id).map(me => me.text).join("; ");
      const notes = [m.note, memberMemos].filter(Boolean).join(" / ");
      csv += `"${m.name}","${m.role}","${m.group}","${m.phone}",${vc},${cc},${pc},"${(notes || "").replace(/"/g, '""')}"\n`;
    });
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `인수인계_${todayStr()}.csv`; a.click();
    toast("엑셀 다운로드 완료");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }} className="handover-report">
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: mob ? 18 : 22, fontWeight: 800 }}>{db.settings.church}</div>
          <div style={{ fontSize: 13, color: C.textMuted }}>교역자: {db.settings.name} {db.settings.role} · 작성일: {todayStr()}</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Btn variant="secondary" size="sm" onClick={() => window.print()} icon={<Icons.Printer />}>인쇄</Btn>
          <Btn variant="primary" size="sm" onClick={exportHandoverCSV} icon={<Icons.Export />}>엑셀</Btn>
        </div>
      </div>

      <Card>
        <div style={{ padding: mob ? 14 : 22 }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, display: "inline-flex", alignItems: "center", gap: 8 }}><Icons.Chart /> 전체 현황 요약</div>
          <div style={{ display: "grid", gridTemplateColumns: mob ? "1fr 1fr" : "repeat(4, 1fr)", gap: 16 }}>
            <div><div style={{ fontSize: 24, fontWeight: 800 }}>{(db.members ?? []).length}</div><div style={{ fontSize: 12, color: C.textMuted }}>전체 성도</div></div>
            <div><div style={{ fontSize: 24, fontWeight: 800 }}>{(db.visits ?? []).length}</div><div style={{ fontSize: 12, color: C.textMuted }}>총 심방</div></div>
            <div><div style={{ fontSize: 24, fontWeight: 800 }}>{(db.counsels ?? []).length}</div><div style={{ fontSize: 12, color: C.textMuted }}>총 상담</div></div>
            <div><div style={{ fontSize: 24, fontWeight: 800 }}>{activePrayerCount}</div><div style={{ fontSize: 12, color: C.textMuted }}>활성 기도제목</div></div>
          </div>
        </div>
      </Card>

      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>성도별 상세</div>
      {(db.members ?? []).map(m => {
        const visits = (db.visits ?? []).filter(v => v.memberId === m.id).sort((a, b) => b.date.localeCompare(a.date));
        const counsels = (db.counsels ?? []).filter(c => c.memberId === m.id).sort((a, b) => b.date.localeCompare(a.date));
        const memberPrayers = prayers.filter(p => p.memberId === m.id && p.status === "active");
        const memberMemos = memos.filter(me => me.memberId === m.id);
        const lastV = visits[0];
        const recentSummary = lastV?.summary ? (lastV.summary.slice(0, 100) + (lastV.summary.length > 100 ? "…" : "")) : "";
        const notes = [m.note, ...memberMemos.map(me => me.text)].filter(Boolean).join(" / ");
        return (
          <Card key={m.id} style={{ breakInside: "avoid" }}>
            <div style={{ padding: mob ? 14 : 22 }}>
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display: "flex", alignItems: "center", gap: 6 }}>{m.name} · {m.role} · {m.group} · <span style={{ display: "inline-flex" }}><Icons.Phone /></span> {m.phone}</div>
              {notes && <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 10, display: "flex", alignItems: "flex-start", gap: 6 }}><Icons.Memo /> {notes}</div>}
              {memberPrayers.length > 0 && (
                <div style={{ marginBottom: 10 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: C.purple, display: "inline-flex", alignItems: "center", gap: 4 }}><Icons.Prayer /> 활성 기도제목: </span>
                  <span style={{ fontSize: 13 }}>{memberPrayers.map(p => p.text).join("; ")}</span>
                </div>
              )}
              <div style={{ fontSize: 13, color: C.textMuted }}>
                심방 {visits.length}회{lastV ? ` (최근 ${fmtDate(lastV.date)})` : ""} · 상담 {counsels.length}회{counsels[0] ? ` (최근 ${fmtDate(counsels[0].date)})` : ""}
              </div>
              {recentSummary && <div style={{ fontSize: 12, color: C.textFaint, marginTop: 8 }}>최근 심방 요약: {recentSummary}</div>}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

/* ----- Settings ----- */
function SettingsSub({ db, setDb, persist, toast }: { db: VCDB; setDb: React.Dispatch<React.SetStateAction<VCDB>>; persist: () => void; toast: (m: string) => void }) {
  const mob = useIsMobile();
  const fileRef = useRef<HTMLInputElement>(null);

  const backupAll = () => {
    const blob = new Blob([JSON.stringify(db, null, 2)], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `심방상담_백업_${todayStr()}.json`; a.click();
    toast("백업 완료");
  };
  const restoreAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const d = JSON.parse(ev.target?.result as string);
        if (d.visits && d.counsels) {
          if (!Array.isArray(d.prayers)) d.prayers = [];
          if (!Array.isArray(d.memos)) d.memos = [];
          setDb(d); persist(); toast("복원 완료");
        } else toast("올바른 파일이 아닙니다");
      } catch { toast("파일 오류"); }
    };
    reader.readAsText(file);
  };
  const resetAll = () => {
    if (typeof window !== "undefined" && !window.confirm("모든 데이터를 초기화하시겠습니까?")) return;
    localStorage.removeItem(VC_KEY);
    setDb(buildEmpty());
    toast("초기화 완료");
  };

  const updateSetting = (key: keyof VCSettings, val: string) => {
    setDb(prev => ({ ...prev, settings: { ...prev.settings, [key]: val } }));
    persist();
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: mob ? "100%" : 600 }}>
      <Card>
        <div style={{ padding: mob ? 14 : 22 }}>
          <h4 style={{ fontSize: mob ? 15 : 17, fontWeight: 700, color: C.navy, marginBottom: 16 }}>⚙️ 설정</h4>
          <FormField label="교역자 이름"><FInput value={db.settings.name} onChange={v => updateSetting("name", v)} /></FormField>
          <FormField label="직분"><FSelect value={db.settings.role} onChange={v => updateSetting("role", v)}><option>담임목사</option><option>부목사</option><option>전도사</option><option>강도사</option><option>교육전도사</option></FSelect></FormField>
          <FormField label="교회명"><FInput value={db.settings.church} onChange={v => updateSetting("church", v)} /></FormField>
        </div>
      </Card>
      <Card>
        <div style={{ padding: mob ? 14 : 22 }}>
          <h4 style={{ fontSize: mob ? 15 : 17, fontWeight: 700, color: C.navy, marginBottom: 12, display: "inline-flex", alignItems: "center", gap: 8 }}><Icons.Save /> 데이터</h4>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Btn variant="secondary" onClick={backupAll} icon={<Icons.Package />}>{mob ? "백업" : "전체 백업"}</Btn>
            <Btn variant="secondary" onClick={() => fileRef.current?.click()} icon={<Icons.Folder />}>복원</Btn>
            <input ref={fileRef} type="file" accept=".json" style={{ display: "none" }} onChange={restoreAll} />
            <Btn variant="danger" size="sm" onClick={resetAll} icon={<Icons.Trash />}>초기화</Btn>
          </div>
        </div>
      </Card>
    </div>
  );
}

/* ============================================================
   MAIN COMPONENT
   ============================================================ */
type SubPage = "dash" | "visits" | "counsels" | "followup" | "prayers" | "members" | "timeline" | "report" | "handover" | "settings";

const NAV_ITEMS: { id: SubPage; Icon: React.ComponentType<any>; label: string }[] = [
  { id: "dash", Icon: LayoutDashboard, label: "대시보드" },
  { id: "visits", Icon: Home, label: "심방 기록" },
  { id: "counsels", Icon: MessageCircle, label: "상담 기록" },
  { id: "followup", Icon: Bell, label: "후속 조치" },
  { id: "prayers", Icon: Heart, label: "기도제목" },
  { id: "members", Icon: User, label: "성도별 이력" },
  { id: "timeline", Icon: ScrollText, label: "전체 타임라인" },
  { id: "report", Icon: TrendingUp, label: "월간 보고서" },
  { id: "handover", Icon: ClipboardList, label: "인수인계 보고서" },
  { id: "settings", Icon: Settings, label: "설정" },
];

const PAGE_INFO: Record<SubPage, { title: string; desc: string }> = {
  dash: { title: "대시보드", desc: "심방과 상담 현황을 한눈에 확인하세요" },
  visits: { title: "심방 기록", desc: "심방 일정과 기록을 관리합니다" },
  counsels: { title: "상담 기록", desc: "상담 내역을 기록하고 관리합니다" },
  followup: { title: "후속 조치", desc: "후속 조치가 필요한 항목을 확인합니다" },
  prayers: { title: "기도제목", desc: "성도별 기도제목을 관리합니다" },
  members: { title: "성도별 이력", desc: "성도별 심방/상담 이력을 조회합니다" },
  timeline: { title: "전체 타임라인", desc: "모든 기록을 시간순으로 봅니다" },
  report: { title: "월간 보고서", desc: "심방/상담 보고서를 생성합니다" },
  handover: { title: "인수인계 보고서", desc: "교역자 인수인계용 성도별 정리" },
  settings: { title: "설정", desc: "시스템 설정을 관리합니다" },
};

export interface VisitCounselPageProps {
  mainDb?: DB;
  setMainDb?: React.Dispatch<React.SetStateAction<DB>>;
  saveMain?: () => void;
}

export function VisitCounselPage({ mainDb, setMainDb, saveMain }: VisitCounselPageProps = {}) {
  const mob = useIsMobile();
  const [db, setDb] = useState<VCDB>(() => loadVC());
  const [activeSub, setActiveSub] = useState<SubPage>("dash");
  const [sideOpen, setSideOpen] = useState(false);
  const [visitsLoading, setVisitsLoading] = useState(false);
  const [visitSaving, setVisitSaving] = useState(false);

  useEffect(() => { if (!mob) setSideOpen(true); else setSideOpen(false); }, [mob]);
  const [toasts, setToasts] = useState<{ id: number; msg: string }[]>([]);

  /* Supabase: visits 목록 로드 */
  const loadVisits = useCallback(async () => {
    if (!supabase) return;
    setVisitsLoading(true);
    const { data, error } = await supabase.from("visits").select("*").order("date", { ascending: false });
    if (error) {
      console.error(error);
      setToasts(prev => [...prev.slice(-2), { id: Date.now(), msg: "데이터 로드 실패: " + error.message }]);
      setTimeout(() => setToasts(t => t.slice(0, -1)), 2500);
    } else {
      setDb(prev => ({ ...prev, visits: (data ?? []).map(mapVisitRow) }));
    }
    setVisitsLoading(false);
  }, []);

  useEffect(() => {
    if (supabase) loadVisits();
  }, [loadVisits]);

  /* Modals */
  const [showVisitModal, setShowVisitModal] = useState(false);
  const [editVisitId, setEditVisitId] = useState<string | null>(null);
  const [showCounselModal, setShowCounselModal] = useState(false);
  const [editCounselId, setEditCounselId] = useState<string | null>(null);
  const [showMemberDetailModal, setShowMemberDetailModal] = useState(false);
  const [detailMemberId, setDetailMemberId] = useState<string | null>(null);
  const [showPrayerModal, setShowPrayerModal] = useState(false);
  const [editPrayerId, setEditPrayerId] = useState<string | null>(null);
  const [pMember, setPMember] = useState("");
  const [pText, setPText] = useState("");
  const [pDate, setPDate] = useState(todayStr());
  const [pCategory, setPCategory] = useState<PrayerCategory>("other");
  const [showMemoModal, setShowMemoModal] = useState(false);
  const [mMemberId, setMMemberId] = useState("");
  const [mText, setMText] = useState("");
  const [mDate, setMDate] = useState(todayStr());
  const [mCategory, setMCategory] = useState<MemoCategory>("other");

  /* Visit form */
  const [vMember, setVMember] = useState("");
  const [vType, setVType] = useState<VisitType>("routine");
  const [vDate, setVDate] = useState(todayStr());
  const [vTime, setVTime] = useState("14:00");
  const [vLoc, setVLoc] = useState("");
  const [vStatus, setVStatus] = useState<VisitStatus>("scheduled");
  const [vSummary, setVSummary] = useState("");
  const [vPrayer, setVPrayer] = useState("");
  const [vFUDate, setVFUDate] = useState("");
  const [vFUNote, setVFUNote] = useState("");
  const [vFUDone, setVFUDone] = useState(false);
  const [vPhotoFile, setVPhotoFile] = useState<File | null>(null);

  /* Counsel form */
  const [cMember, setCMember] = useState("");
  const [cType, setCType] = useState<CounselType>("other");
  const [cDate, setCDate] = useState(todayStr());
  const [cSummary, setCSummary] = useState("");
  const [cConf, setCConf] = useState(false);
  const [cFUDate, setCFUDate] = useState("");
  const [cFUNote, setCFUNote] = useState("");
  const [cFUDone, setCFUDone] = useState(false);

  const persist = useCallback(() => { saveVC(db); }, [db]);
  useEffect(() => { saveVC(db); }, [db]);

  const toast = useCallback((msg: string) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, msg }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 2500);
  }, []);

  const handleNav = (id: SubPage) => { setActiveSub(id); if (mob) setSideOpen(false); };

  const getMember = (id: string) => (db.members ?? []).find(m => m.id === id) || { name: "(삭제됨)", group: "", role: "", id: "", phone: "", note: "" };

  /* Open visit modal */
  const openVisitModal = useCallback((id?: string) => {
    if (id) {
      const v = (db.visits ?? []).find(x => x.id === id);
      if (v) { setEditVisitId(id); setVMember(v.memberId); setVType(v.type); setVDate(v.date); setVTime(v.time); setVLoc(v.location); setVStatus(v.status); setVSummary(v.summary); setVPrayer(v.prayerNote); setVFUDate(v.followUpDate); setVFUNote(v.followUpNote); setVFUDone(v.followUpDone); }
    } else {
      setEditVisitId(null); setVMember(""); setVType("routine"); setVDate(todayStr()); setVTime("14:00"); setVLoc(""); setVStatus("scheduled"); setVSummary(""); setVPrayer(""); setVFUDate(""); setVFUNote(""); setVFUDone(false); setVPhotoFile(null);
    }
    setShowVisitModal(true);
  }, [db.visits]);

  const saveVisit = async () => {
    if (!vMember) { toast("성도를 선택하세요"); return; }
    const visitId = editVisitId || (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `v-${Date.now()}`);
    const data: Visit = { id: visitId, memberId: vMember, type: vType, date: vDate, time: vTime, location: vLoc, status: vStatus, summary: vSummary, prayerNote: vPrayer, followUpDate: vFUDate, followUpNote: vFUNote, followUpDone: vFUDone };

    if (supabase) {
      setVisitSaving(true);
      const payload = visitToPayload(data);
      const { error } = editVisitId
        ? await supabase.from("visits").upsert(payload, { onConflict: "id" })
        : await supabase.from("visits").insert(payload);
      if (error) {
        console.error(error);
        toast("저장 실패: " + error.message);
        setVisitSaving(false);
        return;
      }
      if (vPhotoFile) {
        try {
          const path = `${visitId}/${vPhotoFile.name}`;
          await supabase.storage.from("visit-photos").upload(path, vPhotoFile, { upsert: true });
        } catch (e) {
          console.error(e);
          toast("사진 업로드 실패");
        }
        setVPhotoFile(null);
      }
      await loadVisits();
      setVisitSaving(false);
    }

    setDb(prev => {
      let next = { ...prev };
      if (editVisitId) next = { ...next, visits: next.visits.map(v => v.id === editVisitId ? data : v) };
      else next = { ...next, visits: [...next.visits, data] };
      const prayers = next.prayers || [];
      const textTrim = vPrayer.trim();
      if (textTrim) {
        const exists = prayers.some(p => p.memberId === vMember && p.status === "active" && p.text.trim() === textTrim);
        if (!exists) next = { ...next, prayers: [...prayers, { id: uid(), memberId: vMember, text: textTrim, date: vDate, category: "other", status: "active" as PrayerStatus }] };
      }
      return next;
    });
    persist();
    setShowVisitModal(false);
    toast(editVisitId ? "심방이 수정되었습니다" : "심방이 등록되었습니다");
  };

  const delVisit = async (id: string) => {
    if (typeof window !== "undefined" && !window.confirm("삭제하시겠습니까?")) return;
    if (supabase) {
      const { error } = await supabase.from("visits").delete().eq("id", id);
      if (error) {
        console.error(error);
        toast("삭제 실패: " + error.message);
        return;
      }
      await loadVisits();
    }
    setDb(prev => ({ ...prev, visits: prev.visits.filter(v => v.id !== id) }));
    persist();
    setShowVisitModal(false);
    toast("삭제되었습니다");
  };

  /* Open counsel modal */
  const openCounselModal = useCallback((id?: string) => {
    if (id) {
      const c = (db.counsels ?? []).find(x => x.id === id);
      if (c) { setEditCounselId(id); setCMember(c.memberId); setCType(c.type); setCDate(c.date); setCSummary(c.summary); setCConf(c.confidential); setCFUDate(c.followUpDate); setCFUNote(c.followUpNote); setCFUDone(c.followUpDone); }
    } else {
      setEditCounselId(null); setCMember(""); setCType("other"); setCDate(todayStr()); setCSummary(""); setCConf(false); setCFUDate(""); setCFUNote(""); setCFUDone(false);
    }
    setShowCounselModal(true);
  }, [db.counsels]);

  const saveCounsel = () => {
    if (!cMember) { toast("성도를 선택하세요"); return; }
    const data: Counsel = { id: editCounselId || uid(), memberId: cMember, type: cType, date: cDate, summary: cSummary, confidential: cConf, followUpDate: cFUDate, followUpNote: cFUNote, followUpDone: cFUDone };
    setDb(prev => {
      if (editCounselId) return { ...prev, counsels: prev.counsels.map(c => c.id === editCounselId ? data : c) };
      return { ...prev, counsels: [...prev.counsels, data] };
    });
    persist(); setShowCounselModal(false); toast(editCounselId ? "상담이 수정되었습니다" : "상담이 등록되었습니다");
  };

  const delCounsel = (id: string) => {
    if (typeof window !== "undefined" && !window.confirm("삭제하시겠습니까?")) return;
    setDb(prev => ({ ...prev, counsels: prev.counsels.filter(c => c.id !== id) }));
    persist(); setShowCounselModal(false); toast("삭제되었습니다");
  };

  /* Member detail modal */
  const openMemberDetail = useCallback((id: string) => {
    setDetailMemberId(id); setShowMemberDetailModal(true);
  }, []);

  const savePrayer = () => {
    if (!pMember) { toast("성도를 선택하세요"); return; }
    const textTrim = pText.trim();
    if (!textTrim) { toast("기도제목을 입력하세요"); return; }
    if (editPrayerId) {
      setDb(prev => ({ ...prev, prayers: (prev.prayers || []).map(p => p.id === editPrayerId ? { ...p, memberId: pMember, text: textTrim, date: pDate, category: pCategory } : p) }));
      toast("기도제목이 수정되었습니다");
    } else {
      setDb(prev => ({ ...prev, prayers: [...(prev.prayers || []), { id: uid(), memberId: pMember, text: textTrim, date: pDate, category: pCategory, status: "active" as PrayerStatus }] }));
      toast("기도제목이 등록되었습니다");
    }
    persist(); setShowPrayerModal(false);
  };

  const saveMemo = () => {
    if (!mMemberId) { toast("성도를 선택하세요"); return; }
    const textTrim = mText.trim();
    if (!textTrim) { toast("메모 내용을 입력하세요"); return; }
    setDb(prev => ({ ...prev, memos: [...(prev.memos || []), { id: uid(), memberId: mMemberId, text: textTrim, date: mDate, category: mCategory }] }));
    persist(); setShowMemoModal(false); toast("메모가 등록되었습니다");
    if (detailMemberId) setShowMemberDetailModal(true);
  };

  const exportMemberCSV = (memberId: string) => {
    const m = getMember(memberId);
    let csv = "\uFEFF성도 이력 내보내기\n";
    csv += `이름,${m.name}\n직분,${m.role}\n구역,${m.group}\n연락처,${m.phone}\n특이사항,${(m.note || "").replace(/"/g, '""')}\n\n`;
    const visits = (db.visits ?? []).filter(v => v.memberId === memberId).sort((a, b) => b.date.localeCompare(a.date));
    const counsels = (db.counsels ?? []).filter(c => c.memberId === memberId).sort((a, b) => b.date.localeCompare(a.date));
    const memberPrayers = (db.prayers || []).filter(p => p.memberId === memberId);
    const memberMemos = (db.memos || []).filter(me => me.memberId === memberId);
    csv += "=== 심방 ===\n날짜,유형,장소,상태,내용,기도제목\n";
    visits.forEach(v => { csv += `${v.date},${VISIT_TYPES[v.type]?.label},${v.location || ""},${STATUS_LABELS[v.status]},"${(v.summary || "").replace(/"/g, '""')}","${(v.prayerNote || "").replace(/"/g, '""')}"\n`; });
    csv += "\n=== 상담 ===\n날짜,유형,비공개,내용\n";
    counsels.forEach(c => { csv += `${c.date},${COUNSEL_TYPES[c.type]?.label},${c.confidential ? "Y" : ""},"${(c.summary || "").replace(/"/g, '""')}"\n`; });
    csv += "\n=== 기도제목 ===\n날짜,분류,상태,내용\n";
    memberPrayers.forEach(p => { csv += `${p.date},${PRAYER_CATEGORIES[p.category]},${PRAYER_STATUS_LABELS[p.status]},"${(p.text || "").replace(/"/g, '""')}"\n`; });
    csv += "\n=== 메모 ===\n날짜,분류,내용\n";
    memberMemos.forEach(me => { csv += `${me.date},${MEMO_CATEGORIES[me.category]},"${(me.text || "").replace(/"/g, '""')}"\n`; });
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `성도이력_${m.name}_${todayStr()}.csv`; a.click();
    toast("이력 내보내기 완료");
  };

  const exportCSV = () => {
    let csv = "\uFEFF심방/상담 기록 보고서\n";
    csv += `교회,${db.settings.church}\n교역자,${db.settings.name} ${db.settings.role}\n출력일,${todayStr()}\n\n`;
    csv += "=== 심방 기록 ===\n이름,구역,직분,유형,날짜,시간,장소,상태,내용,기도제목\n";
    [...(db.visits ?? [])].sort((a, b) => b.date.localeCompare(a.date)).forEach(v => {
      const m = getMember(v.memberId);
      csv += `${m.name},${m.group},${m.role},${VISIT_TYPES[v.type]?.label},${v.date},${v.time},${v.location},${STATUS_LABELS[v.status]},"${(v.summary || "").replace(/"/g, '""')}","${(v.prayerNote || "").replace(/"/g, '""')}"\n`;
    });
    csv += "\n=== 상담 기록 ===\n이름,구역,직분,유형,날짜,비공개,내용\n";
    [...(db.counsels ?? [])].sort((a, b) => b.date.localeCompare(a.date)).forEach(c => {
      const m = getMember(c.memberId);
      csv += `${m.name},${m.group},${m.role},${COUNSEL_TYPES[c.type]?.label},${c.date},${c.confidential ? "비공개" : "공개"},"${(c.summary || "").replace(/"/g, '""')}"\n`;
    });
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `심방상담기록_${todayStr()}.csv`; a.click();
    toast("엑셀 다운로드 완료");
  };

  const info = PAGE_INFO[activeSub];
  const allFU = getAllFollowups(db).filter(f => !f.done);
  const overdueCnt = allFU.filter(f => daysFromNow(f.date) < 0).length;
  const detailMember = detailMemberId ? getMember(detailMemberId) : null;

  return (
    <div style={{ fontFamily: "'Inter','Noto Sans KR',-apple-system,sans-serif", background: C.bg, display: "flex", color: C.text, minHeight: "calc(100vh - 56px)", overflow: "hidden", position: "relative" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      {mob && sideOpen && <div onClick={() => setSideOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 99 }} />}

      {/* Sidebar */}
      <aside style={{
        width: mob ? 260 : (sideOpen ? 260 : 64), background: "#1a1f36", color: "#fff",
        display: "flex", flexDirection: "column",
        transition: mob ? "transform 0.3s ease" : "width 0.25s ease",
        overflow: "hidden", flexShrink: 0, zIndex: 100,
        ...(mob ? { position: "fixed", top: 0, left: 0, bottom: 0, transform: sideOpen ? "translateX(0)" : "translateX(-100%)" } : {}),
      }}>
        <div style={{ padding: "24px 20px", borderBottom: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", gap: 10, color: "rgba(255,255,255,0.9)" }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Home size={20} strokeWidth={1.5} /></div>
          <div><div style={{ fontWeight: 700, fontSize: 18, letterSpacing: -0.5, whiteSpace: "nowrap" }}>심방 · 상담</div><div style={{ fontSize: 12, opacity: 0.5, whiteSpace: "nowrap" }}>교역자 기록 관리 시스템</div></div>
        </div>
        <nav style={{ flex: 1, padding: "12px 10px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 2 }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", color: "rgba(255,255,255,0.35)", padding: "16px 12px 6px", letterSpacing: 1, fontWeight: 600 }}>심방/상담</div>
          {NAV_ITEMS.slice(0, 5).map(n => {
            const isActive = activeSub === n.id;
            const Icon = n.Icon;
            return (
              <button key={n.id} onClick={() => handleNav(n.id)} style={{
                display: "flex", alignItems: "center", gap: 12, padding: "10px 12px",
                borderRadius: 8, border: "none", background: isActive ? "rgba(255,255,255,0.12)" : "transparent",
                color: isActive ? "#fff" : "rgba(255,255,255,0.5)", fontWeight: isActive ? 600 : 500,
                fontSize: 14, cursor: "pointer", fontFamily: "inherit", transition: "all 0.2s", textAlign: "left", whiteSpace: "nowrap", position: "relative",
              }}>
                <Icon size={20} strokeWidth={isActive ? 2 : 1.5} style={{ flexShrink: 0 }} /><span>{n.label}</span>
                {n.id === "dash" && overdueCnt > 0 && <span style={{ marginLeft: "auto", background: C.red, color: "#fff", fontSize: 11, padding: "1px 7px", borderRadius: 10, fontWeight: 600 }}>{overdueCnt}</span>}
                {n.id === "followup" && allFU.length > 0 && <span style={{ marginLeft: "auto", background: C.red, color: "#fff", fontSize: 11, padding: "1px 7px", borderRadius: 10, fontWeight: 600 }}>{allFU.length}</span>}
              </button>
            );
          })}
          <div style={{ fontSize: 11, textTransform: "uppercase", color: "rgba(255,255,255,0.35)", padding: "16px 12px 6px", letterSpacing: 1, fontWeight: 600 }}>성도 관리</div>
          {NAV_ITEMS.slice(5, 7).map(n => {
            const isActive = activeSub === n.id;
            const Icon = n.Icon;
            return (
              <button key={n.id} onClick={() => handleNav(n.id)} style={{
                display: "flex", alignItems: "center", gap: 12, padding: "10px 12px",
                borderRadius: 8, border: "none", background: isActive ? "rgba(255,255,255,0.12)" : "transparent",
                color: isActive ? "#fff" : "rgba(255,255,255,0.5)", fontWeight: isActive ? 600 : 500,
                fontSize: 14, cursor: "pointer", fontFamily: "inherit", transition: "all 0.2s", textAlign: "left", whiteSpace: "nowrap",
              }}><Icon size={20} strokeWidth={isActive ? 2 : 1.5} style={{ flexShrink: 0 }} /><span>{n.label}</span></button>
            );
          })}
          <div style={{ fontSize: 11, textTransform: "uppercase", color: "rgba(255,255,255,0.35)", padding: "16px 12px 6px", letterSpacing: 1, fontWeight: 600 }}>보고</div>
          {NAV_ITEMS.slice(7, 9).map(n => {
            const isActive = activeSub === n.id;
            const Icon = n.Icon;
            return (
              <button key={n.id} onClick={() => handleNav(n.id)} style={{
                display: "flex", alignItems: "center", gap: 12, padding: "10px 12px",
                borderRadius: 8, border: "none", background: isActive ? "rgba(255,255,255,0.12)" : "transparent",
                color: isActive ? "#fff" : "rgba(255,255,255,0.5)", fontWeight: isActive ? 600 : 500,
                fontSize: 14, cursor: "pointer", fontFamily: "inherit", transition: "all 0.2s", textAlign: "left", whiteSpace: "nowrap",
              }}><Icon size={20} strokeWidth={isActive ? 2 : 1.5} style={{ flexShrink: 0 }} /><span>{n.label}</span></button>
            );
          })}
          <div style={{ fontSize: 11, textTransform: "uppercase", color: "rgba(255,255,255,0.35)", padding: "16px 12px 6px", letterSpacing: 1, fontWeight: 600 }}>설정</div>
          {NAV_ITEMS.slice(9).map(n => {
            const isActive = activeSub === n.id;
            const Icon = n.Icon;
            return (
              <button key={n.id} onClick={() => handleNav(n.id)} style={{
                display: "flex", alignItems: "center", gap: 12, padding: "10px 12px",
                borderRadius: 8, border: "none", background: isActive ? "rgba(255,255,255,0.12)" : "transparent",
                color: isActive ? "#fff" : "rgba(255,255,255,0.5)", fontWeight: isActive ? 600 : 500,
                fontSize: 14, cursor: "pointer", fontFamily: "inherit", transition: "all 0.2s", textAlign: "left", whiteSpace: "nowrap",
              }}><Icon size={20} strokeWidth={isActive ? 2 : 1.5} style={{ flexShrink: 0 }} /><span>{n.label}</span></button>
            );
          })}
        </nav>
        <div style={{ padding: "16px 20px", borderTop: "1px solid rgba(255,255,255,0.08)", fontSize: 12, color: "rgba(255,255,255,0.35)", textAlign: "center" }}>심방/상담 관리 v1.0</div>
      </aside>

      {/* Main */}
      <main style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>
        <header style={{ height: mob ? 52 : 64, padding: mob ? "0 12px" : "0 28px", background: "rgba(255,255,255,0.85)", backdropFilter: "blur(20px)", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0, gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            {mob && <button onClick={() => setSideOpen(true)} style={{ width: 36, height: 36, border: "none", background: C.bg, borderRadius: 8, fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>☰</button>}
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: mob ? 16 : 20, fontWeight: 700, letterSpacing: -0.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{info.title}</div>
              {!mob && <div style={{ fontSize: 13, color: C.textMuted }}>{info.desc}</div>}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
            <Btn variant="secondary" size="sm" onClick={exportCSV} icon={<Icons.Export />}>{mob ? "엑셀" : "엑셀"}</Btn>
            <Btn variant="primary" size="sm" onClick={() => {
              if (activeSub === "visits" || activeSub === "dash") openVisitModal();
              else if (activeSub === "counsels") openCounselModal();
              else if (activeSub === "prayers") { setShowPrayerModal(true); setEditPrayerId(null); setPMember(""); setPText(""); setPDate(todayStr()); setPCategory("other"); }
              else openVisitModal();
            }}>{mob ? "＋" : "＋ 빠른 등록"}</Btn>
          </div>
        </header>

        <div style={{ flex: 1, overflowY: "auto", padding: mob ? 12 : 24 }}>
          {activeSub === "dash" && <DashSub db={db} goPage={handleNav} openVisitModal={openVisitModal} openCounselModal={openCounselModal} loading={visitsLoading} />}
          {activeSub === "visits" && mainDb != null && setMainDb && saveMain
            ? <MainDBVisitList mainDb={mainDb} setMainDb={setMainDb} saveMain={saveMain} toast={toast} />
            : activeSub === "visits" && <VisitListSub db={db} openVisitModal={openVisitModal} loading={visitsLoading} />}
          {activeSub === "counsels" && <CounselListSub db={db} openCounselModal={openCounselModal} />}
          {activeSub === "followup" && <FollowUpSub db={db} setDb={setDb} persist={persist} toast={toast} openVisitModal={openVisitModal} openCounselModal={openCounselModal} />}
          {activeSub === "prayers" && <PrayersSub db={db} setDb={setDb} persist={persist} toast={toast} openMemberDetail={openMemberDetail} openPrayerModal={() => { setShowPrayerModal(true); setEditPrayerId(null); setPMember(""); setPText(""); setPDate(todayStr()); setPCategory("other"); }} />}
          {activeSub === "members" && <MembersSub db={db} openMemberDetail={openMemberDetail} />}
          {activeSub === "timeline" && <TimelineSub db={db} openVisitModal={openVisitModal} openCounselModal={openCounselModal} />}
          {activeSub === "report" && <ReportSub db={db} toast={toast} loading={visitsLoading} />}
          {activeSub === "handover" && <HandoverSub db={db} toast={toast} getMember={getMember} />}
          {activeSub === "settings" && <SettingsSub db={db} setDb={setDb} persist={persist} toast={toast} />}
        </div>
      </main>

      {/* Visit Modal */}
      <Modal open={showVisitModal} onClose={() => setShowVisitModal(false)} title={editVisitId ? "심방 수정" : "심방 등록"} footer={
        <div style={{ display: "flex", gap: 10, width: "100%", justifyContent: "flex-end" }}>
          {editVisitId && <Btn variant="danger" size="sm" onClick={() => delVisit(editVisitId)} disabled={visitSaving}>삭제</Btn>}
          <div style={{ flex: 1 }} />
          <Btn variant="secondary" onClick={() => setShowVisitModal(false)} disabled={visitSaving}>취소</Btn>
          <Btn onClick={() => saveVisit()} disabled={visitSaving}>{visitSaving ? "저장 중…" : "저장"}</Btn>
        </div>
      }>
        <FormField label="성도 선택"><FSelect value={vMember} onChange={setVMember}><option value="">-- 선택 --</option>{(db.members ?? []).map(m => <option key={m.id} value={m.id}>{m.name} ({m.role}·{m.group})</option>)}</FSelect></FormField>
        <FormField label="심방 유형">
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {Object.entries(VISIT_TYPES).map(([k, v]) => (
              <span key={k} onClick={() => setVType(k as VisitType)} style={{ padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer", border: `1px solid ${vType === k ? C.accent : C.border}`, background: vType === k ? C.accent : C.bg, color: vType === k ? "#fff" : C.text, transition: "all 0.2s", display: "inline-flex", alignItems: "center", gap: 6 }}><v.Icon /> {v.label}</span>
            ))}
          </div>
        </FormField>
        <div style={{ display: "grid", gridTemplateColumns: mob ? "1fr" : "1fr 1fr", gap: 12 }}>
          <FormField label="날짜"><CalendarDropdown value={vDate} onChange={setVDate} /></FormField>
          <FormField label="시간"><FInput type="time" value={vTime} onChange={setVTime} /></FormField>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: mob ? "1fr" : "1fr 1fr", gap: 12 }}>
          <FormField label="장소"><FInput value={vLoc} onChange={setVLoc} placeholder="자택, 병원, 교회 등" /></FormField>
          <FormField label="상태"><FSelect value={vStatus} onChange={v => setVStatus(v as VisitStatus)}>{Object.entries(STATUS_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</FSelect></FormField>
        </div>
        <FormField label="심방 내용"><FTextarea value={vSummary} onChange={setVSummary} placeholder="심방 내용을 상세히 기록하세요" /></FormField>
        <FormField label="기도 제목"><FTextarea value={vPrayer} onChange={setVPrayer} placeholder="기도 제목을 기록하세요" style={{ minHeight: 60 }} /></FormField>
        <FormField label="사진 (선택)">
          <input type="file" accept="image/*" onChange={e => setVPhotoFile(e.target.files?.[0] ?? null)} style={{ fontSize: 13 }} />
          {vPhotoFile && <span style={{ fontSize: 12, color: C.textMuted, marginTop: 4, display: "block" }}>{vPhotoFile.name}</span>}
        </FormField>
        <hr style={{ margin: "12px 0", border: "none", borderTop: `1px solid ${C.borderLight}` }} />
        <div style={{ fontSize: 13, fontWeight: 700, color: C.navy, marginBottom: 12, display: "inline-flex", alignItems: "center", gap: 8 }}><Icons.Bell /> 후속 조치</div>
        <div style={{ display: "grid", gridTemplateColumns: mob ? "1fr" : "1fr 1fr", gap: 12 }}>
          <FormField label="후속 조치 일자"><CalendarDropdown value={vFUDate} onChange={setVFUDate} /><div style={{ fontSize: 12, color: C.textFaint, marginTop: 4 }}>비워두면 후속 조치 없음</div></FormField>
          <FormField label="조치 내용"><FInput value={vFUNote} onChange={setVFUNote} placeholder="예: 재방문, 연락 확인 등" /></FormField>
        </div>
        {editVisitId && vFUDate && <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", marginTop: 8 }}><input type="checkbox" checked={vFUDone} onChange={e => setVFUDone(e.target.checked)} /><span style={{ fontSize: 13, fontWeight: 600, color: C.navy }}>후속 조치 완료</span></label>}
      </Modal>

      {/* Counsel Modal */}
      <Modal open={showCounselModal} onClose={() => setShowCounselModal(false)} title={editCounselId ? "상담 수정" : "상담 등록"} footer={
        <div style={{ display: "flex", gap: 10, width: "100%", justifyContent: "flex-end" }}>
          {editCounselId && <Btn variant="danger" size="sm" onClick={() => delCounsel(editCounselId)}>삭제</Btn>}
          <div style={{ flex: 1 }} />
          <Btn variant="secondary" onClick={() => setShowCounselModal(false)}>취소</Btn>
          <Btn onClick={saveCounsel}>저장</Btn>
        </div>
      }>
        <FormField label="성도 선택"><FSelect value={cMember} onChange={setCMember}><option value="">-- 선택 --</option>{(db.members ?? []).map(m => <option key={m.id} value={m.id}>{m.name} ({m.role}·{m.group})</option>)}</FSelect></FormField>
        <FormField label="상담 유형">
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {Object.entries(COUNSEL_TYPES).map(([k, v]) => (
              <span key={k} onClick={() => setCType(k as CounselType)} style={{ padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer", border: `1px solid ${cType === k ? C.accent : C.border}`, background: cType === k ? C.accent : C.bg, color: cType === k ? "#fff" : C.text, transition: "all 0.2s", display: "inline-flex", alignItems: "center", gap: 6 }}><v.Icon /> {v.label}</span>
            ))}
          </div>
        </FormField>
        <div style={{ display: "grid", gridTemplateColumns: mob ? "1fr" : "1fr 1fr", gap: 12 }}>
          <FormField label="상담 날짜"><CalendarDropdown value={cDate} onChange={setCDate} /></FormField>
          <FormField label="비공개 설정"><label style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 0", cursor: "pointer" }}><input type="checkbox" checked={cConf} onChange={e => setCConf(e.target.checked)} /><span style={{ fontSize: 13, display: "inline-flex", alignItems: "center", gap: 6 }}><Icons.Lock /> 민감한 상담 (비공개)</span></label></FormField>
        </div>
        <FormField label="상담 내용"><FTextarea value={cSummary} onChange={setCSummary} placeholder={"상담 내용을 상세히 기록하세요\n\n- 상담 배경\n- 주요 논의 내용\n- 조언/권면 사항"} style={{ minHeight: 120 }} /></FormField>
        <hr style={{ margin: "12px 0", border: "none", borderTop: `1px solid ${C.borderLight}` }} />
        <div style={{ fontSize: 13, fontWeight: 700, color: C.navy, marginBottom: 12, display: "inline-flex", alignItems: "center", gap: 8 }}><Icons.Bell /> 후속 조치 / 재상담</div>
        <div style={{ display: "grid", gridTemplateColumns: mob ? "1fr" : "1fr 1fr", gap: 12 }}>
          <FormField label="재상담 / 후속 일자"><CalendarDropdown value={cFUDate} onChange={setCFUDate} /><div style={{ fontSize: 12, color: C.textFaint, marginTop: 4 }}>비워두면 재상담 없음</div></FormField>
          <FormField label="조치 내용"><FInput value={cFUNote} onChange={setCFUNote} placeholder="예: 2차 상담, 전문 상담 연결 등" /></FormField>
        </div>
        {editCounselId && cFUDate && <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", marginTop: 8 }}><input type="checkbox" checked={cFUDone} onChange={e => setCFUDone(e.target.checked)} /><span style={{ fontSize: 13, fontWeight: 600, color: C.navy }}>후속 조치 완료</span></label>}
      </Modal>

      {/* Member Detail Modal */}
      <Modal open={showMemberDetailModal} onClose={() => setShowMemberDetailModal(false)} title={detailMember ? `${detailMember.name} 성도 이력` : "성도 이력"} footer={
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
          <Btn variant="secondary" onClick={() => setShowMemberDetailModal(false)}>닫기</Btn>
          {detailMemberId && <Btn variant="secondary" onClick={() => { setMMemberId(detailMemberId); setMText(""); setMDate(todayStr()); setMCategory("other"); setShowMemberDetailModal(false); setShowMemoModal(true); }} icon={<Icons.Memo />}>메모 추가</Btn>}
          {detailMemberId && <Btn variant="secondary" onClick={() => exportMemberCSV(detailMemberId)} icon={<Icons.Export />}>이력 내보내기</Btn>}
          {detailMemberId && <Btn variant="primary" onClick={() => { setShowMemberDetailModal(false); setTimeout(() => { setVMember(detailMemberId); openVisitModal(); }, 300); }} icon={<Icons.Visit />}>심방 등록</Btn>}
          {detailMemberId && <Btn variant="primary" onClick={() => { setShowMemberDetailModal(false); setTimeout(() => { setCMember(detailMemberId); openCounselModal(); }, 300); }} icon={<Icons.Counsel />}>상담 등록</Btn>}
        </div>
      }>
        {detailMember && detailMemberId && (() => {
          const visits = (db.visits ?? []).filter(v => v.memberId === detailMemberId).sort((a, b) => b.date.localeCompare(a.date));
          const counsels = (db.counsels ?? []).filter(c => c.memberId === detailMemberId).sort((a, b) => b.date.localeCompare(a.date));
          const memberMemos = (db.memos || []).filter(me => me.memberId === detailMemberId);
          const allItems: { id: string; _kind: "visit" | "counsel" | "memo"; _date: string; summary?: string }[] = [
            ...visits.map(v => ({ ...v, _kind: "visit" as const, _date: v.date })),
            ...counsels.map(c => ({ ...c, _kind: "counsel" as const, _date: c.date })),
            ...memberMemos.map(me => ({ ...me, _kind: "memo" as const, _date: me.date, summary: me.text })),
          ].sort((a, b) => b._date.localeCompare(a._date));
          return (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 16, padding: 16, background: C.bg, borderRadius: 12, marginBottom: 16 }}>
                <div style={{ width: 64, height: 64, borderRadius: "50%", background: C.accentLight, color: C.accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, fontWeight: 700, flexShrink: 0 }}>{detailMember.name[0]}</div>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 700 }}>{detailMember.name}</div>
                  <div style={{ fontSize: 13, color: C.textMuted, display: "flex", alignItems: "center", gap: 6 }}>{detailMember.role} · {detailMember.group} · <span style={{ display: "inline-flex" }}><Icons.Phone /></span> {detailMember.phone}</div>
                  {detailMember.note && <div style={{ fontSize: 13, color: C.textMuted, marginTop: 4, display: "flex", alignItems: "flex-start", gap: 6 }}><Icons.Memo /> {detailMember.note}</div>}
                </div>
              </div>
              {allItems.length > 0 ? (
                <>
                  <div style={{ fontSize: 15, fontWeight: 700, margin: "20px 0 12px", display: "inline-flex", alignItems: "center", gap: 8 }}><Icons.Scroll /> 전체 이력 ({allItems.length}건)</div>
                  <div style={{ position: "relative", paddingLeft: 32 }}>
                    <div style={{ position: "absolute", left: 10, top: 0, bottom: 0, width: 2, background: C.border }} />
                    {allItems.map(item => {
                      const isVisit = item._kind === "visit";
                      const isMemo = item._kind === "memo";
                      const dotColor = isMemo ? C.yellow : isVisit ? C.teal : C.pink;
                      const bgColor = isMemo ? C.yellowBg : C.bg;
                      const completed = isVisit && "status" in item && item.status === "completed";
                      return (
                        <div key={item.id + item._kind} style={{ position: "relative", paddingBottom: 20 }}>
                          <div style={{ position: "absolute", left: -28, top: 2, width: 16, height: 16, borderRadius: "50%", border: `3px solid ${dotColor}`, background: completed ? C.green : "#fff", zIndex: 1 }} />
                          <div style={{ fontSize: 12, color: C.textMuted, fontWeight: 600 }}>{fmtDateFull(item._date)}</div>
                          <div style={{ background: bgColor, borderRadius: 8, padding: "12px 16px", marginTop: 6, border: `1px solid ${C.borderLight}` }}>
                            {isMemo ? (
                              <div style={{ fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}><Icons.Memo /> 메모 · {MEMO_CATEGORIES[("category" in item ? item.category : "other") as MemoCategory]}</div>
                            ) : (
                              <div style={{ fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>{isVisit ? (() => { const vt = VISIT_TYPES[("type" in item ? item.type : "routine") as VisitType]; return <><vt.Icon /> {vt.label}: {("location" in item ? item.location : "") || ""}</>; })() : (() => { const ct = COUNSEL_TYPES[("type" in item ? item.type : "other") as CounselType]; return <><ct.Icon /> {ct.label} 상담{("confidential" in item && item.confidential) ? <><Icons.Lock /> </> : ""}</>; })()}</div>
                            )}
                            {item.summary && <div style={{ fontSize: 13, color: C.textMuted, marginTop: 4 }}>{item.summary}</div>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : <div style={{ textAlign: "center", padding: 30, color: C.textFaint }}>기록이 없습니다</div>}
            </>
          );
        })()}
      </Modal>

      {/* Prayer Modal */}
      <Modal open={showPrayerModal} onClose={() => setShowPrayerModal(false)} title={editPrayerId ? "기도제목 수정" : "기도제목 등록"} footer={
        <div style={{ display: "flex", gap: 10, width: "100%", justifyContent: "flex-end" }}>
          <Btn variant="secondary" onClick={() => setShowPrayerModal(false)}>취소</Btn>
          <Btn onClick={savePrayer}>저장</Btn>
        </div>
      }>
        <FormField label="성도 선택"><FSelect value={pMember} onChange={setPMember}><option value="">-- 선택 --</option>{(db.members ?? []).map(m => <option key={m.id} value={m.id}>{m.name} ({m.role}·{m.group})</option>)}</FSelect></FormField>
        <FormField label="기도제목"><FTextarea value={pText} onChange={setPText} placeholder="기도제목을 입력하세요" style={{ minHeight: 80 }} /></FormField>
        <FormField label="분류"><FSelect value={pCategory} onChange={v => setPCategory(v as PrayerCategory)}>{Object.entries(PRAYER_CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</FSelect></FormField>
        <FormField label="날짜"><CalendarDropdown value={pDate} onChange={setPDate} /></FormField>
      </Modal>

      {/* Memo Modal */}
      <Modal open={showMemoModal} onClose={() => { setShowMemoModal(false); if (detailMemberId) setTimeout(() => setShowMemberDetailModal(true), 200); }} title={<span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><Icons.Memo /> 메모 추가</span>} footer={
        <div style={{ display: "flex", gap: 10, width: "100%", justifyContent: "flex-end" }}>
          <Btn variant="secondary" onClick={() => { setShowMemoModal(false); if (detailMemberId) setTimeout(() => setShowMemberDetailModal(true), 200); }}>취소</Btn>
          <Btn onClick={saveMemo}>저장</Btn>
        </div>
      }>
        <FormField label="성도">{detailMemberId ? <div style={{ padding: "10px 14px", background: C.bg, borderRadius: 8, fontSize: 14 }}>{getMember(detailMemberId).name}</div> : <FSelect value={mMemberId} onChange={setMMemberId}><option value="">-- 선택 --</option>{(db.members ?? []).map(m => <option key={m.id} value={m.id}>{m.name} ({m.role}·{m.group})</option>)}</FSelect>}</FormField>
        <FormField label="메모 내용"><FTextarea value={mText} onChange={setMText} placeholder="행정 메모, 구역 배정, 멘토 연결 등" style={{ minHeight: 100 }} /></FormField>
        <FormField label="분류"><FSelect value={mCategory} onChange={v => setMCategory(v as MemoCategory)}>{Object.entries(MEMO_CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</FSelect></FormField>
        <FormField label="날짜"><CalendarDropdown value={mDate} onChange={setMDate} /></FormField>
      </Modal>

      {/* Toasts */}
      <div style={{ position: "fixed", top: mob ? 8 : 20, right: mob ? 8 : 20, left: mob ? 8 : "auto", zIndex: 2000, display: "flex", flexDirection: "column", gap: 8 }}>
        {toasts.map(t => (
          <div key={t.id} style={{ background: C.green, color: "#fff", padding: "12px 20px", borderRadius: 12, fontSize: 13, fontWeight: 600, boxShadow: "0 8px 30px rgba(0,0,0,0.12)", display: "flex", alignItems: "center", gap: 8 }}>✓ {t.msg}</div>
        ))}
      </div>

      <style>{`@keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}`}</style>
    </div>
  );
}
