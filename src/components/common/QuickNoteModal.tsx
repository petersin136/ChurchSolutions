"use client";

import { useState, useEffect, useCallback, type CSSProperties } from "react";
import { Check, ChevronDown, FileText, Heart } from "lucide-react";
import { PcModalShell } from "@/components/common/PcModalShell";
import { AppDeleteConfirmModal } from "@/components/common/AppDeleteConfirmModal";
import {
  APP_MODAL,
  appModalBtnSubmit,
  appModalInputStyle,
} from "@/styles/appModalTokens";
import { MEMBER_MGMT } from "@/styles/memberManagementTokens";
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
  memberName: string;
  memberId: string;
  churchId: string;
  type: "note" | "prayer";
  profileContent?: string;
  localSeedItems?: QuickNoteItem[];
  answeredPrayerKeys?: string[];
  onTogglePrayerAnswered?: (key: string, noteId?: string | number) => void;
  onSaved?: (memberId: string, type: "memo" | "prayer", items: QuickNoteItem[], latestContent?: string) => void;
}

function itemKey(it: QuickNoteItem): string {
  if (it.id != null) return `id:${it.id}`;
  return `${it.date}\t${it.content}\t${it.created_at}`;
}

import { prayerAnswerKeyFromParts } from "@/lib/prayerAnswers";

function prayerAnswerKey(memberId: string, item: QuickNoteItem): string {
  return prayerAnswerKeyFromParts({
    memberId,
    noteId: item.id,
    date: item.date,
    createdAt: item.created_at,
    content: item.content,
  });
}

function isLocalNoteId(id: string | number): boolean {
  return typeof id === "string" && id.startsWith("local-");
}

function preferNoteItem(a: QuickNoteItem, b: QuickNoteItem): QuickNoteItem {
  const aLocal = isLocalNoteId(a.id);
  const bLocal = isLocalNoteId(b.id);
  if (aLocal !== bLocal) return aLocal ? b : a;
  const aTime = a.created_at || a.date;
  const bTime = b.created_at || b.date;
  return aTime >= bTime ? a : b;
}

/** id/생성시각 기준 병합만 — 같은 내용이라도 서로 다른 기록이면 모두 유지 */
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

function splitCurrentAndHistory(
  items: QuickNoteItem[],
  profileContent?: string,
): { currentItem: QuickNoteItem | undefined; currentText: string; historyItems: QuickNoteItem[] } {
  const profile = profileContent?.trim() || "";
  const currentItem = items[0];
  const currentText = currentItem?.content?.trim() || (items.length === 0 ? profile : "") || "";
  const historyItems = items.slice(1).filter((it) => it.content.trim() !== currentText);
  return { currentItem, currentText, historyItems };
}

function countBadgeStyle(kind: "prayer" | "memo"): CSSProperties {
  const isPrayer = kind === "prayer";
  return {
    flexShrink: 0,
    fontSize: MEMBER_MGMT.prayerBadgeFontSize,
    fontWeight: MEMBER_MGMT.prayerBadgeFontWeight,
    color: isPrayer ? MEMBER_MGMT.prayerBadgeText : MEMBER_MGMT.memoBadgeText,
    background: isPrayer ? MEMBER_MGMT.prayerBadgeBg : MEMBER_MGMT.memoBadgeBg,
    padding: `2px ${MEMBER_MGMT.prayerBadgePadX}px`,
    borderRadius: MEMBER_MGMT.prayerBadgeRadius,
    lineHeight: 1.2,
    fontFamily: APP_MODAL.fontKR,
  };
}

const ANSWER_CHECK_COLOR = "#e57373";

function answerCheckButtonStyle(answered: boolean, size: "sm" | "md" = "sm"): CSSProperties {
  const dim = size === "sm" ? 20 : 22;
  return {
    width: dim,
    height: dim,
    borderRadius: "50%",
    border: answered ? "none" : "1px solid #d1d5db",
    background: answered ? ANSWER_CHECK_COLOR : "#ffffff",
    color: "#ffffff",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    flexShrink: 0,
    padding: 0,
  };
}

