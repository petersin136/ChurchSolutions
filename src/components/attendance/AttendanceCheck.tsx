"use client";

import { useMemo, useState, useCallback, useEffect, useRef } from "react";
import { tokens } from "@/styles/tokens";
import { supabase } from "@/lib/supabase";
import { getChurchId } from "@/lib/tenant";
import { isChurchActiveMember } from "@/lib/attendance-utils";
import type { Member } from "@/types/db";
import { CalendarDropdown } from "@/components/CalendarDropdown";
import { ModernSelect } from "@/components/common/ModernSelect";
import { MemberPhotoCircle } from "@/components/common/MemberPhoto";

const fmt = (n: number) => new Intl.NumberFormat("ko-KR").format(n);

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
const ATTENDANCE_CHECK_PAGE_SIZE = 10;

function memberMokjangLabel(m: Member): string {
  return (m.mokjang ?? m.group ?? "").trim();
}

function compareMokjangOrder(a: string, b: string): number {
  const aNum = Number((a.match(/\d+/)?.[0] ?? ""));
  const bNum = Number((b.match(/\d+/)?.[0] ?? ""));
  const aHasNum = Number.isFinite(aNum) && aNum > 0;
  const bHasNum = Number.isFinite(bNum) && bNum > 0;
  if (aHasNum && bHasNum && aNum !== bNum) return aNum - bNum;
  if (aHasNum !== bHasNum) return aHasNum ? -1 : 1;
  return a.localeCompare(b, "ko");
}

function memberSurnameInitial(name: string | undefined): string {
  const s = (name ?? "").trim();
  if (!s) return "?";
  const ch = Array.from(s)[0];
  return ch ?? "?";
}

