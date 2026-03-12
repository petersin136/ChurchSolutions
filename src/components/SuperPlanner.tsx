"use client";

import React, { useState, useEffect, useCallback } from "react";
import type { DB } from "@/types/db";
import { DEFAULT_DB, CATS_INCOME, CATS_EXPENSE } from "@/types/db";
import { loadDBFromSupabase, saveDBToSupabase, getWeekNum, getThisMonth } from "@/lib/store";
import { useAuth } from "@/contexts/AuthContext";
import { SuperPlannerUI } from "./SuperPlannerUI";

export type PageId = "pastoral" | "planner" | "finance" | "visit" | "bulletin" | "statistics" | "messaging" | "school" | "settings";

const PAGE_IDS: PageId[] = ["pastoral", "planner", "finance", "visit", "bulletin", "statistics", "messaging", "school", "settings"];
const STORAGE_KEY_PAGE = "currentPage";

export interface ToastItem {
  id: number;
  msg: string;
  type: "ok" | "err" | "warn";
}

function getInitialPage(): PageId {
  if (typeof window === "undefined") return "pastoral";
  const saved = window.sessionStorage.getItem(STORAGE_KEY_PAGE);
  if (saved && PAGE_IDS.includes(saved as PageId)) return saved as PageId;
  return "pastoral";
}

export default function SuperPlanner() {
  const { churchId } = useAuth();
  const [db, setDb] = useState<DB>(() => DEFAULT_DB);
  const [dbLoaded, setDbLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [currentPage, setCurrentPage] = useState<PageId>(getInitialPage);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    console.log("[SuperPlanner] useEffect 실행 - churchId:", churchId);
    if (!churchId) {
      console.log("[SuperPlanner] churchId 없음, 대기 중");
      return;
    }
    console.log("[SuperPlanner] churchId 확인됨, 데이터 로드 시작:", churchId);
    setLoadError(false);
    const loadData = async () => {
      try {
        console.log("[SuperPlanner] loadDBFromSupabase 호출 시작");
        const data = await loadDBFromSupabase(churchId);
        console.log("[SuperPlanner] 로드 성공, members 수:", data?.members?.length ?? 0);
        setDb(data);
        setDbLoaded(true);
      } catch (error) {
        console.error("[SuperPlanner] 로드 실패:", error);
        setLoadError(true);
      }
    };
    loadData();
  }, [churchId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.sessionStorage.setItem(STORAGE_KEY_PAGE, currentPage);
  }, [currentPage]);

  /* 페이지 로드 시 자동 save 제거: saveDBToSupabase가 attendance를 member+year 기준 delete 후 week_num만 insert해
     date/service_type 기반 출석 데이터가 삭제되는 문제 방지. 저장은 사용자가 저장 버튼으로만 수행. */

  const save = useCallback(() => {
    saveDBToSupabase(db).catch(() => {});
  }, [db]);

  const toast = useCallback((msg: string, type: "ok" | "err" | "warn" = "ok") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, msg, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 2500);
  }, []);

  const handleExportCurrent = useCallback(() => {
    if (currentPage === "pastoral") exportReport(db, "attendance", toast);
    else if (currentPage === "finance") exportReport(db, "monthly", toast);
    else if (currentPage === "planner") exportReport(db, "planner", toast);
    // visit, bulletin pages handle their own export internally
  }, [currentPage, db, toast]);

  const [openIncomeModal, setOpenIncomeModal] = useState(false);
  const [openExpenseModal, setOpenExpenseModal] = useState(false);
  const [openBudgetModal, setOpenBudgetModal] = useState(false);
  const [editIncId, setEditIncId] = useState<string | null>(null);
  const [editExpId, setEditExpId] = useState<string | null>(null);

  const handleHeaderAdd = useCallback(() => {
    // pastoral and finance now have their own internal add buttons
  }, []);

  const doExportReport = useCallback(
    (type: string) => exportReport(db, type, toast),
    [db, toast]
  );

  if (!churchId) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "var(--bg, #f2f2f7)", fontFamily: "var(--font)" }}>
        <p style={{ fontSize: 15, color: "var(--text2)" }}>교회 정보를 불러오는 중...</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "var(--bg, #f2f2f7)", fontFamily: "var(--font)" }}>
        <p style={{ fontSize: 15, color: "var(--danger, #dc2626)" }}>데이터 로드에 실패했습니다. 새로고침 해 주세요.</p>
      </div>
    );
  }

  if (!dbLoaded) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "var(--bg, #f2f2f7)", fontFamily: "var(--font)" }}>
        <p style={{ fontSize: 15, color: "var(--text2)" }}>데이터 불러오는 중...</p>
      </div>
    );
  }

  return React.createElement(SuperPlannerUI, {
    currentPage,
    setCurrentPage,
    db,
    setDb,
    save,
    saveDb: (d: DB) => saveDBToSupabase(d),
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
    exportReport: doExportReport,
  });
}

