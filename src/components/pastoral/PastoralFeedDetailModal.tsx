"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { CSSProperties } from "react";
import { X } from "lucide-react";
import type { DB, Note } from "@/types/db";
import { MemberPhoto } from "@/components/common/MemberPhoto";
import { DASH_BADGE, DASH_CARD, DASH_COLOR, DASH_GLOBAL } from "@/styles/pastoralDashboardTokens";

export type PastoralFeedDetailItem = {
  id: string;
  kind: "note" | "newcomer" | "prayer";
  icon: "memo" | "prayer" | "visit" | "event" | "newcomer";
  title: string;
  body: string;
  timestamp: string;
  memberName?: string;
  memberId?: string;
  noteType?: Note["type"];
  noteDate?: string;
  noteCreatedAt?: string;
  isProfilePrayer?: boolean;
};

function parseFeedTimestamp(raw: string | number | Date): Date | null {
  if (raw instanceof Date) return Number.isNaN(raw.getTime()) ? null : raw;
  if (typeof raw === "number") {
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const s = String(raw).trim();
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function fmtFeedDate(timestamp: string | number | Date): string {
  const d = parseFeedTimestamp(timestamp);
  if (!d) return "";
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

function getFeedBadge(item: PastoralFeedDetailItem) {
  if (item.kind === "newcomer") return DASH_BADGE.newfamily;
  if (item.kind === "prayer" || item.icon === "prayer") return DASH_BADGE.prayer;
  if (item.icon === "visit") return DASH_BADGE.visit;
  if (item.icon === "event") return DASH_BADGE.ceremony;
  return DASH_BADGE.memo;
}

function formatMemberName(raw: string): string {
  if (!raw) return "";
  if (raw === "교회 전체" || /님$/.test(raw)) return raw;
  return `${raw}님`;
}

const modalBtnClose: CSSProperties = {
  minWidth: 96,
  height: 44,
  padding: "0 20px",
  borderRadius: 8,
  border: "none",
  background: "#0b0c0e",
  color: "#ffffff",
  fontSize: 15,
  fontWeight: 600,
  fontFamily: DASH_GLOBAL.fontKR,
  cursor: "pointer",
};

type PastoralFeedDetailModalProps = {
  item: PastoralFeedDetailItem;
  db: DB;
  onClose: () => void;
};

export function PastoralFeedDetailModal({ item, db, onClose }: PastoralFeedDetailModalProps) {
  const [mounted, setMounted] = useState(false);
  const member = useMemo(
    () => (item.memberId ? db.members.find((m) => m.id === item.memberId) : undefined),
    [db.members, item.memberId],
  );

  const badge = getFeedBadge(item);
  const dateLabel = fmtFeedDate(item.timestamp);
  const displayName = formatMemberName(item.memberName || item.title || member?.name || "");
  const dept = member?.dept?.trim();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  if (!mounted) return null;

  return createPortal(
    <div
      className="modal-bg open"
      role="presentation"
      style={{
        zIndex: 1200,
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={`${displayName} ${badge.label}`}
        style={{
          maxWidth: 480,
          width: "calc(100% - 32px)",
          padding: 28,
          borderRadius: 10,
          background: DASH_CARD.bg,
          border: DASH_CARD.border,
          boxShadow: DASH_CARD.floatShadow,
          fontFamily: DASH_GLOBAL.fontKR,
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 12,
            marginBottom: 20,
            paddingBottom: 16,
            borderBottom: "1px solid rgba(0,0,0,0.06)",
          }}
        >
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 12,
                  fontWeight: 600,
                  color: badge.fg,
                  background: badge.bg,
                  borderRadius: 6,
                  padding: "4px 10px",
                  lineHeight: 1.2,
                  whiteSpace: "nowrap",
                }}
              >
                {badge.label}
              </span>
              {dateLabel ? (
                <span style={{ fontSize: 13, color: DASH_COLOR.dateValue, whiteSpace: "nowrap" }}>
                  {dateLabel}
                </span>
              ) : null}
            </div>
            <h2
              style={{
                margin: 0,
                fontSize: 18,
                fontWeight: 700,
                color: DASH_COLOR.ink,
                lineHeight: 1.35,
                wordBreak: "keep-all",
              }}
            >
              {displayName || badge.label}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            style={{
              width: 32,
              height: 32,
              marginTop: -4,
              border: "none",
              background: "transparent",
              borderRadius: 8,
              cursor: "pointer",
              color: DASH_COLOR.dateValue,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <X size={20} strokeWidth={2} />
          </button>
        </div>

        {member ? (
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: "50%",
                overflow: "hidden",
                flexShrink: 0,
                background: "#f4f4f6",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 15,
                fontWeight: 700,
                color: DASH_COLOR.ink,
                border: "1px solid rgba(0,0,0,0.06)",
              }}
            >
              <MemberPhoto
                photo={member.photo}
                name={member.name}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: DASH_COLOR.ink, lineHeight: 1.3 }}>
                {member.name}
              </div>
              {dept ? (
                <span
                  style={{
                    display: "inline-flex",
                    marginTop: 4,
                    fontSize: 12,
                    fontWeight: 600,
                    color: "#6d7280",
                    background: "#ececf0",
                    borderRadius: 6,
                    padding: "3px 8px",
                    lineHeight: 1.2,
                  }}
                >
                  {dept}
                </span>
              ) : null}
            </div>
          </div>
        ) : null}

        <div
          style={{
            fontSize: 15,
            lineHeight: 1.7,
            color: DASH_COLOR.ink,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {item.body.trim() || "내용이 없습니다."}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 28 }}>
          <button type="button" onClick={onClose} style={modalBtnClose}>
            닫기
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
