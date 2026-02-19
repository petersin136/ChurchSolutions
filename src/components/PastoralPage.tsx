"use client";

import React, { useState, useMemo, useEffect, useCallback, useRef, type CSSProperties, type ReactNode } from "react";
import type { DB, Member, Note, AttStatus, NewFamilyProgram, Attendance, ServiceType } from "@/types/db";
import { DEFAULT_DB } from "@/types/db";
import { saveDBToSupabase, getWeekNum } from "@/lib/store";
import { supabase } from "@/lib/supabase";
import { toMember } from "@/lib/supabase-db";
import { compressImage } from "@/utils/imageCompressor";
import { LayoutDashboard, Users, CalendarCheck, StickyNote, Sprout, FileText, Settings, Church, BarChart3, UserX, ListOrdered, Sliders } from "lucide-react";
import { UnifiedPageLayout } from "@/components/layout/UnifiedPageLayout";
import { Pagination } from "@/components/common/Pagination";
import { CalendarDropdown } from "@/components/CalendarDropdown";
import { Member360View } from "@/components/members/Member360View";
import { AttendanceDashboard, AttendanceCheck, AbsenteeManagement, AttendanceStatistics, ServiceTypeSettings } from "@/components/attendance";

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
const NOTE_ICONS: Record<string, string> = { memo: "📝", prayer: "🙏", visit: "🏠", event: "🎉" };
const NOTE_LABELS: Record<string, string> = { memo: "메모", prayer: "기도제목", visit: "심방", event: "경조사" };

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
const Icons = {
  Search: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>,
  Plus: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>,
  X: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>,
  Export: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>,
  Church: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 2v4M10 6h4M8 6v4l-5 3v9h18v-9l-5-3V6"/><rect x="10" y="16" width="4" height="6"/></svg>,
  Camera: () => <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>,
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
  return (
    <div style={{ marginBottom: 16 }}>
      {label && <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: C.navy, marginBottom: 6 }}>{label}</label>}
      <select {...(props as React.SelectHTMLAttributes<HTMLSelectElement>)} style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 14, fontFamily: "inherit", color: C.text, background: "#fff", outline: "none", cursor: "pointer", ...(props.style as CSSProperties || {}) }}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
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

function Modal({ open, onClose, title, children, width = 540 }: { open: boolean; onClose: () => void; title: string; children: ReactNode; width?: number }) {
  const mob = useIsMobile();
  if (!open) return null;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: mob ? "flex-end" : "center", justifyContent: "center", background: "rgba(27,42,74,0.4)", backdropFilter: "blur(4px)", padding: mob ? 0 : 20 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: mob ? "20px 20px 0 0" : 20, padding: mob ? 20 : 32, width: mob ? "100%" : "90%", maxWidth: mob ? "100%" : width, maxHeight: mob ? "92vh" : "85vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(27,42,74,0.15)" }}>
        {mob && <div style={{ width: 36, height: 4, background: C.border, borderRadius: 4, margin: "0 auto 12px" }} />}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: mob ? 17 : 20, color: C.navy }}>{title}</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, borderRadius: 8, display: "flex" }}><Icons.X /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, color = C.accent }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <Card style={{ display: "flex", flexDirection: "column", gap: 4, position: "relative", overflow: "hidden", padding: "20px 24px" }}>
      <div style={{ position: "absolute", top: -10, right: -10, width: 60, height: 60, borderRadius: "50%", background: `${color}15` }} />
      <div style={{ fontSize: 13, color: C.textMuted, fontWeight: 500 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700, color: C.navy, letterSpacing: "-0.5px" }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: C.textMuted }}>{sub}</div>}
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

