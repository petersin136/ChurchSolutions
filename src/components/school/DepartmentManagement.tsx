"use client";

import { useState, useEffect } from "react";
import type { DB } from "@/types/db";
import type { SchoolDepartment, SchoolClass } from "@/types/db";
import { supabase } from "@/lib/supabase";

const INDIGO = "#4F46E5";

export interface DepartmentManagementProps {
  db: DB;
  toast: (msg: string, type?: "ok" | "err" | "warn") => void;
}

export function DepartmentManagement({ db, toast }: DepartmentManagementProps) {
  const [departments, setDepartments] = useState<SchoolDepartment[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [selectedDeptId, setSelectedDeptId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [addDeptOpen, setAddDeptOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newAgeRange, setNewAgeRange] = useState("");

  const load = async () => {
    if (!supabase) return;
    const { data: depts } = await supabase.from("school_departments").select("*").order("sort_order");
    setDepartments((depts as SchoolDepartment[]) ?? []);
    const { data: cls } = await supabase.from("school_classes").select("*").order("sort_order");
    setClasses((cls as SchoolClass[]) ?? []);
  };

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, []);

  const selectedDept = selectedDeptId ? departments.find((d) => d.id === selectedDeptId) : null;
  const deptClasses = selectedDeptId ? classes.filter((c) => c.department_id === selectedDeptId) : [];

  const handleAddDepartment = async () => {
    if (!newName.trim() || !supabase) return;
    const { error } = await supabase.from("school_departments").insert({
      name: newName.trim(),
      age_range: newAgeRange.trim() || null,
      sort_order: departments.length + 1,
    });
    if (error) {
      toast("부서 추가 실패: " + error.message, "err");
      return;
    }
    toast("부서가 추가되었습니다", "ok");
    setNewName("");
    setNewAgeRange("");
    setAddDeptOpen(false);
    load();
  };

  if (loading) return <div className="p-6 text-gray-500">로딩 중...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold" style={{ color: INDIGO }}>부서 목록</h3>
        <button
          type="button"
          onClick={() => setAddDeptOpen(true)}
          className="px-4 py-2 rounded-xl text-white text-sm font-semibold"
          style={{ background: INDIGO }}
        >
          + 부서 추가
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left py-3 px-4 font-semibold">이름</th>
                <th className="text-left py-3 px-4 font-semibold">연령대</th>
                <th className="text-left py-3 px-4 font-semibold">담당</th>
                <th className="text-left py-3 px-4 font-semibold">교사/학생</th>
                <th className="text-left py-3 px-4 font-semibold">예배</th>
              </tr>
            </thead>
            <tbody>
              {departments.map((d) => (
                <tr
                  key={d.id}
                  onClick={() => setSelectedDeptId(d.id)}
                  className={`border-b cursor-pointer ${selectedDeptId === d.id ? "bg-indigo-50" : "hover:bg-gray-50"}`}
                >
                  <td className="py-3 px-4 font-medium">{d.name}</td>
                  <td className="py-3 px-4">{d.age_range ?? "-"}</td>
                  <td className="py-3 px-4">{d.leader_name ?? "-"}</td>
                  <td className="py-3 px-4">{d.teacher_count} / {d.student_count}</td>
                  <td className="py-3 px-4">{d.meeting_time ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-4">
          {selectedDept ? (
            <>
              <h4 className="font-semibold mb-3" style={{ color: INDIGO }}>{selectedDept.name} — 반 목록</h4>
              {deptClasses.length === 0 ? (
                <p className="text-gray-500 text-sm">등록된 반이 없습니다.</p>
              ) : (
                <ul className="space-y-2">
                  {deptClasses.map((c) => (
                    <li key={c.id} className="flex justify-between items-center py-2 border-b border-gray-100">
                      <span>{c.name}</span>
                      <span className="text-gray-500 text-sm">{c.teacher_name ?? "-"} · {c.current_students}명</span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <p className="text-gray-500">부서를 선택하세요.</p>
          )}
        </div>
      </div>

      {addDeptOpen && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setAddDeptOpen(false)}>
          <div className="bg-white rounded-xl p-6 max-w-sm w-full shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h4 className="font-semibold mb-4">부서 추가</h4>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="부서명 (예: 영유아부)"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm mb-3"
            />
            <input
              type="text"
              value={newAgeRange}
              onChange={(e) => setNewAgeRange(e.target.value)}
              placeholder="연령대 (예: 0-3)"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm mb-4"
            />
            <div className="flex gap-2">
              <button type="button" onClick={() => setAddDeptOpen(false)} className="flex-1 py-2 rounded-lg border border-gray-200 text-sm">취소</button>
              <button type="button" onClick={handleAddDepartment} className="flex-1 py-2 rounded-lg text-white text-sm font-semibold" style={{ background: INDIGO }}>추가</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
