"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import type { DB, Attendance, Income, Expense, Settings, Member } from "@/types/db";
import { DEFAULT_DB } from "@/types/db";
import { useAppData } from "@/contexts/AppDataContext";
import { getChurchId } from "@/lib/tenant";
import { StatisticsDashboard } from "@/components/statistics/StatisticsDashboard";
import { WeeklyReport } from "@/components/reports/WeeklyReport";
import { MonthlyReport } from "@/components/reports/MonthlyReport";
import { SeniorPastorReport } from "@/components/reports/SeniorPastorReport";
import { DepartmentReport } from "@/components/reports/DepartmentReport";
import { VisitPlanReport } from "@/components/reports/VisitPlanReport";
import { UpcomingEvents } from "@/components/reports/UpcomingEvents";
import { AttendanceStatistics } from "@/components/attendance/AttendanceStatistics";
import { CalendarDropdown } from "@/components/CalendarDropdown";
import { ModernSelect } from "@/components/common/ModernSelect";
import { getSundayForWeekNum, saveSettingsToSupabase } from "@/lib/store";

const NAVY = "#1B2A4A";
const MUTED = "#6b7b9e";
const SUB = "#999";
const TEXT = "#555";
const WHITE = "#fff";
const BORDER = "#e8ecf1";
const BG_SUMMARY = "#f8f9fb";
const BAR_TRACK = "#f0f2f5";
const ROW_ALT = "#fafbfc";
const FOOT_MUTED = "#bbb";

/** 보고서 상세 필터: CalendarDropdown 트리거(앱 기존 캘린더 모달과 동일 컴포넌트) */
const reportFilterDateTrigger: React.CSSProperties = {
  height: 32,
  minHeight: 32,
  maxHeight: 32,
  fontSize: 11,
  borderRadius: 6,
  border: `1px solid ${BORDER}`,
  padding: "0 6px",
  boxSizing: "border-box",
};

function useIsMobile(bp = 768) {
  const [m, setM] = useState(false);
  useEffect(() => {
    const c = () => setM(window.innerWidth <= bp);
    c();
    window.addEventListener("resize", c);
    return () => window.removeEventListener("resize", c);
  }, [bp]);
  return m;
}

function fmtLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

type ReportId =
  | "p_member_list"
  | "p_attendance"
  | "p_absentee"
  | "p_new_family"
  | "p_mokjang"
  | "v_visit"
  | "v_counsel"
  | "f_offering"
  | "f_expense"
  | "x_dashboard"
  | "x_weekly"
  | "x_monthly"
  | "x_senior"
  | "x_dept"
  | "x_visit_plan"
  | "x_upcoming";

interface ReportCardDef {
  id: ReportId;
  title: string;
  desc: string;
  initial: string;
}

const REPORT_GROUPS: { category: string; items: ReportCardDef[] }[] = [
  {
    category: "목양",
    items: [
      { id: "p_member_list", title: "성도 명단", desc: "전체 성도 목록 (이름, 연락처, 부서, 상태)", initial: "목" },
      { id: "p_attendance", title: "출석 통계 보고서", desc: "기간별 출석률, 부서별 출석 현황", initial: "목" },
      { id: "p_absentee", title: "결석자 보고서", desc: "연속 결석자 명단 및 관리 현황", initial: "목" },
      { id: "p_new_family", title: "새가족 정착 보고서", desc: "새가족 정착 프로그램 진행 현황", initial: "목" },
      { id: "p_mokjang", title: "목장 현황 보고서", desc: "목장별 인원 및 출석 현황", initial: "목" },
    ],
  },
  {
    category: "심방·상담",
    items: [
      { id: "v_visit", title: "심방 기록 보고서", desc: "기간별 심방 내역 및 통계", initial: "심" },
      { id: "v_counsel", title: "상담 기록 보고서", desc: "기간별 상담 내역 및 통계", initial: "상" },
    ],
  },
  {
    category: "재정",
    items: [
      { id: "f_offering", title: "헌금 보고서", desc: "기간별 헌금 내역 및 통계", initial: "재" },
      { id: "f_expense", title: "지출 보고서", desc: "기간별 지출 내역 및 통계", initial: "재" },
    ],
  },
  {
    category: "통계·서식",
    items: [
      { id: "x_dashboard", title: "종합 대시보드", desc: "교인·출결·재정·심방 통합", initial: "통" },
      { id: "x_weekly", title: "주간 보고서", desc: "주간 사역 보고서", initial: "통" },
      { id: "x_monthly", title: "월간 보고서", desc: "월간 사역 보고서", initial: "통" },
      { id: "x_senior", title: "담임목사 보고서", desc: "담임목사용 종합 보고서", initial: "통" },
      { id: "x_dept", title: "부서별 보고서", desc: "부서별 현황", initial: "통" },
      { id: "x_visit_plan", title: "심방 계획서", desc: "심방·업무 계획", initial: "통" },
      { id: "x_upcoming", title: "경조사 알림", desc: "다가오는 경조사", initial: "통" },
    ],
  },
];

