"use client";

/**
 * 월간 출석 현황 보고서 (시안 v2)
 * - 1장: 교회 전체 요약 + 2장~N장 부서별 1장씩
 * - 디자인: 흰 배경 + 다크 헤더(#111827) + 5색 데이터 팔레트(blue/emerald/amber/rose/violet)
 * - 차트: 주차별 콤보(bar+line) / 3개월 추이 / 출석률 구간 도넛 / 그룹별 수평막대 / 연령대별 수평막대 / 자동 하이라이트
 * - 모든 SVG inline, 외부 이미지 0개 (html2canvas 호환성 ↑)
 * - "PDF 미리보기" 모달에서 실제 PDF를 확인하고 → 그 안에서 다운로드
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Download, Printer, Eye, X } from "lucide-react";
import { useAppData } from "@/contexts/AppDataContext";
import { ModernSelect } from "@/components/common/ModernSelect";
import type { Member } from "@/types/db";

/* ───────── 디자인 토큰 ───────── */

const COLORS = {
  bg: "#FFFFFF",
  bgSoft: "#F9FAFB",
  ink: "#111827",
  inkSoft: "#4B5563",
  inkFaint: "#9CA3AF",
  line: "#E5E7EB",
  lineSoft: "#F3F4F6",
  headerBg: "#111827",
  blue: "#3B82F6",
  blueSoft: "#DBEAFE",
  emerald: "#10B981",
  emeraldSoft: "#D1FAE5",
  amber: "#F59E0B",
  amberSoft: "#FEF3C7",
  rose: "#EF4444",
  roseSoft: "#FEE2E2",
  violet: "#8B5CF6",
} as const;

const FONT_SANS =
  '"Noto Sans KR", "Inter", -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
const FONT_NUM = '"Inter", -apple-system, BlinkMacSystemFont, sans-serif';
const FONT_SERIF = '"Nanum Myeongjo", "Noto Serif KR", serif';

const A4_W_MM = 210;
const A4_H_MM = 297;

/* ───────── 유틸 ───────── */

const pad2 = (n: number) => String(n).padStart(2, "0");

function fmtShortDate(s: string): string {
  if (!s) return "";
  const [, m, d] = s.split("-").map(Number);
  return `${pad2(m)}.${pad2(d)}`;
}

