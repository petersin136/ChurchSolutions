import { supabase } from "@/lib/supabase";
import { getChurchId, withChurchId, filterByChurch } from "@/lib/tenant";
import type { DB, Member, Note, NewFamilyProgram, Plan, Sermon, Visit, Income, Expense, AttStatus, WeekChecks } from "@/types/db";
import { DEFAULT_DB } from "@/types/db";

const CURRENT_YEAR = new Date().getFullYear();

/** 전체 삭제용 조건 (PostgREST는 조건 없이 delete 불가일 수 있음) */
const MATCH_ALL_ID = "00000000-0000-0000-0000-000000000000";

/** Supabase에서 전체 DB 로드. churchId가 없으면 쿼리하지 않고 DEFAULT_DB 반환 (목양 대시보드 0명 버그 방지). */
export async function loadDBFromSupabase(optionalChurchId?: string | null): Promise<DB> {
  if (!supabase) return { ...DEFAULT_DB };
  const empty = { ...DEFAULT_DB };

  let cid: string | null = optionalChurchId ?? null;
  if (!cid) {
    try {
      cid = getChurchId();
    } catch {
      return { ...DEFAULT_DB };
    }
  }
  if (!cid) return { ...DEFAULT_DB };

  console.log("[loadDB] churchId:", cid);

  const [settingsRes, membersRes, attendanceRes, notesRes, plansRes, sermonsRes, visitsRes, newFamilyProgramsRes, incomeRes, expenseRes, budgetRes, checklistRes] = await Promise.all([
    supabase.from("settings").select("*").eq("church_id", cid).limit(1),
    supabase.from("members").select("*").eq("church_id", cid).order("created_at", { ascending: true }),
    supabase.from("attendance").select("*").eq("church_id", cid),
    supabase.from("notes").select("*").eq("church_id", cid),
    supabase.from("plans").select("*").eq("church_id", cid).order("date", { ascending: true }),
    supabase.from("sermons").select("*").eq("church_id", cid).order("date", { ascending: false }),
    supabase.from("visits").select("*").eq("church_id", cid).order("date", { ascending: false }),
    supabase.from("new_family_program").select("*").eq("church_id", cid),
    supabase.from("income").select("*").eq("church_id", cid).order("date", { ascending: false }),
    supabase.from("expense").select("*").eq("church_id", cid).order("date", { ascending: false }),
    supabase.from("budget").select("*").eq("church_id", cid).eq("fiscal_year", String(CURRENT_YEAR)),
    supabase.from("checklist").select("*").eq("church_id", cid).order("sort_order", { ascending: true }),
  ]);

  if (settingsRes.error) console.warn("settings load error:", settingsRes.error);
  if (membersRes.error) console.warn("members load error:", membersRes.error);

  console.log("[loadDB] members 쿼리 결과:", {
    count: membersRes.data?.length ?? 0,
    error: membersRes.error?.message ?? null,
    firstMember: (membersRes.data?.[0] as Record<string, unknown> | undefined)?.name ?? "none",
  });

  const settingsRow = settingsRes.data?.[0];
  const db: DB = {
    settings: {
      churchName: settingsRow?.church_name ?? empty.settings.churchName,
      depts: settingsRow?.depts ?? empty.settings.depts,
      fiscalStart: settingsRow?.fiscal_start ?? empty.settings.fiscalStart,
      denomination: (settingsRow as Record<string, unknown>)?.denomination as string | undefined ?? empty.settings.denomination,
      address: (settingsRow as Record<string, unknown>)?.address as string | undefined ?? empty.settings.address,
      pastor: (settingsRow as Record<string, unknown>)?.pastor as string | undefined ?? empty.settings.pastor,
      businessNumber: (settingsRow as Record<string, unknown>)?.business_number as string | undefined ?? empty.settings.businessNumber,
    },
    members: (membersRes.data ?? []).map((r: Record<string, unknown>) => toMember(r)),
    attendance: {},
    attendanceReasons: {},
    notes: {},
    plans: (plansRes.data ?? []).map((r: Record<string, unknown>) => toPlan(r)),
    sermons: (sermonsRes.data ?? []).map((r: Record<string, unknown>) => toSermon(r)),
    visits: (visitsRes.data ?? []).map((r: Record<string, unknown>) => toVisit(r)),
    newFamilyPrograms: (newFamilyProgramsRes.data ?? []).map((r: Record<string, unknown>) => toNewFamilyProgram(r)),
    income: (incomeRes.data ?? []).map((r: Record<string, unknown>) => toIncome(r)),
    expense: (expenseRes.data ?? []).map((r: Record<string, unknown>) => toExpense(r)),
    budget: {},
    checklist: {},
  };

  (attendanceRes.data ?? []).forEach((r: Record<string, unknown>) => {
    const mid = r.member_id as string;
    const week = r.week_num as number;
    if (!db.attendance[mid]) db.attendance[mid] = {};
    const status = r.status as string;
    db.attendance[mid][week] = (status === "p" || status === "a" || status === "n" ? status : "n") as AttStatus;
    const reason = r.reason as string | undefined;
    if (reason?.trim()) {
      if (!db.attendanceReasons) db.attendanceReasons = {};
      if (!db.attendanceReasons[mid]) db.attendanceReasons[mid] = {};
      db.attendanceReasons[mid][week] = reason;
    }
  });

  const answeredPrayerKeys: string[] = [];
  const answeredPrayerDates: Record<string, string> = {};
  (notesRes.data ?? []).forEach((r: Record<string, unknown>) => {
    const mid = r.member_id as string;
    if (!db.notes[mid]) db.notes[mid] = [];
    const createdAt = (r.created_at as string) || "";
    const note: Note & { createdAt: string } = {
      date: (r.date as string) || "",
      type: ((r.type as string) || "memo") as Note["type"],
      content: (r.content as string) || "",
      createdAt,
    };
    db.notes[mid].push(note);
    if (note.type === "prayer" && (r.answered === true || r.answered_at)) {
      const key = `note\t${mid}\t${note.date}\t${createdAt}\t${note.content}`;
      answeredPrayerKeys.push(key);
      if (r.answered_at) answeredPrayerDates[key] = String(r.answered_at).slice(0, 10);
    }
  });
  if (answeredPrayerKeys.length > 0) {
    db.answeredPrayerKeys = [...new Set([...(db.answeredPrayerKeys || []), ...answeredPrayerKeys])];
    db.answeredPrayerDates = { ...(db.answeredPrayerDates || {}), ...answeredPrayerDates };
  }

  (budgetRes.data ?? []).forEach((r: Record<string, unknown>) => {
    if (r.fiscal_year != null && r.category_type != null && r.category != null) {
      db.budget[`${r.category_type}:${r.category}`] = Number(r.annual_total) ?? 0;
    } else if (r.category != null) {
      db.budget[r.category as string] = Number(r.annual_total ?? r.amount) ?? 0;
    }
  });

  (checklistRes.data ?? []).forEach((r: Record<string, unknown>) => {
    const key = (r.week_key as string) || "";
    if (!db.checklist[key]) db.checklist[key] = [];
    db.checklist[key].push({
      text: (r.text as string) || "",
      done: Boolean(r.done),
    });
  });

  // Supabase에서 불러온 데이터만 사용. 샘플로 덮어쓰지 않음 (교회 이름·금액이 바뀌는 문제 방지)
  return db;
}

