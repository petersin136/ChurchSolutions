"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAppData } from "@/contexts/AppDataContext";
import { useShellNav } from "@/contexts/ShellNavContext";
import {
  buildGlobalSearchResults,
  flattenGlobalSearchResults,
  navigateToSearchResult,
  type GlobalSearchResult,
  type GlobalSearchResultKind,
} from "@/lib/globalSearch";

const CATEGORY_LABEL: Record<GlobalSearchResultKind, string> = {
  menu: "메뉴",
  member: "성도",
  visit: "심방",
  income: "헌금",
};

function SearchIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

export function GlobalSearchBox() {
  const nav = useShellNav();
  const { db } = useAppData();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const trimmed = query.trim();
  const results = useMemo(
    () => buildGlobalSearchResults(db, trimmed),
    [db, trimmed],
  );
  const flatResults = useMemo(() => flattenGlobalSearchResults(results), [results]);
  const hasResults = flatResults.length > 0;
  const showPanel = open && trimmed.length > 0 && hasResults;

  useEffect(() => {
    setActiveIndex(-1);
  }, [trimmed]);

  useEffect(() => {
    if (!showPanel) return;
    const onDocDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocDown);
    return () => document.removeEventListener("mousedown", onDocDown);
  }, [showPanel]);

  const close = useCallback(() => {
    setOpen(false);
    setActiveIndex(-1);
  }, []);

  const pickResult = useCallback(
    (result: GlobalSearchResult) => {
      if (!nav) return;
      navigateToSearchResult(result, nav.setCurrentPage, db);
      setQuery("");
      close();
      inputRef.current?.blur();
    },
    [nav, db, close],
  );

  const submitQuery = useCallback(() => {
    if (!nav || !trimmed) return;
    if (activeIndex >= 0 && flatResults[activeIndex]) {
      pickResult(flatResults[activeIndex]);
      return;
    }
    if (flatResults.length >= 1) {
      pickResult(flatResults[0]);
    }
  }, [nav, trimmed, activeIndex, flatResults, pickResult]);

  if (!nav) return null;

  const sections = ([
    { kind: "menu" as const, items: results.menus },
    { kind: "member" as const, items: results.members },
    { kind: "visit" as const, items: results.visits },
    { kind: "income" as const, items: results.incomes },
  ] as const).filter((s) => s.items.length > 0);

  let flatOffset = 0;

  return (
    <div ref={rootRef} className="pc-topbar-search-wrap">
      <form
        className="pc-topbar-search"
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          submitQuery();
        }}
      >
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              close();
              inputRef.current?.blur();
              return;
            }
            if (!flatResults.length) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setOpen(true);
              setActiveIndex((i) => (i + 1) % flatResults.length);
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setOpen(true);
              setActiveIndex((i) => (i <= 0 ? flatResults.length - 1 : i - 1));
            }
          }}
          placeholder="검색어를 입력하세요"
          aria-label="검색어를 입력하세요"
          aria-expanded={showPanel}
          aria-controls="global-search-results"
          aria-autocomplete="list"
          autoComplete="off"
        />
        <SearchIcon />
      </form>

      {showPanel && (
        <div id="global-search-results" className="pc-topbar-search-panel" role="listbox">
          {sections.map((section) => {
            const sectionStart = flatOffset;
            flatOffset += section.items.length;
            return (
              <div key={section.kind} className="pc-topbar-search-section">
                <div className="pc-topbar-search-section-label">{CATEGORY_LABEL[section.kind]}</div>
                {section.items.map((item, idx) => {
                  const flatIdx = sectionStart + idx;
                  const active = flatIdx === activeIndex;
                  return (
                    <button
                      key={`${item.kind}-${item.id}`}
                      type="button"
                      role="option"
                      aria-selected={active}
                      className={`pc-topbar-search-item${active ? " active" : ""}`}
                      onMouseEnter={() => setActiveIndex(flatIdx)}
                      onClick={() => pickResult(item)}
                    >
                      <span className="pc-topbar-search-item-title">{item.title}</span>
                      {item.subtitle && (
                        <span className="pc-topbar-search-item-sub">{item.subtitle}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
