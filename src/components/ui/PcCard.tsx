import type { HTMLAttributes, ReactNode } from "react";
import styles from "./PcCard.module.css";

export type PcCardPadding = "sm" | "md" | "lg";
export type PcCardElevation = "none" | "sm" | "md";

export interface PcCardProps extends HTMLAttributes<HTMLDivElement> {
  /** @example <PcCard title="요약" actions={<PcButton size="sm">추가</PcButton>}>…</PcCard> */
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  padding?: PcCardPadding;
  elevation?: PcCardElevation;
  /** 제목이 있을 때 헤더 하단 구분선 (기본 true) */
  divider?: boolean;
  children?: ReactNode;
}

const paddingClass: Record<PcCardPadding, string> = {
  sm: styles.paddingSm,
  md: styles.paddingMd,
  lg: styles.paddingLg,
};

const elevationClass: Record<PcCardElevation, string> = {
  none: styles.elevationNone,
  sm: styles.elevationSm,
  md: styles.elevationMd,
};

export function PcCard({
  title,
  subtitle,
  actions,
  padding = "md",
  elevation = "sm",
  divider,
  className = "",
  children,
  ...rest
}: PcCardProps) {
  const showHeader = Boolean(title || subtitle || actions);
  const showDivider =
    (divider ?? Boolean(title)) && showHeader && Boolean(children);

  return (
    <div
      className={[styles.root, paddingClass[padding], elevationClass[elevation], className]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    >
      {showHeader && (
        <header
          className={[styles.header, !children ? styles.headerNoBody : ""]
            .filter(Boolean)
            .join(" ")}
        >
          <div className={styles.titleBlock}>
            {title ? <h3 className={styles.title}>{title}</h3> : null}
            {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}
          </div>
          {actions ? <div className={styles.actions}>{actions}</div> : null}
        </header>
      )}
      {showDivider ? <hr className={styles.divider} /> : null}
      {children ? <div className={styles.body}>{children}</div> : null}
    </div>
  );
}
