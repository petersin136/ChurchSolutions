"use client";

import { useState, useEffect, useMemo, useRef, type ReactNode, type ComponentType, type TouchEvent } from "react";
import { Home, type LucideIcon } from "lucide-react";

/** 사이드바 메뉴 아이콘 (LucideIcon, ComponentType<any> 등 모두 허용) */
export type NavItemIcon = ComponentType<any>;

/* ---------- 레이아웃 토큰 (심방·상담 등 서브페이지와 맞춤) ---------- */
const LAYOUT = {
  sidebarWidth: 260,
  sidebarWidthCollapsed: 64,
  sidebarBg: "#f0f2fa",
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
  mainBg: "transparent",
  contentAreaBg: "#f0f1fa",
  headerTitleFontSize: 24,
  headerTitleFontSizeMob: 18,
  headerDescFontSize: 14,
  headerTitleColor: "#1F2937",
  headerDescColor: "#9CA3AF",
  border: "#e8e9f0",
  textMuted: "#6b7280",
} as const;

const DEFAULT_SIDEBAR_ACCENT = "#2563eb";

/** 모바일: 상단 헤더 + 탭 바 높이 고정(탭 전환 시 콘텐츠 점프 방지) */
const MOB_TOP_HEADER_H = 48;
const MOB_TOP_TABS_H = 40;

/** 사이드바 상단(교회명/날짜) — 모바일·데스크톱 동일 */
const SIDEBAR_HEADER_FIXED = {
  padding: "24px 20px 16px 20px",
  borderBottom: "1px solid #dde2f0",
  titleFontSize: 18,
  titleFontWeight: 700,
  titleLetterSpacing: -0.5,
  subtitleFontSize: 14,
} as const;

/** 사이드바 메뉴 리스트 영역 */
const SIDEBAR_NAV_AREA = {
  padding: "8px 10px 12px 10px",
} as const;

/** 사이드바 메뉴 항목 — 페이지·뷰포트와 무관하게 동일 */
const SIDEBAR_MENU_ITEM = {
  fontSize: 15,
  fontWeight: 600,
  padding: "12px 16px",
  gap: 9,
  lineHeight: "1.4",
  letterSpacing: "0",
  iconSize: 22,
  transition: "background-color 0.15s ease",
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
  /** 페이지 강조색 — 모바일 서브탭 등에 사용. 미전달 시 #2563eb */
  accentColor?: string;
  /** true면 모바일 상단 가로 서브탭 바를 숨김(재정 등 본문에서 자체 네비 사용) */
  hideMobileSubTabs?: boolean;
  /** 메인 콘텐츠 상단 여백(px) — `children` 래퍼 `marginTop`. 미지정 시 모바일 16·데스크톱 20 */
  contentTopGap?: number;
}

