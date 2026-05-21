-- ============================================================
-- churches 관련 모든 FK 를 ON DELETE CASCADE 로 통일
-- ------------------------------------------------------------
-- 목적
--   · 자식 테이블의 church_id FK 가 NO ACTION / RESTRICT / SET NULL 인 경우
--     CASCADE 로 재생성한다.
--   · church_id 컬럼은 있지만 FK 자체가 없는 테이블에는 CASCADE FK 를 신규
--     추가한다 (uuid 타입 + 고아 row 0 일 때만).
--
-- 적용 후 효과
--   · DELETE FROM public.churches WHERE id = '<uuid>' 한 줄로
--     해당 교회의 종속 데이터가 모두 자동 삭제 (텍스트 church_id 테이블 제외).
--
-- 안전 장치
--   · BEGIN; … COMMIT; 트랜잭션 (시범 실행: 끝의 COMMIT 을 ROLLBACK 으로)
--   · 모든 DDL 은 DO 블록 + EXECUTE format(...) 동적 실행
--   · 존재하지 않는 테이블/컬럼은 to_regclass(), information_schema 로 자동 스킵
--   · STEP 2 의 신규 FK 추가는 (a) 컬럼 uuid 이고 (b) 고아 row = 0 일 때만
-- ============================================================

BEGIN;


-- ────────────────────────────────────────────────────────────
-- STEP 0) 사전 진단 — 적용 전 상태
-- ────────────────────────────────────────────────────────────
-- 0-1) 현재 churches 참조 FK 와 delete_rule (전체)
SELECT
  tc.table_name,
  kcu.column_name,
  tc.constraint_name,
  rc.delete_rule
FROM information_schema.table_constraints  tc
JOIN information_schema.referential_constraints rc
  ON  rc.constraint_name   = tc.constraint_name
  AND rc.constraint_schema = tc.constraint_schema
JOIN information_schema.key_column_usage   kcu
  ON  kcu.constraint_name  = tc.constraint_name
  AND kcu.constraint_schema = tc.constraint_schema
JOIN information_schema.constraint_column_usage ccu
  ON  ccu.constraint_name  = tc.constraint_name
  AND ccu.constraint_schema = tc.constraint_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND ccu.table_schema   = 'public'
  AND ccu.table_name     = 'churches'
ORDER BY rc.delete_rule, tc.table_name;

-- 0-2) church_id 컬럼은 있는데 FK 가 없는 테이블 (적용 전)
SELECT
  c.table_name,
  c.data_type AS church_id_type
FROM information_schema.columns c
WHERE c.table_schema = 'public'
  AND c.column_name  = 'church_id'
  AND NOT EXISTS (
    SELECT 1
    FROM pg_constraint con
    JOIN pg_class      t   ON t.oid = con.conrelid
    JOIN pg_namespace  n   ON n.oid = t.relnamespace
    JOIN pg_attribute  att ON att.attrelid = con.conrelid
                          AND att.attnum   = ANY(con.conkey)
    WHERE con.contype = 'f'
      AND n.nspname   = 'public'
      AND t.relname   = c.table_name
      AND att.attname = 'church_id'
  )
ORDER BY c.data_type, c.table_name;


-- ────────────────────────────────────────────────────────────
-- STEP 1) 기존 FK → CASCADE 재생성
--   information_schema 에서 churches 를 참조하는 모든 FK 중
--   delete_rule 이 CASCADE 가 아닌 것을 찾아 DROP → ADD.
--   (NO ACTION / RESTRICT / SET NULL / SET DEFAULT 모두 포함)
-- ────────────────────────────────────────────────────────────
DO $$
DECLARE
  rec       RECORD;
  converted INT := 0;
  skipped   INT := 0;
BEGIN
  RAISE NOTICE '──── STEP 1) 기존 FK CASCADE 변환 ────';

  FOR rec IN
    SELECT
      tc.table_schema,
      tc.table_name,
      tc.constraint_name,
      kcu.column_name      AS local_column,
      ccu.column_name      AS ref_column,   -- 보통 'id'
      rc.delete_rule
    FROM information_schema.table_constraints  tc
    JOIN information_schema.referential_constraints rc
      ON  rc.constraint_name   = tc.constraint_name
      AND rc.constraint_schema = tc.constraint_schema
    JOIN information_schema.key_column_usage   kcu
      ON  kcu.constraint_name  = tc.constraint_name
      AND kcu.constraint_schema = tc.constraint_schema
    JOIN information_schema.constraint_column_usage ccu
      ON  ccu.constraint_name  = tc.constraint_name
      AND ccu.constraint_schema = tc.constraint_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND ccu.table_schema   = 'public'
      AND ccu.table_name     = 'churches'
      AND rc.delete_rule    <> 'CASCADE'
    ORDER BY tc.table_name, tc.constraint_name
  LOOP
    BEGIN
      EXECUTE format(
        'ALTER TABLE %I.%I DROP CONSTRAINT %I',
        rec.table_schema, rec.table_name, rec.constraint_name
      );
      EXECUTE format(
        'ALTER TABLE %I.%I ADD CONSTRAINT %I '
        'FOREIGN KEY (%I) REFERENCES public.churches(%I) ON DELETE CASCADE',
        rec.table_schema, rec.table_name, rec.constraint_name,
        rec.local_column, rec.ref_column
      );
      converted := converted + 1;
      RAISE NOTICE '  %.%: FK 재생성 완료 (% → CASCADE)',
        rec.table_name, rec.local_column, rec.delete_rule;
    EXCEPTION WHEN OTHERS THEN
      skipped := skipped + 1;
      RAISE WARNING '  %.%: 재생성 실패 — %', rec.table_name, rec.local_column, SQLERRM;
    END;
  END LOOP;

  RAISE NOTICE '──── STEP 1 결과: 변환 % 건 / 실패 % 건 ────', converted, skipped;
