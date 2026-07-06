import type { Member } from "@/types/db";
import type { RawAttendanceRow } from "@/contexts/AppDataContext";

/** 이번 주 일요일 (YYYY-MM-DD) — 출석 체크·대시보드 공통 기준 */
export function getThisSundayStr(from: Date = new Date()): string {
  const d = new Date(from);
  const day = d.getDay();
  if (day !== 0) d.setDate(d.getDate() - day);
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const dd = d.getDate();
  return `${y}-${String(m).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
}

/** 출석 체크·통계 대상 성도 (졸업/전출 제외, 활동 성도) */
export function isChurchActiveMember(m: Member): boolean {
  if (m.status === "졸업/전출") return false;
  return (m.member_status || m.status) === "활동" || !m.member_status;
}

/** member_status 기준 활동 여부 (전체 성도 카드용) */
export function isMemberStatusActive(m: Member): boolean {
  return (m.member_status || m.status) === "활동" || !m.member_status;
}

/** 주일예배 출석(대면·온라인) 행인지 */
export function isSundayWorshipPresentRow(r: RawAttendanceRow): boolean {
  if (r.status !== "p" && r.status !== "o") return false;
  if (r.service_type && r.service_type !== "주일예배") return false;
  return true;
}

function rowYear(r: RawAttendanceRow): number | null {
  if (r.date) {
    const y = Number(r.date.slice(0, 4));
    if (!Number.isNaN(y)) return y;
  }
  return r.year ?? null;
}

function rowMonth(r: RawAttendanceRow): number | null {
  if (r.date) {
    const m = new Date(`${r.date}T12:00:00`).getMonth();
    if (m >= 0 && m <= 11) return m;
  }
  if (r.week_num) return Math.min(11, Math.floor((r.week_num - 1) / 4.33));
  return null;
}

function rowWeekKey(r: RawAttendanceRow): string | null {
  if (r.date) return r.date;
  const y = rowYear(r);
  if (y && r.week_num && r.week_num >= 1 && r.week_num <= 52) return `w:${y}:${r.week_num}`;
  return null;
}

function rowWeekNum(r: RawAttendanceRow, year: number): number | null {
  if (r.week_num && r.week_num >= 1 && r.week_num <= 52) return r.week_num;
  if (r.date) {
    const d = new Date(`${r.date}T12:00:00`);
    if (d.getFullYear() !== year) return null;
    const start = new Date(year, 0, 1);
    const diff = Math.floor((d.getTime() - start.getTime()) / 86_400_000);
    const wn = Math.floor(diff / 7) + 1;
    if (wn >= 1 && wn <= 52) return wn;
  }
  return null;
}

function inMemberPool(memberId: string, pool: Set<string> | null): boolean {
  return !pool || pool.has(memberId);
}

/** 특정 일요일 주일예배 출석(대면·온라인) 인원 — member_id 기준 중복 제거 */
export function countSundayPresent(
  rawAttendance: RawAttendanceRow[],
  sunday: string,
  memberPool?: Iterable<string>,
): number {
  const pool = memberPool ? new Set(memberPool) : null;
  const present = new Set<string>();
  rawAttendance.forEach((r) => {
    if (r.date !== sunday) return;
    if (!isSundayWorshipPresentRow(r)) return;
    if (!inMemberPool(r.member_id, pool)) return;
    present.add(r.member_id);
  });
  return present.size;
}

/** 연도별 주차(1~52) 주일예배 출석 인원 — 주차당 member_id 중복 제거 */
export function aggregateWeeklyByWeekNum(
  rawAttendance: RawAttendanceRow[],
  year: number,
  memberPool?: Iterable<string>,
): number[] {
  const pool = memberPool ? new Set(memberPool) : null;
  const data: Set<string>[] = Array.from({ length: 52 }, () => new Set<string>());
  rawAttendance.forEach((r) => {
    if (!isSundayWorshipPresentRow(r)) return;
    if (rowYear(r) !== year) return;
    if (!inMemberPool(r.member_id, pool)) return;
    const wn = rowWeekNum(r, year);
    if (wn === null) return;
    data[wn - 1].add(r.member_id);
  });
  return data.map((s) => s.size);
}

/** 월별 평균 주일예배 출석 인원 — 해당 월 각 주(일)의 unique member 평균 */
export function aggregateMonthlyAverages(
  rawAttendance: RawAttendanceRow[],
  year: number,
  memberPool?: Iterable<string>,
): number[] {
  const pool = memberPool ? new Set(memberPool) : null;
  const weeksPerMonth: Map<string, Set<string>>[] = Array.from({ length: 12 }, () => new Map());

  rawAttendance.forEach((r) => {
    if (!isSundayWorshipPresentRow(r)) return;
    if (rowYear(r) !== year) return;
    if (!inMemberPool(r.member_id, pool)) return;
    const mn = rowMonth(r);
    if (mn === null || mn < 0 || mn > 11) return;
    const wk = rowWeekKey(r);
    if (!wk) return;
    const bucket = weeksPerMonth[mn];
    if (!bucket.has(wk)) bucket.set(wk, new Set());
    bucket.get(wk)!.add(r.member_id);
  });

  return weeksPerMonth.map((weekMap) => {
    const counts = Array.from(weekMap.values(), (s) => s.size);
    if (counts.length === 0) return 0;
    return Math.round(counts.reduce((a, b) => a + b, 0) / counts.length);
  });
}

/** 연간 평균 주일예배 출석 인원·출석률 */
export function aggregateYearlyAverage(
  rawAttendance: RawAttendanceRow[],
  year: number,
  totalMembers: number,
  memberPool?: Iterable<string>,
): { present: number; total: number; rate: number } {
  const pool = memberPool ? new Set(memberPool) : null;
  const byWeek = new Map<string, Set<string>>();
  rawAttendance.forEach((r) => {
    if (!isSundayWorshipPresentRow(r)) return;
    if (rowYear(r) !== year) return;
    if (!inMemberPool(r.member_id, pool)) return;
    const wk = rowWeekKey(r);
    if (!wk) return;
    if (!byWeek.has(wk)) byWeek.set(wk, new Set());
    byWeek.get(wk)!.add(r.member_id);
  });
  const weekSets = Array.from(byWeek.values());
  const present = weekSets.length > 0
    ? Math.round(weekSets.reduce((sum, ids) => sum + ids.size, 0) / weekSets.length)
    : 0;
  const rate = totalMembers > 0 ? Math.round((present / totalMembers) * 100) : 0;
  return { present, total: totalMembers, rate };
}
