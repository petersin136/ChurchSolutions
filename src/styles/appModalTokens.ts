import type { CSSProperties } from "react";

/**
 * 앱 전역 모달 — 조직/자원관리 시안 기준 (위치·크기·톤 통일)
 */
export const APP_MODAL = {
  width: 540,
  tallHeight: 580,
  wizardHeight: 630,
  padding: 30,
  radius: 10,
  /** 값↑ = 카드 더 아래 */
  cardMarginTop: "14vh",
  zIndex: 1200,
  titleSize: 18,
  titleWeight: 700,
  fontKR: "'Pretendard', system-ui, -apple-system, sans-serif",
  cardBg: "#ffffff",
  cardBorder: "1px solid rgba(0,0,0,0.03)",
  cardShadow: "0 2px 12px rgba(17,17,26,0.05)",
  ink: "#0b0c0e",
  muted: "#6b7280",
  labelMuted: "#8b909a",
  inputBg: "#f4f4f6",
  inputHeight: 48,
  inputRadius: 8,
  inputFontSize: 15,
  btnHeight: 48,
  btnRadius: 8,
  btnGap: 10,
  deleteRed: "#e55c5c",
  overlayBg: "rgba(0, 0, 0, 0.4)",
  maxBodyHeight: "min(85vh, 720px)",
} as const;

export const appModalOverlayStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: APP_MODAL.zIndex,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "flex-start",
  paddingTop: APP_MODAL.cardMarginTop,
  paddingLeft: 16,
  paddingRight: 16,
  paddingBottom: 24,
  boxSizing: "border-box",
  background: APP_MODAL.overlayBg,
  backdropFilter: "blur(6px)",
  WebkitBackdropFilter: "blur(6px)",
  overflow: "auto",
};

export function appModalCardStyle(opts?: {
  width?: number;
  height?: number;
  maxHeight?: string;
}): CSSProperties {
  const w = opts?.width ?? APP_MODAL.width;
  const h = opts?.height;
  return {
    width: w,
    maxWidth: "100%",
    ...(h != null
      ? { height: h, minHeight: h, maxHeight: h }
      : { maxHeight: opts?.maxHeight ?? APP_MODAL.maxBodyHeight }),
    padding: APP_MODAL.padding,
    borderRadius: APP_MODAL.radius,
    background: APP_MODAL.cardBg,
    border: APP_MODAL.cardBorder,
    boxShadow: APP_MODAL.cardShadow,
    fontFamily: APP_MODAL.fontKR,
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    flexShrink: 0,
    transform: "none",
  };
}

export const appModalBtnCancel: CSSProperties = {
  flex: 1,
  height: APP_MODAL.btnHeight,
  borderRadius: APP_MODAL.btnRadius,
  border: "1px solid #e3e4e8",
  background: "#ffffff",
  color: APP_MODAL.ink,
  fontSize: 15,
  fontWeight: 600,
  fontFamily: APP_MODAL.fontKR,
  cursor: "pointer",
};

export const appModalBtnSubmit: CSSProperties = {
  flex: 1,
  height: APP_MODAL.btnHeight,
  borderRadius: APP_MODAL.btnRadius,
  border: "none",
  background: APP_MODAL.ink,
  color: "#ffffff",
  fontSize: 15,
  fontWeight: 600,
  fontFamily: APP_MODAL.fontKR,
  cursor: "pointer",
};

export const appModalBtnRow: CSSProperties = {
  display: "flex",
  gap: APP_MODAL.btnGap,
  flexShrink: 0,
};

export const appModalInputStyle: CSSProperties = {
  width: "100%",
  height: APP_MODAL.inputHeight,
  padding: "0 16px",
  boxSizing: "border-box",
  border: "none",
  borderRadius: APP_MODAL.inputRadius,
  background: APP_MODAL.inputBg,
  fontSize: APP_MODAL.inputFontSize,
  fontFamily: APP_MODAL.fontKR,
  color: APP_MODAL.ink,
  outline: "none",
};
