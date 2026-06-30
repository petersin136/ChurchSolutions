const PENDING_LOGIN_EMAIL_KEY = "church_solution_pending_login_email";
const PENDING_LOGIN_EXPIRES_KEY = "church_solution_pending_login_expires";
const PENDING_LOGIN_TTL_MS = 30 * 60 * 1000;

export function savePendingLoginEmail(email: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(PENDING_LOGIN_EMAIL_KEY, email.trim());
    localStorage.setItem(PENDING_LOGIN_EXPIRES_KEY, String(Date.now() + PENDING_LOGIN_TTL_MS));
  } catch {
    // ignore quota / private mode
  }
}

export function loadPendingLoginEmail(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const expires = Number(localStorage.getItem(PENDING_LOGIN_EXPIRES_KEY) ?? 0);
    if (!expires || Date.now() > expires) {
      clearPendingLoginEmail();
      return null;
    }
    const email = localStorage.getItem(PENDING_LOGIN_EMAIL_KEY)?.trim() ?? "";
    return email || null;
  } catch {
    return null;
  }
}

export function clearPendingLoginEmail(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(PENDING_LOGIN_EMAIL_KEY);
    localStorage.removeItem(PENDING_LOGIN_EXPIRES_KEY);
    localStorage.removeItem("church_solution_pending_login_password");
  } catch {
    // ignore
  }
}

export function getInitialLoginEmail(): string {
  return loadPendingLoginEmail() ?? "";
}
