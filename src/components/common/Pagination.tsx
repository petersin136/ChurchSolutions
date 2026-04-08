"use client";

import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export interface PaginationProps {
  totalItems: number;
  itemsPerPage?: number;
  currentPage: number;
  onPageChange: (page: number) => void;
  /** true이면 상단 "총 N건 중 X-Y 표시" 줄을 렌더링하지 않음 (버튼 행만) */
  hideSummary?: boolean;
  /** 목양 성도 관리 등 모바일 리스트와 맞춤: 요약·버튼 글자 축소 */
  compact?: boolean;
  /** 부모가 flex column일 때 하단 고정: marginTop auto + padding 8px 0, 요약 10px */
  pinBottom?: boolean;
}

const DEFAULT_ITEMS_PER_PAGE = 10;
const MAX_VISIBLE_PAGES = 5;

export function Pagination({
  totalItems,
  itemsPerPage = DEFAULT_ITEMS_PER_PAGE,
  currentPage,
  onPageChange,
  hideSummary = false,
  compact = false,
  pinBottom = false,
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  const start = totalItems === 0 ? 0 : (safePage - 1) * itemsPerPage + 1;
  const end = Math.min(safePage * itemsPerPage, totalItems);

  const handlePageChange = (page: number) => onPageChange(page);
  const prevDisabled = safePage <= 1;
  const nextDisabled = safePage >= totalPages;

  const tight = compact || pinBottom;
  const btnBase: React.CSSProperties = {
    padding: tight ? "4px 8px" : "8px 12px",
    borderRadius: 6,
    border: "1px solid #d1d5db",
    background: "white",
    color: "#374151",
    fontSize: tight ? (pinBottom ? 10 : 11) : 13,
    fontWeight: 500,
    cursor: "pointer",
    fontFamily: "inherit",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: tight ? (pinBottom ? 28 : 30) : 36,
  };
  const summaryFs = tight ? 10 : 13;
  const ellipsisFs = tight ? 10 : 13;
  const chevSize = tight ? (pinBottom ? 14 : 16) : 18;

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

  const wrapStyle: React.CSSProperties = pinBottom
    ? { marginTop: "auto", padding: "8px 0", flexShrink: 0, width: "100%", boxSizing: "border-box" }
    : { marginTop: 0 };

  return (
    <div style={wrapStyle}>
      {!hideSummary && (
        <div style={{ fontSize: summaryFs, color: "#6b7280", marginBottom: tight ? 6 : 8, textAlign: "center" }}>
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
            <span style={{ padding: "0 4px", color: "#6b7280", fontSize: ellipsisFs, flexShrink: 0 }}>…</span>
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
              ...(p === safePage ? { background: "#4F46E5", color: "white", borderColor: "#4F46E5" } : {}),
            }}
          >
            {p}
          </button>
        ))}
        {showTrailingEllipsis && (
          <>
            <span style={{ padding: "0 4px", color: "#6b7280", fontSize: ellipsisFs, flexShrink: 0 }}>…</span>
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
