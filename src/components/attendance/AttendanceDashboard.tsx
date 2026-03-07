"use client";

import { useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";
import type { Member } from "@/types/db";
import type { Attendance } from "@/types/db";
import type { ServiceType } from "@/types/db";

const NAVY = "#1e3a5f";
const GOLD = "#d4a853";
const GRAY = "#6b7280";
const SUCCESS = "#10B981";
const DANGER = "#ef476f";

export interface AttendanceDashboardProps {
  members: Member[];
  attendanceList: Attendance[];
  serviceTypes?: ServiceType[];
  onOpenCheck?: () => void;
  onOpenAbsentee?: () => void;
  onOpenAbsenteeList?: (memberIds: string[]) => void;
}

function getActiveMembers(members: Member[]) {
  return members.filter((m) => (m.member_status || m.status) === "활동" || !m.member_status);
}

/** 로컬 날짜를 YYYY-MM-DD로 포맷 (toISOString은 UTC라 KST 등에서 하루 밀림) */
function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** 이번 주 일요일부터 과거 count주의 일요일 목록 */
function getRecentSundays(count: number): string[] {
  const now = new Date();
  const thisSunday = new Date(now);
  thisSunday.setDate(now.getDate() - now.getDay());
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const sun = new Date(thisSunday);
    sun.setDate(thisSunday.getDate() - i * 7);
    out.unshift(fmtDate(sun));
  }
  return out;
}

/** 날짜(YYYY-MM-DD)가 속한 주의 일요일 날짜 반환 */
function getSundayOfWeek(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  const sun = new Date(d);
  sun.setDate(d.getDate() - d.getDay());
  return fmtDate(sun);
}

