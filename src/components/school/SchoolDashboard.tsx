"use client";

import { useState, useEffect } from "react";
import type { SchoolDepartment } from "@/types/db";
import { supabase } from "@/lib/supabase";
import { getChurchId } from "@/lib/tenant";

const NAVY = "#2563eb";
const SUB = "#6b7b9e";
const MUTED = "#999";
const TEXT = "#555";
const BORDER = "#e8e9f0";
const BG = "#fff";

function useIsMobile(bp = 768) {
  const [m, setM] = useState(false);
  useEffect(() => {
    const c = () => setM(typeof window !== "undefined" && window.innerWidth <= bp);
    c();
    window.addEventListener("resize", c);
    return () => window.removeEventListener("resize", c);
  }, [bp]);
  return m;
}

export interface SchoolDashboardProps {
  toast: (msg: string, type?: "ok" | "err" | "warn") => void;
}

type DeptCounts = Record<string, { teachers: number; students: number }>;

export function SchoolDashboard({ toast }: SchoolDashboardProps) {
  const mob = useIsMobile();
  const [departments, setDepartments] = useState<SchoolDepartment[]>([]);
  const [deptCounts, setDeptCounts] = useState<DeptCounts>({});
  const [loading, setLoading] = useState(true);
  const [totalStudents, setTotalStudents] = useState(0);
  const [totalTeachers, setTotalTeachers] = useState(0);
  const [weekRate, setWeekRate] = useState<number | null>(null);
  const [newThisMonth, setNewThisMonth] = useState(0);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const { data, error } = await supabase
          .from("school_departments")
          .select("*")
          .order("sort_order");
        if (error) {
          console.error("school_departments fetch error:", error.message, error.details);
          toast(`부서 로드 실패: ${error.message}`, "err");
        }
        const list = (data as SchoolDepartment[]) ?? [];
        const activeList = list.filter((d) => d.is_active !== false);
        setDepartments(activeList);

        const { data: enrollmentsData } = await supabase
          .from("school_enrollments")
          .select("member_id, department_id, role")
          .eq("is_active", true)
          .in("role", ["학생", "교사", "부교사"]);
        const enrollments = (enrollmentsData ?? []) as { member_id: string; department_id: string; role: string }[];
        const counts: DeptCounts = {};
        activeList?.forEach((d) => {
          const deptEnrollments = enrollments?.filter((e) => e.department_id === d.id) ?? [];
          counts[d.id] = {
            teachers: deptEnrollments.filter((e) => e.role === "교사" || e.role === "부교사").length,
            students: deptEnrollments.filter((e) => e.role === "학생").length,
          };
        });
        setDeptCounts(counts);

        const totalTeachersFromEnrollments = enrollments.filter((e) => e.role === "교사" || e.role === "부교사").length;
        setTotalTeachers(totalTeachersFromEnrollments);

        const { count: studentCount } = await supabase
          .from("school_enrollments")
          .select("*", { count: "exact", head: true })
          .eq("is_active", true)
          .eq("role", "학생");
        setTotalStudents(studentCount ?? 0);

        const thisMonth = new Date().toISOString().slice(0, 7);
        const { data: enrolls } = await supabase
          .from("school_enrollments")
          .select("id")
          .gte("enrolled_date", `${thisMonth}-01`);
        setNewThisMonth(enrolls?.length ?? 0);

        const weekStart = new Date();
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        const weekStartStr = weekStart.toISOString().slice(0, 10);
        const { data: schoolMemberIds } = await supabase
          .from("school_enrollments")
          .select("member_id")
          .eq("is_active", true)
          .in("role", ["학생", "교사", "부교사"]);
        const memberIds = [...new Set((schoolMemberIds ?? []).map((r: { member_id: string }) => r.member_id))];
        if (memberIds.length > 0) {
          const { data: att } = await supabase
            .from("attendance")
            .select("status")
            .in("member_id", memberIds)
            .eq("service_type", "주일예배")
            .eq("church_id", getChurchId())
            .gte("date", weekStartStr);
          if (att && att.length > 0) {
            const present = att.filter((a: { status: string }) => a.status === "p").length;
            setWeekRate(Math.round((present / att.length) * 100));
          }
        }
      } catch (e) {
        console.error(e);
        toast("데이터 로드 실패", "err");
      } finally {
        setLoading(false);
      }
    })();
  }, [toast]);

  function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
    return (
      <div
        style={{
          background: BG,
          borderRadius: mob ? 8 : 8,
          border: `1px solid ${BORDER}`,
          padding: mob ? "8px 10px" : "16px 20px",
          minHeight: mob ? 56 : 90,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
        }}
      >
        <div style={{ fontSize: mob ? 10 : 13, color: SUB, fontWeight: 500 }}>{label}</div>
        <div style={{ fontSize: mob ? 20 : 26, fontWeight: mob ? 800 : 700, color: NAVY, letterSpacing: "-0.02em", lineHeight: 1.2 }}>{value}</div>
        {sub != null && sub !== "" && <div style={{ fontSize: mob ? 9 : 12, color: MUTED, marginTop: 2 }}>{sub}</div>}
      </div>
    );
  }

  if (loading) {
    return <div style={{ padding: 24, fontSize: 12, color: MUTED }}>로딩 중...</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: mob ? 12 : 20 }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: mob ? "1fr 1fr" : "repeat(4, 1fr)",
          gap: mob ? 8 : 16,
        }}
      >
        <StatCard label="전체 등록 학생" value={`${totalStudents}명`} sub="교회학교 등록" />
        <StatCard label="이번 주 출석률" value={weekRate != null ? `${weekRate}%` : "-"} sub="금주 출석 기준" />
        <StatCard label="전체 교사" value={`${totalTeachers}명`} sub="교사·부교사" />
        <StatCard label="이번 달 신규 등록" value={`${newThisMonth}명`} sub="신규 등록" />
      </div>

      <div style={{ background: BG, borderRadius: mob ? 8 : 16, border: `1px solid ${BORDER}`, overflow: "hidden" }}>
        <div style={{ padding: mob ? "12px 14px" : "16px 20px", borderBottom: `1px solid ${BORDER}` }}>
          <h4 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: NAVY }}>부서별 현황</h4>
        </div>
        <div
          style={{
            padding: mob ? "12px 14px" : "16px 20px",
            display: "grid",
            gridTemplateColumns: mob ? "1fr" : "repeat(auto-fill, minmax(220px, 1fr))",
            gap: 10,
          }}
        >
          {departments.length === 0 ? (
            <div style={{ gridColumn: "1 / -1", textAlign: "center", color: MUTED, padding: 24, fontSize: 12 }}>
              부서가 없습니다. Supabase SQL Editor에서 church_school_rls_anon_read.sql을 실행했는지 확인하세요.
            </div>
          ) : (
            departments.map((d) => (
              <div
                key={d.id}
                style={{
                  background: BG,
                  borderRadius: mob ? 8 : 16,
                  border: `1px solid ${BORDER}`,
                  borderLeft: `3px solid ${NAVY}`,
                  padding: mob ? "10px 12px" : "16px 20px",
                }}
              >
                <div style={{ fontSize: mob ? 12 : 15, fontWeight: 700, color: NAVY }}>{d.name}</div>
                <div style={{ fontSize: mob ? 10 : 13, color: MUTED, marginTop: 4 }}>
                  교사 {deptCounts[d.id]?.teachers ?? 0} · 학생 {deptCounts[d.id]?.students ?? 0}
                </div>
                <div style={{ fontSize: mob ? 10 : 13, color: MUTED, marginTop: 2 }}>이번 주 출석률 —</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
