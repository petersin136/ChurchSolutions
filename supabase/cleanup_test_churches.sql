-- ============================================================
-- 테스트 교회 8개 + 종속 데이터 전체 정리
-- ------------------------------------------------------------
-- 남기는 교회:
--   · 그날미니스트리
--   · 건강한교회
--
-- 삭제 대상 (church_id 8개):
--   b7396060-5f7f-4bb2-9eac-af65a17afa0b  양평교회 1
--   be9411d4-fc1c-4a46-a588-95ef8c46b30f  양평교회 2
--   39bb3d02-d74a-4460-93ca-bca2f38d0cf7  구리시 목자교회
--   07bc2b08-d3eb-4b54-919e-6dcab1d91d38  승용교회
--   a1b2c3d4-e5f6-7890-abcd-ef1234567890  은혜로교회
--   48007e60-83cb-4336-a9a4-7e34ed66da81  포천중앙침례 1
--   b9328d50-ebe9-4877-b382-54cdbbcb05d2  포천중앙침례 2
--   2a15ed43-c845-4ce0-b2d2-ccca6669dacd  포천중앙침례 3
--
-- 안전 장치
--   · BEGIN; … COMMIT; 트랜잭션 (시범 실행은 끝의 COMMIT 을 ROLLBACK 으로 교체)
--   · 모든 DELETE 는 8개 church_id 로만 좁힘 → 다른 교회 데이터 영향 없음
--   · 존재하지 않는 테이블은 to_regclass() 로 자동 스킵
--   · CASCADE 가 이미 걸린 테이블은 명시 삭제 안 함
--       (church_users / bulletins / donation_receipts / donation_receipt_log /
--        church_settings / workflows / workflow_steps / workflow_cards /
--        workflow_card_notes / servant_school_graduates)
--     ↳ 마지막 `DELETE FROM churches` 한 줄로 CASCADE 자동 정리
--
-- 삭제 순서 (FK 안전)
--   (a) members / orgs / accounts 참조 손자 테이블
--   (b) 메인 엔티티 (members, families, school_classes, …)
--   (c) 독립 church_id 테이블 (uuid, text 분리)
--   (d) churches  ← CASCADE 발동
-- ============================================================

BEGIN;

-- ────────────────────────────────────────────────────────────
-- STEP 0) 사전 확인 — 삭제 전 상태
-- ────────────────────────────────────────────────────────────
SELECT id, name, plan, is_active
FROM public.churches
WHERE id = ANY(ARRAY[
  'b7396060-5f7f-4bb2-9eac-af65a17afa0b',
  'be9411d4-fc1c-4a46-a588-95ef8c46b30f',
  '39bb3d02-d74a-4460-93ca-bca2f38d0cf7',
  '07bc2b08-d3eb-4b54-919e-6dcab1d91d38',
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  '48007e60-83cb-4336-a9a4-7e34ed66da81',
  'b9328d50-ebe9-4877-b382-54cdbbcb05d2',
  '2a15ed43-c845-4ce0-b2d2-ccca6669dacd'
]::uuid[])
ORDER BY name;


-- ────────────────────────────────────────────────────────────
-- STEP 1) 본 정리 — 카테고리별로 ROW_COUNT 출력
-- ────────────────────────────────────────────────────────────
DO $$
DECLARE
  ids uuid[] := ARRAY[
    'b7396060-5f7f-4bb2-9eac-af65a17afa0b',
    'be9411d4-fc1c-4a46-a588-95ef8c46b30f',
    '39bb3d02-d74a-4460-93ca-bca2f38d0cf7',
    '07bc2b08-d3eb-4b54-919e-6dcab1d91d38',
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    '48007e60-83cb-4336-a9a4-7e34ed66da81',
    'b9328d50-ebe9-4877-b382-54cdbbcb05d2',
    '2a15ed43-c845-4ce0-b2d2-ccca6669dacd'
  ]::uuid[];
  ids_text text[] := ARRAY[
    'b7396060-5f7f-4bb2-9eac-af65a17afa0b',
    'be9411d4-fc1c-4a46-a588-95ef8c46b30f',
    '39bb3d02-d74a-4460-93ca-bca2f38d0cf7',
    '07bc2b08-d3eb-4b54-919e-6dcab1d91d38',
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    '48007e60-83cb-4336-a9a4-7e34ed66da81',
    'b9328d50-ebe9-4877-b382-54cdbbcb05d2',
    '2a15ed43-c845-4ce0-b2d2-ccca6669dacd'
  ];
  rc  int;
  tbl text;
