"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import {
  APP_MODAL,
  appModalCardStyle,
  appModalOverlayStyle,
} from "@/styles/appModalTokens";

export type PcModalShellProps = {
  open: boolean;
  onClose: () => void;
  /** Modal headline; empty string omits title text (close button only). */
  title?: ReactNode;
  /** Used when title is empty for dialog accessibility. */
  ariaLabel?: string;
  children: ReactNode;
  footer?: ReactNode;
  /** Card width in px. Default {@link APP_MODAL.width} */
  maxWidth?: number;
  width?: number;
  /** Fixed card height (tall forms / wizards) */
  height?: number;
  overlayClassName?: string;
  overlayStyle?: CSSProperties;
  modalClassName?: string;
  bodyClassName?: string;
  closeOnBackdrop?: boolean;
  zIndex?: number;
};

/**
 * 앱 공통 모달 — 위치·크기·디자인 통일 (portal + appModalTokens)
 */
export function PcModalShell({
  open,
  onClose,
  title,
  ariaLabel = "대화상자",
  children,
  footer,
  maxWidth,
  width,
  height,
  overlayClassName = "",
  overlayStyle,
  modalClassName = "",
  bodyClassName,
  closeOnBackdrop = true,
  zIndex,
}: PcModalShellProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open || !mounted) return null;

  const hasTitle = title != null && title !== "";
  const cardWidth = width ?? maxWidth ?? APP_MODAL.width;

  return createPortal(
    <div
      className={`app-modal-overlay open ${overlayClassName}`.trim()}
      style={{ ...appModalOverlayStyle, ...overlayStyle, zIndex: zIndex ?? APP_MODAL.zIndex }}
      role="presentation"
      onMouseDown={(e) => {
        if (!closeOnBackdrop) return;
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`app-modal-card ${modalClassName}`.trim()}
        style={appModalCardStyle({ width: cardWidth, height })}
        role="dialog"
        aria-modal="true"
        aria-label={hasTitle ? undefined : ariaLabel}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 12,
            marginBottom: footer != null ? 16 : 0,
            paddingBottom: hasTitle || !footer ? 16 : 0,
            borderBottom: hasTitle || footer != null ? "1px solid rgba(0,0,0,0.06)" : "none",
            flexShrink: 0,
          }}
        >
          {hasTitle ? (
            typeof title === "string" ? (
              <h2
                style={{
                  margin: 0,
                  fontSize: APP_MODAL.titleSize,
                  fontWeight: APP_MODAL.titleWeight,
                  color: APP_MODAL.ink,
                  fontFamily: APP_MODAL.fontKR,
                  lineHeight: 1.35,
                  flex: 1,
                  minWidth: 0,
                }}
              >
                {title}
              </h2>
            ) : (
              <h2
                style={{
                  margin: 0,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: APP_MODAL.titleSize,
                  fontWeight: APP_MODAL.titleWeight,
                  color: APP_MODAL.ink,
                  fontFamily: APP_MODAL.fontKR,
                  flex: 1,
                  minWidth: 0,
                }}
              >
                {title}
              </h2>
            )
          ) : (
            <div style={{ flex: 1, minWidth: 0 }} aria-hidden />
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            style={{
              width: 32,
              height: 32,
              marginTop: -4,
              border: "none",
              background: "transparent",
              borderRadius: 8,
              cursor: "pointer",
              color: APP_MODAL.labelMuted,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <X size={20} strokeWidth={2} />
          </button>
        </div>

        <div
          className={bodyClassName}
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            WebkitOverflowScrolling: "touch",
          }}
        >
          {children}
        </div>

        {footer != null ? (
          <div
            style={{
              flexShrink: 0,
              marginTop: 16,
              paddingTop: 16,
              borderTop: "1px solid rgba(0,0,0,0.06)",
            }}
          >
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
