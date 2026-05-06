"use client";

import { useState, useMemo, useEffect, type CSSProperties, type ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import { getChurchId } from "@/lib/tenant";
import type { Budget } from "@/types/db";
import {
  budgetYearToolbarRowStyle,
  budgetYearLabelStyle,
  budgetYearSelectStyle,
} from "@/components/finance/budgetYearToolbarStyles";

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);
const fmt = (n: number) => new Intl.NumberFormat("ko-KR").format(n);

/** 월별 입력: 숫자만 state, 화면은 천 단위 콤마 */
function parseBudgetAmountInput(raw: string): number {
  const digits = raw.replace(/\D/g, "");
  if (digits === "") return 0;
  const n = Number.parseInt(digits, 10);
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
}

function formatBudgetAmountInput(n: number): string {
  return n.toLocaleString("ko-KR");
}

const BUDGET_COL_ITEM_PX = 80;
const BUDGET_COL_ANNUAL_PX = 130;
const BUDGET_TABLE_COLGROUP = (
  <colgroup>
    <col style={{ width: BUDGET_COL_ITEM_PX }} />
    <col span={12} />
    <col style={{ width: BUDGET_COL_ANNUAL_PX }} />
  </colgroup>
);

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

const bmTh = (align: "left" | "right" | "center", mob = true): CSSProperties => ({
  fontSize: mob ? 10 : 13,
  fontWeight: 700,
  color: NAVY,
  padding: mob ? "6px 8px" : "10px 14px",
  borderBottom: `2px solid ${NAVY}`,
  background: "var(--color-surface)",
  textAlign: align,
  whiteSpace: "nowrap",
});

const bmTd = (isEven: boolean, align: "left" | "right" | "center", mob = true): CSSProperties => ({
  fontSize: mob ? 11 : 14,
  color: "var(--color-text-muted)",
  padding: mob ? "8px" : "12px 14px",
  borderBottom: `1px solid ${ROW_LINE}`,
  background: isEven ? "#fafbfc" : "#fff",
  textAlign: align,
});

const bmTotalTd = (align: "left" | "right" | "center", mob = true): CSSProperties => ({
  fontSize: mob ? 11 : 14,
  fontWeight: 700,
  color: NAVY,
  padding: mob ? "8px" : "12px 14px",
  background: "var(--color-border-soft)",
  borderBottom: `1px solid ${ROW_LINE}`,
  textAlign: align,
});

const BM_STICKY_HEADER_BG = "#f1f3f5";

/** 첫 열(항목) — sticky 좌측 */
const bmThStickyItem = (mob: boolean): CSSProperties => ({
  ...bmTh("left", mob),
  minWidth: BUDGET_COL_ITEM_PX,
  width: BUDGET_COL_ITEM_PX,
  position: "sticky",
  left: 0,
  background: BM_STICKY_HEADER_BG,
  zIndex: 2,
});

const bmTdStickyItem = (isEven: boolean, mob: boolean): CSSProperties => ({
  ...bmTd(isEven, "left", mob),
  minWidth: BUDGET_COL_ITEM_PX,
  width: BUDGET_COL_ITEM_PX,
  position: "sticky",
  left: 0,
  background: isEven ? "#fafbfc" : "#fff",
  zIndex: 2,
});

const bmTotalTdStickyItem = (mob: boolean): CSSProperties => ({
  ...bmTotalTd("left", mob),
  minWidth: BUDGET_COL_ITEM_PX,
  width: BUDGET_COL_ITEM_PX,
  position: "sticky",
  left: 0,
  zIndex: 2,
});

/** 연간합계 열 — sticky 우측 */
const bmThStickyAnnual = (mob: boolean): CSSProperties => ({
  ...bmTh("right", mob),
  minWidth: BUDGET_COL_ANNUAL_PX,
  width: BUDGET_COL_ANNUAL_PX,
  textAlign: "right",
  whiteSpace: "nowrap",
  position: "sticky",
  right: 0,
  background: BM_STICKY_HEADER_BG,
  zIndex: 2,
  boxShadow: "-2px 0 4px rgba(0,0,0,0.05)",
});

