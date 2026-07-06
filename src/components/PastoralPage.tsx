"use client";

import React, { useState, useMemo, useEffect, useCallback, useRef, type CSSProperties, type ReactNode } from "react";
import type { DB, Member, Note, AttStatus, NewFamilyProgram, Attendance } from "@/types/db";
import { saveDBToSupabase, getWeekNum, getSundayForWeekNum } from "@/lib/store";
import { supabase, deleteMemberPhotoFromStorage } from "@/lib/supabase";
import { getChurchId } from "@/lib/tenant";
import { useAuth } from "@/contexts/AuthContext";
import { useAppData, type RawAttendanceRow } from "@/contexts/AppDataContext";
import { toMember } from "@/lib/supabase-db";
import { compressImage } from "@/utils/imageCompressor";
import {
  getMemberPhotoForSave,
  isEphemeralMemberPhotoUrl,
} from "@/lib/member-photo";
import { MemberPhoto } from "@/components/common/MemberPhoto";
import { LayoutDashboard, Users, ClipboardList, Sprout, Sparkles, FileText, Settings, Church, Heart, Home, Gift, TrendingUp, BookOpenCheck, ArrowUpRight, Plus } from "lucide-react";
import { PrayingHandsIcon } from "@/components/icons/PrayingHandsIcon";
import { CeremonyBoard } from "@/components/ceremony";
import { UnifiedPageLayout } from "@/components/layout/UnifiedPageLayout";
import { DASH_CARD, DASH_GLOBAL, DASH_CHART, DASH_MID, DASH_BADGE, DASH_RADIUS, DASH_LAYOUT } from "@/styles/pastoralDashboardTokens";
import { Pagination, PAGINATION_LIST_PARENT_STYLE } from "@/components/common/Pagination";
import { CalendarDropdown } from "@/components/CalendarDropdown";
import { Member360View } from "@/components/members/Member360View";
import { AttendanceDashboard, AttendanceCheck, AbsenteeManagement, AttendanceStatistics } from "@/components/attendance";
import { MonthlyAttendanceBulletin } from "@/components/reports/MonthlyAttendanceBulletin";
import { ReportModal } from "@/components/report/ReportModal";
import { REPORT_DEFS, ReportPreviewModal, type ReportId } from "@/components/report/A4Reports";
import { ModernSelect } from "@/components/common/ModernSelect";
import { ServantSchoolManager } from "@/components/settling/ServantSchoolManager";
import { QuickNoteModal, type QuickNoteItem } from "@/components/common/QuickNoteModal";
import { PcModalShell } from "@/components/common/PcModalShell";
import SegmentedControl from "@/components/common/SegmentedControl";
import { tokens } from "@/styles/tokens";
import { useShellNav } from "@/contexts/ShellNavContext";

const MOB_PANEL_MIN_H = tokens.layout.mobPastoralPanelMinHeight;

/* ---------- useIsMobile ---------- */
function useIsMobile(bp = 768) {
  const [m, setM] = useState(false);
  useEffect(() => { const c = () => setM(window.innerWidth <= bp); c(); window.addEventListener("resize", c); return () => window.removeEventListener("resize", c); }, [bp]);
  return m;
}

/* ============================================================
   교역자 슈퍼플래너 — 목양노트
   ============================================================ */

/* ---------- Utilities ---------- */
const todayStr = () => new Date().toISOString().slice(0, 10);
const uid = () => Math.random().toString(36).slice(2, 9);
/** UUID v4 (Supabase new_family_program 저장을 위해 항상 UUID 사용) */
const uuid = () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; const v = c === "y" ? (r & 0x3 | 0x8) : r; return v.toString(16); }));

function getDepts(db: DB): string[] {
  return (db.settings.depts || "").split(",").map(d => d.trim()).filter(Boolean);
}

function getMokjangList(db: DB): string[] {
  const fromSettings = (db.settings.mokjangList || "").split(",").map(s => s.trim()).filter(Boolean);
  if (fromSettings.length > 0) return fromSettings;
  const fromMembers = Array.from(new Set(db.members.map(m => m.mokjang ?? m.group).filter(Boolean))) as string[];
  return fromMembers.sort((a, b) => (a || "").localeCompare(b || ""));
}

const STATUS_BADGE: Record<string, string> = {
  "새가족": "accent", "정착중": "teal", "정착": "success",
  "간헐": "warning", "위험": "danger", "휴면": "gray", "졸업/전출": "gray",
};
const MEMBER_STATUS_LIST: (string | null)[] = ["활동", "휴적", "은퇴", "별세", "이적", "제적", "미등록"];
const ROLES_LIST = ["담임목사", "부목사", "전도사", "장로", "안수집사", "권사", "집사", "성도", "청년", "학생"];
const BAPTISM_LIST = ["유아세례", "세례", "입교", "미세례"];
const NOTE_ICON_SIZE = 12;
const NOTE_ICONS: Record<string, ReactNode> = {
  memo: <FileText size={NOTE_ICON_SIZE} strokeWidth={1.5} className="text-gray-400" />,
  prayer: <Heart size={NOTE_ICON_SIZE} strokeWidth={1.5} className="text-gray-400" />,
  visit: <Home size={NOTE_ICON_SIZE} strokeWidth={1.5} className="text-gray-400" />,
  event: <Gift size={NOTE_ICON_SIZE} strokeWidth={1.5} className="text-gray-400" />,
};
const NOTE_LABELS: Record<string, string> = { memo: "메모", prayer: "기도", visit: "심방", event: "경조사" };
/** 기도 추가 모달에서 "전체" 대상일 때 저장하는 notes 키 */
const NOTE_TARGET_CHURCH = "__church__";

/* ---------- Colors (unified app palette) ---------- */
const C = {
  primary: "var(--color-primary)",
  primaryHover: "var(--color-primary-hover)",
  primaryLight: "var(--color-primary-soft)",
  primaryLighter: "var(--color-primary-soft)",
  text: "var(--color-text)",
  textSub: "var(--color-text-muted)",
  textFaint: "var(--color-text-faint)",
  bg: "var(--color-surface-muted)",
  card: "var(--color-surface)",
  border: "var(--color-border)",
  borderLight: "var(--color-border-soft)",
  success: "var(--color-success)",
  successLight: "color-mix(in srgb, var(--color-success) 12%, transparent)",
  danger: "var(--color-danger)",
  dangerLight: "color-mix(in srgb, var(--color-danger) 12%, transparent)",
  warning: "var(--color-warning)",
  warningLight: "color-mix(in srgb, var(--color-warning) 15%, transparent)",
  warningText: "var(--color-warning)",
  purple: "#7c5ce0",
  purpleLight: "color-mix(in srgb, #7c5ce0 12%, transparent)",
  accent: "var(--color-primary)",
  accentLight: "var(--color-primary-soft)",
  navy: "var(--color-text)",
  navyLight: "var(--color-primary-hover)",
  white: "var(--color-surface)",
  shadow: "0 1px 4px rgba(0,0,0,0.06)",
  shadowHover: "0 4px 12px rgba(0,0,0,0.08)",
  shadowMd: "0 4px 16px rgba(0,0,0,0.06)",
  badgeBlueBg: "var(--color-primary-soft)",
  badgeGreenBg: "color-mix(in srgb, var(--color-success) 12%, transparent)",
  badgeRedBg: "color-mix(in srgb, var(--color-danger) 12%, transparent)",
  badgePurpleBg: "color-mix(in srgb, #7c5ce0 12%, transparent)",
  textMuted: "var(--color-text-muted)",
  blue: "var(--color-primary)",
  blueBg: "var(--color-primary-soft)",
  accentBg: "var(--color-primary-soft)",
  successBg: "color-mix(in srgb, var(--color-success) 12%, transparent)",
  dangerBg: "color-mix(in srgb, var(--color-danger) 12%, transparent)",
  warningBg: "color-mix(in srgb, var(--color-warning) 15%, transparent)",
  purpleBg: "#f3f0ff",
  grayBadgeMuted: "rgba(74,80,104,0.12)",
  teal: "#0d9488",
  tealBg: "color-mix(in srgb, #0d9488 12%, transparent)",
  pink: "#db2777",
  pinkBg: "color-mix(in srgb, #db2777 12%, transparent)",
  orange: "#ea580c",
} as const;

const badgeBg: Record<string, [string, string]> = {
  accent: [C.accent, C.accentBg], teal: [C.teal, C.tealBg], success: [C.success, C.successBg],
  warning: [C.warningText, C.warningBg], danger: [C.danger, C.dangerBg], gray: [C.textMuted, C.grayBadgeMuted],
  purple: [C.purple, C.purpleBg], pink: [C.pink, C.pinkBg],
};

/* ---------- Icons ---------- */
const iconStyle = { strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
const Icons = {
  Search: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" {...iconStyle}><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>,
  Plus: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>,
  X: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" {...iconStyle}><path d="M18 6L6 18M6 6l12 12"/></svg>,
  Export: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" {...iconStyle}><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>,
  Church: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 2v4M10 6h4M8 6v4l-5 3v9h18v-9l-5-3V6"/><rect x="10" y="16" width="4" height="6"/></svg>,
  Camera: () => <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>,
  Table: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" {...iconStyle}><rect x="3" y="3" width="18" height="18" rx="1"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/></svg>,
  Card: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" {...iconStyle}><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>,
  Mokjang: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" {...iconStyle}><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>,
  Printer: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" {...iconStyle}><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/></svg>,
  Trash2: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" {...iconStyle}><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>,
  New: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" {...iconStyle}><path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z"/></svg>,
  Clipboard: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" {...iconStyle}><path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/><path d="M8 12h8M8 16h8"/></svg>,
  Graduation: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" {...iconStyle}><path d="M22 10v6M2 10l10 5 10-5-10-5z"/><path d="M6 12v5c0 2 2 3 6 3s6-1 6-3v-5"/></svg>,
  Alert: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" {...iconStyle}><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>,
};

/* ---------- Shared UI ---------- */
function Card({ children, style, onClick }: { children: ReactNode; style?: CSSProperties; onClick?: () => void }) {
  const mob = useIsMobile();
  return (
    <div
      onClick={onClick}
      style={{
        background: C.card,
        borderRadius: mob ? 8 : 12,
        border: `1px solid ${C.border}`,
        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
        padding: mob ? "10px 12px" : 24,
        transition: "all 0.2s",
        cursor: onClick ? "pointer" : "default",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function SBadge({ children, variant = "gray", style }: { children: ReactNode; variant?: string; style?: CSSProperties }) {
  const mob = useIsMobile();
  const [color, bg] = badgeBg[variant] || badgeBg.gray;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: mob ? 2 : 4,
        padding: mob ? "2px 8px" : "4px 12px",
        borderRadius: 20,
        fontSize: mob ? 10 : 12,
        fontWeight: 600,
        color,
        background: bg,
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {children}
    </span>
  );
}

function Btn({
  children,
  onClick,
  variant = "primary",
  size = "md",
  icon,
  style: s,
  disabled,
}: {
  children?: ReactNode;
  onClick?: (e?: React.MouseEvent) => void;
  variant?: string;
  size?: string;
  icon?: ReactNode;
  style?: CSSProperties;
  disabled?: boolean;
}) {
  const mob = useIsMobile();
  const base: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: mob ? 4 : 6,
    border: "none",
    borderRadius: mob ? 6 : 10,
    cursor: disabled ? "not-allowed" : "pointer",
    fontWeight: 600,
    fontFamily: "inherit",
    transition: "all 0.15s",
    fontSize: mob ? (size === "sm" ? 10 : 11) : size === "sm" ? 13 : 14,
    padding: mob ? (size === "sm" ? "4px 8px" : "6px 12px") : size === "sm" ? "6px 14px" : "10px 20px",
    opacity: disabled ? 0.6 : 1,
  };
  const v: Record<string, CSSProperties> = {
    primary: { background: C.primary, color: "var(--color-primary-on)" },
    accent: { background: C.accent, color: "var(--color-primary-on)" },
    success: { background: C.success, color: "var(--color-primary-on)" },
    danger: { background: C.danger, color: "var(--color-primary-on)" },
    ghost: { background: "transparent", color: C.primary, border: `1px solid ${C.border}` },
    soft: { background: C.accentBg, color: C.accent },
  };
  return (
    <button type="button" disabled={disabled} onClick={disabled ? undefined : onClick} style={{ ...base, ...(v[variant] || v.primary), ...s }}>
      {icon}
      {children}
    </button>
  );
}

function FormInput({ label, ...props }: { label?: string; [k: string]: unknown }) {
  const mob = useIsMobile();
  return (
    <div style={{ marginBottom: mob ? 10 : 16 }}>
      {label && (
        <label style={{ display: "block", fontSize: mob ? 11 : 13, fontWeight: 600, color: C.text, marginBottom: mob ? 4 : 6 }}>{label}</label>
      )}
      <input
        {...(props as React.InputHTMLAttributes<HTMLInputElement>)}
        style={{
          width: "100%",
          padding: mob ? "6px 10px" : "10px 14px",
          borderRadius: mob ? 6 : 10,
          border: `1px solid ${C.border}`,
          fontSize: mob ? 12 : 14,
          fontFamily: "inherit",
          color: C.text,
          background: C.card,
          outline: "none",
          height: mob ? 32 : undefined,
          boxSizing: "border-box",
          ...(props.style as CSSProperties | undefined),
        }}
      />
    </div>
  );
}

function FormSelect({ label, options, ...props }: { label?: string; options: { value: string; label: string }[]; [k: string]: unknown }) {
  const p = props as React.SelectHTMLAttributes<HTMLSelectElement> & { style?: CSSProperties };
  const value = String(p.value ?? "");
  return (
    <ModernSelect
      label={label}
      options={options}
      value={value}
      onChange={(v) => p.onChange?.({ target: { value: v } } as React.ChangeEvent<HTMLSelectElement>)}
      disabled={p.disabled}
      id={p.id}
      style={p.style}
    />
  );
}

function FormTextarea({ label, ...props }: { label?: string; [k: string]: unknown }) {
  return (
    <div style={{ marginBottom: 16 }}>
      {label && <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 6 }}>{label}</label>}
      <textarea {...(props as React.TextareaHTMLAttributes<HTMLTextAreaElement>)} style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 14, fontFamily: "inherit", color: C.text, background: C.card, outline: "none", resize: "vertical", minHeight: 72, ...(props.style as CSSProperties || {}) }} />
    </div>
  );
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

const WHEEL_ITEM_HEIGHT = 44;
const WHEEL_VISIBLE_COUNT = 5;

function WheelColumn({ items, selected, onChange, format }: { items: number[]; selected: number; onChange: (value: number) => void; format: (n: number) => string }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const skipScrollSyncRef = useRef(false);
  const selectedIndex = Math.max(0, Math.min(items.length - 1, items.indexOf(selected)));

  // 선택값이 바뀌면 스크롤 위치 맞추기 (예: 월 바꿀 때 일 컬럼)
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || skipScrollSyncRef.current) return;
    el.scrollTop = selectedIndex * WHEEL_ITEM_HEIGHT;
  }, [selectedIndex, items.length]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const index = Math.round(el.scrollTop / WHEEL_ITEM_HEIGHT);
    const clamped = Math.max(0, Math.min(items.length - 1, index));
    const value = items[clamped];
    if (value !== undefined && value !== selected) {
      skipScrollSyncRef.current = true;
      onChange(value);
      setTimeout(() => { skipScrollSyncRef.current = false; }, 50);
    }
  }, [items, selected, onChange]);

  return (
    <div style={{ width: "33.33%", height: WHEEL_ITEM_HEIGHT * WHEEL_VISIBLE_COUNT, position: "relative" }}>
      <div
        ref={scrollRef}
        className="wheel-column-scroll"
        style={{
          height: "100%",
          overflowY: "auto",
          overflowX: "hidden",
          scrollSnapType: "y mandatory",
          WebkitOverflowScrolling: "touch",
          scrollbarWidth: "none",
          msOverflowStyle: "none",
        }}
        onScroll={handleScroll}
      >
        <div style={{ height: WHEEL_ITEM_HEIGHT * 2 }} />
        {items.map((item) => (
          <div
            key={item}
            style={{
              height: WHEEL_ITEM_HEIGHT,
              scrollSnapAlign: "center",
              scrollSnapStop: "always",
              lineHeight: `${WHEEL_ITEM_HEIGHT}px`,
              textAlign: "center",
              fontSize: item === selected ? 20 : 16,
              fontWeight: item === selected ? 700 : 400,
              color: item === selected ? "#111" : "#9ca3af",
            }}
          >
            {format(item)}
          </div>
        ))}
        <div style={{ height: WHEEL_ITEM_HEIGHT * 2 }} />
      </div>
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: 0,
          right: 0,
          height: WHEEL_ITEM_HEIGHT,
          transform: "translateY(-50%)",
          borderTop: `1px solid ${C.border}`,
          borderBottom: `1px solid ${C.border}`,
          background: "rgba(59,130,246,0.06)",
          pointerEvents: "none",
          zIndex: 1,
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "linear-gradient(to bottom, rgba(255,255,255,0.9) 0%, transparent 30%, transparent 70%, rgba(255,255,255,0.9) 100%)",
          pointerEvents: "none",
          zIndex: 2,
        }}
      />
    </div>
  );
}

function DateWheelPicker({ value, onChange, onConfirm }: { value: string; onChange: (v: string) => void; onConfirm: () => void }) {
  const parse = (v: string) => {
    const match = v && /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
    if (match) return { y: parseInt(match[1], 10), m: parseInt(match[2], 10), d: parseInt(match[3], 10) };
    return { y: 2000, m: 1, d: 1 };
  };
  const pad = (n: number) => String(n).padStart(2, "0");
  const toStr = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;

  const parsed = parse(value);
  const [year, setYear] = useState(parsed.y);
  const [month, setMonth] = useState(parsed.m);
  const [day, setDay] = useState(parsed.d);
  const years = useMemo(() => Array.from({ length: 2025 - 1940 + 1 }, (_, i) => 1940 + i), []);
  const months = useMemo(() => Array.from({ length: 12 }, (_, i) => i + 1), []);
  const daysInCur = useMemo(() => getDaysInMonth(year, month), [year, month]);
  const days = useMemo(() => Array.from({ length: daysInCur }, (_, i) => i + 1), [daysInCur]);

  useEffect(() => {
    const { y, m, d } = parse(value);
    setYear(y);
    setMonth(m);
    setDay(Math.min(d, getDaysInMonth(y, m)));
  }, [value]);

  const handleYearChange = useCallback((v: number) => {
    setYear(v);
    const maxD = getDaysInMonth(v, month);
    setDay((d) => Math.min(d, maxD));
    onChange(toStr(v, month, Math.min(day, maxD)));
  }, [month, day, onChange]);

  const handleMonthChange = useCallback((v: number) => {
    setMonth(v);
    const maxD = getDaysInMonth(year, v);
    setDay((d) => Math.min(d, maxD));
    onChange(toStr(year, v, Math.min(day, maxD)));
  }, [year, day, onChange]);

  const handleDayChange = useCallback((v: number) => {
    setDay(v);
    onChange(toStr(year, month, v));
  }, [year, month, onChange]);

  return (
    <div style={{ background: C.card, borderRadius: 16, overflow: "hidden", position: "relative" }}>
      <div style={{ display: "flex", width: "100%" }}>
        <WheelColumn items={years} selected={year} onChange={handleYearChange} format={(n) => `${n}년`} />
        <WheelColumn items={months} selected={month} onChange={handleMonthChange} format={(n) => `${n}월`} />
        <WheelColumn items={days} selected={Math.min(day, daysInCur)} onChange={handleDayChange} format={(n) => `${n}일`} />
      </div>
      <div style={{ padding: "12px 16px", borderTop: `1px solid ${C.border}` }}>
        <button
          type="button"
          onClick={() => {
            onChange(toStr(year, month, Math.min(day, getDaysInMonth(year, month))));
            onConfirm();
          }}
          style={{ width: "100%", padding: "12px", background: C.primary, color: "var(--color-primary-on)", border: "none", borderRadius: 12, fontSize: 15, fontWeight: 600, cursor: "pointer" }}
        >
          확인
        </button>
      </div>
    </div>
  );
}

function Modal({ open, onClose, title, children, width = 540, hideScrollbar, ariaLabel }: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  width?: number;
  hideScrollbar?: boolean;
  ariaLabel?: string;
}) {
  return (
    <PcModalShell
      open={open}
      onClose={onClose}
      title={title}
      ariaLabel={ariaLabel}
      maxWidth={width}
      bodyClassName={hideScrollbar ? "scrollbar-hide" : undefined}
    >
      {children}
    </PcModalShell>
  );
}

function StatCard({ label, value, sub, color = C.accent, compact, dense }: { label: string; value: string; sub?: string; color?: string; compact?: boolean; dense?: boolean }) {
  const pad = dense ? "8px 10px" : compact ? "10px 14px" : "16px 20px";
  const labelSz = dense ? 10 : compact ? 11 : 11;
  const valueSz = dense ? 18 : compact ? 22 : 28;
  const subSz = dense ? 9 : compact ? 10 : 12;
  return (
    <Card
      style={{
        display: "flex",
        flexDirection: "column",
        gap: dense ? 2 : 4,
        padding: pad,
        borderRadius: 16,
        border: `1px solid ${C.border}`,
        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
        minHeight: dense ? 52 : compact ? 64 : 80,
      }}
    >
      <div style={{ fontSize: labelSz, color: C.textFaint, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>{label}</div>
      <div style={{ fontSize: valueSz, fontWeight: 800, color: C.text, letterSpacing: "-0.5px", lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: subSz, color: C.textFaint }}>{sub}</div>}
    </Card>
  );
}

function AttDot({ status, onClick, small }: { status: string; onClick: () => void; small?: boolean }) {
  const colors: Record<string, string> = { p: C.success, a: C.danger, n: C.border };
  const s = status === "l" ? "n" : status;
  const sz = small ? 11 : 14;
  return <div onClick={e => { e.stopPropagation(); onClick(); }} style={{ width: sz, height: sz, borderRadius: "50%", background: colors[s] || C.border, cursor: "pointer", transition: "transform 0.15s", border: `2px solid ${(colors[s] || C.border)}30`, flexShrink: 0 }} title={s === "p" ? "출석" : s === "a" ? "결석" : "미체크"} />;
}

function fmtNoteDate(s: string) {
  if (!s) return "";
  const d = new Date(s);
  const now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / (24 * 60 * 60 * 1000));
  if (diff === 0) return "오늘";
  if (diff === 1) return "어제";
  if (diff < 7) return `${diff}일 전`;
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

function NoteCard({ n, mbrName, mbrDept, onClick, answered, onToggleAnswered }: { n: Note; mbrName?: string; mbrDept?: string; onClick?: () => void; answered?: boolean; onToggleAnswered?: () => void }) {
  const mob = useIsMobile();
  const [hover, setHover] = useState(false);
  const isPrayer = n.type === "prayer";
  const badgeFs = mob ? 9 : 11;
  const badgePad = mob ? "1px 6px" : "2px 8px";
  const typeFs = mob ? 10 : 12;
  const typePad = mob ? "3px 8px" : "4px 10px";
  const iconSm = mob ? 13 : 16;
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: C.card,
        borderRadius: 16,
        border: `1px solid ${C.border}`,
        boxShadow: hover ? "0 4px 12px rgba(0,0,0,0.08)" : "0 1px 3px rgba(0,0,0,0.04)",
        padding: mob ? "10px 12px" : "16px 20px",
        marginBottom: mob ? 6 : 12,
        cursor: onClick ? "pointer" : "default",
        transition: "box-shadow 0.2s ease, transform 0.2s ease",
        transform: hover ? "translateY(-1px)" : "none",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: mob ? 8 : 12,
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: mob ? 6 : 8, flexWrap: "wrap" }}>
          {mbrName != null && mbrName !== "" ? (
            <span style={{ fontSize: mob ? 13 : 16, fontWeight: 700, color: C.text }}>{mbrName}</span>
          ) : (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: mob ? 12 : 14, fontWeight: 600, color: C.textFaint }}>
              {n.type === "prayer" ? <Heart size={iconSm} strokeWidth={1.5} style={{ flexShrink: 0, color: C.textFaint }} /> : <FileText size={iconSm} strokeWidth={1.5} style={{ flexShrink: 0, color: C.textFaint }} />}
              {NOTE_LABELS[n.type] || "메모"}
            </span>
          )}
          {mbrDept && (
            <span style={{ display: "inline-flex", alignItems: "center", padding: badgePad, borderRadius: 9999, fontSize: badgeFs, fontWeight: 600, background: C.accentBg, color: C.accent }}>
              {mbrDept}
            </span>
          )}
        </div>
        <span style={{ fontSize: mob ? 10 : 13, color: C.textFaint }}>{fmtNoteDate(n.date)}</span>
      </div>
      <div
        style={{
          fontSize: mob ? 12 : 14,
          lineHeight: mob ? 1.4 : 1.6,
          color: C.text,
          textDecoration: answered ? "line-through" : undefined,
          opacity: answered ? 0.85 : 1,
          display: "-webkit-box",
          WebkitLineClamp: 3,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
      >
        {n.content}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          gap: mob ? 6 : 8,
          marginTop: mob ? 8 : 12,
          opacity: hover ? 1 : 0.85,
          transition: "opacity 0.2s",
        }}
      >
        {isPrayer && onToggleAnswered && (
          <button
            type="button"
            onClick={e => { e.stopPropagation(); onToggleAnswered(); }}
            style={{
              padding: typePad,
              fontSize: typeFs,
              border: "none",
              borderRadius: 9999,
              cursor: "pointer",
              fontWeight: 500,
              background: "transparent",
              color: C.textMuted,
            }}
          >
            {answered ? "✓ 응답됨" : "응답체크 표시"}
          </button>
        )}
        {isPrayer && (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: badgePad,
              borderRadius: 9999,
              fontSize: typeFs,
              fontWeight: 500,
              background: C.accentBg,
              color: C.accent,
            }}
          >
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>{NOTE_ICONS[n.type] ?? <FileText size={mob ? 10 : NOTE_ICON_SIZE} />} {NOTE_LABELS[n.type] || "메모"}</span>
          </span>
        )}
        {!isPrayer && (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: badgePad,
              borderRadius: 9999,
              fontSize: typeFs,
              fontWeight: 500,
              background: badgeBg[n.type === "visit" ? "teal" : n.type === "event" ? "pink" : "gray"]?.[1] ?? "rgba(107,123,158,0.1)",
              color: badgeBg[n.type === "visit" ? "teal" : n.type === "event" ? "pink" : "gray"]?.[0] ?? C.textMuted,
            }}
          >
            {NOTE_ICONS[n.type] ?? <FileText size={mob ? 10 : NOTE_ICON_SIZE} />} {NOTE_LABELS[n.type] || "메모"}
          </span>
        )}
      </div>
    </div>
  );
}

function DetailRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "10px 14px", background: C.bg, borderRadius: 8, marginBottom: 6 }}>
      <span style={{ fontSize: 17, flexShrink: 0, marginTop: 1 }}>{icon}</span>
      <div><div style={{ fontSize: 11, color: C.textMuted, fontWeight: 500 }}>{label}</div><div style={{ fontSize: 14, color: C.text, marginTop: 1 }}>{value}</div></div>
    </div>
  );
}

/* ---------- CSV helper ---------- */
function csvRow(arr: (string | number)[]) { return arr.map(c => `"${String(c || "").replace(/"/g, '""')}"`).join(","); }
function parseCSVToRows(csv: string): string[][] {
  const rows: string[][] = [];
  const lines = csv.split(/\r?\n/).filter(Boolean);
  for (const line of lines) {
    const cells: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"') {
          if (line[i + 1] === '"') { cur += '"'; i++; }
          else inQuotes = false;
        } else cur += ch;
      } else {
        if (ch === '"') inQuotes = true;
        else if (ch === ",") { cells.push(cur.trim()); cur = ""; }
        else cur += ch;
      }
    }
    cells.push(cur.trim());
    rows.push(cells);
  }
  return rows;
}
function dlCSV(csv: string, name: string) {
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; a.click();
}

/* ---------- Photo compress ---------- */
function compressPhoto(src: string, cb: (r: string) => void) {
  if (typeof window === "undefined") return;
  const img = new Image();
  img.onload = () => {
    const c = document.createElement("canvas");
    let w = img.width, h = img.height;
    if (w > 300) { h = (300 / w) * h; w = 300; }
    c.width = w; c.height = h;
    c.getContext("2d")?.drawImage(img, 0, 0, w, h);
    cb(c.toDataURL("image/jpeg", 0.7));
  };
  img.src = src;
}

/* ============================================================
   SUB-PAGES
   ============================================================ */

/* ====== Dashboard ====== */
type AttChartView = "year" | "month" | "week";

type PastoralFeedItem = {
  id: string;
  kind: "note" | "newcomer" | "prayer";
  icon: "memo" | "prayer" | "visit" | "event" | "newcomer";
  title: string;
  body: string;
  timestamp: string;
  memberName?: string;
};

