"use client";

import { useMemo, useState } from "react";
import type { CashJournalEntry } from "@/types/db";

const NAVY = "#1e3a5f";
const CORAL = "#e74c3c";
const fmt = (n: number) => new Intl.NumberFormat("ko-KR").format(n);

interface IncomeLike { id: string; date: string; amount: number; type?: string; donor?: string; method?: string; memo?: string; payment_method?: string; }
interface ExpenseLike { id: string; date: string; amount: number; category?: string; item?: string; memo?: string; payment_method?: string; }

export interface CashJournalProps {
  income: IncomeLike[];
  expense: ExpenseLike[];
  typeFilter?: "all" | "수입" | "지출";
  onExportExcel?: (entries: CashJournalEntry[]) => void;
  onExportPdf?: (entries: CashJournalEntry[]) => void;
}

export function CashJournal({ income, expense, typeFilter: typeFilterProp, onExportExcel, onExportPdf }: CashJournalProps) {
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [typeFilter, setTypeFilter] = useState<"all" | "수입" | "지출">(typeFilterProp ?? "all");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("");

  const entries = useMemo(() => {
    const list: CashJournalEntry[] = [];
    income.forEach((i) => {
      if (i.date >= startDate && i.date <= endDate) {
        list.push({
          id: i.id,
          date: i.date,
          type: "수입",
          category: i.type ?? "",
          description: i.donor ?? "",
          amount: i.amount,
          payment_method: i.payment_method ?? i.method ?? "현금",
          memo: i.memo,
        });
      }
    });
    expense.forEach((e) => {
      if (e.date >= startDate && e.date <= endDate) {
        list.push({
          id: e.id,
          date: e.date,
          type: "지출",
          category: e.category ?? "",
          description: e.item ?? "",
          amount: e.amount,
          payment_method: e.payment_method ?? "현금",
          memo: e.memo,
        });
      }
    });
    list.sort((a, b) => {
      const d = a.date.localeCompare(b.date);
      return d !== 0 ? d : (a.type === "수입" ? -1 : 1);
    });
    return list;
  }, [income, expense, startDate, endDate]);

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

  const handleExportExcel = () => {
    const rows = withBalance.map((e) => ({
      날짜: e.date,
      유형: e.type,
      카테고리: e.category,
      적요: e.description,
      수입: e.type === "수입" ? e.amount : "",
      지출: e.type === "지출" ? e.amount : "",
      잔액: e.balance,
      결제수단: e.payment_method ?? "",
    }));
    if (onExportExcel) onExportExcel(filtered);
    else {
      const csv = ["날짜,유형,카테고리,적요,수입,지출,잔액,결제수단"].concat(
        rows.map((r) => `"${r.날짜}","${r.유형}","${r.카테고리}","${(r.적요 as string).replace(/"/g, '""')}",${r.수입},${r.지출},${r.잔액},"${r.결제수단}"`)
      ).join("\n");
      const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `현금출납장_${startDate}_${endDate}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <div className="flex flex-wrap items-center gap-4 mb-4">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-600">시작일</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="px-3 py-2 rounded-lg border border-gray-200 text-sm" />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-600">종료일</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="px-3 py-2 rounded-lg border border-gray-200 text-sm" />
          </div>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as "all" | "수입" | "지출")} className="px-3 py-2 rounded-lg border border-gray-200 text-sm">
            <option value="all">전체</option>
            <option value="수입">수입</option>
            <option value="지출">지출</option>
          </select>
          {categories.length > 0 && (
            <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="px-3 py-2 rounded-lg border border-gray-200 text-sm">
              <option value="">카테고리 전체</option>
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          )}
          {paymentMethods.length > 0 && (
            <select value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value)} className="px-3 py-2 rounded-lg border border-gray-200 text-sm">
              <option value="">결제수단 전체</option>
              {paymentMethods.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          )}
          <button type="button" onClick={handleExportExcel} className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium hover:bg-gray-50">
            Excel
          </button>
          {onExportPdf && (
            <button type="button" onClick={() => onExportPdf(filtered)} className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium hover:bg-gray-50">
              PDF
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left py-3 px-3 font-semibold text-gray-700">날짜</th>
                <th className="text-left py-3 px-3 font-semibold text-gray-700">유형</th>
                <th className="text-left py-3 px-3 font-semibold text-gray-700">카테고리</th>
                <th className="text-left py-3 px-3 font-semibold text-gray-700">적요</th>
                <th className="text-right py-3 px-3 font-semibold text-gray-700">수입</th>
                <th className="text-right py-3 px-3 font-semibold text-gray-700">지출</th>
                <th className="text-right py-3 px-3 font-semibold text-gray-700">잔액</th>
                <th className="text-left py-3 px-3 font-semibold text-gray-700">결제수단</th>
              </tr>
            </thead>
            <tbody>
              {withBalance.length === 0 ? (
                <tr><td colSpan={8} className="py-12 text-center text-gray-500">데이터가 없습니다.</td></tr>
              ) : (
                withBalance.map((e) => (
                  <tr key={e.id} className="border-b border-gray-100 hover:bg-gray-50/50">
                    <td className="py-2 px-3 whitespace-nowrap">{e.date}</td>
                    <td className="py-2 px-3">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${e.type === "수입" ? "bg-blue-100 text-blue-800" : "bg-red-100 text-red-800"}`}>
                        {e.type}
                      </span>
                    </td>
                    <td className="py-2 px-3">{e.category}</td>
                    <td className="py-2 px-3 max-w-[200px] truncate" title={e.description}>{e.description}</td>
                    <td className="py-2 px-3 text-right font-medium" style={{ color: e.type === "수입" ? NAVY : undefined }}>
                      {e.type === "수입" ? `₩${fmt(e.amount)}` : "-"}
                    </td>
                    <td className="py-2 px-3 text-right font-medium" style={{ color: e.type === "지출" ? CORAL : undefined }}>
                      {e.type === "지출" ? `₩${fmt(e.amount)}` : "-"}
                    </td>
                    <td className="py-2 px-3 text-right font-medium">{fmt(e.balance!)}</td>
                    <td className="py-2 px-3 text-gray-600">{e.payment_method ?? "-"}</td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot>
              <tr className="bg-gray-100 font-semibold border-t-2 border-gray-200">
                <td colSpan={4} className="py-3 px-3">합계</td>
                <td className="py-3 px-3 text-right" style={{ color: NAVY }}>₩{fmt(totalIncome)}</td>
                <td className="py-3 px-3 text-right" style={{ color: CORAL }}>₩{fmt(totalExpense)}</td>
                <td className="py-3 px-3 text-right">{fmt(finalBalance)}</td>
                <td className="py-3 px-3" />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
