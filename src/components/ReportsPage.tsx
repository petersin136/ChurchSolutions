"use client";

import type { DB } from "@/types/db";
import { ReportsSettingsPage } from "./ReportsSettingsPage";

interface ReportsPageProps {
  db: DB;
  setDb: React.Dispatch<React.SetStateAction<DB>>;
  save: () => void;
  saveDb?: (d: DB) => Promise<void>;
  toast: (msg: string, type?: "ok" | "err" | "warn") => void;
}

export function ReportsPage(props: ReportsPageProps) {
  return <ReportsSettingsPage {...props} mode="reports" />;
}
