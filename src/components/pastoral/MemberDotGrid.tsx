"use client";

import { useMemo } from "react";
import { DASH_CHART, DASH_LAYOUT, getMemberDotScale } from "@/styles/pastoralDashboardTokens";

type MemberDotGridProps = {
  total: number;
  activeCount: number;
  /** 막대와 동기화된 dot 셀 크기(px). 없으면 너비 기준 aspect-ratio */
  cellSize?: number;
};

/**
 * 전체 성도 카드 — 25×4 백분율 dot (시안 2번 이미지).
 * gap 6px 고정, cellSize 지정 시 막대 높이와 정렬.
 */
export function MemberDotGrid({ total, activeCount, cellSize }: MemberDotGridProps) {
  const scale = useMemo(() => getMemberDotScale(total, activeCount), [total, activeCount]);
  const { memberDotCols: cols, memberDotRows: rows, memberDotGap: gap } = DASH_LAYOUT;

  if (cellSize != null && cellSize > 0) {
    const gridH = rows * cellSize + (rows - 1) * gap;
    return (
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${rows}, ${cellSize}px)`,
          gap,
          width: "100%",
          height: gridH,
          flexShrink: 0,
          alignContent: "end",
        }}
      >
        {Array.from({ length: scale.slotCount }).map((_, i) => (
          <span
            key={i}
            style={{
              width: cellSize,
              height: cellSize,
              justifySelf: "center",
              borderRadius: "50%",
              background: i < scale.activeDots ? DASH_CHART.memberDotFill : DASH_CHART.memberDotEmpty,
            }}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
        gap,
        width: "100%",
        flexShrink: 0,
        alignContent: "end",
      }}
    >
      {Array.from({ length: scale.slotCount }).map((_, i) => (
        <span
          key={i}
          style={{
            width: "100%",
            aspectRatio: "1",
            borderRadius: "50%",
            background: i < scale.activeDots ? DASH_CHART.memberDotFill : DASH_CHART.memberDotEmpty,
          }}
        />
      ))}
    </div>
  );
}
