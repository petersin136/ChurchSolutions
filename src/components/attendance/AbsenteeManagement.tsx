"use client";

import { useMemo, useState, useEffect, useLayoutEffect, useRef, useCallback, type CSSProperties } from "react";
import { ChevronDown } from "lucide-react";
import { tokens } from "@/styles/tokens";
import { useAppData, type RawAttendanceRow } from "@/contexts/AppDataContext";
import type { Member } from "@/types/db";
import type { Attendance } from "@/types/db";
import { ModernSelect } from "@/components/common/ModernSelect";
import { MemberPhoto, MemberPhotoCircle } from "@/components/common/MemberPhoto";
import { ATT_CHECK } from "@/styles/attendanceCheckTokens";
import { MEMBER_MGMT } from "@/styles/memberManagementTokens";
import { MemberStylePagination } from "@/components/common/MemberStylePagination";
import { MemberSearchCombo } from "@/components/pastoral/MemberSearchCombo";
import { CommentDotsIcon } from "@/components/icons/CommentDotsIcon";
import { formatMemberRoleDisplay } from "@/lib/member-role-display";
import { isChurchActiveMember } from "@/lib/attendance-utils";
import { getChurchId } from "@/lib/tenant";
import { supabase } from "@/lib/supabase";

export interface AbsenteeManagementProps {
  /** 출석 체크와 동일 성도 배열·동일 id */
  members?: Member[];
  /** Supabase 미사용 시 사용할 출석 목록 */
  attendanceList?: Attendance[];
  /** 출석 체크에서 고른 주일 (YYYY-MM-DD) — 메모 날짜. 기기 오늘 날짜 쓰지 않음 */
  weekSunday?: string;
  /** 출석 체크 화면에 적힌 결석 사유 (memberId → 사유). 최우선 표시 */
  weekNotesByMember?: Record<string, string>;
  consecutiveWeeks?: number;
  onAddVisit?: (memberId: string) => void;
  toast?: (msg: string, type?: "ok" | "err" | "warn") => void;
}
const ABSENTEE_PAGE_SIZE = 10;
/**
 * 이름·구분·부서/목장 = ATT_CHECK.sharedLeftCols (출석 체크와 동일).
 * 나머지 4열은 06·07 PNG 비율로 남은 폭을 나눈다.
 */
const ABSENTEE_COL_TEMPLATE = `${ATT_CHECK.sharedLeftCols} minmax(0, 132fr) minmax(0, 156fr) minmax(0, 134fr) minmax(0, 297fr)`;
const ABSENTEE_HEADERS = ["이름", "구분", "부서/목장", "연속 결석", "연락처", "연락", "심방"] as const;
const ABSENTEE_STATUS_WIDTH = 333;
const CARE_MIN_WEEKS = 1;

type CareBucket = "risk" | "dormant" | "inactive";
type CareFilter = "all" | CareBucket;
type ContactState = "done" | "missed" | "need";

const CARE_TEXT: Record<CareBucket, { label: string; color: string; dot: string }> = {
  risk: { label: "위험", color: "#e0743c", dot: "#e0743c" },
  dormant: { label: "휴면", color: "#6a5641", dot: "#a08566" },
  inactive: { label: "비활동", color: "#93969f", dot: "#93969f" },
};

const CONTACT_META: Record<ContactState, { label: string; color: string }> = {
  done: { label: "연락 완료", color: "#23663d" },
  missed: { label: "부재중", color: "#e0743c" },
  need: { label: "연락 필요", color: "#9479e8" },
};

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
  return members.filter(isChurchActiveMember);
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

function isInactiveMember(m: Member): boolean {
  const official = (m.member_status || "").trim();
  const pastoral = (m.status || "").trim();
  return (official !== "" && official !== "활동") || pastoral === "비활동" || pastoral === "졸업/전출";
}

/** 출석 체크에서 결석으로 저장한 주만 결석으로 센다. 기록 없는 주는 세지 않는다. */
function bucketFromAbsence(m: Member, weeks: number): CareBucket {
  if (isInactiveMember(m)) return "inactive";
  if (weeks >= 3) return "dormant";
  return "risk";
}

function isPresentAttendance(status: string | undefined): boolean {
  return status === "p" || status === "o" || status === "출석" || status === "온라인";
}

function isAbsentAttendance(status: string | undefined): boolean {
  return status === "a" || status === "l" || status === "결석";
}

function isSundayWorship(serviceType: string | undefined): boolean {
  const st = serviceType || "주일예배";
  return st === "주일예배" || st === "주일1부예배";
}

/**
 * 연속 결석 주 수.
 * anchorSunday가 있으면(=출석 체크에서 고른 주일) 그 주가 결석일 때만 센다.
 * 없으면 전체 기록 중 가장 최근 p/a 주부터 센다.
 * (과거: 항상 “최신 기록” 기준이라, 11.15 결석자도 이후 출석이 있으면 목록에서 빠졌음)
 */
