"use client";

import { useState, useEffect } from "react";
import type { DB } from "@/types/db";
import { SchoolDashboard } from "./SchoolDashboard";
import { DepartmentManagement } from "./DepartmentManagement";
import { StudentManagement } from "./StudentManagement";
import { SchoolAttendanceSub } from "./SchoolAttendanceSub";
import { DepartmentTransfer } from "./DepartmentTransfer";
import { SchoolReport } from "./SchoolReport";
import { LayoutDashboard, Building2, Users, CalendarCheck, ArrowRightLeft, FileText } from "lucide-react";
import { UnifiedPageLayout } from "@/components/layout/UnifiedPageLayout";

type SchoolSubTab = "dashboard" | "departments" | "students" | "attendance" | "transfer" | "report";

const PAGE_INFO: Record<SchoolSubTab, { title: string; desc: string }> = {
  dashboard: { title: "대시보드", desc: "교회학교 현황을 한눈에 확인하세요" },
  departments: { title: "부서 관리", desc: "부서와 반을 관리합니다" },
  students: { title: "학생 관리", desc: "학생 등록과 정보를 관리합니다" },
  attendance: { title: "출석부", desc: "52주 출석 기록을 관리합니다" },
  transfer: { title: "부서 이동", desc: "학생 부서 이동을 처리합니다" },
  report: { title: "보고서", desc: "교회학교 보고서를 작성합니다" },
};

const NAV_SECTIONS = [
  {
    sectionLabel: "교회학교",
    items: [
      { id: "dashboard" as const, label: "대시보드", Icon: LayoutDashboard },
      { id: "departments" as const, label: "부서 관리", Icon: Building2 },
      { id: "students" as const, label: "학생 관리", Icon: Users },
      { id: "attendance" as const, label: "출석부", Icon: CalendarCheck },
      { id: "transfer" as const, label: "부서 이동", Icon: ArrowRightLeft },
      { id: "report" as const, label: "보고서", Icon: FileText },
    ],
  },
];

export interface SchoolPageProps {
  db: DB;
  toast: (msg: string, type?: "ok" | "err" | "warn") => void;
}

const SCHOOL_SUB_TAB_IDS: SchoolSubTab[] = ["dashboard", "departments", "students", "attendance", "transfer", "report"];

function getInitialSchoolSubTab(): SchoolSubTab {
  if (typeof window === "undefined") return "dashboard";
  const v = sessionStorage.getItem("schoolSubTab");
  return (SCHOOL_SUB_TAB_IDS.includes(v as SchoolSubTab) ? v : "dashboard") as SchoolSubTab;
}

export function SchoolPage({ db, toast }: SchoolPageProps) {
  const [subTab, setSubTab] = useState<SchoolSubTab>(getInitialSchoolSubTab);
  const info = PAGE_INFO[subTab];

  useEffect(() => {
    if (typeof window !== "undefined") sessionStorage.setItem("schoolSubTab", subTab);
  }, [subTab]);

  return (
    <UnifiedPageLayout
      pageTitle="교회학교"
      pageSubtitle={new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" })}
      navSections={NAV_SECTIONS}
      activeId={subTab}
      onNav={(id) => setSubTab(id as SchoolSubTab)}
      versionText="교회학교 v1.0"
      headerTitle={info.title}
      headerDesc={info.desc}
      SidebarIcon={LayoutDashboard}
    >
      {subTab === "dashboard" && <SchoolDashboard db={db} toast={toast} />}
      {subTab === "departments" && <DepartmentManagement db={db} toast={toast} />}
      {subTab === "students" && <StudentManagement db={db} toast={toast} />}
      {subTab === "attendance" && <SchoolAttendanceSub db={db} toast={toast} />}
      {subTab === "transfer" && <DepartmentTransfer db={db} toast={toast} />}
      {subTab === "report" && <SchoolReport db={db} toast={toast} />}
    </UnifiedPageLayout>
  );
}
