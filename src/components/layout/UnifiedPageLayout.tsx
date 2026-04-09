"use client";

import { useState, useEffect, useMemo, useRef, type ReactNode, type ComponentType, type TouchEvent } from "react";
import { Home, type LucideIcon } from "lucide-react";

/** 사이드바 메뉴 아이콘 (LucideIcon, ComponentType<any> 등 모두 허용) */
export type NavItemIcon = ComponentType<any>;

/* ---------- 레이아웃 토큰 (심방·상담 등 서브페이지와 맞춤) ---------- */
const LAYOUT = {
  sidebarWidth: 260,
  sidebarWidthCollapsed: 64,
  sidebarBg: "#1a1f36",
  sidebarHeaderPadding: "24px 20px",
  sidebarHeaderBorder: "1px solid rgba(255,255,255,0.08)",
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
  mainBg: "#f8f9fc",
  headerTitleFontSize: 24,
  headerTitleFontSizeMob: 18,
  headerDescFontSize: 14,
  headerTitleColor: "#1F2937",
  headerDescColor: "#9CA3AF",
  border: "#e5e7eb",
  textMuted: "#6b7280",
} as const;

const DEFAULT_SIDEBAR_ACCENT = "#2563eb";

/** 모바일: 상단 헤더 + 탭 바 높이 고정(탭 전환 시 콘텐츠 점프 방지) */
const MOB_TOP_HEADER_H = 48;
const MOB_TOP_TABS_H = 40;

/** 사이드바 상단(교회명/날짜) — 모바일·데스크톱 동일 */
const SIDEBAR_HEADER_FIXED = {
  padding: "24px 20px 16px 20px",
  borderBottom: "1px solid rgba(255,255,255,0.12)",
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

function getSidebarBg(accent: string): string {
  const normalized = accent.trim().toLowerCase();
  const darkMap: Record<string, string> = {
    "#1e3a5f": "#152a4a", // 목양 - 네이비 (살짝 밝게)
    "#1b2a4a": "#152a45", // 심방·상담·재정 - #1B2A4A 통일
    "#8b6f47": "#3d2e14", // 주보 - 브라운 (따뜻한 톤 강조)
    "#166534": "#133a20", // 레거시 그린 (호환)
    "#1d4ed8": "#162c6b", // 출석 - 블루 (파랑 강조)
    "#6b7280": "#2d3039", // 설정 - 그레이 (중립)
    "#7c3aed": "#271354", // 학생 - 퍼플 (보라 강조)
    "#db2777": "#4a1030", // 메시징 - 핑크/와인 (강조)
    "#0891b2": "#0c3544", // 통계 - 청록 (틸 강조)
  };
  return darkMap[normalized] || "#1a2332";
}

function useIsMobile(bp = 768) {
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
  /** 사이드바 상단 탭 이름 */
  pageTitle: string;
  /** 사이드바 상단 부제 (또는 날짜 표시용) */
  pageSubtitle: string;
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
  /** 페이지 강조색 — 사이드바 배경 톤(`getSidebarBg`)·앱 하단 탭 등에 사용. 미전달 시 #2563eb */
  accentColor?: string;
  /** true면 모바일 상단 가로 서브탭 바를 숨김(재정 등 본문에서 자체 네비 사용) */
  hideMobileSubTabs?: boolean;
}

export function UnifiedPageLayout({
  pageTitle,
  pageSubtitle,
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
}: UnifiedPageLayoutProps) {
  const mob = useIsMobile();
  const [sideOpen, setSideOpen] = useState(false);
  const accent = accentColor?.trim() || DEFAULT_SIDEBAR_ACCENT;
  const sidebarBg = getSidebarBg(accent);

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

  return (
    <div
      style={{
        fontFamily: "'Inter','Noto Sans KR',-apple-system,sans-serif",
        background: LAYOUT.mainBg,
        display: "flex",
        width: "100%",
        height: "100vh",
        color: "#1f2937",
        overflow: "hidden",
        position: "relative",
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
          background: sidebarBg,
          color: "#fff",
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
        <div
          style={{
            padding: SIDEBAR_HEADER_FIXED.padding,
            borderBottom: SIDEBAR_HEADER_FIXED.borderBottom,
            marginBottom: mob ? 0 : 8,
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <div
            style={{
              width: LAYOUT.sidebarHeaderIconSize,
              height: LAYOUT.sidebarHeaderIconSize,
              borderRadius: LAYOUT.sidebarHeaderIconRadius,
              background: "rgba(255,255,255,0.1)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <IconComp size={20} strokeWidth={1.5} />
          </div>
          <div style={{ minWidth: 0, overflow: "hidden" }}>
            <div
              style={{
                fontWeight: SIDEBAR_HEADER_FIXED.titleFontWeight,
                fontSize: SIDEBAR_HEADER_FIXED.titleFontSize,
                letterSpacing: SIDEBAR_HEADER_FIXED.titleLetterSpacing,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                color: "#ffffff",
              }}
            >
              {pageTitle}
            </div>
            <div
              style={{
                fontSize: SIDEBAR_HEADER_FIXED.subtitleFontSize,
                whiteSpace: "nowrap",
                color: "rgba(255,255,255,0.6)",
              }}
            >
              {pageSubtitle}
            </div>
          </div>
        </div>

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
                  color: "rgba(255,255,255,0.4)",
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
                  borderLeft: isActive ? "3px solid rgba(255,255,255,0.7)" : "3px solid transparent",
                  backgroundColor: isActive ? "rgba(255,255,255,0.12)" : "transparent",
                  color: isActive ? "#ffffff" : "rgba(255,255,255,0.7)",
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
                      e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.08)";
                    }}
                    onMouseLeave={(e) => {
                      if (mob || isActive) return;
                      e.currentTarget.style.backgroundColor = "transparent";
                    }}
                  >
                    <Icon
                      size={SIDEBAR_MENU_ITEM.iconSize}
                      strokeWidth={1.5}
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
            color: "rgba(255,255,255,0.35)",
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
          width: "100%",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <header
          style={
            mob
              ? {
                  flexShrink: 0,
                  height: MOB_TOP_HEADER_H,
                  minHeight: MOB_TOP_HEADER_H,
                  maxHeight: MOB_TOP_HEADER_H,
                  padding: "12px 16px 0",
                  boxSizing: "border-box",
                  overflow: "hidden",
                  background: "#fff",
                  borderBottom: "none",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                  position: "sticky",
                  top: 0,
                  zIndex: 20,
                }
              : {
                  minHeight: LAYOUT.mainHeaderHeight,
                  padding: LAYOUT.mainHeaderPadding,
                  background: "rgba(255,255,255,0.85)",
                  backdropFilter: "blur(20px)",
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
                  background: LAYOUT.mainBg,
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
            onTouchStart={handleSwipeTouchStart}
            onTouchEnd={handleSwipeTouchEnd}
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
              position: "sticky",
              top: MOB_TOP_HEADER_H,
              zIndex: 19,
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
            width: "100%",
            overflowY: "auto",
            padding: mob ? `8px ${LAYOUT.mainContentPaddingMob}px ${LAYOUT.mainContentPaddingMob}px` : LAYOUT.mainContentPadding,
            fontSize: mob ? 14 : 15,
            lineHeight: 1.55,
          }}
        >
          {children}
        </div>
      </main>
    </div>
  );
}
