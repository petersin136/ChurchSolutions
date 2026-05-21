-- ============================================================
-- 사역흐름 체크리스트 시드
-- ------------------------------------------------------------
-- 목적:
--   1) workflow_steps  에 checklist_items  (JSONB, 항목 정의)  컬럼 추가
--   2) workflow_cards  에 checklist_state  (JSONB, 체크 상태) 컬럼 추가
--   3) 4개 사역흐름(결석자 회복 / 세례 신청 / 임직 절차 / 휴면 복귀)의
--      모든 단계에 체크리스트 항목을 시드 데이터로 일괄 주입.
--      new_family(새가족 정착) 은 기존 PastoralPage 의 4주차 트랙과 중복되므로
--      이 스크립트에서 제외합니다.
--
-- 멱등 보장:
--   - ADD COLUMN IF NOT EXISTS
--   - UPDATE 는 (checklist_items IS NULL OR checklist_items = '[]'::jsonb)
--     인 row 만 갱신 → 이미 시드된 row 는 절대 덮어쓰지 않음.
--
-- 의존: supabase/workflow_system.sql, supabase/seeds/workflow_templates.sql
-- ============================================================

BEGIN;

-- ============================================================
-- STEP 1) 컬럼 추가
-- ============================================================
ALTER TABLE public.workflow_steps
  ADD COLUMN IF NOT EXISTS checklist_items JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.workflow_cards
  ADD COLUMN IF NOT EXISTS checklist_state JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.workflow_steps.checklist_items IS
  '단계별 체크리스트 항목 정의. 예: [{"id":"baptism_1_1","label":"세례 신청서 작성 확인","order":1}, ...]';
COMMENT ON COLUMN public.workflow_cards.checklist_state IS
  '카드별 체크리스트 진행 상태. 예: {"baptism_1_1": true, "baptism_1_2": false, ...}';

