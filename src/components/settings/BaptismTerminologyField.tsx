"use client";

import React from "react";
import type { BaptismTerminologySetting } from "@/lib/churchTerminology";
import {
  getBaptismTermLabels,
  inferBaptismTerminologyFromDenomination,
  resolveBaptismTerminology,
} from "@/lib/churchTerminology";
import settingsStyles from "@/components/ReportsSettingsPage.module.css";

const OPTIONS: { value: BaptismTerminologySetting; label: string; desc: string }[] = [
  { value: "auto", label: "교단명 기준 (자동)", desc: "교단에 '침례'가 포함되면 침례, 그 외 세례" },
  { value: "seryae", label: "세례", desc: "장로교·감리교 등 일반 표기" },
  { value: "chimrye", label: "침례", desc: "침례교 표기" },
];

export function BaptismTerminologyField({
  value,
  denomination,
  onChange,
}: {
  value?: BaptismTerminologySetting;
  denomination?: string;
  onChange: (value: BaptismTerminologySetting) => void;
}) {
  const selected = value ?? "auto";
  const resolved = resolveBaptismTerminology({ baptismTerminology: selected, denomination });
  const preview = getBaptismTermLabels({ baptismTerminology: selected, denomination });

  return (
    <fieldset style={{ border: 0, margin: 0, padding: 0 }}>
      <legend className={settingsStyles.toggleLabel} style={{ marginBottom: 8 }}>
        세례·침례 표기
      </legend>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {OPTIONS.map((opt) => {
          const id = `baptism-term-${opt.value}`;
          const checked = selected === opt.value;
          return (
            <label
              key={opt.value}
              htmlFor={id}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
                padding: "10px 12px",
                borderRadius: 7,
                border: `1px solid ${checked ? "var(--color-primary)" : "var(--pc-border)"}`,
                background: checked ? "var(--color-primary-soft, #eef2ff)" : "var(--pc-bg)",
                cursor: "pointer",
              }}
            >
              <input
                id={id}
                type="radio"
                name="baptismTerminology"
                value={opt.value}
                checked={checked}
                onChange={() => onChange(opt.value)}
                style={{ marginTop: 3 }}
              />
              <span style={{ minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 14, fontWeight: 600, color: "var(--pc-text)" }}>
                  {opt.label}
                </span>
                <span style={{ display: "block", fontSize: 13, color: "var(--pc-text-sub)", marginTop: 2, lineHeight: 1.4 }}>
                  {opt.desc}
                </span>
              </span>
            </label>
          );
        })}
      </div>
      <p className={settingsStyles.settingsHint} style={{ marginTop: 10 }}>
        {selected === "auto" ? (
          <>
            현재 교단명(
            {denomination?.trim() ? `"${denomination.trim()}"` : "미입력"}
            ) 기준으로 <strong>{preview.baptism}</strong> 표기가 적용됩니다.
            {denomination?.trim()
              ? null
              : ` 교단을 입력하면 ${inferBaptismTerminologyFromDenomination(denomination) === "chimrye" ? "침례" : "세례"}로 추론됩니다.`}
          </>
        ) : (
          <>교회 전체 화면·증서·교적·통계에 <strong>{resolved === "chimrye" ? "침례" : "세례"}</strong> 표기가 적용됩니다.</>
        )}
      </p>
    </fieldset>
  );
}
