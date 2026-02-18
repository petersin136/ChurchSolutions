"use client";

import { useState } from "react";
import type { SpecialAccount, SpecialAccountTransaction } from "@/types/db";

const fmt = (n: number) => new Intl.NumberFormat("ko-KR").format(n);
const STATUS_LABEL: Record<string, string> = { 진행중: "진행중", 달성: "달성", 종료: "종료", 보류: "보류" };

export interface SpecialAccountsProps {
  accounts: SpecialAccount[];
  transactions: Record<string, SpecialAccountTransaction[]>;
  onAddAccount?: () => void;
  onEditAccount?: (id: string) => void;
  onAddTransaction?: (accountId: string) => void;
}

export function SpecialAccounts({
  accounts,
  transactions,
  onAddAccount,
  onEditAccount,
  onAddTransaction,
}: SpecialAccountsProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = selectedId ? accounts.find((a) => a.id === selectedId) : null;
  const selectedTx = selectedId ? (transactions[selectedId] || []).slice().sort((a, b) => b.date.localeCompare(a.date)) : [];

  const progressColor = (pct: number) => {
    if (pct >= 100) return "bg-[#1e3a5f]";
    if (pct >= 80) return "bg-green-500";
    if (pct >= 50) return "bg-yellow-500";
    return "bg-red-500";
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-[#1e3a5f]">특별회계</h3>
        {onAddAccount && (
          <button type="button" onClick={onAddAccount} className="px-4 py-2 rounded-xl bg-[#1e3a5f] text-white text-sm font-semibold hover:opacity-90">
            + 새 특별회계
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {accounts.map((acc) => {
          const pct = acc.target_amount > 0 ? Math.min(100, Math.round((acc.current_amount / acc.target_amount) * 100)) : 0;
          return (
            <button
              key={acc.id}
              type="button"
              onClick={() => setSelectedId(acc.id)}
              className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 text-left hover:shadow-md transition"
            >
              <div className="font-semibold text-[#1e3a5f] mb-1">{acc.account_name}</div>
              {acc.description && <div className="text-xs text-gray-500 mb-2">{acc.description}</div>}
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-500">목표</span>
                <span className="font-medium">₩{fmt(acc.target_amount)}</span>
              </div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-500">현재</span>
                <span className="font-medium">₩{fmt(acc.current_amount)}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                <div className={`h-full rounded-full ${progressColor(pct)}`} style={{ width: `${Math.min(100, pct)}%` }} />
              </div>
              <div className="mt-2 flex justify-between text-xs">
                <span>{pct}%</span>
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                  acc.status === "달성" ? "bg-green-100 text-green-800" :
                  acc.status === "종료" ? "bg-gray-100 text-gray-700" :
                  "bg-blue-100 text-blue-800"
                }`}>{STATUS_LABEL[acc.status] || acc.status}</span>
              </div>
            </button>
          );
        })}
      </div>

      {selected && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h4 className="text-lg font-semibold text-[#1e3a5f]">{selected.account_name}</h4>
              {selected.description && <p className="text-sm text-gray-500 mt-1">{selected.description}</p>}
            </div>
            <div className="flex gap-2">
              {onEditAccount && <button type="button" onClick={() => onEditAccount(selected.id)} className="px-3 py-1 rounded-lg border border-gray-200 text-sm">수정</button>}
              {onAddTransaction && <button type="button" onClick={() => onAddTransaction(selected.id)} className="px-3 py-1 rounded-lg bg-[#1e3a5f] text-white text-sm">+ 거래 추가</button>}
              <button type="button" onClick={() => setSelectedId(null)} className="px-3 py-1 rounded-lg border border-gray-200 text-sm">닫기</button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="bg-gray-50 border-b"><th className="text-left py-2 px-3">날짜</th><th className="text-left py-2 px-3">유형</th><th className="text-right py-2 px-3">금액</th><th className="text-left py-2 px-3">설명</th><th className="text-left py-2 px-3">헌금자</th></tr></thead>
              <tbody>
                {selectedTx.length === 0 ? (
                  <tr><td colSpan={5} className="py-8 text-center text-gray-500">거래 내역이 없습니다.</td></tr>
                ) : (
                  selectedTx.map((tx) => (
                    <tr key={tx.id} className="border-b border-gray-100">
                      <td className="py-2 px-3">{tx.date}</td>
                      <td className="py-2 px-3"><span className={tx.type === "수입" ? "text-blue-600" : "text-red-600"}>{tx.type}</span></td>
                      <td className="py-2 px-3 text-right font-medium">{tx.type === "지출" ? "(" : ""}₩{fmt(tx.amount)}{tx.type === "지출" ? ")" : ""}</td>
                      <td className="py-2 px-3">{tx.description ?? "-"}</td>
                      <td className="py-2 px-3">{tx.member_name ?? "-"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