function AttendanceListPaginationBar({
  page,
  totalPages,
  totalItems,
  onPageChange,
  compact,
}: {
  page: number;
  totalPages: number;
  totalItems: number;
  onPageChange: (p: number) => void;
  compact?: boolean;
}) {
  if (totalItems === 0) return null;
  const btn =
    compact
      ? "rounded-md border border-gray-200 bg-white px-2 py-0.5 text-[10px] font-medium text-gray-700 shadow-sm disabled:cursor-not-allowed disabled:opacity-40"
      : "rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40";
  const label = compact ? "text-[10px] tabular-nums text-gray-600" : "text-sm tabular-nums text-gray-600";
  return (
    <div
      className={
        compact
          ? "flex shrink-0 items-center justify-center gap-2 border-t border-gray-100 bg-gray-50/90 px-2 py-1.5 backdrop-blur-sm"
          : "flex shrink-0 items-center justify-center gap-3 border-t border-gray-200 bg-gray-50/90 px-4 py-2.5 backdrop-blur-sm"
      }
    >
      <button type="button" className={btn} disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
        이전
      </button>
      <span className={label}>
        {page} / {totalPages}
      </span>
      <button type="button" className={btn} disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
        다음
      </button>
    </div>
  );
}

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
  return members.filter(isChurchActiveMember);
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
  const [mokjangFilter, setMokjangFilter] = useState("");
  const [searchName, setSearchName] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
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
  const mokjangSelectOptions = useMemo(() => {
    const set = new Set<string>();
    activeMembers.forEach((m) => {
      const v = memberMokjangLabel(m);
      if (v) set.add(v);
    });
    const hasUnassigned = activeMembers.some((m) => !memberMokjangLabel(m));
    return [
      { value: "", label: "전체" },
      ...(hasUnassigned ? [{ value: "__none__", label: "미배정" }] : []),
      ...Array.from(set).sort(compareMokjangOrder).map((name) => ({ value: name, label: name })),
    ];
  }, [activeMembers]);

  const filteredMembers = useMemo(() => {
    let list = activeMembers;
    if (deptFilter) list = list.filter((m) => m.dept === deptFilter);
    if (mokjangFilter === "__none__") list = list.filter((m) => !memberMokjangLabel(m));
    else if (mokjangFilter) list = list.filter((m) => memberMokjangLabel(m) === mokjangFilter);
    if (searchName.trim()) {
      const q = searchName.trim().toLowerCase();
      list = list.filter((m) => (m.name || "").toLowerCase().includes(q));
    }
    return list;
  }, [activeMembers, deptFilter, mokjangFilter, searchName]);

  const pagedMembers = useMemo(
    () => filteredMembers.slice((currentPage - 1) * ATTENDANCE_CHECK_PAGE_SIZE, currentPage * ATTENDANCE_CHECK_PAGE_SIZE),
    [filteredMembers, currentPage]
  );
  const totalPages = Math.max(1, Math.ceil(filteredMembers.length / ATTENDANCE_CHECK_PAGE_SIZE));

  useEffect(() => {
    setCurrentPage(1);
  }, [deptFilter, mokjangFilter, searchName, selectedDate]);

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

  const getStatus = useCallback((memberId: string): AttStatusUI | undefined => {
    return statusMap[memberId];
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
      const current = statusMapRef.current[memberId];
      if (current) saveOneAttendance(memberId, current, value);
    }, 800);
  }, [saveOneAttendance]);

  useEffect(() => {
    return () => { Object.values(noteTimersRef.current).forEach(clearTimeout); };
  }, []);

  const count출석 = useMemo(
    () => filteredMembers.filter((m) => statusMap[m.id] === "출석").length,
    [filteredMembers, statusMap]
  );
  const count결석 = useMemo(
    () => filteredMembers.filter((m) => statusMap[m.id] === "결석").length,
    [filteredMembers, statusMap]
  );
  const statsCards = useMemo(() => {
    const total = filteredMembers.length;
    const rate = total > 0 ? Math.round((count출석 / total) * 100) : 0;
    return [
      { label: "대상 인원", value: `${fmt(total)}명`, sub: "필터 적용" },
      { label: "출석률", value: `${rate}%`, sub: "저장된 체크 기준" },
      { label: "출석", value: `${fmt(count출석)}명`, sub: "주일예배" },
      { label: "결석", value: `${fmt(count결석)}명`, sub: "사유 입력 가능" },
    ];
  }, [filteredMembers.length, count출석, count결석]);

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
    const records = filteredMembers
      .filter((m) => statusMap[m.id] != null)
      .map((m) => {
      const uiStatus = statusMap[m.id] as AttStatusUI;
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
    if (records.length === 0) {
      toast("출석 또는 결석을 선택한 후 저장해 주세요.", "warn");
      setSaving(false);
      return;
    }
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
    <div
      className={mob ? "space-y-2" : "space-y-6"}
      style={
        mob
          ? {
              minHeight: tokens.layout.mobPastoralPanelMinHeight,
              minWidth: 0,
            }
          : undefined
      }
    >
      <div
        className={
          mob
            ? "flex flex-wrap items-center gap-2 bg-white rounded-xl shadow-sm border border-gray-100 p-2"
            : "flex flex-nowrap items-center gap-4 overflow-x-auto bg-white rounded-xl shadow-sm border border-gray-100 p-4 [&::-webkit-scrollbar]:hidden"
        }
        style={mob ? undefined : { scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        <label className={mob ? "flex shrink-0 items-center gap-1.5" : "flex shrink-0 items-center gap-2"}>
          <span className={mob ? "whitespace-nowrap text-[10px] text-gray-500" : "whitespace-nowrap text-sm text-gray-600"}>
            날짜
          </span>
          <div className={mob ? "min-w-[130px]" : "min-w-[160px]"}>
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
              ? "rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-[#1e40af]"
              : "rounded-lg bg-blue-50 px-3 py-2 text-sm font-semibold text-[#1e40af]"
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
                : "h-auto w-32 rounded-lg border border-gray-200 px-3 py-2 text-sm"
            }
          />
        </label>
        <label className={`flex shrink-0 items-center gap-1 ${mob ? "text-[10px] text-gray-600" : "gap-2 text-sm text-gray-600"}`}>
          <span className="whitespace-nowrap">부서</span>
          <ModernSelect
            value={deptFilter}
            onChange={setDeptFilter}
            options={[{ value: "", label: "전체" }, ...depts.map((d) => ({ value: d, label: d }))]}
              style={{ marginBottom: 0, minWidth: mob ? 72 : 88 }}
          />
        </label>
        <label className={`flex shrink-0 items-center gap-1 ${mob ? "text-[10px] text-gray-600" : "gap-2 text-sm text-gray-600"}`}>
          <span className="whitespace-nowrap">목장</span>
          <ModernSelect
            value={mokjangFilter}
            onChange={setMokjangFilter}
            options={mokjangSelectOptions}
              style={{ marginBottom: 0, minWidth: mob ? 72 : 100 }}
          />
        </label>
      </div>

      <div
        className={
          mob ? "mb-2 grid grid-cols-2 gap-1.5" : "mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4"
        }
      >
        {statsCards.map((card) => (
          <div
            key={card.label}
            className={
              mob
                ? "rounded-lg border border-gray-100 bg-white p-2"
                : "rounded-xl border border-gray-100 bg-white p-4 shadow-sm"
            }
          >
            <div className={mob ? "text-[9px] text-gray-400" : "text-xs text-gray-500"}>{card.label}</div>
            <div className={mob ? "text-[18px] font-extrabold text-gray-900" : "text-2xl font-extrabold text-gray-900"}>
              {card.value}
            </div>
            <div className={mob ? "text-[9px] text-gray-400" : "text-xs text-gray-400"}>{card.sub}</div>
          </div>
        ))}
      </div>

      {loading ? (
        <div
          className={`flex items-center justify-center py-12 bg-white rounded-xl border border-gray-100 ${mob ? "shrink-0" : ""}`}
        >
          <span className="inline-block w-6 h-6 rounded-full border-2 border-[#1e40af] border-t-transparent animate-spin" />
          <span className="ml-2 text-gray-500">출석 데이터 로딩 중...</span>
        </div>
      ) : mob ? (
        <div className="flex flex-col overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
          <div className="min-h-0">
            <div className="grid grid-cols-[24px_minmax(0,1fr)_100px_80px] items-center border-b border-gray-100 px-2 py-1 text-[10px] font-medium text-gray-400">
              <span className="text-center">#</span>
              <span className="min-w-0">교인</span>
              <span className="w-[100px] shrink-0 text-center">출석</span>
              <span className="w-[80px] shrink-0 text-center">사유</span>
            </div>
            {filteredMembers.length === 0 ? (
              <div className="py-8 text-center text-gray-500 text-sm">교인 목록이 없거나 검색 결과가 없습니다.</div>
            ) : (
              Array.from({ length: ATTENDANCE_CHECK_PAGE_SIZE }, (_, idx) => {
                const m = pagedMembers[idx];
                if (!m) {
                  return <div key={`mob-pad-${currentPage}-${idx}`} className="grid h-9 grid-cols-[24px_minmax(0,1fr)_100px_80px] border-b border-gray-50 px-2" aria-hidden />;
                }
                const num = (currentPage - 1) * ATTENDANCE_CHECK_PAGE_SIZE + idx + 1;
                const status = getStatus(m.id);
                const isAbsent = status === "결석";
                return (
                  <div key={m.id} className="grid h-9 grid-cols-[24px_minmax(0,1fr)_100px_80px] items-center border-b border-gray-50 px-2">
                    <span className="text-center text-[10px] tabular-nums text-gray-500">{num}</span>
                    <div className="flex min-w-0 items-center gap-1.5">
                      <MemberPhotoCircle
                        photo={m.photo}
                        name={m.name}
                        getInitial={memberSurnameInitial}
                        imageClassName="h-5 w-5 shrink-0 rounded-full bg-gray-200 bg-cover bg-center"
                        fallbackClassName="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gray-300 text-[9px] font-semibold text-gray-600"
                      />
                      <span className="min-w-0 truncate text-[11px] font-medium text-gray-900">{m.name}</span>
                    </div>
                    <div className="flex w-[100px] shrink-0 justify-center gap-1">
                      <button
                        type="button"
                        onClick={() => toggleAttendance(m.id, "출석")}
                        className={`h-5 px-2 text-[10px] rounded font-medium transition-colors ${
                          status === "출석" ? "bg-slate-800 text-white" : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        출석
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleAttendance(m.id, "결석")}
                        className={`h-5 px-2 text-[10px] rounded font-medium transition-colors ${
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
                      className={`w-[80px] shrink-0 h-5 px-1.5 text-[10px] border border-gray-200 rounded box-border ${
                        isAbsent ? "bg-white text-gray-900 placeholder:text-gray-300" : "bg-gray-50 text-gray-400 placeholder:text-gray-200 cursor-not-allowed"
                      }`}
                    />
                  </div>
                );
              })
            )}
          </div>
          <AttendanceListPaginationBar
            compact
            page={currentPage}
            totalPages={totalPages}
            totalItems={filteredMembers.length}
            onPageChange={setCurrentPage}
          />
        </div>
      ) : (
        <div className="flex flex-col overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
          <table className="w-full table-fixed border-collapse text-sm">
            <colgroup>
              <col className="w-[5%]" />
              <col className="w-[14%]" />
              <col className="w-[14%]" />
              <col className="w-[14%]" />
              <col className="w-[20%]" />
              <col className="w-[33%]" />
            </colgroup>
            <thead className="border-b border-gray-200 bg-gray-50/95">
              <tr>
                <th className="px-2 py-3 text-center font-semibold text-[#1e40af]">번호</th>
                <th className="px-3 py-3 text-left font-semibold text-[#1e40af]">이름</th>
                <th className="px-3 py-3 text-left font-semibold text-[#1e40af]">부서</th>
                <th className="px-3 py-3 text-left font-semibold text-[#1e40af]">목장</th>
                <th className="px-3 py-3 text-center font-semibold text-[#1e40af]">출석 상태</th>
                <th className="px-3 py-3 text-left font-semibold text-[#1e40af]">사유</th>
              </tr>
            </thead>
            <tbody>
              {filteredMembers.length === 0 ? (
                <tr><td colSpan={6} className="py-8 text-center text-gray-500">교인 목록이 없거나 검색 결과가 없습니다.</td></tr>
              ) : (
                Array.from({ length: ATTENDANCE_CHECK_PAGE_SIZE }, (_, idx) => {
                  const m = pagedMembers[idx];
                  if (!m) {
                    return (
                      <tr key={`pad-${currentPage}-${idx}`} className="h-12 border-b border-gray-50">
                        <td colSpan={6} className="h-12 p-0" aria-hidden />
                      </tr>
                    );
                  }
                  const num = (currentPage - 1) * ATTENDANCE_CHECK_PAGE_SIZE + idx + 1;
                  const status = getStatus(m.id);
                  const isAbsent = status === "결석";
                  return (
                    <tr key={m.id} className="h-12 border-b border-gray-50 hover:bg-gray-50/50">
                      <td className="px-2 py-3 text-center align-middle tabular-nums text-gray-500">{num}</td>
                      <td className="overflow-hidden px-3 py-3 align-middle font-medium">
                        <div className="flex min-w-0 items-center gap-2">
                          <MemberPhotoCircle
                            photo={m.photo}
                            name={m.name}
                            getInitial={memberSurnameInitial}
                            imageClassName="h-7 w-7 shrink-0 rounded-full bg-gray-200 bg-cover bg-center"
                            fallbackClassName="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-300 text-xs font-semibold text-gray-600"
                          />
                          <div className="min-w-0 truncate" title={m.name}>{m.name}</div>
                        </div>
                      </td>
                      <td className="overflow-hidden px-3 py-3 align-middle text-gray-600"><div className="truncate">{m.dept || "-"}</div></td>
                      <td className="overflow-hidden px-3 py-3 align-middle text-gray-600"><div className="truncate">{memberMokjangLabel(m) || "-"}</div></td>
                      <td className="px-3 py-3 align-middle">
                        <div className="flex justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => toggleAttendance(m.id, "출석")}
                            className={`h-6 rounded-md px-2.5 text-[11px] font-medium leading-none transition-colors ${status === "출석" ? "bg-slate-800 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                          >
                            출석
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleAttendance(m.id, "결석")}
                            className={`h-6 rounded-md px-2.5 text-[11px] font-medium leading-none transition-colors ${status === "결석" ? "bg-slate-800 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                          >
                            결석
                          </button>
                        </div>
                      </td>
                      <td className="px-3 py-3 align-middle">
                        <input
                          type="text"
                          placeholder="사유 (선택)"
                          value={noteMap[m.id] ?? ""}
                          onChange={(e) => handleNoteChange(m.id, e.target.value)}
                          disabled={!isAbsent}
                          className={`h-6 w-full max-w-[180px] rounded-md border border-gray-200 px-2 text-[11px] box-border ${isAbsent ? "bg-white" : "bg-gray-50 text-gray-400"}`}
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
          <AttendanceListPaginationBar
            page={currentPage}
            totalPages={totalPages}
            totalItems={filteredMembers.length}
            onPageChange={setCurrentPage}
          />
        </div>
      )}

      <div className="flex justify-end px-1 text-xs text-gray-500">
        {saving ? "저장 중..." : saved ? "자동 저장됨" : saveError ? "저장 실패" : ""}
      </div>
    </div>
  );
}
