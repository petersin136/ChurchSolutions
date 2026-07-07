"use client";

import { useRef, type CSSProperties } from "react";
import { Plus } from "lucide-react";
import type { DB, Member } from "@/types/db";
import { MemberPhoto } from "@/components/common/MemberPhoto";
import { Pagination, PAGINATION_LIST_PARENT_STYLE } from "@/components/common/Pagination";
import { MemberSearchCombo } from "@/components/pastoral/MemberSearchCombo";
import { MEMBER_MGMT, MEMBER_MGMT_COLUMNS } from "@/styles/memberManagementTokens";

function formatDeptMokjang(member: Member): string {
  const dept = (member.dept || "").trim();
  const mokjang = ((member.mokjang ?? member.group) || "").trim();
  if (dept && mokjang) return `${dept}/${mokjang}`;
  return dept || mokjang || "-";
}

function prayerPreview(member: Member, notes: DB["notes"][string] | undefined) {
  const prayerNotes = (notes ?? []).filter((n) => n.type === "prayer");
  const texts = [
    ...(member.prayer?.trim() ? [member.prayer.trim()] : []),
    ...prayerNotes.map((n) => n.content?.trim()).filter(Boolean) as string[],
  ];
  const unique = [...new Set(texts)];
  const preview = unique[0] ?? "";
  const extra = Math.max(0, unique.length - 1);
  const snip = preview.length > 22 ? `${preview.slice(0, 22)}…` : preview;
  return { snip, extra, hasPrayer: Boolean(preview) };
}

function memoPreview(notes: DB["notes"][string] | undefined, memberMemo?: string) {
  const memos = (notes ?? []).filter((n) => n.type === "memo");
  const sorted = [...memos].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  const text = (sorted[0]?.content || memberMemo || "").trim();
  if (!text) return "-";
  return text.length > 18 ? `${text.slice(0, 18)}…` : text;
}

function lastVisitDate(notes: DB["notes"][string] | undefined): string {
  const visits = (notes ?? []).filter((n) => n.type === "visit");
  if (!visits.length) return "-";
  const sorted = [...visits].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  return sorted[0]?.date ?? "-";
}

export interface MembersManagementPanelProps {
  mob: boolean;
  mobPanelMinH: number | string;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  deptOptions: { value: string; label: string }[];
  mokjangOptions: { value: string; label: string }[];
  roleOptions: { value: string; label: string }[];
  onSelectDept: (value: string) => void;
  onSelectMokjang: (value: string) => void;
  onSelectRole: (value: string) => void;
  onResetFilters: () => void;
  onRegister: () => void;
  db: DB;
  filtered: Member[];
  pageMembers: Member[];
  pageSize: number;
  currentPage: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onOpenDetail: (id: string) => void;
  onOpenQuickPrayer: (id: string, name: string) => void;
  onOpenActivity: (id: string) => void;
}

