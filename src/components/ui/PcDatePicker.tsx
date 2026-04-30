"use client";

import { addDays } from "date-fns/addDays";
import { addMonths } from "date-fns/addMonths";
import { endOfWeek } from "date-fns/endOfWeek";
import { format } from "date-fns/format";
import { getYear } from "date-fns/getYear";
import { isAfter } from "date-fns/isAfter";
import { isBefore } from "date-fns/isBefore";
import { isSameDay } from "date-fns/isSameDay";
import { isSameMonth } from "date-fns/isSameMonth";
import { isToday } from "date-fns/isToday";
import { setMonth } from "date-fns/setMonth";
import { setYear } from "date-fns/setYear";
import { startOfDay } from "date-fns/startOfDay";
import { startOfMonth } from "date-fns/startOfMonth";
import { startOfWeek } from "date-fns/startOfWeek";
import { subDays } from "date-fns/subDays";
import { subMonths } from "date-fns/subMonths";
import { ko } from "date-fns/locale/ko";
import { Calendar, ChevronDown, ChevronLeft, ChevronRight, X } from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import styles from "./PcDatePicker.module.css";

export type PcDatePickerSize = "sm" | "md" | "lg";
type PanelMode = "days" | "months" | "years";

const WEEK_OPTS = { weekStartsOn: 0 as const };

function visibleDays(anchor: Date): Date[] {
  const ms = startOfMonth(anchor);
  const gridStart = startOfWeek(ms, WEEK_OPTS);
  return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
}

function clampDay(d: Date, minDate?: Date, maxDate?: Date): Date {
  let x = d;
  if (minDate && isBefore(startOfDay(x), startOfDay(minDate))) {
    x = startOfDay(minDate);
  }
  if (maxDate && isAfter(startOfDay(x), startOfDay(maxDate))) {
    x = startOfDay(maxDate);
  }
  return x;
}

function isDayDisabled(day: Date, minDate?: Date, maxDate?: Date): boolean {
  const t = startOfDay(day);
  if (minDate && isBefore(t, startOfDay(minDate))) return true;
  if (maxDate && isAfter(t, startOfDay(maxDate))) return true;
  return false;
}

const sizeClass: Record<PcDatePickerSize, string> = {
  sm: styles.sizeSm,
  md: styles.sizeMd,
  lg: styles.sizeLg,
};

export interface PcDatePickerProps {
  /** @example <PcDatePicker value={d} onChange={setD} label="일자" /> */
  value: Date | null;
  onChange: (date: Date | null) => void;
  placeholder?: string;
  label?: string;
  helperText?: string;
  error?: string;
  size?: PcDatePickerSize;
  disabled?: boolean;
  minDate?: Date;
  maxDate?: Date;
  format?: string;
  clearable?: boolean;
  fullWidth?: boolean;
  id?: string;
}

const MONTH_LABELS = Array.from({ length: 12 }, (_, m) =>
  format(new Date(2024, m, 15), "LLL", { locale: ko }),
);

