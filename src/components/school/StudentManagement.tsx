"use client";

import { useState, useMemo, useEffect, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import type { DB } from "@/types/db";
import type { SchoolDepartment, SchoolClass, SchoolEnrollment } from "@/types/db";
import { supabase } from "@/lib/supabase";
import { getChurchId } from "@/lib/tenant";
import { useAppData } from "@/contexts/AppDataContext";

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

const NAVY = "#1a1d26";
const BORDER = "#e8e9f0";
const ROW_LINE = "#f0f2f5";
const MUTED = "#999";
const TEXT = "#555";
const UNSEL_BG = "#f5f8ff";

type MemberInfo = { id: string; name: string; phone?: string } | null;
type EnrollmentRow = SchoolEnrollment & { members?: MemberInfo; member?: MemberInfo };

export interface StudentManagementProps {
  db: DB;
  toast: (msg: string, type?: "ok" | "err" | "warn") => void;
}

export function StudentManagement({ toast }: StudentManagementProps) {
  const mob = useIsMobile();
  const { db, schoolDepartments, schoolClasses, schoolEnrollments, refreshSchoolEnrollments } = useAppData();
  const [selectedDeptId, setSelectedDeptId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState<EnrollmentRow | null>(null);
  const [addMemberId, setAddMemberId] = useState("");
  const [addDeptId, setAddDeptId] = useState("");
  const [addClassId, setAddClassId] = useState("");
  const [addRole, setAddRole] = useState<"학생" | "교사" | "부교사" | "부장" | "총무">("학생");
  const [editClassId, setEditClassId] = useState("");
  const [editRole, setEditRole] = useState<"학생" | "교사" | "부교사" | "부장" | "총무">("학생");

  const departments = useMemo(() => schoolDepartments.filter((d) => d.is_active !== false), [schoolDepartments]);
  const classes = schoolClasses;
  const enrollments: EnrollmentRow[] = useMemo(() =>
    schoolEnrollments.map((e) => {
      const m = db.members?.find((mem) => mem.id === e.member_id);
      return { ...e, members: m ? { id: m.id, name: m.name, phone: m.phone } : null };
    }),
    [schoolEnrollments, db.members]
  );

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
    const churchId = getChurchId();
    const { error } = await supabase.from("school_enrollments").insert({
      member_id: addMemberId,
      department_id: addDeptId,
      class_id: addClassId || null,
      role: addRole,
      church_id: churchId,
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
    await refreshSchoolEnrollments();
  };

  const handleUpdate = async () => {
    if (!supabase || !editOpen) return;
    let churchId: string;
    try {
      churchId = getChurchId();
    } catch (e) {
      toast("church_id를 확인할 수 없습니다. 로그인 상태를 확인하세요.", "err");
      return;
    }
    const { error } = await supabase.from("school_enrollments").update({
      class_id: editClassId || null,
      role: editRole,
    }).eq("church_id", churchId).eq("id", editOpen.id);
    if (error) {
      toast("수정 실패: " + error.message, "err");
      return;
    }
    toast("수정되었습니다", "ok");
    setEditOpen(null);
    await refreshSchoolEnrollments();
  };

  const handleDelete = async (e: EnrollmentRow) => {
    if (!supabase || !confirm(`${getMember(e)?.name ?? "이 학생"}을(를) 등록 해제하시겠습니까?`)) return;
    let churchId: string;
    try {
      churchId = getChurchId();
    } catch (err) {
      toast("church_id를 확인할 수 없습니다. 로그인 상태를 확인하세요.", "err");
      return;
    }
    const { error } = await supabase.from("school_enrollments").update({
      is_active: false,
      left_date: new Date().toISOString().slice(0, 10),
    }).eq("church_id", churchId).eq("id", e.id);
    if (error) {
      toast("해제 실패: " + error.message, "err");
      return;
    }
    toast("등록 해제되었습니다", "ok");
    setEditOpen(null);
    await refreshSchoolEnrollments();
  };

  const pillBase: CSSProperties = {
    height: mob ? 28 : 36,
    fontSize: mob ? 11 : 13,
    fontWeight: 600,
    padding: mob ? "0 10px" : "0 14px",
    borderRadius: mob ? 6 : 10,
    whiteSpace: "nowrap",
    flexShrink: 0,
    cursor: "pointer",
    border: `1px solid ${BORDER}`,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: mob ? 12 : 20 }}>
      <div
        style={{
          display: "flex",
          gap: 8,
          overflowX: "auto",
          flexWrap: "nowrap",
          paddingBottom: 4,
          scrollbarWidth: "thin",
        }}
      >
        <button
          type="button"
          onClick={() => setSelectedDeptId(null)}
          style={{
            ...pillBase,
            background: !selectedDeptId ? NAVY : UNSEL_BG,
            color: !selectedDeptId ? "#fff" : TEXT,
            border: !selectedDeptId ? "none" : `1px solid ${BORDER}`,
          }}
        >
          전체
        </button>
        {departments.map((d) => {
          const on = selectedDeptId === d.id;
          return (
            <button
              key={d.id}
              type="button"
              onClick={() => setSelectedDeptId(d.id)}
              style={{
                ...pillBase,
                background: on ? NAVY : UNSEL_BG,
                color: on ? "#fff" : TEXT,
                border: on ? "none" : `1px solid ${BORDER}`,
              }}
            >
              {d.name}
            </button>
          );
        })}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          style={{
            height: mob ? 30 : 40,
            fontSize: mob ? 11 : 14,
            fontWeight: 600,
            padding: mob ? "0 12px" : "0 20px",
            borderRadius: mob ? 6 : 10,
            background: NAVY,
            color: "#fff",
            border: "none",
            cursor: "pointer",
          }}
        >
          학생 등록
        </button>
      </div>

      <div style={{ background: "#fff", borderRadius: mob ? 8 : 16, border: `1px solid ${BORDER}`, overflowX: "auto" }}>
        <table className="w-full" style={{ borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", padding: mob ? "6px 8px" : "10px 14px", fontSize: mob ? 10 : 13, fontWeight: 700, color: NAVY, borderBottom: `2px solid ${NAVY}` }}>이름</th>
              <th style={{ textAlign: "left", padding: mob ? "6px 8px" : "10px 14px", fontSize: mob ? 10 : 13, fontWeight: 700, color: NAVY, borderBottom: `2px solid ${NAVY}` }}>반</th>
              <th style={{ textAlign: "left", padding: mob ? "6px 8px" : "10px 14px", fontSize: mob ? 10 : 13, fontWeight: 700, color: NAVY, borderBottom: `2px solid ${NAVY}` }}>역할</th>
              <th style={{ textAlign: "left", padding: mob ? "6px 8px" : "10px 14px", fontSize: mob ? 10 : 13, fontWeight: 700, color: NAVY, borderBottom: `2px solid ${NAVY}` }}>연락처</th>
              <th style={{ textAlign: "left", padding: mob ? "6px 8px" : "10px 14px", fontSize: mob ? 10 : 13, fontWeight: 700, color: NAVY, borderBottom: `2px solid ${NAVY}` }}>등록일</th>
              <th style={{ textAlign: "left", padding: mob ? "6px 8px" : "10px 14px", fontSize: mob ? 10 : 13, fontWeight: 700, color: NAVY, borderBottom: `2px solid ${NAVY}` }}>관리</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: mob ? 32 : 48, textAlign: "center", fontSize: mob ? 12 : 14, color: MUTED }}>등록된 학생이 없습니다.</td></tr>
            ) : (
              filtered.map((e, idx) => {
                const m = getMember(e);
                const cls = getClass(e.class_id);
                return (
                  <tr key={e.id} style={{ borderBottom: `1px solid ${ROW_LINE}`, background: idx % 2 === 1 ? "#fafbfc" : "#fff" }}>
                    <td style={{ padding: mob ? 8 : "12px 14px", fontSize: mob ? 11 : 14, color: TEXT }}>{m?.name ?? e.member_id}</td>
                    <td style={{ padding: mob ? 8 : "12px 14px", fontSize: mob ? 11 : 14, color: TEXT }}>{cls?.name ?? "-"}</td>
                    <td style={{ padding: mob ? 8 : "12px 14px", fontSize: mob ? 11 : 14, color: TEXT }}>{e.role}</td>
                    <td style={{ padding: mob ? 8 : "12px 14px", fontSize: mob ? 11 : 14, color: TEXT }}>{m?.phone ?? "-"}</td>
                    <td style={{ padding: mob ? 8 : "12px 14px", fontSize: mob ? 11 : 14, color: TEXT }}>{e.enrolled_date ?? "-"}</td>
                    <td style={{ padding: mob ? 8 : "12px 14px" }}>
                      <button
                        type="button"
                        onClick={() => { setEditOpen(e); setEditClassId(e.class_id ?? ""); setEditRole(e.role); }}
                        style={{ marginRight: 8, fontSize: mob ? 10 : 13, color: NAVY, border: `1px solid ${BORDER}`, borderRadius: mob ? 4 : 8, padding: mob ? "2px 8px" : "6px 12px", background: "#fff", cursor: "pointer" }}
                      >
                        수정
                      </button>
                      <button type="button" onClick={() => handleDelete(e)} style={{ fontSize: mob ? 10 : 13, color: TEXT, background: "transparent", border: "none", cursor: "pointer", textDecoration: "underline" }}>해제</button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {addOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 bg-black/30 flex items-center justify-center"
            style={{ zIndex: 10000 }}
            onClick={() => setAddOpen(false)}
          >
            <div
              className="bg-white rounded-xl p-6 max-w-sm w-full shadow-xl"
              style={{ position: "relative", zIndex: 10001 }}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="student-register-title"
            >
              <h4 id="student-register-title" className="font-semibold mb-4">학생 등록</h4>
              <label className="block text-sm font-medium text-gray-700 mb-1">성도</label>
              <select
                value={addMemberId}
                onChange={(e) => setAddMemberId(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm mb-3 min-h-[44px] cursor-pointer bg-white"
              >
                <option value="">선택</option>
                {(db.members ?? []).filter((m) => !enrollments.some((x) => x.member_id === m.id && x.department_id === addDeptId)).map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
              <label className="block text-sm font-medium text-gray-700 mb-1">부서</label>
              <select
                value={addDeptId}
                onChange={(e) => { setAddDeptId(e.target.value); setAddClassId(""); }}
                className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm mb-3 min-h-[44px] cursor-pointer bg-white"
              >
                <option value="">선택</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
              <label className="block text-sm font-medium text-gray-700 mb-1">반</label>
              <select
                value={addClassId}
                onChange={(e) => setAddClassId(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm mb-3 min-h-[44px] cursor-pointer bg-white"
              >
                <option value="">미배정</option>
                {classes.filter((c) => c.department_id === addDeptId).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <label className="block text-sm font-medium text-gray-700 mb-1">역할</label>
              <select
                value={addRole}
                onChange={(e) => setAddRole(e.target.value as typeof addRole)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm mb-4 min-h-[44px] cursor-pointer bg-white"
              >
                <option value="학생">학생</option>
                <option value="교사">교사</option>
                <option value="부교사">부교사</option>
                <option value="부장">부장</option>
                <option value="총무">총무</option>
              </select>
              <div className="flex gap-2">
                <button type="button" onClick={() => setAddOpen(false)} className="flex-1 py-2 rounded-lg border border-gray-200 text-sm">취소</button>
                <button type="button" onClick={handleRegister} className="flex-1 py-2 rounded-lg text-white text-sm font-semibold" style={{ background: NAVY }}>등록</button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {editOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 bg-black/30 flex items-center justify-center"
            style={{ zIndex: 10000 }}
            onClick={() => setEditOpen(null)}
          >
            <div
              className="bg-white rounded-xl p-6 max-w-sm w-full shadow-xl"
              style={{ position: "relative", zIndex: 10001 }}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <h4 className="font-semibold mb-4">등록 수정 — {getMember(editOpen)?.name ?? editOpen.member_id}</h4>
              <label className="block text-sm font-medium text-gray-700 mb-1">반</label>
              <select
                value={editClassId}
                onChange={(e) => setEditClassId(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm mb-3 min-h-[44px] cursor-pointer bg-white"
              >
                <option value="">미배정</option>
                {classes.filter((c) => c.department_id === editOpen.department_id).map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <label className="block text-sm font-medium text-gray-700 mb-1">역할</label>
              <select
                value={editRole}
                onChange={(e) => setEditRole(e.target.value as typeof editRole)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm mb-4 min-h-[44px] cursor-pointer bg-white"
              >
                <option value="학생">학생</option>
                <option value="교사">교사</option>
                <option value="부교사">부교사</option>
                <option value="부장">부장</option>
                <option value="총무">총무</option>
              </select>
              <div className="flex gap-2">
                <button type="button" onClick={() => handleDelete(editOpen)} className="py-2 rounded-lg border border-red-200 text-red-600 text-sm">등록 해제</button>
                <button type="button" onClick={() => setEditOpen(null)} className="flex-1 py-2 rounded-lg border border-gray-200 text-sm">취소</button>
                <button type="button" onClick={handleUpdate} className="flex-1 py-2 rounded-lg text-white text-sm font-semibold" style={{ background: NAVY }}>저장</button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
