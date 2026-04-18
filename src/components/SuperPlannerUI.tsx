"use client";

import type { DB } from "@/types/db";
import type { PageId, ToastItem } from "./SuperPlanner";
import { PastoralPage } from "./PastoralPage";
import { FinancePage } from "./FinancePage";
import { VisitCounselPage } from "./VisitCounselPage";
import { BulletinPage } from "./BulletinPage";
import { Toast } from "./Toast";
import { Modals } from "./Modals";
import { Users, Wallet, Heart, GraduationCap, FileBarChart, Newspaper, CalendarDays } from "lucide-react";
import { PlannerPage } from "./PlannerPage";
import { SchoolPage } from "./school/SchoolPage";
import { ReportsSettingsPage } from "./ReportsSettingsPage";
import { useAuth } from "@/contexts/AuthContext";

const TAB_CONFIG: { id: PageId; label: string; Icon: React.ComponentType<any> }[] = [
  { id: "pastoral", label: "목양", Icon: Users },
  { id: "visit", label: "심방·상담", Icon: Heart },
  { id: "school", label: "교회학교", Icon: GraduationCap },
  { id: "finance", label: "재정", Icon: Wallet },
  { id: "planner", label: "플래너", Icon: CalendarDays },
  { id: "bulletin", label: "주보", Icon: Newspaper },
  { id: "reports", label: "보고서·설정", Icon: FileBarChart },
];

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
  } = props;

  const { user, signOut } = useAuth();

  const handleLogout = async () => {
    await signOut();
  };

  const noop = () => {};
  const noopStr = (_: string | null) => {};

  return (
    <div className="superplanner-root">
      <div className="pc-app-frame">
      <header className="pc-top-nav">
        <div className="pc-top-nav-left">
          <span className="pc-top-nav-logo">목양노트</span>
        </div>
        <nav className="pc-top-nav-tabs" aria-label="주 메뉴">
          {TAB_CONFIG.map(({ id, label, Icon }) => {
            const isActive = currentPage === id;
            return (
              <button
                key={id}
                type="button"
                className={`pc-nav-tab ${isActive ? "active" : ""}`}
                onClick={() => setCurrentPage(id)}
              >
                <Icon size={18} strokeWidth={isActive ? 2 : 1.5} />
                <span>{label}</span>
              </button>
            );
          })}
        </nav>
      </header>

      <div className="pc-app-body">
      <main>
        <div className={`page ${currentPage === "pastoral" ? "active" : ""}`} id="page-pastoral">
          <PastoralPage db={db} setDb={setDb} saveDb={saveDb} />
        </div>
        <div className={`page ${currentPage === "visit" ? "active" : ""}`} id="page-visit">
          <VisitCounselPage mainDb={db} setMainDb={setDb} saveMain={save} />
        </div>
        <div className={`page ${currentPage === "school" ? "active" : ""}`} id="page-school">
          <SchoolPage db={db} toast={toast} />
        </div>
        <div className={`page ${currentPage === "finance" ? "active" : ""}`} id="page-finance">
          <FinancePage db={db} setDb={setDb} settings={db.settings} toast={toast} />
        </div>
        <div className={`page ${currentPage === "planner" ? "active" : ""}`} id="page-planner">
          <PlannerPage toast={toast} />
        </div>
        <div className={`page ${currentPage === "bulletin" ? "active" : ""}`} id="page-bulletin">
          <BulletinPage />
        </div>
        <div className={`page ${currentPage === "reports" ? "active" : ""}`} id="page-reports">
          <ReportsSettingsPage db={db} setDb={setDb} save={save} saveDb={saveDb} toast={toast} />
        </div>
      </main>

      <aside className="pc-right-bar" aria-label="빠른 도구">
        <button type="button" className="pc-right-btn" title="검색">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
        </button>
        <div className="pc-right-church">
          <span className="pc-right-church-name">{user?.email?.split("@")[0] || "사용자"}</span>
        </div>
        <button type="button" className="pc-right-btn pc-right-avatar" title="프로필">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </button>
        <div className="pc-right-divider" />
        <button type="button" className="pc-right-btn" title="도움말">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <circle cx="12" cy="12" r="10" />
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
            <path d="M12 17h.01" />
          </svg>
        </button>
        <button type="button" className="pc-right-btn" title="알림">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          <span className="pc-right-badge" />
        </button>
        <button type="button" className="pc-right-btn" title="설정">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </button>
        <button type="button" className="pc-right-btn" title="로그아웃" onClick={handleLogout}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
        </button>
      </aside>
      </div>
      </div>

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
