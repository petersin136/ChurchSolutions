"use client";

import { useState } from "react";
import { C } from "@/styles/designTokens";

export interface MessagingSettingsProps {
  representativePhone: string;
  signature: string;
  smsPriceDisplay: string;
  onSave: (data: { representativePhone: string; signature: string; smsPriceDisplay: string }) => void;
  toast: (msg: string, type?: "ok" | "err" | "warn") => void;
}

export function MessagingSettings({
  representativePhone,
  signature,
  smsPriceDisplay,
  onSave,
  toast,
}: MessagingSettingsProps) {
  const [phone, setPhone] = useState(representativePhone);
  const [sig, setSig] = useState(signature);
  const [price, setPrice] = useState(smsPriceDisplay);

  const handleSave = () => {
    onSave({ representativePhone: phone, signature: sig, smsPriceDisplay: price });
    toast("설정이 저장되었습니다", "ok");
  };

  return (
    <div style={{ width: "100%", background: C.card, borderRadius: 16, border: `1px solid ${C.border}`, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.04)", display: "flex", flexDirection: "column", gap: 20 }}>
      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: C.navy }}>문자 설정</h3>
      <div>
        <label style={{ display: "block", fontSize: 14, fontWeight: 500, color: C.textMuted, marginBottom: 6 }}>교회 대표번호</label>
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="010-0000-0000"
          style={{ width: "100%", borderRadius: 10, border: `1px solid ${C.border}`, padding: "10px 12px", fontSize: 14 }}
        />
      </div>
      <div>
        <label style={{ display: "block", fontSize: 14, fontWeight: 500, color: C.textMuted, marginBottom: 6 }}>서명 (메시지 끝에 붙일 문구)</label>
        <input
          type="text"
          value={sig}
          onChange={(e) => setSig(e.target.value)}
          placeholder="○○교회 드림"
          style={{ width: "100%", borderRadius: 10, border: `1px solid ${C.border}`, padding: "10px 12px", fontSize: 14 }}
        />
      </div>
      <div>
        <label style={{ display: "block", fontSize: 14, fontWeight: 500, color: C.textMuted, marginBottom: 6 }}>SMS 단가 표시 (참고용)</label>
        <input
          type="text"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder="예: 12원/건"
          style={{ width: "100%", borderRadius: 10, border: `1px solid ${C.border}`, padding: "10px 12px", fontSize: 14 }}
        />
      </div>
      <button type="button" onClick={handleSave} style={{ padding: "10px 16px", borderRadius: 12, background: C.navy, color: "white", fontSize: 14, fontWeight: 600, border: "none", cursor: "pointer", alignSelf: "flex-start" }}>
        저장
      </button>
    </div>
  );
}
