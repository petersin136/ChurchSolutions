"use client";

import { useState, useRef, useEffect, useLayoutEffect, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_KR = ["일", "월", "화", "수", "목", "금", "토"];
const YEAR_MIN = 1940;
const YEAR_MAX = 2030;
/** 앱 테마와 통일 (남색) */
const ACCENT = "#1b2a4a";
const ITEM_H = 40;
const VISIBLE = 5;

function toYMD(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function parseYMD(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}
function daysInMonth(y: number, m: number) {
  return new Date(y, m + 1, 0).getDate();
}
function displayBtn(d: Date): string {
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const dow = DAY_KR[d.getDay()];
  return `${m}월 ${day}일(${dow}) 선택`;
}
function displayValue(value: string): string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return "";
  const [y, m, d] = value.split("-");
  return `${y}. ${parseInt(m ?? "0", 10)}. ${parseInt(d ?? "0", 10)}.`;
}

function WheelColumn({
  items,
  value,
  onChange,
  suffix,
}: {
  items: number[];
  value: number;
  onChange: (v: number) => void;
  suffix: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const scrolling = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  const idx = items.indexOf(value);

  useEffect(() => {
    if (!ref.current || scrolling.current) return;
    const top = idx * ITEM_H;
    ref.current.scrollTo({ top, behavior: "auto" });
  }, [idx]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const top = items.indexOf(value) * ITEM_H;
    el.scrollTo({ top, behavior: "auto" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleScroll = useCallback(() => {
    scrolling.current = true;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (!ref.current) return;
      const scrollTop = ref.current.scrollTop;
      const newIdx = Math.round(scrollTop / ITEM_H);
      const clamped = Math.max(0, Math.min(newIdx, items.length - 1));
      ref.current.scrollTo({ top: clamped * ITEM_H, behavior: "smooth" });
      if (items[clamped] !== undefined && items[clamped] !== value) {
        onChange(items[clamped]);
      }
      scrolling.current = false;
    }, 80);
  }, [items, value, onChange]);

  const pad = (VISIBLE - 1) / 2;

  return (
    <div style={{ position: "relative", height: ITEM_H * VISIBLE, flex: 1, overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          top: ITEM_H * pad,
          left: 4,
          right: 4,
          height: ITEM_H,
          borderRadius: 10,
          border: `1.5px solid ${ACCENT}`,
          background: "rgba(244,116,88,0.06)",
          pointerEvents: "none",
          zIndex: 1,
        }}
      />
      <div
        ref={ref}
        className="scrollbar-hide"
        onScroll={handleScroll}
        style={{
          height: "100%",
          overflowY: "auto",
          scrollSnapType: "y mandatory",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {Array.from({ length: pad }).map((_, i) => (
          <div key={`pad-t-${i}`} style={{ height: ITEM_H }} />
        ))}
        {items.map((item) => {
          const sel = item === value;
          return (
            <div
              key={item}
              style={{
                height: ITEM_H,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                scrollSnapAlign: "start",
                fontSize: sel ? 18 : 15,
                fontWeight: sel ? 700 : 400,
                color: sel ? "#1a1f36" : "#b0b0b0",
                transition: "color 0.15s, font-size 0.15s, font-weight 0.15s",
                cursor: "pointer",
                userSelect: "none",
                fontFamily: "inherit",
              }}
              onClick={() => {
                onChange(item);
                if (ref.current) {
                  const target = items.indexOf(item) * ITEM_H;
                  ref.current.scrollTo({ top: target, behavior: "smooth" });
                }
              }}
            >
              {item}{suffix}
            </div>
          );
        })}
        {Array.from({ length: pad }).map((_, i) => (
          <div key={`pad-b-${i}`} style={{ height: ITEM_H }} />
        ))}
      </div>
    </div>
  );
}

interface CalendarDropdownProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  onClear?: () => void;
  showClearButton?: boolean;
  disabled?: boolean;
  id?: string;
  className?: string;
  style?: React.CSSProperties;
  /** 작은 트리거(출석부 등 행 내 배치용), 높이 36px */
  compact?: boolean;
}

export function CalendarDropdown({
  value,
  onChange,
  label,
  onClear,
  showClearButton = false,
  disabled = false,
  id,
  className,
  style,
  compact = false,
}: CalendarDropdownProps) {
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState(() => (value ? parseYMD(value) : new Date()));
  const [mode, setMode] = useState<"calendar" | "wheel">("calendar");
  const [alignRight, setAlignRight] = useState(false);
  const [portalPosition, setPortalPosition] = useState<{ top: number; left?: number; right?: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const portalRef = useRef<HTMLDivElement>(null);
  const POPUP_WIDTH = 320;

  const today = new Date();
  const todayYMD = toYMD(today);

  useEffect(() => {
    if (value) setSel(parseYMD(value));
  }, [value]);

  useEffect(() => {
    if (!open) setMode("calendar");
  }, [open]);

  useLayoutEffect(() => {
    if (!open) {
      setPortalPosition(null);
      return;
    }
    if (typeof window === "undefined" || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const spaceOnRight = window.innerWidth - rect.right;
    const spaceOnLeft = rect.left;
    const useRight = spaceOnRight < POPUP_WIDTH && spaceOnLeft >= POPUP_WIDTH;
    setAlignRight(useRight);
    const top = rect.bottom + 8;
    const maxW = Math.min(window.innerWidth - 24, 360);
    if (useRight) {
      const right = Math.max(12, window.innerWidth - rect.right);
      setPortalPosition({ top, right });
    } else {
      let left = rect.left;
      if (left + maxW > window.innerWidth - 12) left = window.innerWidth - maxW - 12;
      if (left < 12) left = 12;
      setPortalPosition({ top, left });
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (containerRef.current?.contains(target) || portalRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const year = sel.getFullYear();
  const month = sel.getMonth();
  const day = sel.getDate();

  const grid = useMemo(() => {
    const first = new Date(year, month, 1);
    const startDay = first.getDay();
    const dim = daysInMonth(year, month);
    const prev = daysInMonth(year, month - 1);
    const cells: { d: number; current: boolean; ymd: string }[] = [];
    for (let i = startDay - 1; i >= 0; i--) {
      const dd = prev - i;
      const dt = new Date(year, month - 1, dd);
      cells.push({ d: dd, current: false, ymd: toYMD(dt) });
    }
    for (let i = 1; i <= dim; i++) {
      const dt = new Date(year, month, i);
      cells.push({ d: i, current: true, ymd: toYMD(dt) });
    }
    const rem = 42 - cells.length;
    for (let i = 1; i <= rem; i++) {
      const dt = new Date(year, month + 1, i);
      cells.push({ d: i, current: false, ymd: toYMD(dt) });
    }
    return cells;
  }, [year, month]);

  const yearItems = useMemo(() => Array.from({ length: YEAR_MAX - YEAR_MIN + 1 }, (_, i) => YEAR_MIN + i), []);
  const monthItems = useMemo(() => Array.from({ length: 12 }, (_, i) => i + 1), []);
  const dayItems = useMemo(() => {
    const dim = daysInMonth(year, month);
    return Array.from({ length: dim }, (_, i) => i + 1);
  }, [year, month]);

  const confirm = useCallback(() => {
    onChange(toYMD(sel));
    setOpen(false);
  }, [onChange, sel]);

  const setWheelYear = useCallback((y: number) => {
    setSel((prev) => {
      const dim = daysInMonth(y, prev.getMonth());
      return new Date(y, prev.getMonth(), Math.min(prev.getDate(), dim));
    });
  }, []);
  const setWheelMonth = useCallback((m: number) => {
    setSel((prev) => {
      const dim = daysInMonth(prev.getFullYear(), m - 1);
      return new Date(prev.getFullYear(), m - 1, Math.min(prev.getDate(), dim));
    });
  }, []);
  const setWheelDay = useCallback((d: number) => {
    setSel((prev) => new Date(prev.getFullYear(), prev.getMonth(), d));
  }, []);

  const selectDate = useCallback((ymd: string) => {
    setSel(parseYMD(ymd));
  }, []);

  const prevMonth = useCallback(() => {
    setSel((v) => { const n = new Date(v); n.setMonth(n.getMonth() - 1); return n; });
  }, []);
  const nextMonth = useCallback(() => {
    setSel((v) => { const n = new Date(v); n.setMonth(n.getMonth() + 1); return n; });
  }, []);

  const selYMD = toYMD(sel);

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
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: compact ? "6px 12px" : "12px 14px",
          borderRadius: 12,
          border: "1px solid #e5e7eb",
          background: disabled ? "#f9fafb" : "#fff",
          fontSize: compact ? 14 : 15,
          color: value ? "#1a1f36" : "#9ca3af",
          fontFamily: "inherit",
          cursor: disabled ? "not-allowed" : "pointer",
          outline: "none",
          textAlign: "left",
          opacity: disabled ? 0.7 : 1,
          minHeight: compact ? 36 : undefined,
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

      {open && portalPosition && typeof document !== "undefined" && createPortal(
        <div
          ref={portalRef}
          style={{
            position: "fixed",
            top: portalPosition.top,
            ...(portalPosition.left != null ? { left: portalPosition.left } : {}),
            ...(portalPosition.right != null ? { right: portalPosition.right } : {}),
            minWidth: POPUP_WIDTH,
            width: compact ? POPUP_WIDTH : "100%",
            maxWidth: "min(100vw - 24px, 360px)",
            background: "#fff",
            borderRadius: 20,
            border: "1px solid #e5e7eb",
            boxShadow: "0 12px 40px rgba(0,0,0,0.12)",
            zIndex: 100000,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Header */}
          <div style={{ padding: "16px 20px 8px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <button
              type="button"
              onClick={() => setMode((m) => (m === "calendar" ? "wheel" : "calendar"))}
              style={{
                fontSize: 17,
                fontWeight: 700,
                color: ACCENT,
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 0,
                display: "flex",
                alignItems: "center",
                gap: 4,
                fontFamily: "inherit",
              }}
            >
              {year}년 {month + 1}월
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginTop: 1 }}>
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
            {mode === "calendar" && (
              <div style={{ display: "flex", gap: 2 }}>
                <button type="button" onClick={prevMonth} style={{ width: 30, height: 30, border: "none", background: "transparent", cursor: "pointer", fontSize: 16, color: "#9ca3af", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 8 }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
                </button>
                <button type="button" onClick={nextMonth} style={{ width: 30, height: 30, border: "none", background: "transparent", cursor: "pointer", fontSize: 16, color: "#9ca3af", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 8 }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
                </button>
              </div>
            )}
          </div>

          {mode === "calendar" ? (
            <div style={{ padding: "4px 16px 0" }}>
              {/* Day headers */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", marginBottom: 4 }}>
                {DAY_KR.map((d, i) => (
                  <div key={d} style={{ textAlign: "center", fontSize: 12, fontWeight: 500, color: i === 0 ? ACCENT : "#9ca3af", padding: "4px 0" }}>
                    {d}
                  </div>
                ))}
              </div>
              {/* Date grid */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, maxWidth: 320 }}>
                {grid.map(({ d, current, ymd }) => {
                  const selected = selYMD === ymd;
                  const isToday = todayYMD === ymd;
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
                        background: selected ? ACCENT : "transparent",
                        color: selected ? "#fff" : current ? "#1a1f36" : "#d1d5db",
                        fontSize: 14,
                        fontWeight: selected ? 700 : isToday ? 600 : 400,
                        cursor: "pointer",
                        fontFamily: "inherit",
                        position: "relative",
                      }}
                    >
                      {d}
                      {isToday && !selected && (
                        <span style={{ position: "absolute", bottom: 3, left: "50%", transform: "translateX(-50%)", width: 4, height: 4, borderRadius: "50%", background: ACCENT }} />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div style={{ padding: "8px 12px 0", display: "flex", gap: 0 }}>
              <WheelColumn items={yearItems} value={year} onChange={setWheelYear} suffix="년" />
              <WheelColumn items={monthItems} value={month + 1} onChange={setWheelMonth} suffix="월" />
              <WheelColumn items={dayItems} value={day} onChange={setWheelDay} suffix="일" />
            </div>
          )}

          {/* Bottom confirm */}
          <div style={{ padding: "10px 16px 14px" }}>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={() => setOpen(false)}
                style={{
                  flex: "0 0 auto",
                  padding: "12px 16px",
                  borderRadius: 14,
                  border: "none",
                  background: "#f3f4f6",
                  color: "#6b7280",
                  fontSize: 15,
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                닫기
              </button>
              <button
                type="button"
                onClick={confirm}
                style={{
                  flex: 1,
                  padding: "12px 12px",
                  borderRadius: 14,
                  border: "none",
                  background: ACCENT,
                  color: "#fff",
                  fontSize: 16,
                  fontWeight: 700,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  letterSpacing: -0.3,
                  whiteSpace: "nowrap",
                  minWidth: 0,
                }}
              >
                {displayBtn(sel)}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
