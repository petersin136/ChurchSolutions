"use client";

import { useMemo, useState, useCallback, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { getChurchId, withChurchId } from "@/lib/tenant";
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

export function AttendanceCheck({
  members,
  toast,
  getCurrentUserId,
  onAttendanceSaved,
}: AttendanceCheckProps) {
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
  const [loading, setLoading] = useState(true);
  const [statusMap, setStatusMap] = useState<Record<string, AttStatusUI>>({});
  const [noteMap, setNoteMap] = useState<Record<string, string>>({});
  const requestIdRef = useRef(0);
  const loadingRef = useRef(false);
  const toastRef = useRef(toast);
  toastRef.current = toast;

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
    console.log("[출석 저장 요청]", { count: records.length, sample: records[0], year, week_num });
    const { data, error } = await supabase.from("attendance").upsert(withChurchId(records), {
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
    <div className="space-y-4">
      <div className="space-y-3 bg-white rounded-xl shadow-sm border border-gray-100 p-3 md:p-4 -mx-3 md:mx-0 px-3 md:px-4">
        <div className="flex flex-wrap md:flex-nowrap items-center gap-3 md:gap-4">
          <label className="flex items-center gap-2 shrink-0">
            <span className="text-xs md:text-sm text-gray-600 whitespace-nowrap">날짜</span>
            <div className="min-w-[160px] md:min-w-[180px]">
              <CalendarDropdown
                value={selectedDate}
                onChange={handleDateChange}
                compact
                style={{ marginBottom: 0 }}
              />
            </div>
          </label>
          <span className="text-xs md:text-sm text-[#1e3a5f] font-semibold px-3 py-2 bg-blue-50 rounded-lg">주일예배</span>
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
        {/* 부서 탭 */}
        <div
          className="flex overflow-x-auto gap-2 pb-2 [&::-webkit-scrollbar]:hidden"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {["전체", ...depts].map((dept) => (
            <button
              key={dept}
              type="button"
              onClick={() => setDeptFilter(dept === "전체" ? "" : dept)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
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
      ) : (
        <div className="overflow-x-auto -mx-3 md:mx-0 px-3 md:px-0 bg-white rounded-xl shadow-sm border border-gray-100">
          <table className="w-full text-sm min-w-[320px]">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left py-3 px-3 md:px-4 font-semibold text-[#1e3a5f] text-xs md:text-sm">교인</th>
                <th className="text-left py-3 px-3 md:px-4 font-semibold text-[#1e3a5f] text-xs md:text-sm">직분</th>
                <th className="text-left py-3 px-3 md:px-4 font-semibold text-[#1e3a5f] text-xs md:text-sm">목장</th>
                <th className="text-center py-3 px-3 md:px-4 font-semibold text-[#1e3a5f] text-xs md:text-sm">출석 상태</th>
                <th className="text-left py-3 px-3 md:px-4 font-semibold text-[#1e3a5f] text-xs md:text-sm">사유</th>
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
                      <td className="py-3 px-3 md:px-4 flex items-center gap-2 md:gap-3 min-h-[48px]">
                        <div
                          className="w-8 h-8 md:w-9 md:h-9 rounded-full bg-gray-200 flex-shrink-0 bg-cover bg-center"
                          style={{ backgroundImage: m.photo ? `url(${m.photo})` : undefined }}
                        />
                        <span className="font-medium whitespace-nowrap overflow-hidden text-ellipsis max-w-[100px] md:max-w-none">{m.name}</span>
                      </td>
                      <td className="py-3 px-3 md:px-4 text-gray-600 text-xs md:text-sm whitespace-nowrap overflow-hidden text-ellipsis max-w-[60px] md:max-w-none">{m.role || "-"}</td>
                      <td className="py-3 px-3 md:px-4 text-gray-600 text-xs md:text-sm whitespace-nowrap overflow-hidden text-ellipsis max-w-[60px] md:max-w-none">{m.mokjang || m.group || "-"}</td>
                      <td className="py-3 px-3 md:px-4">
                        <div className="flex flex-wrap gap-2 justify-center">
                          <button
                            type="button"
                            onClick={() => setStatus(m.id, "출석")}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${status === "출석" ? "bg-slate-800 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                          >
                            출석
                          </button>
                          <button
                            type="button"
                            onClick={() => setStatus(m.id, "결석")}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${status === "결석" ? "bg-slate-800 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                          >
                            결석
                          </button>
                        </div>
                      </td>
                      <td className="py-3 px-3 md:px-4">
                        <input
                          type="text"
                          placeholder="사유 (선택)"
                          value={noteMap[m.id] ?? ""}
                          onChange={(e) => setNote(m.id, e.target.value)}
                          disabled={!isAbsent}
                          className={`px-3 py-1.5 text-sm border border-gray-200 rounded-lg w-40 ${isAbsent ? "bg-white" : "bg-gray-50 text-gray-400"}`}
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

      <div className="sticky bottom-0 left-0 right-0 bg-white/95 backdrop-blur border-t border-gray-200 shadow-lg rounded-t-xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex gap-4 text-sm text-gray-600">
          <span>출석 <strong className="text-slate-800">{count출석}명</strong></span>
          <span>결석 <strong className="text-slate-800">{count결석}명</strong></span>
          <span className="text-gray-400">/ 전체 {filteredMembers.length}명</span>
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2.5 rounded-xl bg-[#1e3a5f] text-white font-semibold text-sm hover:opacity-90 disabled:opacity-60 flex items-center gap-2"
        >
          {saved ? <>✓ 저장됨</> : saving ? (<><span className="inline-block w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />저장 중...</>) : "저장"}
        </button>
      </div>
    </div>
  );
}