function NoteCard({ n, mbrName, mbrDept, onClick, answered, onToggleAnswered }: { n: Note; mbrName?: string; mbrDept?: string; onClick?: () => void; answered?: boolean; onToggleAnswered?: () => void }) {
  const borderColors: Record<string, string> = { memo: C.accent, prayer: C.purple, visit: C.teal, event: C.pink };
  const badgeV: Record<string, string> = { memo: "gray", prayer: "purple", visit: "teal", event: "pink" };
  const isPrayer = n.type === "prayer";
  return (
    <div onClick={onClick} style={{ background: answered ? `${C.bg}ee` : C.bg, borderRadius: 10, padding: "14px 16px", borderLeft: `3px solid ${borderColors[n.type] || C.accent}`, marginBottom: 10, cursor: onClick ? "pointer" : "default" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6, flexWrap: "wrap", gap: 8 }}>
        <span style={{ fontSize: 15, color: C.navy, fontWeight: 700 }}>{n.date}{mbrName ? ` · ${mbrName}` : ""}{mbrDept ? ` (${mbrDept})` : ""}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {isPrayer && onToggleAnswered && (
            <button type="button" onClick={e => { e.stopPropagation(); onToggleAnswered(); }} style={{ padding: "4px 10px", fontSize: 12, border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600, background: answered ? C.success : C.border, color: answered ? "#fff" : C.textMuted }}>
              {answered ? "✓ 응답됨" : "응답됨 표시"}
            </button>
          )}
          <SBadge variant={badgeV[n.type] || "gray"}>{NOTE_ICONS[n.type] || "📝"} {NOTE_LABELS[n.type] || "메모"}</SBadge>
        </div>
      </div>
      <div style={{ fontSize: 14, lineHeight: 1.6, color: C.text, textDecoration: answered ? "line-through" : undefined, opacity: answered ? 0.85 : 1 }}>{n.content}</div>
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

function DashboardSub({ db, currentWeek }: { db: DB; currentWeek: number }) {
  const mob = useIsMobile();
  const currentYear = new Date().getFullYear();
  const [attChartView, setAttChartView] = useState<AttChartView>("month");
  const [attChartYear, setAttChartYear] = useState(currentYear);

  const m = db.members.filter(x => x.status !== "졸업/전출");
  const total = m.length;
  const att = m.filter(s => (db.attendance[s.id] || {})[currentWeek] === "p").length;
  const newF = m.filter(s => s.is_new_family === true).length;
  const risk = m.filter(s => s.status === "위험" || s.status === "휴면").length;
  const prayers = m.filter(s => s.prayer && s.prayer.trim()).length;
  const rate = total > 0 ? Math.round(att / total * 100) : 0;

  const weeklyAtt = useMemo(() => {
    return Array.from({ length: 52 }, (_, i) => {
      const w = i + 1;
      return m.filter(s => (db.attendance[s.id] || {})[w] === "p").length;
    });
  }, [db, m]);

  const monthlyAtt = useMemo(() => {
    const data = new Array(12).fill(0);
    m.forEach(s => {
      const a = db.attendance[s.id] || {};
      Object.keys(a).forEach(w => {
        const wn = parseInt(w);
        const mn = Math.min(11, Math.floor((wn - 1) / 4.33));
        if (a[parseInt(w)] === "p") data[mn]++;
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
      (db.notes[mid] || []).forEach(n => all.push({ ...n, mbrName: mbr?.name || "?", mbrId: mid, mbrDept: mbr?.dept || "" }));
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
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
        <StatCard label="전체 성도" value={`${total}명`} sub="활성 등록" color={C.accent} />
        <StatCard label="금주 출석률" value={`${rate}%`} sub={`${att}/${total}명 출석`} color={C.success} />
        <StatCard label="새가족" value={`${newF}명`} sub="정착 진행중" color={C.teal} />
        <StatCard label="위험/휴면" value={`${risk}명`} sub="관심 필요" color={C.danger} />
        <StatCard label="기도제목" value={`${prayers}건`} sub="함께 기도합니다" color={C.purple} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: mob ? "1fr" : "1fr 1fr", gap: 16 }}>
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, padding: mob ? "12px 16px" : "16px 24px", borderBottom: `1px solid ${C.border}` }}>
            <h4 style={{ margin: 0, fontSize: mob ? 14 : 16, fontWeight: 700, color: C.navy }}>출석 추이</h4>
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <select value={attChartYear} onChange={e => setAttChartYear(Number(e.target.value))} style={{ height: 32, padding: "0 8px", fontSize: 12, border: `1px solid ${C.border}`, borderRadius: 8, background: "#fff", color: C.navy, cursor: "pointer" }}>
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
          <div style={{ padding: "20px 24px 16px", minHeight: 180 }}>
            {attChartView === "year" && (
              <div style={{ display: "grid", gridTemplateColumns: mob ? "1fr" : "1fr 1fr", gap: 16 }}>
                <div style={{ background: C.accentBg, borderRadius: 12, padding: 20, textAlign: "center" }}>
                  <div style={{ fontSize: 28, fontWeight: 800, color: C.accent }}>{annualSummary.totalPresent}</div>
                  <div style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>총 출석 인원·주</div>
                </div>
                <div style={{ background: C.successBg, borderRadius: 12, padding: 20, textAlign: "center" }}>
                  <div style={{ fontSize: 28, fontWeight: 800, color: C.success }}>{annualSummary.avgRate}%</div>
                  <div style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>평균 출석률 (기록된 주)</div>
                </div>
                <div style={{ gridColumn: mob ? "1" : "1 / -1", fontSize: 13, color: C.textMuted }}>
                  기록된 주: {annualSummary.weeksWithData}주 · 주당 평균 출석 {annualSummary.avgPerWeek}명
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
              <div style={{ overflowX: "auto", paddingBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "end", gap: 2, minWidth: mob ? 520 : 1040, height: 160 }}>
                  {weeklyAtt.map((v, i) => {
                    const maxW = Math.max(...weeklyAtt, 1);
                    const h = Math.max(4, (v / maxW) * 140);
                    return (
                      <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                        <span style={{ fontSize: 9, color: C.textMuted }}>{v || ""}</span>
                        <div style={{ width: "100%", height: h, minHeight: 4, background: `linear-gradient(to top, ${C.teal}, ${C.teal}aa)`, borderRadius: "4px 4px 0 0", transition: "height 0.3s" }} />
                        <span style={{ fontSize: 9, color: C.textMuted }}>{i + 1}</span>
                      </div>
                    );
                  })}
                </div>
                <div style={{ fontSize: 11, color: C.textMuted, marginTop: 8 }}>1~52주 (가로 스크롤 가능)</div>
              </div>
            )}
          </div>
        </Card>

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
    </div>
  );
}

/* ====== Members ====== */
const ROLE_PRIORITY: Record<string, number> = { "장로": 0, "안수집사": 1, "권사": 2, "집사": 3, "청년": 4, "성도": 5, "학생": 6, "새가족": 7, "영아": 8 };

function MembersSub({ db, setDb, persist, toast, currentWeek, openMemberModal, openDetail, openNoteModal, detailId }: {
  db: DB; setDb: (fn: (prev: DB) => DB) => void; persist: () => void;
  toast: (m: string, t?: string) => void; currentWeek: number;
  openMemberModal: (id?: string) => void; openDetail: (id: string) => void; openNoteModal: (id: string) => void;
  detailId: string | null;
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

  /* 성도 목록: 대시보드와 동일하게 Supabase에서 직접 로드 */
  useEffect(() => {
    if (!supabase) return;
    supabase.from("members").select("*").order("created_at", { ascending: true }).then(({ data, error }) => {
      console.log("[MembersSub] members load:", { count: data?.length ?? 0, data: data ?? null, error: error ?? null });
      if (error) {
        console.error("[MembersSub] members load error:", error.message, error.details);
        return;
      }
      const members = (data ?? []).map((r: Record<string, unknown>) => toMember(r));
      setDb(prev => ({ ...prev, members }));
    });
  }, [setDb]);

  useEffect(() => {
    if (!printOpen) return;
    const close = (e: MouseEvent) => { if (printDropdownRef.current && !printDropdownRef.current.contains(e.target as Node)) setPrintOpen(false); };
    document.addEventListener("mousedown", close); return () => document.removeEventListener("mousedown", close);
  }, [printOpen]);
  const toggleSelect = (id: string) => { setSelectedMemberIds(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; }); };
  const selectAllFiltered = () => setSelectedMemberIds(new Set(filtered.map(m => m.id)));
  const clearSelection = () => setSelectedMemberIds(new Set());
  const mokjangList = getMokjangList(db);

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
            <select value={deptF} onChange={e => { setDeptF(e.target.value); setPageList(1); setPageGroup(1); }} style={{ flex: "1 1 80px", height: 36, padding: "0 8px", fontFamily: "inherit", fontSize: 12, background: "#fff", border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, outline: "none", cursor: "pointer" }}>
              <option value="all">부서</option>
              {depts.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <select value={statusF} onChange={e => { setStatusF(e.target.value); setPageList(1); setPageGroup(1); }} style={{ flex: "1 1 80px", height: 36, padding: "0 8px", fontFamily: "inherit", fontSize: 12, background: "#fff", border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, outline: "none", cursor: "pointer" }}>
              <option value="all">전체 상태</option>
              {MEMBER_STATUS_LIST.map(s => s && <option key={s} value={s}>{s}</option>)}
            </select>
            <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, cursor: "pointer" }}><input type="checkbox" checked={newFamilyOnly} onChange={e => { setNewFamilyOnly(e.target.checked); setPageList(1); }} /> 새가족</label>
            <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, cursor: "pointer" }}><input type="checkbox" checked={prospectOnly} onChange={e => { setProspectOnly(e.target.checked); setPageList(1); }} /> 관심성도</label>
            <SBadge variant="accent">{filtered.length}명</SBadge>
            <Btn onClick={() => openMemberModal()} icon={<Icons.Plus />}>등록</Btn>
          </div>
        ) : (
          <>
            <select value={deptF} onChange={e => { setDeptF(e.target.value); setPageList(1); setPageGroup(1); }} style={{ height: 40, padding: "0 32px 0 12px", fontFamily: "inherit", fontSize: 14, background: "#fff", border: `1px solid ${C.border}`, borderRadius: 10, color: C.text, outline: "none", cursor: "pointer" }}>
              <option value="all">부서</option>
              {depts.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <select value={roleF} onChange={e => { setRoleF(e.target.value); setPageList(1); setPageGroup(1); }} style={{ height: 40, padding: "0 32px 0 12px", fontFamily: "inherit", fontSize: 14, background: "#fff", border: `1px solid ${C.border}`, borderRadius: 10, color: C.text, outline: "none", cursor: "pointer" }}>
              <option value="all">직분</option>
              {ROLES_LIST.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <select value={mokjangF} onChange={e => { setMokjangF(e.target.value); setPageList(1); setPageGroup(1); }} style={{ height: 40, padding: "0 32px 0 12px", fontFamily: "inherit", fontSize: 14, background: "#fff", border: `1px solid ${C.border}`, borderRadius: 10, color: C.text, outline: "none", cursor: "pointer" }}>
              <option value="all">목장</option>
              {mokjangList.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <select value={statusF} onChange={e => { setStatusF(e.target.value); setPageList(1); setPageGroup(1); }} style={{ height: 40, padding: "0 32px 0 12px", fontFamily: "inherit", fontSize: 14, background: "#fff", border: `1px solid ${C.border}`, borderRadius: 10, color: C.text, outline: "none", cursor: "pointer" }}>
              <option value="all">전체 상태</option>
              {MEMBER_STATUS_LIST.map(s => s && <option key={s} value={s}>{s}</option>)}
            </select>
            <label style={{ display: "flex", alignItems: "center", gap: 6, height: 40, padding: "0 10px", fontSize: 13, cursor: "pointer", whiteSpace: "nowrap" }}><input type="checkbox" checked={newFamilyOnly} onChange={e => { setNewFamilyOnly(e.target.checked); setPageList(1); }} /> 새가족</label>
            <label style={{ display: "flex", alignItems: "center", gap: 6, height: 40, padding: "0 10px", fontSize: 13, cursor: "pointer", whiteSpace: "nowrap" }}><input type="checkbox" checked={prospectOnly} onChange={e => { setProspectOnly(e.target.checked); setPageList(1); }} /> 관심성도</label>
            <select value={baptismF} onChange={e => { setBaptismF(e.target.value); setPageList(1); setPageGroup(1); }} style={{ height: 40, padding: "0 32px 0 12px", fontFamily: "inherit", fontSize: 14, background: "#fff", border: `1px solid ${C.border}`, borderRadius: 10, color: C.text, outline: "none", cursor: "pointer" }}>
              <option value="all">세례</option>
              {BAPTISM_LIST.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
            <SBadge variant="accent">{filtered.length}명</SBadge>
            <Btn onClick={() => openMemberModal()} icon={<Icons.Plus />}>새 교인 등록</Btn>
          </>
        )}
      </div>

      {/* ─── 뷰 토글 ─── */}
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center" }}>
        <button type="button" onClick={() => { setViewMode("list"); setSelectedMokjang(null); setPageList(1); }} style={{ padding: "6px 14px", borderRadius: 8, border: "none", fontSize: 13, fontWeight: 600, fontFamily: "inherit", background: viewMode === "list" ? C.navy : C.bg, color: viewMode === "list" ? "#fff" : C.text, cursor: "pointer" }}>📋 테이블</button>
        {viewMode === "list" && (
          <>
            <button type="button" onClick={selectAllFiltered} style={{ padding: "6px 10px", borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 12, fontFamily: "inherit", background: C.card, color: C.text, cursor: "pointer" }}>선택 전체</button>
            <button type="button" onClick={clearSelection} style={{ padding: "6px 10px", borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 12, fontFamily: "inherit", background: C.card, color: C.text, cursor: "pointer" }}>선택 해제</button>
            {selectedMemberIds.size > 0 && <span style={{ fontSize: 12, color: C.textMuted }}>{selectedMemberIds.size}명 선택</span>}
          </>
        )}
        <button type="button" onClick={() => { setViewMode("card"); setSelectedMokjang(null); setPageList(1); }} style={{ padding: "6px 14px", borderRadius: 8, border: "none", fontSize: 13, fontWeight: 600, fontFamily: "inherit", background: viewMode === "card" ? C.navy : C.bg, color: viewMode === "card" ? "#fff" : C.text, cursor: "pointer" }}>🃏 카드</button>
        <button type="button" onClick={() => { setViewMode("group"); setSelectedMokjang(null); }} style={{ padding: "6px 14px", borderRadius: 8, border: "none", fontSize: 13, fontWeight: 600, fontFamily: "inherit", background: viewMode === "group" ? C.navy : C.bg, color: viewMode === "group" ? "#fff" : C.text, cursor: "pointer" }}>🏠 목장별</button>
        <button type="button" onClick={() => { const csv = ["이름,부서,직분,목장,연락처,상태"].concat(filtered.slice(0, 2000).map(m => `"${(m.name||"").replace(/"/g,'""')}","${(m.dept||"").replace(/"/g,'""')}","${(m.role||"").replace(/"/g,'""')}","${((m.mokjang ?? m.group) || "").replace(/"/g,'""')}","${(m.phone||"").replace(/"/g,'""')}","${(m.member_status||m.status||"").replace(/"/g,'""')}"`)).join("\n"); const blob = new Blob(["\uFEFF"+csv], { type: "text/csv;charset=utf-8" }); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `교인목록_${new Date().toISOString().slice(0,10)}.csv`; a.click(); URL.revokeObjectURL(a.href); toast("엑셀(CSV) 내보내기 완료", "ok"); }} style={{ padding: "6px 12px", borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 13, fontFamily: "inherit", background: C.card, color: C.text, cursor: "pointer" }}>📥 Excel 내보내기</button>
        <div ref={printDropdownRef} style={{ position: "relative" }}>
          <button type="button" onClick={() => setPrintOpen(p => !p)} style={{ padding: "6px 12px", borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 13, fontFamily: "inherit", background: C.card, color: C.text, cursor: "pointer" }}>🖨️ 인쇄</button>
          {printOpen && (
            <div style={{ position: "absolute", top: "100%", left: 0, marginTop: 4, background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, boxShadow: "0 4px 12px rgba(0,0,0,0.1)", zIndex: 50, minWidth: 160 }}>
              <button type="button" disabled={!detailId} onClick={async () => { setPrintOpen(false); const detailMember = db.members.find(m => m.id === detailId); if (!detailMember) return; try { const { generateChurchRegisterPdf } = await import("@/components/print/ChurchRegisterPrint"); await generateChurchRegisterPdf(detailMember, db.settings.churchName ?? ""); toast("교적부 PDF 다운로드됨", "ok"); } catch (e) { console.error(e); toast("PDF 생성 실패", "err"); } }} style={{ display: "block", width: "100%", padding: "8px 14px", textAlign: "left", border: "none", background: "none", fontSize: 13, fontFamily: "inherit", color: detailId ? C.text : C.textMuted, cursor: detailId ? "pointer" : "not-allowed" }}>교적부 양식</button>
              <button type="button" disabled={!detailId} onClick={async () => { setPrintOpen(false); const detailMember = db.members.find(m => m.id === detailId); if (!detailMember) return; try { const { generateBaptismCertificatePdf } = await import("@/components/print/BaptismCertificate"); await generateBaptismCertificatePdf(detailMember, db.settings.churchName ?? "", null); toast("세례증명서 PDF 다운로드됨", "ok"); } catch (e) { console.error(e); toast("PDF 생성 실패", "err"); } }} style={{ display: "block", width: "100%", padding: "8px 14px", textAlign: "left", border: "none", background: "none", fontSize: 13, fontFamily: "inherit", color: detailId ? C.text : C.textMuted, cursor: detailId ? "pointer" : "not-allowed" }}>세례증명서</button>
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
                      <div style={{ fontSize: 14 }}>&apos;+ 성도 등록&apos; 버튼으로 첫 성도를 등록해 주세요</div>
                    </td></tr>
                  ) : pageListMembers.map(m => {
                    const ws = (db.attendance[m.id] || {})[currentWeek] || "n";
                    const notes = (db.notes[m.id] || []).slice().reverse();
                    const lastNote = notes[0];
                    const lastVisit = notes.find(n => n.type === "visit");
                    const prayerSnip = m.prayer ? (m.prayer.length > 24 ? m.prayer.substring(0, 24) + "…" : m.prayer) : "-";
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
                        <td style={{ padding: "12px 16px", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 13, color: C.purple }}>{prayerSnip}</td>
                        <td style={{ padding: "12px 16px", maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 12 }}>{lastVisit ? `${lastVisit.date} ${lastVisit.content.substring(0, 12)}…` : "-"}</td>
                        <td style={{ padding: "12px 16px" }}>
                          {lastNote ? <SBadge variant={lastNote.type === "prayer" ? "purple" : "gray"}>{lastNote.type === "visit" ? "🏠" : (NOTE_ICONS[lastNote.type] || "📝")} {lastNote.content.substring(0, 12)}…</SBadge> : <span style={{ color: C.textFaint, fontSize: 12 }}>-</span>}
                        </td>
                        <td style={{ padding: "12px 16px" }}><Btn variant="soft" size="sm" onClick={(e) => { e?.stopPropagation(); openNoteModal(m.id); }}>📝</Btn></td>
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
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <select value={attYear} onChange={e => setAttYear(Number(e.target.value))} style={{ height: mob ? 34 : 38, padding: "0 10px", fontFamily: "inherit", fontSize: mob ? 12 : 14, background: "#fff", border: `1px solid ${C.border}`, borderRadius: 8, color: C.navy, fontWeight: 600, cursor: "pointer" }}>
              {[currentYear, currentYear - 1, currentYear - 2].map(y => <option key={y} value={y}>{y}년</option>)}
            </select>
            <select value={attMonth} onChange={e => { const v = Number(e.target.value); setAttMonth(v); setCurrentWeek(getWeeksInMonth(v)[0] ?? 1); }} style={{ height: mob ? 34 : 38, padding: "0 10px", fontFamily: "inherit", fontSize: mob ? 12 : 14, background: "#fff", border: `1px solid ${C.border}`, borderRadius: 8, color: C.navy, fontWeight: 600, cursor: "pointer" }}>
              {Array.from({ length: 12 }, (_, i) => i + 1).map(mo => <option key={mo} value={mo}>{mo}월</option>)}
            </select>
            <span style={{ color: C.textMuted, fontSize: 12 }}>·</span>
            <Btn variant="ghost" size="sm" onClick={goPrevWeek} style={{ width: 32, height: 32, padding: 0, justifyContent: "center" }}>◀</Btn>
            <span style={{ fontSize: mob ? 15 : 18, fontWeight: 700, minWidth: mob ? 56 : 72, textAlign: "center" }}>제{currentWeek}주</span>
            <Btn variant="ghost" size="sm" onClick={goNextWeek} style={{ width: 32, height: 32, padding: 0, justifyContent: "center" }}>▶</Btn>
          </div>
          <select value={deptF} onChange={e => setDeptF(e.target.value)} style={{ height: mob ? 36 : 40, padding: "0 12px", fontFamily: "inherit", fontSize: mob ? 12 : 14, background: "#fff", border: `1px solid ${C.border}`, borderRadius: 10, color: C.text, outline: "none", cursor: "pointer" }}>
            <option value="all">전체 부서</option>
            {depts.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        {!mob && <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
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
        </div>}
      </Card>

      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 8 }}>
        <button type="button" onClick={() => { setViewModeAtt("list"); setSelectedMokjangAtt(null); }} style={{ padding: "6px 14px", borderRadius: 8, border: "none", fontSize: 13, fontWeight: 600, fontFamily: "inherit", background: viewModeAtt === "list" ? C.navy : C.bg, color: viewModeAtt === "list" ? "#fff" : C.text, cursor: "pointer" }}>📋 전체 목록</button>
        <button type="button" onClick={() => { setViewModeAtt("group"); setSelectedMokjangAtt(null); }} style={{ padding: "6px 14px", borderRadius: 8, border: "none", fontSize: 13, fontWeight: 600, fontFamily: "inherit", background: viewModeAtt === "group" ? C.navy : C.bg, color: viewModeAtt === "group" ? "#fff" : C.text, cursor: "pointer" }}>🏠 목장별</button>
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
function NotesSub({ db, setDb, persist, openDetail, openNoteModal }: { db: DB; setDb: (fn: (prev: DB) => DB) => void; persist: () => void; openDetail: (id: string) => void; openNoteModal: (id?: string) => void }) {
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
      (db.notes[mid] || []).forEach(n => {
        const key = `${mid}|${n.date}|${n.type}|${n.content}`;
        if (seen.has(key)) return;
        seen.add(key);
        a.push({ ...n, mbrName: mbr?.name || "?", mbrId: mid, mbrDept: mbr?.dept || "" });
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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", gap: mob ? 8 : 12, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: 1, minWidth: mob ? 0 : 200, width: mob ? "100%" : undefined }}>
          <div style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: C.textMuted }}><Icons.Search /></div>
          <input value={search} onChange={e => { setSearch(e.target.value); setCurrentPage(1); }} placeholder="이름, 기도제목 검색..." style={{ width: "100%", height: mob ? 36 : 40, padding: "0 14px 0 38px", fontFamily: "inherit", fontSize: mob ? 13 : 14, background: "#fff", border: `1px solid ${C.border}`, borderRadius: 10, color: C.text, outline: "none" }} />
        </div>
        <select value={typeF} onChange={e => { setTypeF(e.target.value); setCurrentPage(1); }} style={{ height: mob ? 36 : 40, padding: "0 12px", fontFamily: "inherit", fontSize: mob ? 12 : 14, background: "#fff", border: `1px solid ${C.border}`, borderRadius: 10, color: C.text, outline: "none", cursor: "pointer" }}>
          <option value="all">전체 유형</option>
          <option value="memo">📝 메모</option><option value="prayer">🙏 기도</option>
          <option value="visit">🏠 심방</option><option value="event">🎉 경조</option>
        </select>
        <Btn variant="accent" size="sm" onClick={() => openNoteModal()}>+ 기록</Btn>
      </div>
      <div ref={listRefNotes}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: 48, color: C.textMuted }}><div style={{ fontSize: 48, opacity: 0.3, marginBottom: 12 }}>📝</div><div style={{ fontSize: 17, fontWeight: 600 }}>기록이 없습니다</div></div>
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
                  onClick={() => openDetail(n.mbrId)}
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
        id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : "nfp_" + uid(),
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
      <div style={{ display: "grid", gridTemplateColumns: mob ? "repeat(2, 1fr)" : "repeat(4, 1fr)", gap: 12 }}>
        <Card style={{ padding: 16 }}>
          <div style={{ fontSize: 24, marginBottom: 4 }}>🆕</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: C.navy }}>{thisMonthCount}명</div>
          <div style={{ fontSize: 12, color: C.textMuted }}>이번 달 새가족</div>
        </Card>
        <Card style={{ padding: 16 }}>
          <div style={{ fontSize: 24, marginBottom: 4 }}>📋</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: C.accent }}>{inProgressCount}명</div>
          <div style={{ fontSize: 12, color: C.textMuted }}>정착 진행중</div>
        </Card>
        <Card style={{ padding: 16 }}>
          <div style={{ fontSize: 24, marginBottom: 4 }}>🎓</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: C.success }}>{completedCount}명</div>
          <div style={{ fontSize: 12, color: C.textMuted }}>수료 완료</div>
        </Card>
        <Card style={{ padding: 16 }}>
          <div style={{ fontSize: 24, marginBottom: 4 }}>⚠️</div>
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
                  <div style={{ fontSize: 11, color: C.textMuted, marginTop: 6 }}>{done}/4주 완료</div>
                </Card>
              );
            })}
          </div>
        )}
        {filteredList.length > 10 && (
          <Pagination totalItems={filteredList.length} itemsPerPage={10} currentPage={currentPage} onPageChange={(p) => { setCurrentPage(p); listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }} />
        )}
      </div>
    </div>
  );
}

