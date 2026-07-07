export const SMALL_GROUP_TERM_KEY = "pastoral_org_small_group_term";
export const DEFAULT_SMALL_GROUP_TERM = "소그룹";

/** 한국 교회에서 쓰는 소그룹 명칭 예시 */
export const SMALL_GROUP_TERM_PRESETS: { term: string; leader: string }[] = [
  { term: "목장", leader: "목자" },
  { term: "셀", leader: "셀 리더" },
  { term: "구역", leader: "구역장" },
  { term: "속", leader: "속장" },
  { term: "전도회", leader: "회장" },
  { term: "선교회", leader: "회장" },
];

export const SMALL_GROUP_TERM_EXAMPLES = SMALL_GROUP_TERM_PRESETS.map((p) => p.term).join(", ");

export const SMALL_GROUP_TERM_CHANGED_EVENT = "churchup:small-group-term-changed";

export function inferLeaderLabelFromTerm(term: string): string {
  const trimmed = term.trim();
  if (!trimmed || trimmed === DEFAULT_SMALL_GROUP_TERM) return "리더";
  const preset = SMALL_GROUP_TERM_PRESETS.find((p) => p.term === trimmed);
  if (preset) return preset.leader;
  if (trimmed.endsWith("회")) return "회장";
  return `${trimmed} 리더`;
}

export function loadSmallGroupTerm(churchId: string): string {
  if (typeof window === "undefined" || !churchId) return "";
  try {
    const stored = localStorage.getItem(`${SMALL_GROUP_TERM_KEY}_${churchId}`)?.trim() ?? "";
    if (!stored || stored === DEFAULT_SMALL_GROUP_TERM) return "";
    return stored;
  } catch {
    return "";
  }
}

export function saveSmallGroupTerm(churchId: string, term: string) {
  if (typeof window === "undefined" || !churchId) return;
  const trimmed = term.trim();
  const normalized = !trimmed || trimmed === DEFAULT_SMALL_GROUP_TERM ? "" : trimmed;
  if (!normalized) {
    localStorage.removeItem(`${SMALL_GROUP_TERM_KEY}_${churchId}`);
  } else {
    localStorage.setItem(`${SMALL_GROUP_TERM_KEY}_${churchId}`, normalized);
  }
  window.dispatchEvent(
    new CustomEvent(SMALL_GROUP_TERM_CHANGED_EVENT, { detail: { churchId, term: normalized } }),
  );
}

export function displaySmallGroupTermInput(term: string): string {
  const trimmed = term.trim();
  if (!trimmed || trimmed === DEFAULT_SMALL_GROUP_TERM) return "";
  return trimmed;
}

export function normalizeSmallGroupTerm(value: string): string {
  const trimmed = value.trim();
  return !trimmed || trimmed === DEFAULT_SMALL_GROUP_TERM ? "" : trimmed;
}
