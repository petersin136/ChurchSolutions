"use client";

import { useMemo, useState } from "react";
import { useAppData } from "@/contexts/AppDataContext";
import type { Member } from "@/types/db";
import type { Attendance } from "@/types/db";

export interface AbsenteeManagementProps {
  /** Supabase 미사용 시 사용할 성도 목록 */
  members?: Member[];
  /** Supabase 미사용 시 사용할 출석 목록 */
  attendanceList?: Attendance[];
  consecutiveWeeks?: number;
  onAddVisit?: (memberId: string) => void;
  toast?: (msg: string, type?: "ok" | "err" | "warn") => void;
}

function getActiveMembers(members: Member[]) {
  return members.filter((m) => (m.member_status || m.status) === "활동" || !m.member_status);
}

function fmtLocalDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getRecentSundays(count: number): string[] {
  const now = new Date();
  const thisSunday = new Date(now);
  thisSunday.setDate(now.getDate() - now.getDay());
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const sun = new Date(thisSunday);
    sun.setDate(thisSunday.getDate() - i * 7);
    out.unshift(fmtLocalDate(sun));
  }
  return out;
}

function getSundayOfWeek(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  const sun = new Date(d);
  sun.setDate(d.getDate() - d.getDay());
  return fmtLocalDate(sun);
}

export function AbsenteeManagement({
  members: membersProp,
  attendanceList: attendanceListProp,
  consecutiveWeeks = 3,
  onAddVisit,
  toast,
}: AbsenteeManagementProps) {
  const { db, rawAttendance } = useAppData();
  const [nWeeks, setNWeeks] = useState(consecutiveWeeks);

  const members = membersProp?.length ? membersProp : (db.members ?? []);
  const attendanceList = useMemo(() => {
    if (attendanceListProp?.length) return attendanceListProp;
    const nWeeksAgo = new Date();
    nWeeksAgo.setDate(nWeeksAgo.getDate() - 7 * Math.max(nWeeks, 1));
    const fromDate = fmtLocalDate(nWeeksAgo);
    return rawAttendance
      .filter(a => a.date >= fromDate)
      .map(a => ({
        member_id: a.member_id,
        date: a.date,
        service_type: a.service_type ?? "주일예배",
        status: a.status === "p" ? "출석" : a.status === "o" ? "온라인" : a.status === "a" ? "결석" : a.status,
      }));
  }, [attendanceListProp, rawAttendance, nWeeks]);

  const activeMembers = useMemo(() => getActiveMembers(members), [members]);
  const recentSundays = useMemo(() => getRecentSundays(nWeeks), [nWeeks]);
  const byWeekService = useMemo(() => {
    const map: Record<string, Record<string, Set<string>>> = {};
    attendanceList.forEach((a) => {
      if (!a.date) return;
      const st = a.service_type || "주일예배";
      if (st !== "주일예배" && st !== "주일1부예배") return;
      const weekKey = getSundayOfWeek(a.date);
      if (!map[weekKey]) map[weekKey] = {};
      if (!map[weekKey]["주일예배"]) map[weekKey]["주일예배"] = new Set();
      if (a.status === "출석" || a.status === "온라인") map[weekKey]["주일예배"].add(a.member_id);
    });
    return map;
  }, [attendanceList]);

  const absentees = useMemo(() => {
    const lastNSundays = recentSundays.slice(-nWeeks);
    const result: { member: Member; consecutiveWeeks: number; lastPresentDate: string | null }[] = [];
    activeMembers.forEach((m) => {
      let consecutive = 0;
      let lastPresent: string | null = null;
      for (let i = lastNSundays.length - 1; i >= 0; i--) {
        const weekKey = lastNSundays[i];
        const present = byWeekService[weekKey]?.["주일예배"]?.has(m.id) ?? false;
        if (present) {
          lastPresent = weekKey;
          break;
        }
        consecutive++;
      }
      if (consecutive >= nWeeks) {
        result.push({ member: m, consecutiveWeeks: consecutive, lastPresentDate: lastPresent });
      }
    });
    return result.sort((a, b) => b.consecutiveWeeks - a.consecutiveWeeks);
  }, [activeMembers, byWeekService, recentSundays, nWeeks]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4 bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <label className="flex items-center gap-2 shrink-0">
          <span className="text-sm text-gray-600 whitespace-nowrap">연속 결석 주</span>
          <select
            value={nWeeks}
            onChange={(e) => setNWeeks(Number(e.target.value))}
            className="rounded-lg border border-gray-200 pl-3 pr-9 py-2 text-sm min-w-[72px]"
          >
            {[2, 3, 4, 5, 6].map((n) => (
              <option key={n} value={n}>
                {n}주
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto pr-4">
        <table className="w-full text-sm">
          <colgroup>
            <col />
            <col />
            <col />
            <col />
            <col />
            <col />
            <col className="w-[1px]" />
          </colgroup>
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50/50">
              <th className="text-left py-3 px-4 font-semibold text-[#1e3a5f]">이름</th>
              <th className="text-left py-3 px-4 font-semibold text-[#1e3a5f]">부서</th>
              <th className="text-left py-3 px-4 font-semibold text-[#1e3a5f]">목장</th>
              <th className="text-center py-3 px-4 font-semibold text-[#1e3a5f]">연속 결석</th>
              <th className="text-left py-3 px-4 font-semibold text-[#1e3a5f]">마지막 출석일</th>
              <th className="text-left py-3 px-4 font-semibold text-[#1e3a5f]">연락처</th>
              <th className="text-left py-3 pl-4 pr-6 font-semibold text-[#1e3a5f] whitespace-nowrap">액션</th>
            </tr>
          </thead>
          <tbody>
            {absentees.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-gray-500">
                  해당 조건의 연속 결석자가 없습니다.
                </td>
              </tr>
            ) : (
              absentees.map(({ member, consecutiveWeeks: cw, lastPresentDate }) => (
                <tr key={member.id} className="border-b border-gray-100 hover:bg-gray-50/50">
                  <td className="py-3 px-4 font-medium">{member.name}</td>
                  <td className="py-3 px-4 text-gray-600">{member.dept || "-"}</td>
                  <td className="py-3 px-4 text-gray-600">{(member.mokjang ?? member.group) || "-"}</td>
                  <td className="py-3 px-4 text-center">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                      {cw}주
                    </span>
                  </td>
                  <td className="py-3 px-4 text-gray-600">{lastPresentDate || "-"}</td>
                  <td className="py-3 px-4">
                    {member.phone ? (
                      <a href={`tel:${member.phone}`} className="text-[#1e3a5f] hover:underline">
                        {member.phone}
                      </a>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="py-3 pl-4 pr-6 align-middle">
                    <div className="flex items-center gap-2">
                      <div className="w-[60px] shrink-0 flex items-center justify-start">
                        {member.phone ? (
                          <a
                            href={`tel:${member.phone}`}
                            className="inline-flex items-center justify-center px-2.5 py-1 rounded-lg border border-gray-200 text-xs font-medium hover:bg-gray-50 whitespace-nowrap"
                          >
                            전화
                          </a>
                        ) : null}
                      </div>
                      {onAddVisit ? (
                        <button
                          type="button"
                          onClick={() => onAddVisit(member.id)}
                          className="inline-flex items-center justify-center shrink-0 px-3 py-1 rounded-lg bg-[#1e3a5f] text-white text-xs font-medium hover:opacity-90 whitespace-nowrap"
                        >
                          심방 등록
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
