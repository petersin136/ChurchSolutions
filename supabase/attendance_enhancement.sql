-- ============================================
-- 출결 강화 Phase 3: 예배별 출결 + 출결 대시보드
-- Supabase SQL Editor에서 실행
-- 기존 attendance 테이블(week_num/year 기반)과 병행하여 date + service_type 기반 출결 지원
-- ============================================

-- ============================================
-- 1) attendance 테이블 강화
-- ============================================
-- date 컬럼: 날짜 기준 출결용 (기존 week_num/year와 병행)
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS date date;

ALTER TABLE attendance ADD COLUMN IF NOT EXISTS service_type text DEFAULT '주일예배';
-- 예배 종류: 주일1부, 주일2부, 주일3부, 수요예배, 금요기도, 새벽기도, 특별집회, 기타
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS check_in_time timestamptz;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS check_in_method text DEFAULT '수동';
-- 체크인 방법: 수동, QR, 앱
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS note text;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS checked_by text;

-- 기존 데이터: service_type이 NULL이면 '주일예배'로
UPDATE attendance SET service_type = '주일예배' WHERE service_type IS NULL AND date IS NOT NULL;

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date);
CREATE INDEX IF NOT EXISTS idx_attendance_member ON attendance(member_id);
CREATE INDEX IF NOT EXISTS idx_attendance_service ON attendance(service_type);

-- 날짜+예배별 출결 중복 방지 (date가 있는 행만)
-- 기존 (member_id, week_num, year) 행과 충돌하지 않도록 partial unique index
CREATE UNIQUE INDEX IF NOT EXISTS idx_attendance_unique_member_date_service
ON attendance (member_id, date, service_type)
WHERE date IS NOT NULL AND service_type IS NOT NULL;

-- ============================================
-- 2) 예배 유형 설정 테이블
-- ============================================
CREATE TABLE IF NOT EXISTS service_types (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  church_id uuid,
  name text NOT NULL,
  day_of_week integer,
  default_time time,
  is_active boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_service_types_name ON service_types (name);

ALTER TABLE service_types ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Auth service_types" ON service_types;
CREATE POLICY "Auth service_types" ON service_types FOR ALL USING (auth.uid() IS NOT NULL);

-- 기본 예배 유형 (이미 있으면 스킵)
INSERT INTO service_types (name, day_of_week, default_time, sort_order) VALUES
  ('주일1부예배', 0, '09:00', 1),
  ('주일2부예배', 0, '11:00', 2),
  ('수요예배', 3, '19:30', 3),
  ('금요기도회', 5, '21:00', 4),
  ('새벽기도', NULL, '05:30', 5)
ON CONFLICT (name) DO NOTHING;
