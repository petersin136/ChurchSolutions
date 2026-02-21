-- settings 테이블에 교단(denomination) 컬럼 추가 (기존 DB용)
-- Supabase SQL Editor에서 실행

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'settings' AND column_name = 'denomination'
  ) THEN
    ALTER TABLE public.settings ADD COLUMN denomination text;
  END IF;
END $$;
