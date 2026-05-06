"use client";

import React, { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";

const SURFACE = "#FFFFFF";
const TEXT = "#1C1C1E";
const TEXT_MUTED = "#8E8E93";
const BORDER = "#c7d2e8";
const BORDER_FOCUS = "#007AFF";
const BLUE_LIGHT = "#E8F2FF";
const RADIUS = 8;

export interface ModernSelectOption {
  value: string;
  label: string;
}

export interface ModernSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: ModernSelectOption[];
  label?: string;
  disabled?: boolean;
  placeholder?: string;
  id?: string;
  style?: React.CSSProperties;
  className?: string;
  /** 모바일 필터용: 낮은 높이·작은 글자 */
  compact?: boolean;
  /** compact와 함께: 높이 28px, radius 6, 좌우 패딩 좁게 (52주 출석 필터 등) */
  uniform28?: boolean;
  /** compact와 함께: 높이 30px, 12px 글자, radius 6, padding 0 8px (52주 출석 필터 등) */
  uniform30?: boolean;
  /** compact와 함께: 높이 32px, 보고서 필터 행(날짜 트리거와 동일) */
  uniform32?: boolean;
}

export function ModernSelect({
  value,
  onChange,
  options,
  label,
  disabled,
  placeholder = "선택",
  id,
  style,
  className,
  compact = false,
  uniform28 = false,
  uniform30 = false,
  uniform32 = false,
}: ModernSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const u32 = compact && uniform32 && !uniform30 && !uniform28;
  const u30 = compact && uniform30 && !u32;
  const u28 = compact && uniform28 && !u30 && !u32;
  const FILTER_BORDER = "#e2e5ef";
  const pad = u32 || u30 ? "0 26px 0 8px" : u28 ? "0 22px 0 6px" : compact ? "4px 28px 4px 8px" : "10px 40px 10px 14px";
  const fs = u32 ? 11 : u30 ? 12 : compact ? 11 : 14;
  const br = u32 || u30 || u28 ? 6 : compact ? 4 : RADIUS;
  const chev = u32 || u30 ? 15 : compact ? 14 : 16;
  const chevRight = u32 || u30 ? 8 : u28 ? 6 : compact ? 8 : 12;
  const optPad = u30 || compact ? "8px 10px" : "10px 14px";
  const optFs = u30 ? 12 : compact ? 12 : 14;

  const selected = options.find((o) => o.value === value);
  const display = selected?.label ?? placeholder;

  useEffect(() => {
    if (!open) return;
    const onOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, [open]);

  return (
    <div ref={ref} style={{ marginBottom: label ? 16 : 0, position: "relative", ...style }} className={className}>
      {label && (
        <label htmlFor={id} style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--color-primary)", marginBottom: 6 }}>
          {label}
        </label>
      )}
      <button
        type="button"
        id={id}
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        style={{
          position: "relative",
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: pad,
          minHeight: compact ? (u32 ? 32 : u30 ? 30 : 28) : undefined,
          height: u32 ? 32 : u30 ? 30 : u28 ? 28 : undefined,
          boxSizing: u32 || u30 || u28 ? "border-box" : undefined,
          fontSize: fs,
          lineHeight: 1.4,
          fontFamily: "inherit",
          color: value ? TEXT : TEXT_MUTED,
          background: SURFACE,
          border: u32 || u30 ? `1px solid ${FILTER_BORDER}` : `1px solid ${BORDER}`,
          borderRadius: br,
          cursor: disabled ? "not-allowed" : "pointer",
          outline: "none",
          transition: "border-color 0.2s, box-shadow 0.2s",
          opacity: disabled ? 0.6 : 1,
        }}
      >
        <span
          style={{
            textAlign: "left",
            whiteSpace: "nowrap",
            ...(u28 || u30 || u32
              ? { flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }
              : {}),
          }}
        >
          {display}
        </span>
        <ChevronDown
          size={chev}
          style={{
            position: "absolute",
            right: chevRight,
            top: "50%",
            transform: open ? "translateY(-50%) rotate(180deg)" : "translateY(-50%)",
            transition: "transform 0.2s",
            color: TEXT_MUTED,
            pointerEvents: "none",
          }}
        />
      </button>
      {open && (
        <div
          role="listbox"
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: "100%",
            marginTop: 4,
            background: SURFACE,
            border: `1px solid ${BORDER}`,
            borderRadius: br,
            boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
            zIndex: 1000,
            maxHeight: 260,
            overflowY: "auto",
          }}
        >
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              role="option"
              aria-selected={o.value === value}
              onClick={() => {
                onChange(o.value);
                setOpen(false);
              }}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: optPad,
                fontSize: optFs,
                fontFamily: "inherit",
                color: TEXT,
                background: o.value === value ? BLUE_LIGHT : "transparent",
                border: "none",
                cursor: "pointer",
                textAlign: "left",
                transition: "background 0.1s",
              }}
              onMouseEnter={(e) => {
                if (o.value !== value) e.currentTarget.style.background = "rgba(0,0,0,0.04)";
              }}
              onMouseLeave={(e) => {
                if (o.value !== value) e.currentTarget.style.background = "transparent";
              }}
            >
              {o.value === value && (
                <span style={{ color: BORDER_FOCUS, fontWeight: 700, flexShrink: 0 }}>✓</span>
              )}
              <span style={{ whiteSpace: "nowrap" }}>{o.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
