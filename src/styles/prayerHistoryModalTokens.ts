import type { CSSProperties } from "react";
import { APP_MODAL } from "@/styles/appModalTokens";
import {
  ACTIVITY_RECORD_FRAME_PATH,
  activityRecordOverlayStyle,
  activityRecordShellStyle,
} from "@/styles/activityRecordModalTokens";

const R = APP_MODAL.radius;

/** 흰 프레임 — 활동 기록과 동일 (520×619, 좌측 탭 + 우측 shelf) */
export const PRAYER_HISTORY_FRAME_PATH = ACTIVITY_RECORD_FRAME_PATH;
export const prayerHistoryShellStyle = activityRecordShellStyle;
export const prayerHistoryOverlayStyle = activityRecordOverlayStyle;

/**
 * 기도 히스토리 모달 토큰
 *
 * SVG 프레임 기준 좌표:
 * - 좌측 흰 탭 상단: y=0, x≈0~197
 * - 사선으로 shelf 시작: (197,0) → (251,47)
 * - shelf 높이: 47
 * - 우상단 outer radius: 7
 */
export const PRAYER_HISTORY_MODAL = {
  fontKR: APP_MODAL.fontKR,
  width: 520,
  height: 619,
  viewW: 520,
  viewH: 619,
  zIndex: APP_MODAL.zIndex,
  shadow: "drop-shadow(0 12px 48px rgba(17, 17, 26, 0.14))",
  radius: R,
  glassLayerBg: "rgba(255, 255, 255, 0.15)",
  glassLayerTop: -39,
  glassLayerHeight: 129,
  glassLayerRadius: R,
  padX: 20,
  /** shelf / 탭 높이 (SVG y=47) */
  headerShelfY: 47,
  /** 제목+성도명까지 포함한 고정 헤더 높이 (스크롤과 겹침 방지) */
  headerBlockHeight: 72,
  headerPadTop: 14,
  /** 흰색 탭 오른쪽 끝·사선 시작 (상단) */
  frameTabTopX: 197,
  /** shelf 시작 x */
  frameShelfX: 251,
  /**
   * 기도중 왼쪽 경계 — 디자이너 SVG와 동일 베지어
   * (절대좌표 197→251,y=0→47 을 frameTabTopX=197 기준 상대좌표로 변환)
   * 상·하단 접합부에 완만한 곡률
   */
  prayingLeftEdgePath:
    "M0,0 C10.262,0.78 12.63,4.452 20.401,12.222 C28.171,19.993 42.145,35.874 47.1,40.828 C49.915,43.644 51.324,45.721 54.496,46.992",
  /** 기도중 | 응답완료 수직 구분선 */
  tabSplitX: 385,
  titleSize: APP_MODAL.titleSize,
  titleWeight: APP_MODAL.titleWeight,
  titleColor: APP_MODAL.ink,
  subtitleSize: 14,
  subtitleWeight: 400,
  subtitleColor: "#9ca0a8",
  titleToSubtitle: 4,
  /** 고정 헤더(제목+성도명) 아래 본문 시작 여백 */
  bodyPadTop: 16,
  bodyPadBottom: 28,
  /** 시안: 기도중 연한 그레이 / 응답완료 진한 그레이 */
  tabPrayingBg: "#ececef",
  tabAnsweredBg: "#c8cad0",
  tabPrayingText: "#a0a3ab",
  tabAnsweredText: "#5a5e66",
  tabFontSize: 14,
  tabFontWeight: 600,
  timelineWidth: 22,
  timelineDot: "#d4d6db",
  checkBorder: "#d1d5db",
  /** 응답완료 액센트 — 세련된 붉은 계열 (펄 베이스) */
  answeredAccent: "#B85652",
  answeredAccentDark: "#9A4542",
  checkAnsweredBg: "#C05A55",
  cardRadius: R,
  /** 흰 창 안쪽 곡률 — 바깥 틀보다 살짝 작게 */
  cardInnerRadius: Math.max(R - 2, 4),
  /** 회색 틀 ↔ 흰 창 사이 얇은 베젤 */
  cardBezel: 2,
  cardHeaderBg: "#e8eaee",
  cardHeaderPadY: 10,
  cardHeaderPadX: 12,
  cardHeaderAnsweredBg: "#C05A55",
  cardHeaderAnsweredText: "#ffffff",
  cardBodyBg: "#ffffff",
  cardBodyBorder: "#e5e6ea",
  cardBodyAnsweredBg: "#FBF6F5",
  cardBodyAnsweredBorder: "#E6C8C5",
  cardBodyPadY: 14,
  cardBodyPadX: 14,
  cardDateFontSize: 13,
  cardDateFontWeight: 600,
  cardContentFontSize: 14,
  cardContentLineHeight: 1.55,
  cardContentColor: APP_MODAL.ink,
  cardGap: 14,
  iconMuted: "#9ca0a8",
  iconHover: APP_MODAL.ink,
  /** 응답완료 탭 — 대댓글 연결선 (검정 ㄱ자 화살표) */
  commentLabel: "응답 내용",
  commentLabelColor: "#B85652",
  replyThreadLine: "#111111",
  replyThreadArrow: "#111111",
  replyConnectorWidth: 31,
  replyConnectorHeight: 28,
  replyUsernameColor: "#262626",
  replyMetaColor: "#8e8e8e",
  replyTextColor: "#262626",
  replyActionColor: "#8e8e8e",
  replyActionHover: "#B85652",
  replyInputBg: "#f7f7f8",
  replyInputBorder: "#ebebeb",
  replyInputFocusBorder: "#B85652",
  replyInputRadius: 7,
  replyPostBtnBg: "#C05A55",
  replyPostBtnText: "#ffffff",
  replyPostBtnMuted: "#DFA8A4",
  commentPlaceholder: "응답이 어떻게 이루어졌는지 남겨 주세요",
  commentEmptyHint: "#9ca0a8",
  /** @deprecated 레거시 — reply 스레드로 대체 */
  commentBubbleBg: "#ffffff",
  commentBubbleBorder: "#E6C8C5",
  commentInputBg: "#ffffff",
  commentInputBorder: "#E6C8C5",
  commentBtnBg: "#C05A55",
  commentBtnText: "#ffffff",
} as const;

