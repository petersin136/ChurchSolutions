"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { ArrowLeft, ArrowRight, Plus } from "lucide-react";
import type { DB, Member } from "@/types/db";
import { MemberPhoto } from "@/components/common/MemberPhoto";
import { MemberSearchCombo } from "@/components/pastoral/MemberSearchCombo";
import { prayerAnswerKeyFromParts } from "@/lib/prayerAnswers";
import { MEMBER_MGMT, MEMBER_MGMT_COLUMNS, MEMBER_MGMT_COL_LAYOUT, computeMemberPanelPageRows } from "@/styles/memberManagementTokens";

/** 번호식 페이지 목록 (1 2 3 4 5 … 21) — 앞·뒤 축약 */
function buildPageList(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 4) return [1, 2, 3, 4, 5, "…", total];
  if (current >= total - 3) return [1, "…", total - 4, total - 3, total - 2, total - 1, total];
  return [1, "…", current - 1, current, current + 1, "…", total];
}

function MemberPagination({
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
  const pages = buildPageList(safePage, totalPages);
  const prevDisabled = safePage <= 1;
  const nextDisabled = safePage >= totalPages;

  // 선(top:0)과 행(화살표·번호) 사이 간격. 화살표·번호 버튼 높이를 동일하게 맞춰 정렬을 고정한다.
  const ITEM_H = MEMBER_MGMT.pagerItemSize;
  const ROW_GAP = MEMBER_MGMT.pagerRowGap;

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

  const LINE_H = MEMBER_MGMT.pagerBarHeight;
  const lineRadius = LINE_H / 2;

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
      {/* 전체 폭 트랙 — 활성 하이라이트와 동일 굵기·연한 색 */}
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

      {/* 가운데 번호 — 트랙 위에 현재 페이지 구간만 진한색으로 하이라이트 */}
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

function formatDeptMokjang(member: Member): string {
  const dept = (member.dept || "").trim();
  const mokjang = ((member.mokjang ?? member.group) || "").trim();
  if (dept && mokjang) return `${dept}/${mokjang}`;
  return dept || mokjang || "-";
}

/** 내용이 없거나 "-", "—" 같은 자리표시자면 실제 값이 아니라고 본다. */
function isMeaningfulText(value: string | null | undefined): boolean {
  const t = (value ?? "").trim();
  if (!t) return false;
  return !/^[-–—]+$/.test(t);
}

/** QuickNoteModal 과 동일한 규칙으로 기도 응답 키를 만든다. */
function prayerAnswerKeyForNote(memberId: string, note: DB["notes"][string][number]): string {
  return prayerAnswerKeyFromParts({
    memberId,
    noteId: note.id,
    date: note.date,
    createdAt: note.createdAt,
    content: note.content,
  });
}

function prayerPreview(
  member: Member,
  notes: DB["notes"][string] | undefined,
  answeredKeys: Set<string>,
) {
  const prayerNotes = (notes ?? []).filter((n) => n.type === "prayer");
  const sortedPrayers = [...prayerNotes].sort((a, b) =>
    (b.createdAt || b.date || "").localeCompare(a.createdAt || a.date || ""),
  );
  // 이미 응답 받은 기도 제목은 카운트/미리보기에서 제외한다.
  const unanswered = sortedPrayers.filter((n) => {
    if (n.answered) return false;
    if (n.id != null && answeredKeys.has(`id\t${String(n.id)}`)) return false;
    return !answeredKeys.has(prayerAnswerKeyForNote(member.id, n));
  });
  const noteTexts = unanswered
    .map((n) => n.content?.trim())
    .filter(isMeaningfulText) as string[];
  const profile = isMeaningfulText(member.prayer) ? member.prayer!.trim() : "";
  // 미리보기: 최신 note → 없으면 프로필
  const preview = noteTexts[0] ?? profile ?? "";
  // 배지: 같은 내용도 각각 카운트 (내용 유니크 합치지 않음)
  const totalCount = noteTexts.length > 0 ? noteTexts.length : profile ? 1 : 0;
  const extra = Math.max(0, totalCount - 1);
  const max = MEMBER_MGMT.prayerPreviewMaxChars;
  const text = preview.length > max ? `${preview.slice(0, max)}…` : preview;
  return { text, extra, hasPrayer: Boolean(preview) };
}

function memoPreview(notes: DB["notes"][string] | undefined, memberMemo?: string) {
  const memos = (notes ?? []).filter((n) => n.type === "memo");
  const sorted = [...memos].sort((a, b) =>
    (b.createdAt || b.date || "").localeCompare(a.createdAt || a.date || ""),
  );
  const texts = [
    ...sorted.map((n) => n.content?.trim()).filter(isMeaningfulText) as string[],
    ...(isMeaningfulText(memberMemo) ? [memberMemo!.trim()] : []),
  ];
  const unique = [...new Set(texts)];
  const preview = unique[0] ?? "";
  if (!preview) return { text: "-", extra: 0, hasMemo: false };
  const extra = Math.max(0, unique.length - 1);
  const max = MEMBER_MGMT.memoPreviewMaxChars;
  const text = preview.length > max ? `${preview.slice(0, max)}…` : preview;
  return { text, extra, hasMemo: true };
}

function lastVisitDate(notes: DB["notes"][string] | undefined): string {
  const visits = (notes ?? []).filter((n) => n.type === "visit");
  if (!visits.length) return "-";
  const sorted = [...visits].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  return sorted[0]?.date ?? "-";
}

const memberGridColumns: CSSProperties = {
  display: "grid",
  gridTemplateColumns: MEMBER_MGMT.colTemplate,
  alignItems: "center",
  width: "100%",
  minWidth: MEMBER_MGMT.colMinWidth,
  boxSizing: "border-box",
};

/** 데이터 행 — 카드 안쪽 여백 */
const rowGridStyle: CSSProperties = {
  ...memberGridColumns,
  paddingLeft: MEMBER_MGMT.gridPadX,
  paddingRight: MEMBER_MGMT.gridPadX,
};

/** 헤더 — 페이지 배경 위 라벨만 (카드 없음) */
const headerBandStyle: CSSProperties = {
  boxSizing: "border-box",
  width: "100%",
  paddingLeft: MEMBER_MGMT.tableBorderWidth + MEMBER_MGMT.gridPadX,
  paddingRight: MEMBER_MGMT.tableBorderWidth + MEMBER_MGMT.gridPadX,
};

function rowHoverBackground(isHovered: boolean): string {
  if (!isHovered) return "transparent";
  return `linear-gradient(to bottom, ${MEMBER_MGMT.rowHoverTopLine} 0px, ${MEMBER_MGMT.rowHoverTopFade} 2px, ${MEMBER_MGMT.rowHover} 3px, ${MEMBER_MGMT.rowHover} 100%)`;
}

function cellPadStyle(colIndex: number): CSSProperties {
  const col = MEMBER_MGMT_COL_LAYOUT[colIndex];
  return {
    textAlign: col.align,
    minWidth: 0,
    overflow: "hidden",
  };
}

/** 빈 칸 placeholder — 최recent심방·메모·기도 동일 굵기·색 */
function emptyCellDashStyle(): CSSProperties {
  return {
    color: MEMBER_MGMT.rowText,
    fontSize: MEMBER_MGMT.cellFontSize,
    fontWeight: MEMBER_MGMT.contentFontWeight,
  };
}

function columnOffsetX(colIndex: number): number | string {
  const offsets: Record<number, number | string> = {
    0: MEMBER_MGMT.headerNumOffsetX,
    1: MEMBER_MGMT.headerNameOffsetX,
    2: MEMBER_MGMT.headerRoleOffsetX,
    3: MEMBER_MGMT.headerDeptOffsetX,
    4: MEMBER_MGMT.headerPrayerOffsetX,
    5: MEMBER_MGMT.headerVisitOffsetX,
    6: MEMBER_MGMT.headerMemoOffsetX,
  };
  return offsets[colIndex] ?? 0;
}

function columnNudgeStyle(offsetX: number | string): CSSProperties | undefined {
  if (offsetX === 0 || offsetX === "0") return undefined;
  return {
    display: "inline-block",
    position: "relative",
    left: offsetX,
    maxWidth: "none",
  };
}

/** 헤더·데이터 동일 오프셋 */
function dataColumnNudgeStyle(offsetX: number | string): CSSProperties {
  if (offsetX === 0 || offsetX === "0") return {};
  return {
    position: "relative",
    left: offsetX,
  };
}

function headerCellOverflow(colIndex: number): CSSProperties["overflow"] {
  // nudge가 큰 열·번호는 잘리지 않게 visible
  if (colIndex === 0 || colIndex === 5 || colIndex === 6) return "visible";
  if (colIndex <= 4 && columnOffsetX(colIndex) !== 0) return "visible";
  return "hidden";
}

function badgeChipStyle(variant: "prayer" | "memo"): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: MEMBER_MGMT.prayerBadgeMinWidth,
    height: MEMBER_MGMT.prayerBadgeMinWidth,
    fontSize: MEMBER_MGMT.prayerBadgeFontSize,
    fontWeight: MEMBER_MGMT.prayerBadgeFontWeight,
    color: variant === "prayer" ? MEMBER_MGMT.prayerBadgeText : MEMBER_MGMT.memoBadgeText,
    background: variant === "prayer" ? MEMBER_MGMT.prayerBadgeBg : MEMBER_MGMT.memoBadgeBg,
    padding: `0 ${MEMBER_MGMT.prayerBadgePadX}px`,
    borderRadius: MEMBER_MGMT.prayerBadgeRadius,
    lineHeight: 1,
    boxSizing: "border-box",
    flexShrink: 0,
  };
}

