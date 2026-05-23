-- =====================================================================
-- 포천중앙침례교회 사역흐름(Workflow) 단독 시드
-- ---------------------------------------------------------------------
-- 목적: 이미 119명 성도가 있는 상태에서 워크플로우(5개 기본 + 카드 샘플)
--       만 안전하게 추가하기 위한 스크립트.
-- 의존:
--   · supabase/workflow_system.sql        (workflows/steps/cards 테이블)
--   · supabase/seeds/pocheon_central_demo_seed.sql 또는 동등 데이터
--     (members 테이블에 포천중앙 성도가 있어야 카드 샘플도 생김)
-- 멱등성:
--   · workflows: (church_id, template_key) UNIQUE → 재실행 안전
--   · workflow_steps: (workflow_id, sort_order) UNIQUE → 재실행 안전
--   · workflow_cards: source_ref 로 중복 가드
-- =====================================================================

BEGIN;

DO $$
DECLARE
  v_church_id UUID;
  v_member_count INT;
  v_wid uuid;
  v_step1 uuid;
  v_step2 uuid;
  v_step3 uuid;
  v_step4 uuid;
  v_step5 uuid;
  v_m RECORD;
  i INT;
BEGIN
  -- 1) 교회 식별
  SELECT id INTO v_church_id
  FROM churches
  WHERE name ILIKE '%포천%중앙%' OR name ILIKE '%pocheon%central%'
  ORDER BY created_at LIMIT 1;
  IF v_church_id IS NULL THEN
    RAISE EXCEPTION '포천중앙침례교회를 찾지 못했습니다.';
  END IF;

  SELECT COUNT(*) INTO v_member_count FROM members WHERE church_id = v_church_id;
  RAISE NOTICE '포천중앙침례교회 워크플로우 시드 시작 · church_id=% · members=%', v_church_id, v_member_count;

  -- ─────────────────────────────────────────────────────────────────
  -- 1) 새가족 정착 (new_family) — 5단계
  -- ─────────────────────────────────────────────────────────────────
  INSERT INTO public.workflows (church_id, name, description, category, template_key, color, icon)
  VALUES (v_church_id, '새가족 정착', '첫 방문부터 정착까지 4~5주 트랙', '새가족', 'new_family', 'success', 'Sprout')
  ON CONFLICT (church_id, template_key) WHERE template_key IS NOT NULL DO NOTHING
  RETURNING id INTO v_wid;
  IF v_wid IS NULL THEN
    SELECT id INTO v_wid FROM public.workflows
     WHERE church_id = v_church_id AND template_key = 'new_family' LIMIT 1;
  END IF;
  INSERT INTO public.workflow_steps (church_id, workflow_id, name, description, sort_order, expected_days, is_terminal) VALUES
    (v_church_id, v_wid, '환영 인사',   '첫 방문 당일 환영, 연락처 확보', 1, 1,  false),
    (v_church_id, v_wid, '안내 통화',   '평일 중 짧은 안부 통화',         2, 3,  false),
    (v_church_id, v_wid, '가정 심방',   '담당 목회자가 가정 방문',         3, 14, false),
    (v_church_id, v_wid, '양육반 배정', '새가족 양육 / 정착반 배정',       4, 21, false),
    (v_church_id, v_wid, '정착 완료',   '소그룹 등록 및 정착 확정',         5, 30, true)
  ON CONFLICT (workflow_id, sort_order) DO NOTHING;

  -- 새가족 카드 샘플 (가장 최근 등록 성도 4명을 단계별로 배치)
  SELECT id INTO v_step1 FROM workflow_steps WHERE workflow_id = v_wid AND sort_order = 1;
  SELECT id INTO v_step2 FROM workflow_steps WHERE workflow_id = v_wid AND sort_order = 2;
  SELECT id INTO v_step3 FROM workflow_steps WHERE workflow_id = v_wid AND sort_order = 3;
  SELECT id INTO v_step4 FROM workflow_steps WHERE workflow_id = v_wid AND sort_order = 4;
  SELECT id INTO v_step5 FROM workflow_steps WHERE workflow_id = v_wid AND sort_order = 5;

  i := 0;
  FOR v_m IN
    SELECT id, name, phone
      FROM members
     WHERE church_id = v_church_id
     ORDER BY created_at DESC NULLS LAST
     LIMIT 6
  LOOP
    i := i + 1;
    INSERT INTO public.workflow_cards (
      church_id, workflow_id, current_step_id, member_id, member_name, member_phone,
      stage, priority, moved_to_step_at, source, source_ref
    )
    SELECT
      v_church_id, v_wid,
      CASE i WHEN 1 THEN v_step1 WHEN 2 THEN v_step2 WHEN 3 THEN v_step3
             WHEN 4 THEN v_step4 WHEN 5 THEN v_step5 ELSE v_step1 END,
      v_m.id, v_m.name, v_m.phone,
      CASE WHEN i = 6 THEN 'completed' ELSE 'open' END,
      'normal',
      now() - (i || ' days')::interval,
      'auto_new_family',
      'seed_pc_nf_' || i
    WHERE NOT EXISTS (
      SELECT 1 FROM workflow_cards
       WHERE church_id = v_church_id AND source_ref = 'seed_pc_nf_' || i
    );
  END LOOP;

  -- ─────────────────────────────────────────────────────────────────
  -- 2) 결석자 회복 (absentee_recovery) — 4단계
  -- ─────────────────────────────────────────────────────────────────
  INSERT INTO public.workflows (church_id, name, description, category, template_key, color, icon)
  VALUES (v_church_id, '결석자 회복', '2주 이상 결석 성도의 출석 회복 트랙', '결석회복', 'absentee_recovery', 'warning', 'AlertCircle')
  ON CONFLICT (church_id, template_key) WHERE template_key IS NOT NULL DO NOTHING
  RETURNING id INTO v_wid;
  IF v_wid IS NULL THEN
    SELECT id INTO v_wid FROM public.workflows
     WHERE church_id = v_church_id AND template_key = 'absentee_recovery' LIMIT 1;
  END IF;
  INSERT INTO public.workflow_steps (church_id, workflow_id, name, description, sort_order, expected_days, is_terminal) VALUES
    (v_church_id, v_wid, '1차 연락',  '문자/통화로 안부 확인',          1, 2,  false),
    (v_church_id, v_wid, '안부 확인', '결석 사유 파악, 기도 제목 청취', 2, 5,  false),
    (v_church_id, v_wid, '심방 진행', '담당 목회자/목장장 심방',         3, 14, false),
    (v_church_id, v_wid, '출석 회복', '예배 출석 재확인',                4, 28, true)
  ON CONFLICT (workflow_id, sort_order) DO NOTHING;

  -- 결석자 카드 샘플 — 장년부 3명을 단계별 배치
  SELECT id INTO v_step1 FROM workflow_steps WHERE workflow_id = v_wid AND sort_order = 1;
  SELECT id INTO v_step2 FROM workflow_steps WHERE workflow_id = v_wid AND sort_order = 2;
  SELECT id INTO v_step3 FROM workflow_steps WHERE workflow_id = v_wid AND sort_order = 3;

  i := 0;
  FOR v_m IN
    SELECT id, name, phone
      FROM members
     WHERE church_id = v_church_id AND dept = '장년부'
     ORDER BY name
     LIMIT 4
  LOOP
    i := i + 1;
    INSERT INTO public.workflow_cards (
      church_id, workflow_id, current_step_id, member_id, member_name, member_phone,
      stage, priority, moved_to_step_at, source, source_ref
    )
    SELECT
      v_church_id, v_wid,
      CASE i WHEN 1 THEN v_step1 WHEN 2 THEN v_step2 WHEN 3 THEN v_step3 ELSE v_step1 END,
      v_m.id, v_m.name, v_m.phone,
      'open',
      CASE WHEN i = 1 THEN 'high' ELSE 'normal' END,
      now() - (i * 2 || ' days')::interval,
      'auto_absentee',
      'seed_pc_ar_' || i
    WHERE NOT EXISTS (
      SELECT 1 FROM workflow_cards
       WHERE church_id = v_church_id AND source_ref = 'seed_pc_ar_' || i
    );
  END LOOP;

  -- ─────────────────────────────────────────────────────────────────
  -- 3) 세례 신청 (baptism) — 5단계
  -- ─────────────────────────────────────────────────────────────────
  INSERT INTO public.workflows (church_id, name, description, category, template_key, color, icon)
  VALUES (v_church_id, '세례 신청', '세례·학습 신청부터 예식까지', '세례', 'baptism', 'primary', 'Droplet')
  ON CONFLICT (church_id, template_key) WHERE template_key IS NOT NULL DO NOTHING
  RETURNING id INTO v_wid;
  IF v_wid IS NULL THEN
    SELECT id INTO v_wid FROM public.workflows
     WHERE church_id = v_church_id AND template_key = 'baptism' LIMIT 1;
  END IF;
  INSERT INTO public.workflow_steps (church_id, workflow_id, name, description, sort_order, expected_days, is_terminal) VALUES
    (v_church_id, v_wid, '신청 접수', '본인 신청 또는 추천 접수',         1, 1,  false),
    (v_church_id, v_wid, '교리 학습', '세례 교리반 출석 (8주)',           2, 56, false),
    (v_church_id, v_wid, '문답 면담', '담임/부교역자 면담',               3, 7,  false),
    (v_church_id, v_wid, '예식 준비', '세례식 명단 확정, 가운 준비',       4, 14, false),
    (v_church_id, v_wid, '세례 완료', '세례식 거행 및 등록',              5, 0,  true)
  ON CONFLICT (workflow_id, sort_order) DO NOTHING;

  -- ─────────────────────────────────────────────────────────────────
  -- 4) 임직 절차 (ordination) — 6단계
  -- ─────────────────────────────────────────────────────────────────
  INSERT INTO public.workflows (church_id, name, description, category, template_key, color, icon)
  VALUES (v_church_id, '임직 절차', '안수집사·권사·장로 임직 트랙', '임직', 'ordination', 'accent', 'Award')
  ON CONFLICT (church_id, template_key) WHERE template_key IS NOT NULL DO NOTHING
  RETURNING id INTO v_wid;
  IF v_wid IS NULL THEN
    SELECT id INTO v_wid FROM public.workflows
     WHERE church_id = v_church_id AND template_key = 'ordination' LIMIT 1;
  END IF;
  INSERT INTO public.workflow_steps (church_id, workflow_id, name, description, sort_order, expected_days, is_terminal) VALUES
    (v_church_id, v_wid, '후보 추천',   '당회·직원회 추천',             1, 7,   false),
    (v_church_id, v_wid, '자격 검토',   '자격·신원 확인',                2, 14,  false),
    (v_church_id, v_wid, '임직 교육',   '필수 교육 이수',                3, 60,  false),
    (v_church_id, v_wid, '공동의회',    '공동의회 결의',                 4, 30,  false),
    (v_church_id, v_wid, '준비 기간',   '예식 준비 / 안내',              5, 14,  false),
    (v_church_id, v_wid, '임직 완료',   '예식 거행 및 임명',              6, 0,   true)
  ON CONFLICT (workflow_id, sort_order) DO NOTHING;

  -- ─────────────────────────────────────────────────────────────────
  -- 5) 휴면 복귀 (reactivation) — 3단계
  -- ─────────────────────────────────────────────────────────────────
  INSERT INTO public.workflows (church_id, name, description, category, template_key, color, icon)
  VALUES (v_church_id, '휴면 복귀', '3개월 이상 미출석 성도의 복귀 트랙', '휴면복귀', 'reactivation', 'danger', 'RefreshCw')
  ON CONFLICT (church_id, template_key) WHERE template_key IS NOT NULL DO NOTHING
  RETURNING id INTO v_wid;
  IF v_wid IS NULL THEN
    SELECT id INTO v_wid FROM public.workflows
     WHERE church_id = v_church_id AND template_key = 'reactivation' LIMIT 1;
  END IF;
  INSERT INTO public.workflow_steps (church_id, workflow_id, name, description, sort_order, expected_days, is_terminal) VALUES
    (v_church_id, v_wid, '복귀 권면', '담당 사역자 연락',     1, 7,  false),
    (v_church_id, v_wid, '집중 심방', '가정 방문 또는 만남',   2, 21, false),
    (v_church_id, v_wid, '복귀 정착', '예배 출석 재정착',      3, 60, true)
  ON CONFLICT (workflow_id, sort_order) DO NOTHING;

  RAISE NOTICE '✅ 포천중앙침례교회 워크플로우 시드 완료 (5개 사역흐름 + 카드 샘플)';
END $$;

COMMIT;

-- 확인 쿼리
SELECT 'workflows'      AS table_name,
       COUNT(*)::INT    AS rows
  FROM workflows
 WHERE church_id = (SELECT id FROM churches
                     WHERE name ILIKE '%포천%중앙%' OR name ILIKE '%pocheon%central%'
                     ORDER BY created_at LIMIT 1)
UNION ALL
SELECT 'workflow_steps', COUNT(*)::INT
  FROM workflow_steps
 WHERE church_id = (SELECT id FROM churches
                     WHERE name ILIKE '%포천%중앙%' OR name ILIKE '%pocheon%central%'
                     ORDER BY created_at LIMIT 1)
UNION ALL
SELECT 'workflow_cards', COUNT(*)::INT
  FROM workflow_cards
 WHERE church_id = (SELECT id FROM churches
                     WHERE name ILIKE '%포천%중앙%' OR name ILIKE '%pocheon%central%'
                     ORDER BY created_at LIMIT 1);