function exportReport(
  db: DB,
  type: string,
  toast: (msg: string, t?: "ok" | "err" | "warn") => void
) {
  const BOM = "\uFEFF";
  let csv = "";
  let filename = "";
  const year = new Date().getFullYear();
  const month = getThisMonth();
  const churchName = db.settings.churchName || "교회";

  switch (type) {
    case "monthly": {
      filename = `${churchName}_월간재정보고서_${month}.csv`;
      const mInc = db.income.filter((r) => r.date.startsWith(month));
      const mExp = db.expense.filter((r) => r.date.startsWith(month));
      const totalInc = mInc.reduce((s, r) => s + (Number(r.amount) || 0), 0);
      const totalExp = mExp.reduce((s, r) => s + (Number(r.amount) || 0), 0);
      csv = `${churchName} 월간 재정 보고서 (${month})\n\n`;
      csv += "=== 수입 ===\n유형,금액\n";
      CATS_INCOME.forEach((c) => {
        const t = mInc.filter((r) => r.type === c.id || r.type === c.name).reduce((s, r) => s + (Number(r.amount) || 0), 0);
        if (t) csv += `${c.name},${t}\n`;
      });
      csv += `수입 합계,${totalInc}\n\n`;
      csv += "=== 지출 ===\n계정과목,금액\n";
      CATS_EXPENSE.forEach((c) => {
        const t = mExp.filter((r) => r.category === c).reduce((s, r) => s + (Number(r.amount) || 0), 0);
        if (t) csv += `${c},${t}\n`;
      });
      csv += `지출 합계,${totalExp}\n\n`;
      csv += `차액(수입-지출),${totalInc - totalExp}\n`;
      break;
    }
    case "quarterly": {
      const q = Math.ceil((new Date().getMonth() + 1) / 3);
      filename = `${churchName}_분기재정보고서_${year}Q${q}.csv`;
      csv = `${churchName} ${q}분기 재정 보고서 (${year})\n\n`;
      csv += "월,수입합계,지출합계,차액\n";
      for (let m = (q - 1) * 3 + 1; m <= q * 3; m++) {
        const ms = `${year}-${String(m).padStart(2, "0")}`;
        const inc = db.income.filter((r) => r.date.startsWith(ms)).reduce((s, r) => s + (Number(r.amount) || 0), 0);
        const exp = db.expense.filter((r) => r.date.startsWith(ms)).reduce((s, r) => s + (Number(r.amount) || 0), 0);
        csv += `${m}월,${inc},${exp},${inc - exp}\n`;
      }
      break;
    }
    case "annual": {
      filename = `${churchName}_연간결산보고서_${year}.csv`;
      csv = `${churchName} 연간 결산 보고서 (${year})\n\n월,수입합계,지출합계,차액\n`;
      let yInc = 0, yExp = 0;
      for (let m = 1; m <= 12; m++) {
        const ms = `${year}-${String(m).padStart(2, "0")}`;
        const inc = db.income.filter((r) => r.date.startsWith(ms)).reduce((s, r) => s + (Number(r.amount) || 0), 0);
        const exp = db.expense.filter((r) => r.date.startsWith(ms)).reduce((s, r) => s + (Number(r.amount) || 0), 0);
        csv += `${m}월,${inc},${exp},${inc - exp}\n`;
        yInc += inc;
        yExp += exp;
      }
      csv += `\n합계,${yInc},${yExp},${yInc - yExp}\n`;
      break;
    }
    case "donor": {
      filename = `${churchName}_헌금자별내역_${year}.csv`;
      const donors: Record<string, Record<number, number>> = {};
      db.income.filter((r) => r.date.startsWith(String(year))).forEach((r) => {
        const name = r.donor || "익명";
        if (!donors[name]) donors[name] = {};
        const m = parseInt(r.date.split("-")[1], 10);
        donors[name][m] = (donors[name][m] || 0) + (Number(r.amount) || 0);
      });
      csv = `${churchName} 헌금자별 연간 내역서 (${year})\n\n`;
      csv += "이름," + Array.from({ length: 12 }, (_, i) => `${i + 1}월`).join(",") + ",연간합계\n";
      Object.keys(donors)
        .sort()
        .forEach((name) => {
          let total = 0;
          csv += `${name},`;
          for (let m = 1; m <= 12; m++) {
            const v = donors[name][m] || 0;
            csv += `${v},`;
            total += v;
          }
          csv += `${total}\n`;
        });
      break;
    }
    case "budgetVsActual": {
      filename = `${churchName}_예산대비실적_${year}.csv`;
      csv = `${churchName} 예산 대비 실적 (${year})\n\n계정과목,예산,집행,잔액,집행률\n`;
      CATS_EXPENSE.forEach((cat) => {
        const budget = db.budget[cat] || 0;
        const spent = db.expense
          .filter((r) => r.date.startsWith(String(year)) && r.category === cat)
          .reduce((s, r) => s + (Number(r.amount) || 0), 0);
        const pct = budget > 0 ? Math.round((spent / budget) * 100) : 0;
        csv += `${cat},${budget},${spent},${budget - spent},${pct}%\n`;
      });
      break;
    }
    case "attendance": {
      filename = `${churchName}_출석현황_제${getWeekNum()}주.csv`;
      csv = "이름,부서,직분,상태," + Array.from({ length: 52 }, (_, i) => `제${i + 1}주`).join(",") + "\n";
      db.members
        .filter((m) => m.status !== "졸업/전출")
        .forEach((m) => {
          const att = db.attendance[m.id] || {};
          const row = [
            m.name,
            m.dept || "",
            m.role || "",
            m.status || "",
            ...Array.from({ length: 52 }, (_, w) => att[w + 1] === "p" ? "출석" : att[w + 1] === "a" ? "결석" : ""),
          ];
          csv += row.join(",") + "\n";
        });
      break;
    }
    case "pastoral": {
      filename = `${churchName}_목양현황_${month}.csv`;
      csv = "이름,부서,상태,기도제목,특이사항,최근심방\n";
      db.members.filter((m) => m.status !== "졸업/전출").forEach((m) => {
        const notes = (db.notes[m.id] || []).filter((n) => n.type === "visit").slice(-1)[0];
        csv += `"${(m.name || "").replace(/"/g, '""')}","${(m.dept || "").replace(/"/g, '""')}","${m.status || ""}","${(m.prayer || "").replace(/"/g, '""')}","${(m.memo || "").replace(/"/g, '""')}","${notes ? notes.content.replace(/"/g, '""') : ""}"\n`;
      });
      break;
    }
    case "planner": {
      filename = `${churchName}_주간일정_${month}.csv`;
      csv = "날짜,시간,제목,카테고리,메모\n";
      db.plans.forEach((p) => {
        csv += `${p.date},${p.time || ""},${p.title},${p.cat},${(p.memo || "").replace(/,/g, " ")}\n`;
      });
      break;
    }
    default:
      toast("지원하지 않는 보고서 유형입니다", "err");
      return;
  }

  const blob = new Blob([BOM + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  toast("다운로드 완료", "ok");
}
