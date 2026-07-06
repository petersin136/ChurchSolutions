"use client";

import React, { useEffect, useState, useRef, useLayoutEffect } from "react";

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
  /** compact와 함께 쓰면 버튼/요약을 더 촘촘하게(리스트 하단 바 전용) */
  pinBottom?: boolean;
  /** 카드 하단 고정용 — pinBottom보다 크고 기본보다 약간 작게 */
  comfortable?: boolean;
}

/** 리스트+Pagination 부모: flex column + 최소 높이 — Pagination의 marginTop:auto가 이 영역 하단까지 밀어냄 */
export const PAGINATION_LIST_PARENT_STYLE: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  width: "100%",
  boxSizing: "border-box",
};

const DEFAULT_ITEMS_PER_PAGE = 10;
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
  hideSummary = true,
  compact = false,
  pinBottom = false,
  comfortable = false,
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

  const tight = (compact || pinBottom) && !comfortable;
  const desktopLoose = !tight && !comfortable && !mob;
  const btnBase: React.CSSProperties = {
    padding: comfortable ? "7px 16px" : tight ? "3px 8px" : desktopLoose ? "8px 14px" : "6px 12px",
    borderRadius: comfortable ? 8 : tight ? 6 : 8,
    border: "1px solid var(--color-border)",
    background: "#fff",
    color: comfortable ? "var(--color-text)" : "var(--color-text-muted)",
    fontSize: comfortable ? 14 : tight ? (pinBottom ? 10 : 11) : desktopLoose ? 14 : 13,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "inherit",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: comfortable ? 60 : tight ? (pinBottom ? 44 : 46) : desktopLoose ? 52 : 48,
    height: comfortable ? 36 : tight ? 24 : desktopLoose ? 34 : 30,
    boxSizing: "border-box",
  };
  const summaryFs = comfortable ? 13 : tight ? 10 : desktopLoose ? 14 : 13;
  const pageIndicatorFs = comfortable ? 15 : tight ? 10 : desktopLoose ? 14 : 13;

  const wrapStyle: React.CSSProperties = {
    marginTop: 0,
    paddingTop: comfortable ? 12 : tight ? 8 : 14,
    paddingBottom: comfortable ? 12 : tight ? 8 : 12,
    flexShrink: 0,
    width: "100%",
    boxSizing: "border-box",
  };

  return (
    <div ref={wrapRef} style={wrapStyle}>
      {!hideSummary && (
        <div style={{ fontSize: summaryFs, color: "var(--color-text-faint)", marginBottom: tight ? 6 : 8, textAlign: "center" }}>
          총 {totalItems}건 중 {totalItems === 0 ? 0 : start}-{end} 표시
        </div>
      )}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: comfortable ? 10 : 6,
          flexWrap: "nowrap",
          alignItems: "center",
          minHeight: comfortable ? 36 : tight ? 24 : desktopLoose ? 34 : 30,
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
          이전
        </button>
        <span
          style={{
            fontSize: pageIndicatorFs,
            color: comfortable ? "var(--color-text)" : "var(--color-text-muted)",
            fontWeight: 700,
            fontVariantNumeric: "tabular-nums",
            minWidth: comfortable ? 64 : tight ? 42 : 56,
            textAlign: "center",
          }}
        >
          {safePage} / {totalPages}
        </span>
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
          다음
        </button>
      </div>
    </div>
  );
}
