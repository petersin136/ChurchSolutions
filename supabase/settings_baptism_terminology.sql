-- settings 테이블에 세례/침례 표기 설정 컬럼 추가 (기존 DB용)
-- 값: 'chimrye' | 'seryae' | NULL(auto — 교단명에서 추론)

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'settings' AND column_name = 'baptism_terminology'
  ) THEN
    ALTER TABLE public.settings ADD COLUMN baptism_terminology text;
  END IF;
END $$;
