"use client";

import { useMemo } from "react";
import type { Member } from "@/types/db";

/**
 * 이번 주 경조사: 생일, 결혼기념일, 세례기념일 (양력 기준)
 * TODO: 음력 생일은 음력 변환 라이브러리 추가 예정
 */
function getThisWeekRange(): { start: string; end: string } {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const start = new Date(d);
  start.setDate(diff);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

function isInWeek(dateStr: string | undefined, start: string, end: string): boolean {
  if (!dateStr || dateStr.length < 10) return false;
  const d = dateStr.slice(0, 10);
  return d >= start && d <= end;
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
  const { start, end } = useMemo(() => getThisWeekRange(), []);

  const events = useMemo(() => {
    const list: { name: string; type: string; date: string; displayDate: string; phone?: string }[] = [];
    members.forEach((m) => {
      const name = m.name ?? "";
      if (isInWeek(m.birth, start, end))
        list.push({ name, type: "생일", date: m.birth!, displayDate: toMMDD(m.birth!), phone: m.phone });
      if (isInWeek(m.wedding_anniversary, start, end))
        list.push({ name, type: "결혼기념일", date: m.wedding_anniversary!, displayDate: toMMDD(m.wedding_anniversary!), phone: m.phone });
      if (isInWeek(m.baptism_date, start, end))
        list.push({ name, type: "세례기념일", date: m.baptism_date!, displayDate: toMMDD(m.baptism_date!), phone: m.phone });
    });
    return list.sort((a, b) => a.date.localeCompare(b.date));
  }, [members, start, end]);

  if (events.length === 0) return <p className={`text-sm text-gray-500 ${className}`}>이번 주 경조사가 없습니다.</p>;

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
