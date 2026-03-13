"use client";

import { useState, useEffect } from "react";
import type { DB } from "@/types/db";
import { BarChart3, FileText, Users, GraduationCap, Church, Settings, ScrollText, Menu } from "lucide-react";
import { SettingsPage } from "./SettingsPage";

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

const C = {
  navy: "#1a1f36",
  bg: "#f9fafb",
  card: "#fff",
  border: "#e5e7eb",
  text: "#1f2937",
  textMuted: "#6b7280",
};

type SubId =
  | "stats-dashboard"
  | "weekly-report"
  | "monthly-report"
  | "pastoral-report"
  | "school-report"
  | "church-info"
  | "dept-template"
  | "activity-log";

interface NavItem {
  id: SubId;
  label: string;
  Icon: React.ComponentType<any>;
}

const REPORT_ITEMS: NavItem[] = [
  { id: "stats-dashboard", label: "종합 대시보드", Icon: BarChart3 },
  { id: "weekly-report", label: "주간 보고서", Icon: FileText },
  { id: "monthly-report", label: "월간 보고서", Icon: FileText },
  { id: "pastoral-report", label: "목양 보고서", Icon: Users },
  { id: "school-report", label: "교회학교 보고서", Icon: GraduationCap },
];

const SETTINGS_ITEMS: NavItem[] = [
  { id: "church-info", label: "교회 정보", Icon: Church },
  { id: "dept-template", label: "부서/템플릿", Icon: Settings },
  { id: "activity-log", label: "활동 로그", Icon: ScrollText },
];

const PAGE_TITLES: Record<SubId, { title: string; desc: string }> = {
  "stats-dashboard": { title: "종합 대시보드", desc: "교회 전체 현황을 한눈에 확인하세요" },
  "weekly-report": { title: "주간 보고서", desc: "주간 사역 보고서를 확인하세요" },
  "monthly-report": { title: "월간 보고서", desc: "월간 사역 보고서를 확인하세요" },
  "pastoral-report": { title: "목양 보고서", desc: "목양 활동 보고서를 확인하세요" },
  "school-report": { title: "교회학교 보고서", desc: "교회학교 보고서를 확인하세요" },
  "church-info": { title: "교회 정보", desc: "교회 기본 정보 및 설정을 관리하세요" },
  "dept-template": { title: "부서/템플릿", desc: "부서 및 템플릿을 관리하세요" },
  "activity-log": { title: "활동 로그", desc: "시스템 활동 기록을 확인하세요" },
};

interface ReportsSettingsPageProps {
  db: DB;
  setDb: React.Dispatch<React.SetStateAction<DB>>;
  save: () => void;
  saveDb?: (d: DB) => Promise<void>;
  toast: (msg: string, type?: "ok" | "err" | "warn") => void;
}

function PlaceholderCard({ title }: { title: string }) {
  return (
    <div style={{
      background: C.card, borderRadius: 14, border: `1px solid ${C.border}`,
      padding: 48, textAlign: "center", maxWidth: 480, margin: "60px auto",
      boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
    }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>📊</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: C.text, marginBottom: 8 }}>{title}</div>
      <div style={{ fontSize: 15, color: C.textMuted }}>준비 중...</div>
    </div>
  );
}

function SidebarButton({ item, isActive, onClick }: { item: NavItem; isActive: boolean; onClick: () => void }) {
  const Icon = item.Icon;
  return (
    <button onClick={onClick} style={{
      display: "flex", alignItems: "center", gap: 12, padding: "10px 12px",
      borderRadius: 8, border: "none",
      background: isActive ? "rgba(255,255,255,0.12)" : "transparent",
      color: isActive ? "#fff" : "rgba(255,255,255,0.5)",
      fontWeight: isActive ? 600 : 500,
      fontSize: 14, cursor: "pointer", fontFamily: "inherit",
      transition: "all 0.2s", textAlign: "left", whiteSpace: "nowrap",
    }}>
      <Icon size={20} strokeWidth={isActive ? 2 : 1.5} style={{ flexShrink: 0 }} />
      <span>{item.label}</span>
    </button>
  );
}

