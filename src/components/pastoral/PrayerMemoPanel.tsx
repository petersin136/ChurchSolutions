"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Pencil, Plus } from "lucide-react";
import type { DB, Member, Note } from "@/types/db";
import { MemberPhoto } from "@/components/common/MemberPhoto";
import { MemberSearchCombo } from "@/components/pastoral/MemberSearchCombo";
import { prayerAnswerKeyFromParts } from "@/lib/prayerAnswers";

const CHURCH_NOTE_ID = "__church__";

/** 1024 시안 → 1440 기준(×1.406)으로 반올림한 카드 치수 */
const PRAYER_BOARD = {
  font: "'Pretendard', system-ui, -apple-system, sans-serif",
  ink: "#0b0c0e",
  muted: "#8b909a",
  date: "#9aa0a8",
  checkedInk: "#6e6f73",
  pageBg: "#f4f4f6",
  churchBg: "#f3f4c8",
  memberBg: "#ebeaef",
  white: "#ffffff",
  radius: 8,
  innerRadius: 8,
  gap: 20,
  toolbarH: 48,
  toolbarGap: 10,
  avatar: 36,
  circle: 18,
  plus: 26,
  plusBg: "#e8e9ed",
  line: "rgba(0,0,0,0.06)",
} as const;

type PrayerFilter = "open" | "answered" | "all";

function isMeaningfulText(value: string | null | undefined): boolean {
  const t = (value ?? "").trim();
  if (!t) return false;
  return !/^[-–—]+$/.test(t);
}

function shortDate(s?: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || "");
  if (!m) return "";
  return `${m[2]}.${m[3]}`;
}

function prayerAnswerKeyForNote(memberId: string, note: Note): string {
  return prayerAnswerKeyFromParts({
    memberId,
    noteId: note.id,
    date: note.date,
    createdAt: note.createdAt,
    content: note.content,
  });
}

function isPrayerOpen(memberId: string, note: Note, answeredKeys: Set<string>): boolean {
  if (note.answered) return false;
  if (note.id != null && answeredKeys.has(`id\t${String(note.id)}`)) return false;
  return !answeredKeys.has(prayerAnswerKeyForNote(memberId, note));
}

function withAnswerState(memberId: string, note: Note, answeredKeys: Set<string>): Note {
  return { ...note, answered: !isPrayerOpen(memberId, note, answeredKeys) };
}

function sortNotes(notes: Note[]): Note[] {
  return [...notes].sort((a, b) => (b.date || b.createdAt || "").localeCompare(a.date || a.createdAt || ""));
}

function memberSubtitle(member: Member): string {
  const status = (member.member_status || member.status || "").trim();
  const role = (member.role || "").trim();
  const dept = (member.dept || "").trim();
  const mokjang = ((member.mokjang ?? member.group) || "").trim();
  const parts: string[] = [];
  if (status === "새가족") parts.push("새가족");
  if (role && !parts.includes(role)) parts.push(role);
  if (dept && !parts.includes(dept)) parts.push(dept);
  if (mokjang && !parts.includes(mokjang)) parts.push(mokjang);
  return parts.join(" · ");
}

export interface PrayerMemoPanelProps {
  mob: boolean;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  deptOptions: { value: string; label: string }[];
  mokjangOptions: { value: string; label: string }[];
  roleOptions: { value: string; label: string }[];
  onSelectDept: (value: string) => void;
  onSelectMokjang: (value: string) => void;
  onSelectRole: (value: string) => void;
  onResetFilters: () => void;
  onRegister: () => void;
  db: DB;
  filtered: Member[];
  pageMembers: Member[];
  pageSize: number;
  currentPage: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onOpenQuickPrayer: (id: string, name: string) => void;
  onOpenQuickMemo: (id: string, name: string) => void;
  onAddEntry?: (id: string, name: string, type: "prayer" | "memo") => void;
  onEditNote?: (id: string, note: Note) => void;
  onTogglePrayer?: (memberId: string, note: Note) => void;
  onOpenActivity: (id: string, name: string, role?: string) => void;
  onCapacityChange?: (rows: number) => void;
}

