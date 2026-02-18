"use client";

import { useMemo } from "react";
import type { DB } from "@/types/db";
import { ReportLayout } from "./ReportLayout";
import { UpcomingEvents } from "./UpcomingEvents";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

export interface SeniorPastorReportProps {
  db: DB;
  toast: (msg: string, type?: "ok" | "err" | "warn") => void;
}

export function SeniorPastorReport({ db, toast }: SeniorPastorReportProps) {
  const now = new Date();
  const year = now.getFullYear();
  const monthStr = `${year}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const incomeThisMonth = useMemo(() => (db.income ?? []).filter((i) => i.date?.slice(0, 7) === monthStr).reduce((s, i) => s + (i.amount ?? 0), 0), [db.income, monthStr]);
  const expenseThisMonth = useMemo(() => (db.expense ?? []).filter((e) => e.date?.slice(0, 7) === monthStr).reduce((s, e) => s + (e.amount ?? 0), 0), [db.expense, monthStr]);
  const newFamilyThisMonth = useMemo(() => db.members.filter((m) => ((m.created_at ?? (m as unknown as { createdAt?: string }).createdAt) ?? "").slice(0, 7) === monthStr), [db.members, monthStr]);
  const visitsThisMonth = useMemo(() => (db.visits ?? []).filter((v) => v.date?.slice(0, 7) === monthStr), [db.visits, monthStr]);

  const recentWeeks = useMemo(() => {
    const getWeekNum = (d: Date) => {
      const s = new Date(d.getFullYear(), 0, 1);
      return Math.ceil(((d.getTime() - s.getTime()) / 864e5 + s.getDay() + 1) / 7);
    };
    const data = [];
    for (let i = 3; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i * 7);
      const w = getWeekNum(d);
      const byMember = db.attendance ?? {};
      let present = 0;
      db.members.forEach((m) => { if (byMember[m.id]?.[w] === "p") present++; });
      data.push({ week: `${d.getMonth() + 1}/${d.getDate()}주`, 출석: present });
    }
    return data;
  }, [db.attendance, db.members, now]);

  const consecutiveAbsent = useMemo(() => {
    const byMember = db.attendance ?? {};
    const currentWeek = Math.ceil((now.getTime() - new Date(year, 0, 1).getTime()) / 864e5 / 7);
    const absent: { name: string; id: string }[] = [];
    db.members.forEach((m) => {
      let count = 0;
      for (let w = currentWeek; w >= Math.max(1, currentWeek - 2); w--) {
        if (byMember[m.id]?.[w] !== "p") count++;
        else break;
      }
      if (count >= 3) absent.push({ name: m.name ?? "", id: m.id });
    });
    return absent;
  }, [db.attendance, db.members, year, now]);

  return (
    <ReportLayout title="담임목사 보고서" period={`${monthStr} 요약`} churchName={db.settings.churchName ?? undefined}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
        <section>
          <h3 className="font-semibold text-[#1e3a5f] mb-2">출석 추이 (최근 4주)</h3>
          {recentWeeks.some((d) => d.출석 > 0) ? (
            <ResponsiveContainer width="100%" height={120}>
              <LineChart data={recentWeeks}>
                <XAxis dataKey="week" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Line type="monotone" dataKey="출석" stroke="#1e3a5f" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : <p className="text-gray-500">데이터 없음</p>}
        </section>
        <section>
          <h3 className="font-semibold text-[#1e3a5f] mb-2">재정 요약 (이번 달)</h3>
          <p>수입 {incomeThisMonth.toLocaleString()}원</p>
          <p>지출 {expenseThisMonth.toLocaleString()}원</p>
          <p>잔액 {(incomeThisMonth - expenseThisMonth).toLocaleString()}원</p>
        </section>
        <section>
          <h3 className="font-semibold text-[#1e3a5f] mb-2">새가족 (이번 달)</h3>
          <p>{newFamilyThisMonth.length}명</p>
        </section>
        <section>
          <h3 className="font-semibold text-[#1e3a5f] mb-2">심방 (이번 달)</h3>
          <p>{visitsThisMonth.length}건</p>
        </section>
        <section className="md:col-span-2">
          <h3 className="font-semibold text-[#1e3a5f] mb-2">주의 필요 (3주 연속 결석)</h3>
          {consecutiveAbsent.length === 0 ? <p className="text-gray-500">해당 없음</p> : <ul className="list-disc pl-5">{consecutiveAbsent.slice(0, 15).map((m) => <li key={m.id}>{m.name}</li>)}</ul>}
        </section>
        <section className="md:col-span-2">
          <h3 className="font-semibold text-[#1e3a5f] mb-2">경조사 예정 (이번 주)</h3>
          <UpcomingEvents members={db.members} />
        </section>
      </div>
    </ReportLayout>
  );
}
