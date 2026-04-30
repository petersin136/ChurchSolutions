"use client";

import { AlertTriangle, CheckCircle, Info, X, XCircle } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import styles from "./PcToast.module.css";
import type { PcToastVariant } from "./pcToastTypes";

export interface PcToastProps {
  variant: PcToastVariant;
  title: string;
  description?: string;
  durationMs: number;
  exiting?: boolean;
  onDismiss: () => void;
}

const borderClass: Record<PcToastVariant, string> = {
  success: styles.borderSuccess,
  error: styles.borderError,
  info: styles.borderInfo,
  warning: styles.borderWarning,
};

const iconMap: Record<PcToastVariant, ReactNode> = {
  success: <CheckCircle className={styles.icon} aria-hidden strokeWidth={2} />,
  error: <XCircle className={styles.icon} aria-hidden strokeWidth={2} />,
  info: <Info className={styles.icon} aria-hidden strokeWidth={2} />,
  warning: <AlertTriangle className={styles.icon} aria-hidden strokeWidth={2} />,
};

export function PcToast({ variant, title, description, durationMs, exiting, onDismiss }: PcToastProps) {
  const [paused, setPaused] = useState(false);
  const remainRef = useRef(durationMs);
  const tickStartRef = useRef(Date.now());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearT = () => {
    if (timerRef.current != null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const arm = () => {
    clearT();
    if (durationMs === 0 || remainRef.current <= 0) return;
    tickStartRef.current = Date.now();
    timerRef.current = setTimeout(onDismiss, remainRef.current);
  };

  useEffect(() => {
    remainRef.current = durationMs;
  }, [durationMs]);

  useEffect(() => {
    if (exiting) {
      clearT();
    }
  }, [exiting]);

  useEffect(() => {
    if (durationMs === 0) return;
    if (paused) {
      clearT();
      const elapsed = Date.now() - tickStartRef.current;
      remainRef.current = Math.max(0, remainRef.current - elapsed);
      return;
    }
    arm();
    return clearT;
  }, [paused, durationMs, onDismiss]);

  return (
    <div
      className={[
        styles.root,
        borderClass[variant],
        exiting ? styles.rootExiting : "",
      ]
        .filter(Boolean)
        .join(" ")}
      role="status"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {iconMap[variant]}
      <div className={styles.body}>
        <p className={styles.title}>{title}</p>
        {description ? <p className={styles.desc}>{description}</p> : null}
      </div>
      <button type="button" className={styles.close} aria-label="닫기" onClick={onDismiss}>
        <X className={styles.closeIcon} strokeWidth={2} />
      </button>
    </div>
  );
}