export function MembersManagementPanel({
  mob,
  mobPanelMinH,
  searchQuery,
  onSearchChange,
  deptOptions,
  mokjangOptions,
  roleOptions,
  onSelectDept,
  onSelectMokjang,
  onSelectRole,
  onResetFilters,
  onRegister,
  db,
  filtered,
  pageMembers,
  pageSize,
  currentPage,
  totalItems,
  onPageChange,
  onOpenDetail,
  onOpenQuickPrayer,
  onOpenActivity,
}: MembersManagementPanelProps) {
  const listRef = useRef<HTMLDivElement>(null);

  const registerBtnStyle: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: MEMBER_MGMT.registerHeight,
    padding: `0 ${MEMBER_MGMT.registerPadX}px`,
    borderRadius: MEMBER_MGMT.registerRadius,
    border: `1px solid ${MEMBER_MGMT.registerBorder}`,
    background: MEMBER_MGMT.registerBg,
    color: MEMBER_MGMT.registerText,
    fontFamily: MEMBER_MGMT.fontKR,
    fontSize: mob ? 13 : MEMBER_MGMT.registerFontSize,
    fontWeight: MEMBER_MGMT.registerFontWeight,
    cursor: "pointer",
    whiteSpace: "nowrap",
    flexShrink: 0,
    boxSizing: "border-box",
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        maxWidth: "100%",
        minWidth: 0,
        boxSizing: "border-box",
        fontFamily: MEMBER_MGMT.fontKR,
        gap: MEMBER_MGMT.gap,
        ...(mob ? { minHeight: mobPanelMinH } : {}),
      }}
    >
      <div
        style={{
          display: "flex",
          gap: MEMBER_MGMT.toolbarGap,
          alignItems: "stretch",
          width: "100%",
          minWidth: 0,
          flexWrap: mob ? "wrap" : "nowrap",
        }}
      >
        <MemberSearchCombo
          value={searchQuery}
          onChange={(v) => {
            onSearchChange(v);
            if (!v.trim()) onResetFilters();
          }}
          deptOptions={deptOptions}
          mokjangOptions={mokjangOptions}
          roleOptions={roleOptions}
          onSelectDept={onSelectDept}
          onSelectMokjang={onSelectMokjang}
          onSelectRole={onSelectRole}
        />
        <button
          type="button"
          onClick={onRegister}
          style={{
            ...registerBtnStyle,
            ...(mob ? { width: "100%" } : {}),
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = MEMBER_MGMT.registerBgHover;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = MEMBER_MGMT.registerBg;
          }}
        >
          <Plus size={16} strokeWidth={2.25} aria-hidden />
          새 성도 등록
        </button>
      </div>

      <div style={{ ...PAGINATION_LIST_PARENT_STYLE, minWidth: 0 }}>
        <div
          ref={listRef}
          style={{
            flex: 1,
            minHeight: 0,
            width: "100%",
            ...(mob ? { overflowY: "auto", WebkitOverflowScrolling: "touch" } : {}),
          }}
        >
          <div
            style={{
              background: MEMBER_MGMT.tableBg,
              border: `1px solid ${MEMBER_MGMT.tableBorder}`,
              borderRadius: MEMBER_MGMT.tableRadius,
              overflow: "hidden",
              width: "100%",
            }}
          >
            <div style={{ overflowX: "auto", width: "100%" }}>
              <table
                style={{
                  width: "100%",
                  minWidth: mob ? 720 : undefined,
                  borderCollapse: "collapse",
                  tableLayout: "fixed",
                }}
              >
                <colgroup>
                  <col style={{ width: 52 }} />
                  <col style={{ width: mob ? 140 : 180 }} />
                  <col style={{ width: mob ? 72 : 96 }} />
                  <col style={{ width: mob ? 120 : 150 }} />
                  <col />
                  <col style={{ width: mob ? 100 : 118 }} />
                  <col style={{ width: mob ? 88 : 110 }} />
                  <col style={{ width: 56 }} />
                </colgroup>
                <thead>
                  <tr style={{ background: MEMBER_MGMT.headerBg, borderBottom: `1px solid ${MEMBER_MGMT.tableBorder}` }}>
                    {MEMBER_MGMT_COLUMNS.map((h, i) => (
                      <th
                        key={h}
                        style={{
                          padding: `${MEMBER_MGMT.headerPadY}px ${MEMBER_MGMT.headerPadX}px`,
                          fontSize: MEMBER_MGMT.headerFontSize,
                          fontWeight: MEMBER_MGMT.headerFontWeight,
                          color: MEMBER_MGMT.headerText,
                          textAlign: i === 0 || i === 7 ? "center" : "left",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td
                        colSpan={8}
                        style={{
                          height: pageSize * MEMBER_MGMT.rowHeight,
                          textAlign: "center",
                          color: MEMBER_MGMT.memoMuted,
                          fontSize: MEMBER_MGMT.cellFontSize,
                          verticalAlign: "middle",
                        }}
                      >
                        검색 결과가 없습니다
                      </td>
                    </tr>
                  ) : (
                    Array.from({ length: pageSize }, (_, idx) => {
                      const m = pageMembers[idx];
                      if (!m) {
                        return (
                          <tr key={`pad-${currentPage}-${idx}`} aria-hidden style={{ height: MEMBER_MGMT.rowHeight }}>
                            <td colSpan={8} style={{ borderBottom: `1px solid ${MEMBER_MGMT.rowBorder}` }} />
                          </tr>
                        );
                      }
                      const rowNum = (currentPage - 1) * pageSize + idx + 1;
                      const notes = db.notes[m.id];
                      const prayer = prayerPreview(m, notes);
                      const roleText = (m.role || "").trim() || "-";
                      const visitDate = lastVisitDate(notes);
                      const memoText = memoPreview(notes, m.memo);

                      return (
                        <tr
                          key={m.id}
                          onClick={() => onOpenDetail(m.id)}
                          style={{
                            height: MEMBER_MGMT.rowHeight,
                            borderBottom: `1px solid ${MEMBER_MGMT.rowBorder}`,
                            cursor: "pointer",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = MEMBER_MGMT.rowHover;
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = "transparent";
                          }}
                        >
                          <td
                            style={{
                              textAlign: "center",
                              color: MEMBER_MGMT.numText,
                              fontSize: MEMBER_MGMT.cellFontSize,
                              fontVariantNumeric: "tabular-nums",
                              padding: `0 ${MEMBER_MGMT.headerPadX}px`,
                            }}
                          >
                            {rowNum}
                          </td>
                          <td style={{ padding: `0 ${MEMBER_MGMT.headerPadX}px`, overflow: "hidden" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                              <div
                                style={{
                                  width: MEMBER_MGMT.avatarSize,
                                  height: MEMBER_MGMT.avatarSize,
                                  borderRadius: "50%",
                                  background: MEMBER_MGMT.avatarBg,
                                  color: MEMBER_MGMT.avatarText,
                                  fontSize: MEMBER_MGMT.avatarFontSize,
                                  fontWeight: MEMBER_MGMT.avatarFontWeight,
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  overflow: "hidden",
                                  flexShrink: 0,
                                }}
                              >
                                <MemberPhoto photo={m.photo} name={m.name} className="h-full w-full object-cover" />
                              </div>
                              <span
                                style={{
                                  fontSize: MEMBER_MGMT.nameFontSize,
                                  fontWeight: MEMBER_MGMT.nameFontWeight,
                                  color: MEMBER_MGMT.nameText,
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {m.name}
                              </span>
                            </div>
                          </td>
                          <td
                            style={{
                              padding: `0 ${MEMBER_MGMT.headerPadX}px`,
                              fontSize: MEMBER_MGMT.cellFontSize,
                              color: MEMBER_MGMT.rowText,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {roleText}
                          </td>
                          <td
                            style={{
                              padding: `0 ${MEMBER_MGMT.headerPadX}px`,
                              fontSize: MEMBER_MGMT.cellFontSize,
                              color: MEMBER_MGMT.rowText,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {formatDeptMokjang(m)}
                          </td>
                          <td
                            style={{ padding: `0 ${MEMBER_MGMT.headerPadX}px`, overflow: "hidden" }}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (prayer.hasPrayer) onOpenQuickPrayer(m.id, m.name || "?");
                            }}
                          >
                            {prayer.hasPrayer ? (
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 6,
                                  minWidth: 0,
                                  fontSize: MEMBER_MGMT.cellFontSize,
                                  color: MEMBER_MGMT.prayerText,
                                }}
                              >
                                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                  {prayer.snip}
                                </span>
                                {prayer.extra > 0 && (
                                  <span
                                    style={{
                                      flexShrink: 0,
                                      fontSize: MEMBER_MGMT.prayerBadgeFontSize,
                                      fontWeight: MEMBER_MGMT.prayerBadgeFontWeight,
                                      color: MEMBER_MGMT.prayerBadgeText,
                                      background: MEMBER_MGMT.prayerBadgeBg,
                                      padding: `2px ${MEMBER_MGMT.prayerBadgePadX}px`,
                                      borderRadius: MEMBER_MGMT.prayerBadgeRadius,
                                      lineHeight: 1.2,
                                    }}
                                  >
                                    +{prayer.extra}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span style={{ color: MEMBER_MGMT.memoMuted, fontSize: MEMBER_MGMT.cellFontSize }}>-</span>
                            )}
                          </td>
                          <td
                            style={{
                              padding: `0 ${MEMBER_MGMT.headerPadX}px`,
                              fontSize: MEMBER_MGMT.cellFontSize,
                              color: MEMBER_MGMT.rowText,
                              whiteSpace: "nowrap",
                            }}
                          >
                            {visitDate}
                          </td>
                          <td
                            style={{
                              padding: `0 ${MEMBER_MGMT.headerPadX}px`,
                              fontSize: MEMBER_MGMT.cellFontSize,
                              color: memoText === "-" ? MEMBER_MGMT.memoMuted : MEMBER_MGMT.rowText,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {memoText}
                          </td>
                          <td style={{ textAlign: "center", padding: `0 8px` }} onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              aria-label="활동기록"
                              onClick={() => onOpenActivity(m.id)}
                              style={{
                                width: MEMBER_MGMT.activityBtnSize,
                                height: MEMBER_MGMT.activityBtnSize,
                                borderRadius: 6,
                                border: `1px solid ${MEMBER_MGMT.activityBtnBorder}`,
                                background: MEMBER_MGMT.activityBtnBg,
                                color: MEMBER_MGMT.activityBtnText,
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                cursor: "pointer",
                                padding: 0,
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = MEMBER_MGMT.activityBtnHover;
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = MEMBER_MGMT.activityBtnBg;
                              }}
                            >
                              <Plus size={14} strokeWidth={2.25} />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <div
          style={{
            display: "flex",
            flexShrink: 0,
            alignItems: "center",
            justifyContent: "center",
            borderTop: `1px solid ${MEMBER_MGMT.rowBorder}`,
            background: MEMBER_MGMT.headerBg,
            padding: mob ? "8px 10px" : "10px 16px",
          }}
        >
          <Pagination
            compact={mob}
            totalItems={totalItems}
            itemsPerPage={pageSize}
            currentPage={currentPage}
            onPageChange={onPageChange}
          />
        </div>
      </div>
    </div>
  );
}
