"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef, type CSSProperties } from "react";
import { Plus, Pencil, Trash2, AlertTriangle, ChevronDown } from "lucide-react";
import type { DB } from "@/types/db";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { getChurchId } from "@/lib/tenant";
import {
  ORG_RESOURCE,
  orgIsColoredSlot,
  orgSlotColor,
  orgShadeHex,
} from "@/styles/orgResourceTokens";
import { TB_PLACES } from "@/components/churchPlanner/plannerDb";

type OrgTab = "dept" | "mokjang" | "place";

type PlannerPlace = {
  id: string;
  church_id: string;
  name: string;
  capacity?: number | null;
  equipment?: string[] | null;
  sort_order?: number;
  is_active?: boolean;
};

const ORG_TAB_KEY = "pastoral_org_tab";
const SLOT_COLORS_KEY = "pastoral_org_slot_colors";
const MOKJANG_LEADERS_KEY = "pastoral_org_mokjang_leaders";
const SMALL_GROUP_TERM_KEY = "pastoral_org_small_group_term";
const DEFAULT_SMALL_GROUP_TERM = "소그룹";

/** 한국 교회에서 쓰는 소그룹 명칭 예시 — 클릭 시 명칭·리더 호칭 자동 적용 */
const SMALL_GROUP_TERM_PRESETS: { term: string; leader: string }[] = [
  { term: "목장", leader: "목자" },
  { term: "셀", leader: "셀 리더" },
  { term: "구역", leader: "구역장" },
  { term: "속", leader: "속장" },
  { term: "전도회", leader: "회장" },
  { term: "선교회", leader: "회장" },
];

function inferLeaderLabelFromTerm(term: string): string {
  const trimmed = term.trim();
  if (!trimmed || trimmed === "소그룹") return "리더";
  const preset = SMALL_GROUP_TERM_PRESETS.find((p) => p.term === trimmed);
  if (preset) return preset.leader;
  if (trimmed.endsWith("회")) return "회장";
  return `${trimmed} 리더`;
}

function mokjangUiLabels(term: string) {
  const t = term.trim() || DEFAULT_SMALL_GROUP_TERM;
  return {
    tab: `${t} 관리`,
    add: `${t} 추가하기`,
    addModal: `새 ${t} 추가`,
    editModal: `${t} 수정`,
    placeholder: `${t} 이름을 입력하세요`,
    memberAssign: `${t}원 배정`,
    step1Desc: `${t} 이름을 입력한 뒤 다음 단계에서 성도를 배정합니다.`,
    step2Desc: `먼저 ${inferLeaderLabelFromTerm(t)}를 지정한 뒤 ${t}원을 추가하세요.`,
    memberAdd: `${t}원 추가`,
    unassigned: `${t} 미배정`,
    none: `${t} 없음`,
    duplicate: `이미 있는 ${t}입니다`,
    saved: `${t}이 저장되었습니다`,
    added: `${t}이 추가되었습니다`,
    deleted: `${t}이 삭제되었습니다`,
    prefix: t,
  };
}

const TAB_LABELS: Record<OrgTab, string> = {
  dept: "부서 관리",
  mokjang: "소그룹 관리",
  place: "장소 관리",
};

const ADD_LABELS: Record<Exclude<OrgTab, "mokjang">, string> = {
  dept: "부서 추가하기",
  place: "장소 추가하기",
};

const ADD_MODAL_TITLES: Record<Exclude<OrgTab, "mokjang">, string> = {
  dept: "새 부서 추가",
  place: "새 장소 추가",
};

const EDIT_MODAL_TITLES: Record<Exclude<OrgTab, "mokjang">, string> = {
  dept: "부서 수정",
  place: "장소 수정",
};

const INPUT_PLACEHOLDERS: Record<Exclude<OrgTab, "mokjang">, string> = {
  dept: "부서 이름을 입력하세요",
  place: "장소 이름을 입력하세요",
};

const PLACE_CAPACITY_PLACEHOLDER = "수용 인원 (명)";

function parseDeptList(depts: string): string[] {
  return depts.split(",").map((d) => d.trim()).filter(Boolean);
}

function loadColorMap(key: string, churchId: string): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(`${key}_${churchId}`);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

function saveColorMap(key: string, churchId: string, map: Record<string, string>) {
  if (typeof window === "undefined") return;
  localStorage.setItem(`${key}_${churchId}`, JSON.stringify(map));
}

function loadMokjangLeaders(churchId: string): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(`${MOKJANG_LEADERS_KEY}_${churchId}`);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

function saveMokjangLeaders(churchId: string, map: Record<string, string>) {
  if (typeof window === "undefined") return;
  localStorage.setItem(`${MOKJANG_LEADERS_KEY}_${churchId}`, JSON.stringify(map));
}

function loadSmallGroupTerm(churchId: string): string {
  if (typeof window === "undefined") return "";
  try {
    const stored = localStorage.getItem(`${SMALL_GROUP_TERM_KEY}_${churchId}`)?.trim() ?? "";
    if (!stored || stored === DEFAULT_SMALL_GROUP_TERM) return "";
    return stored;
  } catch {
    return "";
  }
}

function saveSmallGroupTerm(churchId: string, term: string) {
  if (typeof window === "undefined") return;
  const trimmed = term.trim();
  const normalized = !trimmed || trimmed === DEFAULT_SMALL_GROUP_TERM ? "" : trimmed;
  if (!normalized) {
    localStorage.removeItem(`${SMALL_GROUP_TERM_KEY}_${churchId}`);
  } else {
    localStorage.setItem(`${SMALL_GROUP_TERM_KEY}_${churchId}`, normalized);
  }
}

function displaySmallGroupTermInput(term: string): string {
  const trimmed = term.trim();
  if (!trimmed || trimmed === DEFAULT_SMALL_GROUP_TERM) return "";
  return trimmed;
}

/* ── 세그먼트 탭 (회색 사각 컨테이너 + 흰 활성 탭) ── */
/** 세 탭 동일 너비 (소그룹 명칭 변경 시에도 레이아웃 고정) */
const ORG_SEG_TAB_EQUAL_WIDTH = 136;
const ORG_SEG_TAB_PAD_X = 14;
const ORG_GROUP_TERM_BAR_WIDTH = 480;