BEGIN
  -- ─── (a) 손자 테이블: members / organizations / special_accounts 참조 ───
  RAISE NOTICE '──── (a) 손자 테이블 ────';
  FOREACH tbl IN ARRAY ARRAY[
    'school_attendance',
    'school_enrollments',
    'school_transfer_history',
    'member_status_history',
    'organization_members',
    'user_roles',
    'audit_logs',
    'message_logs',
    'special_account_transactions',
    'attendance',
    'notes',
    'visits',
    'counsels',
    'new_family_program',
    'income'
  ] LOOP
    IF to_regclass('public.' || tbl) IS NOT NULL THEN
      EXECUTE format('DELETE FROM public.%I WHERE church_id = ANY($1)', tbl)
        USING ids;
      GET DIAGNOSTICS rc = ROW_COUNT;
      RAISE NOTICE '  %: % 행 삭제', tbl, rc;
    ELSE
      RAISE NOTICE '  %: 테이블 없음 — 건너뜀', tbl;
    END IF;
  END LOOP;

  -- ─── (b) 메인 엔티티: members → families/school_classes → 부모 ───
  --      members 를 먼저 비워야 families 의 자식 FK 가 사라짐.
  --      school_classes 를 먼저 비워야 school_departments 부모 삭제 가능.
  RAISE NOTICE '──── (b) 메인 엔티티 ────';
  FOREACH tbl IN ARRAY ARRAY[
    'members',
    'families',
    'school_classes',
    'school_departments',
    'organizations',
    'roles',
    'special_accounts'
  ] LOOP
    IF to_regclass('public.' || tbl) IS NOT NULL THEN
      EXECUTE format('DELETE FROM public.%I WHERE church_id = ANY($1)', tbl)
        USING ids;
      GET DIAGNOSTICS rc = ROW_COUNT;
      RAISE NOTICE '  %: % 행 삭제', tbl, rc;
    ELSE
      RAISE NOTICE '  %: 테이블 없음 — 건너뜀', tbl;
    END IF;
  END LOOP;

  -- ─── (c-1) 독립 church_id (uuid) 테이블 ───
  RAISE NOTICE '──── (c-1) church_id uuid 테이블 ────';
  FOREACH tbl IN ARRAY ARRAY[
    'budget',
    'expense',
    'sermons',
    'plans',
    'checklist',
    'settings',
    'service_types',
    'frequent_groups',
    'custom_fields',
    'custom_labels'
  ] LOOP
    IF to_regclass('public.' || tbl) IS NOT NULL THEN
      EXECUTE format('DELETE FROM public.%I WHERE church_id = ANY($1)', tbl)
        USING ids;
      GET DIAGNOSTICS rc = ROW_COUNT;
      RAISE NOTICE '  %: % 행 삭제', tbl, rc;
    ELSE
      RAISE NOTICE '  %: 테이블 없음 — 건너뜀', tbl;
    END IF;
  END LOOP;

  -- ─── (c-2) 독립 church_id (text) 테이블 ───
  --      church_planner_public_tables.sql / church_planner.sql 계열은
  --      church_id 컬럼이 TEXT 로 정의되어 있어 별도 배열로 처리.
  RAISE NOTICE '──── (c-2) church_id text 테이블 ────';
  FOREACH tbl IN ARRAY ARRAY[
    'church_calendar',
    'departments',
    'places',
    'events'
  ] LOOP
    IF to_regclass('public.' || tbl) IS NOT NULL THEN
      EXECUTE format('DELETE FROM public.%I WHERE church_id = ANY($1)', tbl)
        USING ids_text;
      GET DIAGNOSTICS rc = ROW_COUNT;
      RAISE NOTICE '  %: % 행 삭제', tbl, rc;
    ELSE
      RAISE NOTICE '  %: 테이블 없음 — 건너뜀', tbl;
    END IF;
  END LOOP;

  -- ─── (d) churches 본체 — CASCADE 발동 ───
  RAISE NOTICE '──── (d) churches 본체 (CASCADE) ────';
  DELETE FROM public.churches WHERE id = ANY(ids);
  GET DIAGNOSTICS rc = ROW_COUNT;
  RAISE NOTICE '  churches: % 행 삭제', rc;
  RAISE NOTICE '    ↳ CASCADE 자동 정리 대상:';
  RAISE NOTICE '      church_users, bulletins, donation_receipts,';
  RAISE NOTICE '      donation_receipt_log, church_settings,';
  RAISE NOTICE '      workflows, workflow_steps, workflow_cards,';
  RAISE NOTICE '      workflow_card_notes, servant_school_graduates';
