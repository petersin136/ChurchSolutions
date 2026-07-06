"use client";

import React, { useState, useEffect, useCallback, useMemo, type CSSProperties } from "react";
import { Plus, Pencil, Trash2, AlertTriangle } from "lucide-react";
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

const TAB_LABELS: Record<OrgTab, string> = {
  dept: "부서 관리",
  mokjang: "목장 관리",
  place: "장소 관리",
};

const ADD_LABELS: Record<OrgTab, string> = {
  dept: "부서 추가하기",
  mokjang: "목장 추가하기",
  place: "장소 추가하기",
};

const ADD_MODAL_TITLES: Record<OrgTab, string> = {
  dept: "새 부서 추가",
  mokjang: "새 목장 추가",
  place: "새 장소 추가",
};

const EDIT_MODAL_TITLES: Record<OrgTab, string> = {
  dept: "부서 수정",
  mokjang: "목장 수정",
  place: "장소 수정",
};

const INPUT_PLACEHOLDERS: Record<OrgTab, string> = {
  dept: "부서 이름을 입력하세요",
  mokjang: "목장 이름을 입력하세요",
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

/* ── 세그먼트 탭 (회색 사각 컨테이너 + 흰 활성 탭) ── */
function OrgSegmentTabs({ tab, onChange }: { tab: OrgTab; onChange: (t: OrgTab) => void }) {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: ORG_RESOURCE.segGap,
        padding: ORG_RESOURCE.segPad,
        borderRadius: ORG_RESOURCE.segRadius,
        background: ORG_RESOURCE.segBg,
        marginBottom: ORG_RESOURCE.segToGridGap,
      }}
    >
      {(["dept", "mokjang", "place"] as OrgTab[]).map((id) => {
        const active = tab === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            style={{
              border: "none",
              borderRadius: ORG_RESOURCE.segTabRadius,
              padding: `${ORG_RESOURCE.segTabPadY}px ${ORG_RESOURCE.segTabPadX}px`,
              fontSize: ORG_RESOURCE.segTabFontSize,
              fontWeight: active ? ORG_RESOURCE.segTabActiveFontWeight : ORG_RESOURCE.segTabFontWeight,
              fontFamily: ORG_RESOURCE.fontKR,
              cursor: "pointer",
              background: active ? ORG_RESOURCE.segTabActiveBg : "transparent",
              color: active ? ORG_RESOURCE.segTabActiveColor : ORG_RESOURCE.segTabInactiveColor,
              boxShadow: active ? ORG_RESOURCE.segTabActiveShadow : "none",
              whiteSpace: "nowrap",
              transition: "background 0.15s ease, box-shadow 0.15s ease, color 0.15s ease",
            }}
          >
            {TAB_LABELS[id]}
          </button>
        );
      })}
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
  onBodyClick,
}: {
  title: string;
  subtitle?: string;
  count: number;
  countUnit?: string;
  colored: boolean;
  color?: string;
  onEdit: () => void;
  onDelete: () => void;
  onBodyClick?: () => void;
}) {
  const [hover, setHover] = useState(false);
  const bg = colored && color ? color : ORG_RESOURCE.cardNeutralBg;
  const iconBg = colored && color ? orgShadeHex(color, 0.82) : ORG_RESOURCE.cardIconBtnNeutralBg;
  const actionReserve = ORG_RESOURCE.cardIconBtnSize * 2 + 10;

  return (
    <div
      role={onBodyClick ? "button" : undefined}
      tabIndex={onBodyClick ? 0 : undefined}
      onClick={onBodyClick}
      onKeyDown={onBodyClick ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onBodyClick(); } } : undefined}
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
        cursor: onBodyClick ? "pointer" : "default",
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
function OrgFormModal({
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
function OrgDeleteModal({
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
  const [places, setPlaces] = useState<PlannerPlace[]>([]);
  const [placesLoading, setPlacesLoading] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editOldName, setEditOldName] = useState<string | null>(null);
  const [editPlaceId, setEditPlaceId] = useState<string | null>(null);
  const [editCapacity, setEditCapacity] = useState("");

  const [deleteTarget, setDeleteTarget] = useState<{ type: OrgTab; name: string; id?: string } | null>(null);
  const [mokjangManage, setMokjangManage] = useState<string | null>(null);
  const [addMemberSelect, setAddMemberSelect] = useState("");

  useEffect(() => {
    sessionStorage.setItem(ORG_TAB_KEY, tab);
  }, [tab]);

  useEffect(() => {
    if (!churchId) return;
    setSlotColors(loadColorMap(SLOT_COLORS_KEY, churchId));
  }, [churchId]);

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

  const getMokjangLeader = (name: string): string | undefined => {
    const members = db.members.filter((m) => ((m.mokjang ?? m.group) || "") === name);
    const withRole = members.find((m) => (m.role || "").includes("목자") || (m.role || "").includes("목장"));
    if (withRole) return withRole.name;
    return members[0]?.name;
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
    setEditOldName(null);
    setEditPlaceId(null);
    setEditName("");
    setEditCapacity("");
    setFormOpen(true);
  };

  const openEdit = (name: string) => {
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

  const handleSaveForm = async () => {
    const trimmed = editName.trim();
    if (!trimmed) {
      toast("이름을 입력하세요", "err");
      return;
    }

    if (tab === "dept") {
      if (editOldName && editOldName !== trimmed && deptNames.includes(trimmed)) {
        toast("이미 있는 부서입니다", "err");
        return;
      }
      if (!editOldName && deptNames.includes(trimmed)) {
        toast("이미 있는 부서입니다", "err");
        return;
      }
      let names = [...deptNames];
        if (editOldName) {
        names = names.map((n) => (n === editOldName ? trimmed : n));
        if (editOldName !== trimmed && slotColors[editOldName]) {
          const nc = { ...slotColors, [trimmed]: slotColors[editOldName] };
          delete nc[editOldName];
          setSlotColors(nc);
          if (churchId) saveColorMap(SLOT_COLORS_KEY, churchId, nc);
        }
        setDb((prev) => {
          const next = {
            ...prev,
            settings: { ...prev.settings, depts: names.join(", ") },
            members: prev.members.map((m) => (m.dept === editOldName ? { ...m, dept: trimmed } : m)),
          };
          persist();
          void saveDb(next).catch(() => toast("저장 실패", "err"));
          return next;
        });
      } else {
        names.push(trimmed);
        assignSlotColor(trimmed, names.length - 1);
        setDb((prev) => {
          const next = { ...prev, settings: { ...prev.settings, depts: names.join(", ") } };
          persist();
          void saveDb(next).catch(() => toast("저장 실패", "err"));
          return next;
        });
      }
      toast(editOldName ? "부서가 수정되었습니다" : "부서가 추가되었습니다", "ok");
    } else if (tab === "mokjang") {
      if (editOldName && editOldName !== trimmed && mokjangNames.includes(trimmed)) {
        toast("이미 있는 목장입니다", "err");
        return;
      }
      if (!editOldName && mokjangNames.includes(trimmed)) {
        toast("이미 있는 목장입니다", "err");
        return;
      }
      let list = [...mokjangNames];
      if (editOldName) {
        list = list.map((g) => (g === editOldName ? trimmed : g));
        setDb((prev) => ({
          ...prev,
          settings: { ...prev.settings, mokjangList: list.join(", ") },
          members: prev.members.map((m) =>
            (m.mokjang ?? m.group) === editOldName ? { ...m, group: trimmed, mokjang: trimmed } : m,
          ),
        }));
        if (editOldName !== trimmed && slotColors[editOldName]) {
          const nc = { ...slotColors, [trimmed]: slotColors[editOldName] };
          delete nc[editOldName];
          setSlotColors(nc);
          if (churchId) saveColorMap(SLOT_COLORS_KEY, churchId, nc);
        }
      } else {
        list.push(trimmed);
        assignSlotColor(trimmed, list.length - 1);
        setDb((prev) => ({ ...prev, settings: { ...prev.settings, mokjangList: list.join(", ") } }));
      }
      persist();
      toast(editOldName ? "목장이 수정되었습니다" : "목장이 추가되었습니다", "ok");
    } else if (tab === "place") {
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
      if (mokjangManage === name) setMokjangManage(null);
      toast("목장이 삭제되었습니다", "ok");
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

  const formTitle = editOldName || editPlaceId
    ? EDIT_MODAL_TITLES[tab]
    : ADD_MODAL_TITLES[tab];

  return (
    <div style={{ width: "100%", boxSizing: "border-box", textAlign: "left" }}>
      <OrgSegmentTabs tab={tab} onChange={setTab} />

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
                subtitle={leader ? `목자 ${leader}` : undefined}
                count={memberCountMok(name)}
                colored={colored}
                color={color}
                onBodyClick={() => { setMokjangManage(name); setAddMemberSelect(""); }}
                onEdit={() => openEdit(name)}
                onDelete={() => setDeleteTarget({ type: "mokjang", name })}
              />
            );
          })}
          <OrgAddCard label={ADD_LABELS.mokjang} onClick={openAdd} />
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
        open={formOpen}
        title={formTitle}
        value={editName}
        placeholder={INPUT_PLACEHOLDERS[tab]}
        onChange={setEditName}
        onClose={() => setFormOpen(false)}
        onSubmit={() => void handleSaveForm()}
        submitLabel={editOldName || editPlaceId ? "저장" : "등록"}
        capacityValue={tab === "place" ? editCapacity : undefined}
        onCapacityChange={tab === "place" ? setEditCapacity : undefined}
        capacityPlaceholder={PLACE_CAPACITY_PLACEHOLDER}
      />

      <OrgDeleteModal
        open={!!deleteTarget}
        name={deleteTarget?.name ?? ""}
        tab={deleteTarget?.type ?? tab}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />

      {/* 그룹원 관리 — 기능 유지 */}
      {mokjangManage && (
        <div
          className="modal-bg open"
          role="presentation"
          onMouseDown={(e) => { if (e.target === e.currentTarget) { setMokjangManage(null); setAddMemberSelect(""); } }}
        >
          <div className="modal" role="dialog" style={{ maxWidth: 480 }} onMouseDown={(e) => e.stopPropagation()}>
            <h2 style={{ margin: "0 0 12px", fontSize: 18, fontWeight: 700, fontFamily: ORG_RESOURCE.fontKR }}>
              {mokjangManage} 그룹원 관리
            </h2>
            <p style={{ fontSize: 13, color: "#6b7280", marginTop: 0, fontFamily: ORG_RESOURCE.fontKR }}>성도를 목장에 배정하거나 제거합니다.</p>
            <ul style={{ margin: "0 0 16px", padding: 0, listStyle: "none", maxHeight: 200, overflowY: "auto" }}>
              {db.members.filter((m) => ((m.mokjang ?? m.group) || "") === mokjangManage).map((m) => (
                <li key={m.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid #f0f2f5", fontSize: 14, fontFamily: ORG_RESOURCE.fontKR }}>
                  <span style={{ fontWeight: 600 }}>{m.name}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setDb((prev) => ({
                        ...prev,
                        members: prev.members.map((x) => (x.id === m.id ? { ...x, group: "", mokjang: "" } : x)),
                      }));
                      persist();
                      toast("목장에서 제거되었습니다", "ok");
                    }}
                    style={modalBtnCancel}
                  >
                    제거
                  </button>
                </li>
              ))}
            </ul>
            <select value={addMemberSelect} onChange={(e) => setAddMemberSelect(e.target.value)} className="select-modern" style={{ width: "100%", marginBottom: 8 }}>
              <option value="">성도 선택</option>
              {db.members
                .filter((m) => ((m.mokjang ?? m.group) || "") !== mokjangManage && m.status !== "졸업/전출")
                .map((m) => (
                  <option key={m.id} value={m.id}>{m.name} ({m.dept || "부서 없음"})</option>
                ))}
            </select>
            <button
              type="button"
              disabled={!addMemberSelect}
              onClick={() => {
                if (!mokjangManage || !addMemberSelect) return;
                setDb((prev) => ({
                  ...prev,
                  members: prev.members.map((m) =>
                    m.id === addMemberSelect ? { ...m, group: mokjangManage, mokjang: mokjangManage } : m,
                  ),
                }));
                persist();
                setAddMemberSelect("");
                toast("목장에 추가되었습니다", "ok");
              }}
              style={{ ...modalBtnSubmit, width: "100%", opacity: addMemberSelect ? 1 : 0.5 }}
            >
              추가
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
