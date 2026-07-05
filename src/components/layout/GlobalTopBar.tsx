"use client";

import { useShellNav } from "@/contexts/ShellNavContext";

/**
 * 상단 메인 메뉴바 — 사이드바 오른쪽 콘텐츠 영역 위에 얹힌다.
 * 메뉴 스펙(56px 간격 / 566px 기준선 / 텍스트 폭 2px 인디케이터 / Pretendard)은
 * globals.css의 .pc-top-nav-tabs · .pc-nav-tab 규칙을 재사용한다.
 */
export function GlobalTopBar() {
  const nav = useShellNav();
  if (!nav) return null;

  return (
    <div className="pc-content-topbar">
      <nav className="pc-top-nav-tabs" aria-label="주 메뉴">
        {nav.tabs.map((t) => {
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
        })}
      </nav>
    </div>
  );
}
