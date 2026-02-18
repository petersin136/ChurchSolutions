"use client";

import { useState } from "react";
import { C } from "@/styles/designTokens";

export interface FrequentGroup {
  id: string;
  name: string;
  member_ids: string[];
}

export interface FrequentGroupsProps {
  groups: FrequentGroup[];
  onSave: (groups: FrequentGroup[]) => void;
}

export function FrequentGroups({ groups, onSave }: FrequentGroupsProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [addName, setAddName] = useState("");

  const handleAdd = () => {
    if (!addName.trim()) return;
    onSave([
      ...groups,
      { id: `fg-${Date.now()}`, name: addName.trim(), member_ids: [] },
    ]);
    setAddName("");
  };

  const handleDelete = (id: string) => {
    onSave(groups.filter((g) => g.id !== id));
    if (editingId === id) setEditingId(null);
  };

  const startEdit = (g: FrequentGroup) => {
    setEditingId(g.id);
    setEditName(g.name);
  };
  const saveEdit = () => {
    if (editingId && editName.trim()) {
      onSave(groups.map((g) => (g.id === editingId ? { ...g, name: editName.trim() } : g)));
      setEditingId(null);
      setEditName("");
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ background: C.card, borderRadius: 16, border: `1px solid ${C.border}`, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
          <input
            type="text"
            value={addName}
            onChange={(e) => setAddName(e.target.value)}
            placeholder="명단 이름"
            style={{ borderRadius: 10, border: `1px solid ${C.border}`, padding: "8px 12px", fontSize: 14, width: 192 }}
          />
          <button type="button" onClick={handleAdd} style={{ padding: "8px 16px", borderRadius: 12, background: C.navy, color: "white", fontSize: 14, fontWeight: 600, border: "none", cursor: "pointer" }}>
            + 추가
          </button>
        </div>
      </div>
      <div style={{ background: C.card, borderRadius: 16, border: `1px solid ${C.border}`, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
        {groups.length === 0 ? (
          <p style={{ padding: 32, textAlign: "center", color: C.textMuted, fontSize: 14 }}>자주 보내는 명단이 없습니다. 위에서 추가하세요.</p>
        ) : (
          groups.map((g) => (
            <div key={g.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: `1px solid ${C.borderLight}` }}>
              {editingId === g.id ? (
                <>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    style={{ borderRadius: 8, border: `1px solid ${C.border}`, padding: "6px 10px", fontSize: 14, flex: 1, maxWidth: 240 }}
                  />
                  <button type="button" onClick={saveEdit} style={{ marginLeft: 8, padding: "6px 12px", borderRadius: 8, background: C.navy, color: "white", fontSize: 14, border: "none", cursor: "pointer" }}>저장</button>
                  <button type="button" onClick={() => { setEditingId(null); setEditName(""); }} style={{ marginLeft: 4, padding: "6px 12px", borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 14, background: C.card, cursor: "pointer" }}>취소</button>
                </>
              ) : (
                <>
                  <span style={{ fontWeight: 600, color: C.navy }}>{g.name}</span>
                  <span className="text-xs text-gray-500">{g.member_ids?.length ?? 0}명</span>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => startEdit(g)} className="px-2 py-1 rounded border border-gray-200 text-xs">수정</button>
                    <button type="button" onClick={() => handleDelete(g.id)} className="px-2 py-1 rounded border border-red-200 text-red-600 text-xs">삭제</button>
                  </div>
                </>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
