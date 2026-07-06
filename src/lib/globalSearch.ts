"use client";

import { useEffect } from "react";
import type { DB, Member, Visit, Income } from "@/types/db";
import { getAppMenuEntry, searchAppMenus, type AppMenuEntry } from "@/lib/appMenuSearch";

export const PASTORAL_MEMBERS_SEARCH_KEY = "pastoral_members_search";
export const PASTORAL_MEMBERS_SEARCH_EVENT = "churchup:pastoral-members-search";
export const PASTORAL_OPEN_MEMBER_KEY = "pastoral_open_member";
export const PASTORAL_OPEN_MEMBER_EVENT = "churchup:open-member";
export const PASTORAL_SET_SUB_EVENT = "churchup:pastoral-set-sub";

export const VISIT_COUNSEL_SEARCH_KEY = "visit_counsel_search";
export const VISIT_COUNSEL_SEARCH_EVENT = "churchup:visit-counsel-search";
export const VISIT_COUNSEL_SET_SUB_EVENT = "visitCounsel:setSub";
export const VISIT_COUNSEL_OPEN_VISIT_KEY = "visit_counsel_open_visit";
export const VISIT_COUNSEL_OPEN_VISIT_EVENT = "churchup:open-visit";

export const FINANCE_SEARCH_KEY = "finance_search";
export const FINANCE_SEARCH_EVENT = "churchup:finance-search";
export const FINANCE_SET_TAB_EVENT = "churchup:finance-set-tab";
export const FINANCE_ACTIVE_TAB_KEY = "finance_active_tab";

export const SCHOOL_SET_SUB_EVENT = "churchup:school-set-sub";
export const BULLETIN_SET_SUB_EVENT = "churchup:bulletin-set-sub";
export const PLANNER_SET_SUB_EVENT = "churchup:planner-set-sub";

export type GlobalSearchResultKind = "menu" | "member" | "visit" | "income";

export interface GlobalSearchResult {
  kind: GlobalSearchResultKind;
  id: string;
  title: string;
  subtitle?: string;
}

export interface GlobalSearchResults {
  menus: GlobalSearchResult[];
  members: GlobalSearchResult[];
  visits: GlobalSearchResult[];
  incomes: GlobalSearchResult[];
}

type SearchablePage = "pastoral" | "visit" | "finance" | string;

const LIMIT_PER_CATEGORY = 8;

function norm(s: string) {
  return (s ?? "").toLowerCase().replace(/\s+/g, "").replace(/[,\uFF0C.]/g, "");
}

function visitText(v: Visit): string {
  const ext = v as Visit & { summary?: string; location?: string };
  return [ext.summary, v.content, ext.location].filter(Boolean).join(" ");
}

function memberMatches(member: Member, query: string): boolean {
  const q = norm(query);
  if (!q) return false;
  const digits = query.replace(/\D/g, "");

  const nameN = norm(member.name || "");
  const phoneN = (member.phone || "").replace(/\D/g, "");
  const addrN = norm(member.address || "");
  const memoN = norm(member.memo || "");
  const prayerN = norm(member.prayer || "");

  if (nameN.includes(q)) return true;
  if (digits.length > 0 && phoneN.includes(digits)) return true;
  if (addrN.includes(q) || memoN.includes(q) || prayerN.includes(q)) return true;
  return false;
}

function textMatches(query: string, ...fields: (string | undefined)[]): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return false;
  const qn = norm(q);
  const digits = q.replace(/\D/g, "");
  return fields.some((f) => {
    const raw = f ?? "";
    if (raw.toLowerCase().includes(q)) return true;
    if (qn && norm(raw).includes(qn)) return true;
    if (digits.length >= 2 && raw.replace(/\D/g, "").includes(digits)) return true;
    return false;
  });
}

function formatWon(amount: number) {
  return `${amount.toLocaleString("ko-KR")}원`;
}

function memberSubtitle(m: Member): string {
  const parts = [m.dept, m.role, m.phone].filter(Boolean);
  return parts.join(" · ");
}

/** 메뉴·성도·심방·헌금 통합 검색 (상단 검색 드롭다운용) */
export function buildGlobalSearchResults(db: DB, query: string): GlobalSearchResults {
  const q = query.trim();
  if (!q) return { menus: [], members: [], visits: [], incomes: [] };

  const menus: GlobalSearchResult[] = searchAppMenus(q).map((entry) => ({
    kind: "menu" as const,
    id: entry.id,
    title: entry.label,
    subtitle: entry.path,
  }));

  const memberById = new Map(db.members.map((m) => [m.id, m]));

  const members: GlobalSearchResult[] = [];
  for (const m of db.members) {
    if ((m.member_status ?? m.status) === "졸업/전출") continue;
    if (!memberMatches(m, q)) continue;
    members.push({
      kind: "member",
      id: m.id,
      title: m.name || "(이름 없음)",
      subtitle: memberSubtitle(m),
    });
    if (members.length >= LIMIT_PER_CATEGORY) break;
  }

  const visits: GlobalSearchResult[] = [];
  for (const v of db.visits ?? []) {
    const m = memberById.get(v.memberId);
    const name = m?.name ?? "";
    if (!textMatches(q, name, visitText(v), v.type, v.date)) continue;
    const preview = visitText(v).slice(0, 48);
    visits.push({
      kind: "visit",
      id: v.id,
      title: name ? `${name} · 심방` : "심방 기록",
      subtitle: [v.date, v.type, preview].filter(Boolean).join(" · "),
    });
    if (visits.length >= LIMIT_PER_CATEGORY) break;
  }

  const incomes: GlobalSearchResult[] = [];
  for (const i of db.income ?? []) {
    if (!textMatches(q, i.donor, i.type, i.memo, String(i.amount))) continue;
    incomes.push({
      kind: "income",
      id: i.id,
      title: i.donor?.trim() || "익명",
      subtitle: [i.date, i.type, formatWon(i.amount)].filter(Boolean).join(" · "),
    });
    if (incomes.length >= LIMIT_PER_CATEGORY) break;
  }

  return { menus, members, visits, incomes };
}

