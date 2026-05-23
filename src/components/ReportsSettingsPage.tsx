"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback, useContext } from "react";
import type { DB, Attendance, Income, Expense, Settings, Member } from "@/types/db";
import { DEFAULT_DB } from "@/types/db";
import { useAppData } from "@/contexts/AppDataContext";
import { useTheme, type ThemeColor } from "@/contexts/ThemeContext";
import { getChurchId } from "@/lib/tenant";
import { StatisticsDashboard } from "@/components/statistics/StatisticsDashboard";
import { WeeklyReport } from "@/components/reports/WeeklyReport";
import { MonthlyReport } from "@/components/reports/MonthlyReport";
import { SeniorPastorReport } from "@/components/reports/SeniorPastorReport";
import { DepartmentReport } from "@/components/reports/DepartmentReport";
import { VisitPlanReport } from "@/components/reports/VisitPlanReport";
import { UpcomingEvents } from "@/components/reports/UpcomingEvents";
import { UnifiedPageLayout } from "@/components/layout/UnifiedPageLayout";
import { BarChart3, Banknote, Bell, Building2, CalendarDays, CalendarRange, ChevronRight, ClipboardList, Database, FileBarChart, FileText, Home, LayoutDashboard, MessageCircle, Moon, Palette, Receipt, Sprout, UserCheck, UserX, Users, Wallet } from "lucide-react";
import { PcButton, PcCard, PcInput, PcSegmented, PcTabs } from "@/components/ui";
import { CalendarDropdown } from "@/components/CalendarDropdown";
import { ModernSelect } from "@/components/common/ModernSelect";
import { getSundayForWeekNum, saveSettingsToSupabase } from "@/lib/store";
import settingsStyles from "./ReportsSettingsPage.module.css";
import reportItemStyles from "./ReportItemCard.module.css";

const NAVY = "var(--color-primary)";
const MUTED = "#6b7b9e";
const SUB = "#999";
const TEXT = "#555";
const WHITE = "#fff";
const BORDER = "#e2e5ef";
const BG_SUMMARY = "#f8f9fb";
const BAR_TRACK = "#f0f2f5";
const ROW_ALT = "#fafbfc";
const FOOT_MUTED = "#bbb";

/** 보고서 상세 필터: CalendarDropdown 트리거(앱 기존 캘린더 모달과 동일 컴포넌트) */
const reportFilterDateTrigger: React.CSSProperties = {
  height: 32,
  minHeight: 32,
  maxHeight: 32,
  fontSize: 11,
  borderRadius: 6,
  border: `1px solid ${BORDER}`,
  padding: "0 6px",
  boxSizing: "border-box",
};

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

function fmtLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

type ReportId =
  | "p_member_list"
  | "p_attendance"
  | "p_absentee"
  | "p_new_family"
  | "p_mokjang"
  | "v_visit"
  | "v_counsel"
  | "f_offering"
  | "f_expense"
  | "x_dashboard"
  | "x_weekly"
  | "x_monthly"
  | "x_senior"
  | "x_dept"
  | "x_visit_plan"
  | "x_upcoming";

interface ReportCardDef {
  id: ReportId;
  title: string;
  desc: string;
  initial: string;
}

const REPORT_GROUPS: { category: string; items: ReportCardDef[] }[] = [
  {
    category: "목양",
    items: [
      { id: "p_member_list", title: "성도 명단", desc: "전체 성도 목록 (이름, 연락처, 부서, 상태)", initial: "목" },
      { id: "p_attendance", title: "출석 통계 보고서", desc: "기간별 출석률, 부서별 출석 현황", initial: "목" },
      { id: "p_absentee", title: "결석자 보고서", desc: "연속 결석자 명단 및 관리 현황", initial: "목" },
      { id: "p_new_family", title: "새가족 정착 보고서", desc: "새가족 정착 프로그램 진행 현황", initial: "목" },
      { id: "p_mokjang", title: "목장 현황 보고서", desc: "목장별 인원 및 출석 현황", initial: "목" },
    ],
  },
  {
    category: "심방·상담",
    items: [
      { id: "v_visit", title: "심방 기록 보고서", desc: "기간별 심방 내역 및 통계", initial: "심" },
      { id: "v_counsel", title: "상담 기록 보고서", desc: "기간별 상담 내역 및 통계", initial: "상" },
    ],
  },
  {
    category: "재정",
    items: [
      { id: "f_offering", title: "헌금 보고서", desc: "기간별 헌금 내역 및 통계", initial: "재" },
      { id: "f_expense", title: "지출 보고서", desc: "기간별 지출 내역 및 통계", initial: "재" },
    ],
  },
  {
    category: "통계·서식",
    items: [
      { id: "x_dashboard", title: "종합 대시보드", desc: "교인·출결·재정·심방 통합", initial: "통" },
      { id: "x_weekly", title: "주간 보고서", desc: "주간 사역 보고서", initial: "통" },
      { id: "x_monthly", title: "월간 보고서", desc: "월간 사역 보고서", initial: "통" },
      { id: "x_senior", title: "담임목사 보고서", desc: "담임목사용 종합 보고서", initial: "통" },
      { id: "x_dept", title: "부서별 보고서", desc: "부서별 현황", initial: "통" },
      { id: "x_visit_plan", title: "심방 계획서", desc: "심방·업무 계획", initial: "통" },
      { id: "x_upcoming", title: "경조사 알림", desc: "다가오는 경조사", initial: "통" },
    ],
  },
];

const DB_STATUS_TO_UI: Record<string, Attendance["status"]> = {
  p: "출석",
  o: "온라인",
  a: "결석",
  l: "병결",
  n: "기타",
};

interface ReportsSettingsPageProps {
  db: DB;
  setDb: React.Dispatch<React.SetStateAction<DB>>;
  save: () => void;
  saveDb?: (d: DB) => Promise<void>;
  toast: (msg: string, type?: "ok" | "err" | "warn") => void;
  mode?: "both" | "reports" | "settings";
}

