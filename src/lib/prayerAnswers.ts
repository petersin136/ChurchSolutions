/** 기도 응답완료 — note id 기준으로 저장 (내용/날짜 키는 불안정해서 쓰지 않음) */

export type PrayerAnswerRecord = {
  answeredAt: string;
  comment?: string;
};

function storageKey(churchId: string): string {
  return `church_solution_answered_prayers_${churchId}`;
}

export function isRemoteNoteId(id: string | number | null | undefined): boolean {
  if (id == null) return false;
  if (typeof id === "number") return true;
  if (typeof id !== "string") return false;
  if (id.startsWith("local-") || id.startsWith("profile-")) return false;
  return /^[0-9a-f-]{8,}$/i.test(id);
}

export function loadAnsweredPrayersFromStorage(
  churchId: string,
): Record<string, PrayerAnswerRecord> {
  if (typeof window === "undefined" || !churchId) return {};
  try {
    const raw = localStorage.getItem(storageKey(churchId));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, PrayerAnswerRecord | string>;
    if (!parsed || typeof parsed !== "object") return {};
    const out: Record<string, PrayerAnswerRecord> = {};
    for (const [id, value] of Object.entries(parsed)) {
      if (typeof value === "string") {
        out[id] = { answeredAt: value };
      } else if (value && typeof value === "object" && typeof value.answeredAt === "string") {
        out[id] = {
          answeredAt: value.answeredAt,
          ...(typeof value.comment === "string" ? { comment: value.comment } : {}),
        };
      }
    }
    return out;
  } catch {
    return {};
  }
}

export function saveAnsweredPrayersToStorage(
  churchId: string,
  records: Record<string, PrayerAnswerRecord>,
): void {
  if (typeof window === "undefined" || !churchId) return;
  try {
    localStorage.setItem(storageKey(churchId), JSON.stringify(records));
  } catch {
    /* ignore quota */
  }
}

/** UI/맵 키: 원격 note id면 id 기준, 아니면 레거시 내용 키 */
export function prayerAnswerKeyFromParts(params: {
  memberId: string;
  noteId?: string | number | null;
  date: string;
  createdAt: string;
  content: string;
}): string {
  if (isRemoteNoteId(params.noteId)) return `id\t${String(params.noteId)}`;
  return `note\t${params.memberId}\t${params.date}\t${params.createdAt}\t${params.content}`;
}

export function answeredNoteIdFromKey(key: string): string | null {
  if (key.startsWith("id\t")) return key.slice(3);
  return null;
}
