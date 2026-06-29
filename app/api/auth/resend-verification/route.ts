import { NextResponse } from "next/server";
import { getAnonSupabase } from "@/lib/supabase";

interface ResendVerificationBody {
  email: string;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<ResendVerificationBody>;
    const email = body.email?.trim();

    if (!email) {
      return NextResponse.json(
        { error: "이메일이 필요합니다." },
        { status: 400 },
      );
    }

    const anonClient = getAnonSupabase();
    const { error: mailError } = await anonClient.auth.resend({
      type: "signup",
      email,
      options: {
        emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/login`,
      },
    });

    if (mailError) {
      console.error("[resend-verification] 발송 실패:", mailError.message);
      return NextResponse.json(
        { error: mailError.message || "인증 메일 재발송에 실패했습니다." },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[resend-verification] 예외:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "인증 메일 재발송 실패" },
      { status: 500 },
    );
  }
}
