-- =====================================================================
-- 0a_church_id_type_unification.sql  (Phase A 마이그레이션)
-- ---------------------------------------------------------------------
-- 목적
--   church_calendar / departments / events / places 네 테이블의
--   church_id 컬럼을 text → uuid 로 통일하고, churches(id) 를
--   참조하는 외래키(ON DELETE CASCADE) 를 추가한다.
--
-- 영향 범위 (4 tables)
--   - public.church_calendar  (현재 데이터 0건)
--   - public.departments      (현재 데이터 51건)
--   - public.events           (현재 데이터 37건)
--   - public.places           (현재 데이터 30건)
--   * 다른 테이블은 본 파일에서 손대지 않는다.
--
-- 사전 조건
--   - churches.id 가 uuid 타입이고 PRIMARY KEY 라는 점.
--   - 위 4개 테이블의 church_id 값이 모두 유효한 UUID 문자열이며,
--     모두 churches.id 에 실재해야 한다.
--     (Pre-flight 단계에서 검증; 위반 시 트랜잭션 전체 ROLLBACK)
--
-- 잠금 영향
--   - ALTER COLUMN TYPE 는 ACCESS EXCLUSIVE 락 + 테이블 재작성.
--     본 4개 테이블의 총 행 수가 100여 행 수준이므로 실 운영 영향
--     매우 미미. 그러나 쓰기 트래픽이 있는 시간대는 피하는 게 안전.
--
-- 멱등성
--   - DROP CONSTRAINT IF EXISTS … ; ADD CONSTRAINT … 패턴으로
--     FK 추가는 재실행에 안전.
--   - ALTER COLUMN TYPE uuid USING church_id::uuid 는 컬럼이 이미
--     uuid 인 경우에도 형식상 성공(트리비얼 재작성). 두 번 돌려도
--     데이터 손상 없음.
--
-- RLS 정책 호환성 (주의)
--   - 만약 위 4개 테이블 어디엔가 church_id 를 text 로 비교/캐스트
--     하는 RLS 정책이 존재한다면, 본 ALTER 가 실패하거나 실행 후
--     정책이 깨질 수 있다.
--   - 본 파일은 트랜잭션으로 감싸져 있으므로 실패 시 자동 ROLLBACK.
--     실행 전 supabase/security_audit_baseline.sql 의 (1)(2)(7)번
--     쿼리로 정책을 한 번 확인할 것을 권장한다.
--
-- 롤백
--   - 본 마이그레이션은 BEGIN … COMMIT 으로 감싸져 있어, 실행 도중
--     RAISE EXCEPTION 또는 DDL 실패가 발생하면 자동 ROLLBACK 된다.
--   - COMMIT 까지 정상 완료된 뒤 되돌리려면 별도의 역마이그레이션
--     스크립트가 필요하다 (FK DROP + 컬럼 타입 uuid → text 환원).
-- =====================================================================


BEGIN;


-- =====================================================================
-- Pre-flight 검증
-- ---------------------------------------------------------------------
-- A) 4개 테이블의 church_id 값이 모두 UUID 형식 문자열인지 확인.
--    (RFC 4122 8-4-4-4-12 hex 패턴)
-- B) 4개 테이블의 church_id 가 모두 churches.id 에 실재하는지 확인.
--    (orphan 한 행이라도 있으면 FK 추가 시 실패 → 사전 중단)
-- 한 가지라도 위반 시 RAISE EXCEPTION 으로 트랜잭션 전체 ROLLBACK.
-- =====================================================================
DO $$
DECLARE
    invalid_uuid_count  INTEGER;
    orphan_count        INTEGER;
    bad_table_summary   TEXT;
