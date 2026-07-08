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
} from "recharts";
import type { CSSProperties } from "react";
import type { Member } from "@/types/db";
import type { Attendance } from "@/types/db";
import { tokens } from "@/styles/tokens";
import { DASH_CHART } from "@/styles/pastoralDashboardTokens";
import LazyChart from "../common/LazyChart";

const { color: tc, fontSize: tf, height: th, space: ts, fontWeight: tw } = tokens;

type DeptRateRow = { dept: string; rate: number; present: number; total: number };

function DashDeptAxisLabel({ text, hot, fontSize }: { text: string; hot: boolean; fontSize: number }) {
  const color = hot ? DASH_CHART.statBarHighlight : DASH_CHART.statSubGray;
  const fw = hot ? 900 : 700;
  const base: CSSProperties = {
    fontSize,
    color,
    whiteSpace: "nowrap",
    flexShrink: 0,
    textAlign: "center",
    lineHeight: 1.2,
    width: "100%",
    letterSpacing: hot ? "-0.02em" : "-0.01em",
    fontWeight: fw,
    overflow: "hidden",
    textOverflow: "ellipsis",
  };
  return <span style={base}>{text}</span>;
}

function DashStyleDeptBarChart({ items, mob, height }: { items: DeptRateRow[]; mob: boolean; height: number }) {
  const maxRate = 100;
  const barMin = mob ? 40 : 52;
  const valueSize = mob ? 30 : 44;
  const subSize = mob ? 11 : 17;
  const axisSize = mob ? 11 : 15;
  const padTop = mob ? 8 : 18;
  const padLeft = mob ? 8 : 14;

  const hasData = items.some((i) => i.rate > 0);
  if (!hasData) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height,
          color: tc.labelMuted,
          fontSize: mob ? 12 : 14,
        }}
      >
        출석 데이터가 없습니다.
      </div>
    );
  }

  const hotIndex = items.reduce(
    (best, item, i) => (item.rate >= (items[best]?.rate ?? -1) ? i : best),
    0,
  );

  return (
    <div
      style={{
        display: "flex",
        alignItems: "stretch",
        gap: mob ? 8 : 16,
        height,
        paddingTop: 8,
        boxSizing: "border-box",
      }}
    >
      {items.map((item, i) => {
        const hot = i === hotIndex && item.rate > 0;
        const spacerFlex = Math.max(0, maxRate - item.rate);
        const barFlex = item.rate;
        const pctColor = hot ? DASH_CHART.statTextYearHighlight : DASH_CHART.statTextGray;
        const subColor = hot ? DASH_CHART.statSubYearHighlight : DASH_CHART.statSubGray;
        const pctShadow = hot ? "0 1px 1px rgba(255,255,255,0.45)" : "0 1px 1px rgba(255,255,255,0.55)";
        return (
          <div
            key={item.dept}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "stretch",
              gap: 8,
              minWidth: 0,
              minHeight: 0,
            }}
          >
            <div style={{ flex: 1, width: "100%", display: "flex", flexDirection: "column", minHeight: 0 }}>
              {spacerFlex > 0 && <div style={{ flex: spacerFlex, minHeight: 0 }} />}
              {item.rate > 0 && (
                <div
                  style={{
                    flex: barFlex,
                    minHeight: barMin,
                    width: "100%",
                    borderRadius: "12px 12px 0 0",
                    background: hot ? DASH_CHART.statBarHighlight : DASH_CHART.statBarBase,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-start",
                    padding: `${padTop}px ${padLeft}px 0`,
                    boxSizing: "border-box",
                    overflow: "hidden",
                  }}
                >
                  <span
                    style={{
                      fontSize: valueSize,
                      fontWeight: 900,
                      color: pctColor,
                      letterSpacing: "-0.04em",
                      lineHeight: 1,
                      textShadow: pctShadow,
                      fontFeatureSettings: '"tnum"',
                      maxWidth: "100%",
                      overflow: "hidden",
                    }}
                  >
                    {item.rate}%
                  </span>
                  <span
                    style={{
                      fontSize: subSize,
                      color: subColor,
                      marginTop: Math.max(4, Math.round(padTop * 0.4)),
                      fontWeight: 800,
                      letterSpacing: "-0.02em",
                      textShadow: pctShadow,
                      maxWidth: "100%",
                      overflow: "hidden",
                      whiteSpace: "nowrap",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {item.present}/{item.total}명
                  </span>
                </div>
              )}
            </div>
            <DashDeptAxisLabel text={item.dept} hot={hot} fontSize={axisSize} />
          </div>
        );
      })}
    </div>
  );
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

