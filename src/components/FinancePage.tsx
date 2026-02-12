"use client";

import { useState, useMemo, useCallback, useEffect, type CSSProperties, type ReactNode } from "react";
import * as XLSX from "xlsx";

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

/* ---------- 기본 헌금 카테고리 ---------- */
interface Category { id: string; name: string; color: string; icon: string; }
const DEFAULT_CATEGORIES: Category[] = [
  { id: "tithe", name: "십일조", color: "#4361ee", icon: "📘" },
  { id: "thanks", name: "감사헌금", color: "#f72585", icon: "🙏" },
  { id: "mission", name: "선교헌금", color: "#7209b7", icon: "🌍" },
  { id: "building", name: "건축헌금", color: "#3a0ca3", icon: "🏗️" },
  { id: "special", name: "특별헌금", color: "#4cc9f0", icon: "⭐" },
  { id: "firstfruit", name: "첫열매헌금", color: "#06d6a0", icon: "🌾" },
  { id: "sunday", name: "주일헌금", color: "#ffd166", icon: "⛪" },
  { id: "youth", name: "청년부헌금", color: "#ef476f", icon: "👥" },
  { id: "children", name: "주일학교헌금", color: "#118ab2", icon: "👶" },
  { id: "other", name: "기타헌금", color: "#8d99ae", icon: "📋" },
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
interface Donor { id: string; name: string; phone: string; group: string; joinDate: string; note: string; }
interface Offering { id: string; donorId: string; donorName: string; categoryId: string; amount: number; date: string; method: string; note: string; }
interface Expense { id: string; categoryId: string; departmentId: string; amount: number; date: string; description: string; receipt: boolean; note: string; }

/* ---------- 샘플 데이터 생성 ---------- */
function generateSampleData() {
  const donors: Donor[] = [
    { id: uid(), name: "김성민", phone: "010-1234-5678", group: "장년부", joinDate: "2020-03-15", note: "" },
    { id: uid(), name: "이은혜", phone: "010-2345-6789", group: "청년부", joinDate: "2021-06-01", note: "새가족" },
    { id: uid(), name: "박준호", phone: "010-3456-7890", group: "장년부", joinDate: "2019-01-10", note: "집사" },
    { id: uid(), name: "최미영", phone: "010-4567-8901", group: "여전도회", joinDate: "2018-05-20", note: "권사" },
    { id: uid(), name: "정하늘", phone: "010-5678-9012", group: "청년부", joinDate: "2022-09-01", note: "" },
    { id: uid(), name: "한지수", phone: "010-6789-0123", group: "장년부", joinDate: "2017-02-14", note: "안수집사" },
    { id: uid(), name: "윤서연", phone: "010-7890-1234", group: "주일학교", joinDate: "2023-03-01", note: "교사" },
    { id: uid(), name: "익명", phone: "", group: "", joinDate: "", note: "익명 헌금자" },
  ];

  const offerings: Offering[] = [];
  const catIds = DEFAULT_CATEGORIES.map(c => c.id);
  for (let m = 0; m < 12; m++) {
    const numEntries = 15 + Math.floor(Math.random() * 20);
    for (let i = 0; i < numEntries; i++) {
      const donor = donors[Math.floor(Math.random() * donors.length)];
      const cat = catIds[Math.floor(Math.random() * catIds.length)];
      const day = 1 + Math.floor(Math.random() * 28);
      const amounts = [10000, 20000, 30000, 50000, 100000, 150000, 200000, 300000, 500000, 1000000];
      offerings.push({
        id: uid(), donorId: donor.id, donorName: donor.name, categoryId: cat,
        amount: amounts[Math.floor(Math.random() * amounts.length)],
        date: `2025-${String(m+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`,
        method: ["현금","계좌이체","온라인"][Math.floor(Math.random()*3)],
        note: "",
      });
    }
  }

  const expenses: Expense[] = [];
  const expCatIds = EXPENSE_CATEGORIES.map(c => c.id);
  const deptIds = DEFAULT_DEPARTMENTS.map(d => d.id);
  for (let m = 0; m < 12; m++) {
    const numExp = 8 + Math.floor(Math.random() * 10);
    for (let i = 0; i < numExp; i++) {
      const cat = expCatIds[Math.floor(Math.random() * expCatIds.length)];
      const dept = deptIds[Math.floor(Math.random() * deptIds.length)];
      const day = 1 + Math.floor(Math.random() * 28);
      const amounts = [30000, 50000, 100000, 150000, 200000, 300000, 500000, 800000, 1000000, 2000000];
      expenses.push({
        id: uid(), categoryId: cat, departmentId: dept,
        amount: amounts[Math.floor(Math.random() * amounts.length)],
        date: `2025-${String(m+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`,
        description: `${EXPENSE_CATEGORIES.find(c=>c.id===cat)?.name || ""} 지출`,
        receipt: Math.random() > 0.3, note: "",
      });
    }
  }
  return { donors, offerings, expenses };
}

/* ---------- 아이콘 ---------- */
const Icons = {
  Dashboard: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>,
  Offering: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>,
  Donor: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>,
  Expense: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 4H3v16h18V4zM1 10h22"/><path d="M6 16h4M14 16h4"/></svg>,
  Report: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/></svg>,
  Budget: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20V10M18 20V4M6 20v-4"/></svg>,
  Export: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>,
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
  accent: "#4361ee", accentLight: "#eef0ff", success: "#06d6a0", successLight: "#e6faf3",
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

function Button({ children, onClick, variant = "primary", size = "md", icon, style: extraStyle }: {
  children: ReactNode; onClick?: () => void; variant?: string; size?: string;
  icon?: ReactNode; style?: CSSProperties;
}) {
  const base: CSSProperties = {
    display: "inline-flex", alignItems: "center", gap: 6,
    border: "none", borderRadius: 10, cursor: "pointer",
    fontWeight: 600, fontFamily: "inherit", transition: "all 0.15s ease",
    fontSize: size === "sm" ? 13 : 14,
    padding: size === "sm" ? "6px 14px" : "10px 20px",
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
    <button onClick={onClick} style={{ ...base, ...(variants[variant] || variants.primary), ...extraStyle }}>
      {icon}{children}
    </button>
  );
}

function Input({ label, ...props }: { label?: string; [key: string]: unknown }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {label && <label style={{ fontSize: 13, fontWeight: 600, color: C.navy }}>{label}</label>}
      <input {...(props as React.InputHTMLAttributes<HTMLInputElement>)} style={{
        padding: "10px 14px", borderRadius: 10, border: `1px solid ${C.border}`,
        fontSize: 14, fontFamily: "inherit", color: C.navy, background: "#fff",
        outline: "none", transition: "border 0.15s", ...(props.style as CSSProperties || {}),
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
  if (!open) return null;
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1000,
      display: "flex", alignItems: mob ? "flex-end" : "center", justifyContent: "center",
      background: "rgba(27,42,74,0.4)", backdropFilter: "blur(4px)", padding: mob ? 0 : 20,
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "#fff", borderRadius: mob ? "20px 20px 0 0" : 20, padding: mob ? 20 : 32,
        width: mob ? "100%" : "90%", maxWidth: mob ? "100%" : width, maxHeight: mob ? "92vh" : "85vh",
        overflowY: "auto", boxShadow: "0 20px 60px rgba(27,42,74,0.15)",
      }}>
        {mob && <div style={{ width: 36, height: 4, background: C.border, borderRadius: 4, margin: "0 auto 12px" }} />}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: mob ? 17 : 20, color: C.navy }}>{title}</h3>
          <button onClick={onClose} style={{
            background: "none", border: "none", cursor: "pointer", padding: 4, borderRadius: 8, display: "flex",
          }}><Icons.X /></button>
        </div>
        {children}
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
        />
      </Card>
    </div>
  );
}

