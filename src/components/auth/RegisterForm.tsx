"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { AuthCardShell, AuthPageLoading } from "@/components/auth/AuthCardShell";
import { savePendingLoginEmail } from "@/lib/pending-login";
import { PasswordInput } from "@/components/auth/PasswordInput";

type SuccessPhase = "sent" | "verified" | null;

const RESEND_COOLDOWN_SEC = 30;

const toKoreanResendError = (raw?: string): string => {
  const msg = (raw ?? "").toLowerCase();
  if (msg.includes("after") && msg.includes("seconds")) {
    const m = msg.match(/(\d+)\s*seconds?/);
    const sec = m ? m[1] : null;
    return sec
      ? `보안을 위해 ${sec}초 후에 다시 시도할 수 있어요.`
      : "잠시 후에 다시 시도해주세요.";
  }
  if (msg.includes("rate limit") || msg.includes("too many")) {
    return "요청이 많아요. 잠시 후 다시 시도해주세요.";
  }
  if (msg.includes("already confirmed") || msg.includes("already registered")) {
    return "이미 인증이 완료된 계정이에요. 로그인해주세요.";
  }
  return "인증 메일 재발송에 실패했어요. 잠시 후 다시 시도해주세요.";
};

export default function RegisterForm() {
  const router = useRouter();
  const isRegistering = useRef(false);
  const { loading: authLoading, setRegistering } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [successPhase, setSuccessPhase] = useState<SuccessPhase>(null);
  const [registeredEmail, setRegisteredEmail] = useState("");
  const [verifyMessage, setVerifyMessage] = useState("");
  const [infoMessage, setInfoMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingVerification, setCheckingVerification] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = window.setInterval(() => {
      setResendCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendCooldown]);

  useEffect(() => {
    if (successPhase !== "sent" || !registeredEmail) return;

    let cancelled = false;

    const checkVerified = async () => {
      try {
        const res = await fetch("/api/auth/check-verification", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: registeredEmail }),
        });
        const result = (await res.json()) as { verified?: boolean };
        if (cancelled || !result.verified) return;

        savePendingLoginEmail(registeredEmail);
        router.replace("/login");
      } catch {
        // 폴링 실패는 무시하고 다음 주기에 재시도
      }
    };

    void checkVerified();
    const timer = window.setInterval(() => void checkVerified(), 4000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [successPhase, registeredEmail, router]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      setError("이메일을 입력해주세요.");
      return;
    }
    if (password.length < 8) {
      setError("비밀번호는 8자 이상이어야 합니다.");
      return;
    }
    if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
      setError("비밀번호는 영문과 숫자를 모두 포함해야 합니다.");
      return;
    }
    if (password !== confirmPassword) {
      setError("비밀번호가 일치하지 않습니다.");
      return;
    }

    setError("");
    setLoading(true);
    setRegistering(true);
    isRegistering.current = true;

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: trimmedEmail,
          password,
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        setError(result.error ?? "회원가입에 실패했습니다.");
        setLoading(false);
        return;
      }

      setRegisteredEmail(trimmedEmail);
      savePendingLoginEmail(trimmedEmail);
      setSuccessPhase("sent");
      setVerifyMessage("");
      setInfoMessage("");
    } catch (err) {
      setError("회원가입 중 오류가 발생했습니다.");
      console.error(err);
      isRegistering.current = false;
    } finally {
      setRegistering(false);
      setLoading(false);
      isRegistering.current = false;
    }
  };

  const handleCheckVerification = async () => {
    setCheckingVerification(true);
    setVerifyMessage("");
    setInfoMessage("");

    try {
      const res = await fetch("/api/auth/check-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: registeredEmail }),
      });

      const result = await res.json();

      if (!res.ok) {
        setVerifyMessage(result.error ?? "인증 상태를 확인하지 못했습니다.");
        return;
      }

      if (result.verified) {
        savePendingLoginEmail(registeredEmail);
        router.replace("/login");
        return;
      }

      setVerifyMessage("아직 인증이 완료되지 않았어요. 메일함을 확인해주세요.");
    } catch (err) {
      setVerifyMessage("인증 상태를 확인하지 못했습니다.");
      console.error(err);
    } finally {
      setCheckingVerification(false);
    }
  };

  const handleResendVerification = async () => {
    if (resendCooldown > 0 || resendLoading) return;

    setResendLoading(true);
    setVerifyMessage("");
    setInfoMessage("");

    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: registeredEmail,
          password,
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        setVerifyMessage(toKoreanResendError(result.error));
        return;
      }

      setInfoMessage("인증 메일을 다시 보냈어요.");
      setResendCooldown(RESEND_COOLDOWN_SEC);
    } catch (err) {
      setVerifyMessage("인증 메일 재발송에 실패했습니다.");
      console.error(err);
    } finally {
      setResendLoading(false);
    }
  };

  if (authLoading) {
    return <AuthPageLoading />;
  }

  if (successPhase === "verified") {
    return (
      <AuthCardShell styleTag={styleTag}>
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              width: 44,
              height: 44,
              margin: "0 auto 16px",
              borderRadius: "50%",
              background: "var(--color-black)",
              color: "#ffffff",
              fontSize: 22,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            ✓
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "var(--color-black)" }}>
            인증이 완료되었습니다. 로그인해주세요.
          </div>
          <a
            href="/login"
            style={{
              display: "block",
              width: "100%",
              height: 52,
              lineHeight: "52px",
              marginTop: 24,
              borderRadius: 4,
              background: "var(--color-black)",
              color: "#ffffff",
              fontSize: 15,
              fontWeight: 700,
              textDecoration: "none",
              textAlign: "center",
            }}
          >
            로그인 페이지로
          </a>
        </div>
      </AuthCardShell>
    );
  }

  if (successPhase === "sent") {
    return (
      <AuthCardShell styleTag={styleTag}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: "var(--color-black)" }}>
            인증 메일을 보냈어요
          </div>
          <div style={{ marginTop: 12, fontSize: 13, lineHeight: 1.6, color: "var(--color-text-muted)" }}>
            <strong style={{ color: "var(--color-black)", fontWeight: 600 }}>{registeredEmail}</strong>
            {" "}주소로 인증 메일을 보냈습니다.
            <br />
            메일함에서 인증을 완료하면 이 화면이 자동으로 로그인 페이지로 이동해요.
            <br />
            (메일 링크는 새 탭에서 열릴 수 있어요. 이 탭을 닫지 않고 기다려 주세요.)
          </div>

          {verifyMessage ? (
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 16, color: "#e02424", fontSize: 13, textAlign: "left" }}>
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
              {verifyMessage}
            </div>
          ) : null}

          {infoMessage ? (
            <div style={{ marginTop: 16, fontSize: 13, lineHeight: 1.5, color: "var(--color-text-muted)" }}>
              {infoMessage}
            </div>
          ) : null}

          <button
            type="button"
            disabled={checkingVerification}
            onClick={handleCheckVerification}
            style={{
              width: "100%",
              height: 52,
              marginTop: 20,
              borderRadius: 4,
              background: checkingVerification ? "#3a3a3a" : "var(--color-black)",
              color: "#ffffff",
              fontSize: 15,
              fontWeight: 700,
              border: "none",
              cursor: checkingVerification ? "not-allowed" : "pointer",
            }}
          >
            {checkingVerification ? "확인 중..." : "인증 완료 확인"}
          </button>

          <button
            type="button"
            className="cu-link"
            disabled={resendLoading || resendCooldown > 0}
            onClick={handleResendVerification}
            style={{
              marginTop: 14,
              background: "none",
              border: "none",
              fontSize: 13,
              color: resendLoading || resendCooldown > 0 ? "var(--color-text-faint)" : "var(--color-text-muted)",
              cursor: resendLoading || resendCooldown > 0 ? "not-allowed" : "pointer",
              textDecoration: "underline",
              textUnderlineOffset: 3,
            }}
          >
            {resendLoading
              ? "발송 중..."
              : resendCooldown > 0
                ? `메일 다시 보내기 (${resendCooldown}초)`
                : "메일 다시 보내기"}
          </button>

          <div style={{ marginTop: 20, fontSize: 13 }}>
            <a
              href="/login"
              className="cu-link-strong"
              style={{ color: "var(--color-black)", fontWeight: 700, textDecoration: "none" }}
            >
              로그인 페이지로
            </a>
          </div>
        </div>
      </AuthCardShell>
    );
  }

  return (
    <AuthCardShell styleTag={styleTag}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--color-black)" }}>회원가입</div>
          <div style={{ marginTop: 8, fontSize: 13, lineHeight: 1.5, color: "var(--color-text-muted)" }}>
            church up 계정을 만듭니다.
          </div>
        </div>

        <form onSubmit={handleRegister} noValidate>
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
            autoComplete="email"
            style={inputStyle}
          />
          <div style={{ height: 12 }} />
          <PasswordInput
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (error) setError("");
            }}
            placeholder="비밀번호 (영문·숫자 포함 8자 이상)"
            required
            autoComplete="new-password"
          />
          <div style={{ height: 12 }} />
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
              borderRadius: 4,
              background: loading ? "#3a3a3a" : "var(--color-black)",
              color: "#ffffff",
              fontSize: 15,
              fontWeight: 700,
              border: "none",
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "가입 중..." : "회원가입"}
          </button>
        </form>

        <div style={{ textAlign: "center", fontSize: 13, marginTop: 20 }}>
          <span style={{ color: "var(--color-text-muted)" }}>이미 계정이 있으신가요? </span>
          <a href="/login" className="cu-link-strong" style={{ color: "var(--color-black)", fontWeight: 700, textDecoration: "none" }}>
            로그인
          </a>
        </div>
    </AuthCardShell>
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
    .cu-link:hover:not(:disabled), .cu-link:active:not(:disabled) { color: var(--color-black); }
    .cu-link-strong { transition: opacity .12s ease; }
    .cu-link-strong:hover { opacity: .65; }
  `}</style>
);