function NewFamilyProgramDetailModal({ db, setDb, memberId, onClose, toast, mob }: {
  db: DB; setDb: (fn: (prev: DB) => DB) => void; memberId: string; onClose: () => void; toast: (m: string, t?: string) => void; mob: boolean;
}) {
  const member = db.members.find(m => m.id === memberId);
  const program = (db.newFamilyPrograms || []).find(p => p.member_id === memberId);
  const [showMentorSelect, setShowMentorSelect] = useState(false);
  const [weekChecks, setWeekChecks] = useState<[boolean[], boolean[], boolean[], boolean[]]>(() =>
    program ? [
      [program.week1_completed, program.week1_completed, program.week1_completed, program.week1_completed],
      [program.week2_completed, program.week2_completed, program.week2_completed, program.week2_completed],
      [program.week3_completed, program.week3_completed, program.week3_completed, program.week3_completed],
      [program.week4_completed, program.week4_completed, program.week4_completed, program.week4_completed],
    ] : [[false, false, false, false], [false, false, false, false], [false, false, false, false], [false, false, false, false]]
  );

  const mentor = program?.mentor_id ? db.members.find(m => m.id === program.mentor_id) : null;
  const mentorCandidates = useMemo(() => db.members.filter(m => m.id !== memberId && MENTOR_ROLES.some(r => (m.role || "").includes(r)) && (m.dept === "장년부" || !m.dept)), [db.members, memberId]);
  const currentWeekNum = program ? getProgramWeekFromStart(program.program_start_date) : 1;
  const allFourDone = program?.week1_completed && program?.week2_completed && program?.week3_completed && program?.week4_completed;

  const updateProgram = useCallback((patch: Partial<NewFamilyProgram>) => {
    setDb(prev => ({
      ...prev,
      newFamilyPrograms: (prev.newFamilyPrograms || []).map(p => p.member_id === memberId ? { ...p, ...patch } : p),
    }));
  }, [memberId, setDb]);

  const setWeekCheck = useCallback((weekIndex: 0 | 1 | 2 | 3, checkIndex: number, value: boolean) => {
    setWeekChecks(prev => {
      const next = prev.map((arr, wi) => wi === weekIndex ? arr.map((c, i) => i === checkIndex ? value : c) : arr) as [boolean[], boolean[], boolean[], boolean[]];
      return next;
    });
  }, []);

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
              <Btn size="sm" variant="secondary" onClick={() => setShowMentorSelect(true)}>섬김이 배정</Btn>
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
      </div>

      {showMentorSelect && (
        <Modal open onClose={() => setShowMentorSelect(false)} title="섬김이 선택">
          <div style={{ maxHeight: 320, overflowY: "auto" }}>
            {mentorCandidates.length === 0 ? <div style={{ padding: 24, textAlign: "center", color: C.textMuted }}>장년부 집사/권사/장로가 없습니다</div> : mentorCandidates.map(m => (
              <button key={m.id} type="button" onClick={() => { updateProgram({ mentor_id: m.id }); setShowMentorSelect(false); toast("섬김이 배정되었습니다"); }} style={{ display: "block", width: "100%", padding: "12px 16px", textAlign: "left", border: "none", borderBottom: `1px solid ${C.borderLight}`, background: program.mentor_id === m.id ? C.accentLight : "#fff", color: C.navy, fontSize: 14, cursor: "pointer", borderRadius: 0 }}>
                {m.name} ({m.role || ""} {m.dept || ""})
              </button>
            ))}
          </div>
        </Modal>
      )}

      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.6}}`}</style>
    </Modal>
  );
}

/* ====== Reports ====== */
function ReportsSub({ db, currentWeek, toast }: { db: DB; currentWeek: number; toast: (m: string, t?: string) => void }) {
  const mob = useIsMobile();
  const listRefReport = useRef<HTMLDivElement>(null);
  const [viewer, setViewer] = useState<{ title: string; csv: string; filename: string } | null>(null);
  const [currentPageReport, setCurrentPageReport] = useState(1);

  const getMembers = () => {
    const h = ["이름","부서","직분","상태","성별","생년월일","연락처","주소","가족관계","등록경로","기도제목","메모"];
    const rows = db.members.map(m => csvRow([m.name, m.dept || "", m.role || "", m.status || "", m.gender || "", m.birth || "", m.phone || "", m.address || "", m.family || "", m.source || "", m.prayer || "", m.memo || ""]));
    return { csv: csvRow(h) + "\n" + rows.join("\n"), filename: `성도명단_${todayStr()}.csv` };
  };
  const getAttendance = () => {
    const h = ["이름","부서","상태", ...Array.from({ length: 52 }, (_, i) => `${i + 1}주`)];
    const rows = db.members.filter(m => m.status !== "졸업/전출").map(m => {
      const att = db.attendance[m.id] || {};
      const weeks = Array.from({ length: 52 }, (_, i) => ({ p: "O", a: "X" } as Record<string, string>)[att[i + 1] as string] || "");
      return csvRow([m.name, m.dept || "", m.status || "", ...weeks]);
    });
    return { csv: csvRow(h) + "\n" + rows.join("\n"), filename: `출석부_${todayStr()}.csv` };
  };
  const getPrayers = () => {
    const h = ["이름","부서","기도제목"];
    const rows = db.members.filter(m => m.prayer).map(m => csvRow([m.name, m.dept || "", m.prayer || ""]));
    return { csv: csvRow(h) + "\n" + rows.join("\n"), filename: `기도제목_${todayStr()}.csv` };
  };
  const getNotes = () => {
    const h = ["날짜","이름","부서","유형","내용"];
    const rows: string[] = [];
    Object.keys(db.notes).forEach(mid => {
      const mbr = db.members.find(x => x.id === mid);
      (db.notes[mid] || []).forEach(n => rows.push(csvRow([n.date, mbr?.name || "", mbr?.dept || "", NOTE_LABELS[n.type] || "메모", n.content])));
    });
    rows.sort().reverse();
    return { csv: csvRow(h) + "\n" + rows.join("\n"), filename: `기록전체_${todayStr()}.csv` };
  };
  const getNewFamily = () => {
    const nf = db.members.filter(m => m.is_new_family === true);
    const h = ["이름","등록일","경로","1주","2주","3주","4주","상태"];
    const rows = nf.map(m => {
      const att = db.attendance[m.id] || {};
      const rw = currentWeek;
      const weeks = [0, 1, 2, 3].map(i => ({ p: "O", a: "X" } as Record<string, string>)[att[rw + i] as string] || "-");
      return csvRow([m.name, m.createdAt || "", m.source || "", ...weeks, m.status || ""]);
    });
    return { csv: csvRow(h) + "\n" + rows.join("\n"), filename: `새가족현황_${todayStr()}.csv` };
  };
  const getFull = () => {
    const m = db.members.filter(x => x.status !== "졸업/전출");
    let csv = `"${db.settings.churchName || "교회"} 목양 종합 보고서 (${todayStr()})"\n\n`;
    csv += '"=== 현황 요약 ==="\n';
    csv += `"전체 성도","${m.length}명"\n`;
    const att = m.filter(s => (db.attendance[s.id] || {})[currentWeek] === "p").length;
    csv += `"금주 출석","${att}명 (${m.length > 0 ? Math.round(att / m.length * 100) : 0}%)"\n`;
    csv += `"새가족","${m.filter(s => s.is_new_family === true).length}명"\n`;
    csv += `"위험/휴면","${m.filter(s => s.status === "위험" || s.status === "휴면").length}명"\n\n`;
    csv += '"=== 부서별 인원 ==="\n"부서","인원"\n';
    const dc: Record<string, number> = {};
    m.forEach(s => { dc[s.dept || ""] = (dc[s.dept || ""] || 0) + 1; });
    Object.entries(dc).forEach(([d, c]) => { csv += `"${d}","${c}"\n`; });
    csv += "\n";
    csv += '"=== 기도제목 ==="\n"이름","부서","기도제목"\n';
    m.filter(s => s.prayer).forEach(s => { csv += csvRow([s.name, s.dept || "", s.prayer || ""]) + "\n"; });
    return { csv, filename: `목양종합보고서_${todayStr()}.csv` };
  };

  const reportDefs = [
    { icon: "👥", title: "성도 명단", desc: "전체 성도 정보", color: C.accent, getData: getMembers },
    { icon: "📅", title: "출석 현황", desc: "52주 출석 기록", color: C.success, getData: getAttendance },
    { icon: "🙏", title: "기도제목 목록", desc: "전 성도 기도제목", color: C.purple, getData: getPrayers },
    { icon: "📝", title: "메모/기록 전체", desc: "메모, 심방, 경조사 기록", color: C.teal, getData: getNotes },
    { icon: "🌱", title: "새가족 현황", desc: "새가족 4주 트래킹", color: C.pink, getData: getNewFamily },
    { icon: "📊", title: "목양 종합 보고서", desc: "당회 제출용 종합 보고서", color: C.navy, getData: getFull },
  ];

  const openViewer = (r: typeof reportDefs[0]) => {
    const { csv, filename } = r.getData();
    setCurrentPageReport(1);
    setViewer({ title: r.title, csv, filename });
  };

  const doDownload = () => {
    if (!viewer) return;
    dlCSV(viewer.csv, viewer.filename);
    toast("다운로드 완료", "ok");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <Card><p style={{ margin: 0, color: C.textMuted, fontSize: mob ? 13 : 14 }}>보고서를 클릭하면 미리보기가 열립니다. 다운로드는 뷰어에서 버튼으로 받을 수 있습니다.</p></Card>
      <div style={{ display: "grid", gridTemplateColumns: mob ? "1fr" : "repeat(auto-fit, minmax(280px, 1fr))", gap: mob ? 10 : 16 }}>
        {reportDefs.map((r, i) => (
          <Card key={i} onClick={() => openViewer(r)} style={{ cursor: "pointer", transition: "all 0.2s" }}>
            <div style={{ display: "flex", alignItems: "center", gap: mob ? 12 : 16 }}>
              <div style={{ width: mob ? 42 : 52, height: mob ? 42 : 52, borderRadius: 14, background: `${r.color}12`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: mob ? 20 : 24, flexShrink: 0 }}>{r.icon}</div>
              <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 700, color: C.navy, fontSize: mob ? 14 : 16, marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.title}</div><div style={{ fontSize: mob ? 12 : 13, color: C.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.desc}</div></div>
              <div style={{ color: C.textMuted, flexShrink: 0 }}><Icons.Export /></div>
            </div>
          </Card>
        ))}
      </div>

      {viewer && (() => {
        const rows = parseCSVToRows(viewer.csv);
        const hasTable = rows.length >= 1 && rows[0].length >= 1;
        const dataRows = hasTable ? rows.slice(1) : [];
        const totalReportRows = dataRows.length;
        const paginatedReportRows = dataRows.slice((currentPageReport - 1) * 10, currentPageReport * 10);
        return (
          <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.5)", padding: 16 }} onClick={() => { setViewer(null); setCurrentPageReport(1); }}>
            <div style={{ background: C.card, borderRadius: 16, maxWidth: "min(95vw, 1000px)", maxHeight: "90vh", display: "flex", flexDirection: "column", boxShadow: "0 8px 32px rgba(0,0,0,0.2)" }} onClick={e => e.stopPropagation()}>
              <div style={{ padding: "16px 20px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: C.navy }}>{viewer.title}</h3>
                <div style={{ display: "flex", gap: 8 }}>
                  <Btn variant="primary" size="sm" onClick={doDownload}>📥 다운로드</Btn>
                  <Btn variant="ghost" size="sm" onClick={() => { setViewer(null); setCurrentPageReport(1); }}>닫기</Btn>
                </div>
              </div>
              <div ref={listRefReport} style={{ padding: 16, overflow: "auto", flex: 1, minHeight: 200 }}>
                {hasTable ? (
                  <>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: rows[0].length > 10 ? 800 : undefined }}>
                      <thead>
                        <tr style={{ background: C.bg }}>
                          {rows[0].map((cell, j) => (
                            <th key={j} style={{ padding: "8px 10px", textAlign: "left", fontWeight: 600, color: C.navy, borderBottom: `2px solid ${C.border}`, whiteSpace: "nowrap" }}>{cell}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedReportRows.map((row, i) => (
                          <tr key={i} style={{ borderBottom: `1px solid ${C.borderLight}` }}>
                            {row.map((cell, j) => (
                              <td key={j} style={{ padding: "6px 10px", color: C.text, whiteSpace: "nowrap", maxWidth: j >= 3 && row.length > 10 ? 32 : undefined, overflow: "hidden", textOverflow: "ellipsis" }} title={cell}>{cell || "—"}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <Pagination totalItems={totalReportRows} itemsPerPage={10} currentPage={currentPageReport} onPageChange={(p) => { setCurrentPageReport(p); listRefReport.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }} />
                  </>
                ) : (
                  <pre style={{ margin: 0, fontSize: 12, fontFamily: "ui-monospace, monospace", whiteSpace: "pre-wrap", wordBreak: "break-all", color: C.text }}>{viewer.csv}</pre>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

/* ====== Settings ====== */
function SettingsSub({ db, setDb, persist, toast, saveDb }: { db: DB; setDb: (fn: (prev: DB) => DB) => void; persist: () => void; toast: (m: string, t?: string) => void; saveDb: (d: DB) => Promise<void> }) {
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
      <Card>
        <h4 style={{ fontSize: mob ? 15 : 17, fontWeight: 700, color: C.navy, marginBottom: mob ? 14 : 20 }}>⚙️ 교회 설정</h4>
        <FormInput label="교회 이름" value={db.settings.churchName || ""} placeholder="○○교회"
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setDb(prev => ({ ...prev, settings: { ...prev.settings, churchName: e.target.value } })); persist(); }} />
        <FormInput label="부서 목록 (쉼표 구분)" value={db.settings.depts || ""} placeholder="유아부,유치부,유년부,초등부,중등부,고등부,청년부,장년부"
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setDb(prev => ({ ...prev, settings: { ...prev.settings, depts: e.target.value } })); persist(); }} />
        <div style={{ marginTop: 12 }}>
          <Btn onClick={handleSaveSettings}>저장</Btn>
        </div>
      </Card>
      <Card>
        <h4 style={{ fontSize: mob ? 15 : 17, fontWeight: 700, color: C.navy, marginBottom: mob ? 12 : 16 }}>🏠 목장 관리</h4>
        <p style={{ fontSize: 13, color: C.textMuted, marginBottom: 12 }}>목장을 생성·이름 변경·삭제하고, 그룹원을 추가·제거할 수 있습니다.</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 12 }}>
          {mokjangList.map(g => {
            const count = db.members.filter(m => ((m.mokjang ?? m.group) || "") === g).length;
            return (
              <div key={g} style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8, background: C.bg, borderRadius: 10, padding: "12px 14px", border: `1px solid ${C.border}` }}>
                <span style={{ fontWeight: 700, fontSize: 14, color: C.navy }}>🏠 {g}</span>
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
            <select value={addMemberSelect} onChange={e => setAddMemberSelect(e.target.value)} style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 14, marginBottom: 8 }}>
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
type SubPage = "dashboard" | "members" | "attendance" | "notes" | "newfamily" | "reports" | "settings";

const NAV_ITEMS: { id: SubPage; Icon: React.ComponentType<any>; label: string }[] = [
  { id: "dashboard", Icon: LayoutDashboard, label: "대시보드" },
  { id: "members", Icon: Users, label: "성도 관리" },
  { id: "attendance", Icon: CalendarCheck, label: "출석부" },
  { id: "notes", Icon: StickyNote, label: "기도/메모" },
  { id: "newfamily", Icon: Sprout, label: "새가족 관리" },
  { id: "reports", Icon: FileText, label: "보고서" },
  { id: "settings", Icon: Settings, label: "설정" },
];

const PAGE_INFO: Record<SubPage, { title: string; desc: string; addLabel?: string }> = {
  dashboard: { title: "대시보드", desc: "목양 현황을 한눈에 파악합니다", addLabel: "+ 성도 등록" },
  members: { title: "성도 관리", desc: "성도의 삶을 기억하고 돌봅니다", addLabel: "+ 성도 등록" },
  attendance: { title: "출석부", desc: "52주 출석 기록을 관리합니다" },
  notes: { title: "기도/메모", desc: "기도제목과 특이사항을 공유합니다", addLabel: "+ 기록" },
  newfamily: { title: "새가족 관리", desc: "새가족 4주 정착 트래킹", addLabel: "+ 새가족 등록" },
  reports: { title: "보고서", desc: "엑셀 보고서를 즉시 다운로드합니다" },
  settings: { title: "설정", desc: "교회 정보 및 데이터 관리" },
};

const SUB_PAGE_IDS: SubPage[] = ["dashboard", "members", "attendance", "notes", "newfamily", "reports", "settings"];

export function PastoralPage({ db, setDb, saveDb }: { db: DB; setDb: (fn: (prev: DB) => DB) => void; saveDb?: (d: DB) => Promise<void> }) {
  const mob = useIsMobile();
  const [activeSub, setActiveSubState] = useState<SubPage>(() => {
    if (typeof window === "undefined") return "dashboard";
    const v = localStorage.getItem("pastoral_active_sub");
    return (SUB_PAGE_IDS.includes(v as SubPage) ? v : "dashboard") as SubPage;
  });
  const setActiveSub = useCallback((id: SubPage) => setActiveSubState(id), []);
  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem("pastoral_active_sub", activeSub);
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

  // Member form
  const [fName, setFName] = useState(""); const [fDept, setFDept] = useState(""); const [fRole, setFRole] = useState("");
  const [fBirth, setFBirth] = useState(""); const [fGender, setFGender] = useState(""); const [fPhone, setFPhone] = useState("");
  const [fAddr, setFAddr] = useState(""); const [fFamily, setFFamily] = useState(""); const [fStatus, setFStatus] = useState("새가족");
  const [fSource, setFSource] = useState(""); const [fPrayer, setFPrayer] = useState(""); const [fMemo, setFMemo] = useState("");
  const [fGroup, setFGroup] = useState(""); const [fPhoto, setFPhoto] = useState("");
  const [fVisitPath, setFVisitPath] = useState(""); const [fReferrerId, setFReferrerId] = useState(""); const [fJob, setFJob] = useState(""); const [fFirstVisitDate, setFFirstVisitDate] = useState(todayStr());
  const [showBirthPicker, setShowBirthPicker] = useState(false);
  const photoRef = useRef<HTMLInputElement>(null);

  const formatBirthDisplay = (birth: string) => {
    if (!birth || !/^\d{4}-\d{2}-\d{2}$/.test(birth)) return "생년월일 선택";
    const [y, m, d] = birth.split("-");
    return `${y}년 ${parseInt(m, 10)}월 ${parseInt(d, 10)}일`;
  };

  // Note form
  const [nDate, setNDate] = useState(todayStr()); const [nType, setNType] = useState<Note["type"]>("memo"); const [nContent, setNContent] = useState(""); const [nMbrSelect, setNMbrSelect] = useState("");
  const [noteFilterBy, setNoteFilterBy] = useState<"all" | "group" | "dept">("all");
  const [noteFilterValue, setNoteFilterValue] = useState("");

  // 출결 Phase 3: 예배별 출결
  type AttendanceSubTab = "dashboard" | "check" | "absentee" | "statistics" | "serviceType" | "weekly";
  const ATTENDANCE_SUB_IDS: AttendanceSubTab[] = ["dashboard", "check", "absentee", "statistics", "serviceType", "weekly"];
  const [attendanceSubTab, setAttendanceSubTabState] = useState<AttendanceSubTab>(() => {
    if (typeof window === "undefined") return "dashboard";
    const v = localStorage.getItem("pastoral_attendance_sub_tab");
    return (ATTENDANCE_SUB_IDS.includes(v as AttendanceSubTab) ? v : "dashboard") as AttendanceSubTab;
  });
  const setAttendanceSubTab = useCallback((id: AttendanceSubTab) => setAttendanceSubTabState(id), []);
  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem("pastoral_attendance_sub_tab", attendanceSubTab);
  }, [attendanceSubTab]);
  const DEFAULT_SERVICE_TYPES: ServiceType[] = [
    { id: "st-1", name: "주일1부예배", day_of_week: 0, default_time: "09:00", is_active: true, sort_order: 0 },
    { id: "st-2", name: "주일2부예배", day_of_week: 0, default_time: "11:00", is_active: true, sort_order: 1 },
    { id: "st-3", name: "수요예배", day_of_week: 3, default_time: "19:30", is_active: true, sort_order: 2 },
    { id: "st-4", name: "금요기도회", day_of_week: 5, default_time: "21:00", is_active: true, sort_order: 3 },
    { id: "st-5", name: "새벽기도", day_of_week: undefined, default_time: "05:30", is_active: true, sort_order: 4 },
  ];
  const [dateBasedAttendance, setDateBasedAttendance] = useState<Attendance[]>([]);
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>(DEFAULT_SERVICE_TYPES);

  const persist = useCallback(() => { /* 부모에서 db 변경 시 자동 저장 */ }, []);

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
      setFGroup((m.mokjang ?? m.group) && mokjangOptions.includes((m.mokjang ?? m.group) || "") ? ((m.mokjang ?? m.group) || "") : ((m.mokjang ?? m.group) || ""));
      setFVisitPath((m.visit_path ?? m.visitPath) || ""); setFReferrerId(m.referrer_id || ""); setFJob(m.job || ""); setFFirstVisitDate((m.first_visit_date ?? m.firstVisitDate) || todayStr());
    } else {
      setFName(""); setFDept(depts[0] || ""); setFRole(""); setFBirth(""); setFGender("");
      setFPhone(""); setFAddr(""); setFFamily(""); setFStatus("새가족"); setFSource("");
      setFPrayer(""); setFMemo(""); setFPhoto("");
      setFGroup("");
      setFVisitPath(""); setFReferrerId(""); setFJob(""); setFFirstVisitDate(todayStr());
    }
    setShowMemberModal(true);
  }, [db.members, db.settings.mokjangList, depts]);

  const saveMember = () => {
    if (!fName.trim()) { toast("이름을 입력하세요", "err"); return; }
    const data: Partial<Member> = {
      name: fName.trim(), dept: fDept, role: fRole.trim(), birth: fBirth, gender: fGender, phone: fPhone.trim(),
      address: fAddr.trim(), family: fFamily.trim(), status: fStatus, source: fSource, prayer: fPrayer.trim(), memo: fMemo.trim(), photo: fPhoto, group: fGroup || undefined,
      visit_path: (fVisitPath || undefined) as Member["visit_path"], referrer_id: fReferrerId || undefined, job: fJob.trim() || undefined, first_visit_date: fFirstVisitDate || undefined,
    };
    if (editMbrId) {
      setDb(prev => ({ ...prev, members: prev.members.map(m => m.id === editMbrId ? { ...m, ...data } : m) }));
      toast("수정 완료", "ok");
    } else {
      const newId = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : "mb_" + uid();
      const startDate = fFirstVisitDate || todayStr();
      setDb(prev => {
        const next = { ...prev, members: [...prev.members, { ...data, id: newId, createdAt: todayStr() } as Member] };
        if (fStatus === "새가족" || fStatus === "정착중") {
          const program: NewFamilyProgram = {
            id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : "nfp_" + uid(),
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
      toast("등록 완료", "ok");
    }
    setShowBirthPicker(false);
    setShowMemberModal(false);
  };

  const closeMemberModal = () => {
    const hasInput = fName.trim() || fRole.trim() || fBirth || fPhone.trim() || fAddr.trim() || fFamily.trim() || fPrayer.trim() || fMemo.trim() || fPhoto;
    if (hasInput && typeof window !== "undefined" && !window.confirm("작성 중인 내용이 있습니다. 닫으시겠습니까?")) return;
    setShowBirthPicker(false);
    setShowMemberModal(false);
  };

  const openDetail = useCallback((id: string) => { setDetailId(id); setShowDetailModal(true); }, []);

  const deleteMember = (id: string) => {
    if (typeof window !== "undefined" && !window.confirm("삭제하시겠습니까?")) return;
    setDb(prev => {
      const { [id]: _a, ...att } = prev.attendance;
      const { [id]: _ar, ...attReasons } = prev.attendanceReasons || {};
      const { [id]: _n, ...notes } = prev.notes;
      const newFamilyPrograms = (prev.newFamilyPrograms || []).filter(p => p.member_id !== id);
      const next = { ...prev, members: prev.members.filter(m => m.id !== id), attendance: att, attendanceReasons: attReasons, notes, newFamilyPrograms };
      saveDb?.(next).catch(() => toast("저장 실패", "err"));
      return next;
    });
    setShowDetailModal(false);
    setProgramDetailMemberId(null);
    toast("삭제 완료", "warn");
  };

  const openNoteModal = useCallback((id?: string) => {
    setNoteTargetId(id || null);
    setNMbrSelect(id || db.members[0]?.id || "");
    setNDate(todayStr()); setNType("memo"); setNContent("");
    if (id) {
      const m = db.members.find(x => x.id === id);
      if ((m?.mokjang ?? m?.group)) { setNoteFilterBy("group"); setNoteFilterValue((m.mokjang ?? m.group) || ""); }
      else if (m?.dept) { setNoteFilterBy("dept"); setNoteFilterValue(m.dept); }
      else { setNoteFilterBy("all"); setNoteFilterValue(""); }
    } else { setNoteFilterBy("all"); setNoteFilterValue(""); }
    setShowNoteModal(true);
  }, [db.members]);

  const saveNote = () => {
    const mid = nMbrSelect || noteTargetId;
    if (!nContent.trim()) { toast("내용을 입력하세요", "err"); return; }
    if (!mid) { toast("성도를 선택하세요", "err"); return; }
    setDb(prev => {
      const notes = { ...prev.notes };
      if (!notes[mid]) notes[mid] = [];
      notes[mid] = [...notes[mid], { date: nDate, type: nType, content: nContent.trim(), createdAt: new Date().toISOString() }];
      let members = prev.members;
      if (nType === "prayer") { members = members.map(m => m.id === mid ? { ...m, prayer: nContent.trim() } : m); }
      return { ...prev, notes, members };
    });
    setShowNoteModal(false); toast("기록 저장 완료", "ok");
  };

  const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImage(file, 400, 0.7);
      const fd = new FormData();
      fd.append("file", compressed);
      const r = await fetch("/api/upload-photo", { method: "POST", body: fd });
      const data = await r.json();
      if (data.url) setFPhoto(data.url);
      else toast("업로드 실패", "err");
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
          {info.addLabel && <Btn size="sm" onClick={topAdd}>{mob ? "+" : info.addLabel}</Btn>}
        </>
      }
      SidebarIcon={Church}
    >
          {activeSub === "dashboard" && <DashboardSub db={db} currentWeek={currentWeek} />}
          {activeSub === "members" && <MembersSub db={db} setDb={fn => setDb(fn)} persist={persist} toast={toast} currentWeek={currentWeek} openMemberModal={openMemberModal} openDetail={openDetail} openNoteModal={openNoteModal} detailId={detailId} />}
          {activeSub === "attendance" && (
            <>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16, paddingBottom: 12, borderBottom: `1px solid ${C.border}` }}>
                {[
                  { id: "dashboard" as const, label: "대시보드", Icon: LayoutDashboard },
                  { id: "check" as const, label: "출석 체크", Icon: CalendarCheck },
                  { id: "absentee" as const, label: "결석자 관리", Icon: UserX },
                  { id: "statistics" as const, label: "출석 통계", Icon: BarChart3 },
                  { id: "serviceType" as const, label: "예배 설정", Icon: Sliders },
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
                <AttendanceDashboard
                  members={db.members}
                  attendanceList={dateBasedAttendance}
                  serviceTypes={serviceTypes}
                  onOpenCheck={() => setAttendanceSubTab("check")}
                  onOpenAbsentee={() => setAttendanceSubTab("absentee")}
                  onOpenAbsenteeList={() => setAttendanceSubTab("absentee")}
                />
              )}
              {attendanceSubTab === "check" && (
                <AttendanceCheck
                  members={db.members}
                  serviceTypes={serviceTypes}
                  toast={toast}
                />
              )}
              {attendanceSubTab === "absentee" && (
                <AbsenteeManagement
                  members={db.members}
                  attendanceList={dateBasedAttendance}
                  consecutiveWeeks={3}
                  toast={toast}
                  onAddVisit={(memberId) => { setNoteTargetId(memberId); setShowNoteModal(true); toast("심방 등록은 기도/메모에서 기록해 주세요", "ok"); }}
                />
              )}
              {attendanceSubTab === "statistics" && (
                <AttendanceStatistics
                  members={db.members}
                  attendanceList={dateBasedAttendance}
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
              )}
              {attendanceSubTab === "serviceType" && (
                <ServiceTypeSettings
                  serviceTypes={serviceTypes}
                  onSave={async (list) => { setServiceTypes(list); toast("예배 유형이 저장되었습니다", "ok"); }}
                />
              )}
              {attendanceSubTab === "weekly" && <AttendanceSub db={db} setDb={fn => setDb(fn)} persist={persist} toast={toast} currentWeek={currentWeek} setCurrentWeek={setCurrentWeek} />}
            </>
          )}
          {activeSub === "notes" && <NotesSub db={db} setDb={fn => setDb(fn)} persist={persist} openDetail={openDetail} openNoteModal={openNoteModal} />}
          {activeSub === "newfamily" && <NewFamilySub db={db} setDb={fn => setDb(fn)} openProgramDetail={setProgramDetailMemberId} openMemberModal={openMemberModal} toast={toast} />}
          {activeSub === "reports" && <ReportsSub db={db} currentWeek={currentWeek} toast={toast} />}
          {activeSub === "settings" && <SettingsSub db={db} setDb={fn => setDb(fn)} persist={persist} toast={toast} saveDb={saveDBToSupabase} />}
    </UnifiedPageLayout>

      {/* ===== MODALS ===== */}

      {/* Member Modal */}
      <Modal open={showMemberModal} onClose={closeMemberModal} title={editMbrId ? "성도 수정" : "성도 등록"}>
        {/* 프로필 사진 — 맨 위, 원형 100px, 가운데 */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
          <div
            onClick={() => photoRef.current?.click()}
            style={{
              width: 100, height: 100, borderRadius: "50%", background: "#f3f4f6", cursor: "pointer",
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0,
            }}
          >
            {fPhoto ? (
              <img src={fPhoto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <>
                <div style={{ color: C.textMuted, marginBottom: 4 }}><Icons.Camera /></div>
                <span style={{ fontSize: 11, color: C.textMuted }}>사진 등록</span>
              </>
            )}
          </div>
          <input ref={photoRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handlePhoto} />
        </div>
        <FormInput label="이름 *" value={fName} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFName(e.target.value)} placeholder="이름" />
        <div style={{ display: "grid", gridTemplateColumns: mob ? "1fr" : "1fr 1fr", gap: 12 }}>
          <FormSelect label="부서" value={fDept} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFDept(e.target.value)} options={depts.map(d => ({ value: d, label: d }))} />
          <FormInput label="직분/학년" value={fRole} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFRole(e.target.value)} placeholder="예: 집사, 3학년" />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: mob ? "1fr" : "1fr 1fr", gap: 12 }}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: C.navy, marginBottom: 6 }}>생년월일</label>
            <div
              onClick={() => setShowBirthPicker((v) => !v)}
              style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 14, background: "#fff", color: fBirth ? C.text : C.textMuted, cursor: "pointer" }}
            >
              {formatBirthDisplay(fBirth)}
            </div>
            {showBirthPicker && (
              <div style={{ marginTop: 12 }}>
                <DateWheelPicker
                  value={fBirth || "2000-01-01"}
                  onChange={(v) => setFBirth(v)}
                  onConfirm={() => setShowBirthPicker(false)}
                />
              </div>
            )}
          </div>
          <FormSelect label="성별" value={fGender} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFGender(e.target.value)} options={[{ value: "", label: "선택" }, { value: "남", label: "남" }, { value: "여", label: "여" }]} />
        </div>
        <FormInput label="연락처" type="tel" value={fPhone} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFPhone(e.target.value)} placeholder="010-0000-0000" />
        <FormInput label="주소" value={fAddr} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFAddr(e.target.value)} placeholder="주소" />
        <FormInput label="가족관계" value={fFamily} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFFamily(e.target.value)} placeholder="예: 김○○ 집사(배우자)" />
        <FormSelect label="상태" value={fStatus} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFStatus(e.target.value)} options={[
          { value: "새가족", label: "새가족" }, { value: "정착중", label: "정착중" }, { value: "정착", label: "정착" },
          { value: "간헐", label: "간헐" }, { value: "위험", label: "위험" }, { value: "휴면", label: "휴면" }, { value: "졸업/전출", label: "졸업/전출" },
        ]} />
        <FormSelect label="등록 경로" value={fSource} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFSource(e.target.value)} options={[
          { value: "", label: "선택" }, { value: "기존교인자녀", label: "기존 교인 자녀" }, { value: "전도", label: "전도" },
          { value: "전입", label: "타교회 전입" }, { value: "지인소개", label: "지인 소개" }, { value: "기타", label: "기타" },
        ]} />
        {(fStatus === "새가족" || fStatus === "정착중") && (
          <>
            <FormSelect label="방문경로" value={fVisitPath} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFVisitPath(e.target.value)} options={[
              { value: "", label: "선택" }, { value: "지인소개", label: "지인소개" }, { value: "전도", label: "전도" }, { value: "인터넷검색", label: "인터넷검색" }, { value: "자진방문", label: "자진방문" }, { value: "기타", label: "기타" },
            ]} />
            {fVisitPath === "지인소개" && (
              <FormSelect label="소개자" value={fReferrerId} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFReferrerId(e.target.value)} options={[
                { value: "", label: "선택" },
                ...db.members.filter(x => x.status !== "새가족" && x.id !== editMbrId).map(m => ({ value: m.id, label: `${m.name} (${m.dept || ""})` })),
              ]} />
            )}
            <FormInput label="직업" value={fJob} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFJob(e.target.value)} placeholder="직업" />
            <div style={{ marginBottom: 16 }}><CalendarDropdown label="첫 방문일" value={fFirstVisitDate} onChange={setFFirstVisitDate} /></div>
          </>
        )}
        <FormSelect label="목장" value={fGroup} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFGroup(e.target.value)} options={[
          { value: "", label: "미배정" },
          ...getMokjangList(db).map(g => ({ value: g, label: g })),
          ...(fGroup && !getMokjangList(db).includes(fGroup) ? [{ value: fGroup, label: fGroup }] : []),
        ]} />
        <FormTextarea label="기도제목" value={fPrayer} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFPrayer(e.target.value)} placeholder="이 성도를 위한 기도제목" />
        <FormTextarea label="특이사항 메모" value={fMemo} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFMemo(e.target.value)} placeholder="사업장 개업, 병원치료, 가정문제, 진학, 취업 등" />
        <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 8 }}>
          <Btn variant="ghost" onClick={closeMemberModal}>취소</Btn>
          <Btn onClick={saveMember}>저장</Btn>
        </div>
      </Modal>

      {/* New Family Program Detail Modal */}
      {programDetailMemberId && <NewFamilyProgramDetailModal db={db} setDb={fn => setDb(fn)} memberId={programDetailMemberId} onClose={() => setProgramDetailMemberId(null)} toast={toast} mob={mob} />}

      {/* Detail Modal — Member 360° 뷰 */}
      <Modal open={showDetailModal} onClose={() => setShowDetailModal(false)} title="" width={mob ? undefined : 720}>
        {detailMember && (
          <div style={{ maxHeight: "85vh", overflow: "hidden", display: "flex", flexDirection: "column" }}>
            <Member360View
              member={detailMember}
              db={db}
              statusHistory={[]}
              newFamilyProgram={(db.newFamilyPrograms || []).find(p => p.member_id === detailMember.id) ?? null}
              onEdit={() => { setShowDetailModal(false); openMemberModal(detailMember.id); }}
              onClose={() => setShowDetailModal(false)}
            />
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", paddingTop: 12, borderTop: `1px solid ${C.border}` }}>
              <Btn variant="danger" size="sm" onClick={() => detailMember && deleteMember(detailMember.id)}>삭제</Btn>
              <Btn variant="accent" size="sm" onClick={() => { detailMember && openNoteModal(detailMember.id); setShowDetailModal(false); }}>기록 추가</Btn>
            </div>
          </div>
        )}
      </Modal>

      {/* Note Modal */}
      <Modal open={showNoteModal} onClose={() => setShowNoteModal(false)} title={noteTargetId ? (db.members.find(x => x.id === noteTargetId)?.name || "") + " — 기록 추가" : "기록 추가"} width={500}>
        {(() => {
          const activeMembers = db.members.filter(x => x.status !== "졸업/전출");
          const groups = Array.from(new Set(activeMembers.map(m => m.mokjang ?? m.group).filter(Boolean))) as string[];
          groups.sort();
          const deptList = getDepts(db);
          let filteredMembers = activeMembers;
          if (noteFilterBy === "group" && noteFilterValue) filteredMembers = activeMembers.filter(m => (m.mokjang ?? m.group) === noteFilterValue);
          else if (noteFilterBy === "dept" && noteFilterValue) filteredMembers = activeMembers.filter(m => m.dept === noteFilterValue);
          const memberOptions = filteredMembers.length
            ? filteredMembers.map(x => ({ value: x.id, label: `${x.name} (${x.dept || ""})` }))
            : [{ value: "", label: "(해당 없음)" }];
          return (
            <>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
                <div style={{ flex: "1 1 140px" }}>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: C.navy, marginBottom: 6 }}>범위</label>
                  <select value={noteFilterBy} onChange={e => { const v = e.target.value as "all" | "group" | "dept"; setNoteFilterBy(v); setNoteFilterValue(""); setNMbrSelect(""); }} style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 14, background: "#fff", cursor: "pointer" }}>
                    <option value="all">전체</option>
                    <option value="group">목장별</option>
                    <option value="dept">부서별</option>
                  </select>
                </div>
                {noteFilterBy === "group" && (
                  <div style={{ flex: "1 1 160px" }}>
                    <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: C.navy, marginBottom: 6 }}>목장</label>
                    <select value={noteFilterValue} onChange={e => { setNoteFilterValue(e.target.value); setNMbrSelect(""); }} style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 14, background: "#fff", cursor: "pointer" }}>
                      <option value="">선택</option>
                      {groups.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                  </div>
                )}
                {noteFilterBy === "dept" && (
                  <div style={{ flex: "1 1 160px" }}>
                    <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: C.navy, marginBottom: 6 }}>부서</label>
                    <select value={noteFilterValue} onChange={e => { setNoteFilterValue(e.target.value); setNMbrSelect(""); }} style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 14, background: "#fff", cursor: "pointer" }}>
                      <option value="">선택</option>
                      {deptList.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                )}
              </div>
              <FormSelect label="대상 성도" value={nMbrSelect} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setNMbrSelect(e.target.value)}
                options={memberOptions} />
            </>
          );
        })()}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div style={{ marginBottom: 16 }}><CalendarDropdown label="날짜" value={nDate} onChange={setNDate} /></div>
          <FormSelect label="유형" value={nType} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setNType(e.target.value as Note["type"])}
            options={[{ value: "memo", label: "📝 메모" }, { value: "prayer", label: "🙏 기도제목" }, { value: "visit", label: "🏠 심방" }, { value: "event", label: "🎉 경조사" }]} />
        </div>
        <FormTextarea label="내용" value={nContent} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNContent(e.target.value)} placeholder="기록 내용" style={{ minHeight: 100 }} />
        <div style={{ marginTop: 16 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: C.navy, display: "block", marginBottom: 8 }}>이전 기록</label>
          {(() => {
            const mid = nMbrSelect || noteTargetId;
            const hist = mid ? (db.notes[mid] || []).slice().reverse().slice(0, 5) : [];
            return hist.length ? hist.map((n, i) => <NoteCard key={i} n={n} />) : <div style={{ textAlign: "center", color: C.textFaint, padding: 16, fontSize: 13 }}>기록 없음</div>;
          })()}
        </div>
        <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 16 }}>
          <Btn variant="ghost" onClick={() => setShowNoteModal(false)}>취소</Btn>
          <Btn variant="accent" onClick={saveNote}>저장</Btn>
        </div>
      </Modal>

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
