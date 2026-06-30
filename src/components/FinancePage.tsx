"use client";

import { useState, useMemo, useCallback, useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { flushSync } from "react-dom";
import type { SupabaseClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { LayoutDashboard, Wallet, Users, Receipt, FileText, PieChart, Download, FileSignature, Church, Settings, Scale, TrendingDown } from "lucide-react";
import { UnifiedPageLayout } from "@/components/layout/UnifiedPageLayout";
import { SealSettingsSection } from "@/components/finance/SealSettingsSection";
import { CashJournal } from "@/components/finance/CashJournal";
import { BudgetManagement } from "@/components/finance/BudgetManagement";
import { BudgetVsActual } from "@/components/finance/BudgetVsActual";
import {
  budgetYearToolbarRowStyle,
  budgetYearLabelStyle,
  budgetYearSelectStyle,
} from "@/components/finance/budgetYearToolbarStyles";
import { DonorStatistics } from "@/components/finance/DonorStatistics";
import { SpecialAccounts } from "@/components/finance/SpecialAccounts";
import { Pagination, PAGINATION_LIST_PARENT_STYLE } from "@/components/common/Pagination";
import { PcModalShell } from "@/components/common/PcModalShell";
import LazyChart from "@/components/common/LazyChart";
import { CalendarDropdown } from "@/components/CalendarDropdown";
import type { DB, Member, Income as DBIncome, Expense as DBExpense } from "@/types/db";
import { supabase } from "@/lib/supabase";
import { getChurchId } from "@/lib/tenant";
import { initKakao, shareTextToKakao } from "@/lib/kakao";
import { useAppData } from "@/contexts/AppDataContext";

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
  { id: "sunday", name: "주일헌금", color: "var(--color-primary)", icon: "" },
  { id: "tithe", name: "십일조", color: "var(--color-primary)", icon: "" },
  { id: "thanks", name: "감사헌금", color: "var(--color-primary)", icon: "" },
  { id: "building", name: "건축헌금", color: "var(--color-primary)", icon: "" },
  { id: "mission", name: "선교헌금", color: "var(--color-primary)", icon: "" },
  { id: "other", name: "기타", color: "var(--color-primary)", icon: "" },
];

/* ---------- 기본 부서 ---------- */
interface Department { id: string; name: string; color: string; }
const DEFAULT_DEPARTMENTS: Department[] = [
  { id: "worship", name: "예배부", color: "var(--color-primary)" },
  { id: "education", name: "교육부", color: "var(--color-primary)" },
  { id: "mission_dept", name: "선교부", color: "var(--color-primary)" },
  { id: "youth_dept", name: "청년부", color: "var(--color-primary)" },
  { id: "children_dept", name: "주일학교부", color: "var(--color-primary)" },
  { id: "facility", name: "시설관리부", color: "var(--color-primary)" },
  { id: "admin", name: "행정부", color: "var(--color-primary)" },
  { id: "social", name: "사회봉사부", color: "var(--color-primary)" },
  { id: "music", name: "찬양부", color: "var(--color-primary)" },
  { id: "general", name: "총무부", color: "var(--color-primary)" },
];

/* ---------- 지출 카테고리 ---------- */
interface ExpCategory { id: string; name: string; icon: string; }
const EXPENSE_CATEGORIES: ExpCategory[] = [
  { id: "salary", name: "인건비", icon: "" },
  { id: "rent", name: "임대료/관리비", icon: "" },
  { id: "utility", name: "공과금", icon: "" },
  { id: "supply", name: "비품/소모품", icon: "" },
  { id: "event", name: "행사비", icon: "" },
  { id: "mission_exp", name: "선교비", icon: "" },
  { id: "education_exp", name: "교육비", icon: "" },
  { id: "maintenance", name: "시설유지비", icon: "" },
  { id: "transport", name: "교통비", icon: "" },
  { id: "food", name: "식비/다과", icon: "" },
  { id: "other_exp", name: "기타지출", icon: "" },
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
  Export: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>,
  Receipt: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6M9 15h6M9 11h6M9 7h2"/></svg>,
  Plus: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>,
  Search: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>,
  X: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>,
  TrendUp: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 6l-9.5 9.5-5-5L1 18"/><path d="M17 6h6v6"/></svg>,
  TrendDown: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 18l-9.5-9.5-5 5L1 6"/><path d="M17 18h6v-6"/></svg>,
  Church: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 2v4M10 6h4M8 6v4l-5 3v9h18v-9l-5-3V6"/><rect x="10" y="16" width="4" height="6"/></svg>,
};

/* ---------- 스타일 (Planning Center 톤 + 기존 C.* 호환) ---------- */
const C = {
  primary: "var(--color-primary)",
  primaryHover: "var(--color-primary-hover)",
  primaryLight: "var(--color-primary-soft)",
  primaryLighter: "color-mix(in srgb, var(--color-primary) 14%, var(--color-surface-elevated))",

  // 텍스트
  text1: "var(--color-text)",
  text2: "var(--color-text-muted)",
  text3: "var(--color-text-faint)",

  // 배경·표면
  bg: "var(--color-surface-muted)",
  surface: "var(--color-surface)",
  surfaceHover: "var(--color-surface-elevated)",

  // 테두리 — 아주 연한 회청색
  border: "var(--color-border)",
  borderLight: "var(--color-border-soft)",

  // 수입·지출
  income: "var(--color-success)",
  incomeLight: "color-mix(in srgb, var(--color-success) 14%, var(--color-surface-elevated))",
  expense: "var(--color-danger)",
  expenseLight: "color-mix(in srgb, var(--color-danger) 14%, var(--color-surface-elevated))",

  // 잔액 (숫자는 본문색)
  balance: "var(--color-text)",
  balanceLight: "var(--color-surface-elevated)",

  // 차트 — 파스텔 톤 통일
  chart1: "var(--color-primary)",
  chart2: "#8b6caf",
  chart3: "#5aab8b",
  chart4: "#d4a24c",
  chart5: "#c7729a",

  // 그림자 — 아주 연하게
  shadow: "0 1px 3px rgba(0,0,0,0.04)",
  shadowMd: "0 4px 12px rgba(0,0,0,0.04)",

  // 기본
  white: "var(--color-primary-on)",
  danger: "var(--color-danger)",
  dangerLight: "color-mix(in srgb, var(--color-danger) 14%, var(--color-surface-elevated))",
  warning: "var(--color-warning)",
  warningLight: "color-mix(in srgb, var(--color-warning) 16%, var(--color-surface-elevated))",

  // 호환 별칭 (다른 탭과 동일 토큰명)
  navy: "var(--color-text)",
  accent: "var(--color-primary)",
  card: "var(--color-surface)",
  text: "var(--color-text)",
  textSub: "var(--color-text-muted)",
  textFaint: "var(--color-text-faint)",
  textMuted: "var(--color-text-muted)",
  success: "var(--color-success)",
  purple: "#8b6caf",
  purpleLight: "#f0ecf5",
  blue: "var(--color-primary)",
  blueBg: "color-mix(in srgb, var(--color-primary) 14%, var(--color-surface-elevated))",
  accentLight: "var(--color-primary-soft)",
  accentBg: "color-mix(in srgb, var(--color-primary) 14%, var(--color-surface-elevated))",
  successLight: "color-mix(in srgb, var(--color-success) 14%, var(--color-surface-elevated))",
} as const;

/** 재정 상단 2×2 카테고리 버튼 */
function financeCategoryGridBtnStyle(selected: boolean, mob = true): CSSProperties {
  const active: CSSProperties = {
    width: "100%",
    padding: mob ? "10px 12px" : "10px 20px",
    borderRadius: 10,
    fontWeight: 600,
    fontSize: mob ? 12 : 14,
    background: C.primary,
    color: C.white,
    border: "none",
    cursor: "pointer",
    boxShadow: "0 2px 8px color-mix(in srgb, var(--color-primary) 25%, transparent)",
    transition: "all 0.15s ease",
    whiteSpace: "nowrap",
    outline: "none",
    WebkitTapHighlightColor: "transparent",
    fontFamily: "inherit",
  };
  const inactive: CSSProperties = {
    width: "100%",
    padding: mob ? "10px 12px" : "10px 20px",
    borderRadius: 10,
    fontWeight: 500,
    fontSize: mob ? 12 : 14,
    background: C.surface,
    color: C.text2,
    border: "1px solid var(--color-border)",
    cursor: "pointer",
    boxShadow: "none",
    transition: "all 0.15s ease",
    whiteSpace: "nowrap",
    outline: "none",
    WebkitTapHighlightColor: "transparent",
    fontFamily: "inherit",
  };
  return selected ? active : inactive;
}

/** 하위 pill — 한 줄 균등(flex:1) / 그리드 셀 */
function financeSubTabStyle(isSelected: boolean, layout: "rowEqual" | "gridCell" = "rowEqual", mob = true): CSSProperties {
  const fs = mob ? 11 : 14;
  const base: CSSProperties = {
    boxSizing: "border-box",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: fs,
    fontWeight: isSelected ? 600 : 500,
    padding: mob ? "8px 10px" : "10px 18px",
    border: isSelected ? `1px solid ${C.primary}` : "1px solid var(--color-border)",
    background: isSelected ? C.primaryLighter : C.surface,
    color: isSelected ? C.primary : C.text3,
    whiteSpace: "nowrap",
    lineHeight: 1.2,
    cursor: "pointer",
    outline: "none",
    boxShadow: "none",
    transition: "color 0.15s ease, border-color 0.15s ease, background-color 0.15s ease",
    WebkitTapHighlightColor: "transparent",
    fontFamily: "inherit",
    textAlign: "center",
    overflow: "hidden",
    textOverflow: "ellipsis",
    marginBottom: 0,
    borderRadius: mob ? 8 : 10,
  };
  if (layout === "gridCell") {
    return { ...base, width: "100%", boxSizing: "border-box" };
  }
  return { ...base, flex: 1, minWidth: 0 };
}

const financeSubTabRowStyle: CSSProperties = {
  display: "flex",
  gap: 6,
  marginBottom: 10,
  width: "100%",
  alignItems: "stretch",
  borderBottom: "none",
};

/** 보고서 유형·예결산 등 2~5개 토글 — 동일 규격 */
function financeTogglePillStyle(isSelected: boolean, mob = true): CSSProperties {
  return financeSubTabStyle(isSelected, "rowEqual", mob);
}

/** 주간 등 많은 항목: 가로 스크롤 + 최소 너비(약 4칸 노출) */
function financeScrollRowPillStyle(isSelected: boolean, mob = true): CSSProperties {
  const fs = mob ? 10 : 13;
  return {
    fontSize: fs,
    fontWeight: isSelected ? 600 : 500,
    padding: mob ? "8px 10px" : "10px 14px",
    border: isSelected ? `1px solid ${C.primary}` : "1px solid var(--color-border)",
    background: isSelected ? C.primaryLighter : C.surface,
    color: isSelected ? C.primary : C.text3,
    whiteSpace: "nowrap",
    lineHeight: 1.2,
    cursor: "pointer",
    outline: "none",
    boxShadow: "none",
    transition: "color 0.15s ease, border-color 0.15s ease, background-color 0.15s ease",
    fontFamily: "inherit",
    textAlign: "center",
    flex: "0 0 auto",
    minWidth: "calc((100% - 16px) / 4)",
    boxSizing: "border-box",
    marginBottom: 0,
    borderRadius: mob ? 8 : 10,
  };
}

function financeTableHeaderTh(align: "left" | "right" | "center" = "left", mob = false): CSSProperties {
  return {
    padding: mob ? "8px 10px" : "12px 16px",
    fontWeight: 600,
    fontSize: mob ? 10 : 13,
    color: C.text3,
    textAlign: align,
    borderBottom: "2px solid var(--color-border)",
    background: C.surfaceHover,
    letterSpacing: "0.02em",
    textTransform: "uppercase",
    whiteSpace: "nowrap",
  };
}

function financeTableCellTd(_isEven: boolean, align: "left" | "right" | "center" = "left", mob = false): CSSProperties {
  return {
    padding: mob ? "8px 10px" : "12px 16px",
    fontSize: mob ? 11 : 14,
    color: C.text1,
    textAlign: align,
    borderBottom: "1px solid var(--color-border-soft)",
    fontVariantNumeric: "tabular-nums",
    background: C.surface,
  };
}

function financeTableTotalRowTd(align: "left" | "right" | "center" = "left", mob = false): CSSProperties {
  return {
    padding: mob ? "10px 10px" : "14px 16px",
    fontWeight: 700,
    fontSize: mob ? 12 : 15,
    color: C.text1,
    textAlign: align,
    borderTop: "2px solid var(--color-border)",
    background: C.primaryLighter,
  };
}

type FinanceCategoryId = "fin_income" | "fin_budget" | "fin_giving" | "fin_reports";

const LEAF_TO_FINANCE_CATEGORY: Record<string, FinanceCategoryId> = {
  dashboard: "fin_income",
  offering: "fin_income",
  expense: "fin_income",
  cashJournal: "fin_income",
  budgetManagement: "fin_budget",
  budgetVsActual: "fin_budget",
  budgetActual: "fin_budget",
  budget: "fin_budget",
  donorStatistics: "fin_giving",
  givingStatus: "fin_giving",
  donor: "fin_giving",
  specialAccounts: "fin_giving",
  report: "fin_reports",
  export: "fin_reports",
  receipt: "fin_reports",
};

const FINANCE_CATEGORY_FIRST_TAB: Record<FinanceCategoryId, string> = {
  fin_income: "dashboard",
  fin_budget: "budgetManagement",
  fin_giving: "donorStatistics",
  fin_reports: "report",
};

const FINANCE_CATEGORY_GRID: { id: FinanceCategoryId; label: string }[][] = [
  [
    { id: "fin_income", label: "수입/지출" },
    { id: "fin_budget", label: "예산" },
  ],
  [
    { id: "fin_giving", label: "헌금" },
    { id: "fin_reports", label: "보고/설정" },
  ],
];

const FINANCE_SUB_TABS_BY_CATEGORY: Record<FinanceCategoryId, { id: string; label: string }[]> = {
  fin_income: [
    { id: "dashboard", label: "대시보드" },
    { id: "offering", label: "수입 관리" },
    { id: "expense", label: "지출 관리" },
    { id: "cashJournal", label: "현금출납장" },
  ],
  fin_budget: [
    { id: "budgetManagement", label: "예산 관리" },
    { id: "budgetVsActual", label: "예산 대비 실적" },
    { id: "budgetActual", label: "예결산" },
    { id: "budget", label: "예산 계획" },
  ],
  fin_giving: [
    { id: "donorStatistics", label: "헌금자 통계" },
    { id: "givingStatus", label: "헌금 현황" },
    { id: "donor", label: "헌금자 관리" },
    { id: "specialAccounts", label: "특별회계" },
  ],
  fin_reports: [
    { id: "report", label: "보고서" },
    { id: "export", label: "엑셀보내기" },
    { id: "receipt", label: "기부금 영수증" },
  ],
};

function financeStickyNavShell(mob: boolean): CSSProperties {
  return {
    position: "sticky",
    top: 0,
    zIndex: 25,
    width: "calc(100% + " + (mob ? "20" : "48") + "px)",
    marginLeft: mob ? -10 : -24,
    marginRight: mob ? -10 : -24,
    paddingLeft: mob ? 10 : 24,
    paddingRight: mob ? 10 : 24,
    paddingTop: 8,
    paddingBottom: mob ? 10 : 8,
    background: C.bg,
    backgroundColor: C.bg,
    boxShadow: C.shadow,
    marginBottom: mob ? 8 : 12,
    boxSizing: "border-box",
  };
}

function FinanceCategoryNav({ activeTab, onLeafChange }: { activeTab: string; onLeafChange: (id: string) => void }) {
  const mob = useIsMobile();
  const category = LEAF_TO_FINANCE_CATEGORY[activeTab] ?? "fin_income";
  return (
    <div style={{ width: "100%", maxWidth: "100%", display: "flex", flexDirection: "column", gap: mob ? 4 : 4 }}>
      <div style={{ marginBottom: 0 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: mob ? 4 : 8, width: "100%" }}>
          {FINANCE_CATEGORY_GRID[0].map((c) => (
            <button
              key={c.id}
              type="button"
              className="finance-nav-btn"
              style={mob ? financeCategoryGridBtnStyle(category === c.id, true) : { ...financeCategoryGridBtnStyle(category === c.id, false), minHeight: 40, fontSize: 14, borderRadius: 8 }}
              onClick={() => onLeafChange(FINANCE_CATEGORY_FIRST_TAB[c.id])}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>
      <div style={{ marginBottom: 0 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: mob ? 4 : 8, width: "100%" }}>
          {FINANCE_CATEGORY_GRID[1].map((c) => (
            <button
              key={c.id}
              type="button"
              className="finance-nav-btn"
              style={mob ? financeCategoryGridBtnStyle(category === c.id, true) : { ...financeCategoryGridBtnStyle(category === c.id, false), minHeight: 40, fontSize: 14, borderRadius: 8 }}
              onClick={() => onLeafChange(FINANCE_CATEGORY_FIRST_TAB[c.id])}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>
      <div className="finance-sub-pills" style={{ ...financeSubTabRowStyle, gap: mob ? 4 : 8, marginBottom: 0 }}>
        {FINANCE_SUB_TABS_BY_CATEGORY[category].map((t) => (
          <button
            key={t.id}
            type="button"
            className="finance-nav-btn"
            style={financeSubTabStyle(activeTab === t.id, "rowEqual", mob)}
            onClick={() => onLeafChange(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ---------- 공통 컴포넌트 ---------- */
function Card({ children, style, onClick }: { children: ReactNode; style?: CSSProperties; onClick?: () => void }) {
  const mob = useIsMobile();
  return (
    <div onClick={onClick} style={{
      background: C.surface, borderRadius: mob ? 12 : 12, border: `1px solid ${C.border}`,
      boxShadow: C.shadow, padding: mob ? "10px 12px" : 24, transition: "all 0.2s ease", cursor: onClick ? "pointer" : "default", ...style,
    }}>{children}</div>
  );
}

function Badge({ children, color = C.navy, bg, fontSize }: { children: ReactNode; color?: string; bg?: string; fontSize?: number }) {
  const mob = useIsMobile();
  const fs = fontSize ?? (mob ? 10 : 12);
  const pad = mob ? "2px 6px" : "3px 10px";
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: pad, borderRadius: 4, fontSize: fs, fontWeight: 600,
      color, background: bg ?? "#f0f2f5", whiteSpace: "nowrap", border: "none",
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
    primary: { background: C.primary, color: "var(--color-primary-on)" },
    accent: { background: C.primary, color: "var(--color-primary-on)" },
    success: { background: C.income, color: "var(--color-primary-on)" },
    danger: { background: C.dangerLight, color: C.danger, border: `1px solid ${C.border}` },
    ghost: { background: "transparent", color: C.primary, border: `1px solid ${C.border}` },
    soft: { background: C.primaryLighter, color: C.text2, border: `1px solid ${C.border}` },
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
      {label && <label style={{ fontSize: 13, fontWeight: 600, color: C.textSub }}>{label}</label>}
      <input className={className} {...(props as React.InputHTMLAttributes<HTMLInputElement>)} style={{
        padding: "10px 14px", borderRadius: 10, border: `1px solid ${C.border}`,
        fontSize: 14, fontFamily: "inherit", color: C.text, background: "var(--color-surface)",
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
      {label && <label style={{ fontSize: 13, fontWeight: 600, color: C.textSub }}>{label}</label>}
      <select {...(props as React.SelectHTMLAttributes<HTMLSelectElement>)} style={{
        padding: "10px 14px", borderRadius: 10, border: `1px solid ${C.border}`,
        fontSize: 14, fontFamily: "inherit", color: C.text, background: "var(--color-surface)",
        outline: "none", cursor: "pointer", ...(props.style as CSSProperties || {}),
      }}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function StatCard({ label, value, icon, color, sub }: {
  label: string;
  value: string;
  icon: ReactNode;
  color: string;
  sub?: string;
}) {
  const colorMap: Record<string, { bg: string; text: string; iconBg: string; iconColor: string }> = {
    [C.income]: { bg: C.incomeLight, text: C.income, iconBg: "#f0f1f5", iconColor: "#6b7280" },
    [C.expense]: { bg: C.expenseLight, text: C.expense, iconBg: "#f0f1f5", iconColor: "#6b7280" },
    [C.primary]: { bg: C.balanceLight, text: C.balance, iconBg: "#f0f1f5", iconColor: "#6b7280" },
    [C.chart2]: { bg: C.purpleLight, text: C.chart2, iconBg: "#f0f1f5", iconColor: "#6b7280" },
  };
  const cm = colorMap[color] ?? { bg: C.primaryLighter, text: C.text1, iconBg: "#f0f1f5", iconColor: "#6b7280" };

  return (
    <div
      style={{
        background: C.surface,
        borderRadius: 12,
        border: "1px solid var(--color-border)",
        padding: "16px 20px",
        display: "flex",
        alignItems: "center",
        gap: 16,
        boxShadow: C.shadow,
        transition: "box-shadow 0.2s, transform 0.2s",
        flex: 1,
        minWidth: 0,
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 12,
          background: cm.iconBg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <span style={{ color: cm.iconColor, display: "flex", alignItems: "center", justifyContent: "center" }}>{icon}</span>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: C.text3,
            marginBottom: 4,
            letterSpacing: "0.02em",
          }}
        >
          {label}
        </div>
        <div
          style={{
            fontSize: 20,
            fontWeight: 700,
            color: cm.text,
            letterSpacing: "-0.02em",
            lineHeight: 1.2,
          }}
        >
          {value}
        </div>
        {sub && (
          <div style={{ fontSize: 12, color: C.text3, marginTop: 4 }}>{sub}</div>
        )}
      </div>
    </div>
  );
}

interface ColDef { label: string; key?: string; align?: string; render?: (row: Record<string, unknown>) => ReactNode; }

function Table({ columns, data, emptyMsg = "데이터가 없습니다" }: {
  columns: ColDef[]; data: Record<string, unknown>[]; emptyMsg?: string;
}) {
  const mob = useIsMobile();
  return (
    <div
      style={{
        background: C.surface,
        borderRadius: 12,
        border: "1px solid var(--color-border)",
        overflow: "hidden",
        boxShadow: C.shadow,
      }}
    >
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            {columns.map((col, i) => (
              <th key={i} style={{
                padding: mob ? "6px 8px" : "10px 14px", textAlign: (col.align || "left") as "left"|"right"|"center",
                fontWeight: 700, color: C.text3, fontSize: mob ? 10 : 13, borderBottom: "2px solid var(--color-border)", whiteSpace: "nowrap",
                background: C.surfaceHover, letterSpacing: "0.02em", textTransform: "uppercase",
              }}>{col.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr><td colSpan={columns.length} style={{ padding: mob ? 40 : 60, textAlign: "center", color: "var(--color-text-faint)", fontSize: mob ? 12 : 14 }}>{emptyMsg}</td></tr>
          ) : data.map((row, ri) => (
            <tr key={ri} style={{
              borderBottom: `1px solid ${C.borderLight}`,
              background: C.surface,
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = C.surfaceHover; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = C.surface; }}>
              {columns.map((col, ci) => (
                <td key={ci} style={{
                  padding: mob ? 8 : "12px 14px", textAlign: (col.align || "left") as "left"|"right"|"center",
                  color: C.text1, fontSize: mob ? 11 : 14, whiteSpace: "nowrap",
                  fontVariantNumeric: "tabular-nums",
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
      <div style={{ display: "grid", gridTemplateColumns: mob ? "1fr 1fr" : "repeat(auto-fit, minmax(220px, 1fr))", gap: mob ? 8 : 16 }}>
        <StatCard label="총 헌금액" value={`₩${fmt(totalOffering)}`} sub="2025년 누계" color={C.income} icon={<Wallet size={22} strokeWidth={2} />} />
        <StatCard label="총 지출액" value={`₩${fmt(totalExpense)}`} sub="2025년 누계" color={C.expense} icon={<Receipt size={22} strokeWidth={2} />} />
        <StatCard
          label="잔액 (수입-지출)"
          value={`₩${fmt(balance)}`}
          sub={balance >= 0 ? "흑자" : "적자"}
          color={balance >= 0 ? C.balance : C.expense}
          icon={balance >= 0 ? <Scale size={22} strokeWidth={2} /> : <TrendingDown size={22} strokeWidth={2} />}
        />
        <StatCard label="헌금자 수" value={`${uniqueDonors}명`} sub="활성 헌금자" color={C.chart2} icon={<Users size={22} strokeWidth={2} />} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: mob ? "1fr" : "1fr 1fr", gap: 16 }}>
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h4 style={{ margin: 0, color: C.navy, fontSize: 16 }}>월별 헌금 추이</h4>
            <Badge color={C.white} bg={C.primary}>2025년</Badge>
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
                    background: "linear-gradient(to top, var(--color-success), color-mix(in srgb, var(--color-success) 62%, transparent))",
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
            <Badge color={C.white} bg={C.primary}>2025년</Badge>
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
                    background: "linear-gradient(to top, var(--color-danger), color-mix(in srgb, var(--color-danger) 62%, transparent))",
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
              <span style={{ fontWeight: 700, color: C.success }}>₩{fmt(r.amount as number)}</span>
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
  const mob = useIsMobile();

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

  const compactSel: CSSProperties = {
    height: mob ? 32 : 40,
    fontSize: mob ? 11 : 14,
    padding: mob ? "0 8px" : "0 14px",
    borderRadius: mob ? 6 : 10,
    border: `1px solid ${C.border}`,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: mob ? 20 : 24 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: mob ? 8 : 12, alignItems: "center" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 160 }}>
          <div style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: C.textMuted }}><Icons.Search /></div>
          <input value={search} onChange={e => { setSearch(e.target.value); setCurrentPage(1); }} placeholder="헌금자 검색..."
            style={{ width: "100%", boxSizing: "border-box", height: mob ? 32 : 40, padding: mob ? "0 12px 0 32px" : "0 14px 0 36px", borderRadius: mob ? 6 : 10, border: `1px solid ${C.border}`, fontSize: mob ? 12 : 14, fontFamily: "inherit", outline: "none" }} />
        </div>
        <Select style={compactSel} options={[{ value: "all", label: "전체 항목" }, ...categories.map(c => ({ value: c.id, label: c.name }))]}
          value={filterCat} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => { setFilterCat(e.target.value); setCurrentPage(1); }} />
        <Select style={compactSel} options={[{ value: "all", label: "전체 월" }, ...MONTHS.map((m, i) => ({ value: String(i+1).padStart(2,"0"), label: m }))]}
          value={filterMonth} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => { setFilterMonth(e.target.value); setCurrentPage(1); }} />
        <span style={{ fontSize: mob ? 12 : 14, fontWeight: 700, color: C.navy, whiteSpace: "nowrap" }}>합계: ₩{fmt(filteredTotal)}</span>
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          style={{ height: mob ? 32 : 40, fontSize: mob ? 11 : 14, fontWeight: 600, padding: mob ? "0 12px" : "0 20px", borderRadius: mob ? 6 : 10, background: C.primary, color: "var(--color-primary-on)", border: "none", cursor: "pointer", whiteSpace: "nowrap" }}
        >
          헌금 등록
        </button>
      </div>
      <div ref={listRef} style={{ ...PAGINATION_LIST_PARENT_STYLE }}>
      <Table
        columns={[
          { label: "날짜", key: "date" },
          { label: "헌금자", render: (r) => <span style={{ fontWeight: 600 }}>{r.donorName as string}</span> },
          { label: "항목", render: (r) => { const cat = categories.find(c => c.id === r.categoryId); return cat ? <Badge color={C.navy} bg="#f0f2f5">{cat.name}</Badge> : (r.categoryId as string); }},
          { label: "방법", render: (r) => <Badge color={C.textMuted} bg={C.surfaceHover}>{r.method as string}</Badge> },
          { label: "금액", align: "right", render: (r) => <span style={{ fontWeight: 700, color: C.navy }}>₩{fmt(r.amount as number)}</span> },
          { label: "", align: "center", render: (r) => <button onClick={() => handleDelete(r.id as string)} style={{ background: "none", border: "none", cursor: "pointer", color: C.textMuted, fontSize: mob ? 12 : 14, padding: 4 }}>삭제</button> },
        ]}
        data={filtered.slice((currentPage - 1) * 10, currentPage * 10) as unknown as Record<string, unknown>[]}
        emptyMsg="헌금 내역이 없습니다"
      />
      <Pagination totalItems={filtered.length} itemsPerPage={10} currentPage={currentPage} onPageChange={(p) => setCurrentPage(p)} />
      </div>
      <PcModalShell open={showAdd} onClose={() => setShowAdd(false)} title="헌금 등록">
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: C.textSub }}>헌금자</label>
            <input
              type="text"
              value={form.donorName}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, donorName: e.target.value }))}
              placeholder="이름 입력 (비워두면 익명)"
              list="offering-donor-list"
              style={{ padding: "12px 14px", borderRadius: 12, border: `1px solid ${C.border}`, fontSize: 15, fontFamily: "inherit", color: C.navy, background: "var(--color-surface)", outline: "none" }}
            />
            <datalist id="offering-donor-list">
              {donors.filter(d => d.name !== "익명").map(d => <option key={d.id} value={d.name} />)}
            </datalist>
          </div>
          <Select label="헌금 항목" value={form.categoryId} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setForm(f => ({ ...f, categoryId: e.target.value }))}
            options={categories.map(c => ({ value: c.id, label: c.name }))} />
          <Input label="금액 (원)" type="number" value={form.amount} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="100000" />
          <CalendarDropdown label="날짜" value={form.date} onChange={(v) => setForm(f => ({ ...f, date: v }))} />
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: C.textSub }}>헌금 방법</label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {(["현금", "계좌이체", "온라인"] as const).map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, method: m }))}
                  style={{
                    padding: "10px 18px",
                    borderRadius: 12,
                    border: `2px solid ${form.method === m ? C.primary : C.border}`,
                    background: form.method === m ? C.surfaceHover : C.surface,
                    color: form.method === m ? C.primary : C.text,
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
      </PcModalShell>
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
  const mob = useIsMobile();

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
    <div style={{ display: "flex", flexDirection: "column", gap: mob ? 20 : 24 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: mob ? 8 : 12, alignItems: "center" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
          <div style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: C.textMuted }}><Icons.Search /></div>
          <input value={search} onChange={e => { setSearch(e.target.value); setCurrentPage(1); }} placeholder="이름 또는 연락처 검색..."
            style={{ width: "100%", boxSizing: "border-box", height: mob ? 32 : 40, padding: mob ? "0 12px 0 32px" : "0 14px 0 36px", borderRadius: mob ? 6 : 10, border: `1px solid ${C.border}`, fontSize: mob ? 12 : 14, fontFamily: "inherit", outline: "none" }} />
        </div>
        <Badge color={C.navy} bg="#f0f2f5">총 {donors.length}명</Badge>
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          style={{ height: mob ? 32 : 40, fontSize: mob ? 11 : 14, fontWeight: 600, padding: mob ? "0 12px" : "0 20px", borderRadius: mob ? 6 : 10, background: C.primary, color: "var(--color-primary-on)", border: "none", cursor: "pointer", whiteSpace: "nowrap" }}
        >
          헌금자 등록
        </button>
      </div>
      <div ref={listRef} style={{ ...PAGINATION_LIST_PARENT_STYLE }}>
      <Table
        columns={[
          { label: "이름", render: (r) => <span style={{ fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display: "inline-block", maxWidth: "100%" }} title={r.name as string}>{r.name as string}</span> },
          { label: "연락처", key: "phone" },
          { label: "소속", render: (r) => (r.group as string) ? <Badge color={C.navy} bg="#f0f2f5">{r.group as string}</Badge> : <span>-</span> },
          { label: "등록일", key: "joinDate" },
          { label: "헌금 횟수", align: "center", render: (r) => <span>{donorStats[r.id as string]?.count || 0}회</span> },
          { label: "헌금 합계", align: "right", render: (r) => <span style={{ fontWeight: 700, color: C.navy }}>₩{fmt(donorStats[r.id as string]?.total || 0)}</span> },
          { label: "최근 헌금일", render: (r) => <span>{donorStats[r.id as string]?.lastDate || "-"}</span> },
          { label: "메모", render: (r) => (r.note as string) ? <span style={{ color: C.textMuted, fontSize: mob ? 12 : 14 }}>{r.note as string}</span> : <span>-</span> },
        ]}
        data={paginatedDonors as unknown as Record<string, unknown>[]}
        emptyMsg="등록된 헌금자가 없습니다"
      />
      <Pagination totalItems={filtered.length} itemsPerPage={10} currentPage={currentPage} onPageChange={(p) => setCurrentPage(p)} />
      </div>
      <PcModalShell open={showAdd} onClose={() => setShowAdd(false)} title="헌금자 등록">
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
      </PcModalShell>
    </div>
  );
}

/* ====== 헌금 현황 (교인별 통계) ====== */

function GivingStatusTab({ donors, offerings, categories }: {
  donors: Donor[]; offerings: Offering[]; categories: Category[];
}) {
  const mob = useIsMobile();
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
    <th style={{ padding: mob ? "6px 8px" : "10px 14px", textAlign: align, fontWeight: 600, color: C.text3, fontSize: mob ? 10 : 11, borderBottom: `2px solid ${C.border}`, background: C.surfaceHover, whiteSpace: "nowrap", cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.5px" }} onClick={() => toggleSort(keyName)}>
      {label} {sortKey === keyName ? (sortDir === "asc" ? "↑" : "↓") : ""}
    </th>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: mob ? 20 : 24 }}>
      <div style={{ display: "flex", gap: mob ? 12 : 16, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ position: "relative" }}>
          <div style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }}><Icons.Search /></div>
          <input value={search} onChange={e => { setSearch(e.target.value); setCurrentPage(1); }} placeholder="이름 검색..."
            style={{ height: mob ? 32 : 40, padding: mob ? "0 12px 0 32px" : "0 14px 0 36px", borderRadius: mob ? 6 : 10, border: `1px solid ${C.border}`, fontSize: mob ? 12 : 14, fontFamily: "inherit", outline: "none", width: mob ? 200 : 260 }} />
        </div>
      </div>

      <div ref={listRef} style={{ ...PAGINATION_LIST_PARENT_STYLE }}>
        <Card style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, padding: 0, overflow: "hidden" }}>
        <div style={{ overflowX: "auto", flex: 1, minHeight: 0 }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
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
                    borderBottom: `1px solid ${C.borderLight}`,
                    background: i % 2 === 1 ? C.surfaceHover : C.surface,
                  }}
                >
                  <td style={{ padding: mob ? "6px 8px" : "12px 14px", verticalAlign: "middle" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                      <div style={{
                        width: mob ? 28 : 36, height: mob ? 28 : 36, borderRadius: "50%", overflow: "hidden", flexShrink: 0,
                        background: "var(--color-border-soft)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: mob ? 11 : 13, fontWeight: 700, color: C.navy,
                      }}>
                        {s.donor.photoUrl ? <img src={s.donor.photoUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : s.donor.name.charAt(0)}
                      </div>
                      <span style={{ fontSize: mob ? 12 : 14, fontWeight: 600, color: C.navy, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display: "block", minWidth: 0 }}>{s.donor.name}</span>
                    </div>
                  </td>
                  <td style={{ padding: mob ? "6px 8px" : "12px 14px", textAlign: "right", fontSize: mob ? 11 : 14, fontWeight: 600, color: C.navy }}>₩{fmt(s.total)}</td>
                  <td style={{ padding: mob ? "6px 8px" : "12px 14px", textAlign: "center", fontSize: mob ? 10 : 13, color: "var(--color-text-faint)" }}>{s.lastDate || "-"}</td>
                  <td style={{ padding: mob ? "6px 8px" : "12px 14px", textAlign: "center", fontSize: mob ? 10 : 13, color: "var(--color-text-faint)" }}>{s.prevDate || "-"}</td>
                  <td style={{ padding: mob ? "6px 8px" : "12px 14px", textAlign: "right", fontSize: mob ? 11 : 14, color: "var(--color-text-muted)" }}>₩{fmt(s.thisMonth)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && <div style={{ padding: mob ? 32 : 48, textAlign: "center", color: "var(--color-text-faint)", fontSize: mob ? 11 : 14 }}>조건에 맞는 교인이 없습니다</div>}
        {filtered.length > 0 && (
          <Pagination totalItems={filtered.length} itemsPerPage={10} currentPage={currentPage} onPageChange={(p) => setCurrentPage(p)} />
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
  const mob = useIsMobile();

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

  const expSel: CSSProperties = {
    height: mob ? 32 : 40,
    fontSize: mob ? 11 : 14,
    padding: mob ? "0 8px" : "0 14px",
    borderRadius: mob ? 6 : 10,
    border: `1px solid ${C.border}`,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: mob ? 20 : 24 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: mob ? 8 : 12, alignItems: "center" }}>
        <Select style={expSel} options={[{ value: "all", label: "전체 부서" }, ...departments.map(d => ({ value: d.id, label: d.name }))]}
          value={filterDept} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => { setFilterDept(e.target.value); setCurrentPage(1); }} />
        <Select style={expSel} options={[{ value: "all", label: "전체 월" }, ...MONTHS.map((m, i) => ({ value: String(i+1).padStart(2,"0"), label: m }))]}
          value={filterMonth} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => { setFilterMonth(e.target.value); setCurrentPage(1); }} />
        <span style={{ fontSize: mob ? 12 : 14, fontWeight: 700, color: C.navy, whiteSpace: "nowrap" }}>합계: ₩{fmt(filteredTotal)}</span>
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          style={{ height: mob ? 32 : 40, fontSize: mob ? 11 : 14, fontWeight: 600, padding: mob ? "0 12px" : "0 20px", borderRadius: mob ? 6 : 10, background: C.primary, color: "var(--color-primary-on)", border: "none", cursor: "pointer", whiteSpace: "nowrap" }}
        >
          지출 등록
        </button>
      </div>
      <div ref={listRef} style={{ ...PAGINATION_LIST_PARENT_STYLE }}>
      <Table
        columns={[
          { label: "날짜", key: "date" },
          { label: "부서", render: (r) => { const d = departments.find(x => x.id === r.departmentId); return d ? <Badge color={C.navy} bg="#f0f2f5">{d.name}</Badge> : <span>{r.departmentId as string}</span>; }},
          { label: "항목", render: (r) => { const c = expenseCategories.find(x => x.id === r.categoryId); return c ? <Badge color={C.textMuted} bg={C.surfaceHover}>{c.name}</Badge> : <span>{r.categoryId as string}</span>; }},
          { label: "내용", key: "description" },
          { label: "영수증", align: "center", render: (r) => <span>{r.receipt ? "있음" : "없음"}</span> },
          { label: "금액", align: "right", render: (r) => <span style={{ fontWeight: 700, color: C.navy }}>₩{fmt(r.amount as number)}</span> },
        ]}
        data={filtered.slice((currentPage - 1) * 10, currentPage * 10) as unknown as Record<string, unknown>[]}
      />
      <Pagination totalItems={filtered.length} itemsPerPage={10} currentPage={currentPage} onPageChange={(p) => setCurrentPage(p)} />
      </div>
      <PcModalShell open={showAdd} onClose={() => setShowAdd(false)} title="지출 등록">
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Select label="부서" value={form.departmentId} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setForm(f => ({ ...f, departmentId: e.target.value }))}
            options={departments.map(d => ({ value: d.id, label: d.name }))} />
          <Select label="지출 항목" value={form.categoryId} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setForm(f => ({ ...f, categoryId: e.target.value }))}
            options={expenseCategories.map(c => ({ value: c.id, label: c.name }))} />
          <Input label="금액 (원)" type="number" value={form.amount} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="500000" />
          <CalendarDropdown label="날짜" value={form.date} onChange={(v) => setForm(f => ({ ...f, date: v }))} />
          <Input label="내용" value={form.description} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, description: e.target.value }))} placeholder="지출 내용" />
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input type="checkbox" checked={form.receipt} onChange={e => setForm(f => ({ ...f, receipt: e.target.checked }))}
              style={{ width: 18, height: 18, accentColor: C.accent }} />
            <label style={{ fontSize: 14, color: C.textSub }}>영수증 있음</label>
          </div>
          <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 8 }}>
            <Button variant="ghost" onClick={() => setShowAdd(false)}>취소</Button>
            <Button onClick={handleAdd}>등록</Button>
          </div>
        </div>
      </PcModalShell>
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
      const dataUrl = await toPng(el, { pixelRatio: 2, backgroundColor: "var(--color-surface)" });
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

  return (
    <PcModalShell open={open} onClose={onClose} title="월별 결산 보고서" maxWidth={560}>
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
              <tr><td style={{ padding: "8px 0", fontWeight: 600, color: C.navy }}>수입 소계</td><td style={{ padding: "8px 0", textAlign: "right", fontWeight: 700, color: C.success }}>₩{fmt(data.incomeTotal)}</td></tr>
              <tr><td colSpan={2} style={{ padding: "4px 0", borderTop: `1px solid ${C.border}`, fontSize: 12, color: C.textMuted }}>지출 항목별</td></tr>
              {paginatedExpense.map(c => (
                <tr key={c.name}><td style={{ padding: "4px 0 4px 16px" }}>{c.icon} {c.name}</td><td style={{ padding: "4px 0", textAlign: "right" }}>₩{fmt(c.amount)}</td></tr>
              ))}
              {data.expenseByCat.length > 10 && <tr><td colSpan={2} style={{ padding: 8 }}><Pagination totalItems={data.expenseByCat.length} itemsPerPage={10} currentPage={pageExpense} onPageChange={setPageExpense} /></td></tr>}
              <tr><td style={{ padding: "8px 0", fontWeight: 600, color: C.navy }}>지출 소계</td><td style={{ padding: "8px 0", textAlign: "right", fontWeight: 700, color: C.danger }}>₩{fmt(data.expenseTotal)}</td></tr>
              <tr><td colSpan={2} style={{ padding: "8px 0", borderTop: `2px solid ${C.border}` }}></td></tr>
              <tr><td style={{ padding: "8px 0", fontWeight: 700, color: C.navy }}>잔액</td><td style={{ padding: "8px 0", textAlign: "right", fontWeight: 800, color: C.navy }}>₩{fmt(data.balance)}</td></tr>
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
    </PcModalShell>
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
    const catBreakdown = categories.map(c => ({ name: c.name, total: catMap[c.id] || 0, pct: totalOff > 0 ? ((catMap[c.id] || 0) / totalOff * 100).toFixed(1) : "0.0" })).filter(c => c.total > 0).sort((a, b) => b.total - a.total);
    const deptMap: Record<string, number> = {};
    filteredExp.forEach(e => { deptMap[e.departmentId] = (deptMap[e.departmentId] || 0) + e.amount; });
    const deptBreakdown = departments.map(d => ({ name: d.name, total: deptMap[d.id] || 0, pct: totalExp > 0 ? ((deptMap[d.id] || 0) / totalExp * 100).toFixed(1) : "0.0" })).filter(d => d.total > 0).sort((a, b) => b.total - a.total);
    const expCatMap: Record<string, number> = {};
    filteredExp.forEach(e => { expCatMap[e.categoryId] = (expCatMap[e.categoryId] || 0) + e.amount; });
    const expCatBreakdown = expenseCategories.map(c => ({ name: c.name, total: expCatMap[c.id] || 0, pct: totalExp > 0 ? ((expCatMap[c.id] || 0) / totalExp * 100).toFixed(1) : "0.0" })).filter(c => c.total > 0).sort((a, b) => b.total - a.total);
    return { totalOff, totalExp, balance: totalOff - totalExp, catBreakdown, deptBreakdown, expCatBreakdown };
  }, [offerings, expenses, categories, departments, expenseCategories, reportType, selectedPeriod]);

  const mob = useIsMobile();
  const reportTypeLabel: Record<string, string> = { weekly: "주간", monthly: "월간", quarterly: "분기", half: "반기", annual: "연간" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
        <button
          type="button"
          className="finance-nav-btn"
          onClick={() => setShowSettlement(true)}
          style={{ height: mob ? 32 : 40, fontSize: mob ? 11 : 14, fontWeight: 600, padding: mob ? "0 12px" : "0 18px", borderRadius: mob ? 6 : 10, background: C.primary, color: "var(--color-primary-on)", border: "none", cursor: "pointer", boxShadow: "none", outline: "none" }}
        >
          결산 보고서
        </button>
      </div>
      <Card style={{ padding: 12 }}>
        <div style={{ ...financeSubTabRowStyle, marginBottom: reportType !== "annual" ? 8 : 0 }}>
          {["weekly", "monthly", "quarterly", "half", "annual"].map((t) => (
            <button
              key={t}
              type="button"
              className="finance-nav-btn"
              onClick={() => {
                setReportType(t);
                setSelectedPeriod(t === "monthly" ? "01" : "0");
              }}
              style={financeTogglePillStyle(reportType === t, mob)}
            >
              {reportTypeLabel[t]}
            </button>
          ))}
        </div>
        {reportType !== "annual" && (
          reportType === "monthly" ? (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(6, 1fr)",
                gap: 4,
                width: "100%",
              }}
            >
              {periodOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className="finance-nav-btn"
                  onClick={() => setSelectedPeriod(opt.value)}
                  style={financeSubTabStyle(selectedPeriod === opt.value, "gridCell", mob)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          ) : reportType === "weekly" ? (
            <div
              className="scrollbar-hide"
              style={{
                display: "flex",
                gap: 4,
                width: "100%",
                overflowX: "auto",
                WebkitOverflowScrolling: "touch",
                scrollbarWidth: "none",
                msOverflowStyle: "none",
              }}
            >
              {periodOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className="finance-nav-btn"
                  onClick={() => setSelectedPeriod(opt.value)}
                  style={financeScrollRowPillStyle(selectedPeriod === opt.value, mob)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          ) : (
            <div style={financeSubTabRowStyle}>
              {periodOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className="finance-nav-btn"
                  onClick={() => setSelectedPeriod(opt.value)}
                  style={financeTogglePillStyle(selectedPeriod === opt.value, mob)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )
        )}
      </Card>
      <div style={{ display: "grid", gridTemplateColumns: mob ? "1fr" : "repeat(3, 1fr)", gap: mob ? 12 : 20 }}>
        <div style={{ background: C.surface, borderRadius: 12, border: `1px solid ${C.border}`, padding: mob ? 16 : 24, boxShadow: C.shadow }}>
          <div style={{ fontSize: mob ? 10 : 13, color: C.text3, fontWeight: 500 }}>수입 합계</div>
          <div style={{ fontSize: mob ? 18 : 26, fontWeight: 800, color: C.income, letterSpacing: "-0.02em" }}>₩{fmt(reportData.totalOff)}</div>
        </div>
        <div style={{ background: C.surface, borderRadius: 12, border: `1px solid ${C.border}`, padding: mob ? 16 : 24, boxShadow: C.shadow }}>
          <div style={{ fontSize: mob ? 10 : 13, color: C.text3, fontWeight: 500 }}>지출 합계</div>
          <div style={{ fontSize: mob ? 18 : 26, fontWeight: 800, color: C.expense, letterSpacing: "-0.02em" }}>₩{fmt(reportData.totalExp)}</div>
        </div>
        <div style={{ background: C.surface, borderRadius: 12, border: `1px solid ${C.border}`, padding: mob ? 16 : 24, boxShadow: C.shadow }}>
          <div style={{ fontSize: mob ? 10 : 13, color: C.text3, fontWeight: 500 }}>잔액</div>
          <div style={{ fontSize: mob ? 18 : 26, fontWeight: 800, color: C.balance, letterSpacing: "-0.02em" }}>₩{fmt(reportData.balance)}</div>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: mob ? "1fr" : "1fr 1fr", gap: mob ? 12 : 20 }}>
        <Card>
          <h4 style={{ margin: "0 0 16px", color: C.navy, fontSize: mob ? 13 : 16, fontWeight: 700 }}>헌금 항목별 보고</h4>
          <Table columns={[
            { label: "항목", key: "name" },
            { label: "비율", render: (r) => <span>{r.pct as string}%</span> },
            { label: "금액", align: "right", render: (r) => <span style={{ fontWeight: 700 }}>₩{fmt(r.total as number)}</span> },
          ]} data={reportData.catBreakdown as unknown as Record<string, unknown>[]} />
        </Card>
        <Card>
          <h4 style={{ margin: "0 0 16px", color: C.navy, fontSize: mob ? 13 : 16, fontWeight: 700 }}>지출 항목별 보고</h4>
          <Table columns={[
            { label: "항목", key: "name" },
            { label: "비율", render: (r) => <span>{r.pct as string}%</span> },
            { label: "금액", align: "right", render: (r) => <span style={{ fontWeight: 700 }}>₩{fmt(r.total as number)}</span> },
          ]} data={reportData.expCatBreakdown as unknown as Record<string, unknown>[]} />
        </Card>
      </div>
      <Card>
        <h4 style={{ margin: "0 0 16px", color: C.navy, fontSize: mob ? 13 : 16, fontWeight: 700 }}>부서별 지출 보고</h4>
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
      const dataUrl = await toPng(el, { pixelRatio: 2, backgroundColor: "var(--color-surface)" });
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

  const pctColor = () => C.textMuted;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%" }}>
        <div style={budgetYearToolbarRowStyle()}>
          <span style={budgetYearLabelStyle(mob)}>연도</span>
          <select
            value={String(year)}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
              setYear(Number(e.target.value));
              setCurrentPageCompare(1);
            }}
            style={budgetYearSelectStyle(mob)}
          >
            {[currentYear, currentYear - 1, currentYear - 2].map((y) => (
              <option key={y} value={String(y)}>{y}년</option>
            ))}
          </select>
        </div>
        <div style={{ ...financeSubTabRowStyle, marginBottom: 0 }}>
          {(["input", "compare"] as const).map((m) => (
            <button key={m} type="button" className="finance-nav-btn" onClick={() => setMode(m)} style={financeTogglePillStyle(mode === m, mob)}>
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
              <BudgetInputRow key={c.id} label={c.name} value={budgets.income[c.id] ?? ""} onSave={v => saveBudget("income", c.id, v)} />
            ))}
          </div>
          <h4 style={{ margin: "24px 0 16px", color: C.navy }}>지출 항목 예산 ({year}년)</h4>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {expenseCategoriesList.map(c => (
              <BudgetInputRow key={c.id} label={c.name} value={budgets.expense[c.id] ?? ""} onSave={v => saveBudget("expense", c.id, v)} />
            ))}
          </div>
        </Card>
      )}

      {mode === "compare" && (
        <>
          <div ref={listRefCompare} style={{ ...PAGINATION_LIST_PARENT_STYLE }}>
            <div id="budget-actual-report-card" ref={reportCardRef} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 24, boxShadow: "0 4px 20px rgba(0,0,0,0.06)", display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
            <h3 style={{ margin: "0 0 20px", fontSize: 18, fontWeight: 700, color: C.navy }}>{year}년 예산 vs 실적</h3>
            <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th style={financeTableHeaderTh("left", mob)}>구분</th>
                      <th style={financeTableHeaderTh("left", mob)}>항목명</th>
                      <th style={financeTableHeaderTh("right", mob)}>예산</th>
                      <th style={financeTableHeaderTh("right", mob)}>실적</th>
                      <th style={financeTableHeaderTh("right", mob)}>차이</th>
                      <th style={financeTableHeaderTh("right", mob)}>집행률</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedCompareRows.map((r, i) => {
                      const gi = (currentPageCompare - 1) * 10 + i;
                      const total = r.id.startsWith("_");
                      if (total) {
                        return (
                          <tr key={r.id}>
                            <td style={financeTableTotalRowTd("left", mob)}>{r.type}</td>
                            <td style={financeTableTotalRowTd("left", mob)}>{r.name}</td>
                            <td style={financeTableTotalRowTd("right", mob)}>₩{fmt(r.budget)}</td>
                            <td style={financeTableTotalRowTd("right", mob)}>₩{fmt(r.actual)}</td>
                            <td style={financeTableTotalRowTd("right", mob)}>₩{fmt(r.diff)}</td>
                            <td style={financeTableTotalRowTd("right", mob)}>{r.pct > 0 ? `${r.pct}%` : "-"}</td>
                          </tr>
                        );
                      }
                      return (
                        <tr key={r.id}>
                          <td style={financeTableCellTd(gi % 2 === 1, "left", mob)}>{r.type}</td>
                          <td style={financeTableCellTd(gi % 2 === 1, "left", mob)}>{r.name}</td>
                          <td style={financeTableCellTd(gi % 2 === 1, "right", mob)}>₩{fmt(r.budget)}</td>
                          <td style={{ ...financeTableCellTd(gi % 2 === 1, "right", mob), color: C.navy }}>₩{fmt(r.actual)}</td>
                          <td style={financeTableCellTd(gi % 2 === 1, "right", mob)}>₩{fmt(r.diff)}</td>
                          <td style={{ ...financeTableCellTd(gi % 2 === 1, "right", mob), fontWeight: 600, color: pctColor() }}>{r.pct > 0 ? `${r.pct}%` : "-"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <Pagination totalItems={compareRows.length} itemsPerPage={10} currentPage={currentPageCompare} onPageChange={(p) => setCurrentPageCompare(p)} />
            </div>
            {chartData.length > 0 && (
              <div style={{ marginTop: 24, flexShrink: 0 }}>
                <LazyChart height={mob ? 280 : 320}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 60 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-35} textAnchor="end" height={60} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v / 10000).toFixed(0)}만`} />
                      <Tooltip formatter={(value) => `₩${fmt(Number(value))}`} />
                      <Legend />
                      <Bar dataKey="예산" fill="var(--color-text-muted)" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="실적" fill={C.primary} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </LazyChart>
              </div>
            )}
            </div>
          </div>
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
        style={{ width: 140, height: 28, padding: "0 8px", borderRadius: 4, border: `1px solid ${C.border}`, fontSize: 11, fontFamily: "inherit", textAlign: "center" }} />
      <Button size="sm" onClick={handleSave}>저장</Button>
    </div>
  );
}

/* ====== 예산 관리 ====== */
function BudgetTab({ departments, expenses }: { departments: Department[]; expenses: Expense[] }) {
  const mob = useIsMobile();
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
      <div style={budgetYearToolbarRowStyle()}>
        <span style={budgetYearLabelStyle(mob)}>연도</span>
        <select
          value={year}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setYear(e.target.value)}
          style={budgetYearSelectStyle(mob)}
        >
          <option value="2026">2026년</option>
          <option value="2027">2027년</option>
        </select>
        <span style={{ fontSize: 14, fontWeight: 700, color: C.navy }}>{year}년 예산 계획</span>
        <span style={{ marginLeft: "auto", padding: "4px 10px", borderRadius: 6, background: "var(--color-border-soft)", color: C.navy, fontWeight: 600, fontSize: 11 }}>총 예산: ₩{fmt(totalBudget)}</span>
      </div>
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["부서", "전년 실적", "1분기 예산", "2분기 예산", "3분기 예산", "4분기 예산", "연간 합계"].map((h, i) => (
                  <th key={h} style={financeTableHeaderTh(i === 0 ? "left" : (i === 1 || i === 6) ? "right" : "center", mob)}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {departments.map((d, i) => {
                const b = budgets[d.id] || {};
                const annual = (parseInt(b.q1) || 0) + (parseInt(b.q2) || 0) + (parseInt(b.q3) || 0) + (parseInt(b.q4) || 0);
                const even = i % 2 === 1;
                return (
                  <tr key={d.id}>
                    <td style={{ ...financeTableCellTd(even, "left", mob), minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                        <div style={{ width: 8, height: 8, borderRadius: 4, background: C.primary, flexShrink: 0 }} />
                        <span style={{ fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.name}</span>
                      </div>
                    </td>
                    <td style={financeTableCellTd(even, "right", mob)}>₩{fmt(actualByDept[d.id] || 0)}</td>
                    {(["q1", "q2", "q3", "q4"] as const).map((q) => (
                      <td key={q} style={{ ...financeTableCellTd(even, "center", mob), verticalAlign: "middle" }}>
                        <input
                          type="number"
                          value={b[q] || ""}
                          placeholder="0"
                          onChange={(e) => handleBudgetChange(d.id, q, e.target.value)}
                          style={{ width: 110, height: 28, padding: "0 6px", borderRadius: 4, border: `1px solid ${C.border}`, fontSize: 11, fontFamily: "inherit", textAlign: "center", outline: "none", boxShadow: "none" }}
                        />
                      </td>
                    ))}
                    <td style={{ ...financeTableCellTd(even, "right", mob), fontWeight: 700, color: C.navy }}>₩{fmt(annual)}</td>
                  </tr>
                );
              })}
              <tr>
                <td style={financeTableTotalRowTd("left", mob)}>합계</td>
                <td style={financeTableTotalRowTd("right", mob)}>₩{fmt(Object.values(actualByDept).reduce((s, v) => s + v, 0))}</td>
                {(["q1", "q2", "q3", "q4"] as const).map((q) => {
                  const qTotal = departments.reduce((s, d) => s + (parseInt(budgets[d.id]?.[q]) || 0), 0);
                  return <td key={q} style={financeTableTotalRowTd("center", mob)}>₩{fmt(qTotal)}</td>;
                })}
                <td style={financeTableTotalRowTd("right", mob)}>₩{fmt(totalBudget)}</td>
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
  const mob = useIsMobile();
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
    { initial: "헌", title: "헌금 내역", desc: "전체 헌금 내역을 엑셀로 보내기", action: exportOfferings },
    { initial: "지", title: "지출 내역", desc: "전체 지출 내역을 엑셀로 보내기", action: exportExpenses },
    { initial: "목", title: "헌금자 목록", desc: "헌금자 정보 및 통계를 엑셀로 보내기", action: exportDonors },
    { initial: "월", title: "월간 보고서", desc: "12개월 월별 보고서 (시트별 분리)", action: exportMonthlyReport },
    { initial: "연", title: "연간 종합 보고서", desc: "연간요약, 항목별, 부서별 종합 보고서", action: exportAnnualReport },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: mob ? 12 : 20 }}>
      <div style={{
        background: "var(--color-primary-soft)",
        borderRadius: mob ? 8 : 16,
        fontSize: mob ? 11 : 14,
        color: C.textMuted,
        padding: mob ? "10px 12px" : "16px 20px",
        lineHeight: mob ? 1.4 : 1.6,
        border: `1px solid ${C.border}`,
      }}>
        원하는 보고서를 선택하면 엑셀(.xlsx) 파일로 바로 내려받을 수 있습니다. 항목별로 정리되어 재정 보고에 활용하기 좋습니다.
      </div>
      <div style={{ display: "grid", gridTemplateColumns: mob ? "1fr" : "repeat(2, 1fr)", gap: mob ? 8 : 16 }}>
        {exports.map((item, i) => (
          <Card key={i} onClick={item.action} style={{ cursor: "pointer", transition: "all 0.2s ease", padding: mob ? "10px 12px" : "20px 24px", marginBottom: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: mob ? 10 : 16 }}>
              <div style={{
                width: mob ? 32 : 44, height: mob ? 32 : 44, borderRadius: "50%", background: "var(--color-border-soft)", color: C.text2,
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: mob ? 11 : 14, fontWeight: 700, flexShrink: 0,
              }}>{item.initial}</div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, color: C.text1, fontSize: mob ? 12 : 15, marginBottom: 2 }}>{item.title}</div>
                <div style={{ fontSize: mob ? 10 : 13, color: C.textMuted, lineHeight: 1.35 }}>{item.desc}</div>
              </div>
              <div style={{ marginLeft: "auto", color: C.textMuted, display: "flex", alignItems: "center", flexShrink: 0, fontSize: mob ? 14 : 18 }}><Icons.Export /></div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

/* ---------- 기부금 영수증 탭: 새 양식용 CSS ---------- */
const RECEIPT_CSS = `
  .receipt-wrapper-r { width: 210mm; max-width: 100%; box-sizing: border-box; background: #fff; position: relative; padding: 0; box-shadow: none; font-family: var(--font-sans); }
  .receipt-header-r { background: linear-gradient(135deg, #1a2a4a 0%, #2c3e6b 100%); padding: 36px 48px 28px; position: relative; overflow: hidden; }
  .receipt-header-r::after { content: ''; position: absolute; bottom: 0; left: 0; right: 0; height: 4px; background: linear-gradient(90deg, #c9a96e, #e8d5a3, #c9a96e); }
  .receipt-header-r::before { content: '✝'; position: absolute; right: 40px; top: 50%; transform: translateY(-50%); font-size: 100px; color: rgba(255,255,255,0.04); font-weight: 300; }
  .header-top-r { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; }
  .doc-type-r { font-size: 11px; color: rgba(255,255,255,0.5); letter-spacing: 1px; }
  .serial-number-r { font-size: 12px; color: rgba(255,255,255,0.6); background: rgba(255,255,255,0.08); padding: 4px 12px; border-radius: 4px; }
  .receipt-title-r { font-size: 32px; font-weight: 700; color: #fff; letter-spacing: 16px; text-align: center; margin-bottom: 4px; }
  .receipt-subtitle-r { text-align: center; font-size: 12px; color: rgba(255,255,255,0.45); letter-spacing: 2px; }
  .receipt-body-r { padding: 32px 48px 40px; }
  .section-r { margin-bottom: 28px; break-inside: avoid; page-break-inside: avoid; }
  .section-header-r { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; padding-bottom: 8px; border-bottom: 2px solid #1a2a4a; }
  .section-number-r { display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; background: #1a2a4a; color: #fff; font-size: 12px; font-weight: 700; border-radius: 50%; flex-shrink: 0; }
  .section-title-r { font-size: 15px; font-weight: 700; color: #1a2a4a; letter-spacing: 2px; }
  .info-table-r { width: 100%; border-collapse: collapse; }
  .info-table-r tr { border-bottom: 1px solid #eee; break-inside: avoid; page-break-inside: avoid; }
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
  .monthly-table-r tfoot td { padding: 12px; font-size: 15px; font-weight: 700; border-top: 2px solid #1a2a4a; background: #f5f8ff; }
  .monthly-table-r tfoot td.total-label-r { text-align: center; color: #1a2a4a; letter-spacing: 4px; }
  .monthly-table-r tfoot td.total-amount-r { text-align: right; color: #1a2a4a; font-size: 17px; }
  .certification-r { margin-top: 36px; padding-top: 28px; border-top: 1px solid #ddd; text-align: center; break-inside: avoid; page-break-inside: avoid; }
  .cert-text-r { font-size: 14px; color: #444; line-height: 1.8; margin-bottom: 28px; }
  .cert-text-r .law-ref-r { font-size: 11px; color: #999; display: block; margin-bottom: 8px; }
  .cert-date-r { font-size: 16px; font-weight: 600; color: #1a2a4a; margin-bottom: 32px; letter-spacing: 2px; }
  .signature-area-r { display: flex; flex-direction: column; align-items: center; gap: 6px; position: relative; }
  .church-name-sign-r { font-size: 22px; font-weight: 700; color: #1a2a4a; letter-spacing: 6px; }
  .pastor-sign-r { font-size: 14px; color: #555; letter-spacing: 2px; }
  .seal-r { position: absolute; right: 50px; top: -5px; width: 75px; height: 75px; border: 2.5px solid #b33a2b; border-radius: 50%; display: flex; align-items: center; justify-content: center; transform: rotate(-12deg); opacity: 0.7; filter: blur(0.3px) contrast(1.2) saturate(0.85); box-shadow: 0 0 0 1px rgba(179,58,43,0.3), inset 0 0 3px rgba(179,58,43,0.15), 1px 1px 2px rgba(179,58,43,0.1); background: radial-gradient(ellipse at 30% 40%, rgba(179,58,43,0.06) 0%, transparent 70%), radial-gradient(ellipse at 70% 60%, rgba(179,58,43,0.04) 0%, transparent 60%); }
  .seal-r.seal-r--image { transform: none; opacity: 1; border: none; box-shadow: none; background: transparent; border-radius: 0; overflow: visible; }
  .seal-r.seal-r--image::before, .seal-r.seal-r--image::after { display: none; content: none; }
  .seal-r.seal-r--image .seal-inner-r { width: 100%; height: 100%; border: none; background: transparent; border-radius: 0; overflow: visible; display: flex; align-items: center; justify-content: center; }
  .seal-r.seal-r--image img[data-receipt-seal] { filter: contrast(1.18) saturate(1.35); opacity: 1; }
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
  .donation-table-r tbody tr { break-inside: avoid; page-break-inside: avoid; }
  .donation-table-r tbody td { padding: 8px 10px; font-size: 12px; border-bottom: 1px solid #f0f0f0; }
  .donation-table-r tbody td.text-left-r { text-align: left; }
  .donation-table-r tbody td.text-right-r { text-align: right; font-weight: 500; }
  .donation-table-r tbody td.text-right-r.has-value-r { color: #1a2a4a; font-weight: 600; }
  .donation-table-r tfoot td { padding: 10px; font-size: 14px; font-weight: 700; border-top: 2px solid #1a2a4a; background: #f5f8ff; }
  .donation-table-r tfoot .total-label-r { text-align: center; color: #1a2a4a; }
  .donation-table-r tfoot .total-amount-r { text-align: right; color: #1a2a4a; }
  .receipt-pages-container { display: flex; flex-direction: column; align-items: center; gap: 32px; padding: 24px 0 0; background: transparent; width: 100%; box-sizing: border-box; }
  .receipt-page { width: 210mm; min-height: 297mm; height: auto; box-sizing: border-box; padding: 15mm 18mm; background: #fff; box-shadow: none; border: 1px solid #c7d0e8; break-after: page; overflow: visible; display: flex; flex-direction: column; flex-shrink: 0; }
  .monthly-table-r tbody tr { break-inside: avoid; page-break-inside: avoid; }
  @media print {
    .receipt-page { break-after: page; border: none; box-shadow: none; }
    .receipt-pages-container { gap: 0; padding: 0; }
  }
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

/** 영수증 미리보기·PDF·발급대장용 주민번호 표시 (앞 6자리-뒷 첫 1자리 + 마스킹 6자리) */
function maskResidentNumber(front: string, back: string): string {
  if (!front) return "";
  if (!back) return front;
  return `${front}-${back.charAt(0)}${"*".repeat(6)}`;
}

/** 완전한 13자리 숫자일 때만 법정 형식으로 마스킹, 그 외에는 비식별 placeholder */
function maskReceiptResidentNumber(front: string, back: string): string {
  if (front.length !== 6 || back.length !== 7 || !/^\d+$/.test(front) || !/^\d+$/.test(back)) return "******-*******";
  return maskResidentNumber(front, back);
}

/** 뒷 7자리 입력란: 첫 자리만 보이고 이후는 ● (실제 state는 숫자만 저장) */
const RESIDENT_LAST_MASK_DOT = "\u25CF";

function residentLastPartDisplay(realDigits: string): string {
  if (!realDigits) return "";
  if (realDigits.length === 1) return realDigits;
  return realDigits.charAt(0) + RESIDENT_LAST_MASK_DOT.repeat(realDigits.length - 1);
}

function applyResidentLastPartInput(prevReal: string, rawFromInput: string): string {
  const digits = rawFromInput.replace(/\D/g, "");
  if (digits.length > prevReal.length + 1 || digits.length >= 7) return digits.slice(0, 7);
  const prevDisp = residentLastPartDisplay(prevReal);
  if (rawFromInput.length > prevDisp.length) {
    const last = rawFromInput.slice(-1);
    return /^\d$/.test(last) ? (prevReal + last).slice(0, 7) : prevReal;
  }
  if (rawFromInput.length < prevDisp.length) return prevReal.slice(0, Math.max(0, rawFromInput.length));
  return prevReal;
}

type DonationReceiptPersistCfg = {
  churchName: string;
  churchAddress: string | null;
  representativeName: string | null;
};

/** 발급 이력(donation_receipts) — 5년 보관 대장용 */
async function persistDonationReceiptRow(
  client: SupabaseClient | null,
  toast: ((msg: string, type?: "ok" | "err" | "warn") => void) | undefined,
  opts: {
    churchId: string;
    donor: Pick<Donor, "id" | "name">;
    taxYear: number;
    total: number;
    offerings: Offering[];
    cfg: DonationReceiptPersistCfg;
    residentMasked: string;
    memo?: string | null;
  }
): Promise<boolean> {
  if (!client) return false;
  try {
    const { data: receiptNumber, error: rpcErr } = await client.rpc("generate_receipt_number", {
      p_church_id: opts.churchId,
      p_tax_year: opts.taxYear,
    });
    if (rpcErr) console.warn("[donation_receipts] generate_receipt_number", rpcErr);
    const num =
      typeof receiptNumber === "string" && receiptNumber.trim()
        ? receiptNumber.trim()
        : `DR-${opts.taxYear}-00001`;
    const details = opts.offerings
      .filter(o => o.donorId === opts.donor.id && o.date.startsWith(String(opts.taxYear)))
      .reduce<{ category: string; amount: number }[]>((acc, o) => {
        const cat = DEFAULT_CATEGORIES.find(c => c.id === o.categoryId);
        const name = cat?.name ?? o.categoryId;
        const existing = acc.find(x => x.category === name);
        if (existing) existing.amount += o.amount;
        else acc.push({ category: name, amount: o.amount });
        return acc;
      }, []);
    const { error: insErr } = await client.from("donation_receipts").insert({
      member_id: opts.donor.id,
      member_name: opts.donor.name,
      receipt_number: num,
      tax_year: opts.taxYear,
      issue_date: new Date().toISOString().slice(0, 10),
      total_amount: opts.total,
      donation_details: details,
      church_name: opts.cfg.churchName,
      church_address: opts.cfg.churchAddress || null,
      church_representative: opts.cfg.representativeName || null,
      church_id: opts.churchId,
      resident_number_masked: opts.residentMasked,
      memo: opts.memo ?? null,
      status: "발급완료",
    });
    if (insErr) {
      console.warn("[donation_receipts] insert", insErr);
      toast?.("발급 대장(donation_receipts) 저장에 실패했습니다. 테이블·RPC·RLS를 확인해 주세요.", "warn");
      return false;
    }
    return true;
  } catch (e) {
    console.warn("[donation_receipts]", e);
    toast?.("발급 대장 저장 중 오류가 발생했습니다.", "warn");
    return false;
  }
}

function lastDonationDateInYearForDonor(offerings: Offering[], donorId: string, yearStr: string): string {
  const dates = offerings.filter(o => o.donorId === donorId && o.date.startsWith(yearStr)).map(o => o.date).sort();
  return dates.length > 0 ? dates[dates.length - 1]! : `${yearStr}-12-31`;
}

type DonationReceiptLogRow = {
  id: string;
  serial_number: string;
  donor_name: string;
  resident_number_masked: string | null;
  donation_amount: number;
  donation_date: string;
  issued_date: string;
  receipt_year: string;
  note: string | null;
};

async function insertDonationReceiptLog(
  client: SupabaseClient | null,
  cid: string | null,
  params: {
    donorName: string;
    residentMasked: string;
    donationAmount: number;
    donationDate: string;
    issuedDate: string;
    receiptYear: string;
    channelNote: string;
  }
): Promise<boolean> {
  if (!client || !cid) return false;
  try {
    const { data: serial, error: rpcErr } = await client.rpc("next_receipt_log_serial", {
      p_church_id: cid,
      p_year: params.receiptYear,
    });
    if (rpcErr) {
      console.warn("[donation_receipt_log] rpc", rpcErr);
      return false;
    }
    const serialNumber = typeof serial === "string" && serial.trim() ? serial.trim() : `${params.receiptYear}-001`;
    const { error: insErr } = await client.from("donation_receipt_log").insert({
      church_id: cid,
      serial_number: serialNumber,
      donor_name: params.donorName,
      resident_number_masked: params.residentMasked,
      donation_amount: params.donationAmount,
      donation_date: params.donationDate,
      issued_date: params.issuedDate,
      receipt_year: params.receiptYear,
      donation_type: "법정기부금",
      note: params.channelNote,
    });
    if (insErr) {
      console.warn("[donation_receipt_log] insert", insErr);
      return false;
    }
    return true;
  } catch (e) {
    console.warn("[donation_receipt_log]", e);
    return false;
  }
}

/** 기부금 영수증 DOM(html2canvas)용 직인 표시 URL — 매 호출마다 cache bust */
async function buildDonationReceiptSealSrc(
  client: SupabaseClient | null,
  cid: string | null,
  sealRaw: string | null | undefined
): Promise<string | null> {
  if (!client || !cid || !sealRaw?.trim()) return null;
  const raw = sealRaw.trim();
  try {
    if (raw.startsWith("http")) {
      const sep = raw.includes("?") ? "&" : "?";
      return `${raw}${sep}t=${Date.now()}`;
    }
    const path = raw.includes("/") ? raw : `${cid}/seal.png`;
    const { data: signed } = await client.storage.from("church-seals").createSignedUrl(path, 3600);
    if (!signed?.signedUrl) return null;
    const sep = signed.signedUrl.includes("?") ? "&" : "?";
    return `${signed.signedUrl}${sep}t=${Date.now()}`;
  } catch {
    return null;
  }
}

function awaitReceiptSealImagesLoaded(): Promise<void> {
  const imgs = document.querySelectorAll<HTMLImageElement>("img[data-receipt-seal]");
  return Promise.all(
    Array.from(imgs).map(
      (img) =>
        new Promise<void>((resolve) => {
          if (!img.src) {
            resolve();
            return;
          }
          if (img.complete && img.naturalHeight > 0) {
            resolve();
            return;
          }
          const done = () => {
            img.removeEventListener("load", done);
            img.removeEventListener("error", done);
            resolve();
          };
          img.addEventListener("load", done);
          img.addEventListener("error", done);
        })
    )
  ).then(() => {});
}

/* ====== 기부금 영수증 탭 ====== */
type ReceiptSubTab = "individual" | "bulk" | "history";

const FINANCE_RECEIPT_SUBTAB_STORAGE_KEY = "finance_receipt_subtab";

function ReceiptTab({ donors, offerings, settings, toast }: { donors: Donor[]; offerings: Offering[]; settings?: { churchName?: string; address?: string; pastor?: string; businessNumber?: string }; toast?: (msg: string, type?: "ok" | "err" | "warn") => void }) {
  const mob = useIsMobile();
  const listRefBatch = useRef<HTMLDivElement>(null);
  const currentYear = new Date().getFullYear();
  const [receiptSubTab, setReceiptSubTabState] = useState<ReceiptSubTab>("individual");
  useEffect(() => {
    try {
      const raw = localStorage.getItem(FINANCE_RECEIPT_SUBTAB_STORAGE_KEY);
      if (raw === "individual" || raw === "bulk" || raw === "history") setReceiptSubTabState(raw);
    } catch {
      /* ignore */
    }
  }, []);
  const setReceiptSubTab = useCallback((tab: ReceiptSubTab) => {
    setReceiptSubTabState(tab);
    try {
      localStorage.setItem(FINANCE_RECEIPT_SUBTAB_STORAGE_KEY, tab);
    } catch {
      /* ignore */
    }
  }, []);
  const [year, setYear] = useState(currentYear);
  const [currentPageBatch, setCurrentPageBatch] = useState(1);
  const [selectedDonorId, setSelectedDonorId] = useState<string>("");
  /** 일괄(체크박스) 목록은 receiptSubTab === "bulk"에서만 표시 (setBatchMode 미사용 제거) */
  const [batchSelected, setBatchSelected] = useState<Set<string>>(new Set());
  const [batchGenerating, setBatchGenerating] = useState(false);
  const [batchIndex, setBatchIndex] = useState(0);
  const [batchPdfList, setBatchPdfList] = useState<Donor[]>([]);
  const [donorSearch, setDonorSearch] = useState("");
  /** 개별 발급: 「발급하기」 성공 후에만 영수증 미리보기·보조 버튼 표시 */
  const [receiptIssued, setReceiptIssued] = useState(false);
  const [residentFirst, setResidentFirst] = useState("");
  const [residentLast, setResidentLast] = useState("");
  const [batchResidentNumbers, setBatchResidentNumbers] = useState<Record<string, { first: string; last: string }>>({});
  const [yearDropdownOpen, setYearDropdownOpen] = useState(false);
  const [donorDropdownOpen, setDonorDropdownOpen] = useState(false);
  const yearDropdownRef = useRef<HTMLDivElement>(null);
  const donorDropdownRef = useRef<HTMLDivElement>(null);
  const residentLastInputRef = useRef<HTMLInputElement>(null);
  const reprintSsnLastInputRef = useRef<HTMLInputElement>(null);
  const pdfRef = useRef<{ addPage: () => void; addImage: (a: string, b: string, c: number, d: number, e: number, f: number) => void; save: (n: string) => void } | null>(null);
  const [receiptHistory, setReceiptHistory] = useState<
    {
      id: string;
      receipt_number: string;
      member_name: string;
      tax_year: number;
      total_amount: number;
      issue_date: string;
      status: string;
      resident_number_masked?: string | null;
      memo?: string | null;
      created_at?: string;
    }[]
  >([]);
  const [historyYearFilter, setHistoryYearFilter] = useState(currentYear);
  const [historySearch, setHistorySearch] = useState("");
  const [receiptHistoryFetchError, setReceiptHistoryFetchError] = useState<string | null>(null);
  const [receiptHistoryEmptyAfterFetch, setReceiptHistoryEmptyAfterFetch] = useState(false);

  useEffect(() => {
    setReceiptHistoryFetchError(null);
    setReceiptHistoryEmptyAfterFetch(false);
    setReceiptHistory([]);
  }, [historyYearFilter]);
  const [reprintModal, setReprintModal] = useState<{ receipt: (typeof receiptHistory)[0]; ssnFirst: string; ssnLast: string } | null>(null);
  const [cancelModal, setCancelModal] = useState<{ receipt: (typeof receiptHistory)[0]; reason: string } | null>(null);
  const [bulkFile, setBulkFile] = useState<{ name: string; ssn: string; address: string }[]>([]);
  const [bulkMatched, setBulkMatched] = useState<Record<number, string>>({});
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0, done: false });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [churchId, setChurchId] = useState<string | null>(null);
  const [churchSettings, setChurchSettings] = useState<{ church_registration_number?: string | null; representative_name?: string | null; church_address?: string | null; church_tel?: string | null; seal_image_url?: string | null } | null>(null);
  /** html2canvas에 실제 직인 PNG를 넣기 위한 표시용 URL (텍스트 직인과 배타) */
  const [receiptSealImgSrc, setReceiptSealImgSrc] = useState<string | null>(null);
  const [sealSettingsOpen, setSealSettingsOpen] = useState(false);
  const sealSettingsFormRef = useRef<HTMLDivElement>(null);
  const [receiptLogOpen, setReceiptLogOpen] = useState(false);
  const [receiptLogYear, setReceiptLogYear] = useState(currentYear);
  const [receiptLogRows, setReceiptLogRows] = useState<DonationReceiptLogRow[]>([]);
  const [receiptLogLoading, setReceiptLogLoading] = useState(false);

  useEffect(() => {
    setReceiptIssued(false);
  }, [selectedDonorId, year]);

  useEffect(() => {
    if (receiptSubTab !== "individual") setReceiptIssued(false);
  }, [receiptSubTab]);

  const sealSettingsToast = useCallback(
    (msg: string, type?: "ok" | "err" | "warn") => {
      const t = toast ?? (() => {});
      if (type === "ok" && msg.includes("기부금영수증 설정이 저장")) {
        t("저장 완료", "ok");
        return;
      }
      t(msg, type);
    },
    [toast]
  );

  const triggerSealSettingsSave = useCallback(() => {
    console.log("[ReceiptTab] 모달 푸터 저장 클릭 → SealSettingsSection 저장 연결");
    const root = sealSettingsFormRef.current;
    const t = toast ?? (() => {});
    if (!root) {
      t("설정 폼을 불러올 수 없습니다", "err");
      return;
    }
    const saveBtn = root.querySelector<HTMLButtonElement>("[data-seal-settings-save]");
    if (saveBtn) {
      if (saveBtn.disabled) {
        t("저장 처리 중입니다", "warn");
        return;
      }
      saveBtn.click();
      return;
    }
    for (const btn of root.querySelectorAll("button[type='button']")) {
      const el = btn as HTMLButtonElement;
      if (el.disabled) continue;
      const label = (el.textContent ?? "").replace(/\s+/g, " ").trim();
      if (label === "저장") {
        el.click();
        return;
      }
    }
    t("저장 버튼을 찾을 수 없습니다", "err");
  }, [toast]);

  const fetchReceiptLogRows = useCallback(async () => {
    if (!supabase) {
      setReceiptLogRows([]);
      return;
    }
    let cid: string | null = null;
    try {
      cid = getChurchId();
    } catch {
      setReceiptLogRows([]);
      return;
    }
    setReceiptLogLoading(true);
    const { data, error } = await supabase
      .from("donation_receipt_log")
      .select("id, serial_number, donor_name, resident_number_masked, donation_amount, donation_date, issued_date, receipt_year, note")
      .eq("church_id", cid)
      .eq("receipt_year", String(receiptLogYear))
      .order("created_at", { ascending: false });
    setReceiptLogLoading(false);
    if (error) {
      console.warn("[donation_receipt_log] fetch", error);
      setReceiptLogRows([]);
      return;
    }
    setReceiptLogRows((data ?? []) as DonationReceiptLogRow[]);
  }, [receiptLogYear]);

  useEffect(() => {
    if (!receiptLogOpen) return;
    void fetchReceiptLogRows();
  }, [receiptLogOpen, fetchReceiptLogRows]);

  const exportReceiptLogXlsx = useCallback(() => {
    const header = ["일련번호", "기부자", "주민번호(마스킹)", "금액", "기부일", "발급일", "비고"];
    const rows = receiptLogRows.map(r => [
      r.serial_number,
      r.donor_name,
      r.resident_number_masked ?? "",
      r.donation_amount,
      r.donation_date,
      r.issued_date,
      r.note ?? "",
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([header, ...rows]), "발급대장");
    XLSX.writeFile(wb, `기부금영수증_발급대장_${receiptLogYear}.xlsx`);
  }, [receiptLogRows, receiptLogYear]);

  const yearStr = String(year);

  useEffect(() => {
    if (!supabase) return;
    (async () => {
      const cid = getChurchId();
      setChurchId(cid);
      const { data: settingsRow } = await supabase.from("church_settings").select("church_registration_number, representative_name, church_address, church_tel, seal_image_url").eq("church_id", cid).maybeSingle();
      setChurchSettings(settingsRow ?? null);
    })();
  }, [sealSettingsOpen]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const u = await buildDonationReceiptSealSrc(supabase, churchId, churchSettings?.seal_image_url);
      if (!cancelled) setReceiptSealImgSrc(u);
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, churchId, churchSettings]);

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
    const freshSrc = await buildDonationReceiptSealSrc(supabase, churchId, churchSettings?.seal_image_url);
    flushSync(() => setReceiptSealImgSrc(freshSrc));
    await awaitReceiptSealImagesLoaded();
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
        backgroundColor: "var(--color-surface)",
        logging: false,
      });
      canvases.push(canvas);
    }
    return canvases;
  }, [supabase, churchId, churchSettings]);

  const handleSaveImage = async () => {
    if (!receiptDonor) return;
    if (
      !selectedDonor ||
      residentFirst.length !== 6 ||
      residentLast.length !== 7 ||
      !/^\d+$/.test(residentFirst) ||
      !/^\d+$/.test(residentLast)
    ) {
      toast?.("주민등록번호 13자리를 모두 입력해 주세요.", "warn");
      return;
    }
    try {
      const canvases = await captureReceiptPages();
      const gap = 16;
      const totalHeight = canvases.reduce((s, c) => s + c.height, 0) + gap * (canvases.length - 1);
      const w = canvases[0].width;
      const full = document.createElement("canvas");
      full.width = w;
      full.height = totalHeight;
      const ctx = full.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#ffffff";
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
      if (receiptSubTab === "individual" && receiptDonor && selectedDonor) {
        let cid: string | null = null;
        try {
          cid = churchId ?? getChurchId();
        } catch {
          cid = null;
        }
        await insertDonationReceiptLog(supabase, cid, {
          donorName: receiptDonor.name,
          residentMasked: maskReceiptResidentNumber(residentFirst, residentLast),
          donationAmount: receiptData.total,
          donationDate: lastDonationDateInYearForDonor(offerings, receiptDonor.id, yearStr),
          issuedDate: new Date().toISOString().slice(0, 10),
          receiptYear: yearStr,
          channelNote: "이미지 저장",
        });
        if (cid && supabase) {
          await persistDonationReceiptRow(supabase, toast, {
            churchId: cid,
            donor: receiptDonor,
            taxYear: year,
            total: receiptData.total,
            offerings,
            cfg: {
              churchName: cfg.churchName,
              churchAddress: cfg.churchAddress || null,
              representativeName: cfg.representativeName || null,
            },
            residentMasked: maskReceiptResidentNumber(residentFirst, residentLast),
            memo: "이미지 저장",
          });
        }
      }
    } catch (e) {
      console.error(e);
      toast?.("이미지 저장에 실패했습니다.", "err");
    }
  };

  const handleIssueReceipt = async () => {
    if (receiptSubTab !== "individual") return;
    if (!receiptDonor) return;
    if (receiptIssued) return;
    if (
      !selectedDonor ||
      residentFirst.length !== 6 ||
      residentLast.length !== 7 ||
      !/^\d+$/.test(residentFirst) ||
      !/^\d+$/.test(residentLast)
    ) {
      toast?.("주민등록번호 13자리를 모두 입력해 주세요.", "warn");
      return;
    }
    if (!supabase) {
      alert("발급에 실패했습니다. 다시 시도해주세요.");
      return;
    }
    const maskedForLog = maskReceiptResidentNumber(residentFirst, residentLast);
    let logCid: string | null = null;
    try {
      logCid = churchId ?? getChurchId();
    } catch {
      logCid = null;
    }
    try {
      let receiptChurchId: string | null = null;
      try {
        receiptChurchId = getChurchId();
      } catch {
        receiptChurchId = null;
      }
      if (!receiptChurchId || !receiptDonor) {
        alert("발급에 실패했습니다. 다시 시도해주세요.");
        return;
      }
      const okPersist = await persistDonationReceiptRow(supabase, toast, {
        churchId: receiptChurchId,
        donor: receiptDonor,
        taxYear: year,
        total: receiptData.total,
        offerings,
        cfg: {
          churchName: cfg.churchName,
          churchAddress: cfg.churchAddress || null,
          representativeName: cfg.representativeName || null,
        },
        residentMasked: maskedForLog,
        memo: "발급하기",
      });
      if (!okPersist) {
        alert("발급에 실패했습니다. 다시 시도해주세요.");
        return;
      }
      const okLog = await insertDonationReceiptLog(supabase, logCid, {
        donorName: receiptDonor.name,
        residentMasked: maskedForLog,
        donationAmount: receiptData.total,
        donationDate: lastDonationDateInYearForDonor(offerings, receiptDonor.id, yearStr),
        issuedDate: new Date().toISOString().slice(0, 10),
        receiptYear: yearStr,
        channelNote: "발급하기",
      });
      if (!okLog) {
        alert("발급에 실패했습니다. 다시 시도해주세요.");
        return;
      }
      alert("기부금 영수증이 발급되었습니다.");
      void fetchReceiptLogRows();
      setReceiptIssued(true);
    } catch (err) {
      console.error("발급 실패:", err);
      alert("발급에 실패했습니다. 다시 시도해주세요.");
    }
  };

  const handleDownloadPdf = async () => {
    if (!receiptDonor) return;
    if (
      !selectedDonor ||
      residentFirst.length !== 6 ||
      residentLast.length !== 7 ||
      !/^\d+$/.test(residentFirst) ||
      !/^\d+$/.test(residentLast)
    ) {
      toast?.("주민등록번호 13자리를 모두 입력해 주세요.", "warn");
      return;
    }
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
    } catch (e) {
      console.error(e);
      toast?.("PDF 저장에 실패했습니다.", "err");
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
      return maskReceiptResidentNumber(first, last);
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
  const donationReceiptSealInner = useMemo(() => {
    const lines = getSealLines(cfg.churchName);
    return (
      <div className="seal-inner-r">
        {receiptSealImgSrc ? (
          <img
            data-receipt-seal=""
            src={receiptSealImgSrc}
            alt=""
            crossOrigin="anonymous"
            style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
          />
        ) : (
          <>
            {lines[0] && <span className="seal-text-r seal-line1-r">{lines[0]}</span>}
            {lines[1] && <span className="seal-text-r seal-line2-r">{lines[1]}</span>}
            {lines[2] && <span className="seal-text-r seal-line3-r">{lines[2]}</span>}
          </>
        )}
      </div>
    );
  }, [receiptSealImgSrc, cfg.churchName]);
  const getLastDay = (y: number, m: number) => new Date(y, m, 0).getDate();
  const handleShare = async () => {
    if (!receiptDonor) return;
    if (
      !selectedDonor ||
      residentFirst.length !== 6 ||
      residentLast.length !== 7 ||
      !/^\d+$/.test(residentFirst) ||
      !/^\d+$/.test(residentLast)
    ) {
      toast?.("주민등록번호 13자리를 모두 입력해 주세요.", "warn");
      return;
    }
    const title = `${cfg.churchName} 기부금 영수증`;
    const description = `${receiptDonor.name} / ${year}년 / ₩${receiptData.total.toLocaleString("ko-KR")}`;
    const logShare = (channelNote: string) => {
      let cid: string | null = null;
      try {
        cid = churchId ?? getChurchId();
      } catch {
        cid = null;
      }
      return insertDonationReceiptLog(supabase, cid, {
        donorName: receiptDonor.name,
        residentMasked: maskReceiptResidentNumber(residentFirst, residentLast),
        donationAmount: receiptData.total,
        donationDate: lastDonationDateInYearForDonor(offerings, receiptDonor.id, yearStr),
        issuedDate: new Date().toISOString().slice(0, 10),
        receiptYear: yearStr,
        channelNote,
      });
    };
    if (typeof window !== "undefined" && window.Kakao) {
      initKakao();
      if (window.Kakao.isInitialized?.()) {
        shareTextToKakao({
          title,
          description,
          linkUrl: window.location.origin + window.location.pathname + window.location.search,
        });
        void logShare("카카오톡 공유");
        return;
      }
    }
    const text = `${title}\n${description}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "기부금 영수증", text });
        await logShare("웹 공유");
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          await navigator.clipboard?.writeText(text);
          await logShare("클립보드 복사");
        }
      }
    } else if (navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      await logShare("클립보드 복사");
      toast?.("내용을 클립보드에 복사했습니다.", "ok");
    } else {
      toast?.("이 환경에서는 공유할 수 없습니다.", "warn");
    }
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
        const freshSrc = await buildDonationReceiptSealSrc(supabase, churchId, churchSettings?.seal_image_url);
        flushSync(() => setReceiptSealImgSrc(freshSrc));
        await awaitReceiptSealImagesLoaded();
        const html2canvas = (await import("html2canvas")).default;
        const { jsPDF } = await import("jspdf");
        const a4W = 210;
        const a4H = 297;
        for (let p = 0; p < pages.length; p++) {
          const canvas = await html2canvas(pages[p] as HTMLElement, {
            scale: 2,
            useCORS: true,
            backgroundColor: "var(--color-surface)",
            logging: false,
          });
          if (batchIndex === 0 && p === 0) pdfRef.current = new jsPDF();
          else pdfRef.current!.addPage();
          const dataUrl = canvas.toDataURL("image/png");
          pdfRef.current!.addImage(dataUrl, "PNG", 0, 0, a4W, a4H);
        }
        const d = batchPdfList[batchIndex];
        const rn = d ? batchResidentNumbers[d.id] : undefined;
        let cidBatch: string | null = null;
        try {
          cidBatch = churchId ?? getChurchId();
        } catch {
          cidBatch = null;
        }
        if (d && rn && rn.first.length === 6 && rn.last.length === 7 && /^\d+$/.test(rn.first) && /^\d+$/.test(rn.last)) {
          const listB = offerings.filter(o => o.donorId === d.id && o.date.startsWith(yearStr));
          const totalB = listB.reduce((s, o) => s + o.amount, 0);
          await insertDonationReceiptLog(supabase, cidBatch, {
            donorName: d.name,
            residentMasked: maskReceiptResidentNumber(rn.first, rn.last),
            donationAmount: totalB,
            donationDate: lastDonationDateInYearForDonor(offerings, d.id, yearStr),
            issuedDate: new Date().toISOString().slice(0, 10),
            receiptYear: yearStr,
            channelNote: "일괄 PDF",
          });
          if (cidBatch && supabase) {
            await persistDonationReceiptRow(supabase, toast, {
              churchId: cidBatch,
              donor: d,
              taxYear: year,
              total: totalB,
              offerings,
              cfg: {
                churchName: cfg.churchName,
                churchAddress: cfg.churchAddress || null,
                representativeName: cfg.representativeName || null,
              },
              residentMasked: maskReceiptResidentNumber(rn.first, rn.last),
              memo: "일괄 PDF",
            });
          }
        }
      } catch (e) {
        console.error(e);
      }
      setBatchIndex(i => i + 1);
    }, 400);
    return () => clearTimeout(timer);
  }, [batchGenerating, batchIndex, batchPdfList, batchResidentNumbers, offerings, yearStr, year, supabase, churchId, churchSettings, cfg.churchName, cfg.churchAddress, cfg.representativeName, toast]);

  const handleBatchPdf = () => {
    const list = donorsWithOfferingsInYear.filter(d => batchSelected.has(d.id));
    if (list.length === 0) return;
    setBatchPdfList(list);
    setBatchIndex(0);
    pdfRef.current = null;
    setBatchGenerating(true);
  };

  const receiptInputBase = useMemo<CSSProperties>(
    () => ({
      height: mob ? 32 : 40,
      padding: mob ? "0 10px" : "0 14px",
      borderRadius: mob ? 6 : 10,
      border: `1px solid ${C.border}`,
      fontSize: mob ? 12 : 14,
      fontFamily: "inherit",
      outline: "none",
      width: "100%",
      maxWidth: 360,
      boxSizing: "border-box",
      color: "var(--color-text-muted)",
    }),
    [mob]
  );

  const receiptSubTabs: { id: ReceiptSubTab; label: string }[] = [
    { id: "individual", label: "개별 발급" },
    { id: "bulk", label: "일괄 발급" },
    { id: "history", label: "발급 이력" },
  ];

  const handleReprintPdf = useCallback(async () => {
    if (
      !reprintModal ||
      reprintModal.ssnFirst.length !== 6 ||
      reprintModal.ssnLast.length !== 7 ||
      !/^\d+$/.test(reprintModal.ssnFirst) ||
      !/^\d+$/.test(reprintModal.ssnLast)
    )
      return;
    try {
      const { jsPDF } = await import("jspdf");
      const { registerKoreanFont } = await import("@/utils/fontLoader");
      const pdf = new jsPDF({ unit: "mm", format: "a4" });
      await registerKoreanFont(pdf);
      pdf.setFont("NanumGothic", "normal");
      pdf.setFontSize(16);
      pdf.text("기부금 영수증 (재출력)", 105, 20, { align: "center" });
      pdf.setFontSize(10);
      pdf.text(`기부자: ${reprintModal.receipt.member_name}  주민등록번호: ${maskReceiptResidentNumber(reprintModal.ssnFirst, reprintModal.ssnLast)}  총액: ₩${reprintModal.receipt.total_amount.toLocaleString("ko-KR")}  발급번호: ${reprintModal.receipt.receipt_number}  발급일: ${reprintModal.receipt.issue_date}`, 20, 35);
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
      <div
        style={{
          display: "flex",
          gap: 4,
          width: "100%",
          alignItems: "stretch",
          borderBottom: `2px solid ${C.border}`,
          paddingBottom: 12,
        }}
      >
        <div style={{ ...financeSubTabRowStyle, flex: 1, minWidth: 0, marginBottom: 0 }}>
          {receiptSubTabs.map((t) => (
            <button
              key={t.id}
              type="button"
              className="finance-nav-btn"
              onClick={() => setReceiptSubTab(t.id)}
              style={financeSubTabStyle(receiptSubTab === t.id, "rowEqual", mob)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="finance-nav-btn"
          onClick={() => setSealSettingsOpen(true)}
          style={{
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            height: mob ? 28 : 36,
            minHeight: mob ? 28 : 36,
            maxHeight: mob ? 28 : 36,
            padding: mob ? "0 10px" : "0 14px",
            borderRadius: mob ? 6 : 8,
            border: `1px solid ${C.border}`,
            background: "var(--color-primary-soft)",
            color: "var(--color-text-muted)",
            fontSize: mob ? 10 : 13,
            fontWeight: 600,
            cursor: "pointer",
            fontFamily: "inherit",
            outline: "none",
            boxShadow: "none",
          }}
          title="기부금영수증 설정"
        >
          <Settings size={14} /> 설정
        </button>
      </div>

      {(receiptSubTab === "individual" || receiptSubTab === "bulk") && receiptSettingsIncomplete && (
        <div style={{ padding: mob ? "10px 12px" : "16px 20px", borderRadius: mob ? 8 : 16, border: `1px solid ${C.border}`, background: "var(--color-primary-soft)", color: "var(--color-text-muted)" }}>
          <p style={{ margin: 0, fontSize: mob ? 12 : 15, fontWeight: 700, color: C.navy }}>기부금영수증 설정이 완료되지 않았습니다.</p>
          <p style={{ margin: "6px 0 8px", fontSize: mob ? 11 : 14, color: "var(--color-text-muted)", lineHeight: mob ? 1.4 : 1.6 }}>교회 고유번호, 대표자, 소재지를 먼저 등록해주세요. 미등록 시 PDF에 해당 정보가 빈칸으로 나옵니다.</p>
          <button type="button" onClick={() => setSealSettingsOpen(true)} style={{ padding: 0, background: "none", border: "none", color: C.primary, fontWeight: 600, fontSize: mob ? 11 : 14, cursor: "pointer" }}>설정하러 가기 →</button>
        </div>
      )}

      {sealSettingsOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={() => setSealSettingsOpen(false)}>
          <div style={{ maxWidth: 480, width: "100%", height: "90vh", maxHeight: "90vh", display: "flex", flexDirection: "column", overflow: "hidden", background: "var(--color-surface)", borderRadius: 20 }} onClick={e => e.stopPropagation()}>
            <div ref={sealSettingsFormRef} style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: 20 }}>
              <SealSettingsSection
                churchId={churchId}
                toast={sealSettingsToast}
                onSaved={() => {
                  setSealSettingsOpen(false);
                  if (supabase && churchId) {
                    supabase
                      .from("church_settings")
                      .select("church_registration_number, representative_name, church_address, church_tel, seal_image_url")
                      .eq("church_id", churchId)
                      .maybeSingle()
                      .then(({ data }) => setChurchSettings(data ?? null));
                  }
                }}
              />
            </div>
            <div
              style={{
                flexShrink: 0,
                padding: mob ? "10px 16px 16px" : "12px 20px 20px",
                borderTop: `1px solid ${C.border}`,
                display: "flex",
                gap: 10,
              }}
            >
              <button
                type="button"
                onClick={() => {
                  console.log("=== 모달 하단 [저장] 클릭 ===");
                  triggerSealSettingsSave();
                }}
                style={{
                  flex: 1,
                  padding: mob ? "10px 12px" : "12px 16px",
                  borderRadius: mob ? 8 : 10,
                  border: "none",
                  background: C.primary,
                  color: "#fff",
                  cursor: "pointer",
                  fontSize: mob ? 13 : 14,
                  fontWeight: 600,
                  fontFamily: "inherit",
                }}
              >
                저장
              </button>
              <button
                type="button"
                onClick={() => setSealSettingsOpen(false)}
                style={{
                  flex: 1,
                  padding: mob ? "10px 12px" : "12px 16px",
                  borderRadius: mob ? 8 : 10,
                  border: `1px solid ${C.border}`,
                  background: C.bg,
                  color: "var(--color-text-muted)",
                  cursor: "pointer",
                  fontSize: mob ? 13 : 14,
                  fontWeight: 600,
                  fontFamily: "inherit",
                }}
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {receiptSubTab === "individual" && (
        <>
      <Card style={{ padding: mob ? 12 : 20 }}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: mob ? 10 : 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }} ref={yearDropdownRef}>
            <label style={{ fontSize: mob ? 11 : 13, fontWeight: 600, color: C.navy, whiteSpace: "nowrap" }}>귀속연도</label>
            <div style={{ position: "relative" }}>
              <button
                type="button"
                className="finance-nav-btn"
                onClick={(e) => { e.stopPropagation(); setYearDropdownOpen(o => !o); }}
                style={{
                  minWidth: 88,
                  height: mob ? 32 : 40,
                  padding: mob ? "0 28px 0 10px" : "0 32px 0 14px",
                  borderRadius: mob ? 6 : 10,
                  border: `1px solid ${C.border}`,
                  fontSize: mob ? 12 : 14,
                  fontFamily: "inherit",
                  color: C.navy,
                  background: "var(--color-surface)",
                  cursor: "pointer",
                  textAlign: "left",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                  boxSizing: "border-box",
                }}
              >
                <span>{year}년</span>
                <span style={{ flexShrink: 0, display: "flex", alignItems: "center", fontSize: mob ? 10 : 12 }}>▼</span>
              </button>
              {yearDropdownOpen && (
                <div
                  style={{
                    position: "absolute",
                    top: "100%",
                    left: 0,
                    marginTop: 4,
                    minWidth: "100%",
                    background: "var(--color-surface)",
                    border: `1px solid ${C.border}`,
                    borderRadius: 6,
                    boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
                    zIndex: 50,
                    overflow: "hidden",
                  }}
                >
                  {[currentYear, currentYear - 1, currentYear - 2].map((y) => (
                    <button
                      key={y}
                      type="button"
                      className="finance-nav-btn"
                      onClick={() => { setYear(y); setCurrentPageBatch(1); setYearDropdownOpen(false); }}
                      style={{
                        display: "block",
                        width: "100%",
                        padding: mob ? "8px 10px" : "10px 14px",
                        border: "none",
                        background: year === y ? C.navy : "transparent",
                        color: year === y ? "#fff" : C.navy,
                        fontSize: mob ? 12 : 14,
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
            className="finance-nav-btn"
            onClick={() => setReceiptSubTab("bulk")}
            style={{
              height: mob ? 32 : 40,
              padding: mob ? "0 12px" : "0 20px",
              borderRadius: mob ? 6 : 10,
              border: `1px solid ${C.border}`,
              background: "var(--color-primary-soft)",
              color: "var(--color-text-muted)",
              fontWeight: 600,
              fontSize: mob ? 11 : 14,
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            일괄 발급으로 이동
          </button>
        </div>
      </Card>

          <Card style={{ padding: mob ? 12 : 20, border: `1px solid ${C.border}` }}>
            <h4 style={{ margin: "0 0 12px", fontSize: mob ? 13 : 16, fontWeight: 700, color: C.navy }}>교인 선택</h4>
            <div style={{ display: "flex", flexDirection: "column", gap: mob ? 12 : 16 }}>
              <div>
                <label style={{ display: "block", fontSize: mob ? 11 : 13, fontWeight: 600, color: C.text2, marginBottom: mob ? 6 : 8 }}>이름으로 검색</label>
                <input
                  type="text"
                  className="receipt-form-input finance-nav-btn"
                  value={donorSearch}
                  onChange={e => setDonorSearch(e.target.value)}
                  placeholder="검색 후 아래에서 선택"
                  style={{ ...receiptInputBase, margin: 0 }}
                />
              </div>
              <div ref={donorDropdownRef} data-testid="donor-dropdown" style={{ position: "relative" }}>
                <label style={{ display: "block", fontSize: mob ? 11 : 13, fontWeight: 600, color: C.text2, marginBottom: mob ? 6 : 8 }}>교인 선택</label>
                <button
                  type="button"
                  className="finance-nav-btn"
                  onClick={(e) => { e.stopPropagation(); setDonorDropdownOpen(o => !o); }}
                  style={{
                    ...receiptInputBase,
                    margin: 0,
                    cursor: "pointer",
                    height: mob ? 32 : 40,
                    textAlign: "left",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    color: selectedDonorId ? C.navy : C.textFaint,
                  }}
                >
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {selectedDonor ? `${selectedDonor.name}${selectedDonor.phone ? ` (${selectedDonor.phone})` : ""}` : "선택하세요"}
                  </span>
                  <span style={{ flexShrink: 0, marginLeft: 8, fontSize: mob ? 10 : 12 }}>▼</span>
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
                      background: "var(--color-surface)",
                      border: `1px solid ${C.border}`,
                      borderRadius: 6,
                      boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
                      zIndex: 50,
                    }}
                  >
                    <button
                      type="button"
                      className="finance-nav-btn"
                      onClick={() => { setSelectedDonorId(""); setDonorDropdownOpen(false); setResidentFirst(""); setResidentLast(""); }}
                      style={{
                        display: "block",
                        width: "100%",
                        padding: mob ? "8px 10px" : "10px 14px",
                        border: "none",
                        background: !selectedDonorId ? C.navy : "transparent",
                        color: !selectedDonorId ? "#fff" : C.navy,
                        fontSize: mob ? 12 : 14,
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
                        className="finance-nav-btn"
                        onClick={() => { setSelectedDonorId(d.id); setDonorDropdownOpen(false); setResidentFirst(""); setResidentLast(""); }}
                        style={{
                          display: "block",
                          width: "100%",
                          padding: mob ? "8px 10px" : "10px 14px",
                          border: "none",
                          borderTop: `1px solid ${C.borderLight}`,
                          background: selectedDonorId === d.id ? C.navy : "transparent",
                          color: selectedDonorId === d.id ? "#fff" : C.navy,
                          fontSize: mob ? 12 : 14,
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
                <div style={{ display: "flex", flexDirection: "column", gap: mob ? 8 : 12 }}>
                  <div style={{ padding: mob ? "10px 12px" : "14px 18px", borderRadius: mob ? 8 : 16, border: `1px solid ${C.border}`, background: "var(--color-primary-soft)", marginBottom: 4 }}>
                    <p style={{ margin: 0, fontSize: mob ? 12 : 15, fontWeight: 700, color: C.navy }}>개인정보 보호</p>
                    <p style={{ margin: "4px 0 0", fontSize: mob ? 11 : 14, color: "var(--color-text-muted)", lineHeight: mob ? 1.4 : 1.6 }}>주민등록번호는 서버에 저장되지 않으며, 영수증 PDF 생성 후 즉시 폐기됩니다.</p>
                  </div>
                  <label style={{ display: "block", fontSize: mob ? 11 : 13, fontWeight: 600, color: C.text2, marginBottom: mob ? 2 : 6 }}>주민등록번호 (13자리, - 제외)</label>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <input
                      type="text"
                      className="receipt-form-input finance-nav-btn"
                      inputMode="numeric"
                      maxLength={6}
                      autoComplete="off"
                      value={residentFirst}
                      onChange={e => {
                        const val = e.target.value.replace(/\D/g, "").slice(0, 6);
                        setResidentFirst(val);
                        if (val.length === 6) queueMicrotask(() => residentLastInputRef.current?.focus());
                      }}
                      placeholder="앞 6자리"
                      style={{ ...receiptInputBase, width: 90, margin: 0 }}
                    />
                    <span style={{ color: C.textMuted, fontWeight: 600, fontSize: mob ? 11 : 13 }}>-</span>
                    <input
                      ref={residentLastInputRef}
                      type="text"
                      className="receipt-form-input finance-nav-btn"
                      inputMode="numeric"
                      maxLength={7}
                      autoComplete="off"
                      value={residentLastPartDisplay(residentLast)}
                      onChange={e => setResidentLast(applyResidentLastPartInput(residentLast, e.target.value))}
                      placeholder="뒷 7자리"
                      style={{ ...receiptInputBase, width: 100, margin: 0 }}
                    />
                  </div>
                  {selectedDonor && total > 0 && !residentValid && (
                    <p style={{ fontSize: mob ? 11 : 14, color: "var(--color-text-faint)", margin: "4px 0 0" }}>주민등록번호를 입력해주세요 (앞 6자리 + 뒷 7자리)</p>
                  )}
                </div>
              )}
            </div>
            {selectedDonor && total > 0 && (
              <p style={{ margin: "12px 0 0", paddingTop: 10, borderTop: `1px solid ${C.borderLight}`, fontSize: mob ? 11 : 14, color: "var(--color-text-muted)" }}>{year}년 헌금 총액: <span style={{ fontWeight: 700, color: C.navy }}>₩{total.toLocaleString("ko-KR")}</span></p>
            )}
          </Card>

          {receiptDonor && (
            <div
              style={{
                width: "100%",
                maxWidth: "100%",
                margin: 0,
                padding: "0 0 12px",
                boxSizing: "border-box",
                backgroundColor: "transparent",
                boxShadow: "none",
              }}
            >
              <div
                style={{
                  width: "100%",
                  maxWidth: "210mm",
                  margin: "0 auto",
                  marginBottom: receiptIssued ? 20 : 12,
                  boxSizing: "border-box",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 10,
                  position: "relative",
                  zIndex: 2,
                }}
              >
                <button
                  type="button"
                  disabled={receiptIssued}
                  onClick={() => void handleIssueReceipt()}
                  style={{
                    width: "100%",
                    maxWidth: 200,
                    height: 44,
                    padding: 0,
                    boxSizing: "border-box",
                    backgroundColor: receiptIssued ? "#93c5fd" : "#2563EB",
                    color: "#fff",
                    border: "none",
                    borderRadius: 8,
                    fontSize: 15,
                    fontWeight: 700,
                    fontFamily: "inherit",
                    cursor: receiptIssued ? "default" : "pointer",
                    opacity: receiptIssued ? 0.85 : 1,
                  }}
                >
                  발급하기
                </button>
                {receiptIssued && (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "row",
                      flexWrap: "wrap",
                      justifyContent: "center",
                      alignItems: "center",
                      gap: 8,
                      width: "100%",
                      boxSizing: "border-box",
                    }}
                  >
                    <button
                      type="button"
                      onClick={handleDownloadPdf}
                      style={{
                        flex: "1 1 auto",
                        maxWidth: 160,
                        minWidth: 0,
                        height: 38,
                        padding: "0 8px",
                        boxSizing: "border-box",
                        background: "var(--color-surface)",
                        color: C.primary,
                        border: "1px solid #d1d5db",
                        borderRadius: 8,
                        fontSize: 13,
                        fontWeight: 500,
                        fontFamily: "inherit",
                        cursor: "pointer",
                      }}
                    >
                      미리보기 PDF
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveImage}
                      style={{
                        flex: "1 1 auto",
                        maxWidth: 160,
                        minWidth: 0,
                        height: 38,
                        padding: "0 8px",
                        boxSizing: "border-box",
                        background: "var(--color-surface)",
                        color: C.primary,
                        border: "1px solid #d1d5db",
                        borderRadius: 8,
                        fontSize: 13,
                        fontWeight: 500,
                        fontFamily: "inherit",
                        cursor: "pointer",
                      }}
                    >
                      이미지 저장
                    </button>
                    <button
                      type="button"
                      onClick={handleShare}
                      style={{
                        flex: "1 1 auto",
                        maxWidth: 160,
                        minWidth: 0,
                        height: 38,
                        padding: "0 8px",
                        boxSizing: "border-box",
                        background: "var(--color-surface)",
                        color: C.primary,
                        border: "1px solid #d1d5db",
                        borderRadius: 8,
                        fontSize: 13,
                        fontWeight: 500,
                        fontFamily: "inherit",
                        cursor: "pointer",
                      }}
                    >
                      카카오톡 공유
                    </button>
                  </div>
                )}
              </div>
              {receiptIssued && (
              <div
                key={`receipt-${receiptDonor.id}-${year}`}
                id="receipt-card"
                className="receipt-wrapper-r"
                style={{ margin: "0 auto", boxSizing: "border-box", background: "var(--color-surface)", width: "100%", maxWidth: "210mm", boxShadow: "none" }}
              >
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
                    <div style={{ fontSize: 12, color: "var(--color-text-muted)", textAlign: "center", marginTop: 20, borderTop: "1px solid #eee", paddingTop: 10 }}>- 1 / 2 -</div>
                    </div>
                  </div>
                  {/* 페이지 2: 테이블 7~12월 + 계 + 용도 + 증명 + 서명 */}
                  <div className="receipt-page" data-receipt-page="2">
                    <div style={{ fontSize: 10, color: "var(--color-text-faint)", textAlign: "right", marginBottom: 8 }}>002/002</div>
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
                        <div style={{ textAlign: "right", marginBottom: 32, fontSize: 14, color: "var(--color-text-muted)" }}>
                          신청인 &nbsp;&nbsp; <strong style={{ color: "#222", letterSpacing: 4 }}>{receiptDonor.name.split("").join(" ")}</strong> &nbsp;&nbsp; <span style={{ color: "#aaa" }}>(서명 또는 인)</span>
                        </div>
                        <div style={{ textAlign: "center", fontSize: 13, color: "var(--color-text-faint)", marginBottom: 16 }}>위와 같이 기부금을 기부하였음을 증명합니다.</div>
                        <div className="signature-area-r">
                          <div className="church-name-sign-r">{receiptChurchNameSpaced}</div>
                          <div className="pastor-sign-r">담임목사 &nbsp; {receiptPastorSpaced}</div>
                          <div className={receiptSealImgSrc ? "seal-r seal-r--image" : "seal-r"}>{donationReceiptSealInner}</div>
                        </div>
                      </div>
                    </div>
                    <div style={{ fontSize: 12, color: "var(--color-text-muted)", textAlign: "center", marginTop: 20, borderTop: "1px solid #eee", paddingTop: 10 }}>- 2 / 2 -</div>
                  </div>
                </div>
              </div>
              )}
            </div>
          )}
          {selectedDonor && total === 0 && <p style={{ color: "var(--color-text-faint)", fontSize: mob ? 11 : 14 }}>해당 연도 헌금 내역이 없습니다.</p>}
        </>
      )}

      {receiptSubTab === "bulk" && (
        <>
          <div ref={listRefBatch} style={{ ...PAGINATION_LIST_PARENT_STYLE }}>
            <Card style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
            <h4 style={{ margin: "0 0 10px", fontSize: mob ? 13 : 16, fontWeight: 700, color: C.navy }}>해당 연도 헌금 교인 ({donorsWithOfferingsInYear.length}명)</h4>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <input type="checkbox" checked={batchSelected.size === donorsWithOfferingsInYear.length && donorsWithOfferingsInYear.length > 0} onChange={toggleBatchSelectAll} style={{ width: 16, height: 16 }} />
              <span style={{ fontSize: mob ? 11 : 14, color: "var(--color-text-muted)" }}>전체 선택/해제</span>
            </div>
            <div style={{ overflowX: "auto", flex: 1, minHeight: 0 }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={{ padding: mob ? "6px 8px" : "10px 14px", textAlign: "left", fontWeight: 600, color: C.text3, fontSize: mob ? 10 : 11, borderBottom: `2px solid ${C.border}`, textTransform: "uppercase", letterSpacing: "0.5px", background: C.surfaceHover }}></th>
                    <th style={{ padding: mob ? "6px 8px" : "10px 14px", textAlign: "left", fontWeight: 600, color: C.text3, fontSize: mob ? 10 : 11, borderBottom: `2px solid ${C.border}`, textTransform: "uppercase", letterSpacing: "0.5px", background: C.surfaceHover }}>교인 이름</th>
                    <th style={{ padding: mob ? "6px 8px" : "10px 14px", textAlign: "right", fontWeight: 600, color: C.text3, fontSize: mob ? 10 : 11, borderBottom: `2px solid ${C.border}`, textTransform: "uppercase", letterSpacing: "0.5px", background: C.surfaceHover }}>연간 헌금 총액</th>
                    <th style={{ padding: mob ? "6px 8px" : "10px 14px", textAlign: "left", fontWeight: 600, color: C.text3, fontSize: mob ? 10 : 11, borderBottom: `2px solid ${C.border}`, textTransform: "uppercase", letterSpacing: "0.5px", background: C.surfaceHover }}>주민등록번호</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedBatchDonors.map(d => {
                    const sum = offerings.filter(o => o.donorId === d.id && o.date.startsWith(yearStr)).reduce((s, o) => s + o.amount, 0);
                    const rn = batchResidentNumbers[d.id] ?? { first: "", last: "" };
                    return (
                      <tr key={d.id} style={{ borderBottom: `1px solid ${C.borderLight}` }}>
                        <td style={{ padding: mob ? "6px 8px" : "12px 14px" }}>
                          <input type="checkbox" checked={batchSelected.has(d.id)} onChange={() => toggleBatchSelect(d.id)} style={{ width: 16, height: 16 }} />
                        </td>
                        <td style={{ padding: mob ? "6px 8px" : "12px 14px", fontSize: mob ? 11 : 14, color: "var(--color-text-muted)", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }} title={d.name}>{d.name}</td>
                        <td style={{ padding: mob ? "6px 8px" : "12px 14px", textAlign: "right", fontSize: mob ? 11 : 14, fontWeight: 600, color: C.navy }}>₩{sum.toLocaleString("ko-KR")}</td>
                        <td style={{ padding: mob ? "6px 8px" : "12px 14px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                            <input
                              type="text"
                              className="receipt-form-input finance-nav-btn"
                              inputMode="numeric"
                              maxLength={6}
                              value={rn.first}
                              onChange={e => {
                                const val = e.target.value.replace(/\D/g, "").slice(0, 6);
                                setBatchResidentNumbers(prev => ({ ...prev, [d.id]: { ...(prev[d.id] ?? { first: "", last: "" }), first: val } }));
                                if (val.length === 6) queueMicrotask(() => document.getElementById(`batch-resident-last-${d.id}`)?.focus());
                              }}
                              placeholder="앞6"
                              style={{ width: mob ? 52 : 60, height: mob ? 28 : 36, padding: mob ? "0 6px" : "0 8px", fontSize: mob ? 11 : 13, border: `1px solid ${C.border}`, borderRadius: mob ? 6 : 10, boxSizing: "border-box" }}
                            />
                            <span style={{ color: C.textMuted, fontSize: mob ? 11 : 13 }}>-</span>
                            <input
                              id={`batch-resident-last-${d.id}`}
                              type="text"
                              className="receipt-form-input finance-nav-btn"
                              inputMode="numeric"
                              maxLength={7}
                              autoComplete="off"
                              value={residentLastPartDisplay(rn.last)}
                              onChange={e => {
                                const prev = rn.last;
                                const next = applyResidentLastPartInput(prev, e.target.value);
                                setBatchResidentNumbers(p => ({ ...p, [d.id]: { ...(p[d.id] ?? { first: "", last: "" }), last: next } }));
                              }}
                              placeholder="뒷7"
                              style={{ width: mob ? 64 : 72, height: mob ? 28 : 36, padding: mob ? "0 6px" : "0 8px", fontSize: mob ? 11 : 13, border: `1px solid ${C.border}`, borderRadius: mob ? 6 : 10, boxSizing: "border-box" }}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {donorsWithOfferingsInYear.length === 0 && <p style={{ padding: 16, color: "var(--color-text-faint)", fontSize: mob ? 11 : 14, textAlign: "center" }}>해당 연도 헌금 기록이 있는 교인이 없습니다.</p>}
            {donorsWithOfferingsInYear.length > 0 && (
              <Pagination totalItems={donorsWithOfferingsInYear.length} itemsPerPage={10} currentPage={currentPageBatch} onPageChange={(p) => setCurrentPageBatch(p)} />
            )}
            </Card>
          </div>
          {batchSelected.size > 0 && !batchResidentValid && (
            <p style={{ fontSize: mob ? 11 : 14, color: "#c00", margin: "0 0 8px" }}>선택한 교인 모두 주민등록번호를 입력해주세요</p>
          )}
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <Button onClick={handleBatchPdf} disabled={batchSelected.size === 0 || !batchResidentValid || batchGenerating} variant="accent">
              {batchGenerating ? `생성 중 (${batchIndex + 1}/${batchPdfList.length})...` : "선택한 교인 일괄 PDF 생성"}
            </Button>
          </div>
          {batchGenerating && receiptDonor && (
            <div id="receipt-card-batch" className="receipt-wrapper-r" style={{ position: "absolute", left: -9999, top: 0, background: "var(--color-surface)", width: "210mm", maxWidth: "100%", boxSizing: "border-box" }}>
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
                    <div style={{ fontSize: 12, color: "var(--color-text-muted)", textAlign: "center", marginTop: 20, borderTop: "1px solid #eee", paddingTop: 10 }}>- 1 / 2 -</div>
                  </div>
                </div>
                <div className="receipt-page" data-receipt-page="2">
                  <div style={{ fontSize: 10, color: "var(--color-text-faint)", textAlign: "right", marginBottom: 8 }}>002/002</div>
                  <div className="receipt-body-r" style={{ paddingTop: 0, flex: 1 }}>
                    <div className="section-r">
                      <table className="donation-table-r monthly-table-r">
                        <thead><tr><th style={{ width: 90 }}>유형</th><th style={{ width: 50 }}>코드</th><th style={{ width: 60 }}>구분</th><th style={{ width: 95 }}>연월일</th><th>내용 (품명/수량/단가)</th><th style={{ width: 110, textAlign: "right" }}>금액</th></tr></thead>
                        <tbody>
                          {[7, 8, 9, 10, 11, 12].map((m, idx) => {
                            const lastDay = getLastDay(year, m);
                            const dateStr = `${year}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
                            const amt = receiptData.monthly[m - 1];
                            return (<tr key={m}><td className="text-left-r">&quot;</td><td>{cfg.donationCode}</td><td>{cfg.donationCategory}</td><td>{dateStr}</td><td className="text-left-r">헌금</td><td className={`text-right-r ${amt > 0 ? "has-value-r" : ""}`}>{amt > 0 ? amt.toLocaleString("ko-KR") : "0"}</td></tr>);
                          })}
                        </tbody>
                        <tfoot><tr><td colSpan={5} className="total-label-r">계</td><td className="total-amount-r">₩ {receiptData.total.toLocaleString("ko-KR")}</td></tr></tfoot>
                      </table>
                    </div>
                    <div className="usage-row-r"><span className="label-r">용도 :</span><span className="usage-checkbox-r"><span className="box-r checked-r">✓</span> 세금공제신청용</span><span className="usage-checkbox-r"><span className="box-r"></span> 기타 (용도의 사용불가)</span></div>
                    <div className="certification-r">
                      <div className="cert-text-r"><span className="law-ref-r">「소득세법」 제34조, 「조세특례제한법」 제76조 · 제88조의4 및 「법인세법」 제24조에 따른 기부금을</span> 위와 같이 기부하였음을 증명하여 주시기 바랍니다.</div>
                      <div className="cert-date-r">{issueDate.replace(/년\s*/, " 년  ").replace(/월\s*/, " 월  ").replace(/일$/, " 일")}</div>
                      <div style={{ textAlign: "right", marginBottom: 32, fontSize: 14, color: "var(--color-text-muted)" }}>신청인 &nbsp;&nbsp; <strong style={{ color: "#222", letterSpacing: 4 }}>{receiptDonor.name.split("").join(" ")}</strong> &nbsp;&nbsp; <span style={{ color: "#aaa" }}>(서명 또는 인)</span></div>
                      <div style={{ textAlign: "center", fontSize: 13, color: "var(--color-text-faint)", marginBottom: 16 }}>위와 같이 기부금을 기부하였음을 증명합니다.</div>
                      <div className="signature-area-r">
                        <div className="church-name-sign-r">{receiptChurchNameSpaced}</div>
                        <div className="pastor-sign-r">담임목사 &nbsp; {receiptPastorSpaced}</div>
                        <div className={receiptSealImgSrc ? "seal-r seal-r--image" : "seal-r"}>{donationReceiptSealInner}</div>
                      </div>
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--color-text-muted)", textAlign: "center", marginTop: 20, borderTop: "1px solid #eee", paddingTop: 10 }}>- 2 / 2 -</div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {receiptSubTab === "bulk" && (
        <Card style={{ padding: 12 }}>
          <div style={{ padding: "10px 12px", borderRadius: 8, border: `1px solid ${C.border}`, background: "var(--color-primary-soft)", marginBottom: 12 }}>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: C.navy }}>업로드된 엑셀 파일은 서버에 전송되지 않습니다.</p>
            <p style={{ margin: "6px 0 0", fontSize: 11, color: "var(--color-text-muted)", lineHeight: 1.5 }}>모든 처리는 브라우저에서 이루어지며, 발급 완료 후 데이터는 즉시 폐기됩니다.</p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: C.navy }}>귀속연도</label>
              <select value={year} onChange={e => setYear(Number(e.target.value))} className="finance-nav-btn" style={{ height: 32, padding: "0 10px", borderRadius: 6, border: `1px solid ${C.border}`, fontSize: 12, background: "var(--color-surface)", color: "var(--color-text-muted)" }}>
                {[currentYear, currentYear - 1, currentYear - 2].map(y => <option key={y} value={y}>{y}년</option>)}
              </select>
              <button type="button" className="finance-nav-btn" onClick={() => { const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["이름", "주민등록번호", "주소"]]), "기부금영수증"); XLSX.writeFile(wb, "기부금영수증_템플릿.xlsx"); }} style={{ height: 32, padding: "0 12px", borderRadius: 6, border: `1px solid ${C.border}`, background: "var(--color-primary-soft)", color: "var(--color-text-muted)", fontWeight: 600, fontSize: 11, cursor: "pointer" }}>엑셀 템플릿 다운로드</button>
            </div>
            <div onDragOver={e => { e.preventDefault(); e.currentTarget.style.background = "#eef1f5"; }} onDragLeave={e => { e.currentTarget.style.background = "#f5f8ff"; }} onClick={() => fileInputRef.current?.click()} style={{ border: `2px dashed ${C.border}`, borderRadius: 8, padding: 20, textAlign: "center", background: "var(--color-primary-soft)", cursor: "pointer", fontSize: 11, color: "var(--color-text-faint)" }}>엑셀 파일을 여기에 놓거나 클릭하여 선택</div>
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls" style={{ display: "none" }} onChange={async e => { const f = e.target.files?.[0]; if (!f) return; const buf = await f.arrayBuffer(); const wb = XLSX.read(buf, { type: "array" }); const sh = wb.Sheets[wb.SheetNames[0]]; const rows = XLSX.utils.sheet_to_json<string[]>(sh, { header: 1 }) as (string[])[]; const data = rows.slice(1).filter(r => r && r[0]).map((r, i) => ({ name: String(r[0] ?? "").trim(), ssn: String(r[1] ?? "").replace(/\D/g, "").slice(0, 13), address: String(r[2] ?? "").trim() })); setBulkFile(data); setBulkMatched({}); e.target.value = ""; }} />
            {bulkFile.length > 0 && (
              <>
                <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: C.navy }}>미리보기 ({bulkFile.length}명) · 주민번호 마스킹 표시</p>
                <div style={{ overflowX: "auto", maxHeight: 280, border: `1px solid ${C.border}`, borderRadius: 8 }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr>
                        <th style={{ padding: "6px 8px", textAlign: "left", fontWeight: 600, color: C.text3, fontSize: 10, borderBottom: `2px solid ${C.border}`, textTransform: "uppercase", letterSpacing: "0.5px", background: C.surfaceHover }}>이름</th>
                        <th style={{ padding: "6px 8px", fontWeight: 600, color: C.text3, fontSize: 10, borderBottom: `2px solid ${C.border}`, textTransform: "uppercase", letterSpacing: "0.5px", background: C.surfaceHover }}>주민등록번호</th>
                        <th style={{ padding: "6px 8px", textAlign: "left", fontWeight: 600, color: C.text3, fontSize: 10, borderBottom: `2px solid ${C.border}`, textTransform: "uppercase", letterSpacing: "0.5px", background: C.surfaceHover }}>주소</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bulkFile.slice(0, 50).map((row, i) => (
                        <tr key={i} style={{ borderBottom: `1px solid ${C.borderLight}`, background: donors.some(d => d.name.trim() === row.name) ? "transparent" : "#fafbfc" }}>
                          <td style={{ padding: "6px 8px", fontSize: 11, color: "var(--color-text-muted)" }}>{row.name}</td>
                          <td style={{ padding: "6px 8px", fontSize: 11, color: "var(--color-text-muted)" }}>{row.ssn.length === 13 ? maskReceiptResidentNumber(row.ssn.slice(0, 6), row.ssn.slice(6, 13)) : row.ssn ? "—" : "-"}</td>
                          <td style={{ padding: "6px 8px", fontSize: 11, color: "var(--color-text-muted)" }}>{row.address || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {bulkFile.length > 50 && <p style={{ padding: 6, margin: 0, fontSize: 10, color: "var(--color-text-faint)" }}>외 {bulkFile.length - 50}명</p>}
                </div>
                {!bulkProgress.done && bulkProgress.total === 0 && (
                  <button type="button" disabled={bulkFile.length === 0} onClick={async () => { setBulkProgress({ current: 0, total: bulkFile.length, done: false }); const JSZip = (await import("jszip")).default; const { saveAs } = await import("file-saver"); const zip = new JSZip(); let churchId: string | null = null; try { churchId = getChurchId(); } catch (_) {} let sealBase64: string | null = null; if (churchId && churchSettings?.seal_image_url && supabase) { try { const path = churchSettings.seal_image_url.includes("/") ? churchSettings.seal_image_url : `${churchId}/seal.png`; const { data: sealData } = await supabase.storage.from("church-seals").download(path); if (sealData) { sealBase64 = await new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result as string); r.onerror = rej; r.readAsDataURL(sealData); }); } } catch (_) {} } for (let i = 0; i < bulkFile.length; i++) { const row = bulkFile[i]; const donor = donors.find(d => d.name.trim() === row.name); if (!donor || row.ssn.length !== 13) continue; const list = offerings.filter(o => o.donorId === donor.id && o.date.startsWith(String(year))); const total = list.reduce((s, o) => s + o.amount, 0); if (total === 0) continue; setBulkProgress({ current: i + 1, total: bulkFile.length, done: false }); await new Promise(r => setTimeout(r, 50)); const { jsPDF } = await import("jspdf"); const { registerKoreanFont } = await import("@/utils/fontLoader"); const pdf = new jsPDF({ unit: "mm", format: "a4" }); await registerKoreanFont(pdf); pdf.setFont("NanumGothic", "normal"); pdf.setFontSize(16); pdf.text("기부금 영수증", 105, 20, { align: "center" }); pdf.setFontSize(10); pdf.text(`기부자: ${donor.name}  주민등록번호: ${maskReceiptResidentNumber(row.ssn.slice(0, 6), row.ssn.slice(6, 13))}  주소: ${row.address || "-"}`, 20, 35); const receiptNum = `DR-${year}-${String(i + 1).padStart(5, "0")}`; pdf.text(`단체: ${cfg.churchName}  총액: ₩${total.toLocaleString("ko-KR")}  귀속연도: ${year}`, 20, 42); pdf.text(`발급일: ${new Date().toISOString().slice(0, 10)}  발급번호: ${receiptNum}`, 20, 49); if (sealBase64) pdf.addImage(sealBase64, "PNG", 150, 85, 25, 25); const blob = pdf.output("blob"); zip.file(`기부금영수증_${donor.name}_${year}.pdf`, blob); if (churchId && supabase) { try { const details = list.reduce<{ category: string; amount: number }[]>((acc, o) => { const cat = DEFAULT_CATEGORIES.find(c => c.id === o.categoryId); const name = cat?.name ?? o.categoryId; const existing = acc.find(x => x.category === name); if (existing) existing.amount += o.amount; else acc.push({ category: name, amount: o.amount }); return acc; }, []); await persistDonationReceiptRow(supabase, undefined, { churchId, donor, taxYear: year, total, offerings: list, cfg: { churchName: cfg.churchName, churchAddress: cfg.churchAddress || null, representativeName: cfg.representativeName || null }, residentMasked: maskReceiptResidentNumber(row.ssn.slice(0, 6), row.ssn.slice(6, 13)), memo: "일괄 ZIP PDF" }); await insertDonationReceiptLog(supabase, churchId, { donorName: donor.name, residentMasked: maskReceiptResidentNumber(row.ssn.slice(0, 6), row.ssn.slice(6, 13)), donationAmount: total, donationDate: lastDonationDateInYearForDonor(offerings, donor.id, String(year)), issuedDate: new Date().toISOString().slice(0, 10), receiptYear: String(year), channelNote: "일괄 ZIP PDF" }); } catch (_) { /* ignore */ } } } setBulkProgress({ current: bulkFile.length, total: bulkFile.length, done: true }); const blob = await zip.generateAsync({ type: "blob" }); saveAs(blob, `기부금영수증_일괄_${year}.zip`); setBulkFile([]); setBulkMatched({}); }} style={{ height: 32, padding: "0 16px", borderRadius: 6, border: "none", background: C.accent, color: "#fff", fontWeight: 600, fontSize: 11, cursor: "pointer" }}>일괄 PDF 생성 (ZIP)</button>
                )}
                {bulkProgress.total > 0 && !bulkProgress.done && <p style={{ margin: 0, fontSize: 11, color: C.textMuted }}>처리 중... {bulkProgress.current}/{bulkProgress.total}</p>}
                {bulkProgress.done && <p style={{ margin: 0, fontSize: 11, color: "var(--color-text-muted)" }}>완료. ZIP이 다운로드되었습니다. 엑셀 데이터는 폐기되었습니다.</p>}
              </>
            )}
          </div>
        </Card>
      )}

      {receiptSubTab === "history" && (
        <Card style={{ padding: mob ? 12 : 20 }}>
          <div style={{ display: "flex", gap: mob ? 8 : 12, flexWrap: "wrap", marginBottom: 12, alignItems: "center" }}>
            <select value={historyYearFilter} onChange={e => setHistoryYearFilter(Number(e.target.value))} className="finance-nav-btn" style={{ height: mob ? 32 : 40, padding: mob ? "0 10px" : "0 14px", borderRadius: mob ? 6 : 10, border: `1px solid ${C.border}`, fontSize: mob ? 12 : 14, background: "var(--color-surface)", color: "var(--color-text-muted)" }}>
              {[currentYear, currentYear - 1, currentYear - 2].map(y => <option key={y} value={y}>{y}년</option>)}
            </select>
            <input type="text" className="receipt-form-input finance-nav-btn" value={historySearch} onChange={e => setHistorySearch(e.target.value)} placeholder="교인명 검색" style={{ height: mob ? 32 : 40, padding: mob ? "0 10px" : "0 14px", borderRadius: mob ? 6 : 10, border: `1px solid ${C.border}`, width: mob ? 160 : 220, fontSize: mob ? 12 : 14, boxSizing: "border-box" }} />
            <button
              type="button"
              className="finance-nav-btn"
              onClick={async () => {
                console.log("[donation_receipts] 조회 버튼 클릭", { historyYearFilter });
                if (!supabase) {
                  toast?.("Supabase가 연결되지 않았습니다.", "warn");
                  return;
                }
                let cid: string;
                try {
                  cid = getChurchId();
                } catch {
                  toast?.("교회 ID를 확인할 수 없습니다.", "warn");
                  return;
                }
                const taxYear = Number(historyYearFilter);
                console.log("[donation_receipts] 조회 조건", { church_id: cid, tax_year: taxYear, taxYearRaw: historyYearFilter });
                const { data, error } = await supabase
                  .from("donation_receipts")
                  .select("id, receipt_number, member_name, tax_year, total_amount, issue_date, status, resident_number_masked, memo, created_at")
                  .eq("church_id", cid)
                  .eq("tax_year", taxYear)
                  .order("created_at", { ascending: false });
                console.log("[donation_receipts] 조회 결과", { rowCount: data?.length ?? 0, error: error ?? null, data });
                if (error) {
                  console.warn("[donation_receipts] select", error);
                  setReceiptHistoryFetchError(error.message);
                  setReceiptHistoryEmptyAfterFetch(false);
                  toast?.(`발급 이력 조회 실패: ${error.message}`, "warn");
                  setReceiptHistory([]);
                  return;
                }
                setReceiptHistoryFetchError(null);
                const rows = data ?? [];
                setReceiptHistoryEmptyAfterFetch(rows.length === 0);
                setReceiptHistory(rows);
              }}
              style={{ height: mob ? 32 : 40, padding: mob ? "0 14px" : "0 20px", borderRadius: mob ? 6 : 10, border: "none", background: C.primary, color: "#fff", fontWeight: 600, fontSize: mob ? 11 : 14, cursor: "pointer" }}
            >
              조회
            </button>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ padding: mob ? "6px 8px" : "10px 14px", textAlign: "left", fontWeight: 600, color: C.text3, fontSize: mob ? 10 : 11, borderBottom: `2px solid ${C.border}`, textTransform: "uppercase", letterSpacing: "0.5px", background: C.surfaceHover }}>발급번호</th>
                  <th style={{ padding: mob ? "6px 8px" : "10px 14px", textAlign: "left", fontWeight: 600, color: C.text3, fontSize: mob ? 10 : 11, borderBottom: `2px solid ${C.border}`, textTransform: "uppercase", letterSpacing: "0.5px", background: C.surfaceHover }}>교인명</th>
                  <th style={{ padding: mob ? "6px 8px" : "10px 14px", textAlign: "left", fontWeight: 600, color: C.text3, fontSize: mob ? 10 : 11, borderBottom: `2px solid ${C.border}`, textTransform: "uppercase", letterSpacing: "0.5px", background: C.surfaceHover }}>주민번호(마스킹)</th>
                  <th style={{ padding: mob ? "6px 8px" : "10px 14px", fontWeight: 600, color: C.text3, fontSize: mob ? 10 : 11, borderBottom: `2px solid ${C.border}`, textTransform: "uppercase", letterSpacing: "0.5px", background: C.surfaceHover }}>귀속연도</th>
                  <th style={{ padding: mob ? "6px 8px" : "10px 14px", textAlign: "right", fontWeight: 600, color: C.text3, fontSize: mob ? 10 : 11, borderBottom: `2px solid ${C.border}`, textTransform: "uppercase", letterSpacing: "0.5px", background: C.surfaceHover }}>총액</th>
                  <th style={{ padding: mob ? "6px 8px" : "10px 14px", fontWeight: 600, color: C.text3, fontSize: mob ? 10 : 11, borderBottom: `2px solid ${C.border}`, textTransform: "uppercase", letterSpacing: "0.5px", background: C.surfaceHover }}>발급일</th>
                  <th style={{ padding: mob ? "6px 8px" : "10px 14px", textAlign: "left", fontWeight: 600, color: C.text3, fontSize: mob ? 10 : 11, borderBottom: `2px solid ${C.border}`, textTransform: "uppercase", letterSpacing: "0.5px", background: C.surfaceHover }}>비고</th>
                  <th style={{ padding: mob ? "6px 8px" : "10px 14px", fontWeight: 600, color: C.text3, fontSize: mob ? 10 : 11, borderBottom: `2px solid ${C.border}`, textTransform: "uppercase", letterSpacing: "0.5px", background: C.surfaceHover }}>상태</th>
                  <th style={{ padding: mob ? "6px 8px" : "10px 14px", fontWeight: 600, color: C.text3, fontSize: mob ? 10 : 11, borderBottom: `2px solid ${C.border}`, textTransform: "uppercase", letterSpacing: "0.5px", background: C.surfaceHover }}>액션</th>
                </tr>
              </thead>
              <tbody>
                {receiptHistory.filter(r => !historySearch.trim() || r.member_name.includes(historySearch)).map(r => (
                  <tr key={r.id} style={{ borderBottom: `1px solid ${C.borderLight}` }}>
                    <td style={{ padding: mob ? "6px 8px" : "12px 14px", fontSize: mob ? 11 : 14, color: "var(--color-text-muted)" }}>{r.receipt_number}</td>
                    <td style={{ padding: mob ? "6px 8px" : "12px 14px", fontSize: mob ? 11 : 14, color: "var(--color-text-muted)" }}>{r.member_name}</td>
                    <td style={{ padding: mob ? "6px 8px" : "12px 14px", fontSize: mob ? 10 : 13, color: "var(--color-text-muted)" }}>{r.resident_number_masked ?? "—"}</td>
                    <td style={{ padding: mob ? "6px 8px" : "12px 14px", fontSize: mob ? 11 : 14, color: "var(--color-text-muted)" }}>{r.tax_year}년</td>
                    <td style={{ padding: mob ? "6px 8px" : "12px 14px", textAlign: "right", fontSize: mob ? 11 : 14, fontWeight: 600, color: C.navy }}>₩{r.total_amount.toLocaleString("ko-KR")}</td>
                    <td style={{ padding: mob ? "6px 8px" : "12px 14px", fontSize: mob ? 10 : 13, color: "var(--color-text-faint)" }}>{String(r.issue_date).slice(0, 10)}</td>
                    <td style={{ padding: mob ? "6px 8px" : "12px 14px", fontSize: mob ? 10 : 13, color: "var(--color-text-muted)" }}>{r.memo ?? "—"}</td>
                    <td style={{ padding: mob ? "6px 8px" : "12px 14px" }}><span style={{ padding: mob ? "2px 6px" : "3px 10px", borderRadius: 4, fontSize: mob ? 10 : 12, fontWeight: 600, background: "var(--color-border-soft)", color: "var(--color-text-muted)" }}>{r.status}</span></td>
                    <td style={{ padding: mob ? "6px 8px" : "12px 14px" }}>
                      {r.status === "발급완료" && (
                        <>
                          <button type="button" className="finance-nav-btn" onClick={() => setReprintModal({ receipt: r, ssnFirst: "", ssnLast: "" })} style={{ marginRight: 6, padding: mob ? "2px 8px" : "6px 12px", fontSize: mob ? 10 : 13, borderRadius: mob ? 6 : 8, border: `1px solid ${C.border}`, background: "var(--color-surface)", cursor: "pointer" }}>재출력</button>
                          <button type="button" className="finance-nav-btn" onClick={() => setCancelModal({ receipt: r, reason: "" })} style={{ padding: mob ? "2px 8px" : "6px 12px", fontSize: mob ? 10 : 13, borderRadius: mob ? 6 : 8, border: `1px solid ${C.border}`, color: "var(--color-text-muted)", background: "var(--color-primary-soft)", cursor: "pointer" }}>취소</button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {receiptHistoryFetchError && (
            <p style={{ margin: "12px 0 0", fontSize: mob ? 11 : 14, color: "#c00", lineHeight: mob ? 1.4 : 1.6 }}>
              발급 이력 조회에 실패했습니다. churches 테이블과 donation_receipts 테이블·RLS·컬럼을 확인해 주세요. ({receiptHistoryFetchError})
            </p>
          )}
          {!receiptHistoryFetchError && receiptHistoryEmptyAfterFetch && (
            <p style={{ margin: "12px 0 0", fontSize: mob ? 11 : 14, color: "var(--color-text-faint)", lineHeight: mob ? 1.4 : 1.6 }}>해당 연도에 발급된 영수증이 없습니다.</p>
          )}
          {!receiptHistoryFetchError && !receiptHistoryEmptyAfterFetch && receiptHistory.length === 0 && (
            <p style={{ margin: "12px 0 0", fontSize: mob ? 11 : 14, color: "var(--color-text-faint)", lineHeight: mob ? 1.4 : 1.6 }}>귀속 연도를 선택한 뒤 [조회]를 눌러 발급 이력을 불러오세요.</p>
          )}
          {reprintModal && (
            <PcModalShell
              open
              onClose={() => setReprintModal(null)}
              title="재출력 · 주민등록번호 입력"
              maxWidth={400}
              footer={
                <>
                  <button type="button" className="btn btn-secondary" onClick={() => setReprintModal(null)}>닫기</button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={
                      reprintModal.ssnFirst.length !== 6 ||
                      reprintModal.ssnLast.length !== 7 ||
                      !/^\d+$/.test(reprintModal.ssnFirst) ||
                      !/^\d+$/.test(reprintModal.ssnLast)
                    }
                    onClick={handleReprintPdf}
                  >
                    PDF 다운로드
                  </button>
                </>
              }
            >
              <p style={{ margin: "0 0 12px", fontSize: 13, color: C.textMuted }}>{reprintModal.receipt.member_name} / {reprintModal.receipt.receipt_number}</p>
              <p style={{ margin: "0 0 12px", fontSize: 11, color: "var(--color-text-faint)" }}>주민등록번호는 서버에 저장되지 않으며, PDF 생성 후 즉시 폐기됩니다.</p>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  autoComplete="off"
                  value={reprintModal.ssnFirst}
                  onChange={e => {
                    const val = e.target.value.replace(/\D/g, "").slice(0, 6);
                    setReprintModal(m => (m ? { ...m, ssnFirst: val } : null));
                    if (val.length === 6) queueMicrotask(() => reprintSsnLastInputRef.current?.focus());
                  }}
                  placeholder="앞 6자리"
                  style={{ width: 80, padding: "8px 10px", borderRadius: 8, border: `1px solid ${C.border}` }}
                />
                <span>-</span>
                <input
                  ref={reprintSsnLastInputRef}
                  type="text"
                  inputMode="numeric"
                  maxLength={7}
                  autoComplete="off"
                  value={residentLastPartDisplay(reprintModal.ssnLast)}
                  onChange={e => {
                    const v = e.target.value;
                    setReprintModal(m => (m ? { ...m, ssnLast: applyResidentLastPartInput(m.ssnLast, v) } : null));
                  }}
                  placeholder="뒷 7자리"
                  style={{ width: 90, padding: "8px 10px", borderRadius: 8, border: `1px solid ${C.border}` }}
                />
              </div>
            </PcModalShell>
          )}
          {cancelModal && (
            <PcModalShell
              open
              onClose={() => setCancelModal(null)}
              title="영수증 취소"
              maxWidth={400}
              footer={
                <>
                  <button type="button" className="btn btn-secondary" onClick={() => setCancelModal(null)}>닫기</button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={async () => {
                      if (!cancelModal || !supabase || !churchId) return;
                      await supabase.from("donation_receipts").update({ status: "취소", cancelled_at: new Date().toISOString(), cancel_reason: cancelModal.reason || null }).eq("church_id", churchId).eq("id", cancelModal.receipt.id);
                      setReceiptHistory(prev => prev.map(r => r.id === cancelModal.receipt.id ? { ...r, status: "취소" } : r));
                      setCancelModal(null);
                    }}
                  >
                    취소 처리
                  </button>
                </>
              }
            >
              <p style={{ margin: "0 0 12px", fontSize: 13, color: C.textMuted }}>{cancelModal.receipt.member_name} / {cancelModal.receipt.receipt_number}</p>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: C.textMuted, marginBottom: 6 }}>취소 사유</label>
              <input type="text" value={cancelModal.reason} onChange={e => setCancelModal(m => m ? { ...m, reason: e.target.value } : null)} placeholder="선택 입력" style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: `1px solid ${C.border}`, boxSizing: "border-box" }} />
            </PcModalShell>
          )}
        </Card>
      )}

      <div style={{ marginTop: 8, paddingTop: 16, borderTop: `1px solid ${C.border}` }}>
        <button
          type="button"
          className="finance-nav-btn"
          onClick={() => {
            setReceiptLogYear(year);
            setReceiptLogOpen(true);
          }}
          style={{
            height: mob ? 36 : 40,
            padding: mob ? "0 14px" : "0 18px",
            borderRadius: mob ? 8 : 10,
            border: `1px solid ${C.border}`,
            background: C.bg,
            color: C.navy,
            fontWeight: 600,
            fontSize: mob ? 12 : 14,
            cursor: "pointer",
          }}
        >
          발급 대장 보기
        </button>
      </div>

      {receiptLogOpen && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 1001, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: mob ? 10 : 20 }}
          onClick={() => setReceiptLogOpen(false)}
        >
          <div
            style={{ background: C.card, borderRadius: 16, padding: mob ? 14 : 20, maxWidth: 960, width: "100%", maxHeight: "90vh", overflow: "hidden", display: "flex", flexDirection: "column" }}
            onClick={e => e.stopPropagation()}
          >
            <p style={{ margin: "0 0 12px", fontSize: mob ? 11 : 13, color: "var(--color-text-muted)", lineHeight: 1.5 }}>
              ※ 소득세법 시행규칙에 따라 기부금 영수증 발급 대장은 5년간 보관해야 합니다.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 12 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: C.navy }}>귀속연도</label>
              <select
                value={receiptLogYear}
                onChange={e => setReceiptLogYear(Number(e.target.value))}
                className="finance-nav-btn"
                style={{ height: 36, padding: "0 12px", borderRadius: 8, border: `1px solid ${C.border}`, background: "var(--color-surface)" }}
              >
                {[currentYear, currentYear - 1, currentYear - 2, currentYear - 3, currentYear - 4].map(y => (
                  <option key={y} value={y}>{y}년</option>
                ))}
              </select>
              <button type="button" className="finance-nav-btn" onClick={() => void fetchReceiptLogRows()} style={{ padding: "8px 14px", borderRadius: 8, border: "none", background: C.primary, color: "#fff", fontWeight: 600, cursor: "pointer" }}>조회</button>
              <button type="button" className="finance-nav-btn" onClick={exportReceiptLogXlsx} disabled={receiptLogRows.length === 0} style={{ padding: "8px 14px", borderRadius: 8, border: "none", background: receiptLogRows.length === 0 ? "#ddd" : C.accent, color: receiptLogRows.length === 0 ? "#777" : "#fff", fontWeight: 600, cursor: receiptLogRows.length === 0 ? "not-allowed" : "pointer" }}>엑셀 다운로드</button>
              <button type="button" onClick={() => setReceiptLogOpen(false)} style={{ marginLeft: "auto", padding: "8px 14px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.bg, cursor: "pointer" }}>닫기</button>
            </div>
            <div style={{ overflow: "auto", flex: 1, minHeight: 0, border: `1px solid ${C.borderLight}`, borderRadius: 8 }}>
              {receiptLogLoading ? (
                <p style={{ padding: 16, margin: 0, color: "var(--color-text-faint)" }}>불러오는 중…</p>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: mob ? 11 : 13 }}>
                  <thead>
                    <tr style={{ background: "var(--color-primary-soft)" }}>
                      <th style={{ padding: 8, textAlign: "left", borderBottom: `1px solid ${C.border}` }}>일련번호</th>
                      <th style={{ padding: 8, textAlign: "left", borderBottom: `1px solid ${C.border}` }}>기부자</th>
                      <th style={{ padding: 8, textAlign: "left", borderBottom: `1px solid ${C.border}` }}>주민번호(마스킹)</th>
                      <th style={{ padding: 8, textAlign: "right", borderBottom: `1px solid ${C.border}` }}>금액</th>
                      <th style={{ padding: 8, textAlign: "left", borderBottom: `1px solid ${C.border}` }}>기부일</th>
                      <th style={{ padding: 8, textAlign: "left", borderBottom: `1px solid ${C.border}` }}>발급일</th>
                      <th style={{ padding: 8, textAlign: "left", borderBottom: `1px solid ${C.border}` }}>비고</th>
                    </tr>
                  </thead>
                  <tbody>
                    {receiptLogRows.map(r => (
                      <tr key={r.id} style={{ borderBottom: `1px solid ${C.borderLight}` }}>
                        <td style={{ padding: 8 }}>{r.serial_number}</td>
                        <td style={{ padding: 8 }}>{r.donor_name}</td>
                        <td style={{ padding: 8 }}>{r.resident_number_masked ?? "-"}</td>
                        <td style={{ padding: 8, textAlign: "right" }}>₩{r.donation_amount.toLocaleString("ko-KR")}</td>
                        <td style={{ padding: 8 }}>{r.donation_date}</td>
                        <td style={{ padding: 8 }}>{r.issued_date}</td>
                        <td style={{ padding: 8 }}>{r.note ?? "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {!receiptLogLoading && receiptLogRows.length === 0 && (
                <p style={{ padding: 16, margin: 0, color: "var(--color-text-faint)" }}>해당 연도 기록이 없거나 donation_receipt_log 테이블이 아직 생성되지 않았습니다.</p>
              )}
            </div>
          </div>
        </div>
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
  const { refreshIncome, refreshExpense } = useAppData();
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
    const churchId = getChurchId();
    const incomePayload = { date: o.date, type: o.categoryId, amount: o.amount, donor: o.donorName || null, method: o.method || null, memo: o.note || null, church_id: churchId };
    console.log("=== [FinancePage] INCOME INSERT 시도 ===", "church_id:", churchId);
    const { data, error } = await supabase.from("income").insert(incomePayload).select("id").single();
    console.log("=== [FinancePage] INCOME INSERT 결과 ===", { data, error });
    if (error) {
      console.error("=== INCOME DB ERROR ===", error.message, error.details, error.hint);
      alert("저장 실패: " + error.message);
      return null;
    }
    const id = (data as { id: string }).id;
    setOfferings(prev => [...prev, { ...o, id }]);
    refreshIncome();
    return id;
  }, [setOfferings, refreshIncome]);
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
    refreshIncome();
  }, [setOfferings, refreshIncome]);
  const onAddExpense = useCallback(async (e: Omit<Expense, "id">) => {
    if (!supabase || !setDb || !db) return null;
    const churchId = getChurchId();
    const expensePayload = { date: e.date, category: e.categoryId, item: e.description || null, amount: e.amount, resolution: e.departmentId || null, memo: e.note || null, church_id: churchId };
    console.log("=== [FinancePage] EXPENSE INSERT 시도 ===", "church_id:", churchId);
    const { data, error } = await supabase.from("expense").insert(expensePayload).select("id").single();
    console.log("=== [FinancePage] EXPENSE INSERT 결과 ===", { data, error });
    if (error) {
      console.error("=== EXPENSE DB ERROR ===", error.message, error.details, error.hint);
      alert("저장 실패: " + error.message);
      return null;
    }
    const id = (data as { id: string }).id;
    setExpenses(prev => [...prev, { ...e, id }]);
    refreshExpense();
    return id;
  }, [setExpenses, refreshExpense]);
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
    refreshExpense();
  }, [setExpenses, refreshExpense]);

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
    { id: "export", label: "엑셀보내기", Icon: Download },
    { id: "receipt", label: "기부금 영수증", Icon: FileSignature },
  ];

  const handleNav = (id: string) => {
    if (id in FINANCE_CATEGORY_FIRST_TAB) {
      setActiveTab(FINANCE_CATEGORY_FIRST_TAB[id as FinanceCategoryId]);
      return;
    }
    setActiveTab(id);
  };

  useEffect(() => {
    if (typeof window !== "undefined" && VALID_FINANCE_TABS.has(activeTab)) {
      window.sessionStorage.setItem(FINANCE_ACTIVE_TAB_KEY, activeTab);
    }
  }, [activeTab]);

  const financeSidebarItems = [
    { id: "fin_income" as const, label: "수입/지출", Icon: Wallet },
    { id: "fin_budget" as const, label: "예산", Icon: PieChart },
    { id: "fin_giving" as const, label: "헌금", Icon: Users },
    { id: "fin_reports" as const, label: "보고/설정", Icon: Settings },
  ];
  const navSections = [{ sectionLabel: "재정", items: financeSidebarItems.map((t) => ({ id: t.id, label: t.label, Icon: t.Icon })) }];
  const activeCategoryId = LEAF_TO_FINANCE_CATEGORY[activeTab] ?? "fin_income";
  const activeLabel = tabs.find(t => t.id === activeTab)?.label ?? "대시보드";
  const financeHeaderTitle = activeTab === "dashboard" ? "재정 대시보드" : activeLabel;
  const financeChurchName =
    ((settings?.churchName ?? db?.settings?.churchName ?? "") as string).trim() || "교회 이름";

  return (
    <UnifiedPageLayout
      pageTitle="재정"
      churchName={financeChurchName}
      navSections={navSections}
      activeId={activeCategoryId}
      onNav={handleNav}
      versionText="재정 v1.0"
      headerTitle={financeHeaderTitle}
      headerDesc="교회 재정 관리 시스템"
      headerActions={!mob ? <Badge color={C.navy} bg="#f0f2f5">정상 운영중</Badge> : undefined}
      SidebarIcon={Church}
      accentColor={C.primary}
      hideMobileSubTabs
    >
          {activeTab === "budgetManagement" ? (
            <BudgetManagement
              fiscalYear={String(new Date().getFullYear())}
              toast={toast ?? (() => {})}
              stickyNavBand={(toolbar) => (
                <div style={financeStickyNavShell(mob)}>
                  <FinanceCategoryNav activeTab={activeTab} onLeafChange={setActiveTab} />
                  {toolbar}
                </div>
              )}
            />
          ) : (
            <div style={financeStickyNavShell(mob)}>
              <FinanceCategoryNav activeTab={activeTab} onLeafChange={setActiveTab} />
            </div>
          )}
          {activeTab === "dashboard" && (
            <DashboardTab
              offerings={offerings}
              expenses={expenses}
              categories={DEFAULT_CATEGORIES}
              departments={DEFAULT_DEPARTMENTS}
            />
          )}
          {activeTab === "offering" && <OfferingTab offerings={offerings} setOfferings={setOfferings} donors={donors} categories={DEFAULT_CATEGORIES} onAddIncome={onAddIncome} onDeleteIncome={onDeleteIncome} />}
          {activeTab === "givingStatus" && <GivingStatusTab donors={donors} offerings={offerings} categories={DEFAULT_CATEGORIES} />}
          {activeTab === "donor" && <DonorTab donors={donors} setDonors={setDonors} offerings={offerings} />}
          {activeTab === "expense" && <ExpenseTab expenses={expenses} setExpenses={setExpenses} departments={DEFAULT_DEPARTMENTS} expenseCategories={EXPENSE_CATEGORIES} onAddExpense={onAddExpense} />}
          {activeTab === "cashJournal" && <CashJournal toast={toast ?? (() => {})} />}
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
