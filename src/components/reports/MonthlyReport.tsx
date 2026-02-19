"use client";

import { useState, useMemo, useEffect } from "react";
import type { DB } from "@/types/db";
import { ReportLayout } from "./ReportLayout";
import { registerKoreanFont } from "@/utils/fontLoader";
import { supabase } from "@/lib/supabase";

const STORAGE_MONTHLY_CONTENT = "report_monthly_content";
const STORAGE_MONTHLY_PLAN = "report_monthly_plan";

export interface MonthlyReportProps {
  db: DB;
  toast: (msg: string, type?: "ok" | "err" | "warn") => void;
}

export function MonthlyReport({ db, toast }: MonthlyReportProps) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [content, setContent] = useState(() => (typeof window !== "undefined" ? localStorage.getItem(STORAGE_MONTHLY_CONTENT) ?? "" : ""));
  const [plan, setPlan] = useState(() => (typeof window !== "undefined" ? localStorage.getItem(STORAGE_MONTHLY_PLAN) ?? "" : ""));

  const monthStr = `${year}-${String(month).padStart(2, "0")}`;
  const periodLabel = `${year}년 ${month}월`;
  const monthStart = `${monthStr}-01`;
  const monthEnd = `${monthStr}-${new Date(year, month, 0).getDate().toString().padStart(2, "0")}`;

  const [attendanceRows, setAttendanceRows] = useState<{ member_id: string; date: string; status: string }[]>([]);
  useEffect(() => {
    if (!supabase) {
      setAttendanceRows([]);
      return;
    }
    supabase
      .from("attendance")
      .select("member_id, date, status")
      .gte("date", monthStart)
      .lte("date", monthEnd)
      .then(({ data, error }) => {
        if (error) {
          setAttendanceRows([]);
          return;
        }
        setAttendanceRows(
          (data ?? []).map((r: Record<string, unknown>) => ({
            member_id: String(r.member_id ?? ""),
            date: String(r.date ?? ""),
            status: String(r.status ?? ""),
          }))
        );
      });
  }, [monthStart, monthEnd]);

  const attendanceSummary = useMemo(() => {
    const total = db.members.length;
    if (attendanceRows.length > 0) {
      const presentIds = new Set<string>();
      const absentIds = new Set<string>();
      attendanceRows.forEach((r) => {
        if (r.status === "p" || r.status === "출석") presentIds.add(r.member_id);
        else if (r.status === "a" || r.status === "결석") absentIds.add(r.member_id);
      });
      return { present: presentIds.size, absent: absentIds.size, total };
    }
    return { present: 0, absent: 0, total };
  }, [db.members.length, attendanceRows]);

  const newFamilyThisMonth = useMemo(() => db.members.filter((m) => ((m.created_at ?? (m as unknown as { createdAt?: string }).createdAt) ?? "").slice(0, 7) === monthStr), [db.members, monthStr]);
  const visitsThisMonth = useMemo(() => (db.visits ?? []).filter((v) => v.date?.slice(0, 7) === monthStr), [db.visits, monthStr]);
  const incomeThisMonth = useMemo(() => (db.income ?? []).filter((i) => i.date?.slice(0, 7) === monthStr).reduce((s, i) => s + (i.amount ?? 0), 0), [db.income, monthStr]);
  const expenseThisMonth = useMemo(() => (db.expense ?? []).filter((e) => e.date?.slice(0, 7) === monthStr).reduce((s, e) => s + (e.amount ?? 0), 0), [db.expense, monthStr]);

  const saveContent = (v: string) => {
    setContent(v);
    if (typeof window !== "undefined") localStorage.setItem(STORAGE_MONTHLY_CONTENT, v);
  };
  const savePlan = (v: string) => {
    setPlan(v);
    if (typeof window !== "undefined") localStorage.setItem(STORAGE_MONTHLY_PLAN, v);
  };

  const handlePdf = async () => {
    try {
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({ unit: "mm", format: "a4" });
      await registerKoreanFont(doc);
      doc.setFont("NanumGothic", "normal");
      let y = 20;
      doc.setFontSize(14);
      doc.text(db.settings.churchName || "교회", 20, y);
      y += 8;
      doc.setFontSize(12);
      doc.text(`월간 사역보고서 (${periodLabel})`, 20, y);
      y += 10;
      doc.setFontSize(10);
      doc.text(`예배 출석: ${attendanceSummary.present}명 / 결석: ${attendanceSummary.absent}명`, 20, y);
      y += 6;
      doc.text(`새가족: ${newFamilyThisMonth.length}명`, 20, y);
      y += 6;
      doc.text(`심방: ${visitsThisMonth.length}건`, 20, y);
      y += 6;
      doc.text(`수입: ${incomeThisMonth.toLocaleString()}원 / 지출: ${expenseThisMonth.toLocaleString()}원`, 20, y);
      doc.save(`월간보고서_${monthStr}.pdf`);
      toast("PDF가 다운로드되었습니다", "ok");
    } catch (e) {
      console.error(e);
      toast("PDF 생성 실패", "err");
    }
  };

  return (
    <ReportLayout title="월간 사역보고서" period={periodLabel} churchName={db.settings.churchName ?? undefined} onPdfDownload={handlePdf}>
      <div className="no-print mb-6 flex flex-wrap gap-4">
        <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="rounded border px-2 py-1 text-sm">
          {[now.getFullYear(), now.getFullYear() - 1].map((y) => <option key={y} value={y}>{y}년</option>)}
        </select>
        <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className="rounded border px-2 py-1 text-sm">
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => <option key={m} value={m}>{m}월</option>)}
        </select>
      </div>
      <div className="space-y-6 text-sm">
        <section>
          <h3 className="font-semibold text-[#1e3a5f] mb-2">월간 출석 현황</h3>
          <p>출석 {attendanceSummary.present}명 / 결석 {attendanceSummary.absent}명{attendanceRows.length === 0 ? " (Supabase 출석 데이터 없음)" : ""}</p>
        </section>
        <section>
          <h3 className="font-semibold text-[#1e3a5f] mb-2">월간 새가족 현황</h3>
          <p>{newFamilyThisMonth.length}명</p>
        </section>
        <section>
          <h3 className="font-semibold text-[#1e3a5f] mb-2">월간 심방 현황</h3>
          <p>{visitsThisMonth.length}건</p>
        </section>
        <section>
          <h3 className="font-semibold text-[#1e3a5f] mb-2">월간 재정 현황</h3>
          <p>수입 {incomeThisMonth.toLocaleString()}원 / 지출 {expenseThisMonth.toLocaleString()}원</p>
        </section>
        <section>
          <h3 className="font-semibold text-[#1e3a5f] mb-2">주요 사역 내용</h3>
          <textarea value={content} onChange={(e) => saveContent(e.target.value)} className="w-full rounded border p-2 text-sm min-h-[80px]" placeholder="수동 입력" />
        </section>
        <section>
          <h3 className="font-semibold text-[#1e3a5f] mb-2">다음 달 계획</h3>
          <textarea value={plan} onChange={(e) => savePlan(e.target.value)} className="w-full rounded border p-2 text-sm min-h-[80px]" placeholder="수동 입력" />
        </section>
      </div>
    </ReportLayout>
  );
}
