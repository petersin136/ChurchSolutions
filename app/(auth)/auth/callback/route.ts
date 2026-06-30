import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const { searchParams, origin } = requestUrl;

  if (searchParams.get("error")) {
    return NextResponse.redirect(new URL("/login?error=oauth", origin));
  }

  const code = searchParams.get("code");
  if (code) {
    try {
      const supabase = await createSupabaseServerClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        console.error("[auth/callback] exchangeCodeForSession:", error.message);
        return NextResponse.redirect(new URL("/login?error=oauth", origin));
      }
    } catch (err) {
      console.error("[auth/callback]", err);
      return NextResponse.redirect(new URL("/login?error=auth", origin));
    }
  }

  const next = searchParams.get("next")?.trim() || "/";
  const destination = next.startsWith("/") ? next : "/";
  return NextResponse.redirect(new URL(destination, origin));
}
