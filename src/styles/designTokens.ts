/**
 * 목양 탭과 동일한 UI 디자인 토큰 (PastoralPage C 상수 및 카드 스타일 통일)
 */
export const C = {
  bg: "#f8f7f4",
  card: "#ffffff",
  navy: "#1b2a4a",
  navyLight: "#2d4373",
  text: "#1b2a4a",
  textMuted: "#6b7b9e",
  textFaint: "#a0aec0",
  border: "#e8e6e1",
  borderLight: "#f0eeeb",
  blue: "#4361ee",
  blueBg: "#eef0ff",
  accent: "#4361ee",
  accentBg: "#eef0ff",
  success: "#06d6a0",
  successBg: "#e6faf3",
  danger: "#ef476f",
  dangerBg: "#fde8ed",
  warning: "#ffd166",
  purple: "#7209b7",
  purpleBg: "#f3e8ff",
  teal: "#118ab2",
  tealBg: "#e4f4fb",
} as const;

/** 요약 카드용 색상 (라벨, 서브텍스트에 사용) */
export const STAT_CARD_COLORS = {
  accent: C.accent,
  success: C.success,
  teal: C.teal,
  danger: C.danger,
  purple: C.purple,
} as const;