function fmtIssueDateKo(d: Date): string {
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 발행 · 교역실`;
}

function memberMokjang(m: Member): string {
  return (m.mokjang ?? m.group ?? "").trim();
}

function isActive(m: Member): boolean {
  const v = m.member_status ?? m.status;
  return v === "활동" || !v;
}

function getMonthRange(year: number, month: number) {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0);
  return { start, end };
}

function getSundaysInMonth(year: number, month: number): string[] {
  const { start, end } = getMonthRange(year, month);
  const out: string[] = [];
  const d = new Date(start);
  while (d.getDay() !== 0) d.setDate(d.getDate() + 1);
  while (d <= end) {
    out.push(`${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`);
    d.setDate(d.getDate() + 7);
  }
  return out;
}

function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const idx = year * 12 + (month - 1) + delta;
  return { year: Math.floor(idx / 12), month: (idx % 12) + 1 };
}

type Att = "p" | "o" | "a" | "l" | "n";
function normalizeStatus(s: unknown): Att {
  const v = String(s ?? "").toLowerCase();
  if (v === "p" || s === "출석") return "p";
  if (v === "o" || s === "온라인") return "o";
  if (v === "l" || s === "병결") return "l";
  if (v === "a" || s === "결석") return "a";
  return "n";
}

function getAge(birth?: string): number | null {
  if (!birth) return null;
  const y = parseInt(String(birth).slice(0, 4), 10);
  if (!Number.isFinite(y) || y < 1900) return null;
  return new Date().getFullYear() - y;
}

function ageBucketLabel(age: number, deptName: string): string {
  if (deptName.includes("청년")) {
    if (age <= 23) return "20대 초";
    if (age <= 26) return "20대 중";
    if (age <= 29) return "20대 후";
    return "30대+";
  }
  if (age < 20) return "20대 미만";
  if (age < 30) return "20대";
  if (age < 40) return "30대";
  if (age < 50) return "40대";
  if (age < 60) return "50대";
  return "60대+";
}

/* 부서별 그룹 라벨/성경구절/호칭 매핑 */

const GROUP_LABEL_BY_DEPT: { match: string; group: string; sub: string }[] = [
  { match: "청년", group: "소그룹", sub: "SMALL GROUP RANKING" },
  { match: "고등", group: "반", sub: "CLASS RANKING" },
  { match: "중고", group: "반", sub: "CLASS RANKING" },
  { match: "중등", group: "반", sub: "CLASS RANKING" },
  { match: "초등", group: "반", sub: "CLASS RANKING" },
  { match: "유년", group: "반", sub: "CLASS RANKING" },
  { match: "유치", group: "반", sub: "CLASS RANKING" },
  { match: "영아", group: "반", sub: "CLASS RANKING" },
  { match: "학생", group: "반", sub: "CLASS RANKING" },
];
function groupLabelFor(deptName: string): { group: string; sub: string } {
  for (const it of GROUP_LABEL_BY_DEPT) if (deptName.includes(it.match)) return it;
  return { group: "목장", sub: "CELL GROUP RANKING" };
}

const VERSE_BY_DEPT: { match: string; text: string; ref: string }[] = [
  { match: "청년", text: "청년의 때에 너의 창조주를 기억하라", ref: "전 12:1" },
  { match: "고등", text: "마땅히 행할 길을 아이에게 가르치라", ref: "잠 22:6" },
  { match: "중고", text: "마땅히 행할 길을 아이에게 가르치라", ref: "잠 22:6" },
  { match: "중등", text: "마땅히 행할 길을 아이에게 가르치라", ref: "잠 22:6" },
  { match: "학생", text: "마땅히 행할 길을 아이에게 가르치라", ref: "잠 22:6" },
  { match: "초등", text: "어린아이들이 내게 오는 것을 용납하라", ref: "마 19:14" },
  { match: "유년", text: "어린아이들이 내게 오는 것을 용납하라", ref: "마 19:14" },
  { match: "유치", text: "어린아이들이 내게 오는 것을 용납하라", ref: "마 19:14" },
  { match: "영아", text: "어린아이들이 내게 오는 것을 용납하라", ref: "마 19:14" },
  { match: "장년", text: "주께 하듯 하라", ref: "골 3:23" },
];
function verseFor(deptName: string): { text: string; ref: string } {
  if (deptName === "교회 전체") return { text: "모든 일에 감사하라", ref: "살전 5:18" };
  for (const v of VERSE_BY_DEPT) if (deptName.includes(v.match)) return v;
  return { text: "모든 일에 감사하라", ref: "살전 5:18" };
}

function memberNounFor(deptName: string): string {
  if (deptName.includes("청년")) return "청년";
  if (
    deptName.includes("학생") ||
    deptName.includes("고등") ||
    deptName.includes("중고") ||
    deptName.includes("중등") ||
    deptName.includes("초등") ||
    deptName.includes("유년") ||
    deptName.includes("유치") ||
    deptName.includes("영아")
  )
    return "학생";
  return "성도";
}

/* ───────── 집계 타입 ───────── */

interface MemberStat {
  m: Member;
  statuses: Record<string, Att>;
  present: number;
  rate: number;
  consecutiveAbsentTail: number;
}

interface DeptAgg {
  key: string;
  label: string;
  isAll: boolean;
  members: MemberStat[];
  total: number;
  perWeek: { sunday: string; present: number; total: number; rate: number }[];
  avgRate: number;
  prevAvgRate: number | null;
  prev2AvgRate: number | null;
  perfectCount: number;
  perfectNames: string[];
  longAbsent: MemberStat[];
  newMembers: Member[];
  groupLabel: string;
  groupSub: string;
  byGroup: { label: string; rate: number; count: number }[];
  byAge: { label: string; rate: number; count: number }[];
  distribution: { perfect: number; high: number; mid: number; low: number };
}

/* ───────── 메인 컴포넌트 ───────── */

export function MonthlyAttendanceBulletin() {
  const { db, rawAttendance } = useAppData();
  const churchName = (db.settings?.churchName ?? "").trim() || "교회";
  const reportRef = useRef<HTMLDivElement>(null);

  const now = new Date();
  const [year, setYear] = useState<number>(now.getFullYear());
  const [month, setMonth] = useState<number>(now.getMonth() + 1);
  const [scope, setScope] = useState<string>("__all_pages__");
  const [busy, setBusy] = useState<"idle" | "preview" | "download">("idle");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  /* 폰트 1회 주입 */
  useEffect(() => {
    if (typeof document === "undefined") return;
    const id = "mab-google-fonts-v2";
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Noto+Sans+KR:wght@400;500;600;700;800;900&family=Nanum+Myeongjo:wght@700;800&display=swap";
    document.head.appendChild(link);
  }, []);

  /* preview blob 정리 */
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const sundays = useMemo(() => getSundaysInMonth(year, month), [year, month]);
  const prev = useMemo(() => shiftMonth(year, month, -1), [year, month]);
  const prev2 = useMemo(() => shiftMonth(year, month, -2), [year, month]);
  const prevSundays = useMemo(() => getSundaysInMonth(prev.year, prev.month), [prev]);
  const prev2Sundays = useMemo(() => getSundaysInMonth(prev2.year, prev2.month), [prev2]);

  const activeMembers = useMemo(() => (db.members ?? []).filter(isActive), [db.members]);

  const deptOrder = useMemo(() => {
    const fromSettings = (db.settings?.depts ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (fromSettings.length > 0) return fromSettings;
    const seen: string[] = [];
    activeMembers.forEach((m) => {
      const d = (m.dept ?? "").trim() || "기타";
      if (!seen.includes(d)) seen.push(d);
    });
    return seen;
  }, [db.settings?.depts, activeMembers]);

  /* member_id -> date -> Att (다중 월 한꺼번에 처리) */
  const buildStatusMap = (targetSundays: string[]) => {
    const map: Record<string, Record<string, Att>> = {};
    if (targetSundays.length === 0) return map;
    const set = new Set(targetSundays);
    rawAttendance.forEach((r) => {
      if (!r.date || !set.has(r.date)) return;
      const st = r.service_type ?? "주일예배";
      if (st !== "주일예배" && st !== "주일1부예배") return;
      const norm = normalizeStatus(r.status);
      if (!map[r.member_id]) map[r.member_id] = {};
      if (!map[r.member_id][r.date] || norm === "p") map[r.member_id][r.date] = norm;
    });
    return map;
  };

  const statusByMember = useMemo(() => buildStatusMap(sundays), [rawAttendance, sundays]);
  const statusByMemberPrev = useMemo(() => buildStatusMap(prevSundays), [rawAttendance, prevSundays]);
  const statusByMemberPrev2 = useMemo(() => buildStatusMap(prev2Sundays), [rawAttendance, prev2Sundays]);

  /** 부서별 전월/전전월 평균 출석률 */
  const computeAvgByDept = (
    statusMap: Record<string, Record<string, Att>>,
    targetSundays: string[],
  ): Record<string, number> => {
    const buckets: Record<string, { present: number; slots: number }> = {};
    activeMembers.forEach((m) => {
      const d = (m.dept ?? "").trim() || "기타";
      if (!buckets[d]) buckets[d] = { present: 0, slots: 0 };
      targetSundays.forEach((s) => {
        const st = statusMap[m.id]?.[s] ?? "n";
        buckets[d].slots += 1;
        if (st === "p" || st === "o") buckets[d].present += 1;
      });
    });
    const out: Record<string, number> = {};
    Object.entries(buckets).forEach(([d, v]) => {
      out[d] = v.slots > 0 ? Math.round((v.present / v.slots) * 100) : 0;
    });
    const totalP = Object.values(buckets).reduce((a, b) => a + b.present, 0);
    const totalS = Object.values(buckets).reduce((a, b) => a + b.slots, 0);
    out["__all__"] = totalS > 0 ? Math.round((totalP / totalS) * 100) : 0;
    return out;
  };

  const prevAvgByDept = useMemo(
    () => computeAvgByDept(statusByMemberPrev, prevSundays),
    [statusByMemberPrev, prevSundays, activeMembers],
  );
  const prev2AvgByDept = useMemo(
    () => computeAvgByDept(statusByMemberPrev2, prev2Sundays),
    [statusByMemberPrev2, prev2Sundays, activeMembers],
  );

  /** 부서별 + 교회 전체 집계 */
  const aggs: DeptAgg[] = useMemo(() => {
    const byDept: Record<string, Member[]> = {};
    activeMembers.forEach((m) => {
      const d = (m.dept ?? "").trim() || "기타";
      if (!byDept[d]) byDept[d] = [];
      byDept[d].push(m);
    });
    const ordered: string[] = [];
    deptOrder.forEach((d) => {
      if (byDept[d]) ordered.push(d);
    });
    Object.keys(byDept).forEach((d) => {
      if (!ordered.includes(d)) ordered.push(d);
    });

    const numSundays = sundays.length;
    const monthKey = `${year}-${pad2(month)}`;
    const isNewThisMonth = (m: Member) => {
      const c = String(m.created_at ?? m.createdAt ?? "").slice(0, 7);
      const f = String(m.first_visit_date ?? m.firstVisitDate ?? "").slice(0, 7);
      return c === monthKey || f === monthKey;
    };

    const buildStats = (ms: Member[]): MemberStat[] => {
      const list = ms.map<MemberStat>((m) => {
        const byWeek: Record<string, Att> = {};
        let present = 0;
        sundays.forEach((d) => {
          const s = statusByMember[m.id]?.[d] ?? "n";
          byWeek[d] = s;
          if (s === "p" || s === "o") present += 1;
        });
        const rate = numSundays > 0 ? Math.round((present / numSundays) * 100) : 0;
        let tail = 0;
        for (let i = sundays.length - 1; i >= 0; i--) {
          const s = byWeek[sundays[i]];
          if (s === "p" || s === "o") break;
          tail += 1;
        }
        return { m, statuses: byWeek, present, rate, consecutiveAbsentTail: tail };
      });
      list.sort((a, b) => {
        if (b.rate !== a.rate) return b.rate - a.rate;
        return (a.m.name ?? "").localeCompare(b.m.name ?? "", "ko");
      });
      return list;
    };

    const perWeekFor = (members: MemberStat[]) =>
      sundays.map((d) => {
        const present = members.reduce(
          (acc, r) => acc + (r.statuses[d] === "p" || r.statuses[d] === "o" ? 1 : 0),
          0,
        );
        const total = members.length;
        return { sunday: d, present, total, rate: total > 0 ? Math.round((present / total) * 100) : 0 };
      });

    /** 그룹(mokjang)별 출석률 */
    const groupRanks = (members: MemberStat[]) => {
      const map: Record<string, { present: number; slots: number }> = {};
      members.forEach((r) => {
        const g = memberMokjang(r.m) || "미배정";
        if (!map[g]) map[g] = { present: 0, slots: 0 };
        sundays.forEach((d) => {
          map[g].slots += 1;
          const s = r.statuses[d];
          if (s === "p" || s === "o") map[g].present += 1;
        });
      });
      return Object.entries(map)
        .map(([label, v]) => ({
          label,
          rate: v.slots > 0 ? Math.round((v.present / v.slots) * 100) : 0,
          count: members.filter((r) => (memberMokjang(r.m) || "미배정") === label).length,
        }))
        .sort((a, b) => b.rate - a.rate);
    };

    /** 연령대별 출석률 */
    const ageRanks = (members: MemberStat[], deptName: string) => {
      const map: Record<string, { present: number; slots: number; count: number }> = {};
      members.forEach((r) => {
        const age = getAge(r.m.birth);
        if (age == null) return;
        const label = ageBucketLabel(age, deptName);
        if (!map[label]) map[label] = { present: 0, slots: 0, count: 0 };
        map[label].count += 1;
        sundays.forEach((d) => {
          map[label].slots += 1;
          const s = r.statuses[d];
          if (s === "p" || s === "o") map[label].present += 1;
        });
      });
      const order = ["20대 미만", "20대 초", "20대 중", "20대 후", "20대", "30대+", "30대", "40대", "50대", "60대+"];
      return Object.entries(map)
        .map(([label, v]) => ({
          label,
          rate: v.slots > 0 ? Math.round((v.present / v.slots) * 100) : 0,
          count: v.count,
        }))
        .sort((a, b) => order.indexOf(a.label) - order.indexOf(b.label));
    };

    /** 출석률 4구간 분포 */
    const distFor = (members: MemberStat[]) => {
      let perfect = 0, high = 0, mid = 0, low = 0;
      members.forEach((r) => {
        if (numSundays > 0 && r.present === numSundays) perfect += 1;
        else if (r.rate >= 80) high += 1;
        else if (r.rate >= 50) mid += 1;
        else low += 1;
      });
      return { perfect, high, mid, low };
    };

    const deptAggs: DeptAgg[] = ordered.map((dept) => {
      const ms = buildStats(byDept[dept] ?? []);
      const perWeek = perWeekFor(ms);
      const slots = ms.length * numSundays;
      const presentSum = ms.reduce((a, r) => a + r.present, 0);
      const avgRate = slots > 0 ? Math.round((presentSum / slots) * 100) : 0;
      const perfect = numSundays > 0 ? ms.filter((r) => r.present === numSundays) : [];
      const longAbsent = ms.filter((r) => r.consecutiveAbsentTail >= 3 || (numSundays > 0 && r.rate <= 20));
      const newMembers = (byDept[dept] ?? []).filter(isNewThisMonth);
      const labels = groupLabelFor(dept);
      return {
        key: dept,
        label: dept,
        isAll: false,
        members: ms,
        total: ms.length,
        perWeek,
        avgRate,
        prevAvgRate: prevAvgByDept[dept] ?? null,
        prev2AvgRate: prev2AvgByDept[dept] ?? null,
        perfectCount: perfect.length,
        perfectNames: perfect.map((r) => r.m.name || ""),
        longAbsent: longAbsent.slice(0, 8),
        newMembers,
        groupLabel: labels.group,
        groupSub: labels.sub,
        byGroup: groupRanks(ms).slice(0, 8),
        byAge: ageRanks(ms, dept).slice(0, 6),
        distribution: distFor(ms),
      };
    });

    const allMs = buildStats(activeMembers);
    const allPerWeek = perWeekFor(allMs);
    const allSlots = allMs.length * numSundays;
    const allPresent = allMs.reduce((a, r) => a + r.present, 0);
    const allAvg = allSlots > 0 ? Math.round((allPresent / allSlots) * 100) : 0;
    const allPerfect = numSundays > 0 ? allMs.filter((r) => r.present === numSundays) : [];
    const allLong = allMs.filter((r) => r.consecutiveAbsentTail >= 3 || (numSundays > 0 && r.rate <= 20));
    const allNew = activeMembers.filter(isNewThisMonth);

    // 교회 전체 페이지에서는 "그룹별" = "부서별"
    const churchByGroup = deptAggs.map((d) => ({ label: d.label, rate: d.avgRate, count: d.total }));
    const allByAge = (() => {
      const map: Record<string, { present: number; slots: number; count: number }> = {};
      allMs.forEach((r) => {
        const age = getAge(r.m.birth);
        if (age == null) return;
        const label = ageBucketLabel(age, "");
        if (!map[label]) map[label] = { present: 0, slots: 0, count: 0 };
        map[label].count += 1;
        sundays.forEach((d) => {
          map[label].slots += 1;
          const s = r.statuses[d];
          if (s === "p" || s === "o") map[label].present += 1;
        });
      });
      const order = ["20대 미만", "20대", "30대", "40대", "50대", "60대+"];
      return Object.entries(map)
        .map(([label, v]) => ({
          label,
          rate: v.slots > 0 ? Math.round((v.present / v.slots) * 100) : 0,
          count: v.count,
        }))
        .sort((a, b) => order.indexOf(a.label) - order.indexOf(b.label));
    })();

    const allAgg: DeptAgg = {
      key: "__all__",
      label: "교회 전체",
      isAll: true,
      members: allMs,
      total: allMs.length,
      perWeek: allPerWeek,
      avgRate: allAvg,
      prevAvgRate: prevAvgByDept["__all__"] ?? null,
      prev2AvgRate: prev2AvgByDept["__all__"] ?? null,
      perfectCount: allPerfect.length,
      perfectNames: allPerfect.map((r) => r.m.name || ""),
      longAbsent: allLong.slice(0, 8),
      newMembers: allNew,
      groupLabel: "부서",
      groupSub: "DEPARTMENT RANKING",
      byGroup: churchByGroup,
      byAge: allByAge,
      distribution: distFor(allMs),
    };

    return [allAgg, ...deptAggs];
  }, [activeMembers, deptOrder, sundays, statusByMember, prevAvgByDept, prev2AvgByDept, year, month]);

  const pages = useMemo(() => {
    if (scope === "__all_pages__") return aggs;
    if (scope === "__all__") return aggs.filter((a) => a.isAll);
    const one = aggs.filter((a) => a.key === scope);
    return one.length > 0 ? one : [aggs[0]];
  }, [aggs, scope]);

  /* ───────── Toolbar options ───────── */

  const yearOptions = useMemo(
    () =>
      [now.getFullYear() + 1, now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2].map((y) => ({
        value: String(y),
        label: `${y}년`,
      })),
    [now],
  );
  const monthOptions = useMemo(
    () => Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: `${i + 1}월` })),
    [],
  );
  const scopeOptions = useMemo(
    () => [
      { value: "__all_pages__", label: "교회 전체 + 부서 모두 (권장)" },
      { value: "__all__", label: "교회 전체만" },
      ...aggs.filter((a) => !a.isAll).map((a) => ({ value: a.key, label: `${a.label}만` })),
    ],
    [aggs],
  );

  /* ───────── PDF 생성 ───────── */

  /** 동적 import 안정화 — html2canvas-pro는 oklch()/color() 같은 모던 CSS 색 함수를 지원
   *  (기본 html2canvas 1.4.1은 Tailwind v4의 oklch에서 파싱 실패 → "unsupported color function" 에러) */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type Html2CanvasFn = (el: HTMLElement, opts?: any) => Promise<HTMLCanvasElement>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type JsPdfCtor = any;

  const loadDeps = async (): Promise<{ html2canvas: Html2CanvasFn; JsPDF: JsPdfCtor }> => {
    const [h2cMod, pdfMod] = await Promise.all([import("html2canvas-pro"), import("jspdf")]);
    const h2cAny = h2cMod as { default?: Html2CanvasFn };
    const html2canvas = (h2cAny.default ?? (h2cMod as unknown as Html2CanvasFn)) as Html2CanvasFn;
    const pdfModAny = pdfMod as { default?: JsPdfCtor; jsPDF?: JsPdfCtor };
    const JsPDF: JsPdfCtor = pdfModAny.default ?? pdfModAny.jsPDF;
    if (!html2canvas || !JsPDF) throw new Error("PDF 라이브러리를 불러오지 못했습니다.");
    return { html2canvas, JsPDF };
  };

  const renderPdfToBlob = async (): Promise<Blob> => {
    if (!reportRef.current) throw new Error("렌더링된 페이지가 없습니다.");

    // 폰트 로드 대기 (최대 3초)
    await Promise.race([
      (typeof document !== "undefined" && document.fonts?.ready) || Promise.resolve(),
      new Promise<void>((r) => setTimeout(r, 3000)),
    ]);

    const { html2canvas, JsPDF } = await loadDeps();
    const pageEls = Array.from(reportRef.current.querySelectorAll<HTMLElement>("[data-report-page]"));
    if (pageEls.length === 0) throw new Error("렌더링된 페이지가 없습니다.");

    const pdf = new JsPDF("p", "mm", "a4");
    for (let i = 0; i < pageEls.length; i++) {
      const el = pageEls[i];
      // eslint-disable-next-line no-await-in-loop
      const canvas = await html2canvas(el, {
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true,
        allowTaint: true,
        logging: false,
        imageTimeout: 15000,
        width: el.offsetWidth,
        height: el.offsetHeight,
        windowWidth: el.scrollWidth,
        windowHeight: el.scrollHeight,
        onclone: (clonedDoc: Document) => {
          if (!clonedDoc.getElementById("mab-google-fonts-v2")) {
            const link = clonedDoc.createElement("link");
            link.id = "mab-google-fonts-v2";
            link.rel = "stylesheet";
            link.href =
              "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Noto+Sans+KR:wght@400;500;600;700;800;900&family=Nanum+Myeongjo:wght@700;800&display=swap";
            clonedDoc.head.appendChild(link);
          }
        },
      });
      if (i > 0) pdf.addPage();
      pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, A4_W_MM, A4_H_MM);
    }
    return pdf.output("blob");
  };

  const handlePreview = async () => {
    if (busy !== "idle") return;
    setBusy("preview");
    try {
      const blob = await renderPdfToBlob();
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(blob));
    } catch (e) {
      console.error("[MonthlyAttendanceBulletin] preview 실패:", e);
      const msg = e instanceof Error ? e.message : String(e);
      window.alert(`미리보기 생성 실패: ${msg}`);
    } finally {
      setBusy("idle");
    }
  };

  const handleDownloadDirect = async () => {
    if (busy !== "idle") return;
    setBusy("download");
    try {
      const blob = await renderPdfToBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${churchName}_월간출석현황_${year}-${pad2(month)}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (e) {
      console.error("[MonthlyAttendanceBulletin] download 실패:", e);
      const msg = e instanceof Error ? e.message : String(e);
      window.alert(`PDF 생성 실패: ${msg}`);
    } finally {
      setBusy("idle");
    }
  };

  const handleDownloadFromPreview = () => {
    if (!previewUrl) return;
    const a = document.createElement("a");
    a.href = previewUrl;
    a.download = `${churchName}_월간출석현황_${year}-${pad2(month)}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handlePrint = () => window.print();

  /* ───────── 렌더 ───────── */

  const issueDate = fmtIssueDateKo(new Date());
  const monthLabel = `${year}년 ${month}월 출석 현황`;
  const periodStart = sundays[0] ?? `${year}-${pad2(month)}-01`;
  const periodEnd = sundays[sundays.length - 1] ?? periodStart;

  return (
    <div style={{ width: "100%" }}>
      <style>{`
        @media print {
          @page { size: A4; margin: 0; }
          .mab-toolbar, .mab-preview-modal { display: none !important; }
          .mab-frame { background: #ffffff !important; padding: 0 !important; }
          .mab-page { box-shadow: none !important; margin: 0 !important; page-break-after: always; }
          .mab-page:last-child { page-break-after: auto; }
          body { background: #ffffff !important; }
        }
      `}</style>

      {/* ── Toolbar ── */}
      <div className="mab-toolbar" style={toolbarStyle}>
        <span style={{ fontSize: 13, fontWeight: 700, color: COLORS.ink, marginRight: 4 }}>
          월간 출석 현황 · 게시용
        </span>
        <ModernSelect
          value={String(year)}
          onChange={(v) => setYear(Number(v))}
          options={yearOptions}
          compact
          uniform32
          style={{ marginBottom: 0, minWidth: 96 }}
        />
        <ModernSelect
          value={String(month)}
          onChange={(v) => setMonth(Number(v))}
          options={monthOptions}
          compact
          uniform32
          style={{ marginBottom: 0, minWidth: 80 }}
        />
        <ModernSelect
          value={scope}
          onChange={setScope}
          options={scopeOptions}
          compact
          uniform32
          style={{ marginBottom: 0, minWidth: 240 }}
        />
        <div style={{ flex: 1 }} />
        <button type="button" onClick={handlePrint} style={btnSecondary}>
          <Printer size={15} /> 인쇄
        </button>
        <button
          type="button"
          onClick={handlePreview}
          disabled={busy !== "idle"}
          style={{ ...btnAccent, opacity: busy !== "idle" ? 0.5 : 1 }}
        >
          <Eye size={15} /> {busy === "preview" ? "생성중…" : "PDF 미리보기"}
        </button>
        <button
          type="button"
          onClick={handleDownloadDirect}
          disabled={busy !== "idle"}
          style={{ ...btnPrimary, opacity: busy !== "idle" ? 0.7 : 1 }}
        >
          <Download size={15} /> {busy === "download" ? "생성중…" : "PDF 다운로드"}
        </button>
      </div>

      {/* ── 인라인 미리보기 ── */}
      <div className="mab-frame" style={frameStyle}>
        <div
          ref={reportRef}
          style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18, width: "100%" }}
        >
          {pages.map((agg, idx) => (
            <ReportPage
              key={agg.key + "-" + idx}
              pageIdx={idx}
              totalPages={pages.length}
              churchName={churchName}
              issueDate={issueDate}
              monthLabel={monthLabel}
              periodStart={periodStart}
              periodEnd={periodEnd}
              weekCount={sundays.length}
              year={year}
              month={month}
              agg={agg}
            />
          ))}
        </div>
      </div>

      {/* ── PDF 미리보기 모달 ── */}
      {previewUrl && (
        <div
          className="mab-preview-modal"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              if (previewUrl) URL.revokeObjectURL(previewUrl);
              setPreviewUrl(null);
            }
          }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "rgba(0,0,0,0.85)",
            display: "flex",
            flexDirection: "column",
            padding: 20,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              color: "#fff",
              padding: "0 4px 14px",
              maxWidth: 1100,
              width: "100%",
              margin: "0 auto",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Eye size={18} />
              <span style={{ fontSize: 16, fontWeight: 700 }}>월간 출석 현황 보고서 · PDF 미리보기</span>
              <span style={{ fontSize: 12, color: "#cbd5e1" }}>
                ({pages.length}장 · {monthLabel})
              </span>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button type="button" onClick={handleDownloadFromPreview} style={btnPrimaryDark}>
                <Download size={15} /> 다운로드
              </button>
              <button
                type="button"
                onClick={() => {
                  if (previewUrl) URL.revokeObjectURL(previewUrl);
                  setPreviewUrl(null);
                }}
                style={btnGhostDark}
                aria-label="닫기"
              >
                <X size={16} />
              </button>
            </div>
          </div>
          <div
            style={{
              flex: 1,
              maxWidth: 1100,
              width: "100%",
              margin: "0 auto",
              background: "#fff",
              borderRadius: 8,
              overflow: "hidden",
              boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
            }}
          >
            <iframe
              title="PDF 미리보기"
              src={previewUrl}
              style={{ width: "100%", height: "100%", border: 0 }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

/* ───────── 단일 A4 페이지 ───────── */

function ReportPage({
  pageIdx,
  totalPages,
  churchName,
  issueDate,
  monthLabel,
  periodStart,
  periodEnd,
  weekCount,
  year,
  month,
  agg,
}: {
  pageIdx: number;
  totalPages: number;
  churchName: string;
  issueDate: string;
  monthLabel: string;
  periodStart: string;
  periodEnd: string;
  weekCount: number;
  year: number;
  month: number;
  agg: DeptAgg;
}) {
  const verse = verseFor(agg.label);
  const memberNoun = agg.isAll ? "성도" : memberNounFor(agg.label);
  const churchMark = (churchName.trim()[0] ?? "敎").slice(0, 1);

  const trendStr = (() => {
    if (agg.prevAvgRate == null) return `주차 ${weekCount}회 · 주일·온라인 합산`;
    const diff = agg.avgRate - agg.prevAvgRate;
    if (diff > 0) return `▲ 전월 대비 +${diff}%p`;
    if (diff < 0) return `▼ 전월 대비 ${diff}%p`;
    return `— 전월 대비 동일`;
  })();
  const trendDown = (agg.prevAvgRate ?? agg.avgRate) > agg.avgRate;

  // 신규 트렌드 단어
  const newTrend = (() => {
    if (agg.newMembers.length === 0) return "이번 달 신규 없음";
    return `${memberNoun} ${agg.newMembers.length}명 환영`;
  })();

  // 장기 결석 트렌드
  const longTrend = agg.longAbsent.length === 0 ? "해당 없음" : `${agg.longAbsent.length}명 심방 필요`;

  const highlights = generateHighlights(agg, weekCount, year, month);

  return (
    <div data-report-page={pageIdx} className="mab-page" style={pageStyle}>
      {/* ── 상단 헤더 ── */}
      <div style={pageHeadStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 36,
              height: 36,
              background: COLORS.headerBg,
              color: "#fff",
              borderRadius: 8,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: FONT_SERIF,
              fontSize: 18,
              fontWeight: 800,
            }}
          >
            {churchMark}
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.ink, letterSpacing: "-0.01em" }}>
              {churchName}
            </div>
            <div style={{ fontSize: 9.5, color: COLORS.inkFaint, letterSpacing: "0.15em", marginTop: 1 }}>
              CHURCH · MINISTRY
            </div>
          </div>
        </div>
        <div style={{ textAlign: "right", fontSize: 10.5, color: COLORS.inkSoft, lineHeight: 1.6 }}>
          <span
            style={{
              display: "inline-block",
              fontSize: 9,
              background: COLORS.blueSoft,
              color: COLORS.blue,
              padding: "3px 8px",
              borderRadius: 10,
              letterSpacing: "0.05em",
              fontWeight: 600,
              marginBottom: 4,
            }}
          >
            MONTHLY REPORT
          </span>
          <div>{issueDate}</div>
        </div>
      </div>

      {/* ── 타이틀 ── */}
      <div style={{ marginBottom: 14 }}>
        <div
          style={{
            fontSize: 9.5,
            color: COLORS.blue,
            letterSpacing: "0.25em",
            fontWeight: 700,
            marginBottom: 5,
          }}
        >
          월 간 출 석 현 황 보 고 서
        </div>
        <div
          style={{
            fontSize: 24,
            fontWeight: 800,
            color: COLORS.ink,
            letterSpacing: "-0.02em",
            marginBottom: 4,
          }}
        >
          {monthLabel}
        </div>
        <div style={{ fontSize: 11.5, color: COLORS.inkSoft, display: "flex", alignItems: "center", gap: 8 }}>
          <span style={pillStyle}>
            {year}.{pad2(month)}.{periodStart.slice(8, 10)} — {pad2(month)}.{periodEnd.slice(8, 10)}
          </span>
          <span style={{ color: COLORS.inkFaint }}>·</span>
          <span style={pillStyle}>주차 {weekCount}회</span>
        </div>
      </div>

      {/* ── 부서 카드 ── */}
      <div style={deptCardStyle}>
        {/* radial accent */}
        <div
          style={{
            position: "absolute",
            right: -40,
            top: -40,
            width: 160,
            height: 160,
            background: "radial-gradient(circle, rgba(59,130,246,0.25), transparent 70%)",
            pointerEvents: "none",
          }}
        />
        <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", letterSpacing: "0.25em", fontWeight: 600 }}>
            {agg.isAll ? "CHURCH WIDE" : "DEPARTMENT"}
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.01em", color: "#fff" }}>
            {agg.label}
          </div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.75)", marginTop: 2 }}>
            {agg.isAll
              ? `부서 ${agg.byGroup.length}개 · 통합 출석 현황`
              : agg.byGroup.length > 0
                ? `${agg.groupLabel} ${agg.byGroup.length}개 · 활동 ${memberNoun} 통계`
                : `활동 ${memberNoun} 통계`}
          </div>
        </div>
        <div style={{ position: "relative", textAlign: "right" }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "flex-end", gap: 4 }}>
            <span style={{ fontFamily: FONT_NUM, fontSize: 40, fontWeight: 800, lineHeight: 1, color: "#fff" }}>
              {agg.total}
            </span>
            <span style={{ fontSize: 15, color: "rgba(255,255,255,0.75)", fontWeight: 500 }}>명</span>
          </div>
          <div
            style={{
              fontSize: 9.5,
              color: "rgba(255,255,255,0.6)",
              letterSpacing: "0.2em",
              marginTop: 4,
              fontWeight: 600,
            }}
          >
            ACTIVE MEMBERS
          </div>
        </div>
      </div>

      {/* ── KPI 4개 ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 12 }}>
        <KpiCard
          label="월 평균 출석률"
          value={agg.avgRate}
          unit="%"
          trend={trendStr}
          trendTone={trendDown ? "down" : "up"}
          stripe={COLORS.blue}
        />
        <KpiCard
          label={`개근 ${memberNoun}`}
          value={agg.perfectCount}
          unit="명"
          trend={agg.total > 0 ? `전체의 ${Math.round((agg.perfectCount / agg.total) * 100)}%` : "—"}
          trendTone="up"
          stripe={COLORS.emerald}
        />
        <KpiCard
          label="신규 등록"
          value={agg.newMembers.length}
          unit="명"
          trend={newTrend}
          trendTone="neutral"
          stripe={COLORS.amber}
        />
        <KpiCard
          label="장기 결석"
          value={agg.longAbsent.length}
          unit="명"
          trend={longTrend}
          trendTone={agg.longAbsent.length > 0 ? "down" : "up"}
          stripe={COLORS.rose}
        />
      </div>

      {/* ── chart row #1: 콤보 + 3개월 추이 ── */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 8, marginBottom: 12 }}>
        <ChartBox title="주차별 출석 추이" sub={`WEEKLY ATTENDANCE · ${year}.${pad2(month)}`}>
          <div style={{ display: "flex", gap: 10, fontSize: 9.5, color: COLORS.inkSoft, marginBottom: 4 }}>
            <span>
              <span
                style={{
                  display: "inline-block",
                  width: 8,
                  height: 8,
                  borderRadius: 2,
                  background: COLORS.blue,
                  marginRight: 4,
                  verticalAlign: "middle",
                }}
              />
              출석 인원
            </span>
            <span>
              <span
                style={{
                  display: "inline-block",
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: COLORS.emerald,
                  marginRight: 4,
                  verticalAlign: "middle",
                }}
              />
              출석률
            </span>
          </div>
          <ComboChart perWeek={agg.perWeek} />
        </ChartBox>
        <ChartBox title="3개월 추이" sub="3-MONTH TREND">
          <ThreeMonthTrend
            year={year}
            month={month}
            curr={agg.avgRate}
            prev={agg.prevAvgRate}
            prev2={agg.prev2AvgRate}
          />
        </ChartBox>
      </div>

      {/* ── chart row #2: 도넛 + 그룹별 ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
        <ChartBox title="출석률 구간 분포" sub="RATE DISTRIBUTION">
          <DonutDistribution dist={agg.distribution} />
        </ChartBox>
        <ChartBox title={`${agg.groupLabel}별 출석률`} sub={agg.groupSub}>
          <HBarList items={agg.byGroup} colorMode="rate" />
        </ChartBox>
      </div>

      {/* ── chart row #3: 연령대 + 하이라이트 ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 0, flex: 1, minHeight: 0 }}>
        <ChartBox title="연령대별 출석률" sub="BY AGE GROUP">
          {agg.byAge.length === 0 ? (
            <EmptyHint>출생년월 데이터가 부족합니다.</EmptyHint>
          ) : (
            <HBarList items={agg.byAge} colorMode="violet" tall />
          )}
        </ChartBox>
        <HighlightBox items={highlights} />
      </div>

      {/* ── 푸터 ── */}
      <div style={pageFootStyle}>
        <div>{churchName} · 월간 출석 현황 보고서</div>
        <div style={{ color: COLORS.inkSoft, fontWeight: 500 }}>
          <span style={{ color: COLORS.blue, margin: "0 4px" }}>✚</span>
          {verse.text} · {verse.ref}
          <span style={{ color: COLORS.blue, margin: "0 4px" }}>✚</span>
        </div>
        <div>
          {pageIdx + 1} / {totalPages}
        </div>
      </div>
    </div>
  );
}

