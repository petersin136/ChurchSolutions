"use client";

import { useState, useEffect } from "react";
import type { CustomLabel } from "@/types/db";

const NAVY = "#1e3a5f";
const DEFAULT_LABELS = ["구역", "목장", "속", "교구", "전도회", "선교회", "장로", "집사", "권사"];

export interface CustomLabelSettingsProps {
  customLabels: CustomLabel[];
  onSave: (labels: CustomLabel[]) => Promise<void>;
}

export function CustomLabelSettings({ customLabels, onSave }: CustomLabelSettingsProps) {
  const [local, setLocal] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const map: Record<string, string> = {};
    DEFAULT_LABELS.forEach((d) => { map[d] = d; });
    customLabels.forEach((l) => { map[l.default_label] = l.custom_label; });
    setLocal(map);
  }, [customLabels]);

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold" style={{ color: NAVY }}>명칭 설정</h3>
      <p className="text-sm text-gray-500">앱 전체에서 사용할 우리 교회 명칭을 입력하세요. 비우면 기본 명칭이 표시됩니다.</p>
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50/50">
              <th className="text-left py-3 px-4 font-semibold text-gray-700">기본 명칭</th>
              <th className="text-left py-3 px-4 font-semibold text-gray-700">우리 교회 명칭</th>
            </tr>
          </thead>
          <tbody>
            {DEFAULT_LABELS.map((key) => (
              <tr key={key} className="border-b border-gray-100">
                <td className="py-3 px-4 text-gray-600">{key}</td>
                <td className="py-3 px-4">
                  <input
                    type="text"
                    value={local[key] ?? key}
                    onChange={(e) => setLocal((p) => ({ ...p, [key]: e.target.value }))}
                    placeholder={key}
                    className="w-full max-w-xs rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        type="button"
        disabled={saving}
        onClick={async () => {
          setSaving(true);
          const labels: CustomLabel[] = DEFAULT_LABELS.map((default_label) => ({
            id: "",
            default_label,
            custom_label: local[default_label]?.trim() || default_label,
          }));
          await onSave(labels);
          setSaving(false);
        }}
        className="px-4 py-2 rounded-xl text-white text-sm font-semibold hover:opacity-90 disabled:opacity-60"
        style={{ background: NAVY }}
      >
        {saving ? "저장 중..." : "저장"}
      </button>
    </div>
  );
}