BEGIN
    ------------------------------------------------------------------
    -- (A) UUID 형식 검증
    ------------------------------------------------------------------
    WITH all_ids AS (
        SELECT 'church_calendar'::text AS tbl, church_id FROM public.church_calendar
        UNION ALL
        SELECT 'departments',                 church_id FROM public.departments
        UNION ALL
        SELECT 'events',                      church_id FROM public.events
        UNION ALL
        SELECT 'places',                      church_id FROM public.places
    ),
    invalid_rows AS (
        SELECT tbl, church_id
        FROM all_ids
        WHERE church_id IS NULL
           OR church_id !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    )
    SELECT
        count(*),
        string_agg(DISTINCT tbl, ', ' ORDER BY tbl)
    INTO invalid_uuid_count, bad_table_summary
    FROM invalid_rows;

    IF invalid_uuid_count > 0 THEN
        RAISE EXCEPTION
          '[abort] church_id 가 UUID 형식이 아닌 행 % 건 발견 (테이블: %). 데이터 정리 후 재실행하세요.',
          invalid_uuid_count, COALESCE(bad_table_summary, '(none)');
    END IF;

    RAISE NOTICE '[ok] (A) UUID 형식 검증 통과 — 위반 행 0';

    ------------------------------------------------------------------
    -- (B) Orphan row 검증 (church_id 가 churches.id 에 실재하는가)
    ------------------------------------------------------------------
    WITH all_ids AS (
        SELECT 'church_calendar'::text AS tbl, church_id FROM public.church_calendar
        UNION ALL
        SELECT 'departments',                 church_id FROM public.departments
        UNION ALL
        SELECT 'events',                      church_id FROM public.events
        UNION ALL
        SELECT 'places',                      church_id FROM public.places
    ),
    orphans AS (
        SELECT a.tbl, a.church_id
        FROM all_ids a
        LEFT JOIN public.churches c
          ON c.id = a.church_id::uuid
        WHERE c.id IS NULL
    )
    SELECT
        count(*),
        string_agg(DISTINCT tbl, ', ' ORDER BY tbl)
    INTO orphan_count, bad_table_summary
    FROM orphans;

    IF orphan_count > 0 THEN
        RAISE EXCEPTION
          '[abort] churches.id 에 없는 church_id 를 가진 행 % 건 발견 (테이블: %). 사전 정리 후 재실행하세요.',
          orphan_count, COALESCE(bad_table_summary, '(none)');
    END IF;

    RAISE NOTICE '[ok] (B) Orphan 검증 통과 — orphan 행 0';
    RAISE NOTICE '[ok] Pre-flight 통과. 본 마이그레이션을 진행합니다.';
END
$$;


-- =====================================================================
-- 1) church_calendar
--    a) church_id : text → uuid
--    b) FK church_calendar.church_id → churches(id) ON DELETE CASCADE
-- =====================================================================
ALTER TABLE public.church_calendar
    ALTER COLUMN church_id TYPE uuid USING church_id::uuid;

ALTER TABLE public.church_calendar
    DROP CONSTRAINT IF EXISTS church_calendar_church_id_fkey;

ALTER TABLE public.church_calendar
    ADD CONSTRAINT church_calendar_church_id_fkey
        FOREIGN KEY (church_id) REFERENCES public.churches(id)
        ON DELETE CASCADE;

DO $$ BEGIN RAISE NOTICE '[done] church_calendar — church_id uuid + FK CASCADE'; END $$;


-- =====================================================================
-- 2) departments
--    a) church_id : text → uuid
--    b) FK departments.church_id → churches(id) ON DELETE CASCADE
-- =====================================================================
ALTER TABLE public.departments
    ALTER COLUMN church_id TYPE uuid USING church_id::uuid;

ALTER TABLE public.departments
    DROP CONSTRAINT IF EXISTS departments_church_id_fkey;

ALTER TABLE public.departments
    ADD CONSTRAINT departments_church_id_fkey
        FOREIGN KEY (church_id) REFERENCES public.churches(id)
        ON DELETE CASCADE;

DO $$ BEGIN RAISE NOTICE '[done] departments — church_id uuid + FK CASCADE'; END $$;


-- =====================================================================
-- 3) events
--    a) church_id : text → uuid
--    b) FK events.church_id → churches(id) ON DELETE CASCADE
--    * events.department_id (→ departments.id) 와 events.place_id
--      (→ places.id) 는 이미 uuid FK 로 존재한다 (변경 없음).
-- =====================================================================
ALTER TABLE public.events
    ALTER COLUMN church_id TYPE uuid USING church_id::uuid;

