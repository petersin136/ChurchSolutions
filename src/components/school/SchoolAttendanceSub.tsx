"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import type { DB } from "@/types/db";
import type { Attendance } from "@/types/db";
import { supabase } from "@/lib/supabase";
import { getChurchId } from "@/lib/tenant";
import { useAuth } from "@/contexts/AuthContext";
import { AttendanceDashboard } from "@/components/attendance/AttendanceDashboard";
import { AbsenteeManagement } from "@/components/attendance/AbsenteeManagement";
import { AttendanceStatistics } from "@/components/attendance/AttendanceStatistics";
import { SchoolAttendanceCheck } from "./SchoolAttendanceCheck";

const NAVY = "#2563eb";
const BORDER = "#c7d0e8";
const UNSEL_BG = "#f5f8ff";
const UNSEL_TEXT = "#555";

type AttendanceSubTab = "dashboard" | "check" | "absentee" | "statistics" | "weekly";
const ATTENDANCE_SUB_IDS: AttendanceSubTab[] = ["dashboard", "check", "absentee", "statistics", "weekly"];

const DB_STATUS_TO_UI: Record<string, Attendance["status"]> = {
  p: "출석",
  o: "온라인",
  a: "결석",
  l: "병결",
  n: "기타",
};

export interface SchoolAttendanceSubProps {
  db: DB;
  toast: (msg: string, type?: "ok" | "err" | "warn") => void;
}

function getInitialSchoolAttSubTab(): AttendanceSubTab {
  if (typeof window === "undefined") return "dashboard";
  const v = sessionStorage.getItem("schoolAttSubTab");
  return (ATTENDANCE_SUB_IDS.includes(v as AttendanceSubTab) ? v : "dashboard") as AttendanceSubTab;
}

function SubTabButton({
  active,
  label,
  onClick,
  flex,
  mob,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  flex?: number;
  mob: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: flex ?? 1,
        minWidth: 0,
        height: mob ? 30 : 40,
        fontSize: mob ? 10 : 14,
        fontWeight: 600,
        borderRadius: mob ? 6 : 10,
        border: active ? "none" : `1px solid ${BORDER}`,
        padding: mob ? "0 8px" : "0 16px",
        cursor: "pointer",
        background: active ? NAVY : UNSEL_BG,
        color: active ? "#fff" : UNSEL_TEXT,
      }}
    >
      {label}
    </button>
  );
}

function useIsMobile(bp = 768) {
  const [m, setM] = useState(false);
  useEffect(() => {
    const c = () => setM(window.innerWidth <= bp);
    c();
    window.addEventListener("resize", c);
    return () => window.removeEventListener("resize", c);
  }, [bp]);
  return m;
}