/* ====== 헌금 관리 ====== */
function OfferingTab({ offerings, setOfferings, donors, categories }: {
  offerings: Offering[]; setOfferings: React.Dispatch<React.SetStateAction<Offering[]>>;
  donors: Donor[]; categories: Category[];
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("all");
  const [filterMonth, setFilterMonth] = useState("all");
  const [form, setForm] = useState({ donorId: "", categoryId: "tithe", amount: "", date: todayStr(), method: "현금", note: "" });

  const filtered = useMemo(() => {
    let result = [...offerings];
    if (search) { const q = search.toLowerCase(); result = result.filter(o => o.donorName.toLowerCase().includes(q)); }
    if (filterCat !== "all") result = result.filter(o => o.categoryId === filterCat);
    if (filterMonth !== "all") result = result.filter(o => o.date.split("-")[1] === filterMonth);
    return result.sort((a, b) => b.date.localeCompare(a.date));
  }, [offerings, search, filterCat, filterMonth]);

  const handleAdd = () => {
    if (!form.donorId || !form.amount) return;
    const donor = donors.find(d => d.id === form.donorId);
    setOfferings(prev => [...prev, { id: uid(), ...form, amount: parseInt(form.amount), donorName: donor?.name || "익명" }]);
    setForm({ donorId: "", categoryId: "tithe", amount: "", date: todayStr(), method: "현금", note: "" });
    setShowAdd(false);
  };

  const handleDelete = (id: string) => setOfferings(prev => prev.filter(o => o.id !== id));
  const filteredTotal = filtered.reduce((s, o) => s + o.amount, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ position: "relative" }}>
            <div style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }}><Icons.Search /></div>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="헌금자 검색..."
              style={{ padding: "10px 14px 10px 36px", borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 14, fontFamily: "inherit", outline: "none", width: 200 }} />
          </div>
          <Select options={[{ value: "all", label: "전체 항목" }, ...categories.map(c => ({ value: c.id, label: c.name }))]}
            value={filterCat} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFilterCat(e.target.value)} />
          <Select options={[{ value: "all", label: "전체 월" }, ...MONTHS.map((m, i) => ({ value: String(i+1).padStart(2,"0"), label: m }))]}
            value={filterMonth} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFilterMonth(e.target.value)} />
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <Badge color={C.accent}>합계: ₩{fmt(filteredTotal)}</Badge>
          <Button onClick={() => setShowAdd(true)} icon={<Icons.Plus />}>헌금 등록</Button>
        </div>
      </div>
      <Table
        columns={[
          { label: "날짜", key: "date" },
          { label: "헌금자", render: (r) => <span style={{ fontWeight: 600 }}>{r.donorName as string}</span> },
          { label: "항목", render: (r) => { const cat = categories.find(c => c.id === r.categoryId); return cat ? <Badge color={cat.color}>{cat.icon} {cat.name}</Badge> : (r.categoryId as string); }},
          { label: "방법", render: (r) => <Badge color={C.textMuted}>{r.method as string}</Badge> },
          { label: "금액", align: "right", render: (r) => <span style={{ fontWeight: 700, color: C.accent }}>₩{fmt(r.amount as number)}</span> },
          { label: "", align: "center", render: (r) => <button onClick={() => handleDelete(r.id as string)} style={{ background: "none", border: "none", cursor: "pointer", color: C.textMuted, fontSize: 12, padding: 4 }}>삭제</button> },
        ]}
        data={filtered.slice(0, 50) as unknown as Record<string, unknown>[]}
        emptyMsg="헌금 내역이 없습니다"
      />
      {filtered.length > 50 && <div style={{ textAlign: "center", color: C.textMuted, fontSize: 13 }}>{filtered.length}건 중 50건 표시</div>}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="헌금 등록">
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Select label="헌금자" value={form.donorId} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setForm(f => ({ ...f, donorId: e.target.value }))}
            options={[{ value: "", label: "선택하세요" }, ...donors.map(d => ({ value: d.id, label: d.name }))]} />
          <Select label="헌금 항목" value={form.categoryId} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setForm(f => ({ ...f, categoryId: e.target.value }))}
            options={categories.map(c => ({ value: c.id, label: `${c.icon} ${c.name}` }))} />
          <Input label="금액 (원)" type="number" value={form.amount} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="100000" />
          <Input label="날짜" type="date" value={form.date} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, date: e.target.value }))} />
          <Select label="헌금 방법" value={form.method} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setForm(f => ({ ...f, method: e.target.value }))}
            options={[{ value: "현금", label: "현금" }, { value: "계좌이체", label: "계좌이체" }, { value: "온라인", label: "온라인" }]} />
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
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="이름 또는 연락처 검색..."
            style={{ padding: "10px 14px 10px 36px", borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 14, fontFamily: "inherit", outline: "none", width: 260 }} />
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <Badge color={C.purple}>총 {donors.length}명</Badge>
          <Button onClick={() => setShowAdd(true)} icon={<Icons.Plus />}>헌금자 등록</Button>
        </div>
      </div>
      <Table
        columns={[
          { label: "이름", render: (r) => <span style={{ fontWeight: 600 }}>{r.name as string}</span> },
          { label: "연락처", key: "phone" },
          { label: "소속", render: (r) => (r.group as string) ? <Badge color={C.textMuted}>{r.group as string}</Badge> : <span>-</span> },
          { label: "등록일", key: "joinDate" },
          { label: "헌금 횟수", align: "center", render: (r) => <span>{donorStats[r.id as string]?.count || 0}회</span> },
          { label: "헌금 합계", align: "right", render: (r) => <span style={{ fontWeight: 700, color: C.accent }}>₩{fmt(donorStats[r.id as string]?.total || 0)}</span> },
          { label: "최근 헌금일", render: (r) => <span>{donorStats[r.id as string]?.lastDate || "-"}</span> },
          { label: "메모", render: (r) => (r.note as string) ? <span style={{ color: C.textMuted, fontSize: 12 }}>{r.note as string}</span> : <span>-</span> },
        ]}
        data={filtered as unknown as Record<string, unknown>[]}
        emptyMsg="등록된 헌금자가 없습니다"
      />
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="헌금자 등록">
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Input label="이름" value={form.name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, name: e.target.value }))} placeholder="홍길동" />
          <Input label="연락처" value={form.phone} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="010-0000-0000" />
          <Input label="소속 (부서/구역)" value={form.group} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, group: e.target.value }))} placeholder="장년부" />
          <Input label="등록일" type="date" value={form.joinDate} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, joinDate: e.target.value }))} />
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

