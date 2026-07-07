"use client";

import { useEffect, useLayoutEffect, useState, type CSSProperties, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle } from "lucide-react";
import {
  APP_MODAL,
  appModalBtnCancel,
  appModalBtnSubmit,
} from "@/styles/appModalTokens";

export interface AppDeleteConfirmModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  description: ReactNode;
  zIndex?: number;
  /** Parent modal card — when set, centers inside this element instead of the viewport */
  anchorRef?: RefObject<HTMLElement>;
}

const DELETE_CONFIRM_WIDTH = 360;
const DELETE_CONFIRM_PAD = 24;
const DELETE_BTN_HEIGHT = 42;

function deleteConfirmOverlayStyle(zIndex: number, anchorRect: DOMRect | null): CSSProperties {
  if (anchorRect) {
    return {
      position: "fixed",
      top: anchorRect.top,
      left: anchorRect.left,
      width: anchorRect.width,
      height: anchorRect.height,
      zIndex,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 16,
      boxSizing: "border-box",
      background: APP_MODAL.overlayBg,
      backdropFilter: "blur(6px)",
      WebkitBackdropFilter: "blur(6px)",
      borderRadius: APP_MODAL.radius,
      overflow: "hidden",
    };
  }

  return {
    position: "fixed",
    inset: 0,
    zIndex,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    boxSizing: "border-box",
    background: APP_MODAL.overlayBg,
    backdropFilter: "blur(6px)",
    WebkitBackdropFilter: "blur(6px)",
  };
}

function deleteConfirmCardStyle(): CSSProperties {
  return {
    width: DELETE_CONFIRM_WIDTH,
    maxWidth: "100%",
    padding: DELETE_CONFIRM_PAD,
    borderRadius: APP_MODAL.radius,
    background: APP_MODAL.cardBg,
    border: APP_MODAL.cardBorder,
    boxShadow: APP_MODAL.cardShadow,
    fontFamily: APP_MODAL.fontKR,
    boxSizing: "border-box",
    textAlign: "center",
    flexShrink: 0,
  };
}

function deleteConfirmBtnStyle(base: CSSProperties): CSSProperties {
  return {
    ...base,
    height: DELETE_BTN_HEIGHT,
    fontSize: 14,
  };
}

export function AppDeleteConfirmModal({
  open,
  onClose,
  onConfirm,
  description,
  zIndex = APP_MODAL.zIndex + 20,
  anchorRef,
}: AppDeleteConfirmModalProps) {
  const [mounted, setMounted] = useState(false);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useLayoutEffect(() => {
    if (!open || !anchorRef?.current) {
      setAnchorRect(null);
      return;
    }

    const el = anchorRef.current;
    const update = () => setAnchorRect(el.getBoundingClientRect());
    update();

    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
    ro?.observe(el);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);

    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, anchorRef]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className="app-modal-overlay open"
      role="presentation"
      style={deleteConfirmOverlayStyle(zIndex, anchorRect)}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="app-modal-card"
        role="alertdialog"
        aria-modal="true"
        aria-label="삭제 확인"
        style={deleteConfirmCardStyle()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
          <AlertTriangle size={28} strokeWidth={1.75} color={APP_MODAL.deleteRed} />
        </div>
        <h2
          style={{
            margin: "0 0 8px",
            fontSize: 17,
            fontWeight: APP_MODAL.titleWeight,
            color: APP_MODAL.ink,
            fontFamily: APP_MODAL.fontKR,
          }}
        >
          정말 삭제할까요?
        </h2>
        <p
          style={{
            margin: "0 0 20px",
            fontSize: 13,
            color: APP_MODAL.muted,
            lineHeight: 1.55,
            fontFamily: APP_MODAL.fontKR,
          }}
        >
          {description}
        </p>
        <div style={{ display: "flex", gap: APP_MODAL.btnGap }}>
          <button type="button" onClick={onClose} style={deleteConfirmBtnStyle(appModalBtnCancel)}>
            취소
          </button>
          <button
            type="button"
            onClick={onConfirm}
            style={deleteConfirmBtnStyle({ ...appModalBtnSubmit, background: APP_MODAL.deleteRed })}
          >
            삭제
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
