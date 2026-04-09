"use client";

import { useMemo, useState, useEffect, useCallback, type CSSProperties } from "react";
import { supabase } from "@/lib/supabase";
import { filterByChurch } from "@/lib/tenant";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import type { Budget } from "@/types/db";
import { useAppData } from "@/contexts/AppDataContext";
import LazyChart from "../common/LazyChart";

const fmt = (n: number) => new Intl.NumberFormat("ko-KR").format(n);
const NAVY = "#1B2A4A";
const BORDER = "#e8ecf1";
const ROW_LINE = "#f0f2f5";

const bvaTh = (align: "left" | "right" | "center"): CSSProperties => ({
  fontSize: 10,
  fontWeight: 700,
  color: NAVY,
  padding: "6px 8px",
  borderBottom: `2px solid ${NAVY}`,
  background: "#fff",
  textAlign: align,
});

const bvaTd = (isEven: boolean, align: "left" | "right" | "center"): CSSProperties => ({
  fontSize: 11,
  color: "#555",
  padding: "8px",
  borderBottom: `1px solid ${ROW_LINE}`,
  background: isEven ? "#fafbfc" : "#fff",
  textAlign: align,
});

function togglePill(selected: boolean): CSSProperties {
  return {
    height: 28,
    minHeight: 28,
    maxHeight: 28,
    lineHeight: "28px",
    padding: "0 12px",
    fontSize: 11,
    fontWeight: 600,
    borderRadius: 6,
    border: selected ? "none" : `1px solid ${BORDER}`,
    background: selected ? NAVY : "#f5f6f8",
    color: selected ? "#fff" : "#555",
    cursor: "pointer",
    outline: "none",
    boxShadow: "none",
    fontFamily: "inherit",
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
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "48px 16px", color: "#555" }}>
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

  const selStyle: CSSProperties = {
    height: 32,
    fontSize: 11,
    borderRadius: 6,
    border: `1px solid ${BORDER}`,
    padding: "0 10px",
    background: "#fff",
    color: "#555",
    cursor: "pointer",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 600, color: NAVY }}>
          연도
          <input type="text" value={year} readOnly style={{ ...selStyle, width: 72, fontSize: 12, cursor: "default" }} />
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 600, color: NAVY }}>
          월
          <select value={selectedMonth} onChange={(e) => setSelectedMonth(Number(e.target.value))} style={{ ...selStyle, minWidth: 88 }}>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>
                {m}월
              </option>
            ))}
          </select>
        </label>
        <div style={{ display: "flex", gap: 4 }}>
          <button type="button" className="finance-nav-btn" onClick={() => setViewMode("monthly")} style={togglePill(viewMode === "monthly")}>
            월별
          </button>
          <button type="button" className="finance-nav-btn" onClick={() => setViewMode("annual")} style={togglePill(viewMode === "annual")}>
            연간 누적
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 20, maxWidth: "100%" }}>
        <div style={{ background: "#fff", borderRadius: 8, border: `1px solid ${BORDER}`, overflow: "hidden" }}>
          <h4 style={{ margin: 0, padding: "10px 12px", fontSize: 13, fontWeight: 700, color: NAVY, borderBottom: `1px solid ${ROW_LINE}` }}>수입 예산 vs 실적</h4>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={bvaTh("left")}>항목</th>
                  <th style={bvaTh("right")}>예산</th>
                  <th style={bvaTh("right")}>실적</th>
                  <th style={bvaTh("right")}>차이</th>
                  <th style={bvaTh("right")}>달성률</th>
                </tr>
              </thead>
              <tbody>
                {incomeRows.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: 32, textAlign: "center", color: "#999", fontSize: 12 }}>
                      수입 예산/실적 데이터가 없습니다.
                    </td>
                  </tr>
                ) : (
                  incomeRows.map((r, i) => (
                    <tr key={r.name}>
                      <td style={bvaTd(i % 2 === 1, "left")}>{r.name}</td>
                      <td style={bvaTd(i % 2 === 1, "right")}>{fmt(r.예산)}</td>
                      <td style={{ ...bvaTd(i % 2 === 1, "right"), color: NAVY }}>{fmt(r.실적)}</td>
                      <td style={bvaTd(i % 2 === 1, "right")}>{r.차이 >= 0 ? fmt(r.차이) : `(${fmt(-r.차이)})`}</td>
                      <td style={{ ...bvaTd(i % 2 === 1, "right"), fontWeight: 600 }}>{r.달성률}%</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
        <div style={{ background: "#fff", borderRadius: 8, border: `1px solid ${BORDER}`, overflow: "hidden" }}>
          <h4 style={{ margin: 0, padding: "10px 12px", fontSize: 13, fontWeight: 700, color: NAVY, borderBottom: `1px solid ${ROW_LINE}` }}>지출 예산 vs 실적</h4>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={bvaTh("left")}>항목</th>
                  <th style={bvaTh("right")}>예산</th>
                  <th style={bvaTh("right")}>실적</th>
                  <th style={bvaTh("right")}>차이</th>
                  <th style={bvaTh("right")}>달성률</th>
                </tr>
              </thead>
              <tbody>
                {expenseRows.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: 32, textAlign: "center", color: "#999", fontSize: 12 }}>
                      지출 예산/실적 데이터가 없습니다.
                    </td>
                  </tr>
                ) : (
                  expenseRows.map((r, i) => (
                    <tr key={r.name}>
                      <td style={bvaTd(i % 2 === 1, "left")}>{r.name}</td>
                      <td style={bvaTd(i % 2 === 1, "right")}>{fmt(r.예산)}</td>
                      <td style={{ ...bvaTd(i % 2 === 1, "right"), color: NAVY }}>{fmt(r.실적)}</td>
                      <td style={bvaTd(i % 2 === 1, "right")}>{r.차이 >= 0 ? fmt(r.차이) : `(${fmt(-r.차이)})`}</td>
                      <td style={{ ...bvaTd(i % 2 === 1, "right"), fontWeight: 600 }}>{r.달성률}%</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {chartData.length > 0 && (
        <div style={{ background: "#fff", borderRadius: 8, border: `1px solid ${BORDER}`, padding: 16 }}>
          <h4 style={{ margin: "0 0 12px", fontSize: 13, fontWeight: 700, color: NAVY }}>카테고리별 예산 vs 실적</h4>
          <LazyChart height={300}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ left: 60, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={ROW_LINE} />
                <XAxis type="number" tickFormatter={(v) => `${(v / 10000).toFixed(0)}만`} tick={{ fontSize: 10, fill: "#999" }} />
                <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 10, fill: "#555" }} />
                <Tooltip formatter={(v) => [`₩${fmt(Number(v))}`, ""]} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
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