/* ───────── KPI 카드 ───────── */

function KpiCard({
  label,
  value,
  unit,
  trend,
  trendTone,
  stripe,
}: {
  label: string;
  value: number;
  unit: string;
  trend: string;
  trendTone: "up" | "down" | "neutral";
  stripe: string;
}) {
  const tColor = trendTone === "down" ? COLORS.rose : trendTone === "neutral" ? COLORS.inkFaint : COLORS.emerald;
  return (
    <div
      style={{
        background: "#fff",
        border: `1px solid ${COLORS.line}`,
        borderRadius: 10,
        padding: "10px 12px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: 3,
          background: stripe,
        }}
      />
      <div
        style={{
          fontSize: 9.5,
          color: COLORS.inkSoft,
          fontWeight: 600,
          marginBottom: 5,
        }}
      >
        {label}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 2 }}>
        <span
          style={{
            fontFamily: FONT_NUM,
            fontSize: 26,
            fontWeight: 800,
            color: COLORS.ink,
            lineHeight: 1,
            letterSpacing: "-0.02em",
          }}
        >
          {value}
        </span>
        <span style={{ fontSize: 12, color: COLORS.inkSoft, fontWeight: 600 }}>{unit}</span>
      </div>
      <div style={{ fontSize: 9.5, color: tColor, marginTop: 5, fontWeight: 600 }}>{trend}</div>
    </div>
  );
}

