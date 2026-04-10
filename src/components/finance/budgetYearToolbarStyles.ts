import type { CSSProperties } from "react";

/** 연도/월 툴바 한 줄 (예산 하위 탭 공통) */
export function budgetYearToolbarRowStyle(): CSSProperties {
  return { display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginBottom: 12 };
}

export function budgetYearLabelStyle(mob: boolean): CSSProperties {
  return {
    fontSize: mob ? 13 : 14,
    fontWeight: 600,
    color: "#1B2A4A",
    marginRight: 8,
    flexShrink: 0,
  };
}

export function budgetYearSelectStyle(mob: boolean): CSSProperties {
  return mob
    ? {
        height: 34,
        fontSize: 13,
        padding: "0 10px",
        borderRadius: 8,
        border: "1.5px solid #e0e3ea",
        background: "#fff",
        color: "#1B2A4A",
        minWidth: 85,
        cursor: "pointer",
        fontFamily: "inherit",
        boxSizing: "border-box",
        outline: "none",
      }
    : {
        height: 38,
        fontSize: 14,
        padding: "0 12px",
        borderRadius: 10,
        border: "1.5px solid #e0e3ea",
        background: "#fff",
        color: "#1B2A4A",
        minWidth: 100,
        cursor: "pointer",
        fontFamily: "inherit",
        boxSizing: "border-box",
        outline: "none",
      };
}

/** 월 전용 select (데스크톱 minWidth 80) */
export function budgetMonthSelectStyle(mob: boolean): CSSProperties {
  return { ...budgetYearSelectStyle(mob), minWidth: mob ? 85 : 80 };
}

/** 예산 대비 실적 등 부모에서 연도가 고정일 때 읽기 전용 표시 */
export function budgetYearReadonlyStyle(mob: boolean): CSSProperties {
  return { ...budgetYearSelectStyle(mob), cursor: "default" };
}
