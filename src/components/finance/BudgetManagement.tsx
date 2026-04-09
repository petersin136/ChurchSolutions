"use client";

import { useState, useMemo, useEffect, type CSSProperties } from "react";
import { supabase } from "@/lib/supabase";
import { getChurchId } from "@/lib/tenant";
import type { Budget } from "@/types/db";

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);
const fmt = (n: number) => new Intl.NumberFormat("ko-KR").format(n);

const NAVY = "#1B2A4A";
const BORDER = "#e8ecf1";
const ROW_LINE = "#f0f2f5";

const bmTh = (align: "left" | "right" | "center"): CSSProperties => ({
  fontSize: 10,
  fontWeight: 700,
  color: NAVY,
  padding: "6px 8px",
  borderBottom: `2px solid ${NAVY}`,
  background: "#fff",
  textAlign: align,
  whiteSpace: "nowrap",
});

const bmTd = (isEven: boolean, align: "left" | "right" | "center"): CSSProperties => ({
  fontSize: 11,
  color: "#555",
  padding: "8px",
  borderBottom: `1px solid ${ROW_LINE}`,
  background: isEven ? "#fafbfc" : "#fff",
  textAlign: align,
});

const bmTotalTd = (align: "left" | "right" | "center"): CSSProperties => ({
  fontSize: 11,
  fontWeight: 700,
  color: NAVY,
  padding: "8px",
  background: "#f0f2f5",
  borderBottom: `1px solid ${ROW_LINE}`,
  textAlign: align,
});

