type Row = Record<string, unknown>;

const CHURCH_ID_KEY = "church_solution_church_id";
let _loggedOnce = false;

const isBrowser = typeof window !== "undefined";

/**
 * 우선순위: 1) localStorage (church_solution_church_id) — 로그인 시 AuthContext가 저장
 *          2) NEXT_PUBLIC_CHURCH_ID — fallback. localStorage에 값이 있으면 환경변수는 무시.
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

  const id = process.env.NEXT_PUBLIC_CHURCH_ID;
  if (!id || id === "undefined" || id === "null") {
    throw new Error("church_id를 확인할 수 없습니다. 로그인이 필요합니다.");
  }
  if (isBrowser) {
    try {
      localStorage.setItem(CHURCH_ID_KEY, id);
    } catch {
      // silent
    }
  }
  if (!_loggedOnce && isBrowser) {
    console.log("[tenant] church_id (env fallback, 2순위) =", id);
    _loggedOnce = true;
  }
  return id;
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

export function filterByChurch<TQuery extends { eq: (col: string, val: unknown) => TQuery }>(q: TQuery): TQuery {
  const cid = getChurchId();
  if (!cid) {
    throw new Error("[filterByChurch] church_id가 비어있습니다.");
  }
  return q.eq("church_id", cid);
}