/* ───────── 차트 박스 공통 ───────── */

function ChartBox({
  title,
  sub,
  children,
}: {
  title: string;
  sub?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: "#fff",
        border: `1px solid ${COLORS.line}`,
        borderRadius: 10,
        padding: "10px 14px",
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: 8,
          paddingBottom: 6,
          borderBottom: `1px solid ${COLORS.lineSoft}`,
        }}
      >
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.ink }}>{title}</div>
          {sub && (
            <div style={{ fontSize: 9, color: COLORS.inkFaint, letterSpacing: "0.08em", marginTop: 1 }}>{sub}</div>
          )}
        </div>
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>{children}</div>
    </div>
  );
}

function EmptyHint({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: COLORS.inkFaint,
        fontSize: 11,
      }}
    >
      {children}
    </div>
  );
}

/* ───────── 주차별 콤보 차트 (Bar + Line) ───────── */

function ComboChart({ perWeek }: { perWeek: { sunday: string; present: number; total: number; rate: number }[] }) {
  if (perWeek.length === 0) return <EmptyHint>출석 데이터가 없습니다.</EmptyHint>;

  const W = 600;
  const H = 150;
  const xLeft = 40;
  const xRight = 580;
  const yTop = 20;
  const yBottom = 125;

  const n = perWeek.length;
  const slotW = (xRight - xLeft) / n;
  const barW = Math.min(50, slotW - 12);

  const maxCount = Math.max(...perWeek.map((w) => w.present), 1);
  const yMaxRaw = Math.ceil(maxCount * 1.15);
  const yMax = Math.max(yMaxRaw, 1);

  const yScale = (v: number) => yBottom - (v / yMax) * (yBottom - yTop);
  const xCenter = (i: number) => xLeft + slotW * (i + 0.5);

  let maxIdx = 0;
  let minIdx = 0;
  for (let i = 1; i < perWeek.length; i++) {
    if (perWeek[i].rate > perWeek[maxIdx].rate) maxIdx = i;
    if (perWeek[i].rate < perWeek[minIdx].rate) minIdx = i;
  }
  const showMin = perWeek.length >= 3 && perWeek[minIdx].rate < perWeek[maxIdx].rate;

  const linePath = perWeek
    .map((w, i) => `${i === 0 ? "M" : "L"} ${xCenter(i)},${yScale(w.present)}`)
    .join(" ");

  const ticks = [yMax, Math.round(yMax * 0.7), Math.round(yMax * 0.35), 0];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: "100%", height: 140 }}>
      {ticks.map((t, i) => {
        const y = yTop + (yBottom - yTop) * (i / (ticks.length - 1));
        return (
          <g key={i}>
            <line
              x1={40}
              y1={y}
              x2={580}
              y2={y}
              stroke={i === ticks.length - 1 ? COLORS.line : COLORS.lineSoft}
              strokeWidth={1}
            />
            <text x={34} y={y + 3} textAnchor="end" fontSize="9" fill={COLORS.inkFaint}>
              {t}
            </text>
          </g>
        );
      })}

      {perWeek.map((w, i) => {
        const x = xCenter(i) - barW / 2;
        const y = yScale(w.present);
        const h = Math.max(yBottom - y, 0.5);
        const isMax = i === maxIdx;
        const isMin = showMin && i === minIdx;
        const fill = isMax ? COLORS.amber : isMin ? COLORS.rose : COLORS.blue;
        const labelColor = isMax ? "#D97706" : isMin ? "#DC2626" : COLORS.ink;
        return (
          <g key={w.sunday}>
            <rect x={x} y={y} width={barW} height={h} fill={fill} rx={3} />
            <text
              x={xCenter(i)}
              y={y - 4}
              textAnchor="middle"
              fontSize="10"
              fill={labelColor}
              fontWeight={isMax || isMin ? 800 : 700}
            >
              {w.present}
            </text>
          </g>
        );
      })}

      <path d={linePath} fill="none" stroke={COLORS.emerald} strokeWidth={2.5} />
      {perWeek.map((w, i) => {
        const isMax = i === maxIdx;
        const isMin = showMin && i === minIdx;
        if (isMax) {
          return (
            <circle
              key={`p${i}`}
              cx={xCenter(i)}
              cy={yScale(w.present)}
              r={5}
              fill={COLORS.emerald}
              stroke="#fff"
              strokeWidth={2}
            />
          );
        }
        if (isMin) {
          return (
            <circle
              key={`p${i}`}
              cx={xCenter(i)}
              cy={yScale(w.present)}
              r={5}
              fill={COLORS.rose}
              stroke="#fff"
              strokeWidth={2}
            />
          );
        }
        return (
          <circle
            key={`p${i}`}
            cx={xCenter(i)}
            cy={yScale(w.present)}
            r={4}
            fill="#fff"
            stroke={COLORS.emerald}
            strokeWidth={2}
          />
        );
      })}

      {perWeek.map((w, i) => {
        const isMax = i === maxIdx;
        const isMin = showMin && i === minIdx;
        const color = isMax ? COLORS.amber : isMin ? COLORS.rose : COLORS.inkSoft;
        const mark = isMax ? " ★" : isMin ? " ▼" : "";
        return (
          <text
            key={`x${i}`}
            x={xCenter(i)}
            y={142}
            textAnchor="middle"
            fontSize="10"
            fill={color}
            fontWeight={isMax || isMin ? 700 : 600}
          >
            {i + 1}주{mark}
          </text>
        );
      })}
    </svg>
  );
}

