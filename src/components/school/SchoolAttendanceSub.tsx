"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import type { DB } from "@/types/db";
import type { Attendance } from "@/types/db";
import { supabase } from "@/lib/supabase";
import { getChurchId } from "@/lib/tenant";
import { useAuth } from "@/contexts/AuthContext";
import { LayoutDashboard, CalendarCheck, UserX, BarChart3, ListOrdered } from "lucide-react";
import { AttendanceDashboard } from "@/components/attendance/AttendanceDashboard";
import { AbsenteeManagement } from "@/components/attendance/AbsenteeManagement";
import { AttendanceStatistics } from "@/components/attendance/AttendanceStatistics";
import { SchoolAttendanceCheck } from "./SchoolAttendanceCheck";

/* 목양 출석부와 동일한 색상/스타일 */
const C = {
  bg: "#f8f7f4",
  navy: "#1b2a4a",
  text: "#1b2a4a",
  border: "#e8e6e1",
};

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

export function SchoolAttendanceSub({ db, toast }: SchoolAttendanceSubProps) {
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

  const tabs = [
    { id: "dashboard" as const, label: "대시보드", Icon: LayoutDashboard },
    { id: "check" as const, label: "출석 체크", Icon: CalendarCheck },
    { id: "absentee" as const, label: "결석자 관리", Icon: UserX },
    { id: "statistics" as const, label: "출석 통계", Icon: BarChart3 },
    { id: "weekly" as const, label: "52주 출석", Icon: ListOrdered },
  ];

  return (
    <>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          marginBottom: 16,
          paddingBottom: 12,
          borderBottom: `1px solid ${C.border}`,
        }}
      >
        {tabs.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setAttendanceSubTab(id)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 14px",
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 600,
              border: "none",
              cursor: "pointer",
              background: attendanceSubTab === id ? C.navy : "transparent",
              color: attendanceSubTab === id ? "#fff" : C.text,
              borderWidth: 1,
              borderStyle: "solid",
              borderColor: attendanceSubTab === id ? C.navy : C.border,
            }}
          >
            <Icon style={{ width: 18, height: 18 }} />
            {label}
          </button>
        ))}
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
          onAddVisit={(memberId) => toast("심방 등록은 기도/메모에서 기록해 주세요", "ok")}
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
            padding: 32,
            textAlign: "center",
            color: C.text,
            background: C.bg,
            borderRadius: 16,
            border: `1px solid ${C.border}`,
          }}
        >
          <p style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>52주 출석 현황</p>
          <p style={{ margin: "8px 0 0", fontSize: 13, color: "#6b7b9e" }}>
            등록된 학생·교사의 52주 출석 기록을 확인할 수 있습니다. (준비 중)
          </p>
        </div>
      )}

      {loading && attendanceSubTab === "dashboard" && (
        <div style={{ padding: 24, textAlign: "center", color: "#6b7b9e" }}>출석 데이터 로딩 중...</div>
      )}
    </>
  );
}
