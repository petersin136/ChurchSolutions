-- ============================================================
-- 사역흐름(Workflow) 시스템
-- ------------------------------------------------------------
-- Planning Center People의 Workflow / WorkflowStep / WorkflowCard 컨셉을
-- 한국 교회 운영에 맞게 재구성. 모든 테이블은 church_id NOT NULL +
-- authenticated 전용 RLS. anon-all 정책은 절대 생성하지 않습니다.
-- 의존: multi_tenancy_setup.sql 의 churches / church_users / get_my_church_ids()
-- ============================================================

-- ----------------------------------------------------------------
-- TABLE: workflows (사역흐름 정의)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.workflows (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id     uuid NOT NULL REFERENCES public.churches(id) ON DELETE CASCADE,
  name          text NOT NULL,
  description   text,
  category      text NOT NULL DEFAULT '기타'
                CHECK (category IN ('새가족','결석회복','세례','임직','휴면복귀','심방','상담','기타')),
  /** 시드 템플릿 식별자. 사용자 정의 사역흐름은 NULL. */
  template_key  text
                CHECK (template_key IS NULL OR template_key IN
                       ('new_family','absentee_recovery','baptism','ordination','reactivation')),
  is_active     boolean NOT NULL DEFAULT true,
  /** 보드/사이드바 컬러 (디자인 토큰 이름 또는 hex) */
  color         text DEFAULT 'primary',
  /** lucide-react 아이콘 이름 (참고용) */
  icon          text DEFAULT 'GitBranch',
  created_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- 시드 템플릿은 교회별 1개만 — 멱등 재실행 보장
CREATE UNIQUE INDEX IF NOT EXISTS uq_workflows_church_template
  ON public.workflows (church_id, template_key)
  WHERE template_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_workflows_church
  ON public.workflows (church_id);
CREATE INDEX IF NOT EXISTS idx_workflows_church_active
  ON public.workflows (church_id, is_active);

COMMENT ON TABLE public.workflows IS '사역흐름 정의(템플릿). 카드 인스턴스는 workflow_cards.';
COMMENT ON COLUMN public.workflows.template_key IS '시드된 시스템 템플릿 식별자';

-- ----------------------------------------------------------------
-- TABLE: workflow_steps (단계)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.workflow_steps (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id         uuid NOT NULL REFERENCES public.churches(id) ON DELETE CASCADE,
  workflow_id       uuid NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
  name              text NOT NULL,
  description       text,
  sort_order        int  NOT NULL,
  /** 단계 권장 소요일 (담당자 안내용) */
  expected_days     int,
  /** N일 후 자동 다음 단계로 진행 (NULL이면 수동) */
  auto_promote_days int,
  /** 완료 단계인지 (보드에 ✓ 표시) */
  is_terminal       boolean NOT NULL DEFAULT false,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_workflow_steps_workflow_order
  ON public.workflow_steps (workflow_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_workflow_steps_church
  ON public.workflow_steps (church_id);

COMMENT ON TABLE public.workflow_steps IS '사역흐름 단계. workflow_id 별로 sort_order 유일.';

-- ----------------------------------------------------------------
-- TABLE: workflow_cards (진행카드)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.workflow_cards (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id         uuid NOT NULL REFERENCES public.churches(id) ON DELETE CASCADE,
  workflow_id       uuid NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
  current_step_id   uuid REFERENCES public.workflow_steps(id) ON DELETE SET NULL,
  /** 대상 성도 — 삭제 시 카드는 남기되 연결만 끊김 */
  member_id         uuid REFERENCES public.members(id) ON DELETE SET NULL,
  /** 멤버 삭제·이름변경 대비 스냅샷 */
  member_name       text NOT NULL,
  member_phone      text,
  /** 담당자 — auth.users 참조. 담당자 변경은 앱에서 권한 검사 */
  assignee_id       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  assignee_name     text,
  stage             text NOT NULL DEFAULT 'open'
                    CHECK (stage IN ('open','snoozed','completed','dropped')),
  priority          text NOT NULL DEFAULT 'normal'
                    CHECK (priority IN ('low','normal','high','urgent')),
  due_date          date,
  snooze_until      date,
  /** 현재 단계로 이동한 시각 — 트리거가 자동 갱신 */
  moved_to_step_at  timestamptz NOT NULL DEFAULT now(),
  completed_at      timestamptz,
  /** 카드가 만들어진 출처 (수동/자동) */
  source            text NOT NULL DEFAULT 'manual'
                    CHECK (source IN ('manual','auto_new_family','auto_absentee','import','api')),
  source_ref        text,
  created_by        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workflow_cards_church_stage
  ON public.workflow_cards (church_id, stage);
CREATE INDEX IF NOT EXISTS idx_workflow_cards_workflow_step
  ON public.workflow_cards (workflow_id, current_step_id);
CREATE INDEX IF NOT EXISTS idx_workflow_cards_assignee
  ON public.workflow_cards (assignee_id)
  WHERE stage IN ('open','snoozed');
CREATE INDEX IF NOT EXISTS idx_workflow_cards_member
  ON public.workflow_cards (member_id);
CREATE INDEX IF NOT EXISTS idx_workflow_cards_church_member_workflow
  ON public.workflow_cards (church_id, member_id, workflow_id);

COMMENT ON TABLE public.workflow_cards IS '사역흐름 진행카드. 한 성도가 같은 사역흐름에 여러 카드를 가질 수 있음.';

-- ----------------------------------------------------------------
-- TABLE: workflow_card_notes (카드 메모/기록)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.workflow_card_notes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id    uuid NOT NULL REFERENCES public.churches(id) ON DELETE CASCADE,
  card_id      uuid NOT NULL REFERENCES public.workflow_cards(id) ON DELETE CASCADE,
  /** 어느 단계에서 작성된 메모인지 (열람 시 단계 컨텍스트 노출) */
  step_id      uuid REFERENCES public.workflow_steps(id) ON DELETE SET NULL,
  content      text NOT NULL,
  author_id    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  author_name  text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workflow_card_notes_card
  ON public.workflow_card_notes (card_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_workflow_card_notes_church
  ON public.workflow_card_notes (church_id);

-- ============================================================
-- 트리거: updated_at 자동 갱신
-- ============================================================
CREATE OR REPLACE FUNCTION public.workflow_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_workflows_touch ON public.workflows;
CREATE TRIGGER trg_workflows_touch
  BEFORE UPDATE ON public.workflows
  FOR EACH ROW EXECUTE FUNCTION public.workflow_touch_updated_at();

DROP TRIGGER IF EXISTS trg_workflow_steps_touch ON public.workflow_steps;
CREATE TRIGGER trg_workflow_steps_touch
  BEFORE UPDATE ON public.workflow_steps
  FOR EACH ROW EXECUTE FUNCTION public.workflow_touch_updated_at();

-- ============================================================
-- 트리거: workflow_cards 의 단계 이동 / 완료 시각 자동 기록
-- ============================================================
CREATE OR REPLACE FUNCTION public.workflow_cards_track_transitions()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- updated_at 항상 갱신
  NEW.updated_at := now();

  -- current_step_id 가 바뀌면 moved_to_step_at 갱신
  IF TG_OP = 'UPDATE' AND NEW.current_step_id IS DISTINCT FROM OLD.current_step_id THEN
    NEW.moved_to_step_at := now();
  END IF;

  -- stage 가 'completed' 로 진입하면 completed_at 자동 설정
  IF TG_OP = 'UPDATE' AND NEW.stage = 'completed' AND OLD.stage <> 'completed' THEN
    NEW.completed_at := COALESCE(NEW.completed_at, now());
  END IF;

  -- 다시 'open' 등으로 되돌리면 completed_at 비움
  IF TG_OP = 'UPDATE' AND NEW.stage <> 'completed' AND OLD.stage = 'completed' THEN
    NEW.completed_at := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_workflow_cards_transitions ON public.workflow_cards;
CREATE TRIGGER trg_workflow_cards_transitions
  BEFORE UPDATE ON public.workflow_cards
  FOR EACH ROW EXECUTE FUNCTION public.workflow_cards_track_transitions();

-- INSERT 시에도 updated_at 통일 (DEFAULT now() 와 동일 결과)
CREATE OR REPLACE FUNCTION public.workflow_cards_init_timestamps()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.moved_to_step_at IS NULL THEN NEW.moved_to_step_at := now(); END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_workflow_cards_init ON public.workflow_cards;
CREATE TRIGGER trg_workflow_cards_init
  BEFORE INSERT ON public.workflow_cards
  FOR EACH ROW EXECUTE FUNCTION public.workflow_cards_init_timestamps();

-- ============================================================
-- RLS: authenticated 전용 — anon 정책은 절대 만들지 않습니다.
-- ============================================================
ALTER TABLE public.workflows            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_steps       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_cards       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_card_notes  ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  tbl text;
  tbls text[] := ARRAY['workflows','workflow_steps','workflow_cards','workflow_card_notes'];
BEGIN
  FOREACH tbl IN ARRAY tbls LOOP
    -- 재실행 안전성
    EXECUTE format('DROP POLICY IF EXISTS "tenant_select_%s" ON public.%I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS "tenant_insert_%s" ON public.%I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS "tenant_update_%s" ON public.%I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS "tenant_delete_%s" ON public.%I', tbl, tbl);

    EXECUTE format($f$
      CREATE POLICY "tenant_select_%s" ON public.%I
      FOR SELECT TO authenticated
      USING (church_id IN (SELECT public.get_my_church_ids()))
    $f$, tbl, tbl);

    EXECUTE format($f$
      CREATE POLICY "tenant_insert_%s" ON public.%I
      FOR INSERT TO authenticated
      WITH CHECK (church_id IN (SELECT public.get_my_church_ids()))
    $f$, tbl, tbl);

    EXECUTE format($f$
      CREATE POLICY "tenant_update_%s" ON public.%I
      FOR UPDATE TO authenticated
      USING (church_id IN (SELECT public.get_my_church_ids()))
      WITH CHECK (church_id IN (SELECT public.get_my_church_ids()))
    $f$, tbl, tbl);

    EXECUTE format($f$
      CREATE POLICY "tenant_delete_%s" ON public.%I
      FOR DELETE TO authenticated
      USING (church_id IN (SELECT public.get_my_church_ids()))
    $f$, tbl, tbl);
  END LOOP;
END $$;

-- ============================================================
-- 확인 쿼리 (운영 시 주석 처리)
-- ============================================================
-- SELECT table_name FROM information_schema.tables WHERE table_name LIKE 'workflow%' AND table_schema='public';
-- SELECT policyname, tablename FROM pg_policies WHERE tablename LIKE 'workflow%';
