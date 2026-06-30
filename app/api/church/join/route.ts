import { NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";

interface JoinChurchBody {
  churchId: string;
}

export async function POST(request: Request) {
  const supabase = getServiceSupabase();

  try {
    const body = (await request.json()) as Partial<JoinChurchBody>;
    const churchId = body.churchId?.trim();

    if (!churchId) {
      return NextResponse.json(
        { error: "교회를 선택해 주세요." },
        { status: 400 },
      );
    }

    const authHeader = request.headers.get("Authorization");
    const token = authHeader?.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length).trim()
      : null;

    if (!token) {
      return NextResponse.json(
        { error: "로그인이 필요합니다." },
        { status: 401 },
      );
    }

    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    const userId = userData.user?.id;

    if (userError || !userId) {
      return NextResponse.json(
        { error: "로그인이 필요합니다." },
        { status: 401 },
      );
    }

    const { data: churchData, error: churchError } = await supabase
      .from("churches")
      .select("id")
      .eq("id", churchId)
      .maybeSingle();

    if (churchError || !churchData?.id) {
      return NextResponse.json(
        { error: "교회를 찾을 수 없습니다." },
        { status: 404 },
      );
    }

    const { data: existing, error: existingError } = await supabase
      .from("church_users")
      .select("id")
      .eq("user_id", userId)
      .eq("church_id", churchId)
      .maybeSingle();

    if (existingError) {
      console.error("[church/join] 기존 가입 확인 실패:", existingError.message);
      return NextResponse.json(
        { error: "교회 신청에 실패했습니다." },
        { status: 500 },
      );
    }

    if (existing?.id) {
      return NextResponse.json({ ok: true, alreadyJoined: true });
    }

    const { error: joinError } = await supabase.from("church_users").insert({
      user_id: userId,
      church_id: churchId,
      role: "member",
    });

    if (joinError) {
      const msg = joinError.message.toLowerCase();
      if (
        joinError.code === "23505" ||
        msg.includes("duplicate") ||
        msg.includes("unique")
      ) {
        return NextResponse.json({ ok: true, alreadyJoined: true });
      }
      console.error("[church/join] 가입 실패:", joinError.message);
      return NextResponse.json(
        { error: "교회 신청에 실패했습니다." },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[church/join] 예외:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "교회 신청 실패" },
      { status: 500 },
    );
  }
}
