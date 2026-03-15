"use client";

import React, { useState, useMemo, useEffect, useCallback, useRef, type CSSProperties, type ReactNode } from "react";
import type { DB, Member, Note, AttStatus, NewFamilyProgram, Attendance } from "@/types/db";
import { DEFAULT_DB } from "@/types/db";
import { saveDBToSupabase, getWeekNum, getSundayForWeekNum } from "@/lib/store";
import { supabase, deleteMemberPhotoFromStorage } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useAppData } from "@/contexts/AppDataContext";
import { toMember } from "@/lib/supabase-db";
import { compressImage } from "@/utils/imageCompressor";
import { LayoutDashboard, Users, CalendarCheck, StickyNote, Sprout, FileText, Settings, Church, BarChart3, UserX, ListOrdered, Heart, Home, Gift } from "lucide-react";
import { UnifiedPageLayout } from "@/components/layout/UnifiedPageLayout";
import { Pagination } from "@/components/common/Pagination";
import { CalendarDropdown } from "@/components/CalendarDropdown";
import { Member360View } from "@/components/members/Member360View";
import { AttendanceDashboard, AttendanceCheck, AbsenteeManagement, AttendanceStatistics } from "@/components/attendance";
import { ReportModal } from "@/components/report/ReportModal";
import { REPORT_DEFS, ReportPreviewModal, type ReportId } from "@/components/report/A4Reports";
import { ModernSelect } from "@/components/common/ModernSelect";
import { ServantSchoolManager } from "@/components/settling/ServantSchoolManager";
import { QuickNoteModal, type QuickNoteItem } from "@/components/common/QuickNoteModal";

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

/* ---------- Colors (same as FinancePage) ---------- */
const C = {
  bg: "#f8f7f4", card: "#ffffff", navy: "#1b2a4a", navyLight: "#2d4373",
  text: "#1b2a4a", textMuted: "#6b7b9e", textFaint: "#a0aec0",
  border: "#e8e6e1", borderLight: "#f0eeeb",
  blue: "#4361ee", blueBg: "#eef0ff", accent: "#4361ee", accentLight: "#eef0ff", accentBg: "#eef0ff",
  success: "#06d6a0", successBg: "#e6faf3",
  danger: "#ef476f", dangerBg: "#fde8ed",
  warning: "#ffd166", warningBg: "#fff8e6",
  purple: "#7209b7", purpleBg: "#f3e8ff",
  teal: "#118ab2", tealBg: "#e4f4fb",
  pink: "#f72585", pinkBg: "#fde4f0",
  orange: "#ff9500",
};

const statusColors: Record<string, string> = {
  "새가족": C.accent, "정착중": C.teal, "정착": C.success,
  "간헐": C.orange, "위험": C.danger, "휴면": C.textMuted,
};
const badgeBg: Record<string, [string, string]> = {
  accent: [C.accent, C.accentBg], teal: [C.teal, C.tealBg], success: [C.success, C.successBg],
  warning: ["#946b00", C.warningBg], danger: [C.danger, C.dangerBg], gray: [C.textMuted, "rgba(107,123,158,0.1)"],
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
  return <div onClick={onClick} style={{ background: C.card, borderRadius: 16, border: `1px solid ${C.border}`, padding: 24, transition: "all 0.2s", cursor: onClick ? "pointer" : "default", ...style }}>{children}</div>;
}

function SBadge({ children, variant = "gray" }: { children: ReactNode; variant?: string }) {
  const [color, bg] = badgeBg[variant] || badgeBg.gray;
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600, color, background: bg, whiteSpace: "nowrap" }}>{children}</span>;
}

function Btn({ children, onClick, variant = "primary", size = "md", icon, style: s, disabled }: { children?: ReactNode; onClick?: (e?: React.MouseEvent) => void; variant?: string; size?: string; icon?: ReactNode; style?: CSSProperties; disabled?: boolean }) {
  const base: CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, border: "none", borderRadius: 10, cursor: disabled ? "not-allowed" : "pointer", fontWeight: 600, fontFamily: "inherit", transition: "all 0.15s", fontSize: size === "sm" ? 13 : 14, padding: size === "sm" ? "6px 14px" : "10px 20px", opacity: disabled ? 0.6 : 1 };
  const v: Record<string, CSSProperties> = {
    primary: { background: C.navy, color: "#fff" }, accent: { background: C.accent, color: "#fff" },
    success: { background: C.success, color: "#fff" }, danger: { background: C.danger, color: "#fff" },
    ghost: { background: "transparent", color: C.navy, border: `1px solid ${C.border}` },
    soft: { background: C.accentBg, color: C.accent },
  };
  return <button type="button" disabled={disabled} onClick={disabled ? undefined : onClick} style={{ ...base, ...(v[variant] || v.primary), ...s }}>{icon}{children}</button>;
}

function FormInput({ label, ...props }: { label?: string; [k: string]: unknown }) {
  return (
    <div style={{ marginBottom: 16 }}>
      {label && <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: C.navy, marginBottom: 6 }}>{label}</label>}
      <input {...(props as React.InputHTMLAttributes<HTMLInputElement>)} style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 14, fontFamily: "inherit", color: C.text, background: "#fff", outline: "none", ...(props.style as CSSProperties || {}) }} />
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
      {label && <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: C.navy, marginBottom: 6 }}>{label}</label>}
      <textarea {...(props as React.TextareaHTMLAttributes<HTMLTextAreaElement>)} style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 14, fontFamily: "inherit", color: C.text, background: "#fff", outline: "none", resize: "vertical", minHeight: 72, ...(props.style as CSSProperties || {}) }} />
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
          borderTop: "1px solid #e5e7eb",
          borderBottom: "1px solid #e5e7eb",
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
    <div style={{ background: "#fff", borderRadius: 16, overflow: "hidden", position: "relative" }}>
      <div style={{ display: "flex", width: "100%" }}>
        <WheelColumn items={years} selected={year} onChange={handleYearChange} format={(n) => `${n}년`} />
        <WheelColumn items={months} selected={month} onChange={handleMonthChange} format={(n) => `${n}월`} />
        <WheelColumn items={days} selected={Math.min(day, daysInCur)} onChange={handleDayChange} format={(n) => `${n}일`} />
      </div>
      <div style={{ padding: "12px 16px", borderTop: "1px solid #e5e7eb" }}>
        <button
          type="button"
          onClick={() => {
            onChange(toStr(year, month, Math.min(day, getDaysInMonth(year, month))));
            onConfirm();
          }}
          style={{ width: "100%", padding: "12px", background: C.navy, color: "#fff", border: "none", borderRadius: 12, fontSize: 15, fontWeight: 600, cursor: "pointer" }}
        >
          확인
        </button>
      </div>
    </div>
  );
}

function Modal({ open, onClose, title, children, width = 540, hideScrollbar }: { open: boolean; onClose: () => void; title: string; children: ReactNode; width?: number; hideScrollbar?: boolean }) {
  const mob = useIsMobile();
  if (!open) return null;
  const modalHeight = mob ? "92vh" : "85vh";
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: mob ? "flex-end" : "center", justifyContent: "center", background: "rgba(27,42,74,0.4)", backdropFilter: "blur(4px)", padding: mob ? 0 : 20 }} onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: "#fff",
          borderRadius: mob ? "20px 20px 0 0" : 20,
          padding: mob ? 20 : 32,
          width: mob ? "100%" : "90%",
          maxWidth: mob ? "100%" : width,
          height: modalHeight,
          maxHeight: modalHeight,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          boxShadow: "0 20px 60px rgba(27,42,74,0.15)",
        }}
      >
        {mob && <div style={{ width: 36, height: 4, background: C.border, borderRadius: 4, margin: "0 auto 12px", flexShrink: 0 }} />}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexShrink: 0 }}>
          <h3 style={{ margin: 0, fontSize: mob ? 17 : 20, color: C.navy }}>{title}</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, borderRadius: 8, display: "flex" }}><Icons.X /></button>
        </div>
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }} className={hideScrollbar ? "scrollbar-hide" : undefined}>{children}</div>
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, color = C.accent, compact }: { label: string; value: string; sub?: string; color?: string; compact?: boolean }) {
  return (
    <Card
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 4,
        position: "relative",
        overflow: "hidden",
        padding: compact ? 12 : 24,
      }}
    >
      <div
        style={{
          position: "absolute",
          top: compact ? -8 : -10,
          right: compact ? -8 : -10,
          width: compact ? 32 : 60,
          height: compact ? 32 : 60,
          borderRadius: "50%",
          background: `${color}15`,
        }}
      />
      <div style={{ fontSize: compact ? 11 : 13, color: C.textMuted, fontWeight: 500 }}>{label}</div>
      <div style={{ fontSize: compact ? 20 : 26, fontWeight: 700, color: C.navy, letterSpacing: "-0.5px" }}>{value}</div>
      {sub && <div style={{ fontSize: compact ? 10 : 12, color: C.textMuted }}>{sub}</div>}
    </Card>
  );
}

function Progress({ pct, color }: { pct: number; color: string }) {
  return <div style={{ height: 6, borderRadius: 3, background: C.bg, overflow: "hidden" }}><div style={{ height: "100%", borderRadius: 3, width: `${pct}%`, background: color, transition: "width 0.5s ease" }} /></div>;
}

function AttDot({ status, onClick }: { status: string; onClick: () => void }) {
  const colors: Record<string, string> = { p: C.success, a: C.danger, n: C.border };
  const s = status === "l" ? "n" : status;
  return <div onClick={e => { e.stopPropagation(); onClick(); }} style={{ width: 14, height: 14, borderRadius: "50%", background: colors[s] || C.border, cursor: "pointer", transition: "transform 0.15s", border: `2px solid ${(colors[s] || C.border)}30` }} title={s === "p" ? "출석" : s === "a" ? "결석" : "미체크"} />;
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
  const [hover, setHover] = useState(false);
  const isPrayer = n.type === "prayer";
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: "#fff",
        borderRadius: 16,
        border: "1px solid #e5e7eb",
        boxShadow: hover ? "0 4px 12px rgba(0,0,0,0.12)" : "0 1px 3px rgba(0,0,0,0.08)",
        padding: 24,
        marginBottom: 12,
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
          marginBottom: 12,
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {mbrName != null && mbrName !== "" ? (
            <span style={{ fontSize: 16, fontWeight: 700, color: "#1F2937" }}>{mbrName}</span>
          ) : (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 14, fontWeight: 600, color: "#9CA3AF" }}>
              {n.type === "prayer" ? <Heart size={16} strokeWidth={1.5} style={{ flexShrink: 0, color: "#9CA3AF" }} /> : <FileText size={16} strokeWidth={1.5} style={{ flexShrink: 0, color: "#9CA3AF" }} />}
              {NOTE_LABELS[n.type] || "메모"}
            </span>
          )}
          {mbrDept && (
            <span style={{ display: "inline-flex", alignItems: "center", padding: "2px 8px", borderRadius: 9999, fontSize: 12, fontWeight: 500, background: "#EEF2FF", color: "#4F46E5" }}>
              {mbrDept}
            </span>
          )}
        </div>
        <span style={{ fontSize: 14, color: "#9CA3AF" }}>{fmtNoteDate(n.date)}</span>
      </div>
      <div
        style={{
          fontSize: 15,
          lineHeight: 1.6,
          color: "#374151",
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
          gap: 8,
          marginTop: 12,
          opacity: hover ? 1 : 0.85,
          transition: "opacity 0.2s",
        }}
      >
        {isPrayer && onToggleAnswered && (
          <button
            type="button"
            onClick={e => { e.stopPropagation(); onToggleAnswered(); }}
            style={{
              padding: "4px 12px",
              fontSize: 12,
              border: "none",
              borderRadius: 9999,
              cursor: "pointer",
              fontWeight: 500,
              background: "transparent",
              color: "#6B7280",
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
              padding: "2px 8px",
              borderRadius: 9999,
              fontSize: 12,
              fontWeight: 500,
              background: "#EEF2FF",
              color: "#4F46E5",
            }}
          >
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>{NOTE_ICONS[n.type] ?? <FileText size={NOTE_ICON_SIZE} />} {NOTE_LABELS[n.type] || "메모"}</span>
          </span>
        )}
        {!isPrayer && (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: "2px 8px",
              borderRadius: 9999,
              fontSize: 12,
              fontWeight: 500,
              background: badgeBg[n.type === "visit" ? "teal" : n.type === "event" ? "pink" : "gray"]?.[1] ?? "rgba(107,123,158,0.1)",
              color: badgeBg[n.type === "visit" ? "teal" : n.type === "event" ? "pink" : "gray"]?.[0] ?? C.textMuted,
            }}
          >
            {NOTE_ICONS[n.type] ?? <FileText size={NOTE_ICON_SIZE} />} {NOTE_LABELS[n.type] || "메모"}
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

/* ====== Planner Cards for Dashboard ====== */
function PlannerWeekCard({ plans, mob }: { plans: DB["plans"]; mob: boolean }) {
  const today = new Date();
  const day = today.getDay();
  const sun = new Date(today); sun.setDate(today.getDate() - day);
  const sat = new Date(sun); sat.setDate(sun.getDate() + 6);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const weekPlans = plans.filter(p => p.date >= fmt(sun) && p.date <= fmt(sat)).sort((a, b) => a.date.localeCompare(b.date) || (a.time || "").localeCompare(b.time || ""));
  return (
    <Card style={{ padding: mob ? 14 : 20 }}>
      <h4 style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 700, color: C.navy }}>이번 주 일정</h4>
      {weekPlans.length === 0 && <p style={{ margin: 0, fontSize: 13, color: C.textMuted }}>등록된 일정이 없습니다</p>}
      {weekPlans.slice(0, 5).map(p => (
        <div key={p.id} style={{ padding: "6px 0", borderBottom: `1px solid ${C.borderLight}` }}>
          <span style={{ fontSize: 11, color: C.textMuted }}>{p.date.slice(5)} {p.time || ""}</span>
          <p style={{ margin: "2px 0 0", fontSize: 13, fontWeight: 600, color: C.text }}>{p.title}</p>
        </div>
      ))}
      {weekPlans.length > 5 && <p style={{ margin: "8px 0 0", fontSize: 12, color: C.textMuted }}>외 {weekPlans.length - 5}건</p>}
    </Card>
  );
}

