"use client";

import { useState, useMemo, useEffect } from "react";
import type { MessageLog } from "./SendMessage";
import { supabase } from "@/lib/supabase";
import { C } from "@/styles/designTokens";

export interface MessageHistoryProps {
  logs?: MessageLog[];
  toast?: (msg: string, type?: "ok" | "err" | "warn") => void;
}

export function MessageHistory({ logs = [], toast }: MessageHistoryProps) {
  const [startDate, setStartDate] = useState(() => new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [statusFilter, setStatusFilter] = useState("");
  const [dbLogs, setDbLogs] = useState<MessageLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const start = `${startDate}T00:00:00`;
    const end = `${endDate}T23:59:59`;
    let q = supabase.from("message_logs").select("id, recipient_ids, recipient_names, content, message_type, sent_at, status").gte("sent_at", start).lte("sent_at", end).order("sent_at", { ascending: false });
    if (statusFilter) q = q.eq("status", statusFilter);
    q.then(({ data, error }) => {
      if (error && toast) toast("발송 내역 로드 실패: " + error.message, "err");
      const rows = (data ?? []).map((r: Record<string, unknown>) => ({
        id: String(r.id),
        recipient_ids: Array.isArray(r.recipient_ids) ? r.recipient_ids as string[] : [],
        recipient_names: String(r.recipient_names ?? ""),
        content: String(r.content ?? ""),
        message_type: (r.message_type as "SMS" | "LMS") || "SMS",
        sent_at: r.sent_at ? new Date(String(r.sent_at)).toISOString() : "",
        status: (r.status as MessageLog["status"]) || "저장됨",
      }));
      setDbLogs(rows);
    }).finally(() => setLoading(false));
  }, [startDate, endDate, statusFilter, toast]);

  const list = dbLogs.length > 0 ? dbLogs : logs;
  const filtered = useMemo(() => {
    let result = list.filter((l) => l.sent_at && l.sent_at.slice(0, 10) >= startDate && l.sent_at.slice(0, 10) <= endDate);
    if (statusFilter) result = result.filter((l) => l.status === statusFilter);
    return result.sort((a, b) => (b.sent_at || "").localeCompare(a.sent_at || ""));
  }, [list, startDate, endDate, statusFilter]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, background: C.card, borderRadius: 16, border: `1px solid ${C.border}`, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={{ borderRadius: 10, border: `1px solid ${C.border}`, padding: "8px 12px", fontSize: 14 }} />
        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={{ borderRadius: 10, border: `1px solid ${C.border}`, padding: "8px 12px", fontSize: 14 }} />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ borderRadius: 10, border: `1px solid ${C.border}`, padding: "8px 12px", fontSize: 14, background: C.card }}>
          <option value="">전체 상태</option>
          <option value="저장됨">저장됨</option>
          <option value="발송대기">발송대기</option>
          <option value="발송완료">발송완료</option>
          <option value="실패">실패</option>
        </select>
      </div>
      <div style={{ background: C.card, borderRadius: 16, border: `1px solid ${C.border}`, overflowX: "auto", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
        {loading && <p style={{ padding: 12, color: C.textMuted, fontSize: 13 }}>로딩 중...</p>}
        <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: C.bg, borderBottom: `1px solid ${C.border}` }}>
              <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: 600, fontSize: 13, color: C.navy }}>발송일시</th>
              <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: 600, fontSize: 13, color: C.navy }}>수신자</th>
              <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: 600, fontSize: 13, color: C.navy }}>유형</th>
              <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: 600, fontSize: 13, color: C.navy }}>내용 요약</th>
              <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: 600, fontSize: 13, color: C.navy }}>상태</th>
            </tr>
          </thead>
          <tbody>
            {!loading && filtered.length === 0 ? (
              <tr><td colSpan={5} style={{ padding: 32, textAlign: "center", color: C.textMuted }}>발송 내역이 없습니다.</td></tr>
            ) : (
              filtered.map((log) => (
                <tr
                  key={log.id}
                  style={{ borderBottom: `1px solid ${C.borderLight}` }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = C.bg; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                >
                  <td style={{ padding: "12px 16px", color: C.textMuted }}>{new Date(log.sent_at).toLocaleString("ko-KR")}</td>
                  <td style={{ padding: "12px 16px" }}>{log.recipient_names || `${log.recipient_ids?.length ?? 0}명`}</td>
                  <td style={{ padding: "12px 16px" }}>{log.message_type}</td>
                  <td style={{ padding: "12px 16px", maxWidth: 280 }} className="truncate">{(log.content || "").slice(0, 40)}{(log.content?.length ?? 0) > 40 ? "…" : ""}</td>
                  <td style={{ padding: "12px 16px" }}><span style={{ display: "inline-flex", padding: "2px 8px", borderRadius: 6, fontSize: 12, background: C.bg, color: C.textMuted }}>{log.status}</span></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
