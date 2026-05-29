import type { LucideIcon } from "lucide-react";
import {
  Church,        // 예배
  Users,         // 소그룹
  Sparkles,      // 행사
  BookOpen,      // 교육
  CalendarHeart, // 절기
} from "lucide-react";

/** events.event_type 컬럼에 저장되는 값 */
export type EventCategoryCode =
  | "worship"
  | "smallgroup"
  | "event"
  | "education"
  | "holiday";

export interface EventCategory {
  code: EventCategoryCode;
  label: string;       // 한국어 표시명
  icon: LucideIcon;    // lucide 아이콘
  colorVar: string;    // CSS 변수 (배지/필터 칩 배경용)
  softVar: string;     // 연한 배경 변수 (셀 hover 등)
}

/**
 * 5종 카테고리 정의.
 * 색상은 globals.css의 시맨틱 토큰을 재활용하여 테마(orange/blue/green/purple)에
 * 자동 적응. 부서별 색상(departments.color)과 직교하는 분류축.
 */
export const EVENT_CATEGORIES: EventCategory[] = [
  {
    code: "worship",
    label: "예배",
    icon: Church,
    colorVar: "var(--color-info)",         // 파랑 계열
    softVar: "var(--pc-info-soft, #DBEAFE)",
  },
  {
    code: "smallgroup",
    label: "소그룹",
    icon: Users,
    colorVar: "var(--color-success)",      // 초록 계열
    softVar: "var(--pc-success-soft, #DCFCE7)",
  },
  {
    code: "event",
    label: "행사",
    icon: Sparkles,
    colorVar: "var(--color-primary)",      // 현재 테마 primary
    softVar: "var(--color-primary-soft)",
  },
  {
    code: "education",
    label: "교육",
    icon: BookOpen,
    colorVar: "var(--purple, #7c5ce0)",
    softVar: "var(--purple-light, #F3F0FF)",
  },
  {
    code: "holiday",
    label: "절기",
    icon: CalendarHeart,
    colorVar: "var(--color-danger)",       // 빨강 계열 (성탄/추수감사 등)
    softVar: "var(--pc-danger-soft, #FEE2E2)",
  },
];

/** code → 카테고리 객체 빠른 조회용 Map */
export const EVENT_CATEGORY_MAP: Record<EventCategoryCode, EventCategory> =
  EVENT_CATEGORIES.reduce((acc, c) => {
    acc[c.code] = c;
    return acc;
  }, {} as Record<EventCategoryCode, EventCategory>);

/** 알 수 없는 event_type 값에 대한 fallback */
export const DEFAULT_CATEGORY: EventCategory = EVENT_CATEGORIES[2]; // "행사"

/** 문자열 → 안전한 카테고리 lookup. 잘못된 값이면 DEFAULT_CATEGORY 반환. */
export function getEventCategory(code: string | null | undefined): EventCategory {
  if (!code) return DEFAULT_CATEGORY;
  return EVENT_CATEGORY_MAP[code as EventCategoryCode] ?? DEFAULT_CATEGORY;
}
