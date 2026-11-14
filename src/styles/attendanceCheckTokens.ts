/**
 * 목양 출석부(출석 체크) — 디자이너 1440 PNG 실측 토큰
 * 01_empty / 02_list / 03_pagination  (design/attendance)
 * 1440px = 1 CSS px. 이미지에 없는 값은 넣지 않는다.
 */

export const ATT_CHECK = {
  fontKR: "'Pretendard', 'Inter', system-ui, -apple-system, sans-serif",

  /** 콘텐츠 좌우 — PNG x264~1415, 사이드바 240 기준 24 */
  contentPadX: 24,

  pageBg: "#f4f4f6",
  ink: "#0b0c0e",
  muted: "#93969f",
  headerMuted: "#646977",
  headerName: "#606473",
  statsMuted: "#90939c",
  emptyValue: "#a0a5b1",
  placeholder: "#a0a5b1",

  /** 출석 체크 | 결석자 관리 */
  tabTrackBg: "#ebebef",
  tabActiveBg: "#ffffff",
  tabActiveText: "#0b0c0e",
  tabIdleText: "#8d909a",
  tabTrackHeight: 40,
  /** 01·02 PNG 실측 — 트랙 외곽 ≈ 4px, 활성 탭 ≈ 4px (기존 10은 과한 곡률) */
  tabTrackRadius: 4,
  tabActiveRadius: 4,
  tabInnerPad: 4,
  tabFontSize: 14,
  tabFontWeight: 600,
  tabGapBelow: 12,

  /** 검색 · 날짜 · 전체 출석 */
  toolbarGap: 16,
  searchHeight: 48,
  dateWidth: 186,
  markAllWidth: 132,
  markAllBg: "#0b0c0e",
  markAllText: "#f4f4f6",
  markAllIdleBg: "#ebebef",
  markAllIdleText: "#a0a5b1",
  markAllRadius: 7,
  markAllFontSize: 14,
  markAllFontWeight: 600,

  headerRowGap: 16,
  headerToCardGap: 4,
  headerFontSize: 14,
  headerFontWeight: 600,
  headerCurrentWeight: 700,
  headerMinHeight: 32,

  /** 카드 · 행 — 12행 × 52 = 624, PNG 카드 높이 628 */
  cardBg: "#ffffff",
  cardRadius: 12,
  rowHeight: 52,
  rowBorder: "#f0f1f3",
  gridPadX: 24,
  colTemplate: "129px 102px 191px 87px 95px minmax(240px, 1fr)",
  colMinWidth: 844,

  avatarSize: 32,
  avatarGap: 8,
  avatarBg: "#ebebef",
  avatarText: "#5c6170",
  avatarFontSize: 13,
  avatarFontWeight: 600,
  nameFontSize: 15,
  nameFontWeight: 700,
  nameText: "#0b0c0e",
  subText: "#93969f",
  subFontSize: 14,
  subFontWeight: 500,

  /** 지난주 점 8 / 금주 원 20 */
  lastDot: 8,
  thisDot: 20,
  present: "#5b7be6",
  absent: "#e0743c",
  unchecked: "#a0a5b1",

  reasonText: "#0b0c0e",
  reasonPlaceholder: "#c8cad0",
  reasonFontSize: 14,

  statsFontSize: 13,
  statsDot: 8,
  statsGap: 6,
  statsNumber: "#0b0c0e",
  statsNumberWeight: 700,

  emptyTitle: "#93969f",
  emptyFontSize: 14,
  emptyLineGap: 6,

  pagerGapTop: 12,
} as const;