-- ============================================================
-- STEP 2) 체크리스트 항목 시드
-- ------------------------------------------------------------
-- 한 번의 UPDATE ... FROM (VALUES ...) 로 모든 교회의 모든 단계를 갱신.
-- workflows.template_key + workflow_steps.sort_order 로 결합.
-- 멱등성: 이미 비어있지 않은 row 는 WHERE 절에서 제외.
-- ============================================================
WITH checklist_map(template_key, sort_order, items) AS (
  VALUES

  -- ─────────────────────────────────────────────────────────
  -- 결석자 회복 (absentee_recovery) — 4단계
  --   sort_order 1 = 1차 연락 / 2 = 안부 확인 / 3 = 심방 진행 / 4 = 출석 회복
  -- ─────────────────────────────────────────────────────────
  ('absentee_recovery'::text, 1::int, '[
    {"id":"absentee_1_1","label":"출석부에서 결석 확인 (2~3주)","order":1},
    {"id":"absentee_1_2","label":"전화 또는 문자로 안부 연락","order":2},
    {"id":"absentee_1_3","label":"결석 사유 파악 (질병/이사/갈등/신앙)","order":3},
    {"id":"absentee_1_4","label":"연락 결과 메모 기록","order":4}
  ]'::jsonb),
  ('absentee_recovery', 2, '[
    {"id":"absentee_2_1","label":"가족 구성원 출석 상황 확인","order":1},
    {"id":"absentee_2_2","label":"담당 구역장·순장과 정보 공유","order":2},
    {"id":"absentee_2_3","label":"기도 제목 청취","order":3},
    {"id":"absentee_2_4","label":"추가 연락 필요 여부 판단","order":4}
  ]'::jsonb),
  ('absentee_recovery', 3, '[
    {"id":"absentee_3_1","label":"심방 일정 약속","order":1},
    {"id":"absentee_3_2","label":"담당 교역자 또는 구역장 심방","order":2},
    {"id":"absentee_3_3","label":"가정 상황 및 신앙 상태 파악","order":3},
    {"id":"absentee_3_4","label":"예배 복귀 의사 확인","order":4},
    {"id":"absentee_3_5","label":"심방 보고서 작성","order":5}
  ]'::jsonb),
  ('absentee_recovery', 4, '[
    {"id":"absentee_4_1","label":"예배 출석 재개 확인","order":1},
    {"id":"absentee_4_2","label":"구역·소그룹 재연결","order":2},
    {"id":"absentee_4_3","label":"복귀 후 2주 출석 모니터링","order":3},
    {"id":"absentee_4_4","label":"정기 케어 대상으로 전환","order":4}
  ]'::jsonb),

  -- ─────────────────────────────────────────────────────────
  -- 세례 신청 (baptism) — 5단계
  --   sort_order 1 = 신청 접수 / 2 = 교리 학습 / 3 = 문답 면담 / 4 = 예식 준비 / 5 = 세례 완료
  -- ─────────────────────────────────────────────────────────
  ('baptism', 1, '[
    {"id":"baptism_1_1","label":"세례 신청서 작성 확인","order":1},
    {"id":"baptism_1_2","label":"신앙 고백서 제출","order":2},
    {"id":"baptism_1_3","label":"출석 기간 확인 (6개월 이상)","order":3},
    {"id":"baptism_1_4","label":"추천인 확인","order":4}
  ]'::jsonb),
  ('baptism', 2, '[
    {"id":"baptism_2_1","label":"교리 교육 일정 안내","order":1},
    {"id":"baptism_2_2","label":"교재 배부","order":2},
    {"id":"baptism_2_3","label":"교육 출석 (전 회차)","order":3},
    {"id":"baptism_2_4","label":"과제 또는 학습지 제출","order":4},
    {"id":"baptism_2_5","label":"학습 이수 확인","order":5}
  ]'::jsonb),
  ('baptism', 3, '[
    {"id":"baptism_3_1","label":"면담 일정 잡기","order":1},
    {"id":"baptism_3_2","label":"담임목사 또는 교역자 면담","order":2},
    {"id":"baptism_3_3","label":"신앙 간증 청취","order":3},
    {"id":"baptism_3_4","label":"교리 이해도 확인","order":4},
    {"id":"baptism_3_5","label":"최종 승인 결정","order":5}
  ]'::jsonb),
  ('baptism', 4, '[
    {"id":"baptism_4_1","label":"세례식 일정 통보","order":1},
    {"id":"baptism_4_2","label":"세례 의복 준비 안내","order":2},
    {"id":"baptism_4_3","label":"가족·지인 초청","order":3},
    {"id":"baptism_4_4","label":"식순 및 좌석 안내","order":4},
    {"id":"baptism_4_5","label":"사진/영상 담당 배정","order":5}
  ]'::jsonb),
  ('baptism', 5, '[
    {"id":"baptism_5_1","label":"세례식 진행","order":1},
    {"id":"baptism_5_2","label":"세례 증서 발급","order":2},
    {"id":"baptism_5_3","label":"교적부 등록 완료","order":3},
    {"id":"baptism_5_4","label":"첫 성찬 안내 (해당 시)","order":4},
    {"id":"baptism_5_5","label":"봉사 부서 연결 안내","order":5}
  ]'::jsonb),

  -- ─────────────────────────────────────────────────────────
  -- 임직 절차 (ordination) — 6단계
  --   sort_order 1 = 후보 추천 / 2 = 자격 심사 / 3 = 교육 이수 /
  --              4 = 시험·면접 / 5 = 공동의회 / 6 = 임직식
  -- ─────────────────────────────────────────────────────────
  ('ordination', 1, '[
    {"id":"ordination_1_1","label":"당회 또는 운영위원회 추천","order":1},
    {"id":"ordination_1_2","label":"후보자 본인 의사 확인","order":2},
    {"id":"ordination_1_3","label":"추천 사유 기록","order":3},
    {"id":"ordination_1_4","label":"가족 동의 확인","order":4}
  ]'::jsonb),
  ('ordination', 2, '[
    {"id":"ordination_2_1","label":"신앙 연수 확인 (교단 규정)","order":1},
    {"id":"ordination_2_2","label":"출석 및 헌신도 확인","order":2},
    {"id":"ordination_2_3","label":"봉사 이력 검토","order":3},
    {"id":"ordination_2_4","label":"가정 신앙 상태 확인","order":4},
    {"id":"ordination_2_5","label":"추천서 수합","order":5}
  ]'::jsonb),
  ('ordination', 3, '[
    {"id":"ordination_3_1","label":"임직 교육 일정 통보","order":1},
    {"id":"ordination_3_2","label":"교재 배부","order":2},
    {"id":"ordination_3_3","label":"교육 출석 (전 회차)","order":3},
    {"id":"ordination_3_4","label":"과제 제출","order":4}
  ]'::jsonb),
  ('ordination', 4, '[
    {"id":"ordination_4_1","label":"시험 일정 통보","order":1},
    {"id":"ordination_4_2","label":"필기 또는 구술 시험 진행","order":2},
    {"id":"ordination_4_3","label":"당회/교역자 면접","order":3},
    {"id":"ordination_4_4","label":"합격 여부 결정","order":4},
    {"id":"ordination_4_5","label":"결과 통보","order":5}
  ]'::jsonb),
  ('ordination', 5, '[
    {"id":"ordination_5_1","label":"공동의회 일정 공고 (2주 전)","order":1},
    {"id":"ordination_5_2","label":"후보자 공개","order":2},
    {"id":"ordination_5_3","label":"투표 진행","order":3},
    {"id":"ordination_5_4","label":"개표 및 결과 발표","order":4},
    {"id":"ordination_5_5","label":"교단 보고","order":5}
  ]'::jsonb),
  ('ordination', 6, '[
    {"id":"ordination_6_1","label":"임직식 일정 확정","order":1},
    {"id":"ordination_6_2","label":"임직 예복 준비","order":2},
    {"id":"ordination_6_3","label":"임직 서약문 전달","order":3},
    {"id":"ordination_6_4","label":"임직식 진행","order":4},
    {"id":"ordination_6_5","label":"임직패·증서 수여","order":5},
    {"id":"ordination_6_6","label":"교적부 직분 갱신","order":6},
    {"id":"ordination_6_7","label":"첫 봉사 배치","order":7}
  ]'::jsonb),

  -- ─────────────────────────────────────────────────────────
  -- 휴면 복귀 (reactivation) — 3단계
  --   sort_order 1 = 1차 연락 / 2 = 만남 / 3 = 복귀 확정
  -- ─────────────────────────────────────────────────────────
  ('reactivation', 1, '[
    {"id":"reactivation_1_1","label":"6개월 이상 미출석 명단 확인","order":1},
    {"id":"reactivation_1_2","label":"최종 연락처 업데이트","order":2},
    {"id":"reactivation_1_3","label":"전화 연락 시도","order":3},
    {"id":"reactivation_1_4","label":"문자·카톡 안부 메시지","order":4}
  ]'::jsonb),
  ('reactivation', 2, '[
    {"id":"reactivation_2_1","label":"만남 일정 약속","order":1},
    {"id":"reactivation_2_2","label":"담당 교역자 또는 구역장 방문","order":2},
    {"id":"reactivation_2_3","label":"휴면 사유 파악 (이사/갈등/신앙/타교회)","order":3},
    {"id":"reactivation_2_4","label":"복귀 의사 확인","order":4},
    {"id":"reactivation_2_5","label":"기도 제목 청취","order":5}
  ]'::jsonb),
  ('reactivation', 3, '[
    {"id":"reactivation_3_1","label":"복귀 의사 확인 시 예배 초청 및 재등록","order":1},
    {"id":"reactivation_3_2","label":"타교회 출석 확인 시 이명 처리","order":2},
    {"id":"reactivation_3_3","label":"연락 두절 확인 시 휴면 상태로 분류","order":3},
    {"id":"reactivation_3_4","label":"교적 상태 업데이트","order":4},
    {"id":"reactivation_3_5","label":"정기 케어 대상으로 전환","order":5}
  ]'::jsonb)
)
UPDATE public.workflow_steps s
   SET checklist_items = m.items
  FROM checklist_map m
  JOIN public.workflows w
    ON w.template_key = m.template_key
 WHERE s.workflow_id = w.id
   AND s.sort_order  = m.sort_order
   AND (s.checklist_items IS NULL OR s.checklist_items = '[]'::jsonb);

