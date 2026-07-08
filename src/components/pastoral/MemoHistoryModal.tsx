"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { Check, FileText, X } from "lucide-react";
import { AppDeleteConfirmModal } from "@/components/common/AppDeleteConfirmModal";
import type { QuickNoteItem } from "@/components/common/QuickNoteModal";
import { supabase } from "@/lib/supabase";
import {
  MEMO_HISTORY_FRAME_PATH,
  MEMO_HISTORY_MODAL,
  memoHistoryOverlayStyle,
  memoHistoryShellStyle,
  memoImportantPearlStyle,
} from "@/styles/memoHistoryModalTokens";
import { isRemoteNoteId } from "@/lib/prayerAnswers";

type TabId = "general" | "important";

const M = MEMO_HISTORY_MODAL;

function importantStorageKey(churchId: string): string {
  return `church_solution_important_memos_${churchId}`;
}

function loadImportantIdsFromStorage(churchId: string): string[] {
  if (typeof window === "undefined" || !churchId) return [];
  try {
    const raw = localStorage.getItem(importantStorageKey(churchId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === "string");
  } catch {
    return [];
  }
}

function saveImportantIdsToStorage(churchId: string, ids: string[]): void {
  if (typeof window === "undefined" || !churchId) return;
  try {
    localStorage.setItem(importantStorageKey(churchId), JSON.stringify(ids));
  } catch {
    /* ignore quota */
  }
}

function itemKey(it: QuickNoteItem): string {
  if (it.id != null) return `id:${it.id}`;
  return `${it.date}\t${it.content}\t${it.created_at}`;
}

function preferNoteItem(a: QuickNoteItem, b: QuickNoteItem): QuickNoteItem {
  const aLocal = typeof a.id === "string" && a.id.startsWith("local-");
  const bLocal = typeof b.id === "string" && b.id.startsWith("local-");
  if (aLocal !== bLocal) return aLocal ? b : a;
  const aTime = a.created_at || a.date;
  const bTime = b.created_at || b.date;
  return aTime >= bTime ? a : b;
}

function mergeNoteItems(supabaseItems: QuickNoteItem[], localSeed: QuickNoteItem[]): QuickNoteItem[] {
  const byId = new Map<string, QuickNoteItem>();
  for (const it of [...supabaseItems, ...localSeed]) {
    if (!it.content?.trim()) continue;
    const key = itemKey(it);
    const prev = byId.get(key);
    byId.set(key, prev ? preferNoteItem(it, prev) : it);
  }
  return [...byId.values()].sort((a, b) =>
    (b.created_at || b.date).localeCompare(a.created_at || a.date),
  );
}

function formatDisplayDate(ymd: string): string {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return ymd;
  const [y, m, d] = ymd.split("-");
  return `${y}. ${m}. ${d}.`;
}

function memberSubtitle(name: string, role?: string): string {
  const n = name.trim();
  const r = (role || "").trim();
  if (!n) return r || "";
  if (!r) return n;
  return `${n} ${r}`;
}

export interface MemoHistoryModalProps {
  open: boolean;
  onClose: () => void;
  memberId: string;
  memberName: string;
  memberRole?: string;
  churchId: string;
  localSeedItems?: QuickNoteItem[];
  profileMemo?: string;
  importantMemoIds?: string[];
  onToggleImportant?: (noteId: string | number, next: boolean) => void;
  onSaved?: (memberId: string, items: QuickNoteItem[], latestContent?: string) => void;
}

export function MemoHistoryModal({
  open,
  onClose,
  memberId,
  memberName,
  memberRole,
  churchId,
  localSeedItems = [],
  profileMemo,
  importantMemoIds,
  onToggleImportant,
  onSaved,
}: MemoHistoryModalProps) {
  const [mounted, setMounted] = useState(false);
  const [tab, setTab] = useState<TabId>("general");
  const [items, setItems] = useState<QuickNoteItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | number | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | number | null>(null);
  const [deletingId, setDeletingId] = useState<string | number | null>(null);
  const [editingId, setEditingId] = useState<string | number | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  // Important set: seed from props + localStorage
  const [importantSet, setImportantSet] = useState<Set<string>>(() => {
    const fromStorage = loadImportantIdsFromStorage(churchId);
    const fromProps = importantMemoIds ?? [];
    return new Set([...fromStorage, ...fromProps]);
  });

  // Re-seed when churchId changes
  useEffect(() => {
    const fromStorage = loadImportantIdsFromStorage(churchId);
    const fromProps = importantMemoIds ?? [];
    setImportantSet(new Set([...fromStorage, ...fromProps]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [churchId]);

  const isImportant = useCallback(
    (item: QuickNoteItem) => {
      if (item.id == null) return false;
      return importantSet.has(String(item.id));
    },
    [importantSet],
  );

  const toggleImportant = useCallback(
    (item: QuickNoteItem) => {
      if (item.id == null) return;
      const id = String(item.id);
      setImportantSet((prev) => {
        const next = new Set(prev);
        const nextVal = !next.has(id);
        if (nextVal) {
          next.add(id);
        } else {
          next.delete(id);
        }
        saveImportantIdsToStorage(churchId, [...next]);
        return next;
      });
      onToggleImportant?.(item.id, !importantSet.has(id));
    },
    [churchId, importantSet, onToggleImportant],
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    setTab("general");
    setHoveredId(null);
    setPendingDeleteId(null);
    setEditingId(null);
    setEditDraft("");
  }, [open, memberId]);

  const fetchList = useCallback(async () => {
    if (!memberId) return;
    setItems(mergeNoteItems([], localSeedItems));
    setLoading(true);

    let remote: QuickNoteItem[] = [];
    let remoteOk = false;
    if (supabase && churchId) {
      const { data, error } = await supabase
        .from("notes")
        .select("id, date, content, created_at")
        .eq("church_id", churchId)
        .eq("member_id", memberId)
        .eq("type", "memo")
        .order("created_at", { ascending: false });

      if (!error && data) {
        remoteOk = true;
        remote = data.map((r: Record<string, unknown>) => ({
          id: r.id as string | number,
          date: String(r.date ?? "").slice(0, 10),
          content: String(r.content ?? ""),
          created_at: String(r.created_at ?? ""),
        }));
      }
    }

    let merged = remoteOk
      ? mergeNoteItems(remote, [])
      : mergeNoteItems(remote, localSeedItems);
    const profile = profileMemo?.trim();
    if (profile && !merged.some((i) => i.content.trim() === profile)) {
      merged = [
        {
          id: `profile-${memberId}`,
          date: new Date().toISOString().slice(0, 10),
          content: profile,
          created_at: new Date().toISOString(),
        },
        ...merged,
      ];
    }
    setItems(merged);
    setLoading(false);
  }, [churchId, localSeedItems, memberId, profileMemo]);

  useEffect(() => {
    if (!open || !memberId) return;
    void fetchList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, memberId]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && pendingDeleteId == null && editingId == null) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, pendingDeleteId, editingId]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // general: all memos, important: only important ones
  const filteredItems =
    tab === "important" ? items.filter((item) => isImportant(item)) : items;

  const confirmDelete = async () => {
    const id = pendingDeleteId;
    if (id == null) return;
    setPendingDeleteId(null);
    setDeletingId(id);

    if (supabase && churchId) {
      const isRemoteId =
        typeof id === "number" || (typeof id === "string" && !id.startsWith("local-") && !id.startsWith("profile-"));
      if (isRemoteId) {
        const { error } = await supabase
          .from("notes")
          .delete()
          .eq("church_id", churchId)
          .eq("id", id);
        if (error) {
          setDeletingId(null);
          return;
        }
      }
    }

    setDeletingId(null);
    const nextList = items.filter((x) => x.id !== id);
    setItems(nextList);
    onSaved?.(memberId, nextList, nextList[0]?.content ?? "");
  };

  const startEdit = (item: QuickNoteItem) => {
    setEditingId(item.id);
    setEditDraft(item.content);
  };

  const saveEdit = async () => {
    if (editingId == null) return;
    const trimmed = editDraft.trim();
    if (!trimmed) return;
    setSavingEdit(true);
    const item = items.find((x) => x.id === editingId);
    if (!item) {
      setSavingEdit(false);
      return;
    }

    if (supabase && churchId) {
      const isRemoteId =
        typeof editingId === "number" ||
        (typeof editingId === "string" && !editingId.startsWith("local-") && !editingId.startsWith("profile-"));
      if (isRemoteId) {
        await supabase
          .from("notes")
          .update({ content: trimmed })
          .eq("church_id", churchId)
          .eq("id", editingId);
      }
    }

    const nextList = items.map((it) =>
      it.id === editingId ? { ...it, content: trimmed } : it,
    );
    setItems(nextList);
    setEditingId(null);
    setEditDraft("");
    setSavingEdit(false);
    onSaved?.(memberId, nextList, nextList[0]?.content ?? "");
  };

  if (!open || !mounted) return null;

  const { viewW, viewH, width, height } = M;

  return createPortal(
    <>
      <div
        className="app-modal-overlay open"
        role="presentation"
        style={memoHistoryOverlayStyle()}
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label="메모 히스토리"
          style={memoHistoryShellStyle()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {/* 삭제 확인 시 뒤 모달 클릭 막기 — 블러는 nested 오버레이 backdrop-filter */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              zIndex: 1,
              pointerEvents: pendingDeleteId != null ? "none" : undefined,
            }}
          >
            <div
              aria-hidden
              style={{
                position: "absolute",
                top: M.glassLayerTop,
                left: 0,
                right: 0,
                height: M.glassLayerHeight,
                borderRadius: M.glassLayerRadius,
                background: M.glassLayerBg,
                zIndex: 0,
                pointerEvents: "none",
              }}
            />

            <svg
              aria-hidden
              width={width}
              height={height}
              viewBox={`0 0 ${viewW} ${viewH}`}
              style={{
                display: "block",
                maxWidth: "100%",
                filter: M.shadow,
                position: "relative",
                zIndex: 1,
              }}
            >
              {/* 우상단 쐐기 — 중요 탭 배경색으로 채움 */}
              <rect
                x={viewW - M.radius}
                y={M.headerShelfY}
                width={M.radius}
                height={M.radius}
                fill={M.tabImportantBg}
              />
              <path fillRule="evenodd" fill="#ffffff" d={MEMO_HISTORY_FRAME_PATH} />
            </svg>

            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                flexDirection: "column",
                boxSizing: "border-box",
                zIndex: 2,
                overflow: "hidden",
                borderRadius: M.radius,
              }}
            >
              {/* 고정 헤더 */}
              <div
                style={{
                  flexShrink: 0,
                  position: "relative",
                  height: M.headerBlockHeight,
                  boxSizing: "border-box",
                  background: "#ffffff",
                  overflow: "hidden",
                  zIndex: 3,
                  borderTopLeftRadius: M.radius,
                  borderTopRightRadius: M.radius,
                }}
              >
                {/* 제목 영역 — 흰 프레임 좌측 탭 */}
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: M.frameTabTopX,
                    height: "100%",
                    padding: `${M.headerPadTop}px ${M.padX}px 0`,
                    boxSizing: "border-box",
                    zIndex: 2,
                  }}
                >
                  <h2
                    style={{
                      margin: 0,
                      fontSize: M.titleSize,
                      fontWeight: M.titleWeight,
                      color: M.titleColor,
                      lineHeight: 1.3,
                    }}
                  >
                    메모 히스토리
                  </h2>
                  <p
                    style={{
                      margin: `${M.titleToSubtitle}px 0 0`,
                      fontSize: M.subtitleSize,
                      fontWeight: M.subtitleWeight,
                      color: M.subtitleColor,
                      lineHeight: 1.35,
                    }}
                  >
                    {memberSubtitle(memberName, memberRole)}
                  </p>
                </div>

                {/* 탭 영역 */}
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    left: M.frameTabTopX,
                    right: 0,
                    height: M.headerShelfY,
                    zIndex: 1,
                    pointerEvents: "none",
                  }}
                >
                  {/* 중요 탭 (오른쪽, 진한 배경) */}
                  <button
                    type="button"
                    onClick={() => setTab("important")}
                    style={{
                      position: "absolute",
                      top: 0,
                      left:
                        M.tabSplitX -
                        M.frameTabTopX -
                        M.radius,
                      right: 0,
                      height: "100%",
                      pointerEvents: "auto",
                      border: "none",
                      cursor: "pointer",
                      fontFamily: M.fontKR,
                      fontSize: M.tabFontSize,
                      fontWeight: M.tabFontWeight,
                      whiteSpace: "nowrap",
                      background: M.tabImportantBg,
                      color:
                        tab === "important"
                          ? M.tabActiveText
                          : M.tabMutedText,
                      outline: "none",
                      borderTopRightRadius: M.radius,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      paddingLeft: M.radius,
                      boxSizing: "border-box",
                      zIndex: 1,
                    }}
                  >
                    중요
                  </button>

                  {/* 일반 탭 (왼쪽, 연한 배경, 사선) */}
                  <div
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width:
                        M.tabSplitX - M.frameTabTopX,
                      height: "100%",
                      borderTopRightRadius: M.radius,
                      overflow: "hidden",
                      zIndex: 2,
                      pointerEvents: "auto",
                    }}
                  >
                    <svg
                      aria-hidden
                      width="100%"
                      height="100%"
                      viewBox={`0 0 ${M.tabSplitX - M.frameTabTopX} ${M.headerShelfY}`}
                      preserveAspectRatio="none"
                      style={{ position: "absolute", inset: 0, display: "block" }}
                    >
                      <path
                        fill={M.tabGeneralBg}
                        d={`${M.generalLeftEdgePath} L${M.tabSplitX - M.frameTabTopX},${M.headerShelfY} L${M.tabSplitX - M.frameTabTopX},0 Z`}
                      />
                    </svg>
                    <button
                      type="button"
                      onClick={() => setTab("general")}
                      style={{
                        position: "absolute",
                        inset: 0,
                        border: "none",
                        cursor: "pointer",
                        background: "transparent",
                        fontFamily: M.fontKR,
                        fontSize: M.tabFontSize,
                        fontWeight: M.tabFontWeight,
                        whiteSpace: "nowrap",
                        color:
                          tab === "general"
                            ? M.tabActiveText
                            : M.tabMutedText,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        paddingLeft:
                          M.frameShelfX - M.frameTabTopX,
                        boxSizing: "border-box",
                      }}
                    >
                      일반
                    </button>
                  </div>
                </div>
              </div>

              {/* 스크롤 본문 */}
              <div
                className="scrollbar-hide"
                style={{
                  flex: 1,
                  minHeight: 0,
                  overflowY: "auto",
                  overflowX: "hidden",
                  padding: `${M.bodyPadTop}px ${M.padX}px ${M.bodyPadBottom}px`,
                  boxSizing: "border-box",
                  background: "#ffffff",
                  boxShadow: `inset 0 -1px 0 ${M.cardBodyBorder}`,
                }}
              >
                {loading ? (
                  <p style={{ margin: 0, fontSize: 14, color: M.subtitleColor }}>
                    로딩 중...
                  </p>
                ) : filteredItems.length === 0 ? (
                  <p style={{ margin: 0, fontSize: 14, color: M.subtitleColor }}>
                    {tab === "important" ? "중요 메모가 없습니다" : "메모가 없습니다"}
                  </p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", position: "relative" }}>
                    {/* 연속 점선 타임라인 */}
                    {filteredItems.length > 0 ? (
                      <div
                        aria-hidden
                        style={{
                          position: "absolute",
                          top: 10,
                          bottom: 10,
                          left: M.timelineWidth / 2,
                          width: 0,
                          borderLeft: `2px dotted ${M.timelineDot}`,
                          pointerEvents: "none",
                          zIndex: 0,
                          transform: "translateX(-50%)",
                        }}
                      />
                    ) : null}
                    {filteredItems.map((item, index) => {
                      const important = isImportant(item);
                      const hovered = hoveredId === item.id;
                      const editing = editingId === item.id;

                      return (
                        <div
                          key={String(item.id)}
                          style={{
                            display: "flex",
                            gap: 12,
                            marginBottom: index < filteredItems.length - 1 ? M.cardGap : 0,
                            position: "relative",
                            zIndex: 1,
                          }}
                        >
                          {/* 타임라인 노드 */}
                          <div
                            style={{
                              width: M.timelineWidth,
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "center",
                              flexShrink: 0,
                            }}
                          >
                            <button
                              type="button"
                              aria-label={important ? "중요 표시됨" : "중요 표시"}
                              onClick={() => toggleImportant(item)}
                              style={{
                                width: 20,
                                height: 20,
                                borderRadius: M.radius,
                                border: important ? "none" : `1.5px solid ${M.checkBorder}`,
                                ...(important ? memoImportantPearlStyle(true) : { background: M.nodeBg }),
                                color: "#ffffff",
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                cursor: "pointer",
                                flexShrink: 0,
                                padding: 0,
                                position: "relative",
                                zIndex: 1,
                              }}
                            >
                              {important ? (
                                <Check size={12} strokeWidth={2.5} />
                              ) : (
                                <FileText
                                  size={12}
                                  strokeWidth={2}
                                  style={{ color: M.nodeIcon }}
                                />
                              )}
                            </button>
                          </div>

                          {/* 카드 */}
                          <div
                            style={{ flex: 1, minWidth: 0 }}
                            onMouseEnter={() => setHoveredId(item.id)}
                            onMouseLeave={() => setHoveredId(null)}
                          >
                            <div
                              style={{
                                borderRadius: M.cardRadius,
                                ...(important
                                  ? memoImportantPearlStyle()
                                  : { background: M.cardHeaderBg }),
                                paddingBottom: M.cardBezel,
                                paddingLeft: M.cardBezel,
                                paddingRight: M.cardBezel,
                                boxSizing: "border-box",
                              }}
                            >
                              {/* 카드 헤더 */}
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "space-between",
                                  gap: 8,
                                  padding: `${M.cardHeaderPadY}px ${M.cardHeaderPadX}px`,
                                  color: important ? M.cardHeaderImportantText : M.titleColor,
                                }}
                              >
                                <span
                                  style={{
                                    fontSize: M.cardDateFontSize,
                                    fontWeight: M.cardDateFontWeight,
                                    fontVariantNumeric: "tabular-nums",
                                  }}
                                >
                                  {formatDisplayDate(item.date)}
                                </span>

                                {/* 호버 액션 — 자리 항상 확보, opacity 토글만 */}
                                <span
                                  style={{
                                    display: "inline-flex",
                                    gap: 4,
                                    flexShrink: 0,
                                    width: 52,
                                    height: 24,
                                    alignItems: "center",
                                    justifyContent: "flex-end",
                                    opacity: hovered && !editing ? 1 : 0,
                                    pointerEvents: hovered && !editing ? "auto" : "none",
                                  }}
                                >
                                  {/* 삭제 버튼 */}
                                  <button
                                    type="button"
                                    aria-label="삭제"
                                    tabIndex={hovered && !editing ? 0 : -1}
                                    onClick={() => setPendingDeleteId(item.id)}
                                    disabled={deletingId === item.id}
                                    style={{
                                      border: "none",
                                      background: "transparent",
                                      width: 24,
                                      height: 24,
                                      minWidth: 24,
                                      minHeight: 24,
                                      borderRadius: 6,
                                      padding: 0,
                                      boxSizing: "border-box",
                                      cursor: deletingId === item.id ? "not-allowed" : "pointer",
                                      color: important ? "rgba(255,255,255,0.9)" : M.iconMuted,
                                      display: "inline-flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      flexShrink: 0,
                                    }}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.background = important
                                        ? "rgba(255,255,255,0.22)"
                                        : "rgba(255,255,255,0.75)";
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.background = "transparent";
                                    }}
                                  >
                                    <X size={14} strokeWidth={2} />
                                  </button>

                                  {/* 중요 토글 버튼 */}
                                  <button
                                    type="button"
                                    aria-label={important ? "중요 해제" : "중요 표시"}
                                    tabIndex={hovered && !editing ? 0 : -1}
                                    onClick={() => toggleImportant(item)}
                                    style={{
                                      border: "none",
                                      background: "transparent",
                                      width: 24,
                                      height: 24,
                                      minWidth: 24,
                                      minHeight: 24,
                                      borderRadius: 6,
                                      padding: 0,
                                      boxSizing: "border-box",
                                      cursor: "pointer",
                                      color: important ? "rgba(255,255,255,0.9)" : M.iconMuted,
                                      display: "inline-flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      flexShrink: 0,
                                    }}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.background = important
                                        ? "rgba(255,255,255,0.22)"
                                        : "rgba(255,255,255,0.75)";
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.background = "transparent";
                                    }}
                                  >
                                    <Check size={14} strokeWidth={2} />
                                  </button>
                                </span>
                              </div>

                              {/* 카드 본문 */}
                              <div
                                style={{
                                  background: important ? M.cardBodyImportantBg : M.cardBodyBg,
                                  border: important ? `1px solid ${M.cardBodyImportantBorder}` : "none",
                                  borderRadius: M.cardInnerRadius,
                                  padding: `${M.cardBodyPadY}px ${M.cardBodyPadX}px`,
                                  boxSizing: "border-box",
                                }}
                              >
                                {editing ? (
                                  <>
                                    <textarea
                                      value={editDraft}
                                      onChange={(e) => setEditDraft(e.target.value)}
                                      rows={3}
                                      style={{
                                        width: "100%",
                                        boxSizing: "border-box",
                                        border: `1px solid ${M.cardBodyBorder}`,
                                        borderRadius: M.radius,
                                        padding: "10px 12px",
                                        fontFamily: M.fontKR,
                                        fontSize: M.cardContentFontSize,
                                        lineHeight: M.cardContentLineHeight,
                                        color: M.cardContentColor,
                                        resize: "vertical",
                                        outline: "none",
                                      }}
                                    />
                                    <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEditingId(null);
                                          setEditDraft("");
                                        }}
                                        style={{
                                          border: `1px solid ${M.cardBodyBorder}`,
                                          background: "#fff",
                                          borderRadius: M.radius,
                                          padding: "6px 12px",
                                          fontSize: 13,
                                          fontWeight: 600,
                                          cursor: "pointer",
                                          fontFamily: M.fontKR,
                                        }}
                                      >
                                        취소
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => void saveEdit()}
                                        disabled={!editDraft.trim() || savingEdit}
                                        style={{
                                          border: "none",
                                          background: M.titleColor,
                                          color: "#fff",
                                          borderRadius: M.radius,
                                          padding: "6px 12px",
                                          fontSize: 13,
                                          fontWeight: 600,
                                          cursor: !editDraft.trim() || savingEdit ? "not-allowed" : "pointer",
                                          opacity: !editDraft.trim() || savingEdit ? 0.5 : 1,
                                          fontFamily: M.fontKR,
                                        }}
                                      >
                                        {savingEdit ? "저장 중..." : "저장"}
                                      </button>
                                    </div>
                                  </>
                                ) : (
                                  <p
                                    onClick={() => !editing && startEdit(item)}
                                    style={{
                                      margin: 0,
                                      fontSize: M.cardContentFontSize,
                                      lineHeight: M.cardContentLineHeight,
                                      color: M.cardContentColor,
                                      whiteSpace: "pre-wrap",
                                      cursor: "text",
                                    }}
                                  >
                                    {item.content}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          <AppDeleteConfirmModal
            placement="nested"
            open={pendingDeleteId != null}
            onClose={() => setPendingDeleteId(null)}
            onConfirm={() => void confirmDelete()}
            description={
              <>
                선택한 메모를 삭제하면
                <br />
                복구할 수 없습니다.
              </>
            }
          />
        </div>
      </div>
    </>,
    document.body,
  );
}
