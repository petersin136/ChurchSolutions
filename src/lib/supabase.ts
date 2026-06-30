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
        flowType: "pkce",
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

/** API Route 등 서버에서 anon 키로 auth.signUp 호출용 (커스텀 인증 메일 템플릿 적용) */
export function getAnonSupabase(): SupabaseClient {
  if (!supabaseUrl || !supabaseAnonKey) throw new Error("Supabase env not set");
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

import { extractMemberPhotoStoragePath } from "@/lib/member-photo";

/**
 * Supabase Storage에 저장된 성도 프로필 이미지(URL 또는 storage path) 삭제.
 */
export async function deleteMemberPhotoFromStorage(imageUrl: string | undefined): Promise<void> {
  const client = getSupabase();
  if (!client || !imageUrl || typeof imageUrl !== "string") return;
  const filePath = extractMemberPhotoStoragePath(imageUrl);
  if (!filePath) return;
  try {
    await client.storage.from("member-photos").remove([filePath]);
  } catch (e) {
    console.warn("[deleteMemberPhotoFromStorage]", e);
  }
}
