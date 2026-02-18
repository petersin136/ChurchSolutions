"use client";

import type { DB } from "@/types/db";
import type { PageId, ToastItem } from "./SuperPlanner";
import { PastoralPage } from "./PastoralPage";
import { PlannerPage } from "./PlannerPage";
import { FinancePage } from "./FinancePage";
import { VisitCounselPage } from "./VisitCounselPage";
import { BulletinPage } from "./BulletinPage";
import { SettingsPage } from "./SettingsPage";
import { Toast } from "./Toast";
import { Modals } from "./Modals";
import { Users, CalendarCheck, Wallet, Heart, FileText, Settings, BarChart3, MessageSquare, GraduationCap } from "lucide-react";
import { StatisticsReportsPage } from "./StatisticsReportsPage";
import { MessagingPage } from "./messaging/MessagingPage";
import { SchoolPage } from "./school/SchoolPage";

const PAGE_LABELS: Record<PageId, string> = {
  pastoral: "목양노트",
  planner: "플래너",
  finance: "재정관리",
  visit: "심방/상담",
  bulletin: "주보",
  statistics: "통계·보고",
  messaging: "문자",
  school: "교회학교",
  settings: "설정",
};

export interface SuperPlannerUIProps {
  currentPage: PageId;
  setCurrentPage: (p: PageId) => void;
  db: DB;
  setDb: React.Dispatch<React.SetStateAction<DB>>;
  save: () => void;
  saveDb?: (d: DB) => Promise<void>;
  toast: (msg: string, type?: "ok" | "err" | "warn") => void;
  handleExportCurrent: () => void;
  handleHeaderAdd: () => void;
  toasts: ToastItem[];
  openIncomeModal: boolean;
  openExpenseModal: boolean;
  openBudgetModal: boolean;
  editIncId: string | null;
  editExpId: string | null;
  setOpenIncomeModal: (v: boolean) => void;
  setOpenExpenseModal: (v: boolean) => void;
  setOpenBudgetModal: (v: boolean) => void;
  setEditIncId: (v: string | null) => void;
  setEditExpId: (v: string | null) => void;
  exportReport: (type: string) => void;
}

