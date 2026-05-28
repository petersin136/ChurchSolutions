-- =====================================================================
-- 0b_close_rls_holes.sql  (Phase B 마이그레이션)
-- ---------------------------------------------------------------------
-- 목적
--   멀티테넌시 보안을 위해 qual='true' (또는 with_check='true') 인
--   "사실상 통과 무방비" 정책 8개를 제거하고, 표준 패턴
--   (get_my_church_ids() 기반) 으로 4개 정책(SELECT/INSERT/UPDATE/
--   DELETE) 을 재생성한다.
--
-- 영향 범위 (8 tables)
--   ─── 허술 정책 DROP + 표준 4개 CREATE  (7 tables) ─────────────
--     · public.church_calendar
--     · public.counsels
--     · public.departments
--     · public.donation_receipt_log
--     · public.donation_receipts
--     · public.events
--     · public.places
--   ─── 허술 정책 DROP 만, 기존 표준 정책 4개는 유지 (1 table) ───
--     · public.members  (기존 "Allow delete for authenticated users"
--                        등 qual=true 정책만 제거)
--
-- 표준 패턴 (members / workflow_cards 등 기존 정책과 동일)
--   - cmd = SELECT  : USING (church_id IN (SELECT public.get_my_church_ids()))
--   - cmd = INSERT  : WITH CHECK (church_id IN (SELECT public.get_my_church_ids()))
--   - cmd = UPDATE  : USING (...) + WITH CHECK (...) 동일 조건
--   - cmd = DELETE  : USING (church_id IN (SELECT public.get_my_church_ids()))
--   - roles         : {authenticated}
--   - 정책명 형식    : tenant_{cmd_lower}_{table_name}
--
-- 사전 조건
--   - public.get_my_church_ids() 함수 존재.
--   - 8개 대상 테이블에 RLS 가 이미 활성화되어 있을 것.
--   - Phase A (0a_church_id_type_unification.sql) 가 이미 적용되어
--     church_calendar / departments / events / places 의 church_id
--     타입이 uuid 인 상태일 것 권장.  (church_id 컬럼 타입과
--     get_my_church_ids() 의 반환 원소 타입이 일치해야 IN 비교가
--     성공한다.)
--
-- 안전장치
--   - BEGIN … COMMIT 트랜잭션. 중간 실패 시 자동 ROLLBACK.
--   - Pre-check  : 함수/테이블/RLS 활성화를 검증. 위반 시 EXCEPTION.
--   - 각 테이블 작업 전, 허술 정책을 동적으로 모두 DROP 후, 표준
--     정책은 CREATE 전 DROP POLICY IF EXISTS 를 한 번 더 호출하여
--     재실행에도 안전(멱등).
--   - Post-check : 작업 후 (1) 8개 테이블에 qual='true'/with_check=
--     'true' 정책이 잔존하지 않고, (2) 7개 풀-교체 테이블에 표준
--     정책 4개씩 정확히 존재함을 검증. 위반 시 EXCEPTION → ROLLBACK.
--
-- 멱등성
--   - 동적 DROP 단계가 "잔존 허술 정책 N 개" 를 알아서 제거.
--   - CREATE 전 DROP POLICY IF EXISTS 로 동명 충돌 방지.
--   - 재실행 시 변경 없이 통과 (RAISE NOTICE 로 0 개 DROP 보고).
--
-- 롤백
--   - 트랜잭션 도중 실패 시 자동 ROLLBACK.
--   - COMMIT 이후 되돌리려면 별도 역마이그레이션 (예: 표준 정책
--     DROP + 원래 허술 정책 재CREATE) 이 필요.
-- =====================================================================


BEGIN;


-- =====================================================================
-- Pre-check
-- ---------------------------------------------------------------------
-- (A) public.get_my_church_ids() 존재 여부
-- (B) 8개 대상 테이블 모두 public 스키마에 존재
-- (C) 8개 대상 테이블 모두 RLS 활성화 상태 (rowsecurity = true)
-- 한 가지라도 위반 시 RAISE EXCEPTION → 전체 ROLLBACK.
-- =====================================================================
DO $$
DECLARE
    target_tables       TEXT[] := ARRAY[
        'church_calendar',
        'counsels',
        'departments',
        'donation_receipt_log',
        'donation_receipts',
        'events',
        'members',
        'places'
    ];
    fn_exists           BOOLEAN;
    missing_tables_str  TEXT;
    rls_off_tables_str  TEXT;
