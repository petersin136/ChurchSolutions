"use client";

import { useMemo, useState, useCallback, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import type { Member } from "@/types/db";
import type { ServiceType } from "@/types/db";

const STATUSES = ["출석", "온라인", "결석", "병결", "기타"] as const;
const STATUS_COLORS: Record<string, string> = {
  출석: "#10B981",
  온라인: "#3B82F6",
  결석: "#D1D5DB",
  병결: "#F59E0B",
  기타: "#9CA3AF",
};

/** DB: p=출석, o=온라인, a=결석, l=병결, n=기타 (CHECK에 'o','l' 포함하려면 attendance_enhancement.sql의 제약 확장 실행) */
const UI_TO_DB_STATUS: Record<(typeof STATUSES)[number], "p" | "o" | "a" | "l" | "n"> = {
  출석: "p",
  온라인: "o",
  결석: "a",
  병결: "l",
  기타: "n",
};
const DB_TO_UI_STATUS: Record<string, (typeof STATUSES)[number]> = {
  p: "출석",
  a: "결석",
  n: "기타",
  l: "병결",
  o: "온라인",
};
if (typeof window !== "undefined") console.log("[DB_TO_UI_STATUS]", DB_TO_UI_STATUS);

export interface AttendanceCheckProps {
  members: Member[];
  serviceTypes: ServiceType[];
  /** 토스트 (Supabase 저장 결과) */
  toast: (msg: string, type?: "ok" | "err" | "warn") => void;
  getCurrentUserId?: () => string | null;
}

function getActiveMembers(members: Member[]) {
  return members.filter((m) => (m.member_status || m.status) === "활동" || !m.member_status);
}

export function AttendanceCheck({
  members,
  serviceTypes,
  toast,
  getCurrentUserId,
}: AttendanceCheckProps) {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [selectedDate, setSelectedDate] = useState(today);
  const [selectedServiceType, setSelectedServiceType] = useState(serviceTypes[0]?.name || "주일1부예배");
  const [deptFilter, setDeptFilter] = useState("");
  const [searchName, setSearchName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [statusMap, setStatusMap] = useState<Record<string, (typeof STATUSES)[number]>>({});
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
      .order("member_id", { ascending: true });
    loadingRef.current = false;
    if (myId !== requestIdRef.current) return;
    if (error) {
      console.error("[출석 로드 실패]", error);
      toastRef.current("데이터 로드 실패: " + error.message, "err");
      setStatusMap({});
    } else {
      const newMap: Record<string, (typeof STATUSES)[number]> = {};
      (data ?? []).forEach((row: { member_id?: string; status?: string }) => {
        const uiStatus = (DB_TO_UI_STATUS[row.status ?? ""] ?? "결석") as (typeof STATUSES)[number];
        if (row.member_id) newMap[row.member_id] = uiStatus;
      });
      console.log("[출석 로드]", { date, serviceType, count: (data ?? []).length, statusMap: newMap });
      setStatusMap(newMap);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadAttendance(selectedDate, selectedServiceType);
  }, [selectedDate, selectedServiceType, loadAttendance]);

  const getStatus = useCallback((memberId: string): (typeof STATUSES)[number] => {
    return statusMap[memberId] ?? "결석";
  }, [statusMap]);

  const setStatus = useCallback((memberId: string, status: (typeof STATUSES)[number]) => {
    setStatusMap((prev) => ({ ...prev, [memberId]: status }));
  }, []);

  const counts = useMemo(() => {
    let 출석 = 0, 온라인 = 0, 결석 = 0, 병결 = 0, 기타 = 0;
    filteredMembers.forEach((m) => {
      const s = statusMap[m.id] ?? "결석";
      if (s === "출석") 출석++;
      else if (s === "온라인") 온라인++;
      else if (s === "결석") 결석++;
      else if (s === "병결") 병결++;
      else 기타++;
    });
    return { 출석, 온라인, 결석, 병결, 기타 };
  }, [filteredMembers, statusMap]);

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
      const uiStatus = statusMap[m.id] ?? "결석";
      return {
        member_id: m.id,
        week_num: Number(week_num),
        year: Number(year),
        date: selectedDate,
        service_type: selectedServiceType,
        status: UI_TO_DB_STATUS[uiStatus as (typeof STATUSES)[number]] ?? "n",
        check_in_time: new Date().toISOString(),
        check_in_method: "수동" as const,
        note: null as string | null,
        checked_by: getCurrentUserId?.() ?? null,
      };
    });
    console.log("[출석 저장 요청]", { count: records.length, sample: records[0], year, week_num });
    const { data, error } = await supabase.from("attendance").upsert(records, {
      onConflict: "member_id,date,service_type",
    });
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
    loadAttendance(selectedDate, selectedServiceType);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <label className="flex items-center gap-2">
          <span className="text-sm text-gray-600">날짜</span>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
          />
        </label>
        <label className="flex items-center gap-2">
          <span className="text-sm text-gray-600">예배</span>
          <select
            value={selectedServiceType}
            onChange={(e) => setSelectedServiceType(e.target.value)}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm min-w-[140px]"
          >
            {serviceTypes.filter((s) => s.is_active !== false).map((s) => (
              <option key={s.id} value={s.name}>{s.name}</option>
            ))}
            {serviceTypes.length === 0 && <option value="주일1부예배">주일1부예배</option>}
          </select>
        </label>
        <label className="flex items-center gap-2">
          <span className="text-sm text-gray-600">부서</span>
          <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)} className="rounded-lg border border-gray-200 px-3 py-2 text-sm">
            <option value="">전체</option>
            {depts.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </label>
        <input
          type="search"
          placeholder="이름 검색"
          value={searchName}
          onChange={(e) => setSearchName(e.target.value)}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm w-40"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 bg-white rounded-xl border border-gray-100">
          <span className="inline-block w-6 h-6 rounded-full border-2 border-[#1e3a5f] border-t-transparent animate-spin" />
          <span className="ml-2 text-gray-500">출석 데이터 로딩 중...</span>
        </div>
      ) : (
        <div className="overflow-x-auto bg-white rounded-xl shadow-sm border border-gray-100">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left py-3 px-4 font-semibold text-[#1e3a5f]">교인</th>
                <th className="text-left py-3 px-4 font-semibold text-[#1e3a5f]">직분</th>
                <th className="text-left py-3 px-4 font-semibold text-[#1e3a5f]">목장</th>
                <th className="text-center py-3 px-4 font-semibold text-[#1e3a5f]">출석 상태</th>
              </tr>
            </thead>
            <tbody>
              {filteredMembers.length === 0 ? (
                <tr><td colSpan={4} className="py-8 text-center text-gray-500">교인 목록이 없거나 검색 결과가 없습니다.</td></tr>
              ) : (
                filteredMembers.map((m) => {
                  const status = getStatus(m.id);
                  return (
                    <tr key={m.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                      <td className="py-3 px-4 flex items-center gap-3">
                        <div
                          className="w-9 h-9 rounded-full bg-gray-200 flex-shrink-0 bg-cover bg-center"
                          style={{ backgroundImage: m.photo ? `url(${m.photo})` : undefined }}
                        />
                        <span className="font-medium">{m.name}</span>
                      </td>
                      <td className="py-3 px-4 text-gray-600">{m.role || "-"}</td>
                      <td className="py-3 px-4 text-gray-600">{m.mokjang || m.group || "-"}</td>
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1 justify-center">
                          {STATUSES.map((s) => (
                            <button
                              key={s}
                              type="button"
                              onClick={() => setStatus(m.id, s)}
                              className="min-w-[44px] min-h-[44px] rounded-lg px-2 py-1.5 text-xs font-medium transition border-2"
                              style={{
                                backgroundColor: status === s ? STATUS_COLORS[s] : "transparent",
                                color: status === s ? "#fff" : "#374151",
                                borderColor: status === s ? STATUS_COLORS[s] : "#e5e7eb",
                              }}
                            >
                              {s}
                            </button>
                          ))}
                        </div>
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
        <div className="flex flex-wrap gap-4 text-sm">
          <span className="text-green-600 font-medium">출석: {counts.출석}명</span>
          <span className="text-blue-600 font-medium">온라인: {counts.온라인}명</span>
          <span className="text-gray-500">결석: {counts.결석}명</span>
          <span className="text-amber-600">병결: {counts.병결}명</span>
          <span className="text-gray-400">기타: {counts.기타}명</span>
          <span className="font-semibold text-[#1e3a5f]">총: {filteredMembers.length}명</span>
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