export function ReportsSettingsPage({ db, setDb, save, saveDb, toast }: ReportsSettingsPageProps) {
  const mob = useIsMobile();
  const [activeSub, setActiveSub] = useState<SubId>("stats-dashboard");
  const [sideOpen, setSideOpen] = useState(false);

  const handleNav = (id: SubId) => {
    setActiveSub(id);
    if (mob) setSideOpen(false);
  };

  const info = PAGE_TITLES[activeSub];

  return (
    <div style={{
      fontFamily: "'Inter','Noto Sans KR',-apple-system,sans-serif",
      background: C.bg, display: "flex", color: C.text,
      minHeight: "calc(100vh - 56px)", overflow: "hidden", position: "relative",
    }}>
      {mob && sideOpen && (
        <div onClick={() => setSideOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 99 }} />
      )}

      <aside style={{
        width: 260, background: C.navy, color: "#fff",
        display: "flex", flexDirection: "column",
        transition: mob ? "transform 0.3s ease" : "width 0.25s ease",
        overflow: "hidden", flexShrink: 0, zIndex: 100,
        ...(mob
          ? { position: "fixed", top: 0, left: 0, bottom: 0, transform: sideOpen ? "translateX(0)" : "translateX(-100%)" }
          : {}),
      }}>
        <div style={{
          padding: "24px 20px", borderBottom: "1px solid rgba(255,255,255,0.08)",
          display: "flex", alignItems: "center", gap: 10, color: "rgba(255,255,255,0.9)",
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10, background: "rgba(255,255,255,0.1)",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            <BarChart3 size={20} strokeWidth={1.5} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 18, letterSpacing: -0.5, whiteSpace: "nowrap" }}>보고서 · 설정</div>
            <div style={{ fontSize: 12, opacity: 0.5, whiteSpace: "nowrap" }}>통계, 보고서, 환경설정</div>
          </div>
        </div>

        <nav style={{ flex: 1, padding: "12px 10px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 2 }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", color: "rgba(255,255,255,0.4)", padding: "16px 12px 6px", letterSpacing: 1, fontWeight: 600 }}>
            보고서
          </div>
          {REPORT_ITEMS.map(n => (
            <SidebarButton key={n.id} item={n} isActive={activeSub === n.id} onClick={() => handleNav(n.id)} />
          ))}
          <div style={{ fontSize: 11, textTransform: "uppercase", color: "rgba(255,255,255,0.4)", padding: "16px 12px 6px", letterSpacing: 1, fontWeight: 600 }}>
            설정
          </div>
          {SETTINGS_ITEMS.map(n => (
            <SidebarButton key={n.id} item={n} isActive={activeSub === n.id} onClick={() => handleNav(n.id)} />
          ))}
        </nav>

        <div style={{ padding: "16px 20px", borderTop: "1px solid rgba(255,255,255,0.08)", fontSize: 12, color: "rgba(255,255,255,0.35)", textAlign: "center" }}>
          보고서 · 설정 v1.0
        </div>
      </aside>

      <main style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>
        <header style={{
          height: mob ? 52 : 64,
          padding: mob ? "0 12px" : "0 28px",
          background: "rgba(255,255,255,0.85)", backdropFilter: "blur(20px)",
          borderBottom: `1px solid ${C.border}`,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          flexShrink: 0, gap: 8,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            {mob && (
              <button onClick={() => setSideOpen(true)} style={{
                width: 36, height: 36, border: "none", background: C.bg,
                borderRadius: 8, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}>
                <Menu size={18} />
              </button>
            )}
            <div style={{ minWidth: 0 }}>
              <div style={{
                fontSize: mob ? 16 : 20, fontWeight: 700, letterSpacing: -0.5,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                {info.title}
              </div>
              {!mob && <div style={{ fontSize: 13, color: C.textMuted }}>{info.desc}</div>}
            </div>
          </div>
        </header>

        <div style={{ flex: 1, overflowY: "auto", padding: mob ? 12 : 24 }}>
          {activeSub === "church-info" && (
            <SettingsPage db={db} setDb={setDb} save={save} saveDb={saveDb} toast={toast} />
          )}
          {activeSub !== "church-info" && (
            <PlaceholderCard title={info.title} />
          )}
        </div>
      </main>
    </div>
  );
}
