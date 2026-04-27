"use client";

import { useMemo, useState, useEffect, useCallback, type CSSProperties } from "react";
import { supabase } from "@/lib/supabase";
import type { CashJournalEntry } from "@/types/db";
import type { Income } from "@/types/db";
import type { Expense } from "@/types/db";

const NAVY = "#2563eb";
const BORDER = "#e2e5ef";
const ROW = "#f0f2f5";
const TEXT = "#555";
const MUTED = "#999";
const SUB = "#6b7b9e";
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

/** DB 카테고리 코드 → 한글 (현금출납장 표시용) */
const CATEGORY_KO: Record<string, string> = {
  tithe: "십일조",
  sunday: "주일헌금",
  thanks: "감사헌금",
  building: "건축헌금",
  mission: "선교헌금",
  other: "기타",
  salary: "인건비",
  rent: "임대료/관리비",
  utility: "공과금",
  supply: "비품/소모품",
  event: "행사비",
  mission_exp: "선교비",
  education_exp: "교육비",
  maintenance: "시설유지비",
  transport: "교통비",
  food: "식비/다과",
  other_exp: "기타지출",
};

function displayCategory(c: string) {
  if (!c) return "-";
  return CATEGORY_KO[c] ?? c;
}

export interface CashJournalProps {
  toast: (msg: string, type?: "ok" | "err" | "warn") => void;
  typeFilter?: "all" | "수입" | "지출";
  onExportExcel?: (entries: CashJournalEntry[]) => void;
  onExportPdf?: (entries: CashJournalEntry[]) => void;
}

function toEntryFromIncome(i: Income): CashJournalEntry {
  return {
    id: i.id,
    date: i.date,
    type: "수입",
    category: i.type ?? "",
    description: i.donor ?? "",
    amount: i.amount,
    payment_method: i.payment_method ?? i.method ?? "현금",
    memo: i.memo,
  };
}

function toEntryFromExpense(e: Expense): CashJournalEntry {
  return {
    id: e.id,
    date: e.date,
    type: "지출",
    category: e.category ?? "",
    description: e.item ?? "",
    amount: e.amount,
    payment_method: e.payment_method ?? "현금",
    memo: e.memo,
  };
}

const selStyle = (mob: boolean): CSSProperties => ({
  height: mob ? 32 : 40,
  fontSize: mob ? 11 : 14,
  borderRadius: mob ? 6 : 10,
  border: `1px solid ${BORDER}`,
  padding: mob ? "0 8px" : "0 14px",
  background: "#fff",
  color: TEXT,
});

