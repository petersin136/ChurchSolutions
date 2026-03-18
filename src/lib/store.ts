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

/** 주차(1–52)와 연도로 해당 주 일요일 날짜(YYYY-MM-DD) 반환. db.attendance 주차 기준과 동일. */
export function getSundayForWeekNum(year: number, weekNum: number): string {
  const jan1 = new Date(year, 0, 1);
  const firstSunday = new Date(jan1);
  firstSunday.setDate(1 - jan1.getDay());
  const weekSunday = new Date(firstSunday);
  weekSunday.setDate(firstSunday.getDate() + (weekNum - 1) * 7);
  const y = weekSunday.getFullYear();
  const m = weekSunday.getMonth() + 1;
  const d = weekSunday.getDate();
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function fmtNum(n: number): string {
  return Number(n || 0).toLocaleString() + "원";
}

export function getThisMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export { loadBulletinFromSupabase, saveBulletinToSupabase } from "@/lib/supabase-db";
