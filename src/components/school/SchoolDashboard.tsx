"use client";

import { useState, useEffect } from "react";
import type { DB } from "@/types/db";
import type { SchoolDepartment } from "@/types/db";
import { supabase } from "@/lib/supabase";
import { C, STAT_CARD_COLORS } from "@/styles/designTokens";

const DEPT_BAR_COLORS: Record<string, string> = {
  영아부: "#ef476f",
  유치부: "#ffd166",
  유초등부: "#06d6a0",
  초등부: "#06d6a0",
  중등부: "#118ab2",
  고등부: "#4361ee",
  대학부: "#7209b7",
  청년부: "#7209b7",
};

export interface SchoolDashboardProps {
  db: DB;
  toast: (msg: string, type?: "ok" | "err" | "warn") => void;
}

export function SchoolDashboard({ db, toast }: SchoolDashboardProps) {
  const [departments, setDepartments] = useState<SchoolDepartment[]>([]);
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

        const { count: studentCount } = await supabase
          .from("school_enrollments")
          .select("*", { count: "exact", head: true })
          .eq("is_active", true)
          .eq("role", "학생");
        setTotalStudents(studentCount ?? 0);

        const { count: teacherCount } = await supabase
          .from("school_enrollments")
          .select("*", { count: "exact", head: true })
          .eq("is_active", true)
          .in("role", ["교사", "부교사", "부장", "총무"]);
        setTotalTeachers(teacherCount ?? 0);

        const thisMonth = new Date().toISOString().slice(0, 7);
        const { data: enrolls } = await supabase
          .from("school_enrollments")
          .select("id")
          .gte("enrolled_date", `${thisMonth}-01`);
        setNewThisMonth(enrolls?.length ?? 0);

        const weekStart = new Date();
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        const weekStartStr = weekStart.toISOString().slice(0, 10);
        const { data: att } = await supabase
          .from("school_attendance")
          .select("status")
          .gte("date", weekStartStr);
        if (att && att.length > 0) {
          const present = att.filter((a) => a.status === "출석").length;
          setWeekRate(Math.round((present / att.length) * 100));
        }
      } catch (e) {
        console.error(e);
        toast("데이터 로드 실패", "err");
      } finally {
        setLoading(false);
      }
    })();
  }, [toast]);

  function StatCard({ label, value, sub, color = C.accent }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={{ background: C.card, borderRadius: 16, border: `1px solid ${C.border}`, padding: "20px 24px", position: "relative", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
      <div style={{ position: "absolute", top: -10, right: -10, width: 60, height: 60, borderRadius: "50%", background: `${color}15` }} />
      <div style={{ fontSize: 13, color: C.textMuted, fontWeight: 500 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700, color: C.navy, letterSpacing: "-0.5px" }}>{value}</div>
      {sub != null && sub !== "" && <div style={{ fontSize: 12, color: C.textMuted }}>{sub}</div>}
    </div>
  );
}

  if (loading) {
    return <div className="p-6 text-gray-500">로딩 중...</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
        <StatCard label="전체 등록 학생" value={`${totalStudents}명`} sub="교회학교 등록" color={STAT_CARD_COLORS.accent} />
        <StatCard label="전체 교사" value={`${totalTeachers}명`} sub="교사·부교사·부장·총무" color={STAT_CARD_COLORS.teal} />
        <StatCard label="이번 주 출석률" value={weekRate != null ? `${weekRate}%` : "-"} sub="금주 출석 기준" color={STAT_CARD_COLORS.success} />
        <StatCard label="이번 달 신규 등록" value={`${newThisMonth}명`} sub="신규 등록 학생" color={STAT_CARD_COLORS.purple} />
      </div>

      <div style={{ background: C.card, borderRadius: 16, border: `1px solid ${C.border}`, padding: 0, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
        <div style={{ padding: "16px 24px", borderBottom: `1px solid ${C.border}` }}>
          <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: C.navy }}>부서별 현황</h4>
        </div>
        <div style={{ padding: "20px 24px", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16 }}>
          {departments.length === 0 ? (
            <div style={{ gridColumn: "1 / -1", textAlign: "center", color: C.textMuted, padding: 32 }}>
              부서가 없습니다. Supabase SQL Editor에서 church_school_rls_anon_read.sql을 실행했는지 확인하세요.
            </div>
          ) : (
            departments.map((d) => (
              <div
                key={d.id}
                style={{
                  background: C.card,
                  borderRadius: 12,
                  border: `1px solid ${C.border}`,
                  borderLeft: `4px solid ${DEPT_BAR_COLORS[d.name] ?? C.accent}`,
                  padding: 16,
                  cursor: "pointer",
                  transition: "box-shadow 0.2s",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.06)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "none"; }}
              >
                <div style={{ fontSize: 15, fontWeight: 600, color: C.navy }}>{d.name}</div>
                <div style={{ fontSize: 13, color: C.textMuted, marginTop: 4 }}>교사 {d.teacher_count} · 학생 {d.student_count}</div>
                <div style={{ fontSize: 12, color: C.textFaint, marginTop: 2 }}>이번 주 출석률 —</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
