"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";

export interface ColumnDef {
  key: string;
  label: string;
  width?: number | string;
  align?: "left" | "center" | "right";
  excelWidth?: number;
  render?: (value: unknown, row: Record<string, unknown>, rowIndex: number) => React.ReactNode;
}

export interface ReportModalProps {
  title: string;
  columns: ColumnDef[];
  data: Record<string, unknown>[];
  onClose: () => void;
  onDownloadExcel: () => void;
  pageSize?: number;
}

const PAGE_SIZE = 20;

export function ReportModal({ title, columns, data, onClose, onDownloadExcel, pageSize = PAGE_SIZE }: ReportModalProps) {
  const [page, setPage] = useState(1);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); return () => setMounted(false); }, []);
  useEffect(() => { setPage(1); }, [data]);

  const totalPages = Math.max(1, Math.ceil(data.length / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const paged = useMemo(() => data.slice((safePage - 1) * pageSize, safePage * pageSize), [data, safePage, pageSize]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!mounted) return null;

  const headerH = 73;
  const footerH = 64;

  const modal = (
    <>
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 10000 }}
      />
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%,-50%)",
          zIndex: 10001,
          width: "min(900px, 90vw)",
          maxHeight: "80vh",
          background: "#fff",
          borderRadius: 16,
          boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "24px 28px 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: "1px solid #E5E7EB",
            flexShrink: 0,
          }}
        >
          <h3 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#1F2937" }}>{title}</h3>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={onDownloadExcel}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "8px 16px", borderRadius: 8, border: "none",
                background: "#2563EB", color: "#fff", fontSize: 14, fontWeight: 600,
                cursor: "pointer", fontFamily: "inherit",
              }}
            >
              📥 엑셀 다운로드
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "8px 16px", borderRadius: 8, border: "none",
                background: "#F3F4F6", color: "#374151", fontSize: 14, fontWeight: 600,
                cursor: "pointer", fontFamily: "inherit",
              }}
            >
              닫기
            </button>
          </div>
        </div>

        {/* Table */}
        <div
          ref={scrollRef}
          style={{
            padding: "0 28px",
            overflowY: "auto",
            overflowX: "auto",
            flex: 1,
            maxHeight: `calc(80vh - ${headerH}px - ${footerH}px)`,
          }}
        >
          {data.length === 0 ? (
            <div style={{ textAlign: "center", padding: 48, color: "#9CA3AF", fontSize: 15 }}>
              데이터가 없습니다.
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, minWidth: columns.length > 8 ? 800 : undefined }}>
              <thead>
                <tr>
                  {columns.map((col) => (
                    <th
                      key={col.key}
                      style={{
                        position: "sticky",
                        top: 0,
                        zIndex: 1,
                        background: "#F8FAFC",
                        padding: "12px 16px",
                        fontSize: 13,
                        fontWeight: 600,
                        color: "#6B7280",
                        textAlign: col.align || "left",
                        borderBottom: "2px solid #E5E7EB",
                        whiteSpace: "nowrap",
                        width: col.width,
                      }}
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paged.map((row, ri) => (
                  <tr
                    key={ri}
                    style={{ transition: "background 0.15s" }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "#F8FAFC"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = ""; }}
                  >
                    {columns.map((col) => {
                      const val = row[col.key];
                      const rendered = col.render ? col.render(val, row, ri) : (val != null ? String(val) : "");
                      const isEmpty = rendered === "" || rendered === null || rendered === undefined;
                      return (
                        <td
                          key={col.key}
                          style={{
                            padding: "12px 16px",
                            fontSize: 14,
                            color: isEmpty ? "#D1D5DB" : "#374151",
                            borderBottom: "1px solid #F3F4F6",
                            verticalAlign: "middle",
                            textAlign: isEmpty ? "center" : (col.align || "left"),
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            maxWidth: col.width || 300,
                            fontVariantNumeric: col.align === "right" ? "tabular-nums" : undefined,
                          }}
                        >
                          {isEmpty ? "—" : rendered}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer / Pagination */}
        {data.length > 0 && (
          <div
            style={{
              padding: "16px 28px",
              borderTop: "1px solid #E5E7EB",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexShrink: 0,
            }}
          >
            <span style={{ fontSize: 13, color: "#9CA3AF" }}>
              총 {data.length}건 중 {safePage} 페이지
            </span>
            <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
              <PgBtn disabled={safePage <= 1} onClick={() => { setPage(safePage - 1); scrollRef.current?.scrollTo(0, 0); }}>
                <ChevronLeft size={16} />
              </PgBtn>
              {getVisiblePages(safePage, totalPages).map((p, i) =>
                p === "..." ? (
                  <span key={`e${i}`} style={{ padding: "0 4px", color: "#6B7280", fontSize: 13 }}>…</span>
                ) : (
                  <PgBtn key={p} active={p === safePage} onClick={() => { setPage(p as number); scrollRef.current?.scrollTo(0, 0); }}>
                    {p}
                  </PgBtn>
                )
              )}
              <PgBtn disabled={safePage >= totalPages} onClick={() => { setPage(safePage + 1); scrollRef.current?.scrollTo(0, 0); }}>
                <ChevronRight size={16} />
              </PgBtn>
            </div>
          </div>
        )}
      </div>
    </>
  );

  return createPortal(modal, document.body);
}

function PgBtn({ children, active, disabled, onClick }: { children: React.ReactNode; active?: boolean; disabled?: boolean; onClick?: () => void }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      style={{
        width: 32,
        height: 32,
        borderRadius: 8,
        border: "none",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 13,
        fontWeight: 600,
        fontFamily: "inherit",
        cursor: disabled ? "not-allowed" : "pointer",
        background: active ? "#2563EB" : "transparent",
        color: active ? "#fff" : "#6B7280",
        opacity: disabled ? 0.3 : 1,
        transition: "background 0.15s",
      }}
      onMouseEnter={(e) => { if (!active && !disabled) e.currentTarget.style.background = "#F3F4F6"; }}
      onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = "transparent"; }}
    >
      {children}
    </button>
  );
}

function getVisiblePages(current: number, total: number): (number | "...")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | "...")[] = [];
  if (current <= 4) {
    for (let i = 1; i <= 5; i++) pages.push(i);
    pages.push("...", total);
  } else if (current >= total - 3) {
    pages.push(1, "...");
    for (let i = total - 4; i <= total; i++) pages.push(i);
  } else {
    pages.push(1, "...", current - 1, current, current + 1, "...", total);
  }
  return pages;
}