export function toMember(r: Record<string, unknown>): Member {
  const created = r.created_at as string | undefined;
  return {
    id: String(r.id ?? ""),
    name: String(r.name ?? ""),
    dept: r.dept as string | undefined,
    role: r.role as string | undefined,
    birth: r.birth as string | undefined,
    gender: r.gender as string | undefined,
    phone: r.phone as string | undefined,
    address: r.address as string | undefined,
    family: r.family as string | undefined,
    status: (r.status as string | undefined) ?? (r.member_status as string | undefined) ?? "활동",
    source: r.source as string | undefined,
    prayer: r.prayer as string | undefined,
    memo: r.memo as string | undefined,
    group: (r.mokjang ?? r.group) as string | undefined,
    mokjang: (r.mokjang ?? r.group) as string | undefined,
    photo: r.photo as string | undefined,
    created_at: created,
    updated_at: r.updated_at as string | undefined,
    createdAt: created ? new Date(created).toISOString().slice(0, 10) : undefined,
    is_new_family: r.is_new_family as boolean | undefined,
    first_visit_date: r.first_visit_date as string | undefined,
    firstVisitDate: r.first_visit_date as string | undefined,
    visit_path: r.visit_path as Member["visit_path"],
    visitPath: r.visit_path as string | undefined,
    referrer_id: r.referrer_id as string | undefined,
    referrer_name: r.referrer_name as string | undefined,
    family_id: r.family_id as string | undefined,
    family_relation: r.family_relation as Member["family_relation"],
    member_status: (r.member_status as Member["member_status"]) ?? "활동",
    status_changed_at: r.status_changed_at as string | undefined,
    status_reason: r.status_reason as string | undefined,
    email: r.email as string | undefined,
    job: r.job as string | undefined,
    baptism_date: r.baptism_date as string | undefined,
    baptism_type: r.baptism_type as Member["baptism_type"],
    wedding_anniversary: r.wedding_anniversary as string | undefined,
    registered_date: r.registered_date as string | undefined,
    small_group: r.small_group as string | undefined,
    talent: r.talent as string | undefined,
    is_prospect: r.is_prospect as boolean | undefined,
  };
}

