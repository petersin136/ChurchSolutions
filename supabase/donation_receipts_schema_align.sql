-- donation_receipts_schema_align.sql
-- 기존에 "year / donor_name / issued_at …" 식으로만 만들어진 donation_receipts 테이블을
-- 앱(FinancePage)이 기대하는 컬럼명·필드로 맞춥니다. Supabase SQL Editor에서 한 번 실행하세요.
-- (이미 supabase/donation_receipts.sql 전체를 적용했다면 이 파일은 필요 없을 수 있습니다.)

-- 1) 컬럼 이름 맞추기 (존재할 때만)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'donation_receipts' AND column_name = 'year'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'donation_receipts' AND column_name = 'tax_year'
  ) THEN
    ALTER TABLE public.donation_receipts RENAME COLUMN year TO tax_year;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'donation_receipts' AND column_name = 'donor_name'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'donation_receipts' AND column_name = 'member_name'
  ) THEN
    ALTER TABLE public.donation_receipts RENAME COLUMN donor_name TO member_name;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'donation_receipts' AND column_name = 'issued_at'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'donation_receipts' AND column_name = 'issue_date'
  ) THEN
    ALTER TABLE public.donation_receipts RENAME COLUMN issued_at TO issue_date;
  END IF;
END $$;

-- 2) 앱에 필요한 컬럼 보강 (없을 때만 추가)
ALTER TABLE public.donation_receipts
  ADD COLUMN IF NOT EXISTS member_id UUID REFERENCES public.members(id) ON DELETE SET NULL;

ALTER TABLE public.donation_receipts
  ADD COLUMN IF NOT EXISTS member_name TEXT;

ALTER TABLE public.donation_receipts
  ADD COLUMN IF NOT EXISTS tax_year INTEGER;

ALTER TABLE public.donation_receipts
  ADD COLUMN IF NOT EXISTS issue_date DATE;

ALTER TABLE public.donation_receipts
  ADD COLUMN IF NOT EXISTS donation_details JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.donation_receipts
  ADD COLUMN IF NOT EXISTS church_name TEXT;

ALTER TABLE public.donation_receipts
  ADD COLUMN IF NOT EXISTS church_address TEXT;

ALTER TABLE public.donation_receipts
  ADD COLUMN IF NOT EXISTS church_representative TEXT;

ALTER TABLE public.donation_receipts
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT '발급완료';

ALTER TABLE public.donation_receipts
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;

ALTER TABLE public.donation_receipts
  ADD COLUMN IF NOT EXISTS cancel_reason TEXT;

ALTER TABLE public.donation_receipts
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.donation_receipts
  ADD COLUMN IF NOT EXISTS resident_number_masked TEXT;

ALTER TABLE public.donation_receipts
  ADD COLUMN IF NOT EXISTS memo TEXT;

CREATE INDEX IF NOT EXISTS idx_donation_receipts_church_year ON public.donation_receipts(church_id, tax_year);

-- 3) 발급번호 생성 RPC (없을 때만)—본문은 donation_receipts.sql과 동일
CREATE OR REPLACE FUNCTION public.generate_receipt_number(p_church_id UUID, p_tax_year INTEGER)
RETURNS TEXT AS $$
DECLARE
  seq_num INTEGER;
  result TEXT;
BEGIN
  SELECT COALESCE(MAX(
    CAST(SPLIT_PART(receipt_number, '-', 3) AS INTEGER)
  ), 0) + 1
  INTO seq_num
  FROM public.donation_receipts
  WHERE church_id = p_church_id AND tax_year = p_tax_year;

  result := 'DR-' || p_tax_year || '-' || LPAD(seq_num::TEXT, 5, '0');
  RETURN result;
END;
$$ LANGUAGE plpgsql;
