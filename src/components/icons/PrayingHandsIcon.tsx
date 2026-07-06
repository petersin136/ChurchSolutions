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
 * 기도/메모 사이드바 아이콘 — 합장한 양손 실루엣 (Lucide 라인 톤).
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
      {/* 양손 외곽 — 위로 모인 손가락 + 아래로 벌어진 소매 */}
      <path d="M10.4 5.6Q12 3.6 13.6 5.6L15 7.2C16.4 8.8 17 10.8 17 13.2L18.2 18.8H15.2L14.4 14.2C13.9 11.6 13.1 9.6 12 8.4C10.9 9.6 10.1 11.6 9.6 14.2L8.8 18.8H5.8L7 13.2C7 10.8 7.6 8.8 9 7.2L10.4 5.6Z" />
      {/* 손가락 구분선 */}
      <path d="M11 5.8V7.6" />
      <path d="M12 5.2V8" />
      <path d="M13 5.8V7.6" />
    </svg>
  );
}
