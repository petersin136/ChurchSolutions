-- =====================================================================
-- 1a_auth_onboarding_schema.sql
-- ---------------------------------------------------------------------
-- 목적
--   처치플래너 진입 흐름(회원가입 · 교회 개설 · 14일 무료체험 · 검색 ·
--   유사 이름 경고 · 멤버 승인/대기) 리팩토링을 위한 DB 스키마 확장.
--   churches 테이블에 마스터/체험/구독 컬럼을 추가하고,
--   church_users 에 status(pending/approved/rejected) 컬럼을 추가하며,
--   교회 검색 · 유사도 · 체험 만료 처리 함수를 도입한다.
--
-- 영향 범위 (2 tables · 1 view · 4 functions · 인덱스 · CHECK)
--   - public.churches           ALTER (+7 컬럼, CHECK, 인덱스 2개)
--   - public.church_users       ALTER (+3 컬럼, CHECK, 백필)
--   - public.churches_public    NEW VIEW (검색용 컬럼 화이트리스트)
--   - public.normalize_church_name(text)      NEW FUNCTION
--   - public.find_similar_churches(text,real) NEW FUNCTION
--   - public.search_churches_public(text)     NEW FUNCTION
--   - public.expire_trials()                  NEW FUNCTION
--   - public.get_my_pending_church_id()       NEW FUNCTION
--   - public.get_my_church_ids()              REPLACE 본문 (status='approved' 필터 추가)
--
-- 실행 순서
--   기존 마이그레이션 0a / 0b / 0b1 / 0d 다음 (prefix 1a).
--   Supabase Studio SQL Editor 에서 본 파일 전체를 한 번에 실행한다.
--
-- 의존 extension
--   - pg_trgm  (similarity / gin_trgm_ops) — 본 파일 상단에서
--     CREATE EXTENSION IF NOT EXISTS 호출. Supabase 는 사전 활성화 권장.
--
-- 멱등성
--   - 모든 ALTER/CREATE 에 IF NOT EXISTS / OR REPLACE 사용.
--   - CHECK 제약은 DO $$ BEGIN ... EXCEPTION WHEN duplicate_object THEN
--     NULL; END $$; 패턴으로 재실행 안전.
--   - UPDATE 백필은 WHERE 조건으로 멱등.
--
-- 트랜잭션 / 롤백
--   BEGIN … COMMIT 으로 감싸져 있어 중간 실패 시 자동 ROLLBACK.
--   (CREATE EXTENSION 은 트랜잭션 외부에서 먼저 1회 실행해두는 것을
--    권장하지만, IF NOT EXISTS 이고 Supabase 환경에서는 트랜잭션 안에서도
--    무해하게 동작.)
--
-- RLS 영향
--   get_my_church_ids() 본문이 status='approved' 만 반환하도록 바뀌므로,
--   해당 함수를 참조하는 모든 정책(pg_policies 의 qual/with_check 에
--   get_my_church_ids 포함) 의 효과가 "approved 멤버만" 으로 강화된다.
--   pending 멤버는 멀티테넌시 데이터에 일절 접근 불가 (검색용 VIEW 만 가능).
-- =====================================================================


-- pg_trgm extension (트랜잭션 외부 권장이지만 IF NOT EXISTS 라 안전)
CREATE EXTENSION IF NOT EXISTS pg_trgm;


BEGIN;


-- =====================================================================
-- STEP 1. churches 테이블 컬럼 추가 (+CHECK)
-- =====================================================================
DO $$ BEGIN RAISE NOTICE '[step 1] churches 신규 컬럼 추가 시작'; END $$;

ALTER TABLE public.churches
  ADD COLUMN IF NOT EXISTS address              text,
  ADD COLUMN IF NOT EXISTS phone                text,
  ADD COLUMN IF NOT EXISTS denomination         text,
  ADD COLUMN IF NOT EXISTS pastor_name          text,
  ADD COLUMN IF NOT EXISTS master_user_id       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS trial_ends_at        timestamptz,
  ADD COLUMN IF NOT EXISTS subscription_status  text DEFAULT 'trial';

