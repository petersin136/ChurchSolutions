import { createClient } from "@supabase/supabase-js";

/** 주 2회 호출 — Supabase DB 쿼리로 자동 정지 방지 */
export async function GET() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    );
    const { count } = await supabase
      .from("members")
      .select("*", { count: "exact", head: true });
    return new Response(
      JSON.stringify({ ok: true, members: count, t: new Date().toISOString() }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ ok: false, error: String(e), t: new Date().toISOString() }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
