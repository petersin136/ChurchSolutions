"use client";

import { useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

export default function RegisterForm() {
  const isRegistering = useRef(false);
  const { loading: authLoading, setRegistering } = useAuth();
  const [churchName, setChurchName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) {
      setError("서버 연결에 실패했습니다.");
      return;
    }

    const trimmedChurch = churchName.trim();
    const trimmedEmail = email.trim();

    if (!trimmedChurch) {
      setError("교회 이름을 입력해주세요.");
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
    setRegistering(true);
    isRegistering.current = true;

    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
      });

      console.log("[RegisterForm] signUp 결과:", { userId: data?.user?.id, error: signUpError });

      if (signUpError) {
        if (signUpError.message.includes("already registered")) {
          setError("이미 등록된 이메일입니다.");
        } else {
          setError(signUpError.message);
        }
        setLoading(false);
        isRegistering.current = false;
        return;
      }

      if (!data?.user?.id) {
        setError("사용자 생성에 실패했습니다. (user.id 없음)");
        setLoading(false);
        isRegistering.current = false;
        return;
      }

      const { data: churchData, error: churchError } = await supabase
        .from("churches")
        .insert({ name: trimmedChurch })
        .select("id")
        .single();

      console.log("[RegisterForm] churches INSERT:", { churchData, churchError });

      if (churchError) {
        setError("교회 등록 실패: " + churchError.message);
        setLoading(false);
        isRegistering.current = false;
        return;
      }

      if (!churchData?.id) {
        setError("교회 등록 실패: id를 받지 못했습니다.");
        setLoading(false);
        isRegistering.current = false;
        return;
      }

      const { data: cuData, error: cuError } = await supabase
        .from("church_users")
        .insert({
          user_id: data.user.id,
          church_id: churchData.id,
          role: "admin",
        })
        .select();

      console.log("[RegisterForm] church_users INSERT:", { cuData, cuError });

      if (cuError) {
        setError("교회 사용자 등록 실패: " + cuError.message);
        setLoading(false);
        isRegistering.current = false;
        return;
      }

      const { error: settingsError } = await supabase
        .from("settings")
        .insert({ church_id: churchData.id, church_name: trimmedChurch, depts: "장년부,청년부,중고등부,초등부,유치부,영아부" });

      if (settingsError) {
        console.warn("기본 설정 생성 실패 (무시 가능):", settingsError.message);
      }

      await supabase.auth.signOut();
      isRegistering.current = false;
      setSuccess(true);
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

  if (authLoading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f8f7f4" }}>
        <div style={{ fontSize: 14, color: "#6b7280" }}>로딩 중...</div>
      </div>
    );
  }

  if (success) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f8f7f4", padding: "0 16px" }}>
        <div style={{ width: "100%", maxWidth: 384, textAlign: "center" }}>
          <div style={{ background: "#fff", borderRadius: 16, boxShadow: "0 1px 2px rgba(0,0,0,0.05)", border: "1px solid #e8e6e1", padding: 32 }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#1b2a4a", marginBottom: 8 }}>회원가입 완료</div>
            <div style={{ fontSize: 14, color: "#6b7b9e", marginBottom: 24 }}>
              이메일 인증 후 로그인할 수 있습니다.<br />
              메일함을 확인해주세요.
            </div>
            <a
              href="/login"
              style={{ display: "block", width: "100%", padding: "10px 0", borderRadius: 12, background: "#1b2a4a", color: "#fff", fontSize: 14, fontWeight: 600, textDecoration: "none", textAlign: "center" }}
            >
              로그인 페이지로
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "flex-start", justifyContent: "center", background: "#f8f7f4", padding: "40px 16px", overflowY: "auto" }}>
      <div style={{ width: "100%", maxWidth: 384 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>⛪</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: "#1b2a4a" }}>회원가입</div>
          <div style={{ fontSize: 14, color: "#6b7b9e", marginTop: 4 }}>교회와 관리자 계정을 생성합니다</div>
        </div>

        <form onSubmit={handleRegister} style={{ background: "#fff", borderRadius: 16, boxShadow: "0 1px 2px rgba(0,0,0,0.05)", border: "1px solid #e8e6e1", padding: 24 }}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "#6b7b9e", marginBottom: 6 }}>교회 이름</label>
            <input
              type="text"
              value={churchName}
              onChange={(e) => setChurchName(e.target.value)}
              placeholder="예: 사랑의교회"
              required
              style={{ width: "100%", padding: "10px 14px", borderRadius: 12, border: "1px solid #e8e6e1", fontSize: 14, outline: "none", boxSizing: "border-box" }}
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "#6b7b9e", marginBottom: 6 }}>이메일</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="example@church.com"
              required
              autoComplete="email"
              style={{ width: "100%", padding: "10px 14px", borderRadius: 12, border: "1px solid #e8e6e1", fontSize: 14, outline: "none", boxSizing: "border-box" }}
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "#6b7b9e", marginBottom: 6 }}>비밀번호</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="6자 이상"
              required
              autoComplete="new-password"
              style={{ width: "100%", padding: "10px 14px", borderRadius: 12, border: "1px solid #e8e6e1", fontSize: 14, outline: "none", boxSizing: "border-box" }}
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "#6b7b9e", marginBottom: 6 }}>비밀번호 확인</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="비밀번호를 다시 입력"
              required
              autoComplete="new-password"
              style={{ width: "100%", padding: "10px 14px", borderRadius: 12, border: "1px solid #e8e6e1", fontSize: 14, outline: "none", boxSizing: "border-box" }}
            />
          </div>

          {error ? (
            <div style={{ borderRadius: 12, background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", fontSize: 12, padding: "10px 12px", marginBottom: 16 }}>
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: "12px 0",
              borderRadius: 12,
              backgroundColor: loading ? "#9ca3af" : "#1b2a4a",
              color: "#ffffff",
              fontSize: 14,
              fontWeight: 600,
              border: "none",
              cursor: loading ? "not-allowed" : "pointer",
              marginTop: 8,
            }}
          >
            {loading ? "가입 중..." : "회원가입"}
          </button>
        </form>

        <div style={{ textAlign: "center", fontSize: 12, color: "#6b7b9e", marginTop: 20 }}>
          이미 계정이 있으신가요?{" "}
          <a href="/login" style={{ color: "#4361ee", fontWeight: 500, textDecoration: "none" }}>
            로그인
          </a>
        </div>
      </div>
    </div>
  );
}
