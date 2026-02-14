import { NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";

const MATCH_ALL_ID = "00000000-0000-0000-0000-000000000000";

/** 서버에서 Service Role로 초기화 실행 (418/RLS 회피) */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const scope = body?.scope as string; // 'all' | 'pastoral' | 'finance' | 'visits'

    const sb = getServiceSupabase();

    if (scope === "all") {
      const tablesInOrder = [
        { table: "attendance", column: "week_num", value: -1 },
        { table: "notes", column: "member_id", value: MATCH_ALL_ID },
        { table: "visits", column: "id", value: MATCH_ALL_ID },
        { table: "income", column: "id", value: MATCH_ALL_ID },
        { table: "expense", column: "id", value: MATCH_ALL_ID },
        { table: "budget", column: "year", value: -1 },
        { table: "checklist", column: "week_key", value: "__none__" },
        { table: "plans", column: "id", value: MATCH_ALL_ID },
        { table: "sermons", column: "id", value: MATCH_ALL_ID },
        { table: "members", column: "id", value: MATCH_ALL_ID },
      ];
      for (const { table, column, value } of tablesInOrder) {
        const { error } = await sb.from(table).delete().neq(column, value);
        if (error) {
          return NextResponse.json(
            { ok: false, message: `${table} 초기화 실패: ${error.message}` },
            { status: 500 }
          );
        }
      }
      return NextResponse.json({ ok: true, scope: "all" });
    }

    if (scope === "pastoral") {
      const { error: e1 } = await sb.from("attendance").delete().gte("week_num", 0);
      if (e1) return NextResponse.json({ ok: false, message: `attendance: ${e1.message}` }, { status: 500 });
      const { error: e2 } = await sb.from("notes").delete().neq("member_id", MATCH_ALL_ID);
      if (e2) return NextResponse.json({ ok: false, message: `notes: ${e2.message}` }, { status: 500 });
      const { error: e3 } = await sb.from("members").delete().neq("id", MATCH_ALL_ID);
      if (e3) return NextResponse.json({ ok: false, message: `members: ${e3.message}` }, { status: 500 });
      return NextResponse.json({ ok: true, scope: "pastoral" });
    }

    if (scope === "finance") {
      const { error: e1 } = await sb.from("income").delete().neq("id", MATCH_ALL_ID);
      if (e1) return NextResponse.json({ ok: false, message: `income: ${e1.message}` }, { status: 500 });
      const { error: e2 } = await sb.from("expense").delete().neq("id", MATCH_ALL_ID);
      if (e2) return NextResponse.json({ ok: false, message: `expense: ${e2.message}` }, { status: 500 });
      const { error: e3 } = await sb.from("budget").delete().gte("year", 0);
      if (e3) return NextResponse.json({ ok: false, message: `budget: ${e3.message}` }, { status: 500 });
      return NextResponse.json({ ok: true, scope: "finance" });
    }

    if (scope === "visits") {
      const { error } = await sb.from("visits").delete().neq("id", MATCH_ALL_ID);
      if (error) return NextResponse.json({ ok: false, message: `visits: ${error.message}` }, { status: 500 });
      return NextResponse.json({ ok: true, scope: "visits" });
    }

    if (scope === "planner") {
      const { error } = await sb.from("plans").delete().neq("id", MATCH_ALL_ID);
      if (error) return NextResponse.json({ ok: false, message: `plans: ${error.message}` }, { status: 500 });
      return NextResponse.json({ ok: true, scope: "planner" });
    }

    return NextResponse.json({ ok: false, message: "scope 필요: all | pastoral | finance | visits | planner" }, { status: 400 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { ok: false, message: msg.includes("env not set") ? "Supabase 설정이 없습니다. .env.local에 SUPABASE_SERVICE_ROLE_KEY를 추가하세요." : msg },
      { status: 500 }
    );
  }
}
