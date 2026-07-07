/**
 * 조직/자원관리 — 디자이너 시안 토큰 (1440px 기준)
 * 카드: 시안 대비 180% (225% × 80%) · 탭은 컴팩트 유지
 */
const CARD_S = 1.8;
/** 편집·삭제 버튼만 카드 대비 70% */
const ICON_BTN_S = 0.7;
/** 카드 내 텍스트 80% */
const CARD_TEXT_S = 0.8;

export const ORG_RESOURCE = {
  bg: "#f4f4f6",
  fontKR: "'Pretendard', system-ui, -apple-system, sans-serif",
  fontLatin: "'Inter', 'Pretendard', system-ui, -apple-system, sans-serif",
  padTop: 32,
  padLeft: 40,
  padRight: 24,
  padBottom: 24,
  /** 세그먼트 탭 */
  segBg: "#e9e9eb",
  segPad: 4,
  segRadius: 10,
  segGap: 2,
  segTabPadX: 26,
  segTabPadY: 9,
  segTabRadius: 8,
  segTabActiveBg: "#ffffff",
  segTabActiveColor: "#0b0c0e",
  segTabInactiveColor: "#8b909a",
  segTabFontSize: 15,
  segTabFontWeight: 600,
  segTabActiveFontWeight: 700,
  segTabActiveShadow: "0 1px 3px rgba(0,0,0,0.06)",
  segTabHoverBg: "rgba(255,255,255,0.72)",
  segTabHoverColor: "#3d424a",
  segTabHoverShadow: "0 1px 2px rgba(0,0,0,0.05)",
  segToGridGap: 24,
  /** 카드 — 가로 직사각형 */
  cardWidth: Math.round(176 * CARD_S),
  cardHeight: Math.round(110 * CARD_S),
  cardRadius: 10,
  cardPadX: Math.round(14 * CARD_S),
  cardPadY: Math.round(12 * CARD_S),
  gridGap: Math.round(16 * CARD_S),
  cardNeutralBg: "#ffffff",
  cardNeutralShadow: "0 1px 4px rgba(0,0,0,0.05)",
  cardTitleSize: Math.round(16 * CARD_S * CARD_TEXT_S),
  cardTitleWeight: 700,
  cardSubtitleSize: Math.round(13 * CARD_S * CARD_TEXT_S),
  cardSubtitleWeight: 400,
  cardSubtitleColor: "#6b7280",
  cardInk: "#0b0c0e",
  cardCountNumSize: Math.round(40 * CARD_S * CARD_TEXT_S),
  cardCountUnitSize: Math.round(18 * CARD_S * CARD_TEXT_S),
  cardCountWeight: 700,
  cardIconBtnSize: Math.round(30 * CARD_S * ICON_BTN_S),
  cardIconBtnRadius: Math.round(7 * CARD_S * ICON_BTN_S),
  cardActionIconSize: Math.round(14 * CARD_S * ICON_BTN_S),
  cardIconBtnNeutralBg: "#ebebed",
  /** 추가 카드 */
  addCardBg: "#eceef1",
  addCardBgHover: "#ffffff",
  addCardBorder: "#ffffff",
  addCardBorderWidth: Math.round(2 * CARD_S),
  addIconBoxSize: Math.round(36 * CARD_S),
  addIconBoxRadius: Math.round(8 * CARD_S),
  addIconBoxBg: "#e3e4e8",
  addIconBoxBgHover: "#f4f4f6",
  addIconColor: "#9ca3af",
  addIconColorHover: "#6b7280",
  addIconSize: Math.round(20 * CARD_S),
  addLabelSize: Math.round(13 * CARD_S),
  addLabelColor: "#9ca3af",
  addLabelColorHover: "#6b7280",
  addLabelWeight: 500,
  /** 모달 */
  modalWidth: 460,
  modalWizardHeight: 580,
  modalMemberListHeight: 180,
  modalPad: 28,
  modalRadius: 14,
  modalTitleSize: 18,
  modalTitleWeight: 700,
  modalInputBg: "#f4f4f6",
  modalInputHeight: 48,
  modalInputRadius: 8,
  modalInputFontSize: 15,
  modalBtnHeight: 48,
  modalBtnRadius: 8,
  modalBtnGap: 10,
  modalDeleteRed: "#e55c5c",
  /** 부서 편집 모달 — 시안 01~05 */
  deptModalWidth: 460,
  deptModalHeight: 580,
  deptModalMemberAreaMinHeight: 248,
  deptModalMemberRowHeight: 44,
  deptModalSearchDropdownMaxHeight: 176,
  deptModalLabelSize: 14,
  deptModalLabelWeight: 600,
  deptModalLabelColor: "#0b0c0e",
  deptModalEmptySize: 14,
  deptModalEmptySubSize: 13,
  deptModalEmptyColor: "#8b909a",
  deptModalEmptySubColor: "#b0b4bc",
  deptModalMemberNameSize: 15,
  deptModalMemberNameWeight: 600,
  deptModalMemberMetaSize: 14,
  deptModalMemberMetaColor: "#8b909a",
  deptModalStarSize: 18,
  deptModalDeleteBtnSize: 32,
  deptModalDeleteHoverBg: "#ebebed",
  deptModalSearchDropdownHoverBg: "#f4f4f6",
  deptModalTitleToInputGap: 20,
  deptModalInputToLabelGap: 20,
  deptModalLabelToListGap: 12,
  deptModalListToSearchGap: 16,
  deptModalSearchToFooterGap: 20,
  /** 장소 관리 — 시안 01~11 */
  placeGridGap: Math.round(16 * CARD_S),
  placeCardMinHeight: Math.round(110 * CARD_S),
  placeCardHoverBg: "#e3edff",
  /** 첫 번째 장소(본당) 기본 하이라이트 */
  placeCardHighlightBg: "#e6f0ff",
  placeCardDefaultBg: "#ffffff",
  placeCardDefaultShadow: "0 1px 4px rgba(0,0,0,0.05)",
  placeEquipmentSize: Math.round(13 * CARD_S * CARD_TEXT_S),
  placeEquipmentColor: "#0b0c0e",
  placeCapacityLabelSize: Math.round(13 * CARD_S * CARD_TEXT_S),
  placeCapacityNumSize: Math.round(40 * CARD_S * CARD_TEXT_S),
  placeCapacityUnitSize: Math.round(18 * CARD_S * CARD_TEXT_S),
  placeIconBtnBg: "#d4e3ff",
  placeEmptyMinHeight: Math.round(110 * CARD_S * 2 + 16 * CARD_S),
  placeEmptyBg: "#eceef1",
  placeEmptyBgHover: "#ffffff",
  placeEmptyBorder: "#ffffff",
  placeEmptyBorderWidth: Math.round(2 * CARD_S),
  placeCheckboxSize: 18,
  placeCheckboxGap: 10,
  placeCheckboxRowGap: 12,
} as const;

