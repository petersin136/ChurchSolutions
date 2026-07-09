import { APP_MODAL } from "@/styles/appModalTokens";
import {
  ACTIVITY_RECORD_FRAME_PATH,
  activityRecordOverlayStyle,
  activityRecordShellStyle,
} from "@/styles/activityRecordModalTokens";
import { PRAYER_HISTORY_MODAL } from "@/styles/prayerHistoryModalTokens";
import {
  historyTabLeftLabelOffset,
  historyTabRightAreaLeft,
} from "@/styles/historyTabShape";

export { answeredPearlStyle as memoImportantPearlStyle } from "@/styles/prayerHistoryModalTokens";

const R = APP_MODAL.radius;

/** 흰 프레임 — 기도 히스토리 / 활동 기록과 동일 */
export const MEMO_HISTORY_FRAME_PATH = ACTIVITY_RECORD_FRAME_PATH;
export const memoHistoryShellStyle = activityRecordShellStyle;
export const memoHistoryOverlayStyle = activityRecordOverlayStyle;

/**
 * 메모 히스토리 모달 토큰
 * 레이아웃·프레임은 기도 히스토리와 동일, 탭만 일반/중요
 */
export const MEMO_HISTORY_MODAL = {
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
  headerShelfY: 47,
  headerBlockHeight: 72,
  headerPadTop: 14,
  frameTabTopX: 197,
  frameShelfX: 251,
  generalLeftEdgePath:
    "M0,0 C10.262,0.78 12.63,4.452 20.401,12.222 C28.171,19.993 42.145,35.874 47.1,40.828 C49.915,43.644 51.324,45.721 54.496,46.992",
  tabSplitX: 385,
  titleSize: APP_MODAL.titleSize,
  titleWeight: APP_MODAL.titleWeight,
  titleColor: APP_MODAL.ink,
  subtitleSize: 14,
  subtitleWeight: 400,
  subtitleColor: "#9ca0a8",
  titleToSubtitle: 4,
  bodyPadTop: 16,
  bodyPadBottom: 28,
  /** 일반 탭(연한) / 중요 탭(진한) — 디자이너 판 색 */
  tabGeneralBg: "#f4f4f6",
  tabImportantBg: "#d3d5db",
  /** 왼쪽 탭 오른쪽 사선 (frameTabTopX 기준, 폭 188) */
  tabLeftWidth: PRAYER_HISTORY_MODAL.tabLeftWidth,
  tabRowWidth: PRAYER_HISTORY_MODAL.tabRowWidth,
  tabRightAreaLeft: historyTabRightAreaLeft(),
  tabLeftLabelOffset: historyTabLeftLabelOffset(),
  tabMutedText: "#a0a3ab",
  tabActiveText: "#5a5e66",
  tabFontSize: 14,
  tabFontWeight: 600,
  timelineWidth: 26,
  timelineDot: "#d4d6db",
  nodeBorder: "#d1d5db",
  nodeBg: "#ffffff",
  nodeIcon: "#9ca0a8",
  pinBorder: "#e55c5c",
  pinBg: "#fff0f0",
  pinIcon: "#e55c5c",
  pinRadius: 6,
  checkBorder: PRAYER_HISTORY_MODAL.checkBorder,
  importantAccent: PRAYER_HISTORY_MODAL.answeredAccent,
  importantCheckBg: PRAYER_HISTORY_MODAL.checkAnsweredBg,
  cardRadius: R,
  cardInnerRadius: Math.max(R - 2, 4),
  cardBezel: 2,
  cardHeaderBg: "#e8eaee",
  cardHeaderPadY: 10,
  cardHeaderPadX: 12,
  cardHeaderImportantText: PRAYER_HISTORY_MODAL.cardHeaderAnsweredText,
  cardBodyBg: "#ffffff",
  cardBodyBorder: "#e5e6ea",
  cardBodyImportantBg: PRAYER_HISTORY_MODAL.cardBodyAnsweredBg,
  cardBodyImportantBorder: PRAYER_HISTORY_MODAL.cardBodyAnsweredBorder,
  cardBodyPadY: 14,
  cardBodyPadX: 14,
  cardDateFontSize: 13,
  cardDateFontWeight: 600,
  cardContentFontSize: 14,
  cardContentLineHeight: 1.55,
  cardContentColor: APP_MODAL.ink,
  cardGap: 14,
  iconMuted: "#9ca0a8",
} as const;
