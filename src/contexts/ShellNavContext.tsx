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
}

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
