"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { AuthCardShell, AuthPageLoading } from "@/components/auth/AuthCardShell";
import { GoogleLogo, KakaoLogo } from "@/components/auth/SocialBrandIcons";
import {
  clearPendingLoginEmail,
  getInitialLoginEmail,
  loadPendingLoginEmail,
} from "@/lib/pending-login";
import { PasswordInput } from "@/components/auth/PasswordInput";

function LoginFormInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const [email, setEmail] = useState(getInitialLoginEmail);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [keepLoggedIn, setKeepLoggedIn] = useState(false);

  useEffect(() => {
    const emailFromQuery = searchParams.get("email")?.trim();
    const pendingEmail = loadPendingLoginEmail();

    if (emailFromQuery) {
      setEmail(emailFromQuery);
      return;
    }

    if (pendingEmail) setEmail(pendingEmail);
  }, [searchParams]);

  useEffect(() => {
    if (!authLoading && user) router.replace("/");
  }, [user, authLoading, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) {
      setError("서버 연결에 실패했습니다.");
      return;
    }
    setError("");
    setLoading(true);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (signInError) {
      setLoading(false);
      if (signInError.message.includes("Invalid login")) {
        setError("이메일 또는 비밀번호가 올바르지 않습니다.");
      } else if (signInError.message.includes("Email not confirmed")) {
        setError("이메일 인증이 필요합니다. 메일함을 확인해주세요.");
      } else {
        setError(signInError.message);
      }
      return;
    }

    clearPendingLoginEmail();
    router.replace("/");
  };

  const handleGoogleLogin = async () => {
    if (!supabase) {
      setError("서버 연결에 실패했습니다.");
      return;
    }
    setError("");
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/`,
      },
    });
    if (oauthError) {
      setError("구글 로그인에 실패했어요. 잠시 후 다시 시도해 주세요.");
    }
  };

  const handleKakaoLogin = async () => {
    if (!supabase) {
      setError("서버 연결에 실패했습니다.");
      return;
    }
    setError("");
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "kakao",
      options: {
        redirectTo: `${window.location.origin}/`,
        scopes: "profile_nickname profile_image",
      },
    });
    if (oauthError) {
      setError("카카오 로그인에 실패했어요. 잠시 후 다시 시도해 주세요.");
    }
  };

  if (authLoading) {
    return <AuthPageLoading />;
  }

  if (user) return null;

  return (
    <AuthCardShell styleTag={styleTag}>
        <form onSubmit={handleLogin} noValidate>
          <input
            className="cu-input"
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (error) setError("");
            }}
            placeholder="이메일 주소"
            required
            autoComplete="off"
            style={inputStyle}
          />
          <div style={{ height: 12 }} />
          <PasswordInput
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (error) setError("");
            }}
            placeholder="비밀번호"
            required
            autoComplete="new-password"
          />

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 14 }}>
            <label style={{ display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer", userSelect: "none" }}>
              <input
                type="checkbox"
                checked={keepLoggedIn}
                onChange={(e) => setKeepLoggedIn(e.target.checked)}
                style={{ position: "absolute", opacity: 0, width: 0, height: 0 }}
              />
              <span
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: 4,
                  flexShrink: 0,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: keepLoggedIn ? "var(--color-black)" : "#ffffff",
                  border: keepLoggedIn ? "1px solid var(--color-black)" : "1px solid #c4c4c8",
                }}
              >
                {keepLoggedIn ? (
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                    <path d="M2.5 6.2l2.3 2.3 4.7-4.9" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : null}
              </span>
              <span style={{ fontSize: 13, color: keepLoggedIn ? "var(--color-black)" : "var(--color-text-muted)", fontWeight: keepLoggedIn ? 600 : 400 }}>
                로그인 상태 유지
              </span>
            </label>

            <button
              type="button"
              className="cu-link"
              onClick={() => router.push("/forgot-password")}
              style={{ background: "none", border: "none", fontSize: 13, color: "var(--color-text-muted)", cursor: "pointer" }}
            >
              비밀번호 찾기
            </button>
          </div>

          {error ? (
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 12, color: "#e02424", fontSize: 13 }}>
              <span
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: "50%",
                  background: "#e02424",
                  color: "#ffffff",
                  fontSize: 11,
                  fontWeight: 700,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                !
              </span>
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              height: 52,
              marginTop: 18,
              borderRadius: 4,
              background: loading ? "#3a3a3a" : "var(--color-black)",
              color: "#ffffff",
              fontSize: 15,
              fontWeight: 700,
              border: "none",
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "로그인 중..." : "로그인"}
          </button>
        </form>

        <div style={{ textAlign: "center", fontSize: 13, marginTop: 20 }}>
          <span style={{ color: "var(--color-text-muted)" }}>계정이 없으신가요? </span>
          <a href="/register" className="cu-link-strong" style={{ color: "var(--color-black)", fontWeight: 700, textDecoration: "none" }}>
            회원가입
          </a>
        </div>

        <div style={{ textAlign: "center", fontSize: 13, marginTop: 12 }}>
          <span style={{ color: "var(--color-text-muted)" }}>소속 교회를 찾고 계신가요? </span>
          <a href="/church-search" className="cu-link-strong" style={{ color: "var(--color-black)", fontWeight: 700, textDecoration: "none" }}>
            교회 찾기
          </a>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "28px 0 20px" }}>
          <div style={{ flex: 1, height: 1, background: "#ebebeb" }} />
          <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>SNS 계정으로 시작</span>
          <div style={{ flex: 1, height: 1, background: "#ebebeb" }} />
        </div>

        <button
          type="button"
          className="cu-social"
          onClick={handleKakaoLogin}
          style={{ ...socialBtnBase, background: "#FEE500", color: "var(--color-black)" }}
        >
          <span style={socialIconStyle}>
            <KakaoLogo size={20} />
          </span>
          Kakao로 시작하기
        </button>

        <div style={{ height: 10 }} />

        <button
          type="button"
          className="cu-social"
          onClick={handleGoogleLogin}
          style={{ ...socialBtnBase, background: "#ebebeb", color: "var(--color-black)" }}
        >
          <span style={socialIconStyle}>
            <GoogleLogo size={20} />
          </span>
          Google로 시작하기
        </button>
    </AuthCardShell>
  );
}

export default function LoginForm() {
  return (
    <Suspense fallback={<AuthPageLoading />}>
      <LoginFormInner />
    </Suspense>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  height: 52,
  padding: "0 16px",
  borderRadius: 4,
  border: "1px solid transparent",
  background: "#ebebeb",
  color: "var(--color-black)",
  fontSize: 15,
  outline: "none",
  boxSizing: "border-box",
};

const socialBtnBase: React.CSSProperties = {
  width: "100%",
  height: 52,
  borderRadius: 4,
  fontSize: 15,
  fontWeight: 700,
  border: "none",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  position: "relative",
};

const socialIconStyle: React.CSSProperties = {
  position: "absolute",
  left: 18,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};

const styleTag = (
  <style>{`
    .cu-input { transition: border-color .12s ease; }
    .cu-input::placeholder { color: var(--color-text-faint); }
    .cu-input:focus { border-color: var(--color-black); }
    .cu-input:-webkit-autofill,
    .cu-input:-webkit-autofill:hover,
    .cu-input:-webkit-autofill:focus,
    .cu-input:-webkit-autofill:active {
      -webkit-text-fill-color: var(--color-black);
      -webkit-box-shadow: 0 0 0 1000px #ebebeb inset;
      box-shadow: 0 0 0 1000px #ebebeb inset;
      caret-color: var(--color-black);
      transition: background-color 9999s ease-in-out 0s;
    }
    .cu-link { transition: color .12s ease; }
    .cu-link:hover, .cu-link:active { color: var(--color-black); }
    .cu-link-strong { transition: opacity .12s ease; }
    .cu-link-strong:hover { opacity: .65; }
    .cu-social { transition: transform .06s ease, filter .12s ease; }
    .cu-social:hover { filter: brightness(.97); }
    .cu-social:active { transform: translateY(1px); }
  `}</style>
);
