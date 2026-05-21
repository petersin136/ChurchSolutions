"use client";

import { useMemo, useState, useEffect } from "react";
import { tokens } from "@/styles/tokens";
import { useAppData } from "@/contexts/AppDataContext";
import type { Member } from "@/types/db";
import type { Attendance } from "@/types/db";
import { ModernSelect } from "@/components/common/ModernSelect";
import { ensureAbsenteeRecoveryCard } from "@/lib/workflow";
import { GitBranch } from "lucide-react";

export interface AbsenteeManagementProps {
  /** Supabase 미사용 시 사용할 성도 목록 */
  members?: Member[];
  /** Supabase 미사용 시 사용할 출석 목록 */
  attendanceList?: Attendance[];
  consecutiveWeeks?: number;
  onAddVisit?: (memberId: string) => void;
  /** "회복 사역흐름 시작" 버튼 핸들러 (옵션). 없으면 기본 핸들러가 카드를 자동 생성. */
  onStartRecoveryWorkflow?: (memberId: string, consecutiveWeeks: number) => void;
  toast?: (msg: string, type?: "ok" | "err" | "warn") => void;
}
const ABSENTEE_PAGE_SIZE = 10;

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
  onStartRecoveryWorkflow,
  toast,
}: AbsenteeManagementProps) {
  const mob = useIsMobile();
  const { db, rawAttendance } = useAppData();
  const [nWeeks, setNWeeks] = useState(consecutiveWeeks);
  const [currentPage, setCurrentPage] = useState(1);
  const [deptFilter, setDeptFilter] = useState("");
  const [mokjangFilter, setMokjangFilter] = useState("");

  const members = membersProp?.length ? membersProp : (db.members ?? []);

  const startRecovery = async (memberId: string, cw: number) => {
    if (onStartRecoveryWorkflow) { onStartRecoveryWorkflow(memberId, cw); return; }
    const m = members.find((x) => x.id === memberId);
    if (!m) return;
    const card = await ensureAbsenteeRecoveryCard(
      { id: m.id, name: m.name, phone: m.phone ?? null },
      cw,
    );
    if (card) toast?.(`${m.name} 회복 사역흐름이 시작되었습니다`, "ok");
    else toast?.("이미 진행 중이거나 템플릿이 없습니다", "warn");
  };
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
    () => absentees.slice((currentPage - 1) * ABSENTEE_PAGE_SIZE, currentPage * ABSENTEE_PAGE_SIZE),
    [absentees, currentPage]
  );
  const totalPages = Math.max(1, Math.ceil(absentees.length / ABSENTEE_PAGE_SIZE));

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

  return (
    <div
      className={mob ? "space-y-2" : "space-y-6"}
      style={
        mob
          ? {
              minHeight: tokens.layout.mobPastoralPanelMinHeight,
              minWidth: 0,
            }
          : undefined
      }
    >
      <div
        className={`flex flex-wrap items-center bg-white rounded-xl shadow-sm border border-gray-100 ${mob ? "p-2 gap-2" : "gap-4 p-4"}`}
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
        className={
          mob ? "mb-2 grid grid-cols-2 gap-1.5" : "mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4"
        }
      >
        {statsCards.map((card) => (
          <div
            key={card.id}
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

      <div className="flex flex-col overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
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
                          {member.photo ? (
                            <div
                              className="h-4 w-4 shrink-0 rounded-full bg-gray-200 bg-cover bg-center"
                              style={{ backgroundImage: `url(${member.photo})` }}
                            />
                          ) : (
                            <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-gray-300 text-[8px] font-semibold text-gray-600">
                              {memberSurnameInitial(member.name)}
                            </div>
                          )}
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
                          <button
                            type="button"
                            onClick={() => void startRecovery(member.id, cw)}
                            title="회복 사역흐름 시작"
                            className="h-5 shrink-0 rounded-md border border-[#1e40af] bg-white px-1.5 text-[8px] font-medium text-[#1e40af]"
                          >
                            <GitBranch size={10} />
                          </button>
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
          <>
            <div className="min-h-0 overflow-hidden">
              <table className="w-full table-fixed border-collapse text-sm">
                <colgroup>
                  <col className="w-[5%]" />
                  <col className="w-[14%]" />
                  <col className="w-[14%]" />
                  <col className="w-[14%]" />
                  <col className="w-[12%]" />
                  <col className="w-[13%]" />
                  <col className="w-[15%]" />
                  <col className="w-[13%]" />
                </colgroup>
                <thead className="border-b border-gray-200 bg-gray-50/95">
                  <tr>
                    <th className="px-2 py-3 text-center font-semibold text-[#1e40af]">번호</th>
                    <th className="px-3 py-3 text-left font-semibold text-[#1e40af]">이름</th>
                    <th className="px-3 py-3 text-left font-semibold text-[#1e40af]">부서</th>
                    <th className="px-3 py-3 text-left font-semibold text-[#1e40af]">목장</th>
                    <th className="px-3 py-3 text-center font-semibold text-[#1e40af]">연속 결석</th>
                    <th className="px-3 py-3 text-left font-semibold text-[#1e40af]">마지막 출석일</th>
                    <th className="px-3 py-3 text-left font-semibold text-[#1e40af]">연락처</th>
                    <th className="px-3 py-3 text-center font-semibold text-[#1e40af]">액션</th>
                  </tr>
                </thead>
                <tbody>
                  {absentees.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-gray-500">
                        해당 조건의 연속 결석자가 없습니다.
                      </td>
                    </tr>
                  ) : (
                    Array.from({ length: ABSENTEE_PAGE_SIZE }, (_, idx) => {
                      const row = pagedAbsentees[idx];
                      if (!row) {
                        return (
                          <tr key={`pad-${currentPage}-${idx}`} className="h-12 border-b border-gray-100">
                            <td colSpan={8} className="h-12 p-0" aria-hidden />
                          </tr>
                        );
                      }
                      const { member, consecutiveWeeks: cw, lastPresentDate } = row;
                      const num = (currentPage - 1) * ABSENTEE_PAGE_SIZE + idx + 1;
                      const mj = memberMokjangLabel(member);
                      return (
                        <tr key={member.id} className="h-12 border-b border-gray-100 hover:bg-gray-50/50">
                          <td className="px-2 py-3 text-center align-middle tabular-nums text-gray-500">{num}</td>
                          <td className="overflow-hidden px-3 py-3 align-middle font-medium">
                            <div className="flex min-w-0 items-center gap-2">
                              {member.photo ? (
                                <div
                                  className="h-7 w-7 shrink-0 rounded-full bg-gray-200 bg-cover bg-center"
                                  style={{ backgroundImage: `url(${member.photo})` }}
                                />
                              ) : (
                                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-300 text-xs font-semibold text-gray-600">
                                  {memberSurnameInitial(member.name)}
                                </div>
                              )}
                              <div className="min-w-0 truncate" title={member.name}>
                                {member.name}
                              </div>
                            </div>
                          </td>
                          <td className="overflow-hidden px-3 py-3 align-middle text-gray-600">
                            <div className="truncate" title={member.dept || undefined}>
                              {member.dept || "-"}
                            </div>
                          </td>
                          <td className="overflow-hidden px-3 py-3 align-middle text-gray-600">
                            <div className="truncate" title={mj || undefined}>
                              {mj || "-"}
                            </div>
                          </td>
                          <td className="px-3 py-3 text-center align-middle">
                            <span className="inline-flex min-w-[2.75rem] items-center justify-center rounded-md bg-red-100 px-2.5 py-1 text-sm font-semibold tabular-nums text-red-800">
                              {cw}주
                            </span>
                          </td>
                          <td className="overflow-hidden px-3 py-3 align-middle text-gray-600">
                            <div className="truncate">{lastPresentDate || "-"}</div>
                          </td>
                          <td className="overflow-hidden px-3 py-3 align-middle">
                            {member.phone ? (
                              <a href={`tel:${member.phone}`} className="text-[#1e40af] hover:underline">
                                {member.phone}
                              </a>
                            ) : (
                              "-"
                            )}
                          </td>
                          <td className="px-3 py-3 align-middle text-center">
                            <div className="inline-flex items-center justify-center gap-1.5">
                              {onAddVisit ? (
                                <button
                                  type="button"
                                  onClick={() => onAddVisit(member.id)}
                                  className="inline-flex h-6 items-center justify-center rounded-lg bg-[#1e40af] px-3 text-[11px] font-medium text-white shadow-sm hover:opacity-90"
                                >
                                  심방 등록
                                </button>
                              ) : null}
                              <button
                                type="button"
                                onClick={() => void startRecovery(member.id, cw)}
                                className="inline-flex h-6 items-center justify-center gap-1 rounded-lg border border-[#1e40af] bg-white px-2.5 text-[11px] font-medium text-[#1e40af] shadow-sm hover:bg-[#eef1fb]"
                                title="회복 사역흐름 시작"
                              >
                                <GitBranch size={12} /> 회복
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            <AttendanceListPaginationBar
              page={currentPage}
              totalPages={totalPages}
              totalItems={absentees.length}
              onPageChange={setCurrentPage}
            />
          </>
        )}
      </div>
    </div>
  );
}
