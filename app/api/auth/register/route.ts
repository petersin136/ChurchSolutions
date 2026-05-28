import { NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";

interface RegisterBody {
  email: string;
  password: string;
  churchName: string;
}

export async function POST(request: Request) {
  let createdUserId: string | null = null;
  let createdChurchId: string | null = null;
  const supabase = getServiceSupabase();

  try {
    // 1. 입력 파싱 및 검증
    const body = (await request.json()) as Partial<RegisterBody>;
    const email = body.email?.trim();
    const password = body.password;
    const churchName = body.churchName?.trim();

    if (!email || !password || !churchName) {
      return NextResponse.json(
        { error: "이메일, 비밀번호, 교회명을 모두 입력해주세요." },
        { status: 400 }
      );
    }
    if (password.length < 6) {
      return NextResponse.json(
        { error: "비밀번호는 6자 이상이어야 합니다." },
        { status: 400 }
      );
    }

    // 2. auth.signUp — service_role의 admin API 사용
    //    email_confirm: false → 이메일 인증 메일 발송 (기존 동작 유지)
    const { data: userData, error: signUpError } =
      await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: false,
      });

    if (signUpError || !userData.user?.id) {
      const msg = signUpError?.message ?? "";
      if (msg.includes("already registered") || msg.includes("already been registered")) {
        return NextResponse.json(
          { error: "이미 등록된 이메일입니다." },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: msg || "사용자 생성에 실패했습니다." },
        { status: 500 }
      );
    }
    createdUserId = userData.user.id;

    // 2-1. 인증 메일 발송 트리거
    //      admin.createUser는 메일을 자동 발송하지 않으므로,
    //      generateLink로 signup 인증 링크 생성 및 메일 발송을 명시적으로 호출.
    //      실패해도 가입 자체는 진행 (사용자가 비번 재설정으로 우회 가능).
    const { error: mailError } = await supabase.auth.admin.generateLink({
      type: "signup",
      email,
      password,
    });
    if (mailError) {
      console.warn("[register] 인증 메일 발송 실패 (가입은 진행):", mailError.message);
    } else {
      console.log("[register] 인증 메일 발송 완료:", email);
    }

    // 3. churches INSERT
    const { data: churchData, error: churchError } = await supabase
      .from("churches")
      .insert({ name: churchName })
      .select("id")
      .single();

    if (churchError || !churchData?.id) {
      // 롤백: auth user 삭제
      try {
        const { error: rbAuthErr } = await supabase.auth.admin.deleteUser(createdUserId);
        if (rbAuthErr) {
          console.error("[register] auth rollback 실패:", rbAuthErr.message);
        } else {
          console.log("[register] auth rollback 성공:", createdUserId);
        }
      } catch (rbEx) {
        console.error("[register] auth rollback 예외:", rbEx);
      }
      return NextResponse.json(
        { error: `교회 생성 실패: ${churchError?.message ?? "unknown"}` },
        { status: 500 }
      );
    }
    createdChurchId = churchData.id;

    // 4. church_users INSERT (admin 권한)
    const { error: linkError } = await supabase
      .from("church_users")
      .insert({
        user_id: createdUserId,
        church_id: createdChurchId,
        role: "admin",
      });

    if (linkError) {
      // 롤백: churches 삭제 → auth user 삭제
      try {
        const { error: rbChurchErr } = await supabase
          .from("churches")
          .delete()
          .eq("id", createdChurchId);
        if (rbChurchErr) {
          console.error("[register] churches rollback 실패:", rbChurchErr.message);
        } else {
          console.log("[register] churches rollback 성공:", createdChurchId);
        }
      } catch (rbEx) {
        console.error("[register] churches rollback 예외:", rbEx);
      }
      try {
        const { error: rbAuthErr } = await supabase.auth.admin.deleteUser(createdUserId);
        if (rbAuthErr) {
          console.error("[register] auth rollback 실패:", rbAuthErr.message);
        } else {
          console.log("[register] auth rollback 성공:", createdUserId);
        }
      } catch (rbEx) {
        console.error("[register] auth rollback 예외:", rbEx);
      }
      return NextResponse.json(
        { error: `권한 연결 실패: ${linkError.message}` },
        { status: 500 }
      );
    }

    // 5. settings INSERT (실패해도 진행 — 기존 동작 유지)
    const { error: settingsError } = await supabase
      .from("settings")
      .insert({
        church_id: createdChurchId,
        church_name: churchName,
        depts: "장년부,청년부,중고등부,초등부,유치부,영아부",
      });

    if (settingsError) {
      console.warn("[register] settings insert 실패 (진행 계속):", settingsError.message);
    }

    // 6. 성공 응답
    return NextResponse.json({
      ok: true,
      userId: createdUserId,
      churchId: createdChurchId,
      requiresEmailConfirmation: true,
    });
  } catch (e) {
    console.error("[register] 예외:", e);
    if (createdChurchId) {
      try {
        const { error: rbChurchErr } = await supabase
          .from("churches")
          .delete()
          .eq("id", createdChurchId);
        if (rbChurchErr) {
          console.error("[register] churches rollback 실패:", rbChurchErr.message);
        } else {
          console.log("[register] churches rollback 성공:", createdChurchId);
        }
      } catch (rbEx) {
        console.error("[register] churches rollback 예외:", rbEx);
      }
    }
    if (createdUserId) {
      try {
        const { error: rbAuthErr } = await supabase.auth.admin.deleteUser(createdUserId);
        if (rbAuthErr) {
          console.error("[register] auth rollback 실패:", rbAuthErr.message);
        } else {
          console.log("[register] auth rollback 성공:", createdUserId);
        }
      } catch (rbEx) {
        console.error("[register] auth rollback 예외:", rbEx);
      }
    }
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "회원가입 실패" },
      { status: 500 }
    );
  }
}
