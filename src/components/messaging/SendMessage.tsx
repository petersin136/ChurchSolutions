"use client";

import { useState, useMemo, useEffect } from "react";
import type { Member } from "@/types/db";
import { supabase } from "@/lib/supabase";
import { C } from "@/styles/designTokens";

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
  toast?: (msg: string, type?: "ok" | "err" | "warn") => void;
}

export function SendMessage({ members, onSend, toast }: SendMessageProps) {
  const [content, setContent] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("");
  const [groupFilter, setGroupFilter] = useState("");
  const [searchMembers, setSearchMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  const byteLength = useMemo(() => {
    const enc = new TextEncoder();
    return enc.encode(content).length;
  }, [content]);
  const messageType = byteLength <= SMS_MAX ? "SMS" : "LMS";
  const maxByte = messageType === "SMS" ? SMS_MAX : LMS_MAX;
  const isOver = byteLength > maxByte;

  useEffect(() => {
    if (!supabase) return;
    const hasFilter = search.trim() || deptFilter || groupFilter;
    if (!hasFilter) {
      setSearchMembers([]);
      return;
    }
    setLoading(true);
    let q = supabase.from("members").select("id, name, phone, dept, mokjang, group, member_status, status").not("phone", "is", null);
    if (search.trim()) q = q.ilike("name", `%${search.trim()}%`);
    if (deptFilter) q = q.eq("dept", deptFilter);
    if (groupFilter) q = q.or(`mokjang.eq.${groupFilter},group.eq.${groupFilter}`);
    q.then(({ data, error }) => {
      if (error && toast) toast("수신자 검색 실패: " + error.message, "err");
      setSearchMembers((data as Member[]) ?? []);
    }).finally(() => setLoading(false));
  }, [search, deptFilter, groupFilter, toast]);

  const sourceList = useMemo(() => {
    const fromSearch = search.trim() || deptFilter || groupFilter ? searchMembers : members;
    return fromSearch.filter((m) => m.phone && (m.member_status ?? m.status) !== "졸업/전출");
  }, [members, search, deptFilter, groupFilter, searchMembers]);

  const depts = useMemo(() => Array.from(new Set([...members, ...searchMembers].map((m) => m.dept).filter(Boolean))) as string[], [members, searchMembers]);
  const groups = useMemo(() => Array.from(new Set([...members, ...searchMembers].map((m) => m.mokjang ?? m.group).filter(Boolean))) as string[], [members, searchMembers]);

  const toggle = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const selectAll = () => setSelectedIds(new Set(sourceList.map((m) => m.id)));
  const clearAll = () => setSelectedIds(new Set());

  const preview = content.replace(/\{이름\}/g, "홍길동");

  const handleSend = async () => {
    if (selectedIds.size === 0 || isOver) return;
    const names = sourceList.filter((m) => selectedIds.has(m.id)).map((m) => m.name).join(", ");
    const payload = {
      recipient_ids: Array.from(selectedIds),
      recipient_names: names,
      content,
      message_type: messageType,
    };
    if (supabase) {
      setSending(true);
      const { error } = await supabase.from("message_logs").insert({
        recipient_ids: payload.recipient_ids,
        recipient_names: payload.recipient_names,
        content: payload.content,
        message_type: payload.message_type,
        status: "저장됨",
      });
      if (error) {
        if (toast) toast("저장 실패: " + error.message, "err");
        setSending(false);
        return;
      }
      if (toast) toast("발송 내역에 저장되었습니다.", "ok");
    }
    onSend(payload);
    setContent("");
    setSelectedIds(new Set());
    setSending(false);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div style={{ background: C.card, borderRadius: 16, border: `1px solid ${C.border}`, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
          <h3 style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 600, color: C.navy }}>수신자 선택</h3>
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
          <div style={{ maxHeight: 256, overflowY: "auto", border: `1px solid ${C.border}`, borderRadius: 12 }}>
            {loading ? <p style={{ padding: 12, color: C.textMuted, fontSize: 13 }}>검색 중...</p> : sourceList.map((m) => (
              <label key={m.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", cursor: "pointer", borderBottom: `1px solid ${C.borderLight}` }} className="hover:bg-opacity-80" onMouseEnter={(e) => { e.currentTarget.style.background = C.bg; }} onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
                <input type="checkbox" checked={selectedIds.has(m.id)} onChange={() => toggle(m.id)} className="rounded" />
                <span className="text-sm">{m.name}</span>
                <span className="text-xs text-gray-500">{m.dept}</span>
              </label>
            ))}
          </div>
          <p style={{ fontSize: 12, color: C.textMuted, marginTop: 8 }}>선택: {selectedIds.size}명</p>
        </div>

        <div style={{ background: C.card, borderRadius: 16, border: `1px solid ${C.border}`, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
          <h3 style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 600, color: C.navy }}>메시지 작성</h3>
          <p style={{ fontSize: 12, color: C.textMuted, marginBottom: 8 }}>&#123;이름&#125; 입력 시 수신자별 이름으로 치환됩니다. · SMS 90바이트 / LMS 2000바이트</p>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="내용을 입력하세요..."
            style={{ width: "100%", borderRadius: 10, border: `1px solid ${C.border}`, padding: "10px 12px", fontSize: 14, minHeight: 120, resize: "vertical" }}
            maxLength={LMS_MAX + 500}
          />
          <div style={{ fontSize: 14, marginTop: 8, color: isOver ? C.danger : C.textMuted }}>
            {byteLength} / {maxByte} byte ({messageType})
          </div>
          <div style={{ marginTop: 12, padding: 12, background: C.bg, borderRadius: 12, fontSize: 14, color: C.text }}>
            <p style={{ fontWeight: 500, color: C.textMuted, marginBottom: 4 }}>미리보기</p>
            <p className="whitespace-pre-wrap">{preview || "(내용 없음)"}</p>
          </div>
          <button
            type="button"
            onClick={handleSend}
            disabled={selectedIds.size === 0 || isOver || sending}
            style={{ marginTop: 16, padding: "10px 16px", borderRadius: 12, background: C.navy, color: "white", fontSize: 14, fontWeight: 600, opacity: selectedIds.size === 0 || isOver || sending ? 0.5 : 1, cursor: selectedIds.size === 0 || isOver || sending ? "not-allowed" : "pointer", border: "none" }}
          >
            {sending ? "저장 중…" : "발송 (저장)"}
          </button>
        </div>
      </div>
    </div>
  );
}