function toPlan(r: Record<string, unknown>): Plan {
  return {
    id: String(r.id ?? ""),
    title: String(r.title ?? ""),
    date: String(r.date ?? ""),
    time: r.time as string | undefined,
    cat: (r.cat as string) ?? "",
    memo: r.memo as string | undefined,
  };
}

function toSermon(r: Record<string, unknown>): Sermon {
  return {
    id: String(r.id ?? ""),
    date: String(r.date ?? ""),
    service: (r.service as string) ?? "",
    text: r.bible_text as string | undefined,
    title: r.title as string | undefined,
    core: r.core as string | undefined,
    status: (r.status as string) ?? "구상중",
    notes: r.notes as string | undefined,
  };
}

function toVisit(r: Record<string, unknown>): Visit {
  return {
    id: String(r.id ?? ""),
    date: String(r.date ?? ""),
    memberId: r.member_id ? String(r.member_id) : "",
    type: (r.type as string) ?? "",
    content: String(r.content ?? ""),
  };
}

function parseWeekChecks(v: unknown): WeekChecks | undefined {
  if (Array.isArray(v) && v.length >= 4) return [Boolean(v[0]), Boolean(v[1]), Boolean(v[2]), Boolean(v[3])];
  if (typeof v === "string") try { const a = JSON.parse(v); return parseWeekChecks(a); } catch { return undefined; }
  return undefined;
}

function toNewFamilyProgram(r: Record<string, unknown>): NewFamilyProgram {
  const w1c = Boolean(r.week1_completed);
  const w2c = Boolean(r.week2_completed);
  const w3c = Boolean(r.week3_completed);
  const w4c = Boolean(r.week4_completed);
  return {
    id: String(r.id ?? ""),
    member_id: String(r.member_id ?? ""),
    mentor_id: (r.mentor_id as string) || null,
    program_start_date: String(r.program_start_date ?? ""),
    week1_completed: w1c,
    week1_date: (r.week1_date as string) || null,
    week1_note: (r.week1_note as string) || null,
    week1_checks: parseWeekChecks(r.week1_checks) ?? [w1c, w1c, w1c, w1c],
    week2_completed: w2c,
    week2_date: (r.week2_date as string) || null,
    week2_note: (r.week2_note as string) || null,
    week2_checks: parseWeekChecks(r.week2_checks) ?? [w2c, w2c, w2c, w2c],
    week3_completed: w3c,
    week3_date: (r.week3_date as string) || null,
    week3_note: (r.week3_note as string) || null,
    week3_checks: parseWeekChecks(r.week3_checks) ?? [w3c, w3c, w3c, w3c],
    week4_completed: w4c,
    week4_date: (r.week4_date as string) || null,
    week4_note: (r.week4_note as string) || null,
    week4_checks: parseWeekChecks(r.week4_checks) ?? [w4c, w4c, w4c, w4c],
    status: ((r.status as string) || "진행중") as NewFamilyProgram["status"],
    cell_group_assigned: (r.cell_group_assigned as string) || null,
    created_at: r.created_at as string | undefined,
  };
}

function toIncome(r: Record<string, unknown>): Income {
  return {
    id: String(r.id ?? ""),
    date: String(r.date ?? ""),
    type: String(r.type ?? ""),
    amount: Number(r.amount) ?? 0,
    donor: r.donor as string | undefined,
    method: r.method as string | undefined,
    memo: r.memo as string | undefined,
  };
}

function toExpense(r: Record<string, unknown>): Expense {
  return {
    id: String(r.id ?? ""),
    date: String(r.date ?? ""),
    category: String(r.category ?? ""),
    item: r.item as string | undefined,
    amount: Number(r.amount) ?? 0,
    resolution: r.resolution as string | undefined,
    memo: r.memo as string | undefined,
  };
}

