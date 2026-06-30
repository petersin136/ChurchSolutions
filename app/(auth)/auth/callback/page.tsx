"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { AuthPageLoading } from "@/components/auth/AuthCardShell";

function AuthCallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [message, setMessage] = useState("로그인 처리 중...");

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const oauthError = searchParams.get("error");
      if (oauthError) {
        const desc = searchParams.get("error_description");
        setMessage(desc || "소셜 로그인에 실패했습니다.");
        setTimeout(() => {
          if (!cancelled) router.replace("/login?error=oauth");
        }, 1500);
        return;
      }

      if (!supabase) {
        router.replace("/login?error=auth");
        return;
      }

      const code = searchParams.get("code");
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (cancelled) return;
        if (error) {
          console.error("[auth/callback] exchangeCodeForSession:", error.message);
          router.replace("/login?error=oauth");
          return;
        }
      } else {
        const { data, error } = await supabase.auth.getSession();
        if (cancelled) return;
        if (error || !data.session) {
          router.replace("/login?error=oauth");
          return;
        }
      }

      const next = searchParams.get("next")?.trim() || "/";
      router.replace(next.startsWith("/") ? next : "/");
    })();

    return () => {
      cancelled = true;
    };
  }, [router, searchParams]);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "var(--font-sans, system-ui, sans-serif)",
        color: "var(--color-text-muted, #666)",
        fontSize: 15,
      }}
    >
      {message}
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<AuthPageLoading />}>
      <AuthCallbackInner />
    </Suspense>
  );
}
