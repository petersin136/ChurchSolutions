"use client";

import { useState, useRef, useEffect, useCallback } from "react";

const DAYS = ["일", "월", "화", "수", "목", "금", "토"];

function toYMD(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseYMD(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

function displayValue(value: string): string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return "";
  const [y, m, d] = value.split("-");
  return `${y}. ${parseInt(m ?? "0", 10)}. ${parseInt(d ?? "0", 10)}.`;
}

interface CalendarDropdownProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  onClear?: () => void;
  showClearButton?: boolean;
  id?: string;
  className?: string;
  style?: React.CSSProperties;
}

export function CalendarDropdown({
  value,
  onChange,
  label,
  onClear,
  showClearButton = false,
  id,
  className,
  style,
}: CalendarDropdownProps) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => (value ? parseYMD(value) : new Date()));
  const containerRef = useRef<HTMLDivElement>(null);

  const today = toYMD(new Date());

  useEffect(() => {
    if (value) setView(parseYMD(value));
  }, [value]);

  useEffect(() => {
    if (!open) return;
    const onOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, [open]);

  const year = view.getFullYear();
  const month = view.getMonth();
  const first = new Date(year, month, 1);
  const start = new Date(first);
  start.setDate(start.getDate() - start.getDay());
  const grid: { date: Date; ymd: string; isCurrent: boolean; isToday: boolean }[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const ymd = toYMD(d);
    grid.push({
      date: d,
      ymd,
      isCurrent: d.getMonth() === month,
      isToday: ymd === today,
    });
  }

  const prevMonth = useCallback(() => {
    setView((v) => {
      const n = new Date(v);
      n.setMonth(n.getMonth() - 1);
      return n;
    });
  }, []);
  const nextMonth = useCallback(() => {
    setView((v) => {
      const n = new Date(v);
      n.setMonth(n.getMonth() + 1);
      return n;
    });
  }, []);

  const selectDate = useCallback(
    (ymd: string) => {
      onChange(ymd);
      setOpen(false);
    },
    [onChange]
  );

  const setToday = useCallback(() => {
    const t = today;
    onChange(t);
    setView(parseYMD(t));
    setOpen(false);
  }, [onChange, today]);

  return (
    <div ref={containerRef} style={{ position: "relative", ...style }} className={className}>
      {label && (
        <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#1a1f36", marginBottom: 6 }}>
          {label}
        </label>
      )}
      <button
        type="button"
        id={id}
        onClick={() => setOpen((o) => !o)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "12px 14px",
          borderRadius: 12,
          border: "1px solid #e5e7eb",
          background: "#fff",
          fontSize: 15,
          color: value ? "#1a1f36" : "#9ca3af",
          fontFamily: "inherit",
          cursor: "pointer",
          outline: "none",
          textAlign: "left",
        }}
      >
        <span style={{ flex: 1 }}>{value ? displayValue(value) : "날짜 선택"}</span>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            marginTop: 8,
            background: "#fff",
            borderRadius: 16,
            border: "1px solid #e5e7eb",
            boxShadow: "0 10px 40px rgba(0,0,0,0.12)",
            zIndex: 1000,
            overflow: "hidden",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderBottom: "1px solid #f3f4f6" }}>
            <span style={{ fontSize: 16, fontWeight: 700, color: "#1a1f36" }}>
              {year}년 {month + 1}월
            </span>
            <div style={{ display: "flex", gap: 4 }}>
              <button type="button" onClick={prevMonth} style={{ width: 32, height: 32, border: "none", background: "#f3f4f6", borderRadius: 8, cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>◀</button>
              <button type="button" onClick={nextMonth} style={{ width: 32, height: 32, border: "none", background: "#f3f4f6", borderRadius: 8, cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>▶</button>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", padding: "10px 12px", gap: 2 }}>
            {DAYS.map((d) => (
              <div key={d} style={{ textAlign: "center", fontSize: 11, fontWeight: 600, color: "#6b7280", padding: "6px 0" }}>
                {d}
              </div>
            ))}
            {grid.map(({ date, ymd, isCurrent, isToday }) => {
              const selected = value === ymd;
              return (
                <button
                  key={ymd}
                  type="button"
                  onClick={() => selectDate(ymd)}
                  style={{
                    width: "100%",
                    aspectRatio: "1",
                    maxWidth: 40,
                    margin: "0 auto",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "none",
                    borderRadius: "50%",
                    background: selected ? "#3b82f6" : "transparent",
                    color: selected ? "#fff" : isCurrent ? "#1a1f36" : "#d1d5db",
                    fontSize: 14,
                    fontWeight: selected ? 700 : 500,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    boxSizing: "border-box",
                    borderWidth: 1,
                    borderStyle: "solid",
                    borderColor: isToday && !selected ? "#9ca3af" : "transparent",
                  }}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 16px", borderTop: "1px solid #f3f4f6", gap: 8 }}>
            {(showClearButton || onClear) ? (
              <button type="button" onClick={() => { if (onClear) onClear(); else onChange(""); setOpen(false); }} style={{ padding: "8px 14px", fontSize: 14, fontWeight: 600, color: "#6b7280", background: "none", border: "none", cursor: "pointer" }}>
                삭제
              </button>
            ) : <span />}
            <button type="button" onClick={setToday} style={{ padding: "8px 14px", fontSize: 14, fontWeight: 600, color: "#3b82f6", background: "none", border: "none", cursor: "pointer" }}>
              오늘
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