const DB_STATUS_TO_UI: Record<string, Attendance["status"]> = {
  p: "출석",
  o: "온라인",
  a: "결석",
  l: "병결",
  n: "기타",
};

interface ReportsSettingsPageProps {
  db: DB;
  setDb: React.Dispatch<React.SetStateAction<DB>>;
  save: () => void;
  saveDb?: (d: DB) => Promise<void>;
  toast: (msg: string, type?: "ok" | "err" | "warn") => void;
}

function DataBackupPanel({
  db,
  setDb,
  save,
  saveDb,
  toast,
}: ReportsSettingsPageProps) {
  const mob = useIsMobile();
  const importRef = useRef<HTMLInputElement>(null);
  const [resetLoading, setResetLoading] = useState(false);

  const exportBackup = useCallback(() => {
    const json = JSON.stringify(db);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `superplanner_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast("백업 파일이 다운로드되었습니다", "ok");
  }, [db, toast]);

  const importBackup = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = JSON.parse(reader.result as string) as Partial<DB>;
          const merged = { ...db, ...parsed };
          setDb(() => merged);
          if (saveDb) saveDb(merged).then(() => toast("복원 완료", "ok")).catch(() => toast("저장 실패", "err"));
          else {
            save();
            toast("복원 완료", "ok");
          }
        } catch {
          toast("잘못된 백업 파일입니다", "err");
        }
      };
      reader.readAsText(file);
      e.target.value = "";
    },
    [db, setDb, save, saveDb, toast]
  );

  const clearAllData = useCallback(async () => {
    if (typeof window === "undefined") return;
    if (!window.confirm("정말 모든 데이터를 초기화하시겠습니까?\n이 작업은 되돌릴 수 없습니다.")) return;
    try {
      setResetLoading(true);
      if (saveDb) {
        let cid: string;
        try {
          cid = getChurchId();
        } catch {
          toast("교회 정보가 없습니다. 로그인 후 다시 시도하세요.", "err");
          return;
        }
        const res = await fetch("/api/reset", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scope: "all", churchId: cid }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data?.ok) {
          throw new Error(data?.message || res.statusText || "전체 초기화 요청 실패");
        }
      }
      setDb({ ...DEFAULT_DB });
      save();
      toast("전체 초기화 완료", "warn");
      window.location.reload();
    } catch (err) {
      console.error("전체 초기화 오류:", err);
      alert("초기화 중 오류가 발생했습니다.\n" + (err instanceof Error ? err.message : String(err)));
    } finally {
      setResetLoading(false);
    }
  }, [setDb, save, saveDb, toast]);

  const btn: React.CSSProperties = {
    padding: mob ? "6px 12px" : "8px 14px",
    borderRadius: 8,
    fontSize: mob ? 11 : 12,
    fontWeight: 600,
    fontFamily: "inherit",
    cursor: "pointer",
    border: `1px solid ${BORDER}`,
    background: WHITE,
    color: TEXT,
    boxSizing: "border-box",
  };

  return (
    <div style={{ ...sectionCard, padding: mob ? 12 : 16 }}>
      <div style={sectionTitle}>데이터</div>
      <div style={{ fontSize: 11, color: SUB, marginBottom: 12, lineHeight: 1.45 }}>
        백업·복원·초기화는 전체 교회 데이터에 적용됩니다. 초기화 전 반드시 백업하세요.
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, width: "100%", justifyContent: "center" }}>
        <button type="button" style={{ ...btn, flex: 1, minWidth: 100, justifyContent: "center" }} onClick={exportBackup}>
          데이터 백업
        </button>
        <button type="button" style={{ ...btn, flex: 1, minWidth: 100 }} onClick={() => importRef.current?.click()}>
          데이터 복원
        </button>
        <input ref={importRef} type="file" accept=".json,application/json" style={{ display: "none" }} onChange={importBackup} />
        <button
          type="button"
          style={{ ...btn, flex: 1, minWidth: 100, border: `1px solid ${BORDER}`, color: SUB, background: BG_SUMMARY }}
          onClick={clearAllData}
          disabled={resetLoading}
        >
          {resetLoading ? "처리 중…" : "전체 초기화"}
        </button>
      </div>
    </div>
  );
}

const sectionCard: React.CSSProperties = {
  background: WHITE,
  borderRadius: 8,
  border: `1px solid ${BORDER}`,
  padding: 12,
  maxWidth: "100%",
  boxSizing: "border-box",
};

const sectionTitle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  color: NAVY,
  marginBottom: 8,
};

const fieldInput: React.CSSProperties = {
  height: 32,
  fontSize: 12,
  borderRadius: 6,
  border: `1px solid ${BORDER}`,
  padding: "0 10px",
  width: "100%",
  maxWidth: "100%",
  boxSizing: "border-box",
  fontFamily: "inherit",
  color: TEXT,
  background: WHITE,
};

function ChurchInfoSettingsCard({ db, setDb, save, toast }: Pick<ReportsSettingsPageProps, "db" | "setDb" | "save" | "toast">) {
  const s = db.settings;
  const patch = (partial: Partial<Settings>) => {
    setDb((prev) => ({ ...prev, settings: { ...prev.settings, ...partial } }));
  };
  const handleSave = async () => {
    try {
      await saveSettingsToSupabase(db.settings);
      save();
      toast("교회 정보가 저장되었습니다", "ok");
    } catch (e) {
      console.error(e);
      toast("교회 정보 저장 실패: " + (e instanceof Error ? e.message : String(e)), "err");
    }
  };
  return (
    <div style={sectionCard}>
      <div style={sectionTitle}>교회 정보</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11, color: SUB }}>
          교회명
          <input
            type="text"
            value={s.churchName ?? ""}
            onChange={(e) => patch({ churchName: e.target.value })}
            style={fieldInput}
          />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11, color: SUB }}>
          담임목사명
          <input
            type="text"
            value={s.pastor ?? ""}
            onChange={(e) => patch({ pastor: e.target.value })}
            style={fieldInput}
          />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11, color: SUB }}>
          소재지
          <input
            type="text"
            value={s.address ?? ""}
            onChange={(e) => patch({ address: e.target.value })}
            style={fieldInput}
          />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11, color: SUB }}>
          사업자등록번호(고유번호)
          <input
            type="text"
            value={s.businessNumber ?? ""}
            onChange={(e) => patch({ businessNumber: e.target.value })}
            style={fieldInput}
          />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11, color: SUB }}>
          교단
          <input
            type="text"
            value={s.denomination ?? ""}
            onChange={(e) => patch({ denomination: e.target.value })}
            placeholder="예: 장로교, 침례교"
            style={fieldInput}
          />
        </label>
        <button
          type="button"
          onClick={handleSave}
          style={{
            marginTop: 4,
            width: "100%",
            height: 36,
            padding: "0 14px",
            fontSize: 12,
            fontWeight: 600,
            borderRadius: 6,
            border: "none",
            background: NAVY,
            color: WHITE,
            cursor: "pointer",
            fontFamily: "inherit",
            textAlign: "center",
          }}
        >
          저장
        </button>
      </div>
    </div>
  );
}

function NotificationSettingsCard({ db, setDb, save }: Pick<ReportsSettingsPageProps, "db" | "setDb" | "save">) {
  const s = db.settings;
  const weeks = s.absenteeAlertConsecutiveWeeks ?? 3;
  const newFamilyOn = s.alertNewFamilyIncomplete !== false;
  const patch = (partial: Partial<Settings>) => {
    setDb((prev) => ({ ...prev, settings: { ...prev.settings, ...partial } }));
    save();
  };
  const toggleRow = (label: string, active: boolean, onOn: () => void, onOff: () => void) => (
    <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 8 }}>
      <span style={{ fontSize: 12, color: TEXT }}>{label}</span>
      <div
        style={{
          width: "100%",
          display: "flex",
          borderRadius: 8,
          overflow: "hidden",
          border: `1px solid ${BORDER}`,
          margin: "0 0 12px 0",
        }}
      >
        <button
          type="button"
          onClick={onOn}
          style={{
            flex: 1,
            height: 36,
            fontSize: 13,
            fontWeight: 600,
            border: "none",
            fontFamily: "inherit",
            cursor: "pointer",
            background: active ? NAVY : WHITE,
            color: active ? WHITE : TEXT,
          }}
        >
          켜기
        </button>
        <button
          type="button"
          onClick={onOff}
          style={{
            flex: 1,
            height: 36,
            fontSize: 13,
            fontWeight: 600,
            border: "none",
            fontFamily: "inherit",
            cursor: "pointer",
            background: !active ? NAVY : WHITE,
            color: !active ? WHITE : TEXT,
          }}
        >
          끄기
        </button>
      </div>
    </div>
  );
  return (
    <div style={sectionCard}>
      <div style={sectionTitle}>알림 설정</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 11, color: SUB }}>
          결석 알림 기준 (연속 주)
          <select
            value={weeks}
            onChange={(e) => patch({ absenteeAlertConsecutiveWeeks: Number(e.target.value) })}
            style={{ ...fieldInput, height: 36, cursor: "pointer" }}
          >
            {[2, 3, 4, 5, 6, 7, 8].map((n) => (
              <option key={n} value={n}>
                {n}주
              </option>
            ))}
          </select>
          <span style={{ fontSize: 10, color: SUB, lineHeight: 1.4 }}>연속 결석이 이 주 수에 도달하면 알림(향후 연동) 기준으로 사용됩니다.</span>
        </label>
        {toggleRow(
          "새가족 정착 미완료 알림",
          newFamilyOn,
          () => patch({ alertNewFamilyIncomplete: true }),
          () => patch({ alertNewFamilyIncomplete: false })
        )}
      </div>
    </div>
  );
}

function ReportPrintHeader({
  churchName,
  reportTitle,
  startDate,
  endDate,
}: {
  churchName: string;
  reportTitle: string;
  startDate: string;
  endDate: string;
}) {
  const created = new Date().toLocaleDateString("ko-KR");
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        borderBottom: `2px solid ${NAVY}`,
        paddingBottom: 12,
        marginBottom: 16,
      }}
    >
      <div>
        <div style={{ fontSize: 11, color: SUB }}>{churchName.trim() || "교회명"}</div>
        <div style={{ fontSize: 18, fontWeight: 800, color: NAVY, marginTop: 4 }}>{reportTitle}</div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={{ fontSize: 11, color: SUB }}>
          {startDate} ~ {endDate}
        </div>
        <div style={{ fontSize: 10, color: FOOT_MUTED, marginTop: 2 }}>생성일: {created}</div>
      </div>
    </div>
  );
}

function ReportPrintFooter({ churchName }: { churchName: string }) {
  const d = new Date().toLocaleDateString("ko-KR");
  const name = churchName.trim() || "교회";
  return (
    <div
      style={{
        borderTop: `1px solid ${BORDER}`,
        paddingTop: 8,
        marginTop: 16,
        textAlign: "center",
        fontSize: 9,
        color: FOOT_MUTED,
      }}
    >
      {name} · 보고서 자동 생성 · {d}
    </div>
  );
}

function MemberListPrintBody({
  members,
  totalMembers,
  activeMembers,
  newFamilyCount,
  riskCount,
  departments,
}: {
  members: Member[];
  totalMembers: number;
  activeMembers: number;
  newFamilyCount: number;
  riskCount: number;
  departments: { name: string; count: number; barPct: number; sharePct: number }[];
}) {
  const card: React.CSSProperties = {
    padding: "10px 12px",
    borderRadius: 6,
    background: BG_SUMMARY,
    border: `1px solid ${BORDER}`,
  };
  const th: React.CSSProperties = {
    padding: "6px 8px",
    textAlign: "left",
    fontWeight: 700,
    color: NAVY,
    fontSize: 11,
  };
  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
        <div style={card}>
          <div style={{ fontSize: 10, color: MUTED }}>전체 성도</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: NAVY }}>{totalMembers}명</div>
        </div>
        <div style={card}>
          <div style={{ fontSize: 10, color: MUTED }}>활동 성도</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: NAVY }}>{activeMembers}명</div>
        </div>
        <div style={card}>
          <div style={{ fontSize: 10, color: MUTED }}>새가족</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: NAVY }}>{newFamilyCount}명</div>
        </div>
        <div style={card}>
          <div style={{ fontSize: 10, color: MUTED }}>휴면·위험</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: NAVY }}>{riskCount}명</div>
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: NAVY, marginBottom: 8 }}>부서별 현황</div>
        {departments.length === 0 ? (
          <div style={{ fontSize: 11, color: SUB }}>데이터 없음</div>
        ) : (
          departments.map((dept) => (
            <div key={dept.name} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <div style={{ width: 72, fontSize: 11, color: TEXT, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={dept.name}>
                {dept.name}
              </div>
              <div
                style={{
                  flex: 1,
                  height: 16,
                  background: BAR_TRACK,
                  borderRadius: 4,
                  overflow: "hidden",
                  minWidth: 40,
                }}
              >
                <div
                  style={{
                    width: `${dept.barPct}%`,
                    height: "100%",
                    background: NAVY,
                    borderRadius: 4,
                  }}
                />
              </div>
              <div style={{ width: 72, fontSize: 11, color: TEXT, textAlign: "right", flexShrink: 0 }}>
                {dept.count}명 ({dept.sharePct}%)
              </div>
            </div>
          ))
        )}
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: NAVY, marginBottom: 8 }}>상세 명단</div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
          <thead>
            <tr style={{ borderBottom: `2px solid ${NAVY}` }}>
              <th style={th}>이름</th>
              <th style={th}>부서</th>
              <th style={th}>직분</th>
              <th style={th}>연락처</th>
              <th style={th}>상태</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m, i) => (
              <tr
                key={m.id}
                style={{
                  borderBottom: `1px solid ${BAR_TRACK}`,
                  background: i % 2 === 0 ? WHITE : ROW_ALT,
                }}
              >
                <td style={{ padding: "6px 8px", color: NAVY, fontWeight: 600 }}>{m.name}</td>
                <td style={{ padding: "6px 8px", color: TEXT }}>{m.dept || "-"}</td>
                <td style={{ padding: "6px 8px", color: TEXT }}>{m.role || "-"}</td>
                <td style={{ padding: "6px 8px", color: TEXT }}>{m.phone || "-"}</td>
                <td style={{ padding: "6px 8px", color: TEXT }}>{m.member_status ?? m.status ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export function ReportsSettingsPage(props: ReportsSettingsPageProps) {
  const { db, setDb, save, saveDb, toast } = props;
  const mob = useIsMobile();
  const { rawAttendance } = useAppData();

  const [selectedReport, setSelectedReport] = useState<ReportCardDef | null>(null);
  const endD = useMemo(() => new Date(), []);
  const startD = useMemo(() => {
    const s = new Date();
    s.setMonth(s.getMonth() - 1);
    return s;
  }, []);
  const [startDate, setStartDate] = useState(() => fmtLocal(startD));
  const [endDate, setEndDate] = useState(() => fmtLocal(endD));
  const [deptFilter, setDeptFilter] = useState("");

  const attendanceList = useMemo((): Attendance[] => {
    if (rawAttendance.length > 0) {
      return rawAttendance.map((r, i) => ({
        id: `${r.member_id}-${r.date}-${i}`,
        member_id: r.member_id,
        date: r.date,
        status: (DB_STATUS_TO_UI[r.status] ?? "결석") as Attendance["status"],
        service_type: r.service_type ?? "주일예배",
      }));
    }
    const year = new Date().getFullYear();
    const list: Attendance[] = [];
    db.members.forEach((m) => {
      const att = db.attendance?.[m.id] ?? {};
      for (let w = 1; w <= 52; w++) {
        const st = att[w];
        if (st !== "p" && st !== "o") continue;
        const date = getSundayForWeekNum(year, w);
        list.push({
          id: `${m.id}-${w}`,
          member_id: m.id,
          date,
          status: st === "p" ? "출석" : "온라인",
          service_type: "주일예배",
        });
      }
    });
    return list;
  }, [rawAttendance, db.members, db.attendance]);

  const depts = useMemo(() => {
    const s = new Set<string>();
    db.members.forEach((m) => {
      if (m.dept?.trim()) s.add(m.dept);
    });
    return Array.from(s).sort();
  }, [db.members]);

  const membersFiltered = useMemo(() => {
    let list = db.members.filter((m) => (m.member_status ?? m.status) !== "졸업/전출");
    if (deptFilter) list = list.filter((m) => m.dept === deptFilter);
    return list;
  }, [db.members, deptFilter]);

  const memberListPrintData = useMemo(() => {
    const list = membersFiltered;
    const memberStatus = (m: Member) => (m.member_status ?? m.status ?? "").trim();
    const totalMembers = list.length;
    const activeMembers = list.filter((m) => {
      const st = memberStatus(m);
      return st === "활동" || st === "" || st === "새가족";
    }).length;
    const newFamilyCount = list.filter((m) => m.is_new_family || memberStatus(m) === "새가족").length;
    const riskCount = list.filter((m) => {
      const st = memberStatus(m);
      return st.includes("휴면") || st.includes("위험");
    }).length;
    const map = new Map<string, number>();
    list.forEach((m) => {
      const d = (m.dept || "").trim() || "(미배정)";
      map.set(d, (map.get(d) || 0) + 1);
    });
    const deptRows = Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
    const maxDept = Math.max(...deptRows.map(([, c]) => c), 1);
    const departments = deptRows.map(([name, count]) => ({
      name,
      count,
      barPct: Math.round((count / maxDept) * 100),
      sharePct: totalMembers ? Math.round((count / totalMembers) * 100) : 0,
    }));
    return { totalMembers, activeMembers, newFamilyCount, riskCount, departments };
  }, [membersFiltered]);

  const inDateRange = (dateStr: string | undefined) => {
    if (!dateStr) return true;
    return dateStr >= startDate && dateStr <= endDate;
  };

  const handlePrint = useCallback(() => {
    if (typeof document === "undefined") return;
    const printArea = document.getElementById("report-print-area");
    if (!printArea) return;

    const reportTitle = selectedReport?.title ?? "보고서";
    const safeTitle = reportTitle
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

    const printWindow = window.open("", "_blank", "width=800,height=1000");
    if (!printWindow) {
      toast("팝업이 차단되었습니다. 팝업을 허용한 뒤 다시 시도해 주세요.", "warn");
      return;
    }

    printWindow.document.write(`
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <title>${safeTitle}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 15mm;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans KR", sans-serif;
      color: #1B2A4A;
      padding: 0;
      margin: 0;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    th, td {
      padding: 6px 8px;
      text-align: left;
      font-size: 11px;
    }
    th {
      border-bottom: 2px solid #1B2A4A;
      font-weight: 700;
    }
    td {
      border-bottom: 1px solid #e8ecf1;
    }
    tr:nth-child(even) {
      background: #fafbfc;
    }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
${printArea.innerHTML}
</body>
</html>
    `);

    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 500);
  }, [selectedReport?.title, toast]);

  const cardStyle: React.CSSProperties = {
    padding: 12,
    borderRadius: 8,
    border: `1px solid ${BORDER}`,
    background: WHITE,
    display: "flex",
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    cursor: "pointer",
    textAlign: "left",
    fontFamily: "inherit",
    width: "100%",
    boxSizing: "border-box",
  };

  const renderPreview = () => {
    if (!selectedReport) return null;
    const id = selectedReport.id;

    if (id === "x_dashboard") return <StatisticsDashboard db={db} />;
    if (id === "x_weekly") return <WeeklyReport db={db} toast={toast} />;
    if (id === "x_monthly") return <MonthlyReport db={db} toast={toast} />;
    if (id === "x_senior") return <SeniorPastorReport db={db} toast={toast} />;
    if (id === "x_dept") return <DepartmentReport db={db} toast={toast} />;
    if (id === "x_visit_plan") return <VisitPlanReport db={db} toast={toast} />;
    if (id === "x_upcoming") return <UpcomingEvents members={db.members} db={db} />;

    if (id === "p_attendance") {
      return (
        <AttendanceStatistics
          members={membersFiltered}
          attendanceList={attendanceList}
          startDate={startDate}
          endDate={endDate}
          toast={toast}
        />
      );
    }

    if (id === "p_member_list") {
      return null;
    }

    if (id === "p_new_family") {
      const programs = db.newFamilyPrograms ?? [];
      return (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, color: TEXT }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
              {["회원ID", "시작일", "상태", "4주 진행"].map((h) => (
                <th key={h} style={{ textAlign: "left", padding: "6px 4px", color: NAVY, fontWeight: 700 }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {programs.map((p) => (
              <tr key={p.id} style={{ borderBottom: `1px solid ${BORDER}` }}>
                <td style={{ padding: "6px 4px" }}>{p.member_id}</td>
                <td style={{ padding: "6px 4px" }}>{p.program_start_date || "-"}</td>
                <td style={{ padding: "6px 4px" }}>{p.status}</td>
                <td style={{ padding: "6px 4px" }}>
                  {[p.week1_completed, p.week2_completed, p.week3_completed, p.week4_completed].filter(Boolean).length}/4
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }

    if (id === "p_mokjang") {
      const map = new Map<string, number>();
      membersFiltered.forEach((m) => {
        const mj = (m.mokjang ?? m.group ?? "").trim() || "(미배정)";
        map.set(mj, (map.get(mj) || 0) + 1);
      });
      const rows = Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
      return (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, color: TEXT }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
              <th style={{ textAlign: "left", padding: "6px 4px", color: NAVY }}>목장</th>
              <th style={{ textAlign: "left", padding: "6px 4px", color: NAVY }}>인원</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([name, n]) => (
              <tr key={name} style={{ borderBottom: `1px solid ${BORDER}` }}>
                <td style={{ padding: "6px 4px" }}>{name}</td>
                <td style={{ padding: "6px 4px" }}>{n}명</td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }

    if (id === "p_absentee") {
      return (
        <div style={{ fontSize: 12, color: TEXT, lineHeight: 1.6 }}>
          <p style={{ margin: "0 0 8px", color: SUB }}>
            최근 주차 기준 활동 성도 중 출석 기록이 없거나 부족한 경우를 요약합니다. 상세 관리는 목양 &gt; 출석부 &gt; 결석자 관리에서 진행하세요.
          </p>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
                <th style={{ textAlign: "left", padding: "6px 4px", color: NAVY }}>이름</th>
                <th style={{ textAlign: "left", padding: "6px 4px", color: NAVY }}>부서</th>
                <th style={{ textAlign: "left", padding: "6px 4px", color: NAVY }}>비고</th>
              </tr>
            </thead>
            <tbody>
              {membersFiltered.slice(0, 40).map((m) => (
                <tr key={m.id} style={{ borderBottom: `1px solid ${BORDER}` }}>
                  <td style={{ padding: "6px 4px" }}>{m.name}</td>
                  <td style={{ padding: "6px 4px" }}>{m.dept || "-"}</td>
                  <td style={{ padding: "6px 4px", color: SUB }}>출석 데이터 기준 점검</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    if (id === "v_visit") {
      const visits = (db.visits ?? []).filter((v) => inDateRange(v.date));
      return (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, color: TEXT }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
              {["날짜", "성도ID", "유형", "요약"].map((h) => (
                <th key={h} style={{ textAlign: "left", padding: "6px 4px", color: NAVY }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visits.map((v) => (
              <tr key={v.id} style={{ borderBottom: `1px solid ${BORDER}` }}>
                <td style={{ padding: "6px 4px" }}>{v.date}</td>
                <td style={{ padding: "6px 4px" }}>{v.memberId}</td>
                <td style={{ padding: "6px 4px" }}>{v.type}</td>
                <td style={{ padding: "6px 4px" }}>{(v.content || "").slice(0, 80)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }

    if (id === "v_counsel") {
      const counsels = ((db as DB & { counsels?: { id: string; date: string; memberId: string; type: string; summary?: string }[] }).counsels ?? []).filter((c) =>
        inDateRange(c.date)
      );
      return (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, color: TEXT }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
              {["날짜", "성도ID", "유형", "요약"].map((h) => (
                <th key={h} style={{ textAlign: "left", padding: "6px 4px", color: NAVY }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {counsels.map((c) => (
              <tr key={c.id} style={{ borderBottom: `1px solid ${BORDER}` }}>
                <td style={{ padding: "6px 4px" }}>{c.date}</td>
                <td style={{ padding: "6px 4px" }}>{c.memberId}</td>
                <td style={{ padding: "6px 4px" }}>{c.type}</td>
                <td style={{ padding: "6px 4px" }}>{(c.summary ?? "").slice(0, 80)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }

    if (id === "f_offering") {
      const rows = (db.income ?? []).filter((r: Income) => inDateRange(r.date));
      return (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, color: TEXT }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
              {["날짜", "항목", "금액", "비고"].map((h) => (
                <th key={h} style={{ textAlign: "left", padding: "6px 4px", color: NAVY }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} style={{ borderBottom: `1px solid ${BORDER}` }}>
                <td style={{ padding: "6px 4px" }}>{r.date}</td>
                <td style={{ padding: "6px 4px" }}>{r.type}</td>
                <td style={{ padding: "6px 4px" }}>{r.amount?.toLocaleString?.() ?? r.amount}</td>
                <td style={{ padding: "6px 4px" }}>{(r.memo || "").slice(0, 40)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }

    if (id === "f_expense") {
      const rows = (db.expense ?? []).filter((r: Expense) => inDateRange(r.date));
      return (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, color: TEXT }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
              {["날짜", "항목", "금액", "비고"].map((h) => (
                <th key={h} style={{ textAlign: "left", padding: "6px 4px", color: NAVY }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} style={{ borderBottom: `1px solid ${BORDER}` }}>
                <td style={{ padding: "6px 4px" }}>{r.date}</td>
                <td style={{ padding: "6px 4px" }}>{r.category}</td>
                <td style={{ padding: "6px 4px" }}>{r.amount?.toLocaleString?.() ?? r.amount}</td>
                <td style={{ padding: "6px 4px" }}>{(r.memo || "").slice(0, 40)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }

    return null;
  };

  const showDeptFilter =
    selectedReport &&
    ["p_member_list", "p_attendance", "p_absentee", "p_mokjang"].includes(selectedReport.id);

  const detailTitle = selectedReport?.title ?? "보고서 · 설정";
  const churchName = db.settings.churchName ?? "";

  return (
    <div
      style={{
        fontFamily: "'Inter','Noto Sans KR',-apple-system,sans-serif",
        background: "#f9fafb",
        minHeight: "calc(100vh - 56px)",
        color: TEXT,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <header
        style={{
          padding: mob ? "10px 12px" : "12px 20px",
          background: WHITE,
          borderBottom: `1px solid ${BORDER}`,
          flexShrink: 0,
        }}
      >
        <div style={{ fontSize: mob ? 16 : 18, fontWeight: 700, color: NAVY }}>보고서 · 설정</div>
      </header>

      <div style={{ flex: 1, overflowY: "auto", padding: 16, boxSizing: "border-box" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: mob ? "1fr" : "1fr 1fr",
            gap: 24,
            maxWidth: 1400,
            margin: "0 auto",
            width: "100%",
            boxSizing: "border-box",
            alignItems: "start",
          }}
        >
          {/* 왼쪽(모바일: 위): 보고서 */}
          <div style={{ minWidth: 0, width: "100%" }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: NAVY, margin: "0 0 12px" }}>보고서</h2>
            {!selectedReport && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {REPORT_GROUPS.map((g) => (
                  <div key={g.category}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: MUTED, marginBottom: 8 }}>{g.category}</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {g.items.map((item) => (
                        <button key={item.id} type="button" style={cardStyle} onClick={() => setSelectedReport(item)}>
                          <div
                            style={{
                              width: 36,
                              height: 36,
                              borderRadius: "50%",
                              background: "#f0f2f5",
                              color: NAVY,
                              fontSize: 14,
                              fontWeight: 700,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              flexShrink: 0,
                            }}
                          >
                            {item.initial}
                          </div>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: NAVY, marginBottom: 4 }}>{item.title}</div>
                            <div style={{ fontSize: 11, color: SUB, lineHeight: 1.4 }}>{item.desc}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {selectedReport && (
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  <button
                    type="button"
                    onClick={() => setSelectedReport(null)}
                    style={{
                      height: 28,
                      padding: "0 10px",
                      fontSize: 11,
                      borderRadius: 6,
                      border: `1px solid ${BORDER}`,
                      background: WHITE,
                      color: TEXT,
                      cursor: "pointer",
                      flexShrink: 0,
                      fontFamily: "inherit",
                    }}
                  >
                    ← 뒤로
                  </button>
                  <div style={{ fontSize: 15, fontWeight: 700, color: NAVY, minWidth: 0 }}>{detailTitle}</div>
                </div>

                <div
                  style={{
                    display: "flex",
                    flexDirection: "row",
                    alignItems: "stretch",
                    gap: 6,
                    marginBottom: 8,
                    flexWrap: "nowrap",
                    width: "100%",
                    boxSizing: "border-box",
                    minWidth: 0,
                  }}
                >
                  <div
                    style={{
                      flex: 1,
                      minWidth: 0,
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <span style={{ fontSize: 10, color: SUB, flexShrink: 0, lineHeight: 1 }} title="시작일">
                      시작
                    </span>
                    <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center" }}>
                      <CalendarDropdown
                        id="report-filter-start"
                        value={startDate}
                        onChange={setStartDate}
                        compact
                        style={{ marginBottom: 0, width: "100%", minWidth: 0 }}
                        triggerStyle={reportFilterDateTrigger}
                      />
                    </div>
                  </div>
                  <div
                    style={{
                      flex: 1,
                      minWidth: 0,
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <span style={{ fontSize: 10, color: SUB, flexShrink: 0, lineHeight: 1 }} title="종료일">
                      종료
                    </span>
                    <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center" }}>
                      <CalendarDropdown
                        id="report-filter-end"
                        value={endDate}
                        onChange={setEndDate}
                        compact
                        style={{ marginBottom: 0, width: "100%", minWidth: 0 }}
                        triggerStyle={reportFilterDateTrigger}
                      />
                    </div>
                  </div>
                  {showDeptFilter && (
                    <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center" }}>
                      <ModernSelect
                        id="report-filter-dept"
                        value={deptFilter}
                        onChange={setDeptFilter}
                        options={[{ value: "", label: "전체" }, ...depts.map((d) => ({ value: d, label: d }))]}
                        compact
                        uniform32
                        placeholder="전체"
                        style={{ marginBottom: 0, width: "100%", minWidth: 0 }}
                      />
                    </div>
                  )}
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
                  <button
                    type="button"
                    onClick={handlePrint}
                    style={{
                      height: 32,
                      padding: "0 14px",
                      fontSize: 12,
                      fontWeight: 600,
                      borderRadius: 6,
                      background: NAVY,
                      color: WHITE,
                      border: "none",
                      cursor: "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    PDF / 인쇄
                  </button>
                </div>

                <div
                  id="report-print-area"
                  style={{
                    background: WHITE,
                    borderRadius: 8,
                    border: `1px solid ${BORDER}`,
                    padding: 20,
                    minHeight: 120,
                  }}
                >
                  <ReportPrintHeader
                    churchName={churchName}
                    reportTitle={detailTitle}
                    startDate={startDate}
                    endDate={endDate}
                  />
                  {selectedReport.id === "p_member_list" ? (
                    <MemberListPrintBody
                      members={membersFiltered}
                      totalMembers={memberListPrintData.totalMembers}
                      activeMembers={memberListPrintData.activeMembers}
                      newFamilyCount={memberListPrintData.newFamilyCount}
                      riskCount={memberListPrintData.riskCount}
                      departments={memberListPrintData.departments}
                    />
                  ) : (
                    <div style={{ fontSize: 12 }}>{renderPreview()}</div>
                  )}
                  <ReportPrintFooter churchName={churchName} />
                </div>
              </div>
            )}
          </div>

          {/* 오른쪽(모바일: 아래): 설정 */}
          <div style={{ minWidth: 0, width: "100%" }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: NAVY, margin: "0 0 12px" }}>설정</h2>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: mob ? "1fr" : "1fr 1fr",
                gap: 24,
                alignItems: "start",
                width: "100%",
                boxSizing: "border-box",
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0, width: "100%" }}>
                <ChurchInfoSettingsCard db={db} setDb={setDb} save={save} toast={toast} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0, width: "100%" }}>
                <NotificationSettingsCard db={db} setDb={setDb} save={save} />
                <DataBackupPanel db={db} setDb={setDb} save={save} saveDb={saveDb} toast={toast} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