const scrollHideStyle: CSSProperties = {
  overflowY: "auto",
  scrollbarWidth: "none",
  msOverflowStyle: "none",
};

export function QuickNoteModal({
  isOpen,
  onClose,
  memberName,
  memberId,
  churchId,
  type,
  profileContent,
  localSeedItems = [],
  answeredPrayerKeys = [],
  onTogglePrayerAnswered,
  onSaved,
}: QuickNoteModalProps) {
  const [newContent, setNewContent] = useState("");
  const [items, setItems] = useState<QuickNoteItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<string | number | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | number | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const noteType = type === "prayer" ? "prayer" : "memo";
  const isPrayer = type === "prayer";
  const badgeKind = isPrayer ? "prayer" : "memo";
  const label = isPrayer ? "기도 제목" : "메모";
  const placeholder = isPrayer ? "새 기도 제목을 입력하세요..." : "새 메모를 입력하세요...";
  const { currentItem, currentText, historyItems } = splitCurrentAndHistory(items, profileContent);
  const historyCount = historyItems.length;
  const answeredSet = new Set(answeredPrayerKeys);
  const currentAnswered =
    isPrayer && currentItem ? answeredSet.has(prayerAnswerKey(memberId, currentItem)) : false;

  const fetchList = useCallback(async () => {
    if (!memberId) return;
    setItems(mergeNoteItems([], localSeedItems));
    setLoading(true);

    let remote: QuickNoteItem[] = [];
    if (supabase && churchId) {
      const { data, error } = await supabase
        .from("notes")
        .select("id, date, content, created_at")
        .eq("church_id", churchId)
        .eq("member_id", memberId)
        .eq("type", noteType)
        .order("created_at", { ascending: false });

      if (error) {
        console.warn("[QuickNoteModal] fetch error:", error.message);
      } else {
        remote = (data ?? []).map((r: Record<string, unknown>) => ({
          id: r.id as string | number,
          date: String(r.date ?? "").slice(0, 10),
          content: String(r.content ?? ""),
          created_at: String(r.created_at ?? ""),
        }));
      }
    }

    setItems(mergeNoteItems(remote, localSeedItems));
    setLoading(false);
  }, [churchId, memberId, noteType, localSeedItems]);

  useEffect(() => {
    if (!isOpen || !memberId) return;
    setNewContent("");
    setExpandedIds(new Set());
    setPendingDeleteId(null);
    void fetchList();
    // 모달을 열 때만 목록 로드 — 삭제 후 localSeed 변경으로 재조회되며 복원되는 것 방지
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, memberId, noteType]);

  const handleAdd = async () => {
    const content = newContent.trim();
    if (!content) return;
    setAdding(true);

    let newItem: QuickNoteItem | null = null;
    const date = todayStr();

    if (supabase && churchId) {
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

      if (error) {
        console.warn("[QuickNoteModal] insert error:", error.message);
      } else {
        newItem = {
          id: (data as Record<string, unknown>)?.id as string | number,
          date: String((data as Record<string, unknown>)?.date ?? date).slice(0, 10),
          content: String((data as Record<string, unknown>)?.content ?? content),
          created_at: String((data as Record<string, unknown>)?.created_at ?? new Date().toISOString()),
        };
      }
    }

    if (!newItem) {
      newItem = {
        id: `local-${Date.now()}`,
        date,
        content,
        created_at: new Date().toISOString(),
      };
    }

    setAdding(false);
    setNewContent("");
    const nextList = mergeNoteItems([newItem, ...items], []);
    setItems(nextList);
    onSaved?.(memberId, noteType, nextList, content);
  };

  const confirmDelete = async () => {
    const id = pendingDeleteId;
    if (id == null) return;
    setPendingDeleteId(null);
    setDeletingId(id);

    if (supabase && churchId) {
      const isRemoteId =
        typeof id === "number" ||
        (typeof id === "string" && !id.startsWith("local-"));
      if (isRemoteId) {
        const { error } = await supabase.from("notes").delete().eq("church_id", churchId).eq("id", id);
        if (error) {
          console.warn("[QuickNoteModal] delete error:", error.message);
          setDeletingId(null);
          return;
        }
      }
    }

    setDeletingId(null);
    const nextList = items.filter((x) => x.id !== id);
    setItems(nextList);
    onSaved?.(memberId, noteType, nextList, nextList[0]?.content ?? "");
  };

  const toggleExpanded = (id: string | number) => {
    const key = String(id);
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const textareaStyle = {
    ...appModalInputStyle,
    height: "auto",
    minHeight: 64,
    padding: "10px 14px",
    resize: "none" as const,
    lineHeight: 1.5,
    fontSize: 14,
  };

  const deleteDescription = isPrayer ? (
    <>
      선택한 기도 기록을 삭제하면
      <br />
      복구할 수 없습니다.
    </>
  ) : (
    <>
      선택한 메모를 삭제하면
      <br />
      복구할 수 없습니다.
    </>
  );

  return (
    <>
      <PcModalShell
        open={isOpen}
        onClose={onClose}
        height={APP_MODAL.tallHeight}
        bodyClassName="scrollbar-hide"
        nestedOverlay={
          <AppDeleteConfirmModal
            placement="nested"
            open={pendingDeleteId != null}
            onClose={() => setPendingDeleteId(null)}
            onConfirm={confirmDelete}
            description={deleteDescription}
          />
        }
        title={
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            {type === "note" ? (
              <FileText size={20} strokeWidth={1.75} color={APP_MODAL.ink} />
            ) : (
              <Heart size={20} strokeWidth={1.75} color={APP_MODAL.ink} />
            )}
            <span>
              {memberName} {label}
            </span>
          </span>
        }
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            height: "100%",
            minHeight: 0,
            fontFamily: APP_MODAL.fontKR,
          }}
        >
          {currentText ? (
            <div
              style={{
                marginBottom: 10,
                padding: "12px 14px",
                borderRadius: APP_MODAL.inputRadius,
                background: isPrayer ? "#f0f6ff" : "#ffffff",
                border: isPrayer ? "1.5px solid #bfdbfe" : "1.5px solid #e5e7eb",
                boxShadow: isPrayer ? "0 1px 0 rgba(37, 99, 235, 0.06)" : "none",
                opacity: currentAnswered ? 0.62 : 1,
                flexShrink: 0,
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p
                    style={{
                      margin: "0 0 8px",
                      fontSize: 12,
                      fontWeight: 700,
                      color: isPrayer ? MEMBER_MGMT.prayerBadgeText : APP_MODAL.labelMuted,
                      letterSpacing: "0.02em",
                    }}
                  >
                    현재 {label}
                    {currentAnswered ? " · 응답됨" : ""}
                  </p>
                  <p
                    style={{
                      margin: 0,
                      fontSize: 15,
                      fontWeight: 600,
                      lineHeight: 1.55,
                      color: APP_MODAL.ink,
                      whiteSpace: "pre-wrap",
                      textDecoration: currentAnswered ? "line-through" : "none",
                    }}
                  >
                    {currentText}
                  </p>
                </div>
                {isPrayer && currentItem && onTogglePrayerAnswered ? (
                  <button
                    type="button"
                    aria-label={currentAnswered ? "응답됨" : "응답 체크"}
                    onClick={() =>
                      onTogglePrayerAnswered(prayerAnswerKey(memberId, currentItem), currentItem.id)
                    }
                    style={answerCheckButtonStyle(currentAnswered, "md")}
                  >
                    {currentAnswered ? <Check size={12} strokeWidth={2.5} /> : null}
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}

          <textarea
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            placeholder={placeholder}
            rows={2}
            style={{ ...textareaStyle, flexShrink: 0 }}
          />

          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8, marginBottom: 8, flexShrink: 0 }}>
            <button
              type="button"
              onClick={handleAdd}
              disabled={!newContent.trim() || adding}
              style={{
                ...appModalBtnSubmit,
                flex: "none",
                width: "auto",
                height: 36,
                padding: "0 16px",
                fontSize: 14,
                fontWeight: 600,
                opacity: !newContent.trim() || adding ? 0.45 : 1,
                cursor: !newContent.trim() || adding ? "not-allowed" : "pointer",
              }}
            >
              {adding ? "저장 중..." : "추가"}
            </button>
          </div>

          <div
            style={{
              borderTop: "1px solid rgba(0,0,0,0.06)",
              paddingTop: 10,
              flex: 1,
              minHeight: 260,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, flexShrink: 0 }}>
              <p
                style={{
                  margin: 0,
                  fontSize: 12,
                  fontWeight: 600,
                  color: APP_MODAL.labelMuted,
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                }}
              >
                이전 기록
              </p>
              {historyCount > 0 ? <span style={countBadgeStyle(badgeKind)}>+{historyCount}</span> : null}
            </div>

            <div
              className="scrollbar-hide"
              style={{ ...scrollHideStyle, flex: 1, minHeight: 220 }}
            >
              {loading ? (
                <p style={{ margin: 0, fontSize: 14, color: APP_MODAL.muted }}>로딩 중...</p>
              ) : historyItems.length === 0 ? (
                <p style={{ margin: 0, fontSize: 14, color: APP_MODAL.muted, padding: "12px 0" }}>
                  더 이상 기록이 없습니다
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingBottom: 2 }}>
                  {historyItems.map((item) => {
                    const itemId = String(item.id);
                    const expanded = expandedIds.has(itemId);
                    const answered =
                      isPrayer && answeredSet.has(prayerAnswerKey(memberId, item));
                    return (
                      <div
                        key={itemId}
                        style={{
                          padding: "8px 10px",
                          borderRadius: APP_MODAL.inputRadius,
                          background: answered ? "#f3f4f6" : APP_MODAL.inputBg,
                          opacity: answered ? 0.72 : 1,
                          border: "1px solid transparent",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                          <button
                            type="button"
                            onClick={() => toggleExpanded(item.id)}
                            style={{
                              flex: 1,
                              minWidth: 0,
                              border: "none",
                              background: "transparent",
                              padding: 0,
                              textAlign: "left",
                              cursor: "pointer",
                              fontFamily: APP_MODAL.fontKR,
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                              {isPrayer ? (
                                <Heart size={14} strokeWidth={1.5} color={answered ? "#9ca3af" : APP_MODAL.labelMuted} />
                              ) : (
                                <FileText size={14} strokeWidth={1.5} color={APP_MODAL.labelMuted} />
                              )}
                              <span style={{ fontSize: 12, color: answered ? "#9ca3af" : APP_MODAL.labelMuted }}>
                                {item.date}
                              </span>
                              <ChevronDown
                                size={14}
                                color="#9ca3af"
                                style={{
                                  marginLeft: "auto",
                                  transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
                                  transition: "transform 0.15s ease",
                                }}
                              />
                            </div>
                            <p
                              style={{
                                margin: 0,
                                fontSize: 14,
                                lineHeight: 1.5,
                                color: answered ? "#9ca3af" : APP_MODAL.ink,
                                textDecoration: answered ? "line-through" : "none",
                                whiteSpace: expanded ? "pre-wrap" : "nowrap",
                                overflow: expanded ? "visible" : "hidden",
                                textOverflow: expanded ? "clip" : "ellipsis",
                              }}
                            >
                              {item.content}
                            </p>
                          </button>

                          {isPrayer && onTogglePrayerAnswered ? (
                            <button
                              type="button"
                              aria-label={answered ? "응답됨" : "응답 체크"}
                              onClick={() =>
                                onTogglePrayerAnswered(prayerAnswerKey(memberId, item), item.id)
                              }
                              style={answerCheckButtonStyle(!!answered, "sm")}
                            >
                              {answered ? <Check size={11} strokeWidth={2.5} /> : null}
                            </button>
                          ) : null}
                        </div>

                        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}>
                          <button
                            type="button"
                            onClick={() => setPendingDeleteId(item.id)}
                            disabled={deletingId === item.id}
                            style={{
                              border: "none",
                              background: "transparent",
                              fontSize: 12,
                              color: APP_MODAL.labelMuted,
                              cursor: deletingId === item.id ? "not-allowed" : "pointer",
                              fontFamily: APP_MODAL.fontKR,
                            }}
                          >
                            {deletingId === item.id ? "삭제 중..." : "삭제"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </PcModalShell>
    </>
  );
}
