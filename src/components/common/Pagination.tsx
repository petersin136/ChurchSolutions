"use client";

import React, { useEffect, useState, useRef, useLayoutEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

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

export interface PaginationProps {
  totalItems: number;
  itemsPerPage?: number;
  currentPage: number;
  onPageChange: (page: number) => void;
  /** true이면 상단 "총 N건 중 X-Y 표시" 줄을 렌더링하지 않음 (버튼 행만) */
  hideSummary?: boolean;
  /** 목양 성도 관리 등 모바일 리스트와 맞춤: 요약·버튼 글자 축소 */
  compact?: boolean;
  /** compact와 함께 쓰면 버튼/요약을 더 촘촘하게(하단 바 전용). 레이아웃 고정은 부모 `PAGINATION_LIST_PARENT_STYLE` + 본 컴포넌트의 marginTop:auto로 처리 */
  pinBottom?: boolean;
}

/** 리스트+Pagination 부모: flex column + 최소 높이 — Pagination의 marginTop:auto가 이 영역 하단까지 밀어냄 */
export const PAGINATION_LIST_PARENT_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  minHeight: "calc(100vh - 300px)",
  width: "100%",
  boxSizing: "border-box",
};

const DEFAULT_ITEMS_PER_PAGE = 10;
const MAX_VISIBLE_PAGES = 5;

function findScrollParent(el: HTMLElement | null): HTMLElement | null {
  let node = el?.parentElement ?? null;
  while (node) {
    const s = window.getComputedStyle(node);
    if ((s.overflowY === "auto" || s.overflowY === "scroll") && node.scrollHeight > node.clientHeight) return node;
    node = node.parentElement;
  }
  return null;
}

export function Pagination({
  totalItems,
  itemsPerPage = DEFAULT_ITEMS_PER_PAGE,
  currentPage,
  onPageChange,
  hideSummary = false,
  compact = false,
  pinBottom = false,
}: PaginationProps) {
  const mob = useIsMobile();
  const wrapRef = useRef<HTMLDivElement>(null);
  const savedScrollRef = useRef<{ parent: HTMLElement; top: number } | null>(null);
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  const start = totalItems === 0 ? 0 : (safePage - 1) * itemsPerPage + 1;
  const end = Math.min(safePage * itemsPerPage, totalItems);

  useLayoutEffect(() => {
    if (savedScrollRef.current) {
      savedScrollRef.current.parent.scrollTop = savedScrollRef.current.top;
      savedScrollRef.current = null;
    }
  });

  const handlePageChange = (page: number) => {
    const sp = findScrollParent(wrapRef.current);
    if (sp) savedScrollRef.current = { parent: sp, top: sp.scrollTop };
    onPageChange(page);
  };
  const prevDisabled = safePage <= 1;
  const nextDisabled = safePage >= totalPages;

  const tight = compact || pinBottom;
  const desktopLoose = !tight && !mob;
  const btnBase: React.CSSProperties = {
    padding: tight ? "4px 8px" : desktopLoose ? "10px 14px" : "8px 12px",
    borderRadius: tight ? 6 : desktopLoose ? 10 : 6,
    border: "1px solid #c7d0e8",
    background: "#f5f8ff",
    color: "#555",
    fontSize: tight ? (pinBottom ? 10 : 11) : desktopLoose ? 14 : 13,
    fontWeight: 500,
    cursor: "pointer",
    fontFamily: "inherit",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: tight ? (pinBottom ? 28 : 30) : desktopLoose ? 40 : 36,
  };
  const summaryFs = tight ? 10 : desktopLoose ? 14 : 13;
  const ellipsisFs = tight ? 10 : desktopLoose ? 14 : 13;
  const chevSize = tight ? (pinBottom ? 14 : 16) : desktopLoose ? 20 : 18;

  const pageStart = totalPages <= MAX_VISIBLE_PAGES
    ? 1
    : Math.max(1, Math.min(safePage - 2, totalPages - MAX_VISIBLE_PAGES));
  const pageEnd = totalPages <= MAX_VISIBLE_PAGES
    ? totalPages
    : Math.min(totalPages, pageStart + MAX_VISIBLE_PAGES - 1);
  const visiblePages = Array.from(
    { length: pageEnd - pageStart + 1 },
    (_, i) => pageStart + i
  );
  const showLeadingEllipsis = pageStart > 1;
  const showTrailingEllipsis = pageEnd < totalPages;

  const wrapStyle: React.CSSProperties = {
    marginTop: "auto",
    paddingTop: 24,
    paddingBottom: 16,
    flexShrink: 0,
    width: "100%",
    boxSizing: "border-box",
  };

  return (
    <div ref={wrapRef} style={wrapStyle}>
      {!hideSummary && (
        <div style={{ fontSize: summaryFs, color: "#999", marginBottom: tight ? 6 : 8, textAlign: "center" }}>
          총 {totalItems}건 중 {totalItems === 0 ? 0 : start}-{end} 표시
        </div>
      )}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: 4,
          flexWrap: "nowrap",
          alignItems: "center",
          overflowX: "auto",
          WebkitOverflowScrolling: "touch",
          paddingBottom: 4,
          marginLeft: -4,
          marginRight: -4,
        }}
      >
        <button
          type="button"
          aria-label="이전 페이지"
          onClick={() => handlePageChange(safePage - 1)}
          disabled={prevDisabled}
          style={{
            ...btnBase,
            flexShrink: 0,
            ...(prevDisabled ? { opacity: 0.5, cursor: "not-allowed" } : {}),
          }}
        >
          <ChevronLeft size={chevSize} />
        </button>
        {showLeadingEllipsis && (
          <>
            <button type="button" style={{ ...btnBase, flexShrink: 0 }} onClick={() => handlePageChange(1)}>1</button>
            <span style={{ padding: "0 4px", color: "#999", fontSize: ellipsisFs, flexShrink: 0 }}>…</span>
          </>
        )}
        {visiblePages.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => handlePageChange(p)}
            style={{
              ...btnBase,
              flexShrink: 0,
              ...(p === safePage ? { background: "#2563eb", color: "#fff", borderColor: "#2563eb" } : {}),
            }}
          >
            {p}
          </button>
        ))}
        {showTrailingEllipsis && (
          <>
            <span style={{ padding: "0 4px", color: "#999", fontSize: ellipsisFs, flexShrink: 0 }}>…</span>
            <button type="button" style={{ ...btnBase, flexShrink: 0 }} onClick={() => handlePageChange(totalPages)}>{totalPages}</button>
          </>
        )}
        <button
          type="button"
          aria-label="다음 페이지"
          onClick={() => handlePageChange(safePage + 1)}
          disabled={nextDisabled}
          style={{
            ...btnBase,
            flexShrink: 0,
            ...(nextDisabled ? { opacity: 0.5, cursor: "not-allowed" } : {}),
          }}
        >
          <ChevronRight size={chevSize} />
        </button>
      </div>
    </div>
  );
}
