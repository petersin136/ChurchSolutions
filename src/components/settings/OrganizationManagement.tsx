"use client";

import { useState, useMemo } from "react";
import type { Organization, OrganizationMember, Member } from "@/types/db";

const ORG_TYPES = ["교구", "구역", "목장", "속", "전도회", "선교회", "부서", "기타"] as const;
const NAVY = "#1e3a5f";

export interface OrganizationManagementProps {
  organizations: Organization[];
  organizationMembers: OrganizationMember[];
  members: Member[];
  onSaveOrganization: (org: Partial<Organization>) => Promise<void>;
  onDeleteOrganization: (id: string) => Promise<void>;
  onAddMemberToOrg: (organizationId: string, memberId: string, roleInOrg?: string) => Promise<void>;
  onRemoveMemberFromOrg: (organizationId: string, memberId: string) => Promise<void>;
}

function buildTree(orgs: Organization[], parentId: string | null): Organization[] {
  return orgs
    .filter((o) => (o.parent_id ?? null) === parentId)
    .sort((a, b) => a.sort_order - b.sort_order);
}

export function OrganizationManagement({
  organizations,
  organizationMembers,
  members,
  onSaveOrganization,
  onDeleteOrganization,
  onAddMemberToOrg,
  onRemoveMemberFromOrg,
}: OrganizationManagementProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [addOrgOpen, setAddOrgOpen] = useState(false);
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [newOrg, setNewOrg] = useState({ name: "", type: "목장" as const, parent_id: "" as string });
  const [newMemberSelect, setNewMemberSelect] = useState("");
  const [newMemberRole, setNewMemberRole] = useState("");

  const rootOrgs = useMemo(() => buildTree(organizations, null), [organizations]);
  const selected = useMemo(() => organizations.find((o) => o.id === selectedId), [organizations, selectedId]);
  const selectedMembers = useMemo(
    () =>
      selectedId
        ? organizationMembers.filter((om) => om.organization_id === selectedId && om.is_active)
        : [],
    [organizationMembers, selectedId]
  );
  const memberNames = useMemo(() => new Map(members.map((m) => [m.id, m.name])), [members]);

  function renderTree(items: Organization[], depth: number) {
    return items.map((o) => {
      const children = buildTree(organizations, o.id);
      const count = organizationMembers.filter((om) => om.organization_id === o.id && om.is_active).length;
      return (
        <div key={o.id} style={{ marginLeft: depth * 16 }}>
          <button
            type="button"
            onClick={() => setSelectedId(o.id)}
            className="w-full text-left py-2 px-3 rounded-lg hover:bg-gray-100 flex items-center gap-2"
            style={{ borderLeft: selectedId === o.id ? `3px solid ${NAVY}` : "3px solid transparent" }}
          >
            <span className="font-medium">{o.name}</span>
            <span className="text-xs px-1.5 py-0.5 rounded bg-gray-200 text-gray-600">{o.type}</span>
            {o.leader_name && <span className="text-xs text-gray-500">{o.leader_name}</span>}
            <span className="text-xs text-gray-400 ml-auto">{count}명</span>
          </button>
          {children.length > 0 && renderTree(children, depth + 1)}
        </div>
      );
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold" style={{ color: NAVY }}>조직 관리</h3>
        <button
          type="button"
          onClick={() => setAddOrgOpen(true)}
          className="px-4 py-2 rounded-xl text-white text-sm font-semibold hover:opacity-90"
          style={{ background: NAVY }}
        >
          + 조직 추가
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 max-h-[60vh] overflow-y-auto">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">조직 트리</h4>
          {rootOrgs.length === 0 ? (
            <p className="text-sm text-gray-500">등록된 조직이 없습니다.</p>
          ) : (
            renderTree(rootOrgs, 0)
          )}
        </div>

        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          {selected ? (
            <>
              <h4 className="text-sm font-semibold text-gray-700 mb-3">{selected.name} 상세</h4>
              <div className="space-y-2 text-sm mb-4">
                <p><span className="text-gray-500">유형</span> {selected.type}</p>
                {selected.leader_name && <p><span className="text-gray-500">담당자</span> {selected.leader_name}</p>}
                {selected.description && <p><span className="text-gray-500">설명</span> {selected.description}</p>}
              </div>
              <h5 className="text-xs font-semibold text-gray-600 mb-2">소속 교인</h5>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 font-medium">이름</th>
                    <th className="text-left py-2 font-medium">역할</th>
                    <th className="w-20" />
                  </tr>
                </thead>
                <tbody>
                  {selectedMembers.map((om) => (
                    <tr key={om.id} className="border-b border-gray-100">
                      <td className="py-2">{memberNames.get(om.member_id) ?? "-"}</td>
                      <td className="py-2 text-gray-600">{om.role_in_org ?? "-"}</td>
                      <td className="py-2">
                        <button
                          type="button"
                          onClick={() => onRemoveMemberFromOrg(selected.id, om.member_id)}
                          className="text-xs text-red-600 hover:underline"
                        >
                          제거
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button
                type="button"
                onClick={() => setAddMemberOpen(true)}
                className="mt-3 px-3 py-1.5 rounded-lg border border-gray-200 text-sm font-medium hover:bg-gray-50"
              >
                + 교인 추가
              </button>
            </>
          ) : (
            <p className="text-sm text-gray-500">좌측에서 조직을 선택하세요.</p>
          )}
        </div>
      </div>

      {addOrgOpen && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg p-6 max-w-md w-full">
            <h4 className="font-semibold mb-4">새 조직</h4>
            <input
              type="text"
              placeholder="이름"
              value={newOrg.name}
              onChange={(e) => setNewOrg((p) => ({ ...p, name: e.target.value }))}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm mb-3"
            />
            <select
              value={newOrg.type}
              onChange={(e) => setNewOrg((p) => ({ ...p, type: e.target.value as typeof newOrg.type }))}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm mb-3"
            >
              {ORG_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <select
              value={newOrg.parent_id}
              onChange={(e) => setNewOrg((p) => ({ ...p, parent_id: e.target.value }))}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm mb-4"
            >
              <option value="">상위 없음</option>
              {organizations.map((o) => (
                <option key={o.id} value={o.id}>{o.name} ({o.type})</option>
              ))}
            </select>
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setAddOrgOpen(false)} className="px-4 py-2 rounded-lg border border-gray-200 text-sm">취소</button>
              <button
                type="button"
                onClick={async () => {
                  await onSaveOrganization({ ...newOrg, parent_id: newOrg.parent_id || undefined });
                  setAddOrgOpen(false);
                  setNewOrg({ name: "", type: "목장", parent_id: "" });
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

      {addMemberOpen && selectedId && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg p-6 max-w-md w-full">
            <h4 className="font-semibold mb-4">교인 추가</h4>
            <select
              value={newMemberSelect}
              onChange={(e) => setNewMemberSelect(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm mb-3"
            >
              <option value="">선택</option>
              {members.filter((m) => !selectedMembers.some((om) => om.member_id === m.id)).map((m) => (
                <option key={m.id} value={m.id}>{m.name} {m.dept ? `(${m.dept})` : ""}</option>
              ))}
            </select>
            <input
              type="text"
              placeholder="역할 (조장, 부조장 등)"
              value={newMemberRole}
              onChange={(e) => setNewMemberRole(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm mb-4"
            />
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setAddMemberOpen(false)} className="px-4 py-2 rounded-lg border border-gray-200 text-sm">취소</button>
              <button
                type="button"
                onClick={async () => {
                  if (newMemberSelect) {
                    await onAddMemberToOrg(selectedId, newMemberSelect, newMemberRole || undefined);
                    setAddMemberOpen(false);
                    setNewMemberSelect("");
                    setNewMemberRole("");
                  }
                }}
                className="px-4 py-2 rounded-lg text-white text-sm font-medium hover:opacity-90"
                style={{ background: NAVY }}
              >
                추가
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
