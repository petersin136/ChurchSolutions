"use client";

import { useState, useMemo, useCallback, useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import * as XLSX from "xlsx";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from "recharts";
import { LayoutDashboard, Wallet, Users, Receipt, FileText, PieChart, Download, FileSignature, Church, Settings } from "lucide-react";
import { UnifiedPageLayout } from "@/components/layout/UnifiedPageLayout";
import { SealSettingsSection } from "@/components/finance/SealSettingsSection";
import { FinanceDashboard } from "@/components/finance/FinanceDashboard";
import { CashJournal } from "@/components/finance/CashJournal";
import { BudgetManagement } from "@/components/finance/BudgetManagement";
import { BudgetVsActual } from "@/components/finance/BudgetVsActual";
import { DonorStatistics } from "@/components/finance/DonorStatistics";
import { SpecialAccounts } from "@/components/finance/SpecialAccounts";
import { Pagination } from "@/components/common/Pagination";
import { CalendarDropdown } from "@/components/CalendarDropdown";
import type { DB, Member, Income as DBIncome, Expense as DBExpense } from "@/types/db";
import { supabase } from "@/lib/supabase";
import { getChurchId, withChurchId } from "@/lib/tenant";

/* ---------- useIsMobile ---------- */
function useIsMobile(bp = 768) {
  const [m, setM] = useState(false);
  useEffect(() => { const c = () => setM(window.innerWidth <= bp); c(); window.addEventListener("resize", c); return () => window.removeEventListener("resize", c); }, [bp]);
  return m;
}

// ============================================================
// 교회 재정관리 시스템 MVP - Church Finance Manager
// ============================================================

/* ---------- 유틸리티 ---------- */
const fmt = (n: number) => new Intl.NumberFormat("ko-KR").format(n);
const todayStr = () => new Date().toISOString().slice(0, 10);
const uid = () => Math.random().toString(36).slice(2, 9);

const MONTHS = ["1월","2월","3월","4월","5월","6월","7월","8월","9월","10월","11월","12월"];
const QUARTERS = ["1분기 (1-3월)","2분기 (4-6월)","3분기 (7-9월)","4분기 (10-12월)"];
const HALVES = ["상반기 (1-6월)","하반기 (7-12월)"];

/* ---------- 기본 헌금 카테고리 (주일헌금, 십일조, 감사헌금, 건축헌금, 선교헌금, 기타) ---------- */
interface Category { id: string; name: string; color: string; icon: string; }
const DEFAULT_CATEGORIES: Category[] = [
  { id: "sunday", name: "주일헌금", color: "#ffd166", icon: "⛪" },
  { id: "tithe", name: "십일조", color: "#4361ee", icon: "📘" },
  { id: "thanks", name: "감사헌금", color: "#f72585", icon: "🙏" },
  { id: "building", name: "건축헌금", color: "#3a0ca3", icon: "🏗️" },
  { id: "mission", name: "선교헌금", color: "#7209b7", icon: "🌍" },
  { id: "other", name: "기타", color: "#8d99ae", icon: "📋" },
];

/* ---------- 기본 부서 ---------- */
interface Department { id: string; name: string; color: string; }
const DEFAULT_DEPARTMENTS: Department[] = [
  { id: "worship", name: "예배부", color: "#4361ee" },
  { id: "education", name: "교육부", color: "#f72585" },
  { id: "mission_dept", name: "선교부", color: "#7209b7" },
  { id: "youth_dept", name: "청년부", color: "#06d6a0" },
  { id: "children_dept", name: "주일학교부", color: "#118ab2" },
  { id: "facility", name: "시설관리부", color: "#3a0ca3" },
  { id: "admin", name: "행정부", color: "#ffd166" },
  { id: "social", name: "사회봉사부", color: "#ef476f" },
  { id: "music", name: "찬양부", color: "#4cc9f0" },
  { id: "general", name: "총무부", color: "#8d99ae" },
];

/* ---------- 지출 카테고리 ---------- */
interface ExpCategory { id: string; name: string; icon: string; }
const EXPENSE_CATEGORIES: ExpCategory[] = [
  { id: "salary", name: "인건비", icon: "💰" },
  { id: "rent", name: "임대료/관리비", icon: "🏠" },
  { id: "utility", name: "공과금", icon: "💡" },
  { id: "supply", name: "비품/소모품", icon: "📦" },
  { id: "event", name: "행사비", icon: "🎉" },
  { id: "mission_exp", name: "선교비", icon: "✈️" },
  { id: "education_exp", name: "교육비", icon: "📚" },
  { id: "maintenance", name: "시설유지비", icon: "🔧" },
  { id: "transport", name: "교통비", icon: "🚗" },
  { id: "food", name: "식비/다과", icon: "🍚" },
  { id: "other_exp", name: "기타지출", icon: "📋" },
];

/* ---------- 데이터 타입 ---------- */
interface Donor { id: string; name: string; phone: string; group: string; joinDate: string; note: string; photoUrl?: string; address?: string; residentNumber?: string; }
interface Offering { id: string; donorId: string; donorName: string; categoryId: string; amount: number; date: string; method: string; note: string; }
interface Expense { id: string; categoryId: string; departmentId: string; amount: number; date: string; description: string; receipt: boolean; note: string; }

/** 목양(db.members) ↔ 재정 헌금자(Donor) 연동 */
function membersToDonors(members: Member[]): Donor[] {
  return members.map(m => ({
    id: m.id,
    name: m.name,
    phone: m.phone ?? "",
    group: (m.group || m.dept) ?? "",
    joinDate: m.createdAt ?? "",
    note: m.memo ?? "",
    address: m.address,
  }));
}
function donorsToMembers(donors: Donor[]): Member[] {
  return donors
    .filter(d => d.id !== "anon" && d.name !== "익명")
    .map(d => ({
      id: d.id,
      name: d.name,
      phone: d.phone,
      group: d.group || undefined,
      createdAt: d.joinDate || undefined,
      memo: d.note || undefined,
      address: d.address,
    } as Member));
}

/** DB(슈퍼플래너) Income/Expense ↔ 재정 화면 Offering/Expense 변환 — 재정과 Supabase 내용 일치 */
const INCOME_TYPE_TO_ID: Record<string, string> = {
  주일헌금: "sunday", 주정헌금: "sunday", sunday: "sunday",
  십일조: "tithe", tithe: "tithe",
  감사헌금: "thanks", thanks: "thanks",
  건축헌금: "building", building: "building",
  선교헌금: "mission", mission: "mission",
  기타: "other", other: "other",
  기타헌금: "other", 기타수입: "other",
  특별헌금: "other", special: "other",
  첫열매헌금: "other", firstfruit: "other",
  청년부헌금: "other", youth: "other",
  주일학교헌금: "other", children: "other",
};
function incomeToOfferings(income: DBIncome[]): Offering[] {
  return income.map(i => ({
    id: i.id,
    donorId: "",
    donorName: i.donor ?? "",
    categoryId: (i.type && INCOME_TYPE_TO_ID[i.type]) || "other",
    amount: i.amount,
    date: i.date,
    method: i.method ?? "현금",
    note: i.memo ?? "",
  }));
}
function offeringsToIncome(offerings: Offering[]): DBIncome[] {
  return offerings.map(o => ({
    id: o.id,
    date: o.date,
    type: o.categoryId,
    amount: o.amount,
    donor: o.donorName || undefined,
    method: o.method || undefined,
    memo: o.note || undefined,
  }));
}
function expenseDbToFp(expense: DBExpense[]): Expense[] {
  return expense.map(e => ({
    id: e.id,
    categoryId: e.category || "other_exp",
    departmentId: e.resolution ?? "",
    amount: e.amount,
    date: e.date,
    description: e.item ?? "",
    receipt: false,
    note: e.memo ?? "",
  }));
}
function expenseFpToDb(expense: Expense[]): DBExpense[] {
  return expense.map(e => ({
    id: e.id,
    date: e.date,
    category: e.categoryId,
    item: e.description || undefined,
    amount: e.amount,
    resolution: e.departmentId || undefined,
    memo: e.note || undefined,
  }));
}

/** 예결산: 연도별 항목별 예산 (income/expense by categoryId) */
export type BudgetByYear = Record<string, { income: Record<string, number>; expense: Record<string, number> }>;

/* ---------- 예결산 기본 항목 (주일헌금, 십일조, 감사헌금, 건축헌금, 선교헌금, 기타) ---------- */
const BUDGET_INCOME_IDS = ["sunday", "tithe", "thanks", "building", "mission", "other"] as const;
const BUDGET_EXPENSE_IDS = ["salary", "education_exp", "mission_exp", "rent", "event", "other_exp"] as const; // 목회활동비(인건비), 교육비, 선교비, 관리비, 수련회비(행사비), 기타지출

/* ---------- 아이콘 ---------- */
const Icons = {
  Dashboard: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>,
  Offering: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>,
  Donor: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>,
  Expense: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 4H3v16h18V4zM1 10h22"/><path d="M6 16h4M14 16h4"/></svg>,
  Report: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/></svg>,
  Budget: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20V10M18 20V4M6 20v-4"/></svg>,
  Export: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>,
  Receipt: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6M9 15h6M9 11h6M9 7h2"/></svg>,
  Plus: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>,
  Search: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>,
  X: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>,
  TrendUp: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#06d6a0" strokeWidth="2"><path d="M23 6l-9.5 9.5-5-5L1 18"/><path d="M17 6h6v6"/></svg>,
  TrendDown: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef476f" strokeWidth="2"><path d="M23 18l-9.5-9.5-5 5L1 6"/><path d="M17 18h6v-6"/></svg>,
  Church: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 2v4M10 6h4M8 6v4l-5 3v9h18v-9l-5-3V6"/><rect x="10" y="16" width="4" height="6"/></svg>,
};

/* ---------- 스타일 ---------- */
const C = {
  bg: "#f8f7f4", card: "#ffffff", navy: "#1b2a4a", navyLight: "#2d4373",
  text: "#1b2a4a", textMuted: "#6b7b9e", border: "#e8e6e1", borderLight: "#f0eeeb",
  blue: "#4361ee", blueBg: "#eef0ff", accent: "#4361ee", accentLight: "#eef0ff", accentBg: "#eef0ff",
  success: "#06d6a0", successLight: "#e6faf3",
  danger: "#ef476f", dangerLight: "#fde8ed", warning: "#ffd166", warningLight: "#fff8e6",
  purple: "#7209b7", purpleLight: "#f3e8ff",
};

/* ---------- 공통 컴포넌트 ---------- */
function Card({ children, style, onClick }: { children: ReactNode; style?: CSSProperties; onClick?: () => void }) {
  return (
    <div onClick={onClick} style={{
      background: C.card, borderRadius: 16, border: `1px solid ${C.border}`,
      padding: 24, transition: "all 0.2s ease", cursor: onClick ? "pointer" : "default", ...style,
    }}>{children}</div>
  );
}

function Badge({ children, color = C.accent, bg }: { children: ReactNode; color?: string; bg?: string }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600,
      color, background: bg || `${color}15`, whiteSpace: "nowrap",
    }}>{children}</span>
  );
}

function Button({ children, onClick, variant = "primary", size = "md", icon, disabled, style: extraStyle }: {
  children: ReactNode; onClick?: () => void; variant?: string; size?: string;
  icon?: ReactNode; disabled?: boolean; style?: CSSProperties;
}) {
  const base: CSSProperties = {
    display: "inline-flex", alignItems: "center", gap: 6,
    border: "none", borderRadius: 10, cursor: disabled ? "not-allowed" : "pointer",
    fontWeight: 600, fontFamily: "inherit", transition: "all 0.15s ease",
    fontSize: size === "sm" ? 13 : 14,
    padding: size === "sm" ? "6px 14px" : "10px 20px",
    opacity: disabled ? 0.6 : 1,
  };
  const variants: Record<string, CSSProperties> = {
    primary: { background: C.navy, color: "#fff" },
    accent: { background: C.accent, color: "#fff" },
    success: { background: C.success, color: "#fff" },
    danger: { background: C.danger, color: "#fff" },
    ghost: { background: "transparent", color: C.navy, border: `1px solid ${C.border}` },
    soft: { background: C.accentLight, color: C.accent },
  };
  return (
    <button type="button" onClick={onClick} disabled={disabled} style={{ ...base, ...(variants[variant] || variants.primary), ...extraStyle }}>
      {icon}{children}
    </button>
  );
}

function Input({ label, className, style, ...props }: { label?: string; className?: string; style?: CSSProperties; [key: string]: unknown }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {label && <label style={{ fontSize: 13, fontWeight: 600, color: C.navy }}>{label}</label>}
      <input className={className} {...(props as React.InputHTMLAttributes<HTMLInputElement>)} style={{
        padding: "10px 14px", borderRadius: 10, border: `1px solid ${C.border}`,
        fontSize: 14, fontFamily: "inherit", color: C.navy, background: "#fff",
        outline: "none", transition: "border 0.15s", ...(style as CSSProperties || {}),
      }} />
    </div>
  );
}

function Select({ label, options, ...props }: {
  label?: string; options: { value: string; label: string }[];
  [key: string]: unknown;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {label && <label style={{ fontSize: 13, fontWeight: 600, color: C.navy }}>{label}</label>}
      <select {...(props as React.SelectHTMLAttributes<HTMLSelectElement>)} style={{
        padding: "10px 14px", borderRadius: 10, border: `1px solid ${C.border}`,
        fontSize: 14, fontFamily: "inherit", color: C.navy, background: "#fff",
        outline: "none", cursor: "pointer", ...(props.style as CSSProperties || {}),
      }}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function Modal({ open, onClose, title, children, width = 520 }: {
  open: boolean; onClose: () => void; title: string; children: ReactNode; width?: number;
}) {
  const mob = useIsMobile();
  const modalHeight = mob ? "92vh" : "85vh";
  if (!open) return null;
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1000,
      display: "flex", alignItems: mob ? "flex-end" : "center", justifyContent: "center",
      background: "rgba(27,42,74,0.4)", backdropFilter: "blur(4px)", padding: mob ? 0 : 20,
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "#fff", borderRadius: mob ? "20px 20px 0 0" : 20, padding: mob ? 20 : 32,
        width: mob ? "100%" : "90%", maxWidth: mob ? "100%" : width,
        height: modalHeight, maxHeight: modalHeight,
        display: "flex", flexDirection: "column", overflow: "hidden",
        boxShadow: "0 20px 60px rgba(27,42,74,0.15)",
      }}>
        {mob && <div style={{ width: 36, height: 4, background: C.border, borderRadius: 4, margin: "0 auto 12px", flexShrink: 0 }} />}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexShrink: 0 }}>
          <h3 style={{ margin: 0, fontSize: mob ? 17 : 20, color: C.navy }}>{title}</h3>
          <button onClick={onClose} style={{
            background: "none", border: "none", cursor: "pointer", padding: 4, borderRadius: 8, display: "flex",
          }}><Icons.X /></button>
        </div>
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>{children}</div>
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, color = C.accent, trend }: {
  label: string; value: string; sub?: string; icon?: ReactNode; color?: string; trend?: string;
}) {
  return (
    <Card style={{ display: "flex", flexDirection: "column", gap: 8, position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: -10, right: -10, width: 60, height: 60, borderRadius: "50%", background: `${color}10` }} />
      <div style={{ fontSize: 13, color: C.textMuted, fontWeight: 500 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700, color: C.navy, letterSpacing: "-0.5px" }}>{value}</div>
      {sub && (
        <div style={{ fontSize: 12, color: C.textMuted, display: "flex", alignItems: "center", gap: 4 }}>
          {trend === "up" && <Icons.TrendUp />}
          {trend === "down" && <Icons.TrendDown />}
          {sub}
        </div>
      )}
    </Card>
  );
}

interface ColDef { label: string; key?: string; align?: string; render?: (row: Record<string, unknown>) => ReactNode; }

