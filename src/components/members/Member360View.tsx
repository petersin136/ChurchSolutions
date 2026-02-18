"use client";

import { useState, useMemo } from "react";
import type { DB, Member, Note, Visit, Income, MemberStatusHistory, NewFamilyProgram } from "@/types/db";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from "recharts";

const STATUS_BADGE_COLOR: Record<string, string> = {
  활동: "#10B981",
  휴적: "#F59E0B",
  은퇴: "#6B7280",
  별세: "#1F2937",
  이적: "#EF4444",
  제적: "#DC2626",
  미등록: "#9CA3AF",
};

export interface Member360ViewProps {
  member: Member;
  db: DB;
  statusHistory?: MemberStatusHistory[];
  newFamilyProgram?: NewFamilyProgram | null;
  onEdit?: () => void;
  onClose?: () => void;
}

export function Member360View({ member, db, statusHistory = [], newFamilyProgram, onEdit, onClose }: Member360ViewProps) {
  const [activeTab, setActiveTab] = useState<"info" | "attendance" | "giving" | "visits" | "newfamily" | "history">("info");

  const initials = useMemo(() => {
    const n = member.name?.trim() || "";
    if (n.length >= 2) return n.slice(0, 2);
    return n || "?";
  }, [member.name]);

  const attendanceByWeek = useMemo(() => {
    const att = db.attendance[member.id] || {};
    const currentYear = new Date().getFullYear();
    const weeks = 12;
    return Array.from({ length: weeks }, (_, i) => {
      const weekNum = 52 - weeks + i + 1;
      const status = att[weekNum];
      return { week: `${weekNum}주`, weekNum, present: status === "p" ? 1 : 0, absent: status === "a" ? 1 : 0, online: 0 };
    });
  }, [db.attendance, member.id]);

  const threeWeeksAbsent = useMemo(() => {
    const att = db.attendance[member.id] || {};
    const recent = attendanceByWeek.slice(-3);
    return recent.length === 3 && recent.every((r) => att[r.weekNum] === "a");
  }, [db.attendance, member.id, attendanceByWeek]);

  const attendanceRate = useMemo(() => {
    const att = db.attendance[member.id] || {};
    const weeks = Object.keys(att).map(Number).filter((w) => w >= 41 && w <= 52);
    if (weeks.length === 0) return 0;
    const present = weeks.filter((w) => att[w] === "p").length;
    return Math.round((present / 12) * 100);
  }, [db.attendance, member.id]);

  const givingTotal = useMemo(() => {
    const thisYear = new Date().getFullYear().toString();
    return db.income
      .filter((i) => (i.donor === member.name || i.donor === member.name?.trim()) && i.date?.startsWith(thisYear))
      .reduce((s, i) => s + i.amount, 0);
  }, [db.income, member.name]);

  const visitCount = useMemo(() => {
    const thisYear = new Date().getFullYear().toString();
    return db.visits.filter((v) => v.memberId === member.id && v.date?.startsWith(thisYear)).length;
  }, [db.visits, member.id]);

  const newFamilyProgress = useMemo(() => {
    if (!newFamilyProgram) return null;
    const w = [
      newFamilyProgram.week1_completed,
      newFamilyProgram.week2_completed,
      newFamilyProgram.week3_completed,
      newFamilyProgram.week4_completed,
    ].filter(Boolean).length;
    return Math.round((w / 4) * 100);
  }, [newFamilyProgram]);

  const notes = useMemo(() => db.notes[member.id] || [], [db.notes, member.id]);
  const visits = useMemo(
    () => db.visits.filter((v) => v.memberId === member.id).sort((a, b) => (b.date || "").localeCompare(a.date || "")).slice(0, 20),
    [db.visits, member.id]
  );
  const incomeList = useMemo(() => {
    const thisYear = new Date().getFullYear().toString();
    return db.income
      .filter((i) => i.donor === member.name && i.date?.startsWith(thisYear))
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
      .slice(0, 30);
  }, [db.income, member.name]);

  const monthlyGiving = useMemo(() => {
    const map: Record<string, number> = {};
    incomeList.forEach((i) => {
      const month = (i.date || "").slice(0, 7);
      map[month] = (map[month] || 0) + i.amount;
    });
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, amount]) => ({ month: month.slice(5) + "월", amount }));
  }, [incomeList]);

  const categoryGiving = useMemo(() => {
    const map: Record<string, number> = {};
    incomeList.forEach((i) => {
      const cat = i.type || "기타";
      map[cat] = (map[cat] || 0) + i.amount;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [incomeList]);

  const familyMembers = useMemo(
    () => (member.family_id ? db.members.filter((m) => m.family_id === member.family_id && m.id !== member.id) : []),
    [db.members, member.family_id, member.id]
  );

  const statusColor = STATUS_BADGE_COLOR[member.member_status || ""] || "#6B7280";

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden max-h-[90vh] flex flex-col">
      {/* 프로필 헤더 */}
      <div className="bg-gradient-to-r from-[#1e3a5f] to-[#2d5a8e] text-white p-6 flex flex-wrap items-center gap-4">
        <div className="w-[100px] h-[100px] rounded-full border-4 border-white/30 overflow-hidden bg-white/20 flex items-center justify-center shrink-0">
          {member.photo ? (
            <img src={member.photo} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="text-2xl font-bold text-white/90">{initials}</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-2xl font-bold truncate">{member.name}</h2>
          <div className="flex flex-wrap gap-2 mt-2">
            {member.role && <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-white/20">{member.role}</span>}
            {member.dept && <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-white/20">{member.dept}</span>}
            <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: statusColor }}>{member.member_status || "활동"}</span>
            {member.is_prospect && <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-amber-500/80">관심 성도</span>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onEdit && <button type="button" onClick={onEdit} className="p-2 rounded-lg bg-white/20 hover:bg-white/30 text-sm font-medium">편집</button>}
          {member.phone && <a href={`tel:${member.phone}`} className="p-2 rounded-lg bg-white/20 hover:bg-white/30 text-sm font-medium">전화</a>}
          {member.phone && <a href={`sms:${member.phone}`} className="p-2 rounded-lg bg-white/20 hover:bg-white/30 text-sm font-medium">문자</a>}
          {onClose && <button type="button" onClick={onClose} className="p-2 rounded-lg bg-white/20 hover:bg-white/30 text-sm font-medium">닫기</button>}
        </div>
      </div>

      {/* 미니 통계 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 border-b border-gray-100">
        <div className="bg-gray-50 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-[#1e3a5f]">{attendanceRate}%</div>
          <div className="text-xs text-gray-500">출석률 (최근 12주)</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-3 text-center">
          <div className="text-xl font-bold text-[#1e3a5f]">{givingTotal.toLocaleString()}원</div>
          <div className="text-xs text-gray-500">올해 헌금</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-[#1e3a5f]">{visitCount}</div>
          <div className="text-xs text-gray-500">올해 심방</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-3 text-center">
          <div className="text-xl font-bold text-[#1e3a5f]">{newFamilyProgress != null ? `${newFamilyProgress}%` : "해당없음"}</div>
          <div className="text-xs text-gray-500">새가족 정착</div>
        </div>
      </div>

      {/* 탭 */}
      <div className="flex border-b border-gray-200 overflow-x-auto">
        {(["info", "attendance", "giving", "visits", "newfamily", "history"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition ${activeTab === tab ? "border-[#1e3a5f] text-[#1e3a5f]" : "border-transparent text-gray-500 hover:text-gray-700"}`}
          >
            {tab === "info" && "기본 정보"}
            {tab === "attendance" && "출결 현황"}
            {tab === "giving" && "헌금 내역"}
            {tab === "visits" && "심방 기록"}
            {tab === "newfamily" && "새가족 정착"}
            {tab === "history" && "상태 이력"}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        {activeTab === "info" && (
          <div className="space-y-4">
            <InfoRow label="성별" value={member.gender || "-"} />
            <InfoRow label="생년월일" value={member.birth || "-"} />
            <InfoRow label="연락처" value={member.phone || "-"} />
            <InfoRow label="이메일" value={member.email || "-"} />
            <InfoRow label="주소" value={member.address || "-"} />
            <InfoRow label="직업" value={member.job || "-"} />
            <InfoRow label="부서" value={member.dept || "-"} />
            <InfoRow label="직분" value={member.role || "-"} />
            <InfoRow label="목장" value={member.group || "-"} />
            <InfoRow label="소그룹" value={member.small_group || "-"} />
            <InfoRow label="세례" value={[member.baptism_type, member.baptism_date].filter(Boolean).join(" ") || "-"} />
            <InfoRow label="등록일" value={member.registered_date || "-"} />
            {member.family_id && (
              <div>
                <div className="text-xs text-gray-500 mb-1">가족 구성원</div>
                <ul className="space-y-1">
                  {familyMembers.map((m) => (
                    <li key={m.id} className="text-sm text-gray-800">{m.name} {m.family_relation ? `(${m.family_relation})` : ""}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {activeTab === "attendance" && (
          <div className="space-y-4">
            {threeWeeksAbsent && (
              <div className="rounded-lg bg-red-50 border border-red-200 text-red-800 px-4 py-3 text-sm font-medium">
                ⚠️ 최근 3주 연속 결석
              </div>
            )}
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={attendanceByWeek}>
                  <XAxis dataKey="week" tick={{ fontSize: 10 }} />
                  <YAxis hide />
                  <Tooltip />
                  <Bar dataKey="present" fill="#1e3a5f" name="출석" stackId="a" />
                  <Bar dataKey="absent" fill="#e5e7eb" name="결석" stackId="a" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {activeTab === "giving" && (
          <div className="space-y-4">
            {monthlyGiving.length > 0 && (
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={monthlyGiving}>
                    <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 10000).toFixed(0)}만`} />
                    <Tooltip formatter={(v: number) => [`${Number(v).toLocaleString()}원`, "금액"]} />
                    <Line type="monotone" dataKey="amount" stroke="#d4a574" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
            {categoryGiving.length > 0 && (
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={categoryGiving} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={(e) => e.name}>
                      {categoryGiving.map((_, i) => <Cell key={i} fill={["#1e3a5f", "#d4a574", "#6B7280", "#10B981", "#F59E0B"][i % 5]} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => [`${Number(v).toLocaleString()}원`, ""]} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
            <div>
              <div className="text-sm font-medium text-gray-700 mb-2">최근 헌금</div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b"><th className="text-left py-2">날짜</th><th className="text-left py-2">구분</th><th className="text-right py-2">금액</th></tr></thead>
                  <tbody>
                    {incomeList.slice(0, 10).map((i) => (
                      <tr key={i.id} className="border-b border-gray-100"><td className="py-1">{i.date}</td><td>{i.type}</td><td className="text-right">{i.amount.toLocaleString()}원</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === "visits" && (
          <div className="space-y-3">
            {visits.length === 0 ? <p className="text-sm text-gray-500">심방 기록이 없습니다.</p> : visits.map((v) => (
              <div key={v.id} className="border border-gray-100 rounded-lg p-3">
                <div className="flex justify-between text-sm"><span className="font-medium text-gray-800">{v.date}</span><span className="text-gray-500">{v.type}</span></div>
                <p className="text-sm text-gray-600 mt-1 line-clamp-2">{v.content}</p>
              </div>
            ))}
          </div>
        )}

        {activeTab === "newfamily" && (
          <div className="space-y-4">
            {!member.is_new_family && !newFamilyProgram && <p className="text-sm text-gray-500">해당 없음</p>}
            {newFamilyProgram && (
              <div>
                <div className="text-sm font-medium text-gray-700 mb-2">4주 정착 프로그램</div>
                <ul className="space-y-2">
                  {[1, 2, 3, 4].map((w) => (
                    <li key={w} className="flex items-center gap-2 text-sm">
                      <span className={newFamilyProgram[`week${w}_completed` as keyof NewFamilyProgram] ? "text-green-600" : "text-gray-400"}>
                        {newFamilyProgram[`week${w}_completed` as keyof NewFamilyProgram] ? "✓" : "○"} 주{w}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-gray-500 mt-2">상태: {newFamilyProgram.status}</p>
              </div>
            )}
          </div>
        )}

        {activeTab === "history" && (
          <div className="space-y-3">
            {statusHistory.length === 0 ? <p className="text-sm text-gray-500">상태 변경 이력이 없습니다.</p> : statusHistory.map((h) => (
              <div key={h.id} className="border border-gray-100 rounded-lg p-3 text-sm">
                <div className="text-gray-500">{h.changed_at?.slice(0, 10)}</div>
                <div className="font-medium text-gray-800">{h.previous_status || "-"} → {h.new_status}</div>
                {h.reason && <div className="text-gray-600 mt-1">{h.reason}</div>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-sm text-gray-800">{value}</div>
    </div>
  );
}
