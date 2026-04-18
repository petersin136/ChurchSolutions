"use client";

import { useMemo, useState, useEffect } from "react";
import { useAppData } from "@/contexts/AppDataContext";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import type { Member } from "@/types/db";
import type { Attendance } from "@/types/db";
import { CalendarDropdown } from "@/components/CalendarDropdown";
import { ModernSelect } from "@/components/common/ModernSelect";
import LazyChart from "../common/LazyChart";

const fmt = (n: number) => new Intl.NumberFormat("ko-KR").format(n);

export interface AttendanceStatisticsProps {
  members?: Member[];
  attendanceList?: Attendance[];
  startDate?: string;
  endDate?: string;
  toast?: (msg: string, type?: "ok" | "err" | "warn") => void;
  onExportExcel?: (csv: string, filename: string) => void;
}

function getActiveMembers(members: Member[]) {
  return members.filter((m) => (m.member_status || m.status) === "활동" || !m.member_status);
}

function fmtLocalDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getSundayOfWeek(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  const sun = new Date(d);
  sun.setDate(d.getDate() - d.getDay());
  return fmtLocalDate(sun);
}

/** 기간 내 주일 날짜 목록 */
function getSundaysBetween(start: string, end: string): string[] {
  const out: string[] = [];
  const s = new Date(start + "T12:00:00");
  const e = new Date(end + "T12:00:00");
  const d = new Date(s);
  while (d.getDay() !== 0) d.setDate(d.getDate() + 1);
  while (d <= e) {
    out.push(fmtLocalDate(d));
    d.setDate(d.getDate() + 7);
  }
  return out;
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

export function AttendanceStatistics({
  members: membersProp,
  attendanceList: attendanceListProp,
  startDate: startProp,
  endDate: endProp,
  toast,
  onExportExcel,
}: AttendanceStatisticsProps) {
  const mob = useIsMobile();
  const { db, rawAttendance } = useAppData();
  const thisYear = new Date().getFullYear();
  const defaultStart = `${thisYear}-01-01`;
  const defaultEnd = new Date().toISOString().slice(0, 10);
  const [startDate, setStartDate] = useState(startProp ?? defaultStart);
  const [endDate, setEndDate] = useState(endProp ?? defaultEnd);
  const [deptFilter, setDeptFilter] = useState("");
  const [sortBy, setSortBy] = useState<"rate" | "name">("rate");

  const members = membersProp?.length ? membersProp : (db.members ?? []);
  const attendanceList = useMemo(() => {
    if (attendanceListProp?.length) return attendanceListProp;
    return rawAttendance
      .filter(a => a.date >= startDate && a.date <= endDate)
      .map(a => ({
        member_id: a.member_id,
        date: a.date,
        service_type: a.service_type ?? "주일예배",
        status: a.status === "p" ? "출석" : a.status === "o" ? "온라인" : a.status === "a" ? "결석" : a.status,
      }));
  }, [attendanceListProp, rawAttendance, startDate, endDate]);

  const activeMembers = useMemo(() => getActiveMembers(members), [members]);
  const sundays = useMemo(() => getSundaysBetween(startDate, endDate), [startDate, endDate]);
  const totalSundays = sundays.length;

  const byMemberWeek = useMemo(() => {
    const map: Record<string, Record<string, string>> = {};
    attendanceList.forEach((a) => {
      if (!a.date) return;
      const st = a.service_type || "주일예배";
      if (st !== "주일예배" && st !== "주일1부예배") return;
      const weekKey = getSundayOfWeek(a.date);
      if (!map[a.member_id]) map[a.member_id] = {};
      const status = a.status === "출석" || a.status === "온라인" ? "출석" : a.status;
      if (!map[a.member_id][weekKey] || status === "출석") map[a.member_id][weekKey] = status;
    });
    return map;
  }, [attendanceList]);

  const tableRows = useMemo(() => {
    let list = activeMembers.map((m) => {
      const byWeek = byMemberWeek[m.id] || {};
      let 출석 = 0,
        결석 = 0;
      sundays.forEach((d) => {
        const s = byWeek[d];
        if (s === "출석") 출석++;
        else 결석++;
      });
      const rate = totalSundays > 0 ? Math.round((출석 / totalSundays) * 100) : 0;
      return {
        member: m,
        총주일: totalSundays,
        출석,
        결석,
        출석률: rate,
      };
    });
    if (deptFilter) list = list.filter((r) => r.member.dept === deptFilter);
    if (sortBy === "rate") list = list.sort((a, b) => b.출석률 - a.출석률);
    else list = list.sort((a, b) => (a.member.name || "").localeCompare(b.member.name || ""));
    return list;
  }, [activeMembers, byMemberWeek, sundays, totalSundays, deptFilter, sortBy]);

  const deptSummary = useMemo(() => {
    const deptMap: Record<string, { total: number; sumRate: number; count: number }> = {};
    tableRows.forEach((r) => {
      const dept = r.member.dept || "기타";
      if (!deptMap[dept]) deptMap[dept] = { total: 0, sumRate: 0, count: 0 };
      deptMap[dept].total += 1;
      deptMap[dept].sumRate += r.출석률;
      deptMap[dept].count += 1;
    });
    return Object.entries(deptMap).map(([dept, v]) => ({
      부서: dept,
      등록인원: v.count,
      평균출석률: v.count > 0 ? Math.round(v.sumRate / v.count) : 0,
    }));
  }, [tableRows]);

  const monthlyChart = useMemo(() => {
    const byMonth: Record<string, { present: number; total: number }> = {};
    sundays.forEach((d) => {
      const monthKey = d.slice(0, 7);
      if (!byMonth[monthKey]) byMonth[monthKey] = { present: 0, total: 0 };
      byMonth[monthKey].total += activeMembers.length;
      activeMembers.forEach((m) => {
        const byWeek = byMemberWeek[m.id] || {};
        const s = byWeek[d];
        if (s === "출석" || s === "온라인") byMonth[monthKey].present += 1;
      });
    });
    return Object.entries(byMonth).map(([month, v]) => ({
      month,
      rate: v.total > 0 ? Math.round((v.present / v.total) * 100) : 0,
      present: v.present,
      total: v.total,
    }));
  }, [sundays, activeMembers, byMemberWeek]);

  const depts = useMemo(() => Array.from(new Set(activeMembers.map((m) => m.dept).filter(Boolean))) as string[], [activeMembers]);

  const handleExport = () => {
    const headers = ["이름", "부서", "총 주일수", "출석", "결석", "출석률"];
    const rows = tableRows.map((r) =>
      [r.member.name, r.member.dept || "", r.총주일, r.출석, r.결석, `${r.출석률}%`].join(",")
    );
    const csv = "\uFEFF" + [headers.join(","), ...rows].join("\n");
    onExportExcel?.(csv, `출석통계_${startDate}_${endDate}.csv`);
  };

  const statsCards = useMemo(() => {
    const n = tableRows.length;
    const avg = n > 0 ? Math.round(tableRows.reduce((acc, r) => acc + r.출석률, 0) / n) : 0;
    const sum출 = tableRows.reduce((acc, r) => acc + r.출석, 0);
    const sum결 = tableRows.reduce((acc, r) => acc + r.결석, 0);
    return [
      { label: "대상 인원", value: `${fmt(n)}명`, sub: "활동 성도" },
      { label: "평균 출석률", value: `${avg}%`, sub: `주일 ${totalSundays}회` },
      { label: "누적 출석", value: fmt(sum출), sub: "기간 합계" },
      { label: "누적 결석", value: fmt(sum결), sub: "기간 합계" },
    ];
  }, [tableRows, totalSundays]);

  const chartH = mob ? 140 : 260;

  return (
    <div className={mob ? "space-y-2" : "space-y-6"}>
      <div className={`flex flex-wrap items-center bg-white rounded-xl shadow-sm border border-gray-100 ${mob ? "gap-2 p-2" : "gap-4 p-4"}`}>
        <label className={`flex shrink-0 items-center gap-1 ${mob ? "text-[10px] text-gray-600" : "gap-2 text-sm text-gray-600"}`}>
          <span className="whitespace-nowrap">시작일</span>
          <div className={mob ? "min-w-[130px]" : "min-w-[160px]"}>
            <CalendarDropdown
              value={startDate}
              onChange={setStartDate}
              compact
              style={{ marginBottom: 0 }}
            />
          </div>
        </label>
        <label className={`flex shrink-0 items-center gap-1 ${mob ? "text-[10px] text-gray-600" : "gap-2 text-sm text-gray-600"}`}>
          <span className="whitespace-nowrap">종료일</span>
          <div className={mob ? "min-w-[130px]" : "min-w-[160px]"}>
            <CalendarDropdown
              value={endDate}
              onChange={setEndDate}
              compact
              style={{ marginBottom: 0 }}
            />
          </div>
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
          <span className="whitespace-nowrap">정렬</span>
          <ModernSelect
            value={sortBy}
            onChange={(v) => setSortBy(v as "rate" | "name")}
            options={[
              { value: "rate", label: "출석률 순" },
              { value: "name", label: "이름 순" },
            ]}
            style={{ marginBottom: 0, minWidth: mob ? 88 : 100 }}
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

      {mob ? (
        <div className="overflow-hidden rounded-lg border border-gray-100 bg-white">
          <div className="flex items-center border-b border-gray-100 bg-gray-50/50 px-1.5 py-1 text-[9px] font-semibold text-[#1e40af]">
            <span className="w-[44px] shrink-0">이름</span>
            <span className="min-w-0 flex-1 truncate">부서</span>
            <span className="w-[26px] shrink-0 text-right">총</span>
            <span className="w-[26px] shrink-0 text-right">출</span>
            <span className="w-[26px] shrink-0 text-right">결</span>
            <span className="w-[34px] shrink-0 text-right">율</span>
          </div>
          {tableRows.length === 0 ? (
            <div className="px-2 py-8 text-center text-[11px] text-gray-500">기간 내 출석 데이터가 없습니다.</div>
          ) : (
            tableRows.map((r) => (
              <div
                key={r.member.id}
                className="flex items-center border-b border-gray-50 px-1.5 py-1 text-[10px] last:border-0"
              >
                <span className="w-[44px] shrink-0 truncate font-medium text-gray-900">{r.member.name}</span>
                <span className="min-w-0 flex-1 truncate text-gray-600">{r.member.dept || "-"}</span>
                <span className="w-[26px] shrink-0 text-right tabular-nums">{fmt(r.총주일)}</span>
                <span className="w-[26px] shrink-0 text-right tabular-nums text-slate-800">{fmt(r.출석)}</span>
                <span className="w-[26px] shrink-0 text-right tabular-nums text-gray-500">{fmt(r.결석)}</span>
                <span className="w-[34px] shrink-0 text-right font-medium tabular-nums">{r.출석률}%</span>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-100 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50/50">
                <th className="px-4 py-3 text-left font-semibold text-[#1e40af]">이름</th>
                <th className="px-4 py-3 text-left font-semibold text-[#1e40af]">부서</th>
                <th className="px-4 py-3 text-right font-semibold text-[#1e40af]">총 주일수</th>
                <th className="px-4 py-3 text-right font-semibold text-[#1e40af]">출석</th>
                <th className="px-4 py-3 text-right font-semibold text-[#1e40af]">결석</th>
                <th className="px-4 py-3 text-right font-semibold text-[#1e40af]">출석률</th>
              </tr>
            </thead>
            <tbody>
              {tableRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-gray-500">
                    기간 내 출석 데이터가 없습니다.
                  </td>
                </tr>
              ) : (
                tableRows.map((r) => (
                  <tr key={r.member.id} className="border-b border-gray-100 hover:bg-gray-50/50">
                    <td className="px-4 py-3 font-medium">{r.member.name}</td>
                    <td className="px-4 py-3 text-gray-600">{r.member.dept || "-"}</td>
                    <td className="px-4 py-3 text-right">{fmt(r.총주일)}</td>
                    <td className="px-4 py-3 text-right text-slate-800">{fmt(r.출석)}</td>
                    <td className="px-4 py-3 text-right text-gray-500">{fmt(r.결석)}</td>
                    <td className="px-4 py-3 text-right font-medium">{r.출석률}%</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      <div className={mob ? "grid grid-cols-1 gap-2" : "grid grid-cols-1 gap-6 lg:grid-cols-2"}>
        <div className={mob ? "rounded-lg border border-gray-100 bg-white p-2" : "rounded-xl border border-gray-100 bg-white p-4 shadow-sm"}>
          <h4 className={mob ? "mb-2 text-[12px] font-semibold text-[#1e40af]" : "mb-4 text-sm font-semibold text-[#1e40af]"}>
            부서별 요약
          </h4>
          {mob ? (
            <div className="space-y-0">
              <div className="flex border-b border-gray-100 px-1 py-1 text-[9px] font-semibold text-[#1e40af]">
                <span className="min-w-0 flex-1">부서</span>
                <span className="w-[40px] shrink-0 text-right">인원</span>
                <span className="w-[44px] shrink-0 text-right">평균</span>
              </div>
              {deptSummary.map((row) => (
                <div key={row.부서} className="flex border-b border-gray-50 px-1 py-1 text-[10px] last:border-0">
                  <span className="min-w-0 flex-1 truncate">{row.부서}</span>
                  <span className="w-[40px] shrink-0 text-right tabular-nums">{fmt(row.등록인원)}</span>
                  <span className="w-[44px] shrink-0 text-right font-medium tabular-nums">{row.평균출석률}%</span>
                </div>
              ))}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="py-2 text-left font-semibold text-[#1e40af]">부서</th>
                  <th className="py-2 text-right font-semibold text-[#1e40af]">등록 인원</th>
                  <th className="py-2 text-right font-semibold text-[#1e40af]">평균 출석률</th>
                </tr>
              </thead>
              <tbody>
                {deptSummary.map((row) => (
                  <tr key={row.부서} className="border-b border-gray-100">
                    <td className="py-2">{row.부서}</td>
                    <td className="py-2 text-right">{fmt(row.등록인원)}</td>
                    <td className="py-2 text-right font-medium">{row.평균출석률}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div
          className={mob ? "rounded-lg border border-gray-100 bg-white p-2" : "rounded-xl border border-gray-100 bg-white p-4 shadow-sm"}
          style={{ minHeight: mob ? chartH + 48 : 280 }}
        >
          <h4 className={mob ? "mb-1.5 text-[12px] font-semibold text-[#1e40af]" : "mb-4 text-sm font-semibold text-[#1e40af]"}>
            월별 출석률 추이
          </h4>
          {monthlyChart.length === 0 ? (
            <div className={mob ? "text-[11px] text-gray-500" : "text-sm text-gray-500"}>출석 데이터가 없습니다.</div>
          ) : (
            <div className={mob ? "h-[140px]" : ""}>
              <LazyChart height={chartH}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyChart}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                    <XAxis dataKey="month" tick={{ fontSize: mob ? 9 : 11 }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: mob ? 9 : 11 }} width={mob ? 28 : undefined} />
                    <Tooltip formatter={(v: any) => [`${v ?? 0}%`, "출석률"]} />
                    <Bar dataKey="rate" name="출석률" fill="#2563eb" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </LazyChart>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
