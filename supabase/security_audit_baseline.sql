-- =====================================================================
-- security_audit_baseline.sql
-- ---------------------------------------------------------------------
-- 목적 : 현재 Supabase(Postgres) 인스턴스의 RLS 정책 및 멀티테넌시
--        컬럼 상태를 일괄 점검하여 향후 마이그레이션의 기준선으로 삼는다.
-- 성질 : READ-ONLY. 이 파일의 어떤 쿼리도 DDL/DML 을 수행하지 않는다.
-- 실행 : Supabase Studio → SQL Editor 에서 아래 7개 쿼리를 순서대로
--        실행한 뒤 결과를 채집/스냅샷으로 보관한다.
-- =====================================================================


-- =====================================================================
-- 1) public 스키마 RLS 정책 전체 덤프
--    - tablename, policyname, cmd, qual, with_check, roles
--    - cmd 별 정렬로 SELECT/INSERT/UPDATE/DELETE 정책 비교가 쉬워진다.
-- =====================================================================
SELECT
    schemaname,
    tablename,
    policyname,
    cmd,
    permissive,
    roles,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, cmd, policyname;


-- =====================================================================
-- 2) qual='true' 또는 with_check='true' 인 정책
--    - 모든 행을 무조건 허용하는 "구멍" 후보. RLS 가 켜져 있어도 사실상
--      비활성과 동일한 상태가 되므로 우선 점검 대상이다.
-- =====================================================================
SELECT
    schemaname,
    tablename,
    policyname,
    cmd,
    permissive,
    roles,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND (
        qual       = 'true'
     OR with_check = 'true'
      )
ORDER BY tablename, policyname;


-- =====================================================================
-- 3) church_id 컬럼을 가진 테이블 + 그 컬럼의 data_type / is_nullable
--    - 멀티테넌시 키의 타입 일관성 점검 (uuid vs text 혼재 여부 확인).
--    - NOT NULL 여부도 함께 확인 — nullable 이면 테넌트 누락 행이
--      존재할 수 있다.
-- =====================================================================
SELECT
    c.table_schema,
    c.table_name,
    c.column_name,
    c.data_type,
    c.udt_name,
    c.is_nullable,
    c.column_default
FROM information_schema.columns c
WHERE c.table_schema = 'public'
  AND c.column_name  = 'church_id'
ORDER BY c.table_name;


-- =====================================================================
-- 4) public 스키마 모든 테이블의 RLS 활성화 여부
--    - rowsecurity = true 인 테이블만 RLS 가 강제된다.
--    - false 인 테이블은 1번/2번에서 정책이 보이더라도 실제로는
--      적용되지 않는다 (정책 정의만 남아있을 뿐).
-- =====================================================================
SELECT
    schemaname,
    tablename,
    rowsecurity,
    forcerowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY rowsecurity DESC, tablename;


-- =====================================================================
-- 5) church_id 컬럼이 있지만 churches(id) 를 FK 로 참조하지 않는 테이블
--    - 멀티테넌시 무결성 누락 후보. churches 삭제 시 orphan 행이
--      남을 위험이 있다.
--    - 타입 불일치(text vs uuid)로 인해 FK 자체가 정의 불가능한 경우도
--      이 결과에 포함된다 → 3번 결과와 교차 비교할 것.
-- =====================================================================
SELECT
    c.table_name,
    c.column_name,
    c.data_type,
    c.is_nullable
FROM information_schema.columns c
WHERE c.table_schema = 'public'
  AND c.column_name  = 'church_id'
  AND NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints  tc
        JOIN information_schema.key_column_usage   kcu
          ON tc.constraint_name   = kcu.constraint_name
         AND tc.table_schema      = kcu.table_schema
        JOIN information_schema.constraint_column_usage ccu
          ON tc.constraint_name   = ccu.constraint_name
         AND tc.table_schema      = ccu.table_schema
        WHERE tc.constraint_type  = 'FOREIGN KEY'
          AND kcu.table_schema    = c.table_schema
          AND kcu.table_name      = c.table_name
          AND kcu.column_name     = 'church_id'
          AND ccu.table_name      = 'churches'
          AND ccu.column_name     = 'id'
      )
ORDER BY c.table_name;


-- =====================================================================
-- 6) public 스키마의 모든 FK 제약과 delete_rule / update_rule 일괄 조회
--    - ON DELETE CASCADE / SET NULL / NO ACTION / RESTRICT 정책 확인.
--    - 자식 테이블/컬럼 → 부모 테이블/컬럼 매핑과 제약명을 함께 출력.
-- =====================================================================
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
ORDER BY tc.table_name, tc.constraint_name;


-- =====================================================================
-- 7) get_my_church_ids() 함수 정의 본문 확인
--    - RLS 정책의 핵심 술어로 사용될 가능성이 높은 함수이므로,
--      반환 타입(uuid[] vs text[])과 본문 구현을 정확히 파악한다.
--    - SECURITY DEFINER 여부, volatility, search_path 까지 함께 확인.
-- =====================================================================
SELECT
    n.nspname                                          AS schema_name,
    p.proname                                          AS function_name,
    pg_get_function_identity_arguments(p.oid)          AS arguments,
    pg_get_function_result(p.oid)                      AS return_type,
    l.lanname                                          AS language,
    p.prosecdef                                        AS is_security_definer,
    CASE p.provolatile
        WHEN 'i' THEN 'IMMUTABLE'
        WHEN 's' THEN 'STABLE'
        WHEN 'v' THEN 'VOLATILE'
    END                                                AS volatility,
    p.proconfig                                        AS config_settings,
    p.prosrc                                           AS body
FROM pg_proc       p
JOIN pg_namespace  n ON p.pronamespace = n.oid
JOIN pg_language   l ON p.prolang      = l.oid
WHERE p.proname = 'get_my_church_ids'
ORDER BY n.nspname, p.proname;


-- =====================================================================
-- 이 파일은 read-only 입니다. Supabase Studio SQL Editor 에서 각 쿼리를
-- 순서대로 실행하여 결과를 수집하십시오.
-- =====================================================================
