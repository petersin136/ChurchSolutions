"use client";

import { useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from "recharts";

const NAVY = "#1e3a5f";
const CORAL = "#e74c3c";
const fmt = (n: number) => new Intl.NumberFormat("ko-KR").format(n);

interface OfferingLike { date: string; amount: number; categoryId?: string; type?: string; }
interface ExpenseLike { date: string; amount: number; categoryId?: string; category?: string; }
interface CategoryLike { id: string; name: string; }

export interface FinanceDashboardProps {
  offerings: OfferingLike[];
  expenses: ExpenseLike[];
  incomeCategories?: CategoryLike[];
  expenseCategories?: CategoryLike[];
  budgetByMonth?: { income: number; expense: number }[];
  onAddIncome?: () => void;
  onAddExpense?: () => void;
  onOpenCashJournal?: () => void;
  onOpenBudget?: () => void;
}

export function FinanceDashboard({
  offerings,
  expenses,
  incomeCategories = [],
  expenseCategories = [],
  budgetByMonth,
  onAddIncome,
  onAddExpense,
  onOpenCashJournal,
  onOpenBudget,
}: FinanceDashboardProps) {
  const thisYear = new Date().getFullYear().toString();
  const thisMonth = new Date().getMonth() + 1;
  const lastMonth = thisMonth === 1 ? 12 : thisMonth - 1;
  const ms = String(thisMonth).padStart(2, "0");
  const lastMs = String(lastMonth).padStart(2, "0");

  const monthIncome = useMemo(
    () => offerings.filter((o) => o.date?.startsWith(`${thisYear}-${ms}`)).reduce((s, o) => s + o.amount, 0),
    [offerings, thisYear, ms]
  );
  const monthExpense = useMemo(
    () => expenses.filter((e) => e.date?.startsWith(`${thisYear}-${ms}`)).reduce((s, e) => s + e.amount, 0),
    [expenses, thisYear, ms]
  );
  const lastMonthIncome = useMemo(
    () => offerings.filter((o) => o.date?.startsWith(`${thisYear}-${lastMs}`)).reduce((s, o) => s + o.amount, 0),
    [offerings, thisYear, lastMs]
  );
  const lastMonthExpense = useMemo(
    () => expenses.filter((e) => e.date?.startsWith(`${thisYear}-${lastMs}`)).reduce((s, e) => s + e.amount, 0),
    [expenses, thisYear, lastMs]
  );

  const incomeChange = lastMonthIncome > 0 ? Math.round(((monthIncome - lastMonthIncome) / lastMonthIncome) * 100) : 0;
  const expenseChange = lastMonthExpense > 0 ? Math.round(((monthExpense - lastMonthExpense) / lastMonthExpense) * 100) : 0;
  const netProfit = monthIncome - monthExpense;
  const monthBudgetExpense = budgetByMonth?.[thisMonth - 1]?.expense ?? 0;
  const executionRate = monthBudgetExpense > 0 ? Math.round((monthExpense / monthBudgetExpense) * 100) : 0;

  const monthlyTrend = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      const mStr = String(m).padStart(2, "0");
      const inc = offerings.filter((o) => o.date?.startsWith(`${thisYear}-${mStr}`)).reduce((s, o) => s + o.amount, 0);
      const exp = expenses.filter((e) => e.date?.startsWith(`${thisYear}-${mStr}`)).reduce((s, e) => s + e.amount, 0);
      return { month: `${m}월`, 수입: inc, 지출: exp };
    });
  }, [offerings, expenses, thisYear]);

  const incomeByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    offerings.forEach((o) => {
      const id = o.categoryId || o.type || "other";
      map[id] = (map[id] || 0) + o.amount;
    });
    return incomeCategories.length
      ? incomeCategories.map((c) => ({ name: c.name, value: map[c.id] || 0 })).filter((d) => d.value > 0)
      : Object.entries(map).map(([k, v]) => ({ name: k, value: v }));
  }, [offerings, incomeCategories]);

  const expenseByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    expenses.forEach((e) => {
      const id = e.categoryId || e.category || "other";
      map[id] = (map[id] || 0) + e.amount;
    });
    return expenseCategories.length
      ? expenseCategories.map((c) => ({ name: c.name, value: map[c.id] || 0 })).filter((d) => d.value > 0)
      : Object.entries(map).map(([k, v]) => ({ name: k, value: v }));
  }, [expenses, expenseCategories]);

  const COLORS = [NAVY, "#4361ee", "#7209b7", "#06d6a0", "#ffd166", "#8d99ae"];

  return (
    <div className="space-y-6">
      {/* 요약 카드 4개 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 md:p-5">
          <div className="text-xs font-medium text-gray-500 mb-1">이번 달 총 수입</div>
          <div className="text-xl md:text-2xl font-bold text-[#1e3a5f]">₩{fmt(monthIncome)}</div>
          <div className="text-xs text-gray-500 mt-1 flex items-center gap-1">
            {incomeChange >= 0 ? "▲" : "▼"} 전월 대비 {Math.abs(incomeChange)}%
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 md:p-5">
          <div className="text-xs font-medium text-gray-500 mb-1">이번 달 총 지출</div>
          <div className="text-xl md:text-2xl font-bold text-[#e74c3c]">₩{fmt(monthExpense)}</div>
          <div className="text-xs text-gray-500 mt-1 flex items-center gap-1">
            {expenseChange >= 0 ? "▲" : "▼"} 전월 대비 {Math.abs(expenseChange)}%
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 md:p-5">
          <div className="text-xs font-medium text-gray-500 mb-1">이번 달 순수익</div>
          <div className={`text-xl md:text-2xl font-bold ${netProfit >= 0 ? "text-[#1e3a5f]" : "text-[#e74c3c]"}`}>
            ₩{fmt(netProfit)}
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 md:p-5">
          <div className="text-xs font-medium text-gray-500 mb-1">예산 집행률</div>
          <div className="text-xl md:text-2xl font-bold text-[#1e3a5f]">{executionRate}%</div>
          <div className="text-xs text-gray-500 mt-1">이번 달 지출 / 예산</div>
        </div>
      </div>

      {/* 빠른 액션 */}
      <div className="flex flex-wrap gap-3">
        {onAddIncome && (
          <button type="button" onClick={onAddIncome} className="px-4 py-2 rounded-xl bg-[#1e3a5f] text-white text-sm font-semibold hover:opacity-90">
            + 수입 등록
          </button>
        )}
        {onAddExpense && (
          <button type="button" onClick={onAddExpense} className="px-4 py-2 rounded-xl bg-[#e74c3c] text-white text-sm font-semibold hover:opacity-90">
            + 지출 등록
          </button>
        )}
        {onOpenCashJournal && (
          <button type="button" onClick={onOpenCashJournal} className="px-4 py-2 rounded-xl border border-gray-200 text-gray-700 text-sm font-semibold hover:bg-gray-50">
            현금출납장
          </button>
        )}
        {onOpenBudget && (
          <button type="button" onClick={onOpenBudget} className="px-4 py-2 rounded-xl border border-gray-200 text-gray-700 text-sm font-semibold hover:bg-gray-50">
            예산 설정
          </button>
        )}
      </div>

      {/* 차트 2열 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h4 className="text-base font-semibold text-[#1e3a5f] mb-4">월별 수입/지출 추이</h4>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 10000).toFixed(0)}만`} />
                <Tooltip formatter={(v: number | undefined) => [`₩${fmt(v ?? 0)}`, ""]} labelFormatter={(l) => l} />
                <Legend />
                <Line type="monotone" dataKey="수입" stroke={NAVY} strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="지출" stroke={CORAL} strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h4 className="text-base font-semibold text-[#1e3a5f] mb-4">수입 카테고리별</h4>
          <div className="h-64">
            {incomeByCategory.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={incomeByCategory}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={(e) => e.name}
                  >
                    {incomeByCategory.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number | undefined) => [`₩${fmt(v ?? 0)}`, ""]} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400 text-sm">데이터 없음</div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h4 className="text-base font-semibold text-[#1e3a5f] mb-4">지출 카테고리별</h4>
          <div className="h-64">
            {expenseByCategory.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={expenseByCategory}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={(e) => e.name}
                  >
                    {expenseByCategory.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number | undefined) => [`₩${fmt(v ?? 0)}`, ""]} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400 text-sm">데이터 없음</div>
            )}
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h4 className="text-base font-semibold text-[#1e3a5f] mb-4">월별 수입/지출 막대</h4>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyTrend} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 10000).toFixed(0)}만`} />
                <Tooltip formatter={(v: number | undefined) => [`₩${fmt(v ?? 0)}`, ""]} />
                <Legend />
                <Bar dataKey="수입" fill={NAVY} radius={[4, 4, 0, 0]} />
                <Bar dataKey="지출" fill={CORAL} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
