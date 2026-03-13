"use client";

import React, { useRef, useState, useMemo } from "react";
import type { DB } from "@/types/db";
import { getWeekNum } from "@/lib/store";
import { FileText, Users, CalendarCheck, Heart, ArrowLeft, Printer, Download, UserPlus } from "lucide-react";

/* ================================================================
   Shared helpers
   ================================================================ */

function getLastSunday(d: Date): Date {
  const r = new Date(d);
  r.setDate(r.getDate() - r.getDay());
  r.setHours(0, 0, 0, 0);
  return r;
}

function getRecentSundays(count: number): string[] {
  const out: string[] = [];
  const d = new Date();
  for (let i = 0; i < count; i++) {
    const sun = getLastSunday(d);
    sun.setDate(sun.getDate() - i * 7);
    out.unshift(sun.toISOString().slice(0, 10));
  }
  return out;
}

function getWeekFromDate(dateStr: string): number {
  const d = new Date(dateStr);
  const jan1 = new Date(d.getFullYear(), 0, 1);
  return Math.ceil(((d.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7);
}

const NOTE_TARGET_CHURCH = "__church__";

function paginateItems<T>(items: T[], firstPageCount: number, otherPageCount: number): T[][] {
  const pages: T[][] = [];
  if (items.length === 0) return [[]];
  pages.push(items.slice(0, firstPageCount));
  let remaining = items.slice(firstPageCount);
  while (remaining.length > 0) {
    pages.push(remaining.slice(0, otherPageCount));
    remaining = remaining.slice(otherPageCount);
  }
  return pages;
}

/* ================================================================
   ReportPage wrapper (one A4 page)
   ================================================================ */

function ReportPage({ children, pageNum, totalPages }: {
  children: React.ReactNode; pageNum: number; totalPages: number;
}) {
  return (
    <div
      data-report-page={pageNum}
      style={{
        width: "210mm",
        minHeight: "297mm",
        height: "297mm",
        padding: "25mm 20mm 30mm 20mm",
        backgroundColor: "white",
        position: "relative",
        overflow: "hidden",
        boxSizing: "border-box",
        marginBottom: 8,
        boxShadow: "0 1px 4px rgba(0,0,0,0.10)",
      }}
    >
      <div style={{ height: "100%", overflow: "hidden" }}>
        {children}
      </div>
      <div style={{ position: "absolute", bottom: "15mm", left: 0, right: 0, textAlign: "center" }}>
        <span style={{ fontSize: 10, color: "#9ca3af", letterSpacing: "0.1em" }}>{pageNum} / {totalPages}</span>
      </div>
    </div>
  );
}

/* ================================================================
   Shared sub-components
   ================================================================ */

function SectionTitle({ num, title }: { num: string; title: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, marginTop: 4 }}>
      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.15em", color: "#111" }}>{num}</span>
      <span style={{ fontSize: 14, fontWeight: 700, color: "#111" }}>{title}</span>
      <div style={{ flex: 1, height: 1, background: "#e5e7eb", marginLeft: 8 }} />
    </div>
  );
}

function StatBox({ label, value, unit }: { label: string; value: string | number; unit: string }) {
  return (
    <div style={{ padding: 14, border: "1px solid #e5e7eb", borderRadius: 6 }}>
      <p style={{ fontSize: 10, color: "#6b7280", margin: "0 0 4px" }}>{label}</p>
      <p style={{ fontSize: 22, fontWeight: 700, lineHeight: 1, margin: 0 }}>{value}<span style={{ fontSize: 11, fontWeight: 400, color: "#6b7280" }}>{unit}</span></p>
    </div>
  );
}

function ReportHeader({ churchName, enTitle, krTitle, dateLabel }: { churchName: string; enTitle: string; krTitle: string; dateLabel: string }) {
  return (
    <div style={{ textAlign: "center", marginBottom: 32 }}>
      <p style={{ fontSize: 10, letterSpacing: "0.2em", color: "#6b7280", textTransform: "uppercase" as const, margin: "0 0 8px" }}>{enTitle}</p>
      <h1 style={{ fontSize: 26, fontWeight: 700, margin: "0 0 4px", letterSpacing: "-0.02em" }}>{churchName}</h1>
      <div style={{ width: 40, height: 2, background: "#111", margin: "12px auto" }} />
      <p style={{ fontSize: 13, color: "#374151", margin: "0 0 4px" }}>{krTitle}</p>
      <p style={{ fontSize: 11, color: "#9ca3af", margin: 0 }}>{dateLabel}</p>
    </div>
  );
}

