"use client";

import { useMemo, useState, type KeyboardEvent, type ReactNode } from "react";
import { ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react";
import { PcEmptyState } from "./PcEmptyState";
import styles from "./PcTable.module.css";

export type PcTableColumn<T> = {
  key: string;
  header: ReactNode;
  accessor?: (row: T) => ReactNode;
  width?: string | number;
  align?: "left" | "center" | "right";
  sortable?: boolean;
  sortAccessor?: (row: T) => string | number;
  sticky?: "left" | "right";
  /** true면 해당 열 th/td에 줄바꿈 없음 */
  nowrap?: boolean;
};

export type PcTableSortState = {
  key: string;
  direction: "asc" | "desc";
} | null;

export interface PcTableProps<T> {
  data: T[];
  columns: PcTableColumn<T>[];
  rowKey: (row: T, index: number) => string | number;
  size?: "sm" | "md" | "lg";
  striped?: boolean;
  hoverable?: boolean;
  bordered?: boolean;
  onRowClick?: (row: T, index: number) => void;
  emptyState?: ReactNode;
  loading?: boolean;
  stickyHeader?: boolean;
  defaultSort?: { key: string; direction: "asc" | "desc" };
  onSortChange?: (sort: PcTableSortState) => void;
  caption?: string;
  className?: string;
}

function parseWidthPx(w: string | number | undefined): number {
  if (w == null) return 128;
  if (typeof w === "number") return w;
  const px = /^(\d+(?:\.\d+)?)px$/i.exec(w.trim());
  if (px) return parseFloat(px[1]);
  return 128;
}

function getSortValue<T>(row: T, col: PcTableColumn<T>): string | number {
  if (col.sortAccessor) return col.sortAccessor(row);
  if (col.accessor) {
    const v = col.accessor(row);
    if (typeof v === "string" || typeof v === "number") return v;
  }
  const raw = row[col.key as keyof T];
  if (typeof raw === "string" || typeof raw === "number") return raw;
  return String(raw ?? "");
}

function getCellContent<T>(row: T, col: PcTableColumn<T>): ReactNode {
  if (col.accessor) return col.accessor(row);
  return row[col.key as keyof T] as ReactNode;
}

function compareValues(
  a: string | number,
  b: string | number,
  direction: "asc" | "desc",
): number {
  const flip = direction === "desc" ? -1 : 1;
  if (typeof a === "number" && typeof b === "number") {
    if (a < b) return -1 * flip;
    if (a > b) return 1 * flip;
    return 0;
  }
  const sa = String(a);
  const sb = String(b);
  return sa.localeCompare(sb, "ko") * flip;
}

function buildStickyLeftOffsets<T>(cols: PcTableColumn<T>[]): Map<string, number> {
  const map = new Map<string, number>();
  let acc = 0;
  for (const c of cols) {
    if (c.sticky === "left") {
      map.set(c.key, acc);
      acc += parseWidthPx(c.width);
    }
  }
  return map;
}

function buildStickyRightOffsets<T>(cols: PcTableColumn<T>[]): Map<string, number> {
  const map = new Map<string, number>();
  let acc = 0;
  for (let i = cols.length - 1; i >= 0; i--) {
    const c = cols[i]!;
    if (c.sticky === "right") {
      map.set(c.key, acc);
      acc += parseWidthPx(c.width);
    }
  }
  return map;
}

export function PcTable<T>({
  data,
  columns,
  rowKey,
  size = "md",
  striped = false,
  hoverable = true,
  bordered = false,
  onRowClick,
  emptyState,
  loading = false,
  stickyHeader = false,
  defaultSort,
  onSortChange,
  caption,
  className,
}: PcTableProps<T>) {
  const [sort, setSort] = useState<PcTableSortState>(() => defaultSort ?? null);

  const stickyLeft = useMemo(() => buildStickyLeftOffsets(columns), [columns]);
  const stickyRight = useMemo(() => buildStickyRightOffsets(columns), [columns]);

  const displayData = useMemo(() => {
    if (!sort) return data;
    const col = columns.find((c) => c.key === sort.key);
    if (!col) return data;
    const dir = sort.direction;
    return [...data].sort((ra, rb) => {
      const va = getSortValue(ra, col);
      const vb = getSortValue(rb, col);
      return compareValues(va, vb, dir);
    });
  }, [data, columns, sort]);

  const thPad =
    size === "sm"
      ? styles.thPadSm
      : size === "lg"
        ? styles.thPadLg
        : styles.thPadMd;
  const tdPad =
    size === "sm"
      ? styles.tdPadSm
      : size === "lg"
        ? styles.tdPadLg
        : styles.tdPadMd;

  const wrapClass = [
    styles.wrap,
    size === "lg" ? styles.bodyLg : "",
    striped ? styles.striped : "",
    hoverable ? styles.hoverable : "",
    bordered ? styles.bordered : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  const handleSortClick = (key: string) => {
    const col = columns.find((c) => c.key === key);
    if (!col?.sortable) return;

    let next: PcTableSortState;
    if (sort?.key !== key) {
      next = { key, direction: "asc" };
    } else if (sort.direction === "asc") {
      next = { key, direction: "desc" };
    } else {
      next = null;
    }
    setSort(next);
    onSortChange?.(next);
  };

  const handleHeaderKeyDown = (e: KeyboardEvent<HTMLTableCellElement>, key: string) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const col = columns.find((c) => c.key === key);
    if (!col?.sortable) return;
    e.preventDefault();
    handleSortClick(key);
  };

  const handleRowKeyDown = (e: KeyboardEvent<HTMLTableRowElement>, row: T, index: number) => {
    if (!onRowClick) return;
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    onRowClick(row, index);
  };

  const isEmpty = !loading && data.length === 0;
  const colCount = columns.length;

  return (
    <div className={wrapClass}>
      <table className={styles.table} role="table">
        {caption ? (
          <caption className={styles.captionSr}>{caption}</caption>
        ) : null}
        <thead
          className={[styles.thead, stickyHeader ? styles.theadSticky : ""]
            .filter(Boolean)
            .join(" ")}
        >
          <tr>
            {columns.map((col) => {
              const align = col.align ?? "left";
              const thClass = [
                styles.th,
                thPad,
                col.sortable ? styles.thSortable : "",
                align === "center" ? styles.thAlignCenter : "",
                align === "right" ? styles.thAlignRight : "",
                align === "center" ? styles.alignCenter : "",
                align === "right" ? styles.alignRight : "",
                col.nowrap ? styles.cellNowrap : "",
              ]
                .filter(Boolean)
                .join(" ");

              const stickyStyle: React.CSSProperties = {};
              if (col.sticky === "left") {
                stickyStyle.position = "sticky";
                stickyStyle.left = stickyLeft.get(col.key) ?? 0;
                stickyStyle.zIndex = "var(--pc-z-table-sticky-cell)";
                stickyStyle.background = "var(--pc-surface)";
              } else if (col.sticky === "right") {
                stickyStyle.position = "sticky";
                stickyStyle.right = stickyRight.get(col.key) ?? 0;
                stickyStyle.zIndex = "var(--pc-z-table-sticky-cell)";
                stickyStyle.background = "var(--pc-surface)";
              }

              const widthStyle: React.CSSProperties =
                col.width != null
                  ? {
                      width:
                        typeof col.width === "number" ? `${col.width}px` : col.width,
                    }
                  : {};

              const ariaSort =
                sort?.key === col.key
                  ? sort.direction === "asc"
                    ? "ascending"
                    : "descending"
                  : "none";

              const sortIcon =
                sort?.key === col.key ? (
                  sort.direction === "asc" ? (
                    <ChevronUp className={styles.sortIcon} aria-hidden />
                  ) : (
                    <ChevronDown className={styles.sortIcon} aria-hidden />
                  )
                ) : (
                  <ChevronsUpDown
                    className={`${styles.sortIcon} ${styles.sortIconMuted}`}
                    aria-hidden
                  />
                );

              return (
                <th
                  key={col.key}
                  scope="col"
                  className={`${thClass} ${col.sticky === "left" ? `${styles.stickyCell} ${styles.stickyLeft}` : ""} ${col.sticky === "right" ? `${styles.stickyCell} ${styles.stickyRight}` : ""}`}
                  style={{ ...widthStyle, ...stickyStyle }}
                  aria-sort={col.sortable ? ariaSort : undefined}
                  role={col.sortable ? "button" : undefined}
                  tabIndex={col.sortable ? 0 : undefined}
                  onClick={col.sortable ? () => handleSortClick(col.key) : undefined}
                  onKeyDown={
                    col.sortable ? (e) => handleHeaderKeyDown(e, col.key) : undefined
                  }
                >
                  <span className={styles.thInner}>
                    {col.header}
                    {col.sortable ? sortIcon : null}
                  </span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            Array.from({ length: 5 }, (_, sk) => (
              <tr key={`sk-${sk}`} className={styles.skeletonRow} aria-hidden>
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`${styles.td} ${tdPad}${col.nowrap ? ` ${styles.cellNowrap}` : ""}`}
                    colSpan={1}
                  >
                    <div className={styles.skelBar} style={{ width: "70%" }} />
                  </td>
                ))}
              </tr>
            ))
          ) : isEmpty ? (
            <tr>
              <td colSpan={colCount} className={styles.emptyCell}>
                {emptyState ?? (
                  <PcEmptyState title="데이터가 없습니다" />
                )}
              </td>
            </tr>
          ) : (
            displayData.map((row, index) => {
              const last = index === displayData.length - 1;
              const stripeClass = index % 2 === 1 ? styles.trStripe : "";
              return (
                <tr
                  key={String(rowKey(row, index))}
                  className={`${last ? styles.trLast : ""} ${stripeClass} ${onRowClick ? styles.clickable : ""}`}
                  tabIndex={onRowClick ? 0 : undefined}
                  onClick={onRowClick ? () => onRowClick(row, index) : undefined}
                  onKeyDown={
                    onRowClick ? (e) => handleRowKeyDown(e, row, index) : undefined
                  }
                >
                  {columns.map((col) => {
                    const align = col.align ?? "left";
                    const tdClass = [
                      styles.td,
                      tdPad,
                      align === "center" ? styles.alignCenter : "",
                      align === "right" ? styles.alignRight : "",
                      col.nowrap ? styles.cellNowrap : "",
                    ]
                      .filter(Boolean)
                      .join(" ");

                    const stickyStyle: React.CSSProperties = {};
                    if (col.sticky === "left") {
                      stickyStyle.position = "sticky";
                      stickyStyle.left = stickyLeft.get(col.key) ?? 0;
                      stickyStyle.zIndex = "var(--pc-z-table-sticky-cell)";
                      stickyStyle.background = "var(--pc-surface)";
                    } else if (col.sticky === "right") {
                      stickyStyle.position = "sticky";
                      stickyStyle.right = stickyRight.get(col.key) ?? 0;
                      stickyStyle.zIndex = "var(--pc-z-table-sticky-cell)";
                      stickyStyle.background = "var(--pc-surface)";
                    }

                    const widthStyle: React.CSSProperties =
                      col.width != null
                        ? {
                            width:
                              typeof col.width === "number"
                                ? `${col.width}px`
                                : col.width,
                          }
                        : {};

                    return (
                      <td
                        key={col.key}
                        className={`${tdClass} ${col.sticky === "left" ? `${styles.stickyCell} ${styles.stickyLeft}` : ""} ${col.sticky === "right" ? `${styles.stickyCell} ${styles.stickyRight}` : ""}`}
                        style={{ ...widthStyle, ...stickyStyle }}
                      >
                        {getCellContent(row, col)}
                      </td>
                    );
                  })}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