function DataBackupPanel({
  db,
  setDb,
  save,
  saveDb,
  toast,
}: ReportsSettingsPageProps) {
  const mob = useIsMobile();
  const importRef = useRef<HTMLInputElement>(null);
  const [resetLoading, setResetLoading] = useState(false);

  const exportBackup = useCallback(() => {
    const json = JSON.stringify(db);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `superplanner_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast("백업 파일이 다운로드되었습니다", "ok");
  }, [db, toast]);

  const importBackup = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = JSON.parse(reader.result as string) as Partial<DB>;
          const merged = { ...db, ...parsed };
          setDb(() => merged);
          if (saveDb) saveDb(merged).then(() => toast("복원 완료", "ok")).catch(() => toast("저장 실패", "err"));
          else {
            save();
            toast("복원 완료", "ok");
          }
        } catch {
          toast("잘못된 백업 파일입니다", "err");
        }
      };
      reader.readAsText(file);
      e.target.value = "";
    },
    [db, setDb, save, saveDb, toast]
  );

  const clearAllData = useCallback(async () => {
    if (typeof window === "undefined") return;
    if (!window.confirm("정말 모든 데이터를 초기화하시겠습니까?\n이 작업은 되돌릴 수 없습니다.")) return;
    try {
      setResetLoading(true);
      if (saveDb) {
        let cid: string;
        try {
          cid = getChurchId();
        } catch {
          toast("교회 정보가 없습니다. 로그인 후 다시 시도하세요.", "err");
          return;
        }
        const res = await fetch("/api/reset", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scope: "all", churchId: cid }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data?.ok) {
          throw new Error(data?.message || res.statusText || "전체 초기화 요청 실패");
        }
      }
      setDb({ ...DEFAULT_DB });
      save();
      toast("전체 초기화 완료", "warn");
      window.location.reload();
    } catch (err) {
      console.error("전체 초기화 오류:", err);
      alert("초기화 중 오류가 발생했습니다.\n" + (err instanceof Error ? err.message : String(err)));
    } finally {
      setResetLoading(false);
    }
  }, [setDb, save, saveDb, toast]);

  return (
    <PcCard padding="lg" elevation="sm" className={settingsStyles.settingCard}>
      <div className={settingsStyles.settingsCardHead}>
        <div className={settingsStyles.settingsIconBox}>
          <Database size={24} aria-hidden />
        </div>
        <div className={settingsStyles.settingsHeadText}>
          <h3 className={settingsStyles.settingsHeadTitle}>데이터</h3>
          <p className={settingsStyles.settingsHeadDesc}>백업·복원·초기화를 관리합니다.</p>
        </div>
      </div>
      <hr className={settingsStyles.settingsDivider} />
      <div className={settingsStyles.settingsHint}>
        백업·복원·초기화는 전체 교회 데이터에 적용됩니다. 초기화 전 반드시 백업하세요.
      </div>
      <div className={settingsStyles.backupButtons}>
        <PcButton type="button" variant="secondary" fullWidth onClick={exportBackup}>
          데이터 백업
        </PcButton>
        <PcButton type="button" variant="secondary" fullWidth onClick={() => importRef.current?.click()}>
          데이터 복원
        </PcButton>
        <input ref={importRef} type="file" accept=".json,application/json" style={{ display: "none" }} onChange={importBackup} />
        <PcButton type="button" variant="danger" fullWidth onClick={clearAllData} disabled={resetLoading}>
          {resetLoading ? "처리 중…" : "전체 초기화"}
        </PcButton>
      </div>
    </PcCard>
  );
}

const THEME_OPTIONS: { id: ThemeColor; label: string; color: string }[] = [
  { id: "orange", label: "오렌지", color: "#E76F51" },
  { id: "blue", label: "블루", color: "#2563eb" },
  { id: "green", label: "그린", color: "#16a34a" },
  { id: "purple", label: "퍼플", color: "#7c5ce0" },
];

function ThemeSettingsCard() {
  const { theme, mode, setTheme, setMode } = useTheme();
  const dark = mode === "dark";

  return (
    <PcCard padding="lg" elevation="sm" className={settingsStyles.settingCard}>
      <div className={settingsStyles.settingsCardHead}>
        <div className={settingsStyles.settingsIconBox}>
          <Palette size={24} aria-hidden />
        </div>
        <div className={settingsStyles.settingsHeadText}>
          <h3 className={settingsStyles.settingsHeadTitle}>테마</h3>
          <p className={settingsStyles.settingsHeadDesc}>앱 전체 색상과 라이트·다크 모드를 설정합니다.</p>
        </div>
      </div>
      <hr className={settingsStyles.settingsDivider} />
      <div className={settingsStyles.settingsStack}>
        <div>
          <div className={settingsStyles.toggleLabel} style={{ marginBottom: 10 }}>테마 색상</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(96px, 1fr))", gap: 8 }}>
            {THEME_OPTIONS.map((option) => {
              const selected = theme === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setTheme(option.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    height: 40,
                    padding: "0 12px",
                    borderRadius: 10,
                    border: selected ? `2px solid ${option.color}` : "1px solid var(--color-border)",
                    background: selected ? "var(--color-primary-soft)" : "var(--color-surface)",
                    color: "var(--color-text)",
                    fontSize: 13,
                    fontWeight: selected ? 700 : 600,
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  <span style={{ width: 16, height: 16, borderRadius: "50%", background: option.color, boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.08)" }} />
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setMode(dark ? "light" : "dark")}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            width: "100%",
            minHeight: 44,
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid var(--color-border)",
            background: "var(--color-surface)",
            color: "var(--color-text)",
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 700 }}>
            <Moon size={16} aria-hidden />
            다크 모드
          </span>
          <span
            aria-hidden
            style={{
              width: 44,
              height: 24,
              padding: 2,
              borderRadius: 999,
              background: dark ? "var(--color-primary)" : "var(--color-border-strong)",
              transition: "background 0.15s",
            }}
          >
            <span
              style={{
                display: "block",
                width: 20,
                height: 20,
                borderRadius: "50%",
                background: "var(--color-primary-on)",
                transform: dark ? "translateX(20px)" : "translateX(0)",
                transition: "transform 0.15s",
              }}
            />
          </span>
        </button>
      </div>
    </PcCard>
  );
}

function ChurchInfoSettingsCard({ db, setDb, save, toast }: Pick<ReportsSettingsPageProps, "db" | "setDb" | "save" | "toast">) {
  const s = db.settings;
  const patch = (partial: Partial<Settings>) => {
    setDb((prev) => ({ ...prev, settings: { ...prev.settings, ...partial } }));
  };
  const handleSave = async () => {
    try {
      await saveSettingsToSupabase(db.settings);
      save();
      toast("교회 정보가 저장되었습니다", "ok");
    } catch (e) {
      console.error(e);
      toast("교회 정보 저장 실패: " + (e instanceof Error ? e.message : String(e)), "err");
    }
  };
  return (
    <PcCard padding="lg" elevation="sm" className={settingsStyles.settingCard}>
      <div className={settingsStyles.settingsCardHead}>
        <div className={settingsStyles.settingsIconBox}>
          <Building2 size={24} aria-hidden />
        </div>
        <div className={settingsStyles.settingsHeadText}>
          <h3 className={settingsStyles.settingsHeadTitle}>교회 정보</h3>
          <p className={settingsStyles.settingsHeadDesc}>기본 교회 메타데이터를 입력하고 저장합니다.</p>
        </div>
      </div>
      <hr className={settingsStyles.settingsDivider} />
      <div className={settingsStyles.settingsStack}>
        <PcInput size="lg" label="교회명" value={s.churchName ?? ""} onChange={(e) => patch({ churchName: e.target.value })} />
        <PcInput size="lg" label="담임목사명" value={s.pastor ?? ""} onChange={(e) => patch({ pastor: e.target.value })} />
        <PcInput size="lg" label="소재지" value={s.address ?? ""} onChange={(e) => patch({ address: e.target.value })} />
        <PcInput
          size="lg"
          label="사업자등록번호(고유번호)"
          value={s.businessNumber ?? ""}
          onChange={(e) => patch({ businessNumber: e.target.value })}
        />
        <PcInput
          size="lg"
          label="교단"
          value={s.denomination ?? ""}
          placeholder="예: 장로교, 침례교"
          onChange={(e) => patch({ denomination: e.target.value })}
        />
        <div className={settingsStyles.settingsActionsRow}>
          <PcButton type="button" variant="primary" onClick={handleSave}>
            저장
          </PcButton>
        </div>
      </div>
    </PcCard>
  );
}

function NotificationSettingsCard({ db, setDb, save }: Pick<ReportsSettingsPageProps, "db" | "setDb" | "save">) {
  const s = db.settings;
  const weeks = s.absenteeAlertConsecutiveWeeks ?? 3;
  const newFamilyOn = s.alertNewFamilyIncomplete !== false;
  const patch = (partial: Partial<Settings>) => {
    setDb((prev) => ({ ...prev, settings: { ...prev.settings, ...partial } }));
    save();
  };
  const weeksValue = Number.isFinite(weeks) ? weeks : 3;
  return (
    <PcCard padding="lg" elevation="sm" className={settingsStyles.settingCard}>
      <div className={settingsStyles.settingsCardHead}>
        <div className={settingsStyles.settingsIconBox}>
          <Bell size={24} aria-hidden />
        </div>
        <div className={settingsStyles.settingsHeadText}>
          <h3 className={settingsStyles.settingsHeadTitle}>알림 설정</h3>
          <p className={settingsStyles.settingsHeadDesc}>결석 기준과 새가족 정착 알림 토글을 설정합니다.</p>
        </div>
      </div>
      <hr className={settingsStyles.settingsDivider} />
      <div className={settingsStyles.settingsStack}>
        <PcInput
          size="lg"
          type="number"
          min={2}
          max={8}
          step={1}
          label="결석 알림 기준 (연속 주)"
          helperText="연속 결석이 이 주 수에 도달하면 알림(향후 연동) 기준으로 사용됩니다."
          value={String(weeksValue)}
          onChange={(e) => {
            const raw = Number(e.target.value);
            if (!Number.isFinite(raw)) return;
            const clamped = Math.min(8, Math.max(2, Math.round(raw)));
            patch({ absenteeAlertConsecutiveWeeks: clamped });
          }}
        />
        <div className={settingsStyles.toggleRow}>
          <span className={settingsStyles.toggleLabel}>새가족 정착 미완료 알림</span>
          <PcSegmented
            value={newFamilyOn ? "on" : "off"}
            onChange={(v) => patch({ alertNewFamilyIncomplete: v === "on" })}
            options={[
              { value: "on", label: "켜기" },
              { value: "off", label: "끄기" },
            ]}
            fullWidth
            ariaLabel="새가족 정착 미완료 알림"
          />
        </div>
      </div>
    </PcCard>
  );
}

/** ===== 보고서 시트 공통 스타일 ===== */
const RP_TBL_WRAP: React.CSSProperties = { width: "100%", borderCollapse: "collapse", fontSize: 14, color: TEXT };
const RP_TH: React.CSSProperties = {
  textAlign: "left",
  padding: "12px 12px",
  color: NAVY,
  fontWeight: 700,
  fontSize: 14,
  letterSpacing: "-0.01em",
};
const RP_TD: React.CSSProperties = { padding: "12px 12px", fontSize: 14, color: TEXT, lineHeight: 1.5 };
const RP_SECTION_TITLE: React.CSSProperties = {
  fontSize: 17,
  fontWeight: 700,
  color: NAVY,
  marginBottom: 14,
  letterSpacing: "-0.01em",
};
/** 보고서 표 한 페이지에 보일 행 수 (사이트 전체 통일) */
const RP_ROWS_PER_PAGE = 20;

/** PDF 캡처 모드 컨텍스트 — true 면 ReportSimpleTable 이 모든 행을 한 번에 렌더 */
const PdfCaptureContext = React.createContext(false);

/** 페이지네이션 바 (보고서 시트 공통) */
function ReportPagination({
  page,
  totalPages,
  totalItems,
  onChange,
}: {
  page: number;
  totalPages: number;
  totalItems: number;
  onChange: (p: number) => void;
}) {
  return (
    <div
      data-print-hide="true"
      style={{
        display: "grid",
        gridTemplateColumns: "1fr auto 1fr",
        alignItems: "center",
        gap: 12,
        padding: "14px 16px",
        background: BG_SUMMARY,
        borderTop: `1px solid ${BORDER}`,
        borderLeft: `1px solid ${BORDER}`,
        borderRight: `1px solid ${BORDER}`,
        borderBottomLeftRadius: 8,
        borderBottomRightRadius: 8,
      }}
    >
      {/* left: 총 N건 */}
      <div style={{ fontSize: 13, color: SUB, fontVariantNumeric: "tabular-nums", textAlign: "left", minWidth: 0 }}>
        총 <b style={{ color: NAVY, fontWeight: 700 }}>{totalItems.toLocaleString()}</b>건
      </div>
      {/* center: 페이지네이션 컨트롤 */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, justifySelf: "center" }}>
        <button
          type="button"
          onClick={() => onChange(Math.max(1, page - 1))}
          disabled={page <= 1}
          style={{
            height: 32,
            padding: "0 12px",
            fontSize: 13,
            borderRadius: 6,
            border: `1px solid ${BORDER}`,
            background: WHITE,
            color: page <= 1 ? FOOT_MUTED : TEXT,
            cursor: page <= 1 ? "not-allowed" : "pointer",
            fontFamily: "inherit",
            fontWeight: 500,
          }}
        >
          이전
        </button>
        <span style={{ fontSize: 13, color: TEXT, fontVariantNumeric: "tabular-nums", minWidth: 64, textAlign: "center" }}>
          <b style={{ color: NAVY, fontWeight: 700 }}>{page}</b> / {totalPages}
        </span>
        <button
          type="button"
          onClick={() => onChange(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
          style={{
            height: 32,
            padding: "0 12px",
            fontSize: 13,
            borderRadius: 6,
            border: `1px solid ${BORDER}`,
            background: WHITE,
            color: page >= totalPages ? FOOT_MUTED : TEXT,
            cursor: page >= totalPages ? "not-allowed" : "pointer",
            fontFamily: "inherit",
            fontWeight: 500,
          }}
        >
          다음
        </button>
      </div>
      {/* right: 빈 셀 (중앙 정렬 균형용) */}
      <div aria-hidden />
    </div>
  );
}

function ReportSimpleTable({
  headers,
  rows,
  align,
  paginated = true,
  rowsPerPage = RP_ROWS_PER_PAGE,
  showIndex = false,
}: {
  headers: string[];
  rows: React.ReactNode[][];
  align?: ("left" | "right")[];
  paginated?: boolean;
  rowsPerPage?: number;
  showIndex?: boolean;
}) {
  const [page, setPage] = useState(1);
  const isPdfCapture = useContext(PdfCaptureContext);
  const totalItems = rows.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / rowsPerPage));
  const safePage = Math.min(page, totalPages);
  useEffect(() => {
    if (safePage !== page) setPage(safePage);
  }, [safePage, page]);
  // PDF 캡처 모드 — 모든 행 한 번에 렌더 (페이지네이션 무시, 인덱스 1부터)
  const effectivePaginated = paginated && !isPdfCapture;
  const startIdx = effectivePaginated ? (safePage - 1) * rowsPerPage : 0;
  const visible = effectivePaginated ? rows.slice(startIdx, startIdx + rowsPerPage) : rows;
  const emptyRows = effectivePaginated ? Math.max(0, rowsPerPage - visible.length) : 0;
  const effHeaders = showIndex ? ["#", ...headers] : headers;
  const effAlign = showIndex ? (["right" as const, ...((align ?? []) as ("left" | "right")[])]) : align;
  return (
    <div
      style={{
        border: paginated ? `1px solid ${BORDER}` : "none",
        borderRadius: paginated ? 8 : 0,
        overflow: "hidden",
      }}
    >
      <table style={RP_TBL_WRAP}>
        <thead style={{ background: BG_SUMMARY }}>
          <tr style={{ borderBottom: `2px solid ${NAVY}` }}>
            {effHeaders.map((h, j) => (
              <th
                key={`${h}-${j}`}
                style={{
                  ...RP_TH,
                  textAlign: effAlign?.[j] ?? "left",
                  width: showIndex && j === 0 ? 56 : undefined,
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visible.length === 0 && emptyRows === 0 ? (
            <tr>
              <td
                colSpan={effHeaders.length}
                style={{ ...RP_TD, color: SUB, textAlign: "center", padding: "48px 12px" }}
              >
                데이터가 없습니다
              </td>
            </tr>
          ) : (
            <>
              {visible.map((row, i) => {
                const globalIdx = startIdx + i;
                return (
                  <tr
                    key={`r-${globalIdx}`}
                    style={{
                      borderBottom: `1px solid ${BAR_TRACK}`,
                      background: i % 2 === 0 ? WHITE : ROW_ALT,
                    }}
                  >
                    {showIndex && (
                      <td style={{ ...RP_TD, textAlign: "right", color: SUB, fontVariantNumeric: "tabular-nums" }}>
                        {globalIdx + 1}
                      </td>
                    )}
                    {row.map((c, j) => (
                      <td key={j} style={{ ...RP_TD, textAlign: align?.[j] ?? "left" }}>
                        {c ?? "-"}
                      </td>
                    ))}
                  </tr>
                );
              })}
              {/* 빈행으로 표 높이 고정 */}
              {Array.from({ length: emptyRows }).map((_, k) => (
                <tr
                  key={`e-${k}`}
                  style={{
                    borderBottom: `1px solid ${BAR_TRACK}`,
                    background: (visible.length + k) % 2 === 0 ? WHITE : ROW_ALT,
                  }}
                  aria-hidden
                >
                  {effHeaders.map((_h, j) => (
                    <td key={j} style={{ ...RP_TD, color: "transparent" }}>
                      &nbsp;
                    </td>
                  ))}
                </tr>
              ))}
            </>
          )}
        </tbody>
      </table>
      {paginated && totalItems > 0 && (
        <ReportPagination page={safePage} totalPages={totalPages} totalItems={totalItems} onChange={setPage} />
      )}
    </div>
  );
}

function ReportPrintHeader({
  churchName,
  reportTitle,
  startDate,
  endDate,
}: {
  churchName: string;
  reportTitle: string;
  startDate: string;
  endDate: string;
}) {
  const created = new Date().toLocaleDateString("ko-KR");
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        borderBottom: `2px solid ${NAVY}`,
        paddingBottom: 16,
        marginBottom: 24,
      }}
    >
      <div>
        <div style={{ fontSize: 14, color: SUB, letterSpacing: "-0.01em" }}>{churchName.trim() || "교회명"}</div>
        <div style={{ fontSize: 26, fontWeight: 800, color: NAVY, marginTop: 6, letterSpacing: "-0.02em" }}>{reportTitle}</div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={{ fontSize: 14, color: SUB, fontWeight: 500 }}>
          {startDate} ~ {endDate}
        </div>
        <div style={{ fontSize: 12, color: FOOT_MUTED, marginTop: 4 }}>생성일: {created}</div>
      </div>
    </div>
  );
}

function ReportPrintFooter({ churchName }: { churchName: string }) {
  const d = new Date().toLocaleDateString("ko-KR");
  const name = churchName.trim() || "교회";
  return (
    <div
      style={{
        borderTop: `1px solid ${BORDER}`,
        paddingTop: 14,
        marginTop: 28,
        textAlign: "center",
        fontSize: 12,
        color: FOOT_MUTED,
      }}
    >
      {name} · 보고서 자동 생성 · {d}
    </div>
  );
}

function MemberListPrintBody({
  members,
  totalMembers,
  activeMembers,
  newFamilyCount,
  riskCount,
  departments,
}: {
  members: Member[];
  totalMembers: number;
  activeMembers: number;
  newFamilyCount: number;
  riskCount: number;
  departments: { name: string; count: number; barPct: number; sharePct: number }[];
}) {
  const card: React.CSSProperties = {
    padding: "18px 20px",
    borderRadius: 10,
    background: BG_SUMMARY,
    border: `1px solid ${BORDER}`,
  };
  const th: React.CSSProperties = {
    padding: "12px 12px",
    textAlign: "left",
    fontWeight: 700,
    color: NAVY,
    fontSize: 14,
    letterSpacing: "-0.01em",
  };
  const td: React.CSSProperties = {
    padding: "12px 12px",
    fontSize: 14,
    color: TEXT,
    lineHeight: 1.5,
  };
  return (
    <>
      <div data-pdf-break style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 24 }}>
        <div style={card}>
          <div style={{ fontSize: 13, color: MUTED, fontWeight: 500 }}>전체 성도</div>
          <div style={{ fontSize: 32, fontWeight: 800, color: NAVY, marginTop: 6, letterSpacing: "-0.02em" }}>{totalMembers}명</div>
        </div>
        <div style={card}>
          <div style={{ fontSize: 13, color: MUTED, fontWeight: 500 }}>활동 성도</div>
          <div style={{ fontSize: 32, fontWeight: 800, color: NAVY, marginTop: 6, letterSpacing: "-0.02em" }}>{activeMembers}명</div>
        </div>
        <div style={card}>
          <div style={{ fontSize: 13, color: MUTED, fontWeight: 500 }}>새가족</div>
          <div style={{ fontSize: 32, fontWeight: 800, color: NAVY, marginTop: 6, letterSpacing: "-0.02em" }}>{newFamilyCount}명</div>
        </div>
        <div style={card}>
          <div style={{ fontSize: 13, color: MUTED, fontWeight: 500 }}>휴면·위험</div>
          <div style={{ fontSize: 32, fontWeight: 800, color: NAVY, marginTop: 6, letterSpacing: "-0.02em" }}>{riskCount}명</div>
        </div>
      </div>

      <div data-pdf-break style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 17, fontWeight: 700, color: NAVY, marginBottom: 14, letterSpacing: "-0.01em" }}>부서별 현황</div>
        {departments.length === 0 ? (
          <div style={{ fontSize: 14, color: SUB }}>데이터 없음</div>
        ) : (
          departments.map((dept) => (
            <div key={dept.name} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
              <div style={{ width: 110, fontSize: 14, color: TEXT, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 500 }} title={dept.name}>
                {dept.name}
              </div>
              <div
                style={{
                  flex: 1,
                  height: 22,
                  background: BAR_TRACK,
                  borderRadius: 6,
                  overflow: "hidden",
                  minWidth: 40,
                }}
              >
                <div
                  style={{
                    width: `${dept.barPct}%`,
                    height: "100%",
                    background: NAVY,
                    borderRadius: 6,
                  }}
                />
              </div>
              <div style={{ width: 110, fontSize: 14, color: TEXT, textAlign: "right", flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>
                {dept.count}명 ({dept.sharePct}%)
              </div>
            </div>
          ))
        )}
      </div>

      <div data-pdf-break style={{ marginBottom: 16 }}>
        <div style={RP_SECTION_TITLE}>상세 명단</div>
        <ReportSimpleTable
          showIndex
          headers={["이름", "부서", "직분", "연락처", "상태"]}
          rows={members.map((m) => [
            <span key="n" style={{ color: NAVY, fontWeight: 600 }}>{m.name}</span>,
            m.dept || "-",
            m.role || "-",
            <span key="p" style={{ fontVariantNumeric: "tabular-nums" }}>{m.phone || "-"}</span>,
            m.member_status ?? m.status ?? "-",
          ])}
        />
      </div>
    </>
  );
}

/** 출석 통계 보고서 — 다른 시트와 동일한 톤 */
function AttendancePrintBody({
  members,
  attendanceList,
  startDate,
  endDate,
}: {
  members: Member[];
  attendanceList: Attendance[];
  startDate: string;
  endDate: string;
}) {
  const inRange = (d: string) => d >= startDate && d <= endDate;
  const filtered = attendanceList.filter((a) => inRange(a.date));
  const memberIdSet = new Set(members.map((m) => m.id));
  const byMember = new Map<string, { present: number; online: number; absent: number; weeks: Set<string> }>();
  // 모든 활동 멤버 0 초기화
  members.forEach((m) => {
    byMember.set(m.id, { present: 0, online: 0, absent: 0, weeks: new Set<string>() });
  });
  // 기간 내 주차 집합 (전체 기준)
  const allWeeks = new Set<string>();
  filtered.forEach((a) => {
    allWeeks.add(a.date);
    if (!memberIdSet.has(a.member_id)) return;
    const slot = byMember.get(a.member_id)!;
    slot.weeks.add(a.date);
    if (a.status === "출석") slot.present += 1;
    else if (a.status === "온라인") slot.online += 1;
    else if (a.status === "결석") slot.absent += 1;
  });
  const totalWeekCount = allWeeks.size || 1;
  const rows = members.map((m) => {
    const s = byMember.get(m.id) || { present: 0, online: 0, absent: 0, weeks: new Set<string>() };
    const attended = s.present + s.online;
    const rate = totalWeekCount ? Math.round((attended / totalWeekCount) * 100) : 0;
    return { m, attended, absent: s.absent, total: totalWeekCount, rate };
  });
  rows.sort((a, b) => b.rate - a.rate || a.m.name.localeCompare(b.m.name, "ko"));
  const totalAttended = rows.reduce((s, r) => s + r.attended, 0);
  const totalAbsent = rows.reduce((s, r) => s + r.absent, 0);
  const avgRate = rows.length
    ? Math.round(rows.reduce((s, r) => s + r.rate, 0) / rows.length)
    : 0;
  // 부서별 평균 출석률
  const deptMap = new Map<string, { sum: number; count: number }>();
  rows.forEach((r) => {
    const d = (r.m.dept || "(미배정)").trim() || "(미배정)";
    const cur = deptMap.get(d) || { sum: 0, count: 0 };
    cur.sum += r.rate;
    cur.count += 1;
    deptMap.set(d, cur);
  });
  const deptStats = Array.from(deptMap.entries())
    .map(([name, v]) => ({ name, avg: Math.round(v.sum / Math.max(1, v.count)), n: v.count }))
    .sort((a, b) => b.n - a.n);
  const maxDeptN = Math.max(...deptStats.map((d) => d.n), 1);

  const card: React.CSSProperties = {
    padding: "18px 20px",
    borderRadius: 10,
    background: BG_SUMMARY,
    border: `1px solid ${BORDER}`,
  };
  return (
    <>
      <div data-pdf-break style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
        <div style={card}>
          <div style={{ fontSize: 13, color: MUTED, fontWeight: 500 }}>대상 인원</div>
          <div style={{ fontSize: 32, fontWeight: 800, color: NAVY, marginTop: 6, letterSpacing: "-0.02em" }}>
            {members.length}명
          </div>
          <div style={{ fontSize: 12, color: SUB, marginTop: 4 }}>활동 성도</div>
        </div>
        <div style={card}>
          <div style={{ fontSize: 13, color: MUTED, fontWeight: 500 }}>평균 출석률</div>
          <div style={{ fontSize: 32, fontWeight: 800, color: NAVY, marginTop: 6, letterSpacing: "-0.02em" }}>
            {avgRate}%
          </div>
          <div style={{ fontSize: 12, color: SUB, marginTop: 4 }}>주일 {totalWeekCount}회</div>
        </div>
        <div style={card}>
          <div style={{ fontSize: 13, color: MUTED, fontWeight: 500 }}>누적 출석</div>
          <div style={{ fontSize: 32, fontWeight: 800, color: NAVY, marginTop: 6, letterSpacing: "-0.02em" }}>
            {totalAttended.toLocaleString()}
          </div>
          <div style={{ fontSize: 12, color: SUB, marginTop: 4 }}>기간 합계</div>
        </div>
        <div style={card}>
          <div style={{ fontSize: 13, color: MUTED, fontWeight: 500 }}>누적 결석</div>
          <div style={{ fontSize: 32, fontWeight: 800, color: NAVY, marginTop: 6, letterSpacing: "-0.02em" }}>
            {totalAbsent.toLocaleString()}
          </div>
          <div style={{ fontSize: 12, color: SUB, marginTop: 4 }}>기간 합계</div>
        </div>
      </div>

      <div data-pdf-break style={{ marginBottom: 28 }}>
        <div style={RP_SECTION_TITLE}>부서별 평균 출석률</div>
        {deptStats.length === 0 ? (
          <div style={{ fontSize: 14, color: SUB }}>데이터 없음</div>
        ) : (
          deptStats.map((d) => (
            <div key={d.name} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
              <div style={{ width: 110, fontSize: 14, color: TEXT, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 500 }}>
                {d.name}
              </div>
              <div
                style={{
                  flex: 1,
                  height: 22,
                  background: BAR_TRACK,
                  borderRadius: 6,
                  overflow: "hidden",
                  minWidth: 40,
                  position: "relative",
                }}
              >
                <div
                  style={{
                    width: `${d.avg}%`,
                    height: "100%",
                    background: NAVY,
                    borderRadius: 6,
                  }}
                />
              </div>
              <div style={{ width: 140, fontSize: 14, color: TEXT, textAlign: "right", flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>
                {d.avg}% · {d.n}명
              </div>
            </div>
          ))
        )}
      </div>

      <div data-pdf-break style={{ marginBottom: 16 }}>
        <div style={RP_SECTION_TITLE}>성도별 출석 현황</div>
        <ReportSimpleTable
          showIndex
          headers={["이름", "부서", "목장", "총주일수", "출석", "결석", "출석률"]}
          align={["left", "left", "left", "right", "right", "right", "right"]}
          rows={rows.map(({ m, attended, absent, total, rate }) => [
            <span key="n" style={{ color: NAVY, fontWeight: 600 }}>{m.name}</span>,
            m.dept || "-",
            (m.mokjang || m.group || "-") as string,
            <span key="t" style={{ fontVariantNumeric: "tabular-nums" }}>{total}</span>,
            <span key="a" style={{ fontVariantNumeric: "tabular-nums" }}>{attended}</span>,
            <span key="x" style={{ fontVariantNumeric: "tabular-nums" }}>{absent}</span>,
            <span
              key="r"
              style={{
                fontVariantNumeric: "tabular-nums",
                fontWeight: 700,
                color: rate >= 80 ? "#1b7a36" : rate >= 50 ? NAVY : "#a83232",
              }}
            >
              {rate}%
            </span>,
          ])}
        />
      </div>
    </>
  );
}

export function ReportsSettingsPage(props: ReportsSettingsPageProps) {
  const { db, setDb, save, saveDb, toast, mode = "both" } = props;
  const mob = useIsMobile();
  const { rawAttendance } = useAppData();
  const navSections = useMemo(() => {
    if (mode === "reports") {
      return [
        {
          sectionLabel: "보고서",
          items: [{ id: "reports", label: "보고서", Icon: () => null }],
        },
      ];
    }
    if (mode === "settings") {
      return [
        {
          sectionLabel: "설정",
          items: [{ id: "settings", label: "설정", Icon: () => null }],
        },
      ];
    }
    return [
      {
        sectionLabel: "보고서 · 설정",
        items: [{ id: "reports-settings", label: "보고서 · 설정", Icon: () => null }],
      },
    ];
  }, [mode]);

  const [selectedReport, setSelectedReport] = useState<ReportCardDef | null>(null);
  const [activeReportCategory, setActiveReportCategory] = useState("목양");
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [pdfBusy, setPdfBusy] = useState<"idle" | "preview" | "download">("idle");
  /** PDF 캡처 중에만 true — ReportSimpleTable 들이 모든 행을 한 번에 렌더하도록 */
  const [pdfCaptureMode, setPdfCaptureMode] = useState(false);

  // 미리보기 URL 정리
  useEffect(() => {
    return () => {
      if (pdfPreviewUrl) URL.revokeObjectURL(pdfPreviewUrl);
    };
  }, [pdfPreviewUrl]);

  // ESC 키로 PDF 미리보기 모달 닫기
  useEffect(() => {
    if (!pdfPreviewUrl) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        URL.revokeObjectURL(pdfPreviewUrl);
        setPdfPreviewUrl(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pdfPreviewUrl]);

  // 보고서 상세 진입 시 history entry 추가 → 브라우저 뒤로가기/제스처로도 목록으로 복귀
  const reportNavStateRef = useRef<string | null>(null);
  const selectReport = useCallback((r: ReportCardDef | null) => {
    setSelectedReport((prev) => {
      if (typeof window !== "undefined") {
        if (r && !prev) {
          // 상세 진입 — history 에 marker push
          const marker = `report-detail-${Date.now()}`;
          reportNavStateRef.current = marker;
          try { window.history.pushState({ __reportDetail: marker }, ""); } catch {}
        } else if (!r && prev && reportNavStateRef.current) {
          // UI '뒤로' 버튼으로 목록 복귀 — history entry 도 정리
          try {
            if ((window.history.state as { __reportDetail?: string } | null)?.__reportDetail === reportNavStateRef.current) {
              window.history.back();
            }
          } catch {}
          reportNavStateRef.current = null;
        }
      }
      return r;
    });
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onPop = (e: PopStateEvent) => {
      // 브라우저 뒤로가기로 detail entry 를 벗어나는 순간 — 상세 닫기
      const incoming = (e.state as { __reportDetail?: string } | null)?.__reportDetail ?? null;
      if (reportNavStateRef.current && incoming !== reportNavStateRef.current) {
        reportNavStateRef.current = null;
        setSelectedReport(null);
      }
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  const endD = useMemo(() => new Date(), []);
  const startD = useMemo(() => {
    const s = new Date();
    s.setMonth(s.getMonth() - 1);
    return s;
  }, []);
  const [startDate, setStartDate] = useState(() => fmtLocal(startD));
  const [endDate, setEndDate] = useState(() => fmtLocal(endD));
  const [deptFilter, setDeptFilter] = useState("");

  const attendanceList = useMemo((): Attendance[] => {
    if (rawAttendance.length > 0) {
      return rawAttendance.map((r, i) => ({
        id: `${r.member_id}-${r.date}-${i}`,
        member_id: r.member_id,
        date: r.date,
        status: (DB_STATUS_TO_UI[r.status] ?? "결석") as Attendance["status"],
        service_type: r.service_type ?? "주일예배",
      }));
    }
    const year = new Date().getFullYear();
    const list: Attendance[] = [];
    db.members.forEach((m) => {
      const att = db.attendance?.[m.id] ?? {};
      for (let w = 1; w <= 52; w++) {
        const st = att[w];
        if (st !== "p" && st !== "o") continue;
        const date = getSundayForWeekNum(year, w);
        list.push({
          id: `${m.id}-${w}`,
          member_id: m.id,
          date,
          status: st === "p" ? "출석" : "온라인",
          service_type: "주일예배",
        });
      }
    });
    return list;
  }, [rawAttendance, db.members, db.attendance]);

  const depts = useMemo(() => {
    const s = new Set<string>();
    db.members.forEach((m) => {
      if (m.dept?.trim()) s.add(m.dept);
    });
    return Array.from(s).sort();
  }, [db.members]);

  const membersFiltered = useMemo(() => {
    let list = db.members.filter((m) => (m.member_status ?? m.status) !== "졸업/전출");
    if (deptFilter) list = list.filter((m) => m.dept === deptFilter);
    return list;
  }, [db.members, deptFilter]);

  const memberListPrintData = useMemo(() => {
    const list = membersFiltered;
    const memberStatus = (m: Member) => (m.member_status ?? m.status ?? "").trim();
    const totalMembers = list.length;
    const activeMembers = list.filter((m) => {
      const st = memberStatus(m);
      return st === "활동" || st === "" || st === "새가족";
    }).length;
    const newFamilyCount = list.filter((m) => m.is_new_family || memberStatus(m) === "새가족").length;
    const riskCount = list.filter((m) => {
      const st = memberStatus(m);
      return st.includes("휴면") || st.includes("위험");
    }).length;
    const map = new Map<string, number>();
    list.forEach((m) => {
      const d = (m.dept || "").trim() || "(미배정)";
      map.set(d, (map.get(d) || 0) + 1);
    });
    const deptRows = Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
    const maxDept = Math.max(...deptRows.map(([, c]) => c), 1);
    const departments = deptRows.map(([name, count]) => ({
      name,
      count,
      barPct: Math.round((count / maxDept) * 100),
      sharePct: totalMembers ? Math.round((count / totalMembers) * 100) : 0,
    }));
    return { totalMembers, activeMembers, newFamilyCount, riskCount, departments };
  }, [membersFiltered]);

  const inDateRange = (dateStr: string | undefined) => {
    if (!dateStr) return true;
    return dateStr >= startDate && dateStr <= endDate;
  };

  /** PDF 생성 — html2canvas-pro 로 보고서 영역 캡처 → jsPDF 로 A4 다중 페이지 PDF blob
   *  · 사이트 primary 컬러 그대로 유지 (override 안 함)
   *  · 표 행(<tr>) 경계에 맞춰 슬라이스 — 행이 페이지 경계에서 잘리지 않음
   *  · 매 페이지 하단에 페이지 번호 푸터 (1 / N) */
  const renderReportPdfBlob = useCallback(async (): Promise<Blob> => {
    const printArea = document.getElementById("report-print-area");
    if (!printArea) throw new Error("렌더링된 보고서 영역을 찾을 수 없습니다.");

    // 폰트 로딩 대기 (최대 3초)
    await Promise.race([
      (typeof document !== "undefined" && document.fonts?.ready) || Promise.resolve(),
      new Promise<void>((r) => setTimeout(r, 3000)),
    ]);

    /* eslint-disable @typescript-eslint/no-explicit-any */
    type Html2CanvasFn = (el: HTMLElement, opts?: any) => Promise<HTMLCanvasElement>;
    type JsPdfCtor = any;
    /* eslint-enable @typescript-eslint/no-explicit-any */
    const [h2cMod, pdfMod] = await Promise.all([import("html2canvas-pro"), import("jspdf")]);
    const h2cAny = h2cMod as { default?: Html2CanvasFn };
    const html2canvas = (h2cAny.default ?? (h2cMod as unknown as Html2CanvasFn)) as Html2CanvasFn;
    const pdfModAny = pdfMod as { default?: JsPdfCtor; jsPDF?: JsPdfCtor };
    const JsPDF: JsPdfCtor = pdfModAny.default ?? pdfModAny.jsPDF;
    if (!html2canvas || !JsPDF) throw new Error("PDF 라이브러리를 불러오지 못했습니다.");

    // 캡처 전 — 잘림 방지를 위한 cuttable 경계(y) 측정
    // 각 <tr> 끝점 + KPI 카드/섹션 사이 공백을 페이지 경계 후보로 사용
    const areaRect = printArea.getBoundingClientRect();
    const cuttable: number[] = [0];
    printArea.querySelectorAll<HTMLElement>("tr, [data-pdf-break]").forEach((el) => {
      // 빈행은 제외
      if (el.getAttribute("aria-hidden")) return;
      const r = el.getBoundingClientRect();
      cuttable.push(Math.max(0, Math.round(r.bottom - areaRect.top)));
    });
    cuttable.push(Math.round(printArea.scrollHeight));
    const cuttableSorted = Array.from(new Set(cuttable)).sort((a, b) => a - b);

    // 표 헤더 반복 — 각 <table> 의 thead 위치 및 부모 table 범위 기록 (DOM 좌표)
    type TableHeaderInfo = {
      tableY0: number;
      tableY1: number;
      theadY0: number;
      theadY1: number;
    };
    const tableHeadersDom: TableHeaderInfo[] = [];
    printArea.querySelectorAll<HTMLTableElement>("table").forEach((tbl) => {
      const thead = tbl.querySelector("thead");
      if (!thead) return;
      const tblR = tbl.getBoundingClientRect();
      const thR = thead.getBoundingClientRect();
      tableHeadersDom.push({
        tableY0: Math.round(tblR.top - areaRect.top),
        tableY1: Math.round(tblR.bottom - areaRect.top),
        theadY0: Math.round(thR.top - areaRect.top),
        theadY1: Math.round(thR.bottom - areaRect.top),
      });
    });

    const canvas = await html2canvas(printArea, {
      scale: 2,
      backgroundColor: "#ffffff",
      useCORS: true,
      allowTaint: true,
      logging: false,
      imageTimeout: 15000,
      width: printArea.offsetWidth,
      height: printArea.offsetHeight,
      onclone: (clonedDoc: Document) => {
        // 클론 DOM 에서 페이지네이션·버튼·빈행 제거 (PDF 노이즈 제거)
        clonedDoc.querySelectorAll<HTMLElement>("[data-print-hide=\"true\"]").forEach((el) => el.remove());
        clonedDoc.querySelectorAll<HTMLElement>("tr[aria-hidden]").forEach((el) => el.remove());
        clonedDoc.querySelectorAll<HTMLButtonElement>("button").forEach((el) => el.remove());
        // 외곽 카드 보더 제거 (A4 종이에 어색하지 않게)
        const root = clonedDoc.getElementById("report-print-area");
        if (root) {
          root.style.padding = "24px 28px";
          root.style.border = "none";
          root.style.borderRadius = "0";
          root.style.boxShadow = "none";
          root.style.background = "#ffffff";
        }
      },
    });

    // 캡처 좌표 ↔ DOM 좌표 (scale=2 이지만 html2canvas-pro 가 자동 처리)
    const domToCanvas = canvas.width / printArea.offsetWidth;
    const cuttableCanvas = cuttableSorted.map((y) => Math.round(y * domToCanvas));

    // 각 thead 영역을 별도 캔버스로 잘라 보관 (페이지마다 합성용)
    type TableHeaderCanvasInfo = {
      tableY0c: number;  // canvas 좌표
      tableY1c: number;
      theadY0c: number;
      theadY1c: number;
      theadH: number;
      theadCanvas: HTMLCanvasElement;
    };
    const tableHeaders: TableHeaderCanvasInfo[] = tableHeadersDom
      .map((h) => {
        const theadY0c = Math.round(h.theadY0 * domToCanvas);
        const theadY1c = Math.round(h.theadY1 * domToCanvas);
        const tableY0c = Math.round(h.tableY0 * domToCanvas);
        const tableY1c = Math.round(h.tableY1 * domToCanvas);
        const theadH = theadY1c - theadY0c;
        if (theadH <= 0) return null;
        const c = document.createElement("canvas");
        c.width = canvas.width;
        c.height = theadH;
        const cctx = c.getContext("2d");
        if (cctx) {
          cctx.fillStyle = "#ffffff";
          cctx.fillRect(0, 0, canvas.width, theadH);
          cctx.drawImage(canvas, 0, theadY0c, canvas.width, theadH, 0, 0, canvas.width, theadH);
        }
        return { tableY0c, tableY1c, theadY0c, theadY1c, theadH, theadCanvas: c };
      })
      .filter((x): x is TableHeaderCanvasInfo => x !== null);

    /** y 위치(canvas 좌표)가 어떤 table 의 본문 안이면 그 표의 thead 정보 반환 */
    const headerForY = (y: number): TableHeaderCanvasInfo | null => {
      for (const h of tableHeaders) {
        if (y > h.theadY1c + 2 && y < h.tableY1c) return h;
      }
      return null;
    };

    const A4_W_MM = 210;
    const A4_H_MM = 297;
    const TOP_MARGIN_MM = 13;       // 매 페이지 상단 여백 (인쇄 호흡)
    const FOOTER_RESERVED_MM = 14;  // 페이지 번호 표시 영역
    const RULE_MARGIN_X_MM = 14;    // 상·하단 라인 좌우 여백
    const TOP_RULE_Y_MM = 9;        // 상단 구분선 y
    const BOTTOM_RULE_Y_MM = A4_H_MM - 11; // 하단 구분선 y

    const pdf = new JsPDF("p", "mm", "a4");
    const pxPerMm = canvas.width / A4_W_MM;
    const usableMm = A4_H_MM - TOP_MARGIN_MM - FOOTER_RESERVED_MM;
    const pagePxBudget = Math.floor(usableMm * pxPerMm);

    // 1차 패스 — 행 경계에 맞춰 페이지 cut 위치 결정 (행이 잘리지 않도록)
    // p>0 페이지가 표 본문 중간에서 시작하면 thead 합성을 위해 budget 을 thead 만큼 줄임
    const cuts: number[] = [0];
    let cursor = 0;
    let pageIdxTmp = 0;
    while (cursor < canvas.height - 1) {
      const headerInfo = pageIdxTmp > 0 ? headerForY(cursor) : null;
      const reservedHeader = headerInfo ? headerInfo.theadH : 0;
      const effBudget = pagePxBudget - reservedHeader;
      const ideal = cursor + effBudget;
      if (ideal >= canvas.height) {
        cuts.push(canvas.height);
        break;
      }
      // (cursor + 40%) ~ ideal 사이에서 가장 아래쪽 row 경계로 cut
      const minAcceptable = cursor + effBudget * 0.4;
      let cut = ideal;
      for (let i = cuttableCanvas.length - 1; i >= 0; i--) {
        const y = cuttableCanvas[i];
        if (y > minAcceptable && y <= ideal) {
          cut = y;
          break;
        }
      }
      if (cut <= cursor) cut = ideal; // 안전장치
      cuts.push(cut);
      cursor = cut;
      pageIdxTmp += 1;
    }
    const totalPages = Math.max(1, cuts.length - 1);

    // 2차 패스 — 슬라이스 + (필요 시) 표 헤더 합성 + 페이지 번호 푸터
    for (let p = 0; p < totalPages; p++) {
      const y0 = cuts[p];
      const y1 = cuts[p + 1];
      const sliceH = y1 - y0;
      const headerInfo = p > 0 ? headerForY(y0) : null;
      const headerH = headerInfo ? headerInfo.theadH : 0;

      const pageCanvas = document.createElement("canvas");
      pageCanvas.width = canvas.width;
      pageCanvas.height = sliceH + headerH;
      const ctx = pageCanvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, sliceH + headerH);
        // 표 헤더 먼저 (페이지 상단)
        if (headerInfo) {
          ctx.drawImage(headerInfo.theadCanvas, 0, 0);
        }
        // 본문 슬라이스 — headerH 만큼 아래로 밀어서 배치
        ctx.drawImage(canvas, 0, y0, canvas.width, sliceH, 0, headerH, canvas.width, sliceH);
      }
      const dataUrl = pageCanvas.toDataURL("image/png");
      if (p > 0) pdf.addPage();
      // 상단 마진을 두고 본문 배치
      pdf.addImage(dataUrl, "PNG", 0, TOP_MARGIN_MM, A4_W_MM, (sliceH + headerH) / pxPerMm);
      // 상·하단 구분선
      pdf.setDrawColor(190);
      pdf.setLineWidth(0.3);
      pdf.line(RULE_MARGIN_X_MM, TOP_RULE_Y_MM, A4_W_MM - RULE_MARGIN_X_MM, TOP_RULE_Y_MM);
      pdf.line(RULE_MARGIN_X_MM, BOTTOM_RULE_Y_MM, A4_W_MM - RULE_MARGIN_X_MM, BOTTOM_RULE_Y_MM);
      // 페이지 번호 (숫자만 — jsPDF 기본 폰트로 한글 영향 X)
      pdf.setFontSize(9);
      pdf.setTextColor(140);
      pdf.text(`${p + 1} / ${totalPages}`, A4_W_MM / 2, A4_H_MM - 5, { align: "center" });
    }

    return pdf.output("blob");
  }, []);

  const pdfFileName = useMemo(() => {
    const t = (selectedReport?.title ?? "보고서").replace(/[\s/\\?%*:|"<>]/g, "_");
    const today = new Date();
    const d = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`;
    return `${(db.settings.churchName ?? "교회").trim()}_${t}_${d}.pdf`;
  }, [selectedReport?.title, db.settings.churchName]);

  const handlePrint = useCallback(async () => {
    if (pdfBusy !== "idle") return;
    setPdfBusy("preview");
    // 1) 캡처 모드 ON — 모든 행 한 번에 렌더되도록 트리거
    setPdfCaptureMode(true);
    // 2) 두 번의 RAF + 짧은 timeout 으로 re-render & 폰트 metric 안정화 대기
    await new Promise<void>((r) =>
      requestAnimationFrame(() => requestAnimationFrame(() => r()))
    );
    await new Promise<void>((r) => setTimeout(r, 80));
    try {
      const blob = await renderReportPdfBlob();
      if (pdfPreviewUrl) URL.revokeObjectURL(pdfPreviewUrl);
      setPdfPreviewUrl(URL.createObjectURL(blob));
    } catch (e) {
      console.error("[report] PDF preview 실패:", e);
      const msg = e instanceof Error ? e.message : String(e);
      toast(`PDF 생성 실패: ${msg}`, "err");
    } finally {
      setPdfCaptureMode(false);
      setPdfBusy("idle");
    }
  }, [pdfBusy, pdfPreviewUrl, renderReportPdfBlob, toast]);

  const handlePdfDownload = useCallback(() => {
    if (!pdfPreviewUrl) return;
    const a = document.createElement("a");
    a.href = pdfPreviewUrl;
    a.download = pdfFileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [pdfPreviewUrl, pdfFileName]);

  const closePdfPreview = useCallback(() => {
    if (pdfPreviewUrl) URL.revokeObjectURL(pdfPreviewUrl);
    setPdfPreviewUrl(null);
  }, [pdfPreviewUrl]);

  const categoryTone = (category: string) => {
    if (category === "목양") {
      return {
        main: "var(--pc-primary, #4466e0)",
        soft: "var(--pc-primary-soft, #eef2ff)",
      };
    }
    if (category === "심방·상담") {
      return {
        main: "var(--pc-purple, #7c5ce0)",
        soft: "var(--pc-purple-soft, #f3efff)",
      };
    }
    if (category === "재정") {
      return {
        main: "var(--pc-success, #16a34a)",
        soft: "var(--pc-success-soft, #ecfdf3)",
      };
    }
    return {
      main: "var(--pc-warning, #e59500)",
      soft: "var(--pc-warning-soft, #fff7e6)",
    };
  };
  const categoryTabs = useMemo(
    () => [
      { value: "목양", icon: Users },
      { value: "심방·상담", icon: MessageCircle },
      { value: "재정", icon: Wallet },
      { value: "통계·서식", icon: BarChart3 },
    ],
    [],
  );
  const activeCategory =
    REPORT_GROUPS.find((g) => g.category === activeReportCategory) ?? REPORT_GROUPS[0];
  const reportItemIcon = (id: ReportId) => {
    const map: Record<ReportId, React.ComponentType<any>> = {
      p_member_list: Users,
      p_attendance: UserCheck,
      p_absentee: UserX,
      p_new_family: Sprout,
      p_mokjang: Home,
      v_visit: MessageCircle,
      v_counsel: ClipboardList,
      f_offering: Banknote,
      f_expense: Receipt,
      x_dashboard: LayoutDashboard,
      x_weekly: CalendarDays,
      x_monthly: CalendarRange,
      x_senior: FileBarChart,
      x_dept: Building2,
      x_visit_plan: FileText,
      x_upcoming: CalendarDays,
    };
    return map[id] ?? FileText;
  };

  const renderPreview = () => {
    if (!selectedReport) return null;
    const id = selectedReport.id;

    if (id === "x_dashboard") return <StatisticsDashboard db={db} />;
    if (id === "x_weekly") return <WeeklyReport db={db} toast={toast} />;
    if (id === "x_monthly") return <MonthlyReport db={db} toast={toast} />;
    if (id === "x_senior") return <SeniorPastorReport db={db} toast={toast} />;
    if (id === "x_dept") return <DepartmentReport db={db} toast={toast} />;
    if (id === "x_visit_plan") return <VisitPlanReport db={db} toast={toast} />;
    if (id === "x_upcoming") return <UpcomingEvents members={db.members} db={db} />;

    if (id === "p_attendance") {
      return null; // 별도 본문 컴포넌트(AttendancePrintBody)로 렌더
    }

    if (id === "p_member_list") {
      return null;
    }

    if (id === "p_new_family") {
      const programs = db.newFamilyPrograms ?? [];
      const idToName = new Map(db.members.map((m) => [m.id, m.name] as const));
      return (
        <ReportSimpleTable
          showIndex
          headers={["성도", "시작일", "상태", "4주 진행"]}
          align={["left", "left", "left", "right"]}
          rows={programs.map((p) => {
            const done = [p.week1_completed, p.week2_completed, p.week3_completed, p.week4_completed].filter(Boolean).length;
            return [
              <span key="n" style={{ color: NAVY, fontWeight: 600 }}>{idToName.get(p.member_id) || p.member_id}</span>,
              p.program_start_date || "-",
              <span
                key="s"
                style={{
                  display: "inline-block",
                  padding: "4px 10px",
                  borderRadius: 999,
                  fontSize: 12,
                  fontWeight: 600,
                  background: p.status === "수료" ? "#eaf6ec" : p.status === "중단" ? "#fdecec" : "#eaf1ff",
                  color: p.status === "수료" ? "#1b7a36" : p.status === "중단" ? "#a83232" : NAVY,
                }}
              >
                {p.status}
              </span>,
              <span key="p" style={{ fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>{done}/4</span>,
            ];
          })}
        />
      );
    }

    if (id === "p_mokjang") {
      const map = new Map<string, number>();
      membersFiltered.forEach((m) => {
        const mj = (m.mokjang ?? m.group ?? "").trim() || "(미배정)";
        map.set(mj, (map.get(mj) || 0) + 1);
      });
      const rows = Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
      return (
        <ReportSimpleTable
          showIndex
          headers={["목장", "인원"]}
          align={["left", "right"]}
          rows={rows.map(([name, n]) => [
            <span key="n" style={{ color: NAVY, fontWeight: 600 }}>{name}</span>,
            <span key="c" style={{ fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>{n}명</span>,
          ])}
        />
      );
    }

    if (id === "p_absentee") {
      return (
        <div>
          <p style={{ margin: "0 0 16px", color: SUB, fontSize: 14, lineHeight: 1.6 }}>
            최근 주차 기준 활동 성도 중 출석 기록이 없거나 부족한 경우를 요약합니다. 상세 관리는 목양 &gt; 출석부 &gt; 결석자 관리에서 진행하세요.
          </p>
          <ReportSimpleTable
            showIndex
            headers={["이름", "부서", "비고"]}
            rows={membersFiltered.map((m) => [
              <span key="n" style={{ color: NAVY, fontWeight: 600 }}>{m.name}</span>,
              m.dept || "-",
              <span key="r" style={{ color: SUB }}>출석 데이터 기준 점검</span>,
            ])}
          />
        </div>
      );
    }

    if (id === "v_visit") {
      const visits = (db.visits ?? []).filter((v) => inDateRange(v.date));
      const idToName = new Map(db.members.map((m) => [m.id, m.name] as const));
      return (
        <ReportSimpleTable
          showIndex
          headers={["날짜", "성도", "유형", "요약"]}
          align={["left", "left", "left", "left"]}
          rows={visits.map((v) => [
            <span key="d" style={{ fontVariantNumeric: "tabular-nums" }}>{v.date}</span>,
            <span key="n" style={{ color: NAVY, fontWeight: 600 }}>{idToName.get(v.memberId) || v.memberId}</span>,
            v.type,
            (v.content || "").slice(0, 80),
          ])}
        />
      );
    }

    if (id === "v_counsel") {
      const counsels = ((db as DB & { counsels?: { id: string; date: string; memberId: string; type: string; summary?: string }[] }).counsels ?? []).filter((c) =>
        inDateRange(c.date)
      );
      const idToName = new Map(db.members.map((m) => [m.id, m.name] as const));
      return (
        <ReportSimpleTable
          showIndex
          headers={["날짜", "성도", "유형", "요약"]}
          align={["left", "left", "left", "left"]}
          rows={counsels.map((c) => [
            <span key="d" style={{ fontVariantNumeric: "tabular-nums" }}>{c.date}</span>,
            <span key="n" style={{ color: NAVY, fontWeight: 600 }}>{idToName.get(c.memberId) || c.memberId}</span>,
            c.type,
            (c.summary ?? "").slice(0, 80),
          ])}
        />
      );
    }

    if (id === "f_offering") {
      const rows = (db.income ?? []).filter((r: Income) => inDateRange(r.date));
      return (
        <ReportSimpleTable
          showIndex
          headers={["날짜", "항목", "금액", "비고"]}
          align={["left", "left", "right", "left"]}
          rows={rows.map((r) => [
            <span key="d" style={{ fontVariantNumeric: "tabular-nums" }}>{r.date}</span>,
            <span key="t" style={{ color: NAVY, fontWeight: 600 }}>{r.type}</span>,
            <span key="a" style={{ fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>
              ₩{(r.amount ?? 0).toLocaleString()}
            </span>,
            (r.memo || "").slice(0, 40),
          ])}
        />
      );
    }

    if (id === "f_expense") {
      const rows = (db.expense ?? []).filter((r: Expense) => inDateRange(r.date));
      return (
        <ReportSimpleTable
          showIndex
          headers={["날짜", "항목", "금액", "비고"]}
          align={["left", "left", "right", "left"]}
          rows={rows.map((r) => [
            <span key="d" style={{ fontVariantNumeric: "tabular-nums" }}>{r.date}</span>,
            <span key="c" style={{ color: NAVY, fontWeight: 600 }}>{r.category}</span>,
            <span key="a" style={{ fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>
              ₩{(r.amount ?? 0).toLocaleString()}
            </span>,
            (r.memo || "").slice(0, 40),
          ])}
        />
      );
    }

    return null;
  };

  const showDeptFilter =
    selectedReport &&
    ["p_member_list", "p_attendance", "p_absentee", "p_mokjang"].includes(selectedReport.id);

  const detailTitle = selectedReport?.title ?? "보고서 · 설정";
  const selectedReportId = selectedReport?.id;
  const churchName = db.settings.churchName ?? "";
  const showReportsSection = mode !== "settings";
  const showSettingsSection = mode !== "reports";

  return (
    <UnifiedPageLayout
      pageTitle={mode === "reports" ? "보고서" : mode === "settings" ? "설정" : "보고서 · 설정"}
      churchName={churchName.trim() || "교회 이름"}
      navSections={navSections}
      activeId={mode === "reports" ? "reports" : mode === "settings" ? "settings" : "reports-settings"}
      onNav={() => {}}
      versionText={mode === "reports" ? "보고서 v1.0" : mode === "settings" ? "설정 v1.0" : "보고서/설정 v1.0"}
      headerTitle={mode === "reports" ? "보고서" : mode === "settings" ? "설정" : "보고서 · 설정"}
      headerDesc={
        mode === "reports"
          ? selectedReport
            ? detailTitle
            : "리포트를 선택하고 필터를 적용하세요"
          : mode === "settings"
            ? "교회 정보, 알림, 데이터를 설정합니다"
            : selectedReport
              ? detailTitle
              : "리포트를 선택하고 필터를 적용하세요"
      }
      hideMobileSubTabs
      headerActions={showReportsSection ? (
        <div
          style={{
            display: "flex",
            flexDirection: mob ? "column" : "row",
            alignItems: mob ? "stretch" : "center",
            gap: 6,
            width: mob ? "100%" : "auto",
            minWidth: 0,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              minWidth: mob ? 0 : 150,
            }}
          >
            <span style={{ fontSize: 10, color: SUB, flexShrink: 0, lineHeight: 1 }} title="시작일">
              시작
            </span>
            <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center" }}>
              <CalendarDropdown
                id="report-filter-start"
                value={startDate}
                onChange={setStartDate}
                compact
                style={{ marginBottom: 0, width: "100%", minWidth: 0 }}
                triggerStyle={reportFilterDateTrigger}
              />
            </div>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              minWidth: mob ? 0 : 150,
            }}
          >
            <span style={{ fontSize: 10, color: SUB, flexShrink: 0, lineHeight: 1 }} title="종료일">
              종료
            </span>
            <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center" }}>
              <CalendarDropdown
                id="report-filter-end"
                value={endDate}
                onChange={setEndDate}
                compact
                style={{ marginBottom: 0, width: "100%", minWidth: 0 }}
                triggerStyle={reportFilterDateTrigger}
              />
            </div>
          </div>
          {showDeptFilter && (
            <div style={{ minWidth: mob ? 0 : 160, display: "flex", alignItems: "center" }}>
              <ModernSelect
                id="report-filter-dept"
                value={deptFilter}
                onChange={setDeptFilter}
                options={[{ value: "", label: "전체" }, ...depts.map((d) => ({ value: d, label: d }))]}
                compact
                uniform32
                placeholder="전체"
                style={{ marginBottom: 0, width: "100%", minWidth: 0 }}
              />
            </div>
          )}
        </div>
      ) : null}
    >
      <div className={settingsStyles.layoutStack}>
          {showReportsSection ? (
          <section style={{ minWidth: 0, width: "100%" }} aria-label="보고서">
            {!selectedReport && (
              <PcTabs value={activeReportCategory} onValueChange={setActiveReportCategory} variant="underline" size="lg">
                <PcTabs.List ariaLabel="보고서 카테고리">
                  {categoryTabs.map((tab) => {
                    const TabIcon = tab.icon;
                    return (
                      <PcTabs.Trigger key={tab.value} value={tab.value} icon={<TabIcon size={16} />}>
                        {tab.value}
                      </PcTabs.Trigger>
                    );
                  })}
                </PcTabs.List>
                {categoryTabs.map((tab) => (
                  <PcTabs.Content key={tab.value} value={tab.value}>
                    {activeCategory.category === tab.value ? (
                      <div className={reportItemStyles.list}>
                        {activeCategory.items.map((item) => {
                          const tone = categoryTone(activeCategory.category);
                          const selected = selectedReportId === item.id;
                          const ItemIcon = reportItemIcon(item.id);
                          return (
                            <PcCard key={item.id} padding="md" elevation="sm">
                              <button
                                type="button"
                                className={`${reportItemStyles.button}${selected ? ` ${reportItemStyles.buttonSelected}` : ""}`}
                                onClick={() => selectReport(item)}
                              >
                                <span className={reportItemStyles.iconBox} style={{ background: tone.soft, color: tone.main, border: "1px solid var(--color-border)" }}>
                                  <ItemIcon size={24} />
                                </span>
                                <span className={reportItemStyles.textBox}>
                                  <span className={reportItemStyles.title}>{item.title}</span>
                                  <span className={reportItemStyles.desc}>{item.desc}</span>
                                </span>
                                <ChevronRight className={reportItemStyles.arrow} />
                              </button>
                            </PcCard>
                          );
                        })}
                      </div>
                    ) : null}
                  </PcTabs.Content>
                ))}
              </PcTabs>
            )}
            {selectedReport && (
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                  <button
                    type="button"
                    onClick={() => selectReport(null)}
                    style={{
                      height: 36,
                      padding: "0 14px",
                      fontSize: 14,
                      borderRadius: 8,
                      border: `1px solid ${BORDER}`,
                      background: WHITE,
                      color: TEXT,
                      cursor: "pointer",
                      flexShrink: 0,
                      fontFamily: "inherit",
                      fontWeight: 500,
                    }}
                  >
                    ← 뒤로
                  </button>
                  <div style={{ fontSize: 20, fontWeight: 700, color: NAVY, minWidth: 0, letterSpacing: "-0.01em" }}>{detailTitle}</div>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 14 }}>
                  <button
                    type="button"
                    onClick={handlePrint}
                    disabled={pdfBusy !== "idle"}
                    style={{
                      height: 38,
                      padding: "0 18px",
                      fontSize: 14,
                      fontWeight: 600,
                      borderRadius: 8,
                      background: pdfBusy !== "idle" ? "#9aa3b7" : NAVY,
                      color: WHITE,
                      border: "none",
                      cursor: pdfBusy !== "idle" ? "wait" : "pointer",
                      fontFamily: "inherit",
                      letterSpacing: "-0.01em",
                      opacity: pdfBusy !== "idle" ? 0.85 : 1,
                    }}
                  >
                    {pdfBusy === "preview" ? "PDF 생성 중…" : "PDF 미리보기"}
                  </button>
                </div>

                <PdfCaptureContext.Provider value={pdfCaptureMode}>
                  <div
                    id="report-print-area"
                    style={{
                      background: WHITE,
                      borderRadius: 12,
                      border: `1px solid ${BORDER}`,
                      padding: "32px 36px",
                      minHeight: 200,
                      maxWidth: 880,
                      margin: "0 auto",
                      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans KR", sans-serif',
                    }}
                  >
                    <ReportPrintHeader
                      churchName={churchName}
                      reportTitle={detailTitle}
                      startDate={startDate}
                      endDate={endDate}
                    />
                    {selectedReport.id === "p_member_list" ? (
                      <MemberListPrintBody
                        members={membersFiltered}
                        totalMembers={memberListPrintData.totalMembers}
                        activeMembers={memberListPrintData.activeMembers}
                        newFamilyCount={memberListPrintData.newFamilyCount}
                        riskCount={memberListPrintData.riskCount}
                        departments={memberListPrintData.departments}
                      />
                    ) : selectedReport.id === "p_attendance" ? (
                      <AttendancePrintBody
                        members={membersFiltered}
                        attendanceList={attendanceList}
                        startDate={startDate}
                        endDate={endDate}
                      />
                    ) : (
                      <div style={{ fontSize: 14, color: TEXT, lineHeight: 1.6 }}>{renderPreview()}</div>
                    )}
                    <ReportPrintFooter churchName={churchName} />
                  </div>
                </PdfCaptureContext.Provider>
              </div>
            )}
          </section>
          ) : null}

          {showReportsSection && showSettingsSection ? (
            <div className={settingsStyles.sectionDivider} />
          ) : null}

          {showSettingsSection ? (
          <section className={settingsStyles.settingsSection} aria-label="설정">
            <h2 className={settingsStyles.settingsHeading}>설정</h2>
            <ThemeSettingsCard />
            <ChurchInfoSettingsCard db={db} setDb={setDb} save={save} toast={toast} />
            <NotificationSettingsCard db={db} setDb={setDb} save={save} />
            <DataBackupPanel db={db} setDb={setDb} save={save} saveDb={saveDb} toast={toast} />
          </section>
          ) : null}
      </div>

      {/* ===== PDF 미리보기 모달 (시스템 인쇄 다이얼로그 대체) ===== */}
      {pdfPreviewUrl && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={closePdfPreview}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 22, 38, 0.55)",
            backdropFilter: "blur(2px)",
            zIndex: 10000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(96vw, 1000px)",
              height: "min(96vh, 1200px)",
              background: WHITE,
              borderRadius: 14,
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 20px 50px rgba(0,0,0,0.35)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "14px 18px",
                borderBottom: `1px solid ${BORDER}`,
                background: BG_SUMMARY,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: NAVY, letterSpacing: "-0.01em" }}>
                  {selectedReport?.title ?? "보고서"}
                </span>
                <span style={{ fontSize: 13, color: SUB }}>· PDF 미리보기</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button
                  type="button"
                  onClick={handlePdfDownload}
                  style={{
                    height: 34,
                    padding: "0 14px",
                    fontSize: 13,
                    fontWeight: 600,
                    borderRadius: 7,
                    background: NAVY,
                    color: WHITE,
                    border: "none",
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  PDF 다운로드
                </button>
                <button
                  type="button"
                  onClick={closePdfPreview}
                  style={{
                    height: 34,
                    padding: "0 14px",
                    fontSize: 13,
                    fontWeight: 500,
                    borderRadius: 7,
                    background: WHITE,
                    color: TEXT,
                    border: `1px solid ${BORDER}`,
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  닫기
                </button>
              </div>
            </div>
            <iframe
              title="report-pdf-preview"
              src={pdfPreviewUrl}
              style={{ flex: 1, border: "none", background: "#f4f5f8" }}
            />
          </div>
        </div>
      )}
    </UnifiedPageLayout>
  );
}
