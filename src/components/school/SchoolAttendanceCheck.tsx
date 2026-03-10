"use client";

import { useState, useEffect, useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";
import type { DB } from "@/types/db";
import type { SchoolDepartment, SchoolClass, SchoolEnrollment } from "@/types/db";
import { supabase } from "@/lib/supabase";
import { getChurchId, withChurchId } from "@/lib/tenant";


type AttStatus = "출석" | "결석";

type EnrollmentWithMember = SchoolEnrollment & { members?: { id: string; name: string }; member?: { id: string; name: string } };

type DeptSummary = {
  department_id: string;
  name: string;
  studentCount: number;
  checked: boolean;
  출석: number;
  결석: number;
};

/** overflow에 가리지 않도록 포털로 옵션을 띄우는 드롭다운 (부서/반 select 대체) */
function PortalSelect({
  id,
  options,
  value,
  onChange,
  placeholder,
  label,
}: {
  id: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number; width: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  const selected = value ? options.find((o) => o.value === value) : null;
  const displayText = selected ? selected.label : placeholder;

  useEffect(() => {
    if (!open) return;
    const onDocMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (btnRef.current?.contains(target) || listRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDocMouseDown, true);
    return () => document.removeEventListener("mousedown", onDocMouseDown, true);
  }, [open]);

  useLayoutEffect(() => {
    if (open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setPosition({ top: rect.bottom + 4, left: rect.left, width: rect.width });
    } else {
      setPosition(null);
    }
  }, [open]);

  const listStyle: React.CSSProperties = position
    ? {
        position: "fixed",
        left: position.left,
        top: position.top,
        minWidth: position.width,
        zIndex: 9999,
        background: "#fff",
        border: "1px solid #e5e7eb",
        borderRadius: 8,
        boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
        maxHeight: 280,
        overflowY: "auto",
      }
    : { position: "fixed" as const, left: -9999, top: 0, zIndex: 9999, visibility: "hidden" as const };

  return (
    <div className="flex items-center gap-2" style={{ position: "relative", zIndex: 10 }}>
      <span className="text-sm font-medium" id={`${id}-label`}>{label}</span>
      <button
        ref={btnRef}
        id={id}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        className="rounded-lg border border-gray-200 px-3 py-2 text-sm min-w-[120px] min-h-[44px] cursor-pointer text-left flex items-center justify-between gap-2 bg-white hover:bg-gray-50"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={`${id}-label`}
      >
        <span className="truncate">{displayText}</span>
        <span className="flex-shrink-0 text-gray-400" aria-hidden>▼</span>
      </button>
      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div ref={(el) => { listRef.current = el; }} style={listStyle} role="listbox">
            <button
              type="button"
              role="option"
              className="w-full text-left px-3 py-2.5 text-sm hover:bg-gray-100 first:rounded-t-lg last:rounded-b-lg"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
            >
              {placeholder}
            </button>
            {options.map((o) => (
              <button
                key={o.value}
                type="button"
                role="option"
                className="w-full text-left px-3 py-2.5 text-sm hover:bg-gray-100 first:rounded-t-lg last:rounded-b-lg"
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
              >
                {o.label}
              </button>
            ))}
          </div>,
          document.body
        )}
    </div>
  );
}

export interface SchoolAttendanceCheckProps {
  db: DB;
  toast: (msg: string, type?: "ok" | "err" | "warn") => void;
}

