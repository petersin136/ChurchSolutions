import type { HTMLAttributes, ReactNode } from "react";
import styles from "./PcBadge.module.css";

export type PcBadgeVariant =
  | "blue"
  | "green"
  | "yellow"
  | "red"
  | "purple"
  | "teal"
  | "gray";

export type PcBadgeSize = "sm" | "md";

export interface PcBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  /** @example <PcBadge variant="blue">새가족</PcBadge> */
  variant?: PcBadgeVariant;
  size?: PcBadgeSize;
  children: ReactNode;
}

const variantClass: Record<PcBadgeVariant, string> = {
  blue: styles.blue,
  green: styles.green,
  yellow: styles.yellow,
  red: styles.red,
  purple: styles.purple,
  teal: styles.teal,
  gray: styles.gray,
};

const sizeClass: Record<PcBadgeSize, string> = {
  sm: styles.sizeSm,
  md: styles.sizeMd,
};

export function PcBadge({
  variant = "gray",
  size = "md",
  className = "",
  children,
  ...rest
}: PcBadgeProps) {
  return (
    <span
      className={[styles.root, sizeClass[size], variantClass[variant], className]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    >
      {children}
    </span>
  );
}
