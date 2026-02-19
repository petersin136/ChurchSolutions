"use client";

import { useMemo } from "react";
import type { Member } from "@/types/db";

/**
 * 현재 날짜 기준 ±30일 이내 경조사 (생일, 결혼기념일, 세례기념일, 양력 기준)
 * TODO: 음력 생일은 음력 변환 라이브러리 추가 예정
 */
function getRange30Days(): { start: string; end: string } {
  const d = new Date();
  const start = new Date(d);
  start.setDate(start.getDate() - 30);
  const end = new Date(d);
  end.setDate(end.getDate() + 30);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

/** 생일 등 MM-DD만 있는 날짜가 [start, end] 구간(YYYY-MM-DD)에 포함되는지 (당해 연도 기준) */
function isDateInRange(mmdd: string | undefined, start: string, end: string): boolean {
  if (!mmdd || mmdd.length < 5) return false;
  const [yS, mS, dS] = start.split("-").map(Number);
  const [yE, mE, dE] = end.split("-").map(Number);
  const thisYear = new Date().getFullYear();
  const fullDate = mmdd.length >= 10 ? mmdd : `${thisYear}-${mmdd.slice(0, 2)}-${mmdd.slice(3, 5)}`;
  const [my, mm, md] = fullDate.split("-").map(Number);
  const comp = mm * 100 + md;
  const compStart = mS * 100 + dS;
  const compEnd = mE * 100 + dE;
  if (compStart <= compEnd) return comp >= compStart && comp <= compEnd;
  return comp >= compStart || comp <= compEnd;
}

function toMMDD(dateStr: string): string {
  if (!dateStr || dateStr.length < 10) return "";
  const [_, m, d] = dateStr.split("-");
  return `${parseInt(m!, 10)}/${parseInt(d!, 10)}`;
}

export interface UpcomingEventsProps {
  members: Member[];
  className?: string;
}

export function UpcomingEvents({ members, className = "" }: UpcomingEventsProps) {
  const { start, end } = useMemo(() => getRange30Days(), []);

  const events = useMemo(() => {
    const list: { name: string; type: string; date: string; displayDate: string; phone?: string }[] = [];
    members.forEach((m) => {
      const name = m.name ?? "";
      if (m.birth && isDateInRange(m.birth, start, end))
        list.push({ name, type: "생일", date: m.birth, displayDate: toMMDD(m.birth), phone: m.phone });
      if (m.wedding_anniversary && isDateInRange(m.wedding_anniversary, start, end))
        list.push({ name, type: "결혼기념일", date: m.wedding_anniversary, displayDate: toMMDD(m.wedding_anniversary), phone: m.phone });
      if (m.baptism_date && isDateInRange(m.baptism_date, start, end))
        list.push({ name, type: "세례기념일", date: m.baptism_date, displayDate: toMMDD(m.baptism_date), phone: m.phone });
    });
    return list.sort((a, b) => a.date.localeCompare(b.date));
  }, [members, start, end]);

  if (events.length === 0) return <p className={`text-sm text-gray-500 ${className}`}>다가오는 30일 경조사가 없습니다.</p>;

  return (
    <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 ${className}`}>
      {events.map((e, i) => (
        <div key={i} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="font-medium text-[#1e3a5f]">{e.name}</p>
          <p className="text-sm text-gray-600">{e.type} · {e.displayDate}</p>
          {e.phone && <p className="text-xs text-gray-500 mt-1"><a href={`tel:${e.phone}`} className="hover:underline">{e.phone}</a></p>}
        </div>
      ))}
    </div>
  );
}
