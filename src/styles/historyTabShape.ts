/**
 * 기도/메모 히스토리 — 탭 사선·곡률 (shelf 좌표, frameTabTopX=197 기준)
 *
 * 사선: 위 넓고 아래 좁은 \ (평행사변형)
 * 상단 곡률: 오른쪽 탭만 — 꼭짓점 (seamTopX,0)에서 topX로 arc (sweep=0, 아래로 파임)
 * 왼쪽 탭: 동일 사선 직선 (뾰족 꼭짓점)
 *
 * ⚠️ sweep=1이면 arc가 위로 튀어 흰색 돌기·배경 틈 발생 (1시간 버그 원인)
 */
const SHELF_Y = 47;
const LEFT_EDGE_BOTTOM_X = 54.496;

export const HISTORY_TAB_LAYOUT = {
  seamBottomX: 201.5,
  tabRowWidth: 323,
  seamTopX: 147,
  tabLeftWidth: 201.5,
  /** 오른쪽 탭 상단 꼭짓점→topX arc 반경 */
  seamFilletR: 3.5,
} as const;

/** 오른쪽 탭 shape path — radius = 모달 우상단 r7 */
export function historyTabRightShapePath(radius: number): string {
  const { seamBottomX, seamTopX, seamFilletR: r } = HISTORY_TAB_LAYOUT;
  const topX = seamTopX + r;
  return [
    `M${topX},0`,
    `L316,0`,
    `A${radius},${radius} 0 0 1 323,${radius}`,
    `L323,${SHELF_Y}`,
    `L${seamBottomX},${SHELF_Y}`,
    `L${seamTopX},0`,
    `A${r},${r} 0 0 0 ${topX},0`,
    "Z",
  ].join(" ");
}

/** 왼쪽 탭 오른쪽 경계 — 직선 사선 */
export function historyTabRightEdgePath(): string {
  const { seamBottomX, seamTopX } = HISTORY_TAB_LAYOUT;
  return `L${seamBottomX},${SHELF_Y} L${seamTopX},0`;
}

/** 오른쪽 탭 라벨·클릭 영역 시작 x */
export function historyTabRightAreaLeft(): number {
  const { seamTopX, seamBottomX } = HISTORY_TAB_LAYOUT;
  return (seamTopX + seamBottomX) / 2;
}

/** 왼쪽 탭 라벨 평행사변형 중심 보정 (px) */
export function historyTabLeftLabelOffset(): number {
  const { seamBottomX, seamTopX, tabLeftWidth } = HISTORY_TAB_LAYOUT;
  const centroidX = (0 + seamTopX + seamBottomX + LEFT_EDGE_BOTTOM_X) / 4;
  return centroidX - tabLeftWidth / 2;
}
