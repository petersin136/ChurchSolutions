"use client";

import React from "react";
import { tokens } from "@/styles/tokens";

export interface SegmentItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
}

export interface SegmentedControlProps {
  items: SegmentItem[];
  value: string;
  onChange: (id: string) => void;
  columns?: number;
  size?: "sm" | "md";
  fullWidth?: boolean;
}

export default function SegmentedControl({
  items, value, onChange, columns, size = "md", fullWidth = false,
}: SegmentedControlProps) {
  const isGrid = columns != null && columns > 0;
  const c = isGrid ? columns! : 0;
  const n = items.length;
  const rem = isGrid ? n % c : 0;
  const lastRowCount = isGrid ? (rem === 0 ? c : rem) : 0;
  /** 마지막 행에 버튼이 1개만 있을 때(예: 5개·2열 → 3행 단독) 전체 너비 */
  const loneLastRow = isGrid && lastRowCount === 1 && n > 0;
  const sm = size === "sm";

  const btnStyle = (active: boolean): React.CSSProperties => ({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    padding: sm ? "4px 6px" : "6px 14px",
    ...(isGrid && sm
      ? {
          width: "100%",
          maxWidth: "100%",
          minHeight: 28,
          alignSelf: "stretch",
        }
      : {
          height: sm ? tokens.height.mobileSegment : tokens.height.desktopSegment,
        }),
    borderRadius: tokens.radius.pill,
    fontSize: sm ? 10 : 13,
    fontWeight: active ? 600 : 500,
    border: "none",
    background: active ? tokens.color.navy : tokens.color.bg,
    color: active ? "#fff" : tokens.color.sub,
    cursor: "pointer",
    fontFamily: "inherit",
    transition: "background 0.15s, color 0.15s",
    whiteSpace: "nowrap",
    minWidth: 0,
    boxSizing: "border-box",
    lineHeight: 1.2,
    ...(isGrid
      ? {
          whiteSpace: "normal" as const,
          lineHeight: 1.25,
          textAlign: "center" as const,
        }
      : {}),
  });

  return (
    <div style={{
      display: isGrid ? "grid" : "flex",
      ...(isGrid
        ? { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, alignItems: "stretch" as const, justifyItems: "stretch" as const }
        : { flexWrap: "wrap" as const }),
      gap: sm ? 4 : 6,
      width: fullWidth ? "100%" : undefined,
      minWidth: 0,
    }}>
      {items.map((item, index) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onChange(item.id)}
          style={{
            ...btnStyle(value === item.id),
            ...(isGrid && loneLastRow && index === n - 1 ? { gridColumn: "1 / -1" as const } : {}),
          }}
        >
          {item.icon && React.isValidElement(item.icon)
            ? (() => {
                const el = item.icon as React.ReactElement<{ size?: number; style?: React.CSSProperties }>;
                const s = sm ? 11 : 14;
                return React.cloneElement(el, {
                  size: el.props.size ?? s,
                  style: { ...el.props.style, width: s, height: s },
                });
              })()
            : item.icon}
          {item.label}
        </button>
      ))}
    </div>
  );
}
