"use client";

import { X } from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  type MouseEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import styles from "./PcModal.module.css";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

function isVisible(el: HTMLElement): boolean {
  return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
}

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) => isVisible(el),
  );
}

export type PcModalSize = "sm" | "md" | "lg" | "xl" | "full";

export interface PcModalProps {
  /** @example <PcModal open={open} onClose={() => setOpen(false)} title="알림">내용</PcModal> */
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  size?: PcModalSize;
  footer?: ReactNode;
  hideCloseButton?: boolean;
  closeOnOverlayClick?: boolean;
  closeOnEsc?: boolean;
  children: ReactNode;
}

const sizeClass: Record<PcModalSize, string> = {
  sm: styles.sizeSm,
  md: styles.sizeMd,
  lg: styles.sizeLg,
  xl: styles.sizeXl,
  full: styles.sizeFull,
};

export function PcModal({
  open,
  onClose,
  title,
  description,
  size = "md",
  footer,
  hideCloseButton = false,
  closeOnOverlayClick = true,
  closeOnEsc = true,
  children,
}: PcModalProps) {
  const reactId = useId();
  const titleId = `${reactId}-title`;
  const descId = `${reactId}-desc`;
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<Element | null>(null);
  const prevBodyOverflow = useRef<string | null>(null);

  const showClose = !hideCloseButton;
  const showHeader = Boolean(title || description || showClose);
  const dialogAriaLabel = title ? undefined : "대화상자";

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  useLayoutEffect(() => {
    if (!open || typeof window === "undefined") return;

    previouslyFocused.current = document.activeElement;
    prevBodyOverflow.current = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const root = panelRef.current;
    if (root) {
      const list = getFocusableElements(root);
      if (list.length > 0) {
        list[0].focus();
      } else {
        root.focus();
      }
    }

    return () => {
      document.body.style.overflow = prevBodyOverflow.current ?? "";
      const prev = previouslyFocused.current;
      if (prev instanceof HTMLElement && document.contains(prev)) {
        prev.focus();
      }
    };
  }, [open]);

  useEffect(() => {
    if (!open || !closeOnEsc || typeof window === "undefined") return;
    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        handleClose();
      }
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [open, closeOnEsc, handleClose]);

  useEffect(() => {
    if (!open || typeof window === "undefined") return;
    const onTab = (e: globalThis.KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const root = panelRef.current;
      if (!root) return;
      const list = getFocusableElements(root);
      if (list.length === 0) {
        e.preventDefault();
        root.focus();
        return;
      }
      if (list.length === 1) {
        e.preventDefault();
        list[0].focus();
        return;
      }
      const first = list[0];
      const last = list[list.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey) {
        if (active === first || !root.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else if (active === last || !root.contains(active)) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onTab, true);
    return () => document.removeEventListener("keydown", onTab, true);
  }, [open]);

  if (typeof window === "undefined" || !open) {
    return null;
  }

  const onOverlayMouseDown = (e: MouseEvent<HTMLDivElement>) => {
    if (!closeOnOverlayClick) return;
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  return createPortal(
    <div className={styles.overlay} role="presentation" onMouseDown={onOverlayMouseDown}>
      <div
        ref={panelRef}
        className={[styles.panel, sizeClass[size]].filter(Boolean).join(" ")}
        role="dialog"
        aria-modal="true"
        aria-label={dialogAriaLabel}
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {showHeader ? (
          <header className={styles.header}>
            <div className={styles.headerMain}>
              {title ? (
                <h2 id={titleId} className={styles.title}>
                  {title}
                </h2>
              ) : null}
              {description ? (
                <p
                  id={descId}
                  className={[styles.description, !title ? styles.descriptionOnly : ""]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {description}
                </p>
              ) : null}
            </div>
            {showClose ? (
              <button
                type="button"
                className={styles.closeBtn}
                onClick={handleClose}
                aria-label="닫기"
              >
                <X className={styles.closeIcon} aria-hidden strokeWidth={2} />
              </button>
            ) : null}
          </header>
        ) : null}
        <div className={styles.body}>{children}</div>
        {footer ? <footer className={styles.footer}>{footer}</footer> : null}
      </div>
    </div>,
    document.body,
  );
}
