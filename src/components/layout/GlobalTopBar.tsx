"use client";

import { type ReactNode } from "react";
import { Settings } from "lucide-react";
import { useShellNav } from "@/contexts/ShellNavContext";
import { GlobalSearchBox } from "@/components/layout/GlobalSearchBox";
import { dashTopNavTabsWidthCss } from "@/styles/pastoralDashboardTokens";

/** 금주 출석률 카드(4열 중 2칸) 폭 — 모든 페이지 상단 메뉴 기준선 통일 */
const DEFAULT_TOPBAR_TABS_WIDTH = dashTopNavTabsWidthCss(2);

/**
 * 상단 메인 메뉴바 — 사이드바 오른쪽 콘텐츠 영역 위에 얹힌다.
 * globals.css의 .pc-top-nav-tabs · .pc-nav-tab 규칙을 재사용한다.
 */
export function GlobalTopBar({
  actions,
  padLeft,
  padRight,
  tabsWidth,
}: {
  actions?: ReactNode;
  /** 콘텐츠 좌측 여백과 맞춤 (시안 40px) */
  padLeft?: number;
  /** 콘텐츠 우측 여백과 맞춤 (시안 24px) */
  padRight?: number;
  /** 탭·기준선 영역 고정 폭 — 대시보드 금주 출석률 카드(2칸)와 동일 */
  tabsWidth?: string;
}) {
  const nav = useShellNav();
  if (!nav) return null;

  const resolvedTabsWidth = tabsWidth ?? DEFAULT_TOPBAR_TABS_WIDTH;

  const tabButtons = nav.tabs.map((t) => {
    const isActive = nav.currentPage === t.id;
    return (
      <button
        key={t.id}
        type="button"
        className={`pc-nav-tab ${isActive ? "active" : ""}`}
        onClick={() => nav.setCurrentPage(t.id)}
      >
        <span>{t.label}</span>
      </button>
    );
  });

  return (
    <div
      className="pc-content-topbar"
      style={{
        ...(padLeft != null ? { paddingLeft: padLeft } : {}),
        ...(padRight != null ? { paddingRight: padRight } : {}),
      }}
    >
      <div
        className="pc-topbar-tabs-slot"
        style={{ width: resolvedTabsWidth, maxWidth: resolvedTabsWidth }}
      >
        <nav className="pc-top-nav-tabs pc-top-nav-tabs--content-span" aria-label="주 메뉴">
          {tabButtons}
        </nav>
      </div>

      <div className="pc-topbar-right">
        {actions}
        <GlobalSearchBox />
        <button
          type="button"
          className={`pc-topbar-settings${nav.currentPage === "settings" ? " active" : ""}`}
          title="설정"
          aria-label="설정"
          onClick={() => nav.setCurrentPage("settings")}
        >
          <Settings size={18} strokeWidth={1.75} aria-hidden />
        </button>
        <button
          type="button"
          className="pc-topbar-logout"
          title="로그아웃"
          aria-label="로그아웃"
          onClick={() => nav.onLogout?.()}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
