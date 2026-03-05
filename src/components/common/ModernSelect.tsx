"use client";

import React, { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";

const SURFACE = "#FFFFFF";
const TEXT = "#1C1C1E";
const TEXT_MUTED = "#8E8E93";
const BORDER = "rgba(60,60,67,0.15)";
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
}: ModernSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

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
        <label htmlFor={id} style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#1b2a4a", marginBottom: 6 }}>
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
          padding: "10px 40px 10px 14px",
          fontSize: 14,
          lineHeight: 1.4,
          fontFamily: "inherit",
          color: value ? TEXT : TEXT_MUTED,
          background: SURFACE,
          border: `1px solid ${BORDER}`,
          borderRadius: RADIUS,
          cursor: disabled ? "not-allowed" : "pointer",
          outline: "none",
          transition: "border-color 0.2s, box-shadow 0.2s",
          opacity: disabled ? 0.6 : 1,
        }}
      >
        <span style={{ textAlign: "left", whiteSpace: "nowrap" }}>{display}</span>
        <ChevronDown
          size={16}
          style={{
            position: "absolute",
            right: 12,
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
            borderRadius: RADIUS,
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
                padding: "10px 14px",
                fontSize: 14,
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
