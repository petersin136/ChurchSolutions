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

type StatsSubTab = "dashboard" | "weekly" | "monthly" | "senior" | "department" | "visitPlan" | "upcoming";

const TABS: { id: StatsSubTab; label: string; Icon: React.ComponentType<{ size?: number | string; className?: string }> }[] = [
  { id: "dashboard", label: "종합 통계", Icon: BarChart3 },
  { id: "weekly", label: "주간 보고서", Icon: FileText },
  { id: "monthly", label: "월간 보고서", Icon: Calendar },
  { id: "senior", label: "담임목사 보고서", Icon: User },
  { id: "department", label: "부서별 보고서", Icon: Users },
  { id: "visitPlan", label: "심방 계획서", Icon: MapPin },
  { id: "upcoming", label: "경조사 알림", Icon: Gift },
];

interface StatisticsReportsPageProps {
  db: DB;
  toast: (msg: string, type?: "ok" | "err" | "warn") => void;
}

export function StatisticsReportsPage({ db, toast }: StatisticsReportsPageProps) {
  const [subTab, setSubTab] = useState<StatsSubTab>("dashboard");

  return (
    <div className="min-h-screen bg-[#f8f7f4]">
      <header className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-3">
        <h1 className="text-lg font-bold text-[#1e3a5f]">통계 · 보고</h1>
        <div className="flex flex-wrap gap-2 mt-3">
          {TABS.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setSubTab(id)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition ${
                subTab === id
                  ? "bg-[#1e3a5f] text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              <Icon size={18} />
              {label}
            </button>
          ))}
        </div>
      </header>
      <main className="p-4">
        {subTab === "dashboard" && <StatisticsDashboard db={db} />}
        {subTab === "weekly" && <WeeklyReport db={db} toast={toast} />}
        {subTab === "monthly" && <MonthlyReport db={db} toast={toast} />}
        {subTab === "senior" && <SeniorPastorReport db={db} toast={toast} />}
        {subTab === "department" && <DepartmentReport db={db} toast={toast} />}
        {subTab === "visitPlan" && <VisitPlanReport db={db} toast={toast} />}
        {subTab === "upcoming" && <UpcomingEvents members={db.members} />}
      </main>
    </div>
  );
}