function OrgSegTabButton({
  id,
  active,
  onClick,
  label,
  equalWidth,
}: {
  id: OrgTab;
  active: boolean;
  onClick: () => void;
  label?: string;
  equalWidth?: number;
}) {
  const [hover, setHover] = useState(false);
  const showHover = hover && !active;

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        border: "none",
        borderRadius: ORG_RESOURCE.segTabRadius,
        padding: `${ORG_RESOURCE.segTabPadY}px ${equalWidth ? ORG_SEG_TAB_PAD_X : ORG_RESOURCE.segTabPadX}px`,
        fontSize: ORG_RESOURCE.segTabFontSize,
        fontWeight: active ? ORG_RESOURCE.segTabActiveFontWeight : ORG_RESOURCE.segTabFontWeight,
        fontFamily: ORG_RESOURCE.fontKR,
        cursor: "pointer",
        background: active
          ? ORG_RESOURCE.segTabActiveBg
          : showHover
            ? ORG_RESOURCE.segTabHoverBg
            : "transparent",
        color: active
          ? ORG_RESOURCE.segTabActiveColor
          : showHover
            ? ORG_RESOURCE.segTabHoverColor
            : ORG_RESOURCE.segTabInactiveColor,
        boxShadow: active
          ? ORG_RESOURCE.segTabActiveShadow
          : showHover
            ? ORG_RESOURCE.segTabHoverShadow
            : "none",
        whiteSpace: "nowrap",
        transition: "background 0.15s ease, box-shadow 0.15s ease, color 0.15s ease",
        ...(equalWidth
          ? {
              width: equalWidth,
              minWidth: equalWidth,
              maxWidth: equalWidth,
              boxSizing: "border-box" as const,
              textAlign: "center" as const,
              overflow: "hidden",
              textOverflow: "ellipsis",
            }
          : {}),
      }}
    >
      {label ?? TAB_LABELS[id]}
    </button>
  );
}

function OrgSegmentTabs({
  tab,
  onChange,
  mokjangTabLabel,
  inline,
}: {
  tab: OrgTab;
  onChange: (t: OrgTab) => void;
  mokjangTabLabel?: string;
  inline?: boolean;
}) {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: ORG_RESOURCE.segGap,
        padding: ORG_RESOURCE.segPad,
        borderRadius: ORG_RESOURCE.segRadius,
        background: ORG_RESOURCE.segBg,
        marginBottom: inline ? 0 : ORG_RESOURCE.segToGridGap,
        flexShrink: 0,
      }}
    >
      {(["dept", "mokjang", "place"] as OrgTab[]).map((id) => (
        <OrgSegTabButton
          key={id}
          id={id}
          active={tab === id}
          onClick={() => onChange(id)}
          label={id === "mokjang" ? mokjangTabLabel : undefined}
          equalWidth={ORG_SEG_TAB_EQUAL_WIDTH}
        />
      ))}
    </div>
  );
}

const SMALL_GROUP_TERM_EXAMPLES = SMALL_GROUP_TERM_PRESETS.map((p) => p.term).join(", ");

function SmallGroupTermCustomizer({
  term,
  onTermChange,
}: {
  term: string;
  onTermChange: (term: string) => void;
}) {
  const [draft, setDraft] = useState(() => displaySmallGroupTermInput(term));
  const inputRef = useRef<HTMLInputElement>(null);
  const focusedRef = useRef(false);
  const composingRef = useRef(false);
  const skipBlurCommitRef = useRef(false);

  useEffect(() => {
    if (!focusedRef.current) {
      setDraft(displaySmallGroupTermInput(term));
    }
  }, [term]);

  const commit = (value: string) => {
    const trimmed = value.trim();
    const normalized = !trimmed || trimmed === DEFAULT_SMALL_GROUP_TERM ? "" : trimmed;
    setDraft(displaySmallGroupTermInput(normalized));
    if (normalized !== term) {
      onTermChange(normalized);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        width: ORG_GROUP_TERM_BAR_WIDTH,
        flexShrink: 0,
        fontFamily: ORG_RESOURCE.fontKR,
        boxSizing: "border-box",
        paddingLeft: 4,
      }}
    >
      <span
        style={{
          fontSize: 14,
          fontWeight: 600,
          color: "#6b7280",
          whiteSpace: "nowrap",
          flexShrink: 0,
        }}
      >
        소그룹 형태
      </span>
      <input
        ref={inputRef}
        type="text"
        value={draft}
        onFocus={() => { focusedRef.current = true; }}
        onChange={(e) => setDraft(e.target.value)}
        onCompositionStart={() => { composingRef.current = true; }}
        onCompositionEnd={(e) => {
          composingRef.current = false;
          setDraft(e.currentTarget.value);
        }}
        onBlur={() => {
          focusedRef.current = false;
          if (skipBlurCommitRef.current) {
            skipBlurCommitRef.current = false;
            return;
          }
          window.setTimeout(() => {
            if (composingRef.current) return;
            commit(inputRef.current?.value ?? draft);
          }, 0);
        }}
        onKeyDown={(e) => {
          if (e.key !== "Enter") return;
          if (e.nativeEvent.isComposing || composingRef.current) return;
          e.preventDefault();
          skipBlurCommitRef.current = true;
          commit((e.currentTarget as HTMLInputElement).value);
          (e.currentTarget as HTMLInputElement).blur();
        }}
        placeholder={DEFAULT_SMALL_GROUP_TERM}
        aria-label="소그룹 형태"
        style={{
          width: 96,
          height: 34,
          padding: "0 12px",
          boxSizing: "border-box",
          border: "1px solid #e3e4e8",
          borderRadius: 6,
          background: "#ffffff",
          fontSize: 15,
          fontFamily: ORG_RESOURCE.fontKR,
          color: "#0b0c0e",
          textAlign: "center",
          outline: "none",
          flexShrink: 0,
        }}
      />
      <span
        style={{
          fontSize: 13,
          color: "#b0b4bc",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          flex: 1,
          minWidth: 0,
        }}
      >
        예 {SMALL_GROUP_TERM_EXAMPLES}
      </span>
    </div>
  );
}

/* ── 추가 카드 (흰 테두리 · 호버 시 흰 배경) ── */
function OrgAddCard({ label, onClick }: { label: string; onClick: () => void }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: ORG_RESOURCE.cardWidth,
        height: ORG_RESOURCE.cardHeight,
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        padding: 16,
        borderRadius: ORG_RESOURCE.cardRadius,
        border: `${ORG_RESOURCE.addCardBorderWidth}px solid ${ORG_RESOURCE.addCardBorder}`,
        background: hover ? ORG_RESOURCE.addCardBgHover : ORG_RESOURCE.addCardBg,
        cursor: "pointer",
        fontFamily: ORG_RESOURCE.fontKR,
        transition: "background 0.15s ease",
      }}
    >
      <div
        style={{
          width: ORG_RESOURCE.addIconBoxSize,
          height: ORG_RESOURCE.addIconBoxSize,
          borderRadius: ORG_RESOURCE.addIconBoxRadius,
          background: hover ? ORG_RESOURCE.addIconBoxBgHover : ORG_RESOURCE.addIconBoxBg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "background 0.15s ease",
        }}
      >
        <Plus
          size={ORG_RESOURCE.addIconSize}
          strokeWidth={1.5}
          color={hover ? ORG_RESOURCE.addIconColorHover : ORG_RESOURCE.addIconColor}
        />
      </div>
      <span
        style={{
          fontSize: ORG_RESOURCE.addLabelSize,
          fontWeight: ORG_RESOURCE.addLabelWeight,
          color: hover ? ORG_RESOURCE.addLabelColorHover : ORG_RESOURCE.addLabelColor,
          transition: "color 0.15s ease",
        }}
      >
        {label}
      </span>
    </button>
  );
}

