import { NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";

interface CheckVerificationBody {
  email: string;
}

async function findUserByEmail(
  supabase: ReturnType<typeof getServiceSupabase>,
  email: string,
) {
  const normalized = email.trim().toLowerCase();
  let page = 1;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 200,
    });

    if (error) {
      throw error;
    }

    const user = data.users.find(
      (u) => u.email?.trim().toLowerCase() === normalized,
    );
    if (user) return user;

    if (data.users.length < 200) break;
    page += 1;
  }

  return null;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<CheckVerificationBody>;
    const email = body.email?.trim();

    if (!email) {
      return NextResponse.json(
        { error: "이메일을 입력해주세요." },
        { status: 400 },
      );
    }

    const supabase = getServiceSupabase();
    const user = await findUserByEmail(supabase, email);

    if (!user) {
      return NextResponse.json({ verified: false });
    }

    const verified = Boolean(user.email_confirmed_at ?? user.confirmed_at);

    return NextResponse.json({ verified });
  } catch (e) {
    console.error("[check-verification] 예외:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "인증 상태 확인 실패" },
      { status: 500 },
    );
  }
}