-- 결과 안내
DO $$
DECLARE
  updated_count int;
  total_steps int;
BEGIN
  SELECT count(*) INTO total_steps
    FROM public.workflow_steps s
    JOIN public.workflows w ON w.id = s.workflow_id
   WHERE w.template_key IN ('absentee_recovery','baptism','ordination','reactivation');

  SELECT count(*) INTO updated_count
    FROM public.workflow_steps s
    JOIN public.workflows w ON w.id = s.workflow_id
   WHERE w.template_key IN ('absentee_recovery','baptism','ordination','reactivation')
     AND s.checklist_items <> '[]'::jsonb
     AND s.checklist_items IS NOT NULL;

  RAISE NOTICE '[workflow_checklists] 4개 사역흐름 대상 단계 총 %개 중 체크리스트가 채워진 단계: %개',
    total_steps, updated_count;
END $$;

COMMIT;

-- ============================================================
-- 검증 쿼리 (트랜잭션 종료 후 별도 실행)
-- ------------------------------------------------------------
-- 참고: workflow_steps 의 단계명 컬럼은 `name` 입니다.
--       요청 사양의 `s.title` 은 alias 로 제공합니다.
-- ============================================================
SELECT
  w.template_key,
  s.name AS title,
  jsonb_array_length(s.checklist_items) AS checklist_count
FROM public.workflow_steps s
JOIN public.workflows w ON w.id = s.workflow_id
WHERE w.template_key IN ('absentee_recovery','baptism','ordination','reactivation')
ORDER BY w.template_key, s.sort_order;