function ReportFooter({ churchName, reportTitle }: { churchName: string; reportTitle: string }) {
  return (
    <div style={{ marginTop: "auto", paddingTop: 16, borderTop: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <p style={{ fontSize: 10, color: "#9ca3af", margin: 0 }}>{churchName} · {reportTitle}</p>
      <p style={{ fontSize: 10, color: "#9ca3af", margin: 0 }}>생성일: {new Date().toLocaleDateString("ko-KR")}</p>
    </div>
  );
}

const TH: React.CSSProperties = { textAlign: "left", padding: "8px 6px", fontWeight: 600, fontSize: 11, letterSpacing: "0.05em" };
const TH_C: React.CSSProperties = { textAlign: "center", padding: "8px 6px", fontWeight: 600, fontSize: 11 };
const TD: React.CSSProperties = { padding: "6px", fontSize: 12, borderBottom: "1px solid #f3f4f6" };
const TD_C: React.CSSProperties = { padding: "6px", fontSize: 12, textAlign: "center", borderBottom: "1px solid #f3f4f6" };
const TBL: React.CSSProperties = { width: "100%", borderCollapse: "collapse", fontSize: 12 };

/* ================================================================
   1. Weekly Pastoral Report
   ================================================================ */

export function WeeklyReport({ db, churchName, churchId }: { db: DB; churchName: string; churchId: string }) {
  const today = new Date();
  const thisWeekSunday = getLastSunday(today);
  const sundayLabel = thisWeekSunday.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });
  const currentWeek = getWeekNum();

  const members = useMemo(() => db.members.filter(m => (m.member_status || m.status) !== "졸업/전출"), [db.members]);
  const totalMembers = members.length;

  const attendCount = useMemo(() => members.filter(m => {
    const s = (db.attendance[m.id] || {})[currentWeek];
    return s === "p" || s === "o";
  }).length, [members, db.attendance, currentWeek]);

  const attendRate = totalMembers > 0 ? Math.round(attendCount / totalMembers * 100) : 0;

  const absentMembers = useMemo(() => members.filter(m => {
    const s = (db.attendance[m.id] || {})[currentWeek];
    return s === "a";
  }).map(m => {
    const reasons = db.attendanceReasons?.[m.id] || {};
    return { name: m.name, dept: m.dept || "", note: reasons[currentWeek] || "" };
  }), [members, db.attendance, db.attendanceReasons, currentWeek]);

  const unknownCount = totalMembers - attendCount - absentMembers.length;

  const newFamilies = useMemo(() => members.filter(m => m.is_new_family === true).map(m => {
    const prg = (db.newFamilyPrograms || []).find(p => p.member_id === m.id);
    const completedWeeks = [prg?.week1_completed, prg?.week2_completed, prg?.week3_completed, prg?.week4_completed].filter(Boolean).length;
    return { name: m.name, registeredDate: m.first_visit_date || (m as any).firstVisitDate || m.createdAt?.slice(0, 10) || "", step: `${completedWeeks}/4주`, status: prg?.status || "진행중" };
  }), [members, db.newFamilyPrograms]);

  const prayers = useMemo(() => {
    const rows: { memberName: string; content: string }[] = [];
    Object.keys(db.notes).forEach(mid => {
      const mbr = db.members.find(x => x.id === mid);
      const name = mid === NOTE_TARGET_CHURCH ? "교회 전체" : (mbr?.name || "");
      (db.notes[mid] || []).filter(n => n.type === "prayer").forEach(n => {
        rows.push({ memberName: name, content: n.content });
      });
    });
    db.members.forEach(m => {
      if (!m.prayer?.trim()) return;
      const already = (db.notes[m.id] || []).some(n => n.type === "prayer" && n.content === m.prayer);
      if (already) return;
      rows.push({ memberName: m.name, content: m.prayer });
    });
    return rows.slice(0, 30);
  }, [db]);

  const absentPages = paginateItems(absentMembers, 8, 20);

  const pages: React.ReactNode[] = [];

  // Page 1: header + summary + absent (partial)
  pages.push(
    <div key="p1" style={{ color: "#111", lineHeight: 1.7 }}>
      <ReportHeader churchName={churchName} enTitle="Weekly Pastoral Report" krTitle="주간 목양 보고서" dateLabel={`${sundayLabel} 주일 기준`} />
      <SectionTitle num="01" title="금주 요약" />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12, marginBottom: 28 }}>
        <StatBox label="전체 성도" value={totalMembers} unit="명" />
        <StatBox label="금주 출석" value={attendCount} unit="명" />
        <StatBox label="출석률" value={attendRate} unit="%" />
        <StatBox label="새가족" value={newFamilies.length} unit="명" />
      </div>
      <SectionTitle num="02" title="결석 현황" />
      <p style={{ fontSize: 11, color: "#6b7280", margin: "0 0 8px" }}>출석 {attendCount}명 / 결석 {absentMembers.length}명 / 미확인 {unknownCount}명</p>
      {absentMembers.length === 0 ? (
        <p style={{ fontSize: 12, color: "#9ca3af" }}>금주 결석자가 없습니다.</p>
      ) : (
        <table style={TBL}>
          <thead><tr style={{ borderBottom: "2px solid #111" }}><th style={TH}>이름</th><th style={TH}>부서</th><th style={TH_C}>출석</th><th style={TH}>사유</th></tr></thead>
          <tbody>
            {(absentPages[0] || []).map((m, i) => (
              <tr key={i}><td style={TD}>{m.name}</td><td style={TD}>{m.dept}</td><td style={{ ...TD_C, color: "#ef4444" }}>결석</td><td style={{ ...TD, color: "#6b7280" }}>{m.note || "—"}</td></tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );

  // Extra absent pages
  for (let i = 1; i < absentPages.length; i++) {
    pages.push(
      <div key={`absent-${i}`} style={{ color: "#111", lineHeight: 1.7 }}>
        <SectionTitle num="02" title="결석 현황 (계속)" />
        <table style={TBL}>
          <thead><tr style={{ borderBottom: "2px solid #111" }}><th style={TH}>이름</th><th style={TH}>부서</th><th style={TH_C}>출석</th><th style={TH}>사유</th></tr></thead>
          <tbody>
            {absentPages[i].map((m, j) => (
              <tr key={j}><td style={TD}>{m.name}</td><td style={TD}>{m.dept}</td><td style={{ ...TD_C, color: "#ef4444" }}>결석</td><td style={{ ...TD, color: "#6b7280" }}>{m.note || "—"}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // Prayer page(s)
  const prayerPages = paginateItems(prayers, 10, 14);
  prayerPages.forEach((chunk, idx) => {
    pages.push(
      <div key={`prayer-${idx}`} style={{ color: "#111", lineHeight: 1.7 }}>
        <SectionTitle num="03" title={idx === 0 ? "기도제목" : "기도제목 (계속)"} />
        {chunk.length === 0 ? (
          <p style={{ fontSize: 12, color: "#9ca3af" }}>등록된 기도제목이 없습니다.</p>
        ) : chunk.map((p, i) => (
          <div key={i} style={{ marginBottom: 14, paddingLeft: 12, borderLeft: "2px solid #d1d5db" }}>
            <p style={{ fontSize: 12, fontWeight: 600, margin: "0 0 2px" }}>{p.memberName}</p>
            <p style={{ fontSize: 12, color: "#374151", lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-word", margin: 0 }}>{p.content}</p>
          </div>
        ))}
      </div>
    );
  });

  // New family page
  if (newFamilies.length > 0) {
    pages.push(
      <div key="nf" style={{ color: "#111", lineHeight: 1.7 }}>
        <SectionTitle num="04" title="새가족 현황" />
        <table style={TBL}>
          <thead><tr style={{ borderBottom: "2px solid #111" }}><th style={TH}>이름</th><th style={TH}>등록일</th><th style={TH_C}>진행 단계</th><th style={TH}>상태</th></tr></thead>
          <tbody>
            {newFamilies.map((nf, i) => (
              <tr key={i}><td style={TD}>{nf.name}</td><td style={{ ...TD, color: "#6b7280" }}>{nf.registeredDate}</td><td style={TD_C}>{nf.step}</td><td style={TD}>{nf.status}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // Add footer to the last page's content
  const lastIdx = pages.length - 1;
  const lastContent = pages[lastIdx];
  pages[lastIdx] = (
    <div key={`last-${lastIdx}`} style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ flex: 1 }}>{lastContent}</div>
      <ReportFooter churchName={churchName} reportTitle="주간 목양 보고서" />
    </div>
  );

  const totalPages = pages.length;
  return <>{pages.map((c, i) => <ReportPage key={i} pageNum={i + 1} totalPages={totalPages}>{c}</ReportPage>)}</>;
}

/* ================================================================
   2. Members Report
   ================================================================ */

export function MembersReport({ db, churchName }: { db: DB; churchName: string }) {
  const members = useMemo(() =>
    db.members.filter(m => (m.member_status || m.status) !== "졸업/전출")
      .sort((a, b) => (a.dept || "").localeCompare(b.dept || "") || a.name.localeCompare(b.name)),
    [db.members]
  );

  const FIRST_ROWS = 12;
  const OTHER_ROWS = 22;
  const memberPages = paginateItems(members, FIRST_ROWS, OTHER_ROWS);

  const deptMap: Record<string, number> = {};
  members.forEach(m => { deptMap[m.dept || "미분류"] = (deptMap[m.dept || "미분류"] || 0) + 1; });

  const pages: React.ReactNode[] = [];

  memberPages.forEach((chunk, idx) => {
    const startNum = idx === 0 ? 0 : FIRST_ROWS + (idx - 1) * OTHER_ROWS;
    pages.push(
      <div key={`m-${idx}`} style={{ color: "#111", lineHeight: 1.7 }}>
        {idx === 0 && (
          <ReportHeader churchName={churchName} enTitle="Member Directory" krTitle="성도 명부"
            dateLabel={`${new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" })} 기준`} />
        )}
        <SectionTitle num="01" title={idx === 0 ? `전체 성도 현황 (${members.length}명)` : "전체 성도 현황 (계속)"} />
        <table style={TBL}>
          <thead>
            <tr style={{ borderBottom: "2px solid #111" }}>
              <th style={{ ...TH_C, width: 32 }}>NO</th>
              <th style={{ ...TH, width: 56 }}>이름</th>
              <th style={{ ...TH_C, width: 48 }}>부서</th>
              <th style={{ ...TH_C, width: 48 }}>직분</th>
              <th style={{ ...TH, width: 96 }}>연락처</th>
              <th style={TH}>주소</th>
              <th style={{ ...TH_C, width: 52 }}>목장</th>
              <th style={{ ...TH_C, width: 44 }}>상태</th>
            </tr>
          </thead>
          <tbody>
            {chunk.map((m, i) => (
              <tr key={m.id}>
                <td style={TD_C}>{startNum + i + 1}</td>
                <td style={TD}>{m.name}</td>
                <td style={TD_C}>{m.dept || "—"}</td>
                <td style={TD_C}>{m.role || "—"}</td>
                <td style={{ ...TD, whiteSpace: "nowrap" }}>{m.phone || "—"}</td>
                <td style={{ ...TD, fontSize: 11, color: "#6b7280" }}>{m.address || "—"}</td>
                <td style={TD_C}>{(m.mokjang ?? (m as any).group) || "—"}</td>
                <td style={TD_C}>{m.member_status || m.status || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  });

  // Dept summary page
  pages.push(
    <div key="dept" style={{ display: "flex", flexDirection: "column", height: "100%", color: "#111", lineHeight: 1.7 }}>
      <div style={{ flex: 1 }}>
        <SectionTitle num="02" title="부서별 현황" />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 12 }}>
          {Object.entries(deptMap).sort((a, b) => b[1] - a[1]).map(([dept, cnt]) => (
            <div key={dept} style={{ padding: 12, border: "1px solid #e5e7eb", borderRadius: 8 }}>
              <p style={{ fontSize: 11, color: "#6b7280", margin: "0 0 2px" }}>{dept}</p>
              <p style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>{cnt}<span style={{ fontSize: 12, fontWeight: 400, color: "#6b7280" }}>명</span></p>
            </div>
          ))}
        </div>
      </div>
      <ReportFooter churchName={churchName} reportTitle="성도 명부" />
    </div>
  );

  const totalPages = pages.length;
  return <>{pages.map((c, i) => <ReportPage key={i} pageNum={i + 1} totalPages={totalPages}>{c}</ReportPage>)}</>;
}

/* ================================================================
   3. Attendance Report
   ================================================================ */

export function AttendanceReport({ db, churchName, churchId }: { db: DB; churchName: string; churchId: string }) {
  const sundays = useMemo(() => getRecentSundays(8), []);
  const members = useMemo(() => db.members.filter(m => (m.member_status || m.status) !== "졸업/전출"), [db.members]);

  const attRows = useMemo(() => members.map(m => {
    const att = db.attendance[m.id] || {};
    let present = 0;
    const weeks = sundays.map(d => {
      const wn = getWeekFromDate(d);
      const s = att[wn] as string | undefined;
      const isPresent = s === "p" || s === "o";
      if (isPresent) present++;
      return { date: d, status: isPresent ? "●" : s === "a" ? "○" : "—" };
    });
    const rate = sundays.length > 0 ? Math.round(present / sundays.length * 100) : 0;
    return { name: m.name, dept: m.dept || "", weeks, rate };
  }), [members, db.attendance, sundays]);

  const weeklyTotals = useMemo(() => sundays.map((d, idx) => {
    const present = attRows.filter(r => r.weeks[idx].status === "●").length;
    return { date: d, present, rate: members.length > 0 ? Math.round(present / members.length * 100) : 0 };
  }), [sundays, attRows, members.length]);

  const FIRST_ATT_ROWS = 10;
  const OTHER_ATT_ROWS = 20;
  const attPages = paginateItems(attRows, FIRST_ATT_ROWS, OTHER_ATT_ROWS);

  const pages: React.ReactNode[] = [];

  // Page 1: header + weekly summary + start of matrix
  pages.push(
    <div key="p1" style={{ color: "#111", lineHeight: 1.7 }}>
      <ReportHeader churchName={churchName} enTitle="Attendance Report" krTitle="출석 현황 보고서"
        dateLabel={`최근 8주 (${sundays[0]?.slice(5)} ~ ${sundays[sundays.length - 1]?.slice(5)})`} />
      <SectionTitle num="01" title="주별 출석률 요약" />
      <table style={TBL}>
        <thead><tr style={{ borderBottom: "2px solid #111" }}><th style={TH}>날짜</th><th style={TH_C}>출석</th><th style={TH_C}>전체</th><th style={TH_C}>출석률</th></tr></thead>
        <tbody>
          {weeklyTotals.map((w, i) => (
            <tr key={i}><td style={{ ...TD, whiteSpace: "nowrap" }}>{w.date}</td><td style={TD_C}>{w.present}명</td><td style={TD_C}>{members.length}명</td><td style={{ ...TD_C, fontWeight: 600 }}>{w.rate}%</td></tr>
          ))}
        </tbody>
      </table>
      <div style={{ marginTop: 24 }}>
        <SectionTitle num="02" title="개인별 출석 현황" />
        <table style={TBL}>
          <thead>
            <tr style={{ borderBottom: "2px solid #111" }}>
              <th style={{ ...TH, width: 56 }}>이름</th>
              <th style={{ ...TH_C, width: 42 }}>부서</th>
              {sundays.map(d => <th key={d} style={{ ...TH_C, width: 38, fontSize: 9 }}>{d.slice(5)}</th>)}
              <th style={{ ...TH_C, width: 42 }}>출석률</th>
            </tr>
          </thead>
          <tbody>
            {(attPages[0] || []).map((r, i) => (
              <tr key={i}>
                <td style={TD}>{r.name}</td>
                <td style={TD_C}>{r.dept}</td>
                {r.weeks.map((w, j) => (
                  <td key={j} style={{ ...TD_C, color: w.status === "●" ? "#10B981" : w.status === "○" ? "#EF4444" : "#D1D5DB", fontWeight: w.status !== "—" ? 600 : 400 }}>{w.status}</td>
                ))}
                <td style={{ ...TD_C, fontWeight: 600, color: r.rate >= 75 ? "#10B981" : r.rate >= 50 ? "#F59E0B" : "#EF4444" }}>{r.rate}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  // Extra matrix pages
  for (let i = 1; i < attPages.length; i++) {
    const isLast = i === attPages.length - 1;
    pages.push(
      <div key={`att-${i}`} style={{ display: "flex", flexDirection: "column", height: "100%", color: "#111", lineHeight: 1.7 }}>
        <div style={{ flex: 1 }}>
          <SectionTitle num="02" title="개인별 출석 현황 (계속)" />
          <table style={TBL}>
            <thead>
              <tr style={{ borderBottom: "2px solid #111" }}>
                <th style={{ ...TH, width: 56 }}>이름</th>
                <th style={{ ...TH_C, width: 42 }}>부서</th>
                {sundays.map(d => <th key={d} style={{ ...TH_C, width: 38, fontSize: 9 }}>{d.slice(5)}</th>)}
                <th style={{ ...TH_C, width: 42 }}>출석률</th>
              </tr>
            </thead>
            <tbody>
              {attPages[i].map((r, j) => (
                <tr key={j}>
                  <td style={TD}>{r.name}</td>
                  <td style={TD_C}>{r.dept}</td>
                  {r.weeks.map((w, k) => (
                    <td key={k} style={{ ...TD_C, color: w.status === "●" ? "#10B981" : w.status === "○" ? "#EF4444" : "#D1D5DB", fontWeight: w.status !== "—" ? 600 : 400 }}>{w.status}</td>
                  ))}
                  <td style={{ ...TD_C, fontWeight: 600, color: r.rate >= 75 ? "#10B981" : r.rate >= 50 ? "#F59E0B" : "#EF4444" }}>{r.rate}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {isLast && <ReportFooter churchName={churchName} reportTitle="출석 현황 보고서" />}
      </div>
    );
  }

  if (attPages.length <= 1) {
    const first = pages[0];
    pages[0] = (
      <div key="p1-footer" style={{ display: "flex", flexDirection: "column", height: "100%", color: "#111", lineHeight: 1.7 }}>
        <div style={{ flex: 1 }}>{first}</div>
        <ReportFooter churchName={churchName} reportTitle="출석 현황 보고서" />
      </div>
    );
  }

  const totalPages = pages.length;
  return <>{pages.map((c, i) => <ReportPage key={i} pageNum={i + 1} totalPages={totalPages}>{c}</ReportPage>)}</>;
}

/* ================================================================
   4. New Family Report
   ================================================================ */

export function NewFamilyReport({ db, churchName }: { db: DB; churchName: string }) {
  const newFamilies = useMemo(() => db.members.filter(m => m.is_new_family === true).map(m => {
    const prg = (db.newFamilyPrograms || []).find(p => p.member_id === m.id);
    return {
      id: m.id, name: m.name, dept: m.dept || "",
      registeredDate: m.first_visit_date || (m as any).firstVisitDate || m.createdAt?.slice(0, 10) || "",
      source: m.visit_path || (m as any).visitPath || m.source || "",
      w1: prg?.week1_completed || false, w2: prg?.week2_completed || false,
      w3: prg?.week3_completed || false, w4: prg?.week4_completed || false,
      status: prg?.status || "진행중",
    };
  }), [db]);

  const totalCount = newFamilies.length;
  const completedCount = newFamilies.filter(nf => nf.w1 && nf.w2 && nf.w3 && nf.w4).length;
  const inProgressCount = totalCount - completedCount;

  const nfPages = paginateItems(newFamilies, 12, 20);

  const pages: React.ReactNode[] = [];

  nfPages.forEach((chunk, idx) => {
    const isLast = idx === nfPages.length - 1;
    pages.push(
      <div key={`nf-${idx}`} style={{ display: "flex", flexDirection: "column", height: "100%", color: "#111", lineHeight: 1.7 }}>
        <div style={{ flex: 1 }}>
          {idx === 0 && (
            <>
              <ReportHeader churchName={churchName} enTitle="New Family Report" krTitle="새가족 현황 보고서"
                dateLabel={`${new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" })} 기준`} />
              <SectionTitle num="01" title="새가족 요약" />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 28 }}>
                <StatBox label="전체 새가족" value={totalCount} unit="명" />
                <StatBox label="수료 완료" value={completedCount} unit="명" />
                <StatBox label="진행 중" value={inProgressCount} unit="명" />
              </div>
            </>
          )}
          <SectionTitle num="02" title={idx === 0 ? "새가족 정착 과정" : "새가족 정착 과정 (계속)"} />
          {chunk.length === 0 ? (
            <p style={{ fontSize: 12, color: "#9ca3af" }}>등록된 새가족이 없습니다.</p>
          ) : (
            <table style={TBL}>
              <thead>
                <tr style={{ borderBottom: "2px solid #111" }}>
                  <th style={{ ...TH, width: 56 }}>이름</th>
                  <th style={{ ...TH, width: 76, whiteSpace: "nowrap" }}>등록일</th>
                  <th style={{ ...TH_C, width: 48 }}>경로</th>
                  <th style={{ ...TH_C, width: 36 }}>1주</th>
                  <th style={{ ...TH_C, width: 36 }}>2주</th>
                  <th style={{ ...TH_C, width: 36 }}>3주</th>
                  <th style={{ ...TH_C, width: 36 }}>4주</th>
                  <th style={{ ...TH_C, width: 44 }}>수료</th>
                  <th style={{ ...TH_C, width: 52 }}>상태</th>
                </tr>
              </thead>
              <tbody>
                {chunk.map((nf, i) => {
                  const graduated = nf.w1 && nf.w2 && nf.w3 && nf.w4;
                  return (
                    <tr key={i}>
                      <td style={TD}>{nf.name}</td>
                      <td style={{ ...TD, color: "#6b7280", whiteSpace: "nowrap" }}>{nf.registeredDate}</td>
                      <td style={TD_C}>{nf.source || "—"}</td>
                      <td style={{ ...TD_C, color: nf.w1 ? "#10B981" : "#D1D5DB" }}>{nf.w1 ? "✓" : "—"}</td>
                      <td style={{ ...TD_C, color: nf.w2 ? "#10B981" : "#D1D5DB" }}>{nf.w2 ? "✓" : "—"}</td>
                      <td style={{ ...TD_C, color: nf.w3 ? "#10B981" : "#D1D5DB" }}>{nf.w3 ? "✓" : "—"}</td>
                      <td style={{ ...TD_C, color: nf.w4 ? "#10B981" : "#D1D5DB" }}>{nf.w4 ? "✓" : "—"}</td>
                      <td style={{ ...TD_C, color: graduated ? "#059669" : "#D1D5DB", fontWeight: graduated ? 600 : 400 }}>{graduated ? "수료" : "—"}</td>
                      <td style={TD_C}>{nf.status}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
        {isLast && <ReportFooter churchName={churchName} reportTitle="새가족 현황 보고서" />}
      </div>
    );
  });

  const totalPages = pages.length;
  return <>{pages.map((c, i) => <ReportPage key={i} pageNum={i + 1} totalPages={totalPages}>{c}</ReportPage>)}</>;
}

/* ================================================================
   5. Prayer Report (card-style for pastors)
   ================================================================ */

export function PrayerReport({ db, churchName, churchId }: { db: DB; churchName: string; churchId: string }) {
  const answeredSet = useMemo(() => new Set(db.answeredPrayerKeys || []), [db.answeredPrayerKeys]);

  const prayers = useMemo(() => {
    const rows: { name: string; dept: string; content: string; date: string; answered: boolean }[] = [];
    Object.keys(db.notes).forEach(mid => {
      const mbr = db.members.find(x => x.id === mid);
      const name = mid === NOTE_TARGET_CHURCH ? "교회 전체" : (mbr?.name || "");
      (db.notes[mid] || []).filter(n => n.type === "prayer").forEach(n => {
        const key = `note\t${mid}\t${n.date}\t${n.createdAt || n.date}\t${n.content}`;
        rows.push({ name, dept: mbr?.dept || "", content: n.content, date: n.date, answered: answeredSet.has(key) });
      });
    });
    db.members.forEach(m => {
      if (!m.prayer?.trim()) return;
      const already = (db.notes[m.id] || []).some(n => n.type === "prayer" && n.content === m.prayer);
      if (already) return;
      rows.push({ name: m.name, dept: m.dept || "", content: m.prayer, date: m.createdAt?.slice(0, 10) || "", answered: false });
    });
    return rows.sort((a, b) => b.date.localeCompare(a.date));
  }, [db, answeredSet]);

  const totalCount = prayers.length;
  const answeredCount = prayers.filter(p => p.answered).length;
  const prayingCount = totalCount - answeredCount;

  const prayerPages = paginateItems(prayers, 7, 10);

  const pages: React.ReactNode[] = [];

  prayerPages.forEach((chunk, idx) => {
    const isLast = idx === prayerPages.length - 1;
    pages.push(
      <div key={`pr-${idx}`} style={{ display: "flex", flexDirection: "column", height: "100%", color: "#111", lineHeight: 1.7 }}>
        <div style={{ flex: 1 }}>
          {idx === 0 && (
            <>
              <ReportHeader churchName={churchName} enTitle="Prayer Report" krTitle="기도제목 보고서"
                dateLabel={`${new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" })} 기준`} />
              <SectionTitle num="01" title="기도 요약" />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 28 }}>
                <StatBox label="전체 기도제목" value={totalCount} unit="건" />
                <StatBox label="기도중" value={prayingCount} unit="건" />
                <StatBox label="응답완료" value={answeredCount} unit="건" />
              </div>
            </>
          )}
          <SectionTitle num="02" title={idx === 0 ? "기도제목 목록" : "기도제목 목록 (계속)"} />
          {chunk.length === 0 ? (
            <p style={{ fontSize: 12, color: "#9ca3af" }}>등록된 기도제목이 없습니다.</p>
          ) : chunk.map((p, i) => (
            <div key={i} style={{
              marginBottom: 20, paddingBottom: 16,
              borderBottom: i < chunk.length - 1 ? "1px solid #f3f4f6" : "none",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#111" }}>{p.name}</span>
                <span style={{ fontSize: 10, color: "#9ca3af", whiteSpace: "nowrap", marginLeft: 8 }}>{p.dept}{p.dept && p.date ? " · " : ""}{p.date}</span>
              </div>
              <p style={{
                fontSize: 12, color: "#374151", lineHeight: 1.8,
                whiteSpace: "pre-wrap", wordBreak: "break-word", margin: "0 0 8px",
              }}>
                {p.content}
              </p>
              <span style={{
                fontSize: 10, padding: "2px 8px", borderRadius: 4,
                background: p.answered ? "#dcfce7" : "#f3f4f6",
                color: p.answered ? "#166534" : "#6b7280",
              }}>
                {p.answered ? "응답완료" : "기도중"}
              </span>
            </div>
          ))}
        </div>
        {isLast && <ReportFooter churchName={churchName} reportTitle="기도제목 보고서" />}
      </div>
    );
  });

  const totalPages = pages.length;
  return <>{pages.map((c, i) => <ReportPage key={i} pageNum={i + 1} totalPages={totalPages}>{c}</ReportPage>)}</>;
}

/* ================================================================
   Report definitions
   ================================================================ */

export const REPORT_DEFS = [
  { id: "weekly", title: "주간 목양 보고서", description: "금주 출석, 새가족, 심방, 기도제목 종합", Icon: FileText, enTitle: "Weekly Pastoral Report" },
  { id: "members", title: "성도 명부", description: "전체 성도 연락처 및 정보", Icon: Users, enTitle: "Member Directory" },
  { id: "attendance", title: "출석 현황 보고서", description: "최근 8주 출석 추이 및 통계", Icon: CalendarCheck, enTitle: "Attendance Report" },
  { id: "newFamily", title: "새가족 현황 보고서", description: "새가족 정착 과정 추적", Icon: UserPlus, enTitle: "New Family Report" },
  { id: "prayer", title: "기도제목 보고서", description: "전 성도 기도제목 및 응답 현황", Icon: Heart, enTitle: "Prayer Report" },
] as const;

export type ReportId = typeof REPORT_DEFS[number]["id"];

/* ================================================================
   Report Preview Modal (A4 + PDF download)
   ================================================================ */

export function ReportPreviewModal({
  reportId, db, churchName, churchId, onClose,
}: {
  reportId: ReportId; db: DB; churchName: string; churchId: string; onClose: () => void;
}) {
  const reportRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  const def = REPORT_DEFS.find(r => r.id === reportId)!;

  const handleDownloadPDF = async () => {
    if (!reportRef.current || downloading) return;
    setDownloading(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const jsPDF = (await import("jspdf")).default;

      const pageEls = reportRef.current.querySelectorAll("[data-report-page]");

      if (pageEls.length === 0) {
        const canvas = await html2canvas(reportRef.current, { scale: 2, backgroundColor: "#ffffff" });
        const pdf = new jsPDF("p", "mm", "a4");
        pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, 210, 297);
        const date = new Date().toISOString().split("T")[0];
        pdf.save(`${churchName}_${def.title}_${date}.pdf`);
        return;
      }

      const pdf = new jsPDF("p", "mm", "a4");
      for (let i = 0; i < pageEls.length; i++) {
        if (i > 0) pdf.addPage();
        const canvas = await html2canvas(pageEls[i] as HTMLElement, {
          scale: 2, backgroundColor: "#ffffff",
          width: (pageEls[i] as HTMLElement).scrollWidth,
          height: (pageEls[i] as HTMLElement).scrollHeight,
        });
        pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, 210, 297);
      }
      const date = new Date().toISOString().split("T")[0];
      pdf.save(`${churchName}_${def.title}_${date}.pdf`);
    } catch (e) {
      console.error("PDF generation failed:", e);
      alert("PDF 생성에 실패했습니다.");
    } finally {
      setDownloading(false);
    }
  };

  const handlePrint = () => { window.print(); };

  return (
    <div style={{ position: "fixed", inset: 0, background: "#e5e7eb", zIndex: 9999, display: "flex", flexDirection: "column" }}>
      {/* Toolbar */}
      <div style={{
        background: "#fff", borderBottom: "1px solid #e5e7eb",
        padding: "12px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={onClose} style={{ padding: 8, borderRadius: 8, border: "none", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center" }}>
            <ArrowLeft size={20} color="#4b5563" />
          </button>
          <span style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>{def.title}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={handlePrint} style={{
            display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", fontSize: 13, color: "#374151",
            background: "#fff", border: "1px solid #d1d5db", borderRadius: 8, cursor: "pointer",
          }}>
            <Printer size={16} />인쇄
          </button>
          <button onClick={handleDownloadPDF} disabled={downloading} style={{
            display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", fontSize: 13, color: "#fff",
            background: downloading ? "#9ca3af" : "#111827", border: "none", borderRadius: 8, cursor: downloading ? "default" : "pointer",
          }}>
            <Download size={16} />{downloading ? "생성중..." : "PDF 다운로드"}
          </button>
        </div>
      </div>

      {/* A4 Preview Area */}
      <div style={{ flex: 1, overflowY: "auto", padding: "32px 16px", display: "flex", justifyContent: "center" }}>
        <div ref={reportRef} style={{
          display: "flex", flexDirection: "column", alignItems: "center", gap: 16,
          width: "210mm", maxWidth: "100%",
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        }}>
          {reportId === "weekly" && <WeeklyReport db={db} churchName={churchName} churchId={churchId} />}
          {reportId === "members" && <MembersReport db={db} churchName={churchName} />}
          {reportId === "attendance" && <AttendanceReport db={db} churchName={churchName} churchId={churchId} />}
          {reportId === "newFamily" && <NewFamilyReport db={db} churchName={churchName} />}
          {reportId === "prayer" && <PrayerReport db={db} churchName={churchName} churchId={churchId} />}
        </div>
      </div>
    </div>
  );
}
