import type { DB } from "@/types/db";
import { DEFAULT_DB } from "@/types/db";

export {
  loadDBFromSupabase,
  saveDBToSupabase,
  saveSettingsToSupabase,
  clearAllInSupabase,
  clearPastoralInSupabase,
  clearFinanceInSupabase,
  clearVisitsInSupabase,
} from "@/lib/supabase-db";

/** SSR 또는 초기 상태용 (클라이언트에서는 loadDBFromSupabase 사용) */
export function loadDB(): DB {
  return { ...DEFAULT_DB };
}

/** Supabase 사용 시 saveDBToSupabase 호출 권장. 하위 호환용 빈 함수 */
export function saveDB(_db: DB): void {
  /* 데이터는 Supabase에 저장됨 */
}

export function getDepts(db: DB): string[] {
  return (db.settings.depts || "")
    .split(",")
    .map((d) => d.trim())
    .filter(Boolean);
}

export function getWeekNum(): number {
  const now = new Date();
  const s = new Date(now.getFullYear(), 0, 1);
  return Math.ceil(
    ((now.getTime() - s.getTime()) / 864e5 + s.getDay() + 1) / 7
  );
}

export function fmtNum(n: number): string {
  return Number(n || 0).toLocaleString() + "원";
}

export function getThisMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
