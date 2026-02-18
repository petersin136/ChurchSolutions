-- ============================================
-- 교회학교: 비로그인(anon)에서도 부서/반 조회 가능하도록
-- 앱이 로그인 없이 Supabase anon 키만 사용할 때 적용
-- 보안상 로그인 필수로 할 경우 이 파일은 실행하지 마세요.
-- ============================================

-- 부서 목록 읽기 허용 (대시보드/부서 선택용)
DROP POLICY IF EXISTS "Anon read school_departments" ON school_departments;
CREATE POLICY "Anon read school_departments" ON school_departments
  FOR SELECT USING (true);

-- 반 목록 읽기 허용
DROP POLICY IF EXISTS "Anon read school_classes" ON school_classes;
CREATE POLICY "Anon read school_classes" ON school_classes
  FOR SELECT USING (true);

-- 대시보드/학생관리/출석 등에서 anon으로 조회 가능하도록
DROP POLICY IF EXISTS "Anon read school_enrollments" ON school_enrollments;
CREATE POLICY "Anon read school_enrollments" ON school_enrollments FOR SELECT USING (true);
DROP POLICY IF EXISTS "Anon read school_attendance" ON school_attendance;
CREATE POLICY "Anon read school_attendance" ON school_attendance FOR SELECT USING (true);
DROP POLICY IF EXISTS "Anon read school_transfer_history" ON school_transfer_history;
CREATE POLICY "Anon read school_transfer_history" ON school_transfer_history FOR SELECT USING (true);
