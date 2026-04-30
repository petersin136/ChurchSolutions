import type { ReactNode } from "react";
import styles from "./PcEmptyState.module.css";

export interface PcEmptyStateProps {
  /** @example <PcEmptyState title="데이터 없음" description="항목을 추가하세요." action={<PcButton>추가</PcButton>} /> */
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function PcEmptyState({
  icon,
  title,
  description,
  action,
}: PcEmptyStateProps) {
  return (
    <div className={styles.root}>
      {icon ? <div className={styles.iconWrap}>{icon}</div> : null}
      <h3 className={styles.title}>{title}</h3>
      {description ? (
        <p className={styles.description}>{description}</p>
      ) : null}
      {action ? <div className={styles.action}>{action}</div> : null}
    </div>
  );
}
