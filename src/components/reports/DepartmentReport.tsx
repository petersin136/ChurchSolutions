"use client";

import { useState, useMemo } from "react";
import type { DB } from "@/types/db";
import { ReportLayout } from "./ReportLayout";

export interface DepartmentReportProps {
  db: DB;
  toast: (msg: string, type?: "ok" | "err" | "warn") => void;
}

export function DepartmentReport({ db, toast }: DepartmentReportProps) {
  const depts = useMemo(() => {
    const list = (db.settings.depts ?? "").split(",").map((d) => d.trim()).filter(Boolean);
    return list.length > 0 ? list : Array.from(new Set(db.members.map((m) => m.dept).filter(Boolean))) as string[];
  }, [db.settings.depts, db.members]);

  const [dept, setDept] = useState(depts[0] ?? "");

  const membersInDept = useMemo(() => db.members.filter((m) => (m.dept ?? "") === dept), [db.members, dept]);

  const attendanceRate = useMemo(() => {
    if (membersInDept.length === 0) return 0;
    const byMember = db.attendance ?? {};
    let totalPresent = 0;
    let totalPossible = 0;
    membersInDept.forEach((m) => {
      const att = byMember[m.id] ?? {};
      for (let w = 1; w <= 52; w++) {
        totalPossible++;
        if (att[w] === "p") totalPresent++;
      }
    });
    return totalPossible > 0 ? Math.round((totalPresent / totalPossible) * 100) : 0;
  }, [membersInDept, db.attendance]);

  const visitsForDept = useMemo(() => {
    const ids = new Set(membersInDept.map((m) => m.id));
    return (db.visits ?? []).filter((v) => ids.has(v.memberId ?? ""));
  }, [db.visits, membersInDept]);

  return (
    <ReportLayout title="부서별 보고서" period={dept || "부서 선택"} churchName={db.settings.churchName ?? undefined}>
      <div className="no-print mb-6">
        <label className="flex items-center gap-2">
          <span className="text-sm font-medium">부서</span>
          <select value={dept} onChange={(e) => setDept(e.target.value)} className="rounded border px-3 py-2 text-sm">
            {depts.map((d) => <option key={d} value={d}>{d}</option>)}
            {depts.length === 0 && <option value="">전체</option>}
          </select>
        </label>
      </div>
      <div className="space-y-6 text-sm">
        <section>
          <h3 className="font-semibold text-[#1e3a5f] mb-2">소속 교인 ({membersInDept.length}명)</h3>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead><tr className="border-b"><th className="text-left py-2">이름</th><th className="text-left py-2">직분</th><th className="text-right py-2">출석률</th></tr></thead>
              <tbody>
                {membersInDept.map((m) => {
                  const att = (db.attendance ?? {})[m.id] ?? {};
                  let p = 0;
                  for (let w = 1; w <= 52; w++) if (att[w] === "p") p++;
                  const rate = 52 > 0 ? Math.round((p / 52) * 100) : 0;
                  return (
                    <tr key={m.id} className="border-b border-gray-100">
                      <td className="py-2">{m.name}</td>
                      <td className="py-2">{m.role ?? "-"}</td>
                      <td className="text-right py-2">{rate}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
        <section>
          <h3 className="font-semibold text-[#1e3a5f] mb-2">부서 출석률</h3>
          <p>{attendanceRate}%</p>
        </section>
        <section>
          <h3 className="font-semibold text-[#1e3a5f] mb-2">심방 현황</h3>
          <p>{visitsForDept.length}건</p>
        </section>
      </div>
    </ReportLayout>
  );
}
