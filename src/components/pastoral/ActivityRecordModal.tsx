"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import { CalendarDropdown } from "@/components/CalendarDropdown";
import { appModalOverlayStyle } from "@/styles/appModalTokens";
import {
  ACTIVITY_RECORD_MODAL,
  activityRecordCardStyle,
} from "@/styles/activityRecordModalTokens";

export type ActivityRecordType = "prayer" | "memo";

const CATEGORY_OPTIONS: { value: ActivityRecordType; label: string }[] = [
  { value: "prayer", label: "기도" },
  { value: "memo", label: "메모" },
];

const todayStr = () => new Date().toISOString().slice(0, 10);

function memberSubtitle(name: string, role?: string): string {
  const n = name.trim();
  const r = (role || "").trim();
  if (!n) return r || "";
  if (!r) return n;
  return `${n} ${r}`;
}

function fieldShellStyle(): CSSProperties {
  return {
    height: ACTIVITY_RECORD_MODAL.fieldHeight,
    borderRadius: ACTIVITY_RECORD_MODAL.fieldRadius,
    background: ACTIVITY_RECORD_MODAL.fieldBg,
    boxSizing: "border-box",
    fontFamily: ACTIVITY_RECORD_MODAL.fontKR,
    fontSize: ACTIVITY_RECORD_MODAL.fieldFontSize,
    color: ACTIVITY_RECORD_MODAL.fieldColor,
  };
}

export interface ActivityRecordModalProps {
  open: boolean;
  onClose: () => void;
  memberId: string;
  memberName: string;
  memberRole?: string;
  saving?: boolean;
  onSubmit: (payload: {
    memberId: string;
    date: string;
    type: ActivityRecordType;
    content: string;
  }) => void | Promise<void>;
}

