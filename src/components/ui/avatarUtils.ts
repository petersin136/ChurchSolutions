/** 이름 → 표시 이니셜 (한글 1자 / 영문 2자 등) */
export function initialsFromName(name: string): string {
  const t = name.trim();
  if (!t) return "?";
  const parts = t.split(/\s+/).filter(Boolean);
  const isMostlyLatin = /^[a-zA-Z\s.'-]+$/.test(t);
  if (isMostlyLatin && parts.length >= 2) {
    const a = parts[0][0]?.toUpperCase() ?? "";
    const b = parts[parts.length - 1][0]?.toUpperCase() ?? "";
    return (a + b).slice(0, 2);
  }
  const first = Array.from(t)[0];
  return first ?? "?";
}

export function hashPickChartIndex(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  }
  return Math.abs(h) % 8;
}
