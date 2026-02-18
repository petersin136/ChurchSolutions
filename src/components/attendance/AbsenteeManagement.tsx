"use client";

import { useMemo, useState } from "react";
import type { Member } from "@/types/db";
import type { Attendance } from "@/types/db";

export interface AbsenteeManagementProps {
  members: Member[];
  attendanceList: Attendance[];
  consecutiveWeeks?: number;
  onAddVisit?: (memberId: string) => void;
}

function getActiveMembers(members: Member[]) {
  return members.filter((m) => (m.member_status || m.status) === "활동" || !m.member_status);
}

function getRecentSundays(count: number): string[] {
  const out: string[] = [];
  const d = new Date();
  for (let i = 0; i < count; i++) {
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? 0 : -7);
    const sun = new Date(d);
    sun.setDate(diff - i * 7);
    out.unshift(sun.toISOString().slice(0, 10));
  }
  return out;
}

export function AbsenteeManagement({
  members,
  attendanceList,
  consecutiveWeeks = 3,
  onAddVisit,
}: AbsenteeManagementProps) {
  const [nWeeks, setNWeeks] = useState(consecutiveWeeks);

  const activeMembers = useMemo(() => getActiveMembers(members), [members]);
  const recentSundays = useMemo(() => getRecentSundays(nWeeks), [nWeeks]);
  const byDateService = useMemo(() => {
    const map: Record<string, Record<string, Set<string>>> = {};
    attendanceList.forEach((a) => {
      if (!a.date) return;
      const st = a.service_type || "주일예배";
      const key = `${a.date}_${st}`;
      if (!map[a.date]) map[a.date] = {};
      if (!map[a.date][st]) map[a.date][st] = new Set();
      if (a.status === "출석" || a.status === "온라인") map[a.date][st].add(a.member_id);
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
        const d = lastNSundays[i];
        const present =
          (byDateService[d]?.["주일1부예배"] || byDateService[d]?.["주일예배"])?.has(m.id) ?? false;
        if (present) {
          lastPresent = d;
          break;
        }
        consecutive++;
      }
      if (consecutive >= nWeeks) {
        result.push({ member: m, consecutiveWeeks: consecutive, lastPresentDate: lastPresent });
      }
    });
    return result.sort((a, b) => b.consecutiveWeeks - a.consecutiveWeeks);
  }, [activeMembers, byDateService, recentSundays, nWeeks]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4 bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <label className="flex items-center gap-2">
          <span className="text-sm text-gray-600">연속 결석 주</span>
          <select
            value={nWeeks}
            onChange={(e) => setNWeeks(Number(e.target.value))}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
          >
            {[2, 3, 4, 5, 6].map((n) => (
              <option key={n} value={n}>
                {n}주
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50/50">
              <th className="text-left py-3 px-4 font-semibold text-[#1e3a5f]">이름</th>
              <th className="text-left py-3 px-4 font-semibold text-[#1e3a5f]">부서</th>
              <th className="text-left py-3 px-4 font-semibold text-[#1e3a5f]">목장</th>
              <th className="text-center py-3 px-4 font-semibold text-[#1e3a5f]">연속 결석</th>
              <th className="text-left py-3 px-4 font-semibold text-[#1e3a5f]">마지막 출석일</th>
              <th className="text-left py-3 px-4 font-semibold text-[#1e3a5f]">연락처</th>
              <th className="text-center py-3 px-4 font-semibold text-[#1e3a5f]">액션</th>
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
                  <td className="py-3 px-4 text-gray-600">{member.mokjang || member.group || "-"}</td>
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
                  <td className="py-3 px-4">
                    <div className="flex flex-wrap gap-2 justify-center">
                      {member.phone && (
                        <a
                          href={`tel:${member.phone}`}
                          className="px-3 py-1 rounded-lg border border-gray-200 text-xs font-medium hover:bg-gray-50"
                        >
                          전화
                        </a>
                      )}
                      {onAddVisit && (
                        <button
                          type="button"
                          onClick={() => onAddVisit(member.id)}
                          className="px-3 py-1 rounded-lg bg-[#1e3a5f] text-white text-xs font-medium hover:opacity-90"
                        >
                          심방 등록
                        </button>
                      )}
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
