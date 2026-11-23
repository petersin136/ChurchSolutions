"use client";

import { useState, useMemo, useEffect, type CSSProperties, type ReactNode } from "react";
import { useAppData } from "@/contexts/AppDataContext";
import type { DB, Member, Note, Visit, Income, MemberStatusHistory, NewFamilyProgram } from "@/types/db";
import { supabase } from "@/lib/supabase";
import { getChurchId, filterByChurch } from "@/lib/tenant";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import { getBaptismTermLabels, displayBaptismType } from "@/lib/churchTerminology";
import LazyChart from "../common/LazyChart";
import { MemberPhoto } from "@/components/common/MemberPhoto";

const SHEET = {
  font: "'Pretendard', system-ui, -apple-system, sans-serif",
  ink: "#0b0c0e",
  muted: "#8b909a",
  faint: "#a3a8b0",
  line: "rgba(0,0,0,0.06)",
  fill: "#f4f4f6",
  radius: 7,
} as const;

function displayGender(g?: string) {
  if (!g) return "";
  if (g === "M" || g === "남" || g === "male") return "남";
  if (g === "F" || g === "여" || g === "female") return "여";
  return g;
}

function sheetDate(s?: string) {
  if (!s) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!m) return s;
  return `${m[1]}. ${m[2]}. ${m[3]}`;
}

function attLabel(status?: string) {
  if (status === "p") return "출석";
  if (status === "o") return "온라인";
  if (status === "a") return "결석";
  if (status === "l") return "병결";
  if (status === "n") return "기타";
  return status || "";
}

export interface Member360ViewProps {
  member: Member;
  db: DB;
  statusHistory?: MemberStatusHistory[];
  newFamilyProgram?: NewFamilyProgram | null;
  onEdit?: () => void;
  onClose?: () => void;
  toast?: (msg: string, type?: "ok" | "err" | "warn") => void;
}

