"use client";

import type { ToastItem } from "./SuperPlanner";

export function Toast({ toasts }: { toasts: ToastItem[] }) {
  return (
    <div className="toast-box" id="toastBox">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`toast ${t.type === "ok" ? "t-ok" : t.type === "err" ? "t-err" : "t-warn"}`}
        >
          {t.msg}
        </div>
      ))}
    </div>
  );
}
