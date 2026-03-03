import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase";

const BUCKET = "member-photos";
const MAX_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file || !file.size) {
      return NextResponse.json({ error: "파일이 없습니다" }, { status: 400 });
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "5MB 이하 이미지만 업로드 가능합니다" }, { status: 400 });
    }
    const type = file.type?.toLowerCase() || "";
    if (!ALLOWED.includes(type)) {
      return NextResponse.json({ error: "jpeg/png/webp/gif만 가능합니다" }, { status: 400 });
    }

    const supabase = getServiceSupabase();
    const ext = type.replace("image/", "") || "jpg";
    const path = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${ext}`;

    const { data: buckets } = await supabase.storage.listBuckets();
    if (!buckets?.some((b) => b.name === BUCKET)) {
      await supabase.storage.createBucket(BUCKET, { public: true });
    }

    const buf = await file.arrayBuffer();
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, buf, { contentType: file.type, upsert: false });

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
    const publicUrl = urlData.publicUrl;
    console.log("[Photo Debug] getPublicUrl 결과:", publicUrl);

    const { data: signedData, error: signedError } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(path, 60 * 60 * 24 * 365);

    const imageUrl = signedError ? publicUrl : signedData?.signedUrl ?? publicUrl;
    if (!signedError && signedData?.signedUrl) {
      console.log("[Photo Debug] createSignedUrl 사용 (버킷 비공개 대응), 최종 URL:", imageUrl);
    } else if (signedError) {
      console.warn("[Photo Debug] createSignedUrl 실패, public URL 반환:", signedError.message, "| URL:", publicUrl);
    }

    return NextResponse.json({ url: imageUrl });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
