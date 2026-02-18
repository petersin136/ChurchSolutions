"use client";

import { useState, useMemo } from "react";
import type { DB } from "@/types/db";
import { ReportLayout } from "./ReportLayout";
import { getWeekNum } from "@/lib/store";
import { registerKoreanFont } from "@/utils/fontLoader";

const STORAGE_WEEKLY_MEMO = "report_weekly_memo";
const STORAGE_WEEKLY_PRAYER = "report_weekly_prayer";

function getWeekDates(year: number, weekNum: number): { start: Date; end: Date; label: string } {
  const start = new Date(year, 0, 1);
  const day = start.getDay();
  const diff = weekNum * 7 - (day === 0 ? 0 : 7 - day) - 6;
  start.setDate(diff);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const label = `${start.toLocaleDateString("ko-KR")} ~ ${end.toLocaleDateString("ko-KR")}`;
  return { start, end, label };
}

export interface WeeklyReportProps {
  db: DB;
  toast: (msg: string, type?: "ok" | "err" | "warn") => void;
}

export function WeeklyReport({ db, toast }: WeeklyReportProps) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentWeek = getWeekNum();
  const [year, setYear] = useState(currentYear);
  const [week, setWeek] = useState(currentWeek);
  const [memo, setMemo] = useState(() => (typeof window !== "undefined" ? localStorage.getItem(STORAGE_WEEKLY_MEMO) ?? "" : ""));
  const [prayer, setPrayer] = useState(() => (typeof window !== "undefined" ? localStorage.getItem(STORAGE_WEEKLY_PRAYER) ?? "" : ""));

  const weekDates = useMemo(() => getWeekDates(year, week), [year, week]);
  const startStr = weekDates.start.toISOString().slice(0, 10);
  const endStr = weekDates.end.toISOString().slice(0, 10);

  const saveMemo = (v: string) => {
    setMemo(v);
    if (typeof window !== "undefined") localStorage.setItem(STORAGE_WEEKLY_MEMO, v);
  };
  const savePrayer = (v: string) => {
    setPrayer(v);
    if (typeof window !== "undefined") localStorage.setItem(STORAGE_WEEKLY_PRAYER, v);
  };

  const attendanceSummary = useMemo(() => {
    const byMember = db.attendance ?? {};
    let present = 0;
    let absent = 0;
    db.members.forEach((m) => {
      const status = byMember[m.id]?.[week];
      if (status === "p") present++;
      else if (status === "a") absent++;
    });
    return { present, absent, total: db.members.length };
  }, [db.attendance, db.members, week]);

  const newFamilyThisWeek = useMemo(() => {
    return db.members.filter((m) => {
      const created = (m.created_at ?? (m as unknown as { createdAt?: string }).createdAt)?.slice(0, 10);
      return created && created >= startStr && created <= endStr;
    });
  }, [db.members, startStr, endStr]);

  const visitsThisWeek = useMemo(() => {
    return (db.visits ?? []).filter((v) => v.date >= startStr && v.date <= endStr);
  }, [db.visits, startStr, endStr]);

  const incomeThisWeek = useMemo(() => {
    const list = (db.income ?? []).filter((i) => i.date >= startStr && i.date <= endStr);
    const total = list.reduce((s, i) => s + (i.amount ?? 0), 0);
    const byCat: Record<string, number> = {};
    list.forEach((i) => {
      const cat = i.type || "기타";
      byCat[cat] = (byCat[cat] ?? 0) + (i.amount ?? 0);
    });
    return { total, byCat, list };
  }, [db.income, startStr, endStr]);

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
      doc.text(`주간 사역보고서 (${weekDates.label})`, 20, y);
      y += 10;
      doc.setFontSize(10);
      doc.text(`예배 출석: ${attendanceSummary.present}명 / 결석: ${attendanceSummary.absent}명`, 20, y);
      y += 6;
      doc.text(`새가족: ${newFamilyThisWeek.length}명`, 20, y);
      y += 6;
      doc.text(`심방: ${visitsThisWeek.length}건`, 20, y);
      y += 6;
      doc.text(`헌금 합계: ${incomeThisWeek.total.toLocaleString()}원`, 20, y);
      y += 10;
      if (memo) doc.text("주요 일정/메모: " + memo.slice(0, 200), 20, y);
      y += memo ? 8 : 0;
      if (prayer) doc.text("기도제목: " + prayer.slice(0, 200), 20, y);
      doc.save(`주간보고서_${startStr}_${endStr}.pdf`);
      toast("PDF가 다운로드되었습니다", "ok");
    } catch (e) {
      console.error(e);
      toast("PDF 생성 실패", "err");
    }
  };

  const weekOptions = Array.from({ length: 52 }, (_, i) => i + 1);

  return (
    <ReportLayout
      title="주간 사역보고서"
      period={weekDates.label}
      churchName={db.settings.churchName ?? undefined}
      onPdfDownload={handlePdf}
    >
      <div className="no-print mb-6 flex flex-wrap gap-4">
        <label className="flex items-center gap-2">
          <span className="text-sm">연도</span>
          <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="rounded border px-2 py-1 text-sm">
            {[currentYear, currentYear - 1].map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2">
          <span className="text-sm">주</span>
          <select value={week} onChange={(e) => setWeek(Number(e.target.value))} className="rounded border px-2 py-1 text-sm">
            {weekOptions.map((w) => <option key={w} value={w}>{w}주</option>)}
          </select>
        </label>
      </div>

      <div className="space-y-6 text-sm">
        <section>
          <h3 className="font-semibold text-[#1e3a5f] mb-2">예배 출석 현황</h3>
          <p>출석 {attendanceSummary.present}명 / 온라인 - / 결석 {attendanceSummary.absent}명 (총 {attendanceSummary.total}명)</p>
        </section>
        <section>
          <h3 className="font-semibold text-[#1e3a5f] mb-2">새가족 현황</h3>
          {newFamilyThisWeek.length === 0 ? <p>이번 주 등록 새가족 없음</p> : <ul className="list-disc pl-5">{newFamilyThisWeek.map((m) => <li key={m.id}>{m.name} ({m.dept ?? "-"})</li>)}</ul>}
        </section>
        <section>
          <h3 className="font-semibold text-[#1e3a5f] mb-2">심방 현황</h3>
          <p>이번 주 심방 {visitsThisWeek.length}건</p>
          {visitsThisWeek.length > 0 && <ul className="list-disc pl-5 mt-1">{visitsThisWeek.slice(0, 20).map((v, i) => <li key={i}>{v.date} - {v.type}</li>)}</ul>}
        </section>
        <section>
          <h3 className="font-semibold text-[#1e3a5f] mb-2">헌금 현황</h3>
          <p>이번 주 총 수입 {incomeThisWeek.total.toLocaleString()}원</p>
          {Object.entries(incomeThisWeek.byCat).length > 0 && <ul className="list-disc pl-5 mt-1">{Object.entries(incomeThisWeek.byCat).map(([cat, amt]) => <li key={cat}>{cat}: {amt.toLocaleString()}원</li>)}</ul>}
        </section>
        <section>
          <h3 className="font-semibold text-[#1e3a5f] mb-2">주요 일정/메모</h3>
          <textarea value={memo} onChange={(e) => saveMemo(e.target.value)} className="w-full rounded border p-2 text-sm min-h-[80px]" placeholder="수동 입력" />
        </section>
        <section>
          <h3 className="font-semibold text-[#1e3a5f] mb-2">기도제목</h3>
          <textarea value={prayer} onChange={(e) => savePrayer(e.target.value)} className="w-full rounded border p-2 text-sm min-h-[80px]" placeholder="수동 입력" />
        </section>
      </div>
    </ReportLayout>
  );
}
