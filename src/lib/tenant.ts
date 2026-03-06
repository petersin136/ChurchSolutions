type Row = Record<string, unknown>;

export function getChurchId(): string {
  const id = process.env.NEXT_PUBLIC_CHURCH_ID;
  if (!id) {
    // 테스트 단계에서 설정 누락 시 조용히 실패하면 데이터가 church_id 없이 저장될 수 있음
    throw new Error("NEXT_PUBLIC_CHURCH_ID is not set");
  }
  return id;
}

export function withChurchId<T extends Row>(row: T): T & { church_id: string };
export function withChurchId<T extends Row>(rows: T[]): (T & { church_id: string })[];
export function withChurchId<T extends Row>(input: T | T[]) {
  const church_id = getChurchId();
  if (Array.isArray(input)) return input.map((r) => ({ ...r, church_id }));
  return { ...input, church_id };
}

// Select builder에 church_id 필터를 일괄 적용 (타입은 느슨하게 유지)
export function filterByChurch<TQuery extends { eq: (col: string, val: unknown) => TQuery }>(q: TQuery): TQuery {
  return q.eq("church_id", getChurchId());
}

