-- =====================================================================
-- 기부금 영수증: donation_receipts + donation_receipt_log + RPC
-- FinancePage.tsx (persistDonationReceiptRow, insertDonationReceiptLog) 기준
--
-- ⚠️ donation_receipts 는 DROP CASCADE 로 기존 데이터가 삭제됩니다.
-- 프로덕션에서는 백업 후 실행하세요.
--
-- ⚠️ status 기본값은 반드시 '발급완료' 여야 합니다.
--    발급 이력 화면에서 재출력/취소 버튼은 status === '발급완료' 일 때만 노출됩니다.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1단계: donation_receipts
-- ---------------------------------------------------------------------
DROP TABLE IF EXISTS donation_receipts CASCADE;

CREATE TABLE donation_receipts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  member_id TEXT,
  member_name TEXT NOT NULL,
  receipt_number TEXT NOT NULL,
  tax_year INTEGER NOT NULL,
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  total_amount BIGINT NOT NULL DEFAULT 0,
  donation_details JSONB NOT NULL DEFAULT '[]'::jsonb,
  church_name TEXT NOT NULL,
  church_address TEXT,
  church_representative TEXT,
  resident_number_masked TEXT,
  memo TEXT,
  status TEXT NOT NULL DEFAULT '발급완료',
  cancelled_at TIMESTAMPTZ,
  cancel_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_donation_receipts_number ON donation_receipts(receipt_number);
CREATE INDEX idx_dr_church_year ON donation_receipts(church_id, tax_year);

ALTER TABLE donation_receipts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "dr_all" ON donation_receipts;
DROP POLICY IF EXISTS "donation_receipts_church_access" ON donation_receipts;
CREATE POLICY "dr_all" ON donation_receipts FOR ALL USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------
-- 2단계: donation_receipt_log
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS donation_receipt_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  serial_number TEXT NOT NULL,
  donor_name TEXT NOT NULL,
  resident_number_masked TEXT,
  donation_amount BIGINT NOT NULL DEFAULT 0,
  donation_date TEXT NOT NULL,
  issued_date TEXT NOT NULL,
  receipt_year TEXT NOT NULL,
  donation_type TEXT DEFAULT '법정기부금',
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (church_id, serial_number)
);

CREATE INDEX IF NOT EXISTS idx_drl_church_year ON donation_receipt_log(church_id, receipt_year);

ALTER TABLE donation_receipt_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "drl_all" ON donation_receipt_log;
DROP POLICY IF EXISTS "donation_receipt_log_church_access" ON donation_receipt_log;
CREATE POLICY "drl_all" ON donation_receipt_log FOR ALL USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------
-- 3단계: RPC — 앱이 호출하는 시그니처와 동일해야 함
--   persistDonationReceiptRow:  rpc("generate_receipt_number", { p_church_id, p_tax_year })
--   insertDonationReceiptLog:   rpc("next_receipt_log_serial", { p_church_id, p_year })
-- ---------------------------------------------------------------------
DROP FUNCTION IF EXISTS generate_receipt_number(UUID);
DROP FUNCTION IF EXISTS generate_receipt_number(UUID, INTEGER);

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
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP FUNCTION IF EXISTS next_receipt_log_serial(UUID, TEXT);

CREATE OR REPLACE FUNCTION next_receipt_log_serial(p_church_id UUID, p_year TEXT)
RETURNS TEXT AS $$
DECLARE
  seq_num INTEGER;
BEGIN
  SELECT COALESCE(MAX(
    CAST(NULLIF(split_part(serial_number, '-', 2), '') AS INTEGER)
  ), 0) + 1
  INTO seq_num
  FROM donation_receipt_log
  WHERE church_id = p_church_id AND receipt_year = p_year;

  RETURN p_year || '-' || LPAD(seq_num::TEXT, 3, '0');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
