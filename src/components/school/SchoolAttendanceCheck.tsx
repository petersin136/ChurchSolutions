"use client";

import { useState, useEffect } from "react";
import type { DB } from "@/types/db";
import type { SchoolDepartment, SchoolClass, SchoolEnrollment } from "@/types/db";
import { supabase } from "@/lib/supabase";

const INDIGO = "#4F46E5";
const MIN_TOUCH = 44;

type AttStatus = "출석" | "결석" | "병결" | "기타";

export interface SchoolAttendanceCheckProps {
  db: DB;
  toast: (msg: string, type?: "ok" | "err" | "warn") => void;
}

export function SchoolAttendanceCheck({ db, toast }: SchoolAttendanceCheckProps) {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [departments, setDepartments] = useState<SchoolDepartment[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [enrollments, setEnrollments] = useState<SchoolEnrollment[]>([]);
  const [selectedDeptId, setSelectedDeptId] = useState<string | null>(null);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [statusMap, setStatusMap] = useState<Record<string, AttStatus>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadDeptsAndClasses = async () => {
    if (!supabase) return;
    const { data: depts } = await supabase.from("school_departments").select("*").order("sort_order");
    const list = (depts as SchoolDepartment[]) ?? [];
    setDepartments(list.filter((d) => d.is_active !== false));
    const { data: cls } = await supabase.from("school_classes").select("*").order("sort_order");
    const clsList = (cls as SchoolClass[]) ?? [];
    setClasses(clsList.filter((c) => c.is_active !== false));
  };

  const loadEnrollments = async () => {
    if (!supabase) return;
    let q = supabase.from("school_enrollments").select("*").eq("is_active", true).in("role", ["학생", "교사", "부교사"]);
    if (selectedDeptId) q = q.eq("department_id", selectedDeptId);
    if (selectedClassId) q = q.eq("class_id", selectedClassId);
    const { data } = await q;
    setEnrollments((data as SchoolEnrollment[]) ?? []);
  };

  const loadAttendance = async () => {
    if (!supabase || !selectedDeptId) return;
    const { data } = await supabase.from("school_attendance").select("member_id, status").eq("department_id", selectedDeptId).eq("date", date);
    const map: Record<string, AttStatus> = {};
    (data ?? []).forEach((r: { member_id: string; status: AttStatus }) => { map[r.member_id] = r.status; });
    setStatusMap(map);
  };

  useEffect(() => {
    setLoading(true);
    loadDeptsAndClasses().finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadEnrollments();
  }, [selectedDeptId, selectedClassId]);

  useEffect(() => {
    if (selectedDeptId) loadAttendance();
    else setStatusMap({});
  }, [selectedDeptId, date]);

  const setStatus = (memberId: string, status: AttStatus) => {
    setStatusMap((prev) => ({ ...prev, [memberId]: status }));
  };

  const handleSave = async () => {
    if (!supabase || !selectedDeptId) {
      toast("부서를 선택하세요", "warn");
      return;
    }
    setSaving(true);
    try {
      for (const e of enrollments) {
        const status = statusMap[e.member_id] ?? "출석";
        await supabase.from("school_attendance").upsert(
          { department_id: selectedDeptId, class_id: e.class_id ?? null, member_id: e.member_id, date, status },
          { onConflict: "member_id,department_id,date" }
        );
      }
      toast("출석이 저장되었습니다", "ok");
      loadAttendance();
    } catch (err) {
      console.error(err);
      toast("저장 실패", "err");
    } finally {
      setSaving(false);
    }
  };

  const counts = { 출석: 0, 결석: 0, 병결: 0, 기타: 0 };
  enrollments.forEach((e) => {
    const s = statusMap[e.member_id] ?? "출석";
    counts[s]++;
  });

  if (loading) return <div className="p-6 text-gray-500">로딩 중...</div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4 items-center bg-white rounded-xl border border-gray-100 p-4">
        <label className="flex items-center gap-2">
          <span className="text-sm font-medium">날짜</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-lg border border-gray-200 px-3 py-2 text-sm" />
        </label>
        <label className="flex items-center gap-2">
          <span className="text-sm font-medium">부서</span>
          <select value={selectedDeptId ?? ""} onChange={(e) => { setSelectedDeptId(e.target.value || null); setSelectedClassId(null); }} className="rounded-lg border border-gray-200 px-3 py-2 text-sm min-w-[120px]">
            <option value="">선택</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2">
          <span className="text-sm font-medium">반</span>
          <select value={selectedClassId ?? ""} onChange={(e) => setSelectedClassId(e.target.value || null)} className="rounded-lg border border-gray-200 px-3 py-2 text-sm min-w-[120px]">
            <option value="">전체</option>
            {classes.filter((c) => c.department_id === selectedDeptId).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
      </div>

      {selectedDeptId && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {(["출석", "결석", "병결", "기타"] as const).map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => {}}
                className="rounded-xl border-2 p-3 text-sm font-semibold"
                style={{
                  minHeight: MIN_TOUCH,
                  borderColor: status === "출석" ? "#10B981" : status === "결석" ? "#EF4444" : status === "병결" ? "#F59E0B" : "#6B7280",
                  background: status === "출석" ? "#D1FAE5" : status === "결석" ? "#FEE2E2" : status === "병결" ? "#FEF3C7" : "#F3F4F6",
                  color: status === "출석" ? "#065F46" : status === "결석" ? "#991B1B" : status === "병결" ? "#92400E" : "#374151",
                }}
              >
                {status} {counts[status]}명
              </button>
            ))}
          </div>

          <div className="space-y-2">
            {enrollments.length === 0 ? (
              <p className="text-gray-500 text-center py-8">등록된 학생이 없습니다.</p>
            ) : (
              enrollments.map((e) => {
                const m = db.members?.find((x) => x.id === e.member_id);
                const current = statusMap[e.member_id] ?? "출석";
                return (
                  <div key={e.id} className="flex items-center justify-between bg-white rounded-xl border border-gray-100 p-3">
                    <span className="font-medium">{m?.name ?? e.member_id}</span>
                    <div className="flex gap-2">
                      {(["출석", "결석", "병결", "기타"] as const).map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setStatus(e.member_id, s)}
                          className="px-3 py-2 rounded-lg text-sm font-medium"
                          style={{ minWidth: MIN_TOUCH, minHeight: MIN_TOUCH, background: current === s ? (s === "출석" ? "#10B981" : s === "결석" ? "#EF4444" : s === "병결" ? "#F59E0B" : "#6B7280") : "#f3f4f6", color: current === s ? "#fff" : "#6b7280" }}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="sticky bottom-4 flex items-center justify-between bg-white rounded-xl border border-gray-200 p-4 shadow-lg">
            <span className="text-sm">출석 {counts.출석}명 · 결석 {counts.결석}명 · 총 {enrollments.length}명</span>
            <button type="button" onClick={handleSave} disabled={saving} className="px-6 py-2 rounded-xl text-white font-semibold disabled:opacity-50" style={{ background: INDIGO }}>
              {saving ? "저장 중…" : "저장"}
            </button>
          </div>
        </>
      )}

      {!selectedDeptId && <p className="text-gray-500 text-center py-8">부서를 선택하면 출석 체크를 할 수 있습니다.</p>}
    </div>
  );
}
