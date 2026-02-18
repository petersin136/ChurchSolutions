"use client";

import { useState } from "react";

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
    <div className="max-w-lg space-y-4 bg-white rounded-xl border border-gray-100 p-6">
      <h3 className="text-lg font-semibold text-[#1e3a5f]">문자 설정</h3>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">교회 대표번호</label>
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="010-0000-0000"
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">서명 (메시지 끝에 붙일 문구)</label>
        <input
          type="text"
          value={sig}
          onChange={(e) => setSig(e.target.value)}
          placeholder="○○교회 드림"
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">SMS 단가 표시 (참고용)</label>
        <input
          type="text"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder="예: 12원/건"
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
        />
      </div>
      <button type="button" onClick={handleSave} className="px-4 py-2 rounded-xl bg-[#1e3a5f] text-white text-sm font-semibold">
        저장
      </button>
    </div>
  );
}
