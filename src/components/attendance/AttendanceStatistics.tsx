"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import type { Member } from "@/types/db";
import type { Attendance } from "@/types/db";

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

/** 기간 내 주일 날짜 목록 */
function getSundaysBetween(start: string, end: string): string[] {
  const out: string[] = [];
  const s = new Date(start);
  const e = new Date(end);
  const d = new Date(s);
  while (d.getDay() !== 0) d.setDate(d.getDate() + 1);
  while (d <= e) {
    out.push(d.toISOString().slice(0, 10));
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
  const thisYear = new Date().getFullYear();
  const defaultStart = `${thisYear}-01-01`;
  const defaultEnd = new Date().toISOString().slice(0, 10);
  const [startDate, setStartDate] = useState(startProp ?? defaultStart);
  const [endDate, setEndDate] = useState(endProp ?? defaultEnd);
  const [deptFilter, setDeptFilter] = useState("");
  const [sortBy, setSortBy] = useState<"rate" | "name">("rate");
  const [membersFetched, setMembersFetched] = useState<Member[]>([]);
  const [attendanceFetched, setAttendanceFetched] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(false);

  const useSupabase = !!supabase;
  const members = useSupabase ? membersFetched : (membersProp ?? []);
  const attendanceList = useSupabase ? attendanceFetched : (attendanceListProp ?? []);

  const loadFromSupabase = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    const [memRes, attRes] = await Promise.all([
      supabase.from("members").select("id, name, dept, mokjang, member_status, status").order("name"),
      supabase.from("attendance").select("*").gte("date", startDate).lte("date", endDate),
    ]);
    if (memRes.error) {
      console.error(memRes.error);
      toast?.("데이터 로드 실패: " + memRes.error.message, "err");
    } else setMembersFetched((memRes.data ?? []) as Member[]);
    if (attRes.error) {
      console.error(attRes.error);
      toast?.("출석 데이터 로드 실패: " + attRes.error.message, "err");
      setAttendanceFetched([]);
    } else setAttendanceFetched((attRes.data ?? []) as Attendance[]);
    setLoading(false);
  }, [startDate, endDate, toast]);

  useEffect(() => {
    if (useSupabase) loadFromSupabase();
  }, [useSupabase, loadFromSupabase]);

  const activeMembers = useMemo(() => getActiveMembers(members), [members]);
  const sundays = useMemo(() => getSundaysBetween(startDate, endDate), [startDate, endDate]);
  const totalSundays = sundays.length;

  const byMemberDate = useMemo(() => {
    const map: Record<string, Record<string, string>> = {};
    attendanceList.forEach((a) => {
      if (!a.date) return;
      const st = a.service_type || "주일예배";
      const isSun = st.includes("주일") || st === "주일예배";
      if (!isSun) return;
      if (!map[a.member_id]) map[a.member_id] = {};
      const status = a.status === "출석" || a.status === "온라인" ? "출석" : a.status;
      map[a.member_id][a.date] = status;
    });
    return map;
  }, [attendanceList]);

  const tableRows = useMemo(() => {
    let list = activeMembers.map((m) => {
      const byDate = byMemberDate[m.id] || {};
      let 출석 = 0,
        온라인 = 0,
        결석 = 0,
        병결 = 0,
        기타 = 0;
      sundays.forEach((d) => {
        const s = byDate[d];
        if (s === "출석") 출석++;
        else if (s === "온라인") 온라인++;
        else if (s === "결석") 결석++;
        else if (s === "병결") 병결++;
        else 기타++;
      });
      const totalPresent = 출석 + 온라인;
      const rate = totalSundays > 0 ? Math.round((totalPresent / totalSundays) * 100) : 0;
      return {
        member: m,
        총주일: totalSundays,
        출석,
        온라인,
        결석,
        병결,
        기타,
        출석률: rate,
      };
    });
    if (deptFilter) list = list.filter((r) => r.member.dept === deptFilter);
    if (sortBy === "rate") list = list.sort((a, b) => b.출석률 - a.출석률);
    else list = list.sort((a, b) => (a.member.name || "").localeCompare(b.member.name || ""));
    return list;
  }, [activeMembers, byMemberDate, sundays, totalSundays, deptFilter, sortBy]);

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
        const byDate = byMemberDate[m.id] || {};
        const s = byDate[d];
        if (s === "출석" || s === "온라인") byMonth[monthKey].present += 1;
      });
    });
    return Object.entries(byMonth).map(([month, v]) => ({
      month,
      rate: v.total > 0 ? Math.round((v.present / v.total) * 100) : 0,
      present: v.present,
      total: v.total,
    }));
  }, [sundays, activeMembers, byMemberDate]);

  const depts = useMemo(() => Array.from(new Set(activeMembers.map((m) => m.dept).filter(Boolean))) as string[], [activeMembers]);

  const handleExport = () => {
    const headers = ["이름", "부서", "총 주일수", "출석", "온라인", "결석", "병결", "기타", "출석률"];
    const rows = tableRows.map((r) =>
      [r.member.name, r.member.dept || "", r.총주일, r.출석, r.온라인, r.결석, r.병결, r.기타, `${r.출석률}%`].join(",")
    );
    const csv = "\uFEFF" + [headers.join(","), ...rows].join("\n");
    onExportExcel?.(csv, `출석통계_${startDate}_${endDate}.csv`);
  };

  if (useSupabase && loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <span className="inline-block w-8 h-8 rounded-full border-2 border-[#1e3a5f] border-t-transparent animate-spin" />
        <span className="ml-3 text-gray-600">출석 데이터 로딩 중...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4 bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <label className="flex items-center gap-2">
          <span className="text-sm text-gray-600">시작일</span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
          />
        </label>
        <label className="flex items-center gap-2">
          <span className="text-sm text-gray-600">종료일</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
          />
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
        <label className="flex items-center gap-2">
          <span className="text-sm text-gray-600">정렬</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as "rate" | "name")}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
          >
            <option value="rate">출석률 순</option>
            <option value="name">이름 순</option>
          </select>
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
              <th className="text-right py-3 px-4 font-semibold text-[#1e3a5f]">온라인</th>
              <th className="text-right py-3 px-4 font-semibold text-[#1e3a5f]">결석</th>
              <th className="text-right py-3 px-4 font-semibold text-[#1e3a5f]">병결</th>
              <th className="text-right py-3 px-4 font-semibold text-[#1e3a5f]">기타</th>
              <th className="text-right py-3 px-4 font-semibold text-[#1e3a5f]">출석률</th>
            </tr>
          </thead>
          <tbody>
            {tableRows.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-12 text-center text-gray-500">
                  {useSupabase ? "기간 내 성도·출석 데이터가 없습니다. 성도 관리와 출석 체크에서 데이터를 등록해 주세요." : "표시할 데이터가 없습니다."}
                </td>
              </tr>
            ) : (
            tableRows.map((r) => (
              <tr key={r.member.id} className="border-b border-gray-100 hover:bg-gray-50/50">
                <td className="py-3 px-4 font-medium">{r.member.name}</td>
                <td className="py-3 px-4 text-gray-600">{r.member.dept || "-"}</td>
                <td className="py-3 px-4 text-right">{fmt(r.총주일)}</td>
                <td className="py-3 px-4 text-right text-green-600">{fmt(r.출석)}</td>
                <td className="py-3 px-4 text-right text-blue-600">{fmt(r.온라인)}</td>
                <td className="py-3 px-4 text-right text-gray-500">{fmt(r.결석)}</td>
                <td className="py-3 px-4 text-right text-amber-600">{fmt(r.병결)}</td>
                <td className="py-3 px-4 text-right text-gray-400">{fmt(r.기타)}</td>
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
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <h4 className="text-sm font-semibold text-[#1e3a5f] mb-4">월별 출석률 추이</h4>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthlyChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number | undefined) => [`${v ?? 0}%`, "출석률"]} />
              <Bar dataKey="rate" name="출석률" fill="#1e3a5f" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