BEGIN
    ------------------------------------------------------------------
    -- (A) get_my_church_ids() 존재 검증
    ------------------------------------------------------------------
    SELECT EXISTS (
        SELECT 1
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE p.proname = 'get_my_church_ids'
          AND n.nspname = 'public'
    )
    INTO fn_exists;

    IF NOT fn_exists THEN
        RAISE EXCEPTION
          '[abort] public.get_my_church_ids() 함수가 존재하지 않습니다. 표준 RLS 패턴을 적용할 수 없습니다.';
    END IF;
    RAISE NOTICE '[ok] (A) public.get_my_church_ids() 존재 확인';

    ------------------------------------------------------------------
    -- (B) 대상 테이블 존재 검증
    ------------------------------------------------------------------
    SELECT string_agg(t, ', ' ORDER BY t)
    INTO   missing_tables_str
    FROM   unnest(target_tables) AS t
    WHERE  NOT EXISTS (
        SELECT 1 FROM pg_tables
        WHERE schemaname = 'public' AND tablename = t
    );

    IF missing_tables_str IS NOT NULL THEN
        RAISE EXCEPTION
          '[abort] 대상 테이블이 public 스키마에 없습니다: %', missing_tables_str;
    END IF;
    RAISE NOTICE '[ok] (B) 대상 테이블 8개 모두 존재 확인';

    ------------------------------------------------------------------
    -- (C) RLS 활성화 검증
    ------------------------------------------------------------------
    SELECT string_agg(tablename, ', ' ORDER BY tablename)
    INTO   rls_off_tables_str
    FROM   pg_tables
    WHERE  schemaname = 'public'
      AND  tablename = ANY(target_tables)
      AND  rowsecurity = false;

    IF rls_off_tables_str IS NOT NULL THEN
        RAISE EXCEPTION
          '[abort] RLS 가 비활성 상태인 테이블이 있습니다: %. ALTER TABLE … ENABLE ROW LEVEL SECURITY 적용 후 재실행하세요.',
          rls_off_tables_str;
    END IF;
    RAISE NOTICE '[ok] (C) 8개 테이블 모두 RLS 활성화 확인';

    RAISE NOTICE '[ok] Pre-check 통과 — 본 마이그레이션을 진행합니다.';
END
$$;


-- =====================================================================
-- 1) church_calendar — 허술 정책 DROP + 표준 4개 CREATE
-- =====================================================================
DO $$
DECLARE
    pol_name        TEXT;
    dropped_count   INTEGER := 0;
BEGIN
    FOR pol_name IN
        SELECT policyname
        FROM   pg_policies
        WHERE  schemaname = 'public' AND tablename = 'church_calendar'
          AND  (qual = 'true' OR with_check = 'true')
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.church_calendar', pol_name);
        dropped_count := dropped_count + 1;
    END LOOP;
    RAISE NOTICE '[step] church_calendar — 허술 정책 % 개 DROP', dropped_count;
END
$$;

DROP POLICY IF EXISTS tenant_select_church_calendar ON public.church_calendar;
CREATE POLICY tenant_select_church_calendar ON public.church_calendar
    FOR SELECT
    TO authenticated
    USING (church_id IN (SELECT public.get_my_church_ids()));

DROP POLICY IF EXISTS tenant_insert_church_calendar ON public.church_calendar;
CREATE POLICY tenant_insert_church_calendar ON public.church_calendar
    FOR INSERT
    TO authenticated
    WITH CHECK (church_id IN (SELECT public.get_my_church_ids()));

DROP POLICY IF EXISTS tenant_update_church_calendar ON public.church_calendar;
CREATE POLICY tenant_update_church_calendar ON public.church_calendar
    FOR UPDATE
    TO authenticated
    USING      (church_id IN (SELECT public.get_my_church_ids()))
    WITH CHECK (church_id IN (SELECT public.get_my_church_ids()));

DROP POLICY IF EXISTS tenant_delete_church_calendar ON public.church_calendar;
CREATE POLICY tenant_delete_church_calendar ON public.church_calendar
    FOR DELETE
    TO authenticated
    USING (church_id IN (SELECT public.get_my_church_ids()));

