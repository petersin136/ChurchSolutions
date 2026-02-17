-- church_settings에 컬럼 추가 (이미 있으면 무시)
-- Supabase SQL Editor에서 실행

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'church_settings' AND column_name = 'church_address'
  ) THEN
    ALTER TABLE church_settings ADD COLUMN church_address TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'church_settings' AND column_name = 'church_tel'
  ) THEN
    ALTER TABLE church_settings ADD COLUMN church_tel TEXT;
  END IF;
END $$;

-- Storage 버킷은 Supabase 대시보드에서 수동 생성:
-- Storage > New Bucket > 이름: church-seals, Public: OFF
-- Policies: auth.uid() IS NOT NULL 로 SELECT/INSERT/UPDATE/DELETE 허용