const cardShell: CSSProperties = {
  width: ORG_RESOURCE.cardWidth,
  height: ORG_RESOURCE.cardHeight,
  boxSizing: "border-box",
  borderRadius: ORG_RESOURCE.cardRadius,
  position: "relative",
  padding: `${ORG_RESOURCE.cardPadY}px ${ORG_RESOURCE.cardPadX}px`,
  fontFamily: ORG_RESOURCE.fontKR,
};

/* ── 통합 리소스 카드 (부서·목장·장소 동일 레이아웃) ── */
function OrgResourceCard({
  title,
  subtitle,
  count,
  countUnit = "명",
  colored,
  color,
  onEdit,
  onDelete,
}: {
  title: string;
  subtitle?: string;
  count: number;
  countUnit?: string;
  colored: boolean;
  color?: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [hover, setHover] = useState(false);
  const bg = colored && color ? color : ORG_RESOURCE.cardNeutralBg;
  const iconBg = colored && color ? orgShadeHex(color, 0.82) : ORG_RESOURCE.cardIconBtnNeutralBg;
  const actionReserve = ORG_RESOURCE.cardIconBtnSize * 2 + 10;

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setHover(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setHover(false);
      }}
      style={{
        ...cardShell,
        background: bg,
        boxShadow: colored ? "none" : ORG_RESOURCE.cardNeutralShadow,
        border: "none",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: ORG_RESOURCE.cardPadY,
          left: ORG_RESOURCE.cardPadX,
          right: hover ? ORG_RESOURCE.cardPadX + actionReserve : ORG_RESOURCE.cardPadX,
          minWidth: 0,
          transition: "right 0.15s ease",
        }}
      >
        <div style={{ fontSize: ORG_RESOURCE.cardTitleSize, fontWeight: ORG_RESOURCE.cardTitleWeight, color: ORG_RESOURCE.cardInk, lineHeight: 1.2 }}>
          {title}
        </div>
        {subtitle && (
          <div style={{ fontSize: ORG_RESOURCE.cardSubtitleSize, fontWeight: ORG_RESOURCE.cardSubtitleWeight, color: ORG_RESOURCE.cardSubtitleColor, marginTop: 4, lineHeight: 1.3 }}>
            {subtitle}
          </div>
        )}
      </div>
      <div
        style={{
          position: "absolute",
          top: ORG_RESOURCE.cardPadY,
          right: ORG_RESOURCE.cardPadX,
          display: "flex",
          gap: 5,
          opacity: hover ? 1 : 0,
          pointerEvents: hover ? "auto" : "none",
          transition: "opacity 0.15s ease",
        }}
      >
        <button type="button" aria-label="수정" onClick={(e) => { e.stopPropagation(); onEdit(); }} style={{ ...cardIconBtn, background: iconBg }}>
          <Pencil size={ORG_RESOURCE.cardActionIconSize} strokeWidth={2} color={ORG_RESOURCE.cardInk} />
        </button>
        <button type="button" aria-label="삭제" onClick={(e) => { e.stopPropagation(); onDelete(); }} style={{ ...cardIconBtn, background: iconBg }}>
          <Trash2 size={ORG_RESOURCE.cardActionIconSize} strokeWidth={2} color={ORG_RESOURCE.cardInk} />
        </button>
      </div>
      <div
        style={{
          position: "absolute",
          right: ORG_RESOURCE.cardPadX,
          bottom: ORG_RESOURCE.cardPadY,
          display: "flex",
          alignItems: "baseline",
          gap: 2,
          lineHeight: 1,
        }}
      >
        <span style={{ fontFamily: ORG_RESOURCE.fontLatin, fontSize: ORG_RESOURCE.cardCountNumSize, fontWeight: ORG_RESOURCE.cardCountWeight, color: ORG_RESOURCE.cardInk, letterSpacing: "-0.02em" }}>
          {count}
        </span>
        <span style={{ fontFamily: ORG_RESOURCE.fontKR, fontSize: ORG_RESOURCE.cardCountUnitSize, fontWeight: ORG_RESOURCE.cardCountWeight, color: ORG_RESOURCE.cardInk }}>
          {countUnit}
        </span>
      </div>
    </div>
  );
}

const cardIconBtn: CSSProperties = {
  border: "none",
  borderRadius: ORG_RESOURCE.cardIconBtnRadius,
  width: ORG_RESOURCE.cardIconBtnSize,
  height: ORG_RESOURCE.cardIconBtnSize,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
};

function OrgCardGrid({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: ORG_RESOURCE.gridGap,
        justifyContent: "flex-start",
        alignContent: "flex-start",
        width: "100%",
      }}
    >
      {children}
    </div>
  );
}

