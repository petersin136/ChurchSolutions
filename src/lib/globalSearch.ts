"use client";

import { useEffect } from "react";

export const PASTORAL_MEMBERS_SEARCH_KEY = "pastoral_members_search";
export const PASTORAL_MEMBERS_SEARCH_EVENT = "churchup:pastoral-members-search";

export const VISIT_COUNSEL_SEARCH_KEY = "visit_counsel_search";
export const VISIT_COUNSEL_SEARCH_EVENT = "churchup:visit-counsel-search";
export const VISIT_COUNSEL_SET_SUB_EVENT = "visitCounsel:setSub";

export const FINANCE_SEARCH_KEY = "finance_search";
export const FINANCE_SEARCH_EVENT = "churchup:finance-search";
const FINANCE_ACTIVE_TAB_KEY = "finance_active_tab";

type SearchablePage = "pastoral" | "visit" | "finance" | string;

function dispatchSearch(eventName: string, query: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(eventName, { detail: { query } }));
}

function applyPastoralMembersSearch(query: string) {
  sessionStorage.setItem("pastoralSubTab", "members");
  sessionStorage.setItem(PASTORAL_MEMBERS_SEARCH_KEY, query);
  dispatchSearch(PASTORAL_MEMBERS_SEARCH_EVENT, query);
}

function applyVisitCounselSearch(query: string) {
  sessionStorage.setItem(VISIT_COUNSEL_SEARCH_KEY, query);
  window.dispatchEvent(new CustomEvent(VISIT_COUNSEL_SET_SUB_EVENT, { detail: "visits" }));
  dispatchSearch(VISIT_COUNSEL_SEARCH_EVENT, query);
}

function applyFinanceSearch(query: string) {
  sessionStorage.setItem(FINANCE_ACTIVE_TAB_KEY, "offering");
  sessionStorage.setItem(FINANCE_SEARCH_KEY, query);
  dispatchSearch(FINANCE_SEARCH_EVENT, query);
}

/**
 * 상단 GlobalTopBar 검색 — 현재 메인 탭에 맞춰 해당 화면 검색으로 연결.
 * 그 외 탭은 목양 성도 검색으로 이동.
 */
export function runGlobalSearch(
  query: string,
  currentPage: SearchablePage,
  setCurrentPage: (id: string) => void,
): boolean {
  const q = query.trim();
  if (!q) return false;

  switch (currentPage) {
    case "visit":
      setCurrentPage("visit");
      applyVisitCounselSearch(q);
      break;
    case "finance":
      setCurrentPage("finance");
      applyFinanceSearch(q);
      break;
    case "pastoral":
      setCurrentPage("pastoral");
      applyPastoralMembersSearch(q);
      break;
    default:
      setCurrentPage("pastoral");
      applyPastoralMembersSearch(q);
      break;
  }
  return true;
}

/** sessionStorage + 커스텀 이벤트로 페이지 내 검색창에 검색어 반영 */
export function useApplyGlobalSearch(
  storageKey: string,
  eventName: string,
  apply: (query: string) => void,
) {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const run = (q: string) => {
      const trimmed = q.trim();
      if (!trimmed) return;
      apply(trimmed);
    };

    const stored = sessionStorage.getItem(storageKey);
    if (stored) {
      run(stored);
      sessionStorage.removeItem(storageKey);
    }

    const handler = (e: Event) => {
      const q = (e as CustomEvent<{ query?: string }>).detail?.query;
      if (typeof q === "string") run(q);
    };

    window.addEventListener(eventName, handler);
    return () => window.removeEventListener(eventName, handler);
  }, [storageKey, eventName, apply]);
}
