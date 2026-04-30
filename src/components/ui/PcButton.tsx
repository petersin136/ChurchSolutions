"use client";

import {
  forwardRef,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";
import styles from "./PcButton.module.css";

export type PcButtonVariant =
  | "primary"
  | "secondary"
  | "danger"
  | "ghost"
  | "link";

export type PcButtonSize = "sm" | "md" | "lg";

export interface PcButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** @example <PcButton variant="primary">저장</PcButton> */
  variant?: PcButtonVariant;
  size?: PcButtonSize;
  loading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  fullWidth?: boolean;
}

const sizeClass: Record<PcButtonSize, string> = {
  sm: styles.sizeSm,
  md: styles.sizeMd,
  lg: styles.sizeLg,
};

const variantClass: Record<PcButtonVariant, string> = {
  primary: styles.primary,
  secondary: styles.secondary,
  danger: styles.danger,
  ghost: styles.ghost,
  link: styles.link,
};

const linkSizeClass: Record<PcButtonSize, string> = {
  sm: styles.linkSm,
  md: styles.linkMd,
  lg: styles.linkLg,
};

export const PcButton = forwardRef<HTMLButtonElement, PcButtonProps>(
  function PcButton(
    {
      variant = "primary",
      size = "md",
      loading = false,
      leftIcon,
      rightIcon,
      fullWidth = false,
      className = "",
      disabled,
      children,
      type = "button",
      ...rest
    },
    ref,
  ) {
    const isDisabled = Boolean(disabled || loading);
    const showLeft = loading ? (
      <span className={styles.spinner} aria-hidden />
    ) : (
      leftIcon
    );

    const sizeStyles =
      variant === "link" ? linkSizeClass[size] : sizeClass[size];

    return (
      <button
        ref={ref}
        type={type}
        className={[
          styles.root,
          sizeStyles,
          variantClass[variant],
          fullWidth ? styles.fullWidth : "",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
        disabled={isDisabled}
        aria-disabled={isDisabled || undefined}
        aria-busy={loading || undefined}
        {...rest}
        onClick={loading ? undefined : rest.onClick}
      >
        {showLeft}
        {children}
        {!loading && rightIcon}
      </button>
    );
  },
);
