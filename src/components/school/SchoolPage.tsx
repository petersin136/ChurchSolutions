"use client";

import { useState, useEffect } from "react";
import type { DB } from "@/types/db";
import { SchoolDashboard } from "./SchoolDashboard";
import { DepartmentManagement } from "./DepartmentManagement";
import { StudentManagement } from "./StudentManagement";
import { SchoolAttendanceSub } from "./SchoolAttendanceSub";
import { DepartmentTransfer } from "./DepartmentTransfer";
import { LayoutDashboard, Building2, Users, CalendarCheck, ArrowRightLeft } from "lucide-react";
import { UnifiedPageLayout } from "@/components/layout/UnifiedPageLayout";
import { SCHOOL_SET_SUB_EVENT } from "@/lib/globalSearch";

type SchoolSubTab = "dashboard" | "departments" | "students" | "attendance" | "transfer";

const PAGE_INFO: Record<SchoolSubTab, { title: string; desc: string }> = {
  dashboard: { title: "교회학교 대시보드", desc: "교회학교 현황을 한눈에 확인하세요" },
  departments: { title: "부서 관리", desc: "부서와 반을 관리합니다" },
  students: { title: "학생 명단", desc: "교육부서 학생을 관리합니다" },
  attendance: { title: "출석부", desc: "52주 출석 기록을 관리합니다" },
  transfer: { title: "부서 이동", desc: "학생 부서 이동을 처리합니다" },
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
    ],
  },
];

export interface SchoolPageProps {
  db: DB;
  toast: (msg: string, type?: "ok" | "err" | "warn") => void;
}

const SCHOOL_SUB_TAB_IDS: SchoolSubTab[] = ["dashboard", "departments", "students", "attendance", "transfer"];

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

  useEffect(() => {
    const handler = (e: Event) => {
      const sub = (e as CustomEvent<string>).detail;
      if (typeof sub === "string" && SCHOOL_SUB_TAB_IDS.includes(sub as SchoolSubTab)) {
        setSubTab(sub as SchoolSubTab);
      }
    };
    window.addEventListener(SCHOOL_SET_SUB_EVENT, handler as EventListener);
    return () => window.removeEventListener(SCHOOL_SET_SUB_EVENT, handler as EventListener);
  }, []);

  return (
    <UnifiedPageLayout
      pageTitle="교회학교"
      churchName={((db.settings?.churchName ?? "") as string).trim() || "교회 이름"}
      navSections={NAV_SECTIONS}
      activeId={subTab}
      onNav={(id) => setSubTab(id as SchoolSubTab)}
      versionText="교회학교 v1.0"
      headerTitle={info.title}
      headerDesc={info.desc}
      SidebarIcon={LayoutDashboard}
      accentColor="#4466e0"
    >
      {subTab === "dashboard" && <SchoolDashboard toast={toast} />}
      {subTab === "departments" && <DepartmentManagement db={db} toast={toast} />}
      {subTab === "students" && <StudentManagement db={db} toast={toast} />}
      {subTab === "attendance" && <SchoolAttendanceSub db={db} toast={toast} />}
      {subTab === "transfer" && <DepartmentTransfer db={db} toast={toast} />}
    </UnifiedPageLayout>
  );
}