DO $$ BEGIN RAISE NOTICE '[done] church_calendar — 표준 정책 4개 CREATE'; END $$;


-- =====================================================================
-- 2) counsels — 허술 정책 DROP + 표준 4개 CREATE
-- =====================================================================
DO $$
DECLARE
    pol_name        TEXT;
    dropped_count   INTEGER := 0;
BEGIN
    FOR pol_name IN
        SELECT policyname
        FROM   pg_policies
        WHERE  schemaname = 'public' AND tablename = 'counsels'
          AND  (qual = 'true' OR with_check = 'true')
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.counsels', pol_name);
        dropped_count := dropped_count + 1;
    END LOOP;
    RAISE NOTICE '[step] counsels — 허술 정책 % 개 DROP', dropped_count;
END
$$;

DROP POLICY IF EXISTS tenant_select_counsels ON public.counsels;
CREATE POLICY tenant_select_counsels ON public.counsels
    FOR SELECT
    TO authenticated
    USING (church_id IN (SELECT public.get_my_church_ids()));

DROP POLICY IF EXISTS tenant_insert_counsels ON public.counsels;
CREATE POLICY tenant_insert_counsels ON public.counsels
    FOR INSERT
    TO authenticated
    WITH CHECK (church_id IN (SELECT public.get_my_church_ids()));

DROP POLICY IF EXISTS tenant_update_counsels ON public.counsels;
CREATE POLICY tenant_update_counsels ON public.counsels
    FOR UPDATE
    TO authenticated
    USING      (church_id IN (SELECT public.get_my_church_ids()))
    WITH CHECK (church_id IN (SELECT public.get_my_church_ids()));

DROP POLICY IF EXISTS tenant_delete_counsels ON public.counsels;
CREATE POLICY tenant_delete_counsels ON public.counsels
    FOR DELETE
    TO authenticated
    USING (church_id IN (SELECT public.get_my_church_ids()));

DO $$ BEGIN RAISE NOTICE '[done] counsels — 표준 정책 4개 CREATE'; END $$;


-- =====================================================================
-- 3) departments — 허술 정책 DROP + 표준 4개 CREATE
-- =====================================================================
DO $$
DECLARE
    pol_name        TEXT;
    dropped_count   INTEGER := 0;
BEGIN
    FOR pol_name IN
        SELECT policyname
        FROM   pg_policies
        WHERE  schemaname = 'public' AND tablename = 'departments'
          AND  (qual = 'true' OR with_check = 'true')
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.departments', pol_name);
        dropped_count := dropped_count + 1;
    END LOOP;
    RAISE NOTICE '[step] departments — 허술 정책 % 개 DROP', dropped_count;
END
$$;

DROP POLICY IF EXISTS tenant_select_departments ON public.departments;
CREATE POLICY tenant_select_departments ON public.departments
    FOR SELECT
    TO authenticated
    USING (church_id IN (SELECT public.get_my_church_ids()));

DROP POLICY IF EXISTS tenant_insert_departments ON public.departments;
CREATE POLICY tenant_insert_departments ON public.departments
    FOR INSERT
    TO authenticated
    WITH CHECK (church_id IN (SELECT public.get_my_church_ids()));

DROP POLICY IF EXISTS tenant_update_departments ON public.departments;
CREATE POLICY tenant_update_departments ON public.departments
    FOR UPDATE
    TO authenticated
    USING      (church_id IN (SELECT public.get_my_church_ids()))
    WITH CHECK (church_id IN (SELECT public.get_my_church_ids()));

DROP POLICY IF EXISTS tenant_delete_departments ON public.departments;
CREATE POLICY tenant_delete_departments ON public.departments
    FOR DELETE
    TO authenticated
    USING (church_id IN (SELECT public.get_my_church_ids()));

DO $$ BEGIN RAISE NOTICE '[done] departments — 표준 정책 4개 CREATE'; END $$;


-- =====================================================================
-- 4) donation_receipt_log — 허술 정책 DROP + 표준 4개 CREATE
-- =====================================================================
DO $$
DECLARE
    pol_name        TEXT;
    dropped_count   INTEGER := 0;
