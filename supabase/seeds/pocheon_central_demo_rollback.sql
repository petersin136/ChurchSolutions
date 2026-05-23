-- =====================================================================
-- 포천중앙침례교회 데모 시드 롤백 (Pocheon Central Demo Rollback)
-- =====================================================================
-- 동작:
--   churches.name 에 '포천'+'중앙' 이 포함된 교회를 찾아,
--   해당 church_id 에 속한 모든 시드성 데이터를 삭제합니다.
--   (churches/settings 본체는 보존)
-- 안전장치:
--   · 트랜잭션 단위 — 실패 시 전부 롤백
--   · churches 행은 삭제하지 않음 (앱에서 만든 가입 계정 보존)
-- =====================================================================

BEGIN;

DO $$
DECLARE
  v_church_id UUID;
BEGIN
  SELECT id INTO v_church_id
  FROM churches
  WHERE name ILIKE '%포천%중앙%' OR name ILIKE '%pocheon%central%'
  ORDER BY created_at LIMIT 1;

  IF v_church_id IS NULL THEN
    RAISE EXCEPTION '포천중앙침례교회를 찾지 못했습니다. (churches.name 에 ''포천''과 ''중앙''이 포함되어야 합니다)';
  END IF;

  RAISE NOTICE '포천중앙침례교회 롤백 시작 · church_id=%', v_church_id;

  -- planner 계열 (church_id TEXT)
  IF to_regclass('public.events')              IS NOT NULL THEN DELETE FROM events              WHERE church_id = v_church_id::TEXT; END IF;
  IF to_regclass('public.places')              IS NOT NULL THEN DELETE FROM places              WHERE church_id = v_church_id::TEXT; END IF;
  IF to_regclass('public.departments')         IS NOT NULL THEN DELETE FROM departments         WHERE church_id = v_church_id::TEXT; END IF;
  IF to_regclass('public.church_calendar')     IS NOT NULL THEN DELETE FROM church_calendar     WHERE church_id = v_church_id::TEXT; END IF;

  -- 새가족 / 조직
  IF to_regclass('public.new_family_program')  IS NOT NULL THEN DELETE FROM new_family_program  WHERE church_id = v_church_id; END IF;
  IF to_regclass('public.organization_members')IS NOT NULL THEN DELETE FROM organization_members WHERE church_id = v_church_id; END IF;
  IF to_regclass('public.organizations')       IS NOT NULL THEN DELETE FROM organizations       WHERE church_id = v_church_id; END IF;
  IF to_regclass('public.school_enrollments')  IS NOT NULL THEN DELETE FROM school_enrollments  WHERE church_id = v_church_id; END IF;
  IF to_regclass('public.school_departments')  IS NOT NULL THEN DELETE FROM school_departments  WHERE church_id = v_church_id; END IF;

  -- 사역 데이터
  IF to_regclass('public.counsels')            IS NOT NULL THEN DELETE FROM counsels            WHERE church_id = v_church_id; END IF;
  IF to_regclass('public.visits')              IS NOT NULL THEN DELETE FROM visits              WHERE church_id = v_church_id; END IF;
  IF to_regclass('public.notes')               IS NOT NULL THEN DELETE FROM notes               WHERE church_id = v_church_id; END IF;
  IF to_regclass('public.attendance')          IS NOT NULL THEN DELETE FROM attendance          WHERE church_id = v_church_id; END IF;
  IF to_regclass('public.sermons')             IS NOT NULL THEN DELETE FROM sermons             WHERE church_id = v_church_id; END IF;
  IF to_regclass('public.plans')               IS NOT NULL THEN DELETE FROM plans               WHERE church_id = v_church_id; END IF;

  -- 재정
  IF to_regclass('public.budget')              IS NOT NULL THEN DELETE FROM budget              WHERE church_id = v_church_id; END IF;
  IF to_regclass('public.expense')             IS NOT NULL THEN DELETE FROM expense             WHERE church_id = v_church_id; END IF;
  IF to_regclass('public.income')              IS NOT NULL THEN DELETE FROM income              WHERE church_id = v_church_id; END IF;

  -- 멤버·가족
  IF to_regclass('public.members')             IS NOT NULL THEN DELETE FROM members             WHERE church_id = v_church_id; END IF;
  IF to_regclass('public.families')            IS NOT NULL THEN DELETE FROM families            WHERE church_id = v_church_id; END IF;

  RAISE NOTICE '✅ 포천중앙침례교회 데이터 정리 완료. churches/settings 본체는 보존됨.';
END $$;

COMMIT;
