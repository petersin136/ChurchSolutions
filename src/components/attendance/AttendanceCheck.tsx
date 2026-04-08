"use client";

import { useMemo, useState, useCallback, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { getChurchId } from "@/lib/tenant";
import type { Member } from "@/types/db";
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

const STATUSES = ["출석", "결석"] as const;
type AttStatusUI = (typeof STATUSES)[number];

/** DB: p=출석, a=결석. 기존 o/l/n은 로드 시 결석으로 매핑 */
const UI_TO_DB_STATUS: Record<AttStatusUI, "p" | "a"> = {
  출석: "p",
  결석: "a",
};
const DB_TO_UI_STATUS: Record<string, AttStatusUI> = {
  p: "출석",
  a: "결석",
  o: "결석",
  l: "결석",
  n: "결석",
};

export interface AttendanceCheckProps {
  members: Member[];
  /** 토스트 (Supabase 저장 결과) */
  toast: (msg: string, type?: "ok" | "err" | "warn") => void;
  getCurrentUserId?: () => string | null;
  /** 출석 저장 성공 후 호출 (성도 관리 등 다른 화면에 즉시 반영용) */
  onAttendanceSaved?: () => void;
}

function getActiveMembers(members: Member[]) {
  return members.filter((m) => (m.member_status || m.status) === "활동" || !m.member_status);
}

function useIsMobile(bp = 768) {
  const [mob, setMob] = useState(false);
  useEffect(() => {
    const q = () => setMob(window.innerWidth <= bp);
    q();
    window.addEventListener("resize", q);
    return () => window.removeEventListener("resize", q);
  }, [bp]);
  return mob;
}

export function AttendanceCheck({
  members,
  toast,
  getCurrentUserId,
  onAttendanceSaved,
}: AttendanceCheckProps) {
  const mob = useIsMobile();
  const SERVICE_TYPE = "주일예배";
  const todaySunday = useMemo(() => toDateStr(getLastSunday(new Date())), []);
  const [selectedDate, setSelectedDate] = useState(todaySunday);

  const handleDateChange = useCallback((dateStr: string) => {
    const d = new Date(dateStr + "T12:00:00");
    const sunday = getLastSunday(d);
    setSelectedDate(toDateStr(sunday));
  }, []);
  const [deptFilter, setDeptFilter] = useState("");
  const [searchName, setSearchName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [statusMap, setStatusMap] = useState<Record<string, AttStatusUI>>({});
  const [noteMap, setNoteMap] = useState<Record<string, string>>({});
  const requestIdRef = useRef(0);
  const loadingRef = useRef(false);
  const toastRef = useRef(toast);
  toastRef.current = toast;
  const statusMapRef = useRef(statusMap);
  statusMapRef.current = statusMap;
  const noteMapRef = useRef(noteMap);
  noteMapRef.current = noteMap;
  const noteTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const activeMembers = useMemo(() => getActiveMembers(members), [members]);
  const depts = useMemo(() => Array.from(new Set(activeMembers.map((m) => m.dept).filter(Boolean))) as string[], [activeMembers]);

  const filteredMembers = useMemo(() => {
    let list = activeMembers;
    if (deptFilter) list = list.filter((m) => m.dept === deptFilter);
    if (searchName.trim()) {
      const q = searchName.trim().toLowerCase();
      list = list.filter((m) => (m.name || "").toLowerCase().includes(q));
    }
    return list;
  }, [activeMembers, deptFilter, searchName]);

  const loadAttendance = useCallback(async (date: string, serviceType: string) => {
    if (!supabase) {
      setStatusMap({});
      setNoteMap({});
      setLoading(false);
      return;
    }
    if (loadingRef.current) {
      console.log("[loadAttendance 호출]", Date.now(), "스킵(이미 로딩 중)");
      return;
    }
    loadingRef.current = true;
    const myId = ++requestIdRef.current;
    console.log("[loadAttendance 호출]", Date.now(), "requestId:", myId);
    setLoading(true);
    const { data, error } = await supabase
      .from("attendance")
      .select("*")
      .eq("date", date)
      .eq("service_type", serviceType)
      .eq("church_id", getChurchId())
      .order("member_id", { ascending: true });
    loadingRef.current = false;
    if (myId !== requestIdRef.current) return;
    if (error) {
      console.error("[출석 로드 실패]", error);
      toastRef.current("데이터 로드 실패: " + error.message, "err");
      setStatusMap({});
      setNoteMap({});
    } else {
      const newMap: Record<string, AttStatusUI> = {};
      const notes: Record<string, string> = {};
      (data ?? []).forEach((row: { member_id?: string; status?: string; note?: string }) => {
        const uiStatus = (DB_TO_UI_STATUS[row.status ?? ""] ?? "결석") as AttStatusUI;
        if (row.member_id) {
          newMap[row.member_id] = uiStatus;
          if (row.note) notes[row.member_id] = row.note;
        }
      });
      console.log("[출석 로드]", { date, serviceType, count: (data ?? []).length, statusMap: newMap });
      setStatusMap(newMap);
      setNoteMap(notes);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadAttendance(selectedDate, SERVICE_TYPE);
  }, [selectedDate, SERVICE_TYPE, loadAttendance]);

  const getStatus = useCallback((memberId: string): AttStatusUI => {
    return statusMap[memberId] ?? "출석";
  }, [statusMap]);

  const setStatus = useCallback((memberId: string, status: AttStatusUI) => {
    setStatusMap((prev) => ({ ...prev, [memberId]: status }));
  }, []);

  const setNote = useCallback((memberId: string, value: string) => {
    setNoteMap((prev) => ({ ...prev, [memberId]: value }));
  }, []);

  const saveOneAttendance = useCallback(async (memberId: string, newStatus: AttStatusUI, noteOverride?: string) => {
    if (!supabase) return;
    setSaving(true);
    setSaved(false);
    setSaveError(false);
    const year = new Date(selectedDate + "T12:00:00").getFullYear();
    const week_num = getWeekNumForDate(selectedDate);
    const note = newStatus === "결석" ? ((noteOverride ?? noteMapRef.current[memberId])?.trim() || null) : null;
    const churchId = getChurchId();
    const { error } = await supabase.from("attendance").upsert([{
      member_id: memberId,
      week_num: Number(week_num),
      year: Number(year),
      date: selectedDate,
      service_type: SERVICE_TYPE,
      status: UI_TO_DB_STATUS[newStatus] ?? "a",
      check_in_time: new Date().toISOString(),
      check_in_method: "수동" as const,
      note: note as string | null,
      checked_by: getCurrentUserId?.() ?? null,
      church_id: churchId,
    }], { onConflict: "member_id,date,service_type" });
    if (error) {
      setSaveError(true);
      setSaving(false);
      return;
    }
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    onAttendanceSaved?.();
  }, [selectedDate, getCurrentUserId, onAttendanceSaved]);

  const toggleAttendance = useCallback((memberId: string, newStatus: AttStatusUI) => {
    setStatusMap((prev) => ({ ...prev, [memberId]: newStatus }));
    saveOneAttendance(memberId, newStatus);
  }, [saveOneAttendance]);

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

  const count출석 = useMemo(
    () => filteredMembers.filter((m) => (statusMap[m.id] ?? "출석") === "출석").length,
    [filteredMembers, statusMap]
  );
  const count결석 = filteredMembers.length - count출석;

  const getWeekNumForDate = (dateStr: string) => {
    const d = new Date(dateStr + "T12:00:00");
    const s = new Date(d.getFullYear(), 0, 1);
    return Math.ceil(((d.getTime() - s.getTime()) / 864e5 + s.getDay() + 1) / 7);
  };

  const handleSave = async () => {
    if (!supabase) return;
    setSaving(true);
    setSaved(false);
    const year = new Date(selectedDate + "T12:00:00").getFullYear();
    const week_num = getWeekNumForDate(selectedDate);
    const records = filteredMembers.map((m) => {
      const uiStatus = statusMap[m.id] ?? "출석";
      const note = uiStatus === "결석" ? (noteMap[m.id]?.trim() || null) : null;
      return {
        member_id: m.id,
        week_num: Number(week_num),
        year: Number(year),
        date: selectedDate,
        service_type: SERVICE_TYPE,
        status: UI_TO_DB_STATUS[uiStatus] ?? "a",
        check_in_time: new Date().toISOString(),
        check_in_method: "수동" as const,
        note: note as string | null,
        checked_by: getCurrentUserId?.() ?? null,
      };
    });
    const churchId = getChurchId();
    const recordsWithChurch = records.map((r) => ({ ...r, church_id: churchId }));
    console.log("[출석 저장 요청]", { count: records.length, sample: records[0], year, week_num });
    const { data, error } = await supabase.from("attendance").upsert(recordsWithChurch, {
      onConflict: "member_id,date,service_type",
    });
    console.log("=== 출석 저장 디버깅 ===");
    console.log("저장할 데이터:", JSON.stringify(records, null, 2));
    console.log("저장 결과:", JSON.stringify(data, null, 2));
    console.log("에러:", JSON.stringify(error, null, 2));
    console.log("[출석 저장 응답]", { data, error: error?.message ?? null });
    if (error) {
      console.error(error);
      toast("저장 실패: " + error.message, "err");
      setSaving(false);
      return;
    }

    toast(`${records.length}명 출석 저장 완료`);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    setSaving(false);
    loadAttendance(selectedDate, SERVICE_TYPE);
    onAttendanceSaved?.();
  };

  return (
    <div className="space-y-2 md:space-y-4">
      <div
        className={
          mob
            ? "space-y-1.5 bg-white rounded-xl shadow-sm border border-gray-100 p-2 -mx-3 px-2"
            : "space-y-3 bg-white rounded-xl shadow-sm border border-gray-100 p-4 -mx-3 md:mx-0 px-2 md:px-4"
        }
      >
        <div className={mob ? "flex flex-wrap items-center gap-1.5" : "flex flex-nowrap items-center gap-4"}>
          <label className={mob ? "flex shrink-0 items-center gap-1.5" : "flex shrink-0 items-center gap-2"}>
            <span className={mob ? "whitespace-nowrap text-[10px] text-gray-500" : "whitespace-nowrap text-sm text-gray-600"}>
              날짜
            </span>
            <div className={mob ? "min-w-[130px]" : "min-w-[180px]"}>
              <CalendarDropdown
                value={selectedDate}
                onChange={handleDateChange}
                compact
                style={{ marginBottom: 0 }}
                triggerStyle={
                  mob
                    ? { fontSize: 11, height: 28, minHeight: 28, padding: "4px 8px", borderRadius: 6 }
                    : { fontSize: 14, minHeight: 40, padding: "8px 12px", borderRadius: 8 }
                }
              />
            </div>
          </label>
          <span
            className={
              mob
                ? "rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-[#1e3a5f]"
                : "rounded-lg bg-blue-50 px-3 py-2 text-sm font-semibold text-[#1e3a5f]"
            }
          >
            주일예배
          </span>
          <label className={mob ? "flex shrink-0 items-center gap-1.5" : "flex shrink-0 items-center gap-2"}>
            <span className={mob ? "whitespace-nowrap text-[10px] text-gray-500" : "whitespace-nowrap text-sm text-gray-600"}>
              이름 검색
            </span>
            <input
              type="search"
              placeholder="이름 검색"
              value={searchName}
              onChange={(e) => setSearchName(e.target.value)}
              className={
                mob
                  ? "h-6 w-20 rounded border border-gray-200 px-1.5 py-0.5 text-[10px]"
                  : "h-auto w-40 rounded-lg border border-gray-200 px-3 py-2 text-sm"
              }
            />
          </label>
        </div>
        {/* 부서 탭 */}
        <div
          className={mob ? "flex gap-1.5 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden" : "flex gap-2 overflow-x-auto pb-2 [&::-webkit-scrollbar]:hidden"}
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {["전체", ...depts].map((dept) => (
            <button
              key={dept}
              type="button"
              onClick={() => setDeptFilter(dept === "전체" ? "" : dept)}
              className={`rounded-full font-medium whitespace-nowrap transition-colors ${
                mob ? "px-2 py-0.5 text-[10px]" : "px-4 py-2 text-sm"
              } ${
                (dept === "전체" && !deptFilter) || deptFilter === dept
                  ? "bg-slate-800 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {dept}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 bg-white rounded-xl border border-gray-100">
          <span className="inline-block w-6 h-6 rounded-full border-2 border-[#1e3a5f] border-t-transparent animate-spin" />
          <span className="ml-2 text-gray-500">출석 데이터 로딩 중...</span>
        </div>
      ) : mob ? (
        <div className="-mx-3 md:mx-0 px-2 md:px-0 bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="space-y-1">
            <div className="flex items-center px-2 py-1 text-[10px] text-gray-400 font-medium border-b border-gray-100">
              <span className="flex-1 min-w-0">교인</span>
              <span className="w-[100px] shrink-0 text-center">출석</span>
              <span className="w-[80px] shrink-0 text-center">사유</span>
            </div>
            {filteredMembers.length === 0 ? (
              <div className="py-8 text-center text-gray-500 text-sm">교인 목록이 없거나 검색 결과가 없습니다.</div>
            ) : (
              filteredMembers.map((m) => {
                const status = getStatus(m.id);
                const isAbsent = status === "결석";
                return (
                  <div key={m.id} className="flex items-center px-2 py-1.5 border-b border-gray-50 gap-2">
                    <div className="flex-1 min-w-0 flex items-center">
                      <span className="text-[11px] font-medium text-gray-900 truncate">
                        {m.name}
                        {m.role && m.role !== "성도" ? (
                          <span className="text-[9px] font-normal text-gray-400"> ({m.role})</span>
                        ) : null}
                      </span>
                    </div>
                    <div className="flex gap-1 w-[100px] shrink-0 justify-center">
                      <button
                        type="button"
                        onClick={() => toggleAttendance(m.id, "출석")}
                        className={`h-6 px-2.5 text-[10px] rounded font-medium transition-colors ${
                          status === "출석" ? "bg-slate-800 text-white" : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        출석
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleAttendance(m.id, "결석")}
                        className={`h-6 px-2.5 text-[10px] rounded font-medium transition-colors ${
                          status === "결석" ? "bg-slate-800 text-white" : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        결석
                      </button>
                    </div>
                    <input
                      type="text"
                      placeholder="사유"
                      value={noteMap[m.id] ?? ""}
                      onChange={(e) => handleNoteChange(m.id, e.target.value)}
                      disabled={!isAbsent}
                      className={`w-[80px] shrink-0 h-6 px-1.5 text-[10px] border border-gray-200 rounded box-border ${
                        isAbsent ? "bg-white text-gray-900 placeholder:text-gray-300" : "bg-gray-50 text-gray-400 placeholder:text-gray-200 cursor-not-allowed"
                      }`}
                    />
                  </div>
                );
              })
            )}
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto -mx-3 md:mx-0 px-2 md:px-0 bg-white rounded-xl shadow-sm border border-gray-100">
          <table className="w-full text-sm min-w-[320px]">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left py-3 px-4 font-semibold text-[#1e3a5f]">교인</th>
                <th className="text-left py-3 px-4 font-semibold text-[#1e3a5f]">직분</th>
                <th className="text-left py-3 px-4 font-semibold text-[#1e3a5f]">목장</th>
                <th className="text-center py-3 px-4 font-semibold text-[#1e3a5f]">출석 상태</th>
                <th className="text-left py-3 px-4 font-semibold text-[#1e3a5f]">사유</th>
              </tr>
            </thead>
            <tbody>
              {filteredMembers.length === 0 ? (
                <tr><td colSpan={5} className="py-8 text-center text-gray-500">교인 목록이 없거나 검색 결과가 없습니다.</td></tr>
              ) : (
                filteredMembers.map((m) => {
                  const status = getStatus(m.id);
                  const isAbsent = status === "결석";
                  return (
                    <tr key={m.id} className="border-b border-gray-50 hover:bg-gray-50/50 min-h-[48px]">
                      <td className="py-3 px-4 flex items-center gap-3 min-h-[48px]">
                        <div
                          className="w-9 h-9 rounded-full bg-gray-200 flex-shrink-0 bg-cover bg-center"
                          style={{ backgroundImage: m.photo ? `url(${m.photo})` : undefined }}
                        />
                        <span className="font-medium text-sm whitespace-nowrap overflow-hidden text-ellipsis max-w-none">{m.name}</span>
                      </td>
                      <td className="py-3 px-4 text-gray-600 text-sm whitespace-nowrap overflow-hidden text-ellipsis max-w-none">{m.role || "-"}</td>
                      <td className="py-3 px-4 text-gray-600 text-sm whitespace-nowrap overflow-hidden text-ellipsis max-w-none">{m.mokjang || m.group || "-"}</td>
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-2 justify-center">
                          <button
                            type="button"
                            onClick={() => toggleAttendance(m.id, "출석")}
                            className={`px-4 py-2 text-sm rounded-lg font-medium transition-colors ${status === "출석" ? "bg-slate-800 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                          >
                            출석
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleAttendance(m.id, "결석")}
                            className={`px-4 py-2 text-sm rounded-lg font-medium transition-colors ${status === "결석" ? "bg-slate-800 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                          >
                            결석
                          </button>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <input
                          type="text"
                          placeholder="사유 (선택)"
                          value={noteMap[m.id] ?? ""}
                          onChange={(e) => handleNoteChange(m.id, e.target.value)}
                          disabled={!isAbsent}
                          className={`px-3 py-1.5 text-sm border border-gray-200 rounded-lg w-40 box-border ${isAbsent ? "bg-white" : "bg-gray-50 text-gray-400"}`}
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      <div className="sticky bottom-0 left-0 right-0 bg-white/95 backdrop-blur border-t border-gray-200 shadow-lg rounded-t-xl p-2 md:p-4 flex flex-wrap items-center justify-between gap-2 md:gap-4">
        <div className="flex gap-2 md:gap-4 text-xs md:text-sm text-gray-600">
          <span>출석 <strong className="text-slate-800">{count출석}명</strong></span>
          <span>결석 <strong className="text-slate-800">{count결석}명</strong></span>
          <span className="text-gray-400">/ 전체 {filteredMembers.length}명</span>
        </div>
        <div className="text-sm">
          {saving ? (
            <span className="flex items-center gap-1 text-gray-500">
              <span className="inline-block w-3 h-3 rounded-full border-2 border-gray-400 border-t-transparent animate-spin" />
              저장 중...
            </span>
          ) : saved ? (
            <span className="text-green-600 font-medium">✓ 자동 저장됨</span>
          ) : saveError ? (
            <span className="text-red-500">저장 실패 - 다시 시도해주세요</span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
