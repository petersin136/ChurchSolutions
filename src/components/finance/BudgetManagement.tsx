"use client";

import { useState, useMemo } from "react";
import type { Budget } from "@/types/db";

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);
const fmt = (n: number) => new Intl.NumberFormat("ko-KR").format(n);

const DEFAULT_INCOME_CATEGORIES = ["십일조", "감사헌금", "주일헌금", "건축헌금", "선교헌금", "기타수입"];
const DEFAULT_EXPENSE_CATEGORIES = ["인건비", "사역비", "관리비", "선교비", "교육비", "행사비", "기타지출"];

export interface BudgetManagementProps {
  fiscalYear: string;
  budgets: Budget[];
  onSave: (rows: { category_type: "수입" | "지출"; category: string; monthly_amounts: Record<string, number>; annual_total: number }[]) => void;
  onLoadLastYear?: (year: string) => Budget[];
}

export function BudgetManagement({
  fiscalYear,
  budgets,
  onSave,
  onLoadLastYear,
}: BudgetManagementProps) {
  const [year, setYear] = useState(fiscalYear);
  const [incomeRows, setIncomeRows] = useState<{ category: string; amounts: Record<number, number> }[]>(() => {
    const existing = budgets.filter((b) => b.category_type === "수입");
    if (existing.length) {
      return existing.map((b) => ({
        category: b.category,
        amounts: MONTHS.reduce((acc, m) => {
          acc[m] = Number((b.monthly_amounts || {})[String(m)]) || 0;
          return acc;
        }, {} as Record<number, number>),
      }));
    }
    return DEFAULT_INCOME_CATEGORIES.map((cat) => ({
      category: cat,
      amounts: MONTHS.reduce((acc, m) => {
        acc[m] = 0;
        return acc;
      }, {} as Record<number, number>),
    }));
  });
  const [expenseRows, setExpenseRows] = useState<{ category: string; amounts: Record<number, number> }[]>(() => {
    const existing = budgets.filter((b) => b.category_type === "지출");
    if (existing.length) {
      return existing.map((b) => ({
        category: b.category,
        amounts: MONTHS.reduce((acc, m) => {
          acc[m] = Number((b.monthly_amounts || {})[String(m)]) || 0;
          return acc;
        }, {} as Record<number, number>),
      }));
    }
    return DEFAULT_EXPENSE_CATEGORIES.map((cat) => ({
      category: cat,
      amounts: MONTHS.reduce((acc, m) => {
        acc[m] = 0;
        return acc;
      }, {} as Record<number, number>),
    }));
  });

  const incomeTotals = useMemo(() => {
    const byMonth: Record<number, number> = {};
    MONTHS.forEach((m) => { byMonth[m] = incomeRows.reduce((s, r) => s + (r.amounts[m] || 0), 0); });
    const annual = Object.values(byMonth).reduce((s, v) => s + v, 0);
    return { byMonth, annual };
  }, [incomeRows]);

  const expenseTotals = useMemo(() => {
    const byMonth: Record<number, number> = {};
    MONTHS.forEach((m) => { byMonth[m] = expenseRows.reduce((s, r) => s + (r.amounts[m] || 0), 0); });
    const annual = Object.values(byMonth).reduce((s, v) => s + v, 0);
    return { byMonth, annual };
  }, [expenseRows]);

  const balance = incomeTotals.annual - expenseTotals.annual;

  const updateIncomeAmount = (rowIndex: number, month: number, value: number) => {
    setIncomeRows((prev) => prev.map((r, i) => (i === rowIndex ? { ...r, amounts: { ...r.amounts, [month]: value } } : r)));
  };
  const updateExpenseAmount = (rowIndex: number, month: number, value: number) => {
    setExpenseRows((prev) => prev.map((r, i) => (i === rowIndex ? { ...r, amounts: { ...r.amounts, [month]: value } } : r)));
  };

  const copyFromLastYear = () => {
    const lastYear = String(Number(year) - 1);
    const loaded = onLoadLastYear?.(lastYear) ?? [];
    if (loaded.length === 0) return;
    const inc = loaded.filter((b) => b.category_type === "수입").map((b) => ({
      category: b.category,
      amounts: MONTHS.reduce((acc, m) => {
        acc[m] = Number((b.monthly_amounts || {})[String(m)]) || 0;
        return acc;
      }, {} as Record<number, number>),
    }));
    const exp = loaded.filter((b) => b.category_type === "지출").map((b) => ({
      category: b.category,
      amounts: MONTHS.reduce((acc, m) => {
        acc[m] = Number((b.monthly_amounts || {})[String(m)]) || 0;
        return acc;
      }, {} as Record<number, number>),
    }));
    if (inc.length) setIncomeRows(inc);
    if (exp.length) setExpenseRows(exp);
  };

  const handleSave = () => {
    const rows = [
      ...incomeRows.map((r) => ({
        category_type: "수입" as const,
        category: r.category,
        monthly_amounts: MONTHS.reduce((acc, m) => {
          acc[String(m)] = r.amounts[m] || 0;
          return acc;
        }, {} as Record<string, number>),
        annual_total: Object.values(r.amounts).reduce((s, v) => s + v, 0),
      })),
      ...expenseRows.map((r) => ({
        category_type: "지출" as const,
        category: r.category,
        monthly_amounts: MONTHS.reduce((acc, m) => {
          acc[String(m)] = r.amounts[m] || 0;
          return acc;
        }, {} as Record<string, number>),
        annual_total: Object.values(r.amounts).reduce((s, v) => s + v, 0),
      })),
    ];
    onSave(rows);
  };

  const renderCell = (
    key: number | string,
    value: number,
    onChange: (v: number) => void,
    isTotal = false
  ) => (
    <td
      key={key}
      className={`py-2 px-1 border border-gray-200 ${isTotal ? "bg-gray-100 font-bold" : "hover:bg-blue-50/50"} text-right`}
    >
      {isTotal ? (
        <span className="text-gray-800">{fmt(value)}</span>
      ) : (
        <input
          type="number"
          min={0}
          value={value || ""}
          onChange={(e) => onChange(Number(e.target.value) || 0)}
          className="w-full min-w-[72px] px-2 py-1 text-right border-0 rounded bg-transparent focus:ring-2 focus:ring-blue-200"
        />
      )}
    </td>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">연도</span>
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            min={2020}
            max={2030}
            className="w-24 px-3 py-2 rounded-lg border border-gray-200 text-sm"
          />
        </label>
        <button type="button" onClick={copyFromLastYear} className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium hover:bg-gray-50">
          전년도 복사
        </button>
        <button type="button" onClick={handleSave} className="px-4 py-2 rounded-lg bg-[#1e3a5f] text-white text-sm font-semibold hover:opacity-90">
          저장
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <h3 className="px-5 py-3 bg-gray-50 font-semibold text-[#1e3a5f] border-b border-gray-200">수입 예산</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50">
                <th className="py-2 px-3 text-left font-semibold text-gray-700 border border-gray-200 w-32">항목</th>
                {MONTHS.map((m) => (
                  <th key={m} className="py-2 px-1 text-right font-semibold text-gray-700 border border-gray-200 min-w-[72px]">{m}월</th>
                ))}
                <th className="py-2 px-3 text-right font-semibold text-gray-700 border border-gray-200 bg-gray-100">연간합계</th>
              </tr>
            </thead>
            <tbody>
              {incomeRows.map((row, ri) => (
                <tr key={row.category}>
                  <td className="py-2 px-3 font-medium border border-gray-200">{row.category}</td>
                  {MONTHS.map((m) => renderCell(m, row.amounts[m] || 0, (v) => updateIncomeAmount(ri, m, v)))}
                  {renderCell("sum", Object.values(row.amounts).reduce((s, v) => s + v, 0), () => {}, true)}
                </tr>
              ))}
              <tr className="bg-gray-100 font-bold">
                <td className="py-2 px-3 border border-gray-200">수입 합계</td>
                {MONTHS.map((m) => (
                  <td key={m} className="py-2 px-1 text-right border border-gray-200">{fmt(incomeTotals.byMonth[m])}</td>
                ))}
                <td className="py-2 px-3 text-right border border-gray-200">{fmt(incomeTotals.annual)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <h3 className="px-5 py-3 bg-gray-50 font-semibold text-[#1e3a5f] border-b border-gray-200">지출 예산</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50">
                <th className="py-2 px-3 text-left font-semibold text-gray-700 border border-gray-200 w-32">항목</th>
                {MONTHS.map((m) => (
                  <th key={m} className="py-2 px-1 text-right font-semibold text-gray-700 border border-gray-200 min-w-[72px]">{m}월</th>
                ))}
                <th className="py-2 px-3 text-right font-semibold text-gray-700 border border-gray-200 bg-gray-100">연간합계</th>
              </tr>
            </thead>
            <tbody>
              {expenseRows.map((row, ri) => (
                <tr key={row.category}>
                  <td className="py-2 px-3 font-medium border border-gray-200">{row.category}</td>
                  {MONTHS.map((m) => renderCell(m, row.amounts[m] || 0, (v) => updateExpenseAmount(ri, m, v)))}
                  {renderCell("sum", Object.values(row.amounts).reduce((s, v) => s + v, 0), () => {}, true)}
                </tr>
              ))}
              <tr className="bg-gray-100 font-bold">
                <td className="py-2 px-3 border border-gray-200">지출 합계</td>
                {MONTHS.map((m) => (
                  <td key={m} className="py-2 px-1 text-right border border-gray-200">{fmt(expenseTotals.byMonth[m])}</td>
                ))}
                <td className="py-2 px-3 text-right border border-gray-200">{fmt(expenseTotals.annual)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <div className="text-lg font-semibold text-[#1e3a5f]">
          수지 차액 (수입 - 지출): <span className={balance >= 0 ? "text-[#1e3a5f]" : "text-[#e74c3c]"}>{fmt(balance)}</span>
        </div>
      </div>
    </div>
  );
}
