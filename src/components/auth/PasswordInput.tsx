"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

const passwordInputStyle: React.CSSProperties = {
  width: "100%",
  height: 52,
  padding: "0 44px 0 16px",
  borderRadius: 4,
  border: "1px solid transparent",
  background: "#ebebeb",
  color: "var(--color-black)",
  fontSize: 15,
  outline: "none",
  boxSizing: "border-box",
};

type PasswordInputProps = {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  required?: boolean;
  autoComplete?: string;
  className?: string;
  style?: React.CSSProperties;
};

export function PasswordInput({
  value,
  onChange,
  placeholder,
  required,
  autoComplete = "new-password",
  className = "cu-input",
  style,
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div style={{ position: "relative", width: "100%" }}>
      <input
        className={className}
        type={visible ? "text" : "password"}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        autoComplete={autoComplete}
        style={{ ...passwordInputStyle, ...style }}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "비밀번호 숨기기" : "비밀번호 표시"}
        style={{
          position: "absolute",
          right: 0,
          top: 0,
          height: 52,
          width: 44,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "none",
          border: "none",
          cursor: "pointer",
          color: "var(--color-text-muted)",
          padding: 0,
        }}
      >
        {visible ? <EyeOff size={18} strokeWidth={1.75} /> : <Eye size={18} strokeWidth={1.75} />}
      </button>
    </div>
  );
}
