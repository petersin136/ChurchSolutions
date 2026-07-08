"use client";

import { useMemo, useState, useCallback, useEffect, useLayoutEffect, useRef, type CSSProperties } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { tokens } from "@/styles/tokens";
import { supabase } from "@/lib/supabase";
import { getChurchId } from "@/lib/tenant";
import { isChurchActiveMember } from "@/lib/attendance-utils";
import type { Member } from "@/types/db";
import type { Attendance } from "@/types/db";
import { CalendarDropdown } from "@/components/CalendarDropdown";
import { ModernSelect } from "@/components/common/ModernSelect";
import { MemberPhoto, MemberPhotoCircle } from "@/components/common/MemberPhoto";
import { MEMBER_MGMT } from "@/styles/memberManagementTokens";
import { MemberSearchCombo } from "@/components/pastoral/MemberSearchCombo";
import { AttendanceDashboard } from "@/components/attendance/AttendanceDashboard";
import { AttendanceDeptMonthlySummary } from "@/components/attendance/AttendanceStatistics";

const ATTENDANCE_DATE_FIELD_WIDTH = 256;

function formatDeptMokjang(member: Member): string {
  const dept = (member.dept || "").trim();
  const mokjang = ((member.mokjang ?? member.group) || "").trim();
  if (dept && mokjang) return `${dept}/${mokjang}`;
  return dept || mokjang || "-";
}

/** 성도 관리 앞 4열 동일 + 출석 상태·사유 */
const ATTENDANCE_COL_TEMPLATE = "48px 176px 96px 152px 180px minmax(280px, 1.4fr)";
const ATTENDANCE_COL_MIN_WIDTH = 932;
const ATTENDANCE_HEADER_COLUMNS = ["번호", "이름", "직분", "부서/목장", "출석 상태", "사유"] as const;

const attendanceGridColumns: CSSProperties = {
  display: "grid",
  gridTemplateColumns: ATTENDANCE_COL_TEMPLATE,
  alignItems: "center",
  width: "100%",
  minWidth: ATTENDANCE_COL_MIN_WIDTH,
  boxSizing: "border-box",
};

const attendanceRowGridStyle: CSSProperties = {
  ...attendanceGridColumns,
  paddingLeft: MEMBER_MGMT.gridPadX,
  paddingRight: MEMBER_MGMT.gridPadX,
};

const attendanceHeaderBandStyle: CSSProperties = {
  boxSizing: "border-box",
  width: "100%",
  paddingLeft: MEMBER_MGMT.tableBorderWidth + MEMBER_MGMT.gridPadX,
  paddingRight: MEMBER_MGMT.tableBorderWidth + MEMBER_MGMT.gridPadX,
};

const ATTENDANCE_COL_LAYOUT = [
  { align: "left" as const },
  { align: "left" as const },
  { align: "left" as const },
  { align: "left" as const },
  { align: "center" as const },
  { align: "left" as const },
];

function attendanceCellPadStyle(colIndex: number): CSSProperties {
  const col = ATTENDANCE_COL_LAYOUT[colIndex];
  return { textAlign: col.align, minWidth: 0, overflow: "hidden" };
}

function attendanceColumnOffsetX(colIndex: number): number {
  const offsets: Record<number, number> = {
    0: MEMBER_MGMT.headerNumOffsetX,
    1: MEMBER_MGMT.headerNameOffsetX,
    2: MEMBER_MGMT.headerRoleOffsetX,
    3: MEMBER_MGMT.headerDeptOffsetX,
  };
  return offsets[colIndex] ?? 0;
}

function columnNudgeStyle(offsetX: number): CSSProperties | undefined {
  if (offsetX === 0) return undefined;
  return {
    display: "inline-block",
    position: "relative",
    left: offsetX,
    maxWidth: "none",
  };
}

function attendanceHeaderCellOverflow(colIndex: number): CSSProperties["overflow"] {
  if (colIndex === 0) return "visible";
  if (colIndex <= 3 && attendanceColumnOffsetX(colIndex) !== 0) return "visible";
  return "hidden";
}

function emptyCellDashStyle(): CSSProperties {
  return {
    color: MEMBER_MGMT.rowText,
    fontSize: MEMBER_MGMT.cellFontSize,
    fontWeight: MEMBER_MGMT.contentFontWeight,
  };
}

const ATTENDANCE_PRESENT_ACTIVE = "#33473b";
const ATTENDANCE_ABSENT_ACTIVE = "#c94c4c";
const ATTENDANCE_STATUS_IDLE_BG = "#f3f4f6";
const ATTENDANCE_STATUS_IDLE_TEXT = "#6b7280";

function attendanceStatusButtonClass(): string {
  return "h-6 rounded-md px-2.5 text-[11px] font-medium leading-none transition-colors border-0 hover:opacity-90";
}

