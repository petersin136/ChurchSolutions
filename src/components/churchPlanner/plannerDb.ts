/** Supabase 테이블명 (교회 플래너) */
export const TB_DEPARTMENTS = "departments";
export const TB_PLACES = "places";
export const TB_EVENTS = "events";

export const COLOR_PRESETS = [
  "#1B2A4A",
  "#4A90D9",
  "#6C5CE7",
  "#A855F7",
  "#EC4899",
  "#EF4444",
  "#F59E0B",
  "#22C55E",
  "#14B8A6",
  "#3B82F6",
  "#6B7280",
  "#8B6914",
] as const;

export const DEFAULT_DEPARTMENT_SEED: { name: string; color: string; sort_order: number }[] = [
  { name: "담임목사실", color: "#1B2A4A", sort_order: 0 },
  { name: "장로회", color: "#8B6914", sort_order: 1 },
  { name: "교육부", color: "#4A90D9", sort_order: 2 },
  { name: "청년부", color: "#6C5CE7", sort_order: 3 },
  { name: "찬양팀", color: "#A855F7", sort_order: 4 },
  { name: "선교부", color: "#22C55E", sort_order: 5 },
  { name: "봉사부", color: "#F59E0B", sort_order: 6 },
  { name: "여전도회", color: "#EC4899", sort_order: 7 },
  { name: "남선교회", color: "#3B82F6", sort_order: 8 },
  { name: "새가족부", color: "#14B8A6", sort_order: 9 },
  { name: "행정/재정", color: "#6B7280", sort_order: 10 },
];

export const DEFAULT_PLACE_SEED: {
  name: string;
  capacity: number;
  equipment: string[];
  sort_order: number;
}[] = [
  { name: "본당", capacity: 500, equipment: ["빔프로젝터", "음향", "영상"], sort_order: 0 },
  { name: "소예배실", capacity: 80, equipment: ["빔프로젝터", "음향"], sort_order: 1 },
  { name: "교육관 1층", capacity: 60, equipment: ["빔프로젝터"], sort_order: 2 },
  { name: "교육관 2층", capacity: 60, equipment: ["빔프로젝터"], sort_order: 3 },
  { name: "친교실", capacity: 100, equipment: [], sort_order: 4 },
  { name: "회의실", capacity: 20, equipment: ["모니터"], sort_order: 5 },
];
