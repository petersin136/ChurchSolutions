"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { Check, X } from "lucide-react";
import { AppDeleteConfirmModal } from "@/components/common/AppDeleteConfirmModal";
import type { QuickNoteItem } from "@/components/common/QuickNoteModal";
import { supabase } from "@/lib/supabase";
import {
  PRAYER_HISTORY_FRAME_PATH,
  PRAYER_HISTORY_MODAL,
  prayerHistoryOverlayStyle,
  prayerHistoryShellStyle,
} from "@/styles/prayerHistoryModalTokens";
import {
  isRemoteNoteId,
  prayerAnswerKeyFromParts,
} from "@/lib/prayerAnswers";

type TabId = "praying" | "answered";

function isLocalNoteId(id: string | number): boolean {
  return typeof id === "string" && id.startsWith("local-");
}

function itemKey(it: QuickNoteItem): string {
  if (it.id != null) return `id:${it.id}`;
  return `${it.date}\t${it.content}\t${it.created_at}`;
}

export function prayerAnswerKey(memberId: string, item: QuickNoteItem): string {
  return prayerAnswerKeyFromParts({
    memberId,
    noteId: item.id,
    date: item.date,
    createdAt: item.created_at,
    content: item.content,
  });
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

export interface PrayerHistoryModalProps {
  open: boolean;
  onClose: () => void;
  memberId: string;
  memberName: string;
  memberRole?: string;
  churchId: string;
  localSeedItems?: QuickNoteItem[];
  profilePrayer?: string;
  answeredPrayerKeys?: string[];
  answeredPrayerDates?: Record<string, string>;
  answeredPrayerComments?: Record<string, string>;
  answeredPrayerByNoteId?: Record<string, { answeredAt: string; comment?: string }>;
  onTogglePrayerAnswered?: (key: string, noteId?: string | number) => void;
  onSavePrayerComment?: (key: string, comment: string, noteId?: string | number) => void;
  onSaved?: (memberId: string, items: QuickNoteItem[], latestContent?: string) => void;
}

export function PrayerHistoryModal({
  open,
  onClose,
  memberId,
  memberName,
  memberRole,
  churchId,
  localSeedItems = [],
  profilePrayer,
  answeredPrayerKeys = [],
  answeredPrayerDates = {},
  answeredPrayerComments = {},
  answeredPrayerByNoteId = {},
  onTogglePrayerAnswered,
  onSavePrayerComment,
  onSaved,
}: PrayerHistoryModalProps) {
  const [mounted, setMounted] = useState(false);
  const [tab, setTab] = useState<TabId>("praying");
  const [items, setItems] = useState<QuickNoteItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | number | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | number | null>(null);
  const [deletingId, setDeletingId] = useState<string | number | null>(null);
  const [editingId, setEditingId] = useState<string | number | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [editingCommentKey, setEditingCommentKey] = useState<string | null>(null);

  const answeredSet = useMemo(() => {
    const set = new Set(answeredPrayerKeys);
    for (const noteId of Object.keys(answeredPrayerByNoteId)) {
      set.add(`id\t${noteId}`);
    }
    return set;
  }, [answeredPrayerKeys, answeredPrayerByNoteId]);

  const isItemAnswered = useCallback(
    (item: QuickNoteItem) => {
      if (isRemoteNoteId(item.id) && answeredPrayerByNoteId[String(item.id)]) return true;
      return answeredSet.has(prayerAnswerKey(memberId, item));
    },
    [answeredPrayerByNoteId, answeredSet, memberId],
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    setTab("praying");
    setHoveredId(null);
    setPendingDeleteId(null);
    setEditingId(null);
    setEditDraft("");
    setCommentDrafts({});
    setEditingCommentKey(null);
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
        .eq("type", "prayer")
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

    // DB 조회 성공 시 remote만 사용 (localSeed와 이중 카운트 방지)
    let merged = remoteOk
      ? mergeNoteItems(remote, [])
      : mergeNoteItems(remote, localSeedItems);
    const profile = profilePrayer?.trim();
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
  }, [churchId, localSeedItems, memberId, profilePrayer]);

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

  // 기도중: 전체(응답된 것도 그 자리에서 초록) / 응답완료: 응답된 것만
  const filteredItems =
    tab === "answered" ? items.filter((item) => isItemAnswered(item)) : items;

  const confirmDelete = async () => {
    const id = pendingDeleteId;
    if (id == null) return;
    setPendingDeleteId(null);
    setDeletingId(id);

    if (supabase && churchId) {
      const isRemoteId = typeof id === "number" || (typeof id === "string" && !id.startsWith("local-"));
      if (isRemoteId) {
        const { error } = await supabase.from("notes").delete().eq("church_id", churchId).eq("id", id);
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
        (typeof editingId === "string" && !editingId.startsWith("local-"));
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

  const { viewW, viewH, width, height } = PRAYER_HISTORY_MODAL;

  return createPortal(
    <>
      <div
        className="app-modal-overlay open"
        role="presentation"
        style={prayerHistoryOverlayStyle()}
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label="기도 히스토리"
          style={prayerHistoryShellStyle()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {/* 삭제 확인 시 뒤 모달은 filter blur (backdrop-filter는 SVG 프레임을 깨뜨림) */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              zIndex: 1,
              filter: pendingDeleteId != null ? "blur(5px)" : undefined,
              pointerEvents: pendingDeleteId != null ? "none" : undefined,
            }}
          >
          <div
            aria-hidden
            style={{
              position: "absolute",
              top: PRAYER_HISTORY_MODAL.glassLayerTop,
              left: 0,
              right: 0,
              height: PRAYER_HISTORY_MODAL.glassLayerHeight,
              borderRadius: PRAYER_HISTORY_MODAL.glassLayerRadius,
              background: PRAYER_HISTORY_MODAL.glassLayerBg,
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
              filter: PRAYER_HISTORY_MODAL.shadow,
              position: "relative",
              zIndex: 1,
            }}
          >
            {/* 흰 프레임 우상단 r7 바깥 쐐기 — 응답완료 색으로 채움 (흰 path 아래) */}
            <rect
              x={viewW - PRAYER_HISTORY_MODAL.radius}
              y={PRAYER_HISTORY_MODAL.headerShelfY}
              width={PRAYER_HISTORY_MODAL.radius}
              height={PRAYER_HISTORY_MODAL.radius}
              fill={PRAYER_HISTORY_MODAL.tabAnsweredBg}
            />
            <path fillRule="evenodd" fill="#ffffff" d={PRAYER_HISTORY_FRAME_PATH} />
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
              /* 상·하 모두 r7 — 상단각(좌·우) 각진 모서리 제거 */
              borderRadius: PRAYER_HISTORY_MODAL.radius,
            }}
          >
            <div
              style={{
                flexShrink: 0,
                position: "relative",
                height: PRAYER_HISTORY_MODAL.headerBlockHeight,
                boxSizing: "border-box",
                background: "#ffffff",
                overflow: "hidden",
                zIndex: 3,
                borderTopLeftRadius: PRAYER_HISTORY_MODAL.radius,
                borderTopRightRadius: PRAYER_HISTORY_MODAL.radius,
              }}
            >
              {/* 제목 — 흰 프레임 좌측 탭 */}
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: PRAYER_HISTORY_MODAL.frameTabTopX,
                  height: "100%",
                  padding: `${PRAYER_HISTORY_MODAL.headerPadTop}px ${PRAYER_HISTORY_MODAL.padX}px 0`,
                  boxSizing: "border-box",
                  zIndex: 2,
                }}
              >
                <h2
                  style={{
                    margin: 0,
                    fontSize: PRAYER_HISTORY_MODAL.titleSize,
                    fontWeight: PRAYER_HISTORY_MODAL.titleWeight,
                    color: PRAYER_HISTORY_MODAL.titleColor,
                    lineHeight: 1.3,
                  }}
                >
                  기도 히스토리
                </h2>
                <p
                  style={{
                    margin: `${PRAYER_HISTORY_MODAL.titleToSubtitle}px 0 0`,
                    fontSize: PRAYER_HISTORY_MODAL.subtitleSize,
                    fontWeight: PRAYER_HISTORY_MODAL.subtitleWeight,
                    color: PRAYER_HISTORY_MODAL.subtitleColor,
                    lineHeight: 1.35,
                  }}
                >
                  {memberSubtitle(memberName, memberRole)}
                </p>
              </div>

              {/*
                탭 (시안):
                - 기도중: 왼쪽 = 흰 프레임과 같은 사선, 오른쪽 위 = r7 곡률
                - 응답완료: 왼쪽 직선, 우상단 r7
                - 기도중 r7 포켓 아래 = 응답완료 진한 회색
              */}
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: PRAYER_HISTORY_MODAL.frameTabTopX,
                  right: 0,
                  height: PRAYER_HISTORY_MODAL.headerShelfY,
                  zIndex: 1,
                  pointerEvents: "none",
                }}
              >
                {/* 응답완료 — 기도중 곡률 포켓까지 왼쪽 / 우상단 r7 */}
                <button
                  type="button"
                  onClick={() => setTab("answered")}
                  style={{
                    position: "absolute",
                    top: 0,
                    left:
                      PRAYER_HISTORY_MODAL.tabSplitX -
                      PRAYER_HISTORY_MODAL.frameTabTopX -
                      PRAYER_HISTORY_MODAL.radius,
                    right: 0,
                    height: "100%",
                    pointerEvents: "auto",
                    border: "none",
                    cursor: "pointer",
                    fontFamily: PRAYER_HISTORY_MODAL.fontKR,
                    fontSize: PRAYER_HISTORY_MODAL.tabFontSize,
                    fontWeight: PRAYER_HISTORY_MODAL.tabFontWeight,
                    whiteSpace: "nowrap",
                    // 탭 배경색은 고정, 글씨만 활성=진한색 / 비활성=연한색
                    background: PRAYER_HISTORY_MODAL.tabAnsweredBg,
                    color:
                      tab === "answered"
                        ? PRAYER_HISTORY_MODAL.tabAnsweredText
                        : PRAYER_HISTORY_MODAL.tabPrayingText,
                    outline: "none",
                    borderTopRightRadius: PRAYER_HISTORY_MODAL.radius,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    paddingLeft: PRAYER_HISTORY_MODAL.radius,
                    boxSizing: "border-box",
                    zIndex: 1,
                  }}
                >
                  응답완료
                </button>

                {/* 기도 중 — 왼쪽 사선(상·하단 곡률) + 오른쪽 위 r7 */}
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width:
                      PRAYER_HISTORY_MODAL.tabSplitX - PRAYER_HISTORY_MODAL.frameTabTopX,
                    height: "100%",
                    borderTopRightRadius: PRAYER_HISTORY_MODAL.radius,
                    overflow: "hidden",
                    zIndex: 2,
                    pointerEvents: "auto",
                  }}
                >
                  <svg
                    aria-hidden
                    width="100%"
                    height="100%"
                    viewBox={`0 0 ${PRAYER_HISTORY_MODAL.tabSplitX - PRAYER_HISTORY_MODAL.frameTabTopX} ${PRAYER_HISTORY_MODAL.headerShelfY}`}
                    preserveAspectRatio="none"
                    style={{ position: "absolute", inset: 0, display: "block" }}
                  >
                    {/* 왼쪽 경계: 디자이너 사선 베지어(상·하단 곡률) → 우측으로 채움 */}
                    <path
                      fill={PRAYER_HISTORY_MODAL.tabPrayingBg}
                      d={`${PRAYER_HISTORY_MODAL.prayingLeftEdgePath} L${PRAYER_HISTORY_MODAL.tabSplitX - PRAYER_HISTORY_MODAL.frameTabTopX},${PRAYER_HISTORY_MODAL.headerShelfY} L${PRAYER_HISTORY_MODAL.tabSplitX - PRAYER_HISTORY_MODAL.frameTabTopX},0 Z`}
                    />
                  </svg>
                  <button
                    type="button"
                    onClick={() => setTab("praying")}
                    style={{
                      position: "absolute",
                      inset: 0,
                      border: "none",
                      cursor: "pointer",
                      background: "transparent",
                      fontFamily: PRAYER_HISTORY_MODAL.fontKR,
                      fontSize: PRAYER_HISTORY_MODAL.tabFontSize,
                      fontWeight: PRAYER_HISTORY_MODAL.tabFontWeight,
                      whiteSpace: "nowrap",
                      color:
                        tab === "praying"
                          ? PRAYER_HISTORY_MODAL.tabAnsweredText
                          : PRAYER_HISTORY_MODAL.tabPrayingText,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      paddingLeft:
                        PRAYER_HISTORY_MODAL.frameShelfX - PRAYER_HISTORY_MODAL.frameTabTopX,
                      boxSizing: "border-box",
                    }}
                  >
                    기도 중
                  </button>
                </div>
              </div>
            </div>

            <div
              className="scrollbar-hide"
              style={{
                flex: 1,
                minHeight: 0,
                overflowY: "auto",
                overflowX: "hidden",
                padding: `${PRAYER_HISTORY_MODAL.bodyPadTop}px ${PRAYER_HISTORY_MODAL.padX}px ${PRAYER_HISTORY_MODAL.bodyPadBottom}px`,
                boxSizing: "border-box",
                background: "#ffffff",
                /* 하단 얇은 안쪽 경계 */
                boxShadow: `inset 0 -1px 0 ${PRAYER_HISTORY_MODAL.cardBodyBorder}`,
              }}
            >
              {loading ? (
                <p style={{ margin: 0, fontSize: 14, color: PRAYER_HISTORY_MODAL.subtitleColor }}>
                  로딩 중...
                </p>
              ) : filteredItems.length === 0 ? (
                <p style={{ margin: 0, fontSize: 14, color: PRAYER_HISTORY_MODAL.subtitleColor }}>
                  {tab === "answered" ? "응답 완료된 기도가 없습니다" : "기도 중인 제목이 없습니다"}
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", position: "relative" }}>
                  {filteredItems.length > 0 ? (
                    <div
                      aria-hidden
                      style={{
                        position: "absolute",
                        top: 10,
                        bottom: 10,
                        left: PRAYER_HISTORY_MODAL.timelineWidth / 2,
                        width: 0,
                        borderLeft: `2px dotted ${PRAYER_HISTORY_MODAL.timelineDot}`,
                        pointerEvents: "none",
                        zIndex: 0,
                        transform: "translateX(-50%)",
                      }}
                    />
                  ) : null}
                  {filteredItems.map((item, index) => {
                    const key = prayerAnswerKey(memberId, item);
                    const answered = isItemAnswered(item);
                    const hovered = hoveredId === item.id;
                    const editing = editingId === item.id;
                    const byId = isRemoteNoteId(item.id)
                      ? answeredPrayerByNoteId[String(item.id)]
                      : undefined;
                    const answeredEnd =
                      byId?.answeredAt ||
                      answeredPrayerDates[key] ||
                      (isRemoteNoteId(item.id)
                        ? answeredPrayerDates[`id\t${String(item.id)}`]
                        : undefined);
                    const commentText =
                      byId?.comment ||
                      answeredPrayerComments[key] ||
                      (isRemoteNoteId(item.id)
                        ? answeredPrayerComments[`id\t${String(item.id)}`]
                        : undefined) ||
                      "";
                    const dateLabel = answered && answeredEnd
                      ? `${formatDisplayDate(item.date)} ~ ${formatDisplayDate(answeredEnd)}`
                      : formatDisplayDate(item.date);

                    return (
                      <div
                        key={String(item.id)}
                        style={{
                          display: "flex",
                          gap: 12,
                          marginBottom: index < filteredItems.length - 1 ? PRAYER_HISTORY_MODAL.cardGap : 0,
                          position: "relative",
                          zIndex: 1,
                        }}
                      >
                        <div
                          style={{
                            width: PRAYER_HISTORY_MODAL.timelineWidth,
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            flexShrink: 0,
                          }}
                        >
                          <button
                            type="button"
                            aria-label={answered ? "응답됨" : "응답 체크"}
                            onClick={() => onTogglePrayerAnswered?.(key, item.id)}
                            style={{
                              width: 20,
                              height: 20,
                              borderRadius: PRAYER_HISTORY_MODAL.radius,
                              border: answered ? "none" : `1.5px solid ${PRAYER_HISTORY_MODAL.checkBorder}`,
                              background: answered ? PRAYER_HISTORY_MODAL.checkAnsweredBg : "#ffffff",
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
                            {answered ? <Check size={12} strokeWidth={2.5} /> : null}
                          </button>
                        </div>

                        <div
                          style={{ flex: 1, minWidth: 0 }}
                          onMouseEnter={() => setHoveredId(item.id)}
                          onMouseLeave={() => setHoveredId(null)}
                        >
                          <div
                            style={{
                              borderRadius: PRAYER_HISTORY_MODAL.cardRadius,
                              background: answered
                                ? PRAYER_HISTORY_MODAL.cardHeaderAnsweredBg
                                : PRAYER_HISTORY_MODAL.cardHeaderBg,
                              paddingBottom: PRAYER_HISTORY_MODAL.cardBezel,
                              paddingLeft: PRAYER_HISTORY_MODAL.cardBezel,
                              paddingRight: PRAYER_HISTORY_MODAL.cardBezel,
                              boxSizing: "border-box",
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                gap: 8,
                                padding: `${PRAYER_HISTORY_MODAL.cardHeaderPadY}px ${PRAYER_HISTORY_MODAL.cardHeaderPadX}px`,
                                color: answered
                                  ? PRAYER_HISTORY_MODAL.cardHeaderAnsweredText
                                  : PRAYER_HISTORY_MODAL.titleColor,
                              }}
                            >
                              <span
                                style={{
                                  fontSize: PRAYER_HISTORY_MODAL.cardDateFontSize,
                                  fontWeight: PRAYER_HISTORY_MODAL.cardDateFontWeight,
                                  fontVariantNumeric: "tabular-nums",
                                }}
                              >
                                {dateLabel}
                              </span>
                              {/* 자리 항상 확보 — 호버 시 opacity만 변경해 레이아웃/창 흔들림 방지 */}
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
                                    color: answered ? "rgba(255,255,255,0.9)" : PRAYER_HISTORY_MODAL.iconMuted,
                                    display: "inline-flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    flexShrink: 0,
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.background = answered
                                      ? "rgba(255,255,255,0.22)"
                                      : "rgba(255,255,255,0.75)";
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.background = "transparent";
                                  }}
                                >
                                  <X size={14} strokeWidth={2} />
                                </button>
                                <button
                                  type="button"
                                  aria-label={answered ? "응답 취소" : "응답완료"}
                                  tabIndex={hovered && !editing ? 0 : -1}
                                  onClick={() => onTogglePrayerAnswered?.(key, item.id)}
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
                                    color: answered ? "rgba(255,255,255,0.9)" : PRAYER_HISTORY_MODAL.iconMuted,
                                    display: "inline-flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    flexShrink: 0,
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.background = answered
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
                            <div
                              style={{
                                background: answered
                                  ? PRAYER_HISTORY_MODAL.cardBodyAnsweredBg
                                  : PRAYER_HISTORY_MODAL.cardBodyBg,
                                borderRadius: PRAYER_HISTORY_MODAL.cardInnerRadius,
                                padding: `${PRAYER_HISTORY_MODAL.cardBodyPadY}px ${PRAYER_HISTORY_MODAL.cardBodyPadX}px`,
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
                                      border: `1px solid ${PRAYER_HISTORY_MODAL.cardBodyBorder}`,
                                      borderRadius: PRAYER_HISTORY_MODAL.radius,
                                      padding: "10px 12px",
                                      fontFamily: PRAYER_HISTORY_MODAL.fontKR,
                                      fontSize: PRAYER_HISTORY_MODAL.cardContentFontSize,
                                      lineHeight: PRAYER_HISTORY_MODAL.cardContentLineHeight,
                                      color: PRAYER_HISTORY_MODAL.cardContentColor,
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
                                        border: `1px solid ${PRAYER_HISTORY_MODAL.cardBodyBorder}`,
                                        background: "#fff",
                                        borderRadius: PRAYER_HISTORY_MODAL.radius,
                                        padding: "6px 12px",
                                        fontSize: 13,
                                        fontWeight: 600,
                                        cursor: "pointer",
                                        fontFamily: PRAYER_HISTORY_MODAL.fontKR,
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
                                        background: PRAYER_HISTORY_MODAL.titleColor,
                                        color: "#fff",
                                        borderRadius: PRAYER_HISTORY_MODAL.radius,
                                        padding: "6px 12px",
                                        fontSize: 13,
                                        fontWeight: 600,
                                        cursor: !editDraft.trim() || savingEdit ? "not-allowed" : "pointer",
                                        opacity: !editDraft.trim() || savingEdit ? 0.5 : 1,
                                        fontFamily: PRAYER_HISTORY_MODAL.fontKR,
                                      }}
                                    >
                                      {savingEdit ? "저장 중..." : "저장"}
                                    </button>
                                  </div>
                                </>
                              ) : (
                                <>
                                  <p
                                    style={{
                                      margin: 0,
                                      fontSize: PRAYER_HISTORY_MODAL.cardContentFontSize,
                                      lineHeight: PRAYER_HISTORY_MODAL.cardContentLineHeight,
                                      color: PRAYER_HISTORY_MODAL.cardContentColor,
                                      whiteSpace: "pre-wrap",
                                    }}
                                  >
                                    {item.content}
                                  </p>
                                  {answered && tab === "answered" ? (
                                    <div style={{ marginTop: 12 }}>
                                      <div
                                        style={{
                                          fontSize: 12,
                                          fontWeight: 600,
                                          color: PRAYER_HISTORY_MODAL.commentLabelColor,
                                          marginBottom: 6,
                                        }}
                                      >
                                        {PRAYER_HISTORY_MODAL.commentLabel}
                                      </div>
                                      {commentText.trim() &&
                                      editingCommentKey !== key ? (
                                        <div
                                          style={{
                                            background: PRAYER_HISTORY_MODAL.commentBubbleBg,
                                            border: `1px solid ${PRAYER_HISTORY_MODAL.commentBubbleBorder}`,
                                            borderRadius: PRAYER_HISTORY_MODAL.cardInnerRadius,
                                            padding: "10px 12px",
                                            boxSizing: "border-box",
                                          }}
                                        >
                                          <p
                                            style={{
                                              margin: 0,
                                              fontSize: 13,
                                              lineHeight: 1.55,
                                              color: PRAYER_HISTORY_MODAL.cardContentColor,
                                              whiteSpace: "pre-wrap",
                                            }}
                                          >
                                            {commentText}
                                          </p>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setEditingCommentKey(key);
                                              setCommentDrafts((prev) => ({
                                                ...prev,
                                                [key]: commentText,
                                              }));
                                            }}
                                            style={{
                                              marginTop: 8,
                                              border: "none",
                                              background: "transparent",
                                              padding: 0,
                                              cursor: "pointer",
                                              fontSize: 12,
                                              fontWeight: 600,
                                              color: PRAYER_HISTORY_MODAL.commentLabelColor,
                                              fontFamily: PRAYER_HISTORY_MODAL.fontKR,
                                            }}
                                          >
                                            수정
                                          </button>
                                        </div>
                                      ) : (
                                        <div>
                                          <textarea
                                            value={
                                              commentDrafts[key] ??
                                              commentText
                                            }
                                            onChange={(e) =>
                                              setCommentDrafts((prev) => ({
                                                ...prev,
                                                [key]: e.target.value,
                                              }))
                                            }
                                            placeholder={PRAYER_HISTORY_MODAL.commentPlaceholder}
                                            rows={2}
                                            style={{
                                              width: "100%",
                                              boxSizing: "border-box",
                                              border: `1px solid ${PRAYER_HISTORY_MODAL.commentInputBorder}`,
                                              borderRadius: PRAYER_HISTORY_MODAL.cardInnerRadius,
                                              padding: "10px 12px",
                                              fontFamily: PRAYER_HISTORY_MODAL.fontKR,
                                              fontSize: 13,
                                              lineHeight: 1.5,
                                              color: PRAYER_HISTORY_MODAL.cardContentColor,
                                              background: PRAYER_HISTORY_MODAL.commentInputBg,
                                              resize: "vertical",
                                              outline: "none",
                                            }}
                                          />
                                          <div
                                            style={{
                                              display: "flex",
                                              justifyContent: "flex-end",
                                              gap: 8,
                                              marginTop: 8,
                                            }}
                                          >
                                            {editingCommentKey === key ? (
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  setEditingCommentKey(null);
                                                  setCommentDrafts((prev) => {
                                                    const next = { ...prev };
                                                    delete next[key];
                                                    return next;
                                                  });
                                                }}
                                                style={{
                                                  border: `1px solid ${PRAYER_HISTORY_MODAL.cardBodyBorder}`,
                                                  background: "#fff",
                                                  borderRadius: PRAYER_HISTORY_MODAL.radius,
                                                  padding: "6px 12px",
                                                  fontSize: 12,
                                                  fontWeight: 600,
                                                  cursor: "pointer",
                                                  fontFamily: PRAYER_HISTORY_MODAL.fontKR,
                                                }}
                                              >
                                                취소
                                              </button>
                                            ) : null}
                                            <button
                                              type="button"
                                              onClick={() => {
                                                const text = (
                                                  commentDrafts[key] ??
                                                  commentText
                                                ).trim();
                                                onSavePrayerComment?.(key, text, item.id);
                                                setEditingCommentKey(null);
                                                setCommentDrafts((prev) => {
                                                  const next = { ...prev };
                                                  delete next[key];
                                                  return next;
                                                });
                                              }}
                                              disabled={
                                                !(
                                                  commentDrafts[key] ??
                                                  commentText
                                                ).trim()
                                              }
                                              style={{
                                                border: "none",
                                                background: PRAYER_HISTORY_MODAL.commentBtnBg,
                                                color: PRAYER_HISTORY_MODAL.commentBtnText,
                                                borderRadius: PRAYER_HISTORY_MODAL.radius,
                                                padding: "6px 12px",
                                                fontSize: 12,
                                                fontWeight: 600,
                                                cursor: !(
                                                  commentDrafts[key] ??
                                                  commentText
                                                ).trim()
                                                  ? "not-allowed"
                                                  : "pointer",
                                                opacity: !(
                                                  commentDrafts[key] ??
                                                  commentText
                                                ).trim()
                                                  ? 0.5
                                                  : 1,
                                                fontFamily: PRAYER_HISTORY_MODAL.fontKR,
                                              }}
                                            >
                                              남기기
                                            </button>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  ) : null}
                                </>
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
                선택한 기도 기록을 삭제하면
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