export function Member360View({ member, db, statusHistory = [], newFamilyProgram, onEdit, onClose, toast }: Member360ViewProps) {
  const [activeTab, setActiveTab] = useState<"info" | "attendance" | "giving" | "visits" | "newfamily" | "history">("info");
  const [dbStatusHistory, setDbStatusHistory] = useState<MemberStatusHistory[]>([]);
  const { rawAttendance } = useAppData();

  useEffect(() => {
    if (!supabase || !member.id) {
      setDbStatusHistory([]);
      return;
    }
    filterByChurch(supabase.from("member_status_history").select("id, member_id, previous_status, new_status, changed_at, reason, changed_by")).eq("member_id", member.id).order("changed_at", { ascending: false }).then(({ data, error }: { data: unknown[] | null; error: { message: string } | null }) => {
      if (error) return;
      setDbStatusHistory((data ?? []) as MemberStatusHistory[]);
    });
  }, [member.id]);

  const attendanceHistory = useMemo(() => {
    if (!member.id) return [];
    return rawAttendance
      .filter((a) => a.member_id === member.id && a.service_type === "주일예배" && a.date)
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
      .slice(0, 20)
      .map(a => ({
        date: a.date,
        service_type: a.service_type ?? "-",
        status: a.status,
      }));
  }, [rawAttendance, member.id]);

  const displayStatusHistory = dbStatusHistory.length > 0 ? dbStatusHistory : statusHistory;

  const attendanceByWeek = useMemo(() => {
    const att = (db.attendance && db.attendance[member.id]) ? db.attendance[member.id] : {};
    const currentYear = new Date().getFullYear();
    const weeks = 12;
    return Array.from({ length: weeks }, (_, i) => {
      const weekNum = 52 - weeks + i + 1;
      const status = att[weekNum];
      return { week: `${weekNum}주`, weekNum, present: status === "p" ? 1 : 0, absent: status === "a" ? 1 : 0, online: 0 };
    });
  }, [db.attendance, member.id]);

  const threeWeeksAbsent = useMemo(() => {
    const att = (db.attendance && db.attendance[member.id]) ? db.attendance[member.id] : {};
    const recent = attendanceByWeek.slice(-3);
    return recent.length === 3 && recent.every((r) => att[r.weekNum] === "a");
  }, [db.attendance, member.id, attendanceByWeek]);

  const attendanceRate = useMemo(() => {
    const att = (db.attendance && db.attendance[member.id]) ? db.attendance[member.id] : {};
    const weeks = Object.keys(att).map(Number).filter((w) => w >= 41 && w <= 52);
    if (weeks.length === 0) return 0;
    const present = weeks.filter((w) => att[w] === "p").length;
    return Math.round((present / 12) * 100);
  }, [db.attendance, member.id]);

  const givingTotal = useMemo(() => {
    const thisYear = new Date().getFullYear().toString();
    return (db.income ?? [])
      .filter((i) => (i.donor === member.name || i.donor === member.name?.trim()) && i.date?.startsWith(thisYear))
      .reduce((s, i) => s + (i.amount ?? 0), 0);
  }, [db.income, member.name]);

  const visitCount = useMemo(() => {
    const thisYear = new Date().getFullYear().toString();
    return (db.visits ?? []).filter((v) => v.memberId === member.id && v.date?.startsWith(thisYear)).length;
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

  const notes = useMemo(() => (db.notes && db.notes[member.id]) ? db.notes[member.id] : [], [db.notes, member.id]);
  const visits = useMemo(
    () => (db.visits ?? []).filter((v) => v.memberId === member.id).sort((a, b) => (b.date || "").localeCompare(a.date || "")).slice(0, 20),
    [db.visits, member.id]
  );
  const incomeList = useMemo(() => {
    const thisYear = new Date().getFullYear().toString();
    return (db.income ?? [])
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
    () => (member.family_id ? (db.members ?? []).filter((m) => m.family_id === member.family_id && m.id !== member.id) : []),
    [db.members, member.family_id, member.id]
  );

  const baptismLabels = getBaptismTermLabels(db.settings);
  const baptismCertLabel = baptismLabels.baptismCertificate;
  const baptismInfoLabel = baptismLabels.baptism;
  const baptismDisplayValue = displayBaptismType(member.baptism_type, db.settings);

  const meta = [member.role, member.dept, member.member_status || "활동", member.is_prospect ? "관심" : ""]
    .filter(Boolean)
    .join("  ·  ");
  const facts: [string, string][] = [
    ["성별", displayGender(member.gender)],
    ["생년월일", sheetDate(member.birth)],
    ["연락처", member.phone || ""],
    ["이메일", member.email || ""],
    ["주소", member.address || ""],
    ["직업", member.job || ""],
    ["부서", member.dept || ""],
    ["직분", member.role || ""],
    ["목장", member.group || ""],
    ["소그룹", member.small_group || ""],
    [baptismInfoLabel, [baptismDisplayValue, sheetDate(member.baptism_date)].filter(Boolean).join("  ")],
    ["등록일", sheetDate(member.registered_date)],
  ].filter((pair): pair is [string, string] => Boolean(pair[1] && pair[1] !== "-"));
  const attendanceHasBars = attendanceByWeek.some((w) => w.present || w.absent);

  const textBtn: CSSProperties = {
    border: "none",
    background: "none",
    padding: 0,
    fontFamily: SHEET.font,
    fontSize: 14,
    fontWeight: 600,
    color: SHEET.ink,
    cursor: "pointer",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, fontFamily: SHEET.font, color: SHEET.ink }}>

      <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
        <div style={{ width: 72, height: 72, borderRadius: "50%", background: SHEET.fill, overflow: "hidden", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <MemberPhoto
            photo={member.photo}
            name={member.name}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
            fallback={
              <span style={{ fontSize: 26, fontWeight: 700, color: SHEET.ink, letterSpacing: "-0.03em" }}>
                {(member.name?.trim() || "?")[0]}
              </span>
            }
          />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={{ margin: 0, fontSize: 28, fontWeight: 700, letterSpacing: "-0.04em", lineHeight: 1.15, textBoxTrim: "trim-both", textBoxEdge: "cap alphabetic" } as CSSProperties}>{member.name}</h2>
          {meta ? <div style={{ marginTop: 8, fontSize: 14, fontWeight: 500, color: SHEET.muted }}>{meta}</div> : null}
        </div>
        {onEdit && (
          <button type="button" onClick={onEdit} style={{ height: 36, padding: "0 16px", border: "none", borderRadius: SHEET.radius, background: SHEET.ink, color: "#fff", fontFamily: SHEET.font, fontSize: 14, fontWeight: 600, cursor: "pointer", flexShrink: 0 }}>
            편집
          </button>
        )}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "10px 18px", marginTop: 18 }}>
        {member.phone && <a href={`tel:${member.phone}`} style={{ ...textBtn, textDecoration: "none" }}>전화</a>}
        {member.phone && <a href={`sms:${member.phone}`} style={{ ...textBtn, textDecoration: "none" }}>문자</a>}
        <button type="button" style={textBtn} onClick={async () => { try { const { generateBaptismCertificatePdf } = await import("@/components/print/BaptismCertificate"); await generateBaptismCertificatePdf(member, db.settings?.churchName ?? "", null, db.settings); toast?.(`${baptismCertLabel} PDF 다운로드됨`, "ok"); } catch (e) { console.error(e); toast?.("PDF 생성 실패", "err"); } }}>{baptismCertLabel}</button>
        <button type="button" style={textBtn} onClick={async () => { try { const { generateMemberCertificatePdf } = await import("@/components/print/MemberCertificate"); await generateMemberCertificatePdf(member, db.settings?.churchName ?? "", null); toast?.("교인증명서 PDF 다운로드됨", "ok"); } catch (e) { console.error(e); toast?.("PDF 생성 실패", "err"); } }}>교인증명서</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 16, marginTop: 26, padding: "20px 0", borderTop: `1px solid ${SHEET.line}`, borderBottom: `1px solid ${SHEET.line}` }}>
        <Figure value={`${attendanceRate}%`} label="출석 · 12주" />
        <Figure value={givingTotal ? givingTotal.toLocaleString() : "0"} label="올해 헌금" />
        <Figure value={String(visitCount)} label="올해 심방" />
        <Figure value={newFamilyProgress != null ? `${newFamilyProgress}%` : "없음"} label="새가족" quiet={newFamilyProgress == null} />
      </div>

      <div style={{ display: "flex", gap: 22, marginTop: 8, overflowX: "auto", flexShrink: 0 }}>
        {([
          ["info", "정보"],
          ["attendance", "출결"],
          ["giving", "헌금"],
          ["visits", "심방"],
          ["newfamily", "새가족"],
          ["history", "상태"],
        ] as const).map(([id, label]) => {
          const on = activeTab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              style={{
                border: "none",
                background: "none",
                padding: "14px 0 12px",
                fontFamily: SHEET.font,
                fontSize: 15,
                fontWeight: on ? 700 : 500,
                color: on ? SHEET.ink : SHEET.muted,
                borderBottom: on ? `2px solid ${SHEET.ink}` : "2px solid transparent",
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", paddingTop: 22 }}>
        {activeTab === "info" && (
          <div>
            {facts.length === 0 ? <Empty>등록된 기본 정보가 없습니다.</Empty> : (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", columnGap: 28, rowGap: 22 }}>
                {facts.map(([label, value]) => (
                  <div key={label}>
                    <div style={{ fontSize: 12, fontWeight: 500, color: SHEET.muted, marginBottom: 6 }}>{label}</div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: SHEET.ink, lineHeight: 1.45, wordBreak: "break-word" }}>{value}</div>
                  </div>
                ))}
              </div>
            )}
            {familyMembers.length > 0 && (
              <div style={{ marginTop: 28 }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: SHEET.muted, marginBottom: 8 }}>가족</div>
                {familyMembers.map((m) => (
                  <div key={m.id} style={{ fontSize: 15, fontWeight: 600, padding: "8px 0", borderTop: `1px solid ${SHEET.line}` }}>
                    {m.name}{m.family_relation ? `  ·  ${m.family_relation}` : ""}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "attendance" && (
          <div>
            {threeWeeksAbsent && <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>최근 3주 연속 결석</div>}
            {attendanceHistory.length > 0 && (
              <div style={{ marginBottom: 22 }}>
                {attendanceHistory.map((row, i) => (
                  <div key={i} style={{ display: "grid", gridTemplateColumns: "120px 1fr auto", gap: 12, padding: "12px 0", borderTop: i === 0 ? "none" : `1px solid ${SHEET.line}`, fontSize: 14 }}>
                    <span style={{ fontWeight: 600 }}>{sheetDate(row.date)}</span>
                    <span style={{ color: SHEET.muted }}>{row.service_type}</span>
                    <span style={{ fontWeight: 600 }}>{attLabel(row.status)}</span>
                  </div>
                ))}
              </div>
            )}
            {attendanceHasBars ? (
              <LazyChart height={180}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={attendanceByWeek} barCategoryGap="28%">
                    <XAxis dataKey="week" tick={{ fontSize: 11, fill: SHEET.muted }} axisLine={false} tickLine={false} />
                    <YAxis hide />
                    <Tooltip cursor={{ fill: "rgba(0,0,0,0.03)" }} />
                    <Bar dataKey="present" fill={SHEET.ink} name="출석" stackId="a" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="absent" fill="#e3e4e8" name="결석" stackId="a" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </LazyChart>
            ) : attendanceHistory.length === 0 ? <Empty>출결 기록이 없습니다.</Empty> : null}
          </div>
        )}

        {activeTab === "giving" && (
          <div>
            {monthlyGiving.length > 0 && (
              <LazyChart height={180}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={monthlyGiving}>
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: SHEET.muted }} axisLine={false} tickLine={false} />
                    <YAxis hide />
                    <Tooltip formatter={(v: unknown) => [`${Number(v ?? 0).toLocaleString()}원`, ""]} />
                    <Line type="monotone" dataKey="amount" stroke={SHEET.ink} strokeWidth={1.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </LazyChart>
            )}
            {categoryGiving.length > 0 && (
              <div style={{ marginTop: monthlyGiving.length > 0 ? 18 : 0 }}>
                {categoryGiving.map((row) => (
                  <div key={row.name} style={{ display: "flex", justifyContent: "space-between", gap: 16, padding: "12px 0", borderTop: `1px solid ${SHEET.line}`, fontSize: 14 }}>
                    <span style={{ color: SHEET.muted }}>{row.name}</span>
                    <span style={{ fontWeight: 600 }}>{row.value.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
            {incomeList.length > 0 ? (
              <div style={{ marginTop: 8 }}>
                {incomeList.slice(0, 10).map((i) => (
                  <div key={i.id} style={{ display: "grid", gridTemplateColumns: "120px 1fr auto", gap: 12, padding: "12px 0", borderTop: `1px solid ${SHEET.line}`, fontSize: 14 }}>
                    <span style={{ fontWeight: 600 }}>{sheetDate(i.date)}</span>
                    <span style={{ color: SHEET.muted }}>{i.type}</span>
                    <span style={{ fontWeight: 600 }}>{i.amount.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            ) : <Empty>올해 헌금 기록이 없습니다.</Empty>}
          </div>
        )}

        {activeTab === "visits" && (
          <div>
            {visits.length === 0 ? <Empty>심방 기록이 없습니다.</Empty> : visits.map((v, i) => (
              <div key={v.id} style={{ padding: "14px 0", borderTop: i === 0 ? "none" : `1px solid ${SHEET.line}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 14 }}>
                  <span style={{ fontWeight: 700 }}>{sheetDate(v.date)}</span>
                  <span style={{ color: SHEET.muted }}>{v.type}</span>
                </div>
                {v.content ? <p style={{ margin: "8px 0 0", fontSize: 14, lineHeight: 1.55, color: SHEET.ink }}>{v.content}</p> : null}
              </div>
            ))}
          </div>
        )}

        {activeTab === "newfamily" && (
          <div>
            {!member.is_new_family && !newFamilyProgram ? <Empty>새가족 과정이 없습니다.</Empty> : null}
            {newFamilyProgress != null && (
              <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.03em", marginBottom: 16 }}>{newFamilyProgress}%</div>
            )}
            {newFamilyProgram && (
              <div>
                {[1, 2, 3, 4].map((w) => {
                  const done = Boolean(newFamilyProgram[`week${w}_completed` as keyof NewFamilyProgram]);
                  return (
                    <div key={w} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderTop: w === 1 ? "none" : `1px solid ${SHEET.line}`, fontSize: 15, fontWeight: 600, color: done ? SHEET.ink : SHEET.muted }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: done ? SHEET.ink : "#e3e4e8", flexShrink: 0 }} />
                      {w}주
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === "history" && (
          <div>
            {displayStatusHistory.length === 0 ? <Empty>상태 변경 이력이 없습니다.</Empty> : displayStatusHistory.map((h, i) => (
              <div key={h.id} style={{ padding: "14px 0", borderTop: i === 0 ? "none" : `1px solid ${SHEET.line}` }}>
                <div style={{ fontSize: 12, color: SHEET.muted }}>{sheetDate(h.changed_at?.slice(0, 10))}</div>
                <div style={{ marginTop: 4, fontSize: 15, fontWeight: 600 }}>{h.previous_status || "—"} → {h.new_status}</div>
                {h.reason ? <div style={{ marginTop: 4, fontSize: 14, color: SHEET.muted }}>{h.reason}</div> : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Figure({ value, label, quiet }: { value: string; label: string; quiet?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: quiet ? 16 : 22, fontWeight: 700, letterSpacing: "-0.04em", lineHeight: 1.1, color: quiet ? SHEET.muted : SHEET.ink }}>{value}</div>
      <div style={{ marginTop: 8, fontSize: 12, fontWeight: 500, color: SHEET.muted }}>{label}</div>
    </div>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <div style={{ fontSize: 14, color: SHEET.muted, padding: "8px 0 16px" }}>{children}</div>;
}
