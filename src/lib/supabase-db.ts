import { supabase } from "@/lib/supabase";
import type { DB, Member, Note, Plan, Sermon, Visit, Income, Expense, AttStatus, ChecklistItem } from "@/types/db";
import { DEFAULT_DB } from "@/types/db";

const CURRENT_YEAR = new Date().getFullYear();

/** 전체 삭제용 조건 (PostgREST는 조건 없이 delete 불가일 수 있음) */
const MATCH_ALL_ID = "00000000-0000-0000-0000-000000000000";

/** Supabase에서 전체 DB 로드 */
export async function loadDBFromSupabase(): Promise<DB> {
  if (!supabase) return { ...DEFAULT_DB };
  const empty = { ...DEFAULT_DB };

  const [settingsRes, membersRes, attendanceRes, notesRes, plansRes, sermonsRes, visitsRes, incomeRes, expenseRes, budgetRes, checklistRes] = await Promise.all([
    supabase.from("settings").select("*").limit(1),
    supabase.from("members").select("*").order("created_at", { ascending: true }),
    supabase.from("attendance").select("*"),
    supabase.from("notes").select("*"),
    supabase.from("plans").select("*").order("date", { ascending: true }),
    supabase.from("sermons").select("*").order("date", { ascending: false }),
    supabase.from("visits").select("*").order("date", { ascending: false }),
    supabase.from("income").select("*").order("date", { ascending: false }),
    supabase.from("expense").select("*").order("date", { ascending: false }),
    supabase.from("budget").select("*").eq("fiscal_year", String(CURRENT_YEAR)),
    supabase.from("checklist").select("*").order("sort_order", { ascending: true }),
  ]);

  if (settingsRes.error) console.warn("settings load error:", settingsRes.error);
  if (membersRes.error) console.warn("members load error:", membersRes.error);

  const settingsRow = settingsRes.data?.[0];
  const db: DB = {
    settings: {
      churchName: settingsRow?.church_name ?? empty.settings.churchName,
      depts: settingsRow?.depts ?? empty.settings.depts,
      fiscalStart: settingsRow?.fiscal_start ?? empty.settings.fiscalStart,
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

  (notesRes.data ?? []).forEach((r: Record<string, unknown>) => {
    const mid = r.member_id as string;
    if (!db.notes[mid]) db.notes[mid] = [];
    db.notes[mid].push({
      date: (r.date as string) || "",
      type: ((r.type as string) || "memo") as Note["type"],
      content: (r.content as string) || "",
      createdAt: (r.created_at as string) || "",
    });
  });

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

/** 전체 초기화: 외래키 의존 순서대로 자식 테이블 먼저 삭제 (권장: 서버 /api/reset 사용) */
export async function clearAllInSupabase(): Promise<void> {
  if (!supabase) throw new Error("Supabase가 연결되지 않았습니다. .env.local의 NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY를 확인하세요.");
  const tablesInOrder = [
    { table: "attendance", column: "week_num", value: -1 },
    { table: "notes", column: "member_id", value: MATCH_ALL_ID },
    { table: "visits", column: "id", value: MATCH_ALL_ID },
    { table: "income", column: "id", value: MATCH_ALL_ID },
    { table: "expense", column: "id", value: MATCH_ALL_ID },
    { table: "budget", column: "fiscal_year", value: "__none__" },
    { table: "checklist", column: "week_key", value: "__none__" },
    { table: "plans", column: "id", value: MATCH_ALL_ID },
    { table: "sermons", column: "id", value: MATCH_ALL_ID },
    { table: "members", column: "id", value: MATCH_ALL_ID },
  ];
  for (const { table, column, value } of tablesInOrder) {
    const { error } = await supabase.from(table).delete().neq(column, value);
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
  const { error: e1 } = await supabase.from("attendance").delete().gte("week_num", 0);
  if (e1) throw new Error(`attendance 초기화 실패: ${e1.message}`);
  const { error: e2 } = await supabase.from("notes").delete().neq("member_id", MATCH_ALL_ID);
  if (e2) throw new Error(`notes 초기화 실패: ${e2.message}`);
  const { error: e3 } = await supabase.from("members").delete().neq("id", MATCH_ALL_ID);
  if (e3) throw new Error(`members 초기화 실패: ${e3.message}`);
}

/** 재정(수입·지출·예산)만 Supabase에서 비우기 (권장: /api/reset?scope=finance) */
export async function clearFinanceInSupabase(): Promise<void> {
  if (!supabase) throw new Error("Supabase가 연결되지 않았습니다. .env.local을 확인하세요.");
  const { error: e1 } = await supabase.from("income").delete().neq("id", MATCH_ALL_ID);
  if (e1) throw new Error(`income 초기화 실패: ${e1.message}`);
  const { error: e2 } = await supabase.from("expense").delete().neq("id", MATCH_ALL_ID);
  if (e2) throw new Error(`expense 초기화 실패: ${e2.message}`);
  const { error: e3 } = await supabase.from("budget").delete().neq("fiscal_year", "__none__");
  if (e3) throw new Error(`budget 초기화 실패: ${e3.message}`);
}

/** 심방/상담만 초기화: visits (권장: /api/reset?scope=visits) */
export async function clearVisitsInSupabase(): Promise<void> {
  if (!supabase) throw new Error("Supabase가 연결되지 않았습니다. .env.local을 확인하세요.");
  const { error } = await supabase.from("visits").delete().neq("id", MATCH_ALL_ID);
  if (error) throw new Error(`visits 초기화 실패: ${error.message}`);
}

/** 설정(교회 정보)만 Supabase에 저장. 저장 버튼 클릭 시 이 함수만 호출하면 요청 수가 적어 실패 가능성이 낮음 */
export async function saveSettingsToSupabase(settings: DB["settings"]): Promise<void> {
  if (!supabase) return;
  const { data: existing } = await supabase.from("settings").select("id").limit(1).maybeSingle();
  const payload = {
    church_name: settings.churchName,
    depts: settings.depts,
    fiscal_start: settings.fiscalStart,
    ...(settings.address !== undefined && { address: settings.address }),
    ...(settings.pastor !== undefined && { pastor: settings.pastor }),
    ...(settings.businessNumber !== undefined && { business_number: settings.businessNumber }),
  };
  if (existing?.id) {
    const { error } = await supabase.from("settings").update(payload).eq("id", existing.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from("settings").insert(payload);
    if (error) throw new Error(error.message);
  }
}

/** DB 전체를 Supabase에 저장. 설정(settings)은 클라이언트 PATCH 400 방지를 위해 저장하지 않음 — 설정 탭에서 "저장" 시 /api/settings 사용 */
export async function saveDBToSupabase(db: DB): Promise<void> {
  if (!supabase) return;
  const year = CURRENT_YEAR;

  // 로컬에서 삭제된 교인을 Supabase에서도 삭제 (새로고침 시 다시 나타나지 않도록)
  const keepMemberIds = new Set(db.members.map((m) => m.id));
  const { data: existingMembers } = await supabase.from("members").select("id");
  if (existingMembers?.length) {
    for (const row of existingMembers as { id: string }[]) {
      const id = row?.id;
      if (!id || keepMemberIds.has(id)) continue;
      await supabase.from("attendance").delete().eq("member_id", id);
      await supabase.from("notes").delete().eq("member_id", id);
      await supabase.from("members").delete().eq("id", id);
    }
  }

  for (const m of db.members) {
    const isUuid = /^[0-9a-f-]{36}$/i.test(m.id);
    if (isUuid) {
      await supabase
        .from("members")
        .upsert(
          {
            id: m.id,
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
          },
          { onConflict: "id" }
        );
    } else {
      await supabase
        .from("members")
        .insert({
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
        });
    }
  }

  // ⚠️ 출석 저장은 AttendanceCheck.tsx의 handleSave에서 Supabase에 직접 upsert합니다.
  // saveDBToSupabase에서 attendance를 건드리면 date+service_type 기반 데이터가 week_num 기반으로 덮어쓰여 소실됩니다.
  /*
  for (const m of db.members) {
    if (!/^[0-9a-f-]{36}$/i.test(m.id)) continue;
    const reasons = db.attendanceReasons?.[m.id] ?? {};
    const rows = Object.entries(db.attendance[m.id] ?? {}).map(([weekNum, status]) => ({
      member_id: m.id,
      week_num: parseInt(weekNum, 10),
      year,
      status: (status === "p" || status === "a") ? status : "n",
      reason: (reasons[parseInt(weekNum, 10)] || null) as string | null,
    }));
    if (rows.length > 0) {
      await supabase.from("attendance").delete().eq("member_id", m.id).eq("year", year);
      await supabase.from("attendance").insert(rows);
    }
  }
  */

  for (const m of db.members) {
    if (!/^[0-9a-f-]{36}$/i.test(m.id)) continue;
    await supabase.from("notes").delete().eq("member_id", m.id);
    const list = db.notes[m.id] ?? [];
    if (list.length > 0) {
      await supabase.from("notes").insert(
        list.map((n) => ({
          member_id: m.id,
          date: n.date,
          type: n.type,
          content: n.content,
        }))
      );
    }
  }

  for (const p of db.plans) {
    if (/^[0-9a-f-]{36}$/i.test(p.id)) {
      await supabase.from("plans").upsert(
        { id: p.id, title: p.title, date: p.date, time: p.time ?? null, cat: p.cat ?? null, memo: p.memo ?? null },
        { onConflict: "id" }
      );
    } else {
      await supabase.from("plans").insert({
        title: p.title,
        date: p.date,
        time: p.time ?? null,
        cat: p.cat ?? null,
        memo: p.memo ?? null,
      });
    }
  }

  for (const s of db.sermons) {
    if (/^[0-9a-f-]{36}$/i.test(s.id)) {
      await supabase.from("sermons").upsert(
        {
          id: s.id,
          date: s.date,
          service: s.service ?? null,
          bible_text: s.text ?? null,
          title: s.title ?? null,
          core: s.core ?? null,
          status: s.status ?? null,
          notes: s.notes ?? null,
        },
        { onConflict: "id" }
      );
    } else {
      await supabase.from("sermons").insert({
        date: s.date,
        service: s.service ?? null,
        bible_text: s.text ?? null,
        title: s.title ?? null,
        core: s.core ?? null,
        status: s.status ?? null,
        notes: s.notes ?? null,
      });
    }
  }

  for (const v of db.visits) {
    if (/^[0-9a-f-]{36}$/i.test(v.id)) {
      await supabase.from("visits").upsert(
        {
          id: v.id,
          date: v.date,
          member_id: v.memberId || null,
          type: v.type ?? null,
          content: v.content,
        },
        { onConflict: "id" }
      );
    } else {
      await supabase.from("visits").insert({
        date: v.date,
        member_id: v.memberId || null,
        type: v.type ?? null,
        content: v.content,
      });
    }
  }

  for (const i of db.income) {
    if (/^[0-9a-f-]{36}$/i.test(i.id)) {
      await supabase.from("income").upsert(
        {
          id: i.id,
          date: i.date,
          type: i.type,
          amount: i.amount,
          donor: i.donor ?? null,
          method: i.method ?? null,
          memo: i.memo ?? null,
        },
        { onConflict: "id" }
      );
    } else {
      await supabase.from("income").insert({
        date: i.date,
        type: i.type,
        amount: i.amount,
        donor: i.donor ?? null,
        method: i.method ?? null,
        memo: i.memo ?? null,
      });
    }
  }

  for (const e of db.expense) {
    if (/^[0-9a-f-]{36}$/i.test(e.id)) {
      await supabase.from("expense").upsert(
        {
          id: e.id,
          date: e.date,
          category: e.category,
          item: e.item ?? null,
          amount: e.amount,
          resolution: e.resolution ?? null,
          memo: e.memo ?? null,
        },
        { onConflict: "id" }
      );
    } else {
      await supabase.from("expense").insert({
        date: e.date,
        category: e.category,
        item: e.item ?? null,
        amount: e.amount,
        resolution: e.resolution ?? null,
        memo: e.memo ?? null,
      });
    }
  }

  const fiscalYear = String(year);
  await supabase.from("budget").delete().eq("fiscal_year", fiscalYear);
  for (const [key, amount] of Object.entries(db.budget)) {
    const numAmount = Number(amount) ?? 0;
    const parts = key.includes(":") ? key.split(":") : [null, key];
    const category_type = parts[0] === "수입" || parts[0] === "지출" ? parts[0] : "지출";
    const category = parts[1] ?? key;
    await supabase.from("budget").insert({
      fiscal_year: fiscalYear,
      category_type,
      category,
      annual_total: numAmount,
      monthly_amounts: { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0, "6": 0, "7": 0, "8": 0, "9": 0, "10": 0, "11": 0, "12": 0 },
    });
  }

  for (const [weekKey, items] of Object.entries(db.checklist)) {
    await supabase.from("checklist").delete().eq("week_key", weekKey);
    if (items.length > 0) {
      await supabase.from("checklist").insert(
        items.map((item, i) => ({
          week_key: weekKey,
          text: item.text,
          done: item.done,
          sort_order: i,
        }))
      );
    }
  }
}
