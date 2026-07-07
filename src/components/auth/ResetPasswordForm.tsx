"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { AuthCardShell } from "@/components/auth/AuthCardShell";
import { PasswordInput } from "@/components/auth/PasswordInput";

export default function ResetPasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setSessionReady(true);
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setSessionReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) {
      setError("서버 연결에 실패했습니다.");
      return;
    }
    if (password.length < 6) {
      setError("비밀번호는 6자 이상이어야 합니다.");
      return;
    }
    if (password !== confirmPassword) {
      setError("비밀번호가 일치하지 않습니다.");
      return;
    }

    setError("");
    setLoading(true);

    const { error: updateError } = await supabase.auth.updateUser({ password });

    setLoading(false);
    if (updateError) {
      setError("비밀번호 변경에 실패했어요. 잠시 후 다시 시도해 주세요.");
      return;
    }
    setDone(true);
  };

  return (
    <AuthCardShell styleTag={styleTag}>
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "var(--color-black)" }}>비밀번호 재설정</div>
        <div style={{ marginTop: 8, fontSize: 13, lineHeight: 1.5, color: "var(--color-text-muted)" }}>
          새로 사용할 비밀번호를 입력해 주세요.
        </div>
      </div>

      {done ? (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 18, color: "var(--color-black)", fontSize: 13 }}>
            <span
              style={{
                width: 16,
                height: 16,
                borderRadius: "50%",
                background: "var(--color-black)",
                color: "#ffffff",
                fontSize: 11,
                fontWeight: 700,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              ✓
            </span>
            비밀번호가 변경되었어요. 다시 로그인해 주세요.
          </div>
          <button
            type="button"
            onClick={() => router.push("/login")}
            style={{
              width: "100%",
              height: 52,
              borderRadius: 7,
              background: "var(--color-black)",
              color: "#ffffff",
              fontSize: 15,
              fontWeight: 700,
              border: "none",
              cursor: "pointer",
            }}
          >
            로그인하러 가기
          </button>
        </>
      ) : !sessionReady ? (
        <div style={{ textAlign: "center", fontSize: 13, color: "var(--color-text-muted)" }}>
          링크를 확인하는 중...
        </div>
      ) : (
        <form onSubmit={handleSubmit} noValidate>
          <div style={{ marginBottom: 10 }}>
            <PasswordInput
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (error) setError("");
              }}
              placeholder="새 비밀번호"
              required
              autoComplete="new-password"
            />
          </div>
          <PasswordInput
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value);
              if (error) setError("");
            }}
            placeholder="비밀번호 확인"
            required
            autoComplete="new-password"
          />

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
              borderRadius: 7,
              background: loading ? "#3a3a3a" : "var(--color-black)",
              color: "#ffffff",
              fontSize: 15,
              fontWeight: 700,
              border: "none",
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "변경 중..." : "비밀번호 변경하기"}
          </button>
        </form>
      )}

      <div style={{ textAlign: "center", marginTop: 18 }}>
        <button
          type="button"
          className="cu-link"
          onClick={() => router.push("/login")}
          style={{ background: "none", border: "none", fontSize: 13, color: "var(--color-text-muted)", cursor: "pointer" }}
        >
          로그인 화면으로 돌아가기
        </button>
      </div>
    </AuthCardShell>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  height: 52,
  padding: "0 16px",
  borderRadius: 7,
  border: "1px solid transparent",
  background: "#ebebeb",
  color: "var(--color-black)",
  fontSize: 15,
  outline: "none",
  boxSizing: "border-box",
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
  `}</style>
);
