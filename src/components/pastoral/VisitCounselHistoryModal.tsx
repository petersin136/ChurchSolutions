"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Check, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { APP_MODAL, appModalOverlayStyle } from "@/styles/appModalTokens";

type FocusTab = "visit" | "counsel";

type VisitRow = {
  id: string;
  date: string;
  type: string;
  content: string;
  completed: boolean;
};

type CounselRow = {
  id: string;
  date: string;
  type: string;
  summary: string;
  completed: boolean;
};

const VISIT_TYPE_LABEL: Record<string, string> = {
  sick: "병문안",
  new_family: "새가족",
  newfamily: "새가족",
  regular: "정기심방",
  crisis: "위기심방",
  celebration: "경조사",
  routine: "일반방문",
  prayer: "기도심방",
};

const COUNSEL_TYPE_LABEL: Record<string, string> = {
  family: "가정",
  faith: "신앙",
  career: "진로",
  health: "건강",
  finance: "재정",
  other: "기타",
};

function typeLabel(map: Record<string, string>, value: string): string {
  const raw = (value || "").trim();
  if (!raw) return "";
  return map[raw] || raw;
}

function formatDisplayDate(ymd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd);
  if (!m) return ymd;
  return `${m[1]}. ${m[2]}. ${m[3]}.`;
}

function memberSubtitle(name: string, role?: string): string {
  const n = name.trim();
  const r = (role || "").trim();
  if (!n) return r || "";
  if (!r) return n;
  return `${n} ${r}`;
}

export interface VisitCounselHistoryModalProps {
  open: boolean;
  onClose: () => void;
  memberId: string;
  memberName: string;
  memberRole?: string;
  churchId: string;
  initialTab?: FocusTab;
  /** 추가 — 심방 기록 또는 상담 기록 메뉴로 이동 */
  onAdd?: (tab: FocusTab) => void;
}