BEGIN
    FOR pol_name IN
        SELECT policyname
        FROM   pg_policies
        WHERE  schemaname = 'public' AND tablename = 'donation_receipt_log'
          AND  (qual = 'true' OR with_check = 'true')
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.donation_receipt_log', pol_name);
        dropped_count := dropped_count + 1;
    END LOOP;
    RAISE NOTICE '[step] donation_receipt_log — 허술 정책 % 개 DROP', dropped_count;
END
$$;

DROP POLICY IF EXISTS tenant_select_donation_receipt_log ON public.donation_receipt_log;
CREATE POLICY tenant_select_donation_receipt_log ON public.donation_receipt_log
    FOR SELECT
    TO authenticated
    USING (church_id IN (SELECT public.get_my_church_ids()));

DROP POLICY IF EXISTS tenant_insert_donation_receipt_log ON public.donation_receipt_log;
CREATE POLICY tenant_insert_donation_receipt_log ON public.donation_receipt_log
    FOR INSERT
    TO authenticated
    WITH CHECK (church_id IN (SELECT public.get_my_church_ids()));

DROP POLICY IF EXISTS tenant_update_donation_receipt_log ON public.donation_receipt_log;
CREATE POLICY tenant_update_donation_receipt_log ON public.donation_receipt_log
    FOR UPDATE
    TO authenticated
    USING      (church_id IN (SELECT public.get_my_church_ids()))
    WITH CHECK (church_id IN (SELECT public.get_my_church_ids()));

DROP POLICY IF EXISTS tenant_delete_donation_receipt_log ON public.donation_receipt_log;
CREATE POLICY tenant_delete_donation_receipt_log ON public.donation_receipt_log
    FOR DELETE
    TO authenticated
    USING (church_id IN (SELECT public.get_my_church_ids()));

DO $$ BEGIN RAISE NOTICE '[done] donation_receipt_log — 표준 정책 4개 CREATE'; END $$;


-- =====================================================================
-- 5) donation_receipts — 허술 정책 DROP + 표준 4개 CREATE
-- =====================================================================
DO $$
DECLARE
    pol_name        TEXT;
    dropped_count   INTEGER := 0;
BEGIN
    FOR pol_name IN
        SELECT policyname
        FROM   pg_policies
        WHERE  schemaname = 'public' AND tablename = 'donation_receipts'
          AND  (qual = 'true' OR with_check = 'true')
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.donation_receipts', pol_name);
        dropped_count := dropped_count + 1;
    END LOOP;
    RAISE NOTICE '[step] donation_receipts — 허술 정책 % 개 DROP', dropped_count;
END
$$;

DROP POLICY IF EXISTS tenant_select_donation_receipts ON public.donation_receipts;
CREATE POLICY tenant_select_donation_receipts ON public.donation_receipts
    FOR SELECT
    TO authenticated
    USING (church_id IN (SELECT public.get_my_church_ids()));

DROP POLICY IF EXISTS tenant_insert_donation_receipts ON public.donation_receipts;
CREATE POLICY tenant_insert_donation_receipts ON public.donation_receipts
    FOR INSERT
    TO authenticated
    WITH CHECK (church_id IN (SELECT public.get_my_church_ids()));

DROP POLICY IF EXISTS tenant_update_donation_receipts ON public.donation_receipts;
CREATE POLICY tenant_update_donation_receipts ON public.donation_receipts
    FOR UPDATE
    TO authenticated
    USING      (church_id IN (SELECT public.get_my_church_ids()))
    WITH CHECK (church_id IN (SELECT public.get_my_church_ids()));

DROP POLICY IF EXISTS tenant_delete_donation_receipts ON public.donation_receipts;
CREATE POLICY tenant_delete_donation_receipts ON public.donation_receipts
    FOR DELETE
    TO authenticated
    USING (church_id IN (SELECT public.get_my_church_ids()));

DO $$ BEGIN RAISE NOTICE '[done] donation_receipts — 표준 정책 4개 CREATE'; END $$;


-- =====================================================================
-- 6) events — 허술 정책 DROP + 표준 4개 CREATE
-- =====================================================================
DO $$
DECLARE
    pol_name        TEXT;
    dropped_count   INTEGER := 0;
BEGIN
    FOR pol_name IN
        SELECT policyname
        FROM   pg_policies
        WHERE  schemaname = 'public' AND tablename = 'events'
          AND  (qual = 'true' OR with_check = 'true')
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.events', pol_name);
        dropped_count := dropped_count + 1;
    END LOOP;
    RAISE NOTICE '[step] events — 허술 정책 % 개 DROP', dropped_count;