export function SchoolAttendanceCheck({ db, toast }: SchoolAttendanceCheckProps) {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [departments, setDepartments] = useState<SchoolDepartment[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [enrollments, setEnrollments] = useState<EnrollmentWithMember[]>([]);
  const [selectedDeptId, setSelectedDeptId] = useState<string | null>(null);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [statusMap, setStatusMap] = useState<Record<string, AttStatus>>({});
  const [noteMap, setNoteMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deptSummaries, setDeptSummaries] = useState<DeptSummary[]>([]);
  const [summaryLoading, setSummaryLoading] = useState(false);

  const loadDeptsAndClasses = async () => {
    if (!supabase) return;
    const { data: depts, error: deptsErr } = await supabase
      .from("school_departments")
      .select("*")
      .order("sort_order");
    console.log("[SchoolAttendanceCheck] departments query result:", depts, deptsErr);
    if (deptsErr) {
      toast("부서/반 로드 실패: " + deptsErr.message, "err");
      return;
    }
    const list = (depts as SchoolDepartment[]) ?? [];
    setDepartments(list.filter((d) => d.is_active !== false));
    const { data: cls, error: clsErr } = await supabase
      .from("school_classes")
      .select("*")
      .order("sort_order");
    console.log("[SchoolAttendanceCheck] classes query result:", cls, clsErr);
    if (clsErr) {
      toast("반 목록 로드 실패: " + clsErr.message, "err");
      return;
    }
    const clsList = (cls as SchoolClass[]) ?? [];
    setClasses(clsList.filter((c) => c.is_active !== false));
  };

  const loadEnrollments = async () => {
    if (!supabase) return;
    let q = supabase
      .from("school_enrollments")
      .select("*, members(id, name)")
      .eq("is_active", true)
      .in("role", ["학생", "교사", "부교사"]);
    if (selectedDeptId) q = q.eq("department_id", selectedDeptId);
    if (selectedClassId) q = q.eq("class_id", selectedClassId);
    const { data, error } = await q;
    console.log("[SchoolAttendanceCheck] enrollments query result:", data, error);
    if (error) {
      toast("등록 목록 로드 실패: " + error.message, "err");
      return;
    }
    setEnrollments((data as EnrollmentWithMember[]) ?? []);
  };

  const loadAttendance = async () => {
    if (!supabase || !selectedDeptId || enrollments.length === 0) return;
    const memberIds = enrollments.map((e) => e.member_id);
    console.log("[SchoolAtt] 선택 부서:", selectedDeptId);
    console.log("[SchoolAtt] enrollments:", enrollments);
    console.log("[SchoolAtt] memberIds:", memberIds);
    const { data, error } = await supabase
      .from("attendance")
      .select("member_id, status, note")
      .in("member_id", memberIds)
      .eq("date", date)
      .eq("service_type", "주일예배")
      .eq("church_id", getChurchId());
    console.log("[SchoolAtt] attendance 쿼리 결과:", data, error);
    if (error) {
      toast("출석 로드 실패: " + error.message, "err");
      return;
    }
    const map: Record<string, AttStatus> = {};
    const notes: Record<string, string> = {};
    (data ?? []).forEach((r: { member_id: string; status: string; note?: string }) => {
      map[r.member_id] = r.status === "p" ? "출석" : "결석";
      if (r.note) notes[r.member_id] = r.note;
    });
    setStatusMap(map);
    setNoteMap(notes);
  };

  useEffect(() => {
    setLoading(true);
    loadDeptsAndClasses().finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadEnrollments();
  }, [selectedDeptId, selectedClassId]);

  useEffect(() => {
    if (selectedDeptId && enrollments.length > 0) loadAttendance();
    else {
      setStatusMap({});
      setNoteMap({});
    }
  }, [selectedDeptId, date, enrollments]);

  const loadAllDeptSummaries = async () => {
    if (!supabase || departments.length === 0) {
      setDeptSummaries([]);
      return;
    }
    setSummaryLoading(true);
    try {
      const { data: enrolls, error: enrollsErr } = await supabase
        .from("school_enrollments")
        .select("department_id, member_id")
        .eq("is_active", true)
        .in("role", ["학생", "교사", "부교사"]);
      if (enrollsErr) {
        setDeptSummaries([]);
        return;
      }
      const countByDept: Record<string, number> = {};
      const memberToDept: Record<string, string> = {};
      (enrolls ?? []).forEach((r: { department_id: string; member_id: string }) => {
        countByDept[r.department_id] = (countByDept[r.department_id] ?? 0) + 1;
        memberToDept[r.member_id] = r.department_id;
      });
      const memberIds = Object.keys(memberToDept);
      if (memberIds.length === 0) {
        setDeptSummaries(
          departments.map((d) => ({
            department_id: d.id,
            name: d.name,
            studentCount: countByDept[d.id] ?? 0,
            checked: false,
            출석: 0,
            결석: 0,
          }))
        );
        return;
      }

      const { data: att, error: attErr } = await supabase
        .from("attendance")
        .select("member_id, status")
        .in("member_id", memberIds)
        .eq("date", date)
        .eq("service_type", "주일예배")
        .eq("church_id", getChurchId());
      if (attErr) {
        setDeptSummaries(
          departments.map((d) => ({
            department_id: d.id,
            name: d.name,
            studentCount: countByDept[d.id] ?? 0,
            checked: false,
            출석: 0,
            결석: 0,
          }))
        );
        return;
      }
      const attByDept: Record<string, { 출석: number; 결석: number }> = {};
      (att ?? []).forEach((r: { member_id: string; status: string }) => {
        const deptId = memberToDept[r.member_id];
        if (!deptId) return;
        if (!attByDept[deptId]) attByDept[deptId] = { 출석: 0, 결석: 0 };
        if (r.status === "p") attByDept[deptId].출석++;
        else attByDept[deptId].결석++;
      });

      setDeptSummaries(
        departments.map((d) => {
          const studentCount = countByDept[d.id] ?? 0;
          const rec = attByDept[d.id];
          const 출석 = rec?.출석 ?? 0;
          const 결석 = rec?.결석 ?? 0;
          const totalChecked = 출석 + 결석;
          const checked = studentCount > 0 && totalChecked >= studentCount;
          return {
            department_id: d.id,
            name: d.name,
            studentCount,
            checked,
            출석,
            결석,
          };
        })
      );
    } finally {
      setSummaryLoading(false);
    }
  };

  useEffect(() => {
    if (!selectedDeptId && departments.length > 0) loadAllDeptSummaries();
    else setDeptSummaries([]);
  }, [selectedDeptId, date, departments]);

  const setStatus = (memberId: string, status: AttStatus) => {
    setStatusMap((prev) => ({ ...prev, [memberId]: status }));
  };

  const setNote = (memberId: string, value: string) => {
    setNoteMap((prev) => ({ ...prev, [memberId]: value }));
  };

  const getMemberName = (e: EnrollmentWithMember) =>
    e.members?.name ?? e.member?.name ?? db.members?.find((m) => m.id === e.member_id)?.name ?? e.member_id;

  const handleSave = async () => {
    if (!supabase || !selectedDeptId) {
      toast("부서를 선택하세요", "warn");
      return;
    }
    setSaving(true);
    try {
      const now = new Date(date + "T12:00:00");
      const yearVal = now.getFullYear();
      const startOfYear = new Date(yearVal, 0, 1);
      const weekNum = Math.ceil(((now.getTime() - startOfYear.getTime()) / 864e5 + startOfYear.getDay() + 1) / 7);
      const rows = withChurchId(enrollments.map((e) => {
        const st = statusMap[e.member_id] ?? "출석";
        const note = st === "결석" ? (noteMap[e.member_id]?.trim() || null) : null;
        return {
          member_id: e.member_id,
          week_num: weekNum,
          year: yearVal,
          date,
          service_type: "주일예배",
          status: st === "출석" ? "p" : "a",
          check_in_time: new Date().toISOString(),
          check_in_method: "수동" as const,
          note: note as string | null,
        };
      }));
      const { error } = await supabase.from("attendance").upsert(rows, {
        onConflict: "member_id,date,service_type",
      });
      if (error) {
        toast("저장 실패: " + error.message, "err");
        return;
      }

      toast("출석이 저장되었습니다", "ok");
      await loadAttendance();
    } catch (err) {
      console.error(err);
      toast("저장 실패", "err");
    } finally {
      setSaving(false);
    }
  };

  const count출석 = enrollments.filter((e) => (statusMap[e.member_id] ?? "출석") === "출석").length;
  const count결석 = enrollments.length - count출석;

  if (loading) return <div className="p-6 text-gray-500">로딩 중...</div>;

  return (
    <div className="space-y-4">
      <div className="space-y-3 bg-white rounded-xl border border-gray-100 p-4">
        <div className="flex flex-wrap gap-4 items-center">
          <label className="flex items-center gap-2">
            <span className="text-sm font-medium">날짜</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-lg border border-gray-200 px-3 py-2 text-sm" />
          </label>
          <PortalSelect
            id="school-attendance-class"
            label="반"
            placeholder="전체"
            value={selectedClassId ?? ""}
            onChange={(v) => setSelectedClassId(v || null)}
            options={classes.filter((c) => c.department_id === selectedDeptId).map((c) => ({ value: c.id, label: c.name }))}
          />
        </div>
        {/* 부서 탭 - 드롭다운 제거하고 pill 탭으로 교체 */}
        <div
          className="flex overflow-x-auto gap-2 pb-2 [&::-webkit-scrollbar]:hidden"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {[{ id: null, name: "전체" }, ...departments].map((dept) => (
            <button
              key={dept.id ?? "전체"}
              type="button"
              onClick={() => {
                setSelectedDeptId(dept.id);
                setSelectedClassId(null);
              }}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                (!dept.id && !selectedDeptId) || selectedDeptId === dept.id
                  ? "bg-slate-800 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {dept.name}
            </button>
          ))}
        </div>
      </div>

      {selectedDeptId && (
        <>
          <div className="flex gap-4 text-sm text-gray-600">
            <span>출석 <strong className="text-slate-800">{count출석}명</strong></span>
            <span>결석 <strong className="text-slate-800">{count결석}명</strong></span>
            <span className="text-gray-400">/ 전체 {enrollments.length}명</span>
          </div>

          <div className="space-y-2">
            {enrollments.length === 0 ? (
              <p className="text-gray-500 text-center py-8">등록된 학생이 없습니다.</p>
            ) : (
              enrollments.map((e) => {
                const current = statusMap[e.member_id] ?? "출석";
                const isAbsent = current === "결석";
                return (
                  <div key={e.id} className="flex items-center gap-3 bg-white rounded-xl border border-gray-100 p-3">
                    <span className="font-medium shrink-0">{getMemberName(e)}</span>
                    <div className="flex gap-2 shrink-0 ml-auto">
                      <button
                        type="button"
                        onClick={() => setStatus(e.member_id, "출석")}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${current === "출석" ? "bg-slate-800 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                      >
                        출석
                      </button>
                      <button
                        type="button"
                        onClick={() => setStatus(e.member_id, "결석")}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${current === "결석" ? "bg-slate-800 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                      >
                        결석
                      </button>
                    </div>
                    <input
                      type="text"
                      placeholder="사유 (선택)"
                      value={noteMap[e.member_id] ?? ""}
                      onChange={(ev) => setNote(e.member_id, ev.target.value)}
                      disabled={!isAbsent}
                      className={`px-3 py-1.5 text-sm border border-gray-200 rounded-lg w-40 shrink-0 ${isAbsent ? "bg-white" : "bg-gray-50 text-gray-400"}`}
                    />
                  </div>
                );
              })
            )}
          </div>

          <div className="sticky bottom-4 flex items-center justify-between bg-white rounded-xl border border-gray-200 p-4 shadow-lg">
            <div className="flex gap-4 text-sm text-gray-600">
              <span>출석 <strong className="text-slate-800">{count출석}명</strong></span>
              <span>결석 <strong className="text-slate-800">{count결석}명</strong></span>
              <span className="text-gray-400">/ 전체 {enrollments.length}명</span>
            </div>
            <button type="button" onClick={handleSave} disabled={saving} className="px-6 py-2 rounded-xl text-white font-semibold disabled:opacity-50 bg-slate-800 hover:bg-slate-700">
              {saving ? "저장 중…" : "저장"}
            </button>
          </div>
        </>
      )}

      {!selectedDeptId && (
        <>
          {summaryLoading ? (
            <p className="text-gray-500 text-center py-8">부서별 현황 로딩 중...</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {deptSummaries.map((dept) => (
                <button
                  key={dept.department_id}
                  type="button"
                  onClick={() => setSelectedDeptId(dept.department_id)}
                  className="p-5 bg-white border border-gray-200 rounded-xl text-left hover:border-slate-400 hover:shadow-sm transition-all"
                >
                  <h3 className="font-semibold text-slate-800 text-lg">{dept.name}</h3>
                  <div className="mt-2 text-sm text-gray-500">
                    등록 학생: {dept.studentCount}명
                  </div>
                  <div className="mt-1 text-sm">
                    {dept.checked ? (
                      <span className="text-slate-700">출석 {dept.출석}명 / 결석 {dept.결석}명</span>
                    ) : (
                      <span className="text-orange-500">미체크</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
