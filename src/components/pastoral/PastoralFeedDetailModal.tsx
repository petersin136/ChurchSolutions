"use client";

import { useMemo } from "react";
import type { Note, DB } from "@/types/db";
import { MemberPhoto } from "@/components/common/MemberPhoto";
import { PcModalShell } from "@/components/common/PcModalShell";
import { DASH_BADGE, DASH_COLOR } from "@/styles/pastoralDashboardTokens";
import { appModalBtnSubmit } from "@/styles/appModalTokens";

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

type PastoralFeedDetailModalProps = {
  item: PastoralFeedDetailItem;
  db: DB;
  onClose: () => void;
};

export function PastoralFeedDetailModal({ item, db, onClose }: PastoralFeedDetailModalProps) {
  const member = useMemo(
    () => (item.memberId ? db.members.find((m) => m.id === item.memberId) : undefined),
    [db.members, item.memberId],
  );

  const badge = getFeedBadge(item);
  const dateLabel = fmtFeedDate(item.timestamp);
  const displayName = formatMemberName(item.memberName || item.title || member?.name || "");
  const dept = member?.dept?.trim();

  return (
    <PcModalShell
      open
      onClose={onClose}
      title={
        <span style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              fontSize: 12,
              fontWeight: 600,
              color: badge.fg,
              background: badge.bg,
              borderRadius: 7,
              padding: "4px 10px",
              lineHeight: 1.2,
            }}
          >
            {badge.label}
          </span>
          <span>{displayName || badge.label}</span>
        </span>
      }
      footer={
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button type="button" onClick={onClose} style={{ ...appModalBtnSubmit, flex: "0 0 auto", minWidth: 96 }}>
            닫기
          </button>
        </div>
      }
    >
      {dateLabel ? (
        <div style={{ fontSize: 13, color: DASH_COLOR.dateValue, marginBottom: 16 }}>{dateLabel}</div>
      ) : null}

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
              border: "1px solid rgba(0,0,0,0.06)",
            }}
          >
            <MemberPhoto
              photo={member.photo}
              name={member.name}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: DASH_COLOR.ink }}>{member.name}</div>
            {dept ? (
              <span
                style={{
                  display: "inline-flex",
                  marginTop: 4,
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#6d7280",
                  background: "#ececf0",
                  borderRadius: 7,
                  padding: "3px 8px",
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
    </PcModalShell>
  );
}