/** 전체 초기화: FK 의존 순서대로 자식 테이블 먼저 삭제. settings 제외. (권장: 서버 POST /api/reset { scope: "all" }) */
const ALL_RESET_TABLES = [
  "school_attendance",
  "school_transfer_history",
  "school_enrollments",
  "school_classes",
  "school_departments",
  "attendance",
  "notes",
  "visits",
  "new_family_program",
  "income",
  "expense",
  "budget",
  "special_account_transactions",
  "special_accounts",
  "message_logs",
  "frequent_groups",
  "organization_members",
  "organizations",
  "user_roles",
  "roles",
  "audit_logs",
  "custom_fields",
  "custom_labels",
  "member_status_history",
  "families",
  "plans",
  "sermons",
  "checklist",
  "service_types",
  "members",
];

const RESET_TABLE_SPECIAL: Record<string, { column: string; value: string | number }> = {
  attendance: { column: "week_num", value: -1 },
  notes: { column: "member_id", value: MATCH_ALL_ID },
  budget: { column: "fiscal_year", value: "__none__" },
  checklist: { column: "week_key", value: "__none__" },
};

export async function clearAllInSupabase(): Promise<void> {
  if (!supabase) throw new Error("Supabase가 연결되지 않았습니다. .env.local의 NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY를 확인하세요.");
  const churchId = getChurchId();
  for (const table of ALL_RESET_TABLES) {
    const spec = RESET_TABLE_SPECIAL[table];
    const { error } = spec
      ? await supabase.from(table).delete().eq("church_id", churchId).neq(spec.column, spec.value)
      : await supabase.from(table).delete().eq("church_id", churchId).neq("id", MATCH_ALL_ID);
    if (error) throw new Error(`${table} 초기화 실패: ${error.message}`);
  }
}

/**
 * 목양(교인·출석·노트)만 초기화: attendance → notes → members.
 * 반드시 "초기화" 버튼 등 사용자 동작으로만 호출해야 하며, 페이지 로드/useEffect에서 호출 금지.
 * 권장: 클라이언트에서는 POST /api/reset { scope: "pastoral" } 사용.
 */
export async function clearPastoralInSupabase(confirmExplicitReset?: { onlyFromResetButton: true }): Promise<void> {
  if (confirmExplicitReset?.onlyFromResetButton !== true) {
    throw new Error("clearPastoralInSupabase는 초기화 버튼 등 명시적 호출에서만 사용해야 하며, 페이지 로드 시 호출하면 안 됩니다.");
  }
  if (!supabase) throw new Error("Supabase가 연결되지 않았습니다. .env.local을 확인하세요.");
  const churchId = getChurchId();
  const { error: e1 } = await supabase.from("attendance").delete().eq("church_id", churchId).gte("week_num", 0);
  if (e1) throw new Error(`attendance 초기화 실패: ${e1.message}`);
  const { error: e2 } = await supabase.from("notes").delete().eq("church_id", churchId).neq("member_id", MATCH_ALL_ID);
  if (e2) throw new Error(`notes 초기화 실패: ${e2.message}`);
  const { error: e3 } = await supabase.from("members").delete().eq("church_id", churchId).neq("id", MATCH_ALL_ID);
  if (e3) throw new Error(`members 초기화 실패: ${e3.message}`);
}

/** 재정(수입·지출·예산)만 Supabase에서 비우기 (권장: /api/reset?scope=finance) */
export async function clearFinanceInSupabase(): Promise<void> {
  if (!supabase) throw new Error("Supabase가 연결되지 않았습니다. .env.local을 확인하세요.");
  const churchId = getChurchId();
  const { error: e1 } = await supabase.from("income").delete().eq("church_id", churchId).neq("id", MATCH_ALL_ID);
  if (e1) throw new Error(`income 초기화 실패: ${e1.message}`);
  const { error: e2 } = await supabase.from("expense").delete().eq("church_id", churchId).neq("id", MATCH_ALL_ID);
  if (e2) throw new Error(`expense 초기화 실패: ${e2.message}`);
  const { error: e3 } = await supabase.from("budget").delete().eq("church_id", churchId).neq("fiscal_year", "__none__");
  if (e3) throw new Error(`budget 초기화 실패: ${e3.message}`);
}