function SermonCard({ sermons, mob }: { sermons: DB["sermons"]; mob: boolean }) {
  const today = new Date();
  const day = today.getDay();
  const sun = new Date(today); sun.setDate(today.getDate() - day);
  const sat = new Date(sun); sat.setDate(sun.getDate() + 6);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const weekSermons = sermons.filter(s => s.date >= fmt(sun) && s.date <= fmt(sat));
  const next = weekSermons[0] || sermons.filter(s => s.date >= fmt(today)).sort((a, b) => a.date.localeCompare(b.date))[0];
  return (
    <Card style={{ padding: mob ? 14 : 20 }}>
      <h4 style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 700, color: C.navy }}>설교 준비</h4>
      {next ? (
        <>
          <p style={{ margin: 0, fontSize: 11, color: C.textMuted }}>{next.date} · {next.service}</p>
          <p style={{ margin: "4px 0", fontSize: 14, fontWeight: 600, color: C.text }}>{next.title || "(제목 미정)"}</p>
          {next.text && <p style={{ margin: 0, fontSize: 12, color: C.textMuted }}>{next.text}</p>}
          <span style={{ display: "inline-block", marginTop: 6, padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600, background: next.status === "완료" ? C.successBg : C.warningBg, color: next.status === "완료" ? C.success : C.warning }}>{next.status || "준비중"}</span>
        </>
      ) : (
        <p style={{ margin: 0, fontSize: 13, color: C.textMuted }}>예정된 설교가 없습니다</p>
      )}
    </Card>
  );
}

function ChecklistCard({ mob }: { mob: boolean }) {
  const storageKey = "pastoral-checklist";
  const defaultItems = ["설교 준비", "심방 계획 확인", "새가족 연락", "기도제목 업데이트", "주보 확인"];
  const [items, setItems] = useState<{ text: string; done: boolean }[]>(() => {
    if (typeof window === "undefined") return defaultItems.map(t => ({ text: t, done: false }));
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) return JSON.parse(saved);
    } catch {}
    return defaultItems.map(t => ({ text: t, done: false }));
  });
  const toggle = (i: number) => {
    setItems(prev => {
      const next = prev.map((it, idx) => idx === i ? { ...it, done: !it.done } : it);
      localStorage.setItem(storageKey, JSON.stringify(next));
      return next;
    });
  };
  return (
    <Card style={{ padding: mob ? 14 : 20 }}>
      <h4 style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 700, color: C.navy }}>주간 체크리스트</h4>
      {items.map((it, i) => (
        <label key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", cursor: "pointer", fontSize: 13, color: it.done ? C.textMuted : C.text, textDecoration: it.done ? "line-through" : "none" }}>
          <input type="checkbox" checked={it.done} onChange={() => toggle(i)} style={{ accentColor: C.accent }} />
          {it.text}
        </label>
      ))}
    </Card>
  );
}

/* ====== Dashboard ====== */
type AttChartView = "year" | "month" | "week";

function DashboardSub({ db, currentWeek }: { db: DB; currentWeek: number }) {
  const mob = useIsMobile();
  const currentYear = new Date().getFullYear();
  const [attChartView, setAttChartView] = useState<AttChartView>("month");
  const [attChartYear, setAttChartYear] = useState(currentYear);

  const m = db.members.filter(x => x.status !== "졸업/전출");
  const total = m.length;
  console.log("[목양대시보드] 전체 성도 수:", total, "db.members.length:", db.members?.length ?? 0);
  const attInPerson = m.filter(s => (db.attendance[s.id] || {})[currentWeek] === "p").length;
  const attOnline = m.filter(s => (db.attendance[s.id] || {})[currentWeek] === "o").length;
  const attTotal = attInPerson + attOnline;
  const newF = m.filter(s => s.is_new_family === true).length;
  const risk = m.filter(s => s.status === "위험" || s.status === "휴면").length;
  const prayers = m.filter(s => s.prayer && s.prayer.trim()).length;
  const rate = total > 0 ? Math.round(attTotal / total * 100) : 0;

  const weeklyAtt = useMemo(() => {
    return Array.from({ length: 52 }, (_, i) => {
      const w = i + 1;
      return m.filter(s => { const st = (db.attendance[s.id] || {})[w]; return st === "p" || st === "o"; }).length;
    });
  }, [db, m]);

  const monthlyAtt = useMemo(() => {
    const data = new Array(12).fill(0);
    m.forEach(s => {
      const a = db.attendance[s.id] || {};
      Object.keys(a).forEach(w => {
        const wn = parseInt(w);
        const mn = Math.min(11, Math.floor((wn - 1) / 4.33));
        const st = a[parseInt(w)];
        if (st === "p" || st === "o") data[mn]++;
      });
    });
    return data;
  }, [db, m]);

  const annualSummary = useMemo(() => {
    const totalPresent = weeklyAtt.reduce((s, v) => s + v, 0);
    const weeksWithData = weeklyAtt.filter(v => v > 0).length;
    const avgPerWeek = weeksWithData > 0 ? Math.round(totalPresent / weeksWithData) : 0;
    const avgRate = total > 0 && weeksWithData > 0 ? Math.round((totalPresent / (weeksWithData * total)) * 100) : 0;
    return { totalPresent, weeksWithData, avgPerWeek, avgRate };
  }, [weeklyAtt, total]);

  const statusCounts = useMemo(() => {
    const r: Record<string, number> = {};
    m.forEach(s => { r[s.status || ""] = (r[s.status || ""] || 0) + 1; });
    return r;
  }, [m]);

  const deptCounts = useMemo(() => {
    const r: Record<string, number> = {};
    m.forEach(s => { r[s.dept || ""] = (r[s.dept || ""] || 0) + 1; });
    return Object.entries(r).sort((a, b) => b[1] - a[1]);
  }, [m]);

  const recentNotes = useMemo(() => {
    const all: (Note & { mbrName: string; mbrId: string; mbrDept: string })[] = [];
    Object.keys(db.notes).forEach(mid => {
      const mbr = db.members.find(x => x.id === mid);
      const mbrName = mid === NOTE_TARGET_CHURCH ? "교회 전체" : (mbr?.name || "?");
      (db.notes[mid] || []).forEach(n => all.push({ ...n, mbrName, mbrId: mid, mbrDept: mbr?.dept || "" }));
    });
    return all.sort((a, b) => (b.date || "").localeCompare(a.date || "")).slice(0, 6);
  }, [db]);

  const deptColors = [C.accent, C.pink, C.purple, C.success, C.teal, C.orange, C.danger, C.warning];

  const churchName = (db.settings.churchName || "").trim();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {churchName && (
        <div style={{ padding: "12px 0 4px", borderBottom: `2px solid ${C.border}`, marginBottom: 4 }}>
          <h2 style={{ margin: 0, fontSize: mob ? 20 : 24, fontWeight: 800, color: C.navy }}>{churchName}</h2>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: C.textMuted }}>목양 대시보드</p>
        </div>
      )}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: mob ? "1fr 1fr" : "repeat(auto-fit, minmax(200px, 1fr))",
          gap: mob ? 8 : 16,
        }}
      >
        <StatCard label="전체 성도" value={`${total}명`} sub="활성 등록" color={C.accent} compact={mob} />
        <StatCard label="금주 출석률" value={`${rate}%`} sub={attOnline > 0 ? `${attInPerson}명 출석 · ${attOnline}명 온라인 / 총 ${total}명` : `${attTotal}/${total}명 출석`} color={C.success} compact={mob} />
        <StatCard label="새가족" value={`${newF}명`} sub="정착 진행중" color={C.teal} compact={mob} />
        <StatCard label="위험/휴면" value={`${risk}명`} sub="관심 필요" color={C.danger} compact={mob} />
        <div style={mob ? { gridColumn: "1 / -1" } : undefined}>
          <StatCard label="기도제목" value={`${prayers}건`} sub="함께 기도합니다" color={C.purple} compact={mob} />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: mob ? "1fr" : "1fr 1fr", gap: 16 }}>
        {/* minWidth: 0으로 그리드 셀이 주별 차트 너비에 의해 늘어나 옆 칸(상태별 현황)을 침범하지 않도록 함 */}
        <div style={{ minWidth: 0 }}>
        {/* overflow: visible so 연도 선택 드롭다운이 카드에 잘리지 않음 */}
        <Card style={{ padding: 0, overflow: "visible", minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, padding: mob ? "12px 16px" : "16px 24px", borderBottom: `1px solid ${C.border}` }}>
            <h4 style={{ margin: 0, fontSize: mob ? 14 : 16, fontWeight: 700, color: C.navy }}>출석 추이</h4>
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", position: "relative", zIndex: 1 }}>
              <select value={attChartYear} onChange={e => setAttChartYear(Number(e.target.value))} className="select-modern" style={{ height: 38, minHeight: 38, padding: "9px 36px 9px 12px", width: "auto", minWidth: 80, fontSize: 13, lineHeight: 1.35, boxSizing: "border-box" }}>
                {[currentYear, currentYear - 1, currentYear - 2].map(y => <option key={y} value={y}>{y}년</option>)}
              </select>
              <div style={{ display: "flex", gap: 2, background: C.bg, borderRadius: 8, padding: 2 }}>
                {(["year", "month", "week"] as const).map(mode => (
                  <button key={mode} type="button" onClick={() => setAttChartView(mode)} style={{ padding: "4px 10px", fontSize: 11, fontWeight: 600, border: "none", borderRadius: 6, background: attChartView === mode ? C.navy : "transparent", color: attChartView === mode ? "#fff" : C.textMuted, cursor: "pointer" }}>
                    {mode === "year" ? "연간" : mode === "month" ? "월별" : "주별"}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {/* 고정 높이: 연간/월별/주별 전환 시 카드 크기 변하지 않음 (월별·주별 그래프 160px + 주별 안내문) */}
          <div style={{ padding: "20px 24px 16px", height: 220, minHeight: 220, boxSizing: "border-box", overflow: "hidden" }}>
            {attChartView === "year" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16, height: "100%", justifyContent: "center" }}>
                <div style={{ display: "grid", gridTemplateColumns: mob ? "1fr" : "1fr 1fr", gap: 12 }}>
                  <div style={{ background: `linear-gradient(135deg, ${C.accentBg} 0%, rgba(255,255,255,0.9) 100%)`, borderRadius: 14, padding: "16px 20px", border: `1px solid ${C.border}`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 72 }}>
                    <div style={{ fontSize: 24, fontWeight: 800, color: C.accent, letterSpacing: "-0.02em" }}>{annualSummary.totalPresent}</div>
                    <div style={{ fontSize: 12, color: C.textMuted, marginTop: 4, fontWeight: 500 }}>총 출석 인원·주</div>
                  </div>
                  <div style={{ background: `linear-gradient(135deg, ${C.successBg} 0%, rgba(255,255,255,0.9) 100%)`, borderRadius: 14, padding: "16px 20px", border: `1px solid ${C.border}`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 72 }}>
                    <div style={{ fontSize: 24, fontWeight: 800, color: C.success, letterSpacing: "-0.02em" }}>{annualSummary.avgRate}%</div>
                    <div style={{ fontSize: 12, color: C.textMuted, marginTop: 4, fontWeight: 500 }}>평균 출석률 (기록된 주)</div>
                  </div>
                </div>
                <div style={{ fontSize: 12, color: C.textMuted, padding: "8px 12px", background: C.bg, borderRadius: 10, border: `1px solid ${C.border}` }}>
                  기록된 주 <strong style={{ color: C.navy }}>{annualSummary.weeksWithData}주</strong> · 주당 평균 출석 <strong style={{ color: C.navy }}>{annualSummary.avgPerWeek}명</strong>
                </div>
              </div>
            )}
            {attChartView === "month" && (
              <div style={{ display: "flex", alignItems: "end", gap: 6, height: 160 }}>
                {monthlyAtt.map((v, i) => {
                  const maxM = Math.max(...monthlyAtt, 1);
                  const h = Math.max(4, (v / maxM) * 140);
                  return (
                    <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                      <span style={{ fontSize: 10, color: C.textMuted }}>{v || ""}</span>
                      <div style={{ width: "100%", height: h, minHeight: 4, background: `linear-gradient(to top, ${C.accent}, ${C.accent}aa)`, borderRadius: "6px 6px 2px 2px", transition: "height 0.3s" }} />
                      <span style={{ fontSize: 10, color: C.textMuted }}>{i + 1}월</span>
                    </div>
                  );
                })}
              </div>
            )}
            {attChartView === "week" && (
              <div style={{ height: "100%", display: "flex", flexDirection: "column", minHeight: 0 }}>
                <div style={{ overflowX: "auto", overflowY: "hidden", paddingBottom: 6, height: 160, flexShrink: 0 }}>
                  <div style={{ display: "flex", alignItems: "end", gap: 2, minWidth: mob ? 520 : 1040, height: 160 }}>
                    {weeklyAtt.map((v, i) => {
                      const maxW = Math.max(...weeklyAtt, 1);
                      const h = Math.max(4, (v / maxW) * 140);
                      return (
                        <div key={i} style={{ flex: 1, minWidth: 14, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                          <span style={{ fontSize: 9, color: C.textMuted }}>{v || ""}</span>
                          <div style={{ width: "100%", height: h, minHeight: 4, background: `linear-gradient(to top, ${C.teal}, ${C.teal}aa)`, borderRadius: "4px 4px 0 0", transition: "height 0.3s" }} />
                          <span style={{ fontSize: 9, color: C.textMuted }}>{i + 1}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div style={{ fontSize: 11, color: C.textMuted, marginTop: 6, flexShrink: 0 }}>1~52주 (가로 스크롤 가능)</div>
              </div>
            )}
          </div>
        </Card>
        </div>

        <Card style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "16px 24px", borderBottom: `1px solid ${C.border}` }}>
            <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: C.navy }}>상태별 현황</h4>
          </div>
          <div style={{ padding: "20px 24px" }}>
            {Object.entries(statusCounts).map(([st, cnt]) => {
              const pct = total > 0 ? (cnt / total * 100) : 0;
              return (
                <div key={st} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: C.navy, width: 60 }}>{st}</span>
                  <div style={{ flex: 1 }}><Progress pct={pct} color={statusColors[st] || C.border} /></div>
                  <span style={{ fontSize: 13, color: C.textMuted, minWidth: 80, textAlign: "right" }}>{cnt}명 ({pct.toFixed(0)}%)</span>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: mob ? "1fr" : "1fr 1fr", gap: 16 }}>
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: mob ? "12px 16px" : "16px 24px", borderBottom: `1px solid ${C.border}` }}>
            <h4 style={{ margin: 0, fontSize: mob ? 14 : 16, fontWeight: 700, color: C.navy }}>부서별 인원</h4>
          </div>
          <div style={{ padding: "20px 24px" }}>
            {deptCounts.map(([d, cnt], i) => {
              const pct = total > 0 ? (cnt / total * 100) : 0;
              const clr = deptColors[i % deptColors.length];
              return (
                <div key={d} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: `${clr}15`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: clr }}>{d[0]}</div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: C.navy, width: 60 }}>{d}</span>
                  <div style={{ flex: 1 }}><Progress pct={pct} color={clr} /></div>
                  <span style={{ fontSize: 13, color: C.textMuted }}>{cnt}명</span>
                </div>
              );
            })}
          </div>
        </Card>

        <Card style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "16px 24px", borderBottom: `1px solid ${C.border}` }}>
            <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: C.navy }}>최근 기록</h4>
          </div>
          <div style={{ padding: "16px 24px", maxHeight: 300, overflowY: "auto" }}>
            {recentNotes.length ? recentNotes.map((n, i) => <NoteCard key={i} n={n} mbrName={n.mbrName} />) : <div style={{ textAlign: "center", color: C.textMuted, padding: 20 }}>기록이 없습니다</div>}
          </div>
        </Card>
      </div>

      {/* Planner cards */}
      <div style={{ display: "grid", gridTemplateColumns: mob ? "1fr" : "1fr 1fr 1fr", gap: 16 }}>
        <PlannerWeekCard plans={db.plans} mob={mob} />
        <SermonCard sermons={db.sermons} mob={mob} />
        <ChecklistCard mob={mob} />
      </div>
    </div>
  );
}

