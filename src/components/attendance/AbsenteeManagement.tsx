"use client";

import { useMemo, useState, useEffect, useLayoutEffect, useRef, type CSSProperties } from "react";
import { tokens } from "@/styles/tokens";
import { useAppData } from "@/contexts/AppDataContext";
import type { Member } from "@/types/db";
import type { Attendance } from "@/types/db";
import { ModernSelect } from "@/components/common/ModernSelect";
import { MemberPhoto, MemberPhotoCircle } from "@/components/common/MemberPhoto";
import { ATT_CHECK } from "@/styles/attendanceCheckTokens";
import { MEMBER_MGMT } from "@/styles/memberManagementTokens";
import { MemberStylePagination } from "@/components/common/MemberStylePagination";

export interface AbsenteeManagementProps {
  /** Supabase 미사용 시 사용할 성도 목록 */
  members?: Member[];
  /** Supabase 미사용 시 사용할 출석 목록 */
  attendanceList?: Attendance[];
  consecutiveWeeks?: number;
  onAddVisit?: (memberId: string) => void;
  toast?: (msg: string, type?: "ok" | "err" | "warn") => void;
}
const ABSENTEE_PAGE_SIZE = 10;
const ABSENTEE_COL_TEMPLATE = "48px minmax(168px,1.3fr) minmax(110px,0.9fr) minmax(120px,0.9fr) 88px 130px 150px 72px";
const ABSENTEE_HEADERS = ["번호", "이름", "부서", "목장", "연속 결석", "마지막 출석일", "연락처", "액션"] as const;

const absenteeGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: ABSENTEE_COL_TEMPLATE,
  alignItems: "center",
  width: "100%",
  boxSizing: "border-box",
  paddingLeft: ATT_CHECK.gridPadX,
  paddingRight: ATT_CHECK.gridPadX,
};

const fmt = (n: number) => new Intl.NumberFormat("ko-KR").format(n);

function memberSurnameInitial(name: string | undefined): string {
  const s = (name ?? "").trim();
  if (!s) return "?";
  const ch = Array.from(s)[0];
  return ch ?? "?";
}

function AttendanceListPaginationBar({
  page,
  totalPages,
  totalItems,
  onPageChange,
  compact,
}: {
  page: number;
  totalPages: number;
  totalItems: number;
  onPageChange: (p: number) => void;
  compact?: boolean;
}) {
  if (totalItems === 0) return null;
  const btn =
    compact
      ? "rounded-md border border-gray-200 bg-white px-2 py-0.5 text-[10px] font-medium text-gray-700 shadow-sm disabled:cursor-not-allowed disabled:opacity-40"
      : "rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40";
  const label = compact ? "text-[10px] tabular-nums text-gray-600" : "text-sm tabular-nums text-gray-600";
  return (
    <div
      className={
        compact
          ? "flex shrink-0 items-center justify-center gap-2 border-t border-gray-100 bg-gray-50/90 px-2 py-1.5 backdrop-blur-sm"
          : "flex shrink-0 items-center justify-center gap-3 border-t border-gray-200 bg-gray-50/90 px-4 py-2.5 backdrop-blur-sm"
      }
    >
      <button type="button" className={btn} disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
        이전
      </button>
      <span className={label}>
        {page} / {totalPages}
      </span>
      <button type="button" className={btn} disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
        다음
      </button>
    </div>
  );
}

function memberMokjangLabel(m: Member): string {
  return (m.mokjang ?? m.group ?? "").trim();
}

