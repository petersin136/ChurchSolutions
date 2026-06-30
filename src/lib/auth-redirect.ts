/** OAuth 완료 후 돌아올 콜백 경로 (Supabase 대시보드 Redirect URLs에도 등록 필요) */
export const AUTH_CALLBACK_PATH = "/auth/callback";

/** http(s) URL인지, hostname이 null/비어 있지 않은지 */
export function isValidHttpUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== "string") return false;
  const trimmed = url.trim();
  if (!trimmed || trimmed === "null" || trimmed === "undefined") return false;
  try {
    const parsed = new URL(trimmed);
    return (
      (parsed.protocol === "http:" || parsed.protocol === "https:") &&
      Boolean(parsed.hostname) &&
      parsed.hostname !== "null" &&
      parsed.hostname !== "undefined"
    );
  } catch {
    return false;
  }
}

/** 앱 사이트 origin (프로덕션·모바일 우선: env → 브라우저) */
export function resolveSiteOrigin(): string | null {
  const envSite = (process.env.NEXT_PUBLIC_SITE_URL ?? "").trim().replace(/\/$/, "");
  if (envSite && isValidHttpUrl(envSite)) return envSite;

  if (typeof window !== "undefined") {
    const { origin, protocol, hostname } = window.location;
    if (origin && protocol.startsWith("http") && hostname && hostname !== "null") {
      return origin;
    }
  }

  return null;
}

/**
 * Supabase signInWithOAuth redirectTo URL.
 * NEXT_PUBLIC_SITE_URL 이 있으면 모바일에서도 동일 origin 사용.
 */
export function getOAuthRedirectUrl(next = "/"): string {
  const callback = `${AUTH_CALLBACK_PATH}?next=${encodeURIComponent(next)}`;
  const origin = resolveSiteOrigin();
  if (origin) return `${origin}${callback}`;
  return `http://localhost:3000${callback}`;
}
