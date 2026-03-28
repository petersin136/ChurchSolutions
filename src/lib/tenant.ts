type Row = Record<string, unknown>;

const CHURCH_ID_KEY = "church_solution_church_id";
let _loggedOnce = false;

const isBrowser = typeof window !== "undefined";

/**
 * localStorage (church_solution_church_id) — 로그인 시 AuthContext가 저장.
 * 없으면 에러 (환경변수로 교회 ID를 주입하지 않음).
 */
export function getChurchId(): string {
  if (isBrowser) {
    try {
      const stored = localStorage.getItem(CHURCH_ID_KEY);
      if (stored && stored.length > 0 && stored !== "null" && stored !== "undefined") {
        if (!_loggedOnce) {
          console.log("[tenant] church_id (localStorage, 1순위) =", stored);
          _loggedOnce = true;
        }
        return stored;
      }
    } catch {
      // localStorage 접근 실패 (private browsing 등)
    }
  }

  console.log("[tenant] localStorage에 church_id 없음 — 로그인 필요");
  throw new Error("church_id를 확인할 수 없습니다. 로그인이 필요합니다.");
}

export function withChurchId<T extends Row>(row: T): T & { church_id: string };
export function withChurchId<T extends Row>(rows: T[]): (T & { church_id: string })[];
export function withChurchId<T extends Row>(input: T | T[]) {
  const church_id = getChurchId();
  if (!church_id) {
    throw new Error("[withChurchId] church_id가 비어있습니다. 로그인 상태를 확인하세요.");
  }
  if (Array.isArray(input)) {
    const result = input.map((r) => ({ ...r, church_id }));
    console.log("[withChurchId] 배열 적용, church_id =", church_id, ", rows =", result.length);
    return result;
  }
  const result = { ...input, church_id };
  console.log("[withChurchId] 단건 적용, church_id =", church_id);
  return result;
}

export function filterByChurch<T>(query: T): T {
  const cid = getChurchId();
  if (!cid) {
    throw new Error("[filterByChurch] church_id가 비어있습니다.");
  }
  return (query as unknown as { eq: (col: string, val: unknown) => T }).eq("church_id", cid) as T;
}