const bmTdStickyAnnual = (isEven: boolean, mob: boolean): CSSProperties => ({
  ...bmTd(isEven, "right", mob),
  minWidth: BUDGET_COL_ANNUAL_PX,
  width: BUDGET_COL_ANNUAL_PX,
  textAlign: "right",
  whiteSpace: "nowrap",
  position: "sticky",
  right: 0,
  background: isEven ? "#fafbfc" : "#fff",
  zIndex: 2,
  boxShadow: "-2px 0 4px rgba(0,0,0,0.05)",
});

const bmTotalTdStickyAnnual = (mob: boolean): CSSProperties => ({
  ...bmTotalTd("right", mob),
  minWidth: BUDGET_COL_ANNUAL_PX,
  width: BUDGET_COL_ANNUAL_PX,
  whiteSpace: "nowrap",
  position: "sticky",
  right: 0,
  zIndex: 2,
  boxShadow: "-2px 0 4px rgba(0,0,0,0.05)",
});

const bmThMonth = (mob: boolean): CSSProperties => ({
  ...bmTh("right", mob),
  overflow: "hidden",
});

const bmTdMonth = (isEven: boolean, mob: boolean): CSSProperties => ({
  ...bmTd(isEven, "right", mob),
  overflow: "hidden",
  verticalAlign: "middle",
});

const inputCompactStyle = (mob: boolean): CSSProperties => ({
  width: "100%",
  maxWidth: "100%",
  minWidth: 0,
  boxSizing: "border-box",
  height: mob ? 28 : 36,
  padding: mob ? "0 6px" : "0 10px",
  fontSize: mob ? 11 : 13,
  textAlign: "right",
  borderRadius: mob ? 4 : 6,
  border: `1px solid ${BORDER}`,
  outline: "none",
  boxShadow: "none",
  background: "var(--color-surface)",
  color: "var(--color-text-muted)",
  overflow: "hidden",
  textOverflow: "ellipsis",
});

const DEFAULT_INCOME_CATEGORIES = ["십일조", "감사헌금", "주일헌금", "건축헌금", "선교헌금", "기타수입"];
const DEFAULT_EXPENSE_CATEGORIES = ["인건비", "사역비", "관리비", "선교비", "교육비", "행사비", "기타지출"];

export interface BudgetManagementProps {
  /** 초기 회계연도 (기본: 현재 연도) */
  fiscalYear?: string;
  /** 토스트 메시지 */
  toast: (msg: string, type?: "ok" | "err" | "warn") => void;
  /** 재정 탭과 같은 sticky 밴드에 연도/저장 줄을 넣을 때 (로딩 중에는 null) */
  stickyNavBand?: (toolbar: ReactNode) => ReactNode;
}

function toAmounts(monthly_amounts: Record<string, number> | null | undefined): Record<number, number> {
  return MONTHS.reduce((acc, m) => {
    acc[m] = Number((monthly_amounts || {})[String(m)]) || 0;
    return acc;
  }, {} as Record<number, number>);
}

