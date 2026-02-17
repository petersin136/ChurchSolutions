-- 기부금영수증 발급 이력 및 교회 설정
-- Supabase SQL Editor에서 실행하세요.
-- ※ churches 테이블이 없으면 아래 3줄 주석 해제 후 실행 (단일 교회용).

-- CREATE TABLE IF NOT EXISTS churches (id UUID DEFAULT gen_random_uuid() PRIMARY KEY, name TEXT NOT NULL);
-- INSERT INTO churches (name) SELECT '우리교회' WHERE NOT EXISTS (SELECT 1 FROM churches LIMIT 1);
-- ※ church_members가 없으면 RLS 정책에서 아무도 접근할 수 없습니다. 단일 교회면 정책을 "USING (true)"로 변경하세요.

-- 기부금영수증 발급 이력 테이블 (주민등록번호 없음!)
CREATE TABLE IF NOT EXISTS donation_receipts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  member_id UUID REFERENCES members(id) ON DELETE SET NULL,
  member_name TEXT NOT NULL,
  receipt_number TEXT NOT NULL,
  tax_year INTEGER NOT NULL,
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  total_amount BIGINT NOT NULL DEFAULT 0,
  donation_details JSONB NOT NULL DEFAULT '[]'::jsonb,
  church_name TEXT NOT NULL,
  church_address TEXT,
  church_tel TEXT,
  church_representative TEXT,
  status TEXT NOT NULL DEFAULT '발급완료' CHECK (status IN ('발급완료','취소')),
  cancelled_at TIMESTAMPTZ,
  cancel_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_donation_receipts_number ON donation_receipts(receipt_number);
CREATE INDEX IF NOT EXISTS idx_donation_receipts_church ON donation_receipts(church_id);
CREATE INDEX IF NOT EXISTS idx_donation_receipts_member ON donation_receipts(member_id);
CREATE INDEX IF NOT EXISTS idx_donation_receipts_year ON donation_receipts(tax_year);

ALTER TABLE donation_receipts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "donation_receipts_church_access" ON donation_receipts;
CREATE POLICY "donation_receipts_church_access" ON donation_receipts
  FOR ALL USING (
    church_id IN (
      SELECT church_id FROM church_members WHERE user_id = auth.uid()
    )
  );

-- church_members가 없으면 위 정책이 모든 행을 숨깁니다. 단일 교회일 경우 아래로 대체:
-- CREATE POLICY "donation_receipts_church_access" ON donation_receipts FOR ALL USING (true);

CREATE OR REPLACE FUNCTION generate_receipt_number(p_church_id UUID, p_tax_year INTEGER)
RETURNS TEXT AS $$
DECLARE
  seq_num INTEGER;
  result TEXT;
BEGIN
  SELECT COALESCE(MAX(
    CAST(SPLIT_PART(receipt_number, '-', 3) AS INTEGER)
  ), 0) + 1
  INTO seq_num
  FROM donation_receipts
  WHERE church_id = p_church_id AND tax_year = p_tax_year;

  result := 'DR-' || p_tax_year || '-' || LPAD(seq_num::TEXT, 5, '0');
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- 교회 직인/설정 테이블
CREATE TABLE IF NOT EXISTS church_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  seal_image_url TEXT,
  representative_name TEXT,
  church_registration_number TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(church_id)
);

ALTER TABLE church_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "church_settings_access" ON church_settings;
CREATE POLICY "church_settings_access" ON church_settings
  FOR ALL USING (
    church_id IN (
      SELECT church_id FROM church_members WHERE user_id = auth.uid()
    )
  );

-- 단일 교회일 경우: CREATE POLICY "church_settings_access" ON church_settings FOR ALL USING (true);
