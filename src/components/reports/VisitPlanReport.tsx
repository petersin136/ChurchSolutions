"use client";

import { useState, useMemo } from "react";
import type { DB } from "@/types/db";
import { ReportLayout } from "./ReportLayout";

export interface VisitPlanReportProps {
  db: DB;
  toast: (msg: string, type?: "ok" | "err" | "warn") => void;
}

export function VisitPlanReport({ db, toast }: VisitPlanReportProps) {
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().slice(0, 10);
  });

  const plannedVisits = useMemo(() => {
    const list = (db.visits ?? []).filter((v) => v.date >= startDate && v.date <= endDate);
    const withMember = list.map((v) => {
      const member = db.members.find((m) => m.id === v.memberId);
      return { ...v, member };
    });
    return withMember.sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));
  }, [db.visits, db.members, startDate, endDate]);

  return (
    <ReportLayout title="심방/업무 계획서" period={`${startDate} ~ ${endDate}`} churchName={db.settings.churchName ?? undefined}>
      <div className="no-print mb-6 flex flex-wrap gap-4">
        <label className="flex items-center gap-2">
          <span className="text-sm">시작일</span>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="rounded border px-2 py-1 text-sm" />
        </label>
        <label className="flex items-center gap-2">
          <span className="text-sm">종료일</span>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="rounded border px-2 py-1 text-sm" />
        </label>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="text-left py-2 px-2">날짜</th>
              <th className="text-left py-2 px-2">대상</th>
              <th className="text-left py-2 px-2">연락처</th>
              <th className="text-left py-2 px-2">주소</th>
              <th className="text-left py-2 px-2">유형</th>
              <th className="text-left py-2 px-2 w-8">✓</th>
            </tr>
          </thead>
          <tbody>
            {plannedVisits.length === 0 ? (
              <tr><td colSpan={6} className="py-8 text-center text-gray-500">해당 기간 예정 심방이 없습니다.</td></tr>
            ) : (
              plannedVisits.map((v, i) => (
                <tr key={i} className="border-b border-gray-100 hover:bg-gray-50/50">
                  <td className="py-2 px-2">{v.date}</td>
                  <td className="py-2 px-2">{v.member?.name ?? "-"}</td>
                  <td className="py-2 px-2">{v.member?.phone ?? "-"}</td>
                  <td className="py-2 px-2">{v.member?.address ?? "-"}</td>
                  <td className="py-2 px-2">{v.type ?? "-"}</td>
                  <td className="py-2 px-2"><input type="checkbox" className="rounded" readOnly /></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </ReportLayout>
  );
}
