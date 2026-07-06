"use client";

import { useState, useEffect, useMemo, useRef, useContext, createContext, type ReactNode, type ComponentType, type TouchEvent } from "react";
import { type LucideIcon } from "lucide-react";
import { GlobalTopBar } from "./GlobalTopBar";
import { SidebarProfile } from "./SidebarProfile";
import { SidebarBrandMark } from "./SidebarBrandMark";
import { useShellNav } from "@/contexts/ShellNavContext";
import { DASH_COLOR, DASH_GLOBAL, DASH_SIDEBAR, dashTopNavTabsWidthCss } from "@/styles/pastoralDashboardTokens";

/**
 * 레이아웃 중첩 깊이. 최상위(0)에서만 상단 메인 메뉴바를 그려
 * 중첩된 UnifiedPageLayout(예: 문자/통계 서브)에서 메뉴바가 중복 렌더되는 것을 막는다.
 */
const UnifiedLayoutDepthContext = createContext(0);

/** 사이드바 메뉴 아이콘 (LucideIcon, ComponentType<any> 등 모두 허용) */
export type NavItemIcon = ComponentType<any>;

/* ---------- 레이아웃 토큰 (심방·상담 등 서브페이지와 맞춤) ---------- */
const LAYOUT = {
  sidebarWidth: DASH_SIDEBAR.width,
  sidebarWidthCollapsed: 64,
  sidebarBg: "var(--color-surface-sidebar)",
  sidebarBorder: "var(--color-border)",
  sidebarHeaderPadding: "24px 20px",
  sidebarHeaderBorder: "1px solid #dde2f0",
  sidebarHeaderIconSize: 36,
  sidebarHeaderIconRadius: 10,
  sidebarHeaderTitleFontSize: 18,
  sidebarHeaderSubFontSize: 12,
  sidebarNavPadding: "12px 10px",
  sidebarSectionPadding: "16px 12px 6px",
  sidebarSectionFontSize: 12,
  sidebarItemPadding: "10px 12px",
  sidebarItemGap: 12,
  sidebarItemFontSize: 14,
  sidebarItemIconSize: 20,
  sidebarFooterPadding: "16px 20px",
  sidebarFooterFontSize: 12,
  mainHeaderHeight: 64,
  mainHeaderHeightMob: 48,
  mainHeaderPadding: "0 28px",
  mainHeaderPaddingMob: "8px 12px",
  mainContentPadding: 24,
  mainContentPaddingMob: 10,
  mainBg: DASH_GLOBAL.bg,
  /** 사이드바·콘텐츠·상단바 동일 배경 — 시안 #f4f4f6 */
  contentAreaBg: DASH_GLOBAL.bg,
  shellPageBg: DASH_GLOBAL.bg,
  headerTitleFontSize: 24,
  headerTitleFontSizeMob: 18,
  headerDescFontSize: 14,
  headerTitleColor: "var(--color-text)",
  headerDescColor: "var(--color-text-muted)",
  border: "var(--color-border)",
  textMuted: "var(--color-text-muted)",
} as const;

/** 모바일: 상단 헤더 + 탭 바 높이 고정(탭 전환 시 콘텐츠 점프 방지) */
const MOB_TOP_HEADER_H = 48;
const MOB_TOP_TABS_H = 40;

/** 사이드바 상단(교회명/날짜) — 모바일·데스크톱 동일 */
const SIDEBAR_HEADER_FIXED = {
  padding: "24px 20px 16px 20px",
  borderBottom: "1px solid var(--color-border)",
  titleFontSize: 18,
  titleFontWeight: 700,
  titleLetterSpacing: -0.5,
  subtitleFontSize: 14,
} as const;

/** 사이드바 메뉴 리스트 영역 — 좌우 inset은 DASH_SIDEBAR.insetX와 동일 */
const SIDEBAR_NAV_AREA = {
  padding: `${DASH_SIDEBAR.dateToMenuGap}px ${DASH_SIDEBAR.insetX}px 12px`,
} as const;