export function SchoolAttendanceSub({ db, toast }: SchoolAttendanceSubProps) {
  const mob = useIsMobile();
  const { churchId } = useAuth();
  const [attendanceSubTab, setAttendanceSubTabState] = useState<AttendanceSubTab>(getInitialSchoolAttSubTab);
  const [enrolledMemberIds, setEnrolledMemberIds] = useState<Set<string>>(new Set());
  const [dateBasedAttendance, setDateBasedAttendance] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(true);

  const setAttendanceSubTab = useCallback((id: AttendanceSubTab) => setAttendanceSubTabState(id), []);

  useEffect(() => {
    if (typeof window !== "undefined") sessionStorage.setItem("schoolAttSubTab", attendanceSubTab);
  }, [attendanceSubTab]);

  const fetchEnrolledAndAttendance = useCallback(() => {
    if (!supabase || !churchId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    supabase
      .from("school_enrollments")
      .select("member_id")
      .eq("is_active", true)
      .in("role", ["학생", "교사", "부교사"])
      .then(({ data: enrolls, error: enrollsErr }) => {
        if (enrollsErr) {
          setEnrolledMemberIds(new Set());
          setLoading(false);
          return;
        }
        const ids = new Set((enrolls ?? []).map((r: { member_id: string }) => r.member_id));
        setEnrolledMemberIds(ids);

        const end = new Date();
        const start = new Date(end);
        start.setDate(start.getDate() - 16 * 7);
        const startStr = start.toISOString().slice(0, 10);
        const endStr = end.toISOString().slice(0, 10);

        if (ids.size === 0) {
          setDateBasedAttendance([]);
          setLoading(false);
          return;
        }

        if (!supabase) {
          setLoading(false);
          return;
        }
        supabase
          .from("attendance")
          .select("id, member_id, date, status, service_type")
          .eq("church_id", getChurchId())
          .eq("service_type", "주일예배")
          .gte("date", startStr)
          .lte("date", endStr)
          .in("member_id", Array.from(ids))
          .then(({ data, error }) => {
            if (error) {
              setDateBasedAttendance([]);
              setLoading(false);
              return;
            }
            const list: Attendance[] = (data ?? []).map((r: { id?: string; member_id?: string; date?: string; status?: string; service_type?: string }) => ({
              id: String(r.id ?? ""),
              member_id: String(r.member_id ?? ""),
              date: String(r.date ?? ""),
              status: (DB_STATUS_TO_UI[r.status ?? ""] ?? "결석") as Attendance["status"],
              service_type: r.service_type ?? undefined,
            }));
            setDateBasedAttendance(list);
            setLoading(false);
          });
      });
  }, [churchId]);

  useEffect(() => {
    if (!churchId) return;
    fetchEnrolledAndAttendance();
  }, [churchId, attendanceSubTab, fetchEnrolledAndAttendance]);

  const enrolledMembers = useMemo(() => {
    return (db.members ?? []).filter((m) => enrolledMemberIds.has(m.id));
  }, [db.members, enrolledMemberIds]);

  const attendanceListForDashboard = useMemo(() => dateBasedAttendance, [dateBasedAttendance]);

  return (
    <>
      <div style={{ marginBottom: mob ? 16 : 20, paddingBottom: mob ? 12 : 16, borderBottom: `1px solid ${BORDER}` }}>
        <div style={{ display: "flex", gap: mob ? 8 : 12, marginBottom: mob ? 8 : 10 }}>
          <SubTabButton mob={mob} active={attendanceSubTab === "dashboard"} label="대시보드" onClick={() => setAttendanceSubTab("dashboard")} />
          <SubTabButton mob={mob} active={attendanceSubTab === "statistics"} label="출석 통계" onClick={() => setAttendanceSubTab("statistics")} />
        </div>
        <div style={{ display: "flex", gap: mob ? 8 : 12 }}>
          <SubTabButton mob={mob} active={attendanceSubTab === "check"} label="출석 체크" onClick={() => setAttendanceSubTab("check")} />
          <SubTabButton mob={mob} active={attendanceSubTab === "absentee"} label="결석자 관리" onClick={() => setAttendanceSubTab("absentee")} />
          <SubTabButton mob={mob} active={attendanceSubTab === "weekly"} label="52주 출석" onClick={() => setAttendanceSubTab("weekly")} />
        </div>
      </div>

      {attendanceSubTab === "dashboard" && (
        <AttendanceDashboard
          members={enrolledMembers}
          attendanceList={attendanceListForDashboard}
          onOpenCheck={() => setAttendanceSubTab("check")}
          onOpenAbsentee={() => setAttendanceSubTab("absentee")}
          onOpenAbsenteeList={() => setAttendanceSubTab("absentee")}
        />
      )}

      {attendanceSubTab === "check" && <SchoolAttendanceCheck db={db} toast={toast} />}

      {attendanceSubTab === "absentee" && (
        <AbsenteeManagement
          members={enrolledMembers}
          attendanceList={attendanceListForDashboard}
          consecutiveWeeks={3}
          toast={toast}
          onAddVisit={() => toast("심방 등록은 기도/메모에서 기록해 주세요", "ok")}
        />
      )}

      {attendanceSubTab === "statistics" && (
        <AttendanceStatistics
          members={enrolledMembers}
          attendanceList={attendanceListForDashboard}
          toast={toast}
          onExportExcel={(csv, filename) => {
            const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = filename;
            a.click();
            URL.revokeObjectURL(a.href);
            toast("다운로드되었습니다", "ok");
          }}
        />
      )}

      {attendanceSubTab === "weekly" && (
        <div
          style={{
            padding: mob ? 24 : 28,
            textAlign: "center",
            color: UNSEL_TEXT,
            background: "#fff",
            borderRadius: mob ? 8 : 16,
            border: `1px solid ${BORDER}`,
          }}
        >
          <p style={{ margin: 0, fontSize: mob ? 13 : 16, fontWeight: 700, color: NAVY }}>52주 출석 현황</p>
          <p style={{ margin: "8px 0 0", fontSize: mob ? 11 : 14, color: "#999", lineHeight: mob ? 1.4 : 1.6 }}>
            등록된 학생·교사의 52주 출석 기록을 확인할 수 있습니다. (준비 중)
          </p>
        </div>
      )}

      {loading && attendanceSubTab === "dashboard" && (
        <div style={{ padding: 24, textAlign: "center", fontSize: mob ? 11 : 14, color: "#999" }}>출석 데이터 로딩 중...</div>
      )}
    </>
  );
}
