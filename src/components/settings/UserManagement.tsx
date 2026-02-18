"use client";

import { useState } from "react";
import type { UserRole, Role, Member } from "@/types/db";

const NAVY = "#1e3a5f";

export interface UserManagementProps {
  userRoles: (UserRole & { role?: Role; member?: Member })[];
  roles: Role[];
  members: Member[];
  onSaveUserRole: (userRole: Partial<UserRole>) => Promise<void>;
}

export function UserManagement({ userRoles, roles, members, onSaveUserRole }: UserManagementProps) {
  const [selected, setSelected] = useState<(UserRole & { role?: Role; member?: Member }) | null>(null);
  const [roleId, setRoleId] = useState("");
  const [memberId, setMemberId] = useState("");
  const [assignedOrgs, setAssignedOrgs] = useState<string[]>([]);

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold" style={{ color: NAVY }}>사용자 관리</h3>
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50/50">
              <th className="text-left py-3 px-4 font-semibold text-gray-700">이름</th>
              <th className="text-left py-3 px-4 font-semibold text-gray-700">역할</th>
              <th className="text-left py-3 px-4 font-semibold text-gray-700">담당 조직</th>
              <th className="text-left py-3 px-4 font-semibold text-gray-700">등록일</th>
              <th className="w-20" />
            </tr>
          </thead>
          <tbody>
            {userRoles.length === 0 ? (
              <tr><td colSpan={5} className="py-8 text-center text-gray-500">등록된 사용자가 없습니다.</td></tr>
            ) : (
              userRoles.map((ur) => (
                <tr key={ur.id} className="border-b border-gray-100 hover:bg-gray-50/50">
                  <td className="py-3 px-4">{ur.member?.name ?? ur.user_id.slice(0, 8)}</td>
                  <td className="py-3 px-4">{ur.role?.name ?? "-"}</td>
                  <td className="py-3 px-4 text-gray-600">{(ur.assigned_organizations?.length ?? 0) > 0 ? `${ur.assigned_organizations?.length}개` : "-"}</td>
                  <td className="py-3 px-4 text-gray-500">{ur.assigned_at ? new Date(ur.assigned_at).toLocaleDateString("ko-KR") : "-"}</td>
                  <td className="py-3 px-4">
                    <button type="button" onClick={() => { setSelected(ur); setRoleId(ur.role_id); setMemberId(ur.member_id ?? ""); setAssignedOrgs(ur.assigned_organizations ?? []); }} className="text-xs font-medium hover:underline" style={{ color: NAVY }}>수정</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {selected && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg p-6 max-w-md w-full">
            <h4 className="font-semibold mb-4">사용자 역할 수정</h4>
            <label className="block text-sm font-medium text-gray-700 mb-1">역할</label>
            <select value={roleId} onChange={(e) => setRoleId(e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm mb-3">
              {roles.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
            <label className="block text-sm font-medium text-gray-700 mb-1">연결 교인</label>
            <select value={memberId} onChange={(e) => setMemberId(e.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm mb-4">
              <option value="">선택</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>{m.name} {m.dept ? `(${m.dept})` : ""}</option>
              ))}
            </select>
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setSelected(null)} className="px-4 py-2 rounded-lg border border-gray-200 text-sm">취소</button>
              <button
                type="button"
                onClick={async () => {
                  await onSaveUserRole({ id: selected.id, role_id: roleId, member_id: memberId || undefined, assigned_organizations: assignedOrgs });
                  setSelected(null);
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
