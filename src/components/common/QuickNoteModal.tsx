"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { FileText, Heart, X } from "lucide-react";
import { supabase } from "@/lib/supabase";

const todayStr = () => new Date().toISOString().slice(0, 10);

export interface QuickNoteItem {
  id: string | number;
  date: string;
  content: string;
  created_at: string;
}

export interface QuickNoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  memberName: string;
  memberId: string;
  churchId: string;
  type: "note" | "prayer";
  onSaved?: (memberId: string, type: "memo" | "prayer", items: QuickNoteItem[], latestPrayerContent?: string) => void;
}

export function QuickNoteModal({
  isOpen,
  onClose,
  title,
  memberName,
  memberId,
  churchId,
  type,
  onSaved,
}: QuickNoteModalProps) {
  const [newContent, setNewContent] = useState("");
  const [items, setItems] = useState<QuickNoteItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<string | number | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const mouseDownInsideRef = useRef(false);

  const noteType = type === "prayer" ? "prayer" : "memo";

  const handleBackdropMouseDown = (e: React.MouseEvent) => {
    if (modalRef.current && modalRef.current.contains(e.target as Node)) {
      mouseDownInsideRef.current = true;
    } else {
      mouseDownInsideRef.current = false;
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (mouseDownInsideRef.current) {
      mouseDownInsideRef.current = false;
      return;
    }
    if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
      onClose();
    }
  };

  const fetchList = useCallback(async () => {
    if (!supabase || !churchId || !memberId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("notes")
      .select("id, date, content, created_at")
      .eq("church_id", churchId)
      .eq("member_id", memberId)
      .eq("type", noteType)
      .order("created_at", { ascending: false });
    setLoading(false);
    if (error) {
      console.warn("[QuickNoteModal] fetch error:", error.message);
      setItems([]);
      return;
    }
    const list: QuickNoteItem[] = (data ?? []).map((r: Record<string, unknown>) => ({
      id: r.id as string | number,
      date: String(r.date ?? "").slice(0, 10),
      content: String(r.content ?? ""),
      created_at: String(r.created_at ?? ""),
    }));
    setItems(list);
  }, [churchId, memberId, noteType]);

  useEffect(() => {
    if (isOpen && churchId && memberId) void fetchList();
  }, [isOpen, churchId, memberId, fetchList]);

  const handleAdd = async () => {
    const content = newContent.trim();
    if (!content || !supabase || !churchId) return;
    setAdding(true);
    const date = todayStr();
    const { data, error } = await supabase
      .from("notes")
      .insert({
        member_id: memberId,
        church_id: churchId,
        date,
        type: noteType,
        content,
      })
      .select("id, date, content, created_at")
      .single();
    setAdding(false);
    if (error) {
      console.warn("[QuickNoteModal] insert error:", error.message);
      return;
    }
    setNewContent("");
    const newItem: QuickNoteItem = {
      id: (data as Record<string, unknown>)?.id as string | number,
      date: String((data as Record<string, unknown>)?.date ?? date).slice(0, 10),
      content: String((data as Record<string, unknown>)?.content ?? content),
      created_at: String((data as Record<string, unknown>)?.created_at ?? new Date().toISOString()),
    };
    const nextList = [newItem, ...items];
    setItems(nextList);
    onSaved?.(memberId, noteType, nextList, type === "prayer" ? content : undefined);
  };

  const handleDelete = async (id: string | number) => {
    if (!supabase || !churchId) return;
    if (!confirm("이 기록을 삭제할까요?")) return;
    setDeletingId(id);
    const { error } = await supabase.from("notes").delete().eq("church_id", churchId).eq("id", id);
    setDeletingId(null);
    if (error) {
      console.warn("[QuickNoteModal] delete error:", error.message);
      return;
    }
    const nextList = items.filter((x) => x.id !== id);
    setItems(nextList);
    const latestPrayer = type === "prayer" && nextList.length > 0 ? nextList[0].content : undefined;
    onSaved?.(memberId, noteType, nextList, latestPrayer);
  };

  const placeholder = type === "prayer" ? "새 기도 제목을 입력하세요..." : "새 메모를 입력하세요...";

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50"
      onMouseDown={handleBackdropMouseDown}
      onClick={handleBackdropClick}
    >
      <div
        ref={modalRef}
        className="bg-white rounded-2xl shadow-xl max-w-md w-full mx-auto max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            {type === "note" ? (
              <FileText size={20} strokeWidth={1.5} className="text-gray-700" />
            ) : (
              <Heart size={20} strokeWidth={1.5} className="text-gray-700" />
            )}
            <span className="text-lg font-bold text-gray-900">
              {memberName} {type === "note" ? "메모" : "기도 제목"}
            </span>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">
            <X size={20} strokeWidth={1.5} />
          </button>
        </div>
        <div className="p-4 flex-1 overflow-y-auto">
          <textarea
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            placeholder={placeholder}
            rows={3}
            className="w-full border border-gray-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
          />
          {/* === 추가 버튼 === */}
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "12px", marginBottom: "16px" }}>
            <button
              type="button"
              onClick={handleAdd}
              disabled={!newContent.trim() || adding}
              style={{
                backgroundColor: !newContent.trim() || adding ? "#93c5fd" : "#2563eb",
                color: "white",
                padding: "10px 24px",
                borderRadius: "8px",
                fontSize: "14px",
                fontWeight: 600,
                border: "none",
                cursor: !newContent.trim() || adding ? "not-allowed" : "pointer",
              }}
            >
              {adding ? "저장 중..." : "추가"}
            </button>
          </div>
          {/* === 추가 버튼 끝 === */}
          <div className="mt-6 pt-4 border-t border-gray-100">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">이전 기록</p>
            {loading ? (
              <p className="text-sm text-gray-400">로딩 중...</p>
            ) : items.length === 0 ? (
              <p className="text-sm text-gray-400 py-4">더 이상 기록이 없습니다</p>
            ) : (
              <div className="space-y-4 max-h-[300px] overflow-y-auto">
                {items.map((item) => (
                  <div key={String(item.id)} className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      {type === "note" ? (
                        <FileText size={16} strokeWidth={1.5} className="text-gray-400 flex-shrink-0" />
                      ) : (
                        <Heart size={16} strokeWidth={1.5} className="text-gray-400 flex-shrink-0" />
                      )}
                      <span className="text-xs text-gray-400">{item.date}</span>
                    </div>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{item.content}</p>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-xs text-gray-400">{type === "note" ? "메모" : "기도"}</span>
                      <button
                        type="button"
                        onClick={() => handleDelete(item.id)}
                        disabled={deletingId === item.id}
                        className="text-xs text-gray-400 hover:text-red-500 disabled:opacity-50"
                      >
                        {deletingId === item.id ? "삭제 중..." : "삭제"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
