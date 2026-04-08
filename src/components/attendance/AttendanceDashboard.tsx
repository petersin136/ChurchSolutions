"use client";

import { useMemo, useState, useEffect } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";
import type { Member } from "@/types/db";
import type { Attendance } from "@/types/db";
import { tokens } from "@/styles/tokens";
import LazyChart from "../common/LazyChart";

const { color: tc, fontSize: tf, height: th, space: ts, radius: tr, fontWeight: tw } = tokens;

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

export interface AttendanceDashboardProps {
  members: Member[];
  attendanceList: Attendance[];
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
  onOpenAbsenteeList,
}: AttendanceDashboardProps) {
  const mob = useIsMobile();
  const activeMembers = useMemo(() => getActiveMembers(members), [members]);
  const totalActive = activeMembers.length;

  const recentSundays = useMemo(() => getRecentSundays(12), []);
  const thisWeek = recentSundays[recentSundays.length - 1];
  const lastWeek = recentSundays[recentSundays.length - 2];

  const byDateService = useMemo(() => {
    const map: Record<string, Record<string, Attendance[]>> = {};
    attendanceList.forEach((a) => {
      if (!a.date) return;
      const st = a.service_type || "주일예배";
      if (st !== "주일예배" && st !== "주일1부예배") return;
      if (!map[a.date]) map[a.date] = {};
      if (!map[a.date]["주일예배"]) map[a.date]["주일예배"] = [];
      map[a.date]["주일예배"].push(a);
    });
    return map;
  }, [attendanceList]);

  const byWeekService = useMemo(() => {
    const map: Record<string, Record<string, Attendance[]>> = {};
    attendanceList.forEach((a) => {
      if (!a.date) return;
      const st = a.service_type || "주일예배";
      if (st !== "주일예배" && st !== "주일1부예배") return;
      const weekKey = getSundayOfWeek(a.date);
      if (!map[weekKey]) map[weekKey] = {};
      if (!map[weekKey]["주일예배"]) map[weekKey]["주일예배"] = [];
      map[weekKey]["주일예배"].push(a);
    });
    return map;
  }, [attendanceList]);

  const thisWeekPresent = useMemo(() => {
    const list = byWeekService[thisWeek]?.["주일예배"] || [];
    const presentIds = new Set<string>();
    list.forEach((a) => {
      if (a.status === "출석" || a.status === "온라인") presentIds.add(a.member_id);
    });
    return presentIds.size;
  }, [byWeekService, thisWeek]);

  const lastWeekPresent = useMemo(() => {
    const list = byWeekService[lastWeek]?.["주일예배"] || [];
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
      const list = byWeekService[weekKey]?.["주일예배"] || [];
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
        const list = byWeekService[weekKey]?.["주일예배"] || [];
        return list.some((a) => a.member_id === m.id && (a.status === "출석" || a.status === "온라인"));
      });
      if (!hadAttendance) absentIds.push(m.id);
    });
    return absentIds;
  }, [activeMembers, byWeekService, recentSundays]);

  const weeklyTrendData = useMemo(() => {
    return recentSundays.map((weekKey) => {
      const list = byWeekService[weekKey]?.["주일예배"] || [];
      const sunSet = new Set<string>();
      list.forEach((a) => { if (a.status === "출석" || a.status === "온라인") sunSet.add(a.member_id); });
      const label = weekKey.slice(5).replace("-", "/");
      return { week: label, 주일예배: sunSet.size };
    });
  }, [byWeekService, recentSundays]);

  const deptRates = useMemo(() => {
    const deptMap: Record<string, { present: number; total: number }> = {};
    const list = byWeekService[thisWeek]?.["주일예배"] || [];
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
      const list = byWeekService[weekKey]?.["주일예배"] || [];
      const presentIds = new Set(list.filter((a) => a.status === "출석" || a.status === "온라인").map((a) => a.member_id));
      const rate = totalActive > 0 ? (presentIds.size / totalActive) * 100 : 0;
      return { date: weekKey.slice(5), rate: Math.round(rate), present: presentIds.size, total: totalActive };
    });
  }, [byWeekService, recentSundays, totalActive]);

  const metricPad = mob ? "6px 8px" : ts.padding.desktopCard;
  const metricMinH = mob ? 50 : th.desktopCardMin;
  const chartH = mob ? 140 : th.desktopChart;
  const mLabel = mob ? 9 : tf.desktop.label;
  const mValue = mob ? 18 : tf.desktop.value;
  const mSub = mob ? 8 : tf.desktop.sub;

  return (
    <div className={mob ? "space-y-2" : "space-y-6"}>
      <div className={mob ? "grid grid-cols-2 gap-1.5" : "grid grid-cols-2 gap-3"} style={{ gridAutoRows: "1fr" }}>
        <div
          className={mob ? "flex flex-col justify-center rounded-lg border border-gray-100 bg-white shadow-sm" : "bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col justify-center"}
          style={{ padding: metricPad, minHeight: metricMinH, borderRadius: mob ? 6 : undefined }}
        >
          <div style={{ fontSize: mLabel, color: tc.labelMuted, marginBottom: ts.gap.xxs }}>이번 주 출석</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: ts.gap.xs }}>
            <span style={{ fontSize: mValue, fontWeight: tw.extrabold, color: tc.navyEmphasis }}>{thisWeekPresent}</span>
            <span style={{ fontSize: mSub, color: tc.labelMuted }}>/ {totalActive}명</span>
          </div>
          <div
            style={{
              fontSize: mSub,
              color: rateDiff >= 0 ? tc.trendPositive : tc.trendNegative,
              marginTop: ts.gap.xxs,
            }}
          >
            {rateDiff >= 0 ? `▲ ${rateDiff}%p` : `▼ ${Math.abs(rateDiff)}%p`} 전주 대비
          </div>
        </div>
        <div
          className={mob ? "flex flex-col justify-center rounded-lg border border-gray-100 bg-white shadow-sm" : "bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col justify-center"}
          style={{ padding: metricPad, minHeight: metricMinH, borderRadius: mob ? 6 : undefined }}
        >
          <div style={{ fontSize: mLabel, color: tc.labelMuted, marginBottom: ts.gap.xxs }}>이번 주 출석률</div>
          <span style={{ fontSize: mValue, fontWeight: tw.extrabold, color: tc.navyEmphasis }}>{attendanceRate}%</span>
        </div>
        <div
          className={mob ? "flex flex-col justify-center rounded-lg border border-gray-100 bg-white shadow-sm" : "bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col justify-center"}
          style={{ padding: metricPad, minHeight: metricMinH, borderRadius: mob ? 6 : undefined }}
        >
          <div style={{ fontSize: mLabel, color: tc.labelMuted, marginBottom: ts.gap.xxs }}>이번 달 평균 출석률</div>
          <span style={{ fontSize: mValue, fontWeight: tw.extrabold, color: tc.navyEmphasis }}>{monthlyRate}%</span>
        </div>
        <button
          type="button"
          onClick={() => onOpenAbsenteeList?.(consecutiveAbsent)}
          className={
            mob
              ? "flex flex-col justify-center rounded-lg border border-gray-100 bg-white text-left shadow-sm transition hover:shadow-md"
              : "bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col justify-center text-left hover:shadow-md transition"
          }
          style={{ padding: metricPad, minHeight: metricMinH, borderRadius: mob ? 6 : undefined }}
        >
          <div style={{ fontSize: mLabel, color: tc.labelMuted, marginBottom: ts.gap.xxs }}>3주 연속 결석</div>
          <span style={{ fontSize: mValue, fontWeight: tw.extrabold, color: tc.navyEmphasis }}>{consecutiveAbsent.length}명</span>
          <div style={{ fontSize: mSub, color: tc.labelMuted, marginTop: ts.gap.xxs }}>클릭 시 명단</div>
        </button>
      </div>

      <div className={mob ? "grid grid-cols-1 gap-2" : "grid grid-cols-1 gap-6 lg:grid-cols-2"}>
        <div
          className={mob ? "rounded-lg border border-gray-100 bg-white p-2 shadow-sm" : "bg-white rounded-xl shadow-sm border border-gray-100 p-4"}
          style={{ maxHeight: chartH + (mob ? 56 : 80) }}
        >
          <h4 className={mob ? "mb-1.5 text-[12px] font-semibold" : "mb-4 text-sm font-semibold"} style={{ color: tc.navyEmphasis }}>
            주간 출석 추이 (최근 12주)
          </h4>
          <LazyChart height={chartH}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={weeklyTrendData} margin={{ top: 5, right: 10, left: mob ? -20 : -15, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={tc.chartGrid} />
                <XAxis dataKey="week" tick={{ fontSize: mob ? 8 : tf.scale.xs }} />
                <YAxis tick={{ fontSize: mob ? 8 : tf.scale.xs }} width={mob ? 28 : undefined} />
                <Tooltip formatter={(v: any) => [`${v ?? 0}명`, ""]} />
                <Line type="monotone" dataKey="주일예배" stroke={tc.navyEmphasis} strokeWidth={2} name="주일예배" dot={{ r: mob ? 2 : 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </LazyChart>
        </div>
        <div
          className={mob ? "rounded-lg border border-gray-100 bg-white p-2 shadow-sm" : "bg-white rounded-xl shadow-sm border border-gray-100 p-4"}
          style={{ maxHeight: chartH + (mob ? 56 : 80) }}
        >
          <h4 className={mob ? "mb-1.5 text-[12px] font-semibold" : "mb-4 text-sm font-semibold"} style={{ color: tc.navyEmphasis }}>
            부서별 출석률
          </h4>
          <LazyChart height={chartH}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={deptRates} layout="vertical" margin={{ top: 5, right: 10, left: mob ? -14 : -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={tc.chartGrid} />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: mob ? 8 : tf.scale.xs }} />
                <YAxis type="category" dataKey="dept" width={mob ? 44 : 60} tick={{ fontSize: mob ? 8 : tf.scale.xs }} />
                <Tooltip formatter={(v: any) => [`${v ?? 0}%`, "출석률"]} />
                <Bar dataKey="rate" name="출석률" fill={tc.navyEmphasis} radius={[0, tr.xs, tr.xs, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </LazyChart>
        </div>
      </div>

      <div className={mob ? "rounded-lg border border-gray-100 bg-white p-2 shadow-sm" : "bg-white rounded-xl shadow-sm border border-gray-100 p-4"}>
        <h4 className={mob ? "mb-1.5 text-[12px] font-semibold" : "mb-4 text-sm font-semibold"} style={{ color: tc.navyEmphasis }}>
          월별 출석 히트맵 (최근 8주)
        </h4>
        <div className={mob ? "grid w-full grid-cols-4 place-items-center gap-1" : "grid w-full grid-cols-4 place-items-center gap-2"}>
          {heatmapData.map((row) => (
            <div
              key={row.date}
              className={mob ? "rounded-md text-center font-medium text-white" : "rounded-lg px-3 py-2 text-center text-xs font-medium text-white min-w-[4rem]"}
              style={{
                width: mob ? 28 : undefined,
                height: mob ? 28 : undefined,
                fontSize: mob ? 8 : undefined,
                lineHeight: mob ? 1.1 : undefined,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: mob ? 2 : undefined,
                backgroundColor:
                  row.rate >= 80
                    ? tc.navyEmphasis
                    : row.rate >= 50
                      ? tc.heatMid
                      : row.rate >= 20
                        ? tc.heatLight
                        : tc.heatFaint,
              }}
              title={`${row.date} ${row.rate}% (${row.present}/${row.total}명)`}
            >
              <span className="block leading-tight">{row.date}</span>
              <span className="block leading-tight">{row.rate}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