/* ───────── 3개월 추이 ───────── */

function ThreeMonthTrend({
  year,
  month,
  curr,
  prev,
  prev2,
}: {
  year: number;
  month: number;
  curr: number;
  prev: number | null;
  prev2: number | null;
}) {
  const labelFor = (delta: number) => {
    const s = shiftMonth(year, month, delta);
    return `${s.year}년 ${s.month}월`;
  };

  const arrow = (a: number | null, b: number | null) => {
    if (a == null || b == null) return null;
    if (a > b) return { ch: "▲", color: COLORS.emerald };
    if (a < b) return { ch: "▼", color: COLORS.rose };
    return { ch: "—", color: COLORS.inkFaint };
  };

  const arrPrev = arrow(prev, prev2);
  const arrCurr = arrow(curr, prev);

  const isAllUp = prev2 != null && prev != null && curr > prev && prev > prev2;
  const isAllDown = prev2 != null && prev != null && curr < prev && prev < prev2;
  const noteText = isAllUp
    ? "3개월 연속 상승세"
    : isAllDown
      ? "3개월 연속 하락세"
      : prev != null
        ? curr > prev
          ? "전월 대비 상승"
          : curr < prev
            ? "전월 대비 하락"
            : "전월과 동일"
        : "비교 데이터 부족";
  const noteColor = isAllDown ? COLORS.rose : isAllUp ? COLORS.emerald : COLORS.inkFaint;

  const rowStyle: React.CSSProperties = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "7px 10px",
    background: COLORS.bgSoft,
    borderRadius: 6,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={rowStyle}>
        <span style={{ fontSize: 10.5, color: COLORS.inkSoft, fontWeight: 600 }}>{labelFor(-2)}</span>
        <span style={{ fontFamily: FONT_NUM, fontSize: 16, fontWeight: 700, color: COLORS.ink }}>
          {prev2 != null ? `${prev2}%` : "—"}
        </span>
      </div>
      <div style={rowStyle}>
        <span style={{ fontSize: 10.5, color: COLORS.inkSoft, fontWeight: 600 }}>{labelFor(-1)}</span>
        <span style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
          {arrPrev && (
            <span style={{ color: arrPrev.color, fontWeight: 700, fontSize: 10 }}>{arrPrev.ch}</span>
          )}
          <span style={{ fontFamily: FONT_NUM, fontSize: 16, fontWeight: 700, color: COLORS.ink }}>
            {prev != null ? `${prev}%` : "—"}
          </span>
        </span>
      </div>
      <div style={{ ...rowStyle, background: COLORS.blueSoft }}>
        <span style={{ fontSize: 10.5, color: COLORS.blue, fontWeight: 700 }}>{labelFor(0)} (현재)</span>
        <span style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
          {arrCurr && (
            <span style={{ color: arrCurr.color, fontWeight: 700, fontSize: 10 }}>{arrCurr.ch}</span>
          )}
          <span style={{ fontFamily: FONT_NUM, fontSize: 16, fontWeight: 700, color: COLORS.blue }}>
            {curr}%
          </span>
        </span>
      </div>
      <div
        style={{
          marginTop: 6,
          paddingTop: 6,
          borderTop: `1px solid ${COLORS.lineSoft}`,
          fontSize: 10,
          color: noteColor,
          textAlign: "center",
          fontWeight: 600,
        }}
      >
        {noteText}
      </div>
    </div>
  );
}

