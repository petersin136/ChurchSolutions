"use client";

import { useState, useRef, useEffect, useLayoutEffect, useCallback, useMemo, type CSSProperties } from "react";
import { createPortal } from "react-dom";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_KR = ["일", "월", "화", "수", "목", "금", "토"];
const YEAR_MIN = 1940;
const YEAR_MAX = 2030;
/** 앱 테마와 통일 (남색) */
const ACCENT = "var(--color-primary)";
/** 출석부·활동기록 — 잉크 톤을 유지한 에디토리얼 캘린더 */
const ACTIVITY_CAL = {
  ink: "#0b0c0e",
  muted: "#90939c",
  faint: "#c8cad0",
  sun: "#c45c5c",
  surface: "#ffffff",
  border: "#f0f1f3",
  hover: "#ebebef",
  week: "#f6f6f8",
  today: "#ebebef",
  selectedBg: "#0b0c0e",
  shadow: "0 16px 40px rgba(11, 12, 14, 0.10), 0 2px 6px rgba(11, 12, 14, 0.04)",
  panelRadius: 12,
  chipRadius: 6,
  font: "'Pretendard', 'Inter', system-ui, -apple-system, sans-serif",
} as const;
const ACTIVITY_POPUP_WIDTH = 264;

const activityNavBtnStyle: CSSProperties = {
  width: 26,
  height: 28,
  border: "none",
  background: "transparent",
  cursor: "pointer",
  color: ACTIVITY_CAL.muted,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 0,
};

function ActivityPickCell({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        height: 44,
        border: "none",
        background: selected ? ACTIVITY_CAL.selectedBg : "transparent",
        color: selected ? "#ffffff" : ACTIVITY_CAL.ink,
        borderRadius: ACTIVITY_CAL.chipRadius,
        fontFamily: ACTIVITY_CAL.font,
        fontSize: 13,
        fontWeight: selected ? 700 : 500,
        cursor: "pointer",
        fontVariantNumeric: "tabular-nums",
        letterSpacing: "-0.02em",
      }}
      onMouseEnter={(e) => {
        if (!selected) e.currentTarget.style.background = ACTIVITY_CAL.hover;
      }}
      onMouseLeave={(e) => {
        if (!selected) e.currentTarget.style.background = "transparent";
      }}
    >
      {label}
    </button>
  );
}
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

