"use client";

import { useState, useEffect } from "react";
import type { DB } from "@/types/db";
import type { SchoolDepartment, SchoolClass, SchoolEnrollment } from "@/types/db";
import { supabase } from "@/lib/supabase";

const INDIGO = "#4F46E5";

type MemberInfo = { id: string; name: string; phone?: string } | null;
type EnrollmentRow = SchoolEnrollment & { members?: MemberInfo; member?: MemberInfo };

export interface StudentManagementProps {
  db: DB;
  toast: (msg: string, type?: "ok" | "err" | "warn") => void;
}

export function StudentManagement({ db, toast }: StudentManagementProps) {
  const [departments, setDepartments] = useState<SchoolDepartment[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [enrollments, setEnrollments] = useState<EnrollmentRow[]>([]);
  const [selectedDeptId, setSelectedDeptId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState<EnrollmentRow | null>(null);
  const [addMemberId, setAddMemberId] = useState("");
  const [addDeptId, setAddDeptId] = useState("");
  const [addClassId, setAddClassId] = useState("");
  const [addRole, setAddRole] = useState<"학생" | "교사" | "부교사" | "부장" | "총무">("학생");
  const [editClassId, setEditClassId] = useState("");
  const [editRole, setEditRole] = useState<"학생" | "교사" | "부교사" | "부장" | "총무">("학생");

  const load = async () => {
    if (!supabase) return;
    setLoading(true);
    try {
      const [depts, cls, enrolls] = await Promise.all([
        supabase.from("school_departments").select("*").order("sort_order"),
        supabase.from("school_classes").select("*").order("sort_order"),
        supabase.from("school_enrollments").select("*, members(id, name, phone)").eq("is_active", true),
      ]);
      if (depts.error) {
        toast("부서 목록 로드 실패: " + depts.error.message, "err");
        return;
      }
      if (cls.error) {
        toast("반 목록 로드 실패: " + cls.error.message, "err");
        return;
      }
      if (enrolls.error) {
        toast("등록 목록 로드 실패: " + enrolls.error.message, "err");
        return;
      }
      const deptList = (depts.data as SchoolDepartment[]) ?? [];
      setDepartments(deptList.filter((d) => d.is_active !== false));
      setClasses((cls.data as SchoolClass[]) ?? []);
      setEnrollments((enrolls.data as EnrollmentRow[]) ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = selectedDeptId
    ? enrollments.filter((e) => e.department_id === selectedDeptId)
    : enrollments;

  const getMember = (e: EnrollmentRow) => (e.members ?? e.member) ?? db.members?.find((m) => m.id === e.member_id);
  const getClass = (classId: string | undefined) => classes.find((c) => c.id === classId);
  const getDept = (deptId: string) => departments.find((d) => d.id === deptId);

  const handleRegister = async () => {
    if (!supabase || !addMemberId || !addDeptId) {
      toast("성도와 부서를 선택하세요", "warn");
      return;
    }
    const { error } = await supabase.from("school_enrollments").insert({
      member_id: addMemberId,
      department_id: addDeptId,
      class_id: addClassId || null,
      role: addRole,
    });
    if (error) {
      toast("등록 실패: " + error.message, "err");
      return;
    }
    toast("등록되었습니다", "ok");
    setAddOpen(false);
    setAddMemberId("");
    setAddDeptId("");
    setAddClassId("");
    await load();
  };

  const handleUpdate = async () => {
    if (!supabase || !editOpen) return;
    const { error } = await supabase.from("school_enrollments").update({
      class_id: editClassId || null,
      role: editRole,
    }).eq("id", editOpen.id);
    if (error) {
      toast("수정 실패: " + error.message, "err");
      return;
    }
    toast("수정되었습니다", "ok");
    setEditOpen(null);
    await load();
  };

  const handleDelete = async (e: EnrollmentRow) => {
    if (!supabase || !confirm(`${getMember(e)?.name ?? "이 학생"}을(를) 등록 해제하시겠습니까?`)) return;
    const { error } = await supabase.from("school_enrollments").update({
      is_active: false,
      left_date: new Date().toISOString().slice(0, 10),
    }).eq("id", e.id);
    if (error) {
      toast("해제 실패: " + error.message, "err");
      return;
    }
    toast("등록 해제되었습니다", "ok");
    setEditOpen(null);
    await load();
  };

  if (loading) return <div className="p-6 text-gray-500">로딩 중...</div>;

  return (
    <div className="space-y-4">
      <div className="flex gap-2 overflow-x-auto pb-2">
        <button
          type="button"
          onClick={() => setSelectedDeptId(null)}
          className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${!selectedDeptId ? "text-white" : "bg-gray-100 text-gray-700"}`}
          style={!selectedDeptId ? { background: INDIGO } : {}}
        >
          전체
        </button>
        {departments.map((d) => (
          <button
            key={d.id}
            type="button"
            onClick={() => setSelectedDeptId(d.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${selectedDeptId === d.id ? "text-white" : "bg-gray-100 text-gray-700"}`}
            style={selectedDeptId === d.id ? { background: INDIGO } : {}}
          >
            {d.name}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <button type="button" onClick={() => setAddOpen(true)} className="px-4 py-2 rounded-lg text-white text-sm font-medium" style={{ background: INDIGO }}>+ 학생 등록</button>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="text-left py-3 px-4 font-semibold">이름</th>
              <th className="text-left py-3 px-4 font-semibold">반</th>
              <th className="text-left py-3 px-4 font-semibold">역할</th>
              <th className="text-left py-3 px-4 font-semibold">연락처</th>
              <th className="text-left py-3 px-4 font-semibold">등록일</th>
              <th className="text-left py-3 px-4 font-semibold">관리</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={6} className="py-8 text-center text-gray-500">등록된 학생이 없습니다.</td></tr>
            ) : (
              filtered.map((e) => {
                const m = getMember(e);
                const cls = getClass(e.class_id);
                return (
                  <tr key={e.id} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4">{m?.name ?? e.member_id}</td>
                    <td className="py-3 px-4">{cls?.name ?? "-"}</td>
                    <td className="py-3 px-4">{e.role}</td>
                    <td className="py-3 px-4">{m?.phone ?? "-"}</td>
                    <td className="py-3 px-4">{e.enrolled_date ?? "-"}</td>
                    <td className="py-3 px-4">
                      <button type="button" onClick={() => { setEditOpen(e); setEditClassId(e.class_id ?? ""); setEditRole(e.role); }} className="mr-2 text-blue-600 text-sm hover:underline">수정</button>
                      <button type="button" onClick={() => handleDelete(e)} className="text-red-600 text-sm hover:underline">해제</button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {addOpen && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setAddOpen(false)}>
          <div className="bg-white rounded-xl p-6 max-w-sm w-full shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h4 className="font-semibold mb-4">학생 등록</h4>
            <label className="block text-sm font-medium text-gray-700 mb-1">성도</label>
            <select value={addMemberId} onChange={(e) => setAddMemberId(e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm mb-3">
              <option value="">선택</option>
              {(db.members ?? []).filter((m) => !enrollments.some((x) => x.member_id === m.id && x.department_id === addDeptId)).map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
            <label className="block text-sm font-medium text-gray-700 mb-1">부서</label>
            <select value={addDeptId} onChange={(e) => { setAddDeptId(e.target.value); setAddClassId(""); }} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm mb-3">
              <option value="">선택</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <label className="block text-sm font-medium text-gray-700 mb-1">반</label>
            <select value={addClassId} onChange={(e) => setAddClassId(e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm mb-3">
              <option value="">미배정</option>
              {classes.filter((c) => c.department_id === addDeptId).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <label className="block text-sm font-medium text-gray-700 mb-1">역할</label>
            <select value={addRole} onChange={(e) => setAddRole(e.target.value as typeof addRole)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm mb-4">
              <option value="학생">학생</option>
              <option value="교사">교사</option>
              <option value="부교사">부교사</option>
              <option value="부장">부장</option>
              <option value="총무">총무</option>
            </select>
            <div className="flex gap-2">
              <button type="button" onClick={() => setAddOpen(false)} className="flex-1 py-2 rounded-lg border border-gray-200 text-sm">취소</button>
              <button type="button" onClick={handleRegister} className="flex-1 py-2 rounded-lg text-white text-sm font-semibold" style={{ background: INDIGO }}>등록</button>
            </div>
          </div>
        </div>
      )}

      {editOpen && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setEditOpen(null)}>
          <div className="bg-white rounded-xl p-6 max-w-sm w-full shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h4 className="font-semibold mb-4">등록 수정 — {getMember(editOpen)?.name ?? editOpen.member_id}</h4>
            <label className="block text-sm font-medium text-gray-700 mb-1">반</label>
            <select value={editClassId} onChange={(e) => setEditClassId(e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm mb-3">
              <option value="">미배정</option>
              {classes.filter((c) => c.department_id === editOpen.department_id).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <label className="block text-sm font-medium text-gray-700 mb-1">역할</label>
            <select value={editRole} onChange={(e) => setEditRole(e.target.value as typeof editRole)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm mb-4">
              <option value="학생">학생</option>
              <option value="교사">교사</option>
              <option value="부교사">부교사</option>
              <option value="부장">부장</option>
              <option value="총무">총무</option>
            </select>
            <div className="flex gap-2">
              <button type="button" onClick={() => handleDelete(editOpen)} className="py-2 rounded-lg border border-red-200 text-red-600 text-sm">등록 해제</button>
              <button type="button" onClick={() => setEditOpen(null)} className="flex-1 py-2 rounded-lg border border-gray-200 text-sm">취소</button>
              <button type="button" onClick={handleUpdate} className="flex-1 py-2 rounded-lg text-white text-sm font-semibold" style={{ background: INDIGO }}>저장</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
