"use client";

import { useState, useMemo } from "react";
import type { MessageLog } from "./SendMessage";

export interface MessageHistoryProps {
  logs: MessageLog[];
}

export function MessageHistory({ logs }: MessageHistoryProps) {
  const [startDate, setStartDate] = useState(() => new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [statusFilter, setStatusFilter] = useState("");

  const filtered = useMemo(() => {
    let list = logs;
    list = list.filter((l) => l.sent_at >= startDate && l.sent_at.slice(0, 10) <= endDate);
    if (statusFilter) list = list.filter((l) => l.status === statusFilter);
    return list.sort((a, b) => b.sent_at.localeCompare(a.sent_at));
  }, [logs, startDate, endDate, statusFilter]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 bg-white rounded-xl border border-gray-100 p-4">
        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="rounded-lg border border-gray-200 px-3 py-2 text-sm" />
        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="rounded-lg border border-gray-200 px-3 py-2 text-sm" />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-lg border border-gray-200 px-3 py-2 text-sm">
          <option value="">전체 상태</option>
          <option value="저장됨">저장됨</option>
          <option value="발송대기">발송대기</option>
          <option value="발송완료">발송완료</option>
          <option value="실패">실패</option>
        </select>
      </div>
      <div className="bg-white rounded-xl border border-gray-100 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50/50">
              <th className="text-left py-3 px-4 font-semibold text-[#1e3a5f]">발송일시</th>
              <th className="text-left py-3 px-4 font-semibold text-[#1e3a5f]">수신자</th>
              <th className="text-left py-3 px-4 font-semibold text-[#1e3a5f]">유형</th>
              <th className="text-left py-3 px-4 font-semibold text-[#1e3a5f]">내용 요약</th>
              <th className="text-left py-3 px-4 font-semibold text-[#1e3a5f]">상태</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={5} className="py-8 text-center text-gray-500">발송 내역이 없습니다.</td></tr>
            ) : (
              filtered.map((log) => (
                <tr key={log.id} className="border-b border-gray-100">
                  <td className="py-3 px-4 text-gray-600">{new Date(log.sent_at).toLocaleString("ko-KR")}</td>
                  <td className="py-3 px-4">{log.recipient_names || `${log.recipient_ids?.length ?? 0}명`}</td>
                  <td className="py-3 px-4">{log.message_type}</td>
                  <td className="py-3 px-4 max-w-xs truncate">{log.content?.slice(0, 40)}…</td>
                  <td className="py-3 px-4"><span className="inline-flex px-2 py-0.5 rounded text-xs bg-gray-100">{log.status}</span></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