function displayValueActivity(value: string): string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return "";
  const d = parseYMD(value);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const wd = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"][d.getDay()];
  return `${y}. ${m}. ${day}. ${wd}`;
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
          borderRadius: 7,
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
  /** 트리거 버튼에 병합 (모바일 전용 fontSize/height 등) */
  triggerStyle?: React.CSSProperties;
  /** activity — "2026. 07. 08. WED" 형식 */
  displayVariant?: "default" | "activity";
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
  triggerStyle,
  displayVariant = "default",
}: CalendarDropdownProps) {
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState(() => (value ? parseYMD(value) : new Date()));
  const [mode, setMode] = useState<"calendar" | "wheel">("calendar");
  const [activityPick, setActivityPick] = useState<"calendar" | "month" | "year">("calendar");
  const [yearPageStart, setYearPageStart] = useState(() => Math.floor(new Date().getFullYear() / 10) * 10);
  const [alignRight, setAlignRight] = useState(false);
  const [portalPosition, setPortalPosition] = useState<{
    top: number;
    left?: number;
    right?: number;
    width?: number;
  } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const portalRef = useRef<HTMLDivElement>(null);
  const POPUP_WIDTH = 320;

  const today = new Date();
  const todayYMD = toYMD(today);

  useEffect(() => {
    if (value) setSel(parseYMD(value));
  }, [value]);

  useEffect(() => {
    if (!open) {
      setMode("calendar");
      setActivityPick("calendar");
    }
  }, [open]);

  const isActivity = displayVariant === "activity";

  useLayoutEffect(() => {
    if (!open) {
      setPortalPosition(null);
      return;
    }
    if (typeof window === "undefined" || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const popupW = isActivity ? ACTIVITY_POPUP_WIDTH : POPUP_WIDTH;
    const spaceOnRight = window.innerWidth - rect.right;
    const spaceOnLeft = rect.left;
    const useRight = spaceOnRight < popupW && spaceOnLeft >= popupW;
    setAlignRight(useRight);
    const top = rect.bottom + (isActivity ? 6 : 8);
    const maxW = isActivity ? ACTIVITY_POPUP_WIDTH : Math.min(window.innerWidth - 24, 360);
    if (useRight) {
      const right = Math.max(12, window.innerWidth - rect.right);
      setPortalPosition({ top, right, width: maxW });
    } else {
      let left = rect.left;
      if (!isActivity && left + maxW > window.innerWidth - 12) left = window.innerWidth - maxW - 12;
      if (left < 12) left = 12;
      setPortalPosition({ top, left, width: maxW });
    }
  }, [open, isActivity]);

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

  const selectDate = useCallback(
    (ymd: string) => {
      if (isActivity) {
        onChange(ymd);
        setOpen(false);
        return;
      }
      setSel(parseYMD(ymd));
    },
    [isActivity, onChange],
  );

  const goToToday = useCallback(() => {
    const now = new Date();
    const ymd = toYMD(now);
    setSel(now);
    onChange(ymd);
    setOpen(false);
  }, [onChange]);

  const prevMonth = useCallback(() => {
    setSel((v) => { const n = new Date(v); n.setMonth(n.getMonth() - 1); return n; });
  }, []);
  const nextMonth = useCallback(() => {
    setSel((v) => { const n = new Date(v); n.setMonth(n.getMonth() + 1); return n; });
  }, []);

  const pickActivityMonth = useCallback((monthIndex: number) => {
    setSel((prev) => {
      const dim = daysInMonth(prev.getFullYear(), monthIndex);
      return new Date(prev.getFullYear(), monthIndex, Math.min(prev.getDate(), dim));
    });
    setActivityPick("calendar");
  }, []);

  const pickActivityYear = useCallback((nextYear: number) => {
    setSel((prev) => {
      const dim = daysInMonth(nextYear, prev.getMonth());
      return new Date(nextYear, prev.getMonth(), Math.min(prev.getDate(), dim));
    });
    setActivityPick("calendar");
  }, []);

  const shiftActivityWeek = useCallback(
    (weekDelta: number) => {
      const base = value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? parseYMD(value) : sel;
      const next = new Date(base.getFullYear(), base.getMonth(), base.getDate() + weekDelta * 7);
      const ymd = toYMD(next);
      setSel(next);
      onChange(ymd);
    },
    [value, sel, onChange],
  );

  const activityNavPrev = useCallback(() => {
    if (activityPick === "year") {
      setYearPageStart((s) => Math.max(YEAR_MIN, s - 10));
      return;
    }
    if (activityPick === "month") {
      setSel((v) => {
        const y = v.getFullYear() - 1;
        const dim = daysInMonth(y, v.getMonth());
        return new Date(y, v.getMonth(), Math.min(v.getDate(), dim));
      });
      return;
    }
    shiftActivityWeek(-1);
  }, [activityPick, shiftActivityWeek]);

  const activityNavNext = useCallback(() => {
    if (activityPick === "year") {
      setYearPageStart((s) => Math.min(Math.floor(YEAR_MAX / 10) * 10, s + 10));
      return;
    }
    if (activityPick === "month") {
      setSel((v) => {
        const y = v.getFullYear() + 1;
        const dim = daysInMonth(y, v.getMonth());
        return new Date(y, v.getMonth(), Math.min(v.getDate(), dim));
      });
      return;
    }
    shiftActivityWeek(1);
  }, [activityPick, shiftActivityWeek]);

  const activityYearPage = useMemo(() => {
    const start = Math.min(Math.max(yearPageStart, YEAR_MIN), Math.floor(YEAR_MAX / 10) * 10);
    return Array.from({ length: 12 }, (_, i) => start + i).filter((y) => y >= YEAR_MIN && y <= YEAR_MAX);
  }, [yearPageStart]);

  const selYMD = toYMD(sel);
  const highlightYMD = isActivity && value ? value : selYMD;
  const highlightWeekStart = useMemo(() => {
    const idx = grid.findIndex((c) => c.ymd === highlightYMD);
    return idx >= 0 ? Math.floor(idx / 7) * 7 : -1;
  }, [grid, highlightYMD]);

  const triggerH = triggerStyle?.minHeight ?? triggerStyle?.height;
  const triggerDense =
    typeof triggerH === "number"
      ? triggerH <= 28
      : typeof triggerH === "string"
        ? parseInt(triggerH, 10) <= 28
        : false;
  const calendarIconSize = triggerDense ? 16 : 20;

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
          borderRadius: 7,
          border: "1px solid var(--color-border)",
          background: disabled ? "#f9fafb" : "#fff",
          fontSize: compact ? 14 : 15,
          color: value ? "#1a1f36" : "#9ca3af",
          fontFamily: "inherit",
          cursor: disabled ? "not-allowed" : "pointer",
          outline: "none",
          textAlign: "left",
          opacity: disabled ? 0.7 : 1,
          minHeight: compact ? 36 : undefined,
          ...triggerStyle,
        }}
      >
        <span
          style={{
            flex: 1,
            ...(compact
              ? { minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }
              : {}),
          }}
        >
          {value
            ? displayVariant === "activity"
              ? displayValueActivity(value)
              : displayValue(value)
            : "날짜 선택"}
        </span>
        <svg width={calendarIconSize} height={calendarIconSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      </button>

      {open && portalPosition && typeof document !== "undefined" && createPortal(
        isActivity ? (
          <div
            ref={portalRef}
            style={{
              position: "fixed",
              top: portalPosition.top,
              ...(portalPosition.left != null ? { left: portalPosition.left } : {}),
              ...(portalPosition.right != null ? { right: portalPosition.right } : {}),
              width: portalPosition.width,
              background: ACTIVITY_CAL.surface,
              borderRadius: ACTIVITY_CAL.panelRadius,
              border: `1px solid ${ACTIVITY_CAL.border}`,
              boxShadow: ACTIVITY_CAL.shadow,
              zIndex: 100000,
              overflow: "hidden",
              fontFamily: ACTIVITY_CAL.font,
            }}
          >
            <div
              style={{
                padding: "14px 14px 10px 16px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
                borderBottom: `1px solid ${ACTIVITY_CAL.border}`,
              }}
            >
              <div style={{ display: "flex", alignItems: "baseline", gap: 4, minWidth: 0 }}>
                <button
                  type="button"
                  aria-label="월 선택"
                  aria-pressed={activityPick === "month"}
                  onClick={() => setActivityPick((p) => (p === "month" ? "calendar" : "month"))}
                  style={{
                    border: "none",
                    background: activityPick === "month" ? ACTIVITY_CAL.today : "transparent",
                    padding: "2px 6px",
                    margin: "-2px 0",
                    borderRadius: ACTIVITY_CAL.chipRadius,
                    fontSize: 17,
                    fontWeight: 700,
                    color: ACTIVITY_CAL.ink,
                    letterSpacing: "-0.03em",
                    lineHeight: 1.2,
                    cursor: "pointer",
                    fontFamily: ACTIVITY_CAL.font,
                  }}
                >
                  {month + 1}월
                </button>
                <button
                  type="button"
                  aria-label="연도 선택"
                  aria-pressed={activityPick === "year"}
                  onClick={() => {
                    if (activityPick === "year") {
                      setActivityPick("calendar");
                      return;
                    }
                    setYearPageStart(Math.max(YEAR_MIN, Math.floor(year / 10) * 10));
                    setActivityPick("year");
                  }}
                  style={{
                    border: "none",
                    background: activityPick === "year" ? ACTIVITY_CAL.today : "transparent",
                    padding: "2px 6px",
                    margin: "-2px 0",
                    borderRadius: ACTIVITY_CAL.chipRadius,
                    fontSize: 13,
                    fontWeight: 500,
                    color: ACTIVITY_CAL.muted,
                    letterSpacing: "0.01em",
                    lineHeight: 1.2,
                    cursor: "pointer",
                    fontFamily: ACTIVITY_CAL.font,
                  }}
                >
                  {year}
                </button>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <button
                  type="button"
                  onClick={goToToday}
                  style={{
                    border: "none",
                    background: ACTIVITY_CAL.today,
                    color: ACTIVITY_CAL.muted,
                    fontSize: 12,
                    fontWeight: 600,
                    height: 28,
                    padding: "0 10px",
                    borderRadius: ACTIVITY_CAL.chipRadius,
                    cursor: "pointer",
                    fontFamily: ACTIVITY_CAL.font,
                    lineHeight: "28px",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = ACTIVITY_CAL.ink;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = ACTIVITY_CAL.muted;
                  }}
                >
                  오늘
                </button>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    height: 28,
                    background: ACTIVITY_CAL.today,
                    borderRadius: ACTIVITY_CAL.chipRadius,
                    overflow: "hidden",
                  }}
                >
                  <button
                    type="button"
                    onClick={activityNavPrev}
                    aria-label={activityPick === "year" ? "이전 연도" : activityPick === "month" ? "이전 해" : "이전 주"}
                    style={activityNavBtnStyle}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = ACTIVITY_CAL.ink;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = ACTIVITY_CAL.muted;
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="15 18 9 12 15 6" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={activityNavNext}
                    aria-label={activityPick === "year" ? "다음 연도" : activityPick === "month" ? "다음 해" : "다음 주"}
                    style={activityNavBtnStyle}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = ACTIVITY_CAL.ink;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = ACTIVITY_CAL.muted;
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            <div style={{ padding: "12px 12px 14px" }}>
              {activityPick === "month" ? (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 4 }}>
                  {Array.from({ length: 12 }, (_, i) => (
                    <ActivityPickCell
                      key={i}
                      label={`${i + 1}월`}
                      selected={i === month}
                      onClick={() => pickActivityMonth(i)}
                    />
                  ))}
                </div>
              ) : activityPick === "year" ? (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 4 }}>
                  {activityYearPage.map((y) => (
                    <ActivityPickCell
                      key={y}
                      label={String(y)}
                      selected={y === year}
                      onClick={() => pickActivityYear(y)}
                    />
                  ))}
                </div>
              ) : (
              <>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(7, 1fr)",
                  marginBottom: 8,
                  paddingBottom: 8,
                  borderBottom: `1px solid ${ACTIVITY_CAL.border}`,
                }}
              >
                {DAY_KR.map((d, i) => (
                  <div
                    key={d}
                    style={{
                      textAlign: "center",
                      fontSize: 11,
                      fontWeight: 600,
                      color: i === 0 ? ACTIVITY_CAL.sun : ACTIVITY_CAL.muted,
                      padding: "0",
                      letterSpacing: "0.04em",
                      textBoxTrim: "trim-both",
                      textBoxEdge: "cap alphabetic",
                    }}
                  >
                    {d}
                  </div>
                ))}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
                {grid.map(({ d, current, ymd }, i) => {
                  const selected = highlightYMD === ymd;
                  const isToday = todayYMD === ymd;
                  const inWeek = highlightWeekStart >= 0 && i >= highlightWeekStart && i < highlightWeekStart + 7;
                  const col = i % 7;
                  const weekRadius =
                    inWeek && col === 0 ? "8px 0 0 8px" : inWeek && col === 6 ? "0 8px 8px 0" : 0;
                  const chipBg = selected
                    ? ACTIVITY_CAL.selectedBg
                    : isToday
                      ? ACTIVITY_CAL.today
                      : "transparent";
                  return (
                    <button
                      key={ymd}
                      type="button"
                      onClick={() => selectDate(ymd)}
                      style={{
                        width: "100%",
                        height: 36,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        border: "none",
                        borderRadius: weekRadius,
                        background: inWeek ? ACTIVITY_CAL.week : "transparent",
                        cursor: "pointer",
                        fontFamily: ACTIVITY_CAL.font,
                        padding: 0,
                      }}
                    >
                      <span
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: ACTIVITY_CAL.chipRadius,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          background: chipBg,
                          color: selected ? "#ffffff" : current ? ACTIVITY_CAL.ink : ACTIVITY_CAL.faint,
                          fontSize: 13,
                          fontWeight: selected ? 700 : isToday ? 600 : 500,
                          fontVariantNumeric: "tabular-nums",
                          letterSpacing: "-0.02em",
                          transition: "background 0.12s ease, color 0.12s ease",
                          textBoxTrim: "trim-both",
                          textBoxEdge: "cap alphabetic",
                        }}
                        onMouseEnter={(e) => {
                          if (!selected) e.currentTarget.style.background = ACTIVITY_CAL.hover;
                        }}
                        onMouseLeave={(e) => {
                          if (!selected) {
                            e.currentTarget.style.background = isToday ? ACTIVITY_CAL.today : "transparent";
                          }
                        }}
                      >
                        {d}
                      </span>
                    </button>
                  );
                })}
              </div>
              </>
              )}
            </div>
          </div>
        ) : (
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
            background: "var(--color-surface)",
            borderRadius: 7,
            border: "1px solid var(--color-border)",
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
                <button type="button" onClick={prevMonth} style={{ width: 30, height: 30, border: "none", background: "transparent", cursor: "pointer", fontSize: 16, color: "#9ca3af", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 7 }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
                </button>
                <button type="button" onClick={nextMonth} style={{ width: 30, height: 30, border: "none", background: "transparent", cursor: "pointer", fontSize: 16, color: "#9ca3af", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 7 }}>
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
                  const selected = highlightYMD === ymd;
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
                  borderRadius: 7,
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
                  borderRadius: 7,
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
        </div>
        ),
        document.body
      )}
    </div>
  );
}