-- subscription_status CHECK 제약 (중복 add 안전)
DO $$ BEGIN
  ALTER TABLE public.churches
    ADD CONSTRAINT churches_subscription_status_check
    CHECK (subscription_status IN ('trial', 'active', 'expired', 'cancelled'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN RAISE NOTICE '[step 1] churches 컬럼/CHECK 완료'; END $$;


-- =====================================================================
-- STEP 2. churches 중복 차단 — phone 부분 unique 인덱스
-- ---------------------------------------------------------------------
-- 한국 교회는 동명(同名) 다수. 이름 unique 는 비현실적이므로 전화번호로만
-- 하드 차단. NULL / 빈 문자열은 중복 허용 (마이그레이션 직후 기존 row 가
-- 대부분 NULL 일 것).
-- =====================================================================
DO $$ BEGIN RAISE NOTICE '[step 2] churches.phone 부분 unique 인덱스 생성'; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_churches_phone
  ON public.churches (phone)
  WHERE phone IS NOT NULL AND phone <> '';


-- =====================================================================
-- STEP 3. churches 이름 LIKE 검색 가속 (pg_trgm GIN)
-- =====================================================================
DO $$ BEGIN RAISE NOTICE '[step 3] churches.name trigram GIN 인덱스 생성'; END $$;

CREATE INDEX IF NOT EXISTS idx_churches_name_trgm
  ON public.churches USING gin (name gin_trgm_ops);


-- =====================================================================
-- STEP 4. 기존 churches 데이터 백필
-- ---------------------------------------------------------------------
-- 기존 교회는 정상 운영 중이므로 14일 체험 대상이 아님 → 'active' 로 전환.
-- master_user_id 는 각 교회의 가장 오래된 admin 멤버로 백필.
-- trial_ends_at 은 NULL 그대로 (체험 미적용).
-- =====================================================================
DO $$ BEGIN RAISE NOTICE '[step 4] churches 백필 시작'; END $$;

-- 4-1) 기존 row 의 subscription_status: 'trial' default 가 박혀있으므로 active 로 전환
UPDATE public.churches
SET subscription_status = 'active'
WHERE subscription_status IS NULL OR subscription_status = 'trial';

-- 4-2) master_user_id 백필 — 각 church 의 가장 오래된 admin 사용자
UPDATE public.churches c
SET master_user_id = sub.user_id
FROM (
  SELECT DISTINCT ON (church_id) church_id, user_id
  FROM public.church_users
  WHERE role = 'admin'
  ORDER BY church_id, created_at ASC
) sub
WHERE c.id = sub.church_id
  AND c.master_user_id IS NULL;

DO $$ BEGIN RAISE NOTICE '[step 4] churches 백필 완료'; END $$;


-- =====================================================================
-- STEP 5. church_users 컬럼 추가 (status, requested_at, approved_at)
-- ---------------------------------------------------------------------
-- NOT NULL DEFAULT 'approved' 로 추가 → 기존 모든 row 자동 'approved'.
-- 별도 백필 UPDATE 불필요. approved_at 만 created_at 으로 백필.
-- =====================================================================
DO $$ BEGIN RAISE NOTICE '[step 5] church_users 신규 컬럼 추가'; END $$;

ALTER TABLE public.church_users
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'approved';

-- status CHECK 제약 (중복 add 안전)
DO $$ BEGIN
  ALTER TABLE public.church_users
    ADD CONSTRAINT church_users_status_check
    CHECK (status IN ('pending', 'approved', 'rejected'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.church_users
  ADD COLUMN IF NOT EXISTS requested_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS approved_at  timestamptz;

-- 백필: approved 상태인 기존 멤버는 created_at 을 approved_at 으로 간주
UPDATE public.church_users
SET approved_at = COALESCE(approved_at, created_at)
WHERE status = 'approved' AND approved_at IS NULL;

DO $$ BEGIN RAISE NOTICE '[step 5] church_users 컬럼/백필 완료'; END $$;


-- =====================================================================
-- STEP 6. 익명 검색용 노출 (VIEW + 함수 두 방식)
-- ---------------------------------------------------------------------
-- PostgreSQL RLS 는 컬럼 단위 SELECT 제한 미지원 → 노출 컬럼을 VIEW 로
-- 화이트리스트 처리.
--
-- 방식 A) churches_public VIEW
--   - Postgres 15+ : security_invoker=false 로 VIEW 정의자(슈퍼유저)의
--     권한으로 underlying RLS 우회. anon 에 GRANT SELECT.
--   - Postgres 14 이하 : security_invoker 옵션이 없으므로 추가 안전장치
--     필요. 본 환경(Supabase)이 15+ 라면 그대로 동작.
--
-- 방식 B) search_churches_public(q text) SECURITY DEFINER 함수  ★ MAIN
--   - 컬럼 화이트리스트 + 검색 파라미터(q) 일체화 + similarity 정렬.
--   - VIEW 보다 보안 경계가 명확하고, 미들웨어/UI 에서 호출 단순.
--   - 차후 검색 UI 는 본 함수를 우선 사용.
--
-- 둘 다 만들어 두되, 사용 권장은 함수(B) 쪽.
-- =====================================================================
DO $$ BEGIN RAISE NOTICE '[step 6] churches_public VIEW + 검색 함수 생성'; END $$;

