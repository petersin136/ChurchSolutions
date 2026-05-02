-- =====================================================================
-- 시드 후 다른 테넌트 영향 없는지 검증
-- 시드 실행 전후로 두 번 실행해서 결과 비교
-- 은혜로교회 외의 모든 row_count가 동일해야 정상
-- =====================================================================

SELECT
  'OTHER_TENANTS_TOTAL' AS scope,
  (SELECT COUNT(*) FROM members WHERE church_id != 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' OR church_id IS NULL) AS members,
  (SELECT COUNT(*) FROM attendance WHERE church_id != 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' OR church_id IS NULL) AS attendance,
  (SELECT COUNT(*) FROM income WHERE church_id != 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' OR church_id IS NULL) AS income,
  (SELECT COUNT(*) FROM expense WHERE church_id != 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' OR church_id IS NULL) AS expense,
  (SELECT COUNT(*) FROM notes WHERE church_id != 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' OR church_id IS NULL) AS notes,
  (SELECT COUNT(*) FROM organizations WHERE church_id != 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' OR church_id IS NULL) AS organizations,
  (SELECT COUNT(*) FROM churches WHERE id != 'a1b2c3d4-e5f6-7890-abcd-ef1234567890') AS churches;

SELECT
  'GRACE_DEMO_TOTAL' AS scope,
  (SELECT COUNT(*) FROM churches WHERE id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890') AS churches,
  (SELECT COUNT(*) FROM members WHERE church_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890') AS members,
  (SELECT COUNT(*) FROM attendance WHERE church_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890') AS attendance,
  (SELECT COUNT(*) FROM income WHERE church_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890') AS income,
  (SELECT COUNT(*) FROM expense WHERE church_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890') AS expense,
  (SELECT COUNT(*) FROM notes WHERE church_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890') AS notes,
  (SELECT COUNT(*) FROM organizations WHERE church_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890') AS organizations;
