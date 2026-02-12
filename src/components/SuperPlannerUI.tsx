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

const PAGE_LABELS: Record<PageId, string> = {
  pastoral: "목양노트",
  planner: "플래너",
  finance: "재정관리",
  visit: "심방/상담",
  bulletin: "주보",
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
      {currentPage !== "finance" && currentPage !== "pastoral" && currentPage !== "planner" && currentPage !== "visit" && currentPage !== "bulletin" && (
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
          <PastoralPage />
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
          <FinancePage />
        </div>
        <div
          className={`page ${currentPage === "visit" ? "active" : ""}`}
          id="page-visit"
        >
          <VisitCounselPage />
        </div>
        <div
          className={`page ${currentPage === "bulletin" ? "active" : ""}`}
          id="page-bulletin"
        >
          <BulletinPage />
        </div>
        <div
          className={`page ${currentPage === "settings" ? "active" : ""}`}
          id="page-settings"
        >
          <SettingsPage db={db} setDb={setDb} save={save} saveDb={saveDb} toast={toast} />
        </div>
      </main>

      <nav className="tab-bar">
        {(["pastoral", "planner", "finance", "visit", "bulletin", "settings"] as const).map(
          (page) => (
            <button
              key={page}
              type="button"
              className={`tab-item ${currentPage === page ? "active" : ""}`}
              onClick={() => setCurrentPage(page)}
            >
              <span className="tab-icon">
                {page === "pastoral"
                  ? "🐑"
                  : page === "planner"
                    ? "📋"
                    : page === "finance"
                      ? "💰"
                      : page === "visit"
                        ? "🏠"
                        : page === "bulletin"
                          ? "📰"
                          : "⚙️"}
              </span>
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
                        : "설정"}
            </button>
          )
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