export function flattenGlobalSearchResults(results: GlobalSearchResults): GlobalSearchResult[] {
  return [...results.menus, ...results.members, ...results.visits, ...results.incomes];
}

function dispatchSearch(eventName: string, query: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(eventName, { detail: { query } }));
}

function applyPastoralMembersSearch(query: string) {
  sessionStorage.setItem("pastoralSubTab", "members");
  window.dispatchEvent(new CustomEvent(PASTORAL_SET_SUB_EVENT, { detail: "members" }));
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

export function navigateToAppMenu(entry: AppMenuEntry, setCurrentPage: (id: string) => void) {
  setCurrentPage(entry.page);
  switch (entry.page) {
    case "pastoral": {
      const sub = entry.sub ?? "dashboard";
      sessionStorage.setItem("pastoralSubTab", sub);
      window.dispatchEvent(new CustomEvent(PASTORAL_SET_SUB_EVENT, { detail: sub }));
      break;
    }
    case "visit": {
      const sub = entry.sub ?? "dash";
      window.dispatchEvent(new CustomEvent(VISIT_COUNSEL_SET_SUB_EVENT, { detail: sub }));
      break;
    }
    case "school": {
      const sub = entry.sub ?? "dashboard";
      sessionStorage.setItem("schoolSubTab", sub);
      window.dispatchEvent(new CustomEvent(SCHOOL_SET_SUB_EVENT, { detail: sub }));
      break;
    }
    case "finance": {
      const sub = entry.sub ?? "dashboard";
      sessionStorage.setItem(FINANCE_ACTIVE_TAB_KEY, sub);
      window.dispatchEvent(new CustomEvent(FINANCE_SET_TAB_EVENT, { detail: sub }));
      break;
    }
    case "bulletin": {
      const sub = entry.sub ?? "dash";
      sessionStorage.setItem("bulletin-activeSub", sub);
      window.dispatchEvent(new CustomEvent(BULLETIN_SET_SUB_EVENT, { detail: sub }));
      break;
    }
    case "planner": {
      const sub = entry.sub ?? "calendar";
      window.dispatchEvent(new CustomEvent(PLANNER_SET_SUB_EVENT, { detail: sub }));
      break;
    }
    default:
      break;
  }
}

export function navigateToMember(memberId: string, setCurrentPage: (id: string) => void) {
  sessionStorage.setItem("pastoralSubTab", "members");
  sessionStorage.setItem(PASTORAL_OPEN_MEMBER_KEY, memberId);
  setCurrentPage("pastoral");
  window.dispatchEvent(new CustomEvent(PASTORAL_SET_SUB_EVENT, { detail: "members" }));
  window.dispatchEvent(new CustomEvent(PASTORAL_OPEN_MEMBER_EVENT, { detail: { memberId } }));
}

export function navigateToVisit(visitId: string, setCurrentPage: (id: string) => void) {
  sessionStorage.setItem(VISIT_COUNSEL_OPEN_VISIT_KEY, visitId);
  setCurrentPage("visit");
  window.dispatchEvent(new CustomEvent(VISIT_COUNSEL_SET_SUB_EVENT, { detail: "visits" }));
  window.dispatchEvent(new CustomEvent(VISIT_COUNSEL_OPEN_VISIT_EVENT, { detail: { visitId } }));
}

export function navigateToIncome(income: Income, setCurrentPage: (id: string) => void) {
  const q = income.donor?.trim() || income.memo?.trim() || String(income.amount);
  setCurrentPage("finance");
  applyFinanceSearch(q);
}

export function navigateToSearchResult(
  result: GlobalSearchResult,
  setCurrentPage: (id: string) => void,
  db: DB,
) {
  switch (result.kind) {
    case "menu": {
      const entry = getAppMenuEntry(result.id);
      if (entry) navigateToAppMenu(entry, setCurrentPage);
      break;
    }
    case "member":
      navigateToMember(result.id, setCurrentPage);
      break;
    case "visit":
      navigateToVisit(result.id, setCurrentPage);
      break;
    case "income": {
      const income = (db.income ?? []).find((i) => i.id === result.id);
      if (income) navigateToIncome(income, setCurrentPage);
      else {
        setCurrentPage("finance");
        applyFinanceSearch(result.title);
      }
      break;
    }
  }
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

  const menuHits = searchAppMenus(q);
  if (menuHits.length > 0) {
    navigateToAppMenu(menuHits[0], setCurrentPage);
    return true;
  }

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