export function PcDatePicker({
  value,
  onChange,
  placeholder = "날짜 선택",
  label,
  helperText,
  error,
  size = "md",
  disabled = false,
  minDate,
  maxDate,
  format: formatStr = "yyyy-MM-dd",
  clearable = true,
  fullWidth = false,
  id: idProp,
}: PcDatePickerProps) {
  const uid = useId();
  const triggerId = idProp ?? `pc-dp-${uid}`;
  const panelId = `${triggerId}-panel`;
  const helpId = `${triggerId}-help`;
  const errId = `${triggerId}-err`;
  const describedBy = error ? errId : helperText ? helpId : undefined;

  const [open, setOpen] = useState(false);
  const [panelMode, setPanelMode] = useState<PanelMode>("days");
  const [viewDate, setViewDate] = useState(() => value ?? new Date());
  const [cursorDate, setCursorDate] = useState<Date>(() => value ?? new Date());
  const [yearPageStart, setYearPageStart] = useState(() => getYear(value ?? new Date()) - 5);
  const [suffixHover, setSuffixHover] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) {
      const base = value ?? new Date();
      setViewDate(base);
      setCursorDate(clampDay(base, minDate, maxDate));
      setPanelMode("days");
      setYearPageStart(getYear(base) - 5);
    }
  }, [open, value, minDate, maxDate]);

  useLayoutEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => panelRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [open, panelMode]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: globalThis.MouseEvent) => {
      if (rootRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const displayText = useMemo(() => {
    if (!value) return null;
    return format(value, formatStr, { locale: ko });
  }, [value, formatStr]);

  const headerTitleDays = format(viewDate, "yyyy년 M월", { locale: ko });
  const headerTitleMonths = `${getYear(viewDate)}년`;
  const headerTitleYears = `${yearPageStart}–${yearPageStart + 11}`;

  const days = useMemo(() => visibleDays(viewDate), [viewDate]);

  const selectDay = useCallback(
    (d: Date) => {
      if (isDayDisabled(d, minDate, maxDate)) return;
      onChange(startOfDay(d));
      setOpen(false);
    },
    [minDate, maxDate, onChange],
  );

  const onToday = () => {
    const t = new Date();
    if (isDayDisabled(t, minDate, maxDate)) return;
    onChange(startOfDay(t));
    setOpen(false);
  };

  const onClear = (e: ReactMouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    onChange(null);
    setOpen(false);
  };

  const onKeyDownPanel = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
      return;
    }
    if (panelMode !== "days") return;

    if (e.key === "Enter") {
      e.preventDefault();
      selectDay(cursorDate);
      return;
    }

    let next = cursorDate;
    if (e.key === "ArrowLeft") next = subDays(cursorDate, 1);
    else if (e.key === "ArrowRight") next = addDays(cursorDate, 1);
    else if (e.key === "ArrowUp") next = subDays(cursorDate, 7);
    else if (e.key === "ArrowDown") next = addDays(cursorDate, 7);
    else if (e.key === "PageUp") next = subMonths(cursorDate, 1);
    else if (e.key === "PageDown") next = addMonths(cursorDate, 1);
    else if (e.key === "Home") next = startOfWeek(cursorDate, WEEK_OPTS);
    else if (e.key === "End") next = endOfWeek(cursorDate, WEEK_OPTS);
    else return;

    e.preventDefault();
    next = clampDay(next, minDate, maxDate);
    setCursorDate(next);
    if (!isSameMonth(next, viewDate)) {
      setViewDate(startOfMonth(next));
    }
  };

  const onTriggerKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setOpen((o) => !o);
    }
  };

  const yearButtons = useMemo(
    () => Array.from({ length: 12 }, (_, i) => yearPageStart + i),
    [yearPageStart],
  );

  return (
    <div
      ref={rootRef}
      className={[
        styles.wrap,
        fullWidth ? styles.wrapFullWidth : "",
        disabled ? styles.disabled : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {label ? (
        <label htmlFor={triggerId} className={styles.label}>
          {label}
        </label>
      ) : null}
      <div
        className={[
          styles.field,
          sizeClass[size],
          error ? styles.fieldError : "",
          open ? styles.fieldOpen : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <span className={styles.prefix} aria-hidden>
          <Calendar className={styles.prefixIcon} strokeWidth={2} />
        </span>
        <button
          ref={triggerRef}
          id={triggerId}
          type="button"
          role="button"
          className={styles.trigger}
          disabled={disabled}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={panelId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          onClick={() => !disabled && setOpen((o) => !o)}
          onKeyDown={onTriggerKeyDown}
        >
          <span
            className={[styles.triggerText, !displayText ? styles.placeholder : ""]
              .filter(Boolean)
              .join(" ")}
          >
            {displayText ?? placeholder}
          </span>
        </button>
        <span
          className={styles.suffix}
          onMouseEnter={() => setSuffixHover(true)}
          onMouseLeave={() => setSuffixHover(false)}
        >
          {value && clearable && suffixHover ? (
            <button
              type="button"
              className={styles.clearBtn}
              tabIndex={-1}
              aria-label="지우기"
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onClick={onClear}
            >
              <X className={styles.suffixIcon} strokeWidth={2} />
            </button>
          ) : (
            <ChevronDown className={styles.suffixIcon} aria-hidden strokeWidth={2} />
          )}
        </span>
      </div>

      {open && !disabled ? (
        <div
          ref={panelRef}
          id={panelId}
          role="dialog"
          aria-label="날짜 선택"
          className={styles.panel}
          tabIndex={-1}
          onKeyDown={onKeyDownPanel}
        >
          <div className={styles.panelHeader}>
            <button
              type="button"
              className={styles.navBtn}
              aria-label="이전"
              onClick={() => {
                if (panelMode === "days") setViewDate((d) => subMonths(d, 1));
                else if (panelMode === "months") setViewDate((d) => subMonths(d, 12));
                else setYearPageStart((y) => y - 12);
              }}
            >
              <ChevronLeft className={styles.navIcon} strokeWidth={2} />
            </button>
            <button
              type="button"
              className={styles.titleBtn}
              onClick={() => {
                if (panelMode === "days") setPanelMode("months");
                else if (panelMode === "months") setPanelMode("years");
                else setPanelMode("months");
              }}
            >
              {panelMode === "days" && headerTitleDays}
              {panelMode === "months" && headerTitleMonths}
              {panelMode === "years" && headerTitleYears}
            </button>
            <button
              type="button"
              className={styles.navBtn}
              aria-label="다음"
              onClick={() => {
                if (panelMode === "days") setViewDate((d) => addMonths(d, 1));
                else if (panelMode === "months") setViewDate((d) => addMonths(d, 12));
                else setYearPageStart((y) => y + 12);
              }}
            >
              <ChevronRight className={styles.navIcon} strokeWidth={2} />
            </button>
          </div>

          {panelMode === "days" ? (
            <>
              <div className={styles.weekRow} role="row">
                {["일", "월", "화", "수", "목", "금", "토"].map((w, i) => (
                  <div
                    key={w}
                    className={[
                      styles.weekCell,
                      i === 0 ? styles.weekCellSun : "",
                      i === 6 ? styles.weekCellSat : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    role="columnheader"
                  >
                    {w}
                  </div>
                ))}
              </div>
              <div className={styles.grid} role="grid">
                {days.map((day) => {
                  const other = !isSameMonth(day, viewDate);
                  const sel = value ? isSameDay(day, value) : false;
                  const today = isToday(day);
                  const muted = isDayDisabled(day, minDate, maxDate);
                  const kbdSel = isSameDay(day, cursorDate);
                  return (
                    <button
                      key={day.toISOString()}
                      type="button"
                      role="gridcell"
                      aria-selected={sel || undefined}
                      aria-disabled={muted || undefined}
                      disabled={muted}
                      className={[
                        styles.dayBtn,
                        other ? styles.dayBtnOther : "",
                        today ? styles.dayBtnToday : "",
                        sel ? styles.dayBtnSelected : "",
                        muted ? styles.dayBtnMuted : "",
                        kbdSel && !sel && !muted ? styles.dayBtnCursor : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => selectDay(day)}
                      onMouseEnter={() => !muted && setCursorDate(day)}
                    >
                      {format(day, "d", { locale: ko })}
                    </button>
                  );
                })}
              </div>
            </>
          ) : null}

          {panelMode === "months" ? (
            <div className={styles.monthGrid}>
              {MONTH_LABELS.map((lab, m) => (
                <button
                  key={lab}
                  type="button"
                  className={styles.monthBtn}
                  onClick={() => {
                    setViewDate(setMonth(viewDate, m));
                    setPanelMode("days");
                  }}
                >
                  {lab}
                </button>
              ))}
            </div>
          ) : null}

          {panelMode === "years" ? (
            <div className={styles.yearGrid}>
              {yearButtons.map((y) => (
                <button
                  key={y}
                  type="button"
                  className={styles.yearBtn}
                  onClick={() => {
                    setViewDate(setYear(viewDate, y));
                    setPanelMode("months");
                  }}
                >
                  {y}
                </button>
              ))}
            </div>
          ) : null}

          {panelMode === "days" ? (
            <div className={styles.footer}>
              <button type="button" className={styles.footerBtn} onClick={onToday}>
                오늘
              </button>
              {clearable && value ? (
                <button
                  type="button"
                  className={styles.footerBtn}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onChange(null);
                    setOpen(false);
                  }}
                >
                  지우기
                </button>
              ) : (
                <span />
              )}
            </div>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <p id={errId} className={styles.error} role="alert">
          {error}
        </p>
      ) : helperText ? (
        <p id={helpId} className={styles.helper}>
          {helperText}
        </p>
      ) : null}
    </div>
  );
}
