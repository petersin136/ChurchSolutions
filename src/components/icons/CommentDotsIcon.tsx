"use client";

import type { CSSProperties } from "react";

type CommentDotsIconProps = {
  size?: number;
  color?: string;
  style?: CSSProperties;
  className?: string;
};

/**
 * 결석자 관리 연락 상태 아이콘.
 * 원본: Desktop/c. 출석부/comment-dots.svg (viewBox 0 0 24 24, path 그대로)
 */
export function CommentDotsIcon({
  size = 16,
  color = "currentColor",
  style,
  className,
}: CommentDotsIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={color}
      className={className}
      style={style}
      aria-hidden
    >
      <path d="m12,0C5.383,0,0,5.383,0,12s5.383,12,12,12h12v-12C24,5.383,18.617,0,12,0Zm10,22h-10c-5.514,0-10-4.486-10-10S6.486,2,12,2s10,4.486,10,10v10Zm-8.5-10c0,.828-.672,1.5-1.5,1.5s-1.5-.672-1.5-1.5.672-1.5,1.5-1.5,1.5.672,1.5,1.5Zm5,0c0,.828-.672,1.5-1.5,1.5s-1.5-.672-1.5-1.5.672-1.5,1.5-1.5,1.5.672,1.5,1.5Zm-10,0c0,.828-.672,1.5-1.5,1.5s-1.5-.672-1.5-1.5.672-1.5,1.5-1.5,1.5.672,1.5,1.5Z" />
    </svg>
  );
}
