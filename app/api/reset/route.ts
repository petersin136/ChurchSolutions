import { NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";

const MATCH_ALL_ID = "00000000-0000-0000-0000-000000000000";

/** 전체 초기화 시 삭제할 테이블 순서 (FK 의존성: 자식 먼저). settings 제외. */
const ALL_TABLES_IN_ORDER = [
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

/** 테이블별 삭제 조건 (id 없거나 다른 키 쓰는 테이블). 나머지는 .neq("id", MATCH_ALL_ID) */
const TABLE_DELETE_SPECIAL: Record<string, { column: string; value: string | number }> = {
  attendance: { column: "week_num", value: -1 },
  notes: { column: "member_id", value: MATCH_ALL_ID },
  budget: { column: "fiscal_year", value: "__none__" },
  checklist: { column: "week_key", value: "__none__" },
};

function deleteAllFromTable(sb: ReturnType<typeof getServiceSupabase>, table: string) {
  const spec = TABLE_DELETE_SPECIAL[table];
  if (spec) {
    return sb.from(table).delete().neq(spec.column, spec.value);
  }
  return sb.from(table).delete().neq("id", MATCH_ALL_ID);
}

/** 서버에서 Service Role로 초기화 실행 (418/RLS 회피). settings 테이블은 제외. */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const scope = body?.scope as string;

    const sb = getServiceSupabase();

    if (scope === "all") {
      for (const table of ALL_TABLES_IN_ORDER) {
        const { error } = await deleteAllFromTable(sb, table);
        if (error) {
          return NextResponse.json(
            { ok: false, message: `${table} 초기화 실패: ${error.message}` },
            { status: 500 }
          );
        }
      }
      return NextResponse.json({ ok: true, scope: "all" });
    }

    if (scope === "members" || scope === "pastoral") {
      const { error: e1 } = await sb.from("member_status_history").delete().neq("id", MATCH_ALL_ID);
      if (e1) return NextResponse.json({ ok: false, message: `member_status_history: ${e1.message}` }, { status: 500 });
      const { error: e2 } = await sb.from("notes").delete().neq("member_id", MATCH_ALL_ID);
      if (e2) return NextResponse.json({ ok: false, message: `notes: ${e2.message}` }, { status: 500 });
      const { error: e3 } = await sb.from("attendance").delete().gte("week_num", 0);
      if (e3) return NextResponse.json({ ok: false, message: `attendance: ${e3.message}` }, { status: 500 });
      const { error: e4 } = await sb.from("members").delete().neq("id", MATCH_ALL_ID);
      if (e4) return NextResponse.json({ ok: false, message: `members: ${e4.message}` }, { status: 500 });
      const { error: e5 } = await sb.from("families").delete().neq("id", MATCH_ALL_ID);
      if (e5) return NextResponse.json({ ok: false, message: `families: ${e5.message}` }, { status: 500 });
      return NextResponse.json({ ok: true, scope: scope });
    }

    if (scope === "finance") {
      const { error: e1 } = await sb.from("special_account_transactions").delete().neq("id", MATCH_ALL_ID);
      if (e1) return NextResponse.json({ ok: false, message: `special_account_transactions: ${e1.message}` }, { status: 500 });
      const { error: e2 } = await sb.from("special_accounts").delete().neq("id", MATCH_ALL_ID);
      if (e2) return NextResponse.json({ ok: false, message: `special_accounts: ${e2.message}` }, { status: 500 });
      const { error: e3 } = await sb.from("income").delete().neq("id", MATCH_ALL_ID);
      if (e3) return NextResponse.json({ ok: false, message: `income: ${e3.message}` }, { status: 500 });
      const { error: e4 } = await sb.from("expense").delete().neq("id", MATCH_ALL_ID);
      if (e4) return NextResponse.json({ ok: false, message: `expense: ${e4.message}` }, { status: 500 });
      const { error: e5 } = await sb.from("budget").delete().neq("fiscal_year", "__none__");
      if (e5) return NextResponse.json({ ok: false, message: `budget: ${e5.message}` }, { status: 500 });
      return NextResponse.json({ ok: true, scope: "finance" });
    }

    if (scope === "visits") {
      const { error: e1 } = await sb.from("notes").delete().neq("member_id", MATCH_ALL_ID);
      if (e1) return NextResponse.json({ ok: false, message: `notes: ${e1.message}` }, { status: 500 });
      const { error: e2 } = await sb.from("visits").delete().neq("id", MATCH_ALL_ID);
      if (e2) return NextResponse.json({ ok: false, message: `visits: ${e2.message}` }, { status: 500 });
      return NextResponse.json({ ok: true, scope: "visits" });
    }

    if (scope === "attendance") {
      const { error } = await sb.from("attendance").delete().gte("week_num", 0);
      if (error) return NextResponse.json({ ok: false, message: `attendance: ${error.message}` }, { status: 500 });
      return NextResponse.json({ ok: true, scope: "attendance" });
    }

    if (scope === "school") {
      const tables = ["school_attendance", "school_transfer_history", "school_enrollments", "school_classes", "school_departments"];
      for (const table of tables) {
        const { error } = await deleteAllFromTable(sb, table);
        if (error) return NextResponse.json({ ok: false, message: `${table}: ${error.message}` }, { status: 500 });
      }
      return NextResponse.json({ ok: true, scope: "school" });
    }

    if (scope === "new_family") {
      const { error } = await sb.from("new_family_program").delete().neq("id", MATCH_ALL_ID);
      if (error) return NextResponse.json({ ok: false, message: `new_family_program: ${error.message}` }, { status: 500 });
      return NextResponse.json({ ok: true, scope: "new_family" });
    }

    if (scope === "planner") {
      const { error: e1 } = await sb.from("plans").delete().neq("id", MATCH_ALL_ID);
      if (e1) return NextResponse.json({ ok: false, message: `plans: ${e1.message}` }, { status: 500 });
      const { error: e2 } = await sb.from("sermons").delete().neq("id", MATCH_ALL_ID);
      if (e2) return NextResponse.json({ ok: false, message: `sermons: ${e2.message}` }, { status: 500 });
      const { error: e3 } = await sb.from("checklist").delete().neq("week_key", "__none__");
      if (e3) return NextResponse.json({ ok: false, message: `checklist: ${e3.message}` }, { status: 500 });
      const { error: e4 } = await sb.from("service_types").delete().neq("id", MATCH_ALL_ID);
      if (e4) return NextResponse.json({ ok: false, message: `service_types: ${e4.message}` }, { status: 500 });
      return NextResponse.json({ ok: true, scope: "planner" });
    }

    if (scope === "messaging") {
      const { error: e1 } = await sb.from("message_logs").delete().neq("id", MATCH_ALL_ID);
      if (e1) return NextResponse.json({ ok: false, message: `message_logs: ${e1.message}` }, { status: 500 });
      const { error: e2 } = await sb.from("frequent_groups").delete().neq("id", MATCH_ALL_ID);
      if (e2) return NextResponse.json({ ok: false, message: `frequent_groups: ${e2.message}` }, { status: 500 });
      const { error: e3 } = await sb.from("organization_members").delete().neq("id", MATCH_ALL_ID);
      if (e3) return NextResponse.json({ ok: false, message: `organization_members: ${e3.message}` }, { status: 500 });
      const { error: e4 } = await sb.from("organizations").delete().neq("id", MATCH_ALL_ID);
      if (e4) return NextResponse.json({ ok: false, message: `organizations: ${e4.message}` }, { status: 500 });
      return NextResponse.json({ ok: true, scope: "messaging" });
    }

    return NextResponse.json({ ok: false, message: "scope 필요: all | members | pastoral | finance | visits | attendance | school | new_family | planner | messaging" }, { status: 400 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { ok: false, message: msg.includes("env not set") ? "Supabase 설정이 없습니다. .env.local에 SUPABASE_SERVICE_ROLE_KEY를 추가하세요." : msg },
      { status: 500 }
    );
  }
}
