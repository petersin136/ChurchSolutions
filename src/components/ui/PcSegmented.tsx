"use client";

import {
  useLayoutEffect,
  useRef,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import styles from "./PcSegmented.module.css";

export interface PcSegmentedOption {
  value: string;
  label: ReactNode;
  icon?: ReactNode;
  disabled?: boolean;
}

export interface PcSegmentedProps {
  value: string;
  onChange: (value: string) => void;
  options: PcSegmentedOption[];
  size?: "sm" | "md" | "lg";
  fullWidth?: boolean;
  ariaLabel?: string;
}

export function PcSegmented({
  value,
  onChange,
  options,
  size = "md",
  fullWidth = false,
  ariaLabel,
}: PcSegmentedProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const focusAfterKb = useRef(false);

  useLayoutEffect(() => {
    if (!focusAfterKb.current) return;
    focusAfterKb.current = false;
    const el = rootRef.current?.querySelector<HTMLButtonElement>(
      'button[role="radio"][aria-checked="true"]',
    );
    el?.focus();
  }, [value]);

  const sizeClass =
    size === "sm" ? styles.optionSm : size === "lg" ? styles.optionLg : styles.optionMd;

  const rootClass = [styles.root, fullWidth ? styles.rootFullWidth : ""]
    .filter(Boolean)
    .join(" ");

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;

    const enabled = options.filter((o) => !o.disabled);
    if (enabled.length === 0) return;

    let idx = enabled.findIndex((o) => o.value === value);
    if (idx < 0) idx = 0;

    e.preventDefault();
    const delta = e.key === "ArrowRight" ? 1 : -1;
    const next = enabled[(idx + delta + enabled.length) % enabled.length];
    if (!next) return;

    focusAfterKb.current = true;
    onChange(next.value);
  };

  return (
    <div
      ref={rootRef}
      role="radiogroup"
      aria-label={ariaLabel}
      className={rootClass}
      onKeyDown={handleKeyDown}
    >
      {options.map((opt) => {
        const active = value === opt.value;
        const optClass = [
          styles.option,
          sizeClass,
          fullWidth ? styles.optionFullWidth : "",
          active ? styles.optionActive : "",
        ]
          .filter(Boolean)
          .join(" ");

        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            className={optClass}
            disabled={opt.disabled}
            onClick={() => {
              if (!opt.disabled) onChange(opt.value);
            }}
          >
            {opt.icon ? <span className={styles.icon}>{opt.icon}</span> : null}
            <span>{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
