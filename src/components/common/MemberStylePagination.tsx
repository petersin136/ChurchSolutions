"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import type { CSSProperties } from "react";
import { MEMBER_MGMT } from "@/styles/memberManagementTokens";
import { dashScalePx } from "@/styles/pastoralDashboardTokens";

function buildPageList(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 4) return [1, 2, 3, 4, 5, "…", total];
  if (current >= total - 3) return [1, "…", total - 4, total - 3, total - 2, total - 1, total];
  return [1, "…", current - 1, current, current + 1, "…", total];
}

export type MemberStylePaginationProps = {
  totalItems: number;
  itemsPerPage: number;
  currentPage: number;
  onPageChange: (page: number) => void;
  /** 대시보드 등 — 창 크기에 맞춰 글자·간격 축소 */
  typoScale?: number;
};

/** 성도 관리·출석부와 동일 — 화살표 + 번호 + 상단 트랙 하이라이트 */
export function MemberStylePagination({
  totalItems,
  itemsPerPage,
  currentPage,
  onPageChange,
  typoScale = 1,
}: MemberStylePaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  const pages = buildPageList(safePage, totalPages);
  const prevDisabled = safePage <= 1;
  const nextDisabled = safePage >= totalPages;

  const ITEM_H = dashScalePx(MEMBER_MGMT.pagerItemSize, typoScale);
  const ROW_GAP = dashScalePx(MEMBER_MGMT.pagerRowGap, typoScale);
  const LINE_H = MEMBER_MGMT.pagerBarHeight;
  const lineRadius = LINE_H / 2;
  const pageFont = dashScalePx(MEMBER_MGMT.pagerFontSize, typoScale);
  const pageGap = dashScalePx(MEMBER_MGMT.pagerGap, typoScale);
  const barWidth = dashScalePx(MEMBER_MGMT.pagerBarWidth, typoScale);
  const arrowSize = dashScalePx(20, typoScale);

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
        <ArrowLeft size={arrowSize} strokeWidth={2.25} />
      </button>

      <div style={{ display: "flex", alignItems: "center", gap: pageGap }}>
        {pages.map((p, idx) => {
          if (p === "…") {
            return (
              <span
                key={`gap-${idx}`}
                style={{
                  color: MEMBER_MGMT.pagerText,
                  fontSize: pageFont,
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
                fontSize: pageFont,
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
                    width: barWidth,
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
        <ArrowRight size={arrowSize} strokeWidth={2.25} />
      </button>
    </div>
  );
}
