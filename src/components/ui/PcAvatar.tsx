"use client";

import type { ImgHTMLAttributes, MouseEventHandler } from "react";
import styles from "./PcAvatar.module.css";
import { hashPickChartIndex, initialsFromName } from "./avatarUtils";

const CHART_BG: readonly string[] = [
  "var(--pc-chart-1)",
  "var(--pc-chart-2)",
  "var(--pc-chart-3)",
  "var(--pc-chart-4)",
  "var(--pc-chart-5)",
  "var(--pc-chart-6)",
  "var(--pc-chart-7)",
  "var(--pc-chart-8)",
] as const;

export type PcAvatarSize = "sm" | "md" | "lg" | "xl";
export type PcAvatarShape = "rounded" | "circle";

export interface PcAvatarProps {
  /** @example <PcAvatar name="김목사" size="md" /> */
  src?: string;
  name: string;
  size?: PcAvatarSize;
  shape?: PcAvatarShape;
  className?: string;
  imgProps?: Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "className" | "alt">;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
}

const sizeClass: Record<PcAvatarSize, string> = {
  sm: styles.sizeSm,
  md: styles.sizeMd,
  lg: styles.sizeLg,
  xl: styles.sizeXl,
};

const shapeClass: Record<PcAvatarShape, string> = {
  rounded: styles.rounded,
  circle: styles.circle,
};

export function PcAvatar({
  src,
  name,
  size = "md",
  shape = "rounded",
  className = "",
  type = "button",
  imgProps,
  onClick,
  disabled,
}: PcAvatarProps) {
  const idx = hashPickChartIndex(name.trim() || "?");
  const bg = CHART_BG[idx];
  const label = initialsFromName(name);
  const baseClass = [
    styles.root,
    sizeClass[size],
    shapeClass[shape],
    onClick ? styles.button : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const inner =
    src && src.trim() ? (
      <img src={src} alt={name} className={styles.img} {...imgProps} />
    ) : (
      label
    );

  if (onClick) {
    return (
      <button
        type={type}
        className={baseClass}
        style={{ background: bg }}
        onClick={onClick}
        disabled={disabled}
        aria-label={name}
      >
        {inner}
      </button>
    );
  }

  return (
    <span
      className={baseClass}
      style={{ background: bg }}
      role="img"
      aria-label={name}
    >
      {inner}
    </span>
  );
}
