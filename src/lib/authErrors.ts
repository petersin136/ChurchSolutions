/** RFC5322 간략 — 로컬@도메인.확장자 */
export const AUTH_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function isValidAuthEmail(email: string): boolean {
  return AUTH_EMAIL_RE.test(email.trim());
}

function extractAuthErrorText(raw: unknown): string {
  if (raw == null) return "";
  if (typeof raw === "string") return raw.trim();
  if (typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    if (typeof obj.message === "string") return obj.message.trim();
    if (typeof obj.error === "string") return obj.error.trim();
    if (typeof obj.error_description === "string") return obj.error_description.trim();
  }
  return "";
}

/** 회원가입·인증 API 오류 → 사용자용 한글 메시지 */
export function toKoreanAuthError(raw: unknown, fallback = "요청을 처리하지 못했습니다. 잠시 후 다시 시도해주세요."): string {
  const msg = extractAuthErrorText(raw);
  const lower = msg.toLowerCase();

  if (!msg || msg === "{}" || lower === "[object object]") {
    return fallback;
  }

  if (lower.includes("after") && lower.includes("seconds")) {
    const m = lower.match(/(\d+)\s*seconds?/);
    return m ? `보안을 위해 ${m[1]}초 후에 다시 시도할 수 있어요.` : "잠시 후에 다시 시도해주세요.";
  }

  if (lower.includes("already confirmed")) {
    return "이미 인증이 완료된 계정이에요. 로그인해주세요.";
  }

  if (
    (lower.includes("invalid") && lower.includes("email")) ||
    lower.includes("unable to validate email") ||
    lower.includes("email address is invalid") ||
    lower.includes("valid email")
  ) {
    return "올바른 이메일 형식을 입력해주세요. (예: name@example.com)";
  }

  if (lower.includes("already registered") || lower.includes("already been registered") || lower.includes("user already registered")) {
    return "이미 등록된 이메일입니다. 로그인하거나 다른 이메일을 사용해주세요.";
  }

  if (lower.includes("password") && (lower.includes("weak") || lower.includes("short") || lower.includes("least"))) {
    return "비밀번호는 영문과 숫자를 포함해 8자 이상으로 설정해주세요.";
  }

  if (lower.includes("rate limit") || lower.includes("too many")) {
    return "요청이 많아요. 잠시 후 다시 시도해주세요.";
  }

  if (lower.includes("network") || lower.includes("fetch")) {
    return "네트워크 오류가 발생했습니다. 연결을 확인한 뒤 다시 시도해주세요.";
  }

  return msg;
}