function compareMokjangOrder(a: string, b: string): number {
  const aNum = Number((a.match(/\d+/)?.[0] ?? ""));
  const bNum = Number((b.match(/\d+/)?.[0] ?? ""));
  const aHasNum = Number.isFinite(aNum) && aNum > 0;
  const bHasNum = Number.isFinite(bNum) && bNum > 0;
  if (aHasNum && bHasNum && aNum !== bNum) return aNum - bNum;
  if (aHasNum !== bHasNum) return aHasNum ? -1 : 1;
  return a.localeCompare(b, "ko");
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
  const [currentPage, setCurrentPage] = useState(1);
  const [deptFilter, setDeptFilter] = useState("");
  const [mokjangFilter, setMokjangFilter] = useState("");
  const [pageCapacity, setPageCapacity] = useState(6);
  const PAGE_SIZE = mob ? ABSENTEE_PAGE_SIZE : pageCapacity;
  const rootRef = useRef<HTMLDivElement | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const pagerRef = useRef<HTMLDivElement | null>(null);

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
  const depts = useMemo(() => Array.from(new Set(activeMembers.map((m) => m.dept).filter(Boolean))) as string[], [activeMembers]);
  const mokjangSelectOptions = useMemo(() => {
    const set = new Set<string>();
    activeMembers.forEach((m) => {
      const v = memberMokjangLabel(m);
      if (v) set.add(v);
    });
    const hasUnassigned = activeMembers.some((m) => !memberMokjangLabel(m));
    return [
      { value: "", label: "전체" },
      ...(hasUnassigned ? [{ value: "__none__", label: "미배정" }] : []),
      ...Array.from(set).sort(compareMokjangOrder).map((name) => ({ value: name, label: name })),
    ];
  }, [activeMembers]);
  const filteredActiveMembers = useMemo(() => {
    let list = activeMembers;
    if (deptFilter) list = list.filter((m) => m.dept === deptFilter);
    if (mokjangFilter === "__none__") list = list.filter((m) => !memberMokjangLabel(m));
    else if (mokjangFilter) list = list.filter((m) => memberMokjangLabel(m) === mokjangFilter);
    return list;
  }, [activeMembers, deptFilter, mokjangFilter]);
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
    filteredActiveMembers.forEach((m) => {
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
  }, [filteredActiveMembers, byWeekService, recentSundays, nWeeks]);

  const pagedAbsentees = useMemo(
    () => absentees.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [absentees, currentPage, PAGE_SIZE]
  );
  const totalPages = Math.max(1, Math.ceil(absentees.length / PAGE_SIZE));

  const statsCards = useMemo(() => {
    const pool = filteredActiveMembers.length;
    const cnt = absentees.length;
    /** 아래 목록에 오르지 않은 분 비율(높을수록 ‘대부분 출석 기록 있음’) — 결석률처럼 읽히지 않게 */
    const stablePct = pool > 0 ? Math.round(((pool - cnt) / pool) * 100) : 0;
    const sumWeeks = absentees.reduce((s, a) => s + a.consecutiveWeeks, 0);
    const avgWeeks = cnt > 0 ? Math.round(sumWeeks / cnt) : null;
    const maxWeeks = cnt > 0 ? absentees[0]!.consecutiveWeeks : 0;
    return [
      {
        id: "pool",
        label: "이 화면 기준 인원",
        value: `${fmt(pool)}명`,
        sub: "부서·목장 필터가 적용된 활동 성도 전체",
      },
      {
        id: "stable",
        label: "예배 출석 안정도",
        value: `${stablePct}%`,
        sub: `위 인원 중, 최근 주일예배 ${nWeeks}주 연속 ‘미출석’이 아닌 분의 비율`,
      },
      {
        id: "at-risk",
        label: "심방·돌봄 대상",
        value: `${fmt(cnt)}명`,
        sub: `최근 ${nWeeks}주 주일예배에 출석·온라인 기록이 한 번도 없는 분(아래 목록과 동일)`,
      },
      {
        id: "weeks",
        label: "미출석 지속(평균)",
        value: avgWeeks != null ? `평균 ${fmt(avgWeeks)}주` : "—",
        sub:
          cnt > 0
            ? `목록 중 가장 긴 분은 ${fmt(maxWeeks)}주째 출석 기록 없음`
            : "지금 기준에 해당하는 분이 없습니다",
      },
    ];
  }, [filteredActiveMembers.length, absentees, nWeeks]);

  useEffect(() => {
    setCurrentPage(1);
  }, [nWeeks, deptFilter, mokjangFilter]);

  useEffect(() => {
    setCurrentPage((p) => Math.min(p, totalPages));
  }, [totalPages]);

  useLayoutEffect(() => {
    if (typeof window === "undefined" || mob) return;
    const compute = () => {
      const card = cardRef.current;
      if (!card) return;
      const cardTop = card.getBoundingClientRect().top;
      const pagerReserve =
        ATT_CHECK.pagerGapTop + MEMBER_MGMT.pagerRowGap + MEMBER_MGMT.pagerItemSize;
      const availFull = window.innerHeight - cardTop - 8;
      const rowsIfNoPager = Math.max(4, Math.min(40, Math.floor(availFull / ATT_CHECK.rowHeight)));
      const needPager = absentees.length > rowsIfNoPager;
      const avail = needPager ? availFull - pagerReserve : availFull;
      const rows = Math.max(4, Math.min(40, Math.floor(avail / ATT_CHECK.rowHeight)));
      if (Number.isFinite(rows) && rows > 0) setPageCapacity(rows);
    };
    compute();
    const raf = requestAnimationFrame(compute);
    window.addEventListener("resize", compute);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", compute);
    };
  }, [mob, absentees.length]);

  return (
    <div
      ref={rootRef}
      className={mob ? "space-y-2" : undefined}
      style={
        mob
          ? {
              minHeight: tokens.layout.mobPastoralPanelMinHeight,
              minWidth: 0,
            }
          : {
              display: "flex",
              flexDirection: "column",
              height: "100%",
              minHeight: 0,
              overflow: "hidden",
              fontFamily: ATT_CHECK.fontKR,
            }
      }
    >
      <div
        className={mob ? "flex flex-wrap items-center bg-white rounded-xl shadow-sm border border-gray-100 p-2 gap-2" : undefined}
        style={
          mob
            ? undefined
            : {
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                gap: 20,
                background: ATT_CHECK.cardBg,
                borderRadius: ATT_CHECK.cardRadius,
                padding: "16px 20px",
                flexShrink: 0,
                marginBottom: 16,
              }
        }
      >
        <label className={`flex shrink-0 items-center gap-1 ${mob ? "text-[10px] text-gray-600" : "gap-2 text-sm text-gray-600"}`}>
          <span className="whitespace-nowrap">연속 결석 주</span>
          <select
            value={nWeeks}
            onChange={(e) => setNWeeks(Number(e.target.value))}
            className={
              mob
                ? "h-6 min-w-[64px] rounded border border-gray-200 px-2 text-[10px]"
                : "min-w-[72px] rounded-lg border border-gray-200 py-2 pl-3 pr-9 text-sm"
            }
          >
            {[2, 3, 4, 5, 6].map((n) => (
              <option key={n} value={n}>
                {n}주
              </option>
            ))}
          </select>
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
          <span className="whitespace-nowrap">목장</span>
          <ModernSelect
            value={mokjangFilter}
            onChange={setMokjangFilter}
            options={mokjangSelectOptions}
            style={{ marginBottom: 0, minWidth: mob ? 72 : 100 }}
          />
        </label>
      </div>

      <div
        className={mob ? "mb-2 grid grid-cols-2 gap-1.5" : undefined}
        style={
          mob
            ? undefined
            : {
                display: "grid",
                gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                gap: 12,
                marginBottom: 18,
                flexShrink: 0,
              }
        }
      >
        {statsCards.map((card) => (
          <div
            key={card.id}
            className={mob ? "rounded-lg border border-gray-100 bg-white p-2" : undefined}
            style={
              mob
                ? undefined
                : {
                    background: ATT_CHECK.cardBg,
                    borderRadius: ATT_CHECK.cardRadius,
                    padding: "18px 20px 16px",
                    minHeight: 108,
                    boxSizing: "border-box",
                  }
            }
          >
            <div
              className={mob ? "text-[9px] text-gray-400" : undefined}
              style={mob ? undefined : { fontSize: 13, fontWeight: 500, color: ATT_CHECK.statsMuted, marginBottom: 8 }}
            >
              {card.label}
            </div>
            <div
              className={mob ? "text-[18px] font-extrabold text-gray-900" : undefined}
              style={
                mob
                  ? undefined
                  : {
                      fontSize: 28,
                      fontWeight: 800,
                      color: ATT_CHECK.ink,
                      letterSpacing: "-0.03em",
                      lineHeight: 1.15,
                      marginBottom: 8,
                    }
              }
            >
              {card.value}
            </div>
            <div
              className={mob ? "text-[9px] text-gray-400" : undefined}
              style={mob ? undefined : { fontSize: 12, fontWeight: 500, color: ATT_CHECK.emptyValue, lineHeight: 1.45 }}
            >
              {card.sub}
            </div>
          </div>
        ))}
      </div>

      <div
        className={mob ? "flex flex-col overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm" : undefined}
        style={
          mob
            ? undefined
            : {
                flex: 1,
                minHeight: 0,
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
              }
        }
      >
        {mob ? (
          <div className="flex flex-col overflow-hidden">
            <div className="grid grid-cols-[22px_minmax(0,1fr)_40px_44px_minmax(0,0.9fr)_52px] items-center gap-x-0 border-b border-gray-100 bg-gray-50/50 px-1.5 py-1 text-[9px] font-semibold text-[#1e40af]">
              <span className="text-center">#</span>
              <span className="min-w-0 truncate">이름</span>
              <span className="truncate text-center">부서</span>
              <span className="text-center">연속</span>
              <span className="min-w-0 truncate text-center">마지막</span>
              <span className="text-center">액션</span>
            </div>
            {absentees.length === 0 ? (
              <div className="px-2 py-8 text-center text-[11px] text-gray-500">해당 조건의 연속 결석자가 없습니다.</div>
            ) : (
              <>
                <div className="min-h-0">
                  {Array.from({ length: ABSENTEE_PAGE_SIZE }, (_, idx) => {
                    const row = pagedAbsentees[idx];
                    if (!row) {
                      return (
                        <div
                          key={`mob-pad-${currentPage}-${idx}`}
                          className="grid h-10 grid-cols-[22px_minmax(0,1fr)_40px_44px_minmax(0,0.9fr)_52px] items-center border-b border-gray-50 px-1.5 text-[10px]"
                          aria-hidden
                        />
                      );
                    }
                    const { member, consecutiveWeeks: cw, lastPresentDate } = row;
                    const num = (currentPage - 1) * ABSENTEE_PAGE_SIZE + idx + 1;
                    const shortDate = lastPresentDate ? lastPresentDate.slice(5) : "-";
                    return (
                      <div
                        key={member.id}
                        className="grid h-10 grid-cols-[22px_minmax(0,1fr)_40px_44px_minmax(0,0.9fr)_52px] items-center border-b border-gray-50 px-1.5 text-[10px]"
                      >
                        <span className="text-center tabular-nums text-gray-500">{num}</span>
                        <div className="flex min-w-0 items-center gap-1">
                          <MemberPhotoCircle
                            photo={member.photo}
                            name={member.name}
                            getInitial={memberSurnameInitial}
                            imageClassName="h-4 w-4 shrink-0 rounded-full bg-gray-200 bg-cover bg-center"
                            fallbackClassName="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-gray-300 text-[8px] font-semibold text-gray-600"
                          />
                          <span className="min-w-0 truncate font-medium text-gray-900">{member.name}</span>
                        </div>
                        <span className="truncate text-center text-gray-600">{member.dept || "·"}</span>
                        <span className="text-center text-sm font-bold tabular-nums leading-none text-red-600">{cw}주</span>
                        <span className="min-w-0 truncate text-center text-gray-500">{shortDate}</span>
                        <span className="flex shrink-0 items-center justify-center gap-0.5">
                          {onAddVisit ? (
                            <button
                              type="button"
                              onClick={() => onAddVisit(member.id)}
                              className="h-5 shrink-0 rounded-md bg-[#1e40af] px-1.5 text-[8px] font-medium text-white"
                            >
                              심방
                            </button>
                          ) : null}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <AttendanceListPaginationBar
                  compact
                  page={currentPage}
                  totalPages={totalPages}
                  totalItems={absentees.length}
                  onPageChange={setCurrentPage}
                />
              </>
            )}
          </div>
        ) : (
          <div
            style={{
              flex: 1,
              minHeight: 0,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                flexShrink: 0,
                display: "grid",
                ...absenteeGrid,
                minHeight: ATT_CHECK.headerMinHeight,
                marginBottom: ATT_CHECK.headerToCardGap,
              }}
            >
              {ABSENTEE_HEADERS.map((h) => (
                <div
                  key={h}
                  style={{
                    fontSize: ATT_CHECK.headerFontSize,
                    fontWeight: ATT_CHECK.headerFontWeight,
                    color: ATT_CHECK.headerMuted,
                    whiteSpace: "nowrap",
                    overflow: "visible",
                  }}
                >
                  {h}
                </div>
              ))}
            </div>
            <div
              ref={cardRef}
              style={{
                background: ATT_CHECK.cardBg,
                borderRadius: ATT_CHECK.cardRadius,
                flex: 1,
                minHeight: 0,
                overflow: "hidden",
              }}
            >
              {absentees.length === 0 ? (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    minHeight: PAGE_SIZE * ATT_CHECK.rowHeight,
                    color: ATT_CHECK.emptyTitle,
                    fontSize: ATT_CHECK.emptyFontSize,
                    fontWeight: 500,
                  }}
                >
                  해당 조건의 연속 결석자가 없습니다.
                </div>
              ) : (
                Array.from({ length: PAGE_SIZE }, (_, idx) => {
                  const row = pagedAbsentees[idx];
                  if (!row) {
                    return (
                      <div
                        key={`pad-${currentPage}-${idx}`}
                        style={{
                          ...absenteeGrid,
                          height: ATT_CHECK.rowHeight,
                          borderBottom: `1px solid ${ATT_CHECK.rowBorder}`,
                        }}
                        aria-hidden
                      />
                    );
                  }
                  const { member, consecutiveWeeks: cw, lastPresentDate } = row;
                  const num = (currentPage - 1) * PAGE_SIZE + idx + 1;
                  const mj = memberMokjangLabel(member);
                  const cellSub: CSSProperties = {
                    fontSize: ATT_CHECK.subFontSize,
                    fontWeight: ATT_CHECK.subFontWeight,
                    color: ATT_CHECK.subText,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  };
                  return (
                    <div
                      key={member.id}
                      style={{
                        ...absenteeGrid,
                        height: ATT_CHECK.rowHeight,
                        borderBottom: `1px solid ${ATT_CHECK.rowBorder}`,
                      }}
                    >
                      <div
                        style={{
                          fontSize: ATT_CHECK.subFontSize,
                          color: ATT_CHECK.emptyValue,
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {num}
                      </div>
                      <div style={{ overflow: "hidden" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: ATT_CHECK.avatarGap, minWidth: 0 }}>
                          <div
                            style={{
                              width: ATT_CHECK.avatarSize,
                              height: ATT_CHECK.avatarSize,
                              borderRadius: "50%",
                              background: ATT_CHECK.avatarBg,
                              color: ATT_CHECK.avatarText,
                              fontSize: ATT_CHECK.avatarFontSize,
                              fontWeight: ATT_CHECK.avatarFontWeight,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              overflow: "hidden",
                              flexShrink: 0,
                            }}
                          >
                            <MemberPhoto
                              photo={member.photo}
                              name={member.name}
                              className="h-full w-full object-cover"
                              fallback={memberSurnameInitial(member.name)}
                            />
                          </div>
                          <span
                            style={{
                              fontSize: ATT_CHECK.nameFontSize,
                              fontWeight: ATT_CHECK.nameFontWeight,
                              color: ATT_CHECK.nameText,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                            title={member.name}
                          >
                            {member.name}
                          </span>
                        </div>
                      </div>
                      <div style={cellSub} title={member.dept || undefined}>
                        {member.dept || "-"}
                      </div>
                      <div style={cellSub} title={mj || undefined}>
                        {mj || "-"}
                      </div>
                      <div
                        style={{
                          fontSize: ATT_CHECK.subFontSize,
                          fontWeight: 600,
                          color: ATT_CHECK.ink,
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {cw}주
                      </div>
                      <div style={cellSub}>{lastPresentDate || "-"}</div>
                      <div style={{ overflow: "hidden" }}>
                        {member.phone ? (
                          <a
                            href={`tel:${member.phone}`}
                            style={{
                              color: ATT_CHECK.present,
                              fontSize: ATT_CHECK.subFontSize,
                              fontWeight: 600,
                              textDecoration: "none",
                              fontVariantNumeric: "tabular-nums",
                            }}
                          >
                            {member.phone}
                          </a>
                        ) : (
                          <span style={cellSub}>-</span>
                        )}
                      </div>
                      <div>
                        {onAddVisit ? (
                          <button
                            type="button"
                            onClick={() => onAddVisit(member.id)}
                            style={{
                              border: "none",
                              background: "transparent",
                              color: ATT_CHECK.present,
                              fontSize: 13,
                              fontWeight: 600,
                              cursor: "pointer",
                              padding: 0,
                              fontFamily: ATT_CHECK.fontKR,
                            }}
                          >
                            심방
                          </button>
                        ) : null}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
      {!mob && (
        <div
          ref={pagerRef}
          style={{
            display: absentees.length > PAGE_SIZE ? "flex" : "none",
            flexShrink: 0,
            alignItems: "center",
            justifyContent: "center",
            padding: `${ATT_CHECK.pagerGapTop}px 4px 0`,
            background: ATT_CHECK.pageBg,
          }}
        >
          <MemberStylePagination
            totalItems={absentees.length}
            itemsPerPage={PAGE_SIZE}
            currentPage={currentPage}
            onPageChange={setCurrentPage}
          />
        </div>
      )}
    </div>
  );
}
