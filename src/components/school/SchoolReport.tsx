"use client";

import { useState, useEffect } from "react";
import type { DB } from "@/types/db";
import type { SchoolDepartment, SchoolClass } from "@/types/db";
import { supabase } from "@/lib/supabase";

const INDIGO = "#4F46E5";

export interface SchoolReportProps {
  db: DB;
  toast: (msg: string, type?: "ok" | "err" | "warn") => void;
}

export function SchoolReport({ db, toast }: SchoolReportProps) {
  const [departments, setDepartments] = useState<SchoolDepartment[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [deptId, setDeptId] = useState<string | null>(null);
  const [classId, setClassId] = useState<string | null>(null);
  const [startDate, setStartDate] = useState(() => new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    Promise.all([
      supabase.from("school_departments").select("*").order("sort_order"),
      supabase.from("school_classes").select("*").order("sort_order"),
    ]).then(([d, c]) => {
      const deptList = (d.data as SchoolDepartment[]) ?? [];
      setDepartments(deptList.filter((x) => x.is_active !== false));
      setClasses((c.data as SchoolClass[]) ?? []);
      setLoading(false);
    });
  }, []);

  const deptClasses = deptId ? classes.filter((c) => c.department_id === deptId) : [];

  if (loading) return <div className="p-6 text-gray-500">로딩 중...</div>;

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold" style={{ color: INDIGO }}>반별 보고서</h3>
      <div className="flex flex-wrap gap-4 items-center bg-white rounded-xl border border-gray-100 p-4">
        <label className="flex items-center gap-2">
          <span className="text-sm font-medium">부서</span>
          <select value={deptId ?? ""} onChange={(e) => { setDeptId(e.target.value || null); setClassId(null); }} className="rounded-lg border border-gray-200 px-3 py-2 text-sm">
            <option value="">선택</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2">
          <span className="text-sm font-medium">반</span>
          <select value={classId ?? ""} onChange={(e) => setClassId(e.target.value || null)} className="rounded-lg border border-gray-200 px-3 py-2 text-sm">
            <option value="">전체</option>
            {deptClasses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2">
          <span className="text-sm font-medium">기간</span>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="rounded-lg border border-gray-200 px-3 py-2 text-sm" />
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="rounded-lg border border-gray-200 px-3 py-2 text-sm" />
        </label>
        <button type="button" className="px-4 py-2 rounded-xl text-white text-sm font-semibold" style={{ background: INDIGO }}>PDF 다운로드</button>
      </div>
      <div className="bg-white rounded-xl border border-gray-100 p-6">
        <p className="text-gray-500 text-sm">출석 현황 테이블 · 학생 명단 · 개인별 출석률 — 기간·부서 선택 후 PDF/인쇄 연동 예정.</p>
      </div>
    </div>
  );
}
