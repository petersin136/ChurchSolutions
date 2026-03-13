"use client";

import { useMemo, useState } from "react";
import { useAppData } from "@/contexts/AppDataContext";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import type { Member } from "@/types/db";
import type { Attendance } from "@/types/db";
import { CalendarDropdown } from "@/components/CalendarDropdown";
import { ModernSelect } from "@/components/common/ModernSelect";

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

export function AttendanceStatistics({
  members: membersProp,
  attendanceList: attendanceListProp,
  startDate: startProp,
  endDate: endProp,
  toast,
  onExportExcel,
}: AttendanceStatisticsProps) {
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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4 bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <label className="flex items-center gap-2 shrink-0">
          <span className="text-sm text-gray-600 whitespace-nowrap">시작일</span>
          <div className="min-w-[160px]">
            <CalendarDropdown
              value={startDate}
              onChange={setStartDate}
              compact
              style={{ marginBottom: 0 }}
            />
          </div>
        </label>
        <label className="flex items-center gap-2 shrink-0">
          <span className="text-sm text-gray-600 whitespace-nowrap">종료일</span>
          <div className="min-w-[160px]">
            <CalendarDropdown
              value={endDate}
              onChange={setEndDate}
              compact
              style={{ marginBottom: 0 }}
            />
          </div>
        </label>
        <label className="flex items-center gap-2 shrink-0">
          <span className="text-sm text-gray-600 whitespace-nowrap">부서</span>
          <ModernSelect
            value={deptFilter}
            onChange={setDeptFilter}
            options={[{ value: "", label: "전체" }, ...depts.map((d) => ({ value: d, label: d }))]}
            style={{ marginBottom: 0, minWidth: 88 }}
          />
        </label>
        <label className="flex items-center gap-2 shrink-0">
          <span className="text-sm text-gray-600 whitespace-nowrap">정렬</span>
          <ModernSelect
            value={sortBy}
            onChange={(v) => setSortBy(v as "rate" | "name")}
            options={[
              { value: "rate", label: "출석률 순" },
              { value: "name", label: "이름 순" },
            ]}
            style={{ marginBottom: 0, minWidth: 100 }}
          />
        </label>
        {onExportExcel && (
          <button
            type="button"
            onClick={handleExport}
            className="px-4 py-2 rounded-xl border border-[#1e3a5f] text-[#1e3a5f] text-sm font-semibold hover:bg-[#1e3a5f]/5"
          >
            Excel 내보내기
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50/50">
              <th className="text-left py-3 px-4 font-semibold text-[#1e3a5f]">이름</th>
              <th className="text-left py-3 px-4 font-semibold text-[#1e3a5f]">부서</th>
              <th className="text-right py-3 px-4 font-semibold text-[#1e3a5f]">총 주일수</th>
              <th className="text-right py-3 px-4 font-semibold text-[#1e3a5f]">출석</th>
              <th className="text-right py-3 px-4 font-semibold text-[#1e3a5f]">결석</th>
              <th className="text-right py-3 px-4 font-semibold text-[#1e3a5f]">출석률</th>
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
                <td className="py-3 px-4 font-medium">{r.member.name}</td>
                <td className="py-3 px-4 text-gray-600">{r.member.dept || "-"}</td>
                <td className="py-3 px-4 text-right">{fmt(r.총주일)}</td>
                <td className="py-3 px-4 text-right text-slate-800">{fmt(r.출석)}</td>
                <td className="py-3 px-4 text-right text-gray-500">{fmt(r.결석)}</td>
                <td className="py-3 px-4 text-right font-medium">{r.출석률}%</td>
              </tr>
            ))
            )}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <h4 className="text-sm font-semibold text-[#1e3a5f] mb-4">부서별 요약</h4>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2 font-semibold text-[#1e3a5f]">부서</th>
                <th className="text-right py-2 font-semibold text-[#1e3a5f]">등록 인원</th>
                <th className="text-right py-2 font-semibold text-[#1e3a5f]">평균 출석률</th>
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
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4" style={{ minHeight: 280 }}>
          <h4 className="text-sm font-semibold text-[#1e3a5f] mb-4">월별 출석률 추이</h4>
          {monthlyChart.length === 0 ? (
            <div className="text-sm text-gray-500">출석 데이터가 없습니다.</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={monthlyChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: any) => [`${v ?? 0}%`, "출석률"]} />
                <Bar dataKey="rate" name="출석률" fill="#1e3a5f" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
