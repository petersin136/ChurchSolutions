const KEEP_KEY = "church_solution_keep_logged_in";
const EMAIL_KEY = "church_solution_saved_login_email";

const REMEMBER_LOGIN_KEYS = [KEEP_KEY, EMAIL_KEY] as const;

export function loadKeepLoggedIn(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(KEEP_KEY) === "1";
  } catch {
    return false;
  }
}

export function loadRememberedLoginEmail(): string {
  if (!loadKeepLoggedIn()) return "";
  try {
    return localStorage.getItem(EMAIL_KEY)?.trim() ?? "";
  } catch {
    return "";
  }
}

export function saveRememberedLogin(email: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEEP_KEY, "1");
    localStorage.setItem(EMAIL_KEY, email.trim());
  } catch {
    // ignore quota / private mode
  }
}

export function clearRememberedLogin(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(KEEP_KEY);
    localStorage.removeItem(EMAIL_KEY);
  } catch {
    // ignore
  }
}

/** 로그아웃이 localStorage 를 비워도, 체크해 둔 이메일은 남긴다. */
export function snapshotRememberedLogin(): [string, string][] {
  if (typeof window === "undefined") return [];
  const entries: [string, string][] = [];
  try {
    for (const key of REMEMBER_LOGIN_KEYS) {
      const value = localStorage.getItem(key);
      if (value !== null) entries.push([key, value]);
    }
  } catch {
    return [];
  }
  return entries;
}

export function restoreRememberedLogin(entries: [string, string][]): void {
  if (typeof window === "undefined") return;
  try {
    for (const [key, value] of entries) {
      if ((REMEMBER_LOGIN_KEYS as readonly string[]).includes(key)) {
        localStorage.setItem(key, value);
      }
    }
  } catch {
    // ignore
  }
}

/**
 * 비밀번호는 앱에 저장하지 않는다.
 * Chrome 은 사용자 클릭이 살아있는 동안 store() 를 호출해야 저장 창을 띄운다.
 * 로그인 요청을 기다린 뒤에 호출하면 클릭이 만료되어 저장이 무시된다.
 */
export function requestBrowserPasswordSave(
  form: HTMLFormElement,
  email: string,
  password: string
): void {
  const PasswordCredentialCtor = (
    window as Window & {
      PasswordCredential?: new (
        data: HTMLFormElement | { id: string; password: string }
      ) => Credential;
    }
  ).PasswordCredential;
  if (!PasswordCredentialCtor || !navigator.credentials?.store) return;

  try {
    let cred: Credential;
    try {
      cred = new PasswordCredentialCtor(form);
    } catch {
      cred = new PasswordCredentialCtor({ id: email, password });
    }
    void navigator.credentials.store(cred);
  } catch {
    // Credential API 미지원/거부
  }
}
