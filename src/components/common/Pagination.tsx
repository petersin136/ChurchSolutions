"use client";

import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export interface PaginationProps {
  totalItems: number;
  itemsPerPage?: number;
  currentPage: number;
  onPageChange: (page: number) => void;
}

const DEFAULT_ITEMS_PER_PAGE = 10;
const MAX_VISIBLE_PAGES = 5;

export function Pagination({
  totalItems,
  itemsPerPage = DEFAULT_ITEMS_PER_PAGE,
  currentPage,
  onPageChange,
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  const start = totalItems === 0 ? 0 : (safePage - 1) * itemsPerPage + 1;
  const end = Math.min(safePage * itemsPerPage, totalItems);

  const handlePageChange = (page: number) => onPageChange(page);
  const prevDisabled = safePage <= 1;
  const nextDisabled = safePage >= totalPages;

  const btnBase: React.CSSProperties = {
    padding: "8px 12px",
    borderRadius: 6,
    border: "1px solid #d1d5db",
    background: "white",
    color: "#374151",
    fontSize: 13,
    fontWeight: 500,
    cursor: "pointer",
    fontFamily: "inherit",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 36,
  };

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

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 8 }}>
        총 {totalItems}건 중 {totalItems === 0 ? 0 : start}-{end} 표시
      </div>
      <div style={{ display: "flex", justifyContent: "center", gap: 4, flexWrap: "wrap", alignItems: "center" }}>
        <button
          type="button"
          aria-label="이전 페이지"
          onClick={() => handlePageChange(safePage - 1)}
          disabled={prevDisabled}
          style={{
            ...btnBase,
            ...(prevDisabled ? { opacity: 0.5, cursor: "not-allowed" } : {}),
          }}
        >
          <ChevronLeft size={18} />
        </button>
        {showLeadingEllipsis && (
          <>
            <button type="button" style={btnBase} onClick={() => handlePageChange(1)}>1</button>
            <span style={{ padding: "0 4px", color: "#6b7280", fontSize: 13 }}>…</span>
          </>
        )}
        {visiblePages.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => handlePageChange(p)}
            style={{
              ...btnBase,
              ...(p === safePage ? { background: "#3b82f6", color: "white", borderColor: "#3b82f6" } : {}),
            }}
          >
            {p}
          </button>
        ))}
        {showTrailingEllipsis && (
          <>
            <span style={{ padding: "0 4px", color: "#6b7280", fontSize: 13 }}>…</span>
            <button type="button" style={btnBase} onClick={() => handlePageChange(totalPages)}>{totalPages}</button>
          </>
        )}
        <button
          type="button"
          aria-label="다음 페이지"
          onClick={() => handlePageChange(safePage + 1)}
          disabled={nextDisabled}
          style={{
            ...btnBase,
            ...(nextDisabled ? { opacity: 0.5, cursor: "not-allowed" } : {}),
          }}
        >
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
}
