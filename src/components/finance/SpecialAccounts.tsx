"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import type { SpecialAccount, SpecialAccountTransaction } from "@/types/db";

const fmt = (n: number) => new Intl.NumberFormat("ko-KR").format(n);
const STATUS_LABEL: Record<string, string> = { 진행중: "진행중", 달성: "달성", 종료: "종료", 보류: "보류" };
const STATUS_OPTIONS: SpecialAccount["status"][] = ["진행중", "달성", "종료", "보류"];

export interface SpecialAccountsProps {
  toast: (msg: string, type?: "ok" | "err" | "warn") => void;
}

const emptyAccount = (): Partial<SpecialAccount> => ({
  account_name: "",
  description: "",
  target_amount: 0,
  current_amount: 0,
  start_date: "",
  end_date: "",
  status: "진행중",
});

export function SpecialAccounts({ toast }: SpecialAccountsProps) {
  const [accounts, setAccounts] = useState<SpecialAccount[]>([]);
  const [transactions, setTransactions] = useState<Record<string, SpecialAccountTransaction[]>>({});
  const [loading, setLoading] = useState(true);
  const [txLoading, setTxLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState<SpecialAccount | null>(null);
  const [accountForm, setAccountForm] = useState<Partial<SpecialAccount>>(emptyAccount());
  const [showTxModal, setShowTxModal] = useState(false);
  const [txForm, setTxForm] = useState({ date: new Date().toISOString().slice(0, 10), type: "수입" as "수입" | "지출", amount: 0, description: "", member_name: "" });
  const [saving, setSaving] = useState(false);

  const loadAccounts = async () => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.from("special_accounts").select("*").order("created_at", { ascending: false });
    if (error) {
      console.error(error);
      toast("데이터 로드 실패: " + error.message, "err");
      setAccounts([]);
    } else {
      setAccounts((data ?? []) as SpecialAccount[]);
    }
    setLoading(false);
  };

  const loadTransactions = async (accountId: string) => {
    if (!supabase) return;
    setTxLoading(true);
    const { data, error } = await supabase
      .from("special_account_transactions")
      .select("*")
      .eq("account_id", accountId)
      .order("date", { ascending: false });
    if (error) {
      console.error(error);
      toast("거래 내역 로드 실패: " + error.message, "err");
      setTransactions((prev) => ({ ...prev, [accountId]: [] }));
    } else {
      setTransactions((prev) => ({ ...prev, [accountId]: (data ?? []) as SpecialAccountTransaction[] }));
    }
    setTxLoading(false);
  };

  useEffect(() => {
    loadAccounts();
  }, []);

  useEffect(() => {
    if (selectedId) loadTransactions(selectedId);
  }, [selectedId]);

  const selected = selectedId ? accounts.find((a) => a.id === selectedId) : null;
  const selectedTx = selectedId ? (transactions[selectedId] || []).slice().sort((a, b) => b.date.localeCompare(a.date)) : [];

  const progressColor = (pct: number) => {
    if (pct >= 100) return "bg-[#1e3a5f]";
    if (pct >= 80) return "bg-green-500";
    if (pct >= 50) return "bg-yellow-500";
    return "bg-red-500";
  };

  const openAddAccount = () => {
    setEditingAccount(null);
    setAccountForm(emptyAccount());
    setShowAccountModal(true);
  };

  const openEditAccount = (acc: SpecialAccount) => {
    setEditingAccount(acc);
    setAccountForm({
      id: acc.id,
      account_name: acc.account_name,
      description: acc.description ?? "",
      target_amount: acc.target_amount,
      current_amount: acc.current_amount,
      start_date: acc.start_date ?? "",
      end_date: acc.end_date ?? "",
      status: acc.status,
    });
    setShowAccountModal(true);
  };

  const saveAccount = async () => {
    if (!supabase) return;
    if (!accountForm.account_name?.trim()) {
      toast("계좌 이름을 입력하세요.", "warn");
      return;
    }
    setSaving(true);
    const payload = {
      id: editingAccount?.id,
      account_name: accountForm.account_name.trim(),
      description: accountForm.description?.trim() || null,
      target_amount: Number(accountForm.target_amount) || 0,
      current_amount: Number(accountForm.current_amount) || 0,
      start_date: accountForm.start_date || null,
      end_date: accountForm.end_date || null,
      status: accountForm.status || "진행중",
    };
    const { error } = await supabase.from("special_accounts").upsert(payload as SpecialAccount, { onConflict: "id" });
    if (error) {
      toast("저장 실패: " + error.message, "err");
      setSaving(false);
      return;
    }
    toast("저장되었습니다");
    setShowAccountModal(false);
    loadAccounts();
    setSaving(false);
  };

  const deleteAccount = async (accountId: string) => {
    if (!supabase || !window.confirm("이 특별회계를 삭제하시겠습니까?")) return;
    const { error } = await supabase.from("special_accounts").delete().eq("id", accountId);
    if (error) {
      toast("삭제 실패: " + error.message, "err");
      return;
    }
    toast("삭제되었습니다", "ok");
    setSelectedId(null);
    setTransactions((prev) => {
      const next = { ...prev };
      delete next[accountId];
      return next;
    });
    loadAccounts();
  };

  const openAddTransaction = () => {
    setTxForm({
      date: new Date().toISOString().slice(0, 10),
      type: "수입",
      amount: 0,
      description: "",
      member_name: "",
    });
    setShowTxModal(true);
  };

  const saveTransaction = async () => {
    if (!supabase || !selectedId || !selected) return;
    if (txForm.amount <= 0) {
      toast("금액을 입력하세요.", "warn");
      return;
    }
    setSaving(true);
    const { error: insErr } = await supabase.from("special_account_transactions").insert({
      account_id: selectedId,
      date: txForm.date,
      type: txForm.type,
      amount: txForm.amount,
      description: txForm.description || null,
      member_name: txForm.member_name || null,
    });
    if (insErr) {
      toast("저장 실패: " + insErr.message, "err");
      setSaving(false);
      return;
    }
    const newAmount =
      txForm.type === "수입" ? selected.current_amount + txForm.amount : selected.current_amount - txForm.amount;
    const { error: updErr } = await supabase.from("special_accounts").update({ current_amount: newAmount }).eq("id", selectedId);
    if (updErr) {
      toast("잔액 반영 실패: " + updErr.message, "err");
      setSaving(false);
      return;
    }
    toast("거래가 등록되었습니다");
    setShowTxModal(false);
    loadAccounts();
    loadTransactions(selectedId);
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <span className="inline-block w-8 h-8 rounded-full border-2 border-[#1e3a5f] border-t-transparent animate-spin" />
        <span className="ml-3 text-gray-600">특별회계 로딩 중...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-[#1e3a5f]">특별회계</h3>
        <button type="button" onClick={openAddAccount} className="px-4 py-2 rounded-xl bg-[#1e3a5f] text-white text-sm font-semibold hover:opacity-90">
          + 새 특별회계
        </button>
      </div>

      {accounts.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center text-gray-500">
          등록된 특별회계가 없습니다. &quot;+ 새 특별회계&quot;로 추가하세요.
        </div>
      ) : (
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
      )}

      {selected && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h4 className="text-lg font-semibold text-[#1e3a5f]">{selected.account_name}</h4>
              {selected.description && <p className="text-sm text-gray-500 mt-1">{selected.description}</p>}
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => openEditAccount(selected)} className="px-3 py-1 rounded-lg border border-gray-200 text-sm">수정</button>
              <button type="button" onClick={openAddTransaction} className="px-3 py-1 rounded-lg bg-[#1e3a5f] text-white text-sm">+ 거래 추가</button>
              <button type="button" onClick={() => deleteAccount(selected.id)} className="px-3 py-1 rounded-lg border border-red-200 text-red-600 text-sm">삭제</button>
              <button type="button" onClick={() => setSelectedId(null)} className="px-3 py-1 rounded-lg border border-gray-200 text-sm">닫기</button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="bg-gray-50 border-b"><th className="text-left py-2 px-3">날짜</th><th className="text-left py-2 px-3">유형</th><th className="text-right py-2 px-3">금액</th><th className="text-left py-2 px-3">설명</th><th className="text-left py-2 px-3">헌금자</th></tr></thead>
              <tbody>
                {txLoading ? (
                  <tr><td colSpan={5} className="py-8 text-center text-gray-500">로딩 중...</td></tr>
                ) : selectedTx.length === 0 ? (
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

      {showAccountModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => !saving && setShowAccountModal(false)}>
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h4 className="text-lg font-semibold text-[#1e3a5f] mb-4">{editingAccount ? "특별회계 수정" : "새 특별회계"}</h4>
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700">계좌 이름 *</label>
              <input type="text" value={accountForm.account_name ?? ""} onChange={(e) => setAccountForm((f) => ({ ...f, account_name: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" placeholder="예: 건축헌금" />
              <label className="block text-sm font-medium text-gray-700">설명</label>
              <input type="text" value={accountForm.description ?? ""} onChange={(e) => setAccountForm((f) => ({ ...f, description: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" placeholder="선택" />
              <label className="block text-sm font-medium text-gray-700">목표 금액</label>
              <input type="number" min={0} value={accountForm.target_amount ?? 0} onChange={(e) => setAccountForm((f) => ({ ...f, target_amount: Number(e.target.value) || 0 }))} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" />
              <label className="block text-sm font-medium text-gray-700">현재 금액</label>
              <input type="number" min={0} value={accountForm.current_amount ?? 0} onChange={(e) => setAccountForm((f) => ({ ...f, current_amount: Number(e.target.value) || 0 }))} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" />
              <label className="block text-sm font-medium text-gray-700">시작일</label>
              <input type="date" value={accountForm.start_date ?? ""} onChange={(e) => setAccountForm((f) => ({ ...f, start_date: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" />
              <label className="block text-sm font-medium text-gray-700">종료일</label>
              <input type="date" value={accountForm.end_date ?? ""} onChange={(e) => setAccountForm((f) => ({ ...f, end_date: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" />
              <label className="block text-sm font-medium text-gray-700">상태</label>
              <select value={accountForm.status ?? "진행중"} onChange={(e) => setAccountForm((f) => ({ ...f, status: e.target.value as SpecialAccount["status"] }))} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm">
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2 mt-6">
              <button type="button" onClick={saveAccount} disabled={saving} className="px-4 py-2 rounded-lg bg-[#1e3a5f] text-white text-sm font-semibold disabled:opacity-60">{saving ? "저장 중..." : "저장"}</button>
              <button type="button" onClick={() => setShowAccountModal(false)} disabled={saving} className="px-4 py-2 rounded-lg border border-gray-200 text-sm">취소</button>
            </div>
          </div>
        </div>
      )}

      {showTxModal && selected && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => !saving && setShowTxModal(false)}>
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h4 className="text-lg font-semibold text-[#1e3a5f] mb-4">거래 추가</h4>
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700">날짜</label>
              <input type="date" value={txForm.date} onChange={(e) => setTxForm((f) => ({ ...f, date: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" />
              <label className="block text-sm font-medium text-gray-700">유형</label>
              <select value={txForm.type} onChange={(e) => setTxForm((f) => ({ ...f, type: e.target.value as "수입" | "지출" }))} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm">
                <option value="수입">수입</option>
                <option value="지출">지출</option>
              </select>
              <label className="block text-sm font-medium text-gray-700">금액 *</label>
              <input type="number" min={1} value={txForm.amount || ""} onChange={(e) => setTxForm((f) => ({ ...f, amount: Number(e.target.value) || 0 }))} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" />
              <label className="block text-sm font-medium text-gray-700">설명</label>
              <input type="text" value={txForm.description} onChange={(e) => setTxForm((f) => ({ ...f, description: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" />
              <label className="block text-sm font-medium text-gray-700">헌금자/비고</label>
              <input type="text" value={txForm.member_name} onChange={(e) => setTxForm((f) => ({ ...f, member_name: e.target.value }))} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" />
            </div>
            <div className="flex gap-2 mt-6">
              <button type="button" onClick={saveTransaction} disabled={saving} className="px-4 py-2 rounded-lg bg-[#1e3a5f] text-white text-sm font-semibold disabled:opacity-60">{saving ? "저장 중..." : "저장"}</button>
              <button type="button" onClick={() => setShowTxModal(false)} disabled={saving} className="px-4 py-2 rounded-lg border border-gray-200 text-sm">취소</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