/** 장소 장비 — 시안 체크리스트 (03·04·10) */
export const ORG_PLACE_EQUIPMENT = [
  "음향 장비",
  "영상 스크린",
  "건반 악기",
  "와이파이",
] as const;

export type OrgPlaceEquipment = (typeof ORG_PLACE_EQUIPMENT)[number];

export function formatPlaceEquipment(equipment?: string[] | null): string {
  if (!equipment?.length) return "";
  const known = ORG_PLACE_EQUIPMENT.filter((x) => equipment.includes(x));
  const extra = equipment.filter((x) => !ORG_PLACE_EQUIPMENT.includes(x as OrgPlaceEquipment));
  return [...known, ...extra].join(" / ");
}

/** 1·6·11·16… 번째 컬러 — 시안 (라임·핑크 등) */
export const ORG_SLOT_COLORS = [
  "#D9E021",
  "#F080F0",
  "#B8E986",
  "#7EC8E3",
  "#FFD966",
  "#C7B2FF",
] as const;

export function orgIsColoredSlot(index: number): boolean {
  return index % 5 === 0;
}

export function orgSlotColorIndex(index: number): number {
  return Math.floor(index / 5) % ORG_SLOT_COLORS.length;
}

export function orgSlotColor(index: number): string {
  return ORG_SLOT_COLORS[orgSlotColorIndex(index)];
}

export function orgShadeHex(hex: string, factor = 0.82): string {
  const h = hex.replace("#", "");
  if (h.length !== 6) return hex;
  const r = Math.round(parseInt(h.slice(0, 2), 16) * factor);
  const g = Math.round(parseInt(h.slice(2, 4), 16) * factor);
  const b = Math.round(parseInt(h.slice(4, 6), 16) * factor);
  return `#${[r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("")}`;
}