export function CashJournal({ toast, typeFilter: typeFilterProp, onExportPdf }: CashJournalProps) {
  const mob = useIsMobile();
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [typeFilter, setTypeFilter] = useState<"all" | "수입" | "지출">(typeFilterProp ?? "all");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("");
  const [entries, setEntries] = useState<CashJournalEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!supabase) {
      setEntries([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data: viewData, error: viewError } = await supabase
      .from("cash_journal")
      .select("*")
      .gte("date", startDate)
      .lte("date", endDate)
      .order("date", { ascending: true });

    if (!viewError && viewData && viewData.length >= 0) {
      setEntries((viewData as CashJournalEntry[]).map((e) => ({
        id: e.id,
        date: e.date,
        type: e.type,
        category: e.category ?? "",
        description: e.description ?? "",
        amount: e.amount,
        payment_method: e.payment_method,
        memo: e.memo,
      })));
      setLoading(false);
      return;
    }

    const { data: incomes, error: incErr } = await supabase
      .from("income")
      .select("*")
      .gte("date", startDate)
      .lte("date", endDate);
    const { data: expenses, error: expErr } = await supabase
      .from("expense")
      .select("*")
      .gte("date", startDate)
      .lte("date", endDate);

    if (incErr || expErr) {
      console.error(incErr || expErr);
      toast("데이터 로드 실패: " + (incErr?.message || expErr?.message), "err");
      setEntries([]);
      setLoading(false);
      return;
    }

    const list: CashJournalEntry[] = [
      ...(incomes ?? []).map((i) => toEntryFromIncome(i as Income)),
      ...(expenses ?? []).map((e) => toEntryFromExpense(e as Expense)),
    ];
    list.sort((a, b) => {
      const d = a.date.localeCompare(b.date);
      return d !== 0 ? d : (a.type === "수입" ? -1 : 1);
    });
    setEntries(list);
    setLoading(false);
  }, [startDate, endDate, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filtered = useMemo(() => {
    let r = entries;
    if (typeFilter === "수입") r = r.filter((e) => e.type === "수입");
    if (typeFilter === "지출") r = r.filter((e) => e.type === "지출");
    if (categoryFilter) r = r.filter((e) => e.category === categoryFilter);
    if (paymentFilter) r = r.filter((e) => (e.payment_method ?? "") === paymentFilter);
    return r;
  }, [entries, typeFilter, categoryFilter, paymentFilter]);

  const withBalance = useMemo(() => {
    let balance = 0;
    return filtered.map((e) => {
      if (e.type === "수입") balance += e.amount;
      else balance -= e.amount;
      return { ...e, balance };
    });
  }, [filtered]);

  const totalIncome = useMemo(() => filtered.filter((e) => e.type === "수입").reduce((s, e) => s + e.amount, 0), [filtered]);
  const totalExpense = useMemo(() => filtered.filter((e) => e.type === "지출").reduce((s, e) => s + e.amount, 0), [filtered]);
  const finalBalance = totalIncome - totalExpense;

  const categories = useMemo(() => Array.from(new Set(entries.map((e) => e.category).filter(Boolean))), [entries]);
  const paymentMethods = useMemo(() => Array.from(new Set(entries.map((e) => e.payment_method).filter(Boolean))), [entries]);

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 48, color: MUTED, fontSize: 12 }}>
        <span
          className="inline-block w-8 h-8 rounded-full animate-spin"
          style={{ border: `2px solid ${BORDER}`, borderTopColor: NAVY }}
        />
        <span style={{ marginLeft: 12 }}>현금출납장 로딩 중...</span>
      </div>
    );
  }

  const thPad = mob ? "6px 8px" : "10px 14px";
  const thFs = mob ? 10 : 13;
  const tdPad = mob ? 8 : "12px 14px";
  const tdFs = mob ? 11 : 14;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ background: "#fff", borderRadius: mob ? 8 : 16, border: `1px solid ${BORDER}`, padding: mob ? 12 : 20 }}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={{ ...selStyle(mob), flex: "0 0 auto" }} />
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={{ ...selStyle(mob), flex: "0 0 auto" }} />
        </div>
        <div style={{ marginBottom: 6 }}>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as "all" | "수입" | "지출")} style={{ ...selStyle(mob), width: "100%", maxWidth: 200 }}>
            <option value="all">전체</option>
            <option value="수입">수입</option>
            <option value="지출">지출</option>
          </select>
        </div>
        {categories.length > 0 && (
          <div style={{ marginBottom: 6 }}>
            <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} style={{ ...selStyle(mob), width: "100%", maxWidth: 320 }}>
              <option value="">카테고리 전체</option>
              {categories.map((c) => (
                <option key={c} value={c}>{displayCategory(c)}</option>
              ))}
            </select>
          </div>
        )}
        {paymentMethods.length > 0 && (
          <div style={{ marginBottom: 6 }}>
            <select value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value)} style={{ ...selStyle(mob), width: "100%", maxWidth: 320 }}>
              <option value="">결제수단 전체</option>
              {paymentMethods.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
        )}
        {onExportPdf && (
          <button type="button" onClick={() => onExportPdf(filtered)} style={{ height: mob ? 32 : 40, fontSize: mob ? 11 : 14, padding: mob ? "0 12px" : "0 18px", borderRadius: mob ? 6 : 10, border: `1px solid ${BORDER}`, background: "#f5f8ff", color: TEXT, cursor: "pointer" }}>
            PDF
          </button>
        )}
      </div>

      <div style={{ overflowX: "auto", background: "#fff", borderRadius: mob ? 8 : 16, border: `1px solid ${BORDER}` }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {["날짜", "유형", "카테고리", "적요", "수입", "지출", "잔액", "결제수단"].map((h) => (
                <th
                  key={h}
                  style={{
                    textAlign: h === "수입" || h === "지출" || h === "잔액" ? "right" : "left",
                    padding: thPad,
                    fontSize: thFs,
                    fontWeight: 700,
                    color: NAVY,
                    borderBottom: `2px solid ${NAVY}`,
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {withBalance.length === 0 ? (
              <tr><td colSpan={8} style={{ padding: 40, textAlign: "center", color: MUTED, fontSize: 12 }}>해당 기간 데이터가 없습니다.</td></tr>
            ) : (
              withBalance.map((e, ri) => (
                <tr key={e.id} style={{ borderBottom: `1px solid ${ROW}`, background: ri % 2 === 1 ? "#fafbfc" : "#fff" }}>
                  <td style={{ padding: tdPad, fontSize: tdFs, color: TEXT, whiteSpace: "nowrap" }}>{e.date}</td>
                  <td style={{ padding: tdPad, fontSize: tdFs, color: TEXT }}>{e.type}</td>
                  <td style={{ padding: tdPad, fontSize: tdFs, color: TEXT }}>{displayCategory(e.category)}</td>
                  <td style={{ padding: tdPad, fontSize: tdFs, color: TEXT, maxWidth: 200 }} title={e.description}>{e.description}</td>
                  <td style={{ padding: tdPad, fontSize: tdFs, textAlign: "right", color: TEXT }}>{e.type === "수입" ? `₩${fmt(e.amount)}` : "-"}</td>
                  <td style={{ padding: tdPad, fontSize: tdFs, textAlign: "right", color: TEXT }}>{e.type === "지출" ? `₩${fmt(e.amount)}` : "-"}</td>
                  <td style={{ padding: tdPad, fontSize: tdFs, textAlign: "right", color: TEXT }}>{fmt(e.balance!)}</td>
                  <td style={{ padding: tdPad, fontSize: tdFs, color: MUTED }}>{e.payment_method ?? "-"}</td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot>
            <tr style={{ background: "#f0f2f5", fontWeight: 700 }}>
              <td colSpan={4} style={{ padding: tdPad, fontSize: tdFs, color: TEXT }}>합계</td>
              <td style={{ padding: tdPad, fontSize: tdFs, textAlign: "right", color: TEXT }}>₩{fmt(totalIncome)}</td>
              <td style={{ padding: tdPad, fontSize: tdFs, textAlign: "right", color: TEXT }}>₩{fmt(totalExpense)}</td>
              <td style={{ padding: tdPad, fontSize: tdFs, textAlign: "right", color: NAVY }}>{fmt(finalBalance)}</td>
              <td style={{ padding: tdPad }} />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