END $$;


-- ────────────────────────────────────────────────────────────
-- STEP 2) church_id 컬럼은 있는데 FK 가 없는 테이블에 FK 신규 추가
--   대상 후보 15개. 각 테이블마다:
--     (a) 테이블/컬럼 존재 확인
--     (b) church_id 타입이 uuid 인지 확인 (text 면 SKIP + WARNING)
--     (c) 이미 FK 가 있으면 SKIP (STEP 1 에서 이미 처리됨)
--     (d) churches.id 에 없는 고아 row 존재 시 SKIP + WARNING
--     (e) 위 모두 통과 시 ALTER TABLE ADD CONSTRAINT (CASCADE)
-- ────────────────────────────────────────────────────────────
DO $$
DECLARE
  target_tables text[] := ARRAY[
    'budget',
    'church_calendar',
    'church_settings',
    'custom_fields',
    'custom_labels',
    'departments',
    'events',
    'frequent_groups',
    'message_logs',
    'organizations',
    'places',
    'roles',
    'school_departments',
    'service_types',
    'special_accounts'
  ];
  tbl              text;
  col_type         text;
  has_fk           boolean;
  orphan_count     bigint;
  new_constraint   text;
  added            int := 0;
  skipped_text     int := 0;
  skipped_orphan   int := 0;
  skipped_existing int := 0;
  skipped_missing  int := 0;
BEGIN
  RAISE NOTICE '──── STEP 2) church_id FK 신규 추가 ────';

  FOREACH tbl IN ARRAY target_tables LOOP
    -- (a-1) 테이블 존재
    IF to_regclass('public.' || tbl) IS NULL THEN
      RAISE NOTICE '  %: 테이블 없음 — 건너뜀', tbl;
      skipped_missing := skipped_missing + 1;
      CONTINUE;
    END IF;

    -- (a-2) church_id 컬럼 존재 + 타입
    SELECT data_type INTO col_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = tbl
      AND column_name  = 'church_id';

    IF col_type IS NULL THEN
      RAISE NOTICE '  %: church_id 컬럼 없음 — 건너뜀', tbl;
      skipped_missing := skipped_missing + 1;
      CONTINUE;
    END IF;

    -- (b) text 타입은 FK 불가
    IF col_type <> 'uuid' THEN
      RAISE WARNING '  %: church_id 가 % 타입이라 FK 추가 불가, 수동 검토 필요',
        tbl, col_type;
      skipped_text := skipped_text + 1;
      CONTINUE;
    END IF;

    -- (c) 이미 church_id FK 존재?
    SELECT EXISTS (
      SELECT 1
      FROM pg_constraint con
      JOIN pg_class      t   ON t.oid = con.conrelid
      JOIN pg_namespace  n   ON n.oid = t.relnamespace
      JOIN pg_attribute  att ON att.attrelid = con.conrelid
                            AND att.attnum   = ANY(con.conkey)
      WHERE con.contype = 'f'
        AND n.nspname   = 'public'
        AND t.relname   = tbl
        AND att.attname = 'church_id'
    ) INTO has_fk;

    IF has_fk THEN
      RAISE NOTICE '  %: church_id FK 이미 존재 (STEP 1 에서 CASCADE 변환) — 건너뜀', tbl;
      skipped_existing := skipped_existing + 1;
      CONTINUE;
    END IF;

    -- (d) 고아 row 검사
    EXECUTE format(
      'SELECT COUNT(*)
         FROM public.%I t
        WHERE t.church_id IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM public.churches c WHERE c.id = t.church_id
          )',
      tbl
    ) INTO orphan_count;

    IF orphan_count > 0 THEN
      RAISE WARNING '  %: 고아 row % 건 존재 — FK 추가 전 정리 필요',
        tbl, orphan_count;
      skipped_orphan := skipped_orphan + 1;
      CONTINUE;
    END IF;

    -- (e) FK 추가 (CASCADE)
    new_constraint := format('%s_church_id_fkey', tbl);

    EXECUTE format(
      'ALTER TABLE public.%I
         ADD CONSTRAINT %I
         FOREIGN KEY (church_id) REFERENCES public.churches(id)
         ON DELETE CASCADE',
      tbl, new_constraint
    );
    added := added + 1;
    RAISE NOTICE '  %: FK 신규 추가 완료 (%, CASCADE)', tbl, new_constraint;
  END LOOP;

  RAISE NOTICE '──── STEP 2 결과 ────';
  RAISE NOTICE '  신규 추가          : %', added;
  RAISE NOTICE '  이미 FK 있음(스킵) : %', skipped_existing;
  RAISE NOTICE '  text 타입(스킵)    : %', skipped_text;
  RAISE NOTICE '  고아 row(스킵)     : %', skipped_orphan;
  RAISE NOTICE '  테이블/컬럼 없음   : %', skipped_missing;