function attendanceStatusButtonStyle(status: AttStatusUI | undefined, target: AttStatusUI): CSSProperties {
  const active = status === target;
  if (active) {
    return {
      background: target === "출석" ? ATTENDANCE_PRESENT_ACTIVE : ATTENDANCE_ABSENT_ACTIVE,
      color: "#ffffff",
    };
  }
  return {
    background: ATTENDANCE_STATUS_IDLE_BG,
    color: ATTENDANCE_STATUS_IDLE_TEXT,
  };
}

function attendanceDateTriggerStyle(): CSSProperties {
  return {
    width: "100%",
    height: MEMBER_MGMT.searchHeight,
    minHeight: MEMBER_MGMT.searchHeight,
    borderRadius: MEMBER_MGMT.radius,
    background: MEMBER_MGMT.searchBg,
    border: `1px solid ${MEMBER_MGMT.searchBorder}`,
    padding: "0 14px",
    display: "flex",
    alignItems: "center",
    gap: 8,
    cursor: "pointer",
    fontWeight: 500,
    fontFamily: MEMBER_MGMT.fontKR,
    fontSize: MEMBER_MGMT.searchFontSize,
    color: MEMBER_MGMT.searchText,
    boxSizing: "border-box",
  };
}

/** 성도 관리(MembersSub) 검색과 동일한 정규화·매칭 */
function normMemberSearchText(s: string): string {
  return (s ?? "").toLowerCase().replace(/\s+/g, "").replace(/[,\uFF0C./]/g, "");
}

function filterMembersByMgmtSearchQuery(members: Member[], query: string): Member[] {
  const q = query.trim().replace(/[,\uFF0C]+$/g, "").trim();
  if (!q) return members;
  const qn = normMemberSearchText(q);
  const digits = q.replace(/\D/g, "");
  if (digits.length === 0 && q.length < 2) return [];
  return members.filter((m) => {
    const nameN = normMemberSearchText(m.name || "");
    const phoneN = (m.phone || "").replace(/\D/g, "");
    const deptN = normMemberSearchText(m.dept || "");
    const mokjangN = normMemberSearchText((m.mokjang ?? m.group) || "");
    const roleN = normMemberSearchText(m.role || "");
    const addrN = normMemberSearchText(m.address || "");
    const memoN = normMemberSearchText(m.memo || "");
    const prayerN = normMemberSearchText(m.prayer || "");
    if (nameN === qn) return true;
    return (
      nameN.includes(qn) ||
      deptN.includes(qn) ||
      mokjangN.includes(qn) ||
      roleN.includes(qn) ||
      (digits.length > 0 ? phoneN.includes(digits) : false) ||
      addrN.includes(qn) ||
      memoN.includes(qn) ||
      prayerN.includes(qn)
    );
  });
}

/** 성도 관리(MembersManagementPanel)와 동일한 행 호버 그라데이션 */
function rowHoverBackground(isHovered: boolean): string {
  if (!isHovered) return "transparent";
  return `linear-gradient(to bottom, ${MEMBER_MGMT.rowHoverTopLine} 0px, ${MEMBER_MGMT.rowHoverTopFade} 2px, ${MEMBER_MGMT.rowHover} 3px, ${MEMBER_MGMT.rowHover} 100%)`;
}

function getLastSunday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  if (day !== 0) d.setDate(d.getDate() - day);
  return d;
}

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const STATUSES = ["출석", "결석"] as const;
type AttStatusUI = (typeof STATUSES)[number];
const ATTENDANCE_CHECK_DEFAULT_PAGE_SIZE = 18;

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

/** 번호식 페이지 목록 (성도 관리와 동일한 앞·뒤 축약) */
function buildAttendancePageList(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 4) return [1, 2, 3, 4, 5, "…", total];
  if (current >= total - 3) return [1, "…", total - 4, total - 3, total - 2, total - 1, total];
  return [1, "…", current - 1, current, current + 1, "…", total];
}

