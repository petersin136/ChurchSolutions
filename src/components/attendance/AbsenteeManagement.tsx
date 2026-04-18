"use client";

import { useMemo, useState, useEffect } from "react";
import { tokens } from "@/styles/tokens";
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

function useIsMobile(bp = 768) {
  const [m, setM] = useState(false);
  useEffect(() => {
    const c = () => setM(window.innerWidth <= bp);
    c();
    window.addEventListener("resize", c);
    return () => window.removeEventListener("resize", c);
  }, [bp]);
  return m;
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
  const mob = useIsMobile();
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
    <div
      className={mob ? undefined : "space-y-4"}
      style={
        mob
          ? {
              display: "flex",
              flexDirection: "column",
              gap: 8,
              minHeight: tokens.layout.mobPastoralPanelMinHeight,
              minWidth: 0,
            }
          : undefined
      }
    >
      <div
        className={`flex flex-wrap items-center bg-white rounded-xl shadow-sm border border-gray-100 ${mob ? "p-2 gap-2" : "gap-4 p-4"}`}
        style={mob ? { flexShrink: 0 } : undefined}
      >
        <label className={`flex items-center gap-2 shrink-0 ${mob ? "text-[11px] text-gray-600" : "text-sm text-gray-600"}`}>
          <span className="whitespace-nowrap">연속 결석 주</span>
          <select
            value={nWeeks}
            onChange={(e) => setNWeeks(Number(e.target.value))}
            className={
              mob
                ? "ml-1 h-6 min-w-[64px] rounded border border-gray-200 px-2 text-[11px]"
                : "ml-3 min-w-[72px] rounded-lg border border-gray-200 py-2 pl-3 pr-9 text-sm"
            }
          >
            {[2, 3, 4, 5, 6].map((n) => (
              <option key={n} value={n}>
                {n}주
              </option>
            ))}
          </select>
        </label>
      </div>

      <div
        className={`bg-white rounded-xl shadow-sm border border-gray-100 ${mob ? "" : "overflow-x-auto pr-4"}`}
        style={mob ? { flex: 1, minHeight: 0, overflowY: "auto", WebkitOverflowScrolling: "touch" } : undefined}
      >
        {mob ? (
          <div className="space-y-0">
            <div className="flex items-center border-b border-gray-100 px-2 py-1 text-[9px] font-medium text-gray-400">
              <span className="w-[52px] shrink-0">이름</span>
              <span className="w-[40px] shrink-0 truncate">부서</span>
              <span className="w-[36px] shrink-0 text-center">결석</span>
              <span className="min-w-0 flex-1 truncate text-center">마지막출석</span>
              <span className="w-[52px] shrink-0 text-center">액션</span>
            </div>
            {absentees.length === 0 ? (
              <div className="px-2 py-6 text-center text-[11px] text-gray-500">해당 조건의 연속 결석자가 없습니다.</div>
            ) : (
              absentees.map(({ member, consecutiveWeeks: cw, lastPresentDate }) => {
                const shortDate = lastPresentDate ? lastPresentDate.slice(5) : "-";
                return (
                  <div
                    key={member.id}
                    className="flex items-center border-b border-gray-50 px-2 py-1.5 text-[11px]"
                  >
                    <span className="w-[52px] shrink-0 truncate font-medium text-gray-900">{member.name}</span>
                    <span className="w-[40px] shrink-0 truncate text-gray-500">{member.dept || "·"}</span>
                    <span className="w-[36px] shrink-0 text-center font-semibold text-red-600">{cw}주</span>
                    <span className="min-w-0 flex-1 truncate text-center text-[10px] text-gray-500">{shortDate}</span>
                    <span className="flex w-[52px] shrink-0 items-center justify-center gap-1">
                      {member.phone ? (
                        <a href={`tel:${member.phone}`} className="text-[14px] leading-none" title="전화" aria-label="전화">
                          📞
                        </a>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                      {onAddVisit ? (
                        <button
                          type="button"
                          onClick={() => onAddVisit(member.id)}
                          className="h-6 shrink-0 rounded bg-[#1e40af] px-1.5 text-[9px] font-medium text-white"
                        >
                          심방
                        </button>
                      ) : null}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        ) : (
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
                <th className="px-4 py-3 text-left font-semibold text-[#1e40af]">이름</th>
                <th className="px-4 py-3 text-left font-semibold text-[#1e40af]">부서</th>
                <th className="px-4 py-3 text-left font-semibold text-[#1e40af]">목장</th>
                <th className="px-4 py-3 text-center font-semibold text-[#1e40af]">연속 결석</th>
                <th className="px-4 py-3 text-left font-semibold text-[#1e40af]">마지막 출석일</th>
                <th className="px-4 py-3 text-left font-semibold text-[#1e40af]">연락처</th>
                <th className="whitespace-nowrap py-3 pl-4 pr-6 text-left font-semibold text-[#1e40af]">액션</th>
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
                    <td className="px-4 py-3 font-medium">{member.name}</td>
                    <td className="px-4 py-3 text-gray-600">{member.dept || "-"}</td>
                    <td className="px-4 py-3 text-gray-600">{(member.mokjang ?? member.group) || "-"}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
                        {cw}주
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{lastPresentDate || "-"}</td>
                    <td className="px-4 py-3">
                      {member.phone ? (
                        <a href={`tel:${member.phone}`} className="text-[#1e40af] hover:underline">
                          {member.phone}
                        </a>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="py-3 pl-4 pr-6 align-middle">
                      <div className="flex items-center gap-2">
                        <div className="flex w-[60px] shrink-0 items-center justify-start">
                          {member.phone ? (
                            <a
                              href={`tel:${member.phone}`}
                              className="inline-flex items-center justify-center rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-medium whitespace-nowrap hover:bg-gray-50"
                            >
                              전화
                            </a>
                          ) : null}
                        </div>
                        {onAddVisit ? (
                          <button
                            type="button"
                            onClick={() => onAddVisit(member.id)}
                            className="inline-flex shrink-0 items-center justify-center rounded-lg bg-[#1e40af] px-3 py-1 text-xs font-medium whitespace-nowrap text-white hover:opacity-90"
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
        )}
      </div>
    </div>
  );
}