function Table({ columns, data, emptyMsg = "데이터가 없습니다" }: {
  columns: ColDef[]; data: Record<string, unknown>[]; emptyMsg?: string;
}) {
  return (
    <div style={{ overflowX: "auto", borderRadius: 12, border: `1px solid ${C.border}` }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
        <thead>
          <tr style={{ background: C.bg }}>
            {columns.map((col, i) => (
              <th key={i} style={{
                padding: "12px 16px", textAlign: (col.align || "left") as "left"|"right"|"center",
                fontWeight: 600, color: C.navy, fontSize: 13, borderBottom: `1px solid ${C.border}`, whiteSpace: "nowrap",
              }}>{col.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr><td colSpan={columns.length} style={{ padding: 40, textAlign: "center", color: C.textMuted }}>{emptyMsg}</td></tr>
          ) : data.map((row, ri) => (
            <tr key={ri} style={{
              borderBottom: ri < data.length - 1 ? `1px solid ${C.borderLight}` : "none", transition: "background 0.1s",
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = C.bg; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
              {columns.map((col, ci) => (
                <td key={ci} style={{
                  padding: "12px 16px", textAlign: (col.align || "left") as "left"|"right"|"center",
                  color: C.text, whiteSpace: "nowrap",
                }}>{col.render ? col.render(row) : (row[col.key || ""] as ReactNode)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ====== 대시보드 ====== */
function DashboardTab({ offerings, expenses, categories, departments }: {
  offerings: Offering[]; expenses: Expense[]; categories: Category[]; departments: Department[];
}) {
  const mob = useIsMobile();
  const totalOffering = offerings.reduce((s, o) => s + o.amount, 0);
  const totalExpense = expenses.reduce((s, e) => s + e.amount, 0);
  const balance = totalOffering - totalExpense;
  const uniqueDonors = new Set(offerings.map(o => o.donorId)).size;

  const monthlyOfferings = useMemo(() => {
    const r = new Array(12).fill(0);
    offerings.forEach(o => { const m = parseInt(o.date.split("-")[1]) - 1; r[m] += o.amount; });
    return r;
  }, [offerings]);

  const monthlyExpenses = useMemo(() => {
    const r = new Array(12).fill(0);
    expenses.forEach(e => { const m = parseInt(e.date.split("-")[1]) - 1; r[m] += e.amount; });
    return r;
  }, [expenses]);

  const catBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    offerings.forEach(o => { map[o.categoryId] = (map[o.categoryId] || 0) + o.amount; });
    return categories.map(c => ({
      ...c, total: map[c.id] || 0,
      pct: totalOffering > 0 ? ((map[c.id] || 0) / totalOffering * 100) : 0,
    })).sort((a, b) => b.total - a.total);
  }, [offerings, categories, totalOffering]);

  const deptExpBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    expenses.forEach(e => { map[e.departmentId] = (map[e.departmentId] || 0) + e.amount; });
    return departments.map(d => ({
      ...d, total: map[d.id] || 0,
      pct: totalExpense > 0 ? ((map[d.id] || 0) / totalExpense * 100) : 0,
    })).sort((a, b) => b.total - a.total);
  }, [expenses, departments, totalExpense]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
        <StatCard label="총 헌금액" value={`₩${fmt(totalOffering)}`} sub="2025년 누계" color={C.accent} />
        <StatCard label="총 지출액" value={`₩${fmt(totalExpense)}`} sub="2025년 누계" color={C.danger} />
        <StatCard label="잔액 (수입-지출)" value={`₩${fmt(balance)}`}
          sub={balance >= 0 ? "흑자" : "적자"} color={balance >= 0 ? C.success : C.danger}
          trend={balance >= 0 ? "up" : "down"} />
        <StatCard label="헌금자 수" value={`${uniqueDonors}명`} sub="활성 헌금자" color={C.purple} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: mob ? "1fr" : "1fr 1fr", gap: 16 }}>
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h4 style={{ margin: 0, color: C.navy, fontSize: 16 }}>월별 헌금 추이</h4>
            <Badge color={C.accent}>2025년</Badge>
          </div>
          <div style={{ display: "flex", alignItems: "end", gap: 6, height: 160 }}>
            {monthlyOfferings.map((v, i) => {
              const maxV = Math.max(...monthlyOfferings) || 1;
              const h = (v / maxV) * 140;
              return (
                <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <span style={{ fontSize: 10, color: C.textMuted }}>{v > 0 ? `${Math.round(v/10000)}만` : ""}</span>
                  <div style={{
                    width: "100%", height: h, minHeight: 4,
                    background: `linear-gradient(to top, ${C.accent}, ${C.accent}aa)`,
                    borderRadius: "6px 6px 2px 2px", transition: "height 0.3s ease",
                  }} />
                  <span style={{ fontSize: 10, color: C.textMuted }}>{i+1}월</span>
                </div>
              );
            })}
          </div>
        </Card>
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h4 style={{ margin: 0, color: C.navy, fontSize: 16 }}>월별 지출 추이</h4>
            <Badge color={C.danger}>2025년</Badge>
          </div>
          <div style={{ display: "flex", alignItems: "end", gap: 6, height: 160 }}>
            {monthlyExpenses.map((v, i) => {
              const maxV = Math.max(...monthlyExpenses) || 1;
              const h = (v / maxV) * 140;
              return (
                <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <span style={{ fontSize: 10, color: C.textMuted }}>{v > 0 ? `${Math.round(v/10000)}만` : ""}</span>
                  <div style={{
                    width: "100%", height: h, minHeight: 4,
                    background: `linear-gradient(to top, ${C.danger}, ${C.danger}aa)`,
                    borderRadius: "6px 6px 2px 2px", transition: "height 0.3s ease",
                  }} />
                  <span style={{ fontSize: 10, color: C.textMuted }}>{i+1}월</span>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: mob ? "1fr" : "1fr 1fr", gap: 16 }}>
        <Card>
          <h4 style={{ margin: "0 0 16px", color: C.navy, fontSize: 16 }}>헌금 항목별 현황</h4>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {catBreakdown.slice(0, 8).map(c => (
              <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 18, width: 28 }}>{c.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: C.navy }}>{c.name}</span>
                    <span style={{ fontSize: 13, color: C.textMuted }}>₩{fmt(c.total)} ({c.pct.toFixed(1)}%)</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 3, background: C.bg }}>
                    <div style={{ height: "100%", borderRadius: 3, width: `${c.pct}%`, background: c.color, transition: "width 0.5s ease" }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <h4 style={{ margin: "0 0 16px", color: C.navy, fontSize: 16 }}>부서별 지출 현황</h4>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {deptExpBreakdown.slice(0, 8).map(d => (
              <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 8, background: `${d.color}20`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 12, fontWeight: 700, color: d.color,
                }}>{d.name.charAt(0)}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: C.navy }}>{d.name}</span>
                    <span style={{ fontSize: 13, color: C.textMuted }}>₩{fmt(d.total)} ({d.pct.toFixed(1)}%)</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 3, background: C.bg }}>
                    <div style={{ height: "100%", borderRadius: 3, width: `${d.pct}%`, background: d.color, transition: "width 0.5s ease" }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card>
        <h4 style={{ margin: "0 0 16px", color: C.navy, fontSize: 16 }}>최근 헌금 내역</h4>
        <Table
          columns={[
            { label: "날짜", key: "date" },
            { label: "헌금자", render: (r) => <span style={{ fontWeight: 600 }}>{r.donorName as string}</span> },
            { label: "항목", render: (r) => {
              const cat = categories.find(c => c.id === r.categoryId);
              return cat ? <Badge color={cat.color}>{cat.icon} {cat.name}</Badge> : (r.categoryId as string);
            }},
            { label: "방법", render: (r) => <Badge color={C.textMuted}>{r.method as string}</Badge> },
            { label: "금액", align: "right", render: (r) => (
              <span style={{ fontWeight: 700, color: C.accent }}>₩{fmt(r.amount as number)}</span>
            )},
          ]}
          data={[...offerings].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10) as unknown as Record<string, unknown>[]}
          emptyMsg="헌금 내역이 없습니다"
        />
      </Card>
    </div>
  );
}

/* ====== 헌금 관리 (거래입력) ====== */
function OfferingTab({ offerings, setOfferings, donors, categories, onAddIncome, onDeleteIncome }: {
  offerings: Offering[]; setOfferings: React.Dispatch<React.SetStateAction<Offering[]>>;
  donors: Donor[]; categories: Category[];
  onAddIncome?: (o: Omit<Offering, "id">) => Promise<string | null>;
  onDeleteIncome?: (id: string) => Promise<void>;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("all");
  const [filterMonth, setFilterMonth] = useState("all");
  const [form, setForm] = useState({ donorName: "", categoryId: "tithe", amount: "", date: todayStr(), method: "현금", note: "" });

  const filtered = useMemo(() => {
    let result = [...offerings];
    if (search) { const q = search.toLowerCase(); result = result.filter(o => o.donorName.toLowerCase().includes(q)); }
    if (filterCat !== "all") result = result.filter(o => o.categoryId === filterCat);
    if (filterMonth !== "all") result = result.filter(o => o.date.split("-")[1] === filterMonth);
    return result.sort((a, b) => b.date.localeCompare(a.date));
  }, [offerings, search, filterCat, filterMonth]);

  const handleAdd = async () => {
    const name = form.donorName.trim() || "익명";
    if (!form.amount) return;
    const donor = donors.find(d => d.name === name);
    const newOffering: Omit<Offering, "id"> = {
      donorId: donor?.id || "",
      donorName: name,
      categoryId: form.categoryId,
      amount: parseInt(form.amount),
      date: form.date,
      method: form.method,
      note: form.note,
    };
    if (onAddIncome) {
      const id = await onAddIncome(newOffering);
      if (id) {
        setForm({ donorName: "", categoryId: "tithe", amount: "", date: todayStr(), method: "현금", note: "" });
        setShowAdd(false);
      }
    } else {
      setOfferings(prev => [...prev, { id: uid(), ...newOffering }]);
      setForm({ donorName: "", categoryId: "tithe", amount: "", date: todayStr(), method: "현금", note: "" });
      setShowAdd(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (onDeleteIncome) {
      await onDeleteIncome(id);
    } else {
      setOfferings(prev => prev.filter(o => o.id !== id));
    }
  };
  const filteredTotal = filtered.reduce((s, o) => s + o.amount, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ position: "relative" }}>
            <div style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }}><Icons.Search /></div>
            <input value={search} onChange={e => { setSearch(e.target.value); setCurrentPage(1); }} placeholder="헌금자 검색..."
              style={{ padding: "10px 14px 10px 36px", borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 14, fontFamily: "inherit", outline: "none", width: 200 }} />
          </div>
          <Select options={[{ value: "all", label: "전체 항목" }, ...categories.map(c => ({ value: c.id, label: c.name }))]}
            value={filterCat} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => { setFilterCat(e.target.value); setCurrentPage(1); }} />
          <Select options={[{ value: "all", label: "전체 월" }, ...MONTHS.map((m, i) => ({ value: String(i+1).padStart(2,"0"), label: m }))]}
            value={filterMonth} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => { setFilterMonth(e.target.value); setCurrentPage(1); }} />
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <Badge color={C.accent}>합계: ₩{fmt(filteredTotal)}</Badge>
          <Button onClick={() => setShowAdd(true)} icon={<Icons.Plus />}>헌금 등록</Button>
        </div>
      </div>
      <div ref={listRef}>
      <Table
        columns={[
          { label: "날짜", key: "date" },
          { label: "헌금자", render: (r) => <span style={{ fontWeight: 600 }}>{r.donorName as string}</span> },
          { label: "항목", render: (r) => { const cat = categories.find(c => c.id === r.categoryId); return cat ? <Badge color={cat.color}>{cat.icon} {cat.name}</Badge> : (r.categoryId as string); }},
          { label: "방법", render: (r) => <Badge color={C.textMuted}>{r.method as string}</Badge> },
          { label: "금액", align: "right", render: (r) => <span style={{ fontWeight: 700, color: C.accent }}>₩{fmt(r.amount as number)}</span> },
          { label: "", align: "center", render: (r) => <button onClick={() => handleDelete(r.id as string)} style={{ background: "none", border: "none", cursor: "pointer", color: C.textMuted, fontSize: 12, padding: 4 }}>삭제</button> },
        ]}
        data={filtered.slice((currentPage - 1) * 10, currentPage * 10) as unknown as Record<string, unknown>[]}
        emptyMsg="헌금 내역이 없습니다"
      />
      <Pagination totalItems={filtered.length} itemsPerPage={10} currentPage={currentPage} onPageChange={(p) => { setCurrentPage(p); listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }} />
      </div>
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="헌금 등록">
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: C.navy }}>헌금자</label>
            <input
              type="text"
              value={form.donorName}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, donorName: e.target.value }))}
              placeholder="이름 입력 (비워두면 익명)"
              list="offering-donor-list"
              style={{ padding: "12px 14px", borderRadius: 12, border: `1px solid ${C.border}`, fontSize: 15, fontFamily: "inherit", color: C.navy, background: "#fff", outline: "none" }}
            />
            <datalist id="offering-donor-list">
              {donors.filter(d => d.name !== "익명").map(d => <option key={d.id} value={d.name} />)}
            </datalist>
          </div>
          <Select label="헌금 항목" value={form.categoryId} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setForm(f => ({ ...f, categoryId: e.target.value }))}
            options={categories.map(c => ({ value: c.id, label: `${c.icon} ${c.name}` }))} />
          <Input label="금액 (원)" type="number" value={form.amount} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="100000" />
          <CalendarDropdown label="날짜" value={form.date} onChange={(v) => setForm(f => ({ ...f, date: v }))} />
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: C.navy }}>헌금 방법</label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {(["현금", "계좌이체", "온라인"] as const).map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, method: m }))}
                  style={{
                    padding: "10px 18px",
                    borderRadius: 12,
                    border: `2px solid ${form.method === m ? C.accent : C.border}`,
                    background: form.method === m ? C.accentLight : "#fff",
                    color: form.method === m ? C.accent : C.text,
                    fontSize: 14,
                    fontWeight: 600,
                    fontFamily: "inherit",
                    cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
          <Input label="메모" value={form.note} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, note: e.target.value }))} placeholder="메모 (선택)" />
          <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 8 }}>
            <Button variant="ghost" onClick={() => setShowAdd(false)}>취소</Button>
            <Button onClick={handleAdd}>등록</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

/* ====== 헌금자 관리 ====== */
function DonorTab({ donors, setDonors, offerings }: {
  donors: Donor[]; setDonors: React.Dispatch<React.SetStateAction<Donor[]>>; offerings: Offering[];
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ name: "", phone: "", group: "", joinDate: todayStr(), note: "" });

  const donorStats = useMemo(() => {
    const map: Record<string, { total: number; count: number; lastDate: string }> = {};
    offerings.forEach(o => {
      if (!map[o.donorId]) map[o.donorId] = { total: 0, count: 0, lastDate: "" };
      map[o.donorId].total += o.amount; map[o.donorId].count++;
      if (o.date > map[o.donorId].lastDate) map[o.donorId].lastDate = o.date;
    });
    return map;
  }, [offerings]);

  const filtered = useMemo(() => {
    let result = [...donors];
    if (search) { const q = search.toLowerCase(); result = result.filter(d => d.name.toLowerCase().includes(q) || d.phone.includes(q)); }
    return result.sort((a, b) => (donorStats[b.id]?.total || 0) - (donorStats[a.id]?.total || 0));
  }, [donors, search, donorStats]);

  const paginatedDonors = useMemo(() => filtered.slice((currentPage - 1) * 10, currentPage * 10), [filtered, currentPage]);

  const handleAdd = () => {
    if (!form.name) return;
    setDonors(prev => [...prev, { id: uid(), ...form }]);
    setForm({ name: "", phone: "", group: "", joinDate: todayStr(), note: "" });
    setShowAdd(false);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div style={{ position: "relative" }}>
          <div style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }}><Icons.Search /></div>
          <input value={search} onChange={e => { setSearch(e.target.value); setCurrentPage(1); }} placeholder="이름 또는 연락처 검색..."
            style={{ padding: "10px 14px 10px 36px", borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 14, fontFamily: "inherit", outline: "none", width: 260 }} />
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <Badge color={C.purple}>총 {donors.length}명</Badge>
          <Button onClick={() => setShowAdd(true)} icon={<Icons.Plus />}>헌금자 등록</Button>
        </div>
      </div>
      <div ref={listRef}>
      <Table
        columns={[
          { label: "이름", render: (r) => <span style={{ fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display: "inline-block", maxWidth: "100%" }} title={r.name as string}>{r.name as string}</span> },
          { label: "연락처", key: "phone" },
          { label: "소속", render: (r) => (r.group as string) ? <Badge color={C.textMuted}>{r.group as string}</Badge> : <span>-</span> },
          { label: "등록일", key: "joinDate" },
          { label: "헌금 횟수", align: "center", render: (r) => <span>{donorStats[r.id as string]?.count || 0}회</span> },
          { label: "헌금 합계", align: "right", render: (r) => <span style={{ fontWeight: 700, color: C.accent }}>₩{fmt(donorStats[r.id as string]?.total || 0)}</span> },
          { label: "최근 헌금일", render: (r) => <span>{donorStats[r.id as string]?.lastDate || "-"}</span> },
          { label: "메모", render: (r) => (r.note as string) ? <span style={{ color: C.textMuted, fontSize: 12 }}>{r.note as string}</span> : <span>-</span> },
        ]}
        data={paginatedDonors as unknown as Record<string, unknown>[]}
        emptyMsg="등록된 헌금자가 없습니다"
      />
      <Pagination totalItems={filtered.length} itemsPerPage={10} currentPage={currentPage} onPageChange={(p) => { setCurrentPage(p); listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }} />
      </div>
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="헌금자 등록">
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Input label="이름" value={form.name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, name: e.target.value }))} placeholder="홍길동" />
          <Input label="연락처" value={form.phone} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="010-0000-0000" />
          <Input label="소속 (부서/구역)" value={form.group} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, group: e.target.value }))} placeholder="장년부" />
          <CalendarDropdown label="등록일" value={form.joinDate} onChange={(v) => setForm(f => ({ ...f, joinDate: v }))} />
          <Input label="메모" value={form.note} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, note: e.target.value }))} placeholder="직분, 특이사항 등" />
          <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 8 }}>
            <Button variant="ghost" onClick={() => setShowAdd(false)}>취소</Button>
            <Button onClick={handleAdd}>등록</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

/* ====== 헌금 현황 (교인별 통계) ====== */

function GivingStatusTab({ donors, offerings, categories }: {
  donors: Donor[]; offerings: Offering[]; categories: Category[];
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<"name" | "total" | "lastDate" | "prevDate" | "thisMonth">("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  type DonorStat = {
    donor: Donor;
    total: number;
    lastDate: string | null;
    prevDate: string | null;
    thisMonth: number;
  };

  const donorStats = useMemo(() => {
    const now = new Date();
    const thisYear = now.getFullYear();
    const thisMonth = String(now.getMonth() + 1).padStart(2, "0");

    const map = new Map<string, { total: number; dates: string[]; thisMonth: number }>();
    donors.forEach(d => map.set(d.id, { total: 0, dates: [], thisMonth: 0 }));

    offerings.forEach(o => {
      const cur = map.get(o.donorId);
      if (!cur) return;
      cur.total += o.amount;
      if (!cur.dates.includes(o.date)) cur.dates.push(o.date);
      if (o.date.slice(0, 7) === `${thisYear}-${thisMonth}`) cur.thisMonth += o.amount;
    });

    return donors.map(donor => {
      const cur = map.get(donor.id)!;
      const dates = [...(cur.dates || [])].sort((a, b) => b.localeCompare(a));
      const lastDate = dates[0] || null;
      const prevDate = dates[1] || null;
      return {
        donor,
        total: cur?.total ?? 0,
        lastDate,
        prevDate,
        thisMonth: cur?.thisMonth ?? 0,
      } as DonorStat;
    });
  }, [donors, offerings]);

  const filtered = useMemo(() => {
    let list = [...donorStats];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(s => s.donor.name.toLowerCase().includes(q));
    }
    list = [...list].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "name") cmp = (a.donor.name || "").localeCompare(b.donor.name || "");
      else if (sortKey === "total") cmp = a.total - b.total;
      else if (sortKey === "lastDate") cmp = (a.lastDate || "").localeCompare(b.lastDate || "");
      else if (sortKey === "prevDate") cmp = (a.prevDate || "").localeCompare(b.prevDate || "");
      else if (sortKey === "thisMonth") cmp = a.thisMonth - b.thisMonth;
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [donorStats, search, sortKey, sortDir]);

  const paginatedFiltered = useMemo(() => filtered.slice((currentPage - 1) * 10, currentPage * 10), [filtered, currentPage]);

  const toggleSort = (key: typeof sortKey) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  };

  const Th = ({ label, keyName, align = "left" }: { label: string; keyName: typeof sortKey; align?: "left" | "right" | "center" }) => (
    <th style={{ padding: "12px 16px", textAlign: align, fontWeight: 600, color: C.navy, fontSize: 13, borderBottom: `1px solid ${C.border}`, whiteSpace: "nowrap", cursor: "pointer" }} onClick={() => toggleSort(keyName)}>
      {label} {sortKey === keyName ? (sortDir === "asc" ? "↑" : "↓") : ""}
    </th>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ position: "relative" }}>
          <div style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }}><Icons.Search /></div>
          <input value={search} onChange={e => { setSearch(e.target.value); setCurrentPage(1); }} placeholder="이름 검색..."
            style={{ padding: "10px 14px 10px 36px", borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 14, fontFamily: "inherit", outline: "none", width: 200 }} />
        </div>
      </div>

      <div ref={listRef}><Card style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ background: C.bg }}>
                <Th label="교인" keyName="name" />
                <Th label="누적 총액" keyName="total" align="right" />
                <Th label="최근 헌금일" keyName="lastDate" align="center" />
                <Th label="이전 헌금일" keyName="prevDate" align="center" />
                <Th label="이번 달" keyName="thisMonth" align="right" />
              </tr>
            </thead>
            <tbody>
              {paginatedFiltered.map((s, i) => (
                <tr
                  key={s.donor.id}
                  style={{
                    borderBottom: i < paginatedFiltered.length - 1 ? `1px solid ${C.borderLight}` : "none",
                    background: "transparent",
                  }}
                >
                  <td style={{ padding: "12px 16px", minWidth: 90 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: "50%", overflow: "hidden", flexShrink: 0,
                        background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: C.textMuted,
                      }}>
                        {s.donor.photoUrl ? <img src={s.donor.photoUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : s.donor.name.charAt(0)}
                      </div>
                      <span style={{ fontWeight: 600, color: C.navy, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display: "block", minWidth: 0 }}>{s.donor.name}</span>
                    </div>
                  </td>
                  <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: 600, color: C.accent }}>₩{fmt(s.total)}</td>
                  <td style={{ padding: "12px 16px", textAlign: "center" }}>{s.lastDate || "-"}</td>
                  <td style={{ padding: "12px 16px", textAlign: "center", color: C.textMuted }}>{s.prevDate || "-"}</td>
                  <td style={{ padding: "12px 16px", textAlign: "right" }}>₩{fmt(s.thisMonth)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && <div style={{ padding: 40, textAlign: "center", color: C.textMuted }}>조건에 맞는 교인이 없습니다</div>}
        {filtered.length > 0 && (
          <Pagination totalItems={filtered.length} itemsPerPage={10} currentPage={currentPage} onPageChange={(p) => { setCurrentPage(p); listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }} />
        )}
      </Card></div>
    </div>
  );
}

/* ====== 지출 관리 ====== */
function ExpenseTab({ expenses, setExpenses, departments, expenseCategories, onAddExpense }: {
  expenses: Expense[]; setExpenses: React.Dispatch<React.SetStateAction<Expense[]>>;
  departments: Department[]; expenseCategories: ExpCategory[];
  onAddExpense?: (e: Omit<Expense, "id">) => Promise<string | null>;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [showAdd, setShowAdd] = useState(false);
  const [filterDept, setFilterDept] = useState("all");
  const [filterMonth, setFilterMonth] = useState("all");
  const [form, setForm] = useState({ categoryId: "salary", departmentId: "admin", amount: "", date: todayStr(), description: "", receipt: true, note: "" });

  const filtered = useMemo(() => {
    let result = [...expenses];
    if (filterDept !== "all") result = result.filter(e => e.departmentId === filterDept);
    if (filterMonth !== "all") result = result.filter(e => e.date.split("-")[1] === filterMonth);
    return result.sort((a, b) => b.date.localeCompare(a.date));
  }, [expenses, filterDept, filterMonth]);

  const filteredTotal = filtered.reduce((s, e) => s + e.amount, 0);

  const handleAdd = async () => {
    if (!form.amount) return;
    const newExpense: Omit<Expense, "id"> = {
      categoryId: form.categoryId,
      departmentId: form.departmentId,
      amount: parseInt(form.amount),
      date: form.date,
      description: form.description,
      receipt: form.receipt,
      note: form.note,
    };
    if (onAddExpense) {
      const id = await onAddExpense(newExpense);
      if (id) {
        setForm({ categoryId: "salary", departmentId: "admin", amount: "", date: todayStr(), description: "", receipt: true, note: "" });
        setShowAdd(false);
      }
    } else {
      setExpenses(prev => [...prev, { id: uid(), ...newExpense }]);
      setForm({ categoryId: "salary", departmentId: "admin", amount: "", date: todayStr(), description: "", receipt: true, note: "" });
      setShowAdd(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Select options={[{ value: "all", label: "전체 부서" }, ...departments.map(d => ({ value: d.id, label: d.name }))]}
            value={filterDept} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => { setFilterDept(e.target.value); setCurrentPage(1); }} />
          <Select options={[{ value: "all", label: "전체 월" }, ...MONTHS.map((m, i) => ({ value: String(i+1).padStart(2,"0"), label: m }))]}
            value={filterMonth} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => { setFilterMonth(e.target.value); setCurrentPage(1); }} />
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <Badge color={C.danger}>합계: ₩{fmt(filteredTotal)}</Badge>
          <Button onClick={() => setShowAdd(true)} variant="accent" icon={<Icons.Plus />}>지출 등록</Button>
        </div>
      </div>
      <div ref={listRef}>
      <Table
        columns={[
          { label: "날짜", key: "date" },
          { label: "부서", render: (r) => { const d = departments.find(x => x.id === r.departmentId); return d ? <Badge color={d.color}>{d.name}</Badge> : <span>{r.departmentId as string}</span>; }},
          { label: "항목", render: (r) => { const c = expenseCategories.find(x => x.id === r.categoryId); return c ? <span>{c.icon} {c.name}</span> : <span>{r.categoryId as string}</span>; }},
          { label: "내용", key: "description" },
          { label: "영수증", align: "center", render: (r) => <span>{r.receipt ? "✅" : "❌"}</span> },
          { label: "금액", align: "right", render: (r) => <span style={{ fontWeight: 700, color: C.danger }}>₩{fmt(r.amount as number)}</span> },
        ]}
        data={filtered.slice((currentPage - 1) * 10, currentPage * 10) as unknown as Record<string, unknown>[]}
      />
      <Pagination totalItems={filtered.length} itemsPerPage={10} currentPage={currentPage} onPageChange={(p) => { setCurrentPage(p); listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }} />
      </div>
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="지출 등록">
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Select label="부서" value={form.departmentId} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setForm(f => ({ ...f, departmentId: e.target.value }))}
            options={departments.map(d => ({ value: d.id, label: d.name }))} />
          <Select label="지출 항목" value={form.categoryId} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setForm(f => ({ ...f, categoryId: e.target.value }))}
            options={expenseCategories.map(c => ({ value: c.id, label: `${c.icon} ${c.name}` }))} />
          <Input label="금액 (원)" type="number" value={form.amount} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="500000" />
          <CalendarDropdown label="날짜" value={form.date} onChange={(v) => setForm(f => ({ ...f, date: v }))} />
          <Input label="내용" value={form.description} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, description: e.target.value }))} placeholder="지출 내용" />
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input type="checkbox" checked={form.receipt} onChange={e => setForm(f => ({ ...f, receipt: e.target.checked }))}
              style={{ width: 18, height: 18, accentColor: C.accent }} />
            <label style={{ fontSize: 14, color: C.navy }}>영수증 있음</label>
          </div>
          <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 8 }}>
            <Button variant="ghost" onClick={() => setShowAdd(false)}>취소</Button>
            <Button variant="accent" onClick={handleAdd}>등록</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