ALTER TABLE public.events
    DROP CONSTRAINT IF EXISTS events_church_id_fkey;

ALTER TABLE public.events
    ADD CONSTRAINT events_church_id_fkey
        FOREIGN KEY (church_id) REFERENCES public.churches(id)
        ON DELETE CASCADE;

DO $$ BEGIN RAISE NOTICE '[done] events — church_id uuid + FK CASCADE'; END $$;


-- =====================================================================
-- 4) places
--    a) church_id : text → uuid
--    b) FK places.church_id → churches(id) ON DELETE CASCADE
-- =====================================================================
ALTER TABLE public.places
    ALTER COLUMN church_id TYPE uuid USING church_id::uuid;

ALTER TABLE public.places
    DROP CONSTRAINT IF EXISTS places_church_id_fkey;

ALTER TABLE public.places
    ADD CONSTRAINT places_church_id_fkey
        FOREIGN KEY (church_id) REFERENCES public.churches(id)
        ON DELETE CASCADE;

DO $$ BEGIN RAISE NOTICE '[done] places — church_id uuid + FK CASCADE'; END $$;


COMMIT;


-- =====================================================================
-- 검증 쿼리 (트랜잭션 외부, READ-ONLY)
-- ---------------------------------------------------------------------
-- COMMIT 이후 아래 3가지 SELECT 를 차례로 실행하여 결과를 눈으로 확인.
-- 결과가 기대치와 다르면 즉시 보고/대응 필요.
-- =====================================================================

-- (V1) 4개 테이블 church_id 타입이 uuid 인지 확인
--      기대: 4행 모두 data_type='uuid'
SELECT
    table_name,
    column_name,
    data_type,
    udt_name,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND column_name  = 'church_id'
  AND table_name IN ('church_calendar', 'departments', 'events', 'places')
ORDER BY table_name;

-- (V2) 4개 테이블의 church_id FK 가 정상 추가되었는지 확인
--      기대: 4행. 각 row 의 parent_table='churches', delete_rule='CASCADE'.
SELECT
    tc.table_name        AS child_table,
    kcu.column_name      AS child_column,
    ccu.table_name       AS parent_table,
    ccu.column_name      AS parent_column,
    rc.delete_rule,
    rc.update_rule,
    tc.constraint_name
FROM information_schema.table_constraints       tc
JOIN information_schema.key_column_usage        kcu
  ON tc.constraint_name = kcu.constraint_name
 AND tc.table_schema    = kcu.table_schema
JOIN information_schema.constraint_column_usage ccu
  ON tc.constraint_name = ccu.constraint_name
 AND tc.table_schema    = ccu.table_schema
JOIN information_schema.referential_constraints rc
  ON tc.constraint_name = rc.constraint_name
 AND tc.table_schema    = rc.constraint_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema    = 'public'
  AND tc.table_name IN ('church_calendar', 'departments', 'events', 'places')
  AND kcu.column_name    = 'church_id'
ORDER BY tc.table_name;

-- (V3) 데이터 건수 변화 없음 확인
--      기대 (Phase A 시작 시점 스냅샷 기준):
--        church_calendar = 0
--        events          = 37
--        departments     = 51
--        places          = 30
--      ※ 운영 중인 DB라면 시점 차이로 ±α 가능. 큰 변동만 점검.
SELECT 'church_calendar' AS table_name, count(*) AS row_count FROM public.church_calendar
UNION ALL
SELECT 'departments',                    count(*)              FROM public.departments
UNION ALL
SELECT 'events',                         count(*)              FROM public.events
UNION ALL
SELECT 'places',                         count(*)              FROM public.places
ORDER BY table_name;


-- =====================================================================
-- 롤백 안내
-- ---------------------------------------------------------------------
-- 이 마이그레이션은 트랜잭션으로 감싸져 있으므로, 실행 중 에러 발생 시
-- 자동으로 롤백됩니다. 적용 후 되돌리려면 별도의 역마이그레이션이
-- 필요합니다.
-- =====================================================================