/* ── 추가/수정 모달 (시안: 제목 좌상단, 회색 입력, 취소+등록) ── */
export function OrgFormModal({
  open,
  title,
  value,
  placeholder,
  onChange,
  onClose,
  onSubmit,
  submitLabel = "등록",
  capacityValue,
  onCapacityChange,
  capacityPlaceholder,
}: {
  open: boolean;
  title: string;
  value: string;
  placeholder: string;
  onChange: (v: string) => void;
  onClose: () => void;
  onSubmit: () => void;
  submitLabel?: string;
  capacityValue?: string;
  onCapacityChange?: (v: string) => void;
  capacityPlaceholder?: string;
}) {
  if (!open) return null;
  const fieldStyle: CSSProperties = {
    width: "100%",
    height: ORG_RESOURCE.modalInputHeight,
    padding: "0 16px",
    boxSizing: "border-box",
    border: "none",
    borderRadius: ORG_RESOURCE.modalInputRadius,
    background: ORG_RESOURCE.modalInputBg,
    fontSize: ORG_RESOURCE.modalInputFontSize,
    fontFamily: ORG_RESOURCE.fontKR,
    color: "#0b0c0e",
    outline: "none",
  };
  return (
    <div
      className="modal-bg open"
      role="presentation"
      style={{ backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)" }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={{ maxWidth: ORG_RESOURCE.modalWidth, padding: ORG_RESOURCE.modalPad, borderRadius: ORG_RESOURCE.modalRadius }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 style={{ margin: "0 0 20px", fontSize: ORG_RESOURCE.modalTitleSize, fontWeight: ORG_RESOURCE.modalTitleWeight, color: "#0b0c0e", fontFamily: ORG_RESOURCE.fontKR }}>
          {title}
        </h2>
        <input
          autoFocus
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          onKeyDown={(e) => { if (e.key === "Enter" && !onCapacityChange) onSubmit(); }}
          style={{ ...fieldStyle, marginBottom: onCapacityChange ? 12 : 20 }}
        />
        {onCapacityChange && (
          <input
            value={capacityValue ?? ""}
            onChange={(e) => onCapacityChange(e.target.value.replace(/\D/g, ""))}
            placeholder={capacityPlaceholder ?? PLACE_CAPACITY_PLACEHOLDER}
            inputMode="numeric"
            onKeyDown={(e) => { if (e.key === "Enter") onSubmit(); }}
            style={{ ...fieldStyle, marginBottom: 20 }}
          />
        )}
        <div style={{ display: "flex", gap: ORG_RESOURCE.modalBtnGap }}>
          <button type="button" onClick={onClose} style={modalBtnCancel}>취소</button>
          <button type="button" onClick={onSubmit} style={modalBtnSubmit}>{submitLabel}</button>
        </div>
      </div>
    </div>
  );
}

const modalBtnCancel: CSSProperties = {
  flex: 1,
  height: ORG_RESOURCE.modalBtnHeight,
  borderRadius: ORG_RESOURCE.modalBtnRadius,
  border: "1px solid #e3e4e8",
  background: "#ffffff",
  color: "#0b0c0e",
  fontSize: 15,
  fontWeight: 600,
  fontFamily: ORG_RESOURCE.fontKR,
  cursor: "pointer",
};

const modalBtnSubmit: CSSProperties = {
  flex: 1,
  height: ORG_RESOURCE.modalBtnHeight,
  borderRadius: ORG_RESOURCE.modalBtnRadius,
  border: "none",
  background: "#0b0c0e",
  color: "#ffffff",
  fontSize: 15,
  fontWeight: 600,
  fontFamily: ORG_RESOURCE.fontKR,
  cursor: "pointer",
};

/* ── 삭제 확인 모달 ── */
export function OrgDeleteModal({
  open,
  name,
  tab,
  onClose,
  onConfirm,
}: {
  open: boolean;
  name: string;
  tab: OrgTab;
  onClose: () => void;
  onConfirm: () => void;
}) {
  if (!open) return null;
  const desc =
    tab === "mokjang"
      ? `${name}을 삭제하면 소속 성도들은 모두 미배정으로 바뀝니다.`
      : tab === "dept"
        ? `${name} 부서를 삭제하면 해당 성도들의 부서 정보가 비워집니다.`
        : `${name} 장소를 삭제합니다.`;

  return (
    <div
      className="modal-bg open"
      role="presentation"
      style={{ backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)" }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="modal"
        role="alertdialog"
        aria-modal="true"
        aria-label="삭제 확인"
        style={{ maxWidth: ORG_RESOURCE.modalWidth, padding: ORG_RESOURCE.modalPad, borderRadius: ORG_RESOURCE.modalRadius, textAlign: "center" }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
          <AlertTriangle size={32} strokeWidth={1.75} color={ORG_RESOURCE.modalDeleteRed} />
        </div>
        <h2 style={{ margin: "0 0 10px", fontSize: ORG_RESOURCE.modalTitleSize, fontWeight: ORG_RESOURCE.modalTitleWeight, color: "#0b0c0e", fontFamily: ORG_RESOURCE.fontKR }}>
          정말 삭제할까요?
        </h2>
        <p style={{ margin: "0 0 24px", fontSize: 14, color: "#6b7280", lineHeight: 1.5, fontFamily: ORG_RESOURCE.fontKR }}>
          {desc}
        </p>
        <div style={{ display: "flex", gap: ORG_RESOURCE.modalBtnGap }}>
          <button type="button" onClick={onClose} style={modalBtnCancel}>취소</button>
          <button
            type="button"
            onClick={onConfirm}
            style={{ ...modalBtnSubmit, background: ORG_RESOURCE.modalDeleteRed }}
          >
            삭제
          </button>
        </div>
      </div>
    </div>
  );
}

export type OrgMemberManageKind = "dept" | "mokjang";

type ResourceWizardState = {
  kind: OrgMemberManageKind;
  mode: "add" | "edit";
  step: 1 | 2;
  name: string;
  oldName: string | null;
  draftMemberIds: string[];
  leaderId: string | null;
};

const modalInputStyle: CSSProperties = {
  width: "100%",
  height: ORG_RESOURCE.modalInputHeight,
  padding: "0 16px",
  boxSizing: "border-box",
  border: "none",
  borderRadius: ORG_RESOURCE.modalInputRadius,
  background: ORG_RESOURCE.modalInputBg,
  fontSize: ORG_RESOURCE.modalInputFontSize,
  fontFamily: ORG_RESOURCE.fontKR,
  color: "#0b0c0e",
  outline: "none",
};

const modalSelectStyle: CSSProperties = {
  ...modalInputStyle,
  padding: "0 44px 0 16px",
};

const modalFieldLabel: CSSProperties = {
  display: "block",
  fontSize: 13,
  fontWeight: 600,
  color: "#6b7280",
  marginBottom: 8,
  fontFamily: ORG_RESOURCE.fontKR,
};

function OrgModalSelect({
  value,
  onChange,
  disabled,
  placeholder,
  "aria-label": ariaLabel,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  placeholder?: string;
  "aria-label"?: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ position: "relative", width: "100%" }}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        aria-label={ariaLabel}
        style={{
          ...modalSelectStyle,
          appearance: "none",
          WebkitAppearance: "none",
          MozAppearance: "none",
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.5 : 1,
          color: value ? "#0b0c0e" : "#8b909a",
        }}
      >
        {placeholder != null && <option value="">{placeholder}</option>}
        {children}
      </select>
      <ChevronDown
        size={18}
        strokeWidth={2}
        aria-hidden
        style={{
          position: "absolute",
          right: 16,
          top: "50%",
          transform: "translateY(-50%)",
          color: disabled ? "#c4c8d0" : "#8b909a",
          pointerEvents: "none",
        }}
      />
    </div>
  );
}

const modalMemberRemoveBtn: CSSProperties = {
  padding: 0,
  marginLeft: 2,
  border: "none",
  background: "transparent",
  color: "#c4c8d0",
  fontSize: 14,
  lineHeight: 1,
  fontFamily: ORG_RESOURCE.fontKR,
  cursor: "pointer",
  flexShrink: 0,
};

function memberIdsInResource(db: DB, kind: OrgMemberManageKind, name: string): string[] {
  return db.members
    .filter((m) => {
      if (m.status === "졸업/전출") return false;
      if (kind === "dept") return m.dept === name;
      return ((m.mokjang ?? m.group) || "") === name;
    })
    .map((m) => m.id);
}

/** 부서·목장 추가/편집 — 1단계 이름 → 2단계 인원 배정 */
function OrgDeptMokWizardModal({
  wizard,
  db,
  leaderLabel,
  mokjangLabels,
  groupTerm,
  onNameChange,
  onDraftChange,
  onLeaderChange,
  onStepChange,
  onClose,
  onNext,
  onBack,
  onFinish,
}: {
  wizard: ResourceWizardState;
  db: DB;
  leaderLabel: string;
  mokjangLabels: ReturnType<typeof mokjangUiLabels>;
  groupTerm: string;
  onNameChange: (v: string) => void;
  onDraftChange: (ids: string[]) => void;
  onLeaderChange: (id: string | null, draftMemberIds?: string[]) => void;
  onStepChange: (step: 1 | 2) => void;
  onClose: () => void;
  onNext: () => void;
  onBack: () => void;
  onFinish: () => void;
}) {
  const { kind, mode, step, name, draftMemberIds, leaderId } = wizard;
  const isDept = kind === "dept";
  const stepTitle =
    step === 1
      ? (mode === "add"
          ? (isDept ? ADD_MODAL_TITLES.dept : mokjangLabels.addModal)
          : (isDept ? EDIT_MODAL_TITLES.dept : mokjangLabels.editModal))
      : (isDept ? "부서원 배정" : mokjangLabels.memberAssign);
  const stepDesc =
    step === 1
      ? (isDept ? "부서 이름을 입력한 뒤 다음 단계에서 성도를 배정합니다." : mokjangLabels.step1Desc)
      : (isDept ? "이 부서에 소속할 성도를 선택하세요." : mokjangLabels.step2Desc);

  const draftMembers = db.members.filter((m) => draftMemberIds.includes(m.id));
  const availableMembers = db.members.filter((m) => {
    if (m.status === "졸업/전출") return false;
    if (draftMemberIds.includes(m.id)) return false;
    return true;
  });

  const handleMemberSelect = (id: string) => {
    if (!id || draftMemberIds.includes(id)) return;
    onDraftChange([...draftMemberIds, id]);
  };

  const handleLeaderChange = (id: string | null) => {
    if (id && !draftMemberIds.includes(id)) {
      onLeaderChange(id, [...draftMemberIds, id]);
      return;
    }
    onLeaderChange(id);
  };

  const removeDraftMember = (id: string) => {
    onDraftChange(draftMemberIds.filter((x) => x !== id));
    if (!isDept && leaderId === id) onLeaderChange(null);
  };

  const leaderCandidates = db.members.filter((m) => m.status !== "졸업/전출");

  const leaderMember = leaderId ? draftMembers.find((m) => m.id === leaderId) : null;
  const groupMembers =
    !isDept && leaderId ? draftMembers.filter((m) => m.id !== leaderId) : draftMembers;
  const totalCount = draftMembers.length;

  const memberListPanel = (
    <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", marginBottom: 0 }}>
      <label style={modalFieldLabel}>
        배정 현황
        <span style={{ fontWeight: 500, color: "#b0b4bc", marginLeft: 6 }}>
          {totalCount}명
        </span>
      </label>

      <div
        style={{
          flex: 1,
          minHeight: ORG_RESOURCE.modalMemberListHeight,
          borderRadius: ORG_RESOURCE.modalInputRadius,
          background: ORG_RESOURCE.modalInputBg,
          padding: "16px 18px",
          boxSizing: "border-box",
          overflowY: "auto",
          fontFamily: ORG_RESOURCE.fontKR,
        }}
      >
        {totalCount === 0 ? (
          <div
            style={{
              height: "100%",
              minHeight: ORG_RESOURCE.modalMemberListHeight - 32,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
              fontSize: 14,
              color: "#8b909a",
              lineHeight: 1.55,
            }}
          >
            아직 배정된 성도가 없습니다.
            <br />
            <span style={{ fontSize: 13, color: "#b0b4bc" }}>
              {isDept
                ? "위에서 성도를 선택해 추가하세요."
                : `위에서 ${leaderLabel}를 지정하고 ${groupTerm}원을 선택하세요.`}
            </span>
          </div>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "6px 4px", lineHeight: 1.7 }}>
            {!isDept ? (
              <>
                <span
                  style={{
                    fontSize: 16,
                    fontWeight: 700,
                    color: leaderMember ? "#0b0c0e" : "#b0b4bc",
                  }}
                >
                  {leaderMember?.name ?? `${leaderLabel} 미지정`}
                </span>
                {groupMembers.map((m, i) => (
                  <span key={m.id} style={{ display: "inline-flex", alignItems: "center" }}>
                    <span style={{ color: "#d1d5db", fontSize: 13, margin: "0 4px", userSelect: "none" }} aria-hidden>·</span>
                    <span style={{ fontSize: 13, fontWeight: 500, color: "#8b909a" }}>{m.name}</span>
                    <button
                      type="button"
                      onClick={() => removeDraftMember(m.id)}
                      style={modalMemberRemoveBtn}
                      aria-label={`${m.name} 제거`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </>
            ) : (
              draftMembers.map((m, i) => (
                <span key={m.id} style={{ display: "inline-flex", alignItems: "center" }}>
                  {i > 0 && (
                    <span style={{ color: "#d1d5db", fontSize: 13, marginRight: 4, userSelect: "none" }} aria-hidden>·</span>
                  )}
                  <span style={{ fontSize: 13, fontWeight: 500, color: "#8b909a" }}>{m.name}</span>
                  <button
                    type="button"
                    onClick={() => removeDraftMember(m.id)}
                    style={modalMemberRemoveBtn}
                    aria-label={`${m.name} 제거`}
                  >
                    ×
                  </button>
                </span>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );

  const addMemberPanel = (
    <div style={{ marginBottom: 12, flexShrink: 0 }}>
      <label style={modalFieldLabel}>{isDept ? "성도 추가" : mokjangLabels.memberAdd}</label>
      <OrgModalSelect
        value=""
        onChange={handleMemberSelect}
        placeholder="성도 선택"
        aria-label="성도 선택"
      >
        {availableMembers.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
            {isDept
              ? ` (${(m.mokjang ?? m.group) || mokjangLabels.none})`
              : ` (${m.dept || "부서 없음"})`}
          </option>
        ))}
      </OrgModalSelect>
    </div>
  );

  const wizardModalShell: CSSProperties = {
    width: ORG_RESOURCE.modalWidth,
    maxWidth: ORG_RESOURCE.modalWidth,
    height: ORG_RESOURCE.modalWizardHeight,
    minHeight: ORG_RESOURCE.modalWizardHeight,
    maxHeight: ORG_RESOURCE.modalWizardHeight,
    padding: ORG_RESOURCE.modalPad,
    borderRadius: ORG_RESOURCE.modalRadius,
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  };

  const wizardFooter = (
    <div style={{ display: "flex", gap: ORG_RESOURCE.modalBtnGap, flexShrink: 0, marginTop: 16 }}>
      {step === 1 ? (
        <>
          <button type="button" onClick={onClose} style={modalBtnCancel}>취소</button>
          <button type="button" onClick={onNext} style={modalBtnSubmit}>다음</button>
        </>
      ) : (
        <>
          <button type="button" onClick={onBack} style={modalBtnCancel}>이전</button>
          <button type="button" onClick={onFinish} style={modalBtnSubmit}>
            {mode === "add" ? "등록" : "저장"}
          </button>
        </>
      )}
    </div>
  );

  return (
    <div
      className="modal-bg open"
      role="presentation"
      style={{ backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)" }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={stepTitle}
        style={wizardModalShell}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, flexShrink: 0 }}>
          <h2 style={{ margin: 0, fontSize: ORG_RESOURCE.modalTitleSize, fontWeight: ORG_RESOURCE.modalTitleWeight, color: "#0b0c0e", fontFamily: ORG_RESOURCE.fontKR }}>
            {stepTitle}
          </h2>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#8b909a", fontFamily: ORG_RESOURCE.fontLatin }}>
            {step} / 2
          </span>
        </div>
        <p style={{ margin: "0 0 16px", fontSize: 14, color: "#6b7280", lineHeight: 1.5, fontFamily: ORG_RESOURCE.fontKR, flexShrink: 0 }}>
          {stepDesc}
        </p>

        <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {step === 1 ? (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-start" }}>
              <input
                autoFocus
                value={name}
                onChange={(e) => onNameChange(e.target.value)}
                placeholder={isDept ? INPUT_PLACEHOLDERS.dept : mokjangLabels.placeholder}
                onKeyDown={(e) => { if (e.key === "Enter") onNext(); }}
                style={{ ...modalInputStyle, marginBottom: 0 }}
              />
            </div>
          ) : (
            <>
              {!isDept && (
                <div style={{ marginBottom: 12, flexShrink: 0 }}>
                  <label style={modalFieldLabel}>
                    {leaderLabel} 지정 <span style={{ fontWeight: 500, color: "#b0b4bc" }}>(선택)</span>
                  </label>
                  <OrgModalSelect
                    value={leaderId ?? ""}
                    onChange={(v) => handleLeaderChange(v || null)}
                    placeholder={`${leaderLabel} 없음`}
                    aria-label={`${leaderLabel} 선택`}
                  >
                    {leaderCandidates.map((m) => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </OrgModalSelect>
                </div>
              )}

              {addMemberPanel}
              {memberListPanel}
            </>
          )}
        </div>

        {wizardFooter}
      </div>
    </div>
  );
}

export function OrganizationResourceSub({
  db,
  setDb,
  persist,
  toast,
  saveDb,
  getMokjangList,
}: {
  db: DB;
  setDb: (fn: (prev: DB) => DB) => void;
  persist: () => void;
  toast: (m: string, t?: string) => void;
  saveDb: (d: DB) => Promise<void>;
  getMokjangList: (db: DB) => string[];
}) {
  const { churchId: authChurchId } = useAuth();
  const churchId = authChurchId || getChurchId();

  const [tab, setTab] = useState<OrgTab>(() => {
    if (typeof window === "undefined") return "dept";
    const v = sessionStorage.getItem(ORG_TAB_KEY);
    return v === "mokjang" || v === "place" ? v : "dept";
  });

  const [slotColors, setSlotColors] = useState<Record<string, string>>({});
  const [mokjangLeaders, setMokjangLeaders] = useState<Record<string, string>>({});
  const [smallGroupTerm, setSmallGroupTerm] = useState("");
  const [places, setPlaces] = useState<PlannerPlace[]>([]);
  const [placesLoading, setPlacesLoading] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editOldName, setEditOldName] = useState<string | null>(null);
  const [editPlaceId, setEditPlaceId] = useState<string | null>(null);
  const [editCapacity, setEditCapacity] = useState("");

  const [deleteTarget, setDeleteTarget] = useState<{ type: OrgTab; name: string; id?: string } | null>(null);
  const [resourceWizard, setResourceWizard] = useState<ResourceWizardState | null>(null);
  useEffect(() => {
    sessionStorage.setItem(ORG_TAB_KEY, tab);
  }, [tab]);

  useEffect(() => {
    if (!churchId) return;
    setSlotColors(loadColorMap(SLOT_COLORS_KEY, churchId));
    setMokjangLeaders(loadMokjangLeaders(churchId));
    setSmallGroupTerm(loadSmallGroupTerm(churchId));
  }, [churchId]);

  const mokjangLabels = useMemo(() => mokjangUiLabels(smallGroupTerm), [smallGroupTerm]);
  const smallGroupLeaderLabel = useMemo(() => inferLeaderLabelFromTerm(smallGroupTerm), [smallGroupTerm]);

  const handleSmallGroupTermChange = (term: string) => {
    setSmallGroupTerm(term);
    if (churchId) saveSmallGroupTerm(churchId, term);
  };

  const deptNames = useMemo(() => parseDeptList(db.settings.depts || ""), [db.settings.depts]);
  const mokjangNames = useMemo(() => getMokjangList(db), [db, getMokjangList]);

  const loadPlaces = useCallback(async () => {
    if (!supabase || !churchId) return;
    setPlacesLoading(true);
    try {
      const { data, error } = await supabase.from(TB_PLACES).select("*").eq("church_id", churchId).order("sort_order");
      if (error) throw error;
      setPlaces((data ?? []) as PlannerPlace[]);
    } catch (e) {
      console.error("[org] loadPlaces", e);
      toast("장소 목록을 불러오지 못했습니다", "err");
    } finally {
      setPlacesLoading(false);
    }
  }, [churchId, toast]);

  useEffect(() => {
    if (tab === "place") void loadPlaces();
  }, [tab, loadPlaces]);

  const getDeptSubtitle = (deptName: string): string | undefined => {
    const members = db.members.filter((m) => m.dept === deptName && m.status !== "졸업/전출");
    const leader =
      members.find((m) => (m.role || "").includes("담당") || (m.role || "").includes("부장") || (m.role || "").includes("교사")) ??
      members.find((m) => m.role?.trim());
    if (leader) return `담당자 ${leader.name}`;
    return undefined;
  };

  const persistMokjangLeader = (groupName: string, memberId: string | null) => {
    const nc = { ...mokjangLeaders };
    if (memberId) nc[groupName] = memberId;
    else delete nc[groupName];
    setMokjangLeaders(nc);
    if (churchId) saveMokjangLeaders(churchId, nc);
  };

  const renameMokjangLeaderKey = (oldName: string, newName: string) => {
    if (!mokjangLeaders[oldName]) return;
    const nc = { ...mokjangLeaders };
    nc[newName] = nc[oldName];
    delete nc[oldName];
    setMokjangLeaders(nc);
    if (churchId) saveMokjangLeaders(churchId, nc);
  };

  const removeMokjangLeaderKey = (name: string) => {
    if (!mokjangLeaders[name]) return;
    const nc = { ...mokjangLeaders };
    delete nc[name];
    setMokjangLeaders(nc);
    if (churchId) saveMokjangLeaders(churchId, nc);
  };

  const getMokjangLeader = (name: string): string | undefined => {
    const leaderId = mokjangLeaders[name];
    if (leaderId) {
      const assigned = db.members.find((m) => m.id === leaderId);
      if (assigned) return assigned.name;
    }
    const members = db.members.filter((m) => ((m.mokjang ?? m.group) || "") === name);
    const withRole = members.find((m) => (m.role || "").includes("목자") || (m.role || "").includes("목장"));
    if (withRole) return withRole.name;
    return undefined;
  };

  const getSlotCardColor = (index: number, key: string): { colored: boolean; color?: string } => {
    if (!orgIsColoredSlot(index)) return { colored: false };
    return { colored: true, color: slotColors[key] || orgSlotColor(index) };
  };

  const assignSlotColor = (key: string, index: number) => {
    if (!orgIsColoredSlot(index)) return;
    const color = orgSlotColor(index);
    const nc = { ...slotColors, [key]: color };
    setSlotColors(nc);
    if (churchId) saveColorMap(SLOT_COLORS_KEY, churchId, nc);
  };

  const openAdd = () => {
    if (tab === "dept" || tab === "mokjang") {
      setResourceWizard({ kind: tab, mode: "add", step: 1, name: "", oldName: null, draftMemberIds: [], leaderId: null });
      return;
    }
    setEditOldName(null);
    setEditPlaceId(null);
    setEditName("");
    setEditCapacity("");
    setFormOpen(true);
  };

  const openEdit = (name: string) => {
    if (tab === "dept" || tab === "mokjang") {
      setResourceWizard({ kind: tab, mode: "edit", step: 1, name, oldName: name, draftMemberIds: [], leaderId: null });
      return;
    }
    setEditOldName(name);
    setEditPlaceId(null);
    setEditName(name);
    setFormOpen(true);
  };

  const openEditPlace = (p: PlannerPlace) => {
    setEditOldName(null);
    setEditPlaceId(p.id);
    setEditName(p.name);
    setEditCapacity(p.capacity != null && p.capacity > 0 ? String(p.capacity) : "");
    setFormOpen(true);
  };

  const closeWizard = () => {
    setResourceWizard(null);
  };

  const wizardNext = () => {
    if (!resourceWizard) return;
    const trimmed = resourceWizard.name.trim();
    if (!trimmed) {
      toast("이름을 입력하세요", "err");
      return;
    }
    const names = resourceWizard.kind === "dept" ? deptNames : mokjangNames;
    const dup =
      resourceWizard.mode === "add"
        ? names.includes(trimmed)
        : resourceWizard.oldName !== trimmed && names.includes(trimmed);
    if (dup) {
      toast(resourceWizard.kind === "dept" ? "이미 있는 부서입니다" : mokjangLabels.duplicate, "err");
      return;
    }
    const lookupName = resourceWizard.mode === "edit" ? (resourceWizard.oldName ?? trimmed) : trimmed;
    const draftMemberIds =
      resourceWizard.mode === "edit"
        ? memberIdsInResource(db, resourceWizard.kind, lookupName)
        : resourceWizard.draftMemberIds;
    const leaderId =
      resourceWizard.kind === "mokjang"
        ? (resourceWizard.mode === "edit" ? (mokjangLeaders[lookupName] ?? null) : resourceWizard.leaderId)
        : null;
    setResourceWizard({ ...resourceWizard, name: trimmed, step: 2, draftMemberIds, leaderId });
  };

  const wizardFinish = () => {
    if (!resourceWizard) return;
    const trimmed = resourceWizard.name.trim();
    if (!trimmed) {
      toast("이름을 입력하세요", "err");
      return;
    }
    const { kind, mode, oldName, draftMemberIds, leaderId } = resourceWizard;
    const draftSet = new Set(draftMemberIds);

    if (kind === "dept") {
      let names = [...deptNames];
      if (mode === "edit" && oldName) {
        names = names.map((n) => (n === oldName ? trimmed : n));
        if (oldName !== trimmed && slotColors[oldName]) {
          const nc = { ...slotColors, [trimmed]: slotColors[oldName] };
          delete nc[oldName];
          setSlotColors(nc);
          if (churchId) saveColorMap(SLOT_COLORS_KEY, churchId, nc);
        }
      } else {
        names.push(trimmed);
        assignSlotColor(trimmed, names.length - 1);
      }
      setDb((prev) => {
        const next = {
          ...prev,
          settings: { ...prev.settings, depts: names.join(", ") },
          members: prev.members.map((m) => {
            if (draftSet.has(m.id)) return { ...m, dept: trimmed };
            if (mode === "edit" && oldName && m.dept === oldName) return { ...m, dept: "" };
            return m;
          }),
        };
        persist();
        void saveDb(next).catch(() => toast("저장 실패", "err"));
        return next;
      });
      toast(mode === "edit" ? "부서가 저장되었습니다" : "부서가 추가되었습니다", "ok");
    } else {
      let list = [...mokjangNames];
      if (mode === "edit" && oldName) {
        list = list.map((g) => (g === oldName ? trimmed : g));
        if (oldName !== trimmed) {
          renameMokjangLeaderKey(oldName, trimmed);
          if (slotColors[oldName]) {
            const nc = { ...slotColors, [trimmed]: slotColors[oldName] };
            delete nc[oldName];
            setSlotColors(nc);
            if (churchId) saveColorMap(SLOT_COLORS_KEY, churchId, nc);
          }
        }
      } else {
        list.push(trimmed);
        assignSlotColor(trimmed, list.length - 1);
      }
      setDb((prev) => {
        const next = {
          ...prev,
          settings: { ...prev.settings, mokjangList: list.join(", ") },
          members: prev.members.map((m) => {
            if (draftSet.has(m.id)) return { ...m, group: trimmed, mokjang: trimmed };
            if (mode === "edit" && oldName && ((m.mokjang ?? m.group) || "") === oldName) {
              return { ...m, group: "", mokjang: "" };
            }
            return m;
          }),
        };
        persist();
        void saveDb(next).catch(() => toast("저장 실패", "err"));
        return next;
      });
      const validLeader = leaderId && draftSet.has(leaderId) ? leaderId : null;
      persistMokjangLeader(trimmed, validLeader);
      toast(mode === "edit" ? mokjangLabels.saved : mokjangLabels.added, "ok");
    }
    closeWizard();
  };

  const handleSaveForm = async () => {
    const trimmed = editName.trim();
    if (!trimmed) {
      toast("이름을 입력하세요", "err");
      return;
    }

    if (tab === "place") {
      if (!supabase || !churchId) return;
      const cap = editCapacity.trim() ? Number(editCapacity) : null;
      if (editCapacity.trim() && (Number.isNaN(cap) || cap! <= 0)) {
        toast("수용 인원을 올바르게 입력하세요", "err");
        return;
      }
      try {
        if (editPlaceId) {
          const { error } = await supabase.from(TB_PLACES).update({ name: trimmed, capacity: cap }).eq("id", editPlaceId);
          if (error) throw error;
        } else {
          const { error } = await supabase.from(TB_PLACES).insert({
            church_id: churchId,
            name: trimmed,
            capacity: cap,
            equipment: [],
            sort_order: places.length,
            is_active: true,
          });
          if (error) throw error;
          assignSlotColor(`place:new-${trimmed}`, places.length);
        }
        await loadPlaces();
        toast(editPlaceId ? "장소가 수정되었습니다" : "장소가 추가되었습니다", "ok");
      } catch (e) {
        console.error(e);
        toast("저장 실패", "err");
        return;
      }
    }

    setFormOpen(false);
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    const { type, name, id } = deleteTarget;

    if (type === "dept") {
      const names = deptNames.filter((n) => n !== name);
      if (resourceWizard?.kind === "dept" && (resourceWizard.oldName === name || resourceWizard.name === name)) closeWizard();
      setDb((prev) => ({
        ...prev,
        settings: { ...prev.settings, depts: names.join(", ") },
        members: prev.members.map((m) => (m.dept === name ? { ...m, dept: "" } : m)),
      }));
      persist();
      void saveDb(db).catch(() => {});
      const nc = { ...slotColors };
      delete nc[name];
      setSlotColors(nc);
      if (churchId) saveColorMap(SLOT_COLORS_KEY, churchId, nc);
      toast("부서가 삭제되었습니다", "ok");
    } else if (type === "mokjang") {
      const list = mokjangNames.filter((g) => g !== name);
      setDb((prev) => ({
        ...prev,
        settings: { ...prev.settings, mokjangList: list.join(", ") },
        members: prev.members.map((m) =>
          (m.mokjang ?? m.group) === name ? { ...m, group: "", mokjang: "" } : m,
        ),
      }));
      persist();
      const nc = { ...slotColors };
      delete nc[name];
      setSlotColors(nc);
      if (churchId) saveColorMap(SLOT_COLORS_KEY, churchId, nc);
      if (resourceWizard?.kind === "mokjang" && (resourceWizard.oldName === name || resourceWizard.name === name)) closeWizard();
      removeMokjangLeaderKey(name);
      toast(mokjangLabels.deleted, "ok");
    } else if (type === "place" && id && supabase) {
      void supabase.from(TB_PLACES).delete().eq("id", id).then(({ error }) => {
        if (error) { toast("삭제 실패", "err"); return; }
        void loadPlaces();
        toast("장소가 삭제되었습니다", "ok");
      });
    }

    setDeleteTarget(null);
  };

  const memberCountDept = (name: string) => db.members.filter((m) => m.dept === name && m.status !== "졸업/전출").length;
  const memberCountMok = (name: string) => db.members.filter((m) => ((m.mokjang ?? m.group) || "") === name).length;

  const formTitle = editPlaceId
    ? EDIT_MODAL_TITLES.place
    : ADD_MODAL_TITLES.place;

  return (
    <div style={{ width: "100%", boxSizing: "border-box", textAlign: "left" }}>
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 16,
          marginBottom: ORG_RESOURCE.segToGridGap,
          height: 44,
          flexShrink: 0,
        }}
      >
        <OrgSegmentTabs
          tab={tab}
          onChange={setTab}
          mokjangTabLabel={mokjangLabels.tab}
          inline
        />
        {tab === "mokjang" && (
          <>
            <div
              aria-hidden
              style={{ width: 1, height: 24, background: "#d5d6da", flexShrink: 0, margin: "0 4px" }}
            />
            <SmallGroupTermCustomizer
              term={smallGroupTerm}
              onTermChange={handleSmallGroupTermChange}
            />
          </>
        )}
      </div>

      {tab === "dept" && (
        <OrgCardGrid>
          {deptNames.map((name, i) => {
            const { colored, color } = getSlotCardColor(i, name);
            return (
              <OrgResourceCard
                key={name}
                title={name}
                subtitle={getDeptSubtitle(name)}
                count={memberCountDept(name)}
                colored={colored}
                color={color}
                onEdit={() => openEdit(name)}
                onDelete={() => setDeleteTarget({ type: "dept", name })}
              />
            );
          })}
          <OrgAddCard label={ADD_LABELS.dept} onClick={openAdd} />
        </OrgCardGrid>
      )}

      {tab === "mokjang" && (
        <OrgCardGrid>
          {mokjangNames.map((name, i) => {
            const { colored, color } = getSlotCardColor(i, name);
            const leader = getMokjangLeader(name);
            return (
              <OrgResourceCard
                key={name}
                title={name}
                subtitle={leader ? `${smallGroupLeaderLabel} ${leader}` : undefined}
                count={memberCountMok(name)}
                colored={colored}
                color={color}
                onEdit={() => openEdit(name)}
                onDelete={() => setDeleteTarget({ type: "mokjang", name })}
              />
            );
          })}
          <OrgAddCard label={mokjangLabels.add} onClick={openAdd} />
        </OrgCardGrid>
      )}

      {tab === "place" && (
        placesLoading ? (
          <div style={{ padding: 48, color: "#8b909a", fontSize: 15, fontFamily: ORG_RESOURCE.fontKR }}>불러오는 중…</div>
        ) : (
          <OrgCardGrid>
            {places.map((p, i) => {
              const { colored, color } = getSlotCardColor(i, `place:${p.id}`);
              return (
                <OrgResourceCard
                  key={p.id}
                  title={p.name}
                  count={p.capacity ?? 0}
                  colored={colored}
                  color={color}
                  onEdit={() => openEditPlace(p)}
                  onDelete={() => setDeleteTarget({ type: "place", name: p.name, id: p.id })}
                />
              );
            })}
            <OrgAddCard label={ADD_LABELS.place} onClick={openAdd} />
          </OrgCardGrid>
        )
      )}

      <OrgFormModal
        open={formOpen && tab === "place"}
        title={formTitle}
        value={editName}
        placeholder={INPUT_PLACEHOLDERS.place}
        onChange={setEditName}
        onClose={() => setFormOpen(false)}
        onSubmit={() => void handleSaveForm()}
        submitLabel={editPlaceId ? "저장" : "등록"}
        capacityValue={editCapacity}
        onCapacityChange={setEditCapacity}
        capacityPlaceholder={PLACE_CAPACITY_PLACEHOLDER}
      />

      <OrgDeleteModal
        open={!!deleteTarget}
        name={deleteTarget?.name ?? ""}
        tab={deleteTarget?.type ?? tab}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />

      {resourceWizard && (
        <OrgDeptMokWizardModal
          wizard={resourceWizard}
          db={db}
          leaderLabel={smallGroupLeaderLabel}
          mokjangLabels={mokjangLabels}
          groupTerm={smallGroupTerm}
          onNameChange={(v) => setResourceWizard({ ...resourceWizard, name: v })}
          onDraftChange={(ids) => {
            setResourceWizard((prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                draftMemberIds: ids,
                leaderId: prev.leaderId && !ids.includes(prev.leaderId) ? null : prev.leaderId,
              };
            });
          }}
          onLeaderChange={(id, draftMemberIds) => {
            setResourceWizard((prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                leaderId: id,
                ...(draftMemberIds ? { draftMemberIds } : {}),
              };
            });
          }}
          onStepChange={(step) => setResourceWizard({ ...resourceWizard, step })}
          onClose={closeWizard}
          onNext={wizardNext}
          onBack={() => setResourceWizard({ ...resourceWizard, step: 1 })}
          onFinish={wizardFinish}
        />
      )}
    </div>
  );
}
