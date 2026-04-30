"use client";
import React from "react";
import styles from "./PcStatCard.module.css";

export type PcStatCardTone = "orange" | "green" | "pink" | "yellow" | "blue" | "gray";
export type PcStatCardSize = "default" | "compact" | "dense";

export interface PcStatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  tone?: PcStatCardTone;
  icon?: React.ReactNode;
  size?: PcStatCardSize;
  trend?: { direction: "up" | "down" | "flat"; text: string };
  onClick?: () => void;
  className?: string;
}

export function PcStatCard({
  label,
  value,
  sub,
  tone = "blue",
  icon,
  size = "default",
  trend,
  onClick,
  className,
}: PcStatCardProps) {
  const classes = [
    styles.card,
    styles[`size-${size}`],
    onClick ? styles.clickable : "",
    className || "",
  ].filter(Boolean).join(" ");

  return (
    <div
      className={classes}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <div className={styles.header}>
        {icon && (
          <div className={`${styles.iconBox} ${styles[`tone-${tone}`]}`}>
            {icon}
          </div>
        )}
        <span className={styles.label}>{label}</span>
      </div>
      <div className={styles.value}>{value}</div>
      {(sub || trend) && (
        <div className={styles.footer}>
          {trend && (
            <span className={`${styles.trend} ${styles[`trend-${trend.direction}`]}`}>
              {trend.direction === "up" ? "▲" : trend.direction === "down" ? "▼" : "—"} {trend.text}
            </span>
          )}
          {sub && <span className={styles.sub}>{sub}</span>}
        </div>
      )}
    </div>
  );
}
