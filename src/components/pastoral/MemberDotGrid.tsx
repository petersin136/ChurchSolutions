"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { DASH_CHART, getMemberDotScale, layoutMemberDotGrid } from "@/styles/pastoralDashboardTokens";

type MemberDotGridProps = {
  total: number;
  activeCount: number;
};

/** 전체 성도 카드 — dot 영역 크기에 맞춰 원 개수·크기·열 수를 반응형으로 배치 */
export function MemberDotGrid({ total, activeCount }: MemberDotGridProps) {
  const areaRef = useRef<HTMLDivElement>(null);
  const [area, setArea] = useState({ w: 0, h: 0 });

  const scale = useMemo(() => getMemberDotScale(total, activeCount), [total, activeCount]);
  const layout = useMemo(
    () => layoutMemberDotGrid(scale.slotCount, area.w, area.h),
    [scale.slotCount, area.w, area.h],
  );

  useEffect(() => {
    const el = areaRef.current;
    if (!el) return;

    const update = () => {
      const { width, height } = el.getBoundingClientRect();
      setArea({ w: Math.floor(width), h: Math.floor(height) });
    };
    update();

    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
    ro?.observe(el);
    window.addEventListener("resize", update);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);

  return (
    <div
      ref={areaRef}
      style={{
        marginTop: "auto",
        flex: "1 1 0",
        minHeight: 48,
        width: "100%",
        display: "flex",
        alignItems: "flex-end",
      }}
    >
      {scale.slotCount > 0 && layout.dotSize > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${layout.cols}, ${layout.dotSize}px)`,
            gridAutoRows: `${layout.dotSize}px`,
            columnGap: layout.gap,
            rowGap: layout.gap,
            width: "100%",
          }}
        >
          {Array.from({ length: scale.slotCount }).map((_, i) => (
            <span
              key={i}
              style={{
                width: layout.dotSize,
                height: layout.dotSize,
                borderRadius: "50%",
                background: i < scale.activeDots ? DASH_CHART.memberDotFill : DASH_CHART.memberDotEmpty,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