/* ───────── 도넛 ───────── */

function DonutDistribution({
  dist,
}: {
  dist: { perfect: number; high: number; mid: number; low: number };
}) {
  const total = dist.perfect + dist.high + dist.mid + dist.low;
  const pct = (n: number) => (total > 0 ? (n / total) * 100 : 0);
  const segs = [
    { color: COLORS.emerald, value: pct(dist.perfect), count: dist.perfect, label: "개근 (100%)" },
    { color: COLORS.blue, value: pct(dist.high), count: dist.high, label: "80% 이상" },
    { color: COLORS.amber, value: pct(dist.mid), count: dist.mid, label: "50 ~ 79%" },
    { color: COLORS.rose, value: pct(dist.low), count: dist.low, label: "50% 미만" },
  ];

  let curOffset = 25;
  const calcs = segs.map((s) => {
    const ret = { ...s, dashOffset: curOffset };
    curOffset -= s.value;
    return ret;
  });

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, height: "100%" }}>
      <svg viewBox="0 0 42 42" style={{ width: 100, height: 100, flexShrink: 0 }}>
        <circle cx={21} cy={21} r={15.915} fill="transparent" stroke={COLORS.lineSoft} strokeWidth={6} />
        {calcs.map(
          (s, i) =>
            s.value > 0 && (
              <circle
                key={i}
                cx={21}
                cy={21}
                r={15.915}
                fill="transparent"
                stroke={s.color}
                strokeWidth={6}
                strokeDasharray={`${s.value} ${100 - s.value}`}
                strokeDashoffset={s.dashOffset}
                transform="rotate(-90 21 21)"
              />
            ),
        )}
        <text x={21} y={20} textAnchor="middle" fontSize="6" fill={COLORS.ink} fontWeight={800}>
          {Math.round(pct(dist.perfect))}
        </text>
        <text x={21} y={26} textAnchor="middle" fontSize="3" fill={COLORS.inkSoft} fontWeight={600}>
          % 개근
        </text>
      </svg>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 5 }}>
        {segs.map((s, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11 }}>
            <span
              style={{ width: 10, height: 10, borderRadius: 2, background: s.color, flexShrink: 0 }}
            />
            <span style={{ flex: 1, color: COLORS.inkSoft }}>{s.label}</span>
            <span style={{ fontFamily: FONT_NUM, fontWeight: 700, color: COLORS.ink }}>{s.count}명</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ───────── 수평 바 차트 ───────── */

function HBarList({
  items,
  colorMode,
  tall,
}: {
  items: { label: string; rate: number; count: number }[];
  colorMode: "rate" | "violet";
  tall?: boolean;
}) {
  if (items.length === 0) return <EmptyHint>표시할 데이터가 없습니다.</EmptyHint>;
  const barH = tall ? 16 : 13;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: tall ? 7 : 6 }}>
      {items.map((item) => {
        const color =
          colorMode === "violet"
            ? COLORS.violet
            : item.rate >= 80
              ? COLORS.emerald
              : item.rate >= 60
                ? COLORS.blue
                : item.rate >= 40
                  ? COLORS.amber
                  : COLORS.rose;
        return (
          <div
            key={item.label}
            style={{
              display: "grid",
              gridTemplateColumns: "62px 1fr 56px",
              alignItems: "center",
              gap: 8,
              fontSize: 10.5,
            }}
          >
            <span style={{ color: COLORS.inkSoft, fontWeight: 600 }}>{item.label}</span>
            <div
              style={{
                background: COLORS.bgSoft,
                height: barH,
                borderRadius: 4,
                overflow: "hidden",
                position: "relative",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${Math.max(Math.min(item.rate, 100), 1)}%`,
                  background: color,
                  borderRadius: 4,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "flex-end",
                  paddingRight: 6,
                  color: "#fff",
                  fontSize: 9,
                  fontWeight: 700,
                }}
              >
                {item.rate >= 14 ? `${item.rate}%` : ""}
              </div>
            </div>
            <span
              style={{
                textAlign: "right",
                fontFamily: FONT_NUM,
                fontWeight: 700,
                color: COLORS.ink,
                fontSize: 10,
              }}
            >
              {item.count}명
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ───────── 하이라이트 박스 ───────── */

function HighlightBox({ items }: { items: { text: string }[] }) {
  return (
    <div
      style={{
        background: "linear-gradient(135deg, #F9FAFB, #FFFFFF)",
        border: `1px solid ${COLORS.line}`,
        borderLeft: `4px solid ${COLORS.amber}`,
        borderRadius: 8,
        padding: "12px 16px",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          fontSize: 11,
          color: COLORS.amber,
          fontWeight: 700,
          letterSpacing: "0.05em",
          marginBottom: 8,
        }}
      >
        ★ 이번 달 하이라이트
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 5, flex: 1 }}>
        {items.length === 0 ? (
          <div style={{ fontSize: 11, color: COLORS.inkFaint }}>표시할 하이라이트가 없습니다.</div>
        ) : (
          items.map((it, i) => (
            <div
              key={i}
              style={{
                fontSize: 11.5,
                color: COLORS.ink,
                lineHeight: 1.5,
                display: "flex",
                alignItems: "flex-start",
                gap: 6,
              }}
            >
              <span style={{ color: COLORS.amber, fontWeight: 700, flexShrink: 0 }}>·</span>
              <span dangerouslySetInnerHTML={{ __html: it.text }} />
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/* 하이라이트 자동 생성 */
function generateHighlights(
  agg: DeptAgg,
  weekCount: number,
  _year: number,
  _month: number,
): { text: string }[] {
  const out: { text: string }[] = [];
  if (agg.perWeek.length > 0) {
    let maxIdx = 0;
    let minIdx = 0;
    for (let i = 1; i < agg.perWeek.length; i++) {
      if (agg.perWeek[i].rate > agg.perWeek[maxIdx].rate) maxIdx = i;
      if (agg.perWeek[i].rate < agg.perWeek[minIdx].rate) minIdx = i;
    }
    if (agg.perWeek[maxIdx].rate > 0) {
      out.push({
        text: `<strong>${maxIdx + 1}주차 (${fmtShortDate(agg.perWeek[maxIdx].sunday)})</strong> 출석률 ${
          agg.perWeek[maxIdx].rate
        }% — 월 최고치`,
      });
    }
    if (weekCount >= 3 && maxIdx !== minIdx && agg.perWeek[minIdx].rate < agg.perWeek[maxIdx].rate) {
      out.push({
        text: `<strong>${minIdx + 1}주차</strong> 출석률 ${agg.perWeek[minIdx].rate}% — 월 최저, 원인 점검 필요`,
      });
    }
  }
  if (agg.newMembers.length > 0) {
    const names = agg.newMembers
      .slice(0, 2)
      .map((m) => m.name)
      .filter(Boolean);
    const more = agg.newMembers.length - names.length;
    out.push({
      text: `<strong>신규 등록 ${agg.newMembers.length}명</strong>${
        names.length > 0 ? ` (${names.join(", ")}${more > 0 ? ` 외 ${more}명` : ""})` : ""
      }`,
    });
  }
  if (agg.byGroup.length > 0) {
    const sorted = [...agg.byGroup].sort((a, b) => b.rate - a.rate);
    const top = sorted[0];
    const last = sorted[sorted.length - 1];
    if (top && top.rate > 0) {
      out.push({ text: `<strong>${top.label}</strong> ${top.rate}%로 최고 출석률` });
    }
    if (last && top && last !== top && last.rate < 60) {
      out.push({ text: `<strong>${last.label} ${last.rate}%</strong> — 활성화 방안 점검` });
    }
  }
  if (agg.longAbsent.length > 0) {
    const names = agg.longAbsent
      .slice(0, 2)
      .map((r) => r.m.name)
      .filter(Boolean);
    const more = agg.longAbsent.length - names.length;
    out.push({
      text: `<strong>장기결석 ${agg.longAbsent.length}명</strong>${
        names.length > 0 ? ` (${names.join(", ")}${more > 0 ? ` 외 ${more}명` : ""})` : ""
      } · 심방 계획 수립 필요`,
    });
  }
  if (agg.prevAvgRate != null && agg.prev2AvgRate != null) {
    if (agg.avgRate > agg.prevAvgRate && agg.prevAvgRate > agg.prev2AvgRate) {
      out.push({
        text: `<strong>3개월 연속 상승세</strong> — ${agg.prev2AvgRate}% → ${agg.prevAvgRate}% → ${agg.avgRate}%`,
      });
    } else if (agg.avgRate < agg.prevAvgRate && agg.prevAvgRate < agg.prev2AvgRate) {
      out.push({
        text: `<strong>3개월 연속 하락세</strong> — ${agg.prev2AvgRate}% → ${agg.prevAvgRate}% → ${agg.avgRate}%`,
      });
    }
  }
  return out.slice(0, 5);
}

/* ───────── 공유 스타일 ───────── */

const toolbarStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 10,
  alignItems: "center",
  padding: "10px 14px",
  background: "var(--color-surface, #fff)",
  border: "1px solid var(--color-border, #e5e7eb)",
  borderRadius: 12,
  marginBottom: 14,
};

const frameStyle: React.CSSProperties = {
  background: "#4B5563",
  padding: "16px 16px 40px",
  borderRadius: 12,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 18,
};

const pageStyle: React.CSSProperties = {
  width: `${A4_W_MM}mm`,
  height: `${A4_H_MM}mm`,
  background: COLORS.bg,
  padding: "16mm 14mm",
  boxShadow: "0 10px 40px rgba(0,0,0,0.25)",
  boxSizing: "border-box",
  color: COLORS.ink,
  fontFamily: FONT_SANS,
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
};

const pageHeadStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  paddingBottom: 12,
  borderBottom: `1px solid ${COLORS.line}`,
  marginBottom: 14,
};

const pillStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "2px 8px",
  background: COLORS.bgSoft,
  border: `1px solid ${COLORS.line}`,
  borderRadius: 10,
  fontSize: 10.5,
  color: COLORS.ink,
  fontWeight: 500,
};

const deptCardStyle: React.CSSProperties = {
  background: COLORS.headerBg,
  color: "#fff",
  borderRadius: 12,
  padding: "16px 20px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 14,
  position: "relative",
  overflow: "hidden",
};

const pageFootStyle: React.CSSProperties = {
  marginTop: 12,
  paddingTop: 10,
  borderTop: `1px solid ${COLORS.line}`,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  fontSize: 9.5,
  color: COLORS.inkFaint,
};

const btnBase: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  height: 34,
  padding: "0 14px",
  borderRadius: 8,
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
  border: "1px solid transparent",
};

const btnSecondary: React.CSSProperties = {
  ...btnBase,
  background: "#ffffff",
  border: "1px solid #cbd5e1",
  color: "#0f172a",
};

const btnAccent: React.CSSProperties = {
  ...btnBase,
  background: "#ffffff",
  border: `1px solid ${COLORS.blue}`,
  color: COLORS.blue,
};

const btnPrimary: React.CSSProperties = {
  ...btnBase,
  background: COLORS.headerBg,
  color: "#ffffff",
  border: "none",
  padding: "0 16px",
  fontWeight: 700,
  boxShadow: "0 2px 6px rgba(17,24,39,0.18)",
};

const btnPrimaryDark: React.CSSProperties = {
  ...btnBase,
  background: COLORS.blue,
  color: "#ffffff",
  border: "none",
  padding: "0 16px",
  fontWeight: 700,
  boxShadow: "0 4px 12px rgba(59,130,246,0.35)",
};

const btnGhostDark: React.CSSProperties = {
  ...btnBase,
  background: "rgba(255,255,255,0.1)",
  color: "#ffffff",
  border: "1px solid rgba(255,255,255,0.2)",
  width: 34,
  padding: 0,
  justifyContent: "center",
};

export default MonthlyAttendanceBulletin;
