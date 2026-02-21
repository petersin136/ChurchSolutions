-- ============================================================
-- member-photos 버킷 공개 읽기 허용 (프로필 사진 403 방지)
-- Supabase 대시보드 → SQL Editor에서 실행
-- ============================================================
-- 1. 버킷이 Public이 아니면: Storage → member-photos → 설정에서 "Public bucket" 체크
-- 2. 아래 정책을 추가하면 anon/authenticated 사용자가 저장된 URL로 이미지를 볼 수 있음

DROP POLICY IF EXISTS "Public read access for member-photos" ON storage.objects;

CREATE POLICY "Public read access for member-photos"
ON storage.objects
FOR SELECT
TO anon, authenticated
USING (bucket_id = 'member-photos');
