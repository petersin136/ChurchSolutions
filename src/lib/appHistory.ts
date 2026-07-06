/** 브라우저 history.state 에 앱 내비게이션을 기록할 때 쓰는 키 */
export const APP_HISTORY_KEYS = {
  page: "__appPage",
  pastoralSub: "__pastoralSub",
} as const;

export type AppHistoryState = {
  [APP_HISTORY_KEYS.page]?: string;
  [APP_HISTORY_KEYS.pastoralSub]?: string;
};

export function readAppHistoryState(): AppHistoryState {
  if (typeof window === "undefined") return {};
  const raw = window.history.state as AppHistoryState | null;
  return raw ? { ...raw } : {};
}

export function mergePushAppHistory(patch: AppHistoryState) {
  if (typeof window === "undefined") return;
  try {
    window.history.pushState({ ...readAppHistoryState(), ...patch }, "");
  } catch {}
}

export function mergeReplaceAppHistory(patch: AppHistoryState) {
  if (typeof window === "undefined") return;
  try {
    window.history.replaceState({ ...readAppHistoryState(), ...patch }, "");
  } catch {}
}
