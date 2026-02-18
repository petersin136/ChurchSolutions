-- ============================================
-- 교회학교 + 청년부 관리 Phase 8
-- Supabase SQL Editor에서 실행 (members 테이블 선행 필요)
-- ============================================

-- ============================================
-- 1) 교회학교 부서 테이블
-- ============================================
CREATE TABLE IF NOT EXISTS school_departments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  church_id uuid,
  name text NOT NULL,
  age_range text,
  description text,
  leader_id uuid REFERENCES members(id),
  leader_name text,
  teacher_count integer DEFAULT 0,
  student_count integer DEFAULT 0,
  meeting_time text,
  meeting_location text,
  is_active boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============================================
-- 2) 반(Class) 테이블
-- ============================================
CREATE TABLE IF NOT EXISTS school_classes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  department_id uuid REFERENCES school_departments(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  teacher_id uuid REFERENCES members(id),
  teacher_name text,
  assistant_teacher_id uuid REFERENCES members(id),
  assistant_teacher_name text,
  max_students integer DEFAULT 15,
  current_students integer DEFAULT 0,
  sort_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- ============================================
-- 3) 학생 배정 테이블
-- ============================================
CREATE TABLE IF NOT EXISTS school_enrollments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id uuid REFERENCES members(id) ON DELETE CASCADE NOT NULL,
  department_id uuid REFERENCES school_departments(id) ON DELETE CASCADE NOT NULL,
  class_id uuid REFERENCES school_classes(id) ON DELETE SET NULL,
  role text DEFAULT '학생' CHECK (role IN ('학생','교사','부교사','부장','총무')),
  enrolled_date date DEFAULT CURRENT_DATE,
  left_date date,
  is_active boolean DEFAULT true,
  UNIQUE(member_id, department_id)
);

CREATE INDEX IF NOT EXISTS idx_enrollment_dept ON school_enrollments(department_id);
CREATE INDEX IF NOT EXISTS idx_enrollment_class ON school_enrollments(class_id);
CREATE INDEX IF NOT EXISTS idx_enrollment_member ON school_enrollments(member_id);

-- ============================================
-- 4) 교회학교 출결
-- ============================================
CREATE TABLE IF NOT EXISTS school_attendance (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  department_id uuid REFERENCES school_departments(id) NOT NULL,
  class_id uuid REFERENCES school_classes(id),
  member_id uuid REFERENCES members(id) NOT NULL,
  date date NOT NULL,
  status text DEFAULT '출석' CHECK (status IN ('출석','결석','병결','기타')),
  note text,
  checked_by uuid,
  created_at timestamptz DEFAULT now(),
  UNIQUE(member_id, department_id, date)
);

CREATE INDEX IF NOT EXISTS idx_school_att_date ON school_attendance(date);
CREATE INDEX IF NOT EXISTS idx_school_att_dept ON school_attendance(department_id);

-- ============================================
-- 5) 부서 이동 이력
-- ============================================
CREATE TABLE IF NOT EXISTS school_transfer_history (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id uuid REFERENCES members(id) ON DELETE CASCADE NOT NULL,
  from_department_id uuid REFERENCES school_departments(id),
  from_department_name text,
  to_department_id uuid REFERENCES school_departments(id),
  to_department_name text,
  transfer_date date DEFAULT CURRENT_DATE,
  reason text,
  created_at timestamptz DEFAULT now()
);

-- ============================================
-- 6) RLS
-- ============================================
ALTER TABLE school_departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_transfer_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Auth school_departments" ON school_departments;
CREATE POLICY "Auth school_departments" ON school_departments FOR ALL USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Auth school_classes" ON school_classes;
CREATE POLICY "Auth school_classes" ON school_classes FOR ALL USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Auth school_enrollments" ON school_enrollments;
CREATE POLICY "Auth school_enrollments" ON school_enrollments FOR ALL USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Auth school_attendance" ON school_attendance;
CREATE POLICY "Auth school_attendance" ON school_attendance FOR ALL USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Auth school_transfer_history" ON school_transfer_history;
CREATE POLICY "Auth school_transfer_history" ON school_transfer_history FOR ALL USING (auth.uid() IS NOT NULL);

-- 기본 부서 시드 (최초 1회 실행 권장, 테이블이 비어 있을 때만 삽입)
INSERT INTO school_departments (name, age_range, sort_order)
SELECT v.name, v.age_range, v.sort_order
FROM (VALUES
  ('영아부'::text, '0-3'::text, 1),
  ('유치부', '4-6', 2),
  ('유초등부', '7-9', 3),
  ('초등부', '10-12', 4),
  ('중등부', '13-15', 5),
  ('고등부', '16-18', 6),
  ('대학부', '19-25', 7),
  ('청년부', '19-35', 8)
) AS v(name, age_range, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM school_departments LIMIT 1);