/** 심방/상담만 초기화: visits (권장: /api/reset?scope=visits) */
export async function clearVisitsInSupabase(): Promise<void> {
  if (!supabase) throw new Error("Supabase가 연결되지 않았습니다. .env.local을 확인하세요.");
  const churchId = getChurchId();
  const { error } = await supabase.from("visits").delete().eq("church_id", churchId).neq("id", MATCH_ALL_ID);
  if (error) throw new Error(`visits 초기화 실패: ${error.message}`);
}

/** 설정(교회 정보)만 Supabase에 저장. 저장 버튼 클릭 시 이 함수만 호출하면 요청 수가 적어 실패 가능성이 낮음 */
export async function saveSettingsToSupabase(settings: DB["settings"]): Promise<void> {
  if (!supabase) return;
  const churchId = getChurchId();
  const { data: existing } = await supabase.from("settings").select("id").eq("church_id", churchId).limit(1).maybeSingle();
  const payload = withChurchId({
    church_name: settings.churchName,
    depts: settings.depts,
    fiscal_start: settings.fiscalStart,
    ...(settings.denomination !== undefined && { denomination: settings.denomination }),
    ...(settings.address !== undefined && { address: settings.address }),
    ...(settings.pastor !== undefined && { pastor: settings.pastor }),
    ...(settings.businessNumber !== undefined && { business_number: settings.businessNumber }),
  });
  if (existing?.id) {
    const { error } = await supabase.from("settings").update(payload).eq("id", existing.id).eq("church_id", churchId);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from("settings").insert(payload);
    if (error) throw new Error(error.message);
  }
}

/**
 * DB 전체를 Supabase에 저장 (insert/upsert만 수행).
 * 삭제는 이 함수에서 절대 하지 않음 — 사용자가 UI에서 명시적으로 삭제 버튼을 누를 때만 해당 컴포넌트에서 수행.
 * 설정(settings)은 /api/settings 또는 saveSettingsToSupabase에서 별도 저장.
 * 출석(attendance)은 AttendanceCheck.tsx에서 직접 upsert.
 * 노트(notes)는 PastoralPage에서 개별 저장.
 * 예산(budget)은 BudgetManagement에서 개별 저장.
 * 체크리스트(checklist)는 개별 저장.
 */
