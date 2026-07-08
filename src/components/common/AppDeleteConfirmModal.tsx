"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
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
  /**
   * viewport — 화면 중앙 (기본)
   * nested — 부모 모달 카드 안 중앙 (PcModalShell nestedOverlay 용)
   */
  placement?: "viewport" | "nested";
}

const DELETE_CONFIRM_WIDTH = 360;
const DELETE_CONFIRM_PAD = 24;
const DELETE_BTN_HEIGHT = 42;

function deleteConfirmOverlayStyle(
  zIndex: number,
  placement: "viewport" | "nested",
): CSSProperties {
  if (placement === "nested") {
    return {
      position: "absolute",
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

function DeleteConfirmDialog({
  onClose,
  onConfirm,
  description,
}: Pick<AppDeleteConfirmModalProps, "onClose" | "onConfirm" | "description">) {
  return (
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
  );
}

export function AppDeleteConfirmModal({
  open,
  onClose,
  onConfirm,
  description,
  zIndex = APP_MODAL.zIndex + 20,
  placement = "viewport",
}: AppDeleteConfirmModalProps) {
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

  if (!open) return null;
  if (placement === "viewport" && !mounted) return null;

  const overlay = (
    <div
      className="app-modal-overlay open"
      role="presentation"
      style={deleteConfirmOverlayStyle(zIndex, placement)}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <DeleteConfirmDialog onClose={onClose} onConfirm={onConfirm} description={description} />
    </div>
  );

  if (placement === "nested") return overlay;

  return createPortal(overlay, document.body);
}