/** 사이드바 메뉴 항목 — 디자이너 시안(목양 대시보드) 기준 */
const SIDEBAR_MENU_ITEM = {
  fontSize: DASH_SIDEBAR.menuFontSize,
  /** 기본 Regular, hover/active만 SemiBold */
  fontWeight: 400,
  fontWeightActive: 600,
  gap: DASH_SIDEBAR.iconGap,
  iconSize: DASH_SIDEBAR.iconSize,
  lineHeight: "1.4",
  letterSpacing: "0",
  boxWidth: DASH_SIDEBAR.hoverBoxWidth,
  boxHeight: DASH_SIDEBAR.hoverBoxHeight,
  boxRadius: DASH_SIDEBAR.hoverBoxRadius,
  boxPaddingX: DASH_SIDEBAR.hoverBoxPaddingX,
  rowGap: DASH_SIDEBAR.itemRowGap,
  boxBg: DASH_COLOR.cardBg,
  color: DASH_SIDEBAR.itemColor,
  transition: "background-color 0.15s ease, font-weight 0.12s ease",
} as const;

function useIsMobile(bp = 1024) {
  const [m, setM] = useState(false);
  useEffect(() => {
    const c = () => setM(window.innerWidth <= bp);
    c();
    window.addEventListener("resize", c);
    return () => window.removeEventListener("resize", c);
  }, [bp]);
  return m;
}

export interface NavSection {
  sectionLabel: string;
  items: { id: string; Icon: NavItemIcon; label: string; badge?: number }[];
}

export interface UnifiedPageLayoutProps {
  /** `churchName`이 없을 때 사이드바 1행 대체 텍스트(예: "플래너", "주보") */
  pageTitle: string;
  /** @deprecated 사이드바 날짜는 레이아웃 내부에서 생성합니다. 호환용으로만 유지 */
  pageSubtitle?: string;
  /** 교회 이름 — 사이드바 1행 우선. 없으면 `pageTitle`, 둘 다 없으면 "교회 이름" */
  churchName?: string;
  /** 사이드바 컨텍스트 줄(없으면 `headerTitle` 사용) */
  sidebarTitle?: string;
  /** 사이드바 메뉴 그룹들 (섹션 제목 + 메뉴 아이템) */
  navSections: NavSection[];
  /** 현재 활성 메뉴 id */
  activeId: string;
  /** 메뉴 클릭 시 */
  onNav: (id: string) => void;
  /** 하단 버전 정보 */
  versionText?: string;
  /** 메인 헤더 제목 (현재 페이지 제목) */
  headerTitle: string;
  /** 메인 헤더 설명 */
  headerDesc?: string;
  /** 메인 헤더 우측 액션 버튼들 */
  headerActions?: ReactNode;
  /** 메인 콘텐츠 */
  children: ReactNode;
  /** 사이드바 상단 아이콘 (기본 Home) */
  SidebarIcon?: LucideIcon;
  /** 페이지 강조색 — 모바일 서브탭 등에 사용. 미전달 시 var(--color-primary) */
  accentColor?: string;
  /** true면 모바일 상단 가로 서브탭 바를 숨김(재정 등 본문에서 자체 네비 사용) */
  hideMobileSubTabs?: boolean;
  /** 메인 콘텐츠 상단 여백(px) — `children` 래퍼 `marginTop`. 미지정 시 모바일 16·데스크톱 20 */
  contentTopGap?: number;
  /** 콘텐츠 스크롤 영역 배경색. 미지정 시 기존 값(var(--color-surface-muted)) */
  contentBg?: string;
  /** 데스크톱 콘텐츠 좌우 패딩(px) — 좌·우 동일. 미지정 시 24 */
  contentPaddingX?: number;
  /** 데스크톱 콘텐츠 좌측 패딩(px) — contentPaddingX 보다 우선 */
  contentPaddingLeft?: number;
  /** 데스크톱 콘텐츠 우측 패딩(px) — contentPaddingX 보다 우선 */
  contentPaddingRight?: number;
  /** 데스크톱 콘텐츠 하단 패딩(px). 미지정 시 120(스크롤 여유) */
  contentPaddingBottom?: number;
  /** 콘텐츠 영역 기본 서체 — 미지정 시 var(--font-sans) */
  contentFontFamily?: string;
  /** true면 데스크톱에서 페이지 제목 헤더(제목+설명)를 숨김(표시만, 컴포넌트 유지). 모바일은 햄버거 때문에 항상 표시 */
  hideHeader?: boolean;
  /** 데스크톱 상단 메뉴바(GlobalTopBar) 우측(검색창 옆)에 렌더할 페이지 액션(예: +새가족) */
  topbarActions?: ReactNode;
  /** 데스크톱 상단 탭 nav 폭 — 금주 출석률 카드 등 콘텐츠 그리드와 맞출 때 calc(...) */
  topbarTabsWidth?: string;
}

