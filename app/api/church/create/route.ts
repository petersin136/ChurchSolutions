import { NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";

interface CreateChurchBody {
  churchName: string;
  pastorName?: string | null;
}

export async function POST(request: Request) {
  let createdChurchId: string | null = null;
  const supabase = getServiceSupabase();

  try {
    const body = (await request.json()) as Partial<CreateChurchBody>;
    const churchName = body.churchName?.trim();
    const pastorName = body.pastorName?.trim() || null;

    if (!churchName) {
      return NextResponse.json(
        { error: "교회 이름을 입력해주세요." },
        { status: 400 },
      );
    }

    if (!pastorName) {
      return NextResponse.json(
        { error: "담임목사 이름을 입력해주세요." },
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
      .insert({ name: churchName, pastor_name: pastorName })
      .select("id")
      .single();

    if (churchError || !churchData?.id) {
      console.error("[church/create] 교회 생성 실패:", churchError?.message);
      return NextResponse.json(
        { error: "교회 생성에 실패했습니다." },
        { status: 500 },
      );
    }
    createdChurchId = churchData.id;

    const { error: linkError } = await supabase.from("church_users").insert({
      church_id: createdChurchId,
      user_id: userId,
      role: "admin",
    });

    if (linkError) {
      console.error("[church/create] 관리자 연결 실패:", linkError.message);
      try {
        const { error: rbChurchErr } = await supabase
          .from("churches")
          .delete()
          .eq("id", createdChurchId);
        if (rbChurchErr) {
          console.error("[church/create] churches rollback 실패:", rbChurchErr.message);
        } else {
          console.log("[church/create] churches rollback 성공:", createdChurchId);
        }
      } catch (rbEx) {
        console.error("[church/create] churches rollback 예외:", rbEx);
      }
      return NextResponse.json(
        { error: "교회 생성에 실패했습니다." },
        { status: 500 },
      );
    }

    const { error: settingsError } = await supabase.from("settings").insert({
      church_id: createdChurchId,
      church_name: churchName,
      depts: "장년부,청년부,중고등부,초등부,유치부,영아부",
    });

    if (settingsError) {
      console.warn("[church/create] settings insert 실패 (진행 계속):", settingsError.message);
    }

    return NextResponse.json({
      ok: true,
      churchId: createdChurchId,
      churchName,
    });
  } catch (e) {
    console.error("[church/create] 예외:", e);
    if (createdChurchId) {
      try {
        const { error: rbChurchErr } = await supabase
          .from("churches")
          .delete()
          .eq("id", createdChurchId);
        if (rbChurchErr) {
          console.error("[church/create] churches rollback 실패:", rbChurchErr.message);
        } else {
          console.log("[church/create] churches rollback 성공:", createdChurchId);
        }
      } catch (rbEx) {
        console.error("[church/create] churches rollback 예외:", rbEx);
      }
    }
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "교회 개설 실패" },
      { status: 500 },
    );
  }
}
