"use client";

import { useState, type ReactNode } from "react";
import { useShellNav } from "@/contexts/ShellNavContext";

/**
 * 상단 메인 메뉴바 — 사이드바 오른쪽 콘텐츠 영역 위에 얹힌다.
 * 메뉴 스펙(56px 간격 / 566px 기준선 / 텍스트 폭 2px 인디케이터 / Pretendard)은
 * globals.css의 .pc-top-nav-tabs · .pc-nav-tab 규칙을 재사용한다.
 * 우측에는 (페이지 액션) + 검색 입력창(밑줄형, 돋보기 우측) + 로그아웃 아이콘.
 */
export function GlobalTopBar({
  actions,
  padLeft,
  padRight,
}: {
  actions?: ReactNode;
  /** 콘텐츠 좌측 여백과 맞춤 (시안 40px) */
  padLeft?: number;
  /** 콘텐츠 우측 여백과 맞춤 (시안 24px) */
  padRight?: number;
}) {
  const nav = useShellNav();
  const [q, setQ] = useState("");
  if (!nav) return null;

  return (
    <div
      className="pc-content-topbar"
      style={{
        ...(padLeft != null ? { paddingLeft: padLeft } : {}),
        ...(padRight != null ? { paddingRight: padRight } : {}),
      }}
    >
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

      <div className="pc-topbar-right">
        {actions}
        <form
          className="pc-topbar-search"
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            nav.onSearch?.(q.trim());
          }}
        >
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="성도·심방·헌금 검색"
            aria-label="검색"
          />
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
        </form>
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
