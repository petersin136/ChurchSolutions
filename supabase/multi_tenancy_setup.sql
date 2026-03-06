-- ============================================================
-- 멀티테넌시 구조 세팅 — STEP 1
-- 하나의 Supabase 프로젝트에서 여러 교회 데이터를 격리 관리
-- Supabase SQL Editor에서 실행
-- ============================================================


-- ============================================================
-- STEP 1: 새 테이블 생성
-- ============================================================

-- 1-1) churches (교회/테넌트)
CREATE TABLE IF NOT EXISTS public.churches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  plan text DEFAULT 'basic',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz
);

-- 1-2) church_users (교회-사용자 매핑)
CREATE TABLE IF NOT EXISTS public.church_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id uuid NOT NULL REFERENCES public.churches(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text DEFAULT 'admin',
  created_at timestamptz DEFAULT now(),
  UNIQUE(church_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_church_users_church ON public.church_users(church_id);
CREATE INDEX IF NOT EXISTS idx_church_users_user ON public.church_users(user_id);


-- ============================================================
-- STEP 2: 기존 테이블에 church_id 추가
-- 이미 church_id가 있는 테이블은 IF NOT EXISTS로 안전하게 스킵
-- ============================================================

-- ----- 그룹 A: 이미 church_id가 있을 수 있는 테이블 (안전하게 ADD IF NOT EXISTS) -----
ALTER TABLE public.organizations          ADD COLUMN IF NOT EXISTS church_id uuid REFERENCES public.churches(id);
ALTER TABLE public.roles                  ADD COLUMN IF NOT EXISTS church_id uuid REFERENCES public.churches(id);
ALTER TABLE public.custom_fields          ADD COLUMN IF NOT EXISTS church_id uuid REFERENCES public.churches(id);
ALTER TABLE public.custom_labels          ADD COLUMN IF NOT EXISTS church_id uuid REFERENCES public.churches(id);
ALTER TABLE public.service_types          ADD COLUMN IF NOT EXISTS church_id uuid REFERENCES public.churches(id);
ALTER TABLE public.school_departments     ADD COLUMN IF NOT EXISTS church_id uuid REFERENCES public.churches(id);
ALTER TABLE public.budget                 ADD COLUMN IF NOT EXISTS church_id uuid REFERENCES public.churches(id);
ALTER TABLE public.special_accounts       ADD COLUMN IF NOT EXISTS church_id uuid REFERENCES public.churches(id);

-- ----- 그룹 B: church_id가 없는 테이블에 추가 -----
ALTER TABLE public.settings               ADD COLUMN IF NOT EXISTS church_id uuid REFERENCES public.churches(id);
ALTER TABLE public.members                ADD COLUMN IF NOT EXISTS church_id uuid REFERENCES public.churches(id);
ALTER TABLE public.attendance             ADD COLUMN IF NOT EXISTS church_id uuid REFERENCES public.churches(id);
ALTER TABLE public.notes                  ADD COLUMN IF NOT EXISTS church_id uuid REFERENCES public.churches(id);
ALTER TABLE public.plans                  ADD COLUMN IF NOT EXISTS church_id uuid REFERENCES public.churches(id);
ALTER TABLE public.sermons                ADD COLUMN IF NOT EXISTS church_id uuid REFERENCES public.churches(id);
ALTER TABLE public.visits                 ADD COLUMN IF NOT EXISTS church_id uuid REFERENCES public.churches(id);
ALTER TABLE public.income                 ADD COLUMN IF NOT EXISTS church_id uuid REFERENCES public.churches(id);
ALTER TABLE public.expense                ADD COLUMN IF NOT EXISTS church_id uuid REFERENCES public.churches(id);
ALTER TABLE public.checklist              ADD COLUMN IF NOT EXISTS church_id uuid REFERENCES public.churches(id);
ALTER TABLE public.new_family_program     ADD COLUMN IF NOT EXISTS church_id uuid REFERENCES public.churches(id);
ALTER TABLE public.families               ADD COLUMN IF NOT EXISTS church_id uuid REFERENCES public.churches(id);
ALTER TABLE public.member_status_history  ADD COLUMN IF NOT EXISTS church_id uuid REFERENCES public.churches(id);
ALTER TABLE public.organization_members   ADD COLUMN IF NOT EXISTS church_id uuid REFERENCES public.churches(id);
ALTER TABLE public.user_roles             ADD COLUMN IF NOT EXISTS church_id uuid REFERENCES public.churches(id);
ALTER TABLE public.audit_logs             ADD COLUMN IF NOT EXISTS church_id uuid REFERENCES public.churches(id);
ALTER TABLE public.school_classes         ADD COLUMN IF NOT EXISTS church_id uuid REFERENCES public.churches(id);
ALTER TABLE public.school_enrollments     ADD COLUMN IF NOT EXISTS church_id uuid REFERENCES public.churches(id);
ALTER TABLE public.school_attendance      ADD COLUMN IF NOT EXISTS church_id uuid REFERENCES public.churches(id);
ALTER TABLE public.school_transfer_history ADD COLUMN IF NOT EXISTS church_id uuid REFERENCES public.churches(id);
ALTER TABLE public.message_logs           ADD COLUMN IF NOT EXISTS church_id uuid REFERENCES public.churches(id);
ALTER TABLE public.frequent_groups        ADD COLUMN IF NOT EXISTS church_id uuid REFERENCES public.churches(id);
ALTER TABLE public.special_account_transactions ADD COLUMN IF NOT EXISTS church_id uuid REFERENCES public.churches(id);

-- ----- church_id 인덱스 (조회 성능) -----
CREATE INDEX IF NOT EXISTS idx_settings_church              ON public.settings(church_id);
CREATE INDEX IF NOT EXISTS idx_members_church               ON public.members(church_id);
CREATE INDEX IF NOT EXISTS idx_attendance_church            ON public.attendance(church_id);
CREATE INDEX IF NOT EXISTS idx_notes_church                 ON public.notes(church_id);
CREATE INDEX IF NOT EXISTS idx_plans_church                 ON public.plans(church_id);
CREATE INDEX IF NOT EXISTS idx_sermons_church               ON public.sermons(church_id);
CREATE INDEX IF NOT EXISTS idx_visits_church                ON public.visits(church_id);
CREATE INDEX IF NOT EXISTS idx_income_church                ON public.income(church_id);
CREATE INDEX IF NOT EXISTS idx_expense_church               ON public.expense(church_id);
CREATE INDEX IF NOT EXISTS idx_checklist_church             ON public.checklist(church_id);
CREATE INDEX IF NOT EXISTS idx_new_family_program_church    ON public.new_family_program(church_id);
CREATE INDEX IF NOT EXISTS idx_families_church              ON public.families(church_id);
CREATE INDEX IF NOT EXISTS idx_member_status_history_church ON public.member_status_history(church_id);
CREATE INDEX IF NOT EXISTS idx_organization_members_church  ON public.organization_members(church_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_church            ON public.user_roles(church_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_church            ON public.audit_logs(church_id);
CREATE INDEX IF NOT EXISTS idx_school_classes_church        ON public.school_classes(church_id);
CREATE INDEX IF NOT EXISTS idx_school_enrollments_church    ON public.school_enrollments(church_id);
CREATE INDEX IF NOT EXISTS idx_school_attendance_church     ON public.school_attendance(church_id);
CREATE INDEX IF NOT EXISTS idx_school_transfer_history_church ON public.school_transfer_history(church_id);
CREATE INDEX IF NOT EXISTS idx_message_logs_church          ON public.message_logs(church_id);
CREATE INDEX IF NOT EXISTS idx_frequent_groups_church       ON public.frequent_groups(church_id);
CREATE INDEX IF NOT EXISTS idx_special_account_tx_church    ON public.special_account_transactions(church_id);
CREATE INDEX IF NOT EXISTS idx_organizations_church         ON public.organizations(church_id);
CREATE INDEX IF NOT EXISTS idx_roles_church                 ON public.roles(church_id);
CREATE INDEX IF NOT EXISTS idx_custom_fields_church         ON public.custom_fields(church_id);
CREATE INDEX IF NOT EXISTS idx_custom_labels_church         ON public.custom_labels(church_id);
CREATE INDEX IF NOT EXISTS idx_service_types_church         ON public.service_types(church_id);
CREATE INDEX IF NOT EXISTS idx_school_departments_church    ON public.school_departments(church_id);
CREATE INDEX IF NOT EXISTS idx_budget_church                ON public.budget(church_id);
CREATE INDEX IF NOT EXISTS idx_special_accounts_church      ON public.special_accounts(church_id);


-- ============================================================
-- STEP 3: RLS 정책 설정
-- ============================================================
-- ※ 주의: 현재 앱은 anon 키로 동작하며 기존 anon 정책이 있음.
--   아래 정책은 "authenticated 유저가 자기 교회 데이터만 접근" 기준.
--   기존 anon 정책은 유지하되, auth 도입 후 제거하면 됨.
--   (RLS는 OR 조건이라 anon 정책이 있으면 여전히 모든 행 접근 가능)

-- ----- 3-0) churches 테이블 RLS -----
ALTER TABLE public.churches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "churches_select_own" ON public.churches;
CREATE POLICY "churches_select_own" ON public.churches
  FOR SELECT USING (
    id IN (SELECT church_id FROM public.church_users WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "churches_anon_read" ON public.churches;
CREATE POLICY "churches_anon_read" ON public.churches
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- ----- 3-1) church_users 테이블 RLS -----
ALTER TABLE public.church_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "church_users_own_church" ON public.church_users;
CREATE POLICY "church_users_own_church" ON public.church_users
  FOR SELECT USING (
    church_id IN (SELECT church_id FROM public.church_users WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "church_users_insert_own" ON public.church_users;
CREATE POLICY "church_users_insert_own" ON public.church_users
  FOR INSERT WITH CHECK (
    church_id IN (SELECT church_id FROM public.church_users WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "church_users_anon" ON public.church_users;
CREATE POLICY "church_users_anon" ON public.church_users
  FOR ALL TO anon USING (true) WITH CHECK (true);


-- ----- 3-2) 모든 데이터 테이블: 교회별 데이터 격리 정책 -----
-- 헬퍼 함수: 현재 유저의 church_id 목록 반환 (정책에서 반복 호출 최소화)
CREATE OR REPLACE FUNCTION public.get_my_church_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT church_id FROM public.church_users WHERE user_id = auth.uid();
$$;

-- 매크로처럼 각 테이블에 적용할 정책 생성
-- 패턴: SELECT/UPDATE/DELETE는 USING, INSERT는 WITH CHECK

DO $$
DECLARE
  tbl TEXT;
  tbls TEXT[] := ARRAY[
    'settings', 'members', 'attendance', 'notes', 'plans', 'sermons',
    'visits', 'income', 'expense', 'checklist', 'new_family_program',
    'families', 'member_status_history', 'organization_members', 'user_roles',
    'audit_logs', 'school_classes', 'school_enrollments', 'school_attendance',
    'school_transfer_history', 'message_logs', 'frequent_groups',
    'special_account_transactions', 'organizations', 'roles', 'custom_fields',
    'custom_labels', 'service_types', 'school_departments', 'budget',
    'special_accounts'
  ];
BEGIN
  FOREACH tbl IN ARRAY tbls LOOP
    -- RLS 활성화 (이미 되어있어도 안전)
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);

    -- 기존 교회별 정책 제거 (재실행 안전)
    EXECUTE format('DROP POLICY IF EXISTS "tenant_select_%s" ON public.%I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS "tenant_insert_%s" ON public.%I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS "tenant_update_%s" ON public.%I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS "tenant_delete_%s" ON public.%I', tbl, tbl);

    -- SELECT: 자기 교회 데이터만
    EXECUTE format(
      'CREATE POLICY "tenant_select_%s" ON public.%I FOR SELECT TO authenticated USING (church_id IN (SELECT public.get_my_church_ids()))',
      tbl, tbl
    );

    -- INSERT: 자기 교회 church_id만 넣을 수 있음
    EXECUTE format(
      'CREATE POLICY "tenant_insert_%s" ON public.%I FOR INSERT TO authenticated WITH CHECK (church_id IN (SELECT public.get_my_church_ids()))',
      tbl, tbl
    );

    -- UPDATE: 자기 교회 데이터만
    EXECUTE format(
      'CREATE POLICY "tenant_update_%s" ON public.%I FOR UPDATE TO authenticated USING (church_id IN (SELECT public.get_my_church_ids()))',
      tbl, tbl
    );

    -- DELETE: 자기 교회 데이터만
    EXECUTE format(
      'CREATE POLICY "tenant_delete_%s" ON public.%I FOR DELETE TO authenticated USING (church_id IN (SELECT public.get_my_church_ids()))',
      tbl, tbl
    );
  END LOOP;
END $$;


-- ============================================================
-- STEP 4: 테스트용 교회 2개 생성
-- ============================================================
INSERT INTO public.churches (name, plan, is_active)
VALUES ('테스트교회A', 'basic', true)
ON CONFLICT DO NOTHING;

INSERT INTO public.churches (name, plan, is_active)
VALUES ('테스트교회B', 'basic', true)
ON CONFLICT DO NOTHING;

-- 확인용 쿼리 (실행 후 결과 확인)
SELECT id, name, plan, is_active, created_at FROM public.churches;


-- ============================================================
-- [참고] 기존 anon 정책 제거 (auth 도입 후 실행)
-- 현재 앱은 anon 키로 동작하므로 아래는 auth 전환 후에만 실행하세요.
-- 실행하면 anon 접근이 모두 차단됩니다.
-- ============================================================
/*
DO $$
DECLARE
  tbl TEXT;
  tbls TEXT[] := ARRAY[
    'settings', 'members', 'attendance', 'notes', 'plans', 'sermons',
    'visits', 'income', 'expense', 'budget', 'checklist'
  ];
BEGIN
  FOREACH tbl IN ARRAY tbls LOOP
    EXECUTE format('DROP POLICY IF EXISTS "%s_anon_all" ON public.%I', tbl, tbl);
  END LOOP;
END $$;

DROP POLICY IF EXISTS "churches_anon_read" ON public.churches;
DROP POLICY IF EXISTS "church_users_anon" ON public.church_users;
*/


-- ============================================================
-- [참고] 기존 데이터에 church_id 할당 (테스트교회A에 일괄 설정)
-- 기존 데이터가 있는 경우 아래 쿼리로 특정 교회에 할당하세요.
-- ============================================================
/*
-- 먼저 교회 ID 확인
-- SELECT id FROM public.churches WHERE name = '테스트교회A';

-- 아래 {CHURCH_ID}를 위 결과로 교체
UPDATE public.settings SET church_id = '{CHURCH_ID}' WHERE church_id IS NULL;
UPDATE public.members SET church_id = '{CHURCH_ID}' WHERE church_id IS NULL;
UPDATE public.attendance SET church_id = '{CHURCH_ID}' WHERE church_id IS NULL;
UPDATE public.notes SET church_id = '{CHURCH_ID}' WHERE church_id IS NULL;
UPDATE public.plans SET church_id = '{CHURCH_ID}' WHERE church_id IS NULL;
UPDATE public.sermons SET church_id = '{CHURCH_ID}' WHERE church_id IS NULL;
UPDATE public.visits SET church_id = '{CHURCH_ID}' WHERE church_id IS NULL;
UPDATE public.income SET church_id = '{CHURCH_ID}' WHERE church_id IS NULL;
UPDATE public.expense SET church_id = '{CHURCH_ID}' WHERE church_id IS NULL;
UPDATE public.checklist SET church_id = '{CHURCH_ID}' WHERE church_id IS NULL;
UPDATE public.new_family_program SET church_id = '{CHURCH_ID}' WHERE church_id IS NULL;
UPDATE public.families SET church_id = '{CHURCH_ID}' WHERE church_id IS NULL;
UPDATE public.member_status_history SET church_id = '{CHURCH_ID}' WHERE church_id IS NULL;
UPDATE public.organization_members SET church_id = '{CHURCH_ID}' WHERE church_id IS NULL;
UPDATE public.user_roles SET church_id = '{CHURCH_ID}' WHERE church_id IS NULL;
UPDATE public.audit_logs SET church_id = '{CHURCH_ID}' WHERE church_id IS NULL;
UPDATE public.school_classes SET church_id = '{CHURCH_ID}' WHERE church_id IS NULL;
UPDATE public.school_enrollments SET church_id = '{CHURCH_ID}' WHERE church_id IS NULL;
UPDATE public.school_attendance SET church_id = '{CHURCH_ID}' WHERE church_id IS NULL;
UPDATE public.school_transfer_history SET church_id = '{CHURCH_ID}' WHERE church_id IS NULL;
UPDATE public.message_logs SET church_id = '{CHURCH_ID}' WHERE church_id IS NULL;
UPDATE public.frequent_groups SET church_id = '{CHURCH_ID}' WHERE church_id IS NULL;
UPDATE public.special_account_transactions SET church_id = '{CHURCH_ID}' WHERE church_id IS NULL;
UPDATE public.organizations SET church_id = '{CHURCH_ID}' WHERE church_id IS NULL;
UPDATE public.roles SET church_id = '{CHURCH_ID}' WHERE church_id IS NULL;
UPDATE public.custom_fields SET church_id = '{CHURCH_ID}' WHERE church_id IS NULL;
UPDATE public.custom_labels SET church_id = '{CHURCH_ID}' WHERE church_id IS NULL;
UPDATE public.service_types SET church_id = '{CHURCH_ID}' WHERE church_id IS NULL;
UPDATE public.school_departments SET church_id = '{CHURCH_ID}' WHERE church_id IS NULL;
UPDATE public.budget SET church_id = '{CHURCH_ID}' WHERE church_id IS NULL;
UPDATE public.special_accounts SET church_id = '{CHURCH_ID}' WHERE church_id IS NULL;
*/
