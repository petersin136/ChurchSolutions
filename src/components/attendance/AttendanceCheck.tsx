"use client";

import { useMemo, useState, useCallback } from "react";
import type { Member } from "@/types/db";
import type { Attendance } from "@/types/db";
import type { ServiceType } from "@/types/db";

const STATUSES = ["출석", "온라인", "결석", "병결", "기타"] as const;
const STATUS_COLORS: Record<string, string> = {
  출석: "#10B981",
  온라인: "#3B82F6",
  결석: "#D1D5DB",
  병결: "#F59E0B",
  기타: "#9CA3AF",
};

export interface AttendanceCheckProps {
  members: Member[];
  serviceTypes: ServiceType[];
  attendanceList: Attendance[];
  onSave: (records: Partial<Attendance>[]) => Promise<void>;
  getCurrentUserId?: () => string | null;
}

function getActiveMembers(members: Member[]) {
  return members.filter((m) => (m.member_status || m.status) === "활동" || !m.member_status);
}

export function AttendanceCheck({
  members,
  serviceTypes,
  attendanceList,
  onSave,
  getCurrentUserId,
}: AttendanceCheckProps) {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [selectedDate, setSelectedDate] = useState(today);
  const [selectedServiceType, setSelectedServiceType] = useState(serviceTypes[0]?.name || "주일1부예배");
  const [deptFilter, setDeptFilter] = useState("");
  const [searchName, setSearchName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

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

  const existingByMember = useMemo(() => {
    const map: Record<string, Attendance> = {};
    attendanceList
      .filter((a) => a.date === selectedDate && (a.service_type || "주일예배") === selectedServiceType)
      .forEach((a) => {
        map[a.member_id] = a;
      });
    return map;
  }, [attendanceList, selectedDate, selectedServiceType]);

  const [localStatus, setLocalStatus] = useState<Record<string, (typeof STATUSES)[number]>>(() => ({}));

  const getStatus = useCallback(
    (memberId: string): (typeof STATUSES)[number] => {
      if (localStatus[memberId]) return localStatus[memberId];
      const existing = existingByMember[memberId];
      if (existing && (STATUSES as readonly string[]).includes(existing.status)) return existing.status as (typeof STATUSES)[number];
      return "결석";
    },
    [localStatus, existingByMember]
  );

  const setStatus = useCallback((memberId: string, status: (typeof STATUSES)[number]) => {
    setLocalStatus((prev) => ({ ...prev, [memberId]: status }));
  }, []);

  const counts = useMemo(() => {
    let 출석 = 0,
      온라인 = 0,
      결석 = 0,
      병결 = 0,
      기타 = 0;
    filteredMembers.forEach((m) => {
      const s = getStatus(m.id);
      if (s === "출석") 출석++;
      else if (s === "온라인") 온라인++;
      else if (s === "결석") 결석++;
      else if (s === "병결") 병결++;
      else 기타++;
    });
    return { 출석, 온라인, 결석, 병결, 기타 };
  }, [filteredMembers, getStatus]);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const records: Partial<Attendance>[] = filteredMembers.map((m) => ({
        member_id: m.id,
        date: selectedDate,
        status: getStatus(m.id),
        service_type: selectedServiceType,
        check_in_method: "수동",
        checked_by: getCurrentUserId?.() || undefined,
      }));
      await onSave(records);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
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
              <option key={s.id} value={s.name}>
                {s.name}
              </option>
            ))}
            {serviceTypes.length === 0 && <option value="주일1부예배">주일1부예배</option>}
          </select>
        </label>
        <label className="flex items-center gap-2">
          <span className="text-sm text-gray-600">부서</span>
          <select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
          >
            <option value="">전체</option>
            {depts.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
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
            {filteredMembers.map((m) => {
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
            })}
          </tbody>
        </table>
      </div>

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
          {saved ? (
            <>✓ 저장됨</>
          ) : saving ? (
            <>
              <span className="inline-block w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
              저장 중...
            </>
          ) : (
            "저장"
          )}
        </button>
      </div>
    </div>
  );
}
