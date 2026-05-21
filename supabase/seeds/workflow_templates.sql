-- ============================================================
-- 사역흐름 시스템 — 한국형 기본 템플릿 5종 시드
-- ------------------------------------------------------------
-- 모든 교회(public.churches)에 대해 5개 시드 사역흐름과 단계를 만듭니다.
-- (church_id, template_key) UNIQUE 제약으로 멱등 보장.
-- 의존: supabase/workflow_system.sql
-- ============================================================

DO $$
DECLARE
  ch RECORD;
  wid uuid;
BEGIN
  FOR ch IN SELECT id, name FROM public.churches LOOP

    -- ─────────────────────────────────────────────────────────
    -- 1) 새가족 정착 (new_family) — 5단계
    -- ─────────────────────────────────────────────────────────
    INSERT INTO public.workflows (church_id, name, description, category, template_key, color, icon)
    VALUES (ch.id, '새가족 정착', '첫 방문부터 정착까지 4~5주 트랙', '새가족', 'new_family', 'success', 'Sprout')
    ON CONFLICT (church_id, template_key) WHERE template_key IS NOT NULL DO NOTHING
    RETURNING id INTO wid;

    IF wid IS NULL THEN
      SELECT id INTO wid FROM public.workflows
       WHERE church_id = ch.id AND template_key = 'new_family' LIMIT 1;
    END IF;

    INSERT INTO public.workflow_steps (church_id, workflow_id, name, description, sort_order, expected_days, is_terminal) VALUES
      (ch.id, wid, '환영 인사',    '첫 방문 당일 환영, 연락처 확보',  1, 1,  false),
      (ch.id, wid, '안내 통화',    '평일 중 짧은 안부 통화',         2, 3,  false),
      (ch.id, wid, '가정 심방',    '담당 목회자가 가정 방문',         3, 14, false),
      (ch.id, wid, '양육반 배정',  '새가족 양육 / 정착반 배정',       4, 21, false),
      (ch.id, wid, '정착 완료',    '소그룹 등록 및 정착 확정',         5, 30, true)
    ON CONFLICT (workflow_id, sort_order) DO NOTHING;

    -- ─────────────────────────────────────────────────────────
    -- 2) 결석자 회복 (absentee_recovery) — 4단계
    -- ─────────────────────────────────────────────────────────
    INSERT INTO public.workflows (church_id, name, description, category, template_key, color, icon)
    VALUES (ch.id, '결석자 회복', '2주 이상 결석 성도의 출석 회복 트랙', '결석회복', 'absentee_recovery', 'warning', 'AlertCircle')
    ON CONFLICT (church_id, template_key) WHERE template_key IS NOT NULL DO NOTHING
    RETURNING id INTO wid;

    IF wid IS NULL THEN
      SELECT id INTO wid FROM public.workflows
       WHERE church_id = ch.id AND template_key = 'absentee_recovery' LIMIT 1;
    END IF;

    INSERT INTO public.workflow_steps (church_id, workflow_id, name, description, sort_order, expected_days, is_terminal) VALUES
      (ch.id, wid, '1차 연락',     '문자/통화로 안부 확인',           1, 2,  false),
      (ch.id, wid, '안부 확인',    '결석 사유 파악, 기도 제목 청취',   2, 5,  false),
      (ch.id, wid, '심방 진행',    '담당 목회자/목장장 심방',          3, 14, false),
      (ch.id, wid, '출석 회복',    '예배 출석 재확인',                4, 28, true)
    ON CONFLICT (workflow_id, sort_order) DO NOTHING;

    -- ─────────────────────────────────────────────────────────
    -- 3) 세례 신청 (baptism) — 5단계
    -- ─────────────────────────────────────────────────────────
    INSERT INTO public.workflows (church_id, name, description, category, template_key, color, icon)
    VALUES (ch.id, '세례 신청', '세례·학습 신청부터 예식까지', '세례', 'baptism', 'primary', 'Droplet')
    ON CONFLICT (church_id, template_key) WHERE template_key IS NOT NULL DO NOTHING
    RETURNING id INTO wid;

    IF wid IS NULL THEN
      SELECT id INTO wid FROM public.workflows
       WHERE church_id = ch.id AND template_key = 'baptism' LIMIT 1;
    END IF;

    INSERT INTO public.workflow_steps (church_id, workflow_id, name, description, sort_order, expected_days, is_terminal) VALUES
      (ch.id, wid, '신청 접수',     '본인 신청 또는 추천 접수',         1, 1,  false),
      (ch.id, wid, '교리 학습',     '세례 교리반 출석 (8주)',          2, 56, false),
      (ch.id, wid, '문답 면담',     '담임/부교역자 면담',              3, 7,  false),
      (ch.id, wid, '예식 준비',     '세례식 명단 확정, 가운 준비',      4, 14, false),
      (ch.id, wid, '세례 완료',     '세례식 거행 및 등록',             5, 0,  true)
    ON CONFLICT (workflow_id, sort_order) DO NOTHING;

    -- ─────────────────────────────────────────────────────────
    -- 4) 임직 절차 (ordination) — 6단계
    -- ─────────────────────────────────────────────────────────
    INSERT INTO public.workflows (church_id, name, description, category, template_key, color, icon)
    VALUES (ch.id, '임직 절차', '장로·권사·안수집사 임직 프로세스', '임직', 'ordination', 'purple', 'Award')
    ON CONFLICT (church_id, template_key) WHERE template_key IS NOT NULL DO NOTHING
    RETURNING id INTO wid;

    IF wid IS NULL THEN
      SELECT id INTO wid FROM public.workflows
       WHERE church_id = ch.id AND template_key = 'ordination' LIMIT 1;
    END IF;

    INSERT INTO public.workflow_steps (church_id, workflow_id, name, description, sort_order, expected_days, is_terminal) VALUES
      (ch.id, wid, '후보 추천',     '제직회/당회 추천',                 1, 7,  false),
      (ch.id, wid, '자격 심사',     '출석/봉사/헌금 자격 검토',         2, 14, false),
      (ch.id, wid, '교육 이수',     '임직 교육 과정 수료',              3, 42, false),
      (ch.id, wid, '시험·면접',     '담임/당회 면접',                  4, 14, false),
      (ch.id, wid, '공동의회',      '공동의회 인준 투표',              5, 14, false),
      (ch.id, wid, '임직식',        '임직 예배 거행',                  6, 30, true)
    ON CONFLICT (workflow_id, sort_order) DO NOTHING;

    -- ─────────────────────────────────────────────────────────
    -- 5) 휴면 복귀 (reactivation) — 3단계
    -- ─────────────────────────────────────────────────────────
    INSERT INTO public.workflows (church_id, name, description, category, template_key, color, icon)
    VALUES (ch.id, '휴면 복귀', '3개월 이상 미출석 성도 회복', '휴면복귀', 'reactivation', 'orange', 'Heart')
    ON CONFLICT (church_id, template_key) WHERE template_key IS NOT NULL DO NOTHING
    RETURNING id INTO wid;

    IF wid IS NULL THEN
      SELECT id INTO wid FROM public.workflows
       WHERE church_id = ch.id AND template_key = 'reactivation' LIMIT 1;
    END IF;

    INSERT INTO public.workflow_steps (church_id, workflow_id, name, description, sort_order, expected_days, is_terminal) VALUES
      (ch.id, wid, '1차 연락',     '안부 문자/통화 시도',             1, 7,  false),
      (ch.id, wid, '만남',         '커피/식사 등 자연스러운 만남',     2, 21, false),
      (ch.id, wid, '복귀 확정',    '주일예배 출석 회복',              3, 60, true)
    ON CONFLICT (workflow_id, sort_order) DO NOTHING;

    RAISE NOTICE '[workflow_seed] church=% (%) — 5 templates ensured', ch.name, ch.id;
  END LOOP;
END $$;

-- 확인용
-- SELECT w.name, w.category, count(s.id) AS steps
-- FROM workflows w
-- LEFT JOIN workflow_steps s ON s.workflow_id = w.id
-- GROUP BY w.id, w.name, w.category ORDER BY w.name;
