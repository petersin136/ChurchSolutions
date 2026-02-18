"use client";

import { useState } from "react";
import type { Role } from "@/types/db";

const NAVY = "#1e3a5f";
const PERM_KEYS = ["members", "finance", "attendance", "reports", "settings", "donation_receipt"] as const;
const PERM_LABELS: Record<string, string> = {
  members: "교인관리",
  finance: "재정",
  attendance: "출결",
  reports: "보고서",
  settings: "설정",
  donation_receipt: "기부금영수증",
};

export interface RoleManagementProps {
  roles: Role[];
  onSaveRole: (role: Partial<Role>) => Promise<void>;
  onAddRole?: () => void;
}

function countPerms(permissions: Role["permissions"]) {
  let read = 0, write = 0, del = 0;
  Object.values(permissions || {}).forEach((p: { read?: boolean; write?: boolean; delete?: boolean }) => {
    if (p?.read) read++;
    if (p?.write) write++;
    if (p?.delete) del++;
  });
  return { read, write, delete: del };
}

export function RoleManagement({ roles, onSaveRole, onAddRole }: RoleManagementProps) {
  const [editing, setEditing] = useState<Role | null>(null);
  const [form, setForm] = useState<Role | null>(null);

  const startEdit = (r: Role) => {
    setEditing(r);
    setForm(JSON.parse(JSON.stringify(r)));
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold" style={{ color: NAVY }}>역할/권한</h3>
        {onAddRole && (
          <button type="button" onClick={onAddRole} className="px-4 py-2 rounded-xl text-white text-sm font-semibold hover:opacity-90" style={{ background: NAVY }}>
            + 새 역할
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {roles.sort((a, b) => a.sort_order - b.sort_order).map((r) => {
          const { read, write, delete: d } = countPerms(r.permissions);
          return (
            <div
              key={r.id}
              className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 hover:shadow-md transition"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-gray-800">{r.name}</span>
                {r.is_system && <span className="text-xs px-1.5 py-0.5 rounded bg-gray-200 text-gray-600">시스템</span>}
              </div>
              {r.description && <p className="text-xs text-gray-500 mb-2">{r.description}</p>}
              <p className="text-xs text-gray-400">읽기 {read} / 쓰기 {write} / 삭제 {d}</p>
              <button
                type="button"
                onClick={() => startEdit(r)}
                className="mt-2 text-sm font-medium hover:underline"
                style={{ color: NAVY }}
              >
                권한 수정
              </button>
            </div>
          );
        })}
      </div>

      {editing && form && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-lg p-6 max-w-2xl w-full my-8">
            <h4 className="font-semibold mb-4">권한 수정 — {form.name}</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 font-medium">항목</th>
                    <th className="text-center py-2 font-medium w-20">읽기</th>
                    <th className="text-center py-2 font-medium w-20">쓰기</th>
                    <th className="text-center py-2 font-medium w-20">삭제</th>
                  </tr>
                </thead>
                <tbody>
                  {PERM_KEYS.map((key) => {
                    const p = form.permissions[key] ?? {};
                    return (
                      <tr key={key} className="border-b border-gray-100 hover:bg-gray-50/50">
                        <td className="py-2">{PERM_LABELS[key] ?? key}</td>
                        <td className="text-center py-2">
                          <input
                            type="checkbox"
                            checked={!!p.read}
                            onChange={(e) =>
                              setForm((prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      permissions: {
                                        ...prev.permissions,
                                        [key]: { ...p, read: e.target.checked },
                                      },
                                    }
                                  : null
                              )
                            }
                            className="rounded border-gray-300"
                          />
                        </td>
                        <td className="text-center py-2">
                          {key !== "reports" && (
                            <input
                              type="checkbox"
                              checked={!!p.write}
                              onChange={(e) =>
                                setForm((prev) =>
                                  prev
                                    ? {
                                        ...prev,
                                        permissions: {
                                          ...prev.permissions,
                                          [key]: { ...p, write: e.target.checked },
                                        },
                                      }
                                    : null
                                )
                              }
                              className="rounded border-gray-300"
                            />
                          )}
                        </td>
                        <td className="text-center py-2">
                          {["members", "finance", "attendance"].includes(key) && (
                            <input
                              type="checkbox"
                              checked={!!p.delete}
                              onChange={(e) =>
                                setForm((prev) =>
                                  prev
                                    ? {
                                        ...prev,
                                        permissions: {
                                          ...prev.permissions,
                                          [key]: { ...p, delete: e.target.checked },
                                        },
                                      }
                                    : null
                                )
                              }
                              className="rounded border-gray-300"
                            />
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex gap-2 justify-end mt-4">
              <button type="button" onClick={() => setEditing(null)} className="px-4 py-2 rounded-lg border border-gray-200 text-sm">취소</button>
              <button
                type="button"
                onClick={async () => {
                  await onSaveRole({ ...form, id: editing.id });
                  setEditing(null);
                }}
                className="px-4 py-2 rounded-lg text-white text-sm font-medium hover:opacity-90"
                style={{ background: NAVY }}
              >
                저장
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