/** 성도 관리(MemberPagination)와 시각적으로 동일한 숫자식 페이지네이션 (데스크톱) */
function AttendanceNumberPagination({
  totalItems,
  itemsPerPage,
  currentPage,
  onPageChange,
}: {
  totalItems: number;
  itemsPerPage: number;
  currentPage: number;
  onPageChange: (page: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  const pages = buildAttendancePageList(safePage, totalPages);
  const prevDisabled = safePage <= 1;
  const nextDisabled = safePage >= totalPages;

  const ITEM_H = MEMBER_MGMT.pagerItemSize;
  const ROW_GAP = MEMBER_MGMT.pagerRowGap;
  const LINE_H = MEMBER_MGMT.pagerBarHeight;
  const lineRadius = LINE_H / 2;

  const arrowStyle = (disabled: boolean, side: "left" | "right"): CSSProperties => ({
    display: "inline-flex",
    alignItems: "center",
    justifyContent: side === "left" ? "flex-start" : "flex-end",
    height: ITEM_H,
    border: "none",
    background: "transparent",
    color: disabled ? MEMBER_MGMT.pagerArrowDisabled : MEMBER_MGMT.pagerArrow,
    cursor: disabled ? "not-allowed" : "pointer",
    padding: 0,
    flexShrink: 0,
  });

  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        width: "100%",
        paddingTop: ROW_GAP,
        fontFamily: MEMBER_MGMT.fontKR,
      }}
    >
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: LINE_H,
          borderRadius: lineRadius,
          background: MEMBER_MGMT.pagerTrack,
        }}
      />

      <button
        type="button"
        aria-label="이전 페이지"
        onClick={() => !prevDisabled && onPageChange(safePage - 1)}
        disabled={prevDisabled}
        style={arrowStyle(prevDisabled, "left")}
      >
        <ArrowLeft size={20} strokeWidth={2.25} />
      </button>

      <div style={{ display: "flex", alignItems: "center", gap: MEMBER_MGMT.pagerGap }}>
        {pages.map((p, idx) => {
          if (p === "…") {
            return (
              <span
                key={`gap-${idx}`}
                style={{
                  color: MEMBER_MGMT.pagerText,
                  fontSize: MEMBER_MGMT.pagerFontSize,
                  userSelect: "none",
                }}
              >
                …
              </span>
            );
          }
          const active = p === safePage;
          return (
            <button
              key={p}
              type="button"
              onClick={() => onPageChange(p)}
              style={{
                position: "relative",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                height: ITEM_H,
                border: "none",
                background: "transparent",
                color: active ? MEMBER_MGMT.pagerActiveText : MEMBER_MGMT.pagerText,
                fontSize: MEMBER_MGMT.pagerFontSize,
                fontWeight: active ? 700 : 500,
                fontVariantNumeric: "tabular-nums",
                cursor: "pointer",
                padding: "0 6px",
                fontFamily: MEMBER_MGMT.fontKR,
              }}
            >
              {p}
              {active && (
                <span
                  aria-hidden
                  style={{
                    position: "absolute",
                    left: "50%",
                    top: -ROW_GAP,
                    transform: "translateX(-50%)",
                    width: MEMBER_MGMT.pagerBarWidth,
                    height: LINE_H,
                    borderRadius: lineRadius,
                    background: MEMBER_MGMT.pagerDot,
                  }}
                />
              )}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        aria-label="다음 페이지"
        onClick={() => !nextDisabled && onPageChange(safePage + 1)}
        disabled={nextDisabled}
        style={arrowStyle(nextDisabled, "right")}
      >
        <ArrowRight size={20} strokeWidth={2.25} />
      </button>
    </div>
  );
}

/** DB: p=출석, a=결석. 기존 o/l/n은 로드 시 결석으로 매핑 */
const UI_TO_DB_STATUS: Record<AttStatusUI, "p" | "a"> = {
  출석: "p",
  결석: "a",
};
const DB_TO_UI_STATUS: Record<string, AttStatusUI> = {
  p: "출석",
  a: "결석",
  o: "결석",
  l: "결석",
  n: "결석",
};

export interface AttendanceCheckProps {
  members: Member[];
  attendanceList?: Attendance[];
  /** 토스트 (Supabase 저장 결과) */
  toast: (msg: string, type?: "ok" | "err" | "warn") => void;
  getCurrentUserId?: () => string | null;
  /** 출석 저장 성공 후 호출 (성도 관리 등 다른 화면에 즉시 반영용) */
  onAttendanceSaved?: () => void;
}

function getActiveMembers(members: Member[]) {
  return members.filter(isChurchActiveMember);
}

function useIsMobile(bp = 768) {
  const [mob, setMob] = useState(false);
  useEffect(() => {
    const q = () => setMob(window.innerWidth <= bp);
    q();
    window.addEventListener("resize", q);
    return () => window.removeEventListener("resize", q);
  }, [bp]);
  return mob;
}

export function AttendanceCheck({
  members,
  attendanceList = [],
  toast,
  getCurrentUserId,
  onAttendanceSaved,
}: AttendanceCheckProps) {
  const mob = useIsMobile();
  const tabletOrLess = useIsMobile(1024);
  const SERVICE_TYPE = "주일예배";
  const todaySunday = useMemo(() => toDateStr(getLastSunday(new Date())), []);
  const [selectedDate, setSelectedDate] = useState(todaySunday);

  const handleDateChange = useCallback((dateStr: string) => {
    const d = new Date(dateStr + "T12:00:00");
    const sunday = getLastSunday(d);
    setSelectedDate(toDateStr(sunday));
  }, []);
  const [deptFilter, setDeptFilter] = useState("");
  const [mokjangFilter, setMokjangFilter] = useState("");
  const [searchName, setSearchName] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageCapacity, setPageCapacity] = useState(tabletOrLess ? 10 : ATTENDANCE_CHECK_DEFAULT_PAGE_SIZE);
  const PAGE_SIZE = pageCapacity;
  const cardRef = useRef<HTMLDivElement | null>(null);
  const pagerRef = useRef<HTMLDivElement | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [statusMap, setStatusMap] = useState<Record<string, AttStatusUI>>({});
  const [noteMap, setNoteMap] = useState<Record<string, string>>({});
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  const loadingRef = useRef(false);
  const toastRef = useRef(toast);
  toastRef.current = toast;
  const statusMapRef = useRef(statusMap);
  statusMapRef.current = statusMap;
  const noteMapRef = useRef(noteMap);
  noteMapRef.current = noteMap;
  const noteTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

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
  const deptOptionsForCombo = useMemo(
    () => [{ value: "all", label: "전체" }, ...depts.map((d) => ({ value: d, label: d }))],
    [depts],
  );
  const mokjangOptionsForCombo = useMemo(
    () => mokjangSelectOptions.map((o) => (o.value === "" ? { value: "all", label: o.label } : o)),
    [mokjangSelectOptions],
  );
  const roleOptionsForCombo = useMemo(() => {
    const set = new Set<string>();
    activeMembers.forEach((m) => {
      if (m.role) set.add(m.role);
    });
    return [{ value: "all", label: "전체" }, ...Array.from(set).sort().map((r) => ({ value: r, label: r }))];
  }, [activeMembers]);

  const filteredMembers = useMemo(() => {
    let list = activeMembers;
    if (deptFilter) list = list.filter((m) => m.dept === deptFilter);
    if (mokjangFilter === "__none__") list = list.filter((m) => !memberMokjangLabel(m));
    else if (mokjangFilter) list = list.filter((m) => memberMokjangLabel(m) === mokjangFilter);
    list = filterMembersByMgmtSearchQuery(list, searchName);
    return list;
  }, [activeMembers, deptFilter, mokjangFilter, searchName]);

  const hasSearchQuery = searchName.trim().length > 0;

  const pagedMembers = useMemo(
    () => filteredMembers.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [filteredMembers, currentPage, PAGE_SIZE]
  );
  const totalPages = Math.max(1, Math.ceil(filteredMembers.length / PAGE_SIZE));

  useEffect(() => {
    setCurrentPage(1);
  }, [deptFilter, mokjangFilter, searchName, selectedDate]);

  useEffect(() => {
    setCurrentPage((p) => Math.min(p, totalPages));
  }, [totalPages]);

  // 성도 관리(MembersManagementPanel)와 동일: 화면 높이에 맞춰 한 페이지 행 수 자동 조절
  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    const compute = () => {
      const card = cardRef.current;
      if (!card) return;
      const cardTop = card.getBoundingClientRect().top;
      const pagerH = pagerRef.current?.offsetHeight ?? 90;
      const bottomPad = MEMBER_MGMT.toolbarPadBottom + 8;
      const avail = window.innerHeight - cardTop - pagerH - bottomPad;
      const rows = Math.max(4, Math.min(40, Math.floor(avail / MEMBER_MGMT.rowHeight)));
      if (Number.isFinite(rows) && rows > 0) setPageCapacity(rows);
    };
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mob]);

  const loadAttendance = useCallback(async (date: string, serviceType: string) => {
    if (!supabase) {
      setStatusMap({});
      setNoteMap({});
      setLoading(false);
      return;
    }
    if (loadingRef.current) {
      console.log("[loadAttendance 호출]", Date.now(), "스킵(이미 로딩 중)");
      return;
    }
    loadingRef.current = true;
    const myId = ++requestIdRef.current;
    console.log("[loadAttendance 호출]", Date.now(), "requestId:", myId);
    setLoading(true);
    const { data, error } = await supabase
      .from("attendance")
      .select("*")
      .eq("date", date)
      .eq("service_type", serviceType)
      .eq("church_id", getChurchId())
      .order("member_id", { ascending: true });
    loadingRef.current = false;
    if (myId !== requestIdRef.current) return;
    if (error) {
      console.error("[출석 로드 실패]", error);
      toastRef.current("데이터 로드 실패: " + error.message, "err");
      setStatusMap({});
      setNoteMap({});
    } else {
      const newMap: Record<string, AttStatusUI> = {};
      const notes: Record<string, string> = {};
      (data ?? []).forEach((row: { member_id?: string; status?: string; note?: string }) => {
        const uiStatus = (DB_TO_UI_STATUS[row.status ?? ""] ?? "결석") as AttStatusUI;
        if (row.member_id) {
          newMap[row.member_id] = uiStatus;
          if (row.note) notes[row.member_id] = row.note;
        }
      });
      console.log("[출석 로드]", { date, serviceType, count: (data ?? []).length, statusMap: newMap });
      setStatusMap(newMap);
      setNoteMap(notes);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadAttendance(selectedDate, SERVICE_TYPE);
  }, [selectedDate, SERVICE_TYPE, loadAttendance]);

  const getStatus = useCallback((memberId: string): AttStatusUI | undefined => {
    return statusMap[memberId];
  }, [statusMap]);

  const setStatus = useCallback((memberId: string, status: AttStatusUI) => {
    setStatusMap((prev) => ({ ...prev, [memberId]: status }));
  }, []);

  const setNote = useCallback((memberId: string, value: string) => {
    setNoteMap((prev) => ({ ...prev, [memberId]: value }));
  }, []);

  const saveOneAttendance = useCallback(async (memberId: string, newStatus: AttStatusUI, noteOverride?: string) => {
    if (!supabase) return;
    setSaving(true);
    setSaved(false);
    setSaveError(false);
    const year = new Date(selectedDate + "T12:00:00").getFullYear();
    const week_num = getWeekNumForDate(selectedDate);
    const note = newStatus === "결석" ? ((noteOverride ?? noteMapRef.current[memberId])?.trim() || null) : null;
    const churchId = getChurchId();
    const { error } = await supabase.from("attendance").upsert([{
      member_id: memberId,
      week_num: Number(week_num),
      year: Number(year),
      date: selectedDate,
      service_type: SERVICE_TYPE,
      status: UI_TO_DB_STATUS[newStatus] ?? "a",
      check_in_time: new Date().toISOString(),
      check_in_method: "수동" as const,
      note: note as string | null,
      checked_by: getCurrentUserId?.() ?? null,
      church_id: churchId,
    }], { onConflict: "member_id,date,service_type" });
    if (error) {
      setSaveError(true);
      setSaving(false);
      return;
    }
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    onAttendanceSaved?.();
  }, [selectedDate, getCurrentUserId, onAttendanceSaved]);

  const toggleAttendance = useCallback((memberId: string, newStatus: AttStatusUI) => {
    setStatusMap((prev) => ({ ...prev, [memberId]: newStatus }));
    saveOneAttendance(memberId, newStatus);
  }, [saveOneAttendance]);

  const handleNoteChange = useCallback((memberId: string, value: string) => {
    setNoteMap((prev) => ({ ...prev, [memberId]: value }));
    if (noteTimersRef.current[memberId]) clearTimeout(noteTimersRef.current[memberId]);
    noteTimersRef.current[memberId] = setTimeout(() => {
      const current = statusMapRef.current[memberId];
      if (current) saveOneAttendance(memberId, current, value);
    }, 800);
  }, [saveOneAttendance]);

  useEffect(() => {
    return () => { Object.values(noteTimersRef.current).forEach(clearTimeout); };
  }, []);

  const getWeekNumForDate = (dateStr: string) => {
    const d = new Date(dateStr + "T12:00:00");
    const s = new Date(d.getFullYear(), 0, 1);
    return Math.ceil(((d.getTime() - s.getTime()) / 864e5 + s.getDay() + 1) / 7);
  };

  const handleSave = async () => {
    if (!supabase) return;
    setSaving(true);
    setSaved(false);
    const year = new Date(selectedDate + "T12:00:00").getFullYear();
    const week_num = getWeekNumForDate(selectedDate);
    const records = filteredMembers
      .filter((m) => statusMap[m.id] != null)
      .map((m) => {
      const uiStatus = statusMap[m.id] as AttStatusUI;
      const note = uiStatus === "결석" ? (noteMap[m.id]?.trim() || null) : null;
      return {
        member_id: m.id,
        week_num: Number(week_num),
        year: Number(year),
        date: selectedDate,
        service_type: SERVICE_TYPE,
        status: UI_TO_DB_STATUS[uiStatus] ?? "a",
        check_in_time: new Date().toISOString(),
        check_in_method: "수동" as const,
        note: note as string | null,
        checked_by: getCurrentUserId?.() ?? null,
      };
    });
    if (records.length === 0) {
      toast("출석 또는 결석을 선택한 후 저장해 주세요.", "warn");
      setSaving(false);
      return;
    }
    const churchId = getChurchId();
    const recordsWithChurch = records.map((r) => ({ ...r, church_id: churchId }));
    console.log("[출석 저장 요청]", { count: records.length, sample: records[0], year, week_num });
    const { data, error } = await supabase.from("attendance").upsert(recordsWithChurch, {
      onConflict: "member_id,date,service_type",
    });
    console.log("=== 출석 저장 디버깅 ===");
    console.log("저장할 데이터:", JSON.stringify(records, null, 2));
    console.log("저장 결과:", JSON.stringify(data, null, 2));
    console.log("에러:", JSON.stringify(error, null, 2));
    console.log("[출석 저장 응답]", { data, error: error?.message ?? null });
    if (error) {
      console.error(error);
      toast("저장 실패: " + error.message, "err");
      setSaving(false);
      return;
    }

    toast(`${records.length}명 출석 저장 완료`);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    setSaving(false);
    loadAttendance(selectedDate, SERVICE_TYPE);
    onAttendanceSaved?.();
  };

  return (
    <div
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
              width: "100%",
              maxWidth: "100%",
              minWidth: 0,
              boxSizing: "border-box",
              fontFamily: MEMBER_MGMT.fontKR,
              paddingTop: MEMBER_MGMT.toolbarPadTop,
              paddingBottom: MEMBER_MGMT.toolbarPadBottom,
            }
      }
    >
      {mob ? (
      <div className="flex flex-wrap items-center gap-2 bg-white rounded-xl shadow-sm border border-gray-100 p-2">
        <label className="flex shrink-0 items-center gap-1.5">
          <span className="whitespace-nowrap text-[10px] text-gray-500">날짜</span>
          <div className="min-w-[200px]" style={{ width: "100%", maxWidth: ATTENDANCE_DATE_FIELD_WIDTH }}>
            <CalendarDropdown
              value={selectedDate}
              onChange={handleDateChange}
              compact
              displayVariant="activity"
              style={{ marginBottom: 0, width: "100%" }}
              triggerStyle={{
                width: "100%",
                fontSize: 11,
                height: 28,
                minHeight: 28,
                padding: "4px 14px",
                borderRadius: MEMBER_MGMT.radius,
                border: `1px solid ${MEMBER_MGMT.searchBorder}`,
                background: MEMBER_MGMT.searchBg,
                fontWeight: 500,
                color: MEMBER_MGMT.searchText,
              }}
            />
          </div>
        </label>
        <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-[#1e40af]">주일예배</span>
        <label className="flex shrink-0 items-center gap-1.5">
          <span className="whitespace-nowrap text-[10px] text-gray-500">이름 검색</span>
          <input
            type="search"
            placeholder="이름 검색"
            value={searchName}
            onChange={(e) => setSearchName(e.target.value)}
            className="h-6 w-20 rounded border border-gray-200 px-1.5 py-0.5 text-[10px]"
          />
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
      </div>
      ) : (
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          flexWrap: "nowrap",
          gap: MEMBER_MGMT.toolbarGap,
          alignItems: "stretch",
          width: "100%",
          minWidth: 0,
          flexShrink: 0,
          fontFamily: MEMBER_MGMT.fontKR,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <MemberSearchCombo
            value={searchName}
            onChange={(v) => {
              setSearchName(v);
              if (!v.trim()) {
                setDeptFilter("");
                setMokjangFilter("");
              }
            }}
            deptOptions={deptOptionsForCombo}
            mokjangOptions={mokjangOptionsForCombo}
            roleOptions={roleOptionsForCombo}
            onSelectDept={(v) => {
              setDeptFilter(v === "all" ? "" : v);
            }}
            onSelectMokjang={(v) => {
              if (v === "all") setMokjangFilter("");
              else if (v === "__none__") setMokjangFilter("__none__");
              else setMokjangFilter(v);
            }}
            onSelectRole={() => {}}
          />
        </div>
        <div
          style={{
            flexShrink: 0,
            width: ATTENDANCE_DATE_FIELD_WIDTH,
            minWidth: ATTENDANCE_DATE_FIELD_WIDTH,
          }}
        >
          <CalendarDropdown
            value={selectedDate}
            onChange={handleDateChange}
            compact
            displayVariant="activity"
            style={{ marginBottom: 0, width: "100%" }}
            triggerStyle={attendanceDateTriggerStyle()}
          />
        </div>
      </div>
      )}

      {loading ? (
        <div
          className={`flex items-center justify-center py-12 bg-white rounded-xl border border-gray-100 ${mob ? "shrink-0" : ""}`}
        >
          <span className="inline-block w-6 h-6 rounded-full border-2 border-[#1e40af] border-t-transparent animate-spin" />
          <span className="ml-2 text-gray-500">출석 데이터 로딩 중...</span>
        </div>
      ) : mob ? (
        <div className="flex flex-col overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
          <div ref={cardRef} className="min-h-0">
            <div className="grid grid-cols-[24px_minmax(0,1fr)_100px_80px] items-center border-b border-gray-100 px-2 py-1 text-[10px] font-medium text-gray-400">
              <span className="text-center">#</span>
              <span className="min-w-0">교인</span>
              <span className="w-[100px] shrink-0 text-center">출석</span>
              <span className="w-[80px] shrink-0 text-center">사유</span>
            </div>
            {filteredMembers.length === 0 ? (
              <div className="py-8 text-center text-gray-500 text-sm">
                {hasSearchQuery ? "검색 결과가 없습니다" : "교인 목록이 없습니다"}
              </div>
            ) : (
              Array.from({ length: PAGE_SIZE }, (_, idx) => {
                const m = pagedMembers[idx];
                if (!m) {
                  return <div key={`mob-pad-${currentPage}-${idx}`} className="grid h-9 grid-cols-[24px_minmax(0,1fr)_100px_80px] border-b border-gray-50 px-2" aria-hidden />;
                }
                const num = (currentPage - 1) * PAGE_SIZE + idx + 1;
                const status = getStatus(m.id);
                const isAbsent = status === "결석";
                return (
                  <div key={m.id} className="grid h-9 grid-cols-[24px_minmax(0,1fr)_100px_80px] items-center border-b border-gray-50 px-2">
                    <span className="text-center text-[10px] tabular-nums text-gray-500">{num}</span>
                    <div className="flex min-w-0 items-center gap-1.5">
                      <MemberPhotoCircle
                        photo={m.photo}
                        name={m.name}
                        getInitial={memberSurnameInitial}
                        imageClassName="h-5 w-5 shrink-0 rounded-full bg-gray-200 bg-cover bg-center"
                        fallbackClassName="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gray-300 text-[9px] font-semibold text-gray-600"
                      />
                      <span className="min-w-0 truncate text-[11px] font-medium text-gray-900">{m.name}</span>
                    </div>
                    <div className="flex w-[100px] shrink-0 justify-center gap-1">
                      <button
                        type="button"
                        onClick={() => toggleAttendance(m.id, "출석")}
                        className="h-5 rounded px-2 text-[10px] font-medium transition-colors border-0"
                        style={attendanceStatusButtonStyle(status, "출석")}
                      >
                        출석
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleAttendance(m.id, "결석")}
                        className="h-5 rounded px-2 text-[10px] font-medium transition-colors border-0"
                        style={attendanceStatusButtonStyle(status, "결석")}
                      >
                        결석
                      </button>
                    </div>
                    {isAbsent ? (
                      <input
                        type="text"
                        placeholder="사유"
                        value={noteMap[m.id] ?? ""}
                        onChange={(e) => handleNoteChange(m.id, e.target.value)}
                        className="box-border h-5 w-[80px] shrink-0 rounded border border-gray-200 bg-white px-1.5 text-[10px] text-gray-900 placeholder:text-gray-300"
                      />
                    ) : (
                      <span className="w-[80px] shrink-0 text-[10px]" style={emptyCellDashStyle()}>-</span>
                    )}
                  </div>
                );
              })
            )}
          </div>
          <div ref={pagerRef}>
          <AttendanceListPaginationBar
            compact
            page={currentPage}
            totalPages={totalPages}
            totalItems={filteredMembers.length}
            onPageChange={setCurrentPage}
          />
          </div>
        </div>
      ) : (
        <div
          style={{
            flex: "0 0 auto",
            width: "100%",
            overflowX: "auto",
            overflowY: "visible",
            display: "flex",
            flexDirection: "column",
            WebkitOverflowScrolling: "touch",
          }}
        >
          <div
            style={{
              minWidth: ATTENDANCE_COL_MIN_WIDTH + MEMBER_MGMT.gridPadX * 2,
              width: "100%",
              flex: "0 0 auto",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              style={{
                width: "100%",
                flexShrink: 0,
                marginTop: MEMBER_MGMT.headerRowGap,
                marginBottom: MEMBER_MGMT.headerToCardGap,
                display: "flex",
                alignItems: "center",
                minHeight: MEMBER_MGMT.headerMinHeight,
                ...attendanceHeaderBandStyle,
              }}
            >
              <div style={{ ...attendanceGridColumns, alignItems: "center", width: "100%" }}>
                {ATTENDANCE_HEADER_COLUMNS.map((h, i) => {
                  const nudge = attendanceColumnOffsetX(i);
                  return (
                    <div
                      key={h}
                      style={{
                        ...attendanceCellPadStyle(i),
                        fontSize: MEMBER_MGMT.headerFontSize,
                        fontWeight: MEMBER_MGMT.headerFontWeight,
                        lineHeight: MEMBER_MGMT.headerLineHeight,
                        color: MEMBER_MGMT.headerText,
                        whiteSpace: "nowrap",
                        overflow: attendanceHeaderCellOverflow(i),
                        textOverflow: "ellipsis",
                        letterSpacing: i === 0 ? "0" : "-0.01em",
                      }}
                    >
                      <span style={columnNudgeStyle(nudge)}>{h}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            <div
              ref={cardRef}
              className="flex flex-col overflow-hidden"
              style={{ background: MEMBER_MGMT.tableBg, borderRadius: MEMBER_MGMT.radius }}
            >
              {filteredMembers.length === 0 ? (
                <div
                  style={{
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    minHeight: PAGE_SIZE * MEMBER_MGMT.rowHeight,
                    color: MEMBER_MGMT.memoMuted,
                    fontSize: MEMBER_MGMT.cellFontSize,
                  }}
                >
                  {hasSearchQuery ? "검색 결과가 없습니다" : "교인 목록이 없습니다"}
                </div>
              ) : (
                Array.from({ length: PAGE_SIZE }, (_, idx) => {
                  const m = pagedMembers[idx];
                  const isNextHovered =
                    idx < pagedMembers.length - 1 && hoveredRow === pagedMembers[idx + 1]?.id;
                  if (!m) {
                    return (
                      <div
                        key={`pad-${currentPage}-${idx}`}
                        style={{
                          ...attendanceRowGridStyle,
                          height: MEMBER_MGMT.rowHeight,
                          borderBottom: `${MEMBER_MGMT.rowBorderWidth}px solid ${MEMBER_MGMT.rowBorder}`,
                        }}
                        aria-hidden
                      />
                    );
                  }
                  const num = (currentPage - 1) * PAGE_SIZE + idx + 1;
                  const status = getStatus(m.id);
                  const isAbsent = status === "결석";
                  const isHovered = hoveredRow === m.id;
                  const roleText = (m.role || "").trim() || "-";
                  return (
                    <div
                      key={m.id}
                      onMouseEnter={() => setHoveredRow(m.id)}
                      onMouseLeave={() => setHoveredRow((prev) => (prev === m.id ? null : prev))}
                      style={{
                        ...attendanceRowGridStyle,
                        height: MEMBER_MGMT.rowHeight,
                        borderBottom:
                          isHovered || isNextHovered
                            ? "transparent"
                            : `${MEMBER_MGMT.rowBorderWidth}px solid ${MEMBER_MGMT.rowBorder}`,
                        background: rowHoverBackground(isHovered),
                        transition: "background 0.12s ease, border-color 0.12s ease",
                      }}
                    >
                      <div
                        style={{
                          ...attendanceCellPadStyle(0),
                          color: MEMBER_MGMT.numText,
                          fontSize: MEMBER_MGMT.cellFontSize,
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {num}
                      </div>
                      <div style={{ ...attendanceCellPadStyle(1), overflow: "hidden" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: MEMBER_MGMT.nameAvatarGap, minWidth: 0 }}>
                          <div
                            style={{
                              width: MEMBER_MGMT.avatarSize,
                              height: MEMBER_MGMT.avatarSize,
                              borderRadius: "50%",
                              background: MEMBER_MGMT.avatarBg,
                              color: MEMBER_MGMT.avatarText,
                              fontSize: MEMBER_MGMT.avatarFontSize,
                              fontWeight: MEMBER_MGMT.avatarFontWeight,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              overflow: "hidden",
                              flexShrink: 0,
                            }}
                          >
                            <MemberPhoto photo={m.photo} name={m.name} className="h-full w-full object-cover" fallback={memberSurnameInitial(m.name)} />
                          </div>
                          <span
                            style={{
                              fontSize: MEMBER_MGMT.nameFontSize,
                              fontWeight: MEMBER_MGMT.nameFontWeight,
                              color: MEMBER_MGMT.nameText,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                            title={m.name}
                          >
                            {m.name}
                          </span>
                        </div>
                      </div>
                      <div
                        style={{
                          ...attendanceCellPadStyle(2),
                          fontSize: MEMBER_MGMT.cellFontSize,
                          fontWeight: MEMBER_MGMT.subFontWeight,
                          color: MEMBER_MGMT.subText,
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {roleText}
                      </div>
                      <div
                        style={{
                          ...attendanceCellPadStyle(3),
                          fontSize: MEMBER_MGMT.cellFontSize,
                          fontWeight: MEMBER_MGMT.subFontWeight,
                          color: MEMBER_MGMT.deptText,
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {formatDeptMokjang(m)}
                      </div>
                      <div style={attendanceCellPadStyle(4)}>
                        <div style={{ display: "flex", justifyContent: "center", gap: 8 }}>
                          <button
                            type="button"
                            onClick={() => toggleAttendance(m.id, "출석")}
                            className={attendanceStatusButtonClass()}
                            style={attendanceStatusButtonStyle(status, "출석")}
                          >
                            출석
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleAttendance(m.id, "결석")}
                            className={attendanceStatusButtonClass()}
                            style={attendanceStatusButtonStyle(status, "결석")}
                          >
                            결석
                          </button>
                        </div>
                      </div>
                      <div style={attendanceCellPadStyle(5)}>
                        {isAbsent ? (
                          <input
                            type="text"
                            placeholder="사유 (선택)"
                            value={noteMap[m.id] ?? ""}
                            onChange={(e) => handleNoteChange(m.id, e.target.value)}
                            className="box-border h-8 w-full min-w-[240px] rounded-md border border-gray-200 bg-white px-2.5 text-[14.3px] text-gray-900 placeholder:text-gray-400"
                          />
                        ) : (
                          <span style={emptyCellDashStyle()}>-</span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            <div
              ref={pagerRef}
              style={{
                display: "flex",
                flexShrink: 0,
                alignItems: "center",
                justifyContent: "center",
                padding: "32px 4px 2px",
              }}
            >
              <AttendanceNumberPagination
                totalItems={filteredMembers.length}
                itemsPerPage={PAGE_SIZE}
                currentPage={currentPage}
                onPageChange={setCurrentPage}
              />
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-end px-1 text-xs text-gray-500">
        {saving ? "저장 중..." : saved ? "자동 저장됨" : saveError ? "저장 실패" : ""}
      </div>

      {!loading && (
        <>
          <section style={{ marginTop: mob ? 16 : 40, width: "100%" }}>
            <AttendanceDashboard embedded members={members} attendanceList={attendanceList} />
          </section>
          <section style={{ marginTop: mob ? 16 : 32, width: "100%", paddingBottom: mob ? 16 : 24 }}>
            <AttendanceDeptMonthlySummary members={members} attendanceList={attendanceList} />
          </section>
        </>
      )}
    </div>
  );
}
