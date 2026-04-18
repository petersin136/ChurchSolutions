"use client";

import { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import type { DB } from "@/types/db";
import type { SchoolDepartment, SchoolClass, SchoolEnrollment } from "@/types/db";
import { supabase } from "@/lib/supabase";
import { getChurchId } from "@/lib/tenant";
import { useAppData } from "@/contexts/AppDataContext";
import { CalendarDropdown } from "@/components/CalendarDropdown";

function getLastSunday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  if (day !== 0) d.setDate(d.getDate() - day);
  return d;
}
function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getWeekNumForDate(dateStr: string): number {
  const d = new Date(dateStr + "T12:00:00");
  const s = new Date(d.getFullYear(), 0, 1);
  return Math.ceil(((d.getTime() - s.getTime()) / 864e5 + s.getDay() + 1) / 7);
}

type AttStatus = "출석" | "결석";

type EnrollmentWithMember = SchoolEnrollment & { members?: { id: string; name: string }; member?: { id: string; name: string } };

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
        border: "1px solid #c7d0e8",
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
  const { refreshAttendance } = useAppData();
  const todaySunday = useMemo(() => toDateStr(getLastSunday(new Date())), []);
  const [date, setDate] = useState(todaySunday);
  const handleDateChange = useCallback((dateStr: string) => {
    const d = new Date(dateStr + "T12:00:00");
    const sunday = getLastSunday(d);
    setDate(toDateStr(sunday));
  }, []);

  const [departments, setDepartments] = useState<SchoolDepartment[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [enrollments, setEnrollments] = useState<EnrollmentWithMember[]>([]);
  const [selectedDeptId, setSelectedDeptId] = useState<string | null>(null);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [searchName, setSearchName] = useState("");
  const [statusMap, setStatusMap] = useState<Record<string, AttStatus>>({});
  const [noteMap, setNoteMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [streakMap, setStreakMap] = useState<Record<string, number>>({});
  const statusMapRef = useRef(statusMap);
  statusMapRef.current = statusMap;
  const noteMapRef = useRef(noteMap);
  noteMapRef.current = noteMap;
  const noteTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

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
    if (error) {
      toast("등록 목록 로드 실패: " + error.message, "err");
      return;
    }
    setEnrollments((data as EnrollmentWithMember[]) ?? []);
  };

  const loadAttendance = async () => {
    if (!supabase || enrollments.length === 0) return;
    const memberIds = enrollments.map((e) => e.member_id);
    const { data, error } = await supabase
      .from("attendance")
      .select("member_id, status, note")
      .in("member_id", memberIds)
      .eq("date", date)
      .eq("service_type", "주일예배")
      .eq("church_id", getChurchId());
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

  /** 연속출석 계산용: 최근 16주 일요일 날짜 */
  const recentSundays = useMemo(() => {
    const out: string[] = [];
    let d = new Date(date + "T12:00:00");
    for (let i = 0; i < 16; i++) {
      const sun = getLastSunday(d);
      out.push(toDateStr(sun));
      d.setDate(d.getDate() - 7);
    }
    return out;
  }, [date]);

  const loadStreaks = useCallback(async () => {
    if (!supabase || enrollments.length === 0) return;
    const memberIds = [...new Set(enrollments.map((e) => e.member_id))];
    const { data, error } = await supabase
      .from("attendance")
      .select("member_id, date, status")
      .in("member_id", memberIds)
      .in("date", recentSundays)
      .eq("service_type", "주일예배")
      .eq("church_id", getChurchId());
    if (error) return;
    const byMember: Record<string, Record<string, string>> = {};
    memberIds.forEach((id) => { byMember[id] = {}; });
    (data ?? []).forEach((r: { member_id: string; date: string; status: string }) => {
      if (byMember[r.member_id]) byMember[r.member_id][r.date] = r.status;
    });
    const streaks: Record<string, number> = {};
    memberIds.forEach((id) => {
      let count = 0;
      for (const d of recentSundays) {
        if (byMember[id]?.[d] === "p") count++;
        else break;
      }
      streaks[id] = count;
    });
    setStreakMap(streaks);
  }, [enrollments, date, recentSundays]);

  useEffect(() => {
    if (enrollments.length > 0) loadStreaks();
    else setStreakMap({});
  }, [enrollments.length, date, loadStreaks]);

  useEffect(() => {
    setLoading(true);
    loadDeptsAndClasses().finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadEnrollments();
  }, [selectedDeptId, selectedClassId]);

  useEffect(() => {
    if (enrollments.length > 0) loadAttendance();
    else {
      setStatusMap({});
      setNoteMap({});
    }
  }, [date, enrollments]);

  const setStatus = (memberId: string, status: AttStatus) => {
    setStatusMap((prev) => ({ ...prev, [memberId]: status }));
  };

  const setNote = (memberId: string, value: string) => {
    setNoteMap((prev) => ({ ...prev, [memberId]: value }));
  };

  const saveOneAttendance = useCallback(async (memberId: string, newStatus: AttStatus, noteOverride?: string) => {
    if (!supabase) return;
    setSaving(true);
    setSaved(false);
    setSaveError(false);
    const now = new Date(date + "T12:00:00");
    const yearVal = now.getFullYear();
    const startOfYear = new Date(yearVal, 0, 1);
    const wn = Math.ceil(((now.getTime() - startOfYear.getTime()) / 864e5 + startOfYear.getDay() + 1) / 7);
    const note = newStatus === "결석" ? ((noteOverride ?? noteMapRef.current[memberId])?.trim() || null) : null;
    const churchId = getChurchId();
    const { error } = await supabase.from("attendance").upsert([{
      member_id: memberId,
      week_num: wn,
      year: yearVal,
      date,
      service_type: "주일예배",
      status: newStatus === "출석" ? "p" : "a",
      check_in_time: new Date().toISOString(),
      check_in_method: "수동" as const,
      note: note as string | null,
      church_id: churchId,
    }], { onConflict: "member_id,date,service_type" });
    if (error) {
      setSaveError(true);
      setSaving(false);
      return;
    }
    refreshAttendance();
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }, [date, refreshAttendance]);

  const handleNoteChange = useCallback((memberId: string, value: string) => {
    setNoteMap((prev) => ({ ...prev, [memberId]: value }));
    if (noteTimersRef.current[memberId]) clearTimeout(noteTimersRef.current[memberId]);
    noteTimersRef.current[memberId] = setTimeout(() => {
      saveOneAttendance(memberId, statusMapRef.current[memberId] ?? "출석", value);
    }, 800);
  }, [saveOneAttendance]);

  useEffect(() => {
    return () => { Object.values(noteTimersRef.current).forEach(clearTimeout); };
  }, []);

  const getMemberName = (e: EnrollmentWithMember) =>
    e.members?.name ?? e.member?.name ?? db.members?.find((m) => m.id === e.member_id)?.name ?? e.member_id;

  const handleSave = async () => {
    if (!supabase || enrollments.length === 0) {
      toast("저장할 대상이 없습니다", "warn");
      return;
    }
    setSaving(true);
    try {
      const now = new Date(date + "T12:00:00");
      const yearVal = now.getFullYear();
      const startOfYear = new Date(yearVal, 0, 1);
      const weekNum = Math.ceil(((now.getTime() - startOfYear.getTime()) / 864e5 + startOfYear.getDay() + 1) / 7);
      const churchId = getChurchId();
      const rows = enrollments.map((e) => {
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
          church_id: churchId,
        };
      });
      const uniqueRows = Array.from(new Map(rows.map((r) => [r.member_id, r])).values());
      const { error } = await supabase.from("attendance").upsert(uniqueRows, {
        onConflict: "member_id,date,service_type",
      });
      if (error) {
        toast("저장 실패: " + error.message, "err");
        return;
      }

      refreshAttendance();
      toast("출석이 저장되었습니다", "ok");
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      await loadAttendance();
    } catch (err) {
      console.error(err);
      toast("저장 실패", "err");
    } finally {
      setSaving(false);
    }
  };

  const filteredEnrollments = useMemo(() => {
    if (!searchName.trim()) return enrollments;
    const q = searchName.trim().toLowerCase();
    return enrollments.filter((e) => {
      const name = e.members?.name ?? e.member?.name ?? db.members?.find((m) => m.id === e.member_id)?.name ?? e.member_id ?? "";
      return (name || "").toLowerCase().includes(q);
    });
  }, [enrollments, searchName, db.members]);

  const count출석 = filteredEnrollments.filter((e) => (statusMap[e.member_id] ?? "출석") === "출석").length;
  const count결석 = filteredEnrollments.length - count출석;

  const getMemberPhoto = (e: EnrollmentWithMember) => db.members?.find((m) => m.id === e.member_id)?.photo;
  const getClassName = (e: EnrollmentWithMember) => (e.class_id ? classes.find((c) => c.id === e.class_id)?.name : null) ?? "-";

  const toggleAttendance = useCallback((memberId: string, newStatus: AttStatus) => {
    setStatusMap((prev) => ({ ...prev, [memberId]: newStatus }));
    saveOneAttendance(memberId, newStatus);
  }, [saveOneAttendance]);

  return (
    <div className="space-y-4">
      <div className="space-y-3 bg-white rounded-lg border p-3 md:p-4 -mx-3 md:mx-0 px-3 md:px-4" style={{ borderColor: "#c7d0e8" }}>
        <div className="flex flex-wrap md:flex-nowrap items-center gap-3 md:gap-4">
          <label className="flex items-center gap-2 shrink-0">
            <span className="text-xs md:text-sm text-gray-600 whitespace-nowrap">날짜</span>
            <div className="min-w-[160px] md:min-w-[180px]">
              <CalendarDropdown
                value={date}
                onChange={handleDateChange}
                compact
                style={{ marginBottom: 0 }}
              />
            </div>
          </label>
          <span
            className="text-xs md:text-sm font-semibold px-3 py-2 rounded-md"
            style={{ color: "#2563eb", background: "#f0f2f5" }}
          >
            주일예배
          </span>
          {selectedDeptId && (
            <PortalSelect
              id="school-attendance-class"
              label="반"
              placeholder="전체"
              value={selectedClassId ?? ""}
              onChange={(v) => setSelectedClassId(v || null)}
              options={classes.filter((c) => c.department_id === selectedDeptId).map((c) => ({ value: c.id, label: c.name }))}
            />
          )}
          <label className="flex items-center gap-2 shrink-0">
            <span className="text-xs md:text-sm text-gray-600 whitespace-nowrap">이름 검색</span>
            <input
              type="search"
              placeholder="이름 검색"
              value={searchName}
              onChange={(e) => setSearchName(e.target.value)}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm w-28 md:w-40 min-h-[36px] md:min-h-0"
            />
          </label>
        </div>
        {/* 부서 탭 - 목양과 동일한 스타일 */}
        <div
          className="flex overflow-x-auto gap-2 pb-2 [&::-webkit-scrollbar]:hidden"
          style={{ scrollbarWidth: "thin", msOverflowStyle: "none" }}
        >
          {[{ id: null, name: "전체" }, ...departments].map((dept) => {
            const on = (!dept.id && !selectedDeptId) || selectedDeptId === dept.id;
            return (
              <button
                key={dept.id ?? "전체"}
                type="button"
                onClick={() => { setSelectedDeptId(dept.id); setSelectedClassId(null); }}
                style={{
                  height: 28,
                  padding: "0 12px",
                  fontSize: 11,
                  fontWeight: 600,
                  borderRadius: 6,
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                  border: on ? "none" : "1px solid #c7d0e8",
                  background: on ? "#2563eb" : "#f5f8ff",
                  color: on ? "#fff" : "#555",
                  cursor: "pointer",
                }}
              >
                {dept.name}
              </button>
            );
          })}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 bg-white rounded-lg border" style={{ borderColor: "#c7d0e8" }}>
          <span
            className="inline-block w-6 h-6 rounded-full animate-spin"
            style={{ border: "2px solid #c7d0e8", borderTopColor: "#2563eb" }}
          />
          <span className="ml-2" style={{ fontSize: 12, color: "#999" }}>출석 데이터 로딩 중...</span>
        </div>
      ) : (
        <div className="overflow-x-auto -mx-3 md:mx-0 px-3 md:px-0 bg-white rounded-lg border" style={{ borderColor: "#c7d0e8" }}>
          <table className="w-full min-w-[320px]" style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th className="text-left py-2 px-3 md:px-4 text-[10px] md:text-xs font-bold" style={{ color: "#2563eb", borderBottom: "2px solid #2563eb" }}>교인</th>
                <th className="text-left py-2 px-3 md:px-4 text-[10px] md:text-xs font-bold" style={{ color: "#2563eb", borderBottom: "2px solid #2563eb" }}>역할</th>
                <th className="text-left py-2 px-3 md:px-4 text-[10px] md:text-xs font-bold" style={{ color: "#2563eb", borderBottom: "2px solid #2563eb" }}>반</th>
                <th className="text-center py-2 px-3 md:px-4 text-[10px] md:text-xs font-bold" style={{ color: "#2563eb", borderBottom: "2px solid #2563eb" }}>출석 상태</th>
                <th className="text-left py-2 px-3 md:px-4 text-[10px] md:text-xs font-bold" style={{ color: "#2563eb", borderBottom: "2px solid #2563eb" }}>사유</th>
                <th className="text-left py-2 px-3 md:px-4 text-[10px] md:text-xs font-bold" style={{ color: "#2563eb", borderBottom: "2px solid #2563eb" }}>연속출석</th>
              </tr>
            </thead>
            <tbody>
              {filteredEnrollments.length === 0 ? (
                <tr><td colSpan={6} className="py-8 text-center text-gray-500">등록된 학생이 없거나 검색 결과가 없습니다.</td></tr>
              ) : (
                filteredEnrollments.map((e) => {
                  const status = statusMap[e.member_id] ?? "출석";
                  const isAbsent = status === "결석";
                  const photo = getMemberPhoto(e);
                  const streak = streakMap[e.member_id] ?? 0;
                  return (
                    <tr key={e.id} className="min-h-[48px]" style={{ borderBottom: "1px solid #f0f2f5" }}>
                      <td className="py-3 px-3 md:px-4 flex items-center gap-2 md:gap-3 min-h-[48px]">
                        <div
                          className="w-8 h-8 md:w-9 md:h-9 rounded-full bg-gray-200 flex-shrink-0 bg-cover bg-center"
                          style={{ backgroundImage: photo ? `url(${photo})` : undefined }}
                        />
                        <span className="font-medium whitespace-nowrap overflow-hidden text-ellipsis max-w-[100px] md:max-w-none">{getMemberName(e)}</span>
                      </td>
                      <td className="py-3 px-3 md:px-4 text-gray-600 text-xs md:text-sm whitespace-nowrap overflow-hidden text-ellipsis max-w-[60px] md:max-w-none">{e.role ?? "-"}</td>
                      <td className="py-3 px-3 md:px-4 text-gray-600 text-xs md:text-sm whitespace-nowrap overflow-hidden text-ellipsis max-w-[60px] md:max-w-none">{getClassName(e)}</td>
                      <td className="py-3 px-3 md:px-4">
                        <div className="flex flex-wrap gap-2 justify-center">
                          <button
                            type="button"
                            onClick={() => toggleAttendance(e.member_id, "출석")}
                            style={{
                              padding: "6px 12px",
                              borderRadius: 6,
                              fontSize: 11,
                              fontWeight: 600,
                              border: status === "출석" ? "none" : "1px solid #c7d0e8",
                              background: status === "출석" ? "#2563eb" : "#f5f8ff",
                              color: status === "출석" ? "#fff" : "#555",
                            }}
                          >
                            출석
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleAttendance(e.member_id, "결석")}
                            style={{
                              padding: "6px 12px",
                              borderRadius: 6,
                              fontSize: 11,
                              fontWeight: 600,
                              border: status === "결석" ? "none" : "1px solid #c7d0e8",
                              background: status === "결석" ? "#2563eb" : "#f5f8ff",
                              color: status === "결석" ? "#fff" : "#555",
                            }}
                          >
                            결석
                          </button>
                        </div>
                      </td>
                      <td className="py-3 px-3 md:px-4">
                        <input
                          type="text"
                          placeholder="사유 (선택)"
                          value={noteMap[e.member_id] ?? ""}
                          onChange={(ev) => handleNoteChange(e.member_id, ev.target.value)}
                          disabled={!isAbsent}
                          className="px-3 py-1.5 text-sm rounded-md w-40"
                          style={{
                            border: "1px solid #c7d0e8",
                            background: isAbsent ? "#fff" : "#f5f8ff",
                            color: isAbsent ? "#555" : "#999",
                          }}
                        />
                      </td>
                      <td className="py-3 px-3 md:px-4 text-gray-600 text-xs md:text-sm">
                        {streak > 0 ? (
                          <span
                            className="inline-flex items-center rounded px-2 py-0.5 text-[10px] font-semibold"
                            style={{ background: "#f0f2f5", color: "#2563eb" }}
                          >
                            {streak}주 연속
                          </span>
                        ) : "-"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      <div className="sticky bottom-0 left-0 right-0 bg-white/95 backdrop-blur border-t p-4 flex flex-wrap items-center justify-between gap-4 rounded-t-lg" style={{ borderColor: "#c7d0e8" }}>
        <div className="flex gap-4 text-sm" style={{ color: "#555" }}>
          <span>출석 <strong style={{ color: "#2563eb" }}>{count출석}명</strong></span>
          <span>결석 <strong style={{ color: "#2563eb" }}>{count결석}명</strong></span>
          <span style={{ color: "#999" }}>/ 전체 {filteredEnrollments.length}명</span>
        </div>
        <div className="text-sm">
          {saving ? (
            <span className="flex items-center gap-1" style={{ color: "#999" }}>
              <span className="inline-block w-3 h-3 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "#6b7b9e", borderTopColor: "transparent" }} />
              저장 중...
            </span>
          ) : saved ? (
            <span style={{ color: "#2563eb", fontWeight: 600 }}>자동 저장됨</span>
          ) : saveError ? (
            <span style={{ color: "#555" }}>저장 실패 - 다시 시도해주세요</span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
