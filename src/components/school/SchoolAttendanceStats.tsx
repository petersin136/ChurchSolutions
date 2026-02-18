"use client";

import { useState, useEffect } from "react";
import type { DB } from "@/types/db";
import type { SchoolDepartment } from "@/types/db";
import { supabase } from "@/lib/supabase";

const INDIGO = "#4F46E5";

export interface SchoolAttendanceStatsProps {
  db: DB;
  toast: (msg: string, type?: "ok" | "err" | "warn") => void;
}

export function SchoolAttendanceStats({ db, toast }: SchoolAttendanceStatsProps) {
  const [departments, setDepartments] = useState<SchoolDepartment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    supabase.from("school_departments").select("*").eq("is_active", true).order("sort_order").then(({ data }) => {
      setDepartments((data as SchoolDepartment[]) ?? []);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="p-6 text-gray-500">로딩 중...</div>;

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold" style={{ color: INDIGO }}>출석 통계</h3>
      <div className="bg-white rounded-xl border border-gray-100 p-6">
        <p className="text-gray-500 text-sm">부서별 주간 출석률 · 반별 비교 · 개인별 현황 · 월별 추이 — 데이터 수집 후 차트 연동 예정.</p>
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
          {departments.slice(0, 4).map((d) => (
            <div key={d.id} className="p-3 rounded-lg bg-gray-50">
              <div className="font-medium text-gray-800">{d.name}</div>
              <div className="text-sm text-gray-500">출석률 —</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
