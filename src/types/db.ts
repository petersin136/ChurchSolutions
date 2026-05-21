export interface Settings {
  churchName: string;
  depts: string;
  fiscalStart: string;
  /** 교단 (예: 침례교, 장로교). 침례교면 증서에 '침례' 표기, 그 외 '세례' */
  denomination?: string;
  /** 목장 목록 (쉼표 구분). 비어 있으면 성도 데이터에서 자동 추출 */
  mokjangList?: string;
  /** 기부금 영수증용: 소재지 */
  address?: string;
  /** 기부금 영수증용: 담임목사 성함 */
  pastor?: string;
  /** 기부금 영수증용: 사업자등록번호(고유번호) */
  businessNumber?: string;
  /** 결석 알림 기준 연속 주 수 (2~8, 기본 3). 알림 기능 연동용 */
  absenteeAlertConsecutiveWeeks?: number;
  /** 새가족 정착 미완료 알림 사용 여부 */
  alertNewFamilyIncomplete?: boolean;
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

/** 주차별 체크 4개 (개별 저장용) */
export type WeekChecks = [boolean, boolean, boolean, boolean];

/** 정착 프로그램 4주 과정 (new_family_program) */
export interface NewFamilyProgram {
  id: string;
  member_id: string;
  mentor_id: string | null;
  program_start_date: string;
  week1_completed: boolean;
  week1_date: string | null;
  week1_note: string | null;
  week1_checks?: WeekChecks;
  week2_completed: boolean;
  week2_date: string | null;
  week2_note: string | null;
  week2_checks?: WeekChecks;
  week3_completed: boolean;
  week3_date: string | null;
  week3_note: string | null;
  week3_checks?: WeekChecks;
  week4_completed: boolean;
  week4_date: string | null;
  week4_note: string | null;
  week4_checks?: WeekChecks;
  status: "진행중" | "수료" | "중단";
  cell_group_assigned: string | null;
  created_at?: string;
}

export type AttStatus = "p" | "o" | "a" | "n";

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

/** 조직 (교구/구역/목장 등) */
export interface Organization {
  id: string;
  church_id?: string;
  name: string;
  type: "교구" | "구역" | "목장" | "속" | "전도회" | "선교회" | "부서" | "기타";
  parent_id?: string;
  leader_id?: string;
  leader_name?: string;
  description?: string;
  sort_order: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

/** 조직-교인 매핑 */
export interface OrganizationMember {
  id: string;
  organization_id: string;
  member_id: string;
  role_in_org?: string;
  joined_at?: string;
  left_at?: string;
  is_active: boolean;
}

/** 역할/권한 */
export interface Role {
  id: string;
  church_id?: string;
  name: string;
  description?: string;
  permissions: {
    members?: { read?: boolean; write?: boolean; delete?: boolean };
    finance?: { read?: boolean; write?: boolean; delete?: boolean };
    attendance?: { read?: boolean; write?: boolean; delete?: boolean };
    reports?: { read?: boolean };
    settings?: { read?: boolean; write?: boolean };
    donation_receipt?: { read?: boolean; write?: boolean };
  };
  is_system: boolean;
  sort_order: number;
  created_at?: string;
}

/** 사용자-역할 매핑 */
export interface UserRole {
  id: string;
  user_id: string;
  role_id: string;
  member_id?: string;
  assigned_organizations?: string[];
  assigned_at?: string;
  assigned_by?: string;
}

/** 작업 이력 (감사 로그) */
export interface AuditLog {
  id: string;
  user_id?: string;
  user_name?: string;
  action: "CREATE" | "UPDATE" | "DELETE" | "LOGIN" | "EXPORT" | "PRINT";
  target_table?: string;
  target_id?: string;
  target_name?: string;
  details?: Record<string, unknown>;
  ip_address?: string;
  created_at: string;
}

/** 커스텀 필드 정의 */
export interface CustomField {
  id: string;
  church_id?: string;
  target_table: string;
  field_name: string;
  field_label: string;
  field_type: "text" | "number" | "date" | "select" | "checkbox" | "textarea";
  options?: string[];
  is_required: boolean;
  sort_order: number;
  is_active: boolean;
  created_at?: string;
}

/** 명칭 커스터마이징 */
export interface CustomLabel {
  id: string;
  church_id?: string;
  default_label: string;
  custom_label: string;
  category?: string;
}

/** 교회학교 부서 */
export interface SchoolDepartment {
  id: string;
  church_id?: string;
  name: string;
  age_range?: string;
  description?: string;
  leader_id?: string;
  leader_name?: string;
  teacher_count: number;
  student_count: number;
  meeting_time?: string;
  meeting_location?: string;
  is_active: boolean;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
}

/** 교회학교 반(Class) */
export interface SchoolClass {
  id: string;
  department_id: string;
  name: string;
  teacher_id?: string;
  teacher_name?: string;
  assistant_teacher_id?: string;
  assistant_teacher_name?: string;
  max_students: number;
  current_students: number;
  sort_order: number;
  is_active: boolean;
  created_at?: string;
}

/** 교회학교 등록(학생/교사 배정) */
export interface SchoolEnrollment {
  id: string;
  member_id: string;
  department_id: string;
  class_id?: string;
  role: "학생" | "교사" | "부교사" | "부장" | "총무";
  enrolled_date?: string;
  left_date?: string;
  is_active: boolean;
}

/** 교회학교 출결 */
export interface SchoolAttendance {
  id: string;
  department_id: string;
  class_id?: string;
  member_id: string;
  date: string;
  status: "출석" | "결석" | "병결" | "기타";
  note?: string;
  checked_by?: string;
  created_at?: string;
}

/** 교회학교 부서 이동 이력 */
export interface SchoolTransferHistory {
  id: string;
  member_id: string;
  from_department_id?: string;
  from_department_name?: string;
  to_department_id?: string;
  to_department_name?: string;
  transfer_date: string;
  reason?: string;
  created_at?: string;
}

/* ────────────────────────────────────────────────────────────
 *  사역흐름 (Workflow) — Planning Center People 컨셉의 한국형 구현
 *  DB는 snake_case, TS는 동일 키를 유지 (기존 Family/Organization 패턴)
 * ────────────────────────────────────────────────────────────*/

/** 시드된 시스템 템플릿 식별자 — workflows.template_key 와 1:1 매칭 */
export type WorkflowTemplateKey =
  | "new_family"
  | "absentee_recovery"
  | "baptism"
  | "ordination"
  | "reactivation";

export type WorkflowCategory =
  | "새가족" | "결석회복" | "세례" | "임직" | "휴면복귀" | "심방" | "상담" | "기타";

export type WorkflowCardStage = "open" | "snoozed" | "completed" | "dropped";
export type WorkflowCardPriority = "low" | "normal" | "high" | "urgent";
export type WorkflowCardSource =
  | "manual"
  | "auto_new_family"
  | "auto_absentee"
  | "absentee_management"
  | "import"
  | "api";

/** 사역흐름 정의 (workflows) */
export interface Workflow {
  id: string;
  church_id: string;
  name: string;
  description?: string | null;
  category: WorkflowCategory;
  template_key?: WorkflowTemplateKey | null;
  is_active: boolean;
  color?: string | null;
  icon?: string | null;
  created_by?: string | null;
  created_at?: string;
  updated_at?: string;
}

/** 사역흐름 단계의 체크리스트 항목 1개 (workflow_steps.checklist_items 배열 요소) */
export interface WorkflowChecklistItem {
  id: string;
  label: string;
  order: number;
}

/** 카드별 체크리스트 진행 상태 (workflow_cards.checklist_state JSONB) */
export interface WorkflowChecklistState {
  /** checklist item id → checked */
  items?: Record<string, boolean>;
  /** workflow_step id → 완료일 YYYY-MM-DD */
  step_dates?: Record<string, string | null>;
  /** workflow_step id → 단계 메모 */
  step_notes?: Record<string, string | null>;
}

/** 사역흐름 단계 (workflow_steps) */
export interface WorkflowStep {
  id: string;
  church_id: string;
  workflow_id: string;
  name: string;
  description?: string | null;
  sort_order: number;
  expected_days?: number | null;
  auto_promote_days?: number | null;
  is_terminal: boolean;
  /** 체크리스트 항목 (없거나 빈 배열이면 체크박스 UI 미표시) */
  checklist_items?: WorkflowChecklistItem[] | null;
  created_at?: string;
  updated_at?: string;
}

/** 진행카드 (workflow_cards) */
export interface WorkflowCard {
  id: string;
  church_id: string;
  workflow_id: string;
  current_step_id?: string | null;
  member_id?: string | null;
  member_name: string;
  member_phone?: string | null;
  assignee_id?: string | null;
  assignee_name?: string | null;
  stage: WorkflowCardStage;
  priority: WorkflowCardPriority;
  due_date?: string | null;
  snooze_until?: string | null;
  moved_to_step_at: string;
  completed_at?: string | null;
  source: WorkflowCardSource;
  source_ref?: string | null;
  /** 단계별 체크리스트·완료일·메모 누적 (JSONB) */
  checklist_state?: WorkflowChecklistState | null;
  created_by?: string | null;
  created_at?: string;
  updated_at?: string;
}

/** 카드 메모 (workflow_card_notes) */
export interface WorkflowCardNote {
  id: string;
  church_id: string;
  card_id: string;
  step_id?: string | null;
  content: string;
  author_id?: string | null;
  author_name?: string | null;
  created_at: string;
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
  /** 기도 응답일자 (키 -> YYYY-MM-DD) */
  answeredPrayerDates?: Record<string, string>;
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
  denomination: "",
  mokjangList: "",
  address: "",
  pastor: "",
  businessNumber: "",
  absenteeAlertConsecutiveWeeks: 3,
  alertNewFamilyIncomplete: true,
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
