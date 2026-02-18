"use client";

import { useState, useEffect } from "react";
import type { DB } from "@/types/db";
import type { SchoolDepartment } from "@/types/db";
import { supabase } from "@/lib/supabase";

const INDIGO = "#4F46E5";
const DEPT_COLORS: Record<string, string> = {
  영아부: "#FEE2E2",
  유치부: "#FEF3C7",
  유초등부: "#D1FAE5",
  초등부: "#D1FAE5",
  중등부: "#DBEAFE",
  고등부: "#E0E7FF",
  대학부: "#EDE9FE",
  청년부: "#EDE9FE",
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
        const { data: depts } = await supabase
          .from("school_departments")
          .select("*")
          .eq("is_active", true)
          .order("sort_order");
        setDepartments((depts as SchoolDepartment[]) ?? []);

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

  if (loading) {
    return <div className="p-6 text-gray-500">로딩 중...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <div className="text-sm text-gray-500">전체 등록 학생</div>
          <div className="text-2xl font-bold" style={{ color: INDIGO }}>{totalStudents}명</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <div className="text-sm text-gray-500">전체 교사</div>
          <div className="text-2xl font-bold" style={{ color: INDIGO }}>{totalTeachers}명</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <div className="text-sm text-gray-500">이번 주 평균 출석률</div>
          <div className="text-2xl font-bold" style={{ color: INDIGO }}>{weekRate != null ? `${weekRate}%` : "-"}</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <div className="text-sm text-gray-500">이번 달 신규 등록</div>
          <div className="text-2xl font-bold" style={{ color: INDIGO }}>{newThisMonth}명</div>
        </div>
      </div>

      <h3 className="text-lg font-semibold" style={{ color: INDIGO }}>부서별 현황</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {departments.length === 0 ? (
          <div className="col-span-full bg-white rounded-xl border border-gray-100 p-8 text-center text-gray-500">
            부서가 없습니다. Supabase에 school_departments 시드 데이터를 넣어주세요.
          </div>
        ) : (
          departments.map((d) => (
            <div
              key={d.id}
              className="rounded-xl border border-gray-100 p-4 shadow-sm cursor-pointer transition hover:shadow-md"
              style={{ background: DEPT_COLORS[d.name] ?? "#f3f4f6" }}
            >
              <div className="font-semibold text-gray-800">{d.name}</div>
              <div className="text-sm text-gray-600 mt-1">교사 {d.teacher_count} · 학생 {d.student_count}</div>
              <div className="text-xs text-gray-500 mt-1">이번 주 출석률 —</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
