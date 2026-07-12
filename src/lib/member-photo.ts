import { supabase } from "@/lib/supabase";

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
const BUCKET = "member-photos";

/** DB·Storage에 저장 가능한 http(s) URL인지 */
export function isPersistableMemberPhotoUrl(url: string | undefined | null): boolean {
  if (!url?.trim()) return false;
  const u = url.trim();
  return u.startsWith("http://") || u.startsWith("https://");
}

/** blob/data 미리보기 — 새로고침 후 무효 */
export function isEphemeralMemberPhotoUrl(url: string | undefined | null): boolean {
  if (!url?.trim()) return false;
  const u = url.trim().toLowerCase();
  return u.startsWith("blob:") || u.startsWith("data:");
}

/** 시드/외부 생성 아바타(dicebear 등) — 표시하지 않고 성이니셜로 대체 */
export function isGeneratedAvatarUrl(url: string | undefined | null): boolean {
  if (!url?.trim()) return false;
  const u = url.trim().toLowerCase();
  return (
    u.includes("dicebear.com") ||
    u.includes("api.dicebear.com") ||
    u.includes("avataaars") ||
    u.includes("ui-avatars.com") ||
    u.includes("robohash.org")
  );
}

/** members.photo 값(URL 또는 storage path)에서 버킷 내 경로 추출 */
export function extractMemberPhotoStoragePath(photo: string | undefined | null): string | null {
  if (!photo?.trim()) return null;
  const trimmed = photo.trim();
  if (isEphemeralMemberPhotoUrl(trimmed)) return null;

  const publicIdx = trimmed.indexOf("/storage/v1/object/public/member-photos/");
  if (publicIdx >= 0) {
    return decodeURIComponent(trimmed.slice(publicIdx + "/storage/v1/object/public/member-photos/".length).split("?")[0]);
  }

  const signIdx = trimmed.indexOf("/storage/v1/object/sign/member-photos/");
  if (signIdx >= 0) {
    return decodeURIComponent(trimmed.slice(signIdx + "/storage/v1/object/sign/member-photos/".length).split("?")[0]);
  }

  const bucketIdx = trimmed.indexOf("member-photos/");
  if (bucketIdx >= 0 && trimmed.startsWith("http")) {
    return decodeURIComponent(trimmed.slice(bucketIdx + "member-photos/".length).split("?")[0]);
  }

  if (!trimmed.includes("://") && !trimmed.startsWith("/")) {
    return trimmed.split("?")[0];
  }

  return null;
}

/** 동기 fallback — public URL 조합 (버킷 공개 시) */
export function normalizeMemberPhotoDisplayUrl(photo: string | undefined | null): string | undefined {
  if (!photo?.trim()) return undefined;
  const trimmed = photo.trim();
  if (isEphemeralMemberPhotoUrl(trimmed) || isGeneratedAvatarUrl(trimmed)) return undefined;

  const path = extractMemberPhotoStoragePath(trimmed);
  if (path && SUPABASE_URL) {
    return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
  }

  return isPersistableMemberPhotoUrl(trimmed) ? trimmed.split("?")[0] : undefined;
}

/** 표시용 URL — signed URL 우선 (비공개 버킷 대응) */
export async function resolveMemberPhotoSrc(photo: string | undefined | null): Promise<string | undefined> {
  if (!photo?.trim() || isEphemeralMemberPhotoUrl(photo) || isGeneratedAvatarUrl(photo)) return undefined;

  const path = extractMemberPhotoStoragePath(photo);
  if (path && supabase) {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60 * 24);
    if (!error && data?.signedUrl) return data.signedUrl;
  }

  return normalizeMemberPhotoDisplayUrl(photo);
}

export function getMemberPhotoDisplaySrc(photo: string | undefined | null): string | undefined {
  return normalizeMemberPhotoDisplayUrl(photo);
}

/**
 * DB 저장 값 — storage path 우선 (만료 없음), 없으면 정규화된 public URL
 */
export function getMemberPhotoForSave(serverUrl: string, previewUrl: string): string | null {
  const path =
    extractMemberPhotoStoragePath(serverUrl) ||
    extractMemberPhotoStoragePath(previewUrl);
  if (path) return path;

  const normalized =
    normalizeMemberPhotoDisplayUrl(serverUrl) ||
    normalizeMemberPhotoDisplayUrl(previewUrl);
  return normalized ?? null;
}