export function PrayerMemoPanel({
  mob,
  searchQuery,
  onSearchChange,
  deptOptions,
  mokjangOptions,
  roleOptions,
  onSelectDept,
  onSelectMokjang,
  onSelectRole,
  onResetFilters,
  onRegister,
  db,
  filtered,
  onOpenQuickPrayer,
  onOpenQuickMemo,
  onAddEntry,
  onEditNote,
  onTogglePrayer,
}: PrayerMemoPanelProps) {
  const [prayerFilter, setPrayerFilter] = useState<PrayerFilter>("open");
  const [topHover, setTopHover] = useState(false);
  const [showTop, setShowTop] = useState(false);
  const [checkedOverride, setCheckedOverride] = useState<Record<string, boolean>>({});
  const rootRef = useRef<HTMLDivElement | null>(null);
  /** 상단 검색/추가 줄은 고정, 이 영역만 스크롤 */
  const boardScrollRef = useRef<HTMLDivElement | null>(null);

  const answeredKeys = useMemo(() => {
    const set = new Set(db.answeredPrayerKeys ?? []);
    for (const id of Object.keys(db.answeredPrayerByNoteId ?? {})) set.add(`id\t${id}`);
    return set;
  }, [db.answeredPrayerKeys, db.answeredPrayerByNoteId]);

  const churchName = (db.settings?.churchName || "").trim() || "교회";

  const cards = useMemo(() => {
    const list: BoardCard[] = [];
    const churchNotes = sortNotes((db.notes[CHURCH_NOTE_ID] ?? []).filter((n) => n.type === "prayer" && isMeaningfulText(n.content))).map((n) =>
      withAnswerState(CHURCH_NOTE_ID, n, answeredKeys),
    );
    const churchPrayers = churchNotes.filter((n) => (prayerFilter === "answered" ? !!n.answered : true));
    if (churchPrayers.length > 0) {
      list.push({
        id: CHURCH_NOTE_ID,
        kind: "church",
        name: churchName,
        subtitle: "교회 기도",
        prayers: churchPrayers,
        memos: [],
        prayerLabel: prayerFilter === "answered" ? "응답" : "기도 중",
      });
    }
    const seenMember = new Set<string>();
    for (const member of filtered) {
      if (!member.id || seenMember.has(member.id)) continue;
      seenMember.add(member.id);
      const notes = db.notes[member.id] ?? [];
      const prayers = sortNotes(notes.filter((n) => n.type === "prayer" && isMeaningfulText(n.content)))
        .map((n) => withAnswerState(member.id, n, answeredKeys))
        .filter((n) => (prayerFilter === "answered" ? !!n.answered : true));
      const memos = sortNotes(notes.filter((n) => n.type === "memo" && isMeaningfulText(n.content)));
      const profilePrayer = isMeaningfulText(member.prayer) ? member.prayer!.trim() : "";
      const prayerItems = prayers.length > 0
        ? prayers
        : prayerFilter !== "answered" && profilePrayer
          ? [{ date: "", type: "prayer" as const, content: profilePrayer, createdAt: "" }]
          : [];
      const memoItems = memos.length > 0
        ? memos
        : isMeaningfulText(member.memo) && prayerFilter !== "answered"
          ? [{ date: "", type: "memo" as const, content: member.memo!.trim(), createdAt: "" }]
          : [];
      if (prayerFilter === "answered") {
        if (prayerItems.length === 0) continue;
      } else if (prayerItems.length === 0 && memoItems.length === 0) continue;
      list.push({
        id: member.id,
        kind: "member",
        name: member.name || "이름 없음",
        subtitle: memberSubtitle(member),
        photo: member.photo,
        prayers: prayerItems,
        memos: memoItems,
        role: member.role,
        prayerLabel: prayerFilter === "answered" ? "응답" : "기도 중",
      });
    }
    return list;
  }, [answeredKeys, churchName, db.notes, filtered, prayerFilter]);

  useEffect(() => {
    const scroller = boardScrollRef.current;
    if (!scroller) return;
    let last = scroller.scrollTop;
    const onScroll = () => {
      const y = scroller.scrollTop;
      const delta = y - last;
      if (y <= 4) setShowTop(false);
      else if (delta <= -1) setShowTop(true);
      else if (delta >= 1) setShowTop(false);
      last = y;
    };
    scroller.addEventListener("scroll", onScroll, { passive: true });
    return () => scroller.removeEventListener("scroll", onScroll);
  }, [cards.length]);

  const selectStyle: CSSProperties = {
    height: PRAYER_BOARD.toolbarH,
    padding: "0 32px 0 14px",
    borderRadius: 7,
    border: "1px solid #e2e4e8",
    background: "#ffffff",
    color: PRAYER_BOARD.ink,
    fontFamily: PRAYER_BOARD.font,
    fontSize: 14,
    fontWeight: 500,
    outline: "none",
    cursor: "pointer",
    flexShrink: 0,
    appearance: "none",
    WebkitAppearance: "none",
    backgroundImage: "linear-gradient(45deg, transparent 50%, #8b909a 50%), linear-gradient(135deg, #8b909a 50%, transparent 50%)",
    backgroundPosition: "calc(100% - 16px) 50%, calc(100% - 11px) 50%",
    backgroundSize: "5px 5px, 5px 5px",
    backgroundRepeat: "no-repeat",
  };

  return (
    <div
      ref={rootRef}
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        minWidth: 0,
        flex: 1,
        minHeight: 0,
        height: "100%",
        overflow: "hidden",
        boxSizing: "border-box",
        fontFamily: PRAYER_BOARD.font,
        color: PRAYER_BOARD.ink,
        paddingTop: 20,
      }}
    >
      {/* 메뉴(목양…)와의 간격 유지한 채 고정 — sticky로 말려 올라가지 않음 */}
      <div
        style={{
          display: "flex",
          gap: PRAYER_BOARD.toolbarGap,
          alignItems: "center",
          width: "100%",
          minWidth: 0,
          flexWrap: mob ? "wrap" : "nowrap",
          flexShrink: 0,
          paddingBottom: 22,
        }}
      >
        <MemberSearchCombo
          value={searchQuery}
          onChange={(v) => {
            onSearchChange(v);
            if (!v.trim()) onResetFilters();
          }}
          deptOptions={deptOptions}
          mokjangOptions={mokjangOptions}
          roleOptions={roleOptions}
          onSelectDept={onSelectDept}
          onSelectMokjang={onSelectMokjang}
          onSelectRole={onSelectRole}
          placeholder="이름, 부서, 목장, 구분 검색 또는 선택"
          height={PRAYER_BOARD.toolbarH}
        />
        <select
          aria-label="기도 상태"
          value={prayerFilter}
          onChange={(e) => setPrayerFilter(e.target.value as PrayerFilter)}
          style={{ ...selectStyle, width: mob ? "100%" : 112 }}
        >
          <option value="open">기도 중</option>
          <option value="answered">응답</option>
          <option value="all">전체</option>
        </select>
        <button
          type="button"
          onClick={onRegister}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            height: PRAYER_BOARD.toolbarH,
            padding: "0 18px",
            borderRadius: 7,
            border: "none",
            background: PRAYER_BOARD.ink,
            color: "#ffffff",
            fontFamily: PRAYER_BOARD.font,
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
            whiteSpace: "nowrap",
            flexShrink: 0,
            ...(mob ? { width: "100%" } : {}),
          }}
        >
          <Plus size={15} strokeWidth={2.4} aria-hidden />
          기도/메모 추가
        </button>
      </div>

      <div
        ref={boardScrollRef}
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          overflowX: "hidden",
          WebkitOverflowScrolling: "touch",
          paddingBottom: 28,
        }}
      >
        {cards.length === 0 ? (
          <div
            style={{
              minHeight: "100%",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
              color: PRAYER_BOARD.muted,
              fontSize: 14,
              lineHeight: 1.7,
              fontWeight: 500,
            }}
          >
            <div>아직 등록된 기도제목이 없습니다.</div>
            <div>기도/메모 추가를 눌러 첫 기도제목을 적어보세요.</div>
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              gap: PRAYER_BOARD.gap,
              alignItems: "flex-start",
            }}
          >
            {(mob ? [cards] : [cards.filter((_, i) => i % 2 === 0), cards.filter((_, i) => i % 2 === 1)]).map((column, columnIndex) => (
              <div
                key={columnIndex}
                style={{
                  flex: 1,
                  minWidth: 0,
                  display: "flex",
                  flexDirection: "column",
                  gap: PRAYER_BOARD.gap,
                }}
              >
                {column.map((card) => (
                  <PersonCard
                    key={card.id}
                    card={card}
                    onOpenPrayers={() => onOpenQuickPrayer(card.id, card.name)}
                    onOpenMemos={() => onOpenQuickMemo(card.id, card.name)}
                    onAddEntry={onAddEntry}
                    onEditNote={onEditNote}
                    onTogglePrayer={onTogglePrayer}
                    checkedOverride={checkedOverride}
                    onToggleChecked={(note, next) => {
                      setCheckedOverride((prev) => ({ ...prev, [rowKey(card.id, note)]: next }));
                    }}
                  />
                ))}
              </div>
            ))}
          </div>
        )}
        {cards.length > 0 && (
          <div
            style={{
              marginTop: 36,
              textAlign: "center",
              fontSize: 13,
              fontWeight: 500,
              color: "#9aa0a8",
            }}
          >
            모든 카드를 확인했습니다.
          </div>
        )}
      </div>
      {cards.length > 0 && showTop && (
        <button
          type="button"
          aria-label="맨 위로"
          onClick={() => {
            boardScrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
          }}
          onMouseEnter={() => setTopHover(true)}
          onMouseLeave={() => setTopHover(false)}
          style={{
            position: "fixed",
            right: 28,
            bottom: 28,
            zIndex: 20,
            width: 44,
            height: 52,
            borderRadius: 8,
            border: "1px solid #e6e7eb",
            background: topHover ? "#ebeaef" : "#ffffff",
            color: "#8b909a",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 2,
            cursor: "pointer",
            fontFamily: PRAYER_BOARD.font,
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: "0.04em",
            padding: 0,
          }}
        >
          <span aria-hidden style={{ fontSize: 14, lineHeight: 1 }}>↑</span>
          TOP
        </button>
      )}
    </div>
  );
}