END
$$;

DROP POLICY IF EXISTS tenant_select_events ON public.events;
CREATE POLICY tenant_select_events ON public.events
    FOR SELECT
    TO authenticated
    USING (church_id IN (SELECT public.get_my_church_ids()));

DROP POLICY IF EXISTS tenant_insert_events ON public.events;
CREATE POLICY tenant_insert_events ON public.events
    FOR INSERT
    TO authenticated
    WITH CHECK (church_id IN (SELECT public.get_my_church_ids()));

DROP POLICY IF EXISTS tenant_update_events ON public.events;
CREATE POLICY tenant_update_events ON public.events
    FOR UPDATE
    TO authenticated
    USING      (church_id IN (SELECT public.get_my_church_ids()))
    WITH CHECK (church_id IN (SELECT public.get_my_church_ids()));

DROP POLICY IF EXISTS tenant_delete_events ON public.events;
CREATE POLICY tenant_delete_events ON public.events
    FOR DELETE
    TO authenticated
    USING (church_id IN (SELECT public.get_my_church_ids()));

DO $$ BEGIN RAISE NOTICE '[done] events — 표준 정책 4개 CREATE'; END $$;


-- =====================================================================
-- 7) places — 허술 정책 DROP + 표준 4개 CREATE
-- =====================================================================
DO $$
DECLARE
    pol_name        TEXT;
    dropped_count   INTEGER := 0;
BEGIN
    FOR pol_name IN
        SELECT policyname
        FROM   pg_policies
        WHERE  schemaname = 'public' AND tablename = 'places'
          AND  (qual = 'true' OR with_check = 'true')
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.places', pol_name);
        dropped_count := dropped_count + 1;
    END LOOP;
    RAISE NOTICE '[step] places — 허술 정책 % 개 DROP', dropped_count;
END
$$;

DROP POLICY IF EXISTS tenant_select_places ON public.places;
CREATE POLICY tenant_select_places ON public.places
    FOR SELECT
    TO authenticated
    USING (church_id IN (SELECT public.get_my_church_ids()));

DROP POLICY IF EXISTS tenant_insert_places ON public.places;
CREATE POLICY tenant_insert_places ON public.places
    FOR INSERT
    TO authenticated
    WITH CHECK (church_id IN (SELECT public.get_my_church_ids()));

DROP POLICY IF EXISTS tenant_update_places ON public.places;
CREATE POLICY tenant_update_places ON public.places
    FOR UPDATE
    TO authenticated
    USING      (church_id IN (SELECT public.get_my_church_ids()))
    WITH CHECK (church_id IN (SELECT public.get_my_church_ids()));

DROP POLICY IF EXISTS tenant_delete_places ON public.places;
CREATE POLICY tenant_delete_places ON public.places
    FOR DELETE
    TO authenticated
    USING (church_id IN (SELECT public.get_my_church_ids()));

DO $$ BEGIN RAISE NOTICE '[done] places — 표준 정책 4개 CREATE'; END $$;


-- =====================================================================
-- 8) members — 허술 정책만 DROP (기존 표준 정책 4개는 유지)
-- ---------------------------------------------------------------------
-- "Allow delete for authenticated users" 등 qual='true' 또는
-- with_check='true' 인 정책만 동적으로 모두 제거. 기존 표준 정책
-- (church_id IN (SELECT get_my_church_ids()) 조건) 은 보존.
-- =====================================================================
DO $$
DECLARE
    pol_name        TEXT;
    dropped_count   INTEGER := 0;
BEGIN
    FOR pol_name IN
        SELECT policyname
        FROM   pg_policies
        WHERE  schemaname = 'public' AND tablename = 'members'
          AND  (qual = 'true' OR with_check = 'true')
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.members', pol_name);
        RAISE NOTICE '         · DROP %I', pol_name;
        dropped_count := dropped_count + 1;
    END LOOP;
    RAISE NOTICE '[done] members — 허술 정책 % 개 DROP (표준 정책 4개는 보존)', dropped_count;
END
$$;


