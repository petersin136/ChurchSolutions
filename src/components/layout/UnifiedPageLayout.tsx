"use client";

import { useState, useEffect, type ReactNode, type ComponentType } from "react";
import { Home, type LucideIcon } from "lucide-react";

/** 사이드바 메뉴 아이콘 (LucideIcon, ComponentType<any> 등 모두 허용) */
export type NavItemIcon = ComponentType<any>;

/* ---------- Visit 탭과 동일한 픽셀/색상 (VisitCounselPage.tsx 수정 금지) ---------- */
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
  sidebarSectionFontSize: 11,
  sidebarItemPadding: "10px 12px",
  sidebarItemGap: 12,
  sidebarItemFontSize: 14,
  sidebarItemIconSize: 20,
  sidebarFooterPadding: "16px 20px",
  sidebarFooterFontSize: 12,
  mainHeaderHeight: 64,
  mainHeaderHeightMob: 52,
  mainHeaderPadding: "0 28px",
  mainHeaderPaddingMob: "0 12px",
  mainContentPadding: 24,
  mainContentPaddingMob: 12,
  mainBg: "#f8f7f4",
  headerTitleFontSize: 20,
  headerTitleFontSizeMob: 16,
  headerDescFontSize: 13,
  border: "#e5e7eb",
  textMuted: "#6b7280",
} as const;

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
}: UnifiedPageLayoutProps) {
  const mob = useIsMobile();
  const [sideOpen, setSideOpen] = useState(false);

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
        color: "#1f2937",
        minHeight: "calc(100vh - 56px)",
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
          background: LAYOUT.sidebarBg,
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
            padding: LAYOUT.sidebarHeaderPadding,
            borderBottom: LAYOUT.sidebarHeaderBorder,
            display: "flex",
            alignItems: "center",
            gap: 10,
            color: "rgba(255,255,255,0.9)",
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
                fontWeight: 700,
                fontSize: LAYOUT.sidebarHeaderTitleFontSize,
                letterSpacing: -0.5,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {pageTitle}
            </div>
            <div style={{ fontSize: LAYOUT.sidebarHeaderSubFontSize, opacity: 0.5, whiteSpace: "nowrap" }}>
              {pageSubtitle}
            </div>
          </div>
        </div>

        <nav
          style={{
            flex: 1,
            padding: LAYOUT.sidebarNavPadding,
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: 2,
          }}
        >
          {navSections.map((sec) => (
            <div key={sec.sectionLabel}>
              <div
                style={{
                  fontSize: LAYOUT.sidebarSectionFontSize,
                  textTransform: "uppercase",
                  color: "rgba(255,255,255,0.35)",
                  padding: LAYOUT.sidebarSectionPadding,
                  letterSpacing: 1,
                  fontWeight: 600,
                }}
              >
                {sec.sectionLabel}
              </div>
              {sec.items.map((n) => {
                const isActive = activeId === n.id;
                const Icon = n.Icon;
                return (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => { onNav(n.id); if (mob) setSideOpen(false); }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: LAYOUT.sidebarItemGap,
                      padding: LAYOUT.sidebarItemPadding,
                      borderRadius: 8,
                      border: "none",
                      background: isActive ? "rgba(255,255,255,0.12)" : "transparent",
                      color: isActive ? "#fff" : "rgba(255,255,255,0.5)",
                      fontWeight: isActive ? 600 : 500,
                      fontSize: LAYOUT.sidebarItemFontSize,
                      cursor: "pointer",
                      fontFamily: "inherit",
                      transition: "all 0.2s",
                      textAlign: "left",
                      whiteSpace: "nowrap",
                      position: "relative",
                      width: "100%",
                    }}
                  >
                    <Icon size={LAYOUT.sidebarItemIconSize} strokeWidth={isActive ? 2 : 1.5} style={{ flexShrink: 0 }} />
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
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          minWidth: 0,
        }}
      >
        <header
          style={{
            height: mob ? LAYOUT.mainHeaderHeightMob : LAYOUT.mainHeaderHeight,
            padding: mob ? LAYOUT.mainHeaderPaddingMob : LAYOUT.mainHeaderPadding,
            background: "rgba(255,255,255,0.85)",
            backdropFilter: "blur(20px)",
            borderBottom: `1px solid ${LAYOUT.border}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexShrink: 0,
            gap: 8,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            {mob && (
              <button
                type="button"
                onClick={() => setSideOpen(true)}
                style={{
                  width: 36,
                  height: 36,
                  border: "none",
                  background: LAYOUT.mainBg,
                  borderRadius: 8,
                  fontSize: 18,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                ☰
              </button>
            )}
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: mob ? LAYOUT.headerTitleFontSizeMob : LAYOUT.headerTitleFontSize,
                  fontWeight: 700,
                  letterSpacing: -0.5,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {headerTitle}
              </div>
              {!mob && headerDesc && (
                <div style={{ fontSize: LAYOUT.headerDescFontSize, color: LAYOUT.textMuted }}>{headerDesc}</div>
              )}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>{headerActions}</div>
        </header>

        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: mob ? LAYOUT.mainContentPaddingMob : LAYOUT.mainContentPadding,
          }}
        >
          {children}
        </div>
      </main>
    </div>
  );
}
