/** 이름 → 표시 이니셜 (한글 성 1자 / 영문 2자 등) */
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

/** 한글 이름 성(첫 글자). 영문은 initialsFromName 과 동일 */
export function surnameInitialFromName(name: string | undefined | null): string {
  return initialsFromName(name?.trim() || "");
}

export function hashPickChartIndex(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  }
  return Math.abs(h) % 8;
}

/** 성이니셜 아바타용 부드러운 파스텔 팔레트 */
const SURNAME_AVATAR_PALETTE = [
  { bg: "#eceaf6", fg: "#6b63a0" },
  { bg: "#e8f0ff", fg: "#4a6fc7" },
  { bg: "#eaf7f0", fg: "#3d9a68" },
  { bg: "#fff0e6", fg: "#c46a2f" },
  { bg: "#f3eaf8", fg: "#8a55b5" },
  { bg: "#e8f6f7", fg: "#2f8f96" },
  { bg: "#fdecee", fg: "#c45a6a" },
  { bg: "#f5f0e8", fg: "#8a7355" },
] as const;

export function surnameAvatarColors(seed: string): { bg: string; fg: string } {
  return SURNAME_AVATAR_PALETTE[hashPickChartIndex(seed.trim() || "?")] ?? SURNAME_AVATAR_PALETTE[0];
}
