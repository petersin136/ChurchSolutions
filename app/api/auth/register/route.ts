import { NextResponse } from "next/server";
import { getAnonSupabase, getServiceSupabase } from "@/lib/supabase";
import { isValidAuthEmail, toKoreanAuthError } from "@/lib/authErrors";

interface RegisterBody {
  email: string;
  password: string;
}

export async function POST(request: Request) {
  let createdUserId: string | null = null;
  const supabase = getServiceSupabase();

  try {
    const body = (await request.json()) as Partial<RegisterBody>;
    const email = body.email?.trim();
    const password = body.password;

    if (!email || !password) {
      return NextResponse.json(
        { error: "이메일과 비밀번호를 모두 입력해주세요." },
        { status: 400 }
      );
    }
    if (!isValidAuthEmail(email)) {
      return NextResponse.json(
        { error: "올바른 이메일 형식을 입력해주세요. (예: name@example.com)" },
        { status: 400 }
      );
    }
    if (password.length < 8) {
      return NextResponse.json(
        { error: "비밀번호는 8자 이상이어야 합니다." },
        { status: 400 }
      );
    }
    if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
      return NextResponse.json(
        { error: "비밀번호는 영문과 숫자를 모두 포함해야 합니다." },
        { status: 400 }
      );
    }

    const anonClient = getAnonSupabase();
    const { data: signUpData, error: signUpError } = await anonClient.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/auth/confirmed?email=${encodeURIComponent(email)}`,
      },
    });

    if (signUpError || !signUpData.user?.id) {
      return NextResponse.json(
        {
          error: toKoreanAuthError(
            signUpError?.message ?? signUpError,
            "회원가입에 실패했습니다. 입력 정보를 확인해주세요."
          ),
        },
        { status: 400 }
      );
    }
    createdUserId = signUpData.user.id;

    console.log("[register] 인증 메일 발송 완료:", email);

    return NextResponse.json({
      ok: true,
      userId: createdUserId,
      requiresEmailConfirmation: true,
    });
  } catch (e) {
    console.error("[register] 예외:", e);
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
