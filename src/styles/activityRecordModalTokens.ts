import type { CSSProperties } from "react";
import { APP_MODAL, appModalOverlayStyle } from "@/styles/appModalTokens";

const R = APP_MODAL.radius;

/**
 * 활동 기록 추가 모달 — 520×619
 * 외곽 4모서리: 동일한 원호 A 7 7 / 탭 안쪽 사선: 디자이너 원본 유지
 */
export const ACTIVITY_RECORD_FRAME_PATH =
  "M513,619 L7,619 A7,7 0 0,1 0,612 L0,7 A7,7 0 0,1 7,0 L196.423,0 C207.262,0.780 209.630,4.452 217.401,12.222 C225.171,19.993 239.145,35.874 244.100,40.828 C246.915,43.644 248.324,45.721 251.496,46.992 L505.996,46.992 L513,46.992 A7,7 0 0,1 520,53.992 L520,612 A7,7 0 0,1 513,619 Z";

export const ACTIVITY_RECORD_MODAL = {
  fontKR: APP_MODAL.fontKR,
  width: 520,
  height: 619,
  viewW: 520,
  viewH: 619,
  zIndex: APP_MODAL.zIndex,
  shadow: "drop-shadow(0 12px 48px rgba(17, 17, 26, 0.14))",
  radius: R,
  /** 헤더·우상단 쐐기 — 하얀 반투명 15% */
  glassLayerBg: "rgba(255, 255, 255, 0.15)",
  glassLayerBlur: null as string | null,
  /** 쐐기 영역이 어두워 보이지 않도록 오버레이를 약하게 */
  overlayBg: "rgba(0, 0, 0, 0.28)",
  glassLayerTop: -39,
  glassLayerHeight: 129,
  glassLayerRadius: R,
  padX: 20,
  headerShelfY: 47,
  headerPadTop: 16,
  titleSize: APP_MODAL.titleSize,
  titleWeight: APP_MODAL.titleWeight,
  titleColor: APP_MODAL.ink,
  subtitleSize: 14,
  subtitleWeight: 400,
  subtitleColor: "#9ca0a8",
  titleToSubtitle: 4,
  bodyPadTop: 14,
  bodyPadBottom: 22,
  fieldRowGap: 10,
  fieldToTextareaGap: 12,
  textareaToButtonsGap: 20,
  fieldHeight: APP_MODAL.inputHeight,
  fieldRadius: R,
  fieldBg: APP_MODAL.inputBg,
  fieldFontSize: APP_MODAL.inputFontSize,
  fieldColor: APP_MODAL.ink,
  fieldPlaceholder: "#a3a8b0",
  dateFlex: 1,
  categoryFlex: 1,
  textareaMinHeight: 200,
  textareaPad: 16,
  textareaBorder: "#e5e6ea",
  textareaFontSize: 15,
  textareaLineHeight: 1.55,
  dropdownItemHoverBg: "#f4f4f6",
  btnGap: APP_MODAL.btnGap,
  btnRadius: R,
  btnSubmitDisabledBg: "#b0b4bc",
} as const;

export function activityRecordShellStyle(): CSSProperties {
  return {
    position: "relative",
    width: ACTIVITY_RECORD_MODAL.width,
    maxWidth: "100%",
    height: ACTIVITY_RECORD_MODAL.height,
    flexShrink: 0,
    fontFamily: ACTIVITY_RECORD_MODAL.fontKR,
    overflow: "visible",
  };
}

export function activityRecordOverlayStyle(): CSSProperties {
  return {
    ...appModalOverlayStyle,
    background: ACTIVITY_RECORD_MODAL.overlayBg,
    zIndex: ACTIVITY_RECORD_MODAL.zIndex,
  };
}
