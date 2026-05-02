-- =====================================================================
-- 은혜로교회 데모 시드 롤백
-- church_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' 의 모든 데이터 삭제
-- 다른 테넌트 데이터에는 절대 영향 없음
-- =====================================================================

BEGIN;

DO $$
DECLARE
  v_church_id UUID := 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
  v_church_id_text TEXT := 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
BEGIN
  -- FK 의존 역순으로 삭제
  IF to_regclass('public.new_family_program') IS NOT NULL THEN
    DELETE FROM new_family_program WHERE church_id = v_church_id;
  END IF;

  IF to_regclass('public.organization_members') IS NOT NULL THEN
    DELETE FROM organization_members WHERE church_id = v_church_id;
  END IF;

  IF to_regclass('public.school_attendance') IS NOT NULL THEN
    DELETE FROM school_attendance WHERE church_id = v_church_id;
  END IF;

  IF to_regclass('public.school_transfer_history') IS NOT NULL THEN
    DELETE FROM school_transfer_history WHERE church_id = v_church_id;
  END IF;

  IF to_regclass('public.school_enrollments') IS NOT NULL THEN
    DELETE FROM school_enrollments WHERE church_id = v_church_id;
  END IF;

  IF to_regclass('public.school_classes') IS NOT NULL THEN
    DELETE FROM school_classes WHERE church_id = v_church_id;
  END IF;

  IF to_regclass('public.attendance') IS NOT NULL THEN
    DELETE FROM attendance WHERE church_id = v_church_id;
  END IF;

  IF to_regclass('public.notes') IS NOT NULL THEN
    DELETE FROM notes WHERE church_id = v_church_id;
  END IF;

  IF to_regclass('public.visits') IS NOT NULL THEN
    DELETE FROM visits WHERE church_id = v_church_id;
  END IF;

  IF to_regclass('public.counsels') IS NOT NULL THEN
    DELETE FROM counsels WHERE church_id = v_church_id;
  END IF;

  IF to_regclass('public.income') IS NOT NULL THEN
    DELETE FROM income WHERE church_id = v_church_id;
  END IF;

  IF to_regclass('public.expense') IS NOT NULL THEN
    DELETE FROM expense WHERE church_id = v_church_id;
  END IF;

  IF to_regclass('public.budget') IS NOT NULL THEN
    DELETE FROM budget WHERE church_id = v_church_id;
  END IF;

  IF to_regclass('public.special_account_transactions') IS NOT NULL THEN
    DELETE FROM special_account_transactions WHERE church_id = v_church_id;
  END IF;

  IF to_regclass('public.special_accounts') IS NOT NULL THEN
    DELETE FROM special_accounts WHERE church_id = v_church_id;
  END IF;

  IF to_regclass('public.message_logs') IS NOT NULL THEN
    DELETE FROM message_logs WHERE church_id = v_church_id;
  END IF;

  IF to_regclass('public.frequent_groups') IS NOT NULL THEN
    DELETE FROM frequent_groups WHERE church_id = v_church_id;
  END IF;

  IF to_regclass('public.donation_receipts') IS NOT NULL THEN
    DELETE FROM donation_receipts WHERE church_id = v_church_id;
  END IF;

  IF to_regclass('public.donation_receipt_log') IS NOT NULL THEN
    DELETE FROM donation_receipt_log WHERE church_id = v_church_id;
  END IF;

  IF to_regclass('public.church_settings') IS NOT NULL THEN
    DELETE FROM church_settings WHERE church_id = v_church_id;
  END IF;

  IF to_regclass('public.plans') IS NOT NULL THEN
    DELETE FROM plans WHERE church_id = v_church_id;
  END IF;

  IF to_regclass('public.sermons') IS NOT NULL THEN
    DELETE FROM sermons WHERE church_id = v_church_id;
  END IF;

  IF to_regclass('public.checklist') IS NOT NULL THEN
    DELETE FROM checklist WHERE church_id = v_church_id;
  END IF;

  IF to_regclass('public.events') IS NOT NULL THEN
    DELETE FROM events WHERE church_id = v_church_id_text;
  END IF;

  IF to_regclass('public.departments') IS NOT NULL THEN
    DELETE FROM departments WHERE church_id = v_church_id_text;
  END IF;

  IF to_regclass('public.places') IS NOT NULL THEN
    DELETE FROM places WHERE church_id = v_church_id_text;
  END IF;

  IF to_regclass('public.church_calendar') IS NOT NULL THEN
    DELETE FROM church_calendar WHERE church_id = v_church_id_text;
  END IF;

  IF to_regclass('public.organizations') IS NOT NULL THEN
    DELETE FROM organizations WHERE church_id = v_church_id;
  END IF;

  IF to_regclass('public.school_departments') IS NOT NULL THEN
    DELETE FROM school_departments WHERE church_id = v_church_id;
  END IF;

  IF to_regclass('public.member_status_history') IS NOT NULL THEN
    DELETE FROM member_status_history WHERE church_id = v_church_id;
  END IF;

  IF to_regclass('public.members') IS NOT NULL THEN
    DELETE FROM members WHERE church_id = v_church_id;
  END IF;

  IF to_regclass('public.families') IS NOT NULL THEN
    DELETE FROM families WHERE church_id = v_church_id;
  END IF;

  IF to_regclass('public.settings') IS NOT NULL THEN
    DELETE FROM settings WHERE church_id = v_church_id;
  END IF;

  IF to_regclass('public.church_users') IS NOT NULL THEN
    DELETE FROM church_users WHERE church_id = v_church_id;
  END IF;

  DELETE FROM churches WHERE id = v_church_id;

  RAISE NOTICE '✅ 은혜로교회 시드 데이터 전체 삭제 완료';
END $$;

COMMIT;

-- 확인
SELECT 'remaining' AS status, COUNT(*) AS row_count
FROM members
WHERE church_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
-- 결과가 0 이어야 정상
