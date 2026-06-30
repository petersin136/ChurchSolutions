/** OAuth 완료 후 돌아올 콜백 경로 (Supabase 대시보드 Redirect URLs에도 등록 필요) */
export const AUTH_CALLBACK_PATH = "/auth/callback";

/**
 * Supabase signInWithOAuth redirectTo URL.
 * 모바일에서 window.location.origin 이 비정상이면 NEXT_PUBLIC_SITE_URL 사용.
 */
export function getOAuthRedirectUrl(next = "/"): string {
  const callback = `${AUTH_CALLBACK_PATH}?next=${encodeURIComponent(next)}`;

  if (typeof window !== "undefined") {
    const { origin, protocol, hostname } = window.location;
    if (origin && protocol.startsWith("http") && hostname && hostname !== "null") {
      return `${origin}${callback}`;
    }
  }

  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
  if (site) return `${site}${callback}`;

  return `http://localhost:3000${callback}`;
}