export function UnifiedPageLayout({
  pageTitle: _pageTitle,
  pageSubtitle: _pageSubtitle,
  churchName: _churchName,
  sidebarTitle: _sidebarTitle,
  navSections,
  activeId,
  onNav,
  versionText: _versionText = "v1.0",
  headerTitle,
  headerDesc,
  headerActions,
  children,
  SidebarIcon: _SidebarIcon,
  accentColor: _accentColor,
  hideMobileSubTabs = false,
  contentTopGap,
  contentBg,
  contentPaddingX,
  contentPaddingLeft,
  contentPaddingRight,
  contentPaddingBottom,
  contentFontFamily,
  hideHeader = false,
  topbarActions,
  topbarTabsWidth,
}: UnifiedPageLayoutProps) {
  const mob = useIsMobile();
  const shellNav = useShellNav();
  const goHome = shellNav?.goHome;
  const handleBrandHomeClick = goHome
    ? () => {
        goHome();
        setSideOpen(false);
      }
    : undefined;
  const [sideOpen, setSideOpen] = useState(false);

  const flatTabs = useMemo(() => navSections.flatMap((sec) => sec.items), [navSections]);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const tabBtnRefs = useRef<Partial<Record<string, HTMLButtonElement | null>>>({});

  useEffect(() => {
    if (!mob || flatTabs.length === 0) return;
    const el = tabBtnRefs.current[activeId];
    el?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [activeId, mob, flatTabs.length]);

  const handleSwipeTouchStart = (e: TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleSwipeTouchEnd = (e: TouchEvent) => {
    if (!mob || flatTabs.length < 2) return;
    const endX = e.changedTouches[0].clientX;
    const endY = e.changedTouches[0].clientY;
    const dx = touchStartX.current - endX;
    const dy = touchStartY.current - endY;
    if (Math.abs(dx) < 50) return;
    if (Math.abs(dx) < Math.abs(dy)) return;
    const currentIndex = flatTabs.findIndex((t) => t.id === activeId);
    if (currentIndex < 0) return;
    if (dx > 50 && currentIndex < flatTabs.length - 1) {
      onNav(flatTabs[currentIndex + 1].id);
    } else if (dx < -50 && currentIndex > 0) {
      onNav(flatTabs[currentIndex - 1].id);
    }
  };

  useEffect(() => {
    if (!mob) setSideOpen(true);
    else setSideOpen(false);
  }, [mob]);

  const layoutDepth = useContext(UnifiedLayoutDepthContext);
  const isOutermost = layoutDepth === 0;
  /** 데스크톱 + 최상위 레이아웃에서만 상단 메인 메뉴바를 콘텐츠 영역 위에 렌더 */
  const showGlobalTopBar = isOutermost && !mob;

  /** 시안: "2026. 07. 01. WED" (Inter) */
  const sidebarDateLine = (() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const wd = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"][d.getDay()];
    return `${y}. ${m}. ${day}. ${wd}`;
  })();
  const sidebarExpanded = !mob || sideOpen;
  const asideWidth = LAYOUT.sidebarWidth;
  const contentPadLeft = mob
    ? LAYOUT.mainContentPaddingMob
    : (contentPaddingLeft ?? contentPaddingX ?? DASH_GLOBAL.contentPadLeft);
  const contentPadRight = mob
    ? LAYOUT.mainContentPaddingMob
    : (contentPaddingRight ?? contentPaddingX ?? DASH_GLOBAL.contentPadRight);
  const resolvedTopbarTabsWidth = topbarTabsWidth ?? dashTopNavTabsWidthCss(2);
  const contentPadBottom = contentPaddingBottom ?? 120;
  const contentMarginTop = contentTopGap !== undefined ? contentTopGap : mob ? 16 : 20;
  const compactMainChrome = contentTopGap === 0;
  /** 데스크톱에서만 페이지 제목 헤더를 숨김(모바일은 햄버거 버튼이 헤더에 있어 유지) */
  const hideDesktopHeader = hideHeader && !mob;

  return (
    <UnifiedLayoutDepthContext.Provider value={layoutDepth + 1}>
    <div
      style={{
        fontFamily: "var(--font-sans)",
        background: LAYOUT.mainBg,
        position: "relative" as const,
        top: "auto",
        left: "auto",
        right: "auto",
        bottom: "auto",
        width: "100%",
        height: "100%",
        borderRadius: 0,
        border: "none",
        boxShadow: "none",
        display: "flex",
        color: "var(--color-text)",
        overflow: "hidden",
      }}
    >
      {mob && sideOpen && (
        <div
          onClick={() => setSideOpen(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 99 }}
          aria-hidden
        />
      )}

      {/* Sidebar — Visit과 동일 px/색상 */}
      <aside
        style={{
          width: asideWidth,
          /* 데스크톱: 사이드바·콘텐츠 동일 #f4f4f6 — 메뉴 경계 없음. 모바일 드로어는 기존 유지 */
          background: mob ? LAYOUT.sidebarBg : LAYOUT.shellPageBg,
          borderRight: mob ? `1px solid ${LAYOUT.sidebarBorder}` : "none",
          color: "var(--color-text)",
          display: "flex",
          flexDirection: "column",
          transition: mob ? "transform 0.3s ease" : "width 0.25s ease",
          overflow: "hidden",
          flexShrink: 0,
          zIndex: 100,
          ...(mob
            ? { position: "fixed", top: 0, left: 0, bottom: 0, transform: sideOpen ? "translateX(0)" : "translateX(-100%)" }
            : {}),
        }}
      >
        {sidebarExpanded ? (
          <div
            style={{
              padding: `${DASH_SIDEBAR.headerPaddingTop}px 0 0`,
              borderBottom: mob ? LAYOUT.sidebarHeaderBorder : "none",
              background: "transparent",
              boxSizing: "border-box",
              display: "flex",
              justifyContent: "center",
              width: "100%",
            }}
          >
            {/* 처치업 로고 + 날짜 — 사이드바 가운데 정렬 */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                width: "fit-content",
                boxSizing: "border-box",
              }}
            >
              <SidebarBrandMark onClick={handleBrandHomeClick} />
              <div
                style={{
                  marginTop: DASH_SIDEBAR.logoToDateGap,
                  display: "flex",
                  alignItems: "baseline",
                  justifyContent: "center",
                  gap: 4,
                  fontFamily: DASH_GLOBAL.fontLatin,
                  fontSize: DASH_SIDEBAR.dateFontSize,
                  letterSpacing: `${DASH_SIDEBAR.dateLetterSpacing}px`,
                  lineHeight: DASH_SIDEBAR.dateLineHeight,
                  whiteSpace: "nowrap",
                }}
              >
                <span style={{ fontWeight: 500, color: DASH_COLOR.sidebarDateToday }}>Today</span>
                <span style={{ fontWeight: 600, color: DASH_COLOR.sidebarDateValue }}>{sidebarDateLine}</span>
              </div>
            </div>
          </div>
        ) : (
          <div
            style={{
              padding: "16px 10px",
              borderBottom: mob ? SIDEBAR_HEADER_FIXED.borderBottom : "none",
              marginBottom: 8,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <button
              type="button"
              onClick={handleBrandHomeClick}
              aria-label="홈으로 이동"
              title="홈으로 이동"
              style={{
                border: "none",
                background: "transparent",
                padding: 0,
                margin: 0,
                cursor: goHome ? "pointer" : "default",
                display: "inline-flex",
              }}
            >
              <SidebarBrandMark onClick={handleBrandHomeClick} compact />
            </button>
          </div>
        )}

        <nav
          style={{
            flex: 1,
            padding: SIDEBAR_NAV_AREA.padding,
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: 0,
          }}
        >
          {navSections.map((sec) => (
            <div
              key={sec.sectionLabel}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: SIDEBAR_MENU_ITEM.rowGap,
              }}
            >
              {navSections.length > 1 && (
                <div
                  style={{
                    fontSize: 12,
                    color: DASH_COLOR.dateValue,
                    padding: "0 0 8px 0",
                    fontWeight: 500,
                    lineHeight: 1.2,
                  }}
                >
                  {sec.sectionLabel}
                </div>
              )}
              {sec.items.map((n) => {
                const isActive = activeId === n.id;
                const Icon = n.Icon;
                const navBtnStyle = {
                  display: "flex" as const,
                  alignItems: "center" as const,
                  gap: SIDEBAR_MENU_ITEM.gap,
                  padding: `0 ${SIDEBAR_MENU_ITEM.boxPaddingX}px`,
                  minHeight: SIDEBAR_MENU_ITEM.boxHeight,
                  height: SIDEBAR_MENU_ITEM.boxHeight,
                  fontSize: SIDEBAR_MENU_ITEM.fontSize,
                  fontWeight: isActive ? SIDEBAR_MENU_ITEM.fontWeightActive : SIDEBAR_MENU_ITEM.fontWeight,
                  lineHeight: SIDEBAR_MENU_ITEM.lineHeight,
                  letterSpacing: SIDEBAR_MENU_ITEM.letterSpacing,
                  transition: SIDEBAR_MENU_ITEM.transition,
                  borderRadius: SIDEBAR_MENU_ITEM.boxRadius,
                  border: "none",
                  backgroundColor: isActive ? SIDEBAR_MENU_ITEM.boxBg : "transparent",
                  boxShadow: isActive ? "0 1px 2px rgba(0,0,0,0.04)" : "none",
                  color: SIDEBAR_MENU_ITEM.color,
                  cursor: "pointer" as const,
                  fontFamily: "inherit",
                  textAlign: "left" as const,
                  whiteSpace: "nowrap" as const,
                  position: "relative" as const,
                  width: sidebarExpanded ? SIDEBAR_MENU_ITEM.boxWidth : "100%",
                  boxSizing: "border-box" as const,
                };
                return (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => { onNav(n.id); if (mob) setSideOpen(false); }}
                    style={navBtnStyle}
                    onMouseEnter={(e) => {
                      if (mob || isActive) return;
                      e.currentTarget.style.backgroundColor = SIDEBAR_MENU_ITEM.boxBg;
                      e.currentTarget.style.fontWeight = String(SIDEBAR_MENU_ITEM.fontWeightActive);
                      e.currentTarget.style.boxShadow = "0 1px 2px rgba(0,0,0,0.04)";
                    }}
                    onMouseLeave={(e) => {
                      if (mob || isActive) return;
                      e.currentTarget.style.backgroundColor = "transparent";
                      e.currentTarget.style.fontWeight = String(SIDEBAR_MENU_ITEM.fontWeight);
                      e.currentTarget.style.boxShadow = "none";
                    }}
                  >
                    <Icon
                      size={SIDEBAR_MENU_ITEM.iconSize}
                      strokeWidth={1.75}
                      color={SIDEBAR_MENU_ITEM.color}
                      style={{
                        width: SIDEBAR_MENU_ITEM.iconSize,
                        height: SIDEBAR_MENU_ITEM.iconSize,
                        flexShrink: 0,
                      }}
                    />
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{n.label}</span>
                    {n.badge != null && n.badge > 0 && (
                      <span
                        style={{
                          marginLeft: "auto",
                          background: "var(--color-danger)",
                          color: "#fff",
                          fontSize: 11,
                          padding: "1px 7px",
                          borderRadius: 10,
                          fontWeight: 600,
                        }}
                      >
                        {n.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        <div
          style={{
            padding: `${DASH_SIDEBAR.profilePaddingTop}px ${DASH_SIDEBAR.profilePaddingX}px ${DASH_SIDEBAR.profilePaddingBottom}px`,
            borderTop: mob ? LAYOUT.sidebarHeaderBorder : "none",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <SidebarProfile expanded={sidebarExpanded} churchNameFallback={_churchName} />
        </div>
      </aside>

      {/* Main */}
      <main
        style={{
          flex: 1,
          minWidth: 0,
          minHeight: 0,
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            height: "100%",
            flex: 1,
            minHeight: 0,
            width: "100%",
            overflow: "hidden",
          }}
        >
            {showGlobalTopBar && (
              <GlobalTopBar
                actions={topbarActions}
                padLeft={contentPadLeft}
                padRight={contentPadRight}
                tabsWidth={resolvedTopbarTabsWidth}
              />
            )}
            {!hideDesktopHeader && (
            <header
              style={
                mob
                  ? {
                      flexShrink: 0,
                      height: compactMainChrome ? "auto" : MOB_TOP_HEADER_H,
                      minHeight: compactMainChrome ? 0 : MOB_TOP_HEADER_H,
                      maxHeight: compactMainChrome ? "none" : MOB_TOP_HEADER_H,
                      padding: compactMainChrome ? "8px 16px 0" : "12px 16px 0",
                      marginBottom: compactMainChrome ? 0 : undefined,
                      boxSizing: "border-box",
                      overflow: "hidden",
                      background: "var(--color-surface)",
                      borderBottom: `1px solid ${LAYOUT.border}`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 8,
                    }
                  : {
                      minHeight: compactMainChrome ? 0 : LAYOUT.mainHeaderHeight,
                      padding: compactMainChrome ? "10px 28px 0" : LAYOUT.mainHeaderPadding,
                      marginBottom: compactMainChrome ? 0 : undefined,
                      paddingBottom: compactMainChrome ? 0 : undefined,
                      background: "var(--color-surface)",
                      borderBottom: `1px solid ${LAYOUT.border}`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      flexShrink: 0,
                      gap: 8,
                    }
              }
            >
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: 1, height: "100%", overflow: "hidden" }}>
            {mob && (
              <button
                type="button"
                onClick={() => setSideOpen(true)}
                className="min-w-[36px] min-h-[36px] w-9 h-9 flex items-center justify-center flex-shrink-0 border-0 rounded-lg cursor-pointer"
                style={{
                  background: "var(--color-primary-soft)",
                  lineHeight: 1,
                  alignSelf: "center",
                }}
                aria-label="메뉴 열기"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
              </button>
            )}
            <div
              style={{
                minWidth: 0,
                flex: 1,
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
                justifyContent: mob ? "flex-start" : "center",
                ...(mob ? { paddingTop: 0 } : {}),
              }}
            >
              <div
                style={{
                  fontSize: mob ? 16 : LAYOUT.headerTitleFontSize,
                  fontWeight: 700,
                  letterSpacing: mob ? -0.3 : -0.5,
                  color: mob ? "var(--color-text)" : LAYOUT.headerTitleColor,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  lineHeight: 1.2,
                }}
              >
                {headerTitle}
              </div>
              {(mob || headerDesc) && (
                <div
                  style={{
                    fontSize: mob ? 11 : LAYOUT.headerDescFontSize,
                    color: mob ? "var(--color-text-muted)" : LAYOUT.headerDescColor,
                    marginTop: mob ? 2 : 2,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    lineHeight: 1.2,
                    minHeight: mob ? 14 : undefined,
                  }}
                >
                  {mob ? headerDesc || "\u00a0" : headerDesc}
                </div>
              )}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0, alignSelf: "center" }}>{headerActions}</div>
        </header>
        )}

        {mob && navSections.length > 0 && !hideMobileSubTabs && (
          <div
            className="mobile-sub-tabs"
            style={{
              display: "flex",
              alignItems: "stretch",
              overflowX: "auto",
              overflowY: "hidden",
              height: MOB_TOP_TABS_H,
              minHeight: MOB_TOP_TABS_H,
              maxHeight: MOB_TOP_TABS_H,
              borderBottom: "2px solid #f0f2f5",
              background: "var(--color-surface)",
              padding: 0,
              gap: 0,
              flexShrink: 0,
              WebkitOverflowScrolling: "touch",
              scrollbarWidth: "none",
              msOverflowStyle: "none",
              boxSizing: "border-box",
            }}
          >
            {navSections.flatMap((sec) =>
              sec.items.map((item) => {
                const isActive = item.id === activeId;
                return (
                  <button
                    key={`${sec.sectionLabel}-${item.id}`}
                    ref={(el) => {
                      tabBtnRefs.current[item.id] = el;
                    }}
                    type="button"
                    onClick={() => onNav(item.id)}
                    style={{
                      flex: "0 0 auto",
                      height: MOB_TOP_TABS_H,
                      display: "inline-flex",
                      alignItems: "center",
                      padding: "0 12px",
                      fontSize: 12,
                      fontWeight: isActive ? 700 : 500,
                      color: isActive ? "var(--color-primary)" : "var(--color-text-muted)",
                      background: "none",
                      border: "none",
                      borderBottom: isActive ? "2px solid var(--color-primary)" : "2px solid transparent",
                      boxSizing: "border-box",
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                      wordBreak: "keep-all",
                      transition: "color 0.15s, border-color 0.15s",
                      fontFamily: "inherit",
                    }}
                  >
                    {item.label}
                  </button>
                );
              })
            )}
          </div>
        )}

        <div
          onTouchStart={mob ? handleSwipeTouchStart : undefined}
          onTouchEnd={mob ? handleSwipeTouchEnd : undefined}
          style={{
            flex: 1,
            minHeight: 0,
            width: "100%",
            overflowY: "auto",
            background: contentBg ?? LAYOUT.contentAreaBg,
            WebkitOverflowScrolling: "touch",
            paddingTop: 0,
            paddingLeft: contentPadLeft,
            paddingRight: contentPadRight,
            paddingBottom: contentPadBottom,
            fontFamily: contentFontFamily ?? "var(--font-sans)",
            fontSize: mob ? 14 : 15,
            lineHeight: 1.55,
          }}
        >
          <div style={{ marginTop: contentMarginTop }}>{children}</div>
        </div>
        </div>
      </main>
    </div>
    </UnifiedLayoutDepthContext.Provider>
  );
}