/* ====== 지출 관리 ====== */
function ExpenseTab({ expenses, setExpenses, departments, expenseCategories }: {
  expenses: Expense[]; setExpenses: React.Dispatch<React.SetStateAction<Expense[]>>;
  departments: Department[]; expenseCategories: ExpCategory[];
}) {
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

  const handleAdd = () => {
    if (!form.amount) return;
    setExpenses(prev => [...prev, { id: uid(), ...form, amount: parseInt(form.amount) }]);
    setForm({ categoryId: "salary", departmentId: "admin", amount: "", date: todayStr(), description: "", receipt: true, note: "" });
    setShowAdd(false);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Select options={[{ value: "all", label: "전체 부서" }, ...departments.map(d => ({ value: d.id, label: d.name }))]}
            value={filterDept} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFilterDept(e.target.value)} />
          <Select options={[{ value: "all", label: "전체 월" }, ...MONTHS.map((m, i) => ({ value: String(i+1).padStart(2,"0"), label: m }))]}
            value={filterMonth} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFilterMonth(e.target.value)} />
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <Badge color={C.danger}>합계: ₩{fmt(filteredTotal)}</Badge>
          <Button onClick={() => setShowAdd(true)} variant="accent" icon={<Icons.Plus />}>지출 등록</Button>
        </div>
      </div>
      <Table
        columns={[
          { label: "날짜", key: "date" },
          { label: "부서", render: (r) => { const d = departments.find(x => x.id === r.departmentId); return d ? <Badge color={d.color}>{d.name}</Badge> : <span>{r.departmentId as string}</span>; }},
          { label: "항목", render: (r) => { const c = expenseCategories.find(x => x.id === r.categoryId); return c ? <span>{c.icon} {c.name}</span> : <span>{r.categoryId as string}</span>; }},
          { label: "내용", key: "description" },
          { label: "영수증", align: "center", render: (r) => <span>{r.receipt ? "✅" : "❌"}</span> },
          { label: "금액", align: "right", render: (r) => <span style={{ fontWeight: 700, color: C.danger }}>₩{fmt(r.amount as number)}</span> },
        ]}
        data={filtered.slice(0, 50) as unknown as Record<string, unknown>[]}
      />
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="지출 등록">
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Select label="부서" value={form.departmentId} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setForm(f => ({ ...f, departmentId: e.target.value }))}
            options={departments.map(d => ({ value: d.id, label: d.name }))} />
          <Select label="지출 항목" value={form.categoryId} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setForm(f => ({ ...f, categoryId: e.target.value }))}
            options={expenseCategories.map(c => ({ value: c.id, label: `${c.icon} ${c.name}` }))} />
          <Input label="금액 (원)" type="number" value={form.amount} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="500000" />
          <Input label="날짜" type="date" value={form.date} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, date: e.target.value }))} />
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

