export interface Settings {
  churchName: string;
  depts: string;
  fiscalStart: string;
  /** 목장 목록 (쉼표 구분). 비어 있으면 성도 데이터에서 자동 추출 */
  mokjangList?: string;
  /** 기부금 영수증용: 소재지 */
  address?: string;
  /** 기부금 영수증용: 담임목사 성함 */
  pastor?: string;
  /** 기부금 영수증용: 사업자등록번호(고유번호) */
  businessNumber?: string;
}

export interface Member {
  id: string;
  name: string;
  dept?: string;
  role?: string;
  birth?: string;
  gender?: string;
  phone?: string;
  address?: string;
  family?: string;
  status?: string;
  source?: string;
  prayer?: string;
  memo?: string;
  group?: string;
  photo?: string;
  createdAt?: string;
}

export type AttStatus = "p" | "a" | "n";

export interface Note {
  date: string;
  type: "memo" | "prayer" | "visit" | "event";
  content: string;
  createdAt: string;
}

export interface Plan {
  id: string;
  title: string;
  date: string;
  time?: string;
  cat: string;
  memo?: string;
}

export interface Sermon {
  id: string;
  date: string;
  service: string;
  text?: string;
  title?: string;
  core?: string;
  status: string;
  notes?: string;
}

export interface Visit {
  id: string;
  date: string;
  memberId: string;
  type: string;
  content: string;
}

export interface Income {
  id: string;
  date: string;
  type: string;
  amount: number;
  donor?: string;
  method?: string;
  memo?: string;
}

export interface Expense {
  id: string;
  date: string;
  category: string;
  item?: string;
  amount: number;
  resolution?: string;
  memo?: string;
}

export interface ChecklistItem {
  text: string;
  done: boolean;
}

export interface DB {
  settings: Settings;
  members: Member[];
  attendance: Record<string, Record<number, AttStatus>>;
  /** 결석 사유: memberId -> weekNum -> 사유 텍스트 */
  attendanceReasons?: Record<string, Record<number, string>>;
  notes: Record<string, Note[]>;
  /** 기도 응답됨 키 목록 (타임라인/프로필 기도 구분용) */
  answeredPrayerKeys?: string[];
  plans: Plan[];
  sermons: Sermon[];
  visits: Visit[];
  income: Income[];
  expense: Expense[];
  budget: Record<string, number>;
  checklist: Record<string, ChecklistItem[]>;
}

export const DEFAULT_SETTINGS: Settings = {
  churchName: "",
  depts: "유아부,유치부,유년부,초등부,중등부,고등부,청년부,장년부",
  fiscalStart: "1",
  mokjangList: "",
  address: "",
  pastor: "",
  businessNumber: "",
};

export const DEFAULT_DB: DB = {
  settings: { ...DEFAULT_SETTINGS },
  members: [],
  attendance: {},
  attendanceReasons: {},
  notes: {},
  answeredPrayerKeys: [],
  plans: [],
  sermons: [],
  visits: [],
  income: [],
  expense: [],
  budget: {},
  checklist: {},
};

/** 시드/샘플 자동 생성 비활성화 — 호출 시 빈 DB 반환 (더미 데이터 생성 안 함) */
export function buildSampleDB(): DB {
  return { ...DEFAULT_DB };
}


/** 주일헌금, 십일조, 감사헌금, 건축헌금, 선교헌금, 기타 — 재정/Modals와 동기화 */
export const CATS_INCOME: { id: string; name: string }[] = [
  { id: "sunday", name: "주일헌금" },
  { id: "tithe", name: "십일조" },
  { id: "thanks", name: "감사헌금" },
  { id: "building", name: "건축헌금" },
  { id: "mission", name: "선교헌금" },
  { id: "other", name: "기타" },
];
export const CATS_EXPENSE = [
  "인건비",
  "선교비",
  "교육비",
  "시설관리비",
  "사무비",
  "행사비",
  "구제비",
  "기타",
];
export const PLAN_CATS: Record<string, string> = {
  "예배/설교": "c-purple",
  "심방/상담": "c-blue",
  "회의/행정": "c-gray",
  "행사/교육": "c-green",
  "개인/경건": "c-orange",
};
export const SERMON_STATUS_COLORS: Record<string, string> = {
  구상중: "badge-gray",
  본문연구: "badge-blue",
  초고작성: "badge-orange",
  수정중: "badge-purple",
  완료: "badge-green",
};
export const DEFAULT_CHECKLIST = [
  "주보 내용 확인",
  "찬양 곡 선정 확인",
  "교사 배치 확인",
  "새가족 환영 준비",
  "봉사자 배치 확인",
  "설교 최종 점검",
  "기도제목 정리",
  "심방 일정 확인",
];