/* ====== Members ====== */
const ROLE_PRIORITY: Record<string, number> = { "장로": 0, "안수집사": 1, "권사": 2, "집사": 3, "청년": 4, "성도": 5, "학생": 6, "새가족": 7, "영아": 8 };

function MembersSub({ db, setDb, persist, toast, currentWeek, openMemberModal, openDetail, openNoteModal, openQuickNote, detailId, deleteMembers, churchId }: {
  db: DB; setDb: (fn: (prev: DB) => DB) => void; persist: () => void;
  toast: (m: string, t?: string) => void; currentWeek: number;
  openMemberModal: (id?: string) => void; openDetail: (id: string) => void; openNoteModal: (id: string) => void;
  openQuickNote: (memberId: string, memberName: string, type: "note" | "prayer") => void;
  detailId: string | null; deleteMembers: (ids: string[]) => void;
  churchId: string | null;
}) {
  const mob = useIsMobile();
  const listRef = useRef<HTMLDivElement>(null);
  const [search, setSearch] = useState("");
  const [deptF, setDeptF] = useState("all");
  const [roleF, setRoleF] = useState("all");
  const [mokjangF, setMokjangF] = useState("all");
  const [statusF, setStatusF] = useState("all");
  const [newFamilyOnly, setNewFamilyOnly] = useState(false);
  const [prospectOnly, setProspectOnly] = useState(false);
  const [baptismF, setBaptismF] = useState("all");
  const [viewMode, setViewMode] = useState<"list" | "group" | "card">("list");
  const [selectedMokjang, setSelectedMokjang] = useState<string | null>(null);
  const [pageGroup, setPageGroup] = useState(1);
  const [pageList, setPageList] = useState(1);
  const [printOpen, setPrintOpen] = useState(false);
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(new Set());
  const printDropdownRef = useRef<HTMLDivElement>(null);
  const PAGE_SIZE_MEM = 10;
  const depts = getDepts(db);

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

  useEffect(() => {
    if (!printOpen) return;
    const close = (e: MouseEvent) => { if (printDropdownRef.current && !printDropdownRef.current.contains(e.target as Node)) setPrintOpen(false); };
    document.addEventListener("mousedown", close); return () => document.removeEventListener("mousedown", close);
  }, [printOpen]);
  const toggleSelect = (id: string) => { setSelectedMemberIds(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; }); };
  const selectAllFiltered = () => setSelectedMemberIds(new Set(filtered.map(m => m.id)));
  const clearSelection = () => setSelectedMemberIds(new Set());
  const mokjangList = getMokjangList(db);
  const denom = db.settings.denomination?.trim();
  const isChimrye = !!denom && denom.includes("침례");
  /* 침례교회: 침례·입교만 표시 (DB 값은 '세례' 유지), 미세례·유아세례 제거 */
  const baptismOptions = isChimrye
    ? [{ value: "세례", label: "침례" }, { value: "입교", label: "입교" }]
    : BAPTISM_LIST.map(b => ({ value: b, label: b }));

  /* 대시보드와 동일 조건: status !== "졸업/전출" (DashboardSub는 x.status만 사용) */
  const filtered = useMemo(() => {
    let r = db.members.filter(m => (m.member_status ?? m.status) !== "졸업/전출");
    if (search) {
      const q = search.toLowerCase();
      r = r.filter(m => (m.name || "").toLowerCase().includes(q) || (m.phone || "").replace(/\D/g, "").includes(q.replace(/\D/g, "")) || (m.address || "").toLowerCase().includes(q) || (m.memo || "").toLowerCase().includes(q) || (m.prayer || "").toLowerCase().includes(q));
    }
    if (deptF !== "all") r = r.filter(m => m.dept === deptF);
    if (roleF !== "all") r = r.filter(m => m.role === roleF);
    if (mokjangF !== "all") r = r.filter(m => ((m.mokjang ?? m.group) || "") === mokjangF);
    if (statusF !== "all") r = r.filter(m => (m.member_status ?? m.status) === statusF);
    if (newFamilyOnly) r = r.filter(m => m.is_new_family === true);
    if (prospectOnly) r = r.filter(m => m.is_prospect === true);
    if (baptismF !== "all") r = r.filter(m => m.baptism_type === baptismF);
    return r;
  }, [db.members, search, deptF, roleF, mokjangF, statusF, newFamilyOnly, prospectOnly, baptismF]);

  /* 목장별 그룹핑 (목자=직분 높은 순 정렬) */
  const grouped = useMemo(() => {
    const map: Record<string, Member[]> = {};
    filtered.forEach(m => {
      const g = (m.mokjang ?? m.group) || "미배정";
      if (!map[g]) map[g] = [];
      map[g].push(m);
    });
    for (const arr of Object.values(map)) {
      arr.sort((a, b) => (ROLE_PRIORITY[a.role || ""] ?? 99) - (ROLE_PRIORITY[b.role || ""] ?? 99));
    }
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  const selectedGroupMembers = selectedMokjang ? (grouped.find(([name]) => name === selectedMokjang)?.[1] ?? []) : [];
  const totalPagesGroup = Math.max(1, Math.ceil(selectedGroupMembers.length / PAGE_SIZE_MEM));
  const currentPageGroup = Math.min(pageGroup, totalPagesGroup);
  const pageGroupMembers = selectedGroupMembers.slice((currentPageGroup - 1) * PAGE_SIZE_MEM, currentPageGroup * PAGE_SIZE_MEM);

  const totalPagesList = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE_MEM));
  const currentPageList = Math.min(pageList, totalPagesList);
  const pageListMembers = filtered.slice((currentPageList - 1) * PAGE_SIZE_MEM, currentPageList * PAGE_SIZE_MEM);

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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* ─── 필터 바 ─── */}
      <div style={{ display: "flex", gap: mob ? 8 : 12, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: 1, minWidth: mob ? 0 : 200, width: mob ? "100%" : undefined }}>
          <div style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: C.textMuted }}><Icons.Search /></div>
          <input value={search} onChange={e => { setSearch(e.target.value); setPageList(1); setPageGroup(1); }} placeholder="이름, 연락처 검색..." style={{ width: "100%", height: mob ? 36 : 40, padding: "0 14px 0 38px", fontFamily: "inherit", fontSize: mob ? 13 : 14, background: "#fff", border: `1px solid ${C.border}`, borderRadius: 10, color: C.text, outline: "none" }} />
        </div>
        {mob ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, width: "100%" }}>
            <select value={deptF} onChange={e => { setDeptF(e.target.value); setPageList(1); setPageGroup(1); }} className="select-modern" style={{ flex: "1 1 80px", height: 36, width: "auto", fontSize: 12 }}>
              <option value="all">부서</option>
              {depts.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <select value={statusF} onChange={e => { setStatusF(e.target.value); setPageList(1); setPageGroup(1); }} className="select-modern" style={{ flex: "1 1 80px", height: 36, width: "auto", fontSize: 12 }}>
              <option value="all">전체 상태</option>
              {MEMBER_STATUS_LIST.map(s => s && <option key={s} value={s}>{s}</option>)}
            </select>
            <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, cursor: "pointer" }}><input type="checkbox" checked={newFamilyOnly} onChange={e => { setNewFamilyOnly(e.target.checked); setPageList(1); }} /> 새가족</label>
            <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, cursor: "pointer" }}><input type="checkbox" checked={prospectOnly} onChange={e => { setProspectOnly(e.target.checked); setPageList(1); }} /> 관심성도</label>
            <SBadge variant="accent">{filtered.length}명</SBadge>
            <Btn onClick={() => openMemberModal()} icon={<Icons.Plus />}>새 교인 등록</Btn>
          </div>
        ) : (
          <>
            <select value={deptF} onChange={e => { setDeptF(e.target.value); setPageList(1); setPageGroup(1); }} className="select-modern" style={{ height: 40, width: "auto", minWidth: 100 }}>
              <option value="all">부서</option>
              {depts.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <select value={roleF} onChange={e => { setRoleF(e.target.value); setPageList(1); setPageGroup(1); }} className="select-modern" style={{ height: 40, width: "auto", minWidth: 100 }}>
              <option value="all">직분</option>
              {ROLES_LIST.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <select value={mokjangF} onChange={e => { setMokjangF(e.target.value); setPageList(1); setPageGroup(1); }} className="select-modern" style={{ height: 40, width: "auto", minWidth: 100 }}>
              <option value="all">목장</option>
              {mokjangList.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <select value={statusF} onChange={e => { setStatusF(e.target.value); setPageList(1); setPageGroup(1); }} className="select-modern" style={{ height: 40, width: "auto", minWidth: 100 }}>
              <option value="all">전체 상태</option>
              {MEMBER_STATUS_LIST.map(s => s && <option key={s} value={s}>{s}</option>)}
            </select>
            <label style={{ display: "flex", alignItems: "center", gap: 6, height: 40, padding: "0 10px", fontSize: 13, cursor: "pointer", whiteSpace: "nowrap" }}><input type="checkbox" checked={newFamilyOnly} onChange={e => { setNewFamilyOnly(e.target.checked); setPageList(1); }} /> 새가족</label>
            <label style={{ display: "flex", alignItems: "center", gap: 6, height: 40, padding: "0 10px", fontSize: 13, cursor: "pointer", whiteSpace: "nowrap" }}><input type="checkbox" checked={prospectOnly} onChange={e => { setProspectOnly(e.target.checked); setPageList(1); }} /> 관심성도</label>
            <select value={baptismF} onChange={e => { setBaptismF(e.target.value); setPageList(1); setPageGroup(1); }} className="select-modern" style={{ height: 40, width: "auto", minWidth: 100 }}>
              <option value="all">전체</option>
              {baptismOptions.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
            </select>
            <SBadge variant="accent">{filtered.length}명</SBadge>
            <Btn onClick={() => openMemberModal()} icon={<Icons.Plus />}>새 교인 등록</Btn>
          </>
        )}
      </div>

      {/* ─── 뷰 토글 ─── */}
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center" }}>
        <button type="button" onClick={() => { setViewMode("list"); setSelectedMokjang(null); setPageList(1); }} style={{ padding: "6px 14px", borderRadius: 8, border: "none", fontSize: 13, fontWeight: 600, fontFamily: "inherit", background: viewMode === "list" ? C.navy : C.bg, color: viewMode === "list" ? "#fff" : C.text, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ display: "flex" }}><Icons.Table /></span> 테이블</button>
        <button type="button" onClick={() => { setViewMode("card"); setSelectedMokjang(null); setPageList(1); }} style={{ padding: "6px 14px", borderRadius: 8, border: "none", fontSize: 13, fontWeight: 600, fontFamily: "inherit", background: viewMode === "card" ? C.navy : C.bg, color: viewMode === "card" ? "#fff" : C.text, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ display: "flex" }}><Icons.Card /></span> 카드별</button>
        <button type="button" onClick={() => { setViewMode("group"); setSelectedMokjang(null); }} style={{ padding: "6px 14px", borderRadius: 8, border: "none", fontSize: 13, fontWeight: 600, fontFamily: "inherit", background: viewMode === "group" ? C.navy : C.bg, color: viewMode === "group" ? "#fff" : C.text, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ display: "flex" }}><Icons.Mokjang /></span> 목장별</button>
        {viewMode === "list" && selectedMemberIds.size > 0 && (
          <button type="button" onClick={() => { deleteMembers(Array.from(selectedMemberIds)); setSelectedMemberIds(new Set()); }} style={{ padding: "6px 12px", borderRadius: 8, border: `1px solid ${C.danger}`, fontSize: 13, fontFamily: "inherit", background: C.dangerBg || "#fee2e2", color: C.danger, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ display: "flex" }}><Icons.Trash2 /></span> 삭제 ({selectedMemberIds.size}명)</button>
        )}
        <div ref={printDropdownRef} style={{ position: "relative" }}>
          <button type="button" onClick={() => setPrintOpen(p => !p)} style={{ padding: "6px 12px", borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 13, fontFamily: "inherit", background: C.card, color: C.text, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ display: "flex" }}><Icons.Printer /></span> 인쇄</button>
          {printOpen && (
            <div style={{ position: "absolute", top: "100%", left: 0, marginTop: 4, background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, boxShadow: "0 4px 12px rgba(0,0,0,0.1)", zIndex: 50, minWidth: 160 }}>
              <button type="button" disabled={!detailId} onClick={async () => { setPrintOpen(false); const detailMember = db.members.find(m => m.id === detailId); if (!detailMember) return; try { const { generateChurchRegisterPdf } = await import("@/components/print/ChurchRegisterPrint"); await generateChurchRegisterPdf(detailMember, db.settings.churchName ?? "", db.settings.denomination); toast("교적부 PDF 다운로드됨", "ok"); } catch (e) { console.error(e); toast("PDF 생성 실패", "err"); } }} style={{ display: "block", width: "100%", padding: "8px 14px", textAlign: "left", border: "none", background: "none", fontSize: 13, fontFamily: "inherit", color: detailId ? C.text : C.textMuted, cursor: detailId ? "pointer" : "not-allowed" }}>교적부 양식</button>
              <button type="button" disabled={!detailId} onClick={async () => { setPrintOpen(false); const detailMember = db.members.find(m => m.id === detailId); if (!detailMember) return; const denom = db.settings.denomination?.trim(); const isChimrye = denom && denom.includes("침례"); const certLabel = isChimrye ? "침례증명서" : "세례증명서"; try { const { generateBaptismCertificatePdf } = await import("@/components/print/BaptismCertificate"); await generateBaptismCertificatePdf(detailMember, db.settings.churchName ?? "", null, db.settings.denomination); toast(`${certLabel} PDF 다운로드됨`, "ok"); } catch (e) { console.error(e); toast("PDF 생성 실패", "err"); } }} style={{ display: "block", width: "100%", padding: "8px 14px", textAlign: "left", border: "none", background: "none", fontSize: 13, fontFamily: "inherit", color: detailId ? C.text : C.textMuted, cursor: detailId ? "pointer" : "not-allowed" }}>{isChimrye ? "침례증명서" : "세례증명서"}</button>
              <button type="button" disabled={!detailId} onClick={async () => { setPrintOpen(false); const detailMember = db.members.find(m => m.id === detailId); if (!detailMember) return; try { const { generateMemberCertificatePdf } = await import("@/components/print/MemberCertificate"); await generateMemberCertificatePdf(detailMember, db.settings.churchName ?? "", null); toast("교인증명서 PDF 다운로드됨", "ok"); } catch (e) { console.error(e); toast("PDF 생성 실패", "err"); } }} style={{ display: "block", width: "100%", padding: "8px 14px", textAlign: "left", border: "none", background: "none", fontSize: 13, fontFamily: "inherit", color: detailId ? C.text : C.textMuted, cursor: detailId ? "pointer" : "not-allowed" }}>교인증명서</button>
              <button type="button" onClick={async () => { setPrintOpen(false); const list = selectedMemberIds.size > 0 ? filtered.filter(m => selectedMemberIds.has(m.id)) : filtered; if (list.length === 0) { toast("대상 교인이 없습니다", "warn"); return; } try { const { generateAddressLabelPdf } = await import("@/components/print/AddressLabelPrint"); await generateAddressLabelPdf(list.slice(0, 500)); toast("주소 라벨 PDF 다운로드됨", "ok"); } catch (e) { console.error(e); toast("PDF 생성 실패", "err"); } }} style={{ display: "block", width: "100%", padding: "8px 14px", textAlign: "left", border: "none", background: "none", fontSize: 13, fontFamily: "inherit", color: C.text, cursor: "pointer" }}>주소 라벨</button>
              <button type="button" onClick={async () => { setPrintOpen(false); const list = selectedMemberIds.size > 0 ? filtered.filter(m => selectedMemberIds.has(m.id)) : filtered; if (list.length === 0) { toast("대상 교인이 없습니다", "warn"); return; } try { const { generateCustomReportPdf } = await import("@/components/print/CustomReportPrint"); await generateCustomReportPdf(list.slice(0, 500)); toast("커스텀 보고서 PDF 다운로드됨", "ok"); } catch (e) { console.error(e); toast("PDF 생성 실패", "err"); } }} style={{ display: "block", width: "100%", padding: "8px 14px", textAlign: "left", border: "none", background: "none", fontSize: 13, fontFamily: "inherit", color: C.text, cursor: "pointer" }}>커스텀 보고서</button>
            </div>
          )}
        </div>
      </div>

      {/* ─── 목장별 뷰: 목장 이름만 진열 → 클릭 시 목장원 표시 (10명 단위 페이지) ─── */}
      {viewMode === "group" && (
        <>
          {selectedMokjang === null ? (
            /* 목장 이름 카드만 진열 */
            <div style={{ display: "grid", gridTemplateColumns: mob ? "1fr 1fr" : "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
              {grouped.length === 0 ? (
                <Card><div style={{ textAlign: "center", color: C.textMuted, padding: 24 }}>검색 결과가 없습니다</div></Card>
              ) : grouped.map(([gName, gMembers]) => (
                <button key={gName} type="button" onClick={() => { setSelectedMokjang(gName); setPageGroup(1); }} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "14px 18px", background: `linear-gradient(135deg, ${C.navy}, ${C.navyLight})`, color: "#fff", border: "none", borderRadius: 12, cursor: "pointer", fontFamily: "inherit", fontSize: 15, fontWeight: 700, textAlign: "left", transition: "transform 0.15s, box-shadow 0.2s" }}>
                  <span>🏠 {gName}</span>
                  <span style={{ background: "rgba(255,255,255,0.25)", padding: "4px 10px", borderRadius: 20, fontSize: 13, fontWeight: 600 }}>{gMembers.length}명</span>
                </button>
              ))}
            </div>
          ) : (
            /* 선택된 목장의 목장원 (10명 단위 페이지) — 테이블로 한눈에 */
            <div ref={listRef}><Card style={{ padding: 0, overflow: "hidden" }}>
              <div style={{ padding: "14px 20px", background: C.bg, borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
                <button type="button" onClick={() => { setSelectedMokjang(null); setPageGroup(1); }} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", border: "none", background: "transparent", color: C.accent, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>← 목장 목록</button>
                <span style={{ color: C.navy, fontWeight: 700 }}>🏠 {selectedMokjang} ({selectedGroupMembers.length}명)</span>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                  <thead>
                    <tr style={{ background: C.bg }}>
                      {["이름","부서","출석","기도제목","최근 심방"].map((h, i) => (
                        <th key={i} style={{ padding: "10px 14px", textAlign: "left", fontWeight: 600, fontSize: 13, color: C.navy, borderBottom: `1px solid ${C.border}`, whiteSpace: "nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pageGroupMembers.map((m, idx) => {
                      const ws = (db.attendance[m.id] || {})[currentWeek] || "n";
                      const globalIdx = (currentPageGroup - 1) * PAGE_SIZE_MEM + idx;
                      const isLeader = globalIdx === 0;
                      const notes = (db.notes[m.id] || []).slice().reverse();
                      const lastVisit = notes.find(n => n.type === "visit");
                      const prayerSnip = m.prayer ? (m.prayer.length > 20 ? m.prayer.substring(0, 20) + "…" : m.prayer) : "-";
                      return (
                        <tr key={m.id} onClick={() => openDetail(m.id)} style={{ cursor: "pointer", borderBottom: `1px solid ${C.borderLight}`, transition: "background 0.1s" }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = C.bg; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
                          <td style={{ padding: "10px 14px", minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                              <div style={{ width: 34, height: 34, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, background: isLeader ? `linear-gradient(135deg, ${C.accent}, ${C.purple})` : `linear-gradient(135deg, ${C.accentBg}, ${C.tealBg})`, color: isLeader ? "#fff" : C.accent, overflow: "hidden", flexShrink: 0 }}>
                                {m.photo ? <img src={m.photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : (m.name || "?")[0]}
                              </div>
                              <div style={{ minWidth: 0 }}><div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}><span style={{ fontWeight: 700, fontSize: 14, color: C.navy, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display: "block" }}>{m.name}</span>{isLeader && <span style={{ fontSize: 10, fontWeight: 700, color: C.accent, background: C.accentBg, padding: "2px 6px", borderRadius: 8, flexShrink: 0 }}>목자</span>}</div><div style={{ fontSize: 12, color: C.textMuted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.role || ""}</div></div>
                            </div>
                          </td>
                          <td style={{ padding: "10px 14px" }}><SBadge variant="gray">{m.dept || "-"}</SBadge></td>
                          <td style={{ padding: "10px 14px" }}><AttDot status={ws} onClick={() => cycleAtt(m.id)} /></td>
                          <td style={{ padding: "10px 14px", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 13, color: C.purple }}>{prayerSnip}</td>
                          <td style={{ padding: "10px 14px", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 12 }}>{lastVisit ? `${lastVisit.date} ${lastVisit.content.substring(0, 10)}…` : "-"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card></div>
          )}
          {viewMode === "group" && selectedMokjang && (
            <Pagination totalItems={selectedGroupMembers.length} itemsPerPage={PAGE_SIZE_MEM} currentPage={currentPageGroup} onPageChange={(p) => { setPageGroup(p); listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }} />
          )}
        </>
      )}

      {/* ─── 카드 뷰 ─── */}
      {viewMode === "card" && (
        <>
          <div ref={listRef} style={{ display: "grid", gridTemplateColumns: mob ? "1fr 1fr" : "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
            {filtered.length === 0 ? (
              <Card><div style={{ textAlign: "center", color: C.textMuted, padding: 24 }}>검색 결과가 없습니다</div></Card>
            ) : pageListMembers.map(m => {
              const st = m.member_status ?? m.status;
              const badgeColor = st === "활동" ? "#10B981" : st === "휴적" ? "#F59E0B" : st === "이적" || st === "제적" ? "#EF4444" : "#6B7280";
              return (
                <button key={m.id} type="button" onClick={() => openDetail(m.id)} style={{ textAlign: "left", padding: 16, background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, cursor: "pointer", fontFamily: "inherit", transition: "transform 0.15s, box-shadow 0.2s" }} onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.02)"; e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.08)"; }} onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = ""; }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                    <div style={{ width: 48, height: 48, borderRadius: "50%", overflow: "hidden", flexShrink: 0, background: C.accentBg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 700, color: C.accent }}>
                      {m.photo ? <img src={m.photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : (m.name || "?")[0]}
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 15, color: C.navy, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.name}</div>
                      <div style={{ fontSize: 12, color: C.textMuted }}>{m.role || "-"} · {m.dept || "-"}</div>
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 6 }}>목장 {(m.mokjang ?? m.group) || "-"}</div>
                  <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 600, color: "#fff", background: badgeColor }}>{st || "활동"}</span>
                </button>
              );
            })}
          </div>
          {viewMode === "card" && <Pagination totalItems={filtered.length} itemsPerPage={PAGE_SIZE_MEM} currentPage={currentPageList} onPageChange={(p) => { setPageList(p); listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }} />}
        </>
      )}

      {/* ─── 테이블 목록 뷰 ─── */}
      {viewMode === "list" && (
        <>
          <div ref={listRef}><Card style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                <thead>
                  <tr style={{ background: C.bg }}>
                    <th style={{ padding: "12px 8px", width: 40, textAlign: "center", fontWeight: 600, fontSize: 13, color: C.navy, borderBottom: `1px solid ${C.border}` }}><input type="checkbox" checked={filtered.length > 0 && selectedMemberIds.size === filtered.length} onChange={e => { if (e.target.checked) selectAllFiltered(); else clearSelection(); }} onClick={e => e.stopPropagation()} /></th>
                    {["이름","부서","목장","출석","기도제목","최근 심방","최근 메모",""].map((h, i) => (
                      <th key={i} style={{ padding: "12px 16px", textAlign: "left", fontWeight: 600, fontSize: 13, color: C.navy, borderBottom: `1px solid ${C.border}`, whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan={9} style={{ padding: 48, textAlign: "center", color: C.textMuted }}>
                      <div style={{ fontSize: 48, opacity: 0.3, marginBottom: 12 }}>📭</div>
                      <div style={{ fontSize: 17, fontWeight: 600, color: C.text, marginBottom: 6 }}>성도가 없습니다</div>
                      <div style={{ fontSize: 14 }}>&apos;새 교인 등록&apos; 버튼으로 첫 성도를 등록해 주세요</div>
                    </td></tr>
                  ) : pageListMembers.map(m => {
                    const ws = (db.attendance[m.id] || {})[currentWeek] || "n";
                    const notes = (db.notes[m.id] || []).slice().reverse();
                    const lastMemo = notes.find(n => n.type === "memo");
                    const lastPrayerNote = notes.find(n => n.type === "prayer");
                    const lastVisit = notes.find(n => n.type === "visit");
                    const prayerPreview = m.prayer || lastPrayerNote?.content || "";
                    const prayerSnip = prayerPreview ? (prayerPreview.length > 15 ? prayerPreview.substring(0, 15) + "…" : prayerPreview) : "";
                    const memoSnip = lastMemo?.content ? (lastMemo.content.length > 15 ? lastMemo.content.substring(0, 15) + "…" : lastMemo.content) : "";
                    return (
                      <tr key={m.id} onClick={() => openDetail(m.id)} style={{ cursor: "pointer", borderBottom: `1px solid ${C.borderLight}`, transition: "background 0.1s" }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = C.bg; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
                        <td style={{ padding: "12px 8px", width: 40, textAlign: "center", verticalAlign: "middle" }} onClick={e => e.stopPropagation()}>
                          <input type="checkbox" checked={selectedMemberIds.has(m.id)} onChange={() => toggleSelect(m.id)} />
                        </td>
                        <td style={{ padding: "12px 16px", minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                            <div style={{ width: 38, height: 38, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, background: `linear-gradient(135deg,${C.accentBg},${C.tealBg})`, color: C.accent, overflow: "hidden", flexShrink: 0 }}>
                              {m.photo ? <img src={m.photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : (m.name || "?")[0]}
                            </div>
                            <div style={{ minWidth: 0 }}><div style={{ fontWeight: 600, color: C.navy, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.name}</div><div style={{ fontSize: 12, color: C.textMuted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.role || ""}</div></div>
                          </div>
                        </td>
                        <td style={{ padding: "12px 16px" }}><SBadge variant="gray">{m.dept || "-"}</SBadge></td>
                        <td style={{ padding: "12px 16px", whiteSpace: "nowrap", fontSize: 13 }}>{(m.mokjang ?? m.group) || "-"}</td>
                        <td style={{ padding: "12px 16px" }}><AttDot status={ws} onClick={() => cycleAtt(m.id)} /></td>
                        <td style={{ padding: "12px 16px", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 13, color: C.purple, cursor: "pointer" }} onClick={e => { e.stopPropagation(); openQuickNote(m.id, m.name || "?", "prayer"); }}>{prayerSnip || <span style={{ color: C.textFaint, fontSize: 12 }}>+ 추가</span>}</td>
                        <td style={{ padding: "12px 16px", maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 12 }}>{lastVisit ? `${lastVisit.date} ${lastVisit.content.substring(0, 12)}…` : "-"}</td>
                        <td style={{ padding: "12px 16px" }} onClick={e => e.stopPropagation()}>
                          {memoSnip ? <button type="button" onClick={() => openQuickNote(m.id, m.name || "?", "note")} style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 13, color: C.text, textAlign: "left", maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{NOTE_ICONS.memo} {memoSnip}</button> : <button type="button" onClick={() => openQuickNote(m.id, m.name || "?", "note")} style={{ color: C.textFaint, fontSize: 12, background: "none", border: "none", cursor: "pointer", padding: 0 }}>+ 추가</button>}
                        </td>
                        <td style={{ padding: "12px 16px" }}><Btn variant="soft" size="sm" icon={<FileText size={14} />} onClick={(e) => { e?.stopPropagation(); openNoteModal(m.id); }} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card></div>
          {viewMode === "list" && (
            <Pagination totalItems={filtered.length} itemsPerPage={PAGE_SIZE_MEM} currentPage={currentPageList} onPageChange={(p) => { setPageList(p); listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }} />
          )}
        </>
      )}
    </div>
  );
}

/* 주차 → 해당 월 (1~12). 52주를 12개월로 나눔 */
function getMonthFromWeek(w: number): number {
  if (w < 1 || w > 52) return 1;
  return Math.min(12, Math.ceil((w / 52) * 12));
}
function getWeeksInMonth(month: number): number[] {
  if (month < 1 || month > 12) return [];
  const start = Math.ceil(((month - 1) / 12) * 52) + 1;
  const end = month === 12 ? 52 : Math.ceil((month / 12) * 52);
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

/* ====== Attendance ====== */
function AttendanceSub({ db, setDb, persist, toast, currentWeek, setCurrentWeek }: {
  db: DB; setDb: (fn: (prev: DB) => DB) => void; persist: () => void;
  toast: (m: string, t?: string) => void; currentWeek: number; setCurrentWeek: (w: number) => void;
}) {
  const mob = useIsMobile();
  const listRefAtt = useRef<HTMLDivElement>(null);
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const [attYear, setAttYear] = useState(currentYear);
  const [attMonth, setAttMonth] = useState(currentMonth);
  const [deptF, setDeptF] = useState("all");
  const depts = getDepts(db);
  let m = db.members.filter(x => x.status !== "졸업/전출");
  if (deptF !== "all") m = m.filter(x => x.dept === deptF);

  const weeksInRange = useMemo(() => getWeeksInMonth(attMonth), [attMonth]);

  const present = m.filter(s => (db.attendance[s.id] || {})[currentWeek] === "p").length;
  const absent = m.filter(s => (db.attendance[s.id] || {})[currentWeek] === "a").length;
  const unchecked = m.length - present - absent;
  const rate = m.length > 0 ? Math.round(present / m.length * 100) : 0;

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

  const setAbsentReason = (memberId: string, reason: string) => {
    setDb(prev => {
      const nextReasons = { ...(prev.attendanceReasons || {}) };
      if (!nextReasons[memberId]) nextReasons[memberId] = {};
      nextReasons[memberId] = { ...nextReasons[memberId], [currentWeek]: reason };
      return { ...prev, attendanceReasons: nextReasons };
    });
    persist();
  };

  const [viewModeAtt, setViewModeAtt] = useState<"list" | "group">("list");
  const [pageAtt, setPageAtt] = useState(1);
  const [selectedMokjangAtt, setSelectedMokjangAtt] = useState<string | null>(null);
  const [pageGroupAtt, setPageGroupAtt] = useState(1);
  const PAGE_SIZE_ATT = 10;
  const groupedByMokjang = useMemo(() => {
    const map: Record<string, typeof m> = {};
    m.forEach(mem => {
      const g = (mem.mokjang ?? mem.group) || "미배정";
      if (!map[g]) map[g] = [];
      map[g].push(mem);
    });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [m]);
  const totalPagesAtt = Math.max(1, Math.ceil(m.length / PAGE_SIZE_ATT));
  const currentPageAtt = Math.min(pageAtt, totalPagesAtt);
  const pageMembers = m.slice((currentPageAtt - 1) * PAGE_SIZE_ATT, currentPageAtt * PAGE_SIZE_ATT);
  const selectedGroupMembers = selectedMokjangAtt ? (groupedByMokjang.find(([name]) => name === selectedMokjangAtt)?.[1] ?? []) : [];
  const totalPagesGroup = Math.max(1, Math.ceil(selectedGroupMembers.length / PAGE_SIZE_ATT));
  const currentPageGroup = Math.min(pageGroupAtt, totalPagesGroup);
  const pageGroupMembers = selectedGroupMembers.slice((currentPageGroup - 1) * PAGE_SIZE_ATT, currentPageGroup * PAGE_SIZE_ATT);
  const [absentReasonModal, setAbsentReasonModal] = useState<{ memberId: string; name: string } | null>(null);
  const [absentReasonInput, setAbsentReasonInput] = useState("");

  const goPrevWeek = () => {
    const idx = weeksInRange.indexOf(currentWeek);
    if (idx > 0) setCurrentWeek(weeksInRange[idx - 1]);
    else if (currentWeek > 1) setCurrentWeek(currentWeek - 1);
  };
  const goNextWeek = () => {
    const idx = weeksInRange.indexOf(currentWeek);
    if (idx >= 0 && idx < weeksInRange.length - 1) setCurrentWeek(weeksInRange[idx + 1]);
    else if (currentWeek < 52) setCurrentWeek(currentWeek + 1);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <Card>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: mob ? 8 : 12, marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "nowrap", minWidth: 0, flex: "1 1 auto" }}>
            <ModernSelect
              value={String(attYear)}
              onChange={(v) => setAttYear(Number(v))}
              options={[currentYear, currentYear - 1, currentYear - 2].map(y => ({ value: String(y), label: `${y}년` }))}
              style={{ marginBottom: 0, width: 96, minWidth: 88, flexShrink: 0 }}
            />
            <ModernSelect
              value={String(attMonth)}
              onChange={(v) => {
                const num = Number(v);
                setAttMonth(num);
                setCurrentWeek(getWeeksInMonth(num)[0] ?? 1);
              }}
              options={Array.from({ length: 12 }, (_, i) => i + 1).map(mo => ({ value: String(mo), label: `${mo}월` }))}
              style={{ marginBottom: 0, width: 80, minWidth: 72, flexShrink: 0 }}
            />
            <span style={{ color: C.textMuted, fontSize: 12, flexShrink: 0 }}>·</span>
            <Btn variant="ghost" size="sm" onClick={goPrevWeek} style={{ width: 32, height: 32, padding: 0, justifyContent: "center", flexShrink: 0 }}>◀</Btn>
            <span style={{ fontSize: mob ? 15 : 18, fontWeight: 700, minWidth: mob ? 56 : 72, textAlign: "center", flexShrink: 0 }}>제{currentWeek}주</span>
            <Btn variant="ghost" size="sm" onClick={goNextWeek} style={{ width: 32, height: 32, padding: 0, justifyContent: "center", flexShrink: 0 }}>▶</Btn>
            {!mob && (
              <div style={{ display: "flex", gap: 3, flexWrap: "nowrap", alignItems: "center" }}>
                {weeksInRange.map((w, idx) => {
                  const hasData = db.members.some(x => db.attendance[x.id] && db.attendance[x.id][w]);
                  const isActive = w === currentWeek;
                  return (
                    <div key={w} onClick={() => setCurrentWeek(w)} style={{
                      width: 24, height: 24, borderRadius: 6, fontSize: 10, fontWeight: 600, flexShrink: 0,
                      display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
                      background: isActive ? C.accent : hasData ? C.accentBg : C.bg,
                      color: isActive ? "#fff" : hasData ? C.accent : C.textFaint,
                      border: isActive ? `1.5px solid ${C.accent}30` : "1.5px solid transparent", transition: "all 0.15s",
                    }}>{idx + 1}</div>
                  );
                })}
              </div>
            )}
          </div>
          <ModernSelect
            value={deptF}
            onChange={(v) => setDeptF(v)}
            options={[{ value: "all", label: "전체 부서" }, ...depts.map(d => ({ value: d, label: d }))]}
            style={{ marginBottom: 0, width: 120, minWidth: 90, flexShrink: 0 }}
          />
        </div>
        {mob && (
          <div style={{ display: "flex", gap: 3, flexWrap: "wrap", marginBottom: 4 }}>
            {weeksInRange.map((w, idx) => {
              const hasData = db.members.some(x => db.attendance[x.id] && db.attendance[x.id][w]);
              const isActive = w === currentWeek;
              return (
                <div key={w} onClick={() => setCurrentWeek(w)} style={{
                  width: 24, height: 24, borderRadius: 6, fontSize: 10, fontWeight: 600,
                  display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
                  background: isActive ? C.accent : hasData ? C.accentBg : C.bg,
                  color: isActive ? "#fff" : hasData ? C.accent : C.textFaint,
                  border: isActive ? `1.5px solid ${C.accent}30` : "1.5px solid transparent", transition: "all 0.15s",
                }}>{idx + 1}</div>
              );
            })}
          </div>
        )}
      </Card>

      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 8 }}>
        <button type="button" onClick={() => { setViewModeAtt("list"); setSelectedMokjangAtt(null); }} style={{ padding: "6px 14px", borderRadius: 8, border: "none", fontSize: 13, fontWeight: 600, fontFamily: "inherit", background: viewModeAtt === "list" ? C.navy : C.bg, color: viewModeAtt === "list" ? "#fff" : C.text, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ display: "flex" }}><Icons.Table /></span> 전체 목록</button>
        <button type="button" onClick={() => { setViewModeAtt("group"); setSelectedMokjangAtt(null); }} style={{ padding: "6px 14px", borderRadius: 8, border: "none", fontSize: 13, fontWeight: 600, fontFamily: "inherit", background: viewModeAtt === "group" ? C.navy : C.bg, color: viewModeAtt === "group" ? "#fff" : C.text, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ display: "flex" }}><Icons.Mokjang /></span> 목장별</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: mob ? "1fr 1fr" : "repeat(auto-fit, minmax(180px, 1fr))", gap: mob ? 10 : 16 }}>
        <StatCard label="출석" value={`${present}명`} color={C.success} />
        <StatCard label="결석" value={`${absent}명`} color={C.danger} />
        <StatCard label="출석률" value={`${rate}%`} sub={`${unchecked}명 미체크`} color={C.accent} />
      </div>

      <div ref={listRefAtt}><Card style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead><tr style={{ background: C.bg }}>
              {["이름","부서","상태","출석체크","결석 사유","연속출석"].map((h, i) => (
                <th key={i} style={{ padding: "12px 16px", textAlign: i === 3 ? "center" : "left", fontWeight: 600, fontSize: 13, color: C.navy, borderBottom: `1px solid ${C.border}`, whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {viewModeAtt === "group" ? (
                selectedMokjangAtt === null ? (
                  /* 목장 이름만 진열 — 클릭 시 해당 목장원으로 이동 */
                  <tr><td colSpan={6} style={{ padding: 0, border: "none", verticalAlign: "top" }}>
                    <div style={{ display: "grid", gridTemplateColumns: mob ? "1fr 1fr" : "repeat(auto-fill, minmax(200px, 1fr))", gap: 12, padding: 16 }}>
                      {groupedByMokjang.map(([gName, gMembers]) => (
                        <button key={gName} type="button" onClick={() => { setSelectedMokjangAtt(gName); setPageGroupAtt(1); }} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "14px 18px", background: C.navy, color: "#fff", border: "none", borderRadius: 12, cursor: "pointer", fontFamily: "inherit", fontSize: 15, fontWeight: 700, textAlign: "left", transition: "transform 0.15s, box-shadow 0.2s" }}>
                          <span>🏠 {gName}</span>
                          <span style={{ background: "rgba(255,255,255,0.25)", padding: "4px 10px", borderRadius: 20, fontSize: 13, fontWeight: 600 }}>{gMembers.length}명</span>
                        </button>
                      ))}
                    </div>
                  </td></tr>
                ) : (
                  <>
                    <tr style={{ background: C.bg }}>
                      <td colSpan={6} style={{ padding: "10px 16px", borderBottom: `1px solid ${C.border}` }}>
                        <button type="button" onClick={() => { setSelectedMokjangAtt(null); setPageGroupAtt(1); }} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", border: "none", background: "transparent", color: C.accent, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>← 목장 목록</button>
                        <span style={{ marginLeft: 12, color: C.navy, fontWeight: 700 }}>🏠 {selectedMokjangAtt} ({selectedGroupMembers.length}명)</span>
                      </td>
                    </tr>
                    {pageGroupMembers.map(s => {
                      const att = db.attendance[s.id] || {};
                      const ws: AttStatus = (att[currentWeek] === "p" || att[currentWeek] === "a") ? att[currentWeek] : "n";
                      const labels: Record<string, string> = { p: "출석", a: "결석", n: "미체크" };
                      const reason = db.attendanceReasons?.[s.id]?.[currentWeek] || "";
                      let streak = 0;
                      for (let w = currentWeek; w >= 1; w--) { if (att[w] === "p") streak++; else break; }
                      return (
                        <tr key={s.id} style={{ borderBottom: `1px solid ${C.borderLight}` }}>
                          <td style={{ padding: "12px 16px", minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                              <div style={{ width: 38, height: 38, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, background: `linear-gradient(135deg,${C.accentBg},${C.tealBg})`, color: C.accent, overflow: "hidden", flexShrink: 0 }}>
                                {s.photo ? <img src={s.photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : (s.name || "?")[0]}
                              </div>
                              <strong style={{ color: C.navy, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display: "block", minWidth: 0 }}>{s.name}</strong>
                            </div>
                          </td>
                          <td style={{ padding: "12px 16px" }}><SBadge variant="gray">{s.dept}</SBadge></td>
                          <td style={{ padding: "12px 16px" }}><SBadge variant={STATUS_BADGE[s.status || ""] || "gray"}>{s.status}</SBadge></td>
                          <td style={{ padding: "12px 16px", textAlign: "center" }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                              <AttDot status={ws} onClick={() => cycleAtt(s.id)} />
                              <span style={{ fontSize: 12, color: C.textMuted }}>{labels[ws]}</span>
                            </div>
                          </td>
                          <td style={{ padding: "12px 16px", maxWidth: 160 }}>
                            {ws === "a" ? (
                              <button type="button" onClick={() => { setAbsentReasonModal({ memberId: s.id, name: s.name }); setAbsentReasonInput(reason); }} style={{ fontSize: 12, background: reason ? C.bg : C.dangerBg, color: reason ? C.text : C.danger, border: "none", padding: "4px 10px", borderRadius: 6, cursor: "pointer", textAlign: "left", maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={reason || "사유 입력"}>
                                {reason ? reason : "+ 사유 입력"}
                              </button>
                            ) : <span style={{ color: C.textFaint }}>-</span>}
                          </td>
                          <td style={{ padding: "12px 16px" }}>{streak > 0 ? <SBadge variant="success">{streak}주 연속</SBadge> : <span style={{ color: C.textFaint }}>-</span>}</td>
                        </tr>
                      );
                    })}
                  </>
                )
              ) : (
                pageMembers.map(s => {
                  const att = db.attendance[s.id] || {};
                  const ws: AttStatus = (att[currentWeek] === "p" || att[currentWeek] === "a") ? att[currentWeek] : "n";
                  const labels: Record<string, string> = { p: "출석", a: "결석", n: "미체크" };
                  const reason = db.attendanceReasons?.[s.id]?.[currentWeek] || "";
                  let streak = 0;
                  for (let w = currentWeek; w >= 1; w--) { if (att[w] === "p") streak++; else break; }
                  return (
                    <tr key={s.id} style={{ borderBottom: `1px solid ${C.borderLight}` }}>
                      <td style={{ padding: "12px 16px", minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                          <div style={{ width: 38, height: 38, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, background: `linear-gradient(135deg,${C.accentBg},${C.tealBg})`, color: C.accent, overflow: "hidden", flexShrink: 0 }}>
                            {s.photo ? <img src={s.photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : (s.name || "?")[0]}
                          </div>
                          <strong style={{ color: C.navy, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display: "block", minWidth: 0 }}>{s.name}</strong>
                        </div>
                      </td>
                      <td style={{ padding: "12px 16px" }}><SBadge variant="gray">{s.dept}</SBadge></td>
                      <td style={{ padding: "12px 16px" }}><SBadge variant={STATUS_BADGE[s.status || ""] || "gray"}>{s.status}</SBadge></td>
                      <td style={{ padding: "12px 16px", textAlign: "center" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                          <AttDot status={ws} onClick={() => cycleAtt(s.id)} />
                          <span style={{ fontSize: 12, color: C.textMuted }}>{labels[ws]}</span>
                        </div>
                      </td>
                      <td style={{ padding: "12px 16px", maxWidth: 160 }}>
                        {ws === "a" ? (
                          <button type="button" onClick={() => { setAbsentReasonModal({ memberId: s.id, name: s.name }); setAbsentReasonInput(reason); }} style={{ fontSize: 12, background: reason ? C.bg : C.dangerBg, color: reason ? C.text : C.danger, border: "none", padding: "4px 10px", borderRadius: 6, cursor: "pointer", textAlign: "left", maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={reason || "사유 입력"}>
                            {reason ? reason : "+ 사유 입력"}
                          </button>
                        ) : <span style={{ color: C.textFaint }}>-</span>}
                      </td>
                      <td style={{ padding: "12px 16px" }}>{streak > 0 ? <SBadge variant="success">{streak}주 연속</SBadge> : <span style={{ color: C.textFaint }}>-</span>}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
      {viewModeAtt === "list" && (
        <Pagination totalItems={m.length} itemsPerPage={PAGE_SIZE_ATT} currentPage={currentPageAtt} onPageChange={(p) => { setPageAtt(p); listRefAtt.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }} />
      )}
      {viewModeAtt === "group" && selectedMokjangAtt && (
        <Pagination totalItems={selectedGroupMembers.length} itemsPerPage={PAGE_SIZE_ATT} currentPage={currentPageGroup} onPageChange={(p) => { setPageGroupAtt(p); listRefAtt.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }} />
      )}
      </div>
      {absentReasonModal && (
        <Modal open={true} onClose={() => setAbsentReasonModal(null)} title={`결석 사유 · ${absentReasonModal.name}`} width={400}>
          <FormTextarea label="사유 (선택)" value={absentReasonInput} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setAbsentReasonInput(e.target.value)} placeholder="예: 병원, 여행, 개인사정" style={{ minHeight: 80 }} />
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
            <Btn variant="secondary" onClick={() => setAbsentReasonModal(null)}>취소</Btn>
            <Btn onClick={() => { setAbsentReason(absentReasonModal.memberId, absentReasonInput.trim()); setAbsentReasonModal(null); setAbsentReasonInput(""); toast("저장되었습니다", "ok"); }}>저장</Btn>
          </div>
        </Modal>
      )}
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
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, background: "#f8f9fc", minHeight: "100%" }}>
      <div style={{ display: "flex", gap: mob ? 8 : 12, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: 1, minWidth: mob ? 0 : 200, width: mob ? "100%" : undefined }}>
          <div style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "#9CA3AF", pointerEvents: "none" }}><Icons.Search /></div>
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            placeholder="제목, 기도제목 검색"
            style={{
              width: "100%",
              height: 44,
              padding: "0 14px 0 40px",
              fontFamily: "inherit",
              fontSize: 14,
              background: "#fff",
              border: `1px solid ${searchFocused ? "#4F46E5" : "#e5e7eb"}`,
              borderRadius: 12,
              color: C.text,
              outline: "none",
              boxShadow: searchFocused ? "0 0 0 2px rgba(79,70,229,0.2)" : "none",
              transition: "border-color 0.2s, box-shadow 0.2s",
            }}
          />
        </div>
        <select
          value={typeF === "visit" || typeF === "event" ? "all" : typeF}
          onChange={e => { setTypeF(e.target.value); setCurrentPage(1); }}
          className="select-modern"
          style={{ height: 44, width: "auto", minWidth: 120 }}
        >
          <option value="all">전체</option>
          <option value="prayer">기도</option>
          <option value="memo">메모</option>
        </select>
        {typeF === "all" && (
          <span style={{ display: "inline-flex", alignItems: "center", padding: "6px 12px", borderRadius: 9999, fontSize: 12, fontWeight: 500, background: "#ECFDF5", color: "#059669" }}>
            전체
          </span>
        )}
        <Btn variant="primary" icon={<Icons.Plus />} onClick={() => openNoteModal()}>+ 기도</Btn>
      </div>
      <div ref={listRefNotes}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: 48 }}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}><Heart size={40} strokeWidth={1.5} style={{ color: C.textMuted }} /></div>
            <div style={{ fontSize: 17, fontWeight: 600, color: "#1F2937", marginBottom: 8 }}>등록된 기도제목이 없습니다</div>
            <Btn variant="primary" icon={<Icons.Plus />} onClick={() => openNoteModal()}>+ 기도</Btn>
          </div>
        ) : (
          <>
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
            <Pagination totalItems={filtered.length} itemsPerPage={10} currentPage={currentPage} onPageChange={(p) => { setCurrentPage(p); listRefNotes.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }} />
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
  mob,
}: {
  memberId: string;
  member: Member;
  db: DB;
  setDb: (fn: (prev: DB) => DB) => void;
  persist: () => void;
  toast: (m: string, t?: string) => void;
  onClose: () => void;
  mob: boolean;
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

  const navBg = C.navy;
  const width = mob ? undefined : 720;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(27,42,74,0.4)", backdropFilter: "blur(4px)", padding: mob ? 0 : 20 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: mob ? "20px 20px 0 0" : 20, width: mob ? "100%" : "90%", maxWidth: width, height: mob ? "92vh" : "85vh", maxHeight: mob ? "92vh" : "85vh", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 20px 60px rgba(27,42,74,0.15)" }}>
        {/* Header — 남색 */}
        <div style={{ background: navBg, padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 48, height: 48, borderRadius: "50%", overflow: "hidden", flexShrink: 0, background: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 700, color: "#fff" }}>
              {member.photo ? <img src={member.photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : (member.name || "?")[0]}
            </div>
            <div>
              <span style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>{member.name}</span>
              {member.dept && (
                <span style={{ marginLeft: 8, display: "inline-flex", alignItems: "center", padding: "2px 10px", borderRadius: 9999, fontSize: 12, fontWeight: 500, background: "rgba(255,255,255,0.2)", color: "#fff" }}>
                  {member.dept}
                </span>
              )}
            </div>
          </div>
          <button type="button" onClick={onClose} style={{ background: "rgba(255,255,255,0.15)", border: "none", width: 36, height: 36, borderRadius: 10, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }} aria-label="닫기">✕</button>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, padding: "12px 20px", borderBottom: `1px solid ${C.border}`, background: "#fff", flexShrink: 0 }}>
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
                background: filter === f ? C.navy : "transparent",
                color: filter === f ? "#fff" : C.textMuted,
              }}
            >
              {f === "all" ? "전체" : f === "active" ? "기도중" : "응답완료"}
            </button>
          ))}
        </div>

        {/* List — scroll */}
        <div ref={listRef} style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: 20 }}>
          {filteredList.length === 0 ? (
            <div style={{ textAlign: "center", padding: 40, color: "#9CA3AF", fontSize: 15 }}>
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
                      background: answered ? "#F0FDF4" : "#fff",
                      borderRadius: 16,
                      border: "1px solid #e5e7eb",
                      padding: 16,
                      transition: "background 0.2s",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                      <span style={{ fontSize: 14, color: "#9CA3AF" }}>{fmtPrayerDate(n.date)}</span>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <button
                          type="button"
                          onClick={e => { e.stopPropagation(); toggleAnswered(key); }}
                          style={{ padding: "4px 10px", fontSize: 12, border: "none", borderRadius: 9999, cursor: "pointer", fontWeight: 500, background: answered ? "#10B981" : "transparent", color: answered ? "#fff" : "#6B7280" }}
                        >
                          {answered ? "✓ 응답완료" : "기도중"}
                        </button>
                        {(isHover || isEditing) && (
                          <>
                            <button type="button" onClick={() => { setEditingKey(cardKey); setEditContent(n.content); }} style={{ padding: 4, border: "none", background: "none", cursor: "pointer", color: C.textMuted, fontSize: 12 }}>편집</button>
                            <button type="button" onClick={() => deletePrayer(n)} style={{ padding: 4, border: "none", background: "none", cursor: "pointer", color: "#EF4444", fontSize: 12 }}>삭제</button>
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
                        <div style={{ fontSize: 15, color: "#374151", lineHeight: 1.6 }}>{n.content}</div>
                        {answered && answeredDates[key] && (
                          <div style={{ fontSize: 12, color: "#059669", marginTop: 6 }}>응답일 {fmtPrayerDate(answeredDates[key])}</div>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Bottom form — 고정 */}
        <div style={{ padding: 16, borderTop: `1px solid ${C.border}`, background: "#fff", flexShrink: 0 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
              <div style={{ flex: "0 0 auto", minWidth: 140 }}>
                <CalendarDropdown label="날짜" value={addDate} onChange={setAddDate} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: C.navy, marginBottom: 6 }}>기도제목</label>
                <textarea value={addContent} onChange={e => setAddContent(e.target.value)} placeholder="기도제목을 입력하세요..." style={{ width: "100%", padding: "12px 14px", border: `1px solid ${C.border}`, borderRadius: 12, fontSize: 15, minHeight: 48, resize: "vertical", fontFamily: "inherit" }} />
              </div>
              <div style={{ flex: "0 0 auto", alignSelf: "flex-end" }}>
                <Btn variant="accent" size="sm" onClick={addPrayer} style={{ borderRadius: 10, padding: "12px 20px" }}>등록</Btn>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
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

  const programs = db.newFamilyPrograms || [];
  const nfMembers = db.members.filter(m => m.is_new_family === true);
  const memberById = (id: string) => db.members.find(x => x.id === id)!;
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

  const paginated = useMemo(() => filteredList.slice((currentPage - 1) * 10, currentPage * 10), [filteredList, currentPage]);

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
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 4 }}>
        {([{ id: "list" as const, label: "새가족 정착" }, { id: "servant" as const, label: "섬김이 학교" }]).map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setNfSubTab(tab.id)}
            style={{
              padding: "8px 16px", borderRadius: 10, border: "1px solid", fontSize: 13, fontWeight: 600, cursor: "pointer",
              background: nfSubTab === tab.id ? C.navy : "transparent",
              color: nfSubTab === tab.id ? "#fff" : C.text,
              borderColor: nfSubTab === tab.id ? C.navy : C.border,
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {nfSubTab === "servant" && <ServantSchoolManager members={db.members.map(m => ({ id: m.id, name: m.name || "", dept: m.dept, role: m.role }))} toast={toast} />}

      {nfSubTab === "list" && <>
      <div style={{ display: "grid", gridTemplateColumns: mob ? "repeat(2, 1fr)" : "repeat(4, 1fr)", gap: 12 }}>
        <Card style={{ padding: 16 }}>
          <div style={{ marginBottom: 4, color: C.navy, display: "flex" }}><Icons.New /></div>
          <div style={{ fontSize: 22, fontWeight: 800, color: C.navy }}>{thisMonthCount}명</div>
          <div style={{ fontSize: 12, color: C.textMuted }}>이번 달 새가족</div>
        </Card>
        <Card style={{ padding: 16 }}>
          <div style={{ marginBottom: 4, color: C.accent, display: "flex" }}><Icons.Clipboard /></div>
          <div style={{ fontSize: 22, fontWeight: 800, color: C.accent }}>{inProgressCount}명</div>
          <div style={{ fontSize: 12, color: C.textMuted }}>정착 진행중</div>
        </Card>
        <Card style={{ padding: 16 }}>
          <div style={{ marginBottom: 4, color: C.success, display: "flex" }}><Icons.Graduation /></div>
          <div style={{ fontSize: 22, fontWeight: 800, color: C.success }}>{completedCount}명</div>
          <div style={{ fontSize: 12, color: C.textMuted }}>수료 완료</div>
        </Card>
        <Card style={{ padding: 16 }}>
          <div style={{ marginBottom: 4, color: C.orange, display: "flex" }}><Icons.Alert /></div>
          <div style={{ fontSize: 22, fontWeight: 800, color: C.orange }}>{needAttentionCount}명</div>
          <div style={{ fontSize: 12, color: C.textMuted }}>관리 필요</div>
        </Card>
      </div>

      <div ref={listRef}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
          {(["all", "진행중", "수료", "중단", "no_mentor"] as const).map(f => (
            <button key={f} type="button" onClick={() => { setFilter(f); setCurrentPage(1); }} style={{
              padding: "8px 14px", borderRadius: 20, border: `1px solid ${filter === f ? C.accent : C.border}`,
              background: filter === f ? C.accentLight : "#fff", color: filter === f ? C.accent : C.text,
              fontSize: 13, fontWeight: 600, cursor: "pointer",
            }}>{f === "all" ? "전체" : f === "no_mentor" ? "섬김이 미배정" : f}</button>
          ))}
        </div>

        {filteredList.length === 0 ? (
          <Card style={{ padding: 48, textAlign: "center", color: C.textMuted }}>새가족이 없습니다. 상단 "+ 새가족 등록"으로 등록하세요.</Card>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {paginated.map(({ member, program }) => {
              const mentor = program.mentor_id ? memberById(program.mentor_id) : null;
              const done = [program.week1_completed, program.week2_completed, program.week3_completed, program.week4_completed].filter(Boolean).length;
              const needAttention = isProgramNeedAttention(program);
              return (
                <Card key={member.id} onClick={() => openProgramDetail(member.id)} style={{ cursor: "pointer", padding: 16 }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                      <div style={{ width: 44, height: 44, borderRadius: "50%", background: `linear-gradient(135deg,${C.accentBg},${C.tealBg})`, color: C.accent, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 16, overflow: "hidden", flexShrink: 0 }}>
                        {member.photo ? <img src={member.photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : (member.name || "?")[0]}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 16, color: C.navy, display: "flex", alignItems: "center", gap: 6 }}>
                          {member.name}
                          {needAttention && <span style={{ color: C.orange }} title="2주 이상 미완료">⚠️</span>}
                        </div>
                        <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>
                          첫 방문일 {member.firstVisitDate || member.createdAt || "-"} · {VISIT_PATH_LABEL[member.visitPath || ""] || member.visitPath || "-"}
                        </div>
                      </div>
                    </div>
                    <SBadge variant={program.status === "수료" ? "success" : program.status === "중단" ? "gray" : "accent"}>{program.status}</SBadge>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                    {mentor ? <span style={{ fontSize: 13, color: C.text }}>섬김이: {mentor.name}</span> : <span style={{ fontSize: 13, fontWeight: 600, color: C.danger }}>섬김이 미배정</span>}
                  </div>
                  <div style={{ height: 6, background: C.borderLight, borderRadius: 3, overflow: "hidden", display: "flex" }}>
                    {[1, 2, 3, 4].map(i => (
                      <div key={i} style={{ flex: 1, height: "100%", background: [program.week1_completed, program.week2_completed, program.week3_completed, program.week4_completed][i - 1] ? C.success : C.borderLight, marginRight: i < 4 ? 2 : 0 }} />
                    ))}
                  </div>
                  <div style={{ display: "flex", marginTop: 6, gap: 2 }}>
                    {[1, 2, 3, 4].map(i => (
                      <div key={i} style={{ flex: 1, fontSize: 10, fontWeight: 600, color: C.textMuted, textAlign: "center" }}>{i}주차</div>
                    ))}
                  </div>
                  <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>{done}/4주 완료</div>
                </Card>
              );
            })}
          </div>
        )}
        {filteredList.length > 10 && (
          <Pagination totalItems={filteredList.length} itemsPerPage={10} currentPage={currentPage} onPageChange={(p) => { setCurrentPage(p); listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }} />
        )}
      </div>
      </>}
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
          <div style={{ width: 56, height: 56, borderRadius: "50%", background: `linear-gradient(135deg,${C.accentBg},${C.tealBg})`, color: C.accent, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 20, overflow: "hidden", flexShrink: 0 }}>
            {member.photo ? <img src={member.photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : (member.name || "?")[0]}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 18, color: C.navy }}>{member.name}</div>
            <div style={{ fontSize: 13, color: C.textMuted }}>첫 방문일 {member.firstVisitDate || program.program_start_date}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
              {mentor ? <span style={{ fontSize: 13 }}>섬김이: {mentor.name}</span> : <span style={{ fontSize: 13, color: C.danger, fontWeight: 600 }}>섬김이 미배정</span>}
              <Btn size="sm" variant="secondary" onClick={() => { setPendingMentorId(program?.mentor_id ?? null); setShowMentorSelect(true); }}>섬김이 배정</Btn>
            </div>
          </div>
        </div>
      </div>

      <div style={{ position: "relative", paddingLeft: 24 }}>
        <div style={{ position: "absolute", left: 11, top: 12, bottom: 12, width: 2, background: "#e5e7eb", borderRadius: 1 }} />
        {WEEK_CONFIG.map((week, wi) => {
          const completed = [program.week1_completed, program.week2_completed, program.week3_completed, program.week4_completed][wi];
          const isCurrent = currentWeekNum === wi + 1 && program.status === "진행중";
          const dateKey = [`week1_date`, `week2_date`, `week3_date`, `week4_date`][wi] as keyof NewFamilyProgram;
          const noteKey = [`week1_note`, `week2_note`, `week3_note`, `week4_note`][wi] as keyof NewFamilyProgram;
          const dateVal = program[dateKey] as string | null;
          const noteVal = program[noteKey] as string | null;
          return (
            <div key={wi} style={{ position: "relative", marginBottom: 20 }}>
              <div style={{ position: "absolute", left: -24, top: 4, width: 24, height: 24, borderRadius: "50%", background: completed ? "#22c55e" : isCurrent ? "#3b82f6" : "#d1d5db", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 12, fontWeight: 700, boxShadow: isCurrent ? "0 0 0 3px rgba(59,130,246,0.3)" : undefined, animation: isCurrent ? "pulse 1.5s ease-in-out infinite" : undefined }}>{completed ? "✓" : wi + 1}</div>
              <Card style={{ padding: 16, background: "#fff", borderRadius: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: C.navy, marginBottom: 6 }}>{week.title}</div>
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
                  background: (pendingMentorId ?? program?.mentor_id) === m.id ? C.accentLight : "#fff",
                  color: C.navy, fontSize: 14, cursor: "pointer", borderRadius: 0,
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
        <h2 style={{ fontSize: mob ? 18 : 20, fontWeight: 700, color: C.navy, margin: "0 0 4px" }}>보고서</h2>
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
              background: "#fff",
              border: "1px solid #e5e7eb",
              borderRadius: 12,
              cursor: "pointer",
              textAlign: "left",
              minHeight: mob ? 100 : 120,
              transition: "all 0.2s",
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "#9ca3af"; e.currentTarget.style.boxShadow = "0 2px 12px rgba(0,0,0,0.08)"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "#e5e7eb"; e.currentTarget.style.boxShadow = "none"; }}
          >
            <report.Icon size={22} strokeWidth={1.5} color="#9ca3af" style={{ marginBottom: 12 }} />
            <span style={{ fontSize: 14, fontWeight: 600, color: "#111827", marginBottom: 4 }}>{report.title}</span>
            <span style={{ fontSize: 12, color: "#6b7280" }}>{report.description}</span>
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
  const fileRef = useRef<HTMLInputElement>(null);
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

  const exportBackup = () => {
    const blob = new Blob([JSON.stringify(db, null, 2)], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = `슈퍼플래너_백업_${todayStr()}.json`; a.click();
    toast("백업 완료", "ok");
  };

  const importBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const parsed = JSON.parse(ev.target?.result as string);
        const merged = { ...DEFAULT_DB, ...parsed };
        setDb(() => merged);
        saveDb(merged).then(() => toast("복원 완료", "ok")).catch(() => toast("Supabase 저장 실패", "err"));
      } catch { toast("파일 오류", "err"); }
    };
    reader.readAsText(file);
  };

  const clearAll = () => {
    if (typeof window !== "undefined" && !window.confirm("모든 데이터를 삭제하시겠습니까?")) return;
    if (typeof window !== "undefined") location.reload();
  };

  const handleSaveSettings = () => {
    persist();
    saveDb(db).then(() => toast("저장되었습니다", "ok")).catch(() => toast("저장 실패", "err"));
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: mob ? "100%" : 960 }}>
      {!mokjangOnly && (
        <Card>
          <h4 style={{ fontSize: mob ? 15 : 17, fontWeight: 700, color: C.navy, marginBottom: mob ? 14 : 20 }}>⚙️ 교회 설정</h4>
          <FormInput label="교회 이름" value={db.settings.churchName || ""} placeholder="○○교회"
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setDb(prev => ({ ...prev, settings: { ...prev.settings, churchName: e.target.value } })); persist(); }} />
          <FormInput label="교단" value={db.settings.denomination || ""} placeholder="예: 침례교, 장로교, 감리교 (침례교면 증서에 침례 표기)"
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setDb(prev => ({ ...prev, settings: { ...prev.settings, denomination: e.target.value } })); persist(); }} />
          <FormInput label="부서 목록 (쉼표 구분)" value={db.settings.depts || ""} placeholder="유아부,유치부,유년부,초등부,중등부,고등부,청년부,장년부"
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setDb(prev => ({ ...prev, settings: { ...prev.settings, depts: e.target.value } })); persist(); }} />
          <div style={{ marginTop: 12 }}>
            <Btn onClick={handleSaveSettings}>저장</Btn>
          </div>
        </Card>
      )}
      <Card>
        <h4 style={{ fontSize: mob ? 15 : 17, fontWeight: 700, color: C.navy, marginBottom: mob ? 12 : 16, display: "flex", alignItems: "center", gap: 8 }}>
          <Home size={20} strokeWidth={2} style={{ flexShrink: 0, color: C.navy }} />
          목장 관리
        </h4>
        <p style={{ fontSize: 13, color: C.textMuted, marginBottom: 12 }}>목장을 생성·이름 변경·삭제하고, 그룹원을 추가·제거할 수 있습니다.</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 12 }}>
          {mokjangList.map(g => {
            const count = db.members.filter(m => ((m.mokjang ?? m.group) || "") === g).length;
            return (
              <div key={g} style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8, background: C.bg, borderRadius: 10, padding: "12px 14px", border: `1px solid ${C.border}` }}>
                <span style={{ fontWeight: 700, fontSize: 14, color: C.navy, display: "flex", alignItems: "center", gap: 6 }}>
                  <Home size={18} strokeWidth={2} style={{ flexShrink: 0, color: C.navy }} />
                  {g}
                </span>
                <span style={{ fontSize: 12, color: C.textMuted }}>{count}명</span>
                <button type="button" onClick={() => { setMokjangManage(g); setAddMemberSelect(""); }} style={{ padding: "4px 10px", fontSize: 12, border: "none", background: C.navy, color: "#fff", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}>그룹원 관리</button>
                <button type="button" onClick={() => renameMokjang(g)} style={{ padding: "4px 10px", fontSize: 12, border: "none", background: C.accentBg, color: C.accent, borderRadius: 6, cursor: "pointer", fontWeight: 600 }}>이름 변경</button>
                <button type="button" onClick={() => deleteMokjang(g)} style={{ padding: "4px 10px", fontSize: 12, border: "none", background: C.dangerBg || "#fee", color: C.danger, borderRadius: 6, cursor: "pointer", fontWeight: 600 }}>삭제</button>
              </div>
            );
          })}
        </div>
        <Btn variant="accent" size="sm" onClick={addMokjang}>+ 목장 추가</Btn>
      </Card>

      {mokjangManage && (
        <Modal open={true} onClose={() => { setMokjangManage(null); setAddMemberSelect(""); }} title={`${mokjangManage} 그룹원 관리`} width={480}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: C.navy, marginBottom: 6 }}>현재 그룹원</label>
            {db.members.filter(m => ((m.mokjang ?? m.group) || "") === mokjangManage).length === 0 ? (
              <div style={{ padding: 12, background: C.bg, borderRadius: 8, fontSize: 13, color: C.textMuted }}>아직 배정된 성도가 없습니다. 아래에서 추가하세요.</div>
            ) : (
              <ul style={{ margin: 0, padding: 0, listStyle: "none", maxHeight: 200, overflowY: "auto" }}>
                {db.members.filter(m => ((m.mokjang ?? m.group) || "") === mokjangManage).map(m => (
                  <li key={m.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 10px", borderBottom: `1px solid ${C.borderLight}`, fontSize: 14, minWidth: 0 }}>
                    <span style={{ fontWeight: 600, color: C.navy, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}>{m.name}</span>
                    <span style={{ fontSize: 12, color: C.textMuted }}>{m.dept || ""} {m.role || ""}</span>
                    <button type="button" onClick={() => removeMemberFromMokjang(m.id)} style={{ padding: "4px 10px", fontSize: 12, border: "none", background: C.dangerBg || "#fee", color: C.danger, borderRadius: 6, cursor: "pointer" }}>목장에서 제거</button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: C.navy, marginBottom: 6 }}>성도 추가</label>
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
      <Card>
        <h4 style={{ fontSize: mob ? 15 : 17, fontWeight: 700, color: C.navy, marginBottom: mob ? 12 : 16 }}>💾 데이터</h4>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Btn variant="ghost" onClick={exportBackup}>{mob ? "📤 백업" : "📤 전체 백업 (JSON)"}</Btn>
          <Btn variant="ghost" onClick={() => fileRef.current?.click()}>{mob ? "📥 복원" : "📥 백업 복원"}</Btn>
          <input ref={fileRef} type="file" accept=".json" style={{ display: "none" }} onChange={importBackup} />
          <Btn variant="danger" size="sm" onClick={clearAll}>🗑 전체 초기화</Btn>
        </div>
      </Card>
    </div>
  );
}

/* ============================================================
   MAIN COMPONENT
   ============================================================ */
type SubPage = "dashboard" | "members" | "attendance" | "notes" | "newfamily" | "settings";

const NAV_ITEMS: { id: SubPage; Icon: React.ComponentType<any>; label: string }[] = [
  { id: "dashboard", Icon: LayoutDashboard, label: "대시보드" },
  { id: "members", Icon: Users, label: "성도 관리" },
  { id: "attendance", Icon: CalendarCheck, label: "출석부" },
  { id: "notes", Icon: StickyNote, label: "기도/메모" },
  { id: "newfamily", Icon: Sprout, label: "새가족 관리" },
  { id: "settings", Icon: Settings, label: "목장그룹관리" },
];

const PAGE_INFO: Record<SubPage, { title: string; desc: string; addLabel?: string }> = {
  dashboard: { title: "대시보드", desc: "목양 현황을 한눈에 파악합니다" },
  members: { title: "성도 관리", desc: "성도의 삶을 기억하고 돌봅니다" },
  attendance: { title: "출석부", desc: "52주 출석 기록을 관리합니다" },
  notes: { title: "기도/메모", desc: "기도제목과 특이사항을 공유합니다", addLabel: "+ 기도" },
  newfamily: { title: "새가족 관리", desc: "새가족 4주 정착 트래킹", addLabel: "+ 새가족 등록" },
  settings: { title: "목장그룹관리", desc: "목장·소그룹 생성 및 그룹원 관리" },
};

const SUB_PAGE_IDS: SubPage[] = ["dashboard", "members", "attendance", "notes", "newfamily", "settings"];

export function PastoralPage({ db, setDb, saveDb }: { db: DB; setDb: (fn: (prev: DB) => DB) => void; saveDb?: (d: DB) => Promise<void> }) {
  const { churchId } = useAuth();
  const { refreshMembers, refreshNotes, refreshAttendance, refreshVisits, refreshNewFamilyPrograms, schoolDepartments, schoolEnrollments } = useAppData();
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
  type AttendanceSubTab = "dashboard" | "check" | "absentee" | "statistics" | "weekly";
  const ATTENDANCE_SUB_IDS: AttendanceSubTab[] = ["dashboard", "check", "absentee", "statistics", "weekly"];
  const [attendanceSubTab, setAttendanceSubTabState] = useState<AttendanceSubTab>(() => {
    if (typeof window === "undefined") return "dashboard";
    const v = localStorage.getItem("pastoral_attendance_sub_tab");
    return (ATTENDANCE_SUB_IDS.includes(v as AttendanceSubTab) ? v : "dashboard") as AttendanceSubTab;
  });
  const setAttendanceSubTab = useCallback((id: AttendanceSubTab) => setAttendanceSubTabState(id), []);
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
          const reason = row.reason as string | undefined;
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
      setFName(m.name || ""); setFDept(m.dept || depts[0] || ""); setFRole(m.role || "");
      setFBirth(m.birth || ""); setFGender(m.gender || ""); setFPhone(m.phone || "");
      setFAddr(m.address || ""); setFFamily(m.family || ""); setFStatus(m.status || "새가족");
      setFSource(m.source || ""); setFPrayer(m.prayer || ""); setFMemo(m.memo || ""); setFPhoto(m.photo || "");
      setFPhotoServerUrl(m.photo || "");
      setFGroup((m.mokjang ?? m.group) && mokjangOptions.includes((m.mokjang ?? m.group) || "") ? ((m.mokjang ?? m.group) || "") : ((m.mokjang ?? m.group) || ""));
      setFVisitPath((m.visit_path ?? m.visitPath) || ""); setFReferrerId(m.referrer_id || ""); setFJob(m.job || ""); setFFirstVisitDate((m.first_visit_date ?? m.firstVisitDate) || todayStr());
    } else {
      setFName(""); setFDept(depts[0] || ""); setFRole(""); setFBirth(""); setFGender("");
      setFPhone(""); setFAddr(""); setFFamily(""); setFStatus("새가족"); setFSource("");
      setFPrayer(""); setFMemo(""); setFPhoto(""); setFPhotoServerUrl("");
      setFGroup("");
      setFVisitPath(""); setFReferrerId(""); setFJob(""); setFFirstVisitDate(todayStr());
    }
    setShowMemberModal(true);
  }, [db.members, db.settings.mokjangList, depts]);

  const saveMember = async () => {
    if (!fName.trim()) { toast("이름을 입력하세요", "err"); return; }
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
      photo: (fPhotoServerUrl || fPhoto) || null,
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
    setDb(prev => {
      const { [id]: _a, ...att } = prev.attendance;
      const { [id]: _ar, ...attReasons } = prev.attendanceReasons || {};
      const { [id]: _n, ...notes } = prev.notes;
      const newFamilyPrograms = (prev.newFamilyPrograms || []).filter(p => p.member_id !== id);
      const next = { ...prev, members: prev.members.filter(m => m.id !== id), attendance: att, attendanceReasons: attReasons, notes, newFamilyPrograms };
      saveDb?.(next).catch(() => toast("저장 실패", "err"));
      return next;
    });
    refreshMembers();
    setShowDetailModal(false);
    setProgramDetailMemberId(null);
    toast("삭제 완료", "warn");
  };

  const deleteMembers = async (ids: string[]) => {
    if (ids.length === 0) return;
    if (typeof window !== "undefined" && !window.confirm(`선택한 ${ids.length}명을 삭제하시겠습니까?`)) return;
    for (const id of ids) {
      const member = db.members.find(m => m.id === id);
      await deleteMemberPhotoFromStorage(member?.photo);
    }
    const idSet = new Set(ids);
    setDb(prev => {
      const attendance = { ...prev.attendance }; ids.forEach(id => delete attendance[id]);
      const attendanceReasons = { ...(prev.attendanceReasons || {}) }; ids.forEach(id => delete attendanceReasons[id]);
      const notes = { ...prev.notes }; ids.forEach(id => delete notes[id]);
      const newFamilyPrograms = (prev.newFamilyPrograms || []).filter(p => !idSet.has(p.member_id));
      const next = { ...prev, members: prev.members.filter(m => !idSet.has(m.id)), attendance, attendanceReasons, notes, newFamilyPrograms };
      saveDb?.(next).catch(() => toast("저장 실패", "err"));
      return next;
    });
    refreshMembers();
    setShowDetailModal(false);
    setDetailId(null);
    setProgramDetailMemberId(null);
    toast(`선택한 ${ids.length}명이 삭제되었습니다`, "warn");
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
    setDb(prev => {
      const notes = { ...prev.notes };
      if (!notes[mid]) notes[mid] = [];
      notes[mid] = [...notes[mid], { date: nDate, type: nType, content: nContent.trim(), createdAt: new Date().toISOString() }];
      let members = prev.members;
      if (nType === "prayer" && mid !== NOTE_TARGET_CHURCH) { members = members.map(m => m.id === mid ? { ...m, prayer: nContent.trim() } : m); }
      return { ...prev, notes, members };
    });
    setShowNoteModal(false); toast("기록 저장 완료", "ok");
  };

  const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const localPreview = URL.createObjectURL(file);
    setFPhoto(localPreview);
    try {
      const compressed = await compressImage(file, 400, 0.7);
      const fd = new FormData();
      fd.append("file", compressed);
      const r = await fetch("/api/upload-photo", { method: "POST", body: fd });
      const data = await r.json();
      if (data.url) {
        const serverUrl = data.url;
        const testImg = new Image();
        testImg.onload = () => {
          URL.revokeObjectURL(localPreview);
          setFPhoto(serverUrl);
          setFPhotoServerUrl(serverUrl);
        };
        testImg.onerror = () => {
          setFPhotoServerUrl(serverUrl);
        };
        testImg.src = serverUrl;
      } else toast("업로드 실패", "err");
    } catch {
      toast("사진 압축 또는 업로드 실패", "err");
    }
    e.target.value = "";
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
      pageTitle={((db.settings.churchName || "").trim() || "목양")}
      pageSubtitle={new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" })}
      navSections={navSections}
      activeId={activeSub}
      onNav={(id) => handleNav(id as SubPage)}
      versionText="목양 v1.0"
      headerTitle={info.title}
      headerDesc={info.desc}
      headerActions={
        <>
          {!mob && <SBadge variant="success">● 정상 운영중</SBadge>}
          {info.addLabel && activeSub !== "notes" && <Btn variant="primary" size="sm" onClick={topAdd}>{mob ? "+" : info.addLabel}</Btn>}
        </>
      }
      SidebarIcon={Church}
    >
          {activeSub === "dashboard" && <DashboardSub db={db} currentWeek={currentWeek} />}
          {activeSub === "members" && <MembersSub db={db} setDb={fn => setDb(fn)} persist={persist} toast={toast} currentWeek={currentWeek} openMemberModal={openMemberModal} openDetail={openDetail} openNoteModal={openNoteModal} openQuickNote={openQuickNote} detailId={detailId} deleteMembers={deleteMembers} churchId={churchId} />}
          {activeSub === "attendance" && (
            <>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16, paddingBottom: 12, borderBottom: `1px solid ${C.border}` }}>
                {[
                  { id: "dashboard" as const, label: "대시보드", Icon: LayoutDashboard },
                  { id: "check" as const, label: "출석 체크", Icon: CalendarCheck },
                  { id: "absentee" as const, label: "결석자 관리", Icon: UserX },
                  { id: "statistics" as const, label: "출석 통계", Icon: BarChart3 },
                  { id: "weekly" as const, label: "52주 출석", Icon: ListOrdered },
                ].map(({ id, label, Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setAttendanceSubTab(id)}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 10,
                      fontSize: 13, fontWeight: 600, border: "none", cursor: "pointer",
                      background: attendanceSubTab === id ? C.navy : "transparent",
                      color: attendanceSubTab === id ? "#fff" : C.text,
                      borderWidth: 1, borderStyle: "solid", borderColor: attendanceSubTab === id ? C.navy : C.border,
                    }}
                  >
                    <Icon style={{ width: 18, height: 18 }} />
                    {label}
                  </button>
                ))}
              </div>
              {attendanceSubTab === "dashboard" && (
                <div style={{ width: "100%", minHeight: 520 }}>
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
                <div style={{ width: "100%", minHeight: 520 }}>
                  <AttendanceStatistics
                    members={db.members}
                    attendanceList={attendanceListForDashboard}
                    toast={toast}
                    onExportExcel={(csv, filename) => {
                      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
                      const a = document.createElement("a");
                      a.href = URL.createObjectURL(blob);
                      a.download = filename;
                      a.click();
                      URL.revokeObjectURL(a.href);
                      toast("다운로드되었습니다", "ok");
                    }}
                  />
                </div>
              )}
              {/* 예배 설정 탭 제거 - 주일예배 전용 */}
              {attendanceSubTab === "weekly" && <AttendanceSub db={db} setDb={fn => setDb(fn)} persist={persist} toast={toast} currentWeek={currentWeek} setCurrentWeek={setCurrentWeek} />}
            </>
          )}
          {activeSub === "notes" && <NotesSub db={db} setDb={fn => setDb(fn)} persist={persist} openPrayerModal={openPrayerModal} openNoteModal={openNoteModal} />}
          {activeSub === "newfamily" && <NewFamilySub db={db} setDb={fn => setDb(fn)} openProgramDetail={setProgramDetailMemberId} openMemberModal={openMemberModal} toast={toast} />}
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
              width: 100, height: 100, borderRadius: "50%", background: "#f3f4f6", cursor: "pointer",
              overflow: "hidden", flexShrink: 0, position: "relative",
              border: "2px solid #e5e7eb",
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
            {fPhoto ? (
              <img
                src={fPhoto}
                alt="프로필 미리보기"
                onError={() => {}}
                onLoad={() => {}}
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
          <Btn onClick={saveMember}>저장</Btn>
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
            mob={mob}
          />
        ) : null;
      })()}

      {/* Detail Modal — Member 360° 뷰 (성도 관리 등에서만 사용) */}
      <Modal open={showDetailModal} onClose={() => setShowDetailModal(false)} title="" width={mob ? undefined : 720}>
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
          <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: C.navy, marginBottom: 6 }}>대상</label>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <button type="button" onClick={() => setNoteTargetType("all")} style={{ padding: "8px 16px", borderRadius: 8, border: `1px solid ${noteTargetType === "all" ? C.navy : C.border}`, background: noteTargetType === "all" ? C.navy : "#fff", color: noteTargetType === "all" ? "#fff" : C.text, fontSize: 13, fontWeight: 500, cursor: "pointer" }}>전체</button>
            <button type="button" onClick={() => setNoteTargetType("individual")} style={{ padding: "8px 16px", borderRadius: 8, border: `1px solid ${noteTargetType === "individual" ? C.navy : C.border}`, background: noteTargetType === "individual" ? C.navy : "#fff", color: noteTargetType === "individual" ? "#fff" : C.text, fontSize: 13, fontWeight: 500, cursor: "pointer" }}>개인</button>
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
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: C.navy, marginBottom: 6 }}>성도 선택</label>
              <button type="button" onClick={() => setNoteMemberDropdownOpen(v => !v)} style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1px solid ${C.border}`, background: "#fff", fontSize: 14, textAlign: "left", cursor: "pointer", color: selected ? C.text : C.textFaint }}>{selected ? (selected.departmentName ? `${selected.name} (${selected.departmentName})` : selected.name) : "선택하세요"}</button>
              {noteMemberDropdownOpen && (
                <div style={{ position: "absolute", top: "100%", left: 0, right: 0, marginTop: 4, background: "#fff", border: `1px solid ${C.border}`, borderRadius: 8, boxShadow: "0 4px 12px rgba(0,0,0,0.1)", zIndex: 10 }}>
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
          <label style={{ fontSize: 13, fontWeight: 600, color: C.navy, display: "block", marginBottom: 8 }}>이전 기록</label>
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
          <div key={t.id} style={{ padding: "12px 20px", borderRadius: 10, fontSize: 14, fontWeight: 500, color: "#fff", boxShadow: "0 8px 24px rgba(27,42,74,0.1)", display: "flex", alignItems: "center", gap: 8, background: t.type === "ok" ? C.success : t.type === "err" ? C.danger : C.orange, animation: "toastIn 0.3s forwards" }}>
            <span>{t.type === "ok" ? "✓" : t.type === "err" ? "✕" : "⚠"}</span> {t.msg}
          </div>
        ))}
      </div>
    </>
  );
}