/* ====== 보고서 ====== */
function ReportTab({ offerings, expenses, categories, departments, expenseCategories }: {
  offerings: Offering[]; expenses: Expense[]; categories: Category[];
  departments: Department[]; expenseCategories: ExpCategory[];
}) {
  const [reportType, setReportType] = useState("monthly");
  const [selectedPeriod, setSelectedPeriod] = useState("01");

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
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 8, height: 8, borderRadius: 4, background: d.color }} />
                        <span style={{ fontWeight: 600, color: C.navy }}>{d.name}</span>
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

/* ============================================================ */
/* 메인 재정관리 컴포넌트                                         */
/* ============================================================ */
export function FinancePage() {
  const mob = useIsMobile();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [sampleData] = useState(() => generateSampleData());
  const [donors, setDonors] = useState(sampleData.donors);
  const [offerings, setOfferings] = useState(sampleData.offerings);
  const [expenses, setExpenses] = useState(sampleData.expenses);
  const [sideOpen, setSideOpen] = useState(false);

  useEffect(() => { if (!mob) setSideOpen(true); else setSideOpen(false); }, [mob]);

  const tabs = [
    { id: "dashboard", label: "대시보드", icon: <Icons.Dashboard /> },
    { id: "offering", label: "헌금 관리", icon: <Icons.Offering /> },
    { id: "donor", label: "헌금자 관리", icon: <Icons.Donor /> },
    { id: "expense", label: "지출 관리", icon: <Icons.Expense /> },
    { id: "report", label: "보고서", icon: <Icons.Report /> },
    { id: "budget", label: "예산 계획", icon: <Icons.Budget /> },
    { id: "export", label: "엑셀 내보내기", icon: <Icons.Export /> },
  ];

  const handleNav = (id: string) => { setActiveTab(id); if (mob) setSideOpen(false); };

  return (
    <div style={{
      fontFamily: "'Pretendard', 'Noto Sans KR', -apple-system, sans-serif",
      background: C.bg, display: "flex", color: C.text,
      minHeight: "calc(100vh - 56px)", overflow: "hidden", position: "relative",
    }}>
      {/* Mobile overlay */}
      {mob && sideOpen && <div onClick={() => setSideOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 99 }} />}

      {/* 사이드바 */}
      <aside style={{
        width: mob ? 240 : (sideOpen ? 240 : 64), background: C.navy, color: "#fff",
        display: "flex", flexDirection: "column",
        transition: mob ? "transform 0.3s ease" : "width 0.25s ease",
        overflow: "hidden", flexShrink: 0, zIndex: 100,
        ...(mob ? { position: "fixed", top: 0, left: 0, bottom: 0, transform: sideOpen ? "translateX(0)" : "translateX(-100%)" } : {}),
      }}>
        <div style={{
          padding: "20px 16px",
          display: "flex", alignItems: "center", gap: 12,
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          cursor: mob ? "default" : "pointer",
        }} onClick={() => !mob && setSideOpen(!sideOpen)}>
          <div style={{
            width: 36, height: 36, borderRadius: 10, background: "rgba(255,255,255,0.1)",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}><Icons.Church /></div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, whiteSpace: "nowrap" }}>교회 재정관리</div>
            <div style={{ fontSize: 11, opacity: 0.6, whiteSpace: "nowrap" }}>Church Finance</div>
          </div>
        </div>
        <nav style={{ flex: 1, padding: "12px 8px", display: "flex", flexDirection: "column", gap: 2 }}>
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => handleNav(tab.id)}
              style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "10px 14px",
                borderRadius: 10, border: "none",
                background: activeTab === tab.id ? "rgba(255,255,255,0.12)" : "transparent",
                color: activeTab === tab.id ? "#fff" : "rgba(255,255,255,0.6)",
                fontWeight: activeTab === tab.id ? 600 : 400,
                fontSize: 13, cursor: "pointer", fontFamily: "inherit",
                transition: "all 0.15s", textAlign: "left",
                whiteSpace: "nowrap",
              }}>{tab.icon}<span>{tab.label}</span></button>
          ))}
        </nav>
        <div style={{ padding: "12px 16px", borderTop: "1px solid rgba(255,255,255,0.08)", fontSize: 11, opacity: 0.4 }}>
          v1.0 MVP · 2025
        </div>
      </aside>

      {/* 메인 콘텐츠 */}
      <main style={{ flex: 1, overflow: "auto", minWidth: 0 }}>
        <header style={{
          padding: mob ? "10px 12px" : "16px 24px", background: C.card,
          borderBottom: `1px solid ${C.border}`,
          display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            {mob && <button onClick={() => setSideOpen(true)} style={{ width: 36, height: 36, border: "none", background: C.bg, borderRadius: 8, fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>☰</button>}
            <div style={{ minWidth: 0 }}>
              <h2 style={{ margin: 0, fontSize: mob ? 16 : 20, fontWeight: 700, color: C.navy, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {tabs.find(t => t.id === activeTab)?.label}
              </h2>
              {!mob && <p style={{ margin: "2px 0 0", fontSize: 12, color: C.textMuted }}>2025년 교회 재정 관리 시스템</p>}
            </div>
          </div>
          {!mob && <Badge color={C.success} bg={C.successLight}>● 정상 운영중</Badge>}
        </header>
        <div style={{ padding: mob ? 12 : 24 }}>
          {activeTab === "dashboard" && <DashboardTab offerings={offerings} expenses={expenses} categories={DEFAULT_CATEGORIES} departments={DEFAULT_DEPARTMENTS} />}
          {activeTab === "offering" && <OfferingTab offerings={offerings} setOfferings={setOfferings} donors={donors} categories={DEFAULT_CATEGORIES} />}
          {activeTab === "donor" && <DonorTab donors={donors} setDonors={setDonors} offerings={offerings} />}
          {activeTab === "expense" && <ExpenseTab expenses={expenses} setExpenses={setExpenses} departments={DEFAULT_DEPARTMENTS} expenseCategories={EXPENSE_CATEGORIES} />}
          {activeTab === "report" && <ReportTab offerings={offerings} expenses={expenses} categories={DEFAULT_CATEGORIES} departments={DEFAULT_DEPARTMENTS} expenseCategories={EXPENSE_CATEGORIES} />}
          {activeTab === "budget" && <BudgetTab departments={DEFAULT_DEPARTMENTS} expenses={expenses} />}
          {activeTab === "export" && <ExportTab offerings={offerings} expenses={expenses} categories={DEFAULT_CATEGORIES} departments={DEFAULT_DEPARTMENTS} expenseCategories={EXPENSE_CATEGORIES} donors={donors} />}
        </div>
      </main>
    </div>
  );
}
