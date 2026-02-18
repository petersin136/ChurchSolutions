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
  mokjang?: string;
  photo?: string;
  created_at?: string;
  updated_at?: string;
  /** @deprecated use created_at — 하위호환 */
  createdAt?: string;

  // 새가족 관련
  is_new_family?: boolean;
  first_visit_date?: string;
  visit_path?: "지인소개" | "전도" | "자진방문" | "이전교회" | "기타";
  referrer_id?: string;
  referrer_name?: string;
  /** @deprecated use first_visit_date */
  firstVisitDate?: string;
  /** @deprecated use visit_path */
  visitPath?: string;

  // 가족 관계
  family_id?: string;
  family_relation?: "본인" | "배우자" | "자녀" | "부모" | "형제" | "기타";

  // 상태 관리
  member_status?: "활동" | "휴적" | "은퇴" | "별세" | "이적" | "제적" | "미등록";
  status_changed_at?: string;
  status_reason?: string;

  // 추가 인적사항
  email?: string;
  job?: string;
  baptism_date?: string;
  baptism_type?: "유아세례" | "세례" | "입교" | "미세례";
  wedding_anniversary?: string;
  registered_date?: string;
  small_group?: string;
  talent?: string;
  is_prospect?: boolean;
}

export interface MemberStatusHistory {
  id: string;
  member_id: string;
  previous_status?: string;
  new_status: string;
  changed_at: string;
  reason?: string;
  changed_by?: string;
}

export interface Family {
  id: string;
  family_name: string;
  created_at: string;
}

/** 정착 프로그램 4주 과정 (new_family_program) */
export interface NewFamilyProgram {
  id: string;
  member_id: string;
  mentor_id: string | null;
  program_start_date: string;
  week1_completed: boolean;
  week1_date: string | null;
  week1_note: string | null;
  week2_completed: boolean;
  week2_date: string | null;
  week2_note: string | null;
  week3_completed: boolean;
  week3_date: string | null;
  week3_note: string | null;
  week4_completed: boolean;
  week4_date: string | null;
  week4_note: string | null;
  status: "진행중" | "수료" | "중단";
  cell_group_assigned: string | null;
  created_at?: string;
}

export type AttStatus = "p" | "a" | "n";

/** 날짜+예배별 출결 (Phase 3) */
export interface Attendance {
  id: string;
  member_id: string;
  date: string;
  status: "출석" | "온라인" | "결석" | "병결" | "기타";
  service_type?: string;
  check_in_time?: string;
  check_in_method?: "수동" | "QR" | "앱";
  note?: string;
  checked_by?: string;
  created_at?: string;
}

export interface ServiceType {
  id: string;
  church_id?: string;
  name: string;
  day_of_week?: number;
  default_time?: string;
  is_active: boolean;
  sort_order: number;
  created_at?: string;
}

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
  member_id?: string;
  sub_category?: string;
  payment_method?: "현금" | "계좌이체" | "카드" | "온라인" | "기타";
  receipt_issued?: boolean;
  fiscal_year?: string;
  month?: number;
}

export interface Expense {
  id: string;
  date: string;
  category: string;
  item?: string;
  amount: number;
  resolution?: string;
  memo?: string;
  sub_category?: string;
  payment_method?: "현금" | "계좌이체" | "카드" | "기타";
  approved_by?: string;
  receipt_attachment?: string;
  fiscal_year?: string;
  month?: number;
}

export interface Budget {
  id: string;
  church_id?: string;
  fiscal_year: string;
  category_type: "수입" | "지출";
  category: string;
  sub_category?: string;
  monthly_amounts: { [month: string]: number };
  annual_total: number;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface SpecialAccount {
  id: string;
  church_id?: string;
  account_name: string;
  description?: string;
  target_amount: number;
  current_amount: number;
  start_date?: string;
  end_date?: string;
  status: "진행중" | "달성" | "종료" | "보류";
  created_at?: string;
  updated_at?: string;
}

export interface SpecialAccountTransaction {
  id: string;
  account_id: string;
  date: string;
  type: "수입" | "지출";
  amount: number;
  description?: string;
  member_name?: string;
  created_at?: string;
}

export interface CashJournalEntry {
  id: string;
  date: string;
  type: "수입" | "지출";
  category: string;
  sub_category?: string;
  description: string;
  amount: number;
  payment_method?: string;
  memo?: string;
  fiscal_year?: string;
  month?: number;
  created_at?: string;
}

export interface ChecklistItem {
  text: string;
  done: boolean;
}

/** 기부금영수증 발급 이력 (주민등록번호 없음) */
export interface DonationReceipt {
  id: string;
  church_id: string;
  member_id: string | null;
  member_name: string;
  receipt_number: string;
  tax_year: number;
  issue_date: string;
  total_amount: number;
  donation_details: { category: string; amount: number }[];
  church_name: string;
  church_address: string | null;
  church_tel: string | null;
  church_representative: string | null;
  status: "발급완료" | "취소";
  cancelled_at: string | null;
  cancel_reason: string | null;
  created_at?: string;
  created_by?: string | null;
}

/** 교회 직인/기부금영수증 설정 */
export interface ChurchSettings {
  id: string;
  church_id: string;
  seal_image_url: string | null;
  representative_name: string | null;
  church_registration_number: string | null;
  church_address?: string | null;
  church_tel?: string | null;
  updated_at?: string;
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
  /** 새가족 정착 프로그램 (4주 과정) */
  newFamilyPrograms?: NewFamilyProgram[];
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
  newFamilyPrograms: [],
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