-- 6-A) VIEW
CREATE OR REPLACE VIEW public.churches_public AS
SELECT
  id,
  name,
  address,
  denomination,
  pastor_name
FROM public.churches
WHERE is_active = true;

-- Postgres 15+ : VIEW 자체가 churches RLS 를 우회하도록
DO $$ BEGIN
  EXECUTE 'ALTER VIEW public.churches_public SET (security_invoker = false)';
EXCEPTION WHEN feature_not_supported OR undefined_object OR syntax_error THEN
  RAISE NOTICE '[step 6] security_invoker 옵션 미지원 (Postgres 14 이하?) — 함수 방식 사용 권장';
END $$;

GRANT SELECT ON public.churches_public TO anon, authenticated;

-- 6-B) 검색 함수 (메인 사용 권장)
CREATE OR REPLACE FUNCTION public.search_churches_public(q text)
RETURNS TABLE(id uuid, name text, address text, denomination text, pastor_name text)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT id, name, address, denomination, pastor_name
  FROM public.churches
  WHERE is_active = true
    AND (
      q IS NULL OR q = ''
      OR name ILIKE '%' || q || '%'
      OR address ILIKE '%' || q || '%'
    )
  ORDER BY
    CASE WHEN q IS NULL OR q = '' THEN 0 ELSE similarity(name, q) END DESC NULLS LAST,
    name ASC
  LIMIT 50;
$$;

GRANT EXECUTE ON FUNCTION public.search_churches_public(text) TO anon, authenticated;


-- =====================================================================
-- STEP 7. 이름 정규화 + 유사도 검색 함수 (소프트 경고용)
-- ---------------------------------------------------------------------
-- 회원가입 시 "비슷한 이름의 교회가 이미 있어요" 경고를 띄울 때 사용.
-- normalize_church_name() : 접미사(교회/예배당/성전/선교회) 제거 + 공백 정리
-- find_similar_churches() : threshold 이상 유사 교회 최대 10개 반환
-- =====================================================================
DO $$ BEGIN RAISE NOTICE '[step 7] 이름 정규화 + 유사도 함수 생성'; END $$;

