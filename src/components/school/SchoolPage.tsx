"use client";

import { useState } from "react";
import type { DB } from "@/types/db";
import { SchoolDashboard } from "./SchoolDashboard";
import { DepartmentManagement } from "./DepartmentManagement";
import { StudentManagement } from "./StudentManagement";
import { SchoolAttendanceCheck } from "./SchoolAttendanceCheck";
import { SchoolAttendanceStats } from "./SchoolAttendanceStats";
import { DepartmentTransfer } from "./DepartmentTransfer";
import { SchoolReport } from "./SchoolReport";

const SCHOOL_INDIGO = "#4F46E5";

const SUB_TABS: { id: string; label: string }[] = [
  { id: "dashboard", label: "대시보드" },
  { id: "departments", label: "부서 관리" },
  { id: "students", label: "학생 관리" },
  { id: "attendance", label: "출석 체크" },
  { id: "attendanceStats", label: "출석 통계" },
  { id: "transfer", label: "부서 이동" },
  { id: "report", label: "보고서" },
];

export interface SchoolPageProps {
  db: DB;
  toast: (msg: string, type?: "ok" | "err" | "warn") => void;
}

export function SchoolPage({ db, toast }: SchoolPageProps) {
  const [subTab, setSubTab] = useState("dashboard");

  return (
    <div className="min-h-full flex flex-col" style={{ background: "#f8f7f4" }}>
      <div className="flex border-b border-gray-200 bg-white px-2 overflow-x-auto shrink-0">
        {SUB_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setSubTab(tab.id)}
            className="px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors"
            style={{
              borderBottomColor: subTab === tab.id ? SCHOOL_INDIGO : "transparent",
              color: subTab === tab.id ? SCHOOL_INDIGO : "#6b7280",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-auto p-4">
        {subTab === "dashboard" && <SchoolDashboard db={db} toast={toast} />}
        {subTab === "departments" && <DepartmentManagement db={db} toast={toast} />}
        {subTab === "students" && <StudentManagement db={db} toast={toast} />}
        {subTab === "attendance" && <SchoolAttendanceCheck db={db} toast={toast} />}
        {subTab === "attendanceStats" && <SchoolAttendanceStats db={db} toast={toast} />}
        {subTab === "transfer" && <DepartmentTransfer db={db} toast={toast} />}
        {subTab === "report" && <SchoolReport db={db} toast={toast} />}
      </div>
    </div>
  );
}
