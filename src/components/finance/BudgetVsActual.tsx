"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import type { Budget } from "@/types/db";
import type { Income } from "@/types/db";
import type { Expense } from "@/types/db";

const fmt = (n: number) => new Intl.NumberFormat("ko-KR").format(n);
const NAVY = "#1e3a5f";
const CORAL = "#e74c3c";

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
  const [viewMode, setViewMode] = useState<"monthly" | "annual">(viewModeProp);
  const [selectedMonth, setSelectedMonth] = useState(month ?? new Date().getMonth() + 1);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const [budgetRes, incomeRes, expenseRes] = await Promise.all([
      supabase.from("budget").select("*").eq("fiscal_year", year),
      supabase.from("income").select("*").eq("fiscal_year", year),
      supabase.from("expense").select("*").eq("fiscal_year", year),
    ]);
    if (budgetRes.error) {
      console.error(budgetRes.error);
      toast("예산 로드 실패: " + budgetRes.error.message, "err");
    } else setBudgets((budgetRes.data ?? []) as Budget[]);
    if (incomeRes.error) {
      console.error(incomeRes.error);
      toast("수입 실적 로드 실패: " + incomeRes.error.message, "err");
    } else setIncomes((incomeRes.data ?? []) as Income[]);
    if (expenseRes.error) {
      console.error(expenseRes.error);
      toast("지출 실적 로드 실패: " + expenseRes.error.message, "err");
    } else setExpenses((expenseRes.data ?? []) as Expense[]);
    setLoading(false);
  }, [year, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

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
    return incomeCats.map((name) => {
      const bud = incomeBudget[name] ?? 0;
      const act = incomeActual[name] ?? 0;
      const diff = act - bud;
      const pct = bud > 0 ? Math.round((act / bud) * 100) : 0;
      return { name, 예산: bud, 실적: act, 차이: diff, 달성률: pct };
    }).filter((r) => r.예산 > 0 || r.실적 > 0);
  }, [incomeCats, incomeBudget, incomeActual]);

  const expenseRows = useMemo(() => {
    return expenseCats.map((name) => {
      const bud = expenseBudget[name] ?? 0;
      const act = expenseActual[name] ?? 0;
      const diff = bud - act;
      const pct = bud > 0 ? Math.round((act / bud) * 100) : 0;
      return { name, 예산: bud, 실적: act, 차이: diff, 달성률: pct };
    }).filter((r) => r.예산 > 0 || r.실적 > 0);
  }, [expenseCats, expenseBudget, expenseActual]);

  const chartData = useMemo(() => [
    ...incomeRows.map((r) => ({ name: r.name, 예산: r.예산, 실적: r.실적, type: "수입" })),
    ...expenseRows.map((r) => ({ name: r.name, 예산: r.예산, 실적: r.실적, type: "지출" })),
  ], [incomeRows, expenseRows]);

  const pctBg = (pct: number, isExpense: boolean) => {
    if (isExpense) {
      if (pct > 100) return "bg-red-100";
      if (pct >= 80) return "bg-green-50";
      if (pct < 80) return "bg-red-50";
    } else {
      if (pct >= 100) return "bg-green-50";
      if (pct >= 80) return "";
      if (pct < 80) return "bg-red-50";
    }
    return "";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <span className="inline-block w-8 h-8 rounded-full border-2 border-[#1e3a5f] border-t-transparent animate-spin" />
        <span className="ml-3 text-gray-600">예산/실적 로딩 중...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2">
          <span className="text-sm font-medium">연도</span>
          <input type="number" value={year} readOnly className="w-20 px-2 py-1 rounded border text-sm" />
        </label>
        <label className="flex items-center gap-2">
          <span className="text-sm font-medium">월</span>
          <select value={selectedMonth} onChange={(e) => setSelectedMonth(Number(e.target.value))} className="px-3 py-2 rounded-lg border border-gray-200 text-sm">
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>{m}월</option>
            ))}
          </select>
        </label>
        <div className="flex gap-2">
          <button type="button" onClick={() => setViewMode("monthly")} className={`px-3 py-1 rounded text-sm font-medium ${viewMode === "monthly" ? "bg-[#1e3a5f] text-white" : "bg-gray-100 text-gray-700"}`}>월별</button>
          <button type="button" onClick={() => setViewMode("annual")} className={`px-3 py-1 rounded text-sm font-medium ${viewMode === "annual" ? "bg-[#1e3a5f] text-white" : "bg-gray-100 text-gray-700"}`}>연간 누적</button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <h4 className="px-5 py-3 bg-gray-50 font-semibold text-[#1e3a5f] border-b">수입 예산 vs 실적</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="bg-gray-50 border-b"><th className="text-left py-2 px-3">항목</th><th className="text-right py-2 px-3">예산</th><th className="text-right py-2 px-3">실적</th><th className="text-right py-2 px-3">차이</th><th className="text-right py-2 px-3">달성률</th></tr></thead>
              <tbody>
                {incomeRows.length === 0 ? (
                  <tr><td colSpan={5} className="py-8 text-center text-gray-500">수입 예산/실적 데이터가 없습니다.</td></tr>
                ) : (
                  incomeRows.map((r) => (
                    <tr key={r.name} className={`border-b ${pctBg(r.달성률, false)}`}>
                      <td className="py-2 px-3">{r.name}</td>
                      <td className="py-2 px-3 text-right">{fmt(r.예산)}</td>
                      <td className="py-2 px-3 text-right">{fmt(r.실적)}</td>
                      <td className="py-2 px-3 text-right">{r.차이 >= 0 ? fmt(r.차이) : `(${fmt(-r.차이)})`}</td>
                      <td className="py-2 px-3 text-right font-medium">{r.달성률}%</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <h4 className="px-5 py-3 bg-gray-50 font-semibold text-[#1e3a5f] border-b">지출 예산 vs 실적</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="bg-gray-50 border-b"><th className="text-left py-2 px-3">항목</th><th className="text-right py-2 px-3">예산</th><th className="text-right py-2 px-3">실적</th><th className="text-right py-2 px-3">차이</th><th className="text-right py-2 px-3">달성률</th></tr></thead>
              <tbody>
                {expenseRows.length === 0 ? (
                  <tr><td colSpan={5} className="py-8 text-center text-gray-500">지출 예산/실적 데이터가 없습니다.</td></tr>
                ) : (
                  expenseRows.map((r) => (
                    <tr key={r.name} className={`border-b ${pctBg(r.달성률, true)}`}>
                      <td className="py-2 px-3">{r.name}</td>
                      <td className="py-2 px-3 text-right">{fmt(r.예산)}</td>
                      <td className="py-2 px-3 text-right">{fmt(r.실적)}</td>
                      <td className="py-2 px-3 text-right">{r.차이 >= 0 ? fmt(r.차이) : `(${fmt(-r.차이)})`}</td>
                      <td className="py-2 px-3 text-right font-medium">{r.달성률}%</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {chartData.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h4 className="font-semibold text-[#1e3a5f] mb-4">카테고리별 예산 vs 실적</h4>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ left: 60, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis type="number" tickFormatter={(v) => `${(v / 10000).toFixed(0)}만`} />
                <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number | undefined) => [`₩${fmt(v ?? 0)}`, ""]} />
                <Legend />
                <Bar dataKey="예산" fill="#e5e7eb" radius={[0, 4, 4, 0]} />
                <Bar dataKey="실적" fill={NAVY} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
