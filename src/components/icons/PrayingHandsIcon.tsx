"use client";

import type { CSSProperties } from "react";

type PrayingHandsIconProps = {
  size?: number;
  strokeWidth?: number;
  color?: string;
  style?: CSSProperties;
  className?: string;
};

/**
 * 기도/메모 사이드바 아이콘 — Lucide 라인 톤 합장 손(손가락 + 양손 + 소매).
 */
export function PrayingHandsIcon({
  size = 24,
  strokeWidth = 2,
  color = "currentColor",
  style,
  className,
}: PrayingHandsIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden
    >
      {/* 손가락 — 가운데로 모임 */}
      <path d="M8.5 8.2V5.4" />
      <path d="M10.4 7.6V4.6" />
      <path d="M12 7.2V3.8" />
      <path d="M13.6 7.6V4.6" />
      <path d="M15.5 8.2V5.4" />
      {/* 왼손 + 소매 */}
      <path d="M8.5 8.2c-1.6 1.8-2.4 4.2-2.4 7" />
      <path d="M6.1 15.2h3v4.8h-3z" />
      {/* 오른손 + 소매 */}
      <path d="M15.5 8.2c1.6 1.8 2.4 4.2 2.4 7" />
      <path d="M14.9 15.2h3v4.8h-3z" />
    </svg>
  );
}
