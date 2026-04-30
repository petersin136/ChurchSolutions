"use client";

import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";
import styles from "./PcInput.module.css";

export type PcInputSize = "sm" | "md" | "lg";

export interface PcInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "size" | "prefix" | "suffix"> {
  /** @example <PcInput label="이름" placeholder="홍길동" /> */
  label?: string;
  helperText?: string;
  error?: string;
  prefix?: ReactNode;
  suffix?: ReactNode;
  size?: PcInputSize;
}

const sizeClass: Record<PcInputSize, string> = {
  sm: styles.sizeSm,
  md: styles.sizeMd,
  lg: styles.sizeLg,
};

export const PcInput = forwardRef<HTMLInputElement, PcInputProps>(
  function PcInput(
    {
      label,
      helperText,
      error,
      prefix,
      suffix,
      size = "md",
      className = "",
      disabled,
      id,
      ...rest
    },
    ref
  ) {
    const uid = useId();
    const inputId = id ?? (rest.name ? String(rest.name) : `pc-input-${uid}`);
    const helpId = `${inputId}-help`;
    const errId = `${inputId}-err`;
    const describedBy = error ? errId : helperText ? helpId : undefined;

    return (
      <div className={`${styles.wrap} ${disabled ? styles.disabled : ""}`}>
        {label ? (
          <label htmlFor={inputId} className={styles.label}>
            {label}
          </label>
        ) : null}
        <div
          className={`${styles.field} ${sizeClass[size]} ${error ? styles.fieldError : ""}`}
        >
          {prefix ? <span className={styles.affix}>{prefix}</span> : null}
          <input
            ref={ref}
            id={inputId}
            className={`${styles.input} ${className}`.trim()}
            disabled={disabled}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            {...rest}
          />
          {suffix ? <span className={styles.affix}>{suffix}</span> : null}
        </div>
        {error ? (
          <p id={errId} className={styles.error} role="alert">
            {error}
          </p>
        ) : helperText ? (
          <p id={helpId} className={styles.helper}>
            {helperText}
          </p>
        ) : null}
      </div>
    );
  },
);

PcInput.displayName = "PcInput";
