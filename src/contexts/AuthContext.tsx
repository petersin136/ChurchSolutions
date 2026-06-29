"use client";

import { createContext, useContext, useEffect, useState, useRef, useCallback, type ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import type { User, Session } from "@supabase/supabase-js";

const CHURCH_ID_KEY = "church_solution_church_id";
const CHURCH_NAME_KEY = "church_solution_church_name";

interface AuthState {
  user: User | null;
  session: Session | null;
  churchId: string | null;
  churchName: string | null;
  loading: boolean;
  signOut: () => Promise<void>;
  setRegistering: (v: boolean) => void;
  refreshChurch: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  user: null,
  session: null,
  churchId: null,
  churchName: null,
  loading: true,
  signOut: async () => {},
  setRegistering: () => {},
  refreshChurch: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

async function fetchChurchForUser(userId: string): Promise<{ churchId: string; churchName: string } | null> {
  console.log("[Auth] fetchChurchForUser 시작:", userId);
  if (!supabase) {
    console.log("[Auth] supabase 없음");
    return null;
  }

  const MAX_RETRIES = 3;
  /** Vercel 등 느린 네트워크 대비 — church_users / churches 각 단계당 동일 적용 */
  const TIMEOUT_MS = 15000;
  const RETRY_DELAY_MS = 1000;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`[Auth] church 쿼리 시도 ${attempt}/${MAX_RETRIES}`);

      const queryPromise = supabase
        .from("church_users")
        .select("church_id")
        .eq("user_id", userId)
        .limit(1)
        .maybeSingle();
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), TIMEOUT_MS)
      );
      const churchUsersResult = await Promise.race([queryPromise, timeoutPromise]) as { data: { church_id: string } | null; error: { message?: string } | null };

      const { data, error } = churchUsersResult;
      console.log("[Auth] church_users 쿼리 완료:", { data, error: error?.message });

      if (error || !data) {
        console.warn("[Auth] church_users 조회 실패:", error?.message ?? "no data");
        if (attempt < MAX_RETRIES) {
          await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
          continue;
        }
        return null;
      }

      const cid = data.church_id as string;
      if (!cid || cid === "null" || cid === "undefined") return null;

      const churchQueryPromise = supabase.from("churches").select("name").eq("id", cid).maybeSingle();
      const churchTimeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), TIMEOUT_MS)
      );
      const churchResult = await Promise.race([churchQueryPromise, churchTimeoutPromise]) as { data: { name?: string } | null };
      const churchName = churchResult?.data?.name ?? "";

      const result = { churchId: cid, churchName };
      console.log("[Auth] fetchChurchForUser 결과:", result);
      return result;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`[Auth] 시도 ${attempt} 실패:`, message);
      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
        continue;
      }
      console.error("[Auth] fetchChurchForUser 최종 실패:", err);
      return null;
    }
  }
  return null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  // SSR과 클라이언트 첫 렌더 모두 동일한 초기값 (null/true)
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [churchId, setChurchId] = useState<string | null>(null);
  const [churchName, setChurchName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRegistering, setIsRegistering] = useState(false);
  const isRegisteringRef = useRef(false);
  useEffect(() => {
    isRegisteringRef.current = isRegistering;
  }, [isRegistering]);

  const loadChurch = useCallback(async (userId: string) => {
    const cachedId =
      typeof window !== "undefined" ? localStorage.getItem(CHURCH_ID_KEY) : null;
    const hasValidCache = !!(
      cachedId &&
      cachedId !== "null" &&
      cachedId !== "undefined"
    );

    if (hasValidCache && typeof window !== "undefined") {
      const cachedName = localStorage.getItem(CHURCH_NAME_KEY);
      setChurchId(cachedId);
      setChurchName(cachedName ?? "");
      console.log("[Auth] 캐시로 즉시 표시, 백그라운드에서 DB 동기화:", cachedId);
    }

    const syncFromDb = async () => {
      const result = await fetchChurchForUser(userId);
      if (result && result.churchId) {
        console.log("[AuthContext] church_users 조회 결과:", result);
        console.log("[AuthContext] churchId DB 동기화 (localStorage 덮어쓰기):", result.churchId);
        setChurchId(result.churchId);
        setChurchName(result.churchName);
        if (typeof window !== "undefined") {
          localStorage.setItem(CHURCH_ID_KEY, result.churchId);
          if (result.churchName) localStorage.setItem(CHURCH_NAME_KEY, result.churchName);
        }
      } else if (!hasValidCache) {
        console.warn("[AuthContext] church_users 조회 실패 (캐시 없음) — localStorage 정리");
        if (typeof window !== "undefined") {
          localStorage.removeItem(CHURCH_ID_KEY);
          localStorage.removeItem(CHURCH_NAME_KEY);
        }
        setChurchId(null);
        setChurchName(null);
        console.log("[AuthContext] church_users 미등록 유저 — churchId null 유지");
      } else {
        console.warn("[AuthContext] DB 조회 실패 — 캐시된 churchId 유지");
      }
    };

    if (hasValidCache) {
      void syncFromDb();
    } else {
      await syncFromDb();
    }
  }, []);

  const refreshChurch = useCallback(async () => {
    if (user?.id) {
      await loadChurch(user.id);
    }
  }, [user, loadChurch]);

  // 클라이언트에서만 실행: auth 상태 + localStorage 읽기. 한 번만 구독, cleanup 필수.
  useEffect(() => {
    console.log("[Auth] useEffect 시작, supabase:", !!supabase);
    if (!supabase) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    // ⚠️ Vercel 콜드스타트/네트워크 지연으로 getSession() 이 행이 걸리면
    //   화면이 영구 blank 상태가 되는 사고를 막기 위해 8초 안전망 타임아웃.
    //   타임아웃이 먼저 발화해도 이후 응답이 오면 정상 처리되도록 cancelled 플래그를 사용.
    const SESSION_TIMEOUT_MS = 8000;
    const failsafeTimer = setTimeout(() => {
      if (cancelled) return;
      console.warn("[Auth] getSession 타임아웃 — loading=false 강제 해제");
      setLoading(false);
    }, SESSION_TIMEOUT_MS);

    supabase.auth.getSession()
      .then(async ({ data: { session: s } }) => {
        console.log("[Auth] getSession 결과:", !!s, "user:", s?.user?.email);
        if (cancelled) return;
        setSession(s);
        setUser(s?.user ?? null);
        if (s?.user) {
          console.log("[Auth] loadChurch 호출:", s.user.id);
          await loadChurch(s.user.id);
        } else {
          setChurchId(null);
          setChurchName(null);
          console.log("[AuthContext] 세션 없음 — churchId null 유지");
        }
        if (!cancelled) {
          clearTimeout(failsafeTimer);
          console.log("[Auth] setLoading(false) 실행");
          setLoading(false);
          console.log("[AuthContext] getSession 완료, loading=false, user=", !!s?.user);
        }
      })
      .catch((err) => {
        console.error("[Auth] getSession 실패:", err);
        if (!cancelled) {
          clearTimeout(failsafeTimer);
          setLoading(false);
        }
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, s) => {
      if (cancelled) return;
      if (isRegisteringRef.current) {
        console.log("[AuthContext] 회원가입 중 - onAuthStateChange 무시");
        return;
      }
      if (typeof window !== "undefined" && window.location.pathname === "/register") {
        console.log("[AuthContext] /register 페이지에서는 자동 로드 스킵");
        setLoading(false);
        return;
      }
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        await loadChurch(s.user.id);
      } else {
        setChurchId(null);
        setChurchName(null);
        localStorage.removeItem(CHURCH_ID_KEY);
        localStorage.removeItem(CHURCH_NAME_KEY);
      }
    });

    return () => {
      cancelled = true;
      clearTimeout(failsafeTimer);
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 단일 구독 유지, StrictMode 대응
  }, []);

  const signOut = useCallback(async () => {
    // ⚠️ Supabase 서버가 응답 안 하면 supabase.auth.signOut() 가 무한정 대기하는
    //   사례가 있음. 이 함수가 영원히 끝나지 않으면 "지금 로그인 화면으로 이동"
    //   같은 버튼이 무반응처럼 보이므로, 3초 타임아웃 race + fire-and-forget 처리.
    const SIGNOUT_TIMEOUT_MS = 3000;
    if (supabase) {
      try {
        await Promise.race([
          supabase.auth.signOut({ scope: "global" }),
          new Promise<void>((resolve) =>
            setTimeout(() => {
              console.warn("[signOut] supabase.auth.signOut 타임아웃 — 로컬 정리만 수행");
              resolve();
            }, SIGNOUT_TIMEOUT_MS),
          ),
        ]);
      } catch (e) {
        console.error("[signOut] supabase error:", e);
      }
    }

    setUser(null);
    setSession(null);
    setChurchId(null);
    setChurchName(null);

    if (typeof window !== "undefined") {
      try { localStorage.clear(); } catch {}
      try { sessionStorage.clear(); } catch {}
    }

    if (typeof document !== "undefined") {
      try {
        document.cookie.split(";").forEach((c) => {
          document.cookie = c.trim().split("=")[0] + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
        });
      } catch {}
    }

    if (typeof window !== "undefined" && window.indexedDB) {
      try {
        const databases = await Promise.race([
          window.indexedDB.databases(),
          new Promise<IDBDatabaseInfo[]>((resolve) => setTimeout(() => resolve([]), 500)),
        ]);
        databases.forEach((db) => {
          if (db.name) window.indexedDB.deleteDatabase(db.name);
        });
      } catch (_) {
        // indexedDB.databases() 미지원 등 - 무시
      }
    }

    if (typeof window !== "undefined") {
      window.location.replace("/login");
    }
  }, []);

  useEffect(() => {
    console.log("[AuthContext] Provider value - churchId:", churchId);
  }, [churchId]);

  return (
    <AuthContext.Provider value={{ user, session, churchId, churchName, loading, signOut, setRegistering: setIsRegistering, refreshChurch }}>
      {children}
    </AuthContext.Provider>
  );
}