function consecutiveAbsentWeeks(
  marks: Map<string, "p" | "a"> | undefined,
  anchorSunday?: string,
): number {
  if (!marks || marks.size === 0) return 0;
  let end = "";
  const anchor = (anchorSunday || "").slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(anchor)) {
    end = anchor;
    if (marks.get(end) !== "a") return 0;
  } else {
    marks.forEach((_mark, week) => {
      if (week > end) end = week;
    });
    if (!end || marks.get(end) !== "a") return 0;
  }
  let count = 0;
  const endDate = new Date(end + "T12:00:00");
  for (let i = 0; i < 60; i++) {
    const d = new Date(endDate);
    d.setDate(endDate.getDate() - i * 7);
    const key = fmtLocalDate(d);
    if (marks.get(key) !== "a") break;
    count++;
  }
  return count;
}

function formatVisitDay(dateStr: string): string {
  const raw = String(dateStr ?? "").trim().slice(0, 10);
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return raw;
  return `${m[2]}. ${m[3]}`;
}

function normalizeMemberId(id: string | number | undefined | null): string {
  return String(id ?? "").trim();
}

/** 플레이스홀더·빈 문구는 메모로 취급하지 않음 */
function isRealMemoContent(text: string | undefined | null): boolean {
  const t = String(text ?? "").trim();
  if (!t) return false;
  if (t === "메모 입력") return false;
  if (/^\d{1,2}\.\s*\d{1,2}\s*메모 입력$/.test(t)) return false;
  return true;
}

function attendanceNoteText(row: { note?: string; reason?: string }): string {
  return String(row.note ?? row.reason ?? "").trim();
}

function weekNumForDate(dateStr: string): number {
  const d = new Date(dateStr + "T12:00:00");
  const s = new Date(d.getFullYear(), 0, 1);
  return Math.ceil(((d.getTime() - s.getTime()) / 864e5 + s.getDay() + 1) / 7);
}

type CareMemo = {
  date: string;
  content: string;
  source: "visit" | "attendance" | "note";
  serviceType?: string;
};

function deptMokjangText(m: Member): string {
  const dept = (m.dept || "").trim();
  const mokjang = memberMokjangLabel(m);
  if (dept && mokjang) return `${dept}/${mokjang}`;
  return dept || mokjang || "-";
}