export interface AttendanceDashboardProps {
  members: Member[];
  attendanceList: Attendance[];
  /** 출석 체크 하단 임베드 — 요약 카드·차트 2개만 (히트맵·결석자 카드 제외) */
  embedded?: boolean;
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

/** 기간 내 주일 날짜 목록 */
function getSundaysBetween(start: string, end: string): string[] {
  const out: string[] = [];
  const s = new Date(start + "T12:00:00");
  const e = new Date(end + "T12:00:00");
  const d = new Date(s);
  while (d.getDay() !== 0) d.setDate(d.getDate() + 1);
  while (d <= e) {
    out.push(fmtDate(d));
    d.setDate(d.getDate() + 7);
  }
  return out;
}

export function AttendanceDashboard({
  members,
  attendanceList,
  embedded = false,
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
    // embedded(출석 체크 하단): 아래 부서별 요약 표와 동일 — 올해 주일 평균 출석률
    if (embedded) {
      const year = new Date().getFullYear();
      const sundays = getSundaysBetween(`${year}-01-01`, thisWeek);
      const totalSundays = sundays.length;
      if (totalSundays === 0) return [];

      const byMemberWeek: Record<string, Record<string, string>> = {};
      attendanceList.forEach((a) => {
        if (!a.date) return;
        const st = a.service_type || "주일예배";
        if (st !== "주일예배" && st !== "주일1부예배") return;
        const weekKey = getSundayOfWeek(a.date);
        if (!byMemberWeek[a.member_id]) byMemberWeek[a.member_id] = {};
        const status = a.status === "출석" || a.status === "온라인" ? "출석" : a.status;
        if (!byMemberWeek[a.member_id][weekKey] || status === "출석") byMemberWeek[a.member_id][weekKey] = status;
      });

      const deptMap: Record<string, { sumRate: number; count: number; presentSlots: number }> = {};
      activeMembers.forEach((m) => {
        const byWeek = byMemberWeek[m.id] || {};
        let present = 0;
        sundays.forEach((d) => {
          if (byWeek[d] === "출석") present += 1;
        });
        const rate = Math.round((present / totalSundays) * 100);
        const dept = m.dept || "기타";
        if (!deptMap[dept]) deptMap[dept] = { sumRate: 0, count: 0, presentSlots: 0 };
        deptMap[dept].sumRate += rate;
        deptMap[dept].count += 1;
        deptMap[dept].presentSlots += present;
      });

      return Object.entries(deptMap).map(([dept, v]) => ({
        dept,
        rate: v.count > 0 ? Math.round(v.sumRate / v.count) : 0,
        present: v.presentSlots,
        total: v.count * totalSundays,
      }));
    }

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
  }, [activeMembers, attendanceList, byWeekService, embedded, thisWeek]);

  const heatmapData = useMemo(() => {
    const weeks = recentSundays.slice(-8);
    return weeks.map((weekKey) => {
      const list = byWeekService[weekKey]?.["주일예배"] || [];
      const presentIds = new Set(list.filter((a) => a.status === "출석" || a.status === "온라인").map((a) => a.member_id));
      const rate = totalActive > 0 ? (presentIds.size / totalActive) * 100 : 0;
      return { date: weekKey.slice(5), rate: Math.round(rate), present: presentIds.size, total: totalActive };
    });
  }, [byWeekService, recentSundays, totalActive]);

