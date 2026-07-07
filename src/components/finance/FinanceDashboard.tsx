"use client";

import { useState, useEffect, useMemo, type CSSProperties } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import LazyChart from "../common/LazyChart";

const NAVY = "var(--color-primary)";
const MUTED_LINE = "var(--color-text-muted)";
const BORDER = "var(--color-border)";
const LABEL_SUB = "var(--color-text-muted)";
const LABEL_SMALL = "var(--color-text-faint)";
const fmt = (n: number) => new Intl.NumberFormat("ko-KR").format(n);

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
  budgetByMonth,
}: FinanceDashboardProps) {
  const mob = useIsMobile();
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

  const cardBase: CSSProperties = {
    padding: mob ? "8px 10px" : "16px 20px",
    minHeight: mob ? 56 : 90,
    background: "var(--color-surface)",
    border: `1px solid ${BORDER}`,
    borderRadius: 7,
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    position: "relative",
    overflow: "hidden",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: mob ? 12 : 20 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: mob ? 8 : 16 }}>
        <div style={cardBase}>
          <div style={{ fontSize: mob ? 10 : 13, color: LABEL_SUB, fontWeight: 500 }}>이번 달 총 수입</div>
          <div style={{ fontSize: mob ? 18 : 26, fontWeight: mob ? 800 : 700, color: NAVY, lineHeight: 1.2 }}>₩{fmt(monthIncome)}</div>
          <div style={{ fontSize: mob ? 9 : 12, color: LABEL_SMALL, marginTop: 2 }}>
            {incomeChange >= 0 ? "▲" : "▼"} 전월 대비 {Math.abs(incomeChange)}%
          </div>
        </div>
        <div style={cardBase}>
          <div style={{ fontSize: mob ? 10 : 13, color: LABEL_SUB, fontWeight: 500 }}>이번 달 총 지출</div>
          <div style={{ fontSize: mob ? 18 : 26, fontWeight: mob ? 800 : 700, color: NAVY, lineHeight: 1.2 }}>₩{fmt(monthExpense)}</div>
          <div style={{ fontSize: mob ? 9 : 12, color: LABEL_SMALL, marginTop: 2 }}>
            {expenseChange >= 0 ? "▲" : "▼"} 전월 대비 {Math.abs(expenseChange)}%
          </div>
        </div>
        <div style={{ ...cardBase, minHeight: mob ? 52 : 90 }}>
          <div style={{ fontSize: mob ? 10 : 13, color: LABEL_SUB, fontWeight: 500 }}>이번 달 순수익</div>
          <div style={{ fontSize: mob ? 16 : 22, fontWeight: mob ? 800 : 700, color: NAVY, lineHeight: 1.2 }}>₩{fmt(netProfit)}</div>
        </div>
        <div style={{ ...cardBase, minHeight: mob ? 52 : 90 }}>
          <div style={{ fontSize: mob ? 10 : 13, color: LABEL_SUB, fontWeight: 500 }}>예산 집행률</div>
          <div style={{ fontSize: mob ? 16 : 22, fontWeight: mob ? 800 : 700, color: NAVY, lineHeight: 1.2 }}>{executionRate}%</div>
          <div style={{ fontSize: mob ? 9 : 12, color: LABEL_SMALL, marginTop: 2 }}>이번 달 지출 / 예산</div>
        </div>
      </div>

      <div style={{ background: "var(--color-surface)", borderRadius: 7, border: `1px solid ${BORDER}`, padding: mob ? 12 : 24 }}>
        <h4 style={{ margin: mob ? "0 0 10px" : "0 0 16px", fontSize: mob ? 13 : 16, fontWeight: 700, color: NAVY }}>월별 수입/지출 추이</h4>
        <LazyChart height={260}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={monthlyTrend} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="month" tick={{ fontSize: 9, fill: LABEL_SMALL }} />
              <YAxis tick={{ fontSize: 9, fill: LABEL_SMALL }} tickFormatter={(v) => `${(v / 10000).toFixed(0)}만`} />
              <Tooltip formatter={(value) => [`₩${fmt(Number(value))}`, ""]} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="수입" stroke={NAVY} strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="지출" stroke={MUTED_LINE} strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </LazyChart>
      </div>
    </div>
  );
}
