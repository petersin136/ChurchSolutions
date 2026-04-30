"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ChangeEvent,
  type Ref,
  type TextareaHTMLAttributes,
} from "react";
import styles from "./PcTextarea.module.css";

export type PcTextareaSize = "sm" | "md" | "lg";

export interface PcTextareaProps
  extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "size"> {
  /** @example <PcTextarea label="메모" rows={4} /> */
  label?: string;
  helperText?: string;
  error?: string;
  size?: PcTextareaSize;
  autoResize?: boolean;
  showCount?: boolean;
  fullWidth?: boolean;
}

const sizeClass: Record<PcTextareaSize, string> = {
  sm: styles.sizeSm,
  md: styles.sizeMd,
  lg: styles.sizeLg,
};

function assignRef<T>(ref: Ref<T> | undefined, node: T | null) {
  if (!ref) return;
  if (typeof ref === "function") ref(node);
  else (ref as { current: T | null }).current = node;
}

export const PcTextarea = forwardRef<HTMLTextAreaElement, PcTextareaProps>(
  function PcTextarea(
    {
      label,
      helperText,
      error,
      size = "md",
      autoResize = false,
      showCount = false,
      fullWidth = false,
      disabled,
      maxLength,
      className = "",
      id: idProp,
      value,
      defaultValue,
      onChange,
      ...rest
    },
    ref,
  ) {
    const uid = useId();
    const tid = idProp ?? `pc-textarea-${uid}`;
    const helpId = `${tid}-help`;
    const errId = `${tid}-err`;
    const describedBy = error ? errId : helperText ? helpId : undefined;
    const innerRef = useRef<HTMLTextAreaElement | null>(null);
    const isControlled = value !== undefined;
    const [uncontrolledLen, setUncontrolledLen] = useState(() =>
      defaultValue != null ? String(defaultValue).length : 0,
    );

    const setRefs = useCallback(
      (node: HTMLTextAreaElement | null) => {
        innerRef.current = node;
        assignRef(ref, node);
      },
      [ref],
    );

    const adjustHeight = useCallback(() => {
      const el = innerRef.current;
      if (!el || !autoResize) return;
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    }, [autoResize]);

    useLayoutEffect(() => {
      adjustHeight();
    }, [adjustHeight, value]);

    useEffect(() => {
      if (!autoResize) return;
      const el = innerRef.current;
      if (!el || typeof ResizeObserver === "undefined") return;
      const ro = new ResizeObserver(() => adjustHeight());
      ro.observe(el);
      return () => ro.disconnect();
    }, [autoResize, adjustHeight]);

    const controlledLen = isControlled ? String(value ?? "").length : uncontrolledLen;
    const ratio = maxLength && maxLength > 0 ? controlledLen / maxLength : 0;
    const countClass =
      ratio > 1 ? styles.countDanger : ratio > 0.9 ? styles.countWarn : styles.count;

    const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
      if (!isControlled) {
        setUncontrolledLen(e.target.value.length);
      }
      onChange?.(e);
      if (autoResize) {
        requestAnimationFrame(adjustHeight);
      }
    };

    return (
      <div
        className={[
          styles.wrap,
          fullWidth ? styles.wrapFullWidth : "",
          disabled ? styles.disabled : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {label ? (
          <label htmlFor={tid} className={styles.label}>
            {label}
          </label>
        ) : null}
        <div
          className={[
            styles.field,
            sizeClass[size],
            error ? styles.fieldError : "",
            showCount ? styles.fieldWithCount : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <textarea
            ref={setRefs}
            id={tid}
            className={[
              styles.textarea,
              autoResize ? styles.textareaAuto : "",
              className,
            ]
              .filter(Boolean)
              .join(" ")}
            disabled={disabled}
            maxLength={maxLength}
            value={value}
            defaultValue={defaultValue}
            onChange={handleChange}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            {...rest}
          />
          {showCount ? (
            <span className={[styles.countAbs, styles.count, countClass].join(" ")} aria-live="polite">
              {controlledLen}
              {maxLength != null ? ` / ${maxLength}` : ""}
            </span>
          ) : null}
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

PcTextarea.displayName = "PcTextarea";
