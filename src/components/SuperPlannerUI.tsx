"use client";

import type { DB } from "@/types/db";
import type { PageId, ToastItem } from "./SuperPlanner";
import { PastoralPage } from "./PastoralPage";
import { FinancePage } from "./FinancePage";
import { VisitCounselPage } from "./VisitCounselPage";
import { BulletinPage } from "./BulletinPage";
import { Toast } from "./Toast";
import { Modals } from "./Modals";
import { Users, Wallet, Heart, GraduationCap, FileBarChart, Newspaper, LogOut } from "lucide-react";
import { SchoolPage } from "./school/SchoolPage";
import { ReportsSettingsPage } from "./ReportsSettingsPage";
import { useAuth } from "@/contexts/AuthContext";

const PAGE_LABELS: Record<PageId, string> = {
  pastoral: "목양",
  finance: "재정관리",
  visit: "심방·상담",
  school: "교회학교",
  bulletin: "주보",
  reports: "보고서·설정",
};

const TAB_CONFIG: { id: PageId; label: string; Icon: React.ComponentType<any> }[] = [
  { id: "pastoral", label: "목양", Icon: Users },
  { id: "visit", label: "심방·상담", Icon: Heart },
  { id: "school", label: "교회학교", Icon: GraduationCap },
  { id: "finance", label: "재정", Icon: Wallet },
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
      <main>
        <div className={`page ${currentPage === "pastoral" ? "active" : ""}`} id="page-pastoral">
          <PastoralPage db={db} setDb={setDb} saveDb={saveDb} />
        </div>
        <div className={`page ${currentPage === "finance" ? "active" : ""}`} id="page-finance">
          <FinancePage db={db} setDb={setDb} settings={db.settings} toast={toast} />
        </div>
        <div className={`page ${currentPage === "visit" ? "active" : ""}`} id="page-visit">
          <VisitCounselPage mainDb={db} setMainDb={setDb} saveMain={save} />
        </div>
        <div className={`page ${currentPage === "school" ? "active" : ""}`} id="page-school">
          <SchoolPage db={db} toast={toast} />
        </div>
        <div className={`page ${currentPage === "bulletin" ? "active" : ""}`} id="page-bulletin">
          <BulletinPage />
        </div>
        <div className={`page ${currentPage === "reports" ? "active" : ""}`} id="page-reports">
          <ReportsSettingsPage db={db} setDb={setDb} save={save} saveDb={saveDb} toast={toast} />
        </div>
      </main>

      <nav className="tab-bar">
        {TAB_CONFIG.map(({ id, label, Icon }) => {
          const isActive = currentPage === id;
          const iconColor = isActive ? "#3b82f6" : "#9ca3af";
          const strokeWidth = isActive ? 2 : 1.5;
          return (
            <button
              key={id}
              type="button"
              className={`tab-item ${isActive ? "active" : ""}`}
              onClick={() => setCurrentPage(id)}
            >
              <span className="tab-icon">
                <Icon size={24} strokeWidth={strokeWidth} style={{ color: iconColor }} />
              </span>
              <span className="tab-label">{label}</span>
            </button>
          );
        })}
        {user && (
          <button type="button" className="tab-item" onClick={handleLogout} title={user.email ?? ""}>
            <span className="tab-icon">
              <LogOut size={24} strokeWidth={1.5} style={{ color: "#9ca3af" }} />
            </span>
            <span className="tab-label">로그아웃</span>
          </button>
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