export function AttendanceDashboard({
  members,
  attendanceList,
  serviceTypes = [],
  onOpenAbsenteeList,
}: AttendanceDashboardProps) {
  const activeMembers = useMemo(() => getActiveMembers(members), [members]);
  const totalActive = activeMembers.length;

  const recentSundays = useMemo(() => getRecentSundays(12), []);
  const thisWeek = recentSundays[recentSundays.length - 1];
  const lastWeek = recentSundays[recentSundays.length - 2];

  const byDateService = useMemo(() => {
    const map: Record<string, Record<string, Attendance[]>> = {};
    attendanceList.forEach((a) => {
      if (!a.date) return;
      if (!map[a.date]) map[a.date] = {};
      const st = a.service_type || "주일예배";
      if (!map[a.date][st]) map[a.date][st] = [];
      map[a.date][st].push(a);
    });
    return map;
  }, [attendanceList]);

  /** 주 단위 집계 (일요일이 아닌 날 저장된 출석도 같은 주로 합침) */
  const byWeekService = useMemo(() => {
    const map: Record<string, Record<string, Attendance[]>> = {};
    attendanceList.forEach((a) => {
      if (!a.date) return;
      const weekKey = getSundayOfWeek(a.date);
      if (!map[weekKey]) map[weekKey] = {};
      const st = a.service_type || "주일예배";
      if (!map[weekKey][st]) map[weekKey][st] = [];
      map[weekKey][st].push(a);
    });
    return map;
  }, [attendanceList]);

  /** 이번 주 출석 인원 (주일1부/주일예배, 주 단위 집계, 동일인 중복 제거) */
  const thisWeekPresent = useMemo(() => {
    const st1 = "주일1부예배";
    const st2 = "주일예배";
    const list = byWeekService[thisWeek]?.[st1] || byWeekService[thisWeek]?.[st2] || [];
    const presentIds = new Set<string>();
    list.forEach((a) => {
      if (a.status === "출석" || a.status === "온라인") presentIds.add(a.member_id);
    });
    return presentIds.size;
  }, [byWeekService, thisWeek]);

  const lastWeekPresent = useMemo(() => {
    const st1 = "주일1부예배";
    const st2 = "주일예배";
    const list = byWeekService[lastWeek]?.[st1] || byWeekService[lastWeek]?.[st2] || [];
    const presentIds = new Set<string>();
    list.forEach((a) => {
      if (a.status === "출석" || a.status === "온라인") presentIds.add(a.member_id);
    });
    return presentIds.size;
  }, [byWeekService, lastWeek]);

  const attendanceRate = totalActive > 0 ? Math.round((thisWeekPresent / totalActive) * 100) : 0;
  const prevRate = totalActive > 0 && lastWeekPresent > 0 ? Math.round((lastWeekPresent / totalActive) * 100) : 0;
  const rateDiff = attendanceRate - prevRate;

  const monthlyRate = useMemo(() => {
    const thisMonth = new Date().getMonth();
    const thisYear = new Date().getFullYear();
    const monthSundays = recentSundays.filter((d) => {
      const [y, m] = d.split("-").map(Number);
      return y === thisYear && m - 1 === thisMonth;
    });
    let totalPresent = 0;
    let totalPossible = 0;
    monthSundays.forEach((weekKey) => {
      const list = byWeekService[weekKey]?.["주일1부예배"] || byWeekService[weekKey]?.["주일예배"] || [];
      const presentIds = new Set<string>();
      list.forEach((a) => {
        if (a.status === "출석" || a.status === "온라인") presentIds.add(a.member_id);
      });
      totalPresent += presentIds.size;
      totalPossible += totalActive;
    });
    return totalPossible > 0 ? Math.round((totalPresent / totalPossible) * 100) : 0;
  }, [byWeekService, recentSundays, totalActive]);

  const consecutiveAbsent = useMemo(() => {
    const n = 3;
    const lastNWeeks = recentSundays.slice(-n);
    const absentIds: string[] = [];
    activeMembers.forEach((m) => {
      const hadAttendance = lastNWeeks.some((weekKey) => {
        const list = byWeekService[weekKey]?.["주일1부예배"] || byWeekService[weekKey]?.["주일예배"] || [];
        return list.some((a) => a.member_id === m.id && (a.status === "출석" || a.status === "온라인"));
      });
      if (!hadAttendance) absentIds.push(m.id);
    });
    return absentIds;
  }, [activeMembers, byWeekService, recentSundays]);

  const weeklyTrendData = useMemo(() => {
    return recentSundays.map((weekKey) => {
      const st1 = byWeekService[weekKey]?.["주일1부예배"] || byWeekService[weekKey]?.["주일예배"] || [];
      const st2 = byWeekService[weekKey]?.["수요예배"] || [];
      const st3 = byWeekService[weekKey]?.["금요기도회"] || [];
      const sunSet = new Set<string>();
      const wedSet = new Set<string>();
      const friSet = new Set<string>();
      st1.forEach((a) => { if (a.status === "출석" || a.status === "온라인") sunSet.add(a.member_id); });
      st2.forEach((a) => { if (a.status === "출석" || a.status === "온라인") wedSet.add(a.member_id); });
      st3.forEach((a) => { if (a.status === "출석" || a.status === "온라인") friSet.add(a.member_id); });
      const label = weekKey.slice(5).replace("-", "/");
      return { week: label, 주일: sunSet.size, 수요: wedSet.size, 금요: friSet.size };
    });
  }, [byWeekService, recentSundays]);

  const deptRates = useMemo(() => {
    const deptMap: Record<string, { present: number; total: number }> = {};
    const list = byWeekService[thisWeek]?.["주일1부예배"] || byWeekService[thisWeek]?.["주일예배"] || [];
    const presentIds = new Set(list.filter((a) => a.status === "출석" || a.status === "온라인").map((a) => a.member_id));
    activeMembers.forEach((m) => {
      const dept = m.dept || "기타";
      if (!deptMap[dept]) deptMap[dept] = { present: 0, total: 0 };
      deptMap[dept].total += 1;
      if (presentIds.has(m.id)) deptMap[dept].present += 1;
    });
    return Object.entries(deptMap).map(([dept, { present, total }]) => ({
      dept,
      rate: total > 0 ? Math.round((present / total) * 100) : 0,
      present,
      total,
    }));
  }, [activeMembers, byWeekService, thisWeek]);

  const heatmapData = useMemo(() => {
    const weeks = recentSundays.slice(-8);
    return weeks.map((weekKey) => {
      const list = byWeekService[weekKey]?.["주일1부예배"] || byWeekService[weekKey]?.["주일예배"] || [];
      const presentIds = new Set(list.filter((a) => a.status === "출석" || a.status === "온라인").map((a) => a.member_id));
      const rate = totalActive > 0 ? (presentIds.size / totalActive) * 100 : 0;
      return { date: weekKey.slice(5), rate: Math.round(rate), present: presentIds.size, total: totalActive };
    });
  }, [byWeekService, recentSundays, totalActive]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="text-xs text-gray-500 mb-1">이번 주 출석</div>
          <div className="text-2xl font-bold text-[#1e3a5f]">
            {thisWeekPresent} <span className="text-sm font-normal text-gray-500">/ {totalActive}명</span>
          </div>
          <div className="flex items-center gap-1 mt-1 text-sm">
            {rateDiff >= 0 ? (
              <span className="text-green-600">▲ {rateDiff}%p</span>
            ) : (
              <span className="text-red-600">▼ {Math.abs(rateDiff)}%p</span>
            )}
            <span className="text-gray-400">전주 대비</span>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="text-xs text-gray-500 mb-1">이번 주 출석률</div>
          <div className="text-2xl font-bold text-[#1e3a5f]">{attendanceRate}%</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="text-xs text-gray-500 mb-1">이번 달 평균 출석률</div>
          <div className="text-2xl font-bold text-[#1e3a5f]">{monthlyRate}%</div>
        </div>
        <button
          type="button"
          onClick={() => onOpenAbsenteeList?.(consecutiveAbsent)}
          className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 text-left hover:shadow-md transition"
        >
          <div className="text-xs text-gray-500 mb-1">3주 연속 결석</div>
          <div className="text-2xl font-bold text-red-600">{consecutiveAbsent.length}명</div>
          <div className="text-xs text-gray-400 mt-1">클릭 시 명단</div>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <h4 className="text-sm font-semibold text-[#1e3a5f] mb-4">주간 출석 추이 (최근 12주)</h4>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={weeklyTrendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis dataKey="week" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: any) => [`${v ?? 0}명`, ""]} />
              <Legend />
              <Line type="monotone" dataKey="주일" stroke={NAVY} strokeWidth={2} name="주일" dot={{ r: 3 }} />
              <Line type="monotone" dataKey="수요" stroke={GOLD} strokeWidth={2} name="수요" dot={{ r: 3 }} />
              <Line type="monotone" dataKey="금요" stroke={GRAY} strokeWidth={2} name="금요" dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <h4 className="text-sm font-semibold text-[#1e3a5f] mb-4">부서별 출석률</h4>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={deptRates} layout="vertical" margin={{ left: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="dept" tick={{ fontSize: 11 }} width={55} />
              <Tooltip formatter={(v: number | undefined) => [`${v ?? 0}%`, "출석률"]} />
              <Bar dataKey="rate" name="출석률" fill={NAVY} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <h4 className="text-sm font-semibold text-[#1e3a5f] mb-4">월별 출석 히트맵 (최근 8주)</h4>
        <div className="flex flex-wrap gap-2">
          {heatmapData.map((row) => (
            <div
              key={row.date}
              className="rounded-lg px-3 py-2 text-center text-xs font-medium text-white min-w-[4rem]"
              style={{
                backgroundColor:
                  row.rate >= 80
                    ? NAVY
                    : row.rate >= 50
                      ? "#4a6fa5"
                      : row.rate >= 20
                        ? "#7a9bc4"
                        : "rgba(30,58,95,0.2)",
              }}
              title={`${row.date} ${row.rate}% (${row.present}/${row.total}명)`}
            >
              {row.date}
              <br />
              {row.rate}%
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
