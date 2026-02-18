"use client";

import { useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from "recharts";
import type { DB } from "@/types/db";
import type { Member } from "@/types/db";

const NAVY = "#1e3a5f";
const GOLD = "#d4a574";
const CORAL = "#e74c3c";
const GREEN = "#10B981";
const PURPLE = "#8B5CF6";
const SKY = "#3B82F6";
const COLORS = [NAVY, GOLD, CORAL, GREEN, PURPLE, SKY, "#6b7280", "#a78bfa"];
const fmt = (n: number) => new Intl.NumberFormat("ko-KR").format(n);

function getAgeGroup(birth: string | undefined): string {
  if (!birth || !/^\d{4}/.test(birth)) return "미입력";
  const y = parseInt(birth.slice(0, 4), 10);
  const age = new Date().getFullYear() - y;
  if (age < 20) return "10대";
  if (age < 30) return "20대";
  if (age < 40) return "30대";
  if (age < 50) return "40대";
  if (age < 60) return "50대";
  if (age < 70) return "60대";
  return "70대+";
}

export interface StatisticsDashboardProps {
  db: DB;
}

export function StatisticsDashboard({ db }: StatisticsDashboardProps) {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);

  const members = db.members;
  const income = db.income ?? [];
  const expense = db.expense ?? [];
  const visits = db.visits ?? [];
  const newFamilyPrograms = db.newFamilyPrograms ?? [];
  const attendance = db.attendance ?? {};

  const yearStr = String(year);

  // A5-1 교인 통계
  const memberStats = useMemo(() => {
    const byStatus: Record<string, number> = {};
    let newThisYear = 0;
    let leftThisYear = 0;
    let male = 0;
    let female = 0;
    const byAge: Record<string, number> = {};
    const byRole: Record<string, number> = {};
    const byDept: Record<string, number> = {};
    const byMokjang: Record<string, number> = {};
    const byBaptism: Record<string, number> = {};
    const byStatusPie: Record<string, number> = {};
    const newByMonth: Record<string, number> = {};

    members.forEach((m) => {
      const status = m.member_status || m.status || "미등록";
      byStatus[status] = (byStatus[status] ?? 0) + 1;
      byStatusPie[status] = (byStatusPie[status] ?? 0) + 1;
      const created = (m.created_at ?? (m as unknown as { createdAt?: string }).createdAt)?.slice(0, 4);
      if (created === yearStr) newThisYear++;
      if ((status === "이적" || status === "제적") && created) {
        const createdY = parseInt(created, 10);
        if (createdY <= year && year === currentYear) leftThisYear++;
      }
      if (m.gender === "남" || m.gender === "male") male++;
      else if (m.gender === "여" || m.gender === "female") female++;
      const ageGrp = getAgeGroup(m.birth);
      byAge[ageGrp] = (byAge[ageGrp] ?? 0) + 1;
      const role = m.role || "성도";
      byRole[role] = (byRole[role] ?? 0) + 1;
      const dept = m.dept || "기타";
      byDept[dept] = (byDept[dept] ?? 0) + 1;
      const mokjang = m.mokjang || m.group || "미배정";
      byMokjang[mokjang] = (byMokjang[mokjang] ?? 0) + 1;
      const baptism = m.baptism_type || "미세례";
      byBaptism[baptism] = (byBaptism[baptism] ?? 0) + 1;
      if (created === yearStr && m.created_at) {
        const month = m.created_at.slice(0, 7);
        newByMonth[month] = (newByMonth[month] ?? 0) + 1;
      }
    });

    const total = members.length;
    const genderPie = [
      { name: "남", value: male, color: SKY },
      { name: "여", value: female, color: CORAL },
    ].filter((d) => d.value > 0);
    const ageData = Object.entries(byAge)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => ["10대", "20대", "30대", "40대", "50대", "60대", "70대+", "미입력"].indexOf(a.name) - ["10대", "20대", "30대", "40대", "50대", "60대", "70대+", "미입력"].indexOf(b.name));
    const roleData = Object.entries(byRole).map(([name, value], i) => ({ name, value, fill: COLORS[i % COLORS.length] }));
    const deptData = Object.entries(byDept).map(([name, value]) => ({ name, 인원: value }));
    const mokjangData = Object.entries(byMokjang).map(([name, value]) => ({ name, 인원: value }));
    const baptismData = Object.entries(byBaptism).map(([name, value], i) => ({ name, value, fill: COLORS[i % COLORS.length] }));
    const statusPieData = Object.entries(byStatusPie).map(([name, value], i) => ({ name, value, fill: COLORS[i % COLORS.length] }));
    const newTrendData = Object.entries(newByMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, count]) => ({ month: month.slice(5), 신규: count }));

    return {
      total,
      byStatus,
      newThisYear,
      leftThisYear,
      genderPie,
      male,
      female,
      ageData,
      roleData,
      deptData,
      mokjangData,
      baptismData,
      statusPieData,
      newTrendData,
    };
  }, [members, yearStr, currentYear]);

  // A5-2 출결 (week 기반)
  const attendanceStats = useMemo(() => {
    const weeksInYear = 52;
    const byMonth: Record<string, { present: number; total: number }> = {};
    for (let m = 1; m <= 12; m++) byMonth[String(m)] = { present: 0, total: 0 };
    let totalPresent = 0;
    let totalPossible = 0;
    members.forEach((m) => {
      const att = attendance[m.id] ?? {};
      for (let w = 1; w <= weeksInYear; w++) {
        const status = att[w];
        const month = Math.ceil((w * 7) / 30) || 1;
        const key = String(month > 12 ? 12 : month);
        byMonth[key].total += 1;
        if (status === "p") {
          byMonth[key].present += 1;
          totalPresent++;
        }
        totalPossible++;
      }
    });
    const monthlyRate = Object.entries(byMonth).map(([month, v]) => ({
      month: `${month}월`,
      출석률: v.total > 0 ? Math.round((v.present / v.total) * 100) : 0,
    }));
    const deptRates: Record<string, { present: number; total: number }> = {};
    members.forEach((m) => {
      const dept = m.dept || "기타";
      if (!deptRates[dept]) deptRates[dept] = { present: 0, total: 0 };
      deptRates[dept].total += 52;
      const att = attendance[m.id] ?? {};
      for (let w = 1; w <= 52; w++) if (att[w] === "p") deptRates[dept].present++;
    });
    const deptData = Object.entries(deptRates).map(([name, v]) => ({
      name,
      출석률: v.total > 0 ? Math.round((v.present / v.total) * 100) : 0,
    }));
    return { monthlyRate, deptData };
  }, [members, attendance]);

  // A5-3 재정
  const financeStats = useMemo(() => {
    const incByMonth: Record<string, number> = {};
    const expByMonth: Record<string, number> = {};
    const incByCat: Record<string, number> = {};
    const expByCat: Record<string, number> = {};
    for (let m = 1; m <= 12; m++) {
      const key = `${yearStr}-${String(m).padStart(2, "0")}`;
      incByMonth[key] = 0;
      expByMonth[key] = 0;
    }
    income.forEach((i) => {
      const d = i.date?.slice(0, 7);
      if (!d || d.slice(0, 4) !== yearStr) return;
      incByMonth[d] = (incByMonth[d] ?? 0) + (i.amount ?? 0);
      const cat = i.type || "기타";
      incByCat[cat] = (incByCat[cat] ?? 0) + (i.amount ?? 0);
    });
    expense.forEach((e) => {
      const d = e.date?.slice(0, 7);
      if (!d || d.slice(0, 4) !== yearStr) return;
      expByMonth[d] = (expByMonth[d] ?? 0) + (e.amount ?? 0);
      const cat = e.category || "기타";
      expByCat[cat] = (expByCat[cat] ?? 0) + (e.amount ?? 0);
    });
    const trendData = Object.keys(incByMonth)
      .sort()
      .map((month) => ({
        month: month.slice(5),
        수입: incByMonth[month] ?? 0,
        지출: expByMonth[month] ?? 0,
      }));
    const incTable = Object.entries(incByCat).map(([항목, 금액]) => ({ 항목, 금액 }));
    const expTable = Object.entries(expByCat).map(([항목, 금액]) => ({ 항목, 금액 }));
    return { trendData, incTable, expTable };
  }, [income, expense, yearStr]);

  // A5-4 심방
  const visitStats = useMemo(() => {
    const byMonth: Record<string, number> = {};
    const byPastor: Record<string, number> = {};
    const newByMonth: Record<string, number> = {};
    visits.forEach((v) => {
      const d = v.date?.slice(0, 7);
      if (!d || d.slice(0, 4) !== yearStr) return;
      byMonth[d] = (byMonth[d] ?? 0) + 1;
      const type = (v as { type?: string }).type || "기타";
      byPastor[type] = (byPastor[type] ?? 0) + 1;
    });
    members.forEach((m) => {
      const created = (m.created_at ?? (m as unknown as { createdAt?: string }).createdAt)?.slice(0, 7);
      if (created && created.startsWith(yearStr)) newByMonth[created] = (newByMonth[created] ?? 0) + 1;
    });
    const visitTrend = Object.entries(byMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, count]) => ({ month: month.slice(5), 심방: count }));
    const pastorTable = Object.entries(byPastor).map(([교역자, 건수]) => ({ 교역자, 건수 }));
    return { visitTrend, pastorTable };
  }, [visits, members, yearStr]);

  // A5-5 새가족
  const newFamilyStats = useMemo(() => {
    const thisYearPrograms = newFamilyPrograms.filter((p) => p.program_start_date?.startsWith(yearStr));
    const completed = thisYearPrograms.filter((p) => p.status === "수료").length;
    const total = thisYearPrograms.length;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
    const success = thisYearPrograms.filter((p) => p.status === "수료").length;
    const exit = thisYearPrograms.filter((p) => p.status === "중단").length;
    const pieData = [
      { name: "정착 성공", value: success, fill: GREEN },
      { name: "이탈", value: exit, fill: CORAL },
      { name: "진행중", value: total - success - exit, fill: SKY },
    ].filter((d) => d.value > 0);
    return { count: total, completionRate, pieData };
  }, [newFamilyPrograms, yearStr]);

  const EmptyMsg = () => <p className="text-sm text-gray-500 py-4 text-center">데이터가 없습니다.</p>;

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">연도</span>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
          >
            {[currentYear, currentYear - 1, currentYear - 2].map((y) => (
              <option key={y} value={y}>{y}년</option>
            ))}
          </select>
        </label>
      </div>

      {/* A5-1 교인 통계 */}
      <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-bold text-[#1e3a5f] mb-4">교인 통계</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="p-4 rounded-lg bg-gray-50">
            <p className="text-xs text-gray-500">전체 등록 교인</p>
            <p className="text-2xl font-bold text-[#1e3a5f]">{fmt(memberStats.total)}명</p>
          </div>
          <div className="p-4 rounded-lg bg-gray-50">
            <p className="text-xs text-gray-500">올해 신규 등록</p>
            <p className="text-2xl font-bold text-[#1e3a5f]">{fmt(memberStats.newThisYear)}명</p>
          </div>
          <div className="p-4 rounded-lg bg-gray-50">
            <p className="text-xs text-gray-500">올해 이적/제적</p>
            <p className="text-2xl font-bold text-[#1e3a5f]">{fmt(memberStats.leftThisYear)}명</p>
          </div>
          <div className="p-4 rounded-lg bg-gray-50 flex items-center gap-2">
            <div className="flex-1">
              <p className="text-xs text-gray-500">남녀 비율</p>
              <p className="text-sm font-medium">{memberStats.male} : {memberStats.female}</p>
            </div>
            {memberStats.genderPie.length > 0 && (
              <ResponsiveContainer width={60} height={60}>
                <PieChart>
                  <Pie data={memberStats.genderPie} cx="50%" cy="50%" innerRadius={14} outerRadius={28} dataKey="value" nameKey="name">
                    {memberStats.genderPie.map((entry, i) => (
                      <Cell key={i} fill={entry.color ?? COLORS[i]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {memberStats.genderPie.length > 0 ? (
            <div>
              <h3 className="text-sm font-semibold mb-2">성별 분포</h3>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={memberStats.genderPie} cx="50%" cy="50%" outerRadius={70} dataKey="value" nameKey="name" label={(e) => `${e.name} ${e.value}명`}>
                    {memberStats.genderPie.map((_, i) => <Cell key={i} fill={_.color} />)}
                  </Pie>
                  <Tooltip formatter={(v: number | undefined) => [(v ?? 0) + "명", ""]} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : <EmptyMsg />}
          {memberStats.ageData.length > 0 ? (
            <div>
              <h3 className="text-sm font-semibold mb-2">연령대별</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={memberStats.ageData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="value" name="인원" fill={NAVY} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : <EmptyMsg />}
        </div>
        {memberStats.roleData.length > 0 && (
          <div className="mt-6">
            <h3 className="text-sm font-semibold mb-2">직분별</h3>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={memberStats.roleData} cx="50%" cy="50%" outerRadius={70} dataKey="value" nameKey="name">
                  {memberStats.roleData.map((_, i) => <Cell key={i} fill={_.fill} />)}
                </Pie>
                <Tooltip formatter={(v: number | undefined) => [(v ?? 0) + "명", ""]} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
        {memberStats.deptData.length > 0 && (
          <div className="mt-6">
            <h3 className="text-sm font-semibold mb-2">부서별 인원</h3>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={memberStats.deptData} layout="vertical" margin={{ left: 50 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={48} />
                <Tooltip />
                <Bar dataKey="인원" fill={NAVY} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
        {memberStats.newTrendData.length > 0 && (
          <div className="mt-6">
            <h3 className="text-sm font-semibold mb-2">월별 신규 등록 추이</h3>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={memberStats.newTrendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line type="monotone" dataKey="신규" stroke={NAVY} strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      {/* A5-2 출결 */}
      <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-bold text-[#1e3a5f] mb-4">출결 통계</h2>
        {attendanceStats.monthlyRate.some((d) => d.출석률 > 0) ? (
          <>
            <h3 className="text-sm font-semibold mb-2">월별 평균 출석률</h3>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={attendanceStats.monthlyRate}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number | undefined) => [(v ?? 0) + "%", "출석률"]} />
                <Line type="monotone" dataKey="출석률" stroke={GREEN} strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
            {attendanceStats.deptData.length > 0 && (
              <div className="mt-6">
                <h3 className="text-sm font-semibold mb-2">부서별 출석률</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={attendanceStats.deptData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: number | undefined) => [(v ?? 0) + "%", "출석률"]} />
                    <Bar dataKey="출석률" fill={NAVY} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </>
        ) : <EmptyMsg />}
      </section>

      {/* A5-3 재정 */}
      <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-bold text-[#1e3a5f] mb-4">재정 통계</h2>
        {financeStats.trendData.length > 0 || financeStats.incTable.length > 0 ? (
          <>
            {financeStats.trendData.some((d) => d.수입 > 0 || d.지출 > 0) && (
              <>
                <h3 className="text-sm font-semibold mb-2">월별 수입/지출 추이</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={financeStats.trendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => fmt(Number(v))} />
                    <Tooltip formatter={(v: number | undefined) => [fmt(v ?? 0) + "원", ""]} />
                    <Legend />
                    <Line type="monotone" dataKey="수입" stroke={NAVY} strokeWidth={2} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="지출" stroke={CORAL} strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </>
            )}
            {financeStats.incTable.length > 0 && (
              <div className="mt-6 overflow-x-auto">
                <h3 className="text-sm font-semibold mb-2">수입 항목별 연간 합계</h3>
                <table className="w-full text-sm">
                  <thead><tr className="border-b"><th className="text-left py-2">항목</th><th className="text-right py-2">금액</th></tr></thead>
                  <tbody>
                    {financeStats.incTable.map((r) => (
                      <tr key={r.항목} className="border-b border-gray-100"><td className="py-2">{r.항목}</td><td className="text-right py-2">{fmt(r.금액)}원</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {financeStats.expTable.length > 0 && (
              <div className="mt-4 overflow-x-auto">
                <h3 className="text-sm font-semibold mb-2">지출 항목별 연간 합계</h3>
                <table className="w-full text-sm">
                  <thead><tr className="border-b"><th className="text-left py-2">항목</th><th className="text-right py-2">금액</th></tr></thead>
                  <tbody>
                    {financeStats.expTable.map((r) => (
                      <tr key={r.항목} className="border-b border-gray-100"><td className="py-2">{r.항목}</td><td className="text-right py-2">{fmt(r.금액)}원</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : <EmptyMsg />}
      </section>

      {/* A5-4 심방 */}
      <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-bold text-[#1e3a5f] mb-4">심방 통계</h2>
        {visitStats.visitTrend.length > 0 ? (
          <>
            <h3 className="text-sm font-semibold mb-2">월별 심방 건수</h3>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={visitStats.visitTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line type="monotone" dataKey="심방" stroke={PURPLE} strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
            {visitStats.pastorTable.length > 0 && (
              <div className="mt-4 overflow-x-auto">
                <h3 className="text-sm font-semibold mb-2">유형별 심방 현황</h3>
                <table className="w-full text-sm">
                  <thead><tr className="border-b"><th className="text-left py-2">유형</th><th className="text-right py-2">건수</th></tr></thead>
                  <tbody>
                    {visitStats.pastorTable.map((r) => (
                      <tr key={r.교역자} className="border-b border-gray-100"><td className="py-2">{r.교역자}</td><td className="text-right py-2">{fmt(r.건수)}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : <EmptyMsg />}
      </section>

      {/* A5-5 새가족 */}
      <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-bold text-[#1e3a5f] mb-4">새가족 현황</h2>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="p-4 rounded-lg bg-gray-50">
            <p className="text-xs text-gray-500">올해 새가족 등록</p>
            <p className="text-2xl font-bold text-[#1e3a5f]">{fmt(newFamilyStats.count)}명</p>
          </div>
          <div className="p-4 rounded-lg bg-gray-50">
            <p className="text-xs text-gray-500">4주 정착 완료율</p>
            <p className="text-2xl font-bold text-[#1e3a5f]">{newFamilyStats.completionRate}%</p>
          </div>
        </div>
        {newFamilyStats.pieData.length > 0 ? (
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={newFamilyStats.pieData} cx="50%" cy="50%" outerRadius={60} dataKey="value" nameKey="name">
                {newFamilyStats.pieData.map((_, i) => <Cell key={i} fill={_.fill} />)}
              </Pie>
              <Tooltip formatter={(v: number | undefined) => [(v ?? 0) + "명", ""]} />
            </PieChart>
          </ResponsiveContainer>
        ) : <EmptyMsg />}
      </section>
    </div>
  );
}
