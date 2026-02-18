"use client";

import React, { useState, useMemo } from "react";
import type { AuditLog } from "@/types/db";

const NAVY = "#1e3a5f";
const ACTION_COLORS: Record<string, string> = {
  CREATE: "bg-green-100 text-green-800",
  UPDATE: "bg-blue-100 text-blue-800",
  DELETE: "bg-red-100 text-red-800",
  LOGIN: "bg-gray-100 text-gray-800",
  EXPORT: "bg-purple-100 text-purple-800",
  PRINT: "bg-amber-100 text-amber-800",
};

export interface AuditLogViewerProps {
  logs: AuditLog[];
  onLoad?: (filters: { startDate?: string; endDate?: string; action?: string; targetTable?: string }) => void;
}

export function AuditLogViewer({ logs, onLoad }: AuditLogViewerProps) {
  const [startDate, setStartDate] = useState(() => new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [actionFilter, setActionFilter] = useState("");
  const [tableFilter, setTableFilter] = useState("");
  const [expandId, setExpandId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let list = logs;
    if (startDate) list = list.filter((l) => l.created_at >= startDate);
    if (endDate) list = list.filter((l) => l.created_at.slice(0, 10) <= endDate);
    if (actionFilter) list = list.filter((l) => l.action === actionFilter);
    if (tableFilter) list = list.filter((l) => l.target_table === tableFilter);
    return list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [logs, startDate, endDate, actionFilter, tableFilter]);

  const tables = useMemo(() => Array.from(new Set(logs.map((l) => l.target_table).filter(Boolean))) as string[], [logs]);
  const actions = useMemo(() => Array.from(new Set(logs.map((l) => l.action))), [logs]);

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold" style={{ color: NAVY }}>작업 이력</h3>
      <div className="flex flex-wrap items-center gap-3 bg-white rounded-xl border border-gray-100 p-4">
        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="rounded-lg border border-gray-200 px-3 py-2 text-sm" />
        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="rounded-lg border border-gray-200 px-3 py-2 text-sm" />
        <select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)} className="rounded-lg border border-gray-200 px-3 py-2 text-sm">
          <option value="">전체 액션</option>
          {actions.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <select value={tableFilter} onChange={(e) => setTableFilter(e.target.value)} className="rounded-lg border border-gray-200 px-3 py-2 text-sm">
          <option value="">전체 대상</option>
          {tables.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        {onLoad && <button type="button" onClick={() => onLoad({ startDate, endDate, action: actionFilter || undefined, targetTable: tableFilter || undefined })} className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium hover:bg-gray-50">조회</button>}
      </div>
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50/50">
              <th className="text-left py-3 px-4 font-semibold text-gray-700">시간</th>
              <th className="text-left py-3 px-4 font-semibold text-gray-700">사용자</th>
              <th className="text-left py-3 px-4 font-semibold text-gray-700">액션</th>
              <th className="text-left py-3 px-4 font-semibold text-gray-700">대상</th>
              <th className="text-left py-3 px-4 font-semibold text-gray-700">상세</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={5} className="py-8 text-center text-gray-500">이력이 없습니다.</td></tr>
            ) : (
              filtered.map((log) => (
                <React.Fragment key={log.id}>
                  <tr className="border-b border-gray-100 hover:bg-gray-50/50">
                    <td className="py-3 px-4 text-gray-600 whitespace-nowrap">{new Date(log.created_at).toLocaleString("ko-KR")}</td>
                    <td className="py-3 px-4">{log.user_name ?? "-"}</td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${ACTION_COLORS[log.action] ?? "bg-gray-100 text-gray-800"}`}>{log.action}</span>
                    </td>
                    <td className="py-3 px-4">{log.target_table ?? "-"} {log.target_name ? `· ${log.target_name}` : ""}</td>
                    <td className="py-3 px-4">
                      {log.details && Object.keys(log.details).length > 0 && (
                        <button type="button" onClick={() => setExpandId(expandId === log.id ? null : log.id)} className="text-xs font-medium hover:underline" style={{ color: NAVY }}>
                          {expandId === log.id ? "접기" : "펼치기"}
                        </button>
                      )}
                    </td>
                  </tr>
                  {expandId === log.id && log.details && (
                    <tr className="bg-gray-50">
                      <td colSpan={5} className="py-2 px-4">
                        <pre className="text-xs text-gray-700 overflow-x-auto whitespace-pre-wrap">{JSON.stringify(log.details, null, 2)}</pre>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