export function BudgetManagement({ fiscalYear = String(new Date().getFullYear()), toast, stickyNavBand }: BudgetManagementProps) {
  const mob = useIsMobile();
  const [year, setYear] = useState(fiscalYear);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [incomeRows, setIncomeRows] = useState<{ category: string; amounts: Record<number, number> }[]>([]);
  const [expenseRows, setExpenseRows] = useState<{ category: string; amounts: Record<number, number> }[]>([]);

  const loadBudget = async (selectedYear: string, isCancelled: () => boolean) => {
    const aborted = () => isCancelled();

    if (!supabase) {
      if (aborted()) return;
      setLoading(false);
      setIncomeRows(DEFAULT_INCOME_CATEGORIES.map((cat) => ({ category: cat, amounts: MONTHS.reduce((acc, m) => ({ ...acc, [m]: 0 }), {} as Record<number, number>) })));
      setExpenseRows(DEFAULT_EXPENSE_CATEGORIES.map((cat) => ({ category: cat, amounts: MONTHS.reduce((acc, m) => ({ ...acc, [m]: 0 }), {} as Record<number, number>) })));
      return;
    }
    if (aborted()) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("budget")
      .select("*")
      .eq("church_id", getChurchId())
      .eq("fiscal_year", selectedYear)
      .order("category_type", { ascending: true })
      .order("category", { ascending: true });
    if (aborted()) return;
    if (error) {
      console.error(error);
      if (aborted()) return;
      toast("데이터 로드 실패: " + error.message, "err");
      setIncomeRows(DEFAULT_INCOME_CATEGORIES.map((cat) => ({ category: cat, amounts: toAmounts({}) })));
      setExpenseRows(DEFAULT_EXPENSE_CATEGORIES.map((cat) => ({ category: cat, amounts: toAmounts({}) })));
      setLoading(false);
      return;
    }
    if (aborted()) return;
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
    if (!aborted()) setLoading(false);
  };

  useEffect(() => {
    let cancelled = false;
    const isCancelled = () => cancelled;
    void loadBudget(year, isCancelled);
    return () => {
      cancelled = true;
    };
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
    const loadingBody = (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "48px 16px", color: "var(--color-text-muted)", fontSize: 13 }}>
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
    if (stickyNavBand) {
      return (
        <>
          {stickyNavBand(null)}
          {loadingBody}
        </>
      );
    }
    return loadingBody;
  }

  const yearOptions = Array.from({ length: 11 }, (_, i) => String(2020 + i));

  const btnH = mob ? 34 : 38;
  const btnFs = mob ? 13 : 14;
  const btnBr = mob ? 8 : 10;
  const toolbarRow = (
    <div
      style={{
        ...budgetYearToolbarRowStyle(),
        width: "100%",
        alignItems: "center",
        alignContent: "flex-start",
        ...(stickyNavBand ? { marginTop: mob ? 6 : 8 } : {}),
      }}
    >
      <span style={budgetYearLabelStyle(mob)}>연도</span>
      <select value={year} onChange={(e) => setYear(e.target.value)} style={budgetYearSelectStyle(mob)}>
        {yearOptions.map((y) => (
          <option key={y} value={y}>
            {y}년
          </option>
        ))}
      </select>
      <button
        type="button"
        className="finance-nav-btn"
        onClick={copyFromLastYear}
        style={{
          height: btnH,
          fontSize: btnFs,
          padding: mob ? "0 10px" : "0 14px",
          borderRadius: btnBr,
          background: "var(--color-primary-soft)",
          color: "var(--color-text-muted)",
          border: "1.5px solid #e0e3ea",
          cursor: "pointer",
          outline: "none",
          boxShadow: "none",
          fontWeight: 600,
          fontFamily: "inherit",
          boxSizing: "border-box",
          flexShrink: 0,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          whiteSpace: "nowrap",
        }}
      >
        전년도 복사
      </button>
      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        style={{
          height: 38,
          fontSize: 14,
          padding: "0 20px",
          borderRadius: 10,
          background: "var(--color-primary)",
          color: "#fff",
          border: "none",
          cursor: saving ? "not-allowed" : "pointer",
          outline: "none",
          boxShadow: "none",
          fontWeight: 600,
          fontFamily: "inherit",
          boxSizing: "border-box",
          opacity: saving ? 0.65 : 1,
          flexShrink: 0,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          whiteSpace: "nowrap",
          WebkitTapHighlightColor: "transparent",
        }}
      >
        {saving ? "저장 중..." : "저장"}
      </button>
    </div>
  );

  const bodyBlocks = (
    <>
      <div style={{ background: "var(--color-surface)", borderRadius: mob ? 8 : 16, border: `1px solid ${BORDER}`, overflow: "hidden" }}>
        <h3
          style={{
            margin: 0,
            padding: mob ? "10px 12px" : "14px 18px",
            fontSize: mob ? 13 : 16,
            fontWeight: 700,
            color: NAVY,
            borderBottom: `1px solid ${ROW_LINE}`,
          }}
        >
          수입 예산
        </h3>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", tableLayout: "fixed", borderCollapse: "collapse" }}>
            {BUDGET_TABLE_COLGROUP}
            <thead>
              <tr>
                <th style={bmThStickyItem(mob)}>항목</th>
                {MONTHS.map((m) => (
                  <th key={m} style={bmThMonth(mob)}>
                    {m}월
                  </th>
                ))}
                <th style={bmThStickyAnnual(mob)}>연간합계</th>
              </tr>
            </thead>
            <tbody>
              {incomeRows.map((row, ri) => {
                const even = ri % 2 === 1;
                return (
                  <tr key={row.category}>
                    <td style={bmTdStickyItem(even, mob)}>{row.category}</td>
                    {MONTHS.map((m) => (
                      <td key={m} style={bmTdMonth(even, mob)}>
                        <input
                          type="text"
                          inputMode="numeric"
                          autoComplete="off"
                          value={formatBudgetAmountInput(row.amounts[m] ?? 0)}
                          onChange={(e) => updateIncomeAmount(ri, m, parseBudgetAmountInput(e.target.value))}
                          style={inputCompactStyle(mob)}
                        />
                      </td>
                    ))}
                    <td style={bmTdStickyAnnual(even, mob)}>{fmt(Object.values(row.amounts).reduce((s, v) => s + v, 0))}</td>
                  </tr>
                );
              })}
              <tr>
                <td style={bmTotalTdStickyItem(mob)}>수입 합계</td>
                {MONTHS.map((m) => (
                  <td key={m} style={{ ...bmTotalTd("right", mob), overflow: "hidden" }}>
                    {fmt(incomeTotals.byMonth[m])}
                  </td>
                ))}
                <td style={bmTotalTdStickyAnnual(mob)}>{fmt(incomeTotals.annual)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ background: "var(--color-surface)", borderRadius: mob ? 8 : 16, border: `1px solid ${BORDER}`, overflow: "hidden" }}>
        <h3
          style={{
            margin: 0,
            padding: mob ? "10px 12px" : "14px 18px",
            fontSize: mob ? 13 : 16,
            fontWeight: 700,
            color: NAVY,
            borderBottom: `1px solid ${ROW_LINE}`,
          }}
        >
          지출 예산
        </h3>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", tableLayout: "fixed", borderCollapse: "collapse" }}>
            {BUDGET_TABLE_COLGROUP}
            <thead>
              <tr>
                <th style={bmThStickyItem(mob)}>항목</th>
                {MONTHS.map((m) => (
                  <th key={m} style={bmThMonth(mob)}>
                    {m}월
                  </th>
                ))}
                <th style={bmThStickyAnnual(mob)}>연간합계</th>
              </tr>
            </thead>
            <tbody>
              {expenseRows.map((row, ri) => {
                const even = ri % 2 === 1;
                return (
                  <tr key={row.category}>
                    <td style={bmTdStickyItem(even, mob)}>{row.category}</td>
                    {MONTHS.map((m) => (
                      <td key={m} style={bmTdMonth(even, mob)}>
                        <input
                          type="text"
                          inputMode="numeric"
                          autoComplete="off"
                          value={formatBudgetAmountInput(row.amounts[m] ?? 0)}
                          onChange={(e) => updateExpenseAmount(ri, m, parseBudgetAmountInput(e.target.value))}
                          style={inputCompactStyle(mob)}
                        />
                      </td>
                    ))}
                    <td style={bmTdStickyAnnual(even, mob)}>{fmt(Object.values(row.amounts).reduce((s, v) => s + v, 0))}</td>
                  </tr>
                );
              })}
              <tr>
                <td style={bmTotalTdStickyItem(mob)}>지출 합계</td>
                {MONTHS.map((m) => (
                  <td key={m} style={{ ...bmTotalTd("right", mob), overflow: "hidden" }}>
                    {fmt(expenseTotals.byMonth[m])}
                  </td>
                ))}
                <td style={bmTotalTdStickyAnnual(mob)}>{fmt(expenseTotals.annual)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ background: "var(--color-surface)", borderRadius: mob ? 8 : 16, border: `1px solid ${BORDER}`, padding: mob ? "12px 14px" : "18px 24px" }}>
        <div style={{ fontSize: mob ? 14 : 18, fontWeight: 700, color: NAVY }}>
          수지 차액 (수입 - 지출): <span style={{ color: NAVY }}>{fmt(balance)}</span>
        </div>
      </div>
    </>
  );

  if (stickyNavBand) {
    return (
      <>
        {stickyNavBand(toolbarRow)}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>{bodyBlocks}</div>
      </>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {toolbarRow}
      {bodyBlocks}
    </div>
  );
}
