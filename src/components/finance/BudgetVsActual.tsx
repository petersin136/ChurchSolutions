"use client";

import { useMemo, useState, useEffect, useCallback, type CSSProperties } from "react";
import { supabase } from "@/lib/supabase";
import { filterByChurch } from "@/lib/tenant";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import type { Budget } from "@/types/db";
import { useAppData } from "@/contexts/AppDataContext";
import LazyChart from "../common/LazyChart";
import {
  budgetYearToolbarRowStyle,
  budgetYearLabelStyle,
  budgetYearReadonlyStyle,
  budgetMonthSelectStyle,
} from "@/components/finance/budgetYearToolbarStyles";

const fmt = (n: number) => new Intl.NumberFormat("ko-KR").format(n);
const NAVY = "var(--color-primary)";
const BORDER = "#e2e5ef";
const ROW_LINE = "#f0f2f5";

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

const bvaTh = (align: "left" | "right" | "center", mob = true): CSSProperties => ({
  fontSize: mob ? 10 : 13,
  fontWeight: 700,
  color: NAVY,
  padding: mob ? "6px 8px" : "10px 14px",
  borderBottom: `2px solid ${NAVY}`,
  background: "var(--color-surface)",
  textAlign: align,
});

const bvaTd = (isEven: boolean, align: "left" | "right" | "center", mob = true): CSSProperties => ({
  fontSize: mob ? 11 : 14,
  color: "var(--color-text-muted)",
  padding: mob ? "8px" : "12px 14px",
  borderBottom: `1px solid ${ROW_LINE}`,
  background: isEven ? "#fafbfc" : "#fff",
  textAlign: align,
});

function togglePill(selected: boolean, mob = true): CSSProperties {
  const h = mob ? 28 : 36;
  return {
    flex: 1,
    minWidth: 0,
    height: h,
    minHeight: h,
    maxHeight: h,
    lineHeight: `${h}px`,
    padding: mob ? "0 4px" : "0 8px",
    fontSize: mob ? 10 : 13,
    fontWeight: 600,
    borderRadius: mob ? 6 : 8,
    border: selected ? "none" : `1px solid ${BORDER}`,
    background: selected ? NAVY : "#f5f8ff",
    color: selected ? "#fff" : "#555",
    cursor: "pointer",
    outline: "none",
    boxShadow: "none",
    fontFamily: "inherit",
    textAlign: "center",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  };
}

export interface BudgetVsActualProps {
  year: string;
  month?: number | null;
  toast: (msg: string, type?: "ok" | "err" | "warn") => void;
  viewMode?: "monthly" | "annual";
}