export async function saveDBToSupabase(db: DB): Promise<void> {
  if (!supabase) return;

  const churchId = getChurchId();
  console.log("=== [saveDBToSupabase] church_id 확인 ===", churchId, "| localStorage:", typeof window !== "undefined" ? localStorage.getItem("church_solution_church_id") : "SSR");
  if (!churchId) {
    console.error("[saveDBToSupabase] church_id가 비어있어 저장을 중단합니다.");
    return;
  }

  for (const m of db.members) {
    const isUuid = /^[0-9a-f-]{36}$/i.test(m.id);
    const payload = {
      name: m.name,
      dept: m.dept ?? null,
      role: m.role ?? null,
      birth: m.birth ?? null,
      gender: m.gender ?? null,
      phone: m.phone ?? null,
      address: m.address ?? null,
      family: m.family ?? null,
      status: m.status ?? null,
      source: m.source ?? null,
      prayer: m.prayer ?? null,
      memo: m.memo ?? null,
      mokjang: m.mokjang ?? m.group ?? null,
      photo: m.photo ?? null,
      is_new_family: m.is_new_family ?? null,
      first_visit_date: m.first_visit_date ?? null,
      visit_path: m.visit_path ?? null,
      referrer_id: m.referrer_id ?? null,
      referrer_name: m.referrer_name ?? null,
      family_id: m.family_id ?? null,
      family_relation: m.family_relation ?? null,
      member_status: m.member_status ?? null,
      status_changed_at: m.status_changed_at ?? null,
      status_reason: m.status_reason ?? null,
      email: m.email ?? null,
      job: m.job ?? null,
      baptism_date: m.baptism_date ?? null,
      baptism_type: m.baptism_type ?? null,
      wedding_anniversary: m.wedding_anniversary ?? null,
      registered_date: m.registered_date ?? null,
      small_group: m.small_group ?? null,
      talent: m.talent ?? null,
      is_prospect: m.is_prospect ?? null,
    };
    if (isUuid) {
      await supabase.from("members").upsert(withChurchId({ id: m.id, ...payload }), { onConflict: "id" });
    } else {
      await supabase.from("members").insert(withChurchId(payload));
    }
  }

  for (const p of db.plans) {
    if (/^[0-9a-f-]{36}$/i.test(p.id)) {
      await supabase.from("plans").upsert(
        withChurchId({ id: p.id, title: p.title, date: p.date, time: p.time ?? null, cat: p.cat ?? null, memo: p.memo ?? null }),
        { onConflict: "id" }
      );
    } else {
      await supabase.from("plans").insert(
        withChurchId({ title: p.title, date: p.date, time: p.time ?? null, cat: p.cat ?? null, memo: p.memo ?? null })
      );
    }
  }

  for (const s of db.sermons) {
    if (/^[0-9a-f-]{36}$/i.test(s.id)) {
      await supabase.from("sermons").upsert(
        withChurchId({
          id: s.id, date: s.date, service: s.service ?? null, bible_text: s.text ?? null,
          title: s.title ?? null, core: s.core ?? null, status: s.status ?? null, notes: s.notes ?? null,
        }),
        { onConflict: "id" }
      );
    } else {
      await supabase.from("sermons").insert(
        withChurchId({
          date: s.date, service: s.service ?? null, bible_text: s.text ?? null,
          title: s.title ?? null, core: s.core ?? null, status: s.status ?? null, notes: s.notes ?? null,
        })
      );
    }
  }

  for (const v of db.visits) {
    if (/^[0-9a-f-]{36}$/i.test(v.id)) {
      await supabase.from("visits").upsert(
        withChurchId({ id: v.id, date: v.date, member_id: v.memberId || null, type: v.type ?? null, content: v.content }),
        { onConflict: "id" }
      );
    } else {
      await supabase.from("visits").insert(
        withChurchId({ date: v.date, member_id: v.memberId || null, type: v.type ?? null, content: v.content })
      );
    }
  }

  for (const p of db.newFamilyPrograms ?? []) {
    if (!/^[0-9a-f-]{36}$/i.test(p.id)) continue;
    const row: Record<string, unknown> = {
      id: p.id, member_id: p.member_id, mentor_id: p.mentor_id ?? null,
      program_start_date: p.program_start_date,
      week1_completed: p.week1_completed ?? false, week1_date: p.week1_date ?? null, week1_note: p.week1_note ?? null,
      week2_completed: p.week2_completed ?? false, week2_date: p.week2_date ?? null, week2_note: p.week2_note ?? null,
      week3_completed: p.week3_completed ?? false, week3_date: p.week3_date ?? null, week3_note: p.week3_note ?? null,
      week4_completed: p.week4_completed ?? false, week4_date: p.week4_date ?? null, week4_note: p.week4_note ?? null,
      status: p.status ?? "진행중", cell_group_assigned: p.cell_group_assigned ?? null,
    };
    ["week1_checks", "week2_checks", "week3_checks", "week4_checks"].forEach((key) => {
      const arr = (p as unknown as Record<string, unknown>)[key] as WeekChecks | undefined;
      if (arr && Array.isArray(arr) && arr.length >= 4) row[key] = JSON.stringify(arr.slice(0, 4));
    });
    await supabase.from("new_family_program").upsert(withChurchId(row) as any, { onConflict: "id" });
  }

  for (const i of db.income) {
    if (/^[0-9a-f-]{36}$/i.test(i.id)) {
      await supabase.from("income").upsert(
        withChurchId({ id: i.id, date: i.date, type: i.type, amount: i.amount, donor: i.donor ?? null, method: i.method ?? null, memo: i.memo ?? null }),
        { onConflict: "id" }
      );
    } else {
      await supabase.from("income").insert(
        withChurchId({ date: i.date, type: i.type, amount: i.amount, donor: i.donor ?? null, method: i.method ?? null, memo: i.memo ?? null })
      );
    }
  }

  for (const e of db.expense) {
    if (/^[0-9a-f-]{36}$/i.test(e.id)) {
      await supabase.from("expense").upsert(
        withChurchId({ id: e.id, date: e.date, category: e.category, item: e.item ?? null, amount: e.amount, resolution: e.resolution ?? null, memo: e.memo ?? null }),
        { onConflict: "id" }
      );
    } else {
      await supabase.from("expense").insert(
        withChurchId({ date: e.date, category: e.category, item: e.item ?? null, amount: e.amount, resolution: e.resolution ?? null, memo: e.memo ?? null })
      );
    }
  }
}