/* ====== 월별 결산 보고서 모달 ====== */
function SettlementReportModal({ open, onClose, offerings, expenses, categories, expenseCategories, churchName = "교회" }: {
  open: boolean; onClose: () => void; offerings: Offering[]; expenses: Expense[];
  categories: Category[]; expenseCategories: ExpCategory[]; churchName?: string;
}) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [pageIncome, setPageIncome] = useState(1);
  const [pageExpense, setPageExpense] = useState(1);

  const data = useMemo(() => {
    const y = year;
    const m = month;
    const monthStr = String(m).padStart(2, "0");
    const offInMonth = offerings.filter(o => o.date.startsWith(`${y}-${monthStr}`));
    const expInMonth = expenses.filter(e => e.date.startsWith(`${y}-${monthStr}`));
    let prevCarry = 0;
    offerings.forEach(o => { if (o.date < `${y}-${monthStr}-01`) prevCarry += o.amount; });
    expenses.forEach(e => { if (e.date < `${y}-${monthStr}-01`) prevCarry -= e.amount; });
    const incomeByCat = categories.map(c => ({ name: c.name, amount: offInMonth.filter(o => o.categoryId === c.id).reduce((s, o) => s + o.amount, 0), icon: c.icon })).filter(x => x.amount > 0);
    const incomeTotal = offInMonth.reduce((s, o) => s + o.amount, 0);
    const expenseByCat = expenseCategories.map(c => ({ name: c.name, amount: expInMonth.filter(e => e.categoryId === c.id).reduce((s, e) => s + e.amount, 0), icon: c.icon })).filter(x => x.amount > 0);
    const expenseTotal = expInMonth.reduce((s, e) => s + e.amount, 0);
    const balance = prevCarry + incomeTotal - expenseTotal;
    return { prevCarry, incomeByCat, incomeTotal, expenseByCat, expenseTotal, balance };
  }, [offerings, expenses, categories, expenseCategories, year, month]);

  const paginatedIncome = useMemo(() => data.incomeByCat.slice((pageIncome - 1) * 10, pageIncome * 10), [data.incomeByCat, pageIncome]);
  const paginatedExpense = useMemo(() => data.expenseByCat.slice((pageExpense - 1) * 10, pageExpense * 10), [data.expenseByCat, pageExpense]);

  const handleSaveImage = async () => {
    try {
      const { toPng } = await import("html-to-image");
      const el = document.getElementById("settlement-report-card");
      if (!el) return;
      const dataUrl = await toPng(el, { pixelRatio: 2, backgroundColor: "#ffffff" });
      const a = document.createElement("a"); a.href = dataUrl; a.download = `결산보고서_${year}년_${month}월.png`; a.click();
    } catch (e) {
      console.error(e);
    }
  };

  const handleShare = async () => {
    const text = `${churchName} ${year}년 ${month}월 결산\n수입: ₩${fmt(data.incomeTotal)}\n지출: ₩${fmt(data.expenseTotal)}\n잔액: ₩${fmt(data.balance)}`;
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: `${churchName} 결산 보고서`, text });
      } catch (err) {
        if ((err as Error).name !== "AbortError") navigator.clipboard?.writeText(text);
      }
    } else if (navigator.clipboard) navigator.clipboard.writeText(text);
  };

  if (!open) return null;
  return (
    <Modal open={open} onClose={onClose} title="월별 결산 보고서" width={560}>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <Select label="년" options={[{ value: year.toString(), label: `${year}년` }, { value: (year - 1).toString(), label: `${year - 1}년` }, { value: (year - 2).toString(), label: `${year - 2}년` }]} value={String(year)} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => { setYear(Number(e.target.value)); setPageIncome(1); setPageExpense(1); }} />
          <Select label="월" options={MONTHS.map((_, i) => ({ value: (i + 1).toString(), label: `${i + 1}월` }))} value={String(month)} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => { setMonth(Number(e.target.value)); setPageIncome(1); setPageExpense(1); }} />
        </div>
        <div id="settlement-report-card" style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 24, boxShadow: "0 4px 20px rgba(0,0,0,0.06)" }}>
          <div style={{ textAlign: "center", marginBottom: 20 }}>
            <h3 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: C.navy }}>{churchName}</h3>
            <p style={{ margin: "4px 0 0", fontSize: 15, color: C.textMuted }}>{year}년 {month}월 결산</p>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <tbody>
              <tr><td style={{ padding: "8px 0", color: C.textMuted }}>전월 이월금</td><td style={{ padding: "8px 0", textAlign: "right", fontWeight: 600 }}>₩{fmt(data.prevCarry)}</td></tr>
              <tr><td colSpan={2} style={{ padding: "4px 0", borderTop: `1px solid ${C.border}`, fontSize: 12, color: C.textMuted }}>수입 항목별</td></tr>
              {paginatedIncome.map(c => (
                <tr key={c.name}><td style={{ padding: "4px 0 4px 16px" }}>{c.icon} {c.name}</td><td style={{ padding: "4px 0", textAlign: "right" }}>₩{fmt(c.amount)}</td></tr>
              ))}
              {data.incomeByCat.length > 10 && <tr><td colSpan={2} style={{ padding: 8 }}><Pagination totalItems={data.incomeByCat.length} itemsPerPage={10} currentPage={pageIncome} onPageChange={setPageIncome} /></td></tr>}
              <tr><td style={{ padding: "8px 0", fontWeight: 600, color: C.navy }}>수입 소계</td><td style={{ padding: "8px 0", textAlign: "right", fontWeight: 700, color: C.accent }}>₩{fmt(data.incomeTotal)}</td></tr>
              <tr><td colSpan={2} style={{ padding: "4px 0", borderTop: `1px solid ${C.border}`, fontSize: 12, color: C.textMuted }}>지출 항목별</td></tr>
              {paginatedExpense.map(c => (
                <tr key={c.name}><td style={{ padding: "4px 0 4px 16px" }}>{c.icon} {c.name}</td><td style={{ padding: "4px 0", textAlign: "right" }}>₩{fmt(c.amount)}</td></tr>
              ))}
              {data.expenseByCat.length > 10 && <tr><td colSpan={2} style={{ padding: 8 }}><Pagination totalItems={data.expenseByCat.length} itemsPerPage={10} currentPage={pageExpense} onPageChange={setPageExpense} /></td></tr>}
              <tr><td style={{ padding: "8px 0", fontWeight: 600, color: C.navy }}>지출 소계</td><td style={{ padding: "8px 0", textAlign: "right", fontWeight: 700, color: C.danger }}>₩{fmt(data.expenseTotal)}</td></tr>
              <tr><td colSpan={2} style={{ padding: "8px 0", borderTop: `2px solid ${C.border}` }}></td></tr>
              <tr><td style={{ padding: "8px 0", fontWeight: 700, color: C.navy }}>잔액</td><td style={{ padding: "8px 0", textAlign: "right", fontWeight: 800, color: data.balance >= 0 ? C.success : C.danger }}>₩{fmt(data.balance)}</td></tr>
              <tr><td style={{ padding: "4px 0", fontSize: 12, color: C.textMuted }}>차월 이월금</td><td style={{ padding: "4px 0", textAlign: "right", fontWeight: 600 }}>₩{fmt(data.balance)}</td></tr>
            </tbody>
          </table>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Button onClick={handleSaveImage} variant="accent">이미지로 저장</Button>
          <Button onClick={handleShare} variant="soft">카카오톡 공유</Button>
          <Button onClick={() => window.print()} variant="ghost">PDF / 인쇄</Button>
          <Button variant="ghost" onClick={onClose}>닫기</Button>
        </div>
      </div>
    </Modal>
  );
}

/* ====== 보고서 ====== */
function ReportTab({ offerings, expenses, categories, departments, expenseCategories }: {
  offerings: Offering[]; expenses: Expense[]; categories: Category[];
  departments: Department[]; expenseCategories: ExpCategory[];
}) {
  const [reportType, setReportType] = useState("monthly");
  const [selectedPeriod, setSelectedPeriod] = useState("01");
  const [showSettlement, setShowSettlement] = useState(false);

  const periodOptions = useMemo(() => {
    if (reportType === "weekly") { const w = []; for (let i = 1; i <= 52; i++) w.push({ value: String(i), label: `${i}주차` }); return w; }
    if (reportType === "monthly") return MONTHS.map((m, i) => ({ value: String(i+1).padStart(2,"0"), label: m }));
    if (reportType === "quarterly") return QUARTERS.map((q, i) => ({ value: String(i), label: q }));
    if (reportType === "half") return HALVES.map((h, i) => ({ value: String(i), label: h }));
    return [{ value: "2025", label: "2025년" }];
  }, [reportType]);

  const reportData = useMemo(() => {
    let filteredOff = [...offerings];
    let filteredExp = [...expenses];
    if (reportType === "monthly") {
      filteredOff = filteredOff.filter(o => o.date.split("-")[1] === selectedPeriod);
      filteredExp = filteredExp.filter(e => e.date.split("-")[1] === selectedPeriod);
    } else if (reportType === "quarterly") {
      const q = parseInt(selectedPeriod); const startM = q * 3 + 1; const endM = startM + 2;
      filteredOff = filteredOff.filter(o => { const m = parseInt(o.date.split("-")[1]); return m >= startM && m <= endM; });
      filteredExp = filteredExp.filter(e => { const m = parseInt(e.date.split("-")[1]); return m >= startM && m <= endM; });
    } else if (reportType === "half") {
      const h = parseInt(selectedPeriod); const startM = h * 6 + 1; const endM = startM + 5;
      filteredOff = filteredOff.filter(o => { const m = parseInt(o.date.split("-")[1]); return m >= startM && m <= endM; });
      filteredExp = filteredExp.filter(e => { const m = parseInt(e.date.split("-")[1]); return m >= startM && m <= endM; });
    } else if (reportType === "weekly") {
      const weekNum = parseInt(selectedPeriod);
      const startDate = new Date(2025, 0, 1 + (weekNum - 1) * 7);
      const endDate = new Date(startDate); endDate.setDate(endDate.getDate() + 6);
      const s = startDate.toISOString().slice(0,10); const e2 = endDate.toISOString().slice(0,10);
      filteredOff = filteredOff.filter(o => o.date >= s && o.date <= e2);
      filteredExp = filteredExp.filter(e => e.date >= s && e.date <= e2);
    }
    const totalOff = filteredOff.reduce((s, o) => s + o.amount, 0);
    const totalExp = filteredExp.reduce((s, e) => s + e.amount, 0);
    const catMap: Record<string, number> = {};
    filteredOff.forEach(o => { catMap[o.categoryId] = (catMap[o.categoryId] || 0) + o.amount; });
    const catBreakdown = categories.map(c => ({ name: `${c.icon} ${c.name}`, total: catMap[c.id] || 0, pct: totalOff > 0 ? ((catMap[c.id] || 0) / totalOff * 100).toFixed(1) : "0.0" })).filter(c => c.total > 0).sort((a, b) => b.total - a.total);
    const deptMap: Record<string, number> = {};
    filteredExp.forEach(e => { deptMap[e.departmentId] = (deptMap[e.departmentId] || 0) + e.amount; });
    const deptBreakdown = departments.map(d => ({ name: d.name, total: deptMap[d.id] || 0, pct: totalExp > 0 ? ((deptMap[d.id] || 0) / totalExp * 100).toFixed(1) : "0.0" })).filter(d => d.total > 0).sort((a, b) => b.total - a.total);
    const expCatMap: Record<string, number> = {};
    filteredExp.forEach(e => { expCatMap[e.categoryId] = (expCatMap[e.categoryId] || 0) + e.amount; });
    const expCatBreakdown = expenseCategories.map(c => ({ name: `${c.icon} ${c.name}`, total: expCatMap[c.id] || 0, pct: totalExp > 0 ? ((expCatMap[c.id] || 0) / totalExp * 100).toFixed(1) : "0.0" })).filter(c => c.total > 0).sort((a, b) => b.total - a.total);
    return { totalOff, totalExp, balance: totalOff - totalExp, catBreakdown, deptBreakdown, expCatBreakdown };
  }, [offerings, expenses, categories, departments, expenseCategories, reportType, selectedPeriod]);

  const mob = useIsMobile();
  const reportTypeLabel: Record<string, string> = { weekly: "주간", monthly: "월간", quarterly: "분기", half: "반기", annual: "연간" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
        <Button onClick={() => setShowSettlement(true)} icon={<Icons.Report />}>결산 보고서</Button>
      </div>
      <Card>
        <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontWeight: 600, color: C.navy }}>보고서 유형:</span>
          {["weekly","monthly","quarterly","half","annual"].map(t => (
            <button key={t} onClick={() => { setReportType(t); setSelectedPeriod(t === "monthly" ? "01" : "0"); }}
              style={{ padding: "8px 18px", borderRadius: 10, border: "none", background: reportType === t ? C.navy : C.bg, color: reportType === t ? "#fff" : C.navy, fontWeight: 600, fontSize: 14, cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s" }}>
              {reportTypeLabel[t]}
            </button>
          ))}
          {reportType !== "annual" && (
            <Select options={periodOptions} value={selectedPeriod} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedPeriod(e.target.value)} />
          )}
        </div>
      </Card>
      <div style={{ display: "grid", gridTemplateColumns: mob ? "1fr" : "repeat(3, 1fr)", gap: 16 }}>
        <StatCard label="수입 합계" value={`₩${fmt(reportData.totalOff)}`} color={C.accent} />
        <StatCard label="지출 합계" value={`₩${fmt(reportData.totalExp)}`} color={C.danger} />
        <StatCard label="잔액" value={`₩${fmt(reportData.balance)}`} color={reportData.balance >= 0 ? C.success : C.danger} trend={reportData.balance >= 0 ? "up" : "down"} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: mob ? "1fr" : "1fr 1fr", gap: 16 }}>
        <Card>
          <h4 style={{ margin: "0 0 16px", color: C.navy }}>헌금 항목별 보고</h4>
          <Table columns={[
            { label: "항목", key: "name" },
            { label: "비율", render: (r) => <span>{r.pct as string}%</span> },
            { label: "금액", align: "right", render: (r) => <span style={{ fontWeight: 700 }}>₩{fmt(r.total as number)}</span> },
          ]} data={reportData.catBreakdown as unknown as Record<string, unknown>[]} />
        </Card>
        <Card>
          <h4 style={{ margin: "0 0 16px", color: C.navy }}>지출 항목별 보고</h4>
          <Table columns={[
            { label: "항목", key: "name" },
            { label: "비율", render: (r) => <span>{r.pct as string}%</span> },
            { label: "금액", align: "right", render: (r) => <span style={{ fontWeight: 700 }}>₩{fmt(r.total as number)}</span> },
          ]} data={reportData.expCatBreakdown as unknown as Record<string, unknown>[]} />
        </Card>
      </div>
      <Card>
        <h4 style={{ margin: "0 0 16px", color: C.navy }}>부서별 지출 보고</h4>
        <Table columns={[
          { label: "부서", key: "name" },
          { label: "비율", render: (r) => <span>{r.pct as string}%</span> },
          { label: "금액", align: "right", render: (r) => <span style={{ fontWeight: 700 }}>₩{fmt(r.total as number)}</span> },
        ]} data={reportData.deptBreakdown as unknown as Record<string, unknown>[]} />
      </Card>
      <SettlementReportModal open={showSettlement} onClose={() => setShowSettlement(false)} offerings={offerings} expenses={expenses} categories={categories} expenseCategories={expenseCategories} />
    </div>
  );
}