const inputCompact: CSSProperties = {
  width: "100%",
  minWidth: 72,
  height: 28,
  padding: "0 6px",
  fontSize: 11,
  textAlign: "right",
  borderRadius: 4,
  border: `1px solid ${BORDER}`,
  outline: "none",
  boxShadow: "none",
  background: "#fff",
  color: "#555",
};

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
      .eq("church_id", getChurchId())
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
      .eq("church_id", getChurchId())
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
      const { error: delErr } = await supabase.from("budget").delete().eq("church_id", getChurchId()).eq("fiscal_year", year);
      if (delErr) {
        toast("저장 실패: " + delErr.message, "err");
        setSaving(false);
        return;
      }
      const churchId = getChurchId();
      const { error: insErr } = await supabase.from("budget").insert(
        budgetRows.map((row) => ({
          fiscal_year: row.fiscal_year,
          category_type: row.category_type,
          category: row.category,
          sub_category: row.sub_category,
          monthly_amounts: row.monthly_amounts,
          annual_total: row.annual_total,
          notes: row.notes,
          church_id: churchId,
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

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "48px 16px", color: "#555", fontSize: 13 }}>
        <span
          style={{
            display: "inline-block",
            width: 28,
            height: 28,
            borderRadius: "50%",
            border: `2px solid ${NAVY}`,
            borderTopColor: "transparent",
            animation: "finance-spin 0.8s linear infinite",
          }}
        />
        <span style={{ marginLeft: 12 }}>예산 데이터 로딩 중...</span>
        <style>{`@keyframes finance-spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const yearOptions = Array.from({ length: 11 }, (_, i) => String(2020 + i));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 600, color: NAVY }}>
          연도
          <select
            value={year}
            onChange={(e) => setYear(e.target.value)}
            style={{ height: 32, fontSize: 12, width: 90, borderRadius: 6, border: `1px solid ${BORDER}`, padding: "0 8px", background: "#fff", color: "#555", cursor: "pointer" }}
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {y}년
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="finance-nav-btn"
          onClick={copyFromLastYear}
          style={{
            height: 32,
            fontSize: 11,
            padding: "0 12px",
            borderRadius: 6,
            background: "#f5f6f8",
            color: "#555",
            border: `1px solid ${BORDER}`,
            cursor: "pointer",
            outline: "none",
            boxShadow: "none",
            fontWeight: 600,
          }}
        >
          전년도 복사
        </button>
        <button
          type="button"
          className="finance-nav-btn"
          onClick={handleSave}
          disabled={saving}
          style={{
            height: 32,
            fontSize: 11,
            padding: "0 12px",
            borderRadius: 6,
            background: NAVY,
            color: "#fff",
            border: "none",
            cursor: saving ? "not-allowed" : "pointer",
            outline: "none",
            boxShadow: "none",
            fontWeight: 600,
            opacity: saving ? 0.65 : 1,
          }}
        >
          {saving ? "저장 중..." : "저장"}
        </button>
      </div>

      <div style={{ background: "#fff", borderRadius: 8, border: `1px solid ${BORDER}`, overflow: "hidden" }}>
        <h3 style={{ margin: 0, padding: "10px 12px", fontSize: 13, fontWeight: 700, color: NAVY, borderBottom: `1px solid ${ROW_LINE}` }}>수입 예산</h3>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ ...bmTh("left"), minWidth: 96 }}>항목</th>
                {MONTHS.map((m) => (
                  <th key={m} style={{ ...bmTh("right"), minWidth: 72 }}>
                    {m}월
                  </th>
                ))}
                <th style={bmTh("right")}>연간합계</th>
              </tr>
            </thead>
            <tbody>
              {incomeRows.map((row, ri) => {
                const even = ri % 2 === 1;
                return (
                  <tr key={row.category}>
                    <td style={bmTd(even, "left")}>{row.category}</td>
                    {MONTHS.map((m) => (
                      <td key={m} style={bmTd(even, "right")}>
                        <input
                          type="number"
                          min={0}
                          value={row.amounts[m] || ""}
                          onChange={(e) => updateIncomeAmount(ri, m, Number(e.target.value) || 0)}
                          style={inputCompact}
                        />
                      </td>
                    ))}
                    <td style={bmTotalTd("right")}>{fmt(Object.values(row.amounts).reduce((s, v) => s + v, 0))}</td>
                  </tr>
                );
              })}
              <tr>
                <td style={bmTotalTd("left")}>수입 합계</td>
                {MONTHS.map((m) => (
                  <td key={m} style={bmTotalTd("right")}>
                    {fmt(incomeTotals.byMonth[m])}
                  </td>
                ))}
                <td style={bmTotalTd("right")}>{fmt(incomeTotals.annual)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ background: "#fff", borderRadius: 8, border: `1px solid ${BORDER}`, overflow: "hidden" }}>
        <h3 style={{ margin: 0, padding: "10px 12px", fontSize: 13, fontWeight: 700, color: NAVY, borderBottom: `1px solid ${ROW_LINE}` }}>지출 예산</h3>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ ...bmTh("left"), minWidth: 96 }}>항목</th>
                {MONTHS.map((m) => (
                  <th key={m} style={{ ...bmTh("right"), minWidth: 72 }}>
                    {m}월
                  </th>
                ))}
                <th style={bmTh("right")}>연간합계</th>
              </tr>
            </thead>
            <tbody>
              {expenseRows.map((row, ri) => {
                const even = ri % 2 === 1;
                return (
                  <tr key={row.category}>
                    <td style={bmTd(even, "left")}>{row.category}</td>
                    {MONTHS.map((m) => (
                      <td key={m} style={bmTd(even, "right")}>
                        <input
                          type="number"
                          min={0}
                          value={row.amounts[m] || ""}
                          onChange={(e) => updateExpenseAmount(ri, m, Number(e.target.value) || 0)}
                          style={inputCompact}
                        />
                      </td>
                    ))}
                    <td style={bmTotalTd("right")}>{fmt(Object.values(row.amounts).reduce((s, v) => s + v, 0))}</td>
                  </tr>
                );
              })}
              <tr>
                <td style={bmTotalTd("left")}>지출 합계</td>
                {MONTHS.map((m) => (
                  <td key={m} style={bmTotalTd("right")}>
                    {fmt(expenseTotals.byMonth[m])}
                  </td>
                ))}
                <td style={bmTotalTd("right")}>{fmt(expenseTotals.annual)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ background: "#fff", borderRadius: 8, border: `1px solid ${BORDER}`, padding: "12px 14px" }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: NAVY }}>
          수지 차액 (수입 - 지출): <span style={{ color: NAVY }}>{fmt(balance)}</span>
        </div>
      </div>
    </div>
  );
}
