-- =====================================================================
-- 0b1_fix_members_update_with_check.sql  (Phase B.1 패치)
-- ---------------------------------------------------------------------
-- 목적
--   기존 public.members 의 RLS UPDATE 정책(tenant_update_members) 이
--   USING 만 박혀있고 WITH CHECK 가 누락된 상태를 보강한다.
--
-- 보안 영향 (잠재적 escape hatch)
--   PostgreSQL UPDATE 정책:
--     - USING      : OLD 행 검증 (이 행을 수정할 수 있는가)
--     - WITH CHECK : NEW 행 검증 (수정 결과가 정책을 만족하는가)
--   WITH CHECK 가 비어있으면 인증된 사용자가
--     UPDATE public.members SET church_id = '<다른 교회 uuid>' WHERE …
--   같은 식으로 NEW church_id 를 자기와 무관한 교회로 바꿔도 정책
--   검증을 통과한다 → cross-tenant write 가능. 이 패치로 차단.
--
-- 영향 범위 (1 policy)
--   - public.members  의 정책 tenant_update_members 만 재CREATE.
--   - members 의 다른 3개 표준 정책 (select / insert / delete) 는
--     건드리지 않는다.
--   - 7개 풀-교체 테이블 (Phase B 에서 새로 만든) 은 영향 없음
--     (이미 WITH CHECK 가 박힌 채 생성됨).
--
-- 표준 패턴 (Phase B 와 동일)
--   USING      (church_id IN (SELECT public.get_my_church_ids()))
--   WITH CHECK (church_id IN (SELECT public.get_my_church_ids()))
--   roles : {authenticated}
--
-- 안전장치
--   - BEGIN … COMMIT 트랜잭션. 실패 시 자동 ROLLBACK.
--   - Pre-check : tenant_update_members 가 존재하지 않으면 EXCEPTION,
--     이미 WITH CHECK 가 채워져 있으면 "수정 불필요" 안내 후 통과.
--   - DROP POLICY IF EXISTS → CREATE POLICY 패턴.
--   - Post-check: with_check 가 실제로 채워졌는지 재검증. 미충족 시
--     EXCEPTION → ROLLBACK.
--
-- 멱등성
--   - 재실행해도 안전. 이미 WITH CHECK 가 박혀있으면 Pre-check 가
--     안내만 출력하고 DROP+CREATE 는 그대로 진행되어 동일 결과를
--     남긴다.
--
-- 롤백
--   - 트랜잭션 도중 실패 시 자동 ROLLBACK.
--   - COMMIT 이후 되돌리려면 DROP + WITH CHECK 없는 형태로 다시
--     CREATE 하는 역마이그레이션 필요 (보안상 권장하지 않음).
-- =====================================================================


BEGIN;


-- =====================================================================
-- Pre-check
-- ---------------------------------------------------------------------
-- (A) tenant_update_members 정책이 존재해야 한다 (없다면 Phase B 미
--     실행 또는 다른 이유로 누락된 것이므로 안전을 위해 EXCEPTION).
-- (B) with_check 가 비어있으면 패치 대상, 채워져 있으면 안내만.
-- =====================================================================
DO $$
DECLARE
    existing_qual       TEXT;
    existing_check      TEXT;
BEGIN
    SELECT qual, with_check
    INTO   existing_qual, existing_check
    FROM   pg_policies
    WHERE  schemaname = 'public'
      AND  tablename  = 'members'
      AND  policyname = 'tenant_update_members';

    IF NOT FOUND THEN
        RAISE EXCEPTION
          '[abort] public.members.tenant_update_members 정책이 존재하지 않습니다. Phase B 적용 상태를 먼저 점검하세요.';
    END IF;

    RAISE NOTICE '[pre-check] tenant_update_members 발견';
    RAISE NOTICE '            USING       = %', existing_qual;
    RAISE NOTICE '            WITH CHECK  = %', COALESCE(existing_check, '(null)');

    IF existing_check IS NULL THEN
        RAISE NOTICE '[plan] WITH CHECK 누락 — 표준 패턴으로 재CREATE 합니다.';
    ELSE
        RAISE NOTICE '[noop?] WITH CHECK 가 이미 존재합니다. 그래도 표준 패턴으로 재CREATE 하여 일관성을 보장합니다 (멱등).';
    END IF;
END
$$;


-- =====================================================================
-- 본작업: tenant_update_members 재CREATE
-- ---------------------------------------------------------------------
-- USING 과 WITH CHECK 에 동일 조건을 박아 cross-tenant write 차단.
-- =====================================================================
DROP POLICY IF EXISTS tenant_update_members ON public.members;