/** 배지 고정 앵커 — 칸 오른쪽 끝에서 동일 간격 (행마다·기도/메모 동일 x) */
function badgeAnchorRight(): number {
  return MEMBER_MGMT.badgeBeforeNextColGap;
}

/** 텍스트 말줄임 영역 — 배지 유무와 무관하게 항상 동일 여백 (모든 행 오른쪽 끝 일치) */
function badgeTextReserve(): number {
  return badgeAnchorRight() + MEMBER_MGMT.prayerBadgeMinWidth + MEMBER_MGMT.badgeTextGap;
}

/** 텍스트 말줄임 + 배지(열 오른쪽 고정) — 기도/메모 공통 */
function BadgeColumnCell({
  text,
  extra,
  textStyle,
  variant,
}: {
  text: string;
  extra: number;
  textStyle: CSSProperties;
  variant: "prayer" | "memo";
}) {
  const showBadge = extra > 0;
  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        minWidth: 0,
        display: "flex",
        alignItems: "center",
      }}
    >
      <span
        style={{
          display: "block",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          width: "100%",
          minWidth: 0,
          paddingRight: badgeTextReserve(),
          boxSizing: "border-box",
          ...textStyle,
        }}
      >
        {text}
      </span>
      {showBadge && (
        <span
          aria-hidden
          style={{
            ...badgeChipStyle(variant),
            position: "absolute",
            right: badgeAnchorRight(),
            top: "50%",
            transform: "translateY(-50%)",
          }}
        >
          +{extra}
        </span>
      )}
    </div>
  );
}

