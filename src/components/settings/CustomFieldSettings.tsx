"use client";

import { useState } from "react";
import type { CustomField } from "@/types/db";

const NAVY = "#1e3a5f";
const TARGETS = [{ id: "members", label: "교인정보" }, { id: "income", label: "수입" }, { id: "expense", label: "지출" }] as const;
const FIELD_TYPES: { value: CustomField["field_type"]; label: string }[] = [
  { value: "text", label: "텍스트" },
  { value: "number", label: "숫자" },
  { value: "date", label: "날짜" },
  { value: "select", label: "선택" },
  { value: "checkbox", label: "체크박스" },
  { value: "textarea", label: "긴 글" },
];

export interface CustomFieldSettingsProps {
  customFields: CustomField[];
  onSave: (field: Partial<CustomField>) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
}

export function CustomFieldSettings({ customFields, onSave, onDelete }: CustomFieldSettingsProps) {
  const [target, setTarget] = useState<"members" | "income" | "expense">("members");
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ field_name: "", field_label: "", field_type: "text" as CustomField["field_type"], options: "", is_required: false });

  const filtered = customFields.filter((f) => f.target_table === target);

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold" style={{ color: NAVY }}>커스텀 필드</h3>
      <div className="flex gap-2 border-b border-gray-200 pb-2">
        {TARGETS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTarget(t.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${target === t.id ? "text-white" : "text-gray-600 hover:bg-gray-100"}`}
            style={target === t.id ? { background: NAVY } : {}}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="flex justify-end">
        <button type="button" onClick={() => setAddOpen(true)} className="px-4 py-2 rounded-xl text-white text-sm font-semibold hover:opacity-90" style={{ background: NAVY }}>
          + 필드 추가
        </button>
      </div>
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50/50">
              <th className="text-left py-3 px-4 font-semibold text-gray-700">필드명</th>
              <th className="text-left py-3 px-4 font-semibold text-gray-700">표시명</th>
              <th className="text-left py-3 px-4 font-semibold text-gray-700">타입</th>
              <th className="text-center py-3 px-4 font-semibold text-gray-700">필수</th>
              <th className="text-center py-3 px-4 font-semibold text-gray-700">활성</th>
              <th className="w-20" />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={6} className="py-8 text-center text-gray-500">정의된 필드가 없습니다.</td></tr>
            ) : (
              filtered.map((f) => (
                <tr key={f.id} className="border-b border-gray-100">
                  <td className="py-3 px-4 font-mono text-gray-700">{f.field_name}</td>
                  <td className="py-3 px-4">{f.field_label}</td>
                  <td className="py-3 px-4 text-gray-600">{FIELD_TYPES.find(t => t.value === f.field_type)?.label ?? f.field_type}</td>
                  <td className="py-3 px-4 text-center">{f.is_required ? "✓" : "-"}</td>
                  <td className="py-3 px-4 text-center">{f.is_active !== false ? "✓" : "-"}</td>
                  <td className="py-3 px-4">{onDelete && <button type="button" onClick={() => onDelete(f.id)} className="text-xs text-red-600 hover:underline">삭제</button>}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {addOpen && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg p-6 max-w-md w-full">
            <h4 className="font-semibold mb-4">필드 추가</h4>
            <input type="text" placeholder="필드명 (영문)" value={form.field_name} onChange={(e) => setForm((p) => ({ ...p, field_name: e.target.value }))} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm mb-3" />
            <input type="text" placeholder="표시명 (한글)" value={form.field_label} onChange={(e) => setForm((p) => ({ ...p, field_label: e.target.value }))} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm mb-3" />
            <select value={form.field_type} onChange={(e) => setForm((p) => ({ ...p, field_type: e.target.value as CustomField["field_type"] }))} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm mb-3">
              {FIELD_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            {form.field_type === "select" && <input type="text" placeholder="옵션 (쉼표 구분)" value={form.options} onChange={(e) => setForm((p) => ({ ...p, options: e.target.value }))} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm mb-3" />}
            <label className="flex items-center gap-2 text-sm mb-4"><input type="checkbox" checked={form.is_required} onChange={(e) => setForm((p) => ({ ...p, is_required: e.target.checked }))} /> 필수</label>
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setAddOpen(false)} className="px-4 py-2 rounded-lg border border-gray-200 text-sm">취소</button>
              <button type="button" onClick={async () => { await onSave({ ...form, target_table: target, options: form.options ? form.options.split(",").map(s => s.trim()).filter(Boolean) : undefined }); setAddOpen(false); setForm({ field_name: "", field_label: "", field_type: "text", options: "", is_required: false }); }} className="px-4 py-2 rounded-lg text-white text-sm font-medium hover:opacity-90" style={{ background: NAVY }}>저장</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