/* ====== 예결산 (예산 vs 실적) ====== */
function BudgetActualTab({
  offerings,
  expenses,
  categories,
  expenseCategories,
  budgetByYear,
  setBudgetByYear,
}: {
  offerings: Offering[];
  expenses: Expense[];
  categories: Category[];
  expenseCategories: ExpCategory[];
  budgetByYear: BudgetByYear;
  setBudgetByYear: React.Dispatch<React.SetStateAction<BudgetByYear>>;
}) {
  const mob = useIsMobile();
  const listRefCompare = useRef<HTMLDivElement>(null);
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [mode, setMode] = useState<"input" | "compare">("compare");
  const [currentPageCompare, setCurrentPageCompare] = useState(1);
  const reportCardRef = useRef<HTMLDivElement>(null);

  const yearStr = String(year);

  const incomeCategories = useMemo(() => {
    const used = new Set(offerings.map(o => o.categoryId));
    const byId = new Map(categories.map(c => [c.id, c]));
    const result = [...categories.filter(c => BUDGET_INCOME_IDS.includes(c.id as typeof BUDGET_INCOME_IDS[number]))];
    BUDGET_INCOME_IDS.forEach(id => { if (!byId.has(id)) result.push({ id, name: id, color: C.textMuted, icon: "📋" }); });
    used.forEach(id => { if (!result.some(c => c.id === id)) result.push(byId.get(id) || { id, name: id, color: C.textMuted, icon: "📋" }); });
    return result;
  }, [offerings, categories]);

  const expenseCategoriesList = useMemo(() => {
    const used = new Set(expenses.map(e => e.categoryId));
    const byId = new Map(expenseCategories.map(c => [c.id, c]));
    const result = [...expenseCategories.filter(c => BUDGET_EXPENSE_IDS.includes(c.id as typeof BUDGET_EXPENSE_IDS[number]))];
    BUDGET_EXPENSE_IDS.forEach(id => { if (!byId.has(id)) result.push({ id, name: id, icon: "📋" }); });
    used.forEach(id => { if (!result.some(c => c.id === id)) result.push(byId.get(id) || { id, name: id, icon: "📋" }); });
    return result;
  }, [expenses, expenseCategories]);

  const actuals = useMemo(() => {
    const income: Record<string, number> = {};
    const expense: Record<string, number> = {};
    offerings.filter(o => o.date.startsWith(yearStr)).forEach(o => { income[o.categoryId] = (income[o.categoryId] || 0) + o.amount; });
    expenses.filter(e => e.date.startsWith(yearStr)).forEach(e => { expense[e.categoryId] = (expense[e.categoryId] || 0) + e.amount; });
    return { income, expense };
  }, [offerings, expenses, yearStr]);

  const budgets = budgetByYear[yearStr] || { income: {}, expense: {} };

  const saveBudget = (type: "income" | "expense", categoryId: string, value: number) => {
    setBudgetByYear(prev => ({
      ...prev,
      [yearStr]: {
        income: type === "income" ? { ...(prev[yearStr]?.income || {}), [categoryId]: value } : (prev[yearStr]?.income || {}),
        expense: type === "expense" ? { ...(prev[yearStr]?.expense || {}), [categoryId]: value } : (prev[yearStr]?.expense || {}),
      },
    }));
  };

  const compareRows = useMemo(() => {
    const incomeRows = incomeCategories.map(c => {
      const bud = budgets.income[c.id] || 0;
      const act = actuals.income[c.id] || 0;
      const diff = bud - act;
      const pct = bud > 0 ? Math.round((act / bud) * 100) : (act > 0 ? 100 : 0);
      return { type: "수입" as const, name: c.name, budget: bud, actual: act, diff, pct, id: c.id };
    });
    const expenseRows = expenseCategoriesList.map(c => {
      const bud = budgets.expense[c.id] || 0;
      const act = actuals.expense[c.id] || 0;
      const diff = bud - act;
      const pct = bud > 0 ? Math.round((act / bud) * 100) : (act > 0 ? 100 : 0);
      return { type: "지출" as const, name: c.name, budget: bud, actual: act, diff, pct, id: c.id };
    });
    const incBud = incomeRows.reduce((s, r) => s + r.budget, 0);
    const incAct = incomeRows.reduce((s, r) => s + r.actual, 0);
    const expBud = expenseRows.reduce((s, r) => s + r.budget, 0);
    const expAct = expenseRows.reduce((s, r) => s + r.actual, 0);
    const incomeTotal = { type: "수입" as const, name: "수입 합계", budget: incBud, actual: incAct, diff: incBud - incAct, pct: incBud > 0 ? Math.round((incAct / incBud) * 100) : 0, id: "_incomeTotal" };
    const expenseTotal = { type: "지출" as const, name: "지출 합계", budget: expBud, actual: expAct, diff: expBud - expAct, pct: expBud > 0 ? Math.round((expAct / expBud) * 100) : 0, id: "_expenseTotal" };
    const balance = { type: "수입" as const, name: "최종 잔액 (수입-지출)", budget: incBud - expBud, actual: incAct - expAct, diff: (incBud - expBud) - (incAct - expAct), pct: 0, id: "_balance" };
    return [...incomeRows, incomeTotal, ...expenseRows, expenseTotal, balance];
  }, [incomeCategories, expenseCategoriesList, budgets, actuals]);

  const paginatedCompareRows = useMemo(() => compareRows.slice((currentPageCompare - 1) * 10, currentPageCompare * 10), [compareRows, currentPageCompare]);

  const chartData = useMemo(() => {
    const items: { name: string; 예산: number; 실적: number; type: string }[] = [];
    incomeCategories.forEach(c => {
      items.push({ name: c.name, 예산: budgets.income[c.id] || 0, 실적: actuals.income[c.id] || 0, type: "수입" });
    });
    expenseCategoriesList.forEach(c => {
      items.push({ name: c.name, 예산: budgets.expense[c.id] || 0, 실적: actuals.expense[c.id] || 0, type: "지출" });
    });
    return items.filter(i => i.예산 > 0 || i.실적 > 0);
  }, [incomeCategories, expenseCategoriesList, budgets, actuals]);

  const handleSaveImage = async () => {
    try {
      const { toPng } = await import("html-to-image");
      const el = document.getElementById("budget-actual-report-card");
      if (!el) return;
      const dataUrl = await toPng(el, { pixelRatio: 2, backgroundColor: "#ffffff" });
      const a = document.createElement("a"); a.href = dataUrl; a.download = `예결산_${year}년.png`; a.click();
    } catch (e) {
      console.error(e);
    }
  };

  const handleShare = async () => {
    const incomeTotal = compareRows.find(r => r.id === "_incomeTotal");
    const expenseTotal = compareRows.find(r => r.id === "_expenseTotal");
    const text = `${year}년 예결산\n수입 예산/실적: ₩${fmt(incomeTotal?.budget || 0)} / ₩${fmt(incomeTotal?.actual || 0)}\n지출 예산/실적: ₩${fmt(expenseTotal?.budget || 0)} / ₩${fmt(expenseTotal?.actual || 0)}`;
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: `${year}년 예결산 보고서`, text });
      } catch (err) {
        if ((err as Error).name !== "AbortError") navigator.clipboard?.writeText(text);
      }
    } else if (navigator.clipboard) navigator.clipboard.writeText(text);
  };

  const pctColor = (pct: number, isExpense: boolean) => {
    if (pct === 0) return C.textMuted;
    if (isExpense) {
      if (pct < 80) return C.success;
      if (pct <= 100) return C.warning;
      return C.danger;
    }
    if (pct < 80) return C.danger;
    if (pct <= 100) return C.warning;
    return C.success;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
        <Select label="연도" options={[{ value: currentYear.toString(), label: `${currentYear}년` }, { value: (currentYear - 1).toString(), label: `${currentYear - 1}년` }, { value: (currentYear - 2).toString(), label: `${currentYear - 2}년` }]} value={String(year)} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => { setYear(Number(e.target.value)); setCurrentPageCompare(1); }} />
        <div style={{ display: "flex", gap: 4, background: C.bg, borderRadius: 10, padding: 4 }}>
          {(["input", "compare"] as const).map(m => (
            <button key={m} type="button" onClick={() => setMode(m)} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: mode === m ? C.navy : "transparent", color: mode === m ? "#fff" : C.textMuted, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
              {m === "input" ? "예산 입력" : "비교 뷰"}
            </button>
          ))}
        </div>
      </div>

      {mode === "input" && (
        <Card>
          <h4 style={{ margin: "0 0 16px", color: C.navy }}>수입 항목 예산 ({year}년)</h4>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {incomeCategories.map(c => (
              <BudgetInputRow key={c.id} label={`${c.icon} ${c.name}`} value={budgets.income[c.id] ?? ""} onSave={v => saveBudget("income", c.id, v)} />
            ))}
          </div>
          <h4 style={{ margin: "24px 0 16px", color: C.navy }}>지출 항목 예산 ({year}년)</h4>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {expenseCategoriesList.map(c => (
              <BudgetInputRow key={c.id} label={`${c.icon} ${c.name}`} value={budgets.expense[c.id] ?? ""} onSave={v => saveBudget("expense", c.id, v)} />
            ))}
          </div>
        </Card>
      )}

      {mode === "compare" && (
        <>
          <div ref={listRefCompare}><div id="budget-actual-report-card" ref={reportCardRef} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 24, boxShadow: "0 4px 20px rgba(0,0,0,0.06)" }}>
            <h3 style={{ margin: "0 0 20px", fontSize: 18, fontWeight: 700, color: C.navy }}>{year}년 예산 vs 실적</h3>
            <div style={{ overflowX: "auto", marginBottom: 24 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                <thead>
                  <tr style={{ background: C.bg }}>
                    <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: 600, color: C.navy }}>구분</th>
                    <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: 600, color: C.navy }}>항목명</th>
                    <th style={{ padding: "10px 12px", textAlign: "right", fontWeight: 600, color: C.navy }}>예산</th>
                    <th style={{ padding: "10px 12px", textAlign: "right", fontWeight: 600, color: C.navy }}>실적</th>
                    <th style={{ padding: "10px 12px", textAlign: "right", fontWeight: 600, color: C.navy }}>차이</th>
                    <th style={{ padding: "10px 12px", textAlign: "right", fontWeight: 600, color: C.navy }}>집행률</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedCompareRows.map((r, i) => (
                    <tr key={r.id} style={{ borderBottom: r.id.startsWith("_") ? `2px solid ${C.border}` : `1px solid ${C.borderLight}`, background: r.id.startsWith("_") ? C.bg : "transparent" }}>
                      <td style={{ padding: "10px 12px" }}>{r.type}</td>
                      <td style={{ padding: "10px 12px", fontWeight: r.id.startsWith("_") ? 700 : 500 }}>{r.name}</td>
                      <td style={{ padding: "10px 12px", textAlign: "right" }}>₩{fmt(r.budget)}</td>
                      <td style={{ padding: "10px 12px", textAlign: "right", color: r.type === "수입" ? C.accent : C.danger }}>₩{fmt(r.actual)}</td>
                      <td style={{ padding: "10px 12px", textAlign: "right" }}>₩{fmt(r.diff)}</td>
                      <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 600, color: r.id.startsWith("_") ? C.navy : pctColor(r.pct, r.type === "지출") }}>{r.pct > 0 ? `${r.pct}%` : "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination totalItems={compareRows.length} itemsPerPage={10} currentPage={currentPageCompare} onPageChange={(p) => { setCurrentPageCompare(p); listRefCompare.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }} />
            {chartData.length > 0 && (
              <div style={{ height: mob ? 280 : 320 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 60 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-35} textAnchor="end" height={60} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v / 10000).toFixed(0)}만`} />
                    <Tooltip formatter={(value) => `₩${fmt(Number(value))}`} />
                    <Legend />
                    <Bar dataKey="예산" fill="#9ca3af" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="실적" radius={[4, 4, 0, 0]}>
                      {chartData.map((entry, index) => (
                        <Cell key={index} fill={entry.type === "수입" ? C.accent : C.danger} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div></div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Button onClick={handleSaveImage} variant="accent">예결산 보고서 이미지 저장</Button>
            <Button onClick={handleShare} variant="soft">카카오톡 공유</Button>
          </div>
        </>
      )}
    </div>
  );
}

function BudgetInputRow({ label, value, onSave }: { label: string; value: number | ""; onSave: (v: number) => void }) {
  const [input, setInput] = useState(value === "" ? "" : String(value));
  useEffect(() => { setInput(value === "" ? "" : String(value)); }, [value]);
  const handleSave = () => {
    const n = parseInt(input, 10);
    if (!Number.isNaN(n) && n >= 0) onSave(n);
  };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
      <span style={{ minWidth: 140, fontWeight: 500, color: C.navy }}>{label}</span>
      <input type="number" value={input} onChange={e => setInput(e.target.value)} placeholder="0" min={0}
        style={{ width: 140, padding: "8px 12px", borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 14, fontFamily: "inherit" }} />
      <Button size="sm" onClick={handleSave}>저장</Button>
    </div>
  );
}

/* ====== 예산 관리 ====== */
function BudgetTab({ departments, expenses }: { departments: Department[]; expenses: Expense[] }) {
  const [year, setYear] = useState("2026");
  const [budgets, setBudgets] = useState<Record<string, Record<string, string>>>(() => {
    const b: Record<string, Record<string, string>> = {};
    departments.forEach(d => { b[d.id] = { q1: "", q2: "", q3: "", q4: "" }; });
    return b;
  });

  const actualByDept = useMemo(() => {
    const map: Record<string, number> = {};
    expenses.forEach(e => { map[e.departmentId] = (map[e.departmentId] || 0) + e.amount; });
    return map;
  }, [expenses]);

  const handleBudgetChange = (deptId: string, quarter: string, value: string) => {
    setBudgets(prev => ({ ...prev, [deptId]: { ...prev[deptId], [quarter]: value } }));
  };

  const totalBudget = departments.reduce((sum, d) => {
    const b = budgets[d.id] || {};
    return sum + (parseInt(b.q1) || 0) + (parseInt(b.q2) || 0) + (parseInt(b.q3) || 0) + (parseInt(b.q4) || 0);
  }, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <h3 style={{ margin: 0, color: C.navy }}>{year}년 예산 계획</h3>
          <Select options={[{ value: "2026", label: "2026년" }, { value: "2027", label: "2027년" }]} value={year} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setYear(e.target.value)} />
        </div>
        <Badge color={C.accent}>총 예산: ₩{fmt(totalBudget)}</Badge>
      </div>
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ background: C.bg }}>
                {["부서","전년 실적","1분기 예산","2분기 예산","3분기 예산","4분기 예산","연간 합계"].map((h,i) => (
                  <th key={i} style={{ padding: "14px 16px", textAlign: i === 0 ? "left" : (i === 1 || i === 6) ? "right" : "center", fontWeight: 600, color: C.navy, borderBottom: `1px solid ${C.border}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {departments.map((d, i) => {
                const b = budgets[d.id] || {};
                const annual = (parseInt(b.q1) || 0) + (parseInt(b.q2) || 0) + (parseInt(b.q3) || 0) + (parseInt(b.q4) || 0);
                return (
                  <tr key={d.id} style={{ borderBottom: i < departments.length - 1 ? `1px solid ${C.borderLight}` : "none" }}>
                    <td style={{ padding: "12px 16px", minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                        <div style={{ width: 8, height: 8, borderRadius: 4, background: d.color, flexShrink: 0 }} />
                        <span style={{ fontWeight: 600, color: C.navy, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.name}</span>
                      </div>
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "right", color: C.textMuted }}>₩{fmt(actualByDept[d.id] || 0)}</td>
                    {(["q1","q2","q3","q4"] as const).map(q => (
                      <td key={q} style={{ padding: "8px 10px", textAlign: "center" }}>
                        <input type="number" value={b[q] || ""} placeholder="0"
                          onChange={e => handleBudgetChange(d.id, q, e.target.value)}
                          style={{ width: 110, padding: "8px 10px", borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 13, fontFamily: "inherit", textAlign: "right", outline: "none" }} />
                      </td>
                    ))}
                    <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: 700, color: C.navy }}>₩{fmt(annual)}</td>
                  </tr>
                );
              })}
              <tr style={{ background: C.bg, fontWeight: 700 }}>
                <td style={{ padding: "14px 16px", color: C.navy }}>합계</td>
                <td style={{ padding: "14px 16px", textAlign: "right", color: C.navy }}>₩{fmt(Object.values(actualByDept).reduce((s, v) => s + v, 0))}</td>
                {(["q1","q2","q3","q4"] as const).map(q => {
                  const qTotal = departments.reduce((s, d) => s + (parseInt(budgets[d.id]?.[q]) || 0), 0);
                  return <td key={q} style={{ padding: "14px 16px", textAlign: "center", color: C.navy }}>₩{fmt(qTotal)}</td>;
                })}
                <td style={{ padding: "14px 16px", textAlign: "right", color: C.accent, fontSize: 16 }}>₩{fmt(totalBudget)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

/* ====== 엑셀 내보내기 ====== */
function ExportTab({ offerings, expenses, categories, departments, expenseCategories, donors }: {
  offerings: Offering[]; expenses: Expense[]; categories: Category[];
  departments: Department[]; expenseCategories: ExpCategory[]; donors: Donor[];
}) {
  const exportOfferings = () => {
    const data = offerings.map(o => {
      const cat = categories.find(c => c.id === o.categoryId);
      return { "날짜": o.date, "헌금자": o.donorName, "헌금항목": cat?.name || o.categoryId, "헌금방법": o.method, "금액": o.amount, "메모": o.note || "" };
    }).sort((a, b) => a["날짜"].localeCompare(b["날짜"]));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "헌금내역");
    XLSX.writeFile(wb, "헌금내역_2025.xlsx");
  };

  const exportExpenses = () => {
    const data = expenses.map(e => {
      const cat = expenseCategories.find(c => c.id === e.categoryId);
      const dept = departments.find(d => d.id === e.departmentId);
      return { "날짜": e.date, "부서": dept?.name || e.departmentId, "지출항목": cat?.name || e.categoryId, "내용": e.description, "영수증": e.receipt ? "있음" : "없음", "금액": e.amount };
    }).sort((a, b) => a["날짜"].localeCompare(b["날짜"]));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "지출내역");
    XLSX.writeFile(wb, "지출내역_2025.xlsx");
  };

  const exportDonors = () => {
    const donorMap: Record<string, { total: number; count: number }> = {};
    offerings.forEach(o => { if (!donorMap[o.donorId]) donorMap[o.donorId] = { total: 0, count: 0 }; donorMap[o.donorId].total += o.amount; donorMap[o.donorId].count++; });
    const data = donors.map(d => ({ "이름": d.name, "연락처": d.phone, "소속": d.group, "등록일": d.joinDate, "헌금횟수": donorMap[d.id]?.count || 0, "헌금합계": donorMap[d.id]?.total || 0, "메모": d.note }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "헌금자목록");
    XLSX.writeFile(wb, "헌금자목록_2025.xlsx");
  };

  const exportMonthlyReport = () => {
    const wb = XLSX.utils.book_new();
    for (let m = 1; m <= 12; m++) {
      const ms = String(m).padStart(2, "0");
      const mOff = offerings.filter(o => o.date.split("-")[1] === ms);
      const mExp = expenses.filter(e => e.date.split("-")[1] === ms);
      const summary: Record<string, string | number>[] = [
        { "구분": "수입 합계", "금액": mOff.reduce((s, o) => s + o.amount, 0) },
        { "구분": "지출 합계", "금액": mExp.reduce((s, e) => s + e.amount, 0) },
        { "구분": "잔액", "금액": mOff.reduce((s, o) => s + o.amount, 0) - mExp.reduce((s, e) => s + e.amount, 0) },
        { "구분": "---", "금액": "" }, { "구분": "[헌금 항목별]", "금액": "" },
      ];
      categories.forEach(c => { const t = mOff.filter(o => o.categoryId === c.id).reduce((s, o) => s + o.amount, 0); if (t > 0) summary.push({ "구분": c.name, "금액": t }); });
      summary.push({ "구분": "---", "금액": "" }, { "구분": "[부서별 지출]", "금액": "" });
      departments.forEach(d => { const t = mExp.filter(e => e.departmentId === d.id).reduce((s, e) => s + e.amount, 0); if (t > 0) summary.push({ "구분": d.name, "금액": t }); });
      const ws = XLSX.utils.json_to_sheet(summary);
      XLSX.utils.book_append_sheet(wb, ws, `${m}월`);
    }
    XLSX.writeFile(wb, "월간보고서_2025.xlsx");
  };

  const exportAnnualReport = () => {
    const wb = XLSX.utils.book_new();
    const annualSummary = MONTHS.map((month, i) => {
      const ms = String(i+1).padStart(2, "0");
      const offT = offerings.filter(o => o.date.split("-")[1] === ms).reduce((s, o) => s + o.amount, 0);
      const expT = expenses.filter(e => e.date.split("-")[1] === ms).reduce((s, e) => s + e.amount, 0);
      return { "월": month, "수입": offT, "지출": expT, "잔액": offT - expT };
    });
    const tOff = offerings.reduce((s, o) => s + o.amount, 0);
    const tExp = expenses.reduce((s, e) => s + e.amount, 0);
    annualSummary.push({ "월": "합계", "수입": tOff, "지출": tExp, "잔액": tOff - tExp });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(annualSummary), "연간요약");

    const catData = categories.map(c => {
      const row: Record<string, string | number> = { "항목": c.name }; let yt = 0;
      for (let m = 1; m <= 12; m++) { const ms = String(m).padStart(2,"0"); const mt = offerings.filter(o => o.categoryId === c.id && o.date.split("-")[1] === ms).reduce((s, o) => s + o.amount, 0); row[`${m}월`] = mt; yt += mt; }
      row["합계"] = yt; return row;
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(catData), "항목별헌금");

    const deptData = departments.map(d => {
      const row: Record<string, string | number> = { "부서": d.name }; let yt = 0;
      for (let m = 1; m <= 12; m++) { const ms = String(m).padStart(2,"0"); const mt = expenses.filter(e => e.departmentId === d.id && e.date.split("-")[1] === ms).reduce((s, e) => s + e.amount, 0); row[`${m}월`] = mt; yt += mt; }
      row["합계"] = yt; return row;
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(deptData), "부서별지출");
    XLSX.writeFile(wb, "연간보고서_2025.xlsx");
  };

  const exports = [
    { icon: "📘", title: "헌금 내역", desc: "전체 헌금 내역을 엑셀로 내보내기", color: C.accent, action: exportOfferings },
    { icon: "💳", title: "지출 내역", desc: "전체 지출 내역을 엑셀로 내보내기", color: C.danger, action: exportExpenses },
    { icon: "👥", title: "헌금자 목록", desc: "헌금자 정보 및 통계를 엑셀로 내보내기", color: C.purple, action: exportDonors },
    { icon: "📊", title: "월간 보고서", desc: "12개월 월별 보고서 (시트별 분리)", color: C.success, action: exportMonthlyReport },
    { icon: "📋", title: "연간 종합 보고서", desc: "연간요약, 항목별, 부서별 종합 보고서", color: C.navy, action: exportAnnualReport },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <Card>
        <p style={{ margin: 0, color: C.textMuted, fontSize: 14 }}>
          원하는 보고서를 클릭하면 엑셀(.xlsx) 파일로 즉시 다운로드됩니다.
          각 보고서는 항목별로 완벽히 분류되어 있어 교회 재정 보고에 바로 활용할 수 있습니다.
        </p>
      </Card>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
        {exports.map((item, i) => (
          <Card key={i} onClick={item.action} style={{ cursor: "pointer", transition: "all 0.2s ease" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{
                width: 52, height: 52, borderRadius: 14, background: `${item.color}12`,
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24,
              }}>{item.icon}</div>
              <div>
                <div style={{ fontWeight: 700, color: C.navy, fontSize: 16, marginBottom: 4 }}>{item.title}</div>
                <div style={{ fontSize: 13, color: C.textMuted }}>{item.desc}</div>
              </div>
              <div style={{ marginLeft: "auto" }}><Icons.Export /></div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

/* ---------- 기부금 영수증 탭: 새 양식용 CSS ---------- */
const RECEIPT_CSS = `
  .receipt-wrapper-r { width: 680px; background: #fff; position: relative; padding: 0; box-shadow: 0 4px 24px rgba(0,0,0,0.08); font-family: 'Noto Sans KR', 'Pretendard', sans-serif; }
  .receipt-header-r { background: linear-gradient(135deg, #1a2a4a 0%, #2c3e6b 100%); padding: 36px 48px 28px; position: relative; overflow: hidden; }
  .receipt-header-r::after { content: ''; position: absolute; bottom: 0; left: 0; right: 0; height: 4px; background: linear-gradient(90deg, #c9a96e, #e8d5a3, #c9a96e); }
  .receipt-header-r::before { content: '✝'; position: absolute; right: 40px; top: 50%; transform: translateY(-50%); font-size: 100px; color: rgba(255,255,255,0.04); font-weight: 300; }
  .header-top-r { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; }
  .doc-type-r { font-size: 11px; color: rgba(255,255,255,0.5); letter-spacing: 1px; }
  .serial-number-r { font-size: 12px; color: rgba(255,255,255,0.6); background: rgba(255,255,255,0.08); padding: 4px 12px; border-radius: 4px; }
  .receipt-title-r { font-size: 32px; font-weight: 700; color: #fff; letter-spacing: 16px; text-align: center; margin-bottom: 4px; }
  .receipt-subtitle-r { text-align: center; font-size: 12px; color: rgba(255,255,255,0.45); letter-spacing: 2px; }
  .receipt-body-r { padding: 32px 48px 40px; }
  .section-r { margin-bottom: 28px; }
  .section-header-r { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; padding-bottom: 8px; border-bottom: 2px solid #1a2a4a; }
  .section-number-r { display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; background: #1a2a4a; color: #fff; font-size: 12px; font-weight: 700; border-radius: 50%; flex-shrink: 0; }
  .section-title-r { font-size: 15px; font-weight: 700; color: #1a2a4a; letter-spacing: 2px; }
  .info-table-r { width: 100%; border-collapse: collapse; }
  .info-table-r tr { border-bottom: 1px solid #eee; }
  .info-table-r tr:last-child { border-bottom: none; }
  .info-table-r th { width: 120px; padding: 10px 16px; text-align: left; font-size: 13px; font-weight: 500; color: #666; background: #fafbfc; border-right: 1px solid #eee; vertical-align: middle; }
  .info-table-r td { padding: 10px 16px; font-size: 14px; font-weight: 500; color: #222; vertical-align: middle; }
  .info-table-r td.amount-r { font-weight: 700; font-size: 16px; color: #1a2a4a; }
  .monthly-table-r { width: 100%; border-collapse: collapse; margin-top: 4px; }
  .monthly-table-r thead th { background: #1a2a4a; color: #fff; padding: 8px 12px; font-size: 12px; font-weight: 600; text-align: center; letter-spacing: 1px; }
  .monthly-table-r thead th:first-child { border-radius: 6px 0 0 0; }
  .monthly-table-r thead th:last-child { border-radius: 0 6px 0 0; }
  .monthly-table-r tbody td { padding: 9px 12px; font-size: 13px; text-align: center; border-bottom: 1px solid #f0f0f0; color: #333; }
  .monthly-table-r tbody tr:nth-child(even) { background: #fafbfc; }
  .monthly-table-r tbody td.month-label-r { font-weight: 600; color: #1a2a4a; width: 60px; }
  .monthly-table-r tbody td.month-amount-r { text-align: right; font-weight: 500; }
  .monthly-table-r tbody td.month-amount-r.has-value-r { color: #1a2a4a; font-weight: 600; }
  .monthly-table-r tbody td.month-amount-r.zero-r { color: #ccc; }
  .monthly-table-r tfoot td { padding: 12px; font-size: 15px; font-weight: 700; border-top: 2px solid #1a2a4a; background: #f5f6f8; }
  .monthly-table-r tfoot td.total-label-r { text-align: center; color: #1a2a4a; letter-spacing: 4px; }
  .monthly-table-r tfoot td.total-amount-r { text-align: right; color: #1a2a4a; font-size: 17px; }
  .certification-r { margin-top: 36px; padding-top: 28px; border-top: 1px solid #ddd; text-align: center; }
  .cert-text-r { font-size: 14px; color: #444; line-height: 1.8; margin-bottom: 28px; }
  .cert-text-r .law-ref-r { font-size: 11px; color: #999; display: block; margin-bottom: 8px; }
  .cert-date-r { font-size: 16px; font-weight: 600; color: #1a2a4a; margin-bottom: 32px; letter-spacing: 2px; }
  .signature-area-r { display: flex; flex-direction: column; align-items: center; gap: 6px; position: relative; }
  .church-name-sign-r { font-size: 22px; font-weight: 700; color: #1a2a4a; letter-spacing: 6px; }
  .pastor-sign-r { font-size: 14px; color: #555; letter-spacing: 2px; }
  .seal-r { position: absolute; right: 50px; top: -5px; width: 75px; height: 75px; border: 2.5px solid #b33a2b; border-radius: 50%; display: flex; align-items: center; justify-content: center; transform: rotate(-12deg); opacity: 0.7; filter: blur(0.3px) contrast(1.2) saturate(0.85); box-shadow: 0 0 0 1px rgba(179,58,43,0.3), inset 0 0 3px rgba(179,58,43,0.15), 1px 1px 2px rgba(179,58,43,0.1); background: radial-gradient(ellipse at 30% 40%, rgba(179,58,43,0.06) 0%, transparent 70%), radial-gradient(ellipse at 70% 60%, rgba(179,58,43,0.04) 0%, transparent 60%); }
  .seal-r::before { content: ""; position: absolute; width: 3px; height: 2px; background: rgba(179,58,43,0.25); border-radius: 50%; top: -4px; right: 12px; filter: blur(0.5px); }
  .seal-r::after { content: ""; position: absolute; width: 2px; height: 3px; background: rgba(179,58,43,0.2); border-radius: 50%; bottom: 5px; left: -3px; filter: blur(0.4px); }
  .seal-inner-r { width: 62px; height: 62px; border: 1.2px solid #b33a2b; border-radius: 50%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0; line-height: 1.15; filter: blur(0.2px); background: radial-gradient(ellipse at 60% 30%, rgba(179,58,43,0.05) 0%, transparent 50%); }
  .seal-text-r { color: #b33a2b; text-shadow: 0 0 0.5px rgba(179,58,43,0.5), 0.3px 0.3px 0.3px rgba(179,58,43,0.2); font-family: "Noto Serif KR", "Noto Serif", Georgia, serif; }
  .seal-line1-r { font-size: 8px; font-weight: 600; letter-spacing: 1.5px; }
  .seal-line2-r { font-size: 12px; font-weight: 800; letter-spacing: 2px; }
  .seal-line3-r { font-size: 7px; font-weight: 400; letter-spacing: 3px; }
  .receipt-footer-r { background: #fafbfc; padding: 16px 48px; border-top: 1px solid #eee; display: flex; justify-content: space-between; align-items: center; }
  .footer-left-r { font-size: 11px; color: #aaa; }
  .footer-right-r { font-size: 10px; color: #ccc; }
  .page-number-r { position: absolute; top: 12px; right: 16px; font-size: 10px; color: rgba(255,255,255,0.3); }
  .usage-row-r { display: flex; gap: 20px; margin-top: 12px; padding: 10px 16px; background: #f9f9f9; border-radius: 6px; font-size: 12px; color: #888; }
  .usage-row-r .label-r { font-weight: 600; color: #666; }
  .usage-checkbox-r .box-r { width: 14px; height: 14px; border: 1.5px solid #aaa; border-radius: 2px; display: inline-flex; align-items: center; justify-content: center; font-size: 10px; color: #1a2a4a; }
  .usage-checkbox-r .box-r.checked-r { background: #1a2a4a; border-color: #1a2a4a; color: #fff; }
  .donation-table-r thead th { background: #1a2a4a; color: #fff; padding: 8px 10px; font-size: 11px; font-weight: 600; text-align: center; }
  .donation-table-r tbody td { padding: 8px 10px; font-size: 12px; border-bottom: 1px solid #f0f0f0; }
  .donation-table-r tbody td.text-left-r { text-align: left; }
  .donation-table-r tbody td.text-right-r { text-align: right; font-weight: 500; }
  .donation-table-r tbody td.text-right-r.has-value-r { color: #1a2a4a; font-weight: 600; }
  .donation-table-r tfoot td { padding: 10px; font-size: 14px; font-weight: 700; border-top: 2px solid #1a2a4a; background: #f5f6f8; }
  .donation-table-r tfoot .total-label-r { text-align: center; color: #1a2a4a; }
  .donation-table-r tfoot .total-amount-r { text-align: right; color: #1a2a4a; }
  .receipt-pages-container { display: flex; flex-direction: column; align-items: center; gap: 24px; padding: 20px 0; }
  .receipt-page { width: 210mm; min-height: 297mm; height: 297mm; box-sizing: border-box; padding: 15mm 18mm; background: #fff; box-shadow: 0 2px 12px rgba(0,0,0,0.08); break-after: page; overflow: hidden; display: flex; flex-direction: column; flex-shrink: 0; }
  .receipt-page:last-child { box-shadow: 0 2px 12px rgba(0,0,0,0.08); }
`;

/** 기부금 영수증 설정 (설정에서 값 로드, 없으면 기본값) */
const RECEIPT_CONFIG_DEFAULTS = {
  churchName: "○○교회",
  businessNumber: "000-00-00000",
  churchAddress: "서울시 ○○구 ○○로 00",
  legalBasis: "소득세법 제34조제1항",
  representativeName: "○○○",
  donationType: "종교단체기부금",
  donationCode: "41",
  donationCategory: "금전",
} as const;

/* ====== 기부금 영수증 탭 ====== */
type ReceiptSubTab = "individual" | "bulk" | "history";
function ReceiptTab({ donors, offerings, settings, toast }: { donors: Donor[]; offerings: Offering[]; settings?: { churchName?: string; address?: string; pastor?: string; businessNumber?: string }; toast?: (msg: string, type?: "ok" | "err" | "warn") => void }) {
  const mob = useIsMobile();
  const listRefBatch = useRef<HTMLDivElement>(null);
  const currentYear = new Date().getFullYear();
  const [receiptSubTab, setReceiptSubTab] = useState<ReceiptSubTab>("individual");
  const [year, setYear] = useState(currentYear);
  const [currentPageBatch, setCurrentPageBatch] = useState(1);
  const [selectedDonorId, setSelectedDonorId] = useState<string>("");
  const [batchMode, setBatchMode] = useState(false);
  const [batchSelected, setBatchSelected] = useState<Set<string>>(new Set());
  const [batchGenerating, setBatchGenerating] = useState(false);
  const [batchIndex, setBatchIndex] = useState(0);
  const [batchPdfList, setBatchPdfList] = useState<Donor[]>([]);
  const [donorSearch, setDonorSearch] = useState("");
  const [residentFirst, setResidentFirst] = useState("");
  const [residentLast, setResidentLast] = useState("");
  const [batchResidentNumbers, setBatchResidentNumbers] = useState<Record<string, { first: string; last: string }>>({});
  const [yearDropdownOpen, setYearDropdownOpen] = useState(false);
  const [donorDropdownOpen, setDonorDropdownOpen] = useState(false);
  const yearDropdownRef = useRef<HTMLDivElement>(null);
  const donorDropdownRef = useRef<HTMLDivElement>(null);
  const pdfRef = useRef<{ addPage: () => void; addImage: (a: string, b: string, c: number, d: number, e: number, f: number) => void; save: (n: string) => void } | null>(null);
  const [receiptHistory, setReceiptHistory] = useState<{ id: string; receipt_number: string; member_name: string; tax_year: number; total_amount: number; issue_date: string; status: string }[]>([]);
  const [historyYearFilter, setHistoryYearFilter] = useState(currentYear);
  const [historySearch, setHistorySearch] = useState("");
  const [reprintModal, setReprintModal] = useState<{ receipt: (typeof receiptHistory)[0]; ssnFirst: string; ssnLast: string } | null>(null);
  const [cancelModal, setCancelModal] = useState<{ receipt: (typeof receiptHistory)[0]; reason: string } | null>(null);
  const [bulkFile, setBulkFile] = useState<{ name: string; ssn: string; address: string }[]>([]);
  const [bulkMatched, setBulkMatched] = useState<Record<number, string>>({});
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0, done: false });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [churchId, setChurchId] = useState<string | null>(null);
  const [churchSettings, setChurchSettings] = useState<{ church_registration_number?: string | null; representative_name?: string | null; church_address?: string | null; church_tel?: string | null; seal_image_url?: string | null } | null>(null);
  const [sealSettingsOpen, setSealSettingsOpen] = useState(false);

  const yearStr = String(year);

  useEffect(() => {
    if (!supabase) return;
    (async () => {
      const { data: churchRow } = await supabase.from("churches").select("id").limit(1).maybeSingle();
      if (churchRow?.id) {
        setChurchId(churchRow.id);
        const { data: settingsRow } = await supabase.from("church_settings").select("church_registration_number, representative_name, church_address, church_tel, seal_image_url").eq("church_id", churchRow.id).maybeSingle();
        setChurchSettings(settingsRow ?? null);
      }
    })();
  }, [sealSettingsOpen]);

  useEffect(() => {
    if (!yearDropdownOpen) return;
    const close = (e: MouseEvent) => {
      if (yearDropdownRef.current && !yearDropdownRef.current.contains(e.target as Node)) setYearDropdownOpen(false);
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [yearDropdownOpen]);

  useEffect(() => {
    if (!donorDropdownOpen) return;
    const close = (e: MouseEvent) => {
      if (donorDropdownRef.current && !donorDropdownRef.current.contains(e.target as Node)) setDonorDropdownOpen(false);
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [donorDropdownOpen]);

  const donorsWithOfferingsInYear = useMemo(() => {
    const ids = new Set(offerings.filter(o => o.date.startsWith(yearStr)).map(o => o.donorId));
    return donors.filter(d => ids.has(d.id)).sort((a, b) => a.name.localeCompare(b.name));
  }, [donors, offerings, yearStr]);

  const serialIndexMap = useMemo(() => {
    const m = new Map<string, number>();
    donorsWithOfferingsInYear.forEach((d, i) => m.set(d.id, i + 1));
    return m;
  }, [donorsWithOfferingsInYear]);

  const paginatedBatchDonors = useMemo(() => donorsWithOfferingsInYear.slice((currentPageBatch - 1) * 10, currentPageBatch * 10), [donorsWithOfferingsInYear, currentPageBatch]);

  const selectedDonor = useMemo(() => donors.find(d => d.id === selectedDonorId), [donors, selectedDonorId]);

  const { total, monthly } = useMemo(() => {
    if (!selectedDonorId) return { total: 0, monthly: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] };
    const list = offerings.filter(o => o.donorId === selectedDonorId && o.date.startsWith(yearStr));
    const m = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    list.forEach(o => {
      const month = parseInt(o.date.slice(5, 7), 10) - 1;
      m[month] += o.amount;
    });
    return { total: m.reduce((s, v) => s + v, 0), monthly: m };
  }, [selectedDonorId, offerings, yearStr]);

  const filteredDonorsForSelect = useMemo(() => {
    if (!donorSearch.trim()) return donors.sort((a, b) => a.name.localeCompare(b.name));
    const q = donorSearch.toLowerCase();
    return donors.filter(d => d.name.toLowerCase().includes(q)).sort((a, b) => a.name.localeCompare(b.name));
  }, [donors, donorSearch]);

  const receiptDonor = batchGenerating && batchPdfList[batchIndex] ? batchPdfList[batchIndex] : selectedDonor ?? null;
  const receiptData = useMemo(() => {
    if (!receiptDonor) return { total: 0, monthly: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] };
    const list = offerings.filter(o => o.donorId === receiptDonor.id && o.date.startsWith(yearStr));
    const m = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    list.forEach(o => { const month = parseInt(o.date.slice(5, 7), 10) - 1; m[month] += o.amount; });
    return { total: m.reduce((s, v) => s + v, 0), monthly: m };
  }, [receiptDonor, offerings, yearStr]);

  const serialNumber = receiptDonor ? `${yearStr}-${String(serialIndexMap.get(receiptDonor.id) ?? 0).padStart(3, "0")}` : "";

  const issueDate = useMemo(() => {
    const t = new Date();
    return `${t.getFullYear()}년 ${t.getMonth() + 1}월 ${t.getDate()}일`;
  }, []);

  useEffect(() => {
    if (!receiptDonor) return;
    const id = "receipt-global-styles";
    if (document.getElementById(id)) return;
    const style = document.createElement("style");
    style.id = id;
    style.textContent = RECEIPT_CSS;
    document.head.appendChild(style);
    return () => {
      const el = document.getElementById(id);
      if (el) el.remove();
    };
  }, [receiptDonor]);

  const captureReceiptPages = useCallback(async (): Promise<HTMLCanvasElement[]> => {
    const pages = document.querySelectorAll("#receipt-card .receipt-page");
    if (!pages.length) throw new Error("영수증 영역을 찾을 수 없습니다.");
    pages[0].scrollIntoView({ behavior: "instant", block: "start" });
    await new Promise(r => requestAnimationFrame(r));
    await new Promise(r => setTimeout(r, 150));
    const html2canvas = (await import("html2canvas")).default;
    const canvases: HTMLCanvasElement[] = [];
    for (let i = 0; i < pages.length; i++) {
      const canvas = await html2canvas(pages[i] as HTMLElement, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
      });
      canvases.push(canvas);
    }
    return canvases;
  }, []);

  const handleSaveImage = async () => {
    if (!receiptDonor) return;
    try {
      const canvases = await captureReceiptPages();
      const gap = 24;
      const totalHeight = canvases.reduce((s, c) => s + c.height, 0) + gap * (canvases.length - 1);
      const w = canvases[0].width;
      const full = document.createElement("canvas");
      full.width = w;
      full.height = totalHeight;
      const ctx = full.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#f5f5f5";
        ctx.fillRect(0, 0, w, totalHeight);
        let y = 0;
        canvases.forEach(c => {
          ctx.drawImage(c, 0, y);
          y += c.height + gap;
        });
      }
      const a = document.createElement("a");
      a.href = full.toDataURL("image/png");
      a.download = `기부금영수증_${receiptDonor.name}_${year}.png`;
      a.click();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDownloadPdf = async () => {
    if (!receiptDonor) return;
    try {
      const { jsPDF } = await import("jspdf");
      const canvases = await captureReceiptPages();
      const pdf = new jsPDF({ unit: "mm", format: "a4" });
      const a4W = 210;
      const a4H = 297;
      canvases.forEach((canvas, i) => {
        if (i > 0) pdf.addPage();
        const dataUrl = canvas.toDataURL("image/png");
        pdf.addImage(dataUrl, "PNG", 0, 0, a4W, a4H);
      });
      pdf.save(`기부금영수증_${receiptDonor.name}_${year}.pdf`);

      if (supabase && receiptSubTab === "individual") {
        try {
          const { data: churchRow } = await supabase.from("churches").select("id").limit(1).maybeSingle();
          const churchId = churchRow?.id;
          if (churchId) {
            const { data: receiptNumber } = await supabase.rpc("generate_receipt_number", { p_church_id: churchId, p_tax_year: year });
            const details = offerings
              .filter(o => o.donorId === receiptDonor.id && o.date.startsWith(String(year)))
              .reduce<{ category: string; amount: number }[]>((acc, o) => {
                const cat = DEFAULT_CATEGORIES.find(c => c.id === o.categoryId);
                const name = cat?.name ?? o.categoryId;
                const existing = acc.find(x => x.category === name);
                if (existing) existing.amount += o.amount;
                else acc.push({ category: name, amount: o.amount });
                return acc;
              }, []);
            await supabase.from("donation_receipts").insert({
              church_id: churchId,
              member_id: receiptDonor.id,
              member_name: receiptDonor.name,
              receipt_number: receiptNumber ?? `DR-${year}-00001`,
              tax_year: year,
              issue_date: new Date().toISOString().slice(0, 10),
              total_amount: receiptData.total,
              donation_details: details,
              church_name: cfg.churchName,
              church_address: cfg.churchAddress || null,
              church_representative: cfg.representativeName || null,
            });
          }
        } catch (_) { /* RLS or table 없으면 무시 */ }
      }
      setResidentFirst("");
      setResidentLast("");
    } catch (e) {
      console.error(e);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const cfg = {
    churchName: (settings?.churchName || "").trim() || RECEIPT_CONFIG_DEFAULTS.churchName,
    businessNumber: (churchSettings?.church_registration_number || settings?.businessNumber || "").trim() || "-",
    churchAddress: (churchSettings?.church_address || settings?.address || "").trim() || "-",
    legalBasis: RECEIPT_CONFIG_DEFAULTS.legalBasis,
    representativeName: (churchSettings?.representative_name || settings?.pastor || "").trim() || RECEIPT_CONFIG_DEFAULTS.representativeName,
    donationType: RECEIPT_CONFIG_DEFAULTS.donationType,
    donationCode: RECEIPT_CONFIG_DEFAULTS.donationCode,
    donationCategory: RECEIPT_CONFIG_DEFAULTS.donationCategory,
  };
  const receiptChurchNameSpaced = cfg.churchName.split("").join(" ");
  const receiptPastorSpaced = cfg.representativeName.replace(/\s/g, " \u00A0");
  const donorAddress = (receiptDonor && "address" in receiptDonor && (receiptDonor as Donor).address) ? (receiptDonor as Donor).address : "-";
  const donorResidentNumber = useMemo(() => {
    if (!receiptDonor) return "******-*******";
    const first = batchGenerating ? batchResidentNumbers[receiptDonor.id]?.first ?? "" : residentFirst;
    const last = batchGenerating ? batchResidentNumbers[receiptDonor.id]?.last ?? "" : residentLast;
    if (first.length === 6 && last.length === 7 && /^\d+$/.test(first) && /^\d+$/.test(last))
      return `${first}-${last}`;
    return "******-*******";
  }, [receiptDonor, batchGenerating, batchResidentNumbers, residentFirst, residentLast]);
  const residentValid = selectedDonor && residentFirst.length === 6 && residentLast.length === 7 && /^\d+$/.test(residentFirst) && /^\d+$/.test(residentLast);
  const batchResidentValid = useMemo(() => {
    if (batchSelected.size === 0) return false;
    return Array.from(batchSelected).every(id => {
      const r = batchResidentNumbers[id];
      return r && r.first.length === 6 && r.last.length === 7 && /^\d+$/.test(r.first) && /^\d+$/.test(r.last);
    });
  }, [batchSelected, batchResidentNumbers]);
  const getSealLines = (name: string): [string, string, string] => {
    if (!name?.trim()) return ["직인", "", ""];
    const n = name.trim();
    if (n.endsWith("교회")) {
      const prefix = n.slice(0, -2);
      if (prefix.length <= 2) return [prefix, "교회", "직인"];
      if (prefix.length <= 4) return [prefix, "교회", "직인"];
      const firstLen = prefix.length >= 6 ? 4 : 3;
      return [prefix.slice(0, firstLen), prefix.slice(firstLen) + "교회", "직인"];
    }
    return [n, "직인", ""];
  };
  const sealLines = getSealLines(cfg.churchName);
  const getLastDay = (y: number, m: number) => new Date(y, m, 0).getDate();
  const handleShare = async () => {
    if (!receiptDonor) return;
    const text = `${cfg.churchName} 기부금 영수증\n${receiptDonor.name} / ${year}년 / ₩${receiptData.total.toLocaleString("ko-KR")}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "기부금 영수증", text });
      } catch (err) {
        if ((err as Error).name !== "AbortError") navigator.clipboard?.writeText(text);
      }
    } else if (navigator.clipboard) navigator.clipboard.writeText(text);
  };

  const toggleBatchSelect = (id: string) => {
    setBatchSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleBatchSelectAll = () => {
    if (batchSelected.size >= donorsWithOfferingsInYear.length) setBatchSelected(new Set());
    else setBatchSelected(new Set(donorsWithOfferingsInYear.map(d => d.id)));
  };

  useEffect(() => {
    if (!batchGenerating || batchIndex >= batchPdfList.length) {
      if (batchGenerating && batchPdfList.length > 0 && pdfRef.current) {
        pdfRef.current.save(`기부금영수증_${year}년_일괄.pdf`);
        pdfRef.current = null;
      }
      setBatchGenerating(false);
      setBatchIndex(0);
      setBatchPdfList([]);
      return;
    }
    const timer = setTimeout(async () => {
      const pages = document.querySelectorAll("#receipt-card-batch .receipt-page");
      if (!pages.length) {
        setBatchIndex(i => i + 1);
        return;
      }
      try {
        const html2canvas = (await import("html2canvas")).default;
        const { jsPDF } = await import("jspdf");
        const a4W = 210;
        const a4H = 297;
        for (let p = 0; p < pages.length; p++) {
          const canvas = await html2canvas(pages[p] as HTMLElement, {
            scale: 2,
            useCORS: true,
            backgroundColor: "#ffffff",
            logging: false,
          });
          if (batchIndex === 0 && p === 0) pdfRef.current = new jsPDF();
          else pdfRef.current!.addPage();
          const dataUrl = canvas.toDataURL("image/png");
          pdfRef.current!.addImage(dataUrl, "PNG", 0, 0, a4W, a4H);
        }
      } catch (e) {
        console.error(e);
      }
      setBatchIndex(i => i + 1);
    }, 400);
    return () => clearTimeout(timer);
  }, [batchGenerating, batchIndex, batchPdfList.length, year]);

  const handleBatchPdf = () => {
    const list = donorsWithOfferingsInYear.filter(d => batchSelected.has(d.id));
    if (list.length === 0) return;
    setBatchPdfList(list);
    setBatchIndex(0);
    pdfRef.current = null;
    setBatchGenerating(true);
  };

  const inputBase = { padding: "12px 14px", borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 15, fontFamily: "inherit", outline: "none", width: "100%", maxWidth: 360 } as React.CSSProperties;

  const receiptSubTabs: { id: ReceiptSubTab; label: string }[] = [
    { id: "individual", label: "개별 발급" },
    { id: "bulk", label: "일괄 발급" },
    { id: "history", label: "발급 이력" },
  ];

  const handleReprintPdf = useCallback(async () => {
    if (!reprintModal || reprintModal.ssnFirst.length !== 6 || reprintModal.ssnLast.length !== 7) return;
    try {
      const { jsPDF } = await import("jspdf");
      const { registerKoreanFont } = await import("@/utils/fontLoader");
      const pdf = new jsPDF({ unit: "mm", format: "a4" });
      await registerKoreanFont(pdf);
      pdf.setFont("NanumGothic", "normal");
      pdf.setFontSize(16);
      pdf.text("기부금 영수증 (재출력)", 105, 20, { align: "center" });
      pdf.setFontSize(10);
      pdf.text(`기부자: ${reprintModal.receipt.member_name}  주민등록번호: ${reprintModal.ssnFirst}-${reprintModal.ssnLast}  총액: ₩${reprintModal.receipt.total_amount.toLocaleString("ko-KR")}  발급번호: ${reprintModal.receipt.receipt_number}  발급일: ${reprintModal.receipt.issue_date}`, 20, 35);
      if (churchId && churchSettings?.seal_image_url && supabase) {
        try {
          const path = churchSettings.seal_image_url.includes("/") ? churchSettings.seal_image_url : `${churchId}/seal.png`;
          const { data: sealData } = await supabase.storage.from("church-seals").download(path);
          if (sealData) {
            const sealBase64 = await new Promise<string>((res, rej) => {
              const r = new FileReader();
              r.onload = () => res(r.result as string);
              r.onerror = rej;
              r.readAsDataURL(sealData);
            });
            pdf.addImage(sealBase64, "PNG", 150, 85, 25, 25);
          }
        } catch (_) { /* ignore */ }
      }
      pdf.save(`기부금영수증_재출력_${reprintModal.receipt.member_name}_${reprintModal.receipt.receipt_number}.pdf`);
      setReprintModal(null);
    } catch (e) {
      console.error(e);
    }
  }, [reprintModal, churchId, churchSettings?.seal_image_url, supabase]);

  const receiptSettingsIncomplete = !churchSettings?.church_registration_number?.trim() || !churchSettings?.representative_name?.trim() || !churchSettings?.church_address?.trim();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", borderBottom: `2px solid ${C.border}`, paddingBottom: 12 }}>
        {receiptSubTabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setReceiptSubTab(t.id)}
            style={{
              padding: "10px 20px",
              borderRadius: 10,
              border: `2px solid ${receiptSubTab === t.id ? C.accent : C.border}`,
              background: receiptSubTab === t.id ? C.accentLight : "#fff",
              color: receiptSubTab === t.id ? C.accent : C.text,
              fontWeight: 600,
              fontSize: 14,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            {t.label}
          </button>
        ))}
        <button type="button" onClick={() => setSealSettingsOpen(true)} style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.card, color: C.text, fontSize: 13, cursor: "pointer" }} title="기부금영수증 설정"><Settings size={18} /> 설정</button>
      </div>

      {(receiptSubTab === "individual" || receiptSubTab === "bulk") && receiptSettingsIncomplete && (
        <div style={{ padding: "12px 16px", borderRadius: 10, border: "2px solid #f59e0b", background: "#fffbeb", color: "#92400e" }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>⚠️ 기부금영수증 설정이 완료되지 않았습니다.</p>
          <p style={{ margin: "4px 0 8px", fontSize: 12 }}>교회 고유번호, 대표자, 소재지를 먼저 등록해주세요. 미등록 시 PDF에 해당 정보가 빈칸으로 나옵니다.</p>
          <button type="button" onClick={() => setSealSettingsOpen(true)} style={{ padding: "6px 12px", borderRadius: 6, border: "none", background: "#f59e0b", color: "#fff", fontWeight: 600, fontSize: 12, cursor: "pointer" }}>설정하러 가기 →</button>
        </div>
      )}

      {sealSettingsOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={() => setSealSettingsOpen(false)}>
          <div style={{ maxWidth: 480, width: "100%", height: "90vh", maxHeight: "90vh", display: "flex", flexDirection: "column", overflow: "hidden", background: "#fff", borderRadius: 20 }} onClick={e => e.stopPropagation()}>
            <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: 20 }}>
              <SealSettingsSection churchId={churchId} toast={toast ?? (() => {})} onSaved={() => { setSealSettingsOpen(false); if (supabase && churchId) supabase.from("church_settings").select("church_registration_number, representative_name, church_address, church_tel, seal_image_url").eq("church_id", churchId).maybeSingle().then(({ data }) => setChurchSettings(data ?? null)); }} />
            </div>
            <div style={{ flexShrink: 0, paddingTop: 12 }}>
              <button type="button" onClick={() => setSealSettingsOpen(false)} style={{ width: "100%", padding: "10px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.bg, cursor: "pointer" }}>닫기</button>
            </div>
          </div>
        </div>
      )}

      {receiptSubTab === "individual" && (
        <>
      <Card style={{ padding: mob ? 16 : 20 }}>
        <div style={{ display: "flex", flexWrap: "nowrap", alignItems: "center", gap: 16, minHeight: 48 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }} ref={yearDropdownRef}>
            <label style={{ fontSize: 14, fontWeight: 600, color: C.navy, whiteSpace: "nowrap" }}>귀속연도</label>
            <div style={{ position: "relative" }}>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setYearDropdownOpen(o => !o); }}
                style={{
                  minWidth: 100,
                  minHeight: 44,
                  padding: "10px 36px 10px 14px",
                  borderRadius: 10,
                  border: `1px solid ${C.border}`,
                  fontSize: 15,
                  fontFamily: "inherit",
                  color: C.navy,
                  background: "#fff",
                  cursor: "pointer",
                  textAlign: "left",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                }}
              >
                <span>{year}년</span>
                <span style={{ flexShrink: 0, display: "flex", alignItems: "center" }}>▼</span>
              </button>
              {yearDropdownOpen && (
                <div
                  style={{
                    position: "absolute",
                    top: "100%",
                    left: 0,
                    marginTop: 4,
                    minWidth: "100%",
                    background: "#fff",
                    border: `1px solid ${C.border}`,
                    borderRadius: 10,
                    boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
                    zIndex: 50,
                    overflow: "hidden",
                  }}
                >
                  {[currentYear, currentYear - 1, currentYear - 2].map((y) => (
                    <button
                      key={y}
                      type="button"
                      onClick={() => { setYear(y); setCurrentPageBatch(1); setYearDropdownOpen(false); }}
                      style={{
                        display: "block",
                        width: "100%",
                        padding: "12px 14px",
                        border: "none",
                        background: year === y ? C.navy : "transparent",
                        color: year === y ? "#fff" : C.navy,
                        fontSize: 15,
                        fontFamily: "inherit",
                        cursor: "pointer",
                        textAlign: "left",
                      }}
                    >
                      {y}년
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setReceiptSubTab("bulk")}
            style={{
              padding: "10px 18px",
              minHeight: 44,
              borderRadius: 10,
              border: `1px solid ${C.border}`,
              background: C.bg,
              color: C.navy,
              fontWeight: 600,
              fontSize: 14,
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            일괄 발급으로 이동
          </button>
        </div>
      </Card>

          <Card style={{ padding: mob ? 16 : 24 }}>
            <h4 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: C.navy }}>교인 선택</h4>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: C.textMuted, marginBottom: 6 }}>이름으로 검색</label>
                <input
                  type="text"
                  value={donorSearch}
                  onChange={e => setDonorSearch(e.target.value)}
                  placeholder="검색 후 아래에서 선택"
                  style={{ ...inputBase, margin: 0 }}
                />
              </div>
              <div ref={donorDropdownRef} style={{ position: "relative" }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: C.textMuted, marginBottom: 6 }}>교인 선택</label>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setDonorDropdownOpen(o => !o); }}
                  style={{
                    ...inputBase,
                    margin: 0,
                    cursor: "pointer",
                    minHeight: 48,
                    textAlign: "left",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    color: selectedDonorId ? C.navy : C.textMuted,
                  }}
                >
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {selectedDonor ? `${selectedDonor.name}${selectedDonor.phone ? ` (${selectedDonor.phone})` : ""}` : "선택하세요"}
                  </span>
                  <span style={{ flexShrink: 0, marginLeft: 8 }}>▼</span>
                </button>
                {donorDropdownOpen && (
                  <div
                    style={{
                      position: "absolute",
                      top: "100%",
                      left: 0,
                      right: 0,
                      marginTop: 4,
                      maxHeight: 280,
                      overflowY: "auto",
                      background: "#fff",
                      border: `1px solid ${C.border}`,
                      borderRadius: 10,
                      boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
                      zIndex: 50,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => { setSelectedDonorId(""); setDonorDropdownOpen(false); setResidentFirst(""); setResidentLast(""); }}
                      style={{
                        display: "block",
                        width: "100%",
                        padding: "12px 14px",
                        border: "none",
                        background: !selectedDonorId ? C.navy : "transparent",
                        color: !selectedDonorId ? "#fff" : C.navy,
                        fontSize: 15,
                        fontFamily: "inherit",
                        cursor: "pointer",
                        textAlign: "left",
                      }}
                    >
                      선택하세요
                    </button>
                    {filteredDonorsForSelect.map((d) => (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => { setSelectedDonorId(d.id); setDonorDropdownOpen(false); setResidentFirst(""); setResidentLast(""); }}
                        style={{
                          display: "block",
                          width: "100%",
                          padding: "12px 14px",
                          border: "none",
                          borderTop: `1px solid ${C.borderLight}`,
                          background: selectedDonorId === d.id ? C.navy : "transparent",
                          color: selectedDonorId === d.id ? "#fff" : C.navy,
                          fontSize: 15,
                          fontFamily: "inherit",
                          cursor: "pointer",
                          textAlign: "left",
                        }}
                      >
                        {d.name}{d.phone ? ` (${d.phone})` : ""}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {selectedDonor && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ padding: "12px 14px", borderRadius: 10, border: "2px solid #dc2626", background: "#fef2f2", marginBottom: 4 }}>
                    <p style={{ margin: 0, fontSize: 12, color: "#b91c1c", fontWeight: 600 }}>🔒 개인정보 보호</p>
                    <p style={{ margin: "4px 0 0", fontSize: 12, color: "#991b1b" }}>⚠️ 주민등록번호는 서버에 저장되지 않으며, 영수증 PDF 생성 후 즉시 폐기됩니다.</p>
                  </div>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: C.textMuted, marginBottom: 2 }}>주민등록번호 (13자리, - 제외)</label>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <input
                      type="password"
                      inputMode="numeric"
                      maxLength={6}
                      value={residentFirst}
                      onChange={e => setResidentFirst(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      placeholder="앞 6자리"
                      style={{ ...inputBase, width: 90, margin: 0 }}
                    />
                    <span style={{ color: C.textMuted, fontWeight: 600 }}>-</span>
                    <input
                      type="password"
                      inputMode="numeric"
                      maxLength={7}
                      value={residentLast}
                      onChange={e => setResidentLast(e.target.value.replace(/\D/g, "").slice(0, 7))}
                      placeholder="뒷 7자리"
                      style={{ ...inputBase, width: 100, margin: 0 }}
                    />
                  </div>
                  {selectedDonor && total > 0 && !residentValid && (
                    <p style={{ fontSize: 13, color: "#c00", margin: "4px 0 0" }}>주민등록번호를 입력해주세요 (앞 6자리 + 뒷 7자리)</p>
                  )}
                </div>
              )}
            </div>
            {selectedDonor && total > 0 && (
              <p style={{ margin: "16px 0 0", paddingTop: 12, borderTop: `1px solid ${C.borderLight}`, fontSize: 14, color: C.textMuted }}>{year}년 헌금 총액: ₩{total.toLocaleString("ko-KR")}</p>
            )}
          </Card>

          {receiptDonor && (
            <>
              <div id="receipt-card" className="receipt-wrapper-r" style={{ margin: "0 auto", boxSizing: "border-box", background: "transparent" }}>
                <style dangerouslySetInnerHTML={{ __html: RECEIPT_CSS }} />
                <div className="receipt-pages-container">
                  {/* 페이지 1: 헤더 + ①②③ + ④ 기간/총액 + 테이블 1~6월 */}
                  <div className="receipt-page" data-receipt-page="1">
                    <div className="receipt-header-r" style={{ margin: "0 -18mm" }}>
                      <div className="header-top-r">
                        <span className="doc-type-r">소득세법 시행규칙 [별지 제45호의2서식] &lt;개정 2026. 1. 2.&gt;</span>
                        <span className="serial-number-r">No. {serialNumber}</span>
                      </div>
                      <div className="receipt-title-r">기 부 금 영 수 증</div>
                      <div className="receipt-subtitle-r">DONATION RECEIPT</div>
                    </div>
                    <div className="receipt-body-r" style={{ flex: 1, paddingTop: 24 }}>
                      <div className="section-r">
                        <div className="section-header-r">
                          <span className="section-number-r">1</span>
                          <span className="section-title-r">기 부 자</span>
                        </div>
                        <table className="info-table-r">
                          <tbody>
                            <tr>
                              <th>성명 (법인명)</th>
                              <td>{receiptDonor.name}</td>
                              <th style={{ width: 140 }}>주민등록번호 (사업자등록번호)</th>
                              <td>{donorResidentNumber}</td>
                            </tr>
                            <tr>
                              <th>주소 (소재지)</th>
                              <td colSpan={3}>{donorAddress}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                      <div className="section-r">
                        <div className="section-header-r">
                          <span className="section-number-r">2</span>
                          <span className="section-title-r">기 부 금 단 체</span>
                        </div>
                        <table className="info-table-r">
                          <tbody>
                            <tr>
                              <th>단체명</th>
                              <td>{cfg.churchName}</td>
                              <th style={{ width: 140 }}><span>사업자등록번호<br />(고유번호)</span></th>
                              <td>{cfg.businessNumber}</td>
                            </tr>
                            <tr>
                              <th>소재지</th>
                              <td colSpan={3}>{cfg.churchAddress}</td>
                            </tr>
                            <tr>
                              <th>기부금공제대상 기부금단체 근거법령</th>
                              <td colSpan={3}>{cfg.legalBasis}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                      <div className="section-r">
                        <div className="section-header-r">
                          <span className="section-number-r">3</span>
                          <span className="section-title-r">기 부 금 모 집 처</span>
                        </div>
                        <table className="info-table-r">
                          <tbody>
                            <tr>
                              <th>단체명</th>
                              <td>-</td>
                              <th style={{ width: 140 }}>사업자등록번호</th>
                              <td>-</td>
                            </tr>
                            <tr>
                              <th>소재지</th>
                              <td colSpan={3}>-</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                      <div className="section-r">
                        <div className="section-header-r">
                          <span className="section-number-r">4</span>
                          <span className="section-title-r">기 부 내 용</span>
                        </div>
                        <table className="info-table-r" style={{ marginBottom: 8 }}>
                          <tbody>
                            <tr>
                              <th>기부 기간</th>
                              <td>{year}. 01. 01 ~ {year}. 12. 31</td>
                              <th style={{ width: 100 }}>기부 총액</th>
                              <td className="amount-r">₩ {receiptData.total.toLocaleString("ko-KR")}</td>
                            </tr>
                          </tbody>
                        </table>
                        <table className="donation-table-r monthly-table-r">
                          <thead>
                            <tr>
                              <th style={{ width: 90 }}>유형</th>
                              <th style={{ width: 50 }}>코드</th>
                              <th style={{ width: 60 }}>구분</th>
                              <th style={{ width: 95 }}>연월일</th>
                              <th>내용 (품명/수량/단가)</th>
                              <th style={{ width: 110, textAlign: "right" }}>금액</th>
                            </tr>
                          </thead>
                          <tbody>
                            {[1, 2, 3, 4, 5, 6].map((m, idx) => {
                              const lastDay = getLastDay(year, m);
                              const dateStr = `${year}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
                              const amt = receiptData.monthly[m - 1];
                              const typeVal = idx === 0 ? cfg.donationType : '"';
                              return (
                                <tr key={m}>
                                  <td className="text-left-r">{typeVal}</td>
                                  <td>{cfg.donationCode}</td>
                                  <td>{cfg.donationCategory}</td>
                                  <td>{dateStr}</td>
                                  <td className="text-left-r">헌금</td>
                                  <td className={`text-right-r ${amt > 0 ? "has-value-r" : ""}`}>{amt > 0 ? amt.toLocaleString("ko-KR") : "0"}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                  {/* 페이지 2: 테이블 7~12월 + 계 + 용도 + 증명 + 서명 */}
                  <div className="receipt-page" data-receipt-page="2">
                    <div style={{ fontSize: 10, color: "#999", textAlign: "right", marginBottom: 8 }}>002/002</div>
                    <div className="receipt-body-r" style={{ paddingTop: 0, flex: 1 }}>
                      <div className="section-r">
                        <table className="donation-table-r monthly-table-r">
                          <thead>
                            <tr>
                              <th style={{ width: 90 }}>유형</th>
                              <th style={{ width: 50 }}>코드</th>
                              <th style={{ width: 60 }}>구분</th>
                              <th style={{ width: 95 }}>연월일</th>
                              <th>내용 (품명/수량/단가)</th>
                              <th style={{ width: 110, textAlign: "right" }}>금액</th>
                            </tr>
                          </thead>
                          <tbody>
                            {[7, 8, 9, 10, 11, 12].map((m, idx) => {
                              const lastDay = getLastDay(year, m);
                              const dateStr = `${year}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
                              const amt = receiptData.monthly[m - 1];
                              const typeVal = idx === 0 ? '"' : '"';
                              return (
                                <tr key={m}>
                                  <td className="text-left-r">{typeVal}</td>
                                  <td>{cfg.donationCode}</td>
                                  <td>{cfg.donationCategory}</td>
                                  <td>{dateStr}</td>
                                  <td className="text-left-r">헌금</td>
                                  <td className={`text-right-r ${amt > 0 ? "has-value-r" : ""}`}>{amt > 0 ? amt.toLocaleString("ko-KR") : "0"}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                          <tfoot>
                            <tr>
                              <td colSpan={5} className="total-label-r">계</td>
                              <td className="total-amount-r">₩ {receiptData.total.toLocaleString("ko-KR")}</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                      <div className="usage-row-r">
                        <span className="label-r">용도 :</span>
                        <span className="usage-checkbox-r">
                          <span className="box-r checked-r">✓</span> 세금공제신청용
                        </span>
                        <span className="usage-checkbox-r">
                          <span className="box-r"></span> 기타 (용도의 사용불가)
                        </span>
                      </div>
                      <div className="certification-r">
                        <div className="cert-text-r">
                          <span className="law-ref-r">「소득세법」 제34조, 「조세특례제한법」 제76조 · 제88조의4 및 「법인세법」 제24조에 따른 기부금을</span>
                          위와 같이 기부하였음을 증명하여 주시기 바랍니다.
                        </div>
                        <div className="cert-date-r">{issueDate.replace(/년\s*/, " 년  ").replace(/월\s*/, " 월  ").replace(/일$/, " 일")}</div>
                        <div style={{ textAlign: "right", marginBottom: 32, fontSize: 14, color: "#555" }}>
                          신청인 &nbsp;&nbsp; <strong style={{ color: "#222", letterSpacing: 4 }}>{receiptDonor.name.split("").join(" ")}</strong> &nbsp;&nbsp; <span style={{ color: "#aaa" }}>(서명 또는 인)</span>
                        </div>
                        <div style={{ textAlign: "center", fontSize: 13, color: "#999", marginBottom: 16 }}>위와 같이 기부금을 기부하였음을 증명합니다.</div>
                        <div className="signature-area-r">
                          <div className="church-name-sign-r">{receiptChurchNameSpaced}</div>
                          <div className="pastor-sign-r">담임목사 &nbsp; {receiptPastorSpaced}</div>
                          <div className="seal-r">
                            <div className="seal-inner-r">
                              {sealLines[0] && <span className="seal-text-r seal-line1-r">{sealLines[0]}</span>}
                              {sealLines[1] && <span className="seal-text-r seal-line2-r">{sealLines[1]}</span>}
                              {sealLines[2] && <span className="seal-text-r seal-line3-r">{sealLines[2]}</span>}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div style={{ fontSize: 12, color: "#666", textAlign: "center", marginTop: 20, borderTop: "1px solid #eee", paddingTop: 10 }}>- 1 / 2 -</div>
                    <div className="receipt-footer-r" style={{ margin: "24px -18mm 0", marginTop: "auto" }}>
                      <div className="footer-left-r">210mm × 297mm (일반용지 60g/㎡)</div>
                      <div className="footer-right-r">Powered by 교회매니저</div>
                    </div>
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center", marginTop: 16 }}>
                <Button onClick={handleSaveImage} disabled={!residentValid} variant="accent">이미지 저장</Button>
                <Button onClick={handleDownloadPdf} disabled={!residentValid} variant="ghost">PDF 다운로드</Button>
                <Button onClick={handleShare} disabled={!residentValid} variant="soft">카카오톡 공유</Button>
              </div>
            </>
          )}
          {selectedDonor && total === 0 && <p style={{ color: C.textMuted, fontSize: 14 }}>해당 연도 헌금 내역이 없습니다.</p>}
        </>
      )}

      {batchMode && (
        <>
          <div ref={listRefBatch}><Card>
            <h4 style={{ margin: "0 0 12px", color: C.navy }}>해당 연도 헌금 교인 ({donorsWithOfferingsInYear.length}명)</h4>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <input type="checkbox" checked={batchSelected.size === donorsWithOfferingsInYear.length && donorsWithOfferingsInYear.length > 0} onChange={toggleBatchSelectAll} style={{ width: 18, height: 18 }} />
              <span style={{ fontSize: 13 }}>전체 선택/해제</span>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                <thead>
                  <tr style={{ background: C.bg }}>
                    <th style={{ padding: "10px 12px", textAlign: "left" }}></th>
                    <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: 600, color: C.navy }}>교인 이름</th>
                    <th style={{ padding: "10px 12px", textAlign: "right", fontWeight: 600, color: C.navy }}>연간 헌금 총액</th>
                    <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: 600, color: C.navy }}>주민등록번호</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedBatchDonors.map(d => {
                    const sum = offerings.filter(o => o.donorId === d.id && o.date.startsWith(yearStr)).reduce((s, o) => s + o.amount, 0);
                    const rn = batchResidentNumbers[d.id] ?? { first: "", last: "" };
                    return (
                      <tr key={d.id} style={{ borderBottom: `1px solid ${C.borderLight}` }}>
                        <td style={{ padding: "10px 12px" }}>
                          <input type="checkbox" checked={batchSelected.has(d.id)} onChange={() => toggleBatchSelect(d.id)} style={{ width: 18, height: 18 }} />
                        </td>
                        <td style={{ padding: "10px 12px", fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }} title={d.name}>{d.name}</td>
                        <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 600 }}>₩{sum.toLocaleString("ko-KR")}</td>
                        <td style={{ padding: "8px 12px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                            <input
                              type="text"
                              inputMode="numeric"
                              maxLength={6}
                              value={rn.first}
                              onChange={e => setBatchResidentNumbers(prev => ({ ...prev, [d.id]: { ...(prev[d.id] ?? { first: "", last: "" }), first: e.target.value.replace(/\D/g, "").slice(0, 6) } }))}
                              placeholder="앞6"
                              style={{ width: 52, padding: "6px 8px", fontSize: 13, border: `1px solid ${C.border}`, borderRadius: 6 }}
                            />
                            <span style={{ color: C.textMuted }}>-</span>
                            <input
                              type="text"
                              inputMode="numeric"
                              maxLength={1}
                              value={rn.last}
                              onChange={e => setBatchResidentNumbers(prev => ({ ...prev, [d.id]: { ...(prev[d.id] ?? { first: "", last: "" }), last: e.target.value.replace(/\D/g, "").slice(0, 1) } }))}
                              placeholder="뒷1"
                              style={{ width: 40, padding: "6px 8px", fontSize: 13, border: `1px solid ${C.border}`, borderRadius: 6 }}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {donorsWithOfferingsInYear.length === 0 && <p style={{ padding: 20, color: C.textMuted, textAlign: "center" }}>해당 연도 헌금 기록이 있는 교인이 없습니다.</p>}
            {donorsWithOfferingsInYear.length > 0 && (
              <Pagination totalItems={donorsWithOfferingsInYear.length} itemsPerPage={10} currentPage={currentPageBatch} onPageChange={(p) => { setCurrentPageBatch(p); listRefBatch.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }} />
            )}
          </Card></div>
          {batchSelected.size > 0 && !batchResidentValid && (
            <p style={{ fontSize: 13, color: "#c00", margin: "0 0 8px" }}>선택한 교인 모두 주민등록번호를 입력해주세요</p>
          )}
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <Button onClick={handleBatchPdf} disabled={batchSelected.size === 0 || !batchResidentValid || batchGenerating} variant="accent">
              {batchGenerating ? `생성 중 (${batchIndex + 1}/${batchPdfList.length})...` : "선택한 교인 일괄 PDF 생성"}
            </Button>
          </div>
          {batchGenerating && receiptDonor && (
            <div id="receipt-card-batch" className="receipt-wrapper-r" style={{ position: "absolute", left: -9999, top: 0, background: "transparent" }}>
              <style dangerouslySetInnerHTML={{ __html: RECEIPT_CSS }} />
              <div className="receipt-pages-container">
                <div className="receipt-page" data-receipt-page="1">
                  <div className="receipt-header-r" style={{ margin: "0 -18mm" }}>
                    <span className="page-number-r">001/002</span>
                    <div className="header-top-r">
                      <span className="doc-type-r">소득세법 시행규칙 [별지 제45호의2서식] &lt;개정 2026. 1. 2.&gt;</span>
                      <span className="serial-number-r">No. {serialNumber}</span>
                    </div>
                    <div className="receipt-title-r">기 부 금 영 수 증</div>
                    <div className="receipt-subtitle-r">DONATION RECEIPT</div>
                  </div>
                  <div className="receipt-body-r" style={{ flex: 1, paddingTop: 24 }}>
                    <div className="section-r">
                      <div className="section-header-r"><span className="section-number-r">1</span><span className="section-title-r">기 부 자</span></div>
                      <table className="info-table-r">
                        <tbody>
                          <tr><th>성명 (법인명)</th><td>{receiptDonor.name}</td><th style={{ width: 140 }}>주민등록번호 (사업자등록번호)</th><td>{donorResidentNumber}</td></tr>
                          <tr><th>주소 (소재지)</th><td colSpan={3}>{donorAddress}</td></tr>
                        </tbody>
                      </table>
                    </div>
                    <div className="section-r">
                      <div className="section-header-r"><span className="section-number-r">2</span><span className="section-title-r">기 부 금 단 체</span></div>
                      <table className="info-table-r">
                        <tbody>
                          <tr><th>단체명</th><td>{cfg.churchName}</td><th style={{ width: 140 }}><span>사업자등록번호<br />(고유번호)</span></th><td>{cfg.businessNumber}</td></tr>
                          <tr><th>소재지</th><td colSpan={3}>{cfg.churchAddress}</td></tr>
                          <tr><th>기부금공제대상 기부금단체 근거법령</th><td colSpan={3}>{cfg.legalBasis}</td></tr>
                        </tbody>
                      </table>
                    </div>
                    <div className="section-r">
                      <div className="section-header-r"><span className="section-number-r">3</span><span className="section-title-r">기 부 금 모 집 처</span></div>
                      <table className="info-table-r">
                        <tbody>
                          <tr><th>단체명</th><td>-</td><th style={{ width: 140 }}>사업자등록번호</th><td>-</td></tr>
                          <tr><th>소재지</th><td colSpan={3}>-</td></tr>
                        </tbody>
                      </table>
                    </div>
                    <div className="section-r">
                      <div className="section-header-r"><span className="section-number-r">4</span><span className="section-title-r">기 부 내 용</span></div>
                      <table className="info-table-r" style={{ marginBottom: 8 }}>
                        <tbody><tr><th>기부 기간</th><td>{year}. 01. 01 ~ {year}. 12. 31</td><th style={{ width: 100 }}>기부 총액</th><td className="amount-r">₩ {receiptData.total.toLocaleString("ko-KR")}</td></tr></tbody>
                      </table>
                      <table className="donation-table-r monthly-table-r">
                        <thead><tr><th style={{ width: 90 }}>유형</th><th style={{ width: 50 }}>코드</th><th style={{ width: 60 }}>구분</th><th style={{ width: 95 }}>연월일</th><th>내용 (품명/수량/단가)</th><th style={{ width: 110, textAlign: "right" }}>금액</th></tr></thead>
                        <tbody>
                          {[1, 2, 3, 4, 5, 6].map((m, idx) => {
                            const lastDay = getLastDay(year, m);
                            const dateStr = `${year}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
                            const amt = receiptData.monthly[m - 1];
                            return (<tr key={m}><td className="text-left-r">{idx === 0 ? cfg.donationType : '"'}</td><td>{cfg.donationCode}</td><td>{cfg.donationCategory}</td><td>{dateStr}</td><td className="text-left-r">헌금</td><td className={`text-right-r ${amt > 0 ? "has-value-r" : ""}`}>{amt > 0 ? amt.toLocaleString("ko-KR") : "0"}</td></tr>);
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
                <div className="receipt-page" data-receipt-page="2">
                  <div style={{ fontSize: 10, color: "#999", textAlign: "right", marginBottom: 8 }}>002/002</div>
                  <div className="receipt-body-r" style={{ paddingTop: 0, flex: 1 }}>
                    <div className="section-r">
                      <table className="donation-table-r monthly-table-r">
                        <thead><tr><th style={{ width: 90 }}>유형</th><th style={{ width: 50 }}>코드</th><th style={{ width: 60 }}>구분</th><th style={{ width: 95 }}>연월일</th><th>내용 (품명/수량/단가)</th><th style={{ width: 110, textAlign: "right" }}>금액</th></tr></thead>
                        <tbody>
                          {[7, 8, 9, 10, 11, 12].map((m, idx) => {
                            const lastDay = getLastDay(year, m);
                            const dateStr = `${year}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
                            const amt = receiptData.monthly[m - 1];
                            return (<tr key={m}><td className="text-left-r">"</td><td>{cfg.donationCode}</td><td>{cfg.donationCategory}</td><td>{dateStr}</td><td className="text-left-r">헌금</td><td className={`text-right-r ${amt > 0 ? "has-value-r" : ""}`}>{amt > 0 ? amt.toLocaleString("ko-KR") : "0"}</td></tr>);
                          })}
                        </tbody>
                        <tfoot><tr><td colSpan={5} className="total-label-r">계</td><td className="total-amount-r">₩ {receiptData.total.toLocaleString("ko-KR")}</td></tr></tfoot>
                      </table>
                    </div>
                    <div className="usage-row-r"><span className="label-r">용도 :</span><span className="usage-checkbox-r"><span className="box-r checked-r">✓</span> 세금공제신청용</span><span className="usage-checkbox-r"><span className="box-r"></span> 기타 (용도의 사용불가)</span></div>
                    <div className="certification-r">
                      <div className="cert-text-r"><span className="law-ref-r">「소득세법」 제34조, 「조세특례제한법」 제76조 · 제88조의4 및 「법인세법」 제24조에 따른 기부금을</span> 위와 같이 기부하였음을 증명하여 주시기 바랍니다.</div>
                      <div className="cert-date-r">{issueDate.replace(/년\s*/, " 년  ").replace(/월\s*/, " 월  ").replace(/일$/, " 일")}</div>
                      <div style={{ textAlign: "right", marginBottom: 32, fontSize: 14, color: "#555" }}>신청인 &nbsp;&nbsp; <strong style={{ color: "#222", letterSpacing: 4 }}>{receiptDonor.name.split("").join(" ")}</strong> &nbsp;&nbsp; <span style={{ color: "#aaa" }}>(서명 또는 인)</span></div>
                      <div style={{ textAlign: "center", fontSize: 13, color: "#999", marginBottom: 16 }}>위와 같이 기부금을 기부하였음을 증명합니다.</div>
                      <div className="signature-area-r">
                        <div className="church-name-sign-r">{receiptChurchNameSpaced}</div>
                        <div className="pastor-sign-r">담임목사 &nbsp; {receiptPastorSpaced}</div>
                        <div className="seal-r"><div className="seal-inner-r">{sealLines[0] && <span className="seal-text-r seal-line1-r">{sealLines[0]}</span>}{sealLines[1] && <span className="seal-text-r seal-line2-r">{sealLines[1]}</span>}{sealLines[2] && <span className="seal-text-r seal-line3-r">{sealLines[2]}</span>}</div></div>
                      </div>
                    </div>
                  </div>
                  <div className="receipt-footer-r" style={{ margin: "24px -18mm 0", marginTop: "auto" }}><div className="footer-left-r">210mm × 297mm (일반용지 60g/㎡)</div><div className="footer-right-r">Powered by 교회매니저</div></div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {receiptSubTab === "bulk" && (
        <Card style={{ padding: 24 }}>
          <div style={{ padding: "12px 14px", borderRadius: 10, border: "2px solid #059669", background: "#ecfdf5", marginBottom: 20 }}>
            <p style={{ margin: 0, fontSize: 13, color: "#047857", fontWeight: 600 }}>🔒 업로드된 엑셀 파일은 서버에 전송되지 않습니다.</p>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: "#065f46" }}>모든 처리는 브라우저에서 이루어지며, 발급 완료 후 데이터는 즉시 폐기됩니다.</p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <label style={{ fontSize: 14, fontWeight: 600, color: C.navy }}>귀속연도</label>
              <select value={year} onChange={e => setYear(Number(e.target.value))} style={{ padding: "8px 12px", borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 14 }}>
                {[currentYear, currentYear - 1, currentYear - 2].map(y => <option key={y} value={y}>{y}년</option>)}
              </select>
              <button type="button" onClick={() => { const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["이름", "주민등록번호", "주소"]]), "기부금영수증"); XLSX.writeFile(wb, "기부금영수증_템플릿.xlsx"); }} style={{ padding: "8px 16px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.card, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>엑셀 템플릿 다운로드</button>
            </div>
            <div onDragOver={e => { e.preventDefault(); e.currentTarget.style.background = C.accentLight; }} onDragLeave={e => { e.currentTarget.style.background = "#f8fafc"; }} onClick={() => fileInputRef.current?.click()} style={{ border: `2px dashed ${C.border}`, borderRadius: 12, padding: 32, textAlign: "center", background: "#f8fafc", cursor: "pointer", fontSize: 14, color: C.textMuted }}>엑셀 파일을 여기에 놓거나 클릭하여 선택</div>
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls" style={{ display: "none" }} onChange={async e => { const f = e.target.files?.[0]; if (!f) return; const buf = await f.arrayBuffer(); const wb = XLSX.read(buf, { type: "array" }); const sh = wb.Sheets[wb.SheetNames[0]]; const rows = XLSX.utils.sheet_to_json<string[]>(sh, { header: 1 }) as (string[])[]; const data = rows.slice(1).filter(r => r && r[0]).map((r, i) => ({ name: String(r[0] ?? "").trim(), ssn: String(r[1] ?? "").replace(/\D/g, "").slice(0, 13), address: String(r[2] ?? "").trim() })); setBulkFile(data); setBulkMatched({}); e.target.value = ""; }} />
            {bulkFile.length > 0 && (
              <>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: C.navy }}>미리보기 ({bulkFile.length}명) · 주민번호 마스킹 표시</p>
                <div style={{ overflowX: "auto", maxHeight: 280, border: `1px solid ${C.border}`, borderRadius: 10 }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead><tr style={{ background: C.navy, color: "#fff" }}><th style={{ padding: "10px 12px", textAlign: "left" }}>이름</th><th style={{ padding: "10px 12px" }}>주민등록번호</th><th style={{ padding: "10px 12px", textAlign: "left" }}>주소</th></tr></thead>
                    <tbody>
                      {bulkFile.slice(0, 50).map((row, i) => (
                        <tr key={i} style={{ borderBottom: `1px solid ${C.borderLight}`, background: donors.some(d => d.name.trim() === row.name) ? "transparent" : "#fef9c3" }}>
                          <td style={{ padding: "8px 12px" }}>{row.name}</td>
                          <td style={{ padding: "8px 12px" }}>{row.ssn ? "***-**-*******" : "-"}</td>
                          <td style={{ padding: "8px 12px" }}>{row.address || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {bulkFile.length > 50 && <p style={{ padding: 8, margin: 0, fontSize: 12, color: C.textMuted }}>외 {bulkFile.length - 50}명</p>}
                </div>
                {!bulkProgress.done && bulkProgress.total === 0 && (
                  <button type="button" disabled={bulkFile.length === 0} onClick={async () => { setBulkProgress({ current: 0, total: bulkFile.length, done: false }); const JSZip = (await import("jszip")).default; const { saveAs } = await import("file-saver"); const zip = new JSZip(); let churchId: string | null = null; if (supabase) { const { data: churchRow } = await supabase.from("churches").select("id").limit(1).maybeSingle(); churchId = churchRow?.id ?? null; } let sealBase64: string | null = null; if (churchId && churchSettings?.seal_image_url && supabase) { try { const path = churchSettings.seal_image_url.includes("/") ? churchSettings.seal_image_url : `${churchId}/seal.png`; const { data: sealData } = await supabase.storage.from("church-seals").download(path); if (sealData) { sealBase64 = await new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result as string); r.onerror = rej; r.readAsDataURL(sealData); }); } } catch (_) {} } for (let i = 0; i < bulkFile.length; i++) { const row = bulkFile[i]; const donor = donors.find(d => d.name.trim() === row.name); if (!donor || row.ssn.length !== 13) continue; const list = offerings.filter(o => o.donorId === donor.id && o.date.startsWith(String(year))); const total = list.reduce((s, o) => s + o.amount, 0); if (total === 0) continue; setBulkProgress({ current: i + 1, total: bulkFile.length, done: false }); await new Promise(r => setTimeout(r, 50)); const { jsPDF } = await import("jspdf"); const { registerKoreanFont } = await import("@/utils/fontLoader"); const pdf = new jsPDF({ unit: "mm", format: "a4" }); await registerKoreanFont(pdf); pdf.setFont("NanumGothic", "normal"); pdf.setFontSize(16); pdf.text("기부금 영수증", 105, 20, { align: "center" }); pdf.setFontSize(10); pdf.text(`기부자: ${donor.name}  주민등록번호: ${row.ssn.slice(0, 6)}-${row.ssn.slice(6)}  주소: ${row.address || "-"}`, 20, 35); const receiptNum = `DR-${year}-${String(i + 1).padStart(5, "0")}`; pdf.text(`단체: ${cfg.churchName}  총액: ₩${total.toLocaleString("ko-KR")}  귀속연도: ${year}`, 20, 42); pdf.text(`발급일: ${new Date().toISOString().slice(0, 10)}  발급번호: ${receiptNum}`, 20, 49); if (sealBase64) pdf.addImage(sealBase64, "PNG", 150, 85, 25, 25); const blob = pdf.output("blob"); zip.file(`기부금영수증_${donor.name}_${year}.pdf`, blob); if (churchId && supabase) { try { const { data: genNum } = await supabase.rpc("generate_receipt_number", { p_church_id: churchId, p_tax_year: year }); const details = list.reduce<{ category: string; amount: number }[]>((acc, o) => { const cat = DEFAULT_CATEGORIES.find(c => c.id === o.categoryId); const name = cat?.name ?? o.categoryId; const existing = acc.find(x => x.category === name); if (existing) existing.amount += o.amount; else acc.push({ category: name, amount: o.amount }); return acc; }, []); await supabase.from("donation_receipts").insert({ church_id: churchId, member_id: donor.id, member_name: donor.name, receipt_number: genNum ?? receiptNum, tax_year: year, issue_date: new Date().toISOString().slice(0, 10), total_amount: total, donation_details: details, church_name: cfg.churchName, church_address: cfg.churchAddress || null, church_representative: cfg.representativeName || null }); } catch (_) { /* ignore */ } } } setBulkProgress({ current: bulkFile.length, total: bulkFile.length, done: true }); const blob = await zip.generateAsync({ type: "blob" }); saveAs(blob, `기부금영수증_일괄_${year}.zip`); setBulkFile([]); setBulkMatched({}); }} style={{ padding: "12px 24px", borderRadius: 10, border: "none", background: C.accent, color: "#fff", fontWeight: 600, fontSize: 14, cursor: "pointer" }}>일괄 PDF 생성 (ZIP)</button>
                )}
                {bulkProgress.total > 0 && !bulkProgress.done && <p style={{ margin: 0, fontSize: 13, color: C.textMuted }}>처리 중... {bulkProgress.current}/{bulkProgress.total}</p>}
                {bulkProgress.done && <p style={{ margin: 0, fontSize: 13, color: C.success }}>완료. ZIP이 다운로드되었습니다. 엑셀 데이터는 폐기되었습니다.</p>}
              </>
            )}
          </div>
        </Card>
      )}

      {receiptSubTab === "history" && (
        <Card style={{ padding: 24 }}>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
            <select value={historyYearFilter} onChange={e => setHistoryYearFilter(Number(e.target.value))} style={{ padding: "8px 12px", borderRadius: 8, border: `1px solid ${C.border}` }}>
              {[currentYear, currentYear - 1, currentYear - 2].map(y => <option key={y} value={y}>{y}년</option>)}
            </select>
            <input type="text" value={historySearch} onChange={e => setHistorySearch(e.target.value)} placeholder="교인명 검색" style={{ padding: "8px 12px", borderRadius: 8, border: `1px solid ${C.border}`, width: 160 }} />
            <button type="button" onClick={async () => { if (!supabase) return; const { data: churchRow } = await supabase.from("churches").select("id").limit(1).maybeSingle(); if (!churchRow) return; const { data } = await supabase.from("donation_receipts").select("id, receipt_number, member_name, tax_year, total_amount, issue_date, status").eq("church_id", churchRow.id).eq("tax_year", historyYearFilter).order("created_at", { ascending: false }); setReceiptHistory(data ?? []); }} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: C.navy, color: "#fff", fontWeight: 600, cursor: "pointer" }}>조회</button>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead><tr style={{ background: C.navy, color: "#fff" }}><th style={{ padding: "10px 12px", textAlign: "left" }}>발급번호</th><th style={{ padding: "10px 12px", textAlign: "left" }}>교인명</th><th style={{ padding: "10px 12px" }}>귀속연도</th><th style={{ padding: "10px 12px", textAlign: "right" }}>총액</th><th style={{ padding: "10px 12px" }}>발급일</th><th style={{ padding: "10px 12px" }}>상태</th><th style={{ padding: "10px 12px" }}>액션</th></tr></thead>
              <tbody>
                {receiptHistory.filter(r => !historySearch.trim() || r.member_name.includes(historySearch)).map(r => (
                  <tr key={r.id} style={{ borderBottom: `1px solid ${C.borderLight}` }}>
                    <td style={{ padding: "10px 12px" }}>{r.receipt_number}</td>
                    <td style={{ padding: "10px 12px" }}>{r.member_name}</td>
                    <td style={{ padding: "10px 12px" }}>{r.tax_year}년</td>
                    <td style={{ padding: "10px 12px", textAlign: "right" }}>₩{r.total_amount.toLocaleString("ko-KR")}</td>
                    <td style={{ padding: "10px 12px" }}>{r.issue_date}</td>
                    <td style={{ padding: "10px 12px" }}><span style={{ padding: "2px 8px", borderRadius: 6, fontSize: 12, fontWeight: 600, background: r.status === "발급완료" ? C.successLight : "#fde8ed", color: r.status === "발급완료" ? C.success : C.danger }}>{r.status}</span></td>
                    <td style={{ padding: "10px 12px" }}>
                      {r.status === "발급완료" && (
                        <>
                          <button type="button" onClick={() => setReprintModal({ receipt: r, ssnFirst: "", ssnLast: "" })} style={{ marginRight: 8, padding: "4px 10px", fontSize: 12, borderRadius: 6, border: `1px solid ${C.border}`, background: C.card, cursor: "pointer" }}>재출력</button>
                          <button type="button" onClick={() => setCancelModal({ receipt: r, reason: "" })} style={{ padding: "4px 10px", fontSize: 12, borderRadius: 6, border: `1px solid ${C.danger}`, color: C.danger, background: "transparent", cursor: "pointer" }}>취소</button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {receiptHistory.length === 0 && <p style={{ margin: "16px 0 0", fontSize: 13, color: C.textMuted }}>발급 이력을 조회하려면 위에서 연도를 선택한 뒤 [조회]를 누르세요. churches 테이블과 donation_receipts 테이블이 있어야 합니다.</p>}
          {reprintModal && (
            <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={() => setReprintModal(null)}>
              <div style={{ background: C.card, borderRadius: 16, padding: 24, maxWidth: 400, width: "100%" }} onClick={e => e.stopPropagation()}>
                <h4 style={{ margin: "0 0 16px", fontSize: 16, color: C.navy }}>재출력 · 주민등록번호 입력</h4>
                <p style={{ margin: "0 0 12px", fontSize: 13, color: C.textMuted }}>{reprintModal.receipt.member_name} / {reprintModal.receipt.receipt_number}</p>
                <p style={{ margin: "0 0 12px", fontSize: 12, color: "#b91c1c" }}>⚠️ 주민등록번호는 서버에 저장되지 않으며, PDF 생성 후 즉시 폐기됩니다.</p>
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 16 }}>
                  <input type="password" inputMode="numeric" maxLength={6} value={reprintModal.ssnFirst} onChange={e => setReprintModal(m => m ? { ...m, ssnFirst: e.target.value.replace(/\D/g, "").slice(0, 6) } : null)} placeholder="앞 6자리" style={{ width: 80, padding: "8px 10px", borderRadius: 8, border: `1px solid ${C.border}` }} />
                  <span>-</span>
                  <input type="password" inputMode="numeric" maxLength={7} value={reprintModal.ssnLast} onChange={e => setReprintModal(m => m ? { ...m, ssnLast: e.target.value.replace(/\D/g, "").slice(0, 7) } : null)} placeholder="뒷 7자리" style={{ width: 90, padding: "8px 10px", borderRadius: 8, border: `1px solid ${C.border}` }} />
                </div>
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <button type="button" onClick={() => setReprintModal(null)} style={{ padding: "8px 16px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.bg, cursor: "pointer" }}>닫기</button>
                  <button type="button" disabled={reprintModal.ssnFirst.length !== 6 || reprintModal.ssnLast.length !== 7} onClick={handleReprintPdf} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: C.accent, color: "#fff", fontWeight: 600, cursor: "pointer" }}>PDF 다운로드</button>
                </div>
              </div>
            </div>
          )}
          {cancelModal && (
            <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={() => setCancelModal(null)}>
              <div style={{ background: C.card, borderRadius: 16, padding: 24, maxWidth: 400, width: "100%" }} onClick={e => e.stopPropagation()}>
                <h4 style={{ margin: "0 0 16px", fontSize: 16, color: C.navy }}>영수증 취소</h4>
                <p style={{ margin: "0 0 12px", fontSize: 13, color: C.textMuted }}>{cancelModal.receipt.member_name} / {cancelModal.receipt.receipt_number}</p>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: C.textMuted, marginBottom: 6 }}>취소 사유</label>
                <input type="text" value={cancelModal.reason} onChange={e => setCancelModal(m => m ? { ...m, reason: e.target.value } : null)} placeholder="선택 입력" style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: `1px solid ${C.border}`, marginBottom: 16 }} />
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <button type="button" onClick={() => setCancelModal(null)} style={{ padding: "8px 16px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.bg, cursor: "pointer" }}>닫기</button>
                  <button type="button" onClick={async () => { if (!cancelModal || !supabase || !churchId) return; await supabase.from("donation_receipts").update({ status: "취소", cancelled_at: new Date().toISOString(), cancel_reason: cancelModal.reason || null }).eq("church_id", churchId).eq("id", cancelModal.receipt.id); setReceiptHistory(prev => prev.map(r => r.id === cancelModal.receipt.id ? { ...r, status: "취소" } : r)); setCancelModal(null); }} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: C.danger, color: "#fff", fontWeight: 600, cursor: "pointer" }}>취소 처리</button>
                </div>
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

/* ============================================================ */
/* 메인 재정관리 컴포넌트                                         */
/* ============================================================ */
const FINANCE_ACTIVE_TAB_KEY = "finance_active_tab";
const VALID_FINANCE_TABS = new Set(["dashboard", "offering", "givingStatus", "donor", "expense", "report", "budgetActual", "budget", "export", "receipt", "cashJournal", "budgetManagement", "budgetVsActual", "donorStatistics", "specialAccounts"]);

/** 설정(교회이름, 소재지, 담임목사, 사업자등록번호)은 재정 영수증에 사용. db.members와 연동해 목양 교인 = 헌금자로 통일 */
export function FinancePage({ db, setDb, settings, toast }: { db?: DB; setDb?: (fn: (prev: DB) => DB) => void; settings?: { churchName?: string; address?: string; pastor?: string; businessNumber?: string }; toast?: (msg: string, type?: "ok" | "err" | "warn") => void }) {
  const mob = useIsMobile();
  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window === "undefined") return "dashboard";
    const s = window.sessionStorage.getItem(FINANCE_ACTIVE_TAB_KEY);
    return s && VALID_FINANCE_TABS.has(s) ? s : "dashboard";
  });
  const [localDonors, setLocalDonors] = useState<Donor[]>([]);
  const [localOfferings, setLocalOfferings] = useState<Offering[]>([]);
  const [localExpenses, setLocalExpenses] = useState<Expense[]>([]);

  const useDb = Boolean(db && setDb);
  const offerings = useMemo(() =>
    useDb && db!.income?.length !== undefined ? incomeToOfferings(db!.income) : localOfferings,
    [useDb, db?.income, localOfferings]
  );
  const expenses = useMemo(() =>
    useDb && db!.expense?.length !== undefined ? expenseDbToFp(db!.expense) : localExpenses,
    [useDb, db?.expense, localExpenses]
  );
  const setOfferings = useCallback((updater: Offering[] | ((prev: Offering[]) => Offering[])) => {
    const next = typeof updater === "function" ? updater(offerings) : updater;
    if (setDb && db) {
      setDb(prev => ({ ...prev, income: offeringsToIncome(next) }));
    } else {
      setLocalOfferings(next);
    }
  }, [db, setDb, offerings]);
  const setExpenses = useCallback((updater: Expense[] | ((prev: Expense[]) => Expense[])) => {
    const next = typeof updater === "function" ? updater(expenses) : updater;
    if (setDb && db) {
      setDb(prev => ({ ...prev, expense: expenseFpToDb(next) }));
    } else {
      setLocalExpenses(next);
    }
  }, [db, setDb, expenses]);

  const onAddIncome = useCallback(async (o: Omit<Offering, "id">) => {
    if (!supabase || !setDb || !db) return null;
    const row = { date: o.date, type: o.categoryId, amount: o.amount, donor: o.donorName || null, method: o.method || null, memo: o.note || null };
    console.log("=== INCOME INSERT 시도 ===", row);
    const { data, error } = await supabase.from("income").insert(withChurchId(row)).select("id").single();
    console.log("=== INCOME INSERT 결과 ===", { data, error });
    if (error) {
      console.error("=== INCOME DB ERROR ===", error.message, error.details, error.hint);
      alert("저장 실패: " + error.message);
      return null;
    }
    const id = (data as { id: string }).id;
    setOfferings(prev => [...prev, { ...o, id }]);
    return id;
  }, [setOfferings]);
  const onDeleteIncome = useCallback(async (id: string) => {
    if (!supabase || !setDb) return;
    console.log("=== INCOME DELETE 시도 ===", id);
    const { error } = await supabase.from("income").delete().eq("church_id", getChurchId()).eq("id", id);
    console.log("=== INCOME DELETE 결과 ===", { error });
    if (error) {
      console.error("=== INCOME DB ERROR ===", error.message, error.details, error.hint);
      alert("삭제 실패: " + error.message);
      return;
    }
    setOfferings(prev => prev.filter(o => o.id !== id));
  }, [setOfferings]);
  const onAddExpense = useCallback(async (e: Omit<Expense, "id">) => {
    if (!supabase || !setDb || !db) return null;
    const row = { date: e.date, category: e.categoryId, item: e.description || null, amount: e.amount, resolution: e.departmentId || null, memo: e.note || null };
    console.log("=== EXPENSE INSERT 시도 ===", row);
    const { data, error } = await supabase.from("expense").insert(withChurchId(row)).select("id").single();
    console.log("=== EXPENSE INSERT 결과 ===", { data, error });
    if (error) {
      console.error("=== EXPENSE DB ERROR ===", error.message, error.details, error.hint);
      alert("저장 실패: " + error.message);
      return null;
    }
    const id = (data as { id: string }).id;
    setExpenses(prev => [...prev, { ...e, id }]);
    return id;
  }, [setExpenses]);
  const onDeleteExpense = useCallback(async (id: string) => {
    if (!supabase || !setDb) return;
    console.log("=== EXPENSE DELETE 시도 ===", id);
    const { error } = await supabase.from("expense").delete().eq("church_id", getChurchId()).eq("id", id);
    console.log("=== EXPENSE DELETE 결과 ===", { error });
    if (error) {
      console.error("=== EXPENSE DB ERROR ===", error.message, error.details, error.hint);
      alert("삭제 실패: " + error.message);
      return;
    }
    setExpenses(prev => prev.filter(x => x.id !== id));
  }, [setExpenses]);

  const donors = useMemo(() => {
    if (db?.members != null) {
      return membersToDonors(db.members);
    }
    return localDonors;
  }, [db?.members, localDonors]);

  const setDonors = useCallback((updater: Donor[] | ((prev: Donor[]) => Donor[])) => {
    if (setDb && db) {
      setDb(prev => {
        const prevDonors = membersToDonors(prev.members);
        const nextDonors = typeof updater === "function" ? updater(prevDonors) : updater;
        const nextMembers = donorsToMembers(nextDonors);
        return { ...prev, members: nextMembers };
      });
    } else {
      setLocalDonors(prev => (typeof updater === "function" ? updater(prev) : updater));
    }
  }, [db, setDb]);

  const [budgetByYear, setBudgetByYear] = useState<BudgetByYear>({});

  const tabs: { id: string; label: string; Icon: React.ComponentType<any> }[] = [
    { id: "dashboard", label: "대시보드", Icon: LayoutDashboard },
    { id: "offering", label: "수입 관리", Icon: Wallet },
    { id: "expense", label: "지출 관리", Icon: Receipt },
    { id: "cashJournal", label: "현금출납장", Icon: FileText },
    { id: "budgetManagement", label: "예산 관리", Icon: PieChart },
    { id: "budgetVsActual", label: "예산 대비 실적", Icon: PieChart },
    { id: "donorStatistics", label: "헌금자 통계", Icon: Users },
    { id: "specialAccounts", label: "특별회계", Icon: Church },
    { id: "givingStatus", label: "헌금 현황", Icon: Users },
    { id: "donor", label: "헌금자 관리", Icon: Users },
    { id: "report", label: "보고서", Icon: FileText },
    { id: "budgetActual", label: "예결산", Icon: PieChart },
    { id: "budget", label: "예산 계획", Icon: PieChart },
    { id: "export", label: "엑셀 내보내기", Icon: Download },
    { id: "receipt", label: "기부금 영수증", Icon: FileSignature },
  ];

  const handleNav = (id: string) => { setActiveTab(id); };

  useEffect(() => {
    if (typeof window !== "undefined" && VALID_FINANCE_TABS.has(activeTab)) {
      window.sessionStorage.setItem(FINANCE_ACTIVE_TAB_KEY, activeTab);
    }
  }, [activeTab]);

  const navSections = [{ sectionLabel: "재정", items: tabs.map((t) => ({ id: t.id, label: t.label, Icon: t.Icon })) }];
  const activeLabel = tabs.find(t => t.id === activeTab)?.label ?? "대시보드";

  return (
    <UnifiedPageLayout
      pageTitle="재정"
      pageSubtitle={new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" })}
      navSections={navSections}
      activeId={activeTab}
      onNav={handleNav}
      versionText="재정 v1.0"
      headerTitle={activeLabel}
      headerDesc="교회 재정 관리 시스템"
      headerActions={!mob ? <Badge color={C.success} bg={C.successLight}>● 정상 운영중</Badge> : undefined}
      SidebarIcon={Church}
    >
          {activeTab === "dashboard" && (
            <FinanceDashboard
              offerings={offerings}
              expenses={expenses}
              incomeCategories={DEFAULT_CATEGORIES}
              expenseCategories={EXPENSE_CATEGORIES}
              onAddIncome={() => setActiveTab("offering")}
              onAddExpense={() => setActiveTab("expense")}
              onOpenCashJournal={() => setActiveTab("cashJournal")}
              onOpenBudget={() => setActiveTab("budgetManagement")}
            />
          )}
          {activeTab === "offering" && <OfferingTab offerings={offerings} setOfferings={setOfferings} donors={donors} categories={DEFAULT_CATEGORIES} onAddIncome={onAddIncome} onDeleteIncome={onDeleteIncome} />}
          {activeTab === "givingStatus" && <GivingStatusTab donors={donors} offerings={offerings} categories={DEFAULT_CATEGORIES} />}
          {activeTab === "donor" && <DonorTab donors={donors} setDonors={setDonors} offerings={offerings} />}
          {activeTab === "expense" && <ExpenseTab expenses={expenses} setExpenses={setExpenses} departments={DEFAULT_DEPARTMENTS} expenseCategories={EXPENSE_CATEGORIES} onAddExpense={onAddExpense} />}
          {activeTab === "cashJournal" && <CashJournal toast={toast ?? (() => {})} />}
          {activeTab === "budgetManagement" && <BudgetManagement fiscalYear={String(new Date().getFullYear())} toast={toast ?? (() => {})} />}
          {activeTab === "budgetVsActual" && <BudgetVsActual year={String(new Date().getFullYear())} month={new Date().getMonth() + 1} toast={toast ?? (() => {})} />}
          {activeTab === "donorStatistics" && <DonorStatistics year={String(new Date().getFullYear())} offerings={offerings} donors={donors} categories={DEFAULT_CATEGORIES} receiptSettings={settings} />}
          {activeTab === "specialAccounts" && <SpecialAccounts toast={toast ?? (() => {})} />}
          {activeTab === "report" && <ReportTab offerings={offerings} expenses={expenses} categories={DEFAULT_CATEGORIES} departments={DEFAULT_DEPARTMENTS} expenseCategories={EXPENSE_CATEGORIES} />}
          {activeTab === "budgetActual" && <BudgetActualTab offerings={offerings} expenses={expenses} categories={DEFAULT_CATEGORIES} expenseCategories={EXPENSE_CATEGORIES} budgetByYear={budgetByYear} setBudgetByYear={setBudgetByYear} />}
          {activeTab === "budget" && <BudgetTab departments={DEFAULT_DEPARTMENTS} expenses={expenses} />}
          {activeTab === "export" && <ExportTab offerings={offerings} expenses={expenses} categories={DEFAULT_CATEGORIES} departments={DEFAULT_DEPARTMENTS} expenseCategories={EXPENSE_CATEGORIES} donors={donors} />}
          {activeTab === "receipt" && <ReceiptTab donors={donors} offerings={offerings} settings={settings} toast={toast} />}
    </UnifiedPageLayout>
  );
}
