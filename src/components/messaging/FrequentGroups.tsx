"use client";

import { useState } from "react";

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
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={addName}
          onChange={(e) => setAddName(e.target.value)}
          placeholder="명단 이름"
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm w-48"
        />
        <button type="button" onClick={handleAdd} className="px-4 py-2 rounded-xl bg-[#1e3a5f] text-white text-sm font-semibold">
          + 추가
        </button>
      </div>
      <div className="bg-white rounded-xl border border-gray-100 divide-y divide-gray-100">
        {groups.length === 0 ? (
          <p className="py-8 text-center text-gray-500 text-sm">자주 보내는 명단이 없습니다. 위에서 추가하세요.</p>
        ) : (
          groups.map((g) => (
            <div key={g.id} className="flex items-center justify-between px-4 py-3">
              {editingId === g.id ? (
                <>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="rounded-lg border border-gray-200 px-2 py-1 text-sm flex-1 max-w-xs"
                  />
                  <button type="button" onClick={saveEdit} className="ml-2 px-3 py-1 rounded-lg bg-[#1e3a5f] text-white text-sm">저장</button>
                  <button type="button" onClick={() => { setEditingId(null); setEditName(""); }} className="ml-1 px-3 py-1 rounded-lg border border-gray-200 text-sm">취소</button>
                </>
              ) : (
                <>
                  <span className="font-medium text-[#1e3a5f]">{g.name}</span>
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
