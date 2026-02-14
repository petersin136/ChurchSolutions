import { NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";

/** 서버에서 Service Role로 설정 저장 (PATCH 400/RLS 회피) */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const churchName = body?.churchName ?? "";
    const depts = body?.depts ?? "";
    const fiscalStart = body?.fiscalStart ?? "1";

    const sb = getServiceSupabase();

    const payload = {
      church_name: churchName,
      depts,
      fiscal_start: fiscalStart,
    };

    const { data: existing } = await sb.from("settings").select("id").limit(1).maybeSingle();

    if (existing?.id) {
      const { error } = await sb.from("settings").update(payload).eq("id", existing.id);
      if (error) {
        return NextResponse.json(
          { ok: false, message: error.message },
          { status: 500 }
        );
      }
    } else {
      const { error } = await sb.from("settings").insert(payload);
      if (error) {
        return NextResponse.json(
          { ok: false, message: error.message },
          { status: 500 }
        );
      }
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { ok: false, message: msg.includes("env not set") ? "Supabase 설정이 없습니다." : msg },
      { status: 500 }
    );
  }
}
