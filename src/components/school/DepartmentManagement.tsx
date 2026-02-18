"use client";

import { useState, useEffect } from "react";
import type { DB } from "@/types/db";
import type { SchoolDepartment, SchoolClass } from "@/types/db";
import { supabase } from "@/lib/supabase";
import { C } from "@/styles/designTokens";

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
  const [editDeptOpen, setEditDeptOpen] = useState(false);
  const [editDeptName, setEditDeptName] = useState("");
  const [editDeptAgeRange, setEditDeptAgeRange] = useState("");
  const [addClassOpen, setAddClassOpen] = useState(false);
  const [newClassName, setNewClassName] = useState("");
  const [editClassOpen, setEditClassOpen] = useState<SchoolClass | null>(null);
  const [editClassName, setEditClassName] = useState("");
  const [editDeptId, setEditDeptId] = useState<string | null>(null);

  const load = async () => {
    if (!supabase) return;
    setLoading(true);
    try {
      const { data: depts, error: deptsError } = await supabase.from("school_departments").select("*").order("sort_order");
      if (deptsError) {
        toast("부서 목록 로드 실패: " + deptsError.message, "err");
        return;
      }
      setDepartments((depts as SchoolDepartment[]) ?? []);
      const { data: cls, error: clsError } = await supabase.from("school_classes").select("*").order("sort_order");
      if (clsError) {
        toast("반 목록 로드 실패: " + clsError.message, "err");
        return;
      }
      setClasses((cls as SchoolClass[]) ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
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
    await load();
  };

  const openEditDept = (d: SchoolDepartment) => {
    setEditDeptId(d.id);
    setEditDeptName(d.name);
    setEditDeptAgeRange(d.age_range ?? "");
    setEditDeptOpen(true);
  };

  const handleUpdateDepartment = async () => {
    if (!editDeptId || !editDeptName.trim() || !supabase) return;
    const { error } = await supabase.from("school_departments").update({
      name: editDeptName.trim(),
      age_range: editDeptAgeRange.trim() || null,
      updated_at: new Date().toISOString(),
    }).eq("id", editDeptId);
    if (error) {
      toast("부서 수정 실패: " + error.message, "err");
      return;
    }
    toast("부서가 수정되었습니다", "ok");
    setEditDeptOpen(false);
    setEditDeptId(null);
    await load();
  };

  const handleDeleteDepartment = async (d?: SchoolDepartment) => {
    const target = d ?? (editDeptId ? departments.find((x) => x.id === editDeptId) : selectedDept);
    if (!target || !supabase || !confirm(`"${target.name}" 부서를 삭제하시겠습니까?`)) return;
    const { error } = await supabase.from("school_departments").delete().eq("id", target.id);
    if (error) {
      toast("부서 삭제 실패: " + error.message, "err");
      return;
    }
    toast("부서가 삭제되었습니다", "ok");
    setSelectedDeptId(null);
    setEditDeptOpen(false);
    setEditDeptId(null);
    await load();
  };

  const handleAddClass = async () => {
    if (!selectedDeptId || !newClassName.trim() || !supabase) return;
    const deptClassesCount = deptClasses.length;
    const { error } = await supabase.from("school_classes").insert({
      department_id: selectedDeptId,
      name: newClassName.trim(),
      sort_order: deptClassesCount + 1,
    });
    if (error) {
      toast("반 추가 실패: " + error.message, "err");
      return;
    }
    toast("반이 추가되었습니다", "ok");
    setNewClassName("");
    setAddClassOpen(false);
    await load();
  };

  const handleUpdateClass = async () => {
    if (!editClassOpen || !editClassName.trim() || !supabase) return;
    const { error } = await supabase.from("school_classes").update({
      name: editClassName.trim(),
    }).eq("id", editClassOpen.id);
    if (error) {
      toast("반 수정 실패: " + error.message, "err");
      return;
    }
    toast("반이 수정되었습니다", "ok");
    setEditClassOpen(null);
    await load();
  };

  const handleDeleteClass = async (c: SchoolClass) => {
    if (!supabase || !confirm(`"${c.name}" 반을 삭제하시겠습니까?`)) return;
    const { error } = await supabase.from("school_classes").delete().eq("id", c.id);
    if (error) {
      toast("반 삭제 실패: " + error.message, "err");
      return;
    }
    toast("반이 삭제되었습니다", "ok");
    setEditClassOpen(null);
    await load();
  };

  if (loading) return <div className="p-6 text-gray-500">로딩 중...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold" style={{ color: C.navy }}>부서 목록</h3>
        <button
          type="button"
          onClick={() => setAddDeptOpen(true)}
          className="px-4 py-2 rounded-xl text-white text-sm font-semibold"
          style={{ background: C.navy }}
        >
          + 부서 추가
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div style={{ background: C.card, borderRadius: 16, border: `1px solid ${C.border}`, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
          <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: C.bg, borderBottom: `1px solid ${C.border}` }}>
                <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: 600, fontSize: 13, color: C.navy }}>이름</th>
                <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: 600, fontSize: 13, color: C.navy }}>연령대</th>
                <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: 600, fontSize: 13, color: C.navy }}>담당</th>
                <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: 600, fontSize: 13, color: C.navy }}>교사/학생</th>
                <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: 600, fontSize: 13, color: C.navy }}>예배</th>
                <th style={{ padding: "12px 16px", textAlign: "right", fontWeight: 600, fontSize: 13, color: C.navy }}>관리</th>
              </tr>
            </thead>
            <tbody>
              {departments.map((d) => (
                <tr
                  key={d.id}
                  onClick={() => setSelectedDeptId(d.id)}
                  style={{ borderBottom: `1px solid ${C.borderLight}`, cursor: "pointer", background: selectedDeptId === d.id ? C.accentBg : "transparent", transition: "background 0.1s" }}
                  onMouseEnter={(e) => { if (selectedDeptId !== d.id) e.currentTarget.style.background = C.bg; }}
                  onMouseLeave={(e) => { if (selectedDeptId !== d.id) e.currentTarget.style.background = "transparent"; }}
                >
                  <td className="py-3 px-4 font-medium">{d.name}</td>
                  <td className="py-3 px-4">{d.age_range ?? "-"}</td>
                  <td className="py-3 px-4">{d.leader_name ?? "-"}</td>
                  <td className="py-3 px-4">{d.teacher_count} / {d.student_count}</td>
                  <td className="py-3 px-4">{d.meeting_time ?? "-"}</td>
                  <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                    <button type="button" onClick={() => openEditDept(d)} className="mr-2 text-sm text-blue-600 hover:underline">수정</button>
                    <button type="button" onClick={() => handleDeleteDepartment(d)} className="text-sm text-red-600 hover:underline">삭제</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ background: C.card, borderRadius: 16, border: `1px solid ${C.border}`, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
          {selectedDept ? (
            <>
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold" style={{ color: C.navy }}>{selectedDept.name} — 반 목록</h4>
                <button type="button" onClick={() => setAddClassOpen(true)} className="px-3 py-1.5 rounded-lg text-white text-sm font-medium" style={{ background: C.navy }}>+ 반 추가</button>
              </div>
              {deptClasses.length === 0 ? (
                <p className="text-gray-500 text-sm">등록된 반이 없습니다.</p>
              ) : (
                <ul className="space-y-2">
                  {deptClasses.map((c) => (
                    <li key={c.id} className="flex justify-between items-center py-2 border-b border-gray-100">
                      <span>{c.name}</span>
                      <span className="text-gray-500 text-sm">{c.teacher_name ?? "-"} · {c.current_students}명</span>
                      <span className="flex gap-2">
                        <button type="button" onClick={() => { setEditClassOpen(c); setEditClassName(c.name); }} className="text-sm text-blue-600 hover:underline">수정</button>
                        <button type="button" onClick={() => handleDeleteClass(c)} className="text-sm text-red-600 hover:underline">삭제</button>
                      </span>
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
              <button type="button" onClick={handleAddDepartment} className="flex-1 py-2 rounded-lg text-white text-sm font-semibold" style={{ background: C.navy }}>추가</button>
            </div>
          </div>
        </div>
      )}

      {editDeptOpen && editDeptId && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => { setEditDeptOpen(false); setEditDeptId(null); }}>
          <div className="bg-white rounded-xl p-6 max-w-sm w-full shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h4 className="font-semibold mb-4">부서 수정</h4>
            <input
              type="text"
              value={editDeptName}
              onChange={(e) => setEditDeptName(e.target.value)}
              placeholder="부서명"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm mb-3"
            />
            <input
              type="text"
              value={editDeptAgeRange}
              onChange={(e) => setEditDeptAgeRange(e.target.value)}
              placeholder="연령대"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm mb-4"
            />
            <div className="flex gap-2">
              <button type="button" onClick={() => handleDeleteDepartment()} className="py-2 rounded-lg border border-red-200 text-red-600 text-sm">삭제</button>
              <button type="button" onClick={() => { setEditDeptOpen(false); setEditDeptId(null); }} className="flex-1 py-2 rounded-lg border border-gray-200 text-sm">취소</button>
              <button type="button" onClick={handleUpdateDepartment} className="flex-1 py-2 rounded-lg text-white text-sm font-semibold" style={{ background: C.navy }}>저장</button>
            </div>
          </div>
        </div>
      )}

      {addClassOpen && selectedDeptId && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setAddClassOpen(false)}>
          <div className="bg-white rounded-xl p-6 max-w-sm w-full shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h4 className="font-semibold mb-4">반 추가</h4>
            <input
              type="text"
              value={newClassName}
              onChange={(e) => setNewClassName(e.target.value)}
              placeholder="반 이름"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm mb-4"
            />
            <div className="flex gap-2">
              <button type="button" onClick={() => setAddClassOpen(false)} className="flex-1 py-2 rounded-lg border border-gray-200 text-sm">취소</button>
              <button type="button" onClick={handleAddClass} className="flex-1 py-2 rounded-lg text-white text-sm font-semibold" style={{ background: C.navy }}>추가</button>
            </div>
          </div>
        </div>
      )}

      {editClassOpen && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setEditClassOpen(null)}>
          <div className="bg-white rounded-xl p-6 max-w-sm w-full shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h4 className="font-semibold mb-4">반 수정</h4>
            <input
              type="text"
              value={editClassName}
              onChange={(e) => setEditClassName(e.target.value)}
              placeholder="반 이름"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm mb-4"
            />
            <div className="flex gap-2">
              <button type="button" onClick={() => setEditClassOpen(null)} className="flex-1 py-2 rounded-lg border border-gray-200 text-sm">취소</button>
              <button type="button" onClick={handleUpdateClass} className="flex-1 py-2 rounded-lg text-white text-sm font-semibold" style={{ background: C.navy }}>저장</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
