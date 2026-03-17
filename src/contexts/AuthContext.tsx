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
}

const AuthContext = createContext<AuthState>({
  user: null,
  session: null,
  churchId: null,
  churchName: null,
  loading: true,
  signOut: async () => {},
  setRegistering: () => {},
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
    if (typeof window !== "undefined") {
      const cachedChurchId = localStorage.getItem(CHURCH_ID_KEY);
      const cachedChurchName = localStorage.getItem(CHURCH_NAME_KEY);
      if (cachedChurchId) {
        console.log("[Auth] localStorage 캐시 사용:", cachedChurchId, cachedChurchName);
        setChurchId(cachedChurchId);
        setChurchName(cachedChurchName ?? "");
        setLoading(false);
      }
    }

    const result = await fetchChurchForUser(userId);
    if (result && result.churchId) {
      console.log("[AuthContext] church_users 조회 결과:", result);
      console.log("[AuthContext] churchId 설정됨:", result.churchId);
      setChurchId(result.churchId);
      setChurchName(result.churchName);
      if (typeof window !== "undefined") {
        localStorage.setItem(CHURCH_ID_KEY, result.churchId);
        if (result.churchName) localStorage.setItem(CHURCH_NAME_KEY, result.churchName);
      }
    } else {
      const envId = process.env.NEXT_PUBLIC_CHURCH_ID;
      if (envId && envId !== "undefined" && envId !== "null") {
        console.log("[AuthContext] churchId 설정됨 (env):", envId);
        setChurchId(envId);
        if (typeof window !== "undefined") {
          localStorage.setItem(CHURCH_ID_KEY, envId);
        }
      }
    }
  }, []);

  // 클라이언트에서만 실행: auth 상태 + localStorage 읽기. 한 번만 구독, cleanup 필수.
  useEffect(() => {
    console.log("[Auth] useEffect 시작, supabase:", !!supabase);
    if (!supabase) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    supabase.auth.getSession().then(async ({ data: { session: s } }) => {
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
        const cached = localStorage.getItem(CHURCH_ID_KEY);
        if (cached && cached !== "null" && cached !== "undefined") {
          console.log("[AuthContext] churchId 설정됨 (cached):", cached);
          setChurchId(cached);
        }
        const cachedName = localStorage.getItem(CHURCH_NAME_KEY);
        if (cachedName) setChurchName(cachedName);
      }
      if (!cancelled) {
        console.log("[Auth] setLoading(false) 실행");
        setLoading(false);
        console.log("[AuthContext] getSession 완료, loading=false, user=", !!s?.user);
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
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 단일 구독 유지, StrictMode 대응
  }, []);

  const signOut = useCallback(async () => {
    try {
      if (supabase) await supabase.auth.signOut({ scope: "global" });
    } catch (e) {
      console.error("[signOut] supabase error:", e);
    }

    setUser(null);
    setSession(null);
    setChurchId(null);
    setChurchName(null);

    if (typeof window !== "undefined") {
      const bulletinBackup = localStorage.getItem("bulletin_db");
      localStorage.clear();
      if (bulletinBackup) {
        localStorage.setItem("bulletin_db", bulletinBackup);
      }
    }

    if (typeof window !== "undefined") {
      sessionStorage.clear();
    }

    if (typeof document !== "undefined") {
      document.cookie.split(";").forEach((c) => {
        document.cookie = c.trim().split("=")[0] + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
      });
    }

    if (typeof window !== "undefined" && window.indexedDB) {
      try {
        const databases = await window.indexedDB.databases();
        databases.forEach((db) => {
          if (db.name) window.indexedDB.deleteDatabase(db.name);
        });
      } catch (_) {
        // indexedDB.databases() 미지원 등
      }
    }

    window.location.replace("/login");
  }, []);

  useEffect(() => {
    console.log("[AuthContext] Provider value - churchId:", churchId);
  }, [churchId]);

  return (
    <AuthContext.Provider value={{ user, session, churchId, churchName, loading, signOut, setRegistering: setIsRegistering }}>
      {children}
    </AuthContext.Provider>
  );
}