export function UnifiedPageLayout({
  pageTitle,
  pageSubtitle: _pageSubtitle,
  churchName,
  sidebarTitle,
  navSections,
  activeId,
  onNav,
  versionText = "v1.0",
  headerTitle,
  headerDesc,
  headerActions,
  children,
  SidebarIcon,
  accentColor,
  hideMobileSubTabs = false,
  contentTopGap,
}: UnifiedPageLayoutProps) {
  const mob = useIsMobile();
  const [sideOpen, setSideOpen] = useState(false);
  const accent = accentColor?.trim() || DEFAULT_SIDEBAR_ACCENT;

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

  const IconComp = SidebarIcon ?? Home;

  const sidebarChurchLine =
    (churchName && churchName.trim()) || (pageTitle && pageTitle.trim()) || "교회 이름";
  const sidebarDateLine = new Date().toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const sidebarContextLine = (sidebarTitle && sidebarTitle.trim()) || headerTitle;
  const sidebarExpanded = mob || sideOpen;
  const contentMarginTop = contentTopGap !== undefined ? contentTopGap : mob ? 16 : 20;
  const compactMainChrome = contentTopGap === 0;

  return (
    <div
      style={{
        fontFamily: "'Inter','Noto Sans KR',-apple-system,sans-serif",
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
        color: "#1f2937",
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
          width: mob ? LAYOUT.sidebarWidth : sideOpen ? LAYOUT.sidebarWidth : LAYOUT.sidebarWidthCollapsed,
          background: LAYOUT.sidebarBg,
          borderRight: "1px solid #dde2f0",
          color: "#1f2937",
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
              padding: "24px 20px 20px 20px",
              borderBottom: LAYOUT.sidebarHeaderBorder,
              background: "transparent",
              boxSizing: "border-box",
            }}
          >
            <div
              style={{
                fontSize: 20,
                fontWeight: 800,
                color: "#3a4670",
                letterSpacing: "-0.3px",
                lineHeight: 1.3,
                marginBottom: 4,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {sidebarChurchLine}
            </div>
            <div
              style={{
                fontSize: 15,
                fontWeight: 600,
                color: "#475569",
                marginBottom: 6,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {sidebarContextLine}
            </div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 400,
                color: "#6b7280",
              }}
            >
              {sidebarDateLine}
            </div>
          </div>
        ) : (
          <div
            style={{
              padding: "16px 10px",
              borderBottom: SIDEBAR_HEADER_FIXED.borderBottom,
              marginBottom: 8,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                width: LAYOUT.sidebarHeaderIconSize,
                height: LAYOUT.sidebarHeaderIconSize,
                borderRadius: LAYOUT.sidebarHeaderIconRadius,
                background: "#e8edff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <IconComp size={20} strokeWidth={1.5} color="#6b7280" />
            </div>
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
            <div key={sec.sectionLabel}>
              <div
                style={{
                  fontSize: LAYOUT.sidebarSectionFontSize,
                  textTransform: "uppercase",
                  color: "#a0a8be",
                  padding: LAYOUT.sidebarSectionPadding,
                  letterSpacing: "0.05em",
                  fontWeight: 600,
                }}
              >
                {sec.sectionLabel}
              </div>
              {sec.items.map((n) => {
                const isActive = activeId === n.id;
                const Icon = n.Icon;
                const navBtnStyle = {
                  display: "flex" as const,
                  alignItems: "center" as const,
                  gap: SIDEBAR_MENU_ITEM.gap,
                  padding: SIDEBAR_MENU_ITEM.padding,
                  fontSize: SIDEBAR_MENU_ITEM.fontSize,
                  fontWeight: SIDEBAR_MENU_ITEM.fontWeight,
                  lineHeight: SIDEBAR_MENU_ITEM.lineHeight,
                  letterSpacing: SIDEBAR_MENU_ITEM.letterSpacing,
                  transition: SIDEBAR_MENU_ITEM.transition,
                  borderRadius: 8,
                  border: "none",
                  borderLeft: isActive ? "2.5px solid #4466e0" : "2.5px solid transparent",
                  backgroundColor: isActive ? "rgba(68,102,224,0.04)" : "transparent",
                  color: isActive ? "#3355cc" : "#7a839e",
                  cursor: "pointer" as const,
                  fontFamily: "inherit",
                  textAlign: "left" as const,
                  whiteSpace: "nowrap" as const,
                  position: "relative" as const,
                  width: "100%",
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
                      e.currentTarget.style.backgroundColor = "rgba(68,102,224,0.03)";
                    }}
                    onMouseLeave={(e) => {
                      if (mob || isActive) return;
                      e.currentTarget.style.backgroundColor = "transparent";
                    }}
                  >
                    <Icon
                      size={SIDEBAR_MENU_ITEM.iconSize}
                      strokeWidth={1.5}
                      color={isActive ? "#4466e0" : "#9ba3b8"}
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
                          background: "#ef4444",
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
            padding: LAYOUT.sidebarFooterPadding,
            borderTop: LAYOUT.sidebarHeaderBorder,
            fontSize: LAYOUT.sidebarFooterFontSize,
            color: "#9ca3af",
            textAlign: "center",
          }}
        >
          {versionText}
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
                      background: "#fff",
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
                      background: "#ffffff",
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
                  background: "#eaedf7",
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
                  fontSize: mob ? 16 : 20,
                  fontWeight: 700,
                  letterSpacing: mob ? -0.3 : -0.5,
                  color: mob ? "#1f2937" : LAYOUT.headerTitleColor,
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
                    fontSize: mob ? 11 : 14,
                    color: mob ? "#999" : "#6b7280",
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
              background: "#ffffff",
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
                      color: isActive ? accent : "#6b7280",
                      background: "none",
                      border: "none",
                      borderBottom: isActive ? `2px solid ${accent}` : "2px solid transparent",
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
            background: LAYOUT.contentAreaBg,
            WebkitOverflowScrolling: "touch",
            paddingTop: 0,
            paddingLeft: mob ? LAYOUT.mainContentPaddingMob : LAYOUT.mainContentPadding,
            paddingRight: mob ? LAYOUT.mainContentPaddingMob : LAYOUT.mainContentPadding,
            paddingBottom: 120,
            fontSize: mob ? 14 : 15,
            lineHeight: 1.55,
          }}
        >
          <div style={{ marginTop: contentMarginTop }}>{children}</div>
        </div>
        </div>
      </main>
    </div>
  );
}