function DashboardSub({ db, currentWeek, rawAttendance, onNavSub }: { db: DB; currentWeek: number; rawAttendance: RawAttendanceRow[]; onNavSub?: (id: SubPage) => void }) {
  const mob = useIsMobile();
  const shellNav = useShellNav();
  const periodSegmentItems = useMemo(
    () => [
      { id: "week", label: "W" },
      { id: "month", label: "M" },
      { id: "year", label: "Y" },
    ],
    [],
  );
  const currentYear = new Date().getFullYear();
  const attChartYearOptions = useMemo(() => Array.from({ length: 6 }, (_, i) => currentYear - i), [currentYear]);
  const [attChartView, setAttChartView] = useState<AttChartView>("month");
  const [attChartYear, setAttChartYear] = useState(currentYear);
  const statsCardRef = useRef<HTMLDivElement>(null);
  const [statsCardHeight, setStatsCardHeight] = useState<number | null>(null);

  const m = db.members.filter(x => x.status !== "졸업/전출");
  const total = m.length;
  const attInPerson = m.filter(s => (db.attendance[s.id] || {})[currentWeek] === "p").length;
  const attOnline = m.filter(s => (db.attendance[s.id] || {})[currentWeek] === "o").length;
  const attTotal = attInPerson + attOnline;
  const newF = m.filter(s => s.is_new_family === true).length;
  const risk = m.filter(s => s.status === "위험" || s.status === "휴면").length;
  const prayers = m.filter(s => s.prayer && s.prayer.trim()).length;
  const rate = total > 0 ? Math.round(attTotal / total * 100) : 0;
  /** 활동/비활동 (전체 성도 카드) — status "활동" 만 활성 */
  const activeCount = m.filter(s => s.status === "활동").length;
  const inactiveCount = total - activeCount;
  /** 금주 출석률 bar: 항상 20개, %비례 채움 (round) */
  const ATT_BAR_COUNT = 20;
  const attFilledBars = Math.round((rate / 100) * ATT_BAR_COUNT);
  /** 전체 성도 원: 항상 100개(10x10), 활성 비율 채움 (round) */
  const MEMBER_DOT_COUNT = 100;
  const memberFilledDots = total > 0 ? Math.round((activeCount / total) * MEMBER_DOT_COUNT) : 0;

  const weeklyAtt = useMemo(() => {
    const data = new Array(52).fill(0);
    rawAttendance.filter(r => r.year === attChartYear).forEach(r => {
      const wn = r.week_num ?? 0;
      if ((r.status === "p" || r.status === "o") && wn >= 1 && wn <= 52) {
        data[wn - 1]++;
      }
    });
    return data;
  }, [rawAttendance, attChartYear]);

  const currentMonthIdx = new Date().getMonth();
  const isCurrentYearSel = attChartYear === currentYear;

  /** 주별(W): 최근 5주, 각 주 present/total·%, 현재 주 주황 하이라이트 */
  const weekly5 = useMemo(() => {
    const start = Math.max(1, Math.min(currentWeek - 4, 48));
    const weeks: { wk: number; label: string; present: number; total: number; rate: number; isCurrent: boolean }[] = [];
    for (let wk = start; wk <= start + 4; wk++) {
      const present = weeklyAtt[wk - 1] ?? 0;
      const d = new Date(attChartYear, 0, 1 + (wk - 1) * 7);
      const wom = Math.ceil(d.getDate() / 7);
      weeks.push({
        wk,
        label: `${d.getMonth() + 1}월 ${wom}주차`,
        present,
        total,
        rate: total > 0 ? Math.round((present / total) * 100) : 0,
        isCurrent: isCurrentYearSel && wk === currentWeek,
      });
    }
    return weeks;
  }, [weeklyAtt, currentWeek, total, attChartYear, isCurrentYearSel]);

  /** 월별(M): 12개월 평균 출석 명수(주 단위 평균), 현재 월 주황 하이라이트 */
  const monthlyAvg = useMemo(() => {
    const sum = new Array(12).fill(0);
    const svc: Set<number>[] = new Array(12).fill(0).map(() => new Set<number>());
    rawAttendance.filter(r => r.year === attChartYear).forEach(r => {
      if (r.status !== "p" && r.status !== "o") return;
      const mn = r.date ? new Date(r.date).getMonth() : Math.min(11, Math.floor(((r.week_num ?? 1) - 1) / 4.33));
      if (mn < 0 || mn > 11) return;
      sum[mn]++;
      svc[mn].add(r.week_num ?? (r.date ? new Date(r.date).getTime() : mn));
    });
    return sum.map((s, i) => ({
      avg: svc[i].size > 0 ? Math.round(s / svc[i].size) : 0,
      isCurrent: isCurrentYearSel && i === currentMonthIdx,
    }));
  }, [rawAttendance, attChartYear, isCurrentYearSel, currentMonthIdx]);

  /** 연간(Y): 최근 3년, 연 평균 출석/총원 %, 최신 연도 주황 하이라이트 */
  const yearly3 = useMemo(() => {
    const years = [currentYear - 2, currentYear - 1, currentYear];
    return years.map(y => {
      const rows = rawAttendance.filter(r => r.year === y && (r.status === "p" || r.status === "o"));
      const weeks = new Set<number>();
      rows.forEach(r => weeks.add(r.week_num ?? 0));
      const present = weeks.size > 0 ? Math.round(rows.length / weeks.size) : 0;
      return {
        year: y,
        present,
        total,
        rate: total > 0 ? Math.round((present / total) * 100) : 0,
        isCurrent: y === currentYear,
      };
    });
  }, [rawAttendance, currentYear, total]);

  const deptCounts = useMemo(() => {
    const r: Record<string, number> = {};
    m.forEach(s => { r[s.dept || ""] = (r[s.dept || ""] || 0) + 1; });
    return Object.entries(r).sort((a, b) => b[1] - a[1]);
  }, [m]);

  useEffect(() => {
    if (mob) {
      setStatsCardHeight(null);
      return;
    }
    const el = statsCardRef.current;
    if (!el) return;

    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        setStatsCardHeight(Math.ceil(el.getBoundingClientRect().height));
      });
    };

    update();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
    ro?.observe(el);
    window.addEventListener("resize", update);

    return () => {
      cancelAnimationFrame(frame);
      ro?.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [mob, attChartView, attChartYear]);

  const recentNotes = useMemo(() => {
    const all: (Note & { mbrName: string; mbrId: string; mbrDept: string })[] = [];
    Object.keys(db.notes).forEach(mid => {
      const mbr = db.members.find(x => x.id === mid);
      const mbrName = mid === NOTE_TARGET_CHURCH ? "교회 전체" : (mbr?.name || "?");
      (db.notes[mid] || []).forEach(n => all.push({ ...n, mbrName, mbrId: mid, mbrDept: mbr?.dept || "" }));
    });
    return all.sort((a, b) => (b.date || "").localeCompare(a.date || "")).slice(0, 6);
  }, [db]);

  const pastoralFeed = useMemo(() => {
    const items: PastoralFeedItem[] = [];

    recentNotes.forEach((n, i) => {
      items.push({
        id: `note-${i}`,
        kind: "note",
        icon: (n.type as "memo" | "prayer" | "visit" | "event") || "memo",
        title: n.mbrName || "이름 없음",
        body: (n as { text?: string }).text || n.content || "",
        timestamp: n.date || n.createdAt || new Date().toISOString(),
        memberName: n.mbrName,
      });
    });

    const newcomers = db.members
      .filter((m) => {
        const status = (m as { status?: string; role?: string }).status || (m as { status?: string; role?: string }).role || "";
        return status === "새가족" || status === "정착중";
      })
      .sort((a, b) => {
        const da = (a as { firstVisitDate?: string; first_visit_date?: string; createdAt?: string; created_at?: string }).firstVisitDate || (a as { first_visit_date?: string }).first_visit_date || (a as { createdAt?: string; created_at?: string }).createdAt || (a as { created_at?: string }).created_at || "";
        const dbb = (b as { firstVisitDate?: string; first_visit_date?: string; createdAt?: string; created_at?: string }).firstVisitDate || (b as { first_visit_date?: string }).first_visit_date || (b as { createdAt?: string; created_at?: string }).createdAt || (b as { created_at?: string }).created_at || "";
        return dbb.localeCompare(da);
      })
      .slice(0, 5);

    newcomers.forEach((m) => {
      const mm = m as { group?: string; mokjang?: string; firstVisitDate?: string; first_visit_date?: string; createdAt?: string; created_at?: string };
      items.push({
        id: `newcomer-${m.id}`,
        kind: "newcomer",
        icon: "newcomer",
        title: `${m.name || "이름 없음"} 새가족 등록`,
        body: mm.group || mm.mokjang || "부서 미지정",
        timestamp: mm.firstVisitDate || mm.first_visit_date || mm.createdAt || mm.created_at || new Date().toISOString(),
        memberName: m.name,
      });
    });

    const withPrayer = db.members
      .filter((m) => (m as { prayer?: string }).prayer && String((m as { prayer?: string }).prayer).trim())
      .sort((a, b) => {
        const da = (a as { updatedAt?: string; updated_at?: string; createdAt?: string; created_at?: string }).updatedAt || (a as { updated_at?: string }).updated_at || (a as { createdAt?: string; created_at?: string }).createdAt || (a as { created_at?: string }).created_at || "";
        const dbb = (b as { updatedAt?: string; updated_at?: string; createdAt?: string; created_at?: string }).updatedAt || (b as { updated_at?: string }).updated_at || (b as { createdAt?: string; created_at?: string }).createdAt || (b as { created_at?: string }).created_at || "";
        return dbb.localeCompare(da);
      })
      .slice(0, 5);

    withPrayer.forEach((m) => {
      const mm = m as { prayer?: string; updatedAt?: string; updated_at?: string; createdAt?: string; created_at?: string };
      const pr = mm.prayer || "";
      items.push({
        id: `prayer-${m.id}`,
        kind: "prayer",
        icon: "prayer",
        title: `${m.name || "이름 없음"}님 기도제목`,
        body: pr.substring(0, 60) + (pr.length > 60 ? "…" : ""),
        timestamp: mm.updatedAt || mm.updated_at || mm.createdAt || mm.created_at || new Date().toISOString(),
        memberName: m.name,
      });
    });

    return items
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      .slice(0, 15);
  }, [recentNotes, db.members]);

  const summaryCards = useMemo(
    () => [
      { label: "전체 성도", value: `${total}명`, sub: "활성 등록", color: C.primary },
      {
        label: "금주 출석률",
        value: `${rate}%`,
        sub: attOnline > 0 ? `${attInPerson}명 출석 · ${attOnline}명 온라인 / 총 ${total}명` : `${attTotal}/${total}명 출석`,
        color: C.purple,
      },
      { label: "새가족", value: `${newF}명`, sub: "정착 진행중", color: C.success },
      { label: "위험/휴면", value: `${risk}명`, sub: "관심 필요", color: C.danger },
      { label: "기도제목", value: `${prayers}건`, sub: "함께 기도합니다", color: C.warning },
    ],
    [total, rate, attOnline, attInPerson, attTotal, newF, risk, prayers],
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: mob ? 12 : DASH_LAYOUT.gridGap }}>
      {mob ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 8,
            width: "100%",
            alignItems: "stretch",
            minWidth: 0,
          }}
        >
          {summaryCards.map((card) => (
            <div
              key={card.label}
              style={{
                background: "var(--color-surface-muted)",
                borderRadius: 10,
                border: `1px solid ${C.border}`,
                padding: "10px 12px",
                minHeight: 60,
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                gap: 3,
                boxSizing: "border-box",
                minWidth: 0,
              }}
            >
              <span style={{ fontSize: 10, color: C.textFaint, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>{card.label}</span>
              <span style={{ fontSize: 20, fontWeight: 800, color: C.text, lineHeight: 1.1 }}>{card.value}</span>
              {card.sub && <span style={{ fontSize: 9, color: C.textFaint }}>{card.sub}</span>}
            </div>
          ))}
        </div>
      ) : (
        (() => {
          const visitCount = recentNotes.filter((n) => n.type === "visit").length;

          const cardBase: CSSProperties = {
            background: DASH_CARD.bg,
            border: "none",
            borderRadius: DASH_RADIUS.card,
            padding: DASH_LAYOUT.topCardPadding,
            boxShadow: DASH_CARD.floatShadow,
            display: "flex",
            flexDirection: "column",
            height: DASH_LAYOUT.topCardHeight,
            boxSizing: "border-box",
            overflow: "hidden",
          };
          const labelStyle: CSSProperties = { fontSize: 15, fontWeight: 600, color: C.text, letterSpacing: "-0.01em" };
          const subStyle: CSSProperties = { fontSize: 12, color: C.textMuted };
          const splitNum = (v: string): [string, string] => {
            const m = v.match(/^([\d,]+)(.*)$/);
            return m ? [m[1], m[2]] : [v, ""];
          };

          // 2행 4카드: 새가족 / 위험·휴면 / 심방 / 기도
          const midCards = [
            { key: "newfamily", label: "새가족", sub: newF > 0 ? "정착 진행 중" : "정착 진행 성도 없음", value: `${newF}명`, has: newF > 0, fill: newF > 0 ? DASH_MID.newFamilyFill : DASH_MID.emptyFill, nav: () => onNavSub?.("newfamily") },
            { key: "risk", label: "위험/휴면", sub: risk > 0 ? "관심 필요" : "관심 필요 성도 없음", value: `${risk}명`, has: risk > 0, fill: DASH_MID.riskFill, nav: () => onNavSub?.("members") },
            { key: "visit", label: "심방", sub: "최근 기록", value: `${visitCount}건`, has: false, fill: DASH_MID.visitFill, nav: () => shellNav?.setCurrentPage("visit") },
            { key: "prayer", label: "기도", sub: prayers > 0 ? "함께 기도합니다" : "함께 기도합니다", value: `${prayers}건`, has: prayers > 0, fill: prayers > 0 ? DASH_MID.prayerFill : DASH_MID.emptyFill, nav: () => onNavSub?.("notes") },
          ];

          return (
            /* 4열 단일 그리드: 1행 카드는 각 2칸(50:50), 2행 카드는 각 1칸 → 세로·가로 갭이 십자로 정확히 맞음 */
            <div
              style={{
                display: "grid",
                gridTemplateColumns: `repeat(${DASH_LAYOUT.gridColumns}, 1fr)`,
                gridAutoRows: "auto",
                alignItems: "start",
                gap: DASH_LAYOUT.gridGap,
                marginTop: 8,
              }}
            >
              {/* 1행 좌: 금주 출석률 (2칸 = 50%) */}
              <div style={{ ...cardBase, gridColumn: "span 2" }}>
                <span style={labelStyle}>금주 출석률</span>
                <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 8 }}>
                  <span style={{ fontSize: 48, fontWeight: 800, color: C.text, letterSpacing: "-0.02em", lineHeight: 1 }}>{rate}%</span>
                  <span style={{ fontSize: 13, color: C.textMuted }}>{attTotal}/{total}명 출석</span>
                </div>
                <div style={{ display: "flex", alignItems: "stretch", gap: 4, height: DASH_LAYOUT.attendanceBarHeight, marginTop: "auto" }}>
                  {Array.from({ length: ATT_BAR_COUNT }).map((_, i) => (
                    <div key={i} style={{ flex: 1, borderRadius: 3, background: i < attFilledBars ? DASH_CHART.attendanceBarFill : DASH_CHART.attendanceBarEmpty }} />
                  ))}
                </div>
              </div>
              {/* 1행 우: 전체 성도 (2칸 = 50%) */}
              <div style={{ ...cardBase, gridColumn: "span 2" }}>
                <span style={labelStyle}>전체 성도</span>
                <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 8 }}>
                  <span style={{ fontSize: 40, fontWeight: 800, color: C.text, letterSpacing: "-0.02em", lineHeight: 1 }}>{total}<span style={{ fontSize: 18, fontWeight: 700 }}>명</span></span>
                  <span style={{ fontSize: 13, color: C.textMuted }}>활동 {activeCount} / 비활동 {inactiveCount}</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: `repeat(${DASH_LAYOUT.memberDotCols}, ${DASH_LAYOUT.memberDotSize}px)`, gridAutoRows: `${DASH_LAYOUT.memberDotSize}px`, columnGap: DASH_LAYOUT.memberDotGap, rowGap: DASH_LAYOUT.memberDotGap, marginTop: "auto", justifyContent: "start" }}>
                  {Array.from({ length: MEMBER_DOT_COUNT }).map((_, i) => (
                    <span key={i} style={{ width: DASH_LAYOUT.memberDotSize, height: DASH_LAYOUT.memberDotSize, borderRadius: "50%", background: i < memberFilledDots ? DASH_CHART.memberDotFill : DASH_CHART.memberDotEmpty }} />
                  ))}
                </div>
              </div>
              {/* 2행: 새가족 / 위험·휴면 / 심방 / 기도 — 각 1칸 */}
              {midCards.map((c) => {
                const [num, suf] = splitNum(c.value);
                return (
                  <div key={c.key} style={{ position: "relative", width: "100%", background: c.fill, border: "none", borderRadius: DASH_RADIUS.mid, boxShadow: DASH_CARD.floatShadow, padding: DASH_LAYOUT.midCardPadding, aspectRatio: DASH_LAYOUT.midCardAspectRatio, boxSizing: "border-box", display: "flex", flexDirection: "column", overflow: "hidden" }}>
                    <div style={{ paddingRight: 28 }}>
                      <div style={labelStyle}>{c.label}</div>
                      <div style={{ ...subStyle, marginTop: 4 }}>{c.sub}</div>
                    </div>
                    <button
                      type="button"
                      aria-label={`${c.label} 바로가기`}
                      onClick={c.nav}
                      style={{ position: "absolute", top: DASH_LAYOUT.midCardArrowInset, right: DASH_LAYOUT.midCardArrowInset, border: "none", background: "transparent", padding: 0, cursor: "pointer", color: "#1a1a1c", lineHeight: 0 }}
                    >
                      <ArrowUpRight size={DASH_LAYOUT.midCardArrowSize} strokeWidth={DASH_LAYOUT.midCardArrowStroke} />
                    </button>
                    <div style={{ marginTop: "auto", alignSelf: "flex-end", display: "flex", alignItems: "baseline" }}>
                      <span style={{ fontSize: 30, fontWeight: 800, color: C.text, letterSpacing: "-0.02em", lineHeight: 1 }}>{num}</span>
                      <span style={{ fontSize: 15, fontWeight: 700, color: C.text, marginLeft: 2 }}>{suf}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()
      )}

      <div
        style={
          mob
            ? { display: "flex", flexDirection: "column", gap: 12 }
            : {
                display: "grid",
                gridTemplateColumns: `${DASH_LAYOUT.bottomLeftFr}fr ${DASH_LAYOUT.bottomRightFr}fr`,
                gap: DASH_LAYOUT.gridGap,
              }
        }
      >
        {/* 출석 통계 — 시안: 현황보고와 같은 행, 부서별 인원은 그 아래(스크롤) */}
        <div ref={statsCardRef} style={{ minWidth: 0, ...(mob ? {} : { gridColumn: 1, gridRow: 1 }) }}>
        <Card style={{ padding: 0, overflow: "visible", minWidth: 0, border: "none", boxShadow: DASH_CARD.floatShadow, borderRadius: DASH_RADIUS.card }}>
          {mob ? (
            <div style={{ padding: "8px 12px", borderBottom: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--color-text)", marginBottom: 8 }}>
                출석 통계
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 12,
                  minWidth: 0,
                }}
              >
                <div style={{ display: "flex", borderRadius: 6, overflow: "hidden", border: `1px solid ${C.border}`, flexShrink: 0 }}>
                  {attChartYearOptions.map((y, i, arr) => {
                    const active = attChartYear === y;
                    return (
                      <button key={y} type="button" onClick={() => setAttChartYear(y)} style={{ height: 28, padding: "0 8px", fontSize: 11, fontWeight: 600, border: "none", borderRight: i < arr.length - 1 ? `1px solid ${C.border}` : undefined, fontFamily: "inherit", cursor: "pointer", boxSizing: "border-box", background: active ? "var(--color-primary)" : "var(--color-surface)", color: active ? "var(--color-primary-on)" : C.textMuted, whiteSpace: "nowrap" }}>
                        {y}년
                      </button>
                    );
                  })}
                </div>
                <div style={{ display: "flex", borderRadius: 6, overflow: "hidden", border: `1px solid ${C.border}`, flexShrink: 0 }}>
                  {periodSegmentItems.map((item, i) => {
                    const active = attChartView === item.id;
                    const isLast = i === periodSegmentItems.length - 1;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setAttChartView(item.id as AttChartView)}
                        style={{
                          height: 28,
                          padding: "0 10px",
                          fontSize: 11,
                          fontWeight: 600,
                          border: "none",
                          borderRight: !isLast ? `1px solid ${C.border}` : undefined,
                          fontFamily: "inherit",
                          cursor: "pointer",
                          boxSizing: "border-box",
                          background: active ? "var(--color-primary)" : "var(--color-surface)",
                          color: active ? "var(--color-primary-on)" : C.textMuted,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, padding: "16px 24px" }}>
              <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: C.text }}>출석 통계</h4>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", position: "relative", zIndex: 1 }}>
                <select value={attChartYear} onChange={e => setAttChartYear(Number(e.target.value))} className="select-modern" style={{ height: 36, minHeight: 36, padding: "8px 36px 8px 12px", width: "auto", minWidth: 80, fontSize: 14, lineHeight: 1.35, boxSizing: "border-box" }}>
                  {attChartYearOptions.map(y => <option key={y} value={y}>{y}년</option>)}
                </select>
                <SegmentedControl
                  items={periodSegmentItems}
                  value={attChartView}
                  onChange={(id) => setAttChartView(id as AttChartView)}
                  size="md"
                />
              </div>
            </div>
          )}
          <div style={{ padding: mob ? "8px 10px" : "16px 20px", height: mob ? tokens.height.mobileChart : DASH_LAYOUT.attendanceChartHeight, minHeight: mob ? tokens.height.mobileChart : DASH_LAYOUT.attendanceChartHeight, boxSizing: "border-box", overflow: mob ? "auto" : "hidden" }}>
            {(() => {
              const emptyMsg = (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: C.textMuted, fontSize: 13 }}>
                  아직 출석 기록이 없습니다.
                </div>
              );

              if (attChartView === "week") {
                const has = weekly5.some(w => w.present > 0);
                if (!has) return emptyMsg;
                const barMax = mob ? 116 : 176;
                const barMin = 52;
                const maxRate = Math.max(...weekly5.map(x => x.rate), 1);
                return (
                  <div style={{ display: "flex", alignItems: "flex-end", gap: mob ? 8 : 16, height: "100%", paddingTop: 8, boxSizing: "border-box" }}>
                    {weekly5.map((w) => {
                      const hot = w.isCurrent;
                      const h = barMin + (w.rate / maxRate) * (barMax - barMin);
                      return (
                        <div key={w.wk} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, minWidth: 0 }}>
                          <div style={{ width: "100%", height: h, borderRadius: "12px 12px 0 0", background: hot ? DASH_CHART.statBarHighlight : DASH_CHART.statBarBase, display: "flex", flexDirection: "column", alignItems: "center", padding: "12px 4px 0", boxSizing: "border-box" }}>
                            <span style={{ fontSize: mob ? 16 : 22, fontWeight: 800, color: hot ? "#fff" : DASH_CHART.statTextGray, letterSpacing: "-0.02em", lineHeight: 1 }}>{w.rate}%</span>
                            <span style={{ fontSize: 11, color: hot ? "rgba(255,255,255,0.9)" : DASH_CHART.statSubGray, marginTop: 3 }}>{w.present}/{w.total}명</span>
                          </div>
                          <span style={{ fontSize: 11, color: hot ? C.text : C.textMuted, fontWeight: hot ? 700 : 500, whiteSpace: "nowrap" }}>{w.label}</span>
                        </div>
                      );
                    })}
                  </div>
                );
              }

              if (attChartView === "month") {
                const MON = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
                const has = monthlyAvg.some(x => x.avg > 0);
                if (!has) return emptyMsg;
                const maxM = Math.max(...monthlyAvg.map(x => x.avg), 1);
                const barMax = mob ? 104 : 159;
                return (
                  <div style={{ display: "flex", alignItems: "flex-end", gap: mob ? 4 : 8, height: "100%", paddingTop: 16, boxSizing: "border-box" }}>
                    {monthlyAvg.map((mm, i) => {
                      const hot = mm.isCurrent;
                      const h = Math.max(4, (mm.avg / maxM) * barMax);
                      return (
                        <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, minWidth: 0, justifyContent: "flex-end" }}>
                          <span style={{ fontSize: 11, color: hot ? DASH_CHART.statBarHighlight : C.textMuted, fontWeight: hot ? 700 : 500 }}>{mm.avg || ""}</span>
                          <div style={{ width: "100%", height: h, minHeight: 4, borderRadius: "6px 6px 0 0", background: hot ? DASH_CHART.statBarHighlight : DASH_CHART.statBarBase }} />
                          <span style={{ fontSize: 10, color: hot ? DASH_CHART.statBarHighlight : C.textMuted, fontWeight: hot ? 700 : 500 }}>{MON[i]}</span>
                        </div>
                      );
                    })}
                  </div>
                );
              }

              const has = yearly3.some(y => y.present > 0);
              if (!has) return emptyMsg;
              const barMax = mob ? 116 : 176;
              const barMin = 56;
              const maxRate = Math.max(...yearly3.map(x => x.rate), 1);
              return (
                <div style={{ display: "flex", alignItems: "flex-end", gap: mob ? 10 : 16, height: "100%", paddingTop: 8, boxSizing: "border-box" }}>
                  {yearly3.map((y) => {
                    const hot = y.isCurrent;
                    const h = barMin + (y.rate / maxRate) * (barMax - barMin);
                    return (
                      <div key={y.year} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, minWidth: 0 }}>
                        <div style={{ width: "100%", height: h, borderRadius: "14px 14px 0 0", background: hot ? DASH_CHART.statBarHighlight : DASH_CHART.statBarBase, display: "flex", flexDirection: "column", alignItems: "center", padding: "14px 4px 0", boxSizing: "border-box" }}>
                          <span style={{ fontSize: mob ? 18 : 26, fontWeight: 800, color: hot ? "#fff" : DASH_CHART.statTextGray, letterSpacing: "-0.02em", lineHeight: 1 }}>{y.rate}%</span>
                          <span style={{ fontSize: 11, color: hot ? "rgba(255,255,255,0.9)" : DASH_CHART.statSubGray, marginTop: 3 }}>{y.present}/{y.total}명</span>
                        </div>
                        <span style={{ fontSize: 12, color: hot ? C.text : C.textMuted, fontWeight: hot ? 700 : 500 }}>{y.year}</span>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </Card>
        </div>

        <div
          style={{
            background: DASH_CARD.bg,
            border: "none",
            borderRadius: DASH_RADIUS.card,
            padding: 24,
            boxShadow: DASH_CARD.floatShadow,
            display: "flex",
            flexDirection: "column",
            ...(mob
              ? { minHeight: 320 }
              : {
                  gridColumn: 2,
                  gridRow: 1,
                  height: statsCardHeight ?? undefined,
                  maxHeight: statsCardHeight ?? undefined,
                  minHeight: 0,
                  overflow: "hidden",
                }),
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: C.text }}>
              현황 보고
            </h4>
            <span style={{ fontSize: 12, color: C.textMuted }}>
              총 {pastoralFeed.length}건
            </span>
          </div>

          <div className="scrollbar-hide" style={{ display: "flex", flexDirection: "column", gap: 0, overflowY: "auto", overflowX: "hidden", flex: 1, minHeight: 0 }}>
            {pastoralFeed.length === 0 ? (
              <div style={{ textAlign: "center", color: C.textMuted, padding: "40px 12px", fontSize: 13, lineHeight: 1.7 }}>
                최근 업데이트된 현황 보고가 없습니다.<br />
                사역 기록이 등록되면 실시간으로 타임라인이 생성됩니다.
              </div>
            ) : (
              pastoralFeed.map((item, idx) => {
                const badge =
                  item.kind === "newcomer" ? DASH_BADGE.newfamily :
                  (item.kind === "prayer" || item.icon === "prayer") ? DASH_BADGE.prayer :
                  item.icon === "visit" ? DASH_BADGE.visit :
                  item.icon === "event" ? DASH_BADGE.ceremony :
                  DASH_BADGE.memo;
                const rawName = item.memberName || item.title || "";
                const name = rawName === "교회 전체" || /님$/.test(rawName) ? rawName : `${rawName}님`;
                return (
                  <div
                    key={item.id}
                    style={{
                      display: "flex",
                      gap: 12,
                      padding: "13px 0",
                      borderBottom: idx < pastoralFeed.length - 1 ? "1px solid var(--color-border-soft)" : "none",
                      alignItems: "center",
                    }}
                  >
                    <span style={{ flexShrink: 0, width: 68, textAlign: "center", fontSize: 11, fontWeight: 600, color: badge.fg, background: badge.bg, borderRadius: 6, padding: "5px 0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {badge.label}
                    </span>
                    <span style={{ flexShrink: 0, width: 64, fontSize: 13, fontWeight: 600, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {name}
                    </span>
                    <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: C.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {item.body}
                    </span>
                    <span style={{ fontSize: 11, color: C.textMuted, flexShrink: 0 }}>
                      {(() => {
                        const d = new Date(item.timestamp);
                        const now = new Date();
                        const diff = (now.getTime() - d.getTime()) / 1000 / 60;
                        if (diff < 60) return `${Math.floor(diff)}분 전`;
                        if (diff < 60 * 24) return `${Math.floor(diff / 60)}시간 전`;
                        if (diff < 60 * 24 * 7) return `${Math.floor(diff / 60 / 24)}일 전`;
                        return d.toISOString().slice(5, 10).replace("-", ".");
                      })()}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div style={{ minWidth: 0, ...(mob ? {} : { gridColumn: 1, gridRow: 2 }) }}>
        <Card style={{ padding: 0, overflow: "hidden", border: "none", boxShadow: DASH_CARD.floatShadow, borderRadius: DASH_RADIUS.card }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: mob ? "12px 16px 4px" : "16px 24px 4px" }}>
            <h4 style={{ margin: 0, fontSize: mob ? 14 : 16, fontWeight: 700, color: C.text }}>부서별 인원</h4>
            <button
              type="button"
              aria-label="성도 관리로 이동"
              onClick={() => onNavSub?.("members")}
              style={{ width: 30, height: 30, borderRadius: 8, border: `1px solid ${C.border}`, background: "var(--color-surface)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: C.text }}
            >
              <Plus size={16} strokeWidth={2} />
            </button>
          </div>
          <div style={{ padding: "20px 24px" }}>
            {deptCounts.length === 0 ? (
              <div style={{ textAlign: "center", color: C.textMuted, padding: "24px 0", fontSize: 13, lineHeight: 1.6 }}>
                등록된 부서가 없습니다.<br />우측 상단의 + 버튼을 눌러 부서를 추가해 주세요.
              </div>
            ) : (
              deptCounts.map(([d, cnt], i) => {
                const maxCnt = deptCounts[0]?.[1] || 1;
                const pct = maxCnt > 0 ? (cnt / maxCnt * 100) : 0;
                const isTop = i === 0;
                return (
                  <div key={d} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: i < deptCounts.length - 1 ? 10 : 0 }}>
                    <div style={{ flex: 1, position: "relative", height: 36, borderRadius: 8, background: DASH_CHART.deptBarOther, overflow: "hidden" }}>
                      <div style={{ position: "absolute", inset: 0, width: `${Math.max(pct, 12)}%`, background: isTop ? DASH_CHART.deptBarTop : DASH_CHART.deptBarOther, borderRadius: 8 }} />
                      <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 13, fontWeight: 600, color: C.text }}>{d}</span>
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 600, color: C.text, minWidth: 44, textAlign: "right" }}>{cnt}명</span>
                  </div>
                );
              })
            )}
          </div>
        </Card>
        </div>
      </div>
    </div>
  );
}

/* ====== Members ====== */
const ROLE_PRIORITY: Record<string, number> = {
  "담임목사": 0,
  "부목사": 1,
  "강도사": 2,
  "전도사": 3,
  "교육전도사": 4,
  "장로": 5,
  "안수집사": 6,
  "권사": 7,
  "집사": 8,
  "교사": 9,
  "부교사": 10,
  "청년": 11,
  "성도": 12,
  "학생": 13,
  "새가족": 14,
  "영아": 15,
};

function MembersSub({ db, setDb, persist, toast, currentWeek, openMemberModal, openDetail, openNoteModal, openQuickNote, churchId }: {
  db: DB; setDb: (fn: (prev: DB) => DB) => void; persist: () => void;
  toast: (m: string, t?: string) => void; currentWeek: number;
  openMemberModal: (id?: string) => void; openDetail: (id: string) => void; openNoteModal: (id: string) => void;
  openQuickNote: (memberId: string, memberName: string, type: "note" | "prayer") => void;
  churchId: string | null;
}) {
  const mob = useIsMobile();
  const tabletOrLess = useIsMobile(1024);
  const listRef = useRef<HTMLDivElement>(null);
  const [searchInput, setSearchInput] = useState("");
  const [searchTerms, setSearchTerms] = useState<string[]>([]);
  const [deptF, setDeptF] = useState("all");
  const [roleF, setRoleF] = useState("all");
  const [mokjangF, setMokjangF] = useState("all");
  const [statusF, setStatusF] = useState("all");
  const [newFamilyOnly, setNewFamilyOnly] = useState(false);
  const [prospectOnly, setProspectOnly] = useState(false);
  const [baptismF, setBaptismF] = useState("all");
  const [viewMode, setViewMode] = useState<"list" | "group">("list");
  const [groupBy, setGroupBy] = useState<"dept" | "mokjang" | "role">("dept");
  const [selectedGroupKey, setSelectedGroupKey] = useState<string | null>(null);
  const [pageGroup, setPageGroup] = useState(1);
  const [pageList, setPageList] = useState(1);
  const PAGE_SIZE_MEM = tabletOrLess ? 10 : 15;
  const depts = getDepts(db);
  const viewModeOptions = useMemo(
    () => [
      { value: "list", label: "테이블 보기" },
      { value: "group", label: "그룹 보기" },
    ],
    []
  );
  const groupByOptions = useMemo(
    () => [
      { value: "dept", label: "부서별" },
      { value: "mokjang", label: "목장별" },
      { value: "role", label: "직분별" },
    ],
    []
  );

  /* 성도 목록: churchId 없으면 쿼리하지 않음. churchId가 준비되면 그때 로드. (setDb는 ref로 넣어 의존성에서 제외해 불필요한 재실행 방지) */
  const setDbRef = useRef(setDb);
  setDbRef.current = setDb;
  useEffect(() => {
    if (!churchId || !supabase) return;
    supabase
      .from("members")
      .select("*")
      .eq("church_id", churchId)
      .order("created_at", { ascending: true })
      .then(({ data, error }: { data: unknown[] | null; error: { message: string; details?: unknown } | null }) => {
        if (error) {
          console.error("[MembersSub] members load error:", error.message, error.details);
          return;
        }
        const members = (data ?? []).map((r) => toMember(r as Record<string, unknown>));
        setDbRef.current((prev) => ({ ...prev, members }));
      });
  }, [churchId]);

  const mokjangList = getMokjangList(db);
  const denom = db.settings.denomination?.trim();
  const isChimrye = !!denom && denom.includes("침례");
  /* 침례교회: 침례·입교만 표시 (DB 값은 '세례' 유지), 미세례·유아세례 제거 */
  const baptismOptions = isChimrye
    ? [{ value: "세례", label: "침례" }, { value: "입교", label: "입교" }]
    : BAPTISM_LIST.map(b => ({ value: b, label: b }));
  const roleFilterOptions = useMemo(() => {
    const baseOrder = ["담임목사", "부목사", "강도사", "전도사", "교육전도사", "장로", "안수집사", "권사", "집사", "교사", "부교사", "성도", "청년", "학생", "새가족"];
    const fromMembers = Array.from(new Set(db.members.map((m) => (m.role || "").trim()).filter(Boolean)));
    const merged = Array.from(new Set([...baseOrder, ...fromMembers]));
    return merged.sort((a, b) => (ROLE_PRIORITY[a] ?? 99) - (ROLE_PRIORITY[b] ?? 99) || a.localeCompare(b, "ko"));
  }, [db.members]);
  const deptSelectOptions = useMemo(
    () => [{ value: "all", label: "부서" }, ...depts.map((d) => ({ value: d, label: d }))],
    [depts]
  );
  const roleSelectOptions = useMemo(
    () => [{ value: "all", label: "직분" }, ...roleFilterOptions.map((r) => ({ value: r, label: r }))],
    [roleFilterOptions]
  );
  const mokjangSelectOptions = useMemo(
    () => [{ value: "all", label: "목장" }, ...mokjangList.map((m) => ({ value: m, label: m }))],
    [mokjangList]
  );

  /* 대시보드와 동일 조건: status !== "졸업/전출" (DashboardSub는 x.status만 사용) */
  const filtered = useMemo(() => {
    let r = db.members.filter(m => (m.member_status ?? m.status) !== "졸업/전출");
    if (searchTerms.length > 0) {
      const cleanTerm = (s: string) => (s ?? "").trim().replace(/[,\uFF0C]+$/g, "").trim();
      const terms = searchTerms
        .map(cleanTerm)
        .filter((t) => {
          if (!t) return false;
          const digits = t.replace(/\D/g, "");
          // 한 글자 한글 검색어는 너무 넓게 매칭되어 오탐이 많으므로 무시
          if (digits.length === 0 && t.length < 2) return false;
          return true;
        });
      const norm = (s: string) => (s ?? "").toLowerCase().replace(/\s+/g, "").replace(/[,\uFF0C.]/g, "");
      r = r.filter((m) => {
        const nameN = norm(m.name || "");
        const phoneN = (m.phone || "").replace(/\D/g, "");
        const addrN = norm(m.address || "");
        const memoN = norm(m.memo || "");
        const prayerN = norm(m.prayer || "");
        return terms.some((t) => {
          const tn = norm(t);
          if (!tn) return false;
          // 1개만 검색할 때는 최대한 "그 사람만" 나오도록: 이름 정확일치 우선, 없으면 부분일치
          if (terms.length === 1) {
            if (nameN === tn) return true;
          }
          const digits = t.replace(/\D/g, "");
          return (
            nameN.includes(tn) ||
            (digits.length > 0 ? phoneN.includes(digits) : false) ||
            addrN.includes(tn) ||
            memoN.includes(tn) ||
            prayerN.includes(tn)
          );
        });
      });
    }
    if (deptF !== "all") r = r.filter(m => m.dept === deptF);
    if (roleF !== "all") r = r.filter(m => m.role === roleF);
    if (mokjangF !== "all") r = r.filter(m => ((m.mokjang ?? m.group) || "") === mokjangF);
    if (statusF !== "all") r = r.filter(m => (m.member_status ?? m.status) === statusF);
    if (newFamilyOnly) r = r.filter(m => m.is_new_family === true);
    if (prospectOnly) r = r.filter(m => m.is_prospect === true);
    if (baptismF !== "all") r = r.filter(m => m.baptism_type === baptismF);
    return r;
  }, [db.members, searchTerms, deptF, roleF, mokjangF, statusF, newFamilyOnly, prospectOnly, baptismF]);

  const addSearchTerm = useCallback(() => {
    const v = searchInput.trim().replace(/[,\uFF0C]+$/g, "").trim();
    if (!v) return;
    const digits = v.replace(/\D/g, "");
    if (digits.length === 0 && v.length < 2) {
      toast("이름은 2글자 이상 입력해 주세요", "warn");
      return;
    }
    setSearchTerms((prev) => {
      const exists = prev.some((x) => x.toLowerCase() === v.toLowerCase());
      const next = exists ? prev : [...prev, v];
      return next;
    });
    setSearchInput("");
    setPageList(1);
    setPageGroup(1);
  }, [searchInput]);

  const removeSearchTerm = useCallback((term: string) => {
    setSearchTerms((prev) => prev.filter((t) => t !== term));
    setPageList(1);
    setPageGroup(1);
  }, []);

  const grouped = useMemo(() => {
    const map: Record<string, Member[]> = {};
    const sortedMembers = [...filtered].sort((a, b) =>
      (ROLE_PRIORITY[a.role || ""] ?? 99) - (ROLE_PRIORITY[b.role || ""] ?? 99) || (a.name || "").localeCompare(b.name || "", "ko")
    );
    sortedMembers.forEach((m) => {
      const key =
        groupBy === "dept"
          ? (m.dept || "미지정")
          : groupBy === "mokjang"
            ? (m.mokjang ?? m.group) || "미배정"
            : (m.role || "미지정");
      if (!map[key]) map[key] = [];
      map[key].push(m);
    });
    for (const arr of Object.values(map)) {
      arr.sort((a, b) => (ROLE_PRIORITY[a.role || ""] ?? 99) - (ROLE_PRIORITY[b.role || ""] ?? 99) || (a.name || "").localeCompare(b.name || "", "ko"));
    }
    const entries = Object.entries(map);
    if (groupBy === "role") {
      return entries.sort(([a], [b]) => (ROLE_PRIORITY[a] ?? 99) - (ROLE_PRIORITY[b] ?? 99) || a.localeCompare(b, "ko"));
    }
    return entries.sort(([a], [b]) => a.localeCompare(b, "ko"));
  }, [filtered, groupBy]);

  const selectedGroupMembers = selectedGroupKey ? (grouped.find(([name]) => name === selectedGroupKey)?.[1] ?? []) : [];
  const totalPagesGroup = Math.max(1, Math.ceil(selectedGroupMembers.length / PAGE_SIZE_MEM));
  const currentPageGroup = Math.min(pageGroup, totalPagesGroup);
  const pageGroupMembers = selectedGroupMembers.slice((currentPageGroup - 1) * PAGE_SIZE_MEM, currentPageGroup * PAGE_SIZE_MEM);

  const totalPagesList = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE_MEM));
  const currentPageList = Math.min(pageList, totalPagesList);
  const pageListMembers = filtered.slice((currentPageList - 1) * PAGE_SIZE_MEM, currentPageList * PAGE_SIZE_MEM);

  useEffect(() => {
    setPageList((p) => Math.min(p, totalPagesList));
    setPageGroup((p) => Math.min(p, totalPagesGroup));
  }, [totalPagesList, totalPagesGroup]);

  const cycleAtt = (id: string) => {
    setDb(prev => {
      const att = { ...prev.attendance };
      if (!att[id]) att[id] = {};
      const raw = att[id][currentWeek];
      const cur: AttStatus = (raw === "p" || raw === "a") ? raw : "n";
      const next = ({ n: "p", p: "a", a: "n" } as Record<string, AttStatus>)[cur] || "n";
      att[id] = { ...att[id], [currentWeek]: next };
      const labels: Record<string, string> = { p: "출석", a: "결석", n: "미기록" };
      toast(labels[next] + "으로 변경", "ok");
      return { ...prev, attendance: att };
    });
    persist();
  };

  const listMobTh = mob ? 10 : 13;
  const listMobCell = mob ? 10 : 13;
  const listMobName = mob ? 11 : 14;
  const listMobRole = mob ? 10 : 12;
  const listMobAvatarInit = mob ? 11 : 14;

  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%", maxWidth: "100%", minWidth: 0, boxSizing: "border-box", ...(mob ? { minHeight: MOB_PANEL_MIN_H, gap: 8 } : { gap: 20 }) }}>
      {/* ─── 필터 바 ─── */}
      <div style={{ display: "flex", gap: mob ? 8 : 12, alignItems: "center", flexWrap: "wrap", width: "100%", minWidth: 0, ...(mob ? { flexShrink: 0 } : {}) }}>
        <div style={{ position: "relative", flex: 1, minWidth: mob ? 0 : 200, width: mob ? "100%" : undefined }}>
          <div style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: C.textMuted }}><Icons.Search /></div>
          <input
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addSearchTerm();
              } else if (e.key === "Escape") {
                e.preventDefault();
                setSearchInput("");
              }
            }}
            placeholder="이름, 연락처 검색..."
            style={{
              width: "100%",
              height: mob ? tokens.height.mobileInput : tokens.height.desktopInput,
              paddingRight: 56,
              paddingLeft: 34,
              fontFamily: "inherit",
              fontSize: mob ? 11 : tokens.fontSize.desktop.search,
              background: C.card,
              border: `1px solid ${C.border}`,
              borderRadius: mob ? tokens.radius.sm : tokens.radius.lg,
              color: C.text,
              outline: "none",
              boxSizing: "border-box",
            }}
          />
          <button
            type="button"
            onClick={addSearchTerm}
            style={{
              position: "absolute",
              right: 8,
              top: "50%",
              transform: "translateY(-50%)",
              height: mob ? 26 : 30,
              padding: mob ? "0 10px" : "0 12px",
              borderRadius: 10,
              border: `1px solid ${C.border}`,
              background: C.bg,
              color: C.textMuted,
              cursor: "pointer",
              fontSize: mob ? 10 : 12,
              fontWeight: 600,
              fontFamily: "inherit",
              whiteSpace: "nowrap",
            }}
          >
            검색
          </button>
        </div>
        {searchTerms.length > 0 && (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 6,
              alignItems: "center",
              width: "100%",
              minWidth: 0,
            }}
          >
            {searchTerms.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => removeSearchTerm(t)}
                title="클릭하여 제거"
                style={{
                  height: mob ? 26 : 30,
                  padding: mob ? "0 10px" : "0 12px",
                  borderRadius: 999,
                  border: `1px solid ${C.border}`,
                  background: C.bg,
                  color: C.text,
                  cursor: "pointer",
                  fontSize: mob ? 10 : 12,
                  fontWeight: 600,
                  fontFamily: "inherit",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  whiteSpace: "nowrap",
                  maxWidth: "100%",
                }}
              >
                <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{t}</span>
                <span style={{ color: C.textMuted, fontWeight: 800 }}>×</span>
              </button>
            ))}
          </div>
        )}
        {mob ? (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, width: "100%" }}>
            <ModernSelect
              value={deptF}
              onChange={(v) => { setDeptF(v); setPageList(1); setPageGroup(1); }}
              options={deptSelectOptions}
              compact
              uniform32
              style={{ marginBottom: 0 }}
            />
            <ModernSelect
              value={roleF}
              onChange={(v) => { setRoleF(v); setPageList(1); setPageGroup(1); }}
              options={roleSelectOptions}
              compact
              uniform32
              style={{ marginBottom: 0 }}
            />
            <select
              id="debug-status"
              className="members-mob-filter-select"
              value={statusF}
              onChange={e => { setStatusF(e.target.value); setPageList(1); setPageGroup(1); }}
              style={{ minWidth: 0, width: "100%", appearance: "none", WebkitAppearance: "none", fontFamily: "inherit", color: C.text, cursor: "pointer", outline: "none" }}
            >
              <option value="all">전체 상태</option>
              {MEMBER_STATUS_LIST.map(s => s && <option key={s} value={s}>{s}</option>)}
            </select>
            <div
              id="debug-checkbox-box"
              style={{
                height: tokens.height.mobileSelect,
                fontSize: 10,
                borderRadius: tokens.radius.sm,
                border: `1px solid ${C.border}`,
                boxSizing: "border-box",
                padding: tokens.space.padding.mobileFilter,
                minWidth: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                background: C.card,
              }}
            >
              <label style={{ display: "flex", alignItems: "center", gap: 3, fontSize: mob ? 10 : 13, cursor: "pointer", whiteSpace: "nowrap" }}>
                <input type="checkbox" checked={newFamilyOnly} onChange={e => { setNewFamilyOnly(e.target.checked); setPageList(1); }} />
                새가족
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 3, fontSize: mob ? 10 : 13, cursor: "pointer", whiteSpace: "nowrap" }}>
                <input type="checkbox" checked={prospectOnly} onChange={e => { setProspectOnly(e.target.checked); setPageList(1); }} />
                관심성도
              </label>
              <span style={{ marginLeft: "auto", color: "var(--color-primary)", fontWeight: 700, fontSize: mob ? 10 : 13 }}>{filtered.length}명</span>
            </div>
            <button
              id="debug-register-btn"
              type="button"
              onClick={() => openMemberModal()}
              style={{
                height: tokens.height.mobileSelect,
                borderRadius: tokens.radius.sm,
                border: "none",
                boxSizing: "border-box",
                padding: tokens.space.padding.mobileFilter,
                minWidth: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 4,
                background: C.primary,
                color: "var(--color-primary-on)",
                fontWeight: 600,
                fontFamily: "inherit",
                fontSize: mob ? 10 : tokens.fontSize.desktop.button,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              + 새 교인 등록
            </button>
          </div>
        ) : (
          <>
            <ModernSelect value={deptF} onChange={(v) => { setDeptF(v); setPageList(1); setPageGroup(1); }} options={deptSelectOptions} style={{ marginBottom: 0, minWidth: 120 }} />
            <ModernSelect value={mokjangF} onChange={(v) => { setMokjangF(v); setPageList(1); setPageGroup(1); }} options={mokjangSelectOptions} style={{ marginBottom: 0, minWidth: 120 }} />
            <ModernSelect value={roleF} onChange={(v) => { setRoleF(v); setPageList(1); setPageGroup(1); }} options={roleSelectOptions} style={{ marginBottom: 0, minWidth: 120 }} />
            <select value={statusF} onChange={e => { setStatusF(e.target.value); setPageList(1); setPageGroup(1); }} className="select-modern" style={{ height: 40, width: "auto", minWidth: 70 }}>
              <option value="all">전체 상태</option>
              {MEMBER_STATUS_LIST.map(s => s && <option key={s} value={s}>{s}</option>)}
            </select>
            <label style={{ display: "flex", alignItems: "center", gap: 6, height: 40, padding: "0 10px", fontSize: 13, cursor: "pointer", whiteSpace: "nowrap" }}><input type="checkbox" checked={newFamilyOnly} onChange={e => { setNewFamilyOnly(e.target.checked); setPageList(1); }} /> 새가족</label>
            <label style={{ display: "flex", alignItems: "center", gap: 6, height: 40, padding: "0 10px", fontSize: 13, cursor: "pointer", whiteSpace: "nowrap" }}><input type="checkbox" checked={prospectOnly} onChange={e => { setProspectOnly(e.target.checked); setPageList(1); }} /> 관심성도</label>
            <select value={baptismF} onChange={e => { setBaptismF(e.target.value); setPageList(1); setPageGroup(1); }} className="select-modern" style={{ height: 40, width: "auto", minWidth: 70 }}>
              <option value="all">전체</option>
              {baptismOptions.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
            </select>
            <SBadge variant="accent">{filtered.length}명</SBadge>
            <Btn onClick={() => openMemberModal()} icon={<Icons.Plus />}>새 교인 등록</Btn>
          </>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: mob ? "1fr" : viewMode === "group" ? "180px 180px" : "180px", gap: 8, width: "100%", minWidth: 0, ...(mob ? { flexShrink: 0 } : {}) }}>
        <ModernSelect
          value={viewMode}
          onChange={(v) => {
            const next = v === "group" ? "group" : "list";
            setViewMode(next);
            setSelectedGroupKey(null);
            setPageGroup(1);
            setPageList(1);
          }}
          options={viewModeOptions}
          compact={mob}
          uniform32={mob}
          style={{ marginBottom: 0 }}
        />
        {viewMode === "group" && (
          <ModernSelect
            value={groupBy}
            onChange={(v) => {
              const next = v === "dept" || v === "mokjang" || v === "role" ? v : "dept";
              setGroupBy(next);
              setSelectedGroupKey(null);
              setPageGroup(1);
            }}
            options={groupByOptions}
            compact={mob}
            uniform32={mob}
            style={{ marginBottom: 0 }}
          />
        )}
      </div>

      <div style={mob ? { flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 } : { width: "100%", minWidth: 0 }}>
      {/* ─── 목장별 뷰: 목장 이름만 진열 → 클릭 시 목장원 표시 (10명 단위 페이지) ─── */}
      {viewMode === "group" && (
        <>
          {selectedGroupKey === null ? (
            /* 목장 이름 카드만 진열 */
            <div style={{ display: "grid", gridTemplateColumns: mob ? "1fr 1fr" : "repeat(auto-fill, minmax(200px, 1fr))", gap: 12, ...(mob ? { flex: 1, minHeight: 0, overflowY: "auto", WebkitOverflowScrolling: "touch" as const, alignContent: "start" } : {}) }}>
              {grouped.length === 0 ? (
                <Card><div style={{ textAlign: "center", color: C.textMuted, padding: 24 }}>검색 결과가 없습니다</div></Card>
              ) : grouped.map(([gName, gMembers]) => (
                <button key={gName} type="button" onClick={() => { setSelectedGroupKey(gName); setPageGroup(1); }} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "14px 18px", background: "var(--color-primary-soft)", color: "var(--color-primary)", border: "1px solid var(--color-primary)", borderRadius: 16, cursor: "pointer", fontFamily: "inherit", fontSize: 15, fontWeight: 700, textAlign: "left", transition: "transform 0.15s, box-shadow 0.2s" }}>
                  <span>{groupBy === "dept" ? "🏢 " : groupBy === "mokjang" ? "🏠 " : "🏷️ "}{gName}</span>
                  <span style={{ background: "rgba(255,255,255,0.25)", padding: "4px 10px", borderRadius: 20, fontSize: 13, fontWeight: 600 }}>{gMembers.length}명</span>
                </button>
              ))}
            </div>
          ) : (
            /* 선택된 목장의 목장원 (10명 단위 페이지) — 테이블로 한눈에 */
            <div style={{ ...PAGINATION_LIST_PARENT_STYLE, ...(mob ? { minWidth: 0 } : {}) }}>
              <div ref={listRef} style={{ flex: 1, minHeight: 0, ...(mob ? { overflowY: "auto", WebkitOverflowScrolling: "touch" as const } : {}) }}><Card style={{ padding: 0, overflow: "hidden", border: `1px solid ${C.border}`, borderRadius: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
                <div style={{ padding: "14px 20px", background: C.bg, borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
                  <button type="button" onClick={() => { setSelectedGroupKey(null); setPageGroup(1); }} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", border: "none", background: "transparent", color: C.accent, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>← 그룹 목록</button>
                  <span style={{ color: C.text, fontWeight: 700 }}>{selectedGroupKey} ({selectedGroupMembers.length}명)</span>
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: mob ? listMobCell : 14 }}>
                    <thead>
                      <tr style={{ background: C.bg }}>
                        {["이름","부서","출석","기도제목","최근 심방"].map((h, i) => (
                          <th key={i} style={{ padding: "10px 14px", textAlign: "left", fontWeight: 600, fontSize: listMobTh, color: C.text, borderBottom: `1px solid ${C.border}`, whiteSpace: "nowrap" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {pageGroupMembers.map((m, idx) => {
                        const ws = (db.attendance[m.id] || {})[currentWeek] || "n";
                        const globalIdx = (currentPageGroup - 1) * PAGE_SIZE_MEM + idx;
                        const isLeader = groupBy === "mokjang" && globalIdx === 0;
                        const notes = (db.notes[m.id] || []).slice().reverse();
                        const lastVisit = notes.find(n => n.type === "visit");
                        const prayerSnip = m.prayer ? (m.prayer.length > 20 ? m.prayer.substring(0, 20) + "…" : m.prayer) : "-";
                        return (
                          <tr key={m.id} onClick={() => openDetail(m.id)} style={{ cursor: "pointer", borderBottom: `1px solid ${C.borderLight}`, transition: "background 0.1s" }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = C.bg; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
                            <td style={{ padding: "10px 14px", minWidth: 0 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                                <div style={{ width: 34, height: 34, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: listMobAvatarInit, fontWeight: 700, background: isLeader ? `linear-gradient(135deg, ${C.accent}, ${C.purple})` : `linear-gradient(135deg, ${C.accentBg}, ${C.tealBg})`, color: isLeader ? "var(--color-primary-on)" : C.text, overflow: "hidden", flexShrink: 0 }}>
                                    <MemberPhoto photo={m.photo} name={m.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                </div>
                                <div style={{ minWidth: 0 }}><div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}><span style={{ fontWeight: 700, fontSize: listMobName, color: C.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display: "block" }}>{m.name}</span>{isLeader && <span style={{ fontSize: mob ? 9 : 10, fontWeight: 700, color: C.accent, background: C.accentBg, padding: "2px 6px", borderRadius: 8, flexShrink: 0 }}>목자</span>}</div><div style={{ fontSize: listMobRole, color: C.textMuted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.role || ""}</div></div>
                              </div>
                            </td>
                            <td style={{ padding: "10px 14px" }}><SBadge variant="gray" style={mob ? { fontSize: 9, padding: "1px 6px" } : undefined}>{m.dept || "-"}</SBadge></td>
                            <td style={{ padding: "10px 14px" }}><AttDot status={ws} onClick={() => cycleAtt(m.id)} /></td>
                            <td style={{ padding: "10px 14px", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: listMobCell, color: C.purple }}>{prayerSnip}</td>
                            <td style={{ padding: "10px 14px", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: listMobCell }}>{lastVisit ? `${lastVisit.date} ${lastVisit.content.substring(0, 10)}…` : "-"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card></div>
              <Pagination compact={mob} totalItems={selectedGroupMembers.length} itemsPerPage={PAGE_SIZE_MEM} currentPage={currentPageGroup} onPageChange={(p) => setPageGroup(p)} />
            </div>
          )}
        </>
      )}

      {/* ─── 테이블 목록 뷰 (출석 통계 목록과 동일: 번호 열, 10행 고정, 체크박스 없음) ─── */}
      {viewMode === "list" && (
        <>
          <div style={{ ...PAGINATION_LIST_PARENT_STYLE, ...(mob ? { minWidth: 0 } : {}) }}>
            <div
              ref={listRef}
              style={{
                flex: 1,
                minHeight: 0,
                ...(mob
                  ? { overflowY: "auto", WebkitOverflowScrolling: "touch" as const, width: "100%", maxWidth: "100%", minWidth: 0 }
                  : { width: "100%", maxWidth: "100%", minWidth: 0 }),
              }}
            >
              <div className="flex flex-col overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm w-full max-w-full box-border">
                <div className="min-h-0 overflow-x-auto w-full max-w-full">
                  <table className="w-full table-fixed border-collapse text-sm">
                    <colgroup>
                      <col className="w-[52px]" />
                      <col className="w-[190px]" />
                      <col className="w-[120px]" />
                      <col className="w-[190px]" />
                      <col className="w-[72px]" />
                      <col className="w-[160px] md:w-[220px] lg:w-[260px]" />
                      <col className="w-[180px]" />
                      <col className="w-[180px]" />
                      <col className="w-[68px]" />
                    </colgroup>
                    <thead className="border-b border-gray-200 bg-gray-50/95">
                      <tr>
                        {(["번호", "이름", "직분", "부서", "출석", "기도제목", "최근 심방", "최근 메모", "기록"] as const).map((h, i) => (
                          <th
                            key={h}
                            className={`py-3 font-semibold text-[#1e40af] ${i === 0 || i === 8 ? "px-2" : "px-3"} ${i === 0 ? "text-center" : i === 2 || i === 4 || i === 8 ? "text-center" : "text-left"}`}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.length === 0 ? (
                        Array.from({ length: PAGE_SIZE_MEM }, (_, idx) => {
                          const centerIdx = Math.floor(PAGE_SIZE_MEM / 2);
                          if (idx === centerIdx) {
                            return (
                              <tr key={`members-empty-msg-${idx}`} className="h-12 border-b border-gray-100">
                                <td colSpan={9} className="h-12 px-2 text-center align-middle text-gray-500">
                                  <div className="inline-flex items-center gap-2">
                                    <span style={{ fontSize: 18, opacity: 0.45 }}>📭</span>
                                    <span className="text-sm font-medium">검색 결과가 없습니다</span>
                                  </div>
                                </td>
                              </tr>
                            );
                          }
                          return (
                            <tr key={`members-empty-pad-${idx}`} className="h-12 border-b border-gray-100" aria-hidden>
                              <td colSpan={9} className="h-12 p-0" />
                            </tr>
                          );
                        })
                      ) : (
                        Array.from({ length: PAGE_SIZE_MEM }, (_, idx) => {
                          const m = pageListMembers[idx];
                          const rowNum = (currentPageList - 1) * PAGE_SIZE_MEM + idx + 1;
                          if (!m) {
                            return (
                              <tr key={`members-pad-${currentPageList}-${idx}`} className="h-12 border-b border-gray-100" aria-hidden>
                                <td colSpan={9} className="h-12 p-0" />
                              </tr>
                            );
                          }
                          const ws = (db.attendance[m.id] || {})[currentWeek] || "n";
                          const notes = (db.notes[m.id] || []).slice().reverse();
                          const lastMemo = notes.find((n) => n.type === "memo");
                          const lastPrayerNote = notes.find((n) => n.type === "prayer");
                          const lastVisit = notes.find((n) => n.type === "visit");
                          const roleLabel = (m.role || "").trim();
                          const deptLabel = (m.dept || "").trim();
                          const mokjangLabel = ((m.mokjang ?? m.group) || "").trim();
                          const primaryRoleText =
                            roleLabel && roleLabel !== "학생" ? roleLabel : (deptLabel || roleLabel || "-");
                          const affiliationText =
                            deptLabel && mokjangLabel
                              ? `${deptLabel} · ${mokjangLabel}`
                              : deptLabel || mokjangLabel || "-";
                          const prayerPreview = m.prayer || lastPrayerNote?.content || "";
                          const prayerSnip = prayerPreview
                            ? prayerPreview.length > 15
                              ? prayerPreview.substring(0, 15) + "…"
                              : prayerPreview
                            : "";
                          const memoSnip = lastMemo?.content
                            ? lastMemo.content.length > 15
                              ? lastMemo.content.substring(0, 15) + "…"
                              : lastMemo.content
                            : "";
                          return (
                            <tr
                              key={m.id}
                              className="h-12 border-b border-gray-100 hover:bg-gray-50/50 cursor-pointer"
                              onClick={() => openDetail(m.id)}
                            >
                              <td className="px-2 py-3 text-center align-middle tabular-nums text-gray-500">{rowNum}</td>
                              <td className="overflow-hidden px-3 py-3 align-middle">
                                <div className="flex min-w-0 items-center gap-2">
                                  <div
                                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold overflow-hidden"
                                    style={{
                                      background: `linear-gradient(135deg,${C.accentBg},${C.tealBg})`,
                                      color: C.text,
                                    }}
                                  >
                                    <MemberPhoto photo={m.photo} name={m.name} className="h-full w-full object-cover" />
                                  </div>
                                  <div className="min-w-0">
                                    <div className="truncate font-medium text-gray-900">{m.name}</div>
                                  </div>
                                </div>
                              </td>
                              <td className="overflow-hidden px-3 py-3 align-middle text-center">
                                <div className="flex justify-center">
                                  <SBadge variant="gray" style={mob ? { fontSize: 9, padding: "1px 6px" } : undefined}>
                                    {primaryRoleText}
                                  </SBadge>
                                </div>
                              </td>
                              <td className="overflow-hidden px-3 py-3 align-middle text-gray-600 text-sm">
                                <div className="truncate">{affiliationText}</div>
                              </td>
                              <td className="px-3 py-3 text-center align-middle">
                                <div className="flex justify-center">
                                  <AttDot status={ws} onClick={() => cycleAtt(m.id)} />
                                </div>
                              </td>
                              <td
                                className="overflow-hidden px-3 py-3 align-middle text-sm truncate max-w-0 cursor-pointer"
                                style={{ color: C.purple }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openQuickNote(m.id, m.name || "?", "prayer");
                                }}
                              >
                                {prayerSnip ? (
                                  <div className="w-full overflow-hidden text-ellipsis whitespace-nowrap">{prayerSnip}</div>
                                ) : (
                                  <span className="text-gray-300 whitespace-nowrap">+ 추가</span>
                                )}
                              </td>
                              <td className="overflow-hidden px-3 py-3 align-middle text-sm text-gray-600 max-w-0">
                                <div className="truncate">{lastVisit ? `${lastVisit.date} ${lastVisit.content.substring(0, 12)}…` : "-"}</div>
                              </td>
                              <td className="overflow-hidden px-3 py-3 align-middle max-w-0" onClick={(e) => e.stopPropagation()}>
                                {memoSnip ? (
                                  <button
                                    type="button"
                                    onClick={() => openQuickNote(m.id, m.name || "?", "note")}
                                    className="inline-flex max-w-full items-center gap-1 truncate border-0 bg-transparent p-0 text-left text-sm text-gray-800 cursor-pointer"
                                  >
                                    {NOTE_ICONS.memo} {memoSnip}
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => openQuickNote(m.id, m.name || "?", "note")}
                                    className="border-0 bg-transparent p-0 text-sm text-gray-300 cursor-pointer"
                                  >
                                    + 추가
                                  </button>
                                )}
                              </td>
                              <td className="px-2 py-3 text-center align-middle" onClick={(e) => e.stopPropagation()}>
                                <Btn
                                  variant="soft"
                                  size="sm"
                                  icon={<FileText size={14} />}
                                  onClick={(e) => {
                                    e?.stopPropagation();
                                    openNoteModal(m.id);
                                  }}
                                />
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            <div
              className={
                mob
                  ? "flex shrink-0 items-center justify-center gap-2 border-t border-gray-100 bg-gray-50/90 px-2 py-1.5 backdrop-blur-sm"
                  : "flex shrink-0 items-center justify-center gap-3 border-t border-gray-200 bg-gray-50/90 px-4 py-2.5 backdrop-blur-sm"
              }
            >
              <Pagination
                compact={mob}
                totalItems={filtered.length}
                itemsPerPage={PAGE_SIZE_MEM}
                currentPage={currentPageList}
                onPageChange={(p) => setPageList(p)}
              />
            </div>
          </div>
        </>
      )}
      </div>
    </div>
  );
}


/** 기도 항목의 응답됨 저장용 키 (타임라인 vs 프로필 구분) */
function getPrayerAnsweredKey(n: Note & { mbrId: string; isProfilePrayer?: boolean }): string {
  if ((n as { isProfilePrayer?: boolean }).isProfilePrayer) return `profile\t${n.mbrId}\t${n.content}`;
  return `note\t${n.mbrId}\t${n.date}\t${n.createdAt}\t${n.content}`;
}

/* ====== Notes ====== */
function NotesSub({ db, setDb, persist, openPrayerModal, openNoteModal }: { db: DB; setDb: (fn: (prev: DB) => DB) => void; persist: () => void; openPrayerModal: (id: string) => void; openNoteModal: (id?: string) => void }) {
  const mob = useIsMobile();
  const listRefNotes = useRef<HTMLDivElement>(null);
  const [search, setSearch] = useState("");
  const [typeF, setTypeF] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);

  const answeredSet = useMemo(() => new Set(db.answeredPrayerKeys || []), [db.answeredPrayerKeys]);

  const allNotes = useMemo(() => {
    const a: (Note & { mbrName: string; mbrId: string; mbrDept: string; isProfilePrayer?: boolean })[] = [];
    const seen = new Set<string>();
    // 타임라인 기록 (db.notes)
    Object.keys(db.notes).forEach(mid => {
      const mbr = db.members.find(x => x.id === mid);
      const mbrName = mid === NOTE_TARGET_CHURCH ? "교회 전체" : (mbr?.name || "?");
      (db.notes[mid] || []).forEach(n => {
        const key = `${mid}|${n.date}|${n.type}|${n.content}`;
        if (seen.has(key)) return;
        seen.add(key);
        a.push({ ...n, mbrName, mbrId: mid, mbrDept: mbr?.dept || "" });
      });
    });
    // 성도 프로필 기도제목(m.prayer) — 기록으로 추가한 적 없어도 기도/메모 탭에 표시
    const today = new Date().toISOString().slice(0, 10);
    db.members.forEach(m => {
      const prayer = (m.prayer || "").trim();
      if (!prayer || m.status === "졸업/전출") return;
      const key = `${m.id}|profile|prayer|${prayer}`;
      if (seen.has(key)) return;
      const alreadyInNotes = (db.notes[m.id] || []).some(n => n.type === "prayer" && n.content === prayer);
      if (alreadyInNotes) return;
      seen.add(key);
      a.push({
        type: "prayer",
        content: prayer,
        date: m.createdAt?.slice(0, 10) || today,
        createdAt: m.createdAt || today,
        mbrName: m.name,
        mbrId: m.id,
        mbrDept: m.dept || "",
        isProfilePrayer: true,
      });
    });
    return a;
  }, [db]);

  const filtered = useMemo(() => {
    let r = [...allNotes];
    if (search) { const q = search.toLowerCase(); r = r.filter(n => n.mbrName.toLowerCase().includes(q) || n.content.toLowerCase().includes(q)); }
    if (typeF !== "all") r = r.filter(n => n.type === typeF);
    return r.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  }, [allNotes, search, typeF]);

  const paginatedNotes = useMemo(() => filtered.slice((currentPage - 1) * 10, currentPage * 10), [filtered, currentPage]);

  const toggleAnswered = (key: string) => {
    const list = db.answeredPrayerKeys || [];
    const next = list.includes(key) ? list.filter(k => k !== key) : [...list, key];
    setDb(prev => ({ ...prev, answeredPrayerKeys: next }));
    persist();
  };

  const [searchFocused, setSearchFocused] = useState(false);
  const btnPrayMob: CSSProperties = mob
    ? { height: 32, fontSize: 11, padding: "0 10px", minHeight: 32 }
    : {};
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: mob ? 8 : 20, ...(mob ? { minHeight: MOB_PANEL_MIN_H } : { minHeight: "100%" }) }}>
      <div style={{ display: "flex", gap: mob ? 8 : 12, alignItems: "center", flexWrap: "wrap", ...(mob ? { flexShrink: 0 } : {}) }}>
        <div style={{ position: "relative", flex: 1, minWidth: mob ? 0 : 200, width: mob ? "100%" : undefined }}>
          <div style={{ position: "absolute", left: mob ? 10 : 14, top: "50%", transform: "translateY(-50%)", color: C.textFaint, pointerEvents: "none" }}><Icons.Search /></div>
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            placeholder="제목, 기도제목 검색"
            style={{
              width: "100%",
              height: mob ? 32 : 44,
              padding: mob ? "0 10px 0 30px" : "0 14px 0 40px",
              fontFamily: "inherit",
              fontSize: mob ? 12 : 14,
              background: C.card,
              border: `1px solid ${searchFocused ? "var(--color-primary)" : C.border}`,
              borderRadius: 16,
              color: "var(--color-text)",
              outline: "none",
              boxShadow: searchFocused ? "0 0 0 2px color-mix(in srgb, var(--color-primary) 22%, transparent)" : "none",
              transition: "border-color 0.2s, box-shadow 0.2s",
            }}
          />
        </div>
        <select
          value={typeF === "visit" || typeF === "event" ? "all" : typeF}
          onChange={e => { setTypeF(e.target.value); setCurrentPage(1); }}
          className="select-modern pastoral-notes-type-select"
          style={{ height: mob ? 32 : 44, width: "auto", minWidth: mob ? 80 : 120, fontSize: mob ? 11 : 14 }}
        >
          <option value="all">전체</option>
          <option value="prayer">기도</option>
          <option value="memo">메모</option>
        </select>
        {typeF === "all" && (
          <span style={{ display: "inline-flex", alignItems: "center", padding: mob ? "3px 8px" : "6px 12px", borderRadius: 9999, fontSize: mob ? 10 : 12, fontWeight: 600, background: C.successBg, color: C.success }}>
            전체
          </span>
        )}
        <Btn variant="primary" icon={<Icons.Plus />} onClick={() => openNoteModal()} style={btnPrayMob}>+ 기도</Btn>
      </div>
      <div ref={listRefNotes} style={{ ...PAGINATION_LIST_PARENT_STYLE, ...(mob ? { minWidth: 0 } : {}) }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: mob ? 24 : 48 }}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}><Heart size={mob ? 28 : 40} strokeWidth={1.5} style={{ color: C.textMuted }} /></div>
            <div style={{ fontSize: mob ? 14 : 17, fontWeight: 600, color: C.text, marginBottom: 8 }}>등록된 기도제목이 없습니다</div>
            <Btn variant="primary" icon={<Icons.Plus />} onClick={() => openNoteModal()} style={btnPrayMob}>+ 기도</Btn>
          </div>
        ) : (
          <>
            <div style={mob ? { flex: 1, minHeight: 0, overflowY: "auto", WebkitOverflowScrolling: "touch" as const } : {}}>
              {paginatedNotes.map((n, i) => {
                const key = getPrayerAnsweredKey(n);
                const answered = n.type === "prayer" && answeredSet.has(key);
                return (
                  <NoteCard
                    key={`${n.mbrId}-${n.date}-${n.type}-${n.createdAt}-${i}`}
                    n={n}
                    mbrName={n.mbrName}
                    mbrDept={n.mbrDept}
                    onClick={() => openPrayerModal(n.mbrId)}
                    answered={n.type === "prayer" ? answered : undefined}
                    onToggleAnswered={n.type === "prayer" ? () => toggleAnswered(key) : undefined}
                  />
                );
              })}
            </div>
            <Pagination compact={mob} totalItems={filtered.length} itemsPerPage={10} currentPage={currentPage} onPageChange={(p) => setCurrentPage(p)} />
          </>
        )}
      </div>
    </div>
  );
}

/* ====== Prayer Modal (기도/메모 전용) ====== */
function fmtPrayerDate(s: string) {
  if (!s) return "";
  const d = new Date(s);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

function PrayerModal({
  memberId,
  member,
  db,
  setDb,
  persist,
  toast,
  onClose,
  churchId,
}: {
  memberId: string;
  member: Member;
  db: DB;
  setDb: (fn: (prev: DB) => DB) => void;
  persist: () => void;
  toast: (m: string, t?: string) => void;
  onClose: () => void;
  churchId: string | null;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const [filter, setFilter] = useState<"all" | "active" | "answered">("all");
  const [addDate, setAddDate] = useState(todayStr());
  const [addContent, setAddContent] = useState("");
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [hoverCardKey, setHoverCardKey] = useState<string | null>(null);

  const answeredSet = useMemo(() => new Set(db.answeredPrayerKeys || []), [db.answeredPrayerKeys]);
  const answeredDates = db.answeredPrayerDates || {};

  const prayerList = useMemo(() => {
    const list: (Note & { createdAt: string; isProfilePrayer?: boolean })[] = [];
    const fromNotes = (db.notes[memberId] || []).filter(n => n.type === "prayer");
    fromNotes.forEach(n => list.push({ ...n, createdAt: n.createdAt || n.date }));
    const profilePrayer = (member.prayer || "").trim();
    if (profilePrayer && !fromNotes.some(n => n.content === profilePrayer)) {
      list.push({
        date: member.createdAt?.slice(0, 10) || member.created_at?.slice(0, 10) || todayStr(),
        type: "prayer",
        content: profilePrayer,
        createdAt: member.createdAt || member.created_at || new Date().toISOString(),
        isProfilePrayer: true,
      });
    }
    return list.sort((a, b) => (b.date || "").localeCompare(a.date || "") || (b.createdAt || "").localeCompare(a.createdAt || ""));
  }, [db.notes, memberId, member.prayer, member.createdAt, member.created_at]);

  const filteredList = useMemo(() => {
    if (filter === "all") return prayerList;
    return prayerList.filter(n => {
      const key = getPrayerAnsweredKey({ ...n, mbrId: memberId, isProfilePrayer: n.isProfilePrayer });
      const answered = answeredSet.has(key);
      if (filter === "answered") return answered;
      return !answered;
    });
  }, [prayerList, filter, answeredSet, memberId]);

  const toggleAnswered = (key: string) => {
    const list = db.answeredPrayerKeys || [];
    const next = list.includes(key) ? list.filter(k => k !== key) : [...list, key];
    const dates = { ...(db.answeredPrayerDates || {}) };
    if (next.includes(key)) dates[key] = todayStr();
    else delete dates[key];
    setDb(prev => ({ ...prev, answeredPrayerKeys: next, answeredPrayerDates: dates }));
    persist();
  };

  const addPrayer = () => {
    const content = addContent.trim();
    if (!content) { toast("기도제목을 입력하세요", "err"); return; }
    setDb(prev => {
      const notes = { ...prev.notes };
      if (!notes[memberId]) notes[memberId] = [];
      notes[memberId] = [...notes[memberId], { date: addDate, type: "prayer", content, createdAt: new Date().toISOString() }];
      let members = prev.members;
      if (!member.prayer) members = members.map(m => m.id === memberId ? { ...m, prayer: content } : m);
      return { ...prev, notes, members };
    });
    const cid = churchId ?? getChurchId();
    if (supabase && cid) {
      void (async () => {
        try {
          await supabase.from("notes").insert({
            member_id: memberId,
            church_id: cid,
            date: addDate,
            type: "prayer",
            content,
          });
        } catch (e) {
          console.error("기도제목 저장 실패:", e);
        }
      })();
    }
    persist();
    setAddContent("");
    setAddDate(todayStr());
    toast("기도제목이 등록되었습니다", "ok");
  };

  const deletePrayer = (n: Note & { createdAt: string; isProfilePrayer?: boolean }) => {
    if (typeof window !== "undefined" && !window.confirm("이 기도제목을 삭제하시겠습니까?")) return;
    const key = getPrayerAnsweredKey({ ...n, mbrId: memberId, isProfilePrayer: n.isProfilePrayer });
    setDb(prev => {
      const notes = { ...prev.notes };
      if (!n.isProfilePrayer) {
        notes[memberId] = (notes[memberId] || []).filter(
          x => !(x.type === "prayer" && x.date === n.date && (x.createdAt || x.date) === n.createdAt && x.content === n.content)
        );
      }
      const answeredPrayerKeys = (prev.answeredPrayerKeys || []).filter(k => k !== key);
      const answeredPrayerDates = { ...(prev.answeredPrayerDates || {}) };
      delete answeredPrayerDates[key];
      if (n.isProfilePrayer && member.prayer) {
        const members = prev.members.map(m => m.id === memberId ? { ...m, prayer: "" } : m);
        return { ...prev, notes, members, answeredPrayerKeys, answeredPrayerDates };
      }
      return { ...prev, notes, answeredPrayerKeys, answeredPrayerDates };
    });
    persist();
    setEditingKey(null);
    toast("삭제되었습니다", "warn");
  };

  const saveEdit = (n: Note & { createdAt: string; isProfilePrayer?: boolean }) => {
    const content = editContent.trim();
    if (!content) { setEditingKey(null); return; }
    setDb(prev => {
      if (n.isProfilePrayer) {
        const members = prev.members.map(m => m.id === memberId ? { ...m, prayer: content } : m);
        return { ...prev, members };
      }
      const notes = { ...prev.notes };
      const arr = notes[memberId] || [];
      const idx = arr.findIndex(x => x.type === "prayer" && x.date === n.date && (x.createdAt || x.date) === n.createdAt && x.content === n.content);
      if (idx >= 0) {
        const copy = [...arr];
        copy[idx] = { ...copy[idx], content };
        notes[memberId] = copy;
      }
      return { ...prev, notes };
    });
    persist();
    setEditingKey(null);
    toast("수정되었습니다", "ok");
  };

  return (
    <PcModalShell
      open
      onClose={onClose}
      title={`${member.name} — 기도`}
      maxWidth={720}
      footer={
        <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
            <div style={{ flex: "0 0 auto", minWidth: 140 }}>
              <CalendarDropdown label="날짜" value={addDate} onChange={setAddDate} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: C.text, marginBottom: 6 }}>기도제목</label>
              <textarea value={addContent} onChange={e => setAddContent(e.target.value)} placeholder="기도제목을 입력하세요..." style={{ width: "100%", padding: "12px 14px", border: `1px solid ${C.border}`, borderRadius: 12, fontSize: 15, minHeight: 48, resize: "vertical", fontFamily: "inherit", boxSizing: "border-box" }} />
            </div>
            <div style={{ flex: "0 0 auto", alignSelf: "flex-end" }}>
              <Btn variant="accent" size="sm" onClick={addPrayer} style={{ borderRadius: 10, padding: "12px 20px" }}>등록</Btn>
            </div>
          </div>
        </div>
      }
    >
        <div style={{ display: "flex", alignItems: "center", gap: 12, paddingBottom: 16, marginBottom: 16, borderBottom: `1px solid ${C.border}` }}>
          <div style={{ width: 48, height: 48, borderRadius: "50%", overflow: "hidden", flexShrink: 0, background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 700, color: C.text, border: `1px solid ${C.border}` }}>
            <MemberPhoto photo={member.photo} name={member.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>
          <div>
            <span style={{ fontSize: 17, fontWeight: 700, color: C.text }}>{member.name}</span>
            {member.dept && (
              <span style={{ marginLeft: 8, display: "inline-flex", alignItems: "center", padding: "2px 10px", borderRadius: 9999, fontSize: 12, fontWeight: 500, background: C.accentBg, color: C.text }}>
                {member.dept}
              </span>
            )}
          </div>
        </div>

        <div style={{ display: "flex", gap: 4, paddingBottom: 12, marginBottom: 12, borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
          {(["all", "active", "answered"] as const).map(f => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              style={{
                padding: "8px 16px",
                borderRadius: 8,
                border: "none",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                background: filter === f ? C.primary : "transparent",
                color: filter === f ? "var(--color-primary-on)" : C.textMuted,
              }}
            >
              {f === "all" ? "전체" : f === "active" ? "기도중" : "응답완료"}
            </button>
          ))}
        </div>

        <div ref={listRef} style={{ maxHeight: "min(50vh, 420px)", overflowY: "auto", margin: "0 -8px", padding: "0 8px 8px" }}>
          {filteredList.length === 0 ? (
            <div style={{ textAlign: "center", padding: 40, color: C.textFaint, fontSize: 15 }}>
              등록된 기도제목이 없습니다
              <div style={{ marginTop: 12, fontSize: 13 }}>아래 입력창에서 바로 작성해 보세요.</div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {filteredList.map((n, i) => {
                const key = getPrayerAnsweredKey({ ...n, mbrId: memberId, isProfilePrayer: n.isProfilePrayer });
                const answered = answeredSet.has(key);
                const cardKey = `${n.date}-${n.createdAt}-${i}`;
                const isHover = hoverCardKey === cardKey;
                const isEditing = editingKey === cardKey;
                return (
                  <div
                    key={cardKey}
                    onMouseEnter={() => setHoverCardKey(cardKey)}
                    onMouseLeave={() => setHoverCardKey(null)}
                    style={{
                      background: answered ? C.successBg : C.card,
                      borderRadius: 16,
                      border: `1px solid ${C.border}`,
                      padding: 16,
                      transition: "background 0.2s",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                      <span style={{ fontSize: 14, color: C.textFaint }}>{fmtPrayerDate(n.date)}</span>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <button
                          type="button"
                          onClick={e => { e.stopPropagation(); toggleAnswered(key); }}
                          style={{ padding: "4px 10px", fontSize: 12, border: "none", borderRadius: 9999, cursor: "pointer", fontWeight: 600, background: answered ? C.success : "transparent", color: answered ? "var(--color-primary-on)" : C.textMuted }}
                        >
                          {answered ? "✓ 응답완료" : "기도중"}
                        </button>
                        {(isHover || isEditing) && (
                          <>
                            <button type="button" onClick={() => { setEditingKey(cardKey); setEditContent(n.content); }} style={{ padding: 4, border: "none", background: "none", cursor: "pointer", color: C.textMuted, fontSize: 12 }}>편집</button>
                            <button type="button" onClick={() => deletePrayer(n)} style={{ padding: 4, border: "none", background: "none", cursor: "pointer", color: C.danger, fontSize: 12 }}>삭제</button>
                          </>
                        )}
                      </div>
                    </div>
                    {isEditing ? (
                      <div style={{ marginTop: 8 }}>
                        <textarea value={editContent} onChange={e => setEditContent(e.target.value)} style={{ width: "100%", padding: 10, border: `1px solid ${C.border}`, borderRadius: 10, fontSize: 14, minHeight: 80, resize: "vertical" }} />
                        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                          <Btn variant="ghost" size="sm" onClick={() => setEditingKey(null)}>취소</Btn>
                          <Btn variant="accent" size="sm" onClick={() => saveEdit(n)}>저장</Btn>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div style={{ fontSize: 15, color: C.text, lineHeight: 1.6 }}>{n.content}</div>
                        {answered && answeredDates[key] && (
                          <div style={{ fontSize: 12, color: C.success, marginTop: 6 }}>응답일 {fmtPrayerDate(answeredDates[key])}</div>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
    </PcModalShell>
  );
}

/* ====== New Family ====== */
const VISIT_PATH_LABEL: Record<string, string> = { 지인소개: "지인소개", 전도: "전도", 인터넷검색: "인터넷검색", 자진방문: "자진방문", 기타: "기타" };

const WEEK_CONFIG = [
  { title: "1주차 - 환영 & 등록", desc: "환영 예배 참석, 새가족 등록카드 작성, 환영 선물 전달, 섬김이 배정", checks: ["새가족 등록카드 작성 완료", "환영 선물 전달", "섬김이 배정 완료", "기념 사진 촬영"] },
  { title: "2주차 - 교회 안내 & 교제", desc: "교회 시설 안내, 예배 순서 안내, 기존 성도 3명 이상 소개, 식사 교제", checks: ["교회 시설 안내", "예배 순서 및 교회 생활 안내", "기존 성도 소개 (3명 이상)", "식사 교제"] },
  { title: "3주차 - 양육 & 관계 형성", desc: "신앙 이야기 나눔, 기도 제목 공유, 소그룹/셀 참여 안내", checks: ["신앙 간증 나눔", "기도 제목 공유", "소그룹/셀 소개", "주중 연락 (전화/문자)"] },
  { title: "4주차 - 수료 & 정착", desc: "정착 수료 확인, 구역/셀 배정, 수료 감사 기도, 교적부 정식 등록", checks: ["수료 확인", "구역/셀 배정", "수료 기념 기도", "교적부 정식 등록"] },
];
const MENTOR_ROLES = ["집사", "안수집사", "권사", "장로"];

function getProgramWeekFromStart(startDate: string): number {
  const start = new Date(startDate).getTime();
  const now = Date.now();
  const days = Math.floor((now - start) / (24 * 60 * 60 * 1000));
  return Math.min(4, Math.max(1, Math.floor(days / 7) + 1));
}

function isProgramNeedAttention(program: NewFamilyProgram): boolean {
  const week = getProgramWeekFromStart(program.program_start_date);
  if (program.status !== "진행중") return false;
  if (week >= 2 && !program.week1_completed) return true;
  if (week >= 3 && !program.week2_completed) return true;
  if (week >= 4 && !program.week3_completed) return true;
  return false;
}

function NewFamilySub({ db, setDb, openProgramDetail, openMemberModal, toast }: {
  db: DB; setDb: (fn: (prev: DB) => DB) => void; openProgramDetail: (memberId: string) => void; openMemberModal: (id?: string) => void; toast: (m: string, t?: string) => void;
}) {
  const mob = useIsMobile();
  const listRef = useRef<HTMLDivElement>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [filter, setFilter] = useState<"all" | "진행중" | "수료" | "중단" | "no_mentor">("all");
  const [nfSubTab, setNfSubTab] = useState<"list" | "servant">("list");
  const PAGE_SIZE_NEWFAMILY = 5;

  const programs = db.newFamilyPrograms || [];
  const nfMembers = db.members.filter(m => m.is_new_family === true);
  const programByMember = (memberId: string) => programs.find(p => p.member_id === memberId);

  const thisMonth = useMemo(() => {
    const y = new Date().getFullYear();
    const m = String(new Date().getMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
  }, []);
  const thisMonthCount = useMemo(() => nfMembers.filter(m => (m.firstVisitDate || m.createdAt || "").slice(0, 7) === thisMonth).length, [nfMembers, thisMonth]);
  const inProgressCount = useMemo(() => programs.filter(p => p.status === "진행중").length, [programs]);
  const completedCount = useMemo(() => programs.filter(p => p.status === "수료").length, [programs]);
  const needAttentionCount = useMemo(() => programs.filter(isProgramNeedAttention).length, [programs]);

  // 새가족/정착중인데 프로그램이 없으면 자동 생성
  useEffect(() => {
    const missing = nfMembers.filter(m => !programs.some(p => p.member_id === m.id));
    if (missing.length === 0) return;
    setDb(prev => {
      const existing = prev.newFamilyPrograms || [];
      const toAdd: NewFamilyProgram[] = missing.map(m => ({
        id: uuid(),
        member_id: m.id,
        mentor_id: null,
        program_start_date: m.firstVisitDate || m.createdAt || todayStr(),
        week1_completed: false, week1_date: null, week1_note: null,
        week2_completed: false, week2_date: null, week2_note: null,
        week3_completed: false, week3_date: null, week3_note: null,
        week4_completed: false, week4_date: null, week4_note: null,
        status: "진행중",
        cell_group_assigned: null,
      }));
      return { ...prev, newFamilyPrograms: [...existing, ...toAdd] };
    });
  }, [nfMembers, programs]);

  const filteredList = useMemo(() => {
    let list = nfMembers.map(m => ({ member: m, program: programByMember(m.id) })).filter(x => x.program != null) as { member: Member; program: NewFamilyProgram }[];
    if (filter === "진행중") list = list.filter(x => x.program.status === "진행중");
    else if (filter === "수료") list = list.filter(x => x.program.status === "수료");
    else if (filter === "중단") list = list.filter(x => x.program.status === "중단");
    else if (filter === "no_mentor") list = list.filter(x => !x.program.mentor_id);
    return list;
  }, [nfMembers, programs, filter]);

  const paginated = useMemo(
    () => filteredList.slice((currentPage - 1) * PAGE_SIZE_NEWFAMILY, currentPage * PAGE_SIZE_NEWFAMILY),
    [filteredList, currentPage]
  );

  useEffect(() => {
    if (typeof window !== "undefined") {
      const sql = `-- Supabase SQL 에디터에서 실행
CREATE TABLE IF NOT EXISTS new_family_program (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  mentor_id uuid REFERENCES members(id) ON DELETE SET NULL,
  program_start_date date NOT NULL,
  week1_completed boolean DEFAULT false, week1_date date, week1_note text,
  week2_completed boolean DEFAULT false, week2_date date, week2_note text,
  week3_completed boolean DEFAULT false, week3_date date, week3_note text,
  week4_completed boolean DEFAULT false, week4_date date, week4_note text,
  status text DEFAULT '진행중' CHECK (status IN ('진행중', '수료', '중단')),
  cell_group_assigned text, created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_new_family_program_member_id ON new_family_program(member_id);
CREATE INDEX IF NOT EXISTS idx_new_family_program_mentor_id ON new_family_program(mentor_id);
CREATE INDEX IF NOT EXISTS idx_new_family_program_status ON new_family_program(status);`;
      console.log("[새가족] Supabase CREATE TABLE 쿼리:\n", sql);
    }
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: mob ? 8 : 12, ...(mob ? { minHeight: MOB_PANEL_MIN_H } : {}) }}>
      <div
        style={{
          display: "flex",
          gap: 12,
          marginBottom: 2,
          flexWrap: "wrap",
          ...(mob ? { flexShrink: 0 } : {}),
          ...(mob
            ? {}
            : {
                position: "static",
                background: "transparent",
                paddingTop: 0,
                paddingBottom: 0,
              }),
        }}
      >
        {([{ id: "list" as const, label: "새가족 정착" }, { id: "servant" as const, label: "섬김이 학교" }]).map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setNfSubTab(tab.id)}
            style={{
              height: mob ? 34 : 34,
              padding: mob ? "0 14px" : "0 16px",
              borderRadius: 10,
              fontSize: mob ? 13 : 13,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "inherit",
              background: nfSubTab === tab.id ? C.accentBg : C.card,
              color: nfSubTab === tab.id ? C.accent : C.textMuted,
              border: nfSubTab === tab.id ? "1px solid var(--color-primary)" : `1px solid ${C.border}`,
              boxSizing: "border-box",
              whiteSpace: "nowrap",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {nfSubTab === "servant" && <ServantSchoolManager members={db.members.map(m => ({ id: m.id, name: m.name || "", dept: m.dept, role: m.role }))} toast={toast} />}

      {nfSubTab === "list" && (
      <div style={mob ? { flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 } : {}}>
      <div style={{ display: "grid", gridTemplateColumns: mob ? "repeat(2, 1fr)" : "repeat(4, 1fr)", gap: mob ? 6 : 12, ...(mob ? { flexShrink: 0, marginBottom: 18 } : { marginBottom: 8 }) }}>
        {[
          { label: "이번 달 새가족", value: `${thisMonthCount}명`, sub: thisMonth.replace("-", ".") },
          { label: "정착 진행중", value: `${inProgressCount}명`, sub: "프로그램" },
          { label: "수료 완료", value: `${completedCount}명`, sub: "4주 과정" },
          { label: "관리 필요", value: `${needAttentionCount}명`, sub: "미완료 점검" },
        ].map((row) => (
          <div
            key={row.label}
            style={{
              background: C.card,
              border: `1px solid ${C.border}`,
              borderRadius: 16,
              padding: mob ? "8px 10px" : "14px 18px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
              boxSizing: "border-box",
            }}
          >
            <div style={{ fontSize: 10, color: C.textMuted, marginBottom: 4, lineHeight: 1.2 }}>{row.label}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "var(--color-text)", lineHeight: 1.15, letterSpacing: "-0.02em" }}>{row.value}</div>
            <div style={{ fontSize: 9, color: C.textFaint, marginTop: 4, lineHeight: 1.2 }}>{row.sub}</div>
          </div>
        ))}
      </div>

      <div ref={listRef} style={{ ...PAGINATION_LIST_PARENT_STYLE, ...(mob ? { minWidth: 0 } : {}) }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: mob ? 8 : 8, marginBottom: mob ? 12 : 16, ...(mob ? { flexShrink: 0 } : {}) }}>
          {(["all", "진행중", "수료", "중단", "no_mentor"] as const).map(f => (
            <button key={f} type="button" onClick={() => { setFilter(f); setCurrentPage(1); }} style={{
              padding: mob ? "4px 10px" : "8px 14px", borderRadius: 8, fontSize: mob ? 10 : 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", boxSizing: "border-box",
              background: filter === f ? C.accentBg : C.card,
              color: filter === f ? C.accent : C.textMuted,
              border: filter === f ? "1px solid var(--color-primary)" : `1px solid ${C.border}`,
            }}>{f === "all" ? "전체" : f === "no_mentor" ? "섬김이 미배정" : f}</button>
          ))}
        </div>

        {filteredList.length === 0 ? (
          <Card style={{ padding: mob ? 24 : 48, textAlign: "center", color: C.textMuted }}>새가족이 없습니다. 상단 + 새가족 등록으로 등록하세요.</Card>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: mob ? 8 : 12, ...(mob ? { flex: 1, minHeight: 0, overflowY: "auto", WebkitOverflowScrolling: "touch" as const } : {}) }}>
            {paginated.map(({ member, program }) => {
              const mentor = program.mentor_id ? (db.members.find(m => m.id === program.mentor_id) ?? null) : null;
              const done = [program.week1_completed, program.week2_completed, program.week3_completed, program.week4_completed].filter(Boolean).length;
              let nfBadgeLabel: string;
              let nfBadgeColor: string;
              if (program.status === "중단") {
                nfBadgeLabel = "중단";
                nfBadgeColor = C.textFaint;
              } else if (!mentor) {
                nfBadgeLabel = "미배정";
                nfBadgeColor = C.textFaint;
              } else if (program.status === "수료") {
                nfBadgeLabel = "수료";
                nfBadgeColor = "var(--color-primary)";
              } else {
                nfBadgeLabel = "진행중";
                nfBadgeColor = "var(--color-primary)";
              }
              return (
                <Card key={member.id} onClick={() => openProgramDetail(member.id)} style={{ cursor: "pointer", padding: mob ? "10px 12px" : 16 }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: mob ? 8 : 10, minWidth: 0 }}>
                      <div style={{ width: mob ? 32 : 44, height: mob ? 32 : 44, borderRadius: "50%", background: "color-mix(in srgb, var(--color-primary) 16%, var(--color-surface-elevated))", color: "var(--color-primary)", border: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: mob ? 12 : 16, overflow: "hidden", flexShrink: 0 }}>
                        <MemberPhoto photo={member.photo} name={member.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: mob ? 13 : 16, color: "var(--color-text)", display: "flex", alignItems: "center", gap: 6 }}>
                          {member.name}
                        </div>
                        <div style={{ fontSize: mob ? 10 : 12, color: C.textFaint, marginTop: 2 }}>
                          첫 방문일 {member.firstVisitDate || member.createdAt || "-"} · {VISIT_PATH_LABEL[member.visitPath || ""] || member.visitPath || "-"}
                        </div>
                      </div>
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 600, color: nfBadgeColor, background: "color-mix(in srgb, currentColor 12%, var(--color-surface-elevated))", border: `1px solid ${C.border}`, padding: "2px 8px", borderRadius: 6, flexShrink: 0 }}>{nfBadgeLabel}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                    {mentor ? <span style={{ fontSize: mob ? 11 : 13, color: C.textMuted }}>섬김이: {mentor.name}</span> : <span style={{ fontSize: mob ? 11 : 13, fontWeight: 600, color: C.textFaint }}>섬김이 미배정</span>}
                  </div>
                  <div style={{ height: mob ? 4 : 6, background: C.border, borderRadius: 3, overflow: "hidden", display: "flex" }}>
                    {[1, 2, 3, 4].map(i => (
                      <div key={i} style={{ flex: 1, height: "100%", background: [program.week1_completed, program.week2_completed, program.week3_completed, program.week4_completed][i - 1] ? C.accent : "var(--color-border-soft)", marginRight: i < 4 ? 2 : 0 }} />
                    ))}
                  </div>
                  <div style={{ display: "flex", marginTop: 6, gap: 2 }}>
                    {[1, 2, 3, 4].map(i => (
                      <div key={i} style={{ flex: 1, fontSize: 10, fontWeight: 600, color: C.textMuted, textAlign: "center" }}>{i}주차</div>
                    ))}
                  </div>
                  <div style={{ fontSize: mob ? 9 : 10, color: C.textFaint, marginTop: 4 }}>{done}/4주 완료</div>
                </Card>
              );
            })}
          </div>
        )}
        {filteredList.length > 0 && (
          <Pagination
            compact={mob}
            totalItems={filteredList.length}
            itemsPerPage={PAGE_SIZE_NEWFAMILY}
            currentPage={currentPage}
            onPageChange={(p) => setCurrentPage(p)}
          />
        )}
      </div>
      </div>
      )}
    </div>
  );
}

function NewFamilyProgramDetailModal({ db, setDb, memberId, onClose, onSaved, saveDb, toast, mob, churchId }: {
  db: DB; setDb: (fn: (prev: DB) => DB) => void; memberId: string; onClose: () => void; onSaved?: () => void; saveDb?: (d: DB) => Promise<void>; toast: (m: string, t?: string) => void; mob: boolean;
  churchId: string | null;
}) {
  const [saving, setSaving] = useState(false);
  const member = db.members.find(m => m.id === memberId);
  const program = (db.newFamilyPrograms || []).find(p => p.member_id === memberId);
  const [showMentorSelect, setShowMentorSelect] = useState(false);
  const [pendingMentorId, setPendingMentorId] = useState<string | null>(null);
  const [weekChecks, setWeekChecks] = useState<[boolean[], boolean[], boolean[], boolean[]]>(() =>
    program ? [
      (program.week1_checks ?? [program.week1_completed, program.week1_completed, program.week1_completed, program.week1_completed]).slice(0, 4) as [boolean, boolean, boolean, boolean],
      (program.week2_checks ?? [program.week2_completed, program.week2_completed, program.week2_completed, program.week2_completed]).slice(0, 4) as [boolean, boolean, boolean, boolean],
      (program.week3_checks ?? [program.week3_completed, program.week3_completed, program.week3_completed, program.week3_completed]).slice(0, 4) as [boolean, boolean, boolean, boolean],
      (program.week4_checks ?? [program.week4_completed, program.week4_completed, program.week4_completed, program.week4_completed]).slice(0, 4) as [boolean, boolean, boolean, boolean],
    ] : [[false, false, false, false], [false, false, false, false], [false, false, false, false], [false, false, false, false]]
  );

  const mentor = program?.mentor_id ? db.members.find(m => m.id === program.mentor_id) : null;
  const [mentorCandidates, setMentorCandidates] = useState<{ id: string; name: string; dept?: string; role?: string }[]>([]);
  useEffect(() => {
    if (!supabase || !churchId) return;
    supabase
      .from("servant_school_graduates")
      .select("member_id, name")
      .eq("church_id", churchId)
      .eq("is_active", true)
      .then(({ data, error }: any) => {
        if (error || !data) {
          setMentorCandidates(db.members.filter(m => m.id !== memberId && MENTOR_ROLES.some(r => (m.role || "").includes(r))));
          return;
        }
        const graduateIds = new Set((data as any[]).map((g: any) => g.member_id));
        const candidates = db.members
          .filter(m => graduateIds.has(m.id) && m.id !== memberId)
          .map(m => ({ id: m.id, name: m.name || "", dept: m.dept, role: m.role }));
        setMentorCandidates(candidates);
      });
  }, [churchId, db.members, memberId]);
  const currentWeekNum = program ? getProgramWeekFromStart(program.program_start_date) : 1;
  const allFourDone = program?.week1_completed && program?.week2_completed && program?.week3_completed && program?.week4_completed;

  const updateProgram = useCallback((patch: Partial<NewFamilyProgram>) => {
    setDb(prev => ({
      ...prev,
      newFamilyPrograms: (prev.newFamilyPrograms || []).map(p => p.member_id === memberId ? { ...p, ...patch } : p),
    }));
    // 저장 반영 후 부모에 알려 목록/다른 탭이 동일 db로 갱신되도록 함
    setTimeout(() => onSaved?.(), 0);
  }, [memberId, setDb, onSaved]);

  const setWeekCheck = useCallback((weekIndex: 0 | 1 | 2 | 3, checkIndex: number, value: boolean) => {
    const key = ["week1_checks", "week2_checks", "week3_checks", "week4_checks"][weekIndex] as keyof NewFamilyProgram;
    setWeekChecks(prev => {
      const next = prev.map((arr, wi) => wi === weekIndex ? arr.map((c, i) => i === checkIndex ? value : c) : arr) as [boolean[], boolean[], boolean[], boolean[]];
      const newWeek = next[weekIndex] as [boolean, boolean, boolean, boolean];
      updateProgram({ [key]: newWeek });
      return next;
    });
  }, [updateProgram]);

  const setWeekCompletedFromChecks = useCallback((weekIndex: 0 | 1 | 2 | 3, date: string | null, note: string | null) => {
    const checks = weekChecks[weekIndex];
    const allChecked = checks.every(Boolean);
    if (!program || !allChecked || !date) return;
    const key = ["week1", "week2", "week3", "week4"][weekIndex] as "week1" | "week2" | "week3" | "week4";
    updateProgram({
      [`${key}_completed`]: true,
      [`${key}_date`]: date,
      [`${key}_note`]: note || null,
    });
  }, [program, weekChecks, updateProgram]);

  const handleComplete = useCallback(() => {
    if (!allFourDone) return;
    if (!program?.cell_group_assigned?.trim()) {
      toast("구역/셀 배정을 입력하세요", "err");
      return;
    }
    updateProgram({ status: "수료" });
    toast("수료 처리되었습니다", "ok");
    onClose();
  }, [allFourDone, program?.cell_group_assigned, updateProgram, toast, onClose]);

  if (!member || !program) return null;

  return (
    <Modal open onClose={onClose} title="정착 프로그램 상세" width={mob ? undefined : 520}>
      <div style={{ marginBottom: 20, paddingBottom: 16, borderBottom: `1px solid ${C.border}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
          <div style={{ width: 56, height: 56, borderRadius: "50%", background: `linear-gradient(135deg,${C.accentBg},${C.tealBg})`, color: C.text, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 20, overflow: "hidden", flexShrink: 0 }}>
            <MemberPhoto photo={member.photo} name={member.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 18, color: C.text }}>{member.name}</div>
            <div style={{ fontSize: 13, color: C.textMuted }}>첫 방문일 {member.firstVisitDate || program.program_start_date}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
              {mentor ? <span style={{ fontSize: 13 }}>섬김이: {mentor.name}</span> : <span style={{ fontSize: 13, color: C.danger, fontWeight: 600 }}>섬김이 미배정</span>}
              <Btn size="sm" variant="secondary" onClick={() => { setPendingMentorId(program?.mentor_id ?? null); setShowMentorSelect(true); }}>섬김이 배정</Btn>
            </div>
          </div>
        </div>
      </div>

      <div style={{ position: "relative", paddingLeft: 24 }}>
        <div style={{ position: "absolute", left: 11, top: 12, bottom: 12, width: 2, background: C.border, borderRadius: 1 }} />
        {WEEK_CONFIG.map((week, wi) => {
          const completed = [program.week1_completed, program.week2_completed, program.week3_completed, program.week4_completed][wi];
          const isCurrent = currentWeekNum === wi + 1 && program.status === "진행중";
          const dateKey = [`week1_date`, `week2_date`, `week3_date`, `week4_date`][wi] as keyof NewFamilyProgram;
          const noteKey = [`week1_note`, `week2_note`, `week3_note`, `week4_note`][wi] as keyof NewFamilyProgram;
          const dateVal = program[dateKey] as string | null;
          const noteVal = program[noteKey] as string | null;
          return (
            <div key={wi} style={{ position: "relative", marginBottom: 20 }}>
              <div style={{ position: "absolute", left: -24, top: 4, width: 24, height: 24, borderRadius: "50%", background: completed ? "var(--color-success)" : isCurrent ? "var(--color-primary)" : "var(--color-border-strong)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-primary-on)", fontSize: 12, fontWeight: 700, boxShadow: isCurrent ? "0 0 0 3px color-mix(in srgb, var(--color-primary) 30%, transparent)" : undefined, animation: isCurrent ? "pulse 1.5s ease-in-out infinite" : undefined }}>{completed ? "✓" : wi + 1}</div>
              <Card style={{ padding: 16, background: C.card, borderRadius: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: C.text, marginBottom: 6 }}>{week.title}</div>
                <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 12 }}>{week.desc}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
                  {week.checks.map((label, ci) => (
                    <label key={ci} style={{ display: "flex", alignItems: "center", gap: 8, cursor: completed ? "default" : "pointer", fontSize: 13 }}>
                      <input type="checkbox" checked={completed ? true : weekChecks[wi][ci]} onChange={e => !completed && setWeekCheck(wi as 0 | 1 | 2 | 3, ci, e.target.checked)} style={{ width: 18, height: 18, accentColor: C.accent }} />
                      <span>□ {label}</span>
                    </label>
                  ))}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ marginBottom: 0 }}><CalendarDropdown label="완료일" value={dateVal || ""} onChange={(v) => { updateProgram({ [dateKey]: v || null }); if (weekChecks[wi].every(Boolean) && v) setWeekCompletedFromChecks(wi as 0 | 1 | 2 | 3, v, noteVal); }} /></div>
                  <textarea placeholder="메모" value={noteVal || ""} onChange={e => updateProgram({ [noteKey]: e.target.value || null })} style={{ width: "100%", padding: 10, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 13, minHeight: 60, resize: "vertical" }} />
                  {wi === 3 && <div style={{ marginTop: 8 }}><FormInput label="구역/셀 배정" value={program.cell_group_assigned || ""} onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateProgram({ cell_group_assigned: e.target.value || null })} placeholder="예: 1구역 A셀" /></div>}
                </div>
              </Card>
            </div>
          );
        })}
      </div>

      {program.status === "진행중" && allFourDone && (
        <div style={{ marginTop: 20, paddingTop: 16, borderTop: `1px solid ${C.border}` }}>
          <Btn onClick={handleComplete}>🎓 수료 처리</Btn>
          {!program.cell_group_assigned?.trim() && <span style={{ marginLeft: 8, fontSize: 13, color: C.orange }}>구역/셀 배정 후 수료 가능</span>}
        </div>
      )}

      <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 16 }}>
        <Btn variant="ghost" onClick={onClose}>닫기</Btn>
        <Btn
          disabled={saving}
          onClick={async () => {
            if (saveDb) {
              setSaving(true);
              try {
                await saveDb(db);
                toast("저장되었습니다", "ok");
                onClose();
              } catch (e) {
                console.error("정착 프로그램 저장 실패:", e);
                toast("저장 실패: " + (e instanceof Error ? e.message : String(e)), "err");
              } finally {
                setSaving(false);
              }
            } else {
              onSaved?.();
              onClose();
              toast("저장되었습니다", "ok");
            }
          }}
        >
          {saving ? "저장 중…" : "저장"}
        </Btn>
      </div>

      {showMentorSelect && (
        <Modal open onClose={() => setShowMentorSelect(false)} title="섬김이 선택">
          <div style={{ maxHeight: 320, overflowY: "auto" }}>
            {mentorCandidates.length === 0 ? <div style={{ padding: 24, textAlign: "center", color: C.textMuted }}>섬김이 학교 수료자를 먼저 등록해주세요.<br/><span style={{ fontSize: 12 }}>새가족 관리 → 섬김이 학교 탭에서 등록</span></div> : mentorCandidates.map(m => (
              <button
                key={m.id}
                type="button"
                onClick={() => setPendingMentorId(m.id)}
                style={{
                  display: "block", width: "100%", padding: "12px 16px", textAlign: "left", border: "none", borderBottom: `1px solid ${C.borderLight}`,
                  background: (pendingMentorId ?? program?.mentor_id) === m.id ? C.accentLight : C.card,
                  color: C.text, fontSize: 14, cursor: "pointer", borderRadius: 0,
                }}
              >
                {m.name} ({m.role || ""} {m.dept || ""})
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16, paddingTop: 12, borderTop: `1px solid ${C.border}` }}>
            <Btn variant="ghost" onClick={() => setShowMentorSelect(false)}>취소</Btn>
            <Btn
              onClick={() => {
                const toApply = pendingMentorId ?? program?.mentor_id ?? null;
                if (toApply) updateProgram({ mentor_id: toApply });
                setShowMentorSelect(false);
                setPendingMentorId(null);
                toast("섬김이 배정 저장되었습니다", "ok");
              }}
            >
              저장
            </Btn>
          </div>
        </Modal>
      )}

      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.6}}`}</style>
    </Modal>
  );
}

/* ====== Reports ====== */
function ReportsSub({ db, currentWeek, toast, churchId }: { db: DB; currentWeek: number; toast: (m: string, t?: string) => void; churchId: string | null }) {
  const mob = useIsMobile();
  const [selectedReport, setSelectedReport] = useState<ReportId | null>(null);
  const churchName = db.settings?.churchName || "교회";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header */}
      <div style={{ marginBottom: mob ? 4 : 8 }}>
        <h2 style={{ fontSize: mob ? 18 : 20, fontWeight: 700, color: C.text, margin: "0 0 4px" }}>보고서</h2>
        <p style={{ fontSize: mob ? 12 : 13, color: C.textMuted, margin: 0 }}>
          보고서를 선택하면 A4 미리보기가 표시됩니다. PDF로 다운로드하거나 인쇄할 수 있습니다.
        </p>
      </div>

      {/* Report Card Grid */}
      <div style={{
        display: "grid",
        gridTemplateColumns: mob ? "1fr" : "repeat(auto-fill, minmax(220px, 1fr))",
        gap: mob ? 10 : 16,
      }}>
        {REPORT_DEFS.map(report => (
          <button
            key={report.id}
            onClick={() => setSelectedReport(report.id)}
            style={{
              display: "flex", flexDirection: "column", alignItems: "flex-start",
              padding: mob ? 16 : 20,
              background: C.card,
              border: `1px solid ${C.border}`,
              borderRadius: 12,
              cursor: "pointer",
              textAlign: "left",
              minHeight: mob ? 100 : 120,
              transition: "all 0.2s",
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--color-primary)"; e.currentTarget.style.boxShadow = "0 2px 12px rgba(0,0,0,0.18)"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--color-border)"; e.currentTarget.style.boxShadow = "none"; }}
          >
            <report.Icon size={22} strokeWidth={1.5} color="var(--color-text-muted)" style={{ marginBottom: 12 }} />
            <span style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 4 }}>{report.title}</span>
            <span style={{ fontSize: 12, color: C.textMuted }}>{report.description}</span>
          </button>
        ))}
      </div>

      {/* A4 Preview Modal */}
      {selectedReport && (
        <ReportPreviewModal
          reportId={selectedReport}
          db={db}
          churchName={churchName}
          churchId={churchId || ""}
          onClose={() => setSelectedReport(null)}
        />
      )}
    </div>
  );
}

/* ====== Settings (목장그룹관리: 목양 탭 전용, 교회 전체 설정 제외) ====== */
function SettingsSub({ db, setDb, persist, toast, saveDb, mokjangOnly = false }: { db: DB; setDb: (fn: (prev: DB) => DB) => void; persist: () => void; toast: (m: string, t?: string) => void; saveDb: (d: DB) => Promise<void>; mokjangOnly?: boolean }) {
  const mob = useIsMobile();
  const [mokjangManage, setMokjangManage] = useState<string | null>(null);
  const [addMemberSelect, setAddMemberSelect] = useState("");
  const mokjangList = getMokjangList(db);

  const addMokjang = () => {
    const name = window.prompt("새 목장 이름을 입력하세요");
    if (!name || !name.trim()) return;
    const trimmed = name.trim();
    if (mokjangList.includes(trimmed)) { toast("이미 있는 목장입니다", "err"); return; }
    setDb(prev => ({ ...prev, settings: { ...prev.settings, mokjangList: [...mokjangList, trimmed].join(", ") } }));
    persist();
    toast("목장이 추가되었습니다", "ok");
  };

  const renameMokjang = (oldName: string) => {
    const newName = window.prompt("목장 이름 변경", oldName);
    if (!newName || !newName.trim() || newName.trim() === oldName) return;
    const trimmed = newName.trim();
    if (mokjangList.includes(trimmed) && trimmed !== oldName) { toast("이미 있는 목장 이름입니다", "err"); return; }
    const newList = mokjangList.map(g => g === oldName ? trimmed : g);
    setDb(prev => ({
      ...prev,
      settings: { ...prev.settings, mokjangList: newList.join(", ") },
      members: prev.members.map(m => (m.mokjang ?? m.group) === oldName ? { ...m, group: trimmed, mokjang: trimmed } : m),
    }));
    persist();
    toast("목장 이름이 변경되었습니다", "ok");
  };

  const deleteMokjang = (name: string) => {
    if (!window.confirm(`"${name}" 목장을 삭제하면 해당 성도들은 미배정으로 바뀝니다. 계속할까요?`)) return;
    const newList = mokjangList.filter(g => g !== name);
    setDb(prev => ({
      ...prev,
      settings: { ...prev.settings, mokjangList: newList.join(", ") },
      members: prev.members.map(m => (m.mokjang ?? m.group) === name ? { ...m, group: "", mokjang: "" } : m),
    }));
    persist();
    toast("목장이 삭제되었습니다", "ok");
    if (mokjangManage === name) setMokjangManage(null);
  };

  const removeMemberFromMokjang = (memberId: string) => {
    if (!mokjangManage) return;
    setDb(prev => ({ ...prev, members: prev.members.map(m => m.id === memberId ? { ...m, group: "", mokjang: "" } : m) }));
    persist();
    toast("목장에서 제거되었습니다", "ok");
  };

  const addMemberToMokjang = () => {
    if (!mokjangManage || !addMemberSelect) return;
    setDb(prev => ({ ...prev, members: prev.members.map(m => m.id === addMemberSelect ? { ...m, group: mokjangManage, mokjang: mokjangManage } : m) }));
    persist();
    setAddMemberSelect("");
    toast("목장에 추가되었습니다", "ok");
  };

  const handleSaveSettings = () => {
    persist();
    saveDb(db).then(() => toast("저장되었습니다", "ok")).catch(() => toast("저장 실패", "err"));
  };

  const formInMob: CSSProperties | undefined = mob
    ? { height: 32, fontSize: 12, padding: "6px 10px", borderRadius: 8, boxSizing: "border-box" }
    : undefined;
  const mokRowBtnPrimary: CSSProperties = { padding: mob ? "4px 10px" : "4px 12px", fontSize: mob ? 11 : 12, border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600, fontFamily: "inherit", background: "var(--color-primary)", color: "var(--color-primary-on)", boxSizing: "border-box" };
  const mokRowBtnSecondary: CSSProperties = { padding: mob ? "4px 10px" : "4px 12px", fontSize: mob ? 11 : 12, border: `1px solid ${C.border}`, borderRadius: 6, cursor: "pointer", fontWeight: 600, fontFamily: "inherit", background: C.bg, color: C.textMuted, boxSizing: "border-box" };
  const mokRowBtnMuted: CSSProperties = { ...mokRowBtnSecondary, color: C.textFaint };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: mob ? 12 : 16, maxWidth: mob ? "100%" : 960 }}>
      {!mokjangOnly && (
        <Card>
          <h4 style={{ fontSize: mob ? 14 : 17, fontWeight: 700, color: C.text, marginBottom: mob ? 14 : 20 }}>교회 설정</h4>
          <FormInput label="교회 이름" value={db.settings.churchName || ""} placeholder="○○교회"
            style={formInMob}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setDb(prev => ({ ...prev, settings: { ...prev.settings, churchName: e.target.value } })); persist(); }} />
          <FormInput label="교단" value={db.settings.denomination || ""} placeholder="예: 침례교, 장로교, 감리교 (침례교면 증서에 침례 표기)"
            style={formInMob}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setDb(prev => ({ ...prev, settings: { ...prev.settings, denomination: e.target.value } })); persist(); }} />
          <FormInput label="부서 목록 (쉼표 구분)" value={db.settings.depts || ""} placeholder="유아부,유치부,유년부,초등부,중등부,고등부,청년부,장년부"
            style={formInMob}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setDb(prev => ({ ...prev, settings: { ...prev.settings, depts: e.target.value } })); persist(); }} />
          <div style={{ marginTop: 12 }}>
            <Btn onClick={handleSaveSettings}>저장</Btn>
          </div>
        </Card>
      )}
      <Card
        style={
          mob
            ? { padding: "10px 12px", borderRadius: 16, border: `1px solid ${C.border}`, background: C.card, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }
            : { border: `1px solid ${C.border}`, background: C.card, borderRadius: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }
        }
      >
        <h4 style={{ fontSize: mob ? 13 : 16, fontWeight: 700, color: "var(--color-text)", margin: 0, marginBottom: mob ? 8 : 16 }}>목장 관리</h4>
        <p style={{ fontSize: mob ? 11 : 13, color: C.textFaint, margin: 0, marginBottom: mob ? 8 : 12, lineHeight: 1.45 }}>목장을 생성·이름 변경·삭제하고, 그룹원을 추가·제거할 수 있습니다.</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 0, marginBottom: 12 }}>
          {mokjangList.map((g, idx) => {
            const count = db.members.filter(m => ((m.mokjang ?? m.group) || "") === g).length;
            return (
              <div
                key={g}
                style={{
                  display: "flex",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: mob ? 6 : 8,
                  padding: mob ? "8px 0" : "12px 0",
                  fontSize: mob ? 12 : 14,
                  borderBottom: idx < mokjangList.length - 1 ? "1px solid #f0f2f5" : "none",
                }}
              >
                <span style={{ fontWeight: 700, color: "var(--color-text)", flex: mob ? "1 1 100%" : undefined, minWidth: 0 }}>{g}</span>
                <span style={{ fontSize: mob ? 11 : 12, color: C.textFaint }}>{count}명</span>
                <button type="button" onClick={() => { setMokjangManage(g); setAddMemberSelect(""); }} style={mokRowBtnPrimary}>그룹원 관리</button>
                <button type="button" onClick={() => renameMokjang(g)} style={mokRowBtnSecondary}>이름 변경</button>
                <button type="button" onClick={() => deleteMokjang(g)} style={mokRowBtnMuted}>삭제</button>
              </div>
            );
          })}
        </div>
        <button
          type="button"
          onClick={addMokjang}
          style={{
            height: mob ? 32 : 36,
            fontSize: mob ? 12 : 13,
            padding: mob ? "0 12px" : "0 14px",
            borderRadius: mob ? 6 : 8,
            background: "var(--color-primary)",
            color: "var(--color-primary-on)",
            border: "none",
            fontWeight: 600,
            fontFamily: "inherit",
            cursor: "pointer",
            boxSizing: "border-box",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          + 목장 추가
        </button>
      </Card>

      {mokjangManage && (
        <Modal open={true} onClose={() => { setMokjangManage(null); setAddMemberSelect(""); }} title={`${mokjangManage} 그룹원 관리`} width={480}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 6 }}>현재 그룹원</label>
            {db.members.filter(m => ((m.mokjang ?? m.group) || "") === mokjangManage).length === 0 ? (
              <div style={{ padding: 12, background: C.bg, borderRadius: 8, fontSize: 13, color: C.textMuted }}>아직 배정된 성도가 없습니다. 아래에서 추가하세요.</div>
            ) : (
              <ul style={{ margin: 0, padding: 0, listStyle: "none", maxHeight: 200, overflowY: "auto" }}>
                {db.members.filter(m => ((m.mokjang ?? m.group) || "") === mokjangManage).map(m => (
                  <li key={m.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 10px", borderBottom: `1px solid ${C.borderLight}`, fontSize: 14, minWidth: 0 }}>
                    <span style={{ fontWeight: 600, color: C.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}>{m.name}</span>
                    <span style={{ fontSize: 12, color: C.textMuted }}>{m.dept || ""} {m.role || ""}</span>
                    <button type="button" onClick={() => removeMemberFromMokjang(m.id)} style={{ padding: "4px 10px", fontSize: 12, border: `1px solid ${C.border}`, background: C.bg, color: C.textFaint, borderRadius: 6, cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}>목장에서 제거</button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 6 }}>성도 추가</label>
            <select value={addMemberSelect} onChange={e => setAddMemberSelect(e.target.value)} className="select-modern" style={{ marginBottom: 8 }}>
              <option value="">선택하세요</option>
              {db.members.filter(m => ((m.mokjang ?? m.group) || "") !== mokjangManage && m.status !== "졸업/전출").map(m => (
                <option key={m.id} value={m.id}>{m.name} ({m.dept || ""}) {!(m.mokjang ?? m.group) ? "· 미배정" : `· ${m.mokjang ?? m.group}`}</option>
              ))}
            </select>
            <Btn size="sm" onClick={addMemberToMokjang} disabled={!addMemberSelect}>추가</Btn>
          </div>
          <div style={{ marginTop: 16 }}>
            <Btn variant="ghost" onClick={() => { setMokjangManage(null); setAddMemberSelect(""); }}>닫기</Btn>
          </div>
        </Modal>
      )}
      {/* 데이터(백업·복원·초기화): 향후 별도 설정 탭으로 이전 예정 — 목장그룹관리에서는 숨김 */}
    </div>
  );
}

/* ============================================================
   MAIN COMPONENT
   ============================================================ */
type SubPage = "dashboard" | "members" | "attendance" | "notes" | "newfamily" | "ceremony" | "settings";

const NAV_ITEMS: { id: SubPage; Icon: React.ComponentType<any>; label: string }[] = [
  { id: "dashboard", Icon: LayoutDashboard, label: "대시보드" },
  { id: "members", Icon: Users, label: "성도 관리" },
  { id: "attendance", Icon: ClipboardList, label: "출석부" },
  { id: "notes", Icon: PrayingHandsIcon, label: "기도/메모" },
  { id: "newfamily", Icon: Sprout, label: "새가족 관리" },
  { id: "ceremony", Icon: BookOpenCheck, label: "식순" },
  { id: "settings", Icon: Settings, label: "목장그룹관리" },
];

const PAGE_INFO: Record<SubPage, { title: string; desc: string; addLabel?: string }> = {
  dashboard: { title: "목양 대시보드", desc: "목양 현황을 한눈에 파악합니다" },
  members: { title: "성도 관리", desc: "성도의 삶을 기억하고 돌봅니다" },
  attendance: { title: "출석부", desc: "주일예배 출석·통계를 관리합니다" },
  notes: { title: "기도/메모", desc: "기도제목과 특이사항을 공유합니다", addLabel: "+ 기도" },
  newfamily: { title: "새가족 관리", desc: "새가족 4주 정착 트래킹", addLabel: "+ 새가족 등록" },
  ceremony: { title: "식순 가이드", desc: "예배·예식·성례 모든 교회 순서를 단계별로 진행합니다" },
  settings: { title: "목장그룹관리", desc: "목장·소그룹 생성 및 그룹원 관리" },
};

const SUB_PAGE_IDS: SubPage[] = ["dashboard", "members", "attendance", "notes", "newfamily", "ceremony", "settings"];

export function PastoralPage({ db, setDb, saveDb }: { db: DB; setDb: (fn: (prev: DB) => DB) => void; saveDb?: (d: DB) => Promise<void> }) {
  const { churchId } = useAuth();
  const { rawAttendance, refreshMembers, refreshNotes, refreshVisits, refreshNewFamilyPrograms, schoolDepartments, schoolEnrollments } = useAppData();
  const mob = useIsMobile();
  const [activeSub, setActiveSubState] = useState<SubPage>(() => {
    if (typeof window === "undefined") return "dashboard";
    const v = sessionStorage.getItem("pastoralSubTab");
    return (SUB_PAGE_IDS.includes(v as SubPage) ? v : "dashboard") as SubPage;
  });
  const setActiveSub = useCallback((id: SubPage) => setActiveSubState(id), []);
  useEffect(() => {
    if (typeof window !== "undefined") sessionStorage.setItem("pastoralSubTab", activeSub);
  }, [activeSub]);
  const [currentWeek, setCurrentWeek] = useState(getWeekNum);
  const [toasts, setToasts] = useState<{ id: number; msg: string; type: string }[]>([]);

  // Modals
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [editMbrId, setEditMbrId] = useState<string | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [programDetailMemberId, setProgramDetailMemberId] = useState<string | null>(null);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [noteTargetId, setNoteTargetId] = useState<string | null>(null);
  const [prayerModalMemberId, setPrayerModalMemberId] = useState<string | null>(null);
  const [quickNoteOpen, setQuickNoteOpen] = useState(false);
  const [quickNoteMemberId, setQuickNoteMemberId] = useState("");
  const [quickNoteMemberName, setQuickNoteMemberName] = useState("");
  const [quickNoteType, setQuickNoteType] = useState<"note" | "prayer">("note");

  // Member form
  const [fName, setFName] = useState(""); const [fDept, setFDept] = useState(""); const [fRole, setFRole] = useState("");
  const [fBirth, setFBirth] = useState(""); const [fGender, setFGender] = useState(""); const [fPhone, setFPhone] = useState("");
  const [fAddr, setFAddr] = useState(""); const [fFamily, setFFamily] = useState(""); const [fStatus, setFStatus] = useState("새가족");
  const [fSource, setFSource] = useState(""); const [fPrayer, setFPrayer] = useState(""); const [fMemo, setFMemo] = useState("");
  const [fGroup, setFGroup] = useState(""); const [fPhoto, setFPhoto] = useState("");
  const [fPhotoServerUrl, setFPhotoServerUrl] = useState("");
  const [photoUploading, setPhotoUploading] = useState(false);
  const [fVisitPath, setFVisitPath] = useState(""); const [fReferrerId, setFReferrerId] = useState(""); const [fJob, setFJob] = useState(""); const [fFirstVisitDate, setFFirstVisitDate] = useState(todayStr());
  const photoRef = useRef<HTMLInputElement>(null);

  // Note form
  const [nDate, setNDate] = useState(todayStr()); const [nType, setNType] = useState<Note["type"]>("prayer"); const [nContent, setNContent] = useState("");
  const [noteTargetType, setNoteTargetType] = useState<"all" | "individual">("all");
  const [noteSelectedMemberId, setNoteSelectedMemberId] = useState("");
  const [noteMemberSearchText, setNoteMemberSearchText] = useState("");
  const [noteMemberDropdownOpen, setNoteMemberDropdownOpen] = useState(false);
  const memberDeptMap = useMemo(() => {
    const deptById: Record<string, string> = {};
    schoolDepartments.forEach((d) => { deptById[d.id] = d.name; });
    const map: Record<string, string> = {};
    schoolEnrollments.forEach((e) => {
      if (e.department_id && deptById[e.department_id]) map[e.member_id] = deptById[e.department_id];
    });
    return map;
  }, [schoolDepartments, schoolEnrollments]);
  const noteMemberDropdownRef = useRef<HTMLDivElement>(null);

  // 출결 Phase 3: 예배별 출결
  type AttendanceSubTab = "dashboard" | "check" | "absentee" | "statistics" | "bulletin";
  const ATTENDANCE_SUB_IDS: AttendanceSubTab[] = ["dashboard", "statistics", "check", "absentee", "bulletin"];
  const [attendanceSubTab, setAttendanceSubTabState] = useState<AttendanceSubTab>(() => {
    if (typeof window === "undefined") return "dashboard";
    const v = localStorage.getItem("pastoral_attendance_sub_tab");
    if (v === "weekly") return "check";
    return (ATTENDANCE_SUB_IDS.includes(v as AttendanceSubTab) ? v : "dashboard") as AttendanceSubTab;
  });
  const setAttendanceSubTab = useCallback((id: AttendanceSubTab) => setAttendanceSubTabState(id), []);
  const attendanceSegmentItems = useMemo(
    () => [
      { id: "dashboard", label: "대시보드" },
      { id: "statistics", label: "출석 통계" },
      { id: "check", label: "출석 체크" },
      { id: "absentee", label: "결석자 관리" },
      { id: "bulletin", label: "월간 게시판" },
    ],
    [],
  );
  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem("pastoral_attendance_sub_tab", attendanceSubTab);
  }, [attendanceSubTab]);
  const [dateBasedAttendance, setDateBasedAttendance] = useState<Attendance[]>([]);

  // 출석부 대시보드/결석자/통계: Supabase attendance 테이블(date + service_type)에서 로드 (출석 체크 탭과 동일 소스)
  const DB_STATUS_TO_UI: Record<string, Attendance["status"]> = { p: "출석", o: "온라인", a: "결석", l: "병결", n: "기타" };

  const fetchDateBasedAttendance = useCallback(() => {
    if (!supabase || !churchId) return;
    const end = new Date();
    const start = new Date(end);
    start.setDate(start.getDate() - 16 * 7);
    const startStr = start.toISOString().slice(0, 10);
    const endStr = end.toISOString().slice(0, 10);
    supabase
      .from("attendance")
      .select("id, member_id, date, status, service_type")
      .eq("church_id", churchId)
      .eq("service_type", "주일예배")
      .gte("date", startStr)
      .lte("date", endStr)
      .then(({ data, error }) => {
        if (error) {
          console.warn("[PastoralPage] dateBasedAttendance load error:", error.message);
          return;
        }
        const list: Attendance[] = (data ?? []).map((r: { id?: string; member_id?: string; date?: string; status?: string; service_type?: string }) => ({
          id: String(r.id ?? ""),
          member_id: String(r.member_id ?? ""),
          date: String(r.date ?? ""),
          status: (DB_STATUS_TO_UI[r.status ?? ""] ?? "결석") as Attendance["status"],
          service_type: r.service_type ?? undefined,
        }));
        setDateBasedAttendance(list);
      });
  }, [churchId]);

  useEffect(() => {
    if (!churchId) return;
    fetchDateBasedAttendance();
  }, [churchId, activeSub, attendanceSubTab, fetchDateBasedAttendance]);

  /** 출석 체크 저장 후 호출: db.attendance(주차별)와 dateBasedAttendance를 재조회해 성도 관리 등에 즉시 반영 */
  const refetchAttendanceAfterSave = useCallback(() => {
    if (!supabase || !churchId) return;
    supabase
      .from("attendance")
      .select("id, member_id, week_num, date, status, reason")
      .eq("church_id", churchId)
      .then(({ data, error }: { data: unknown[] | null; error: { message: string; details?: unknown } | null }) => {
        if (error) {
          console.warn("[PastoralPage] refetchAttendance error:", error.message);
          return;
        }
        const attendance: DB["attendance"] = {};
        const attendanceReasons: Record<string, Record<number, string>> = {};
        (data ?? []).forEach((r) => {
          const row = r as Record<string, unknown>;
          const mid = row.member_id as string;
          const week = row.week_num as number;
          if (!mid) return;
          if (!attendance[mid]) attendance[mid] = {};
          const status = row.status as string;
          attendance[mid][week] = (status === "p" || status === "a" || status === "n" ? status : "n") as AttStatus;
          const reason = (row.note ?? row.reason) as string | undefined;
          if (reason?.trim()) {
            if (!attendanceReasons[mid]) attendanceReasons[mid] = {};
            attendanceReasons[mid][week] = reason;
          }
        });
        setDb((prev) => ({ ...prev, attendance, attendanceReasons }));
        fetchDateBasedAttendance();
      });
  }, [churchId, setDb, fetchDateBasedAttendance]);

  // Supabase 데이터가 없을 때 메인 대시보드와 동일한 db.attendance(주차별)를 날짜 기준으로 변환해 사용
  const attendanceListForDashboard = useMemo(() => {
    if (dateBasedAttendance.length > 0) return dateBasedAttendance;
    const year = new Date().getFullYear();
    const list: Attendance[] = [];
    db.members.forEach((m) => {
      const att = db.attendance?.[m.id] ?? {};
      for (let w = 1; w <= 52; w++) {
        const st = att[w];
        if (st !== "p" && st !== "o") continue;
        const date = getSundayForWeekNum(year, w);
        list.push({
          id: `${m.id}-${w}`,
          member_id: m.id,
          date,
          status: st === "p" ? "출석" : "온라인",
          service_type: "주일예배",
        });
      }
    });
    return list;
  }, [dateBasedAttendance, db.members, db.attendance]);

  const persist = useCallback(() => { /* 실제 저장은 아래 useEffect(db) 디바운스 저장으로 수행 */ }, []);

  const didMountRef = useRef(false);
  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }
    const t = setTimeout(() => {
      if (!saveDb) return;
      saveDb(db).catch(() => {});
    }, 400);
    return () => clearTimeout(t);
  }, [db, saveDb]);

  const toastIdRef = useRef(0);
  const toastTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const toast = useCallback((msg: string, type = "ok") => {
    const id = ++toastIdRef.current;
    setToasts(prev => [...prev.slice(-2), { id, msg, type }]);
    const tid = setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 2500);
    toastTimeoutsRef.current.push(tid);
  }, []);
  useEffect(() => () => { toastTimeoutsRef.current.forEach(clearTimeout); toastTimeoutsRef.current = []; }, []);

  const depts = getDepts(db);

  // Open member modal
  const openMemberModal = useCallback((id?: string) => {
    const m = id ? db.members.find(x => x.id === id) : null;
    setEditMbrId(id || null);
    const mokjangOptions = getMokjangList(db);
    if (m) {
      setFName(m.name || ""); setFDept(m.dept || ""); setFRole(m.role || "");
      setFBirth(m.birth || ""); setFGender(m.gender || ""); setFPhone(m.phone || "");
      setFAddr(m.address || ""); setFFamily(m.family || ""); setFStatus(m.status || "새가족");
      setFSource(m.source || ""); setFPrayer(m.prayer || ""); setFMemo(m.memo || ""); setFPhoto(m.photo || "");
      setFPhotoServerUrl(m.photo || "");
      setFGroup((m.mokjang ?? m.group) && mokjangOptions.includes((m.mokjang ?? m.group) || "") ? ((m.mokjang ?? m.group) || "") : ((m.mokjang ?? m.group) || ""));
      setFVisitPath((m.visit_path ?? m.visitPath) || ""); setFReferrerId(m.referrer_id || ""); setFJob(m.job || ""); setFFirstVisitDate((m.first_visit_date ?? m.firstVisitDate) || todayStr());
    } else {
      setFName(""); setFDept(""); setFRole(""); setFBirth(""); setFGender("");
      setFPhone(""); setFAddr(""); setFFamily(""); setFStatus("새가족"); setFSource("");
      setFPrayer(""); setFMemo(""); setFPhoto(""); setFPhotoServerUrl("");
      setFGroup("");
      setFVisitPath(""); setFReferrerId(""); setFJob(""); setFFirstVisitDate(todayStr());
    }
    setShowMemberModal(true);
  }, [db.members, db.settings.mokjangList, depts]);

  const saveMember = async () => {
    if (!fName.trim()) { toast("이름을 입력하세요", "err"); return; }
    if (photoUploading) {
      toast("사진 업로드 중입니다. 잠시 후 저장해 주세요.", "warn");
      return;
    }
    const photoToSave = getMemberPhotoForSave(fPhotoServerUrl, fPhoto);
    if ((fPhoto.trim() || fPhotoServerUrl.trim()) && !photoToSave) {
      toast("사진 업로드가 완료될 때까지 기다려 주세요.", "warn");
      return;
    }
    if (!supabase) {
      console.error("=== DB 저장 불가: Supabase 클라이언트 없음 ===");
      toast("저장할 수 없습니다. Supabase 연결을 확인하세요.", "err");
      return;
    }
    const isNewFamily = fStatus === "새가족" || fStatus === "정착중";
    const insertData = {
      name: fName.trim(),
      dept: fDept || null,
      role: fRole.trim() || null,
      birth: fBirth || null,
      gender: fGender || null,
      phone: fPhone.trim() || null,
      address: fAddr.trim() || null,
      family: fFamily.trim() || null,
      status: fStatus,
      is_new_family: isNewFamily,
      source: fSource || null,
      prayer: fPrayer.trim() || null,
      memo: fMemo.trim() || null,
      mokjang: fGroup || null,
      photo: photoToSave,
      visit_path: fVisitPath || null,
      referrer_id: fReferrerId || null,
      job: fJob.trim() || null,
      first_visit_date: fFirstVisitDate || null,
      member_status: "활동",
    };
    try {
      if (!churchId) {
        alert("church_id가 없습니다. 로그인 상태를 확인해주세요.");
        return;
      }
      if (editMbrId) {
        const { data, error } = await supabase.from("members").update(insertData).eq("church_id", churchId).eq("id", editMbrId).select();
        console.log("=== [PastoralPage] DB UPDATE 결과 ===", { data, error });
        if (error) {
          console.error("=== [PastoralPage] DB ERROR ===", error.message, error.details, error.hint);
          alert("저장 실패: " + error.message);
          return;
        }
        const dataMerged: Partial<Member> = {
          name: insertData.name, dept: insertData.dept ?? undefined, role: insertData.role ?? undefined, birth: insertData.birth ?? undefined,
          gender: insertData.gender ?? undefined, phone: insertData.phone ?? undefined, address: insertData.address ?? undefined, family: insertData.family ?? undefined,
          status: insertData.status, is_new_family: insertData.is_new_family, source: insertData.source ?? undefined, prayer: insertData.prayer ?? undefined, memo: insertData.memo ?? undefined,
          photo: insertData.photo ?? undefined, group: insertData.mokjang ?? undefined, visit_path: insertData.visit_path as Member["visit_path"], referrer_id: insertData.referrer_id ?? undefined,
          job: insertData.job ?? undefined, first_visit_date: insertData.first_visit_date ?? undefined,
        };
        setDb(prev => ({ ...prev, members: prev.members.map(m => m.id === editMbrId ? { ...m, ...dataMerged } : m) }));
        refreshMembers();
        toast("수정 완료", "ok");
      } else {
        const insertPayload = { ...insertData, church_id: churchId };
        const { data, error } = await supabase.from("members").insert(insertPayload).select();
        console.log("=== [PastoralPage] DB INSERT 결과 ===", { data, error });
        if (error) {
          console.error("=== [PastoralPage] DB ERROR ===", error.message, error.details, error.hint);
          alert("저장 실패: " + error.message);
          return;
        }
        const row = Array.isArray(data) ? data[0] : data;
        const newId = (row as { id: string } | undefined)?.id ?? (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : "mb_" + uid());
        const newMember: Member = {
          id: newId,
          name: insertData.name,
          dept: insertData.dept ?? undefined,
          role: insertData.role ?? undefined,
          birth: insertData.birth ?? undefined,
          gender: insertData.gender ?? undefined,
          phone: insertData.phone ?? undefined,
          address: insertData.address ?? undefined,
          family: insertData.family ?? undefined,
          status: insertData.status,
          is_new_family: insertData.is_new_family,
          source: insertData.source ?? undefined,
          prayer: insertData.prayer ?? undefined,
          memo: insertData.memo ?? undefined,
          photo: insertData.photo ?? undefined,
          group: insertData.mokjang ?? undefined,
          mokjang: insertData.mokjang ?? undefined,
          visit_path: insertData.visit_path as Member["visit_path"],
          referrer_id: insertData.referrer_id ?? undefined,
          job: insertData.job ?? undefined,
          first_visit_date: insertData.first_visit_date ?? undefined,
          createdAt: todayStr(),
        };
        const startDate = fFirstVisitDate || todayStr();
        setDb(prev => {
          const next = { ...prev, members: [...prev.members, newMember] };
          if (fStatus === "새가족" || fStatus === "정착중") {
            const program: NewFamilyProgram = {
              id: uuid(),
              member_id: newId,
              mentor_id: null,
              program_start_date: startDate,
              week1_completed: false, week1_date: null, week1_note: null,
              week2_completed: false, week2_date: null, week2_note: null,
              week3_completed: false, week3_date: null, week3_note: null,
              week4_completed: false, week4_date: null, week4_note: null,
              status: "진행중",
              cell_group_assigned: null,
            };
            next.newFamilyPrograms = [...(prev.newFamilyPrograms || []), program];
          }
          return next;
        });
        refreshMembers();
        toast("등록 완료", "ok");
      }
      setShowMemberModal(false);
    } catch (e) {
      console.error("=== saveMember 예외 ===", e);
      alert("저장 중 오류가 발생했습니다.");
    }
  };

  const closeMemberModal = () => {
    const hasInput = fName.trim() || fRole.trim() || fBirth || fPhone.trim() || fAddr.trim() || fFamily.trim() || fPrayer.trim() || fMemo.trim() || fPhoto;
    if (hasInput && typeof window !== "undefined" && !window.confirm("작성 중인 내용이 있습니다. 닫으시겠습니까?")) return;
    setShowMemberModal(false);
  };

  const openDetail = useCallback((id: string) => { setDetailId(id); setShowDetailModal(true); }, []);
  const openPrayerModal = useCallback((id: string) => { setPrayerModalMemberId(id); }, []);

  const deleteMember = async (id: string) => {
    if (typeof window !== "undefined" && !window.confirm("삭제하시겠습니까?")) return;
    const member = db.members.find(m => m.id === id);
    await deleteMemberPhotoFromStorage(member?.photo);

    if (supabase) {
      try {
        const cid = churchId ?? getChurchId();
        const { error } = await supabase.from("members").delete().eq("id", id).eq("church_id", cid);
        if (error) {
          console.error("성도 삭제 실패:", error);
          toast("삭제 실패: " + error.message, "err");
          return;
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error("성도 삭제 실패:", e);
        toast("삭제 실패: " + msg, "err");
        return;
      }
    }

    setDb(prev => {
      const { [id]: _a, ...att } = prev.attendance;
      const { [id]: _ar, ...attReasons } = prev.attendanceReasons || {};
      const { [id]: _n, ...notes } = prev.notes;
      const newFamilyPrograms = (prev.newFamilyPrograms || []).filter(p => p.member_id !== id);
      return { ...prev, members: prev.members.filter(m => m.id !== id), attendance: att, attendanceReasons: attReasons, notes, newFamilyPrograms };
    });
    refreshMembers();
    setShowDetailModal(false);
    setProgramDetailMemberId(null);
    toast("삭제 완료", "warn");
  };

  const openQuickNote = useCallback((memberId: string, memberName: string, type: "note" | "prayer") => {
    setQuickNoteMemberId(memberId);
    setQuickNoteMemberName(memberName);
    setQuickNoteType(type);
    setQuickNoteOpen(true);
  }, []);

  const handleQuickNoteSaved = useCallback((memberId: string, type: "memo" | "prayer", items: QuickNoteItem[], latestPrayerContent?: string) => {
    setDb(prev => {
      const notes = { ...prev.notes };
      const current = notes[memberId] || [];
      const others = current.filter(n => n.type !== type);
      const merged = [...others, ...items.map(it => ({ date: it.date, type, content: it.content, createdAt: it.created_at }))];
      notes[memberId] = merged;
      let members = prev.members;
      if (type === "prayer" && latestPrayerContent !== undefined) {
        members = members.map(m => m.id === memberId ? { ...m, prayer: latestPrayerContent } : m);
      }
      return { ...prev, notes, members };
    });
  }, [setDb]);

  const openNoteModal = useCallback((id?: string) => {
    setNoteTargetId(id || null);
    setNDate(todayStr()); setNType("prayer"); setNContent("");
    setNoteTargetType(id ? "individual" : "all");
    setNoteSelectedMemberId(id || "");
    setNoteMemberSearchText("");
    setNoteMemberDropdownOpen(false);
    setShowNoteModal(true);
  }, []);

  useEffect(() => {
    if (!noteMemberDropdownOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (noteMemberDropdownRef.current && !noteMemberDropdownRef.current.contains(e.target as Node)) setNoteMemberDropdownOpen(false);
    };
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, [noteMemberDropdownOpen]);

  const saveNote = () => {
    const mid: string = noteTargetType === "all" ? NOTE_TARGET_CHURCH : (noteSelectedMemberId || noteTargetId || "");
    if (!nContent.trim()) { toast("내용을 입력하세요", "err"); return; }
    if (noteTargetType === "individual" && !mid) { toast("성도를 선택하세요", "err"); return; }
    const trimmed = nContent.trim();
    setDb(prev => {
      const notes = { ...prev.notes };
      if (!notes[mid]) notes[mid] = [];
      notes[mid] = [...notes[mid], { date: nDate, type: nType, content: trimmed, createdAt: new Date().toISOString() }];
      let members = prev.members;
      if (nType === "prayer" && mid !== NOTE_TARGET_CHURCH) { members = members.map(m => m.id === mid ? { ...m, prayer: trimmed } : m); }
      return { ...prev, notes, members };
    });
    const cid = churchId ?? getChurchId();
    if (supabase && cid) {
      void (async () => {
        try {
          await supabase.from("notes").insert({
            member_id: mid,
            church_id: cid,
            date: nDate,
            type: nType,
            content: trimmed,
          });
        } catch (e) {
          console.error("노트 저장 실패:", e);
        }
      })();
    }
    setShowNoteModal(false); toast("기록 저장 완료", "ok");
  };

  const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const localPreview = URL.createObjectURL(file);
    setFPhoto(localPreview);
    setFPhotoServerUrl("");
    setPhotoUploading(true);
    try {
      const compressed = await compressImage(file, 400, 0.7);
      const fd = new FormData();
      fd.append("file", compressed);
      const r = await fetch("/api/upload-photo", { method: "POST", body: fd });
      const data = (await r.json()) as { url?: string; path?: string; error?: string };
      if (!r.ok || (!data.path && !data.url)) {
        toast(data.error || "업로드 실패", "err");
        URL.revokeObjectURL(localPreview);
        setFPhoto("");
        return;
      }
      URL.revokeObjectURL(localPreview);
      setFPhoto(data.url || localPreview);
      setFPhotoServerUrl(data.path || data.url || "");
    } catch {
      toast("사진 압축 또는 업로드 실패", "err");
      URL.revokeObjectURL(localPreview);
      setFPhoto("");
      setFPhotoServerUrl("");
    } finally {
      setPhotoUploading(false);
      e.target.value = "";
    }
  };

  const topAdd = () => {
    if (activeSub === "dashboard" || activeSub === "members" || activeSub === "newfamily") openMemberModal();
    else if (activeSub === "notes") openNoteModal();
  };

  const handleNav = (id: SubPage) => { setActiveSub(id); };

  const info = PAGE_INFO[activeSub];
  const detailMember = detailId ? db.members.find(x => x.id === detailId) : null;

  const navSections = [{ sectionLabel: "목양", items: NAV_ITEMS.map((n) => ({ id: n.id, label: n.label, Icon: n.Icon })) }];

  return (
    <>
    <UnifiedPageLayout
      pageTitle="목양"
      churchName={((db.settings.churchName || "").trim() || "교회 이름")}
      navSections={navSections}
      activeId={activeSub}
      onNav={(id) => handleNav(id as SubPage)}
      versionText="목양 v1.0"
      headerTitle={info.title}
      headerDesc={info.desc}
      headerActions={
        <>
          {info.addLabel && activeSub !== "notes" && <Btn variant="primary" size="sm" onClick={topAdd}>{mob ? "+" : info.addLabel}</Btn>}
        </>
      }
      SidebarIcon={Church}
      accentColor={tokens.color.navyEmphasis}
      contentBg={activeSub === "dashboard" ? DASH_GLOBAL.bg : undefined}
      contentPaddingLeft={activeSub === "dashboard" ? DASH_GLOBAL.contentPadLeft : undefined}
      contentPaddingRight={activeSub === "dashboard" ? DASH_GLOBAL.contentPadRight : undefined}
      contentPaddingBottom={activeSub === "dashboard" ? DASH_GLOBAL.contentPadBottom : undefined}
      contentTopGap={activeSub === "dashboard" ? DASH_GLOBAL.contentPadTop : undefined}
      contentFontFamily={activeSub === "dashboard" ? DASH_GLOBAL.fontKR : undefined}
      hideHeader={activeSub === "dashboard"}
    >
          {activeSub === "dashboard" && <DashboardSub db={db} currentWeek={currentWeek} rawAttendance={rawAttendance} onNavSub={setActiveSub} />}
          {activeSub === "members" && <MembersSub db={db} setDb={fn => setDb(fn)} persist={persist} toast={toast} currentWeek={currentWeek} openMemberModal={openMemberModal} openDetail={openDetail} openNoteModal={openNoteModal} openQuickNote={openQuickNote} churchId={churchId} />}
          {activeSub === "attendance" && (
            <>
              <div
                style={{
                  marginBottom: mob ? 6 : 16,
                  paddingBottom: mob ? 8 : 12,
                  borderBottom: "none",
                  boxSizing: "border-box",
                  ...(mob
                    ? {}
                    : {
                        position: "static",
                        background: "transparent",
                        paddingTop: 0,
                        paddingBottom: 0,
                      }),
                }}
              >
                {mob ? (
                  <>
                    {([
                      { gridTemplateColumns: "1fr 1fr", slice: [0, 2] as const },
                      { gridTemplateColumns: "1fr 1fr", slice: [2, 4] as const },
                    ] as const).map((row, rowIdx) => (
                      <div
                        key={rowIdx}
                        style={{
                          display: "grid",
                          gridTemplateColumns: row.gridTemplateColumns,
                          gap: 6,
                          marginBottom: 6,
                          width: "100%",
                          minWidth: 0,
                        }}
                      >
                        {attendanceSegmentItems.slice(row.slice[0], row.slice[1]).map((item) => {
                          const active = attendanceSubTab === item.id;
                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => setAttendanceSubTab(item.id as AttendanceSubTab)}
                              style={{
                                width: "100%",
                                height: 34,
                                fontSize: 11,
                                fontWeight: 600,
                                borderRadius: 8,
                                border: active ? "1px solid var(--color-primary)" : `1px solid ${C.border}`,
                                fontFamily: "inherit",
                                cursor: "pointer",
                                boxSizing: "border-box",
                                background: active ? C.accentBg : C.card,
                                color: active ? C.accent : C.textMuted,
                              }}
                            >
                              {item.label}
                            </button>
                          );
                        })}
                      </div>
                    ))}
                  </>
                ) : (
                  <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12 }}>
                    {attendanceSegmentItems.map((item) => {
                      const active = attendanceSubTab === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setAttendanceSubTab(item.id as AttendanceSubTab)}
                          style={{
                            height: 34,
                            padding: "0 16px",
                            borderRadius: 10,
                            border: active ? "1px solid var(--color-primary)" : `1px solid ${C.border}`,
                            background: active ? C.accentBg : C.card,
                            color: active ? C.accent : C.textMuted,
                            fontSize: 13,
                            fontWeight: 600,
                            fontFamily: "inherit",
                            cursor: "pointer",
                            whiteSpace: "nowrap",
                            boxSizing: "border-box",
                          }}
                        >
                          {item.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              {attendanceSubTab === "dashboard" && (
                <div style={{ width: "100%", minHeight: mob ? undefined : 520 }}>
                  <AttendanceDashboard
                    members={db.members}
                    attendanceList={attendanceListForDashboard}
                    onOpenCheck={() => setAttendanceSubTab("check")}
                    onOpenAbsentee={() => setAttendanceSubTab("absentee")}
                    onOpenAbsenteeList={() => setAttendanceSubTab("absentee")}
                  />
                </div>
              )}
              {attendanceSubTab === "check" && (
                <AttendanceCheck
                  members={db.members}
                  toast={toast}
                  onAttendanceSaved={refetchAttendanceAfterSave}
                />
              )}
              {attendanceSubTab === "absentee" && (
                <AbsenteeManagement
                  members={db.members}
                  attendanceList={attendanceListForDashboard}
                  consecutiveWeeks={3}
                  toast={toast}
                  onAddVisit={(memberId) => { setNoteTargetId(memberId); setShowNoteModal(true); toast("심방 등록은 기도/메모에서 기록해 주세요", "ok"); }}
                />
              )}
              {attendanceSubTab === "statistics" && (
                <div style={{ width: "100%", minHeight: mob ? undefined : 520 }}>
                  <AttendanceStatistics
                    members={db.members}
                    attendanceList={attendanceListForDashboard}
                    toast={toast}
                  />
                </div>
              )}
              {attendanceSubTab === "bulletin" && (
                <div style={{ width: "100%", minHeight: mob ? undefined : 520 }}>
                  <MonthlyAttendanceBulletin />
                </div>
              )}
            </>
          )}
          {activeSub === "notes" && <NotesSub db={db} setDb={fn => setDb(fn)} persist={persist} openPrayerModal={openPrayerModal} openNoteModal={openNoteModal} />}
          {activeSub === "newfamily" && <NewFamilySub db={db} setDb={fn => setDb(fn)} openProgramDetail={setProgramDetailMemberId} openMemberModal={openMemberModal} toast={toast} />}
          {activeSub === "ceremony" && <CeremonyBoard toast={toast} />}
          {activeSub === "settings" && <SettingsSub db={db} setDb={fn => setDb(fn)} persist={persist} toast={toast} saveDb={saveDBToSupabase} mokjangOnly />}
    </UnifiedPageLayout>

      {/* ===== MODALS ===== */}

      {/* Member Modal */}
      <Modal open={showMemberModal} onClose={closeMemberModal} title={editMbrId ? "성도 수정" : "성도 등록"} hideScrollbar>
        {/* 프로필 사진 — 맨 위, 원형 100px. 클릭 시 파일 선택. 미리보기는 <img>로 표시 (backgroundImage는 URL 특수문자로 깨질 수 있음) */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
          <label
            onClick={() => {}}
            style={{
              display: "block",
              width: 100, height: 100, borderRadius: "50%", background: "var(--color-surface-elevated)", cursor: "pointer",
              overflow: "hidden", flexShrink: 0, position: "relative",
              border: `2px solid ${C.border}`,
            }}
          >
            <input
              ref={photoRef}
              type="file"
              accept="image/*"
              onChange={handlePhoto}
              style={{
                position: "absolute", left: 0, top: 0, width: "100%", height: "100%",
                opacity: 0, cursor: "pointer", zIndex: 1,
              }}
              aria-label="프로필 사진 선택"
            />
            {fPhoto && isEphemeralMemberPhotoUrl(fPhoto) ? (
              <img
                src={fPhoto}
                alt="프로필 미리보기"
                style={{
                  position: "absolute", left: 0, top: 0, width: "100%", height: "100%",
                  objectFit: "cover", borderRadius: "50%", display: "block", zIndex: 0,
                }}
              />
            ) : (fPhoto || fPhotoServerUrl) ? (
              <MemberPhoto
                photo={fPhotoServerUrl || fPhoto}
                name={fName || "?"}
                style={{
                  position: "absolute", left: 0, top: 0, width: "100%", height: "100%",
                  objectFit: "cover", borderRadius: "50%", display: "block", zIndex: 0,
                }}
              />
            ) : (
              <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
                <div style={{ color: C.textMuted, marginBottom: 4 }}><Icons.Camera /></div>
                <span style={{ fontSize: 11, color: C.textMuted }}>사진 등록</span>
              </div>
            )}
          </label>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: mob ? "1fr" : "1fr 1fr", gap: 12, marginBottom: 12 }}>
          <FormInput label="이름 *" value={fName} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFName(e.target.value)} placeholder="이름" />
          <CalendarDropdown label="생년월일" value={fBirth} onChange={setFBirth} showClearButton />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: mob ? "1fr" : "1fr 1fr", gap: 12, marginBottom: 12 }}>
          <FormSelect label="성별" value={fGender} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFGender(e.target.value)} options={[{ value: "", label: "선택" }, { value: "남", label: "남" }, { value: "여", label: "여" }]} />
          <FormInput label="연락처" type="tel" value={fPhone} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFPhone(e.target.value)} placeholder="010-0000-0000" />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: mob ? "1fr" : "1fr 1fr", gap: 12, marginBottom: 12 }}>
          <FormSelect label="부서" value={fDept} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFDept(e.target.value)} options={depts.map(d => ({ value: d, label: d }))} />
          <FormInput label="직분/학년" value={fRole} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFRole(e.target.value)} placeholder="예: 집사, 3학년" />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: mob ? "1fr" : "1fr 1fr", gap: 12, marginBottom: 12 }}>
          <FormSelect label="목장" value={fGroup} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFGroup(e.target.value)} options={[
            { value: "", label: "미배정" },
            ...getMokjangList(db).map(g => ({ value: g, label: g })),
            ...(fGroup && !getMokjangList(db).includes(fGroup) ? [{ value: fGroup, label: fGroup }] : []),
          ]} />
          <FormInput label="주소" value={fAddr} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFAddr(e.target.value)} placeholder="주소" />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: mob ? "1fr" : "1fr 1fr", gap: 12, marginBottom: 12 }}>
          <FormSelect label="상태" value={fStatus} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFStatus(e.target.value)} options={[
            { value: "새가족", label: "새가족" }, { value: "정착중", label: "정착중" }, { value: "정착", label: "정착" },
            { value: "간헐", label: "간헐" }, { value: "위험", label: "위험" }, { value: "휴면", label: "휴면" }, { value: "졸업/전출", label: "졸업/전출" },
          ]} />
          <FormSelect label="방문경로" value={fVisitPath} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFVisitPath(e.target.value)} options={[
            { value: "", label: "선택" }, { value: "지인소개", label: "지인소개" }, { value: "전도", label: "전도" }, { value: "인터넷검색", label: "인터넷검색" }, { value: "자진방문", label: "자진방문" }, { value: "기타", label: "기타" },
          ]} />
        </div>
        {(fStatus === "새가족" || fStatus === "정착중") && fVisitPath === "지인소개" && (
          <div style={{ marginBottom: 12 }}>
            <FormSelect label="소개자" value={fReferrerId} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFReferrerId(e.target.value)} options={[
              { value: "", label: "선택" },
              ...db.members.filter(x => x.status !== "새가족" && x.id !== editMbrId).map(m => ({ value: m.id, label: `${m.name} (${m.dept || ""})` })),
            ]} />
          </div>
        )}
        {(fStatus === "새가족" || fStatus === "정착중") && (
          <div style={{ marginBottom: 12 }}>
            <CalendarDropdown label="첫 방문일" value={fFirstVisitDate} onChange={setFFirstVisitDate} />
          </div>
        )}
        {editMbrId && (
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <Btn variant="soft" size="sm" onClick={() => { const m = db.members.find(x => x.id === editMbrId); if (m) openQuickNote(m.id, m.name || "?", "note"); }}>메모 보기</Btn>
            <Btn variant="soft" size="sm" onClick={() => { const m = db.members.find(x => x.id === editMbrId); if (m) openQuickNote(m.id, m.name || "?", "prayer"); }}>기도 제목 보기</Btn>
          </div>
        )}
        <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 8 }}>
          <Btn variant="ghost" onClick={closeMemberModal}>취소</Btn>
          <Btn onClick={saveMember} disabled={photoUploading}>{photoUploading ? "사진 업로드 중…" : "저장"}</Btn>
        </div>
      </Modal>

      {/* New Family Program Detail Modal */}
      {programDetailMemberId && <NewFamilyProgramDetailModal db={db} setDb={fn => setDb(fn)} memberId={programDetailMemberId} onClose={() => setProgramDetailMemberId(null)} onSaved={() => setDb(prev => { void saveDb?.(prev); return prev; })} saveDb={saveDb} toast={toast} mob={mob} churchId={churchId} />}

      {/* Prayer Modal — 기도/메모 페이지에서 이름 클릭 시 */}
      {prayerModalMemberId && (() => {
        const member = db.members.find(x => x.id === prayerModalMemberId);
        return member ? (
          <PrayerModal
            memberId={prayerModalMemberId}
            member={member}
            db={db}
            setDb={setDb}
            persist={persist}
            toast={toast}
            onClose={() => setPrayerModalMemberId(null)}
            churchId={churchId}
          />
        ) : null;
      })()}

      {/* Detail Modal — Member 360° 뷰 (성도 관리 등에서만 사용) */}
      <Modal open={showDetailModal} onClose={() => setShowDetailModal(false)} title="" ariaLabel="성도 상세" width={mob ? undefined : 720}>
        {detailMember && (
          <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
            <Member360View
              member={detailMember}
              db={db}
              statusHistory={[]}
              newFamilyProgram={(db.newFamilyPrograms ?? []).find(p => p.member_id === detailMember.id) ?? null}
              onEdit={() => { setShowDetailModal(false); openMemberModal(detailMember.id); }}
              onClose={() => setShowDetailModal(false)}
              toast={toast}
            />
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", paddingTop: 12, borderTop: `1px solid ${C.border}` }}>
              <Btn variant="danger" size="sm" onClick={() => detailMember && deleteMember(detailMember.id)}>삭제</Btn>
              <Btn variant="soft" size="sm" onClick={() => detailMember && openQuickNote(detailMember.id, detailMember.name || "?", "note")}>메모</Btn>
              <Btn variant="soft" size="sm" onClick={() => detailMember && openQuickNote(detailMember.id, detailMember.name || "?", "prayer")}>기도 제목</Btn>
              <Btn variant="accent" size="sm" onClick={() => { detailMember && openNoteModal(detailMember.id); setShowDetailModal(false); }}>기도 추가</Btn>
            </div>
          </div>
        )}
      </Modal>

      {/* Note Modal */}
      <Modal open={showNoteModal} onClose={() => setShowNoteModal(false)} title={noteTargetId ? (db.members.find(x => x.id === noteTargetId)?.name || "") + " — 기도 추가" : "기도 추가"} width={500}>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 6 }}>대상</label>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <button type="button" onClick={() => setNoteTargetType("all")} style={{ padding: "8px 16px", borderRadius: 8, border: `1px solid ${noteTargetType === "all" ? C.primary : C.border}`, background: noteTargetType === "all" ? C.primary : "#fff", color: noteTargetType === "all" ? "var(--color-primary-on)" : C.text, fontSize: 13, fontWeight: 500, cursor: "pointer" }}>전체</button>
            <button type="button" onClick={() => setNoteTargetType("individual")} style={{ padding: "8px 16px", borderRadius: 8, border: `1px solid ${noteTargetType === "individual" ? C.primary : C.border}`, background: noteTargetType === "individual" ? C.primary : "#fff", color: noteTargetType === "individual" ? "var(--color-primary-on)" : C.text, fontSize: 13, fontWeight: 500, cursor: "pointer" }}>개인</button>
          </div>
        </div>
        {noteTargetType === "individual" && (() => {
          const activeMembers = db.members.filter(x => x.status !== "졸업/전출");
          const membersWithDept = activeMembers.map(m => ({ id: m.id, name: m.name, departmentName: memberDeptMap[m.id] ?? m.dept ?? "" }));
          const filteredMembers = noteMemberSearchText.trim()
            ? membersWithDept.filter(m => m.name.includes(noteMemberSearchText.trim()))
            : membersWithDept;
          const selected = membersWithDept.find(m => m.id === (noteSelectedMemberId || noteTargetId || ""));
          return (
            <div ref={noteMemberDropdownRef} style={{ marginBottom: 16, position: "relative" }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 6 }}>성도 선택</label>
              <button type="button" onClick={() => setNoteMemberDropdownOpen(v => !v)} style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.card, fontSize: 14, textAlign: "left", cursor: "pointer", color: selected ? C.text : C.textFaint }}>{selected ? (selected.departmentName ? `${selected.name} (${selected.departmentName})` : selected.name) : "선택하세요"}</button>
              {noteMemberDropdownOpen && (
                <div style={{ position: "absolute", top: "100%", left: 0, right: 0, marginTop: 4, background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, boxShadow: "0 4px 12px rgba(0,0,0,0.1)", zIndex: 10 }}>
                  <input type="text" placeholder="이름 검색" value={noteMemberSearchText} onChange={e => setNoteMemberSearchText(e.target.value)} style={{ width: "100%", padding: "10px 12px", border: "none", borderBottom: `1px solid ${C.border}`, borderRadius: "8px 8px 0 0", fontSize: 14, outline: "none", boxSizing: "border-box" }} />
                  <div style={{ maxHeight: 200, overflowY: "auto" }}>
                    {filteredMembers.length === 0 ? <div style={{ padding: 12, color: C.textFaint, fontSize: 13 }}>검색 결과 없음</div> : filteredMembers.map(m => (
                      <button key={m.id} type="button" onClick={() => { setNoteSelectedMemberId(m.id); setNoteMemberDropdownOpen(false); }} style={{ display: "block", width: "100%", padding: "10px 12px", border: "none", background: (noteSelectedMemberId || noteTargetId) === m.id ? C.accentBg : "transparent", color: (noteSelectedMemberId || noteTargetId) === m.id ? C.blue : C.text, fontSize: 14, textAlign: "left", cursor: "pointer" }} onMouseOver={e => { e.currentTarget.style.background = C.blueBg; }} onMouseOut={e => { e.currentTarget.style.background = (noteSelectedMemberId || noteTargetId) === m.id ? C.accentBg : "transparent"; }}>{m.departmentName ? `${m.name} (${m.departmentName})` : m.name}</button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })()}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div style={{ marginBottom: 16 }}><CalendarDropdown label="날짜" value={nDate} onChange={setNDate} /></div>
          <FormSelect label="유형" value={nType === "visit" || nType === "event" ? "prayer" : nType} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setNType(e.target.value as Note["type"])}
            options={[{ value: "prayer", label: "기도" }, { value: "memo", label: "메모" }]} />
        </div>
        <FormTextarea label="내용" value={nContent} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNContent(e.target.value)} placeholder="기록 내용" style={{ minHeight: 100 }} />
        <div style={{ marginTop: 16 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: C.text, display: "block", marginBottom: 8 }}>이전 기록</label>
          {(() => {
            const mid = noteTargetType === "all" ? NOTE_TARGET_CHURCH : (noteSelectedMemberId || noteTargetId);
            const hist = mid ? (db.notes[mid] || []).slice().reverse().slice(0, 5) : [];
            const mbrName = mid === NOTE_TARGET_CHURCH ? "교회 전체" : (mid ? db.members.find(m => m.id === mid)?.name : undefined);
            const mbrDept = mid && mid !== NOTE_TARGET_CHURCH ? db.members.find(m => m.id === mid)?.dept : undefined;
            return hist.length ? hist.map((n, i) => <NoteCard key={i} n={n} mbrName={mbrName} mbrDept={mbrDept} />) : <div style={{ textAlign: "center", color: C.textFaint, padding: 16, fontSize: 13 }}>기록 없음</div>;
          })()}
        </div>
        <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 16 }}>
          <Btn variant="ghost" onClick={() => setShowNoteModal(false)}>취소</Btn>
          <Btn variant="accent" onClick={saveNote}>저장</Btn>
        </div>
      </Modal>

      {/* Quick Note/Prayer Modal — 성도별 메모·기도 제목 빠른 추가 */}
      {churchId && (
        <QuickNoteModal
          isOpen={quickNoteOpen}
          onClose={() => setQuickNoteOpen(false)}
          title={quickNoteType === "prayer" ? "기도 제목" : "메모"}
          memberName={quickNoteMemberName}
          memberId={quickNoteMemberId}
          churchId={churchId}
          type={quickNoteType}
          onSaved={handleQuickNoteSaved}
        />
      )}

      {/* Toasts */}
      <div style={{ position: "fixed", top: mob ? 8 : 20, right: mob ? 8 : 32, left: mob ? 8 : "auto", zIndex: 2000, display: "flex", flexDirection: "column", gap: 8 }}>
        {toasts.map(t => (
          <div key={t.id} style={{ padding: "12px 20px", borderRadius: 10, fontSize: 14, fontWeight: 500, color: "var(--color-primary-on)", boxShadow: "0 8px 24px rgba(0, 0, 0, 0.12)", display: "flex", alignItems: "center", gap: 8, background: t.type === "ok" ? C.success : t.type === "err" ? C.danger : C.orange, animation: "toastIn 0.3s forwards" }}>
            <span>{t.type === "ok" ? "✓" : t.type === "err" ? "✕" : "⚠"}</span> {t.msg}
          </div>
        ))}
      </div>
    </>
  );
}