export function VisitCounselHistoryModal({
  open,
  onClose,
  memberId,
  memberName,
  memberRole,
  churchId,
  initialTab = "visit",
  onAdd,
}: VisitCounselHistoryModalProps) {
  const [mounted, setMounted] = useState(false);
  const [tab, setTab] = useState<FocusTab>(initialTab);
  const [visits, setVisits] = useState<VisitRow[]>([]);
  const [counsels, setCounsels] = useState<CounselRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    setTab(initialTab);
    setError("");
  }, [open, initialTab, memberId]);

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

  const load = useCallback(async () => {
    if (!supabase || !churchId || !memberId) {
      setVisits([]);
      setCounsels([]);
      return;
    }
    setLoading(true);
    setError("");
    const [visitRes, counselRes] = await Promise.all([
      supabase
        .from("visits")
        .select("id, date, type, content, summary, status")
        .eq("church_id", churchId)
        .eq("member_id", memberId)
        .order("date", { ascending: false }),
      supabase
        .from("counsels")
        .select("id, date, type, summary, follow_up_done")
        .eq("church_id", churchId)
        .eq("member_id", memberId)
        .order("date", { ascending: false }),
    ]);
    if (visitRes.error) {
      setError(visitRes.error.message);
      setVisits([]);
    } else {
      setVisits(
        (visitRes.data ?? []).map((row) => {
          const r = row as Record<string, unknown>;
          return {
            id: String(r.id ?? ""),
            date: String(r.date ?? ""),
            type: String(r.type ?? ""),
            content: String(r.summary ?? r.content ?? ""),
            completed: String(r.status ?? "") === "completed",
          };
        }),
      );
    }
    if (counselRes.error) {
      setError((prev) => prev || counselRes.error.message);
      setCounsels([]);
    } else {
      setCounsels(
        (counselRes.data ?? []).map((row) => {
          const r = row as Record<string, unknown>;
          return {
            id: String(r.id ?? ""),
            date: String(r.date ?? ""),
            type: String(r.type ?? ""),
            summary: String(r.summary ?? ""),
            completed: Boolean(r.follow_up_done),
          };
        }),
      );
    }
    setLoading(false);
  }, [churchId, memberId]);

  useEffect(() => {
    if (!open) return;
    void load();
  }, [open, load]);

  const toggleVisit = async (row: VisitRow) => {
    if (!supabase || !churchId) return;
    const next = !row.completed;
    setVisits((prev) => prev.map((v) => (v.id === row.id ? { ...v, completed: next } : v)));
    const { error: updateError } = await supabase
      .from("visits")
      .update({ status: next ? "completed" : "scheduled" })
      .eq("church_id", churchId)
      .eq("member_id", memberId)
      .eq("id", row.id);
    if (updateError) {
      setVisits((prev) => prev.map((v) => (v.id === row.id ? { ...v, completed: row.completed } : v)));
      setError(updateError.message);
    }
  };

  const toggleCounsel = async (row: CounselRow) => {
    if (!supabase || !churchId) return;
    const next = !row.completed;
    setCounsels((prev) => prev.map((c) => (c.id === row.id ? { ...c, completed: next } : c)));
    const { error: updateError } = await supabase
      .from("counsels")
      .update({ follow_up_done: next })
      .eq("church_id", churchId)
      .eq("member_id", memberId)
      .eq("id", row.id);
    if (updateError) {
      setCounsels((prev) => prev.map((c) => (c.id === row.id ? { ...c, completed: row.completed } : c)));
      setError(updateError.message);
    }
  };

  if (!mounted || !open) return null;

  const rows = tab === "visit" ? visits : counsels;

  return createPortal(
    <div
      role="presentation"
      style={appModalOverlayStyle}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="심방/상담 히스토리"
        style={{
          width: APP_MODAL.width,
          maxWidth: "100%",
          maxHeight: APP_MODAL.maxBodyHeight,
          borderRadius: APP_MODAL.radius,
          background: APP_MODAL.cardBg,
          border: APP_MODAL.cardBorder,
          boxShadow: APP_MODAL.cardShadow,
          fontFamily: APP_MODAL.fontKR,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "22px 22px 0" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ margin: 0, fontSize: APP_MODAL.titleSize, fontWeight: APP_MODAL.titleWeight, color: APP_MODAL.ink }}>
              심방/상담 히스토리
            </h2>
            <p style={{ margin: "6px 0 0", fontSize: 13, color: APP_MODAL.muted }}>
              {memberSubtitle(memberName, memberRole)}
            </p>
          </div>
          <button
            type="button"
            aria-label="닫기"
            onClick={onClose}
            style={{
              border: "none",
              background: "transparent",
              color: APP_MODAL.muted,
              cursor: "pointer",
              padding: 4,
              lineHeight: 0,
            }}
          >
            <X size={18} strokeWidth={2} />
          </button>
        </div>

        <div style={{ display: "flex", gap: 8, padding: "16px 22px 0" }}>
          {([
            ["visit", "심방"],
            ["counsel", "상담"],
          ] as const).map(([id, label]) => {
            const active = tab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                style={{
                  height: 32,
                  padding: "0 14px",
                  borderRadius: APP_MODAL.radius,
                  border: active ? "none" : "1px solid #e3e4e8",
                  background: active ? APP_MODAL.ink : "#ffffff",
                  color: active ? "#ffffff" : APP_MODAL.ink,
                  fontSize: 13,
                  fontWeight: 600,
                  fontFamily: APP_MODAL.fontKR,
                  cursor: "pointer",
                }}
              >
                {label}
              </button>
            );
          })}
        </div>

        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "16px 22px" }}>
          {loading ? (
            <p style={{ margin: 0, fontSize: 14, color: APP_MODAL.muted }}>불러오는 중...</p>
          ) : rows.length === 0 ? (
            <p style={{ margin: 0, fontSize: 14, color: APP_MODAL.muted }}>
              {tab === "visit" ? "심방 기록이 없습니다" : "상담 기록이 없습니다"}
            </p>
          ) : tab === "visit" ? (
            visits.map((row) => (
              <HistoryRow
                key={row.id}
                date={formatDisplayDate(row.date)}
                kind={typeLabel(VISIT_TYPE_LABEL, row.type)}
                text={row.content}
                completed={row.completed}
                checkLabel={row.completed ? "완료됨" : "완료 체크"}
                onToggle={() => void toggleVisit(row)}
              />
            ))
          ) : (
            counsels.map((row) => (
              <HistoryRow
                key={row.id}
                date={formatDisplayDate(row.date)}
                kind={typeLabel(COUNSEL_TYPE_LABEL, row.type)}
                text={row.summary}
                completed={row.completed}
                checkLabel={row.completed ? "완료됨" : "완료 체크"}
                onToggle={() => void toggleCounsel(row)}
              />
            ))
          )}
          {error ? (
            <p style={{ margin: "12px 0 0", fontSize: 12, color: APP_MODAL.deleteRed }}>{error}</p>
          ) : null}
        </div>

        {onAdd ? (
          <div style={{ display: "flex", justifyContent: "flex-end", padding: "0 22px 20px" }}>
            <button
              type="button"
              onClick={() => onAdd(tab)}
              style={{
                height: 36,
                padding: "0 16px",
                border: "none",
                borderRadius: APP_MODAL.radius,
                background: APP_MODAL.ink,
                color: "#ffffff",
                fontSize: 14,
                fontWeight: 600,
                fontFamily: APP_MODAL.fontKR,
                cursor: "pointer",
              }}
            >
              추가
            </button>
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}

function HistoryRow({
  date,
  kind,
  text,
  completed,
  checkLabel,
  onToggle,
}: {
  date: string;
  kind: string;
  text: string;
  completed: boolean;
  checkLabel: string;
  onToggle: () => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        gap: 12,
        alignItems: "flex-start",
        padding: "12px 0",
        borderBottom: "1px solid #eceef2",
      }}
    >
      <button
        type="button"
        aria-label={checkLabel}
        onClick={onToggle}
        style={{
          width: 20,
          height: 20,
          marginTop: 2,
          borderRadius: 4,
          border: completed ? "none" : "1.5px solid #c5c8d0",
          background: completed ? APP_MODAL.ink : "#ffffff",
          color: "#ffffff",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          flexShrink: 0,
          padding: 0,
        }}
      >
        {completed ? <Check size={12} strokeWidth={2.5} /> : null}
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: APP_MODAL.ink, fontVariantNumeric: "tabular-nums" }}>
            {date}
          </span>
          {kind ? <span style={{ fontSize: 12, color: APP_MODAL.muted }}>{kind}</span> : null}
        </div>
        {text ? (
          <p style={{ margin: "4px 0 0", fontSize: 14, lineHeight: 1.5, color: "#2c2d33", whiteSpace: "pre-wrap" }}>
            {text}
          </p>
        ) : null}
      </div>
    </div>
  );
}
