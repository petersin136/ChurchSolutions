-- ============================================
-- 교적부 강화 Phase 1: DB 스키마 확장
-- Supabase SQL Editor에서 실행
-- ============================================

-- ============================================
-- 1) members 테이블 컬럼 추가
-- ============================================
-- 새가족 관련
ALTER TABLE members ADD COLUMN IF NOT EXISTS is_new_family boolean DEFAULT false;
ALTER TABLE members ADD COLUMN IF NOT EXISTS first_visit_date date;
ALTER TABLE members ADD COLUMN IF NOT EXISTS visit_path text; -- 지인소개/전도/자진방문/이전교회/기타
ALTER TABLE members ADD COLUMN IF NOT EXISTS referrer_id uuid REFERENCES members(id);
ALTER TABLE members ADD COLUMN IF NOT EXISTS referrer_name text;

-- 가족 관계
ALTER TABLE members ADD COLUMN IF NOT EXISTS family_id uuid; -- 같은 가족끼리 동일 UUID
ALTER TABLE members ADD COLUMN IF NOT EXISTS family_relation text; -- 본인/배우자/자녀/부모/형제/기타

-- 상태 이력
ALTER TABLE members ADD COLUMN IF NOT EXISTS member_status text DEFAULT '활동' CHECK (member_status IN ('활동','휴적','은퇴','별세','이적','제적','미등록'));
ALTER TABLE members ADD COLUMN IF NOT EXISTS status_changed_at timestamptz;
ALTER TABLE members ADD COLUMN IF NOT EXISTS status_reason text;

-- 추가 인적사항
ALTER TABLE members ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE members ADD COLUMN IF NOT EXISTS job text;
ALTER TABLE members ADD COLUMN IF NOT EXISTS baptism_date date;
ALTER TABLE members ADD COLUMN IF NOT EXISTS baptism_type text; -- 유아세례/세례/입교/미세례
ALTER TABLE members ADD COLUMN IF NOT EXISTS wedding_anniversary date;
ALTER TABLE members ADD COLUMN IF NOT EXISTS registered_date date DEFAULT CURRENT_DATE;
ALTER TABLE members ADD COLUMN IF NOT EXISTS small_group text; -- 소그룹/셀
ALTER TABLE members ADD COLUMN IF NOT EXISTS talent text; -- 은사/재능

-- 관심 성도 (등록 전 단계)
ALTER TABLE members ADD COLUMN IF NOT EXISTS is_prospect boolean DEFAULT false;

-- 기존 status → member_status 마이그레이션 (한 번만 실행)
UPDATE members SET member_status = status WHERE member_status IS NULL AND status IS NOT NULL;

-- ============================================
-- 2) 상태 변경 이력 테이블
-- ============================================
CREATE TABLE IF NOT EXISTS member_status_history (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id uuid REFERENCES members(id) ON DELETE CASCADE NOT NULL,
  previous_status text,
  new_status text NOT NULL,
  changed_at timestamptz DEFAULT now(),
  reason text,
  changed_by uuid
);

CREATE INDEX IF NOT EXISTS idx_status_history_member ON member_status_history(member_id);

-- ============================================
-- 3) 가족 그룹 테이블 (선택적, family_id 관리용)
-- ============================================
CREATE TABLE IF NOT EXISTS families (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  family_name text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- ============================================
-- 4) RLS 정책
-- ============================================
ALTER TABLE member_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE families ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can manage status history" ON member_status_history;
CREATE POLICY "Authenticated users can manage status history"
  ON member_status_history FOR ALL
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can manage families" ON families;
CREATE POLICY "Authenticated users can manage families"
  ON families FOR ALL
  USING (auth.uid() IS NOT NULL);
