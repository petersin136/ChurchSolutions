"use client";

import type { CSSProperties, ReactNode } from "react";

export type PcModalShellProps = {
  open: boolean;
  onClose: () => void;
  /** Modal headline; empty string omits title text (close button only). */
  title?: ReactNode;
  /** Used when title is empty for dialog accessibility. */
  ariaLabel?: string;
  children: ReactNode;
  footer?: ReactNode;
  /** Passed to `.modal` as maxWidth (px). */
  maxWidth?: number;
  overlayClassName?: string;
  overlayStyle?: CSSProperties;
  modalClassName?: string;
  bodyClassName?: string;
  closeOnBackdrop?: boolean;
};

/**
 * Planning Center–style shell matching `Modals.tsx`: `.modal-bg.open` > `.modal`
 * (handle, head, body, optional foot). Uses global styles in `app/globals.css`.
 */
export function PcModalShell({
  open,
  onClose,
  title,
  ariaLabel = "대화상자",
  children,
  footer,
  maxWidth,
  overlayClassName = "",
  overlayStyle,
  modalClassName = "",
  bodyClassName,
  closeOnBackdrop = true,
}: PcModalShellProps) {
  if (!open) return null;

  const hasTitle = title != null && title !== "";

  return (
    <div
      className={`modal-bg open ${overlayClassName}`.trim()}
      style={overlayStyle}
      role="presentation"
      onMouseDown={(e) => {
        if (!closeOnBackdrop) return;
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`modal ${modalClassName}`.trim()}
        style={maxWidth != null ? { maxWidth } : undefined}
        role="dialog"
        aria-modal="true"
        aria-label={hasTitle ? undefined : ariaLabel}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="modal-handle" aria-hidden />
        <div className="modal-head">
          {hasTitle ? (
            typeof title === "string" ? (
              <h2>{title}</h2>
            ) : (
              <h2 style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {title}
              </h2>
            )
          ) : (
            <div style={{ flex: 1, minWidth: 0 }} aria-hidden />
          )}
          <button type="button" className="modal-x" onClick={onClose} aria-label="닫기">
            ✕
          </button>
        </div>
        <div className={["modal-body", bodyClassName].filter(Boolean).join(" ")}>{children}</div>
        {footer != null ? <div className="modal-foot">{footer}</div> : null}
      </div>
    </div>
  );
}