/** 응답완료/중요 — 세련된 붉은 펄 (단색 베이스 + 스페큘러 하이라이트) */
export function answeredPearlStyle(compact = false): CSSProperties {
  const base = compact ? "#C05E59" : "#B85652";
  const highlights = compact
    ? [
        "radial-gradient(ellipse 85% 75% at 30% 20%, rgba(255,255,255,0.72) 0%, transparent 54%)",
        "radial-gradient(ellipse 65% 55% at 78% 85%, rgba(255,200,195,0.28) 0%, transparent 50%)",
        "linear-gradient(180deg, rgba(255,255,255,0.28) 0%, transparent 20%, transparent 80%, rgba(0,0,0,0.1) 100%)",
      ]
    : [
        "radial-gradient(ellipse 50% 85% at 14% 10%, rgba(255,255,255,0.65) 0%, transparent 52%)",
        "radial-gradient(ellipse 38% 55% at 72% 18%, rgba(255,255,255,0.24) 0%, transparent 58%)",
        "radial-gradient(ellipse 42% 65% at 86% 90%, rgba(220,140,135,0.22) 0%, transparent 48%)",
        "linear-gradient(180deg, rgba(255,255,255,0.22) 0%, transparent 16%, transparent 84%, rgba(0,0,0,0.09) 100%)",
      ];

  return {
    backgroundColor: base,
    backgroundImage: highlights.join(", "),
    border: compact
      ? "1px solid rgba(255,255,255,0.28)"
      : "1px solid rgba(255,255,255,0.22)",
    boxShadow: compact
      ? "inset 0 1.5px 0 rgba(255,255,255,0.7), inset 0 -1px 0 rgba(0,0,0,0.14), 0 1px 2px rgba(0,0,0,0.06)"
      : "inset 0 2px 0 rgba(255,255,255,0.5), inset 0 -1.5px 0 rgba(0,0,0,0.11), 0 2px 8px rgba(184,86,82,0.14)",
  };
}

export function prayerTabLabelStyle(kind: "praying" | "answered"): CSSProperties {
  const activeLook = kind === "praying";
  return {
    border: "none",
    padding: 0,
    margin: 0,
    cursor: "pointer",
    fontSize: PRAYER_HISTORY_MODAL.tabFontSize,
    fontWeight: PRAYER_HISTORY_MODAL.tabFontWeight,
    fontFamily: PRAYER_HISTORY_MODAL.fontKR,
    color: activeLook ? PRAYER_HISTORY_MODAL.tabPrayingText : PRAYER_HISTORY_MODAL.tabAnsweredText,
    background: "transparent",
    whiteSpace: "nowrap",
  };
}
