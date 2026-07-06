"use client";

import { createContext, useContext, type ReactNode } from "react";

/** 상단 메인 메뉴바 탭 (목양/심방·상담/재정/…) */
export interface ShellNavTab {
  id: string;
  label: string;
}

export interface ShellNavValue {
  currentPage: string;
  setCurrentPage: (id: string) => void;
  tabs: ShellNavTab[];
  /** 사이드바 church up 로고 → 목양 대시보드(앱 첫 화면) */
  goHome?: () => void;
  /** 상단바 우측 로그아웃 */
  onLogout?: () => void;
  /** 상단바 우측 검색 실행(Enter). 미전달 시 검색 입력창만 표시 */
  onSearch?: (query: string) => void;
}

/** `goHome` 호출 시 목양 서브탭을 대시보드로 맞추기 위한 이벤트 */
export const CHURCHUP_GO_HOME_EVENT = "churchup-go-home";

const ShellNavContext = createContext<ShellNavValue | null>(null);

/**
 * 앱 셸의 메인 네비게이션(현재 페이지/탭 목록)을 하위 레이아웃에 전달한다.
 * `UnifiedPageLayout` 안의 `GlobalTopBar`가 이 값을 읽어 상단 메뉴바를 그린다.
 */
export function ShellNavProvider({ value, children }: { value: ShellNavValue; children: ReactNode }) {
  return <ShellNavContext.Provider value={value}>{children}</ShellNavContext.Provider>;
}

/** Provider 밖(예: 독립 프린트 뷰)에서는 null을 반환 → 상단바 미표시(안전한 폴백) */
export function useShellNav(): ShellNavValue | null {
  return useContext(ShellNavContext);
}
