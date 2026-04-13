-- 기부금 영수증 발급 대장 (소득세법 시행규칙 별지 제45호의3 등 대응)
-- Supabase SQL Editor에서 실행하세요.
-- 주민등록번호 원본은 저장하지 않습니다. 마스킹된 값만 저장합니다.

CREATE TABLE IF NOT EXISTS donation_receipt_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  serial_number TEXT NOT NULL,
  donor_name TEXT NOT NULL,
  resident_number_masked TEXT,
  donation_amount BIGINT NOT NULL,
  donation_date TEXT NOT NULL,
  issued_date TEXT NOT NULL,
  receipt_year TEXT NOT NULL,
  donation_type TEXT DEFAULT '법정기부금',
  issued_by TEXT,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(church_id, serial_number)
);

CREATE INDEX IF NOT EXISTS idx_receipt_log_church ON donation_receipt_log(church_id);
CREATE INDEX IF NOT EXISTS idx_receipt_log_year ON donation_receipt_log(receipt_year);

ALTER TABLE donation_receipt_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "donation_receipt_log_church_access" ON donation_receipt_log;
CREATE POLICY "donation_receipt_log_church_access" ON donation_receipt_log
  FOR ALL USING (
    church_id IN (
      SELECT church_id FROM church_members WHERE user_id = auth.uid()
    )
  );

-- church_members가 없으면 위 정책이 모든 행을 숨깁니다. 단일 교회일 경우 아래로 대체:
-- CREATE POLICY "donation_receipt_log_church_access" ON donation_receipt_log FOR ALL USING (true);

-- 연도별 다음 일련번호 (예: 2025-001, 2025-002)
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
$$ LANGUAGE plpgsql;
