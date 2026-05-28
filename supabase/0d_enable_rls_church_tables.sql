-- ============================================================
-- Phase D: church_users / churches RLS 활성화
-- ============================================================
-- 배경:
--   - Phase C로 INSERT/UPDATE는 service_role(서버 라우트)에서만 발생
--   - 기존 정책은 church_users 자기 자신을 SELECT하는 무한재귀 구조
--   - get_my_church_ids() 함수(SECURITY DEFINER)로 재귀 회피
-- 영향:
--   - 두 테이블 모두 RLS ON
--   - SELECT: 본인 소속 교회만 조회 가능
--   - INSERT/UPDATE/DELETE: service_role만 가능 (RLS 우회)
-- ============================================================

BEGIN;

-- 1. Pre-check: get_my_church_ids() 존재 확인
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'get_my_church_ids'
  ) THEN
    RAISE EXCEPTION '[pre-check] get_my_church_ids() 함수가 없습니다.';
  END IF;
  RAISE NOTICE '[ok] get_my_church_ids() 함수 확인';
END $$;

-- 2. 기존 재귀 정책 제거
DROP POLICY IF EXISTS church_users_own_church ON public.church_users;
DROP POLICY IF EXISTS church_users_insert_own ON public.church_users;
DROP POLICY IF EXISTS churches_select_own ON public.churches;

DO $$ BEGIN RAISE NOTICE '[step] 기존 재귀 정책 3개 DROP 완료'; END $$;

-- 3. church_users 새 정책 (SELECT만 — INSERT/UPDATE/DELETE는 service_role 전용)
CREATE POLICY tenant_select_church_users ON public.church_users
  FOR SELECT TO authenticated
  USING (church_id IN (SELECT public.get_my_church_ids()));

DO $$ BEGIN RAISE NOTICE '[done] church_users SELECT 정책 생성'; END $$;

-- 4. churches 새 정책 (SELECT만)
CREATE POLICY tenant_select_churches ON public.churches
  FOR SELECT TO authenticated
  USING (id IN (SELECT public.get_my_church_ids()));

DO $$ BEGIN RAISE NOTICE '[done] churches SELECT 정책 생성'; END $$;

-- 5. RLS 활성화
ALTER TABLE public.church_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.churches ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN RAISE NOTICE '[done] 두 테이블 RLS ENABLE 완료'; END $$;

-- 6. Post-check: RLS 활성화 + 정책 개수 검증
DO $$
DECLARE
  rls_users boolean;
  rls_churches boolean;
  cnt_users int;
  cnt_churches int;
BEGIN
  SELECT rowsecurity INTO rls_users FROM pg_tables
    WHERE schemaname='public' AND tablename='church_users';
  SELECT rowsecurity INTO rls_churches FROM pg_tables
    WHERE schemaname='public' AND tablename='churches';

  IF NOT rls_users OR NOT rls_churches THEN
    RAISE EXCEPTION '[post-check] RLS 활성화 실패';
  END IF;

  SELECT COUNT(*) INTO cnt_users FROM pg_policies
    WHERE schemaname='public' AND tablename='church_users';
  SELECT COUNT(*) INTO cnt_churches FROM pg_policies
    WHERE schemaname='public' AND tablename='churches';

  IF cnt_users <> 1 OR cnt_churches <> 1 THEN
    RAISE EXCEPTION '[post-check] 정책 개수 이상 (users=%, churches=%)', cnt_users, cnt_churches;
  END IF;

  RAISE NOTICE '[ok] Post-check 통과 — RLS ON, 정책 각 1개. COMMIT 진행.';
END $$;

COMMIT;

-- ============================================================
-- 검증 쿼리 (트랜잭션 외부)
-- ============================================================

-- V1: RLS 상태
SELECT tablename, rowsecurity FROM pg_tables
WHERE schemaname='public' AND tablename IN ('church_users','churches');

-- V2: 새 정책 확인
SELECT tablename, policyname, cmd, roles, qual
FROM pg_policies
WHERE schemaname='public' AND tablename IN ('church_users','churches')
ORDER BY tablename;
