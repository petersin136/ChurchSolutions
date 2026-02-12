import { supabase } from "@/lib/supabase";
import type { DB, Member, Note, Plan, Sermon, Visit, Income, Expense, AttStatus, ChecklistItem } from "@/types/db";
import { DEFAULT_DB, buildSampleDB } from "@/types/db";

const CURRENT_YEAR = new Date().getFullYear();

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
    supabase.from("budget").select("*").eq("year", CURRENT_YEAR),
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
    db.budget[r.category as string] = Number(r.amount) || 0;
  });

  (checklistRes.data ?? []).forEach((r: Record<string, unknown>) => {
    const key = (r.week_key as string) || "";
    if (!db.checklist[key]) db.checklist[key] = [];
    db.checklist[key].push({
      text: (r.text as string) || "",
      done: Boolean(r.done),
    });
  });

  // 교인이 10명 미만이면 70명 샘플로 채워서 예시 동작 보여주기
  if (!membersRes.data?.length || membersRes.data.length < 10) return buildSampleDB();
  return db;
}

function toMember(r: Record<string, unknown>): Member {
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
    status: r.status as string | undefined,
    source: r.source as string | undefined,
    prayer: r.prayer as string | undefined,
    memo: r.memo as string | undefined,
    group: r.mokjang as string | undefined,
    photo: r.photo as string | undefined,
    createdAt: r.created_at ? new Date(r.created_at as string).toISOString().slice(0, 10) : undefined,
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

/** DB 전체를 Supabase에 저장 */
export async function saveDBToSupabase(db: DB): Promise<void> {
  if (!supabase) return;
  const year = CURRENT_YEAR;

  const existingSettings = await supabase.from("settings").select("id").limit(1).maybeSingle();
  if (existingSettings.data?.id) {
    await supabase.from("settings").update({
      church_name: db.settings.churchName,
      depts: db.settings.depts,
      fiscal_start: db.settings.fiscalStart,
    }).eq("id", existingSettings.data.id);
  } else {
    await supabase.from("settings").insert({
      church_name: db.settings.churchName,
      depts: db.settings.depts,
      fiscal_start: db.settings.fiscalStart,
    });
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
            mokjang: m.group ?? null,
            photo: m.photo ?? null,
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
          mokjang: m.group ?? null,
          photo: m.photo ?? null,
        });
    }
  }

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

  for (const [category, amount] of Object.entries(db.budget)) {
    await supabase.from("budget").upsert(
      { category, amount, year },
      { onConflict: "category,year" }
    );
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