-- =====================================================================
-- Post-check
-- ---------------------------------------------------------------------
-- (1) 8개 대상 테이블에 qual='true' / with_check='true' 정책이
--     하나도 잔존하지 않는지.
-- (2) 7개 풀-교체 테이블 각각에 표준 정책 4개 (tenant_select_*,
--     tenant_insert_*, tenant_update_*, tenant_delete_*) 가 정확히
--     존재하는지.
-- 위반 시 RAISE EXCEPTION → 트랜잭션 전체 ROLLBACK.
-- =====================================================================
DO $$
DECLARE
    target_tables       TEXT[] := ARRAY[
        'church_calendar',
        'counsels',
        'departments',
        'donation_receipt_log',
        'donation_receipts',
        'events',
        'members',
        'places'
    ];
    full_replace_tables TEXT[] := ARRAY[
        'church_calendar',
        'counsels',
        'departments',
        'donation_receipt_log',
        'donation_receipts',
        'events',
        'places'
    ];
    loose_count         INTEGER;
    loose_summary       TEXT;
    t                   TEXT;
    pol_count           INTEGER;
BEGIN
    ------------------------------------------------------------------
    -- (1) 허술 정책 잔존 검사 (8 tables)
    ------------------------------------------------------------------
    SELECT count(*),
           string_agg(tablename || '.' || policyname, ', ' ORDER BY tablename, policyname)
    INTO   loose_count, loose_summary
    FROM   pg_policies
    WHERE  schemaname = 'public'
      AND  tablename = ANY(target_tables)
      AND  (qual = 'true' OR with_check = 'true');

    IF loose_count > 0 THEN
        RAISE EXCEPTION
          '[abort] 허술 정책 % 개 잔존: %', loose_count, loose_summary;
    END IF;
    RAISE NOTICE '[ok] (1) 8개 테이블 모두 qual=true/with_check=true 정책 없음 확인';

    ------------------------------------------------------------------
    -- (2) 7개 풀-교체 테이블 표준 정책 4개씩 정확히 존재
    ------------------------------------------------------------------
    FOREACH t IN ARRAY full_replace_tables LOOP
        SELECT count(*) INTO pol_count
        FROM   pg_policies
        WHERE  schemaname = 'public'
          AND  tablename  = t
          AND  policyname IN (
                'tenant_select_' || t,
                'tenant_insert_' || t,
                'tenant_update_' || t,
                'tenant_delete_' || t
              );
        IF pol_count <> 4 THEN
            RAISE EXCEPTION
              '[abort] % : 표준 정책 4개 중 % 개만 존재 (tenant_select/insert/update/delete_% )',
              t, pol_count, t;
        END IF;
    END LOOP;
    RAISE NOTICE '[ok] (2) 7개 풀-교체 테이블 각각 표준 정책 4개 존재 확인';

    RAISE NOTICE '[ok] Post-check 통과 — COMMIT 진행';
END
$$;


COMMIT;


-- =====================================================================
-- 검증 쿼리 (트랜잭션 외부, READ-ONLY)
-- ---------------------------------------------------------------------
-- COMMIT 이후 아래 SELECT 들을 차례로 실행해 결과를 눈으로 확인.
-- =====================================================================

-- (V1) 8개 대상 테이블의 현재 정책 목록
--      기대:
--        - 7개 풀-교체 테이블: 표준 정책 4행씩
--        - members: 기존 표준 정책 4행 (Allow delete … 등 사라짐)
SELECT
    tablename,
    policyname,
    cmd,
    permissive,
    roles,
    qual,
    with_check
FROM   pg_policies
WHERE  schemaname = 'public'
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
ORDER BY tablename, cmd, policyname;

-- (V2) 허술 정책 (qual='true' or with_check='true') 잔존 검사
--      기대: 8개 대상 테이블에서 0 행 반환
SELECT
    tablename,
    policyname,
    cmd,
    qual,
    with_check
FROM   pg_policies
WHERE  schemaname = 'public'
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
  AND  (qual = 'true' OR with_check = 'true')
ORDER BY tablename, policyname;


-- =====================================================================
-- 다음 단계 안내
-- ---------------------------------------------------------------------
-- 이 파일은 일반 테이블의 보안 정책만 정비합니다. church_users 와
-- churches 의 RLS 활성화는 회원가입 흐름을 API 라우트로 이전하는
-- 작업(Phase C) 과 함께 별도 진행 필요합니다.
-- =====================================================================
