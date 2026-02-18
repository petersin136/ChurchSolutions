"use client";

import { useState, useCallback } from "react";
import type { ServiceType } from "@/types/db";

const DAYS = [
  { value: 0, label: "일" },
  { value: 1, label: "월" },
  { value: 2, label: "화" },
  { value: 3, label: "수" },
  { value: 4, label: "목" },
  { value: 5, label: "금" },
  { value: 6, label: "토" },
];

export interface ServiceTypeSettingsProps {
  serviceTypes: ServiceType[];
  onSave: (list: ServiceType[]) => Promise<void>;
}

export function ServiceTypeSettings({ serviceTypes, onSave }: ServiceTypeSettingsProps) {
  const [list, setList] = useState<ServiceType[]>(() => [...serviceTypes].sort((a, b) => a.sort_order - b.sort_order));
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const update = useCallback((id: string, patch: Partial<ServiceType>) => {
    setList((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }, []);

  const add = useCallback(() => {
    const newOne: ServiceType = {
      id: `new-${Date.now()}`,
      name: "새 예배",
      day_of_week: 0,
      default_time: "09:00",
      is_active: true,
      sort_order: list.length,
    };
    setList((prev) => [...prev, newOne]);
    setEditingId(newOne.id);
  }, [list.length]);

  const remove = useCallback((id: string) => {
    setList((prev) => prev.filter((s) => s.id !== id));
    if (editingId === id) setEditingId(null);
  }, [editingId]);

  const move = useCallback((id: string, dir: "up" | "down") => {
    setList((prev) => {
      const i = prev.findIndex((s) => s.id === id);
      if (i < 0) return prev;
      const j = dir === "up" ? i - 1 : i + 1;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next.map((s, idx) => ({ ...s, sort_order: idx }));
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const toSave = list.map((s, idx) => ({ ...s, sort_order: idx }));
      await onSave(toSave);
      setEditingId(null);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-[#1e3a5f]">예배 유형 설정</h3>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={add}
            className="px-4 py-2 rounded-xl border border-[#1e3a5f] text-[#1e3a5f] text-sm font-semibold hover:bg-[#1e3a5f]/5"
          >
            + 추가
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 rounded-xl bg-[#1e3a5f] text-white text-sm font-semibold hover:opacity-90 disabled:opacity-60"
          >
            {saving ? "저장 중..." : "저장"}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50/50">
              <th className="text-left py-3 px-4 font-semibold text-[#1e3a5f] w-8">순서</th>
              <th className="text-left py-3 px-4 font-semibold text-[#1e3a5f]">이름</th>
              <th className="text-left py-3 px-4 font-semibold text-[#1e3a5f]">요일</th>
              <th className="text-left py-3 px-4 font-semibold text-[#1e3a5f]">시간</th>
              <th className="text-center py-3 px-4 font-semibold text-[#1e3a5f]">활성</th>
              <th className="text-center py-3 px-4 font-semibold text-[#1e3a5f]">액션</th>
            </tr>
          </thead>
          <tbody>
            {list.map((s, idx) => (
              <tr key={s.id} className="border-b border-gray-100 hover:bg-gray-50/50">
                <td className="py-3 px-4">
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => move(s.id, "up")}
                      disabled={idx === 0}
                      className="p-1 rounded border border-gray-200 text-gray-500 hover:bg-gray-100 disabled:opacity-40"
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      onClick={() => move(s.id, "down")}
                      disabled={idx === list.length - 1}
                      className="p-1 rounded border border-gray-200 text-gray-500 hover:bg-gray-100 disabled:opacity-40"
                    >
                      ▼
                    </button>
                  </div>
                </td>
                <td className="py-3 px-4">
                  <input
                    type="text"
                    value={s.name}
                    onChange={(e) => update(s.id, { name: e.target.value })}
                    className="w-full max-w-[160px] rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
                  />
                </td>
                <td className="py-3 px-4">
                  <select
                    value={s.day_of_week ?? ""}
                    onChange={(e) => update(s.id, { day_of_week: e.target.value === "" ? undefined : Number(e.target.value) })}
                    className="rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
                  >
                    <option value="">-</option>
                    {DAYS.map((d) => (
                      <option key={d.value} value={d.value}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="py-3 px-4">
                  <input
                    type="time"
                    value={typeof s.default_time === "string" ? s.default_time.slice(0, 5) : ""}
                    onChange={(e) => update(s.id, { default_time: e.target.value })}
                    className="rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
                  />
                </td>
                <td className="py-3 px-4 text-center">
                  <label className="inline-flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={s.is_active !== false}
                      onChange={(e) => update(s.id, { is_active: e.target.checked })}
                      className="rounded border-gray-300"
                    />
                    <span className="text-xs text-gray-600">활성</span>
                  </label>
                </td>
                <td className="py-3 px-4">
                  <button
                    type="button"
                    onClick={() => remove(s.id)}
                    className="px-2 py-1 rounded border border-red-200 text-red-600 text-xs hover:bg-red-50"
                  >
                    삭제
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {list.length === 0 && (
        <p className="text-sm text-gray-500 py-4">예배 유형이 없습니다. &quot;+ 추가&quot;로 등록하세요.</p>
      )}
    </div>
  );
}