export interface MembersManagementPanelProps {
  mob: boolean;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  deptOptions: { value: string; label: string }[];
  mokjangOptions: { value: string; label: string }[];
  roleOptions: { value: string; label: string }[];
  onSelectDept: (value: string) => void;
  onSelectMokjang: (value: string) => void;
  onSelectRole: (value: string) => void;
  onResetFilters: () => void;
  onRegister: () => void;
  db: DB;
  filtered: Member[];
  searchMemberMatches?: { id: string; name: string; subtitle?: string }[];
  onSelectSearchMember?: (memberId: string) => void;
  pageMembers: Member[];
  pageSize: number;
  currentPage: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onOpenQuickPrayer: (id: string, name: string) => void;
  onOpenQuickMemo: (id: string, name: string) => void;
  onOpenActivity: (id: string, name: string, role?: string) => void;
  /** 화면 높이에 맞는 한 페이지 행 수를 부모로 전달 (반응형 페이지 크기) */
  onCapacityChange?: (rows: number) => void;
}

export function MembersManagementPanel({
  mob,
  searchQuery,
  onSearchChange,
  deptOptions,
  mokjangOptions,
  roleOptions,
  onSelectDept,
  onSelectMokjang,
  onSelectRole,
  onResetFilters,
  onRegister,
  db,
  filtered,
  searchMemberMatches,
  onSelectSearchMember,
  pageMembers,
  pageSize,
  currentPage,
  totalItems,
  onPageChange,
  onOpenQuickPrayer,
  onOpenQuickMemo,
  onOpenActivity,
  onCapacityChange,
}: MembersManagementPanelProps) {
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  const [spotlightRowId, setSpotlightRowId] = useState<string | null>(null);
  const [hoveredCell, setHoveredCell] = useState<string | null>(null);
  const cellHovered = (id: string, col: string) => hoveredCell === `${id}:${col}`;
  const cardRef = useRef<HTMLDivElement | null>(null);
  const pagerRef = useRef<HTMLDivElement | null>(null);

  // 데이터 카드 상단 위치와 페이지네이션 높이를 재서, 화면에 들어가는 행 수를 계산.
  // 카드 상단·페이지네이션 높이는 행 수와 무관하게 고정이라 되먹임(무한 루프)이 없다.
  useLayoutEffect(() => {
    if (typeof window === "undefined" || !onCapacityChange) return;

    const compute = () => {
      const card = cardRef.current;
      const pager = pagerRef.current;
      if (!card) return;
      const cardTop = card.getBoundingClientRect().top;
      const pagerH = pager?.offsetHeight ?? 90;
      const bottomPad = MEMBER_MGMT.toolbarPadBottom + 8;
      const avail = window.innerHeight - cardTop - pagerH - bottomPad;
      const rows = computeMemberPanelPageRows(avail, window.innerHeight);
      if (Number.isFinite(rows) && rows > 0) onCapacityChange(rows);
    };

    compute();
    const raf = requestAnimationFrame(compute);
    window.addEventListener("resize", compute);
    const ro =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => requestAnimationFrame(compute))
        : null;
    if (cardRef.current) ro?.observe(cardRef.current);
    if (pagerRef.current) ro?.observe(pagerRef.current);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", compute);
      ro?.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onCapacityChange, mob]);

  useEffect(() => {
    if (!spotlightRowId) return;
    const timer = window.setTimeout(() => setSpotlightRowId(null), 2400);
    return () => window.clearTimeout(timer);
  }, [spotlightRowId]);

  const answeredPrayerKeySet = useMemo(() => {
    const set = new Set(db.answeredPrayerKeys ?? []);
    for (const id of Object.keys(db.answeredPrayerByNoteId ?? {})) {
      set.add(`id\t${id}`);
    }
    return set;
  }, [db.answeredPrayerKeys, db.answeredPrayerByNoteId]);
  const registerBtnStyle: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: MEMBER_MGMT.registerHeight,
    padding: `0 ${MEMBER_MGMT.registerPadX}px`,
    borderRadius: MEMBER_MGMT.radius,
    border: `1px solid ${MEMBER_MGMT.registerBorder}`,
    background: MEMBER_MGMT.registerBg,
    color: MEMBER_MGMT.registerText,
    fontFamily: MEMBER_MGMT.fontKR,
    fontSize: mob ? 13 : MEMBER_MGMT.registerFontSize,
    fontWeight: MEMBER_MGMT.registerFontWeight,
    cursor: "pointer",
    whiteSpace: "nowrap",
    flexShrink: 0,
    boxSizing: "border-box",
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        maxWidth: "100%",
        minWidth: 0,
        minHeight: mob ? MEMBER_MGMT.panelMinHeightMob : MEMBER_MGMT.panelMinHeightDesktop,
        boxSizing: "border-box",
        fontFamily: MEMBER_MGMT.fontKR,
        paddingTop: MEMBER_MGMT.toolbarPadTop,
        paddingBottom: MEMBER_MGMT.toolbarPadBottom,
      }}
    >
      {/* 검색·등록 — 회색 배경 위 */}
      <div
        style={{
          display: "flex",
          gap: MEMBER_MGMT.toolbarGap,
          alignItems: "stretch",
          width: "100%",
          minWidth: 0,
          flexWrap: mob ? "wrap" : "nowrap",
          flexShrink: 0,
        }}
      >
        <MemberSearchCombo
          value={searchQuery}
          onChange={(v) => {
            onSearchChange(v);
            if (!v.trim()) onResetFilters();
          }}
          deptOptions={deptOptions}
          mokjangOptions={mokjangOptions}
          roleOptions={roleOptions}
          onSelectDept={onSelectDept}
          onSelectMokjang={onSelectMokjang}
          onSelectRole={onSelectRole}
          memberMatches={searchMemberMatches}
          onSelectMember={(memberId) => {
            onSelectSearchMember?.(memberId);
            setSpotlightRowId(memberId);
          }}
        />
        <button
          type="button"
          onClick={onRegister}
          style={{
            ...registerBtnStyle,
            ...(mob ? { width: "100%" } : {}),
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = MEMBER_MGMT.registerBgHover;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = MEMBER_MGMT.registerBg;
          }}
        >
          <Plus size={16} strokeWidth={2.25} aria-hidden />
          새 성도 등록
        </button>
      </div>

      {/* 테이블 — 헤더·카드 가로 스크롤 동기화 (활동기록 열 유지) */}
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
            // 열 너비 합(colMinWidth) + 행 좌우 안쪽 여백(gridPadX×2)까지 포함해야
            // 마지막 활동기록(+) 열이 잘리지 않고 스크롤 끝까지 닿는다.
            minWidth: MEMBER_MGMT.colMinWidth + MEMBER_MGMT.gridPadX * 2,
            width: "100%",
            flex: "0 0 auto",
            display: "flex",
            flexDirection: "column",
          }}
        >
      {/* 컬럼 헤더 — 검색창과 카드 사이 */}
      <div
        style={{
          width: "100%",
          flexShrink: 0,
          marginTop: MEMBER_MGMT.headerRowGap,
          marginBottom: MEMBER_MGMT.headerToCardGap,
          display: "flex",
          alignItems: "center",
          minHeight: MEMBER_MGMT.headerMinHeight,
          ...headerBandStyle,
        }}
      >
        <div
          style={{
            ...memberGridColumns,
            alignItems: "center",
            width: "100%",
          }}
        >
          {MEMBER_MGMT_COLUMNS.map((h, i) => {
            const nudge = columnOffsetX(i);
            return (
            <div
              key={h}
              style={{
                ...cellPadStyle(i),
                fontSize: MEMBER_MGMT.headerFontSize,
                fontWeight: MEMBER_MGMT.headerFontWeight,
                lineHeight: MEMBER_MGMT.headerLineHeight,
                color: MEMBER_MGMT.headerText,
                whiteSpace: "nowrap",
                overflow: headerCellOverflow(i),
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

      {/* 데이터 카드 — 화면 높이에 맞춰 행 수 자동 (하단 흰 여백 없음) */}
      <div
        ref={cardRef}
        style={{
          flex: "0 0 auto",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          background: MEMBER_MGMT.tableBg,
          border: "none",
          borderRadius: MEMBER_MGMT.radius,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            flex: "0 0 auto",
            display: "flex",
            flexDirection: "column",
            overflow: "visible",
            WebkitOverflowScrolling: "touch",
          }}
        >
          {filtered.length === 0 ? (
            <div
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                minHeight: pageSize * MEMBER_MGMT.rowHeight,
                color: MEMBER_MGMT.memoMuted,
                fontSize: MEMBER_MGMT.cellFontSize,
              }}
            >
              성도 목록이 없습니다
            </div>
          ) : (
            <>
              {pageMembers.map((m, idx) => {
                const rowNum = (currentPage - 1) * pageSize + idx + 1;
                const notes = db.notes[m.id];
                const prayer = prayerPreview(m, notes, answeredPrayerKeySet);
                const roleText = (m.role || "").trim() || "-";
                const visitDate = lastVisitDate(notes);
                const memo = memoPreview(notes, m.memo);

                const isHovered = hoveredRow === m.id || spotlightRowId === m.id;
                const isNextHovered =
                  idx < pageMembers.length - 1 && hoveredRow === pageMembers[idx + 1]?.id;

                return (
                  <div
                    key={m.id}
                    style={{
                      ...rowGridStyle,
                      height: MEMBER_MGMT.rowHeight,
                      borderBottom:
                        isHovered || isNextHovered ? "transparent" : `${MEMBER_MGMT.rowBorderWidth}px solid ${MEMBER_MGMT.rowBorder}`,
                      borderTop: "transparent",
                      background: rowHoverBackground(isHovered),
                      transition: "background 0.12s ease, border-color 0.12s ease",
                    }}
                    onMouseEnter={() => setHoveredRow(m.id)}
                    onMouseLeave={() => {
                      setHoveredRow((prev) => (prev === m.id ? null : prev));
                      setHoveredCell((prev) => (prev?.startsWith(`${m.id}:`) ? null : prev));
                    }}
                  >
                    <div
                      style={{
                        ...cellPadStyle(0),
                        color: MEMBER_MGMT.numText,
                        fontSize: MEMBER_MGMT.cellFontSize,
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {rowNum}
                    </div>
                    <div style={{ ...cellPadStyle(1), overflow: "hidden" }}>
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
                          <MemberPhoto photo={m.photo} name={m.name} className="h-full w-full object-cover" />
                        </div>
                        <span
                          onMouseEnter={() => setHoveredCell(`${m.id}:name`)}
                          onMouseLeave={() => setHoveredCell(null)}
                          style={{
                            fontSize: MEMBER_MGMT.nameFontSize,
                            fontWeight: MEMBER_MGMT.nameFontWeight,
                            color: cellHovered(m.id, "name") ? MEMBER_MGMT.cellHoverText : MEMBER_MGMT.nameText,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            transition: "color 0.12s ease",
                          }}
                        >
                          {m.name}
                        </span>
                      </div>
                    </div>
                    <div
                      style={{
                        ...cellPadStyle(2),
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
                        ...cellPadStyle(3),
                        fontSize: MEMBER_MGMT.cellFontSize,
                        fontWeight: MEMBER_MGMT.subFontWeight,
                        color: MEMBER_MGMT.deptText,
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {formatDeptMokjang(m)}
                    </div>
                    <div
                      onMouseEnter={() => prayer.hasPrayer && setHoveredCell(`${m.id}:prayer`)}
                      onMouseLeave={() => setHoveredCell(null)}
                      style={{
                        ...cellPadStyle(4),
                        overflow: "hidden",
                        minWidth: 0,
                        ...(prayer.hasPrayer ? { cursor: "pointer" } : {}),
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (prayer.hasPrayer) onOpenQuickPrayer(m.id, m.name || "?");
                      }}
                    >
                      {prayer.hasPrayer ? (
                        <BadgeColumnCell
                          text={prayer.text}
                          extra={prayer.extra}
                          variant="prayer"
                          textStyle={{
                            fontSize: MEMBER_MGMT.cellFontSize,
                            fontWeight: MEMBER_MGMT.contentFontWeight,
                            color: cellHovered(m.id, "prayer") ? MEMBER_MGMT.cellHoverText : MEMBER_MGMT.prayerText,
                            transition: "color 0.12s ease",
                          }}
                        />
                      ) : (
                        <span style={emptyCellDashStyle()}>-</span>
                      )}
                    </div>
                    <div
                      onMouseEnter={() => visitDate !== "-" && setHoveredCell(`${m.id}:visit`)}
                      onMouseLeave={() => setHoveredCell(null)}
                      style={{
                        ...cellPadStyle(5),
                        overflow: "visible",
                        minWidth: 0,
                        fontSize: MEMBER_MGMT.cellFontSize,
                        fontWeight:
                          visitDate !== "-"
                            ? 600
                            : MEMBER_MGMT.contentFontWeight,
                        color:
                          visitDate !== "-" && cellHovered(m.id, "visit")
                            ? MEMBER_MGMT.cellHoverText
                            : visitDate !== "-"
                              ? "#374151"
                              : MEMBER_MGMT.rowText,
                        whiteSpace: "nowrap",
                        textOverflow: "ellipsis",
                        transition: "color 0.12s ease",
                        ...dataColumnNudgeStyle(columnOffsetX(5)),
                      }}
                    >
                      {visitDate}
                    </div>
                    <div
                      onMouseEnter={() => memo.hasMemo && setHoveredCell(`${m.id}:memo`)}
                      onMouseLeave={() => setHoveredCell(null)}
                      style={{
                        ...cellPadStyle(6),
                        overflow: "visible",
                        minWidth: 0,
                        fontSize: MEMBER_MGMT.cellFontSize,
                        ...dataColumnNudgeStyle(columnOffsetX(6)),
                        ...(memo.hasMemo ? { cursor: "pointer" } : {}),
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (memo.hasMemo) onOpenQuickMemo(m.id, m.name || "?");
                      }}
                    >
                      {memo.hasMemo ? (
                        <BadgeColumnCell
                          text={memo.text}
                          extra={memo.extra}
                          variant="memo"
                          textStyle={{
                            fontSize: MEMBER_MGMT.cellFontSize,
                            fontWeight: MEMBER_MGMT.contentFontWeight,
                            color: cellHovered(m.id, "memo") ? MEMBER_MGMT.cellHoverText : MEMBER_MGMT.contentText,
                            transition: "color 0.12s ease",
                          }}
                        />
                      ) : (
                        <span style={emptyCellDashStyle()}>-</span>
                      )}
                    </div>
                    <div
                      style={{
                        ...cellPadStyle(7),
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "flex-end",
                        flexShrink: 0,
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        aria-label="활동기록 추가"
                        onClick={() => onOpenActivity(m.id, m.name || "?", m.role)}
                        style={{
                          width: MEMBER_MGMT.activityBtnSize,
                          height: MEMBER_MGMT.activityBtnSize,
                          borderRadius: 7,
                          border: `1px solid ${MEMBER_MGMT.activityBtnBorder}`,
                          background: MEMBER_MGMT.activityBtnBg,
                          color: MEMBER_MGMT.activityText,
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: "pointer",
                          padding: 0,
                          fontSize: MEMBER_MGMT.activityPlusSize,
                          fontWeight: 500,
                          lineHeight: 1,
                          fontFamily: MEMBER_MGMT.fontKR,
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = MEMBER_MGMT.activityBtnHover;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = MEMBER_MGMT.activityBtnBg;
                        }}
                      >
                        +
                      </button>
                    </div>
                  </div>
                );
              })}
              {Array.from({ length: Math.max(0, pageSize - pageMembers.length) }, (_, idx) => (
                <div
                  key={`pad-${currentPage}-${idx}`}
                  aria-hidden
                  style={{
                    ...rowGridStyle,
                    height: MEMBER_MGMT.rowHeight,
                  }}
                />
              ))}
            </>
          )}
        </div>
      </div>
        </div>
      </div>

      <div
        ref={pagerRef}
        style={{
          display: "flex",
          flexShrink: 0,
          alignItems: "center",
          justifyContent: "center",
          padding: mob ? "28px 4px 6px" : "32px 4px 2px",
        }}
      >
        <MemberPagination
          totalItems={totalItems}
          itemsPerPage={pageSize}
          currentPage={currentPage}
          onPageChange={onPageChange}
        />
      </div>
    </div>
  );
}
