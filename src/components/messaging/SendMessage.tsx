"use client";

import { useState, useMemo } from "react";
import type { DB } from "@/types/db";
import type { Member } from "@/types/db";

const SMS_MAX = 90;
const LMS_MAX = 2000;

export interface MessageLog {
  id: string;
  recipient_ids: string[];
  recipient_names: string;
  content: string;
  message_type: "SMS" | "LMS";
  sent_at: string;
  status: "저장됨" | "발송대기" | "발송완료" | "실패";
}

export interface SendMessageProps {
  members: Member[];
  onSend: (log: Omit<MessageLog, "id" | "sent_at" | "status">) => void;
}

export function SendMessage({ members, onSend }: SendMessageProps) {
  const [content, setContent] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("");
  const [groupFilter, setGroupFilter] = useState("");

  const byteLength = useMemo(() => {
    const enc = new TextEncoder();
    return enc.encode(content).length;
  }, [content]);
  const messageType = byteLength <= SMS_MAX ? "SMS" : "LMS";
  const maxByte = messageType === "SMS" ? SMS_MAX : LMS_MAX;
  const isOver = byteLength > maxByte;

  const filteredMembers = useMemo(() => {
    let list = members.filter((m) => m.phone && (m.member_status ?? m.status) !== "졸업/전출");
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((m) => (m.name ?? "").toLowerCase().includes(q));
    }
    if (deptFilter) list = list.filter((m) => m.dept === deptFilter);
    if (groupFilter) list = list.filter((m) => (m.mokjang ?? m.group) === groupFilter);
    return list;
  }, [members, search, deptFilter, groupFilter]);

  const depts = useMemo(() => Array.from(new Set(members.map((m) => m.dept).filter(Boolean))) as string[], [members]);
  const groups = useMemo(() => Array.from(new Set(members.map((m) => m.mokjang ?? m.group).filter(Boolean))) as string[], [members]);

  const toggle = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const selectAll = () => setSelectedIds(new Set(filteredMembers.map((m) => m.id)));
  const clearAll = () => setSelectedIds(new Set());

  const preview = content.replace(/\{이름\}/g, "홍길동");

  const handleSend = () => {
    if (selectedIds.size === 0 || isOver) return;
    const names = members.filter((m) => selectedIds.has(m.id)).map((m) => m.name).join(", ");
    onSend({
      recipient_ids: Array.from(selectedIds),
      recipient_names: names,
      content,
      message_type: messageType,
    });
    setContent("");
    setSelectedIds(new Set());
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <h3 className="text-sm font-semibold text-[#1e3a5f] mb-3">수신자 선택</h3>
          <div className="flex flex-wrap gap-2 mb-3">
            <input
              type="search"
              placeholder="이름 검색"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm w-40"
            />
            <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)} className="rounded-lg border border-gray-200 px-3 py-2 text-sm">
              <option value="">부서 전체</option>
              {depts.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
            <select value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)} className="rounded-lg border border-gray-200 px-3 py-2 text-sm">
              <option value="">목장 전체</option>
              {groups.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
            <button type="button" onClick={selectAll} className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm">전체 선택</button>
            <button type="button" onClick={clearAll} className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm">해제</button>
          </div>
          <div className="max-h-64 overflow-y-auto border border-gray-100 rounded-lg">
            {filteredMembers.map((m) => (
              <label key={m.id} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer border-b border-gray-50 last:border-0">
                <input type="checkbox" checked={selectedIds.has(m.id)} onChange={() => toggle(m.id)} className="rounded" />
                <span className="text-sm">{m.name}</span>
                <span className="text-xs text-gray-500">{m.dept}</span>
              </label>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-2">선택: {selectedIds.size}명</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <h3 className="text-sm font-semibold text-[#1e3a5f] mb-3">메시지 작성</h3>
          <p className="text-xs text-gray-500 mb-1">&#123;이름&#125; 입력 시 수신자별 이름으로 치환됩니다. · SMS 90바이트 / LMS 2000바이트</p>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="내용을 입력하세요..."
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm min-h-[120px] resize-y"
            maxLength={LMS_MAX + 500}
          />
          <div className={`text-sm mt-1 ${isOver ? "text-red-600" : "text-gray-500"}`}>
            {byteLength} / {maxByte} byte ({messageType})
          </div>
          <div className="mt-3 p-3 bg-gray-50 rounded-lg text-sm text-gray-700">
            <p className="font-medium text-gray-600 mb-1">미리보기</p>
            <p className="whitespace-pre-wrap">{preview || "(내용 없음)"}</p>
          </div>
          <button
            type="button"
            onClick={handleSend}
            disabled={selectedIds.size === 0 || isOver}
            className="mt-4 px-4 py-2 rounded-xl bg-[#1e3a5f] text-white text-sm font-semibold disabled:opacity-50"
          >
            발송 (저장)
          </button>
        </div>
      </div>
    </div>
  );
}
