"use client";

import { useState, useEffect } from "react";
import type { DB } from "@/types/db";
import type { SchoolDepartment, SchoolClass, SchoolEnrollment } from "@/types/db";
import { supabase } from "@/lib/supabase";

const INDIGO = "#4F46E5";

export interface StudentManagementProps {
  db: DB;
  toast: (msg: string, type?: "ok" | "err" | "warn") => void;
}

export function StudentManagement({ db, toast }: StudentManagementProps) {
  const [departments, setDepartments] = useState<SchoolDepartment[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [enrollments, setEnrollments] = useState<SchoolEnrollment[]>([]);
  const [selectedDeptId, setSelectedDeptId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!supabase) return;
    const [depts, cls, enrolls] = await Promise.all([
      supabase.from("school_departments").select("*").order("sort_order"),
      supabase.from("school_classes").select("*").order("sort_order"),
      supabase.from("school_enrollments").select("*").eq("is_active", true),
    ]);
    console.log("=== STUDENT MANAGEMENT school_departments ===");
    console.log("data:", depts.data);
    console.log("error:", depts.error);
    const deptList = (depts.data as SchoolDepartment[]) ?? [];
    setDepartments(deptList.filter((d) => d.is_active !== false));
    setClasses((cls.data as SchoolClass[]) ?? []);
    setEnrollments((enrolls.data as SchoolEnrollment[]) ?? []);
  };

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, []);

  const filtered = selectedDeptId
    ? enrollments.filter((e) => e.department_id === selectedDeptId)
    : enrollments;

  const getMember = (memberId: string) => db.members?.find((m) => m.id === memberId);
  const getClass = (classId: string | undefined) => classes.find((c) => c.id === classId);
  const getDept = (deptId: string) => departments.find((d) => d.id === deptId);

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
        <span className="text-sm text-gray-500">+ 학생 등록 · 반 변경 · 일괄 이동 · 엑셀 (준비 중)</span>
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
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={5} className="py-8 text-center text-gray-500">등록된 학생이 없습니다.</td></tr>
            ) : (
              filtered.map((e) => {
                const m = getMember(e.member_id);
                const cls = getClass(e.class_id);
                return (
                  <tr key={e.id} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4">{m?.name ?? e.member_id}</td>
                    <td className="py-3 px-4">{cls?.name ?? "-"}</td>
                    <td className="py-3 px-4">{e.role}</td>
                    <td className="py-3 px-4">{m?.phone ?? "-"}</td>
                    <td className="py-3 px-4">{e.enrolled_date ?? "-"}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