END $$;


-- ────────────────────────────────────────────────────────────
-- STEP 2) 검증
-- ────────────────────────────────────────────────────────────

-- 2-1) 남은 교회 — "그날미니스트리" / "건강한교회" 2건만 보여야 함
SELECT name, COUNT(*) AS row_count
FROM public.churches
GROUP BY name
ORDER BY name;

-- 2-2) workflows 총합 — 5 templates × 2 churches = 10 이어야 함
SELECT COUNT(*) AS workflows_total
FROM public.workflows;

-- 2-3) 삭제 대상 church_id 가 어디든 남아있는지 광범위 점검
--      (정상이라면 0행)
WITH dead_ids AS (
  SELECT unnest(ARRAY[
    'b7396060-5f7f-4bb2-9eac-af65a17afa0b'::uuid,
    'be9411d4-fc1c-4a46-a588-95ef8c46b30f'::uuid,
    '39bb3d02-d74a-4460-93ca-bca2f38d0cf7'::uuid,
    '07bc2b08-d3eb-4b54-919e-6dcab1d91d38'::uuid,
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid,
    '48007e60-83cb-4336-a9a4-7e34ed66da81'::uuid,
    'b9328d50-ebe9-4877-b382-54cdbbcb05d2'::uuid,
    '2a15ed43-c845-4ce0-b2d2-ccca6669dacd'::uuid
  ]) AS cid
)
SELECT 'churches' AS table_name, COUNT(*) AS leftover
  FROM public.churches WHERE id IN (SELECT cid FROM dead_ids)
UNION ALL SELECT 'members',      COUNT(*) FROM public.members      WHERE church_id IN (SELECT cid FROM dead_ids)
UNION ALL SELECT 'attendance',   COUNT(*) FROM public.attendance   WHERE church_id IN (SELECT cid FROM dead_ids)
UNION ALL SELECT 'workflows',    COUNT(*) FROM public.workflows    WHERE church_id IN (SELECT cid FROM dead_ids)
UNION ALL SELECT 'workflow_cards',COUNT(*) FROM public.workflow_cards WHERE church_id IN (SELECT cid FROM dead_ids);


COMMIT;
-- 시범 실행 시: 위 COMMIT; 을 ROLLBACK; 으로 바꿔서 실행하면
-- STEP 0/1/2 의 출력만 보고 실제 변경은 되돌릴 수 있음.


-- ============================================================
-- 실행 후 확인 가이드
-- ------------------------------------------------------------
-- 1) "Messages" 탭에서 카테고리(a)/(b)/(c-1)/(c-2)/(d) 별
--    "테이블명: N 행 삭제" 로그가 순서대로 찍히는지 확인.
-- 2) STEP 2-1 결과가 정확히 2행("그날미니스트리","건강한교회") 인지 확인.
-- 3) STEP 2-2 결과가 10 인지 확인 (시드된 템플릿 5개 × 2 교회).
-- 4) STEP 2-3 결과가 모두 leftover=0 인지 확인.
-- ============================================================