export function AbsenteeManagement({
  members: membersProp,
  attendanceList: attendanceListProp,
  weekSunday,
  weekNotesByMember,
  consecutiveWeeks = 3,
  onAddVisit,
  toast,
}: AbsenteeManagementProps) {
  const mob = useIsMobile();
  const { db, rawAttendance, refreshAttendance } = useAppData();
  const [nWeeks, setNWeeks] = useState(consecutiveWeeks);
  const [currentPage, setCurrentPage] = useState(1);
  const [deptFilter, setDeptFilter] = useState("");
  const [mokjangFilter, setMokjangFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [searchName, setSearchName] = useState("");
  const [careFilter, setCareFilter] = useState<CareFilter>("all");
  const [contactState, setContactState] = useState<Record<string, ContactState>>({});
  const [statusOpen, setStatusOpen] = useState(false);
  const [openContactId, setOpenContactId] = useState<string | null>(null);
  const [editingMemoId, setEditingMemoId] = useState<string | null>(null);
  const [memoDraft, setMemoDraft] = useState("");
  /** 심방 칸 호버 시 과거 메모 드롭다운 (fixed — 상위 overflow에 안 잘리게) */
  const [memoHover, setMemoHover] = useState<{
    id: string;
    top: number;
    left: number;
    width: number;
  } | null>(null);
  const memoHoverCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const statusRef = useRef<HTMLDivElement>(null);
  const [pageCapacity, setPageCapacity] = useState(6);
  const PAGE_SIZE = mob ? ABSENTEE_PAGE_SIZE : pageCapacity;
  const rootRef = useRef<HTMLDivElement | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const pagerRef = useRef<HTMLDivElement | null>(null);

  const openMemoHover = useCallback((next: { id: string; top: number; left: number; width: number }) => {
    if (memoHoverCloseTimer.current) {
      clearTimeout(memoHoverCloseTimer.current);
      memoHoverCloseTimer.current = null;
    }
    setMemoHover(next);
  }, []);

  const scheduleCloseMemoHover = useCallback(() => {
    if (memoHoverCloseTimer.current) clearTimeout(memoHoverCloseTimer.current);
    memoHoverCloseTimer.current = setTimeout(() => {
      setMemoHover(null);
      memoHoverCloseTimer.current = null;
    }, 140);
  }, []);

  useEffect(() => {
    return () => {
      if (memoHoverCloseTimer.current) clearTimeout(memoHoverCloseTimer.current);
    };
  }, []);

  /** 출석 체크와 동일 성도 목록·동일 id. prop이 있으면 db.members로 바꾸지 않는다. */
  const members = membersProp ?? db.members ?? [];
  const membersById = useMemo(() => {
    const map = new Map<string, Member>();
    members.forEach((m) => {
      const id = normalizeMemberId(m.id);
      if (id) map.set(id, m);
    });
    return map;
  }, [members]);
  const referenceSunday = (weekSunday && String(weekSunday).slice(0, 10)) || "";
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

  const absenceMarksByMember = useMemo(() => {
    const map = new Map<string, Map<string, "p" | "a">>();
    rawAttendance.forEach((row: RawAttendanceRow) => {
      const id = normalizeMemberId(row.member_id);
      const date = String(row.date ?? "").trim().slice(0, 10);
      if (!id || !date || !isSundayWorship(row.service_type)) return;
      const present = isPresentAttendance(row.status);
      const absent = isAbsentAttendance(row.status);
      if (!present && !absent) return;
      const week = getSundayOfWeek(date);
      let marks = map.get(id);
      if (!marks) {
        marks = new Map();
        map.set(id, marks);
      }
      if (present) marks.set(week, "p");
      else if (marks.get(week) !== "p") marks.set(week, "a");
    });
    return map;
  }, [rawAttendance]);

  const careRows = useMemo(() => {
    const rows: { member: Member; consecutiveWeeks: number; bucket: CareBucket }[] = [];
    // 출석 체크와 동일: 활동 성도만. 선택 주일(referenceSunday) 결석 기준으로 센다.
    activeMembers.forEach((m) => {
      const id = normalizeMemberId(m.id);
      if (!id) return;
      const weeks = consecutiveAbsentWeeks(
        absenceMarksByMember.get(id),
        referenceSunday || undefined,
      );
      if (weeks < CARE_MIN_WEEKS) return;
      rows.push({ member: m, consecutiveWeeks: weeks, bucket: bucketFromAbsence(m, weeks) });
    });
    return rows.sort((a, b) => b.consecutiveWeeks - a.consecutiveWeeks || a.member.name.localeCompare(b.member.name, "ko"));
  }, [activeMembers, absenceMarksByMember, referenceSunday]);

  const careCounts = useMemo(() => {
    let risk = 0;
    let dormant = 0;
    let inactive = 0;
    careRows.forEach((row) => {
      if (row.bucket === "risk") risk += 1;
      else if (row.bucket === "dormant") dormant += 1;
      else inactive += 1;
    });
    return { risk, dormant, inactive };
  }, [careRows]);

  const shownCareRows = useMemo(() => {
    const q = searchName.trim().toLowerCase();
    return careRows.filter((row) => {
      if (careFilter === "all") {
        if (row.bucket === "inactive") return false;
      } else if (row.bucket !== careFilter) return false;
      const m = row.member;
      if (deptFilter && m.dept !== deptFilter) return false;
      if (mokjangFilter === "__none__" && memberMokjangLabel(m)) return false;
      if (mokjangFilter && mokjangFilter !== "__none__" && memberMokjangLabel(m) !== mokjangFilter) return false;
      if (roleFilter && (m.role || "") !== roleFilter) return false;
      if (!q) return true;
      const hay = [m.name, m.dept, m.role, memberMokjangLabel(m), m.phone].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [careRows, careFilter, deptFilter, mokjangFilter, roleFilter, searchName]);

  /** 멤버별 최신 결석 주일 (출석 체크에서 결석 저장한 날) */
  const latestAbsentDateByMember = useMemo(() => {
    const map = new Map<string, { date: string; serviceType: string; status: string }>();
    rawAttendance.forEach((row) => {
      if (!isSundayWorship(row.service_type)) return;
      if (!isAbsentAttendance(row.status)) return;
      const id = normalizeMemberId(row.member_id);
      const date = String(row.date ?? "").trim().slice(0, 10);
      if (!id || !date) return;
      const prev = map.get(id);
      if (!prev || date > prev.date) {
        map.set(id, {
          date,
          serviceType: row.service_type || "주일예배",
          status: row.status,
        });
      }
    });
    return map;
  }, [rawAttendance]);

  /**
   * 심방 칸 메모 — 결석자 관리 화면이므로 출석 결석 사유를 최우선.
   * 날짜는 new Date()가 아니라 그 성도의 결석 주일 / 출석 체크에서 고른 주일만 쓴다.
   */
  const latestMemoByMember = useMemo(() => {
    const map = new Map<string, CareMemo>();

    rawAttendance.forEach((row) => {
      if (!isSundayWorship(row.service_type)) return;
      const note = attendanceNoteText(row);
      if (!isRealMemoContent(note)) return;
      const id = normalizeMemberId(row.member_id);
      const date = String(row.date ?? "").trim().slice(0, 10);
      if (!id || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
      const prev = map.get(id);
      const rowAbsent = isAbsentAttendance(row.status);
      const prevAbsent = prev?.source === "attendance";
      const next: CareMemo = {
        date,
        content: note,
        source: "attendance",
        serviceType: row.service_type || "주일예배",
      };
      if (!prev) {
        map.set(id, next);
        return;
      }
      if (rowAbsent && !prevAbsent) {
        map.set(id, next);
        return;
      }
      if (rowAbsent === prevAbsent && date >= prev.date) {
        map.set(id, next);
      }
    });

    const considerSecondary = (
      memberId: string,
      dateRaw: string,
      content: string,
      source: "visit" | "note",
    ) => {
      const id = normalizeMemberId(memberId);
      const date = String(dateRaw ?? "").trim().slice(0, 10);
      if (!id || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
      if (!isRealMemoContent(content)) return;
      const text = String(content).trim();
      const prev = map.get(id);
      if (prev?.source === "attendance") return;
      if (!prev || date > prev.date) {
        map.set(id, { date, content: text, source });
      }
    };

    (db.visits ?? []).forEach((v) => considerSecondary(v.memberId, v.date, v.content, "visit"));
    Object.entries(db.notes ?? {}).forEach(([memberId, list]) => {
      list.forEach((note) => {
        if (note.type === "visit" || note.type === "memo") {
          considerSecondary(memberId, note.date, note.content, note.type === "visit" ? "visit" : "note");
        }
      });
    });

    return map;
  }, [db.visits, db.notes, rawAttendance]);

  /**
   * 멤버별 결석 사유/메모 이력 (최신순).
   * 출석 체크에서 고른 주일이 있으면 그 주일 이하만 — 연속 결석 구간의 이전 주 메모를 호버로 본다.
   */
  const memoHistoryByMember = useMemo(() => {
    const map = new Map<string, CareMemo[]>();
    const upsert = (id: string, item: CareMemo) => {
      const list = map.get(id) ?? [];
      const idx = list.findIndex((x) => x.date === item.date && x.source === item.source);
      if (idx >= 0) list[idx] = item;
      else list.push(item);
      map.set(id, list);
    };

    rawAttendance.forEach((row) => {
      if (!isSundayWorship(row.service_type)) return;
      const note = attendanceNoteText(row);
      if (!isRealMemoContent(note)) return;
      const id = normalizeMemberId(row.member_id);
      const date = String(row.date ?? "").trim().slice(0, 10);
      if (!id || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
      if (referenceSunday && date > referenceSunday) return;
      upsert(id, {
        date,
        content: note,
        source: "attendance",
        serviceType: row.service_type || "주일예배",
      });
    });

    if (weekNotesByMember && referenceSunday) {
      Object.entries(weekNotesByMember).forEach(([rawId, text]) => {
        const id = normalizeMemberId(rawId);
        if (!id || !isRealMemoContent(text)) return;
        upsert(id, {
          date: referenceSunday,
          content: String(text).trim(),
          source: "attendance",
          serviceType: "주일예배",
        });
      });
    }

    map.forEach((list, id) => {
      list.sort((a, b) => b.date.localeCompare(a.date));
      map.set(id, list);
    });
    return map;
  }, [rawAttendance, referenceSunday, weekNotesByMember]);

  const saveCareMemo = useCallback(
    async (memberId: string, content: string) => {
      if (!supabase) {
        toast?.("저장할 수 없습니다", "err");
        return;
      }
      const absent = latestAbsentDateByMember.get(memberId);
      const existing = latestMemoByMember.get(memberId);
      const date =
        (existing?.source === "attendance" ? existing.date : null) ||
        absent?.date ||
        referenceSunday ||
        "";
      if (!date) {
        toast?.("결석 기록이 있는 주일 기준으로만 메모를 남길 수 있습니다", "warn");
        return;
      }
      const serviceType =
        (existing?.source === "attendance" ? existing.serviceType : null) ||
        absent?.serviceType ||
        "주일예배";
      const status = absent?.status || "a";
      const churchId = getChurchId();
      const year = Number(date.slice(0, 4));
      const { error } = await supabase.from("attendance").upsert(
        {
          church_id: churchId,
          member_id: normalizeMemberId(memberId),
          date,
          service_type: serviceType,
          status,
          note: content.trim() || null,
          week_num: weekNumForDate(date),
          year,
        },
        { onConflict: "member_id,date,service_type" },
      );
      if (error) {
        toast?.("메모 저장 실패: " + error.message, "err");
        return;
      }
      await refreshAttendance();
    },
    [latestAbsentDateByMember, latestMemoByMember, referenceSunday, refreshAttendance, toast],
  );

  const comboDeptOptions = useMemo(() => {
    const set = new Set<string>();
    members.forEach((m) => {
      if (m.dept) set.add(m.dept);
    });
    return [{ value: "all", label: "전체" }, ...Array.from(set).sort((a, b) => a.localeCompare(b, "ko")).map((d) => ({ value: d, label: d }))];
  }, [members]);
  const comboMokjangOptions = useMemo(() => {
    const set = new Set<string>();
    members.forEach((m) => {
      const v = memberMokjangLabel(m);
      if (v) set.add(v);
    });
    return [
      { value: "all", label: "전체" },
      ...Array.from(set).sort(compareMokjangOrder).map((name) => ({ value: name, label: name })),
    ];
  }, [members]);
  const comboRoleOptions = useMemo(() => {
    const set = new Set<string>();
    members.forEach((m) => {
      if (m.role) set.add(m.role);
    });
    return [{ value: "all", label: "전체" }, ...Array.from(set).sort((a, b) => a.localeCompare(b, "ko")).map((r) => ({ value: r, label: r }))];
  }, [members]);

  const pagedAbsentees = useMemo(
    () => absentees.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [absentees, currentPage, PAGE_SIZE]
  );
  const pagedCareRows = useMemo(
    () => shownCareRows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [shownCareRows, currentPage, PAGE_SIZE]
  );
  const listCount = mob ? absentees.length : shownCareRows.length;
  const totalPages = Math.max(1, Math.ceil(listCount / PAGE_SIZE));

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
  }, [nWeeks, deptFilter, mokjangFilter, roleFilter, searchName, careFilter]);

  useEffect(() => {
    if (!statusOpen && !openContactId) return;
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node;
      if (statusRef.current?.contains(target)) return;
      if (target instanceof Element && target.closest("[data-contact-menu]")) return;
      setStatusOpen(false);
      setOpenContactId(null);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [statusOpen, openContactId]);

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
        ATT_CHECK.pagerGapTop +
        ATT_CHECK.pagerPadBottom +
        MEMBER_MGMT.pagerRowGap +
        MEMBER_MGMT.pagerItemSize;
      const rootBottom = rootRef.current?.getBoundingClientRect().bottom ?? window.innerHeight;
      const availByRoot = rootBottom - cardTop - pagerReserve;
      const availByCard = card.clientHeight > ATT_CHECK.rowHeight ? card.clientHeight : availByRoot;
      const avail = Math.max(availByRoot, availByCard);
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
  }, [mob]);

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
              flex: 1,
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
                flexWrap: "nowrap",
                alignItems: "center",
                gap: ATT_CHECK.toolbarGap,
                flexShrink: 0,
                height: ATT_CHECK.searchHeight,
                minHeight: ATT_CHECK.searchHeight,
                maxHeight: ATT_CHECK.searchHeight,
                boxSizing: "border-box",
                marginBottom: 0,
                overflow: "hidden",
              }
        }
      >
        {mob ? (
          <>
        <label className="flex shrink-0 items-center gap-1 text-[10px] text-gray-600">
          <span className="whitespace-nowrap">연속 결석 주</span>
          <select
            value={nWeeks}
            onChange={(e) => setNWeeks(Number(e.target.value))}
            className="h-6 min-w-[64px] rounded border border-gray-200 px-2 text-[10px]"
          >
            {[2, 3, 4, 5, 6].map((n) => (
              <option key={n} value={n}>
                {n}주
              </option>
            ))}
          </select>
        </label>
        <label className="flex shrink-0 items-center gap-1 text-[10px] text-gray-600">
          <span className="whitespace-nowrap">부서</span>
          <ModernSelect
            value={deptFilter}
            onChange={setDeptFilter}
            options={[{ value: "", label: "전체" }, ...depts.map((d) => ({ value: d, label: d }))]}
            style={{ marginBottom: 0, minWidth: 72 }}
          />
        </label>
        <label className="flex shrink-0 items-center gap-1 text-[10px] text-gray-600">
          <span className="whitespace-nowrap">목장</span>
          <ModernSelect
            value={mokjangFilter}
            onChange={setMokjangFilter}
            options={mokjangSelectOptions}
            style={{ marginBottom: 0, minWidth: 72 }}
          />
        </label>
          </>
        ) : (
          <>
            <div style={{ flex: 1, minWidth: 0 }}>
              <MemberSearchCombo
                value={searchName}
                onChange={setSearchName}
                height={ATT_CHECK.searchHeight}
                placeholder="이름, 부서, 목장, 구분 검색 또는 선택"
                deptOptions={comboDeptOptions}
                mokjangOptions={comboMokjangOptions}
                roleOptions={comboRoleOptions}
                onSelectDept={(v) => setDeptFilter(v === "all" ? "" : v)}
                onSelectMokjang={(v) => setMokjangFilter(v === "all" ? "" : v)}
                onSelectRole={(v) => setRoleFilter(v === "all" ? "" : v)}
              />
            </div>
            <div ref={statusRef} style={{ position: "relative", flexShrink: 0, width: ABSENTEE_STATUS_WIDTH }}>
              <button
                type="button"
                aria-haspopup="listbox"
                aria-expanded={statusOpen}
                onClick={() => setStatusOpen((v) => !v)}
                style={{
                  width: "100%",
                  height: ATT_CHECK.searchHeight,
                  boxSizing: "border-box",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                  padding: "0 14px",
                  borderRadius: MEMBER_MGMT.radius,
                  background: MEMBER_MGMT.searchBg,
                  border: `1px solid ${MEMBER_MGMT.searchBorder}`,
                  cursor: "pointer",
                  fontFamily: ATT_CHECK.fontKR,
                  fontSize: 14,
                  fontWeight: 500,
                  color: ATT_CHECK.ink,
                }}
              >
                <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", lineHeight: "20px" }}>
                  {careFilter === "risk"
                    ? `상태 위험 ${careCounts.risk}`
                    : careFilter === "dormant"
                      ? `상태 휴면 ${careCounts.dormant}`
                      : careFilter === "inactive"
                        ? `상태 비활동 ${careCounts.inactive}`
                        : `상태 위험 ${careCounts.risk} · 휴면 ${careCounts.dormant} / 전체 ${careCounts.risk + careCounts.dormant}명`}
                </span>
                <ChevronDown size={16} color={ATT_CHECK.muted} style={{ flexShrink: 0, transform: statusOpen ? "rotate(180deg)" : undefined }} />
              </button>
              {statusOpen && (
                <div
                  role="listbox"
                  style={{
                    position: "absolute",
                    top: "calc(100% + 6px)",
                    right: 0,
                    width: "100%",
                    zIndex: 50,
                    background: "#ffffff",
                    border: `1px solid ${MEMBER_MGMT.searchBorder}`,
                    borderRadius: MEMBER_MGMT.radius,
                    padding: "6px 0",
                    boxShadow: "0 8px 24px rgba(11,12,14,0.08)",
                  }}
                >
                  {(
                    [
                      ["all", `전체 · 위험 ${careCounts.risk} · 휴면 ${careCounts.dormant}`],
                      ["risk", `위험 ${careCounts.risk}`],
                      ["dormant", `휴면 ${careCounts.dormant}`],
                      ["inactive", `비활동 ${careCounts.inactive}`],
                    ] as const
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      role="option"
                      aria-selected={careFilter === id}
                      onClick={() => {
                        setCareFilter(id);
                        setStatusOpen(false);
                      }}
                      style={{
                        display: "block",
                        width: "100%",
                        textAlign: "left",
                        border: "none",
                        background: careFilter === id ? "#f4f4f6" : "transparent",
                        padding: "8px 14px",
                        fontFamily: ATT_CHECK.fontKR,
                        fontSize: 14,
                        fontWeight: careFilter === id ? 600 : 500,
                        color: ATT_CHECK.ink,
                        cursor: "pointer",
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {mob && (
      <div className="mb-2 grid grid-cols-2 gap-1.5">
        {statsCards.map((card) => (
          <div key={card.id} className="rounded-lg border border-gray-100 bg-white p-2">
            <div className="text-[9px] text-gray-400">{card.label}</div>
            <div className="text-[18px] font-extrabold text-gray-900">{card.value}</div>
            <div className="text-[9px] text-gray-400">{card.sub}</div>
          </div>
        ))}
      </div>
      )}

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
              overflow: "visible",
            }}
          >
            <div
              style={{
                flexShrink: 0,
                display: "grid",
                ...absenteeGrid,
                minHeight: ATT_CHECK.headerMinHeight,
                marginTop: ATT_CHECK.headerRowGap,
                marginBottom: ATT_CHECK.headerToCardGap,
              }}
            >
              {ABSENTEE_HEADERS.map((h, i) => (
                <div
                  key={h}
                  style={{
                    fontSize: ATT_CHECK.headerFontSize,
                    fontWeight: ATT_CHECK.headerFontWeight,
                    color: ATT_CHECK.headerMuted,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    minWidth: 0,
                    lineHeight: "20px",
                    textAlign: i === ABSENTEE_HEADERS.length - 1 ? "right" : "left",
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
                // 심방 메모 호버 드롭다운이 잘리지 않도록 visible
                overflow: "visible",
              }}
            >
              {shownCareRows.length === 0 ? (
                <div
                  style={{
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    minHeight: PAGE_SIZE * ATT_CHECK.rowHeight,
                    color: ATT_CHECK.emptyTitle,
                    fontSize: ATT_CHECK.emptyFontSize,
                    fontWeight: 500,
                    textAlign: "center",
                    gap: ATT_CHECK.emptyLineGap,
                    fontFamily: ATT_CHECK.fontKR,
                  }}
                >
                  {members.length === 0 ? (
                    <>
                      <span>아직 등록된 성도가 없습니다.</span>
                      <span>성도관리에서 성도를 등록해 주세요.</span>
                    </>
                  ) : searchName.trim() || deptFilter || mokjangFilter || roleFilter ? (
                    "검색 결과가 없습니다"
                  ) : careFilter === "risk" ? (
                    "위험 상태의 성도가 없습니다."
                  ) : careFilter === "dormant" ? (
                    "휴면 상태의 성도가 없습니다."
                  ) : careFilter === "inactive" ? (
                    "비활동 상태의 성도가 없습니다."
                  ) : (
                    "연속으로 결석한 성도가 없습니다."
                  )}
                </div>
              ) : (
                Array.from({ length: PAGE_SIZE }, (_, idx) => {
                  const row = pagedCareRows[idx];
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
                  const { member, consecutiveWeeks: cw, bucket } = row;
                  const care = CARE_TEXT[bucket];
                  const memberId = normalizeMemberId(member.id);
                  const contact = contactState[memberId] ?? "need";
                  const contactMeta = CONTACT_META[contact];
                  const absentMeta = latestAbsentDateByMember.get(memberId);
                  const weekNote = String(
                    weekNotesByMember?.[memberId] ?? weekNotesByMember?.[member.id] ?? "",
                  ).trim();
                  const fromWeek: CareMemo | undefined = isRealMemoContent(weekNote) && referenceSunday
                    ? {
                        date: referenceSunday,
                        content: weekNote,
                        source: "attendance",
                        serviceType: "주일예배",
                      }
                    : undefined;
                  const memo = fromWeek ?? latestMemoByMember.get(memberId);
                  /** 날짜: 실제 메모 날짜 → 출석 체크에서 고른 주일 → 결석 기록일. 기기 오늘/미래 이상값은 쓰지 않음 */
                  const memoDate =
                    (memo?.date && /^\d{4}-\d{2}-\d{2}$/.test(memo.date) ? memo.date : "") ||
                    referenceSunday ||
                    (absentMeta?.date && /^\d{4}-\d{2}-\d{2}$/.test(absentMeta.date) ? absentMeta.date : "") ||
                    "";
                  const memoHistory = memoHistoryByMember.get(memberId) ?? [];
                  const isVisitDone = memo?.source === "visit" && isRealMemoContent(memo.content);
                  const isEditingMemo = editingMemoId === memberId;
                  const roleText = formatMemberRoleDisplay(member.role, member.dept);
                  const cellSub: CSSProperties = {
                    fontSize: ATT_CHECK.subFontSize,
                    fontWeight: ATT_CHECK.subFontWeight,
                    color: ATT_CHECK.subText,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    minWidth: 0,
                  };
                  return (
                    <div
                      key={memberId}
                      style={{
                        ...absenteeGrid,
                        height: ATT_CHECK.rowHeight,
                        borderBottom: `1px solid ${ATT_CHECK.rowBorder}`,
                      }}
                    >
                      <div style={{ overflow: "hidden", minWidth: 0 }}>
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
                      <div style={cellSub} title={roleText}>
                        {roleText}
                      </div>
                      <div style={cellSub} title={deptMokjangText(member)}>
                        {deptMokjangText(member)}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, overflow: "hidden" }}>
                        <span
                          style={{
                            width: ATT_CHECK.statsDot,
                            height: ATT_CHECK.statsDot,
                            borderRadius: "50%",
                            background: care.dot,
                            flexShrink: 0,
                          }}
                        />
                        <span
                          style={{
                            fontSize: ATT_CHECK.subFontSize,
                            fontWeight: 600,
                            color: care.color,
                            whiteSpace: "nowrap",
                            lineHeight: "20px",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            minWidth: 0,
                          }}
                        >
                          {cw}주 {care.label}
                        </span>
                      </div>
                      <div style={{ overflow: "hidden", minWidth: 0 }}>
                        {member.phone ? (
                          <a
                            href={`tel:${member.phone}`}
                            style={{
                              display: "block",
                              color: ATT_CHECK.headerMuted,
                              fontSize: ATT_CHECK.subFontSize,
                              fontWeight: 500,
                              textDecoration: "none",
                              fontVariantNumeric: "tabular-nums",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {member.phone}
                          </a>
                        ) : (
                          <span style={cellSub}>-</span>
                        )}
                      </div>
                      <div data-contact-menu="" style={{ position: "relative", minWidth: 0 }}>
                        <button
                          type="button"
                          onClick={() => setOpenContactId((id) => (id === memberId ? null : memberId))}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            border: "none",
                            background: "transparent",
                            padding: 0,
                            cursor: "pointer",
                            color: contactMeta.color,
                            fontFamily: ATT_CHECK.fontKR,
                            fontSize: ATT_CHECK.subFontSize,
                            fontWeight: 600,
                            maxWidth: "100%",
                            minWidth: 0,
                            overflow: "hidden",
                          }}
                        >
                          <CommentDotsIcon size={16} color={contactMeta.color} style={{ flexShrink: 0 }} />
                          <span style={{ whiteSpace: "nowrap", lineHeight: "20px", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}>
                            {contactMeta.label}
                          </span>
                          <ChevronDown size={14} color={contactMeta.color} />
                        </button>
                        {openContactId === memberId && (
                          <div
                            style={{
                              position: "absolute",
                              top: "calc(100% + 4px)",
                              left: 0,
                              zIndex: 40,
                              minWidth: 140,
                              background: "#ffffff",
                              border: `1px solid ${MEMBER_MGMT.searchBorder}`,
                              borderRadius: MEMBER_MGMT.radius,
                              padding: "4px 0",
                              boxShadow: "0 8px 24px rgba(11,12,14,0.08)",
                            }}
                          >
                            {(Object.keys(CONTACT_META) as ContactState[]).map((key) => (
                              <button
                                key={key}
                                type="button"
                                onClick={() => {
                                  setContactState((prev) => ({ ...prev, [memberId]: key }));
                                  setOpenContactId(null);
                                }}
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 6,
                                  width: "100%",
                                  border: "none",
                                  background: contact === key ? "#f4f4f6" : "transparent",
                                  padding: "7px 12px",
                                  cursor: "pointer",
                                  color: CONTACT_META[key].color,
                                  fontFamily: ATT_CHECK.fontKR,
                                  fontSize: 13,
                                  fontWeight: 600,
                                }}
                              >
                                <CommentDotsIcon size={14} color={CONTACT_META[key].color} />
                                {CONTACT_META[key].label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <div
                        data-memo-hover=""
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 10,
                          minWidth: 0,
                          overflow: "hidden",
                          position: "relative",
                        }}
                        onMouseEnter={(e) => {
                          if (isEditingMemo || memoHistory.length < 2) return;
                          const rect = e.currentTarget.getBoundingClientRect();
                          const width = Math.min(Math.max(rect.width, 280), 360);
                          const left = Math.min(rect.left, window.innerWidth - width - 12);
                          openMemoHover({
                            id: memberId,
                            top: rect.bottom + 4,
                            left: Math.max(12, left),
                            width,
                          });
                        }}
                        onMouseLeave={scheduleCloseMemoHover}
                      >
                        {isEditingMemo ? (
                          <input
                            autoFocus
                            value={memoDraft}
                            onChange={(e) => setMemoDraft(e.target.value)}
                            onBlur={() => {
                              const next = memoDraft.trim();
                              const prev = memo?.content ?? "";
                              setEditingMemoId(null);
                              if (next !== prev) void saveCareMemo(memberId, next);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                              if (e.key === "Escape") {
                                setEditingMemoId(null);
                                setMemoDraft(memo?.content ?? "");
                              }
                            }}
                            placeholder="메모 입력"
                            style={{
                              flex: 1,
                              minWidth: 0,
                              height: 32,
                              border: "none",
                              outline: "none",
                              background: "transparent",
                              fontFamily: ATT_CHECK.fontKR,
                              fontSize: ATT_CHECK.subFontSize,
                              fontWeight: 500,
                              color: ATT_CHECK.ink,
                              padding: 0,
                            }}
                          />
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              if (isVisitDone) return;
                              setMemoHover(null);
                              setEditingMemoId(memberId);
                              setMemoDraft(memo?.content ?? "");
                            }}
                            style={{
                              ...cellSub,
                              flex: 1,
                              border: "none",
                              background: "transparent",
                              padding: 0,
                              cursor: isVisitDone ? "default" : "text",
                              color: memo?.content ? ATT_CHECK.ink : ATT_CHECK.muted,
                              fontWeight: 500,
                              textAlign: "left",
                              fontFamily: ATT_CHECK.fontKR,
                            }}
                            title={memoHistory.length > 1 ? "이전 주 메모 보기" : memo?.content || "메모 입력"}
                          >
                            {memoDate ? `${formatVisitDay(memoDate)} ` : ""}
                            {memo?.content || "메모 입력"}
                          </button>
                        )}
                        {isVisitDone ? (
                          <span style={{ flexShrink: 0, fontSize: 13, fontWeight: 500, color: ATT_CHECK.muted }}>
                            {referenceSunday && memo!.date > referenceSunday ? "예정" : "완료"}
                          </span>
                        ) : (
                          <button
                            type="button"
                            aria-label="메모 입력"
                            onClick={() => {
                              if (onAddVisit) {
                                onAddVisit(memberId);
                                return;
                              }
                              setMemoHover(null);
                              setEditingMemoId(memberId);
                              setMemoDraft(memo?.content ?? "");
                            }}
                            style={{
                              width: 32,
                              height: 32,
                              border: "none",
                              borderRadius: 8,
                              background: "#ebebef",
                              color: "#7d818e",
                              fontSize: 18,
                              lineHeight: "32px",
                              cursor: "pointer",
                              flexShrink: 0,
                            }}
                          >
                            +
                          </button>
                        )}
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
            display: "flex",
            flexShrink: 0,
            alignItems: "center",
            justifyContent: "center",
            padding: `${ATT_CHECK.pagerGapTop}px 4px ${ATT_CHECK.pagerPadBottom}px`,
          }}
        >
          <MemberStylePagination
            totalItems={Math.max(shownCareRows.length, 1)}
            itemsPerPage={PAGE_SIZE}
            currentPage={currentPage}
            onPageChange={setCurrentPage}
          />
        </div>
      )}
      {memoHover && (memoHistoryByMember.get(memoHover.id)?.length ?? 0) > 1 ? (
        <div
          role="list"
          aria-label="이전 주 메모"
          onMouseEnter={() => {
            if (memoHoverCloseTimer.current) {
              clearTimeout(memoHoverCloseTimer.current);
              memoHoverCloseTimer.current = null;
            }
          }}
          onMouseLeave={scheduleCloseMemoHover}
          style={{
            position: "fixed",
            top: memoHover.top,
            left: memoHover.left,
            width: memoHover.width,
            zIndex: 9999,
            background: "#ffffff",
            border: `1px solid ${MEMBER_MGMT.searchBorder}`,
            borderRadius: MEMBER_MGMT.radius,
            padding: "6px 0",
            boxShadow: "0 10px 28px rgba(11,12,14,0.12)",
            maxHeight: 240,
            overflowY: "auto",
            fontFamily: ATT_CHECK.fontKR,
          }}
        >
          {(memoHistoryByMember.get(memoHover.id) ?? []).map((item) => {
            const isCurrent = Boolean(referenceSunday) && item.date === referenceSunday;
            return (
              <div
                key={`${item.date}-${item.source}-${item.content.slice(0, 12)}`}
                role="listitem"
                style={{
                  display: "grid",
                  gridTemplateColumns: "52px minmax(0, 1fr)",
                  gap: 10,
                  padding: "8px 12px",
                  background: isCurrent ? "#f4f4f6" : "transparent",
                }}
              >
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: ATT_CHECK.headerMuted,
                    fontVariantNumeric: "tabular-nums",
                    whiteSpace: "nowrap",
                  }}
                >
                  {formatVisitDay(item.date)}
                </span>
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 500,
                    color: ATT_CHECK.ink,
                    lineHeight: 1.35,
                    wordBreak: "keep-all",
                    overflowWrap: "anywhere",
                  }}
                >
                  {item.content}
                </span>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
