"use client";

import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { PcToast } from "./PcToast";
import type { PcToastOptions, PcToastVariant, ShowToastPayload, ToastRecord } from "./pcToastTypes";

export type { PcToastOptions, PcToastVariant } from "./pcToastTypes";

function readCssMs(varName: string, fallback: number): number {
  if (typeof window === "undefined") return fallback;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : fallback;
}

export type ToastContextValue = {
  show: (payload: ShowToastPayload) => string;
  success: (title: string, description?: string, options?: PcToastOptions) => string;
  error: (title: string, description?: string, options?: PcToastOptions) => string;
  info: (title: string, description?: string, options?: PcToastOptions) => string;
  warning: (title: string, description?: string, options?: PcToastOptions) => string;
  dismiss: (id: string) => void;
  dismissAll: () => void;
};

export const ToastContext = createContext<ToastContextValue | null>(null);

const shellStyle: CSSProperties = {
  position: "fixed",
  bottom: "var(--pc-space-6)",
  right: "var(--pc-space-6)",
  zIndex: "var(--pc-z-toast)",
  display: "flex",
  flexDirection: "column-reverse",
  gap: "var(--pc-space-2)",
  pointerEvents: "none",
};

export function PcToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastRecord[]>([]);
  const [mounted, setMounted] = useState(false);
  const idRef = useRef(0);

  useEffect(() => {
    setMounted(true);
  }, []);

  const removeHard = useCallback((id: string) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const dismiss = useCallback(
    (id: string) => {
      const exitMs = readCssMs("--pc-toast-exit-duration", 180);
      setItems((prev) => {
        const t = prev.find((x) => x.id === id);
        if (!t || t.exiting) return prev;
        return prev.map((x) => (x.id === id ? { ...x, exiting: true } : x));
      });
      window.setTimeout(() => {
        removeHard(id);
      }, exitMs);
    },
    [removeHard],
  );

  const dismissAll = useCallback(() => {
    setItems([]);
  }, []);

  const show = useCallback((payload: ShowToastPayload) => {
    const id = `pc-toast-${++idRef.current}`;
    const duration =
      payload.duration !== undefined
        ? payload.duration
        : readCssMs("--pc-toast-default-duration", 4000);
    const row: ToastRecord = { ...payload, id, duration };
    setItems((prev) => [...prev, row].slice(-3));
    return id;
  }, []);

  const success = useCallback(
    (title: string, description?: string, options?: PcToastOptions) =>
      show({ variant: "success", title, description, duration: options?.duration }),
    [show],
  );

  const error = useCallback(
    (title: string, description?: string, options?: PcToastOptions) =>
      show({ variant: "error", title, description, duration: options?.duration }),
    [show],
  );

  const info = useCallback(
    (title: string, description?: string, options?: PcToastOptions) =>
      show({ variant: "info", title, description, duration: options?.duration }),
    [show],
  );

  const warning = useCallback(
    (title: string, description?: string, options?: PcToastOptions) =>
      show({ variant: "warning", title, description, duration: options?.duration }),
    [show],
  );

  const value = useMemo(
    () => ({ show, success, error, info, warning, dismiss, dismissAll }),
    [show, success, error, info, warning, dismiss, dismissAll],
  );

  const portal =
    mounted && typeof document !== "undefined" ? (
      createPortal(
        <div style={shellStyle} aria-live="polite">
          {items.map((t) => (
            <div key={t.id} style={{ pointerEvents: "auto" }}>
              <PcToast
                variant={t.variant}
                title={t.title}
                description={t.description}
                durationMs={t.duration ?? readCssMs("--pc-toast-default-duration", 4000)}
                exiting={t.exiting}
                onDismiss={() => dismiss(t.id)}
              />
            </div>
          ))}
        </div>,
        document.body,
      )
    ) : null;

  return (
    <ToastContext.Provider value={value}>
      {children}
      {portal}
    </ToastContext.Provider>
  );
}