CREATE OR REPLACE FUNCTION public.normalize_church_name(input text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT lower(
    regexp_replace(
      regexp_replace(
        COALESCE(input, ''),
        '(교회|예배당|성전|선교회)$',
        ''
      ),
      '[\s\-_]+',
      '',
      'g'
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.find_similar_churches(input_name text, threshold real DEFAULT 0.6)
RETURNS TABLE(id uuid, name text, address text, denomination text, pastor_name text, sim real)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    c.id,
    c.name,
    c.address,
    c.denomination,
    c.pastor_name,
    similarity(
      public.normalize_church_name(c.name),
      public.normalize_church_name(input_name)
    ) AS sim
  FROM public.churches c
  WHERE c.is_active = true
    AND similarity(
      public.normalize_church_name(c.name),
      public.normalize_church_name(input_name)
    ) >= threshold
  ORDER BY sim DESC
  LIMIT 10;
$$;

GRANT EXECUTE ON FUNCTION public.find_similar_churches(text, real) TO anon, authenticated;


-- =====================================================================
-- STEP 8. 14일 체험 만료 자동 전환 함수
-- ---------------------------------------------------------------------
-- 호출 주체:
--   - cron(예: pg_cron / Vercel cron → /api/cron) 또는
--   - 미들웨어에서 주기적 / 진입 시 호출
-- service_role 외 EXECUTE 권한 회수.
-- =====================================================================
DO $$ BEGIN RAISE NOTICE '[step 8] expire_trials() 함수 생성'; END $$;

CREATE OR REPLACE FUNCTION public.expire_trials()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected integer;
BEGIN
  UPDATE public.churches
  SET subscription_status = 'expired'
  WHERE subscription_status = 'trial'
    AND trial_ends_at IS NOT NULL
    AND trial_ends_at < now();

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.expire_trials() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.expire_trials() FROM anon, authenticated;


-- =====================================================================
-- STEP 9. get_my_church_ids() — status='approved' 필터 추가
-- ---------------------------------------------------------------------
-- 시그니처 (인자 없음, RETURNS setof uuid, LANGUAGE sql, SECURITY DEFINER,
-- STABLE) 는 그대로 유지. 본문에 status='approved' 조건만 추가.
-- 이 함수를 참조하는 모든 정책의 효과가 "approved 멤버만" 으로 강화됨.
-- =====================================================================
DO $$ BEGIN RAISE NOTICE '[step 9] get_my_church_ids() 본문 교체 (approved 필터)'; END $$;

CREATE OR REPLACE FUNCTION public.get_my_church_ids()
RETURNS setof uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT church_id
  FROM public.church_users
  WHERE user_id = auth.uid()
    AND status = 'approved';
$$;


-- =====================================================================
-- STEP 10. 신청 대기 중인 (pending) church 조회 함수
-- ---------------------------------------------------------------------
-- 가입 신청 후 승인 대기 화면에서 자신의 pending 신청 위치를 보여줄 때 사용.
-- 한 사용자에게 여러 pending 이 있으면 가장 최근 신청 1건 반환.
-- =====================================================================
DO $$ BEGIN RAISE NOTICE '[step 10] get_my_pending_church_id() 함수 생성'; END $$;

CREATE OR REPLACE FUNCTION public.get_my_pending_church_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT church_id
  FROM public.church_users
  WHERE user_id = auth.uid()
    AND status = 'pending'
  ORDER BY requested_at DESC NULLS LAST, created_at DESC
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_pending_church_id() TO authenticated;


-- =====================================================================
-- Post-check (가벼운 사후 검증)
-- =====================================================================
DO $$
DECLARE
  c_cols int;
  cu_cols int;
  fn_exists boolean;
BEGIN
  -- churches 신규 컬럼 7개 존재 확인
  SELECT COUNT(*) INTO c_cols
  FROM information_schema.columns
  WHERE table_schema='public' AND table_name='churches'
    AND column_name IN ('address','phone','denomination','pastor_name',
                        'master_user_id','trial_ends_at','subscription_status');
  IF c_cols <> 7 THEN
    RAISE EXCEPTION '[post-check] churches 신규 컬럼 7개 누락 (현재 %)', c_cols;
  END IF;

  -- church_users 신규 컬럼 3개 존재 확인
  SELECT COUNT(*) INTO cu_cols
  FROM information_schema.columns
  WHERE table_schema='public' AND table_name='church_users'
    AND column_name IN ('status','requested_at','approved_at');
  IF cu_cols <> 3 THEN
    RAISE EXCEPTION '[post-check] church_users 신규 컬럼 3개 누락 (현재 %)', cu_cols;
  END IF;

  -- get_my_church_ids() 본문에 'approved' 포함 확인
  SELECT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname='public' AND p.proname='get_my_church_ids'
      AND pg_get_functiondef(p.oid) ILIKE '%approved%'
  ) INTO fn_exists;
  IF NOT fn_exists THEN
    RAISE EXCEPTION '[post-check] get_my_church_ids() 본문에 approved 필터 없음';
  END IF;

  RAISE NOTICE '[ok] Post-check 통과 — 컬럼/함수 정상. COMMIT 진행.';
END $$;


COMMIT;


-- =====================================================================
-- VERIFY (트랜잭션 외부 · 수동 실행)
-- ---------------------------------------------------------------------
-- 1) churches 컬럼 추가 확인
-- SELECT column_name, data_type, column_default
--   FROM information_schema.columns
--   WHERE table_schema='public' AND table_name='churches'
--   ORDER BY ordinal_position;
--
-- 2) church_users status 분포 확인
-- SELECT status, COUNT(*) FROM public.church_users GROUP BY status;
--
-- 3) get_my_church_ids() 본문 확인
-- SELECT pg_get_functiondef('public.get_my_church_ids()'::regprocedure);
--
-- 4) find_similar_churches 동작
-- SELECT * FROM public.find_similar_churches('포천중앙교회');
--
-- 5) churches_public VIEW 동작
-- SELECT * FROM public.churches_public LIMIT 5;
--
-- 6) search_churches_public 동작
-- SELECT * FROM public.search_churches_public('중앙');
--
-- 7) get_my_church_ids 를 참조하는 정책 목록 (영향받는 정책 수)
-- SELECT schemaname, tablename, policyname, cmd
--   FROM pg_policies
--   WHERE schemaname='public'
--     AND (qual ILIKE '%get_my_church_ids%' OR with_check ILIKE '%get_my_church_ids%')
--   ORDER BY tablename, policyname;
--
-- 8) churches.master_user_id 백필 결과
-- SELECT COUNT(*) FILTER (WHERE master_user_id IS NULL)  AS still_null,
--        COUNT(*) FILTER (WHERE master_user_id IS NOT NULL) AS filled,
--        COUNT(*) AS total
--   FROM public.churches;
--
-- 9) 체험 만료 시뮬레이션 (실제 expire_trials() 실행은 service_role 로)
-- -- SELECT public.expire_trials();
-- =====================================================================
