"use client";

import { useState } from "react";
import type { DB } from "@/types/db";
import { StatisticsDashboard } from "@/components/statistics/StatisticsDashboard";
import { WeeklyReport } from "@/components/reports/WeeklyReport";
import { MonthlyReport } from "@/components/reports/MonthlyReport";
import { SeniorPastorReport } from "@/components/reports/SeniorPastorReport";
import { DepartmentReport } from "@/components/reports/DepartmentReport";
import { VisitPlanReport } from "@/components/reports/VisitPlanReport";
import { UpcomingEvents } from "@/components/reports/UpcomingEvents";
import { BarChart3, FileText, Calendar, User, Users, MapPin, Gift } from "lucide-react";
import { UnifiedPageLayout } from "@/components/layout/UnifiedPageLayout";

type StatsSubTab = "dashboard" | "weekly" | "monthly" | "senior" | "department" | "visitPlan" | "upcoming";

const PAGE_INFO: Record<StatsSubTab, { title: string; desc: string }> = {
  dashboard: { title: "종합 통계", desc: "교인·출결·재정·심방·새가족 통계를 한눈에 확인하세요" },
  weekly: { title: "주간 보고서", desc: "주간 보고서를 작성하고 내보냅니다" },
  monthly: { title: "월간 보고서", desc: "월간 보고서를 작성하고 내보냅니다" },
  senior: { title: "담임목사 보고서", desc: "담임목사용 보고서" },
  department: { title: "부서별 보고서", desc: "부서별 현황 보고서" },
  visitPlan: { title: "심방 계획서", desc: "심방/업무 계획을 정리합니다" },
  upcoming: { title: "경조사 알림", desc: "다가오는 경조사를 확인합니다" },
};

const NAV_SECTIONS = [
  {
    sectionLabel: "통계 · 보고",
    items: [
      { id: "dashboard" as const, label: "종합 통계", Icon: BarChart3 },
      { id: "weekly" as const, label: "주간 보고서", Icon: FileText },
      { id: "monthly" as const, label: "월간 보고서", Icon: Calendar },
      { id: "senior" as const, label: "담임목사 보고서", Icon: User },
      { id: "department" as const, label: "부서별 보고서", Icon: Users },
      { id: "visitPlan" as const, label: "심방 계획서", Icon: MapPin },
      { id: "upcoming" as const, label: "경조사 알림", Icon: Gift },
    ],
  },
];

interface StatisticsReportsPageProps {
  db: DB;
  toast: (msg: string, type?: "ok" | "err" | "warn") => void;
}

export function StatisticsReportsPage({ db, toast }: StatisticsReportsPageProps) {
  const [subTab, setSubTab] = useState<StatsSubTab>("dashboard");
  const info = PAGE_INFO[subTab];

  return (
    <UnifiedPageLayout
      pageTitle="통계 · 보고"
      pageSubtitle={new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" })}
      navSections={NAV_SECTIONS}
      activeId={subTab}
      onNav={(id) => setSubTab(id as StatsSubTab)}
      versionText="통계/보고 v1.0"
      headerTitle={info.title}
      headerDesc={info.desc}
      SidebarIcon={BarChart3}
    >
      {subTab === "dashboard" && <StatisticsDashboard db={db} />}
      {subTab === "weekly" && <WeeklyReport db={db} toast={toast} />}
      {subTab === "monthly" && <MonthlyReport db={db} toast={toast} />}
      {subTab === "senior" && <SeniorPastorReport db={db} toast={toast} />}
      {subTab === "department" && <DepartmentReport db={db} toast={toast} />}
      {subTab === "visitPlan" && <VisitPlanReport db={db} toast={toast} />}
      {subTab === "upcoming" && <UpcomingEvents members={db.members} />}
    </UnifiedPageLayout>
  );
}