  const metricPad = mob ? "10px 12px" : ts.padding.desktopCard;
  const metricMinH = mob ? 56 : th.desktopCardMin;
  const chartH = mob ? 140 : th.desktopChart;
  const mLabel = mob ? 10 : tf.desktop.label;
  const mValue = mob ? 20 : tf.desktop.value;
  const mSub = mob ? 9 : tf.desktop.sub;

  return (
    <div className={mob ? "space-y-2" : "space-y-6"}>
      <div className={mob ? "grid grid-cols-2 gap-1.5" : "grid grid-cols-2 gap-3"} style={{ gridAutoRows: "1fr" }}>
        <div
          className={mob ? "flex flex-col justify-center rounded-lg border border-gray-100 bg-white shadow-sm" : "bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col justify-center"}
          style={{ padding: metricPad, minHeight: metricMinH, borderRadius: 7 }}
        >
          <div style={{ fontSize: mLabel, color: tc.labelMuted, marginBottom: ts.gap.xxs }}>이번 주 출석</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: ts.gap.xs }}>
            <span style={{ fontSize: mValue, fontWeight: tw.extrabold, color: "var(--color-text)" }}>{thisWeekPresent}</span>
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
          style={{ padding: metricPad, minHeight: metricMinH, borderRadius: 7 }}
        >
          <div style={{ fontSize: mLabel, color: tc.labelMuted, marginBottom: ts.gap.xxs }}>이번 주 출석률</div>
          <span style={{ fontSize: mValue, fontWeight: tw.extrabold, color: "var(--color-text)" }}>{attendanceRate}%</span>
        </div>
        {embedded ? (
          <div
            className={mob ? "flex flex-col justify-center rounded-lg border border-gray-100 bg-white shadow-sm" : "bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col justify-center"}
            style={{ padding: metricPad, minHeight: metricMinH, borderRadius: 7 }}
          >
            <div style={{ fontSize: mLabel, color: tc.labelMuted, marginBottom: ts.gap.xxs }}>지난 주 출석률</div>
            <span style={{ fontSize: mValue, fontWeight: tw.extrabold, color: "var(--color-text)" }}>{prevRate}%</span>
          </div>
        ) : (
          <div
            className={mob ? "flex flex-col justify-center rounded-lg border border-gray-100 bg-white shadow-sm" : "bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col justify-center"}
            style={{ padding: metricPad, minHeight: metricMinH, borderRadius: 7 }}
          >
            <div style={{ fontSize: mLabel, color: tc.labelMuted, marginBottom: ts.gap.xxs }}>이번 달 평균 출석률</div>
            <span style={{ fontSize: mValue, fontWeight: tw.extrabold, color: "var(--color-text)" }}>{monthlyRate}%</span>
          </div>
        )}
        {embedded ? (
          <div
            className={mob ? "flex flex-col justify-center rounded-lg border border-gray-100 bg-white shadow-sm" : "bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col justify-center"}
            style={{ padding: metricPad, minHeight: metricMinH, borderRadius: 7 }}
          >
            <div style={{ fontSize: mLabel, color: tc.labelMuted, marginBottom: ts.gap.xxs }}>등록 성도 전체</div>
            <span style={{ fontSize: mValue, fontWeight: tw.extrabold, color: "var(--color-text)" }}>{totalActive}명</span>
            <div style={{ fontSize: mSub, color: tc.labelMuted, marginTop: ts.gap.xxs }}>전체 성도 합계</div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => onOpenAbsenteeList?.(consecutiveAbsent)}
            className={
              mob
                ? "flex flex-col justify-center rounded-lg border border-gray-100 bg-white text-left shadow-sm transition hover:shadow-md"
                : "bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col justify-center text-left hover:shadow-md transition"
            }
            style={{ padding: metricPad, minHeight: metricMinH, borderRadius: 7 }}
          >
            <div style={{ fontSize: mLabel, color: tc.labelMuted, marginBottom: ts.gap.xxs }}>3주 연속 결석</div>
            <span style={{ fontSize: mValue, fontWeight: tw.extrabold, color: "var(--color-text)" }}>{consecutiveAbsent.length}명</span>
            <div style={{ fontSize: mSub, color: tc.labelMuted, marginTop: ts.gap.xxs }}>클릭 시 명단</div>
          </button>
        )}
      </div>

      <div className={mob ? "grid grid-cols-1 gap-2" : "grid grid-cols-1 gap-6 lg:grid-cols-2"}>
        <div
          className={mob ? "rounded-lg border border-gray-100 bg-white p-2 shadow-sm" : "bg-white rounded-xl shadow-sm border border-gray-100 p-4"}
          style={{ maxHeight: chartH + (mob ? 56 : 80) }}
        >
          <h4 className={mob ? "mb-1.5 text-[12px] font-semibold" : "mb-4 text-sm font-semibold"} style={{ color: "var(--color-text)" }}>
            주간 출석 추이 (최근 12주)
          </h4>
          <LazyChart height={chartH}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={weeklyTrendData} margin={{ top: 5, right: 10, left: mob ? -20 : -15, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={tc.chartGrid} />
                <XAxis dataKey="week" tick={{ fontSize: mob ? 8 : tf.scale.xs }} />
                <YAxis tick={{ fontSize: mob ? 8 : tf.scale.xs }} width={mob ? 28 : undefined} />
                <Tooltip formatter={(v: any) => [`${v ?? 0}명`, ""]} />
                <Line type="monotone" dataKey="주일예배" stroke={tc.navyEmphasis} strokeWidth={2} name="주일예배" dot={{ r: mob ? 2 : 3, fill: tc.navyEmphasis }} activeDot={{ r: mob ? 4 : 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </LazyChart>
        </div>
        <div
          className={mob ? "rounded-lg border border-gray-100 bg-white p-2 shadow-sm" : "bg-white rounded-xl shadow-sm border border-gray-100 p-4"}
          style={{ maxHeight: chartH + (mob ? 56 : 80) }}
        >
          <h4 className={mob ? "mb-1.5 text-[12px] font-semibold" : "mb-4 text-sm font-semibold"} style={{ color: "var(--color-text)" }}>
            {embedded ? "부서별 평균 출석률 (올해)" : "부서별 출석률 (이번 주)"}
          </h4>
          <DashStyleDeptBarChart items={deptRates} mob={mob} height={chartH} />
        </div>
      </div>

      {!embedded && (
      <div className={mob ? "rounded-lg border border-gray-100 bg-white p-2 shadow-sm" : "bg-white rounded-xl shadow-sm border border-gray-100 p-4"}>
        <h4 className={mob ? "mb-1.5 text-[12px] font-semibold" : "mb-4 text-sm font-semibold"} style={{ color: "var(--color-text)" }}>
          월별 출석 히트맵 (최근 8주)
        </h4>
        <div style={mob ? { padding: "12px", width: "100%", boxSizing: "border-box" } : undefined}>
          <div
            className={mob ? undefined : "grid w-full grid-cols-4 place-items-center gap-2"}
            style={
              mob
                ? {
                    display: "grid",
                    gridTemplateColumns: "repeat(4, 1fr)",
                    gap: 8,
                    width: "100%",
                  }
                : undefined
            }
          >
            {heatmapData.map((row) => (
              <div
                key={row.date}
                className={mob ? "text-center font-medium text-white" : "rounded-lg px-3 py-2 text-center text-xs font-medium text-white min-w-[4rem]"}
                style={{
                  width: mob ? "100%" : undefined,
                  aspectRatio: mob ? "1" : undefined,
                  borderRadius: 7,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: mob ? 0 : undefined,
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
                {mob ? (
                  <>
                    <span style={{ fontSize: 11, fontWeight: 600, lineHeight: 1.2 }}>{row.date}</span>
                    <span style={{ fontSize: 10, lineHeight: 1.2 }}>{row.rate}%</span>
                  </>
                ) : (
                  <>
                    <span className="block leading-tight">{row.date}</span>
                    <span className="block leading-tight">{row.rate}%</span>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
      )}
    </div>
  );
}