type BoardCard = {
  id: string;
  kind: "church" | "member";
  name: string;
  subtitle: string;
  photo?: string;
  prayers: Note[];
  memos: Note[];
  role?: string;
  prayerLabel: string;
};

function PersonCard({
  card,
  onOpenPrayers,
  onOpenMemos,
  onAddEntry,
  onEditNote,
  onTogglePrayer,
  checkedOverride,
  onToggleChecked,
}: {
  card: BoardCard;
  onOpenPrayers: () => void;
  onOpenMemos: () => void;
  onAddEntry?: (id: string, name: string, type: "prayer" | "memo") => void;
  onEditNote?: (id: string, note: Note) => void;
  onTogglePrayer?: (memberId: string, note: Note) => void;
  checkedOverride: Record<string, boolean>;
  onToggleChecked: (note: Note, next: boolean) => void;
}) {
  const initial = (card.name.trim() || "?")[0];
  const prayerChecked = (note: Note) => {
    const key = rowKey(card.id, note);
    return key in checkedOverride ? checkedOverride[key] : !!note.answered;
  };
  const answeredNotes = card.prayers.filter(prayerChecked);
  const openNotes = card.prayers.filter((note) => !prayerChecked(note));
  return (
    <article
      style={{
        background: card.kind === "church" ? PRAYER_BOARD.churchBg : PRAYER_BOARD.memberBg,
        borderRadius: PRAYER_BOARD.radius,
        padding: "16px 16px 14px",
        boxSizing: "border-box",
        minWidth: 0,
      }}
    >
      <header style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <div
          style={{
            width: PRAYER_BOARD.avatar,
            height: PRAYER_BOARD.avatar,
            borderRadius: "50%",
            background: "#ffffff",
            overflow: "hidden",
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 15,
            fontWeight: 700,
            color: "#595e6b",
          }}
        >
          {card.kind === "member" ? (
            <MemberPhoto
              photo={card.photo}
              name={card.name}
              fallback={initial}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            initial
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 16,
              fontWeight: 700,
              letterSpacing: "-0.02em",
              lineHeight: 1.25,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {card.name}
          </div>
          {card.subtitle ? (
            <div style={{ marginTop: 2, fontSize: 12, fontWeight: 500, color: PRAYER_BOARD.muted }}>{card.subtitle}</div>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => {
            if (card.kind === "church" || card.prayers.length > 0) onOpenPrayers();
            else onOpenMemos();
          }}
          style={{
            border: "none",
            background: "none",
            padding: 0,
            fontFamily: PRAYER_BOARD.font,
            fontSize: 13,
            fontWeight: 500,
            color: PRAYER_BOARD.muted,
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          모든 기록 →
        </button>
      </header>

      {answeredNotes.length > 0 && (
        <NoteBlock
          label={prayerHeading("응답", answeredNotes.length)}
          notes={answeredNotes.slice(0, 3)}
          onAdd={() => (onAddEntry ? onAddEntry(card.id, card.name, "prayer") : onOpenPrayers())}
          onEdit={onEditNote ? (note) => onEditNote(card.id, note) : undefined}
          marked
          isChecked={() => true}
          onToggle={(note, next) => {
            onToggleChecked(note, next);
            onTogglePrayer?.(card.id, note);
          }}
        />
      )}
      {answeredNotes.length === 0 && openNotes.length === 0 && card.prayerLabel !== "응답" && (
        <NoteBlock
          label="기도 중 0"
          notes={[]}
          onAdd={() => (onAddEntry ? onAddEntry(card.id, card.name, "prayer") : onOpenPrayers())}
          marked
        />
      )}
      {openNotes.length > 0 && card.prayerLabel !== "응답" && (
        <NoteBlock
          label={prayerHeading("기도 중", openNotes.length)}
          notes={openNotes}
          onAdd={() => (onAddEntry ? onAddEntry(card.id, card.name, "prayer") : onOpenPrayers())}
          onEdit={onEditNote ? (note) => onEditNote(card.id, note) : undefined}
          marked
          spaced={answeredNotes.length > 0}
          isChecked={() => false}
          onToggle={(note, next) => {
            onToggleChecked(note, next);
            onTogglePrayer?.(card.id, note);
          }}
        />
      )}
      {card.kind === "member" && (
        <NoteBlock
          label={memoHeading(card.memos.length)}
          notes={card.memos.slice(0, 1)}
          onAdd={() => (onAddEntry ? onAddEntry(card.id, card.name, "memo") : onOpenMemos())}
          onEdit={onEditNote ? (note) => onEditNote(card.id, note) : undefined}
          spaced
        />
      )}
    </article>
  );
}

function rowKey(memberId: string, note: Note): string {
  return `${memberId}\t${note.id ?? ""}\t${note.date}\t${note.createdAt ?? ""}\t${note.content}`;
}

function prayerHeading(label: string, count: number): string {
  if (label === "응답" && count > 3) return `응답 ${count} · 최근 3개`;
  return `${label} ${count}`;
}

function memoHeading(count: number): string {
  if (count > 1) return `메모 ${count} · 최근 1개`;
  return `메모 ${count}`;
}

function NoteBlock({
  label,
  notes,
  onAdd,
  onEdit,
  spaced,
  marked,
  isChecked,
  onToggle,
}: {
  label: string;
  notes: Note[];
  onAdd: () => void;
  onEdit?: (note: Note) => void;
  spaced?: boolean;
  marked?: boolean;
  isChecked?: (note: Note) => boolean;
  onToggle?: (note: Note, next: boolean) => void;
}) {
  const [hoverKey, setHoverKey] = useState<string | null>(null);
  return (
    <div
      style={{
        background: PRAYER_BOARD.white,
        borderRadius: PRAYER_BOARD.innerRadius,
        padding: "12px 14px 8px",
        marginTop: spaced ? 10 : 0,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: PRAYER_BOARD.muted }}>{label}</span>
        <button
          type="button"
          aria-label="추가"
          onClick={onAdd}
          style={{
            width: PRAYER_BOARD.plus,
            height: PRAYER_BOARD.plus,
            border: "none",
            borderRadius: 6,
            background: PRAYER_BOARD.plusBg,
            color: "#6b7078",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            padding: 0,
          }}
        >
          <Plus size={14} strokeWidth={2.2} />
        </button>
      </div>
      {notes.map((note, i) => {
        const checked = isChecked?.(note) ?? !!note.answered;
        return (
        <div
          key={`${note.id ?? note.createdAt ?? i}-${i}`}
          onMouseEnter={() => setHoverKey(rowKey("row", note) + i)}
          onMouseLeave={() => setHoverKey(null)}
          style={{
            display: "flex",
            gap: 10,
            alignItems: "flex-start",
            padding: "7px 0",
          }}
        >
          {marked ? (
            <button
              type="button"
              aria-pressed={checked}
              aria-label={checked ? "응답 해제" : "응답으로 표시"}
              onClick={(e) => {
                e.stopPropagation();
                onToggle?.(note, !checked);
              }}
              style={{
                width: 28,
                height: 28,
                marginTop: -4,
                marginLeft: -5,
                borderRadius: "50%",
                border: "none",
                flexShrink: 0,
                boxSizing: "border-box",
                background: "transparent",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 0,
                cursor: "pointer",
              }}
            >
              <span
                aria-hidden
                style={{
                  width: PRAYER_BOARD.circle,
                  height: PRAYER_BOARD.circle,
                  borderRadius: "50%",
                  border: checked ? "none" : "1.5px solid #c8c9ce",
                  boxSizing: "border-box",
                  background: checked ? "#3a9a62" : "#ffffff",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {checked ? (
                  <svg width="10" height="8" viewBox="0 0 10 8">
                    <path d="M1 4.1 3.6 6.7 9 1.2" fill="none" stroke="#ffffff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : null}
              </span>
            </button>
          ) : null}
          <p style={{ margin: 0, flex: 1, minWidth: 0, fontSize: 14, fontWeight: 500, lineHeight: 1.55, color: checked ? PRAYER_BOARD.checkedInk : PRAYER_BOARD.ink }}>
            {note.content}
            {shortDate(note.date) ? (
              <span style={{ marginLeft: 8, color: PRAYER_BOARD.date, fontWeight: 500, whiteSpace: "nowrap" }}>{shortDate(note.date)}</span>
            ) : null}
          </p>
          {onEdit && hoverKey === rowKey("row", note) + i ? (
            <button
              type="button"
              aria-label="내용 수정"
              onClick={() => onEdit(note)}
              style={{
                width: 26,
                height: 26,
                border: "none",
                borderRadius: 6,
                background: PRAYER_BOARD.plusBg,
                color: "#6b7078",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                flexShrink: 0,
                padding: 0,
              }}
            >
              <Pencil size={13} strokeWidth={2} />
            </button>
          ) : null}
        </div>
        );
      })}
    </div>
  );
}