export function BudgetVsActual({
  year,
  month,
  toast,
  viewMode: viewModeProp = "monthly",
}: BudgetVsActualProps) {
  const mob = useIsMobile();
  const { db } = useAppData();
  const [viewMode, setViewMode] = useState<"monthly" | "annual">(viewModeProp);
  const [selectedMonth, setSelectedMonth] = useState(month ?? new Date().getMonth() + 1);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);

  const incomes = useMemo(() => {
    const yearStart = `${year}-01-01`;
    const yearEnd = `${year}-12-31`;
    return db.income.filter((i) => i.date >= yearStart && i.date <= yearEnd);
  }, [db.income, year]);

  const expenses = useMemo(() => {
    const yearStart = `${year}-01-01`;
    const yearEnd = `${year}-12-31`;
    return db.expense.filter((e) => e.date >= yearStart && e.date <= yearEnd);
  }, [db.expense, year]);

  const loadBudget = useCallback(async () => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await filterByChurch(supabase.from("budget").select("*")).eq("fiscal_year", year);
    if (error) {
      console.error(error);
      toast("예산 로드 실패: " + error.message, "err");
    } else {
      setBudgets((data ?? []) as Budget[]);
    }
    setLoading(false);
  }, [year, toast]);

  useEffect(() => {
    loadBudget();
  }, [loadBudget]);

  const mStr = String(selectedMonth).padStart(2, "0");
  const incomeActual = useMemo(() => {
    const map: Record<string, number> = {};
    incomes
      .filter((o) => o.date?.startsWith(`${year}-${mStr}`) || o.month === selectedMonth)
      .forEach((o) => {
        const cat = o.type || "기타수입";
        map[cat] = (map[cat] || 0) + (o.amount ?? 0);
      });
    return map;
  }, [incomes, year, mStr, selectedMonth]);
  const expenseActual = useMemo(() => {
    const map: Record<string, number> = {};
    expenses
      .filter((e) => e.date?.startsWith(`${year}-${mStr}`) || e.month === selectedMonth)
      .forEach((e) => {
        const cat = e.category || "기타지출";
        map[cat] = (map[cat] || 0) + (e.amount ?? 0);
      });
    return map;
  }, [expenses, year, mStr, selectedMonth]);

  const incomeBudget = useMemo(() => {
    const map: Record<string, number> = {};
    budgets.filter((b) => b.category_type === "수입").forEach((b) => {
      map[b.category] = Number(b.monthly_amounts?.[String(selectedMonth)]) || 0;
    });
    return map;
  }, [budgets, selectedMonth]);
  const expenseBudget = useMemo(() => {
    const map: Record<string, number> = {};
    budgets.filter((b) => b.category_type === "지출").forEach((b) => {
      map[b.category] = Number(b.monthly_amounts?.[String(selectedMonth)]) || 0;
    });
    return map;
  }, [budgets, selectedMonth]);

  const incomeCats = useMemo(
    () => Array.from(new Set([...Object.keys(incomeBudget), ...Object.keys(incomeActual)])).filter(Boolean),
    [incomeBudget, incomeActual]
  );
  const expenseCats = useMemo(
    () => Array.from(new Set([...Object.keys(expenseBudget), ...Object.keys(expenseActual)])).filter(Boolean),
    [expenseBudget, expenseActual]
  );

  const incomeRows = useMemo(() => {
    return incomeCats
      .map((name) => {
        const bud = incomeBudget[name] ?? 0;
        const act = incomeActual[name] ?? 0;
        const diff = act - bud;
        const pct = bud > 0 ? Math.round((act / bud) * 100) : 0;
        return { name, 예산: bud, 실적: act, 차이: diff, 달성률: pct };
      })
      .filter((r) => r.예산 > 0 || r.실적 > 0);
  }, [incomeCats, incomeBudget, incomeActual]);

  const expenseRows = useMemo(() => {
    return expenseCats
      .map((name) => {
        const bud = expenseBudget[name] ?? 0;
        const act = expenseActual[name] ?? 0;
        const diff = bud - act;
        const pct = bud > 0 ? Math.round((act / bud) * 100) : 0;
        return { name, 예산: bud, 실적: act, 차이: diff, 달성률: pct };
      })
      .filter((r) => r.예산 > 0 || r.실적 > 0);
  }, [expenseCats, expenseBudget, expenseActual]);

  const chartData = useMemo(
    () => [
      ...incomeRows.map((r) => ({ name: r.name, 예산: r.예산, 실적: r.실적, type: "수입" })),
      ...expenseRows.map((r) => ({ name: r.name, 예산: r.예산, 실적: r.실적, type: "지출" })),
    ],
    [incomeRows, expenseRows]
  );

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "48px 16px", color: "var(--color-text-muted)" }}>
        <span
          style={{
            display: "inline-block",
            width: 28,
            height: 28,
            borderRadius: "50%",
            border: `2px solid ${NAVY}`,
            borderTopColor: "transparent",
            animation: "bva-spin 0.8s linear infinite",
          }}
        />
        <span style={{ marginLeft: 12, fontSize: 13 }}>예산/실적 로딩 중...</span>
        <style>{`@keyframes bva-spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%" }}>
        <div style={budgetYearToolbarRowStyle()}>
          <span style={budgetYearLabelStyle(mob)}>연도</span>
          <input type="text" value={`${year}년`} readOnly tabIndex={-1} style={budgetYearReadonlyStyle(mob)} />
          <span style={budgetYearLabelStyle(mob)}>월</span>
          <select value={selectedMonth} onChange={(e) => setSelectedMonth(Number(e.target.value))} style={budgetMonthSelectStyle(mob)}>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>
                {m}월
              </option>
            ))}
          </select>
        </div>
        <div style={{ display: "flex", gap: 4, width: "100%", alignItems: "stretch" }}>
          <button type="button" className="finance-nav-btn" onClick={() => setViewMode("monthly")} style={togglePill(viewMode === "monthly", mob)}>
            월별
          </button>
          <button type="button" className="finance-nav-btn" onClick={() => setViewMode("annual")} style={togglePill(viewMode === "annual", mob)}>
            연간 누적
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 20, maxWidth: "100%" }}>
        <div style={{ background: "var(--color-surface)", borderRadius: mob ? 8 : 16, border: `1px solid ${BORDER}`, overflow: "hidden" }}>
          <h4
            style={{
              margin: 0,
              padding: mob ? "10px 12px" : "14px 18px",
              fontSize: mob ? 13 : 16,
              fontWeight: 700,
              color: NAVY,
              borderBottom: `1px solid ${ROW_LINE}`,
            }}
          >
            수입 예산 vs 실적
          </h4>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={bvaTh("left", mob)}>항목</th>
                  <th style={bvaTh("right", mob)}>예산</th>
                  <th style={bvaTh("right", mob)}>실적</th>
                  <th style={bvaTh("right", mob)}>차이</th>
                  <th style={bvaTh("right", mob)}>달성률</th>
                </tr>
              </thead>
              <tbody>
                {incomeRows.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: 32, textAlign: "center", color: "var(--color-text-faint)", fontSize: 12 }}>
                      수입 예산/실적 데이터가 없습니다.
                    </td>
                  </tr>
                ) : (
                  incomeRows.map((r, i) => (
                    <tr key={r.name}>
                      <td style={bvaTd(i % 2 === 1, "left", mob)}>{r.name}</td>
                      <td style={bvaTd(i % 2 === 1, "right", mob)}>{fmt(r.예산)}</td>
                      <td style={{ ...bvaTd(i % 2 === 1, "right", mob), color: NAVY }}>{fmt(r.실적)}</td>
                      <td style={bvaTd(i % 2 === 1, "right", mob)}>{r.차이 >= 0 ? fmt(r.차이) : `(${fmt(-r.차이)})`}</td>
                      <td style={{ ...bvaTd(i % 2 === 1, "right", mob), fontWeight: 600 }}>{r.달성률}%</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
        <div style={{ background: "var(--color-surface)", borderRadius: mob ? 8 : 16, border: `1px solid ${BORDER}`, overflow: "hidden" }}>
          <h4
            style={{
              margin: 0,
              padding: mob ? "10px 12px" : "14px 18px",
              fontSize: mob ? 13 : 16,
              fontWeight: 700,
              color: NAVY,
              borderBottom: `1px solid ${ROW_LINE}`,
            }}
          >
            지출 예산 vs 실적
          </h4>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={bvaTh("left", mob)}>항목</th>
                  <th style={bvaTh("right", mob)}>예산</th>
                  <th style={bvaTh("right", mob)}>실적</th>
                  <th style={bvaTh("right", mob)}>차이</th>
                  <th style={bvaTh("right", mob)}>달성률</th>
                </tr>
              </thead>
              <tbody>
                {expenseRows.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: 32, textAlign: "center", color: "var(--color-text-faint)", fontSize: 12 }}>
                      지출 예산/실적 데이터가 없습니다.
                    </td>
                  </tr>
                ) : (
                  expenseRows.map((r, i) => (
                    <tr key={r.name}>
                      <td style={bvaTd(i % 2 === 1, "left", mob)}>{r.name}</td>
                      <td style={bvaTd(i % 2 === 1, "right", mob)}>{fmt(r.예산)}</td>
                      <td style={{ ...bvaTd(i % 2 === 1, "right", mob), color: NAVY }}>{fmt(r.실적)}</td>
                      <td style={bvaTd(i % 2 === 1, "right", mob)}>{r.차이 >= 0 ? fmt(r.차이) : `(${fmt(-r.차이)})`}</td>
                      <td style={{ ...bvaTd(i % 2 === 1, "right", mob), fontWeight: 600 }}>{r.달성률}%</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {chartData.length > 0 && (
        <div style={{ background: "var(--color-surface)", borderRadius: mob ? 8 : 16, border: `1px solid ${BORDER}`, padding: mob ? 16 : 24 }}>
          <h4 style={{ margin: "0 0 12px", fontSize: mob ? 13 : 16, fontWeight: 700, color: NAVY }}>카테고리별 예산 vs 실적</h4>
          <LazyChart height={300}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ left: 60, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={ROW_LINE} />
                <XAxis type="number" tickFormatter={(v) => `${(v / 10000).toFixed(0)}만`} tick={{ fontSize: mob ? 10 : 12, fill: "#999" }} />
                <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: mob ? 10 : 12, fill: "#555" }} />
                <Tooltip formatter={(v) => [`₩${fmt(Number(v))}`, ""]} />
                <Legend wrapperStyle={{ fontSize: mob ? 11 : 13 }} />
                <Bar dataKey="예산" fill="#6b7b9e" radius={[0, 4, 4, 0]} />
                <Bar dataKey="실적" fill={NAVY} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </LazyChart>
        </div>
      )}
    </div>
  );
}
