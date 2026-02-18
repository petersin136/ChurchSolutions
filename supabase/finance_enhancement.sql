-- ============================================
-- 재정 강화 Phase 2: 예산·현금출납장·특별회계
-- Supabase SQL Editor에서 실행
-- ============================================

-- ============================================
-- 1) 예산(Budget) 테이블
-- ============================================
CREATE TABLE IF NOT EXISTS budget (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  church_id uuid,
  fiscal_year text NOT NULL,
  category_type text NOT NULL CHECK (category_type IN ('수입','지출')),
  category text NOT NULL,
  sub_category text,
  monthly_amounts jsonb DEFAULT '{"1":0,"2":0,"3":0,"4":0,"5":0,"6":0,"7":0,"8":0,"9":0,"10":0,"11":0,"12":0}'::jsonb,
  annual_total numeric DEFAULT 0,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_budget_year ON budget(fiscal_year);
CREATE INDEX IF NOT EXISTS idx_budget_category ON budget(category_type, category);

-- ============================================
-- 2) income 테이블 강화
-- ============================================
ALTER TABLE income ADD COLUMN IF NOT EXISTS member_id uuid REFERENCES members(id);
ALTER TABLE income ADD COLUMN IF NOT EXISTS sub_category text;
ALTER TABLE income ADD COLUMN IF NOT EXISTS payment_method text DEFAULT '현금';
ALTER TABLE income ADD COLUMN IF NOT EXISTS receipt_issued boolean DEFAULT false;
ALTER TABLE income ADD COLUMN IF NOT EXISTS fiscal_year text;
ALTER TABLE income ADD COLUMN IF NOT EXISTS month integer;

UPDATE income SET fiscal_year = EXTRACT(YEAR FROM (date::date))::text WHERE fiscal_year IS NULL AND date IS NOT NULL;
UPDATE income SET month = EXTRACT(MONTH FROM (date::date))::integer WHERE month IS NULL AND date IS NOT NULL;

-- ============================================
-- 3) expense 테이블 강화
-- ============================================
ALTER TABLE expense ADD COLUMN IF NOT EXISTS sub_category text;
ALTER TABLE expense ADD COLUMN IF NOT EXISTS payment_method text DEFAULT '현금';
ALTER TABLE expense ADD COLUMN IF NOT EXISTS approved_by text;
ALTER TABLE expense ADD COLUMN IF NOT EXISTS receipt_attachment text;
ALTER TABLE expense ADD COLUMN IF NOT EXISTS fiscal_year text;
ALTER TABLE expense ADD COLUMN IF NOT EXISTS month integer;

UPDATE expense SET fiscal_year = EXTRACT(YEAR FROM (date::date))::text WHERE fiscal_year IS NULL AND date IS NOT NULL;
UPDATE expense SET month = EXTRACT(MONTH FROM (date::date))::integer WHERE month IS NULL AND date IS NOT NULL;

-- ============================================
-- 4) 현금출납장 뷰 (수입+지출 통합, 정렬은 조회 시 적용)
-- ============================================
CREATE OR REPLACE VIEW cash_journal AS
SELECT
  id::text AS id,
  date,
  '수입'::text AS type,
  COALESCE(type, '')::text AS category,
  sub_category,
  COALESCE(donor, '')::text AS description,
  amount,
  COALESCE(payment_method, '현금')::text AS payment_method,
  memo,
  fiscal_year,
  month,
  created_at
FROM income
UNION ALL
SELECT
  id::text AS id,
  date,
  '지출'::text AS type,
  COALESCE(category, '')::text AS category,
  sub_category,
  COALESCE(item, '')::text AS description,
  amount,
  COALESCE(payment_method, '현금')::text AS payment_method,
  memo,
  fiscal_year,
  month,
  created_at
FROM expense;

-- ============================================
-- 5) 특별회계
-- ============================================
CREATE TABLE IF NOT EXISTS special_accounts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  church_id uuid,
  account_name text NOT NULL,
  description text,
  target_amount numeric DEFAULT 0,
  current_amount numeric DEFAULT 0,
  start_date date,
  end_date date,
  status text DEFAULT '진행중' CHECK (status IN ('진행중','달성','종료','보류')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============================================
-- 6) 특별회계 거래내역
-- ============================================
CREATE TABLE IF NOT EXISTS special_account_transactions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id uuid REFERENCES special_accounts(id) ON DELETE CASCADE NOT NULL,
  date date NOT NULL,
  type text NOT NULL CHECK (type IN ('수입','지출')),
  amount numeric NOT NULL,
  description text,
  member_name text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_special_tx_account ON special_account_transactions(account_id);

-- ============================================
-- 7) RLS
-- ============================================
ALTER TABLE budget ENABLE ROW LEVEL SECURITY;
ALTER TABLE special_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE special_account_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Auth budget" ON budget;
CREATE POLICY "Auth budget" ON budget FOR ALL USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Auth special_accounts" ON special_accounts;
CREATE POLICY "Auth special_accounts" ON special_accounts FOR ALL USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Auth special_account_transactions" ON special_account_transactions;
CREATE POLICY "Auth special_account_transactions" ON special_account_transactions FOR ALL USING (auth.uid() IS NOT NULL);

-- ============================================
-- 8) 영수증 첨부 스토리지 버킷 (지출 영수증 이미지)
-- ============================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('receipt-attachments', 'receipt-attachments', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Allow authenticated select receipt-attachments" ON storage.objects;
CREATE POLICY "Allow authenticated select receipt-attachments"
ON storage.objects FOR SELECT
USING (bucket_id = 'receipt-attachments' AND auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Allow authenticated insert receipt-attachments" ON storage.objects;
CREATE POLICY "Allow authenticated insert receipt-attachments"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'receipt-attachments' AND auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Allow authenticated update receipt-attachments" ON storage.objects;
CREATE POLICY "Allow authenticated update receipt-attachments"
ON storage.objects FOR UPDATE
USING (bucket_id = 'receipt-attachments' AND auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Allow authenticated delete receipt-attachments" ON storage.objects;
CREATE POLICY "Allow authenticated delete receipt-attachments"
ON storage.objects FOR DELETE
USING (bucket_id = 'receipt-attachments' AND auth.uid() IS NOT NULL);
