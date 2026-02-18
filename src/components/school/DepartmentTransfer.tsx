"use client";

import { useState, useEffect } from "react";
import type { DB } from "@/types/db";
import type { SchoolDepartment, SchoolEnrollment, SchoolTransferHistory } from "@/types/db";
import { supabase } from "@/lib/supabase";

const INDIGO = "#4F46E5";

export interface DepartmentTransferProps {
  db: DB;
  toast: (msg: string, type?: "ok" | "err" | "warn") => void;
}

export function DepartmentTransfer({ db, toast }: DepartmentTransferProps) {
  const [departments, setDepartments] = useState<SchoolDepartment[]>([]);
  const [enrollments, setEnrollments] = useState<SchoolEnrollment[]>([]);
  const [history, setHistory] = useState<SchoolTransferHistory[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [fromDeptId, setFromDeptId] = useState<string | null>(null);
  const [toDeptId, setToDeptId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!supabase) return;
    const [depts, enrolls, hist] = await Promise.all([
      supabase.from("school_departments").select("*").order("sort_order"),
      supabase.from("school_enrollments").select("*").eq("is_active", true),
      supabase.from("school_transfer_history").select("*").order("created_at", { ascending: false }).limit(50),
    ]);
    const deptList = (depts.data as SchoolDepartment[]) ?? [];
    setDepartments(deptList.filter((d) => d.is_active !== false));
    setEnrollments((enrolls.data as SchoolEnrollment[]) ?? []);
    setHistory((hist.data as SchoolTransferHistory[]) ?? []);
  };

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, []);

  const filtered = fromDeptId ? enrollments.filter((e) => e.department_id === fromDeptId) : [];

  const toggle = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleTransfer = async () => {
    if (!supabase || !toDeptId || selectedIds.size === 0) {
      toast("이동할 학생과 새 부서를 선택하세요", "warn");
      return;
    }
    const toDept = departments.find((d) => d.id === toDeptId);
    const fromDept = fromDeptId ? departments.find((d) => d.id === fromDeptId) : null;
    try {
      for (const enrollId of selectedIds) {
        const en = enrollments.find((e) => e.id === enrollId);
        if (!en) continue;
        await supabase.from("school_enrollments").update({ department_id: toDeptId, class_id: null }).eq("id", enrollId);
        await supabase.from("school_transfer_history").insert({
          member_id: en.member_id,
          from_department_id: fromDeptId,
          from_department_name: fromDept?.name,
          to_department_id: toDeptId,
          to_department_name: toDept?.name,
          reason: reason.trim() || null,
        });
      }
      toast("부서 이동이 완료되었습니다", "ok");
      setSelectedIds(new Set());
      setReason("");
      load();
    } catch (err) {
      console.error(err);
      toast("이동 처리 실패", "err");
    }
  };

  const getMember = (id: string) => db.members?.find((m) => m.id === id);

  if (loading) return <div className="p-6 text-gray-500">로딩 중...</div>;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <h4 className="font-semibold mb-3" style={{ color: INDIGO }}>부서 이동</h4>
        <div className="flex flex-wrap gap-4 mb-3">
          <label className="flex items-center gap-2">
            <span className="text-sm">현재 부서</span>
            <select value={fromDeptId ?? ""} onChange={(e) => { setFromDeptId(e.target.value || null); setSelectedIds(new Set()); }} className="rounded-lg border border-gray-200 px-3 py-2 text-sm">
              <option value="">선택</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-2">
            <span className="text-sm">새 부서</span>
            <select value={toDeptId ?? ""} onChange={(e) => setToDeptId(e.target.value || null)} className="rounded-lg border border-gray-200 px-3 py-2 text-sm">
              <option value="">선택</option>
              {departments.filter((d) => d.id !== fromDeptId).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </label>
          <input type="text" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="이동 사유" className="rounded-lg border border-gray-200 px-3 py-2 text-sm w-48" />
          <button type="button" onClick={handleTransfer} disabled={selectedIds.size === 0 || !toDeptId} className="px-4 py-2 rounded-xl text-white text-sm font-semibold disabled:opacity-50" style={{ background: INDIGO }}>이동 실행</button>
        </div>
        <div className="max-h-48 overflow-y-auto border border-gray-100 rounded-lg">
          {filtered.map((e) => (
            <label key={e.id} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer">
              <input type="checkbox" checked={selectedIds.has(e.id)} onChange={() => toggle(e.id)} />
              <span>{getMember(e.member_id)?.name ?? e.member_id}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-x-auto">
        <h4 className="font-semibold p-4" style={{ color: INDIGO }}>이동 이력</h4>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="text-left py-2 px-4">이동일</th>
              <th className="text-left py-2 px-4">구 부서</th>
              <th className="text-left py-2 px-4">신 부서</th>
              <th className="text-left py-2 px-4">사유</th>
            </tr>
          </thead>
          <tbody>
            {history.length === 0 ? (
              <tr><td colSpan={4} className="py-6 text-center text-gray-500">이력이 없습니다.</td></tr>
            ) : (
              history.map((h) => (
                <tr key={h.id} className="border-b">
                  <td className="py-2 px-4">{h.transfer_date}</td>
                  <td className="py-2 px-4">{h.from_department_name ?? "-"}</td>
                  <td className="py-2 px-4">{h.to_department_name ?? "-"}</td>
                  <td className="py-2 px-4">{h.reason ?? "-"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
