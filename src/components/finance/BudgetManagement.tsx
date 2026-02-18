"use client";

import { useState, useMemo, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import type { Budget } from "@/types/db";

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);
const fmt = (n: number) => new Intl.NumberFormat("ko-KR").format(n);

const DEFAULT_INCOME_CATEGORIES = ["십일조", "감사헌금", "주일헌금", "건축헌금", "선교헌금", "기타수입"];
const DEFAULT_EXPENSE_CATEGORIES = ["인건비", "사역비", "관리비", "선교비", "교육비", "행사비", "기타지출"];

export interface BudgetManagementProps {
  /** 초기 회계연도 (기본: 현재 연도) */
  fiscalYear?: string;
  /** 토스트 메시지 */
  toast: (msg: string, type?: "ok" | "err" | "warn") => void;
}

function toAmounts(monthly_amounts: Record<string, number> | null | undefined): Record<number, number> {
  return MONTHS.reduce((acc, m) => {
    acc[m] = Number((monthly_amounts || {})[String(m)]) || 0;
    return acc;
  }, {} as Record<number, number>);
}

export function BudgetManagement({ fiscalYear = String(new Date().getFullYear()), toast }: BudgetManagementProps) {
  const [year, setYear] = useState(fiscalYear);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [incomeRows, setIncomeRows] = useState<{ category: string; amounts: Record<number, number> }[]>([]);
  const [expenseRows, setExpenseRows] = useState<{ category: string; amounts: Record<number, number> }[]>([]);

  const loadBudget = async (selectedYear: string) => {
    if (!supabase) {
      setLoading(false);
      setIncomeRows(DEFAULT_INCOME_CATEGORIES.map((cat) => ({ category: cat, amounts: MONTHS.reduce((acc, m) => ({ ...acc, [m]: 0 }), {} as Record<number, number>) })));
      setExpenseRows(DEFAULT_EXPENSE_CATEGORIES.map((cat) => ({ category: cat, amounts: MONTHS.reduce((acc, m) => ({ ...acc, [m]: 0 }), {} as Record<number, number>) })));
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("budget")
      .select("*")
      .eq("fiscal_year", selectedYear)
      .order("category_type", { ascending: true })
      .order("category", { ascending: true });
    if (error) {
      console.error(error);
      toast("데이터 로드 실패: " + error.message, "err");
      setIncomeRows(DEFAULT_INCOME_CATEGORIES.map((cat) => ({ category: cat, amounts: toAmounts({}) })));
      setExpenseRows(DEFAULT_EXPENSE_CATEGORIES.map((cat) => ({ category: cat, amounts: toAmounts({}) })));
      setLoading(false);
      return;
    }
    const budgets = (data ?? []) as Budget[];
    const inc = budgets.filter((b) => b.category_type === "수입");
    const exp = budgets.filter((b) => b.category_type === "지출");
    setIncomeRows(
      inc.length > 0
        ? inc.map((b) => ({ category: b.category, amounts: toAmounts(b.monthly_amounts) }))
        : DEFAULT_INCOME_CATEGORIES.map((cat) => ({ category: cat, amounts: toAmounts({}) }))
    );
    setExpenseRows(
      exp.length > 0
        ? exp.map((b) => ({ category: b.category, amounts: toAmounts(b.monthly_amounts) }))
        : DEFAULT_EXPENSE_CATEGORIES.map((cat) => ({ category: cat, amounts: toAmounts({}) }))
    );
    setLoading(false);
  };

  useEffect(() => {
    loadBudget(year);
  }, [year]);

  const incomeTotals = useMemo(() => {
    const byMonth: Record<number, number> = {};
    MONTHS.forEach((m) => {
      byMonth[m] = incomeRows.reduce((s, r) => s + (r.amounts[m] || 0), 0);
    });
    const annual = Object.values(byMonth).reduce((s, v) => s + v, 0);
    return { byMonth, annual };
  }, [incomeRows]);

  const expenseTotals = useMemo(() => {
    const byMonth: Record<number, number> = {};
    MONTHS.forEach((m) => {
      byMonth[m] = expenseRows.reduce((s, r) => s + (r.amounts[m] || 0), 0);
    });
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

  const copyFromLastYear = async () => {
    const lastYear = String(Number(year) - 1);
    if (!supabase) return;
    const { data, error } = await supabase
      .from("budget")
      .select("*")
      .eq("fiscal_year", lastYear)
      .order("category_type", { ascending: true })
      .order("category", { ascending: true });
    if (error || !data?.length) {
      toast("전년도 데이터가 없습니다.", "warn");
      return;
    }
    const budgets = data as Budget[];
    const inc = budgets.filter((b) => b.category_type === "수입").map((b) => ({ category: b.category, amounts: toAmounts(b.monthly_amounts) }));
    const exp = budgets.filter((b) => b.category_type === "지출").map((b) => ({ category: b.category, amounts: toAmounts(b.monthly_amounts) }));
    if (inc.length) setIncomeRows(inc);
    if (exp.length) setExpenseRows(exp);
    toast("전년도 예산을 불러왔습니다.", "ok");
  };

  const handleSave = async () => {
    if (!supabase) return;
    setSaving(true);
    const budgetRows = [
      ...incomeRows.map((r) => ({
        fiscal_year: year,
        category_type: "수입" as const,
        category: r.category,
        sub_category: null as string | null,
        monthly_amounts: MONTHS.reduce((acc, m) => {
          acc[String(m)] = r.amounts[m] || 0;
          return acc;
        }, {} as Record<string, number>),
        annual_total: Object.values(r.amounts).reduce((s, v) => s + v, 0),
        notes: null as string | null,
      })),
      ...expenseRows.map((r) => ({
        fiscal_year: year,
        category_type: "지출" as const,
        category: r.category,
        sub_category: null as string | null,
        monthly_amounts: MONTHS.reduce((acc, m) => {
          acc[String(m)] = r.amounts[m] || 0;
          return acc;
        }, {} as Record<string, number>),
        annual_total: Object.values(r.amounts).reduce((s, v) => s + v, 0),
        notes: null as string | null,
      })),
    ];
    try {
      const { error: delErr } = await supabase.from("budget").delete().eq("fiscal_year", year);
      if (delErr) {
        toast("저장 실패: " + delErr.message, "err");
        setSaving(false);
        return;
      }
      const { error: insErr } = await supabase.from("budget").insert(
        budgetRows.map((row) => ({
          fiscal_year: row.fiscal_year,
          category_type: row.category_type,
          category: row.category,
          sub_category: row.sub_category,
          monthly_amounts: row.monthly_amounts,
          annual_total: row.annual_total,
          notes: row.notes,
        }))
      );
      if (insErr) {
        toast("저장 실패: " + insErr.message, "err");
        setSaving(false);
        return;
      }
      toast("예산이 저장되었습니다");
    } catch (e) {
      toast("저장 실패: " + (e instanceof Error ? e.message : String(e)), "err");
    }
    setSaving(false);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <span className="inline-block w-8 h-8 rounded-full border-2 border-[#1e3a5f] border-t-transparent animate-spin" />
        <span className="ml-3 text-gray-600">예산 데이터 로딩 중...</span>
      </div>
    );
  }

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
        <button type="button" onClick={handleSave} disabled={saving} className="px-4 py-2 rounded-lg bg-[#1e3a5f] text-white text-sm font-semibold hover:opacity-90 disabled:opacity-60">
          {saving ? "저장 중..." : "저장"}
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
