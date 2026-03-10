"use client";

import { useState, useEffect } from "react";
import type { DB } from "@/types/db";
import type { SchoolDepartment } from "@/types/db";
import { supabase } from "@/lib/supabase";
import { getChurchId } from "@/lib/tenant";

const INDIGO = "#4F46E5";

type DeptStats = { department_id: string; name: string; 출석: number; 결석: number; 병결: number; 기타: number; total: number; rate: number };

export interface SchoolAttendanceStatsProps {
  db: DB;
  toast: (msg: string, type?: "ok" | "err" | "warn") => void;
}

export function SchoolAttendanceStats({ db, toast }: SchoolAttendanceStatsProps) {
  const [departments, setDepartments] = useState<SchoolDepartment[]>([]);
  const [stats, setStats] = useState<DeptStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<"week" | "month">("month");
  const toLocalDateString = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);

  useEffect(() => {
    const client = supabase;
    if (!client) {
      setLoading(false);
      return;
    }
    const load = async () => {
      setLoading(true);
      try {
        const { data: depts, error: deptsErr } = await client
          .from("school_departments")
          .select("*")
          .order("sort_order");
        console.log("[SchoolAttendanceStats] departments query result:", depts, deptsErr);
        if (deptsErr) {
          toast("부서 로드 실패: " + deptsErr.message, "err");
          setLoading(false);
          return;
        }
        const list = (depts as SchoolDepartment[]) ?? [];
        setDepartments(list.filter((d) => d.is_active !== false));

        const now = new Date();
        const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const start = new Date(end);
        if (period === "week") {
          start.setDate(start.getDate() - 7);
        } else {
          start.setMonth(start.getMonth() - 1);
        }
        const startStr = toLocalDateString(start);
        const endStr = toLocalDateString(end);

        const { data: enrolls, error: enrollsErr } = await client
          .from("school_enrollments")
          .select("member_id, department_id")
          .eq("is_active", true)
          .in("role", ["학생", "교사", "부교사"]);
        if (enrollsErr || !enrolls?.length) {
          const activeDepts = list.filter((d) => d.is_active !== false);
          setStats(
            activeDepts.map((d) => ({
              department_id: d.id,
              name: d.name,
              출석: 0,
              결석: 0,
              병결: 0,
              기타: 0,
              total: 0,
              rate: 0,
            }))
          );
          setLoading(false);
          return;
        }
        const memberIds = [...new Set((enrolls as { member_id: string }[]).map((e) => e.member_id))];
        const memberToDept: Record<string, string> = {};
        (enrolls as { member_id: string; department_id: string }[]).forEach((e) => {
          memberToDept[e.member_id] = e.department_id;
        });

        const { data: att, error: attErr } = await client
          .from("attendance")
          .select("member_id, status")
          .in("member_id", memberIds)
          .eq("service_type", "주일예배")
          .eq("church_id", getChurchId())
          .gte("date", startStr)
          .lte("date", endStr);
        console.log("[SchoolAttendanceStats] attendance query result:", att, attErr);
        if (attErr) {
          toast("출석 데이터 로드 실패: " + attErr.message, "err");
          setLoading(false);
          return;
        }
        const byDept: Record<string, { 출석: number; 결석: number; 병결: number; 기타: number }> = {};
        (att ?? []).forEach((r: { member_id: string; status: string }) => {
          const deptId = memberToDept[r.member_id];
          if (!deptId) return;
          if (!byDept[deptId]) byDept[deptId] = { 출석: 0, 결석: 0, 병결: 0, 기타: 0 };
          if (r.status === "p") byDept[deptId].출석++;
          else byDept[deptId].결석++;
        });
        const deptList = list.filter((d) => d.is_active !== false);
        setStats(
          deptList.map((d) => {
            const s = byDept[d.id] ?? { 출석: 0, 결석: 0, 병결: 0, 기타: 0 };
            const total = s.출석 + s.결석 + s.병결 + s.기타;
            const rate = total > 0 ? Math.round((s.출석 / total) * 100) : 0;
            return { department_id: d.id, name: d.name, ...s, total, rate };
          })
        );
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [period]);

  if (loading && stats.length === 0) return <div className="p-6 text-gray-500">로딩 중...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold" style={{ color: INDIGO }}>출석 통계</h3>
        <select value={period} onChange={(e) => setPeriod(e.target.value as "week" | "month")} className="rounded-lg border border-gray-200 px-3 py-2 text-sm">
          <option value="week">최근 7일</option>
          <option value="month">이번 달</option>
        </select>
      </div>
      <div className="bg-white rounded-xl border border-gray-100 p-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {stats.map((s) => (
            <div key={s.department_id} className="p-3 rounded-lg bg-gray-50">
              <div className="font-medium text-gray-800">{s.name}</div>
              <div className="text-sm text-gray-500">출석 {s.출석} / 총 {s.total}명 · 출석률 {s.rate}%</div>
              <div className="text-xs text-gray-400 mt-1">결석 {s.결석} · 병결 {s.병결} · 기타 {s.기타}</div>
            </div>
          ))}
        </div>
        {stats.length === 0 && !loading && <p className="text-gray-500 text-sm">해당 기간 출석 데이터가 없습니다.</p>}
      </div>
    </div>
  );
}
