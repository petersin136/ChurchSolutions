"use client";

import { useCallback, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { PcButton } from "./PcButton";
import { PcModal } from "./PcModal";

export type PcConfirmDialogVariant = "default" | "danger";

export interface PcConfirmDialogProps {
  /** @example <PcConfirmDialog open={o} onClose={...} onConfirm={...} title="삭제?" message="복구할 수 없습니다." /> */
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  message?: string | ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: PcConfirmDialogVariant;
  loading?: boolean;
}

const messageTextStyle: CSSProperties = {
  margin: 0,
  color: "var(--pc-text-sub)",
  fontSize: "var(--pc-text-sm)",
};

export function PcConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "확인",
  cancelText = "취소",
  variant = "default",
  loading: loadingProp = false,
}: PcConfirmDialogProps) {
  const [internalLoading, setInternalLoading] = useState(false);
  const runningRef = useRef(false);
  const isLoading = Boolean(loadingProp) || internalLoading;

  const handleConfirm = useCallback(async () => {
    if (runningRef.current || loadingProp) return;
    runningRef.current = true;
    setInternalLoading(true);
    try {
      await Promise.resolve(onConfirm());
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      runningRef.current = false;
      setInternalLoading(false);
    }
  }, [loadingProp, onConfirm, onClose]);

  const body =
    typeof message === "string" ? (
      <p style={messageTextStyle}>{message}</p>
    ) : (
      message ?? null
    );

  return (
    <PcModal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      closeOnOverlayClick={!isLoading}
      footer={
        <>
          <PcButton variant="secondary" onClick={onClose} disabled={isLoading}>
            {cancelText}
          </PcButton>
          <PcButton
            variant={variant === "danger" ? "danger" : "primary"}
            onClick={handleConfirm}
            loading={isLoading}
          >
            {confirmText}
          </PcButton>
        </>
      }
    >
      {body}
    </PcModal>
  );
}