CREATE POLICY tenant_update_members ON public.members
    FOR UPDATE
    TO authenticated
    USING      (church_id IN (SELECT public.get_my_church_ids()))
    WITH CHECK (church_id IN (SELECT public.get_my_church_ids()));

DO $$ BEGIN RAISE NOTICE '[done] members.tenant_update_members — USING + WITH CHECK 표준 패턴으로 재생성'; END $$;


-- =====================================================================
-- Post-check
-- ---------------------------------------------------------------------
-- 재CREATE 결과:
--   · qual / with_check 둘 다 NOT NULL
--   · roles = {authenticated}, cmd = 'UPDATE', permissive = 'PERMISSIVE'
-- 위반 시 EXCEPTION → ROLLBACK.
-- =====================================================================
DO $$
DECLARE
    pol_qual            TEXT;
    pol_check           TEXT;
    pol_roles           TEXT[];
    pol_cmd             TEXT;
    pol_permissive      TEXT;
BEGIN
    SELECT qual, with_check, roles, cmd, permissive
    INTO   pol_qual, pol_check, pol_roles, pol_cmd, pol_permissive
    FROM   pg_policies
    WHERE  schemaname = 'public'
      AND  tablename  = 'members'
      AND  policyname = 'tenant_update_members';

    IF NOT FOUND THEN
        RAISE EXCEPTION '[abort] 재CREATE 직후 tenant_update_members 를 찾을 수 없습니다.';
    END IF;

    IF pol_qual IS NULL OR pol_check IS NULL THEN
        RAISE EXCEPTION
          '[abort] tenant_update_members USING/WITH CHECK 중 하나가 비어있습니다 (qual=%, with_check=%).',
          COALESCE(pol_qual, '(null)'), COALESCE(pol_check, '(null)');
    END IF;

    IF pol_cmd <> 'UPDATE' THEN
        RAISE EXCEPTION '[abort] cmd 가 UPDATE 가 아닙니다: %', pol_cmd;
    END IF;

    IF pol_permissive <> 'PERMISSIVE' THEN
        RAISE EXCEPTION '[abort] permissive 가 PERMISSIVE 가 아닙니다: %', pol_permissive;
    END IF;

    IF NOT ('authenticated' = ANY(pol_roles)) THEN
        RAISE EXCEPTION '[abort] roles 에 authenticated 가 포함되어 있지 않습니다: %', pol_roles;
    END IF;

    RAISE NOTICE '[ok] Post-check 통과 — USING + WITH CHECK 모두 채워졌고, cmd/role/permissive 정상.';
END
$$;


COMMIT;


-- =====================================================================
-- 검증 쿼리 (트랜잭션 외부, READ-ONLY)
-- ---------------------------------------------------------------------
-- COMMIT 이후 아래 SELECT 로 결과를 눈으로 확인.
-- =====================================================================

-- (V1) members 의 4개 표준 정책 현황
--      기대:
--        - tenant_select_members  : qual SET, with_check NULL
--        - tenant_insert_members  : qual NULL, with_check SET
--        - tenant_update_members  : qual SET, with_check SET   ← 패치 결과
--        - tenant_delete_members  : qual SET, with_check NULL
SELECT
    policyname,
    cmd,
    permissive,
    roles,
    qual,
    with_check
FROM   pg_policies
WHERE  schemaname = 'public'
  AND  tablename  = 'members'
ORDER BY cmd, policyname;

-- (V2) WITH CHECK 누락 상태로 남은 UPDATE 정책 잔존 검사
--      대상 9 테이블 (Phase B + members) 의 UPDATE 정책 중 with_check
--      가 비어있는 것이 있는지.
--      기대: 0 행 반환.
SELECT
    tablename,
    policyname,
    qual,
    with_check
FROM   pg_policies
WHERE  schemaname = 'public'
  AND  cmd        = 'UPDATE'
  AND  with_check IS NULL
  AND  tablename IN (
        'church_calendar',
        'counsels',
        'departments',
        'donation_receipt_log',
        'donation_receipts',
        'events',
        'members',
        'places'
    )
ORDER BY tablename, policyname;


-- =====================================================================
-- 다음 단계 안내
-- ---------------------------------------------------------------------
-- 이로써 Phase B 계열 정비가 마무리됩니다 (8개 대상 테이블 모두에서
-- 표준 패턴 일관성 확보). 다음 단계는 Phase C — 회원가입 흐름을
-- API 라우트로 이전(service_role)한 뒤 churches / church_users 의
-- RLS 활성화 및 정책 정비입니다.
-- =====================================================================