export function ActivityRecordModal({
  open,
  onClose,
  memberId,
  memberName,
  memberRole,
  saving = false,
  onSubmit,
}: ActivityRecordModalProps) {
  const [mounted, setMounted] = useState(false);
  const [date, setDate] = useState(todayStr);
  const [type, setType] = useState<ActivityRecordType | "">("");
  const [content, setContent] = useState("");
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [hoverCategory, setHoverCategory] = useState<ActivityRecordType | null>(null);
  const [dropdownRect, setDropdownRect] = useState<{ top: number; left: number; width: number } | null>(
    null,
  );
  const categoryRef = useRef<HTMLDivElement>(null);
  const dropdownPortalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    setDate(todayStr());
    setType("");
    setContent("");
    setCategoryOpen(false);
    setHoverCategory(null);
  }, [open, memberId]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!categoryOpen) return;
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (categoryRef.current?.contains(target)) return;
      if (dropdownPortalRef.current?.contains(target)) return;
      setCategoryOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [categoryOpen]);

  useLayoutEffect(() => {
    if (!categoryOpen) {
      setDropdownRect(null);
      return;
    }
    const update = () => {
      const el = categoryRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setDropdownRect({ top: rect.bottom, left: rect.left, width: rect.width });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [categoryOpen]);

  const handleSubmit = useCallback(async () => {
    const trimmed = content.trim();
    if (!trimmed || !type || saving) return;
    await onSubmit({ memberId, date, type, content: trimmed });
  }, [content, date, memberId, onSubmit, saving, type]);

  if (!open || !mounted) return null;

  const selectedCategory = CATEGORY_OPTIONS.find((o) => o.value === type);
  const canSubmit = Boolean(content.trim() && type && !saving);

  const dateTriggerStyle: CSSProperties = {
    ...fieldShellStyle(),
    width: "100%",
    border: "none",
    padding: "0 14px",
    display: "flex",
    alignItems: "center",
    gap: 8,
    cursor: "pointer",
    fontWeight: 500,
  };

  const categoryButtonStyle: CSSProperties = {
    ...fieldShellStyle(),
    width: "100%",
    border: "none",
    padding: "0 14px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    cursor: "pointer",
    color: selectedCategory ? ACTIVITY_RECORD_MODAL.fieldColor : ACTIVITY_RECORD_MODAL.fieldPlaceholder,
    fontWeight: selectedCategory ? 500 : 400,
  };

  return createPortal(
    <div
      className="app-modal-overlay open"
      role="presentation"
      style={{ ...appModalOverlayStyle, zIndex: ACTIVITY_RECORD_MODAL.zIndex }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="app-modal-card"
        role="dialog"
        aria-modal="true"
        aria-label="활동 기록 추가"
        style={activityRecordCardStyle()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* 헤더 — 흰 배경 + 우상단 회색 사선 장식 + 구분선 */}
        <div
          style={{
            position: "relative",
            height: ACTIVITY_RECORD_MODAL.headerHeight,
            flexShrink: 0,
            borderTopLeftRadius: ACTIVITY_RECORD_MODAL.radius,
            borderTopRightRadius: ACTIVITY_RECORD_MODAL.radius,
            overflow: "hidden",
          }}
        >
          <svg
            aria-hidden
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              width: ACTIVITY_RECORD_MODAL.headerWedgeWidth,
              height: ACTIVITY_RECORD_MODAL.headerHeight,
              pointerEvents: "none",
            }}
            viewBox={`0 0 ${ACTIVITY_RECORD_MODAL.headerWedgeWidth} ${ACTIVITY_RECORD_MODAL.headerHeight}`}
            preserveAspectRatio="none"
          >
            <polygon
              points={`32,0 ${ACTIVITY_RECORD_MODAL.headerWedgeWidth},0 ${ACTIVITY_RECORD_MODAL.headerWedgeWidth},${ACTIVITY_RECORD_MODAL.headerHeight}`}
              fill={ACTIVITY_RECORD_MODAL.headerBg}
            />
          </svg>
          <div
            style={{
              position: "relative",
              padding: `${ACTIVITY_RECORD_MODAL.headerPadTop}px ${ACTIVITY_RECORD_MODAL.headerPadX}px ${ACTIVITY_RECORD_MODAL.headerPadBottom}px`,
            }}
          >
            <h2
              style={{
                margin: 0,
                fontSize: ACTIVITY_RECORD_MODAL.titleSize,
                fontWeight: ACTIVITY_RECORD_MODAL.titleWeight,
                color: ACTIVITY_RECORD_MODAL.titleColor,
                lineHeight: 1.35,
              }}
            >
              활동 기록 추가
            </h2>
            <p
              style={{
                margin: `${ACTIVITY_RECORD_MODAL.titleToSubtitle}px 0 0`,
                fontSize: ACTIVITY_RECORD_MODAL.subtitleSize,
                fontWeight: ACTIVITY_RECORD_MODAL.subtitleWeight,
                color: ACTIVITY_RECORD_MODAL.subtitleColor,
                lineHeight: 1.4,
              }}
            >
              {memberSubtitle(memberName, memberRole)}
            </p>
          </div>
          <div
            aria-hidden
            style={{
              position: "absolute",
              bottom: 0,
              left: ACTIVITY_RECORD_MODAL.headerPadX,
              right: ACTIVITY_RECORD_MODAL.headerPadX,
              height: 1,
              background: ACTIVITY_RECORD_MODAL.dividerColor,
            }}
          />
        </div>

        <div
          style={{
            flex: 1,
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
            padding: `0 ${ACTIVITY_RECORD_MODAL.bodyPadX}px ${ACTIVITY_RECORD_MODAL.bodyPadBottom}px`,
          }}
        >
          <div
            style={{
              display: "flex",
              gap: ACTIVITY_RECORD_MODAL.fieldRowGap,
              marginTop: 16,
              marginBottom: ACTIVITY_RECORD_MODAL.fieldToTextareaGap,
              flexShrink: 0,
            }}
          >
            <div style={{ flex: ACTIVITY_RECORD_MODAL.dateFlex, minWidth: 0 }}>
              <CalendarDropdown
                value={date}
                onChange={setDate}
                compact
                triggerStyle={dateTriggerStyle}
                displayVariant="activity"
              />
            </div>
            <div ref={categoryRef} style={{ flex: ACTIVITY_RECORD_MODAL.categoryFlex, minWidth: 0, position: "relative" }}>
              <button
                type="button"
                aria-haspopup="listbox"
                aria-expanded={categoryOpen}
                onClick={() => setCategoryOpen((v) => !v)}
                style={{
                  ...categoryButtonStyle,
                  ...(categoryOpen
                    ? {
                        borderBottomLeftRadius: 0,
                        borderBottomRightRadius: 0,
                      }
                    : {}),
                }}
              >
                <span>{selectedCategory?.label ?? "구분"}</span>
                <ChevronDown
                  size={18}
                  strokeWidth={2}
                  color="#9ca0a8"
                  style={{
                    flexShrink: 0,
                    transform: categoryOpen ? "rotate(180deg)" : "rotate(0deg)",
                    transition: "transform 0.15s ease",
                  }}
                />
              </button>
            </div>
          </div>

          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="기록할 내용을 입력해 주세요"
            style={{
              width: "100%",
              flex: 1,
              minHeight: ACTIVITY_RECORD_MODAL.textareaMinHeight,
              padding: ACTIVITY_RECORD_MODAL.textareaPad,
              boxSizing: "border-box",
              border: `1px solid ${ACTIVITY_RECORD_MODAL.textareaBorder}`,
              borderRadius: ACTIVITY_RECORD_MODAL.fieldRadius,
              background: "#ffffff",
              resize: "none",
              outline: "none",
              fontFamily: ACTIVITY_RECORD_MODAL.fontKR,
              fontSize: ACTIVITY_RECORD_MODAL.textareaFontSize,
              lineHeight: ACTIVITY_RECORD_MODAL.textareaLineHeight,
              color: ACTIVITY_RECORD_MODAL.fieldColor,
              marginBottom: ACTIVITY_RECORD_MODAL.textareaToButtonsGap,
            }}
          />

          <div style={{ display: "flex", gap: ACTIVITY_RECORD_MODAL.btnGap, flexShrink: 0 }}>
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              style={{
                flex: 1,
                height: ACTIVITY_RECORD_MODAL.btnHeight,
                borderRadius: ACTIVITY_RECORD_MODAL.btnRadius,
                border: `1px solid ${ACTIVITY_RECORD_MODAL.btnCancelBorder}`,
                background: ACTIVITY_RECORD_MODAL.btnCancelBg,
                color: ACTIVITY_RECORD_MODAL.btnCancelColor,
                fontSize: ACTIVITY_RECORD_MODAL.btnFontSize,
                fontWeight: ACTIVITY_RECORD_MODAL.btnFontWeight,
                fontFamily: ACTIVITY_RECORD_MODAL.fontKR,
                cursor: saving ? "not-allowed" : "pointer",
              }}
            >
              취소
            </button>
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={!canSubmit}
              style={{
                flex: 1,
                height: ACTIVITY_RECORD_MODAL.btnHeight,
                borderRadius: ACTIVITY_RECORD_MODAL.btnRadius,
                border: "none",
                background: ACTIVITY_RECORD_MODAL.btnSubmitBg,
                color: ACTIVITY_RECORD_MODAL.btnSubmitColor,
                fontSize: ACTIVITY_RECORD_MODAL.btnFontSize,
                fontWeight: ACTIVITY_RECORD_MODAL.btnFontWeight,
                fontFamily: ACTIVITY_RECORD_MODAL.fontKR,
                cursor: !canSubmit ? "not-allowed" : "pointer",
                opacity: !canSubmit ? 0.45 : 1,
              }}
            >
              {saving ? "등록 중..." : "등록"}
            </button>
          </div>
        </div>
      </div>

      {categoryOpen && dropdownRect
        ? createPortal(
            <div
              ref={dropdownPortalRef}
              role="listbox"
              aria-label="구분"
              style={{
                position: "fixed",
                top: dropdownRect.top,
                left: dropdownRect.left,
                width: dropdownRect.width,
                background: ACTIVITY_RECORD_MODAL.dropdownBg,
                border: `1px solid ${ACTIVITY_RECORD_MODAL.dropdownBorder}`,
                borderTop: "none",
                borderRadius: `0 0 ${ACTIVITY_RECORD_MODAL.fieldRadius}px ${ACTIVITY_RECORD_MODAL.fieldRadius}px`,
                boxShadow: ACTIVITY_RECORD_MODAL.dropdownShadow,
                zIndex: ACTIVITY_RECORD_MODAL.zIndex + 2,
                overflow: "hidden",
                boxSizing: "border-box",
              }}
            >
              {CATEGORY_OPTIONS.map((opt) => {
                const active = type === opt.value;
                const hovered = hoverCategory === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="option"
                    aria-selected={active}
                    onMouseEnter={() => setHoverCategory(opt.value)}
                    onMouseLeave={() => setHoverCategory(null)}
                    onClick={() => {
                      setType(opt.value);
                      setCategoryOpen(false);
                    }}
                    style={{
                      width: "100%",
                      border: "none",
                      background:
                        hovered || active
                          ? ACTIVITY_RECORD_MODAL.dropdownItemHoverBg
                          : "#ffffff",
                      padding: `${ACTIVITY_RECORD_MODAL.dropdownItemPadY}px ${ACTIVITY_RECORD_MODAL.dropdownItemPadX}px`,
                      textAlign: "left",
                      fontFamily: ACTIVITY_RECORD_MODAL.fontKR,
                      fontSize: ACTIVITY_RECORD_MODAL.fieldFontSize,
                      fontWeight: 500,
                      color: ACTIVITY_RECORD_MODAL.fieldColor,
                      cursor: "pointer",
                    }}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>,
            document.body,
          )
        : null}
    </div>,
    document.body,
  );
}
