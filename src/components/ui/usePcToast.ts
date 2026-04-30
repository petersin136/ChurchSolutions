"use client";

import { useContext } from "react";
import { ToastContext, type ToastContextValue } from "./PcToastProvider";
import type { PcToastOptions, PcToastVariant } from "./pcToastTypes";

const noop = () => "";
const noopVoid = () => {};

const fallback: ToastContextValue = {
  show: noop,
  success: noop,
  error: noop,
  info: noop,
  warning: noop,
  dismiss: noopVoid,
  dismissAll: noopVoid,
};

export function usePcToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    if (typeof window !== "undefined") {
      console.warn("[usePcToast] PcToastProvider 바깥에서 호출되었습니다. 토스트는 표시되지 않습니다.");
    }
    return fallback;
  }
  return ctx;
}