export function SuperPlannerUI(props: SuperPlannerUIProps) {
  const {
    currentPage,
    setCurrentPage,
    db,
    setDb,
    save,
    saveDb,
    toast,
    handleExportCurrent,
    handleHeaderAdd,
    toasts,
    openIncomeModal,
    openExpenseModal,
    openBudgetModal,
    editIncId,
    editExpId,
    setOpenIncomeModal,
    setOpenExpenseModal,
    setOpenBudgetModal,
    setEditIncId,
    setEditExpId,
    exportReport,
  } = props;

  // Stubs for Modals (pastoral + planner modals now live inside their own components)
  const noop = () => {};
  const noopStr = (_: string | null) => {};

  return (
    <div className="superplanner-root">
      {currentPage !== "finance" && currentPage !== "pastoral" && currentPage !== "planner" && currentPage !== "visit" && currentPage !== "bulletin" && currentPage !== "statistics" && currentPage !== "messaging" && currentPage !== "school" && (
        <header className="app-header">
          <h1>
            ⛪ 슈퍼플래너{" "}
            <small
              style={{
                fontSize: 11,
                color: "var(--text2)",
                fontWeight: 400,
                marginLeft: 6,
              }}
            >
              {PAGE_LABELS[currentPage]}
            </small>
          </h1>
          <div className="header-actions">
            <button
              type="button"
              className="btn btn-icon btn-ghost"
              onClick={handleExportCurrent}
              title="엑셀 내보내기"
            >
              📥
            </button>
          </div>
        </header>
      )}

      <main>
        <div
          className={`page ${currentPage === "pastoral" ? "active" : ""}`}
          id="page-pastoral"
        >
          <PastoralPage db={db} setDb={setDb} saveDb={saveDb} />
        </div>
        <div
          className={`page ${currentPage === "planner" ? "active" : ""}`}
          id="page-planner"
        >
          <PlannerPage />
        </div>
        <div
          className={`page ${currentPage === "finance" ? "active" : ""}`}
          id="page-finance"
        >
          <FinancePage db={db} setDb={setDb} settings={db.settings} toast={toast} />
        </div>
        <div
          className={`page ${currentPage === "visit" ? "active" : ""}`}
          id="page-visit"
        >
          <VisitCounselPage mainDb={db} setMainDb={setDb} saveMain={save} />
        </div>
        <div
          className={`page ${currentPage === "bulletin" ? "active" : ""}`}
          id="page-bulletin"
        >
          <BulletinPage />
        </div>
        <div
          className={`page ${currentPage === "statistics" ? "active" : ""}`}
          id="page-statistics"
        >
          <StatisticsReportsPage db={db} toast={toast} />
        </div>
        <div
          className={`page ${currentPage === "messaging" ? "active" : ""}`}
          id="page-messaging"
        >
          <MessagingPage db={db} toast={toast} />
        </div>
        <div
          className={`page ${currentPage === "school" ? "active" : ""}`}
          id="page-school"
        >
          <SchoolPage db={db} toast={toast} />
        </div>
        <div
          className={`page ${currentPage === "settings" ? "active" : ""}`}
          id="page-settings"
        >
          <SettingsPage db={db} setDb={setDb} save={save} saveDb={saveDb} toast={toast} />
        </div>
      </main>

      <nav className="tab-bar">
        {(["pastoral", "planner", "finance", "visit", "bulletin", "statistics", "messaging", "school", "settings"] as const).map(
          (page) => {
            const isActive = currentPage === page;
            const iconColor = isActive ? "#3b82f6" : "#9ca3af";
            const strokeWidth = isActive ? 2 : 1.5;
            const iconProps = { size: 24, strokeWidth, style: { color: iconColor } as React.CSSProperties };
            return (
              <button
                key={page}
                type="button"
                className={`tab-item ${isActive ? "active" : ""}`}
                onClick={() => setCurrentPage(page)}
              >
                <span className="tab-icon">
                  {page === "pastoral" && <Users {...iconProps} />}
                  {page === "planner" && <CalendarCheck {...iconProps} />}
                  {page === "finance" && <Wallet {...iconProps} />}
                  {page === "visit" && <Heart {...iconProps} />}
                  {page === "bulletin" && <FileText {...iconProps} />}
                  {page === "statistics" && <BarChart3 {...iconProps} />}
                  {page === "messaging" && <MessageSquare {...iconProps} />}
                  {page === "school" && <GraduationCap {...iconProps} />}
                  {page === "settings" && <Settings {...iconProps} />}
                </span>
                <span className="tab-label">
                  {page === "pastoral"
                    ? "목양"
                    : page === "planner"
                      ? "플래너"
                      : page === "finance"
                        ? "재정"
                        : page === "visit"
                          ? "심방"
                          : page === "bulletin"
                            ? "주보"
                            : page === "statistics"
                              ? "통계"
                              : page === "messaging"
                                ? "문자"
                                : page === "school"
                                  ? "교회학교"
                                  : "설정"}
                </span>
              </button>
            );
          }
        )}
      </nav>

      <Modals
        db={db}
        setDb={setDb}
        save={save}
        toast={toast}
        editMemberId={null}
        detailMemberId={null}
        noteTargetId={null}
        editPlanId={null}
        editSermonId={null}
        editIncId={editIncId}
        editExpId={editExpId}
        openMemberModal={false}
        openDetailModal={false}
        openNoteModal={false}
        openPlanModal={false}
        openSermonModal={false}
        openVisitModal={false}
        openIncomeModal={openIncomeModal}
        openExpenseModal={openExpenseModal}
        openBudgetModal={openBudgetModal}
        setOpenMemberModal={noop}
        setOpenDetailModal={noop}
        setOpenNoteModal={noop}
        setOpenPlanModal={noop}
        setOpenSermonModal={noop}
        setOpenVisitModal={noop}
        setOpenIncomeModal={setOpenIncomeModal}
        setOpenExpenseModal={setOpenExpenseModal}
        setOpenBudgetModal={setOpenBudgetModal}
        setEditMemberId={noopStr}
        setDetailMemberId={noopStr}
        setNoteTargetId={noopStr}
        setEditPlanId={noopStr}
        setEditSermonId={noopStr}
        setEditIncId={setEditIncId}
        setEditExpId={setEditExpId}
      />

      <Toast toasts={toasts} />
    </div>
  );
}
