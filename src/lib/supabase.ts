import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

let supabaseInstance: SupabaseClient | null = null;

function getSupabase(): SupabaseClient | null {
  if (!supabaseUrl || !supabaseAnonKey) return null;
  if (!supabaseInstance) {
    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        storageKey: "church-solution-auth",
        storage: typeof window !== "undefined" ? window.localStorage : undefined,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    });
  }
  return supabaseInstance;
}

/** 브라우저/클라이언트용 싱글턴. auth lock 충돌 방지. */
export const supabase = getSupabase();

/** 서버 전용 (API Route). env 없으면 throw. anon 클라이언트와 별도 인스턴스. */
export function getServiceSupabase(): SupabaseClient {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey || !supabaseUrl) throw new Error("Supabase env not set");
  return createClient(supabaseUrl, serviceKey);
}

/**
 * Supabase Storage에 저장된 성도 프로필 이미지 URL에서 파일 경로를 추출해 삭제.
 * URL 예: .../storage/v1/object/public/member-photos/member-id.jpg 또는 .../object/sign/...
 */
export async function deleteMemberPhotoFromStorage(imageUrl: string | undefined): Promise<void> {
  const client = getSupabase();
  if (!client || !imageUrl || typeof imageUrl !== "string") return;
  const part =
    imageUrl.split("/storage/v1/object/public/")[1] ||
    imageUrl.split("/storage/v1/object/sign/")[1];
  if (!part) return;
  const pathPart = part.split("?")[0];
  const segments = pathPart.split("/");
  const bucket = segments[0];
  const filePath = segments.slice(1).join("/");
  if (bucket && filePath) {
    try {
      await client.storage.from(bucket).remove([filePath]);
    } catch (e) {
      console.warn("[deleteMemberPhotoFromStorage]", e);
    }
  }
}
