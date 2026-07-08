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
import {
  appModalBtnCancel,
  appModalBtnSubmit,
} from "@/styles/appModalTokens";
import {
  ACTIVITY_RECORD_FRAME_PATH,
  ACTIVITY_RECORD_MODAL,
  activityRecordOverlayStyle,
  activityRecordShellStyle,
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
    if (!categoryOpen || !categoryRef.current) return;
    const update = () => {
      const el = categoryRef.current;
      const menu = dropdownPortalRef.current;
      if (!el || !menu) return;
      const rect = el.getBoundingClientRect();
      menu.style.top = `${rect.bottom}px`;
      menu.style.left = `${rect.left}px`;
      menu.style.width = `${rect.width}px`;
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

  const { viewW, viewH, width, height } = ACTIVITY_RECORD_MODAL;

  return createPortal(
    <div
      className="app-modal-overlay open"
      role="presentation"
      style={activityRecordOverlayStyle()}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="활동 기록 추가"
        style={activityRecordShellStyle()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* 헤더·쐐기 뒤 하얀 반투명 레이어 */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            top: ACTIVITY_RECORD_MODAL.glassLayerTop,
            left: 0,
            right: 0,
            height: ACTIVITY_RECORD_MODAL.glassLayerHeight,
            borderRadius: ACTIVITY_RECORD_MODAL.glassLayerRadius,
            background: ACTIVITY_RECORD_MODAL.glassLayerBg,
            ...(ACTIVITY_RECORD_MODAL.glassLayerBlur
              ? {
                  backdropFilter: ACTIVITY_RECORD_MODAL.glassLayerBlur,
                  WebkitBackdropFilter: ACTIVITY_RECORD_MODAL.glassLayerBlur,
                }
              : {}),
            zIndex: 0,
            pointerEvents: "none",
          }}
        />

        {/* 디자이너 SVG 프레임 */}
        <svg
          aria-hidden
          width={width}
          height={height}
          viewBox={`0 0 ${viewW} ${viewH}`}
          style={{
            display: "block",
            maxWidth: "100%",
            filter: ACTIVITY_RECORD_MODAL.shadow,
            position: "relative",
            zIndex: 1,
          }}
        >
          <path fillRule="evenodd" fill="#ffffff" d={ACTIVITY_RECORD_FRAME_PATH} />
        </svg>

        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            boxSizing: "border-box",
            zIndex: 2,
          }}
        >
          {/* 탭 영역 (y 0 ~ shelf) */}
          <div
            style={{
              flexShrink: 0,
              padding: `${ACTIVITY_RECORD_MODAL.headerPadTop}px ${ACTIVITY_RECORD_MODAL.padX}px 0`,
              minHeight: ACTIVITY_RECORD_MODAL.headerShelfY,
              boxSizing: "border-box",
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
            style={{
              flex: 1,
              minHeight: 0,
              display: "flex",
              flexDirection: "column",
              padding: `${ACTIVITY_RECORD_MODAL.bodyPadTop}px ${ACTIVITY_RECORD_MODAL.padX}px ${ACTIVITY_RECORD_MODAL.bodyPadBottom}px`,
              boxSizing: "border-box",
              borderRadius: ACTIVITY_RECORD_MODAL.radius,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                display: "flex",
                gap: ACTIVITY_RECORD_MODAL.fieldRowGap,
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
                    borderRadius: ACTIVITY_RECORD_MODAL.fieldRadius,
                    ...(categoryOpen
                      ? {
                          borderBottomLeftRadius: ACTIVITY_RECORD_MODAL.radius,
                          borderBottomRightRadius: ACTIVITY_RECORD_MODAL.radius,
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
                      transform: categoryOpen ? "rotate(180deg)" : "none",
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
                style={{ ...appModalBtnCancel, borderRadius: ACTIVITY_RECORD_MODAL.btnRadius }}
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => void handleSubmit()}
                disabled={!canSubmit}
                style={{
                  ...appModalBtnSubmit,
                  borderRadius: ACTIVITY_RECORD_MODAL.btnRadius,
                  background: canSubmit
                    ? ACTIVITY_RECORD_MODAL.titleColor
                    : ACTIVITY_RECORD_MODAL.btnSubmitDisabledBg,
                  opacity: 1,
                  cursor: !canSubmit ? "not-allowed" : "pointer",
                }}
              >
                {saving ? "등록 중..." : "등록"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {categoryOpen && categoryRef.current
        ? createPortal(
            <div
              ref={dropdownPortalRef}
              role="listbox"
              aria-label="구분"
              style={{
                position: "fixed",
                top: categoryRef.current.getBoundingClientRect().bottom,
                left: categoryRef.current.getBoundingClientRect().left,
                width: categoryRef.current.getBoundingClientRect().width,
                background: "#ffffff",
                border: `1px solid ${ACTIVITY_RECORD_MODAL.textareaBorder}`,
                borderTop: `1px solid ${ACTIVITY_RECORD_MODAL.textareaBorder}`,
                borderRadius: ACTIVITY_RECORD_MODAL.fieldRadius,
                marginTop: 4,
                boxShadow: "0 8px 24px rgba(0,0,0,0.1)",
                zIndex: ACTIVITY_RECORD_MODAL.zIndex + 2,
                overflow: "hidden",
                boxSizing: "border-box",
              }}
            >
              {CATEGORY_OPTIONS.map((opt) => {
                const hovered = hoverCategory === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="option"
                    aria-selected={type === opt.value}
                    onMouseEnter={() => setHoverCategory(opt.value)}
                    onMouseLeave={() => setHoverCategory(null)}
                    onClick={() => {
                      setType(opt.value);
                      setCategoryOpen(false);
                    }}
                    style={{
                      width: "100%",
                      border: "none",
                      background: hovered ? ACTIVITY_RECORD_MODAL.dropdownItemHoverBg : "#ffffff",
                      padding: "12px 16px",
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