END $$;


-- ────────────────────────────────────────────────────────────
-- STEP 3) 최종 검증
-- ────────────────────────────────────────────────────────────

-- 3-1) 모든 churches 참조 FK + delete_rule
SELECT
  tc.table_name,
  kcu.column_name,
  tc.constraint_name,
  rc.delete_rule
FROM information_schema.table_constraints  tc
JOIN information_schema.referential_constraints rc
  ON  rc.constraint_name   = tc.constraint_name
  AND rc.constraint_schema = tc.constraint_schema
JOIN information_schema.key_column_usage   kcu
  ON  kcu.constraint_name  = tc.constraint_name
  AND kcu.constraint_schema = tc.constraint_schema
JOIN information_schema.constraint_column_usage ccu
  ON  ccu.constraint_name  = tc.constraint_name
  AND ccu.constraint_schema = tc.constraint_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND ccu.table_schema   = 'public'
  AND ccu.table_name     = 'churches'
ORDER BY tc.table_name;

-- 3-2) CASCADE 가 아닌 FK 만 — 정상이면 0행
SELECT
  tc.table_name,
  kcu.column_name,
  tc.constraint_name,
  rc.delete_rule
FROM information_schema.table_constraints  tc
JOIN information_schema.referential_constraints rc
  ON  rc.constraint_name   = tc.constraint_name
  AND rc.constraint_schema = tc.constraint_schema
JOIN information_schema.key_column_usage   kcu
  ON  kcu.constraint_name  = tc.constraint_name
  AND kcu.constraint_schema = tc.constraint_schema
JOIN information_schema.constraint_column_usage ccu
  ON  ccu.constraint_name  = tc.constraint_name
  AND ccu.constraint_schema = tc.constraint_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND ccu.table_schema   = 'public'
  AND ccu.table_name     = 'churches'
  AND rc.delete_rule    <> 'CASCADE'
ORDER BY tc.table_name;

-- 3-3) church_id 컬럼은 있는데 여전히 FK 가 없는 테이블
--      → 정상: text 타입만 남아야 함 (또는 0행)
SELECT
  c.table_name,
  c.data_type AS church_id_type
FROM information_schema.columns c
WHERE c.table_schema = 'public'
  AND c.column_name  = 'church_id'
  AND NOT EXISTS (
    SELECT 1
    FROM pg_constraint con
    JOIN pg_class      t   ON t.oid = con.conrelid
    JOIN pg_namespace  n   ON n.oid = t.relnamespace
    JOIN pg_attribute  att ON att.attrelid = con.conrelid
                          AND att.attnum   = ANY(con.conkey)
    WHERE con.contype = 'f'
      AND n.nspname   = 'public'
      AND t.relname   = c.table_name
      AND att.attname = 'church_id'
  )
ORDER BY c.data_type, c.table_name;


COMMIT;
-- 시범 실행 시: 위 COMMIT; 을 ROLLBACK; 으로 바꾸면
-- STEP 0/1/2/3 의 출력만 확인하고 실제 변경은 되돌릴 수 있음.


-- ============================================================
-- 실행 후 확인 가이드
-- ------------------------------------------------------------
-- 1) "Messages" 탭에서
--    · STEP 1: "%.%: FK 재생성 완료 (X → CASCADE)" 로그가
--      24개 안팎 출력되는지 확인.
--    · STEP 2: "%: FK 신규 추가 완료" 또는 적절한 SKIP 사유.
-- 2) STEP 3-2 결과가 0행 (모두 CASCADE).
-- 3) STEP 3-3 결과는 text 타입 테이블만 (departments, places,
--    events, church_calendar) — 이들은 컬럼 타입을 uuid 로 마이그레이션
--    한 후 별도로 FK 를 추가해야 함.
-- 4) STEP 2 에서 [WARNING] 고아 row 가 발견된 테이블은 별도로
--    "UPDATE … SET church_id = NULL" 또는 "DELETE …" 로 정리 후
--    이 파일을 재실행해 FK 를 마저 추가.
-- ============================================================
