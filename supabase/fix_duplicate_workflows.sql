-- ============================================================
-- 사역흐름 중복 정리 (workflows)
-- ------------------------------------------------------------
-- 같은 (church_id, template_key) 조합에 여러 건이 들어간 row 중
-- 가장 오래된 1개만 남기고 나머지를 안전하게 삭제합니다.
--
-- 안전 규칙
--   1) created_at ASC, id ASC 순으로 첫 번째만 KEEP
--   2) 삭제 대상에 workflow_cards 가 1개라도 있으면 → SKIP (보존)
--      · CASCADE 로 카드/메모까지 같이 사라지는 데이터 손실을 방지
--      · SKIP 항목은 수동으로 카드 이관 후 재실행 필요
--   3) workflow_steps, workflow_card_notes 는 workflows / workflow_cards
--      삭제 시 FK CASCADE 로 자동 정리됨
--
-- 의존:
--   · supabase/workflow_system.sql (테이블·FK 정의)
--
-- 실행 방법 (Supabase SQL Editor)
--   · 전체 블록 그대로 실행 → 결과/메시지 탭에서 진단 결과와
--     [DEL]/[SKIP] 메시지를 확인
--   · 의심스러우면 마지막 COMMIT; 을 ROLLBACK; 으로 바꿔서 시범 실행
-- ============================================================

BEGIN;


-- ────────────────────────────────────────────────────────────
-- STEP 1) 진단 — 중복 그룹 요약 (church 이름 + template_key)
-- ────────────────────────────────────────────────────────────
SELECT
  c.name                                  AS church_name,
  w.template_key,
  COUNT(*)                                AS dup_count,
  MIN(w.created_at)                       AS first_created_at,
  MAX(w.created_at)                       AS last_created_at
FROM public.workflows w
JOIN public.churches  c ON c.id = w.church_id
WHERE w.template_key IS NOT NULL
GROUP BY c.name, w.template_key
HAVING COUNT(*) > 1
ORDER BY c.name, w.template_key;


-- ────────────────────────────────────────────────────────────
-- STEP 1-1) 진단 — 중복 row 각각의 카드 사용 현황
--           keep_order = 1 인 row 는 유지, 2 이상은 삭제 후보
-- ────────────────────────────────────────────────────────────
SELECT
  c.name                                  AS church_name,
  w.template_key,
  w.id                                    AS workflow_id,
  w.name                                  AS workflow_name,
  w.created_at,
  (SELECT COUNT(*) FROM public.workflow_cards wc
    WHERE wc.workflow_id = w.id)          AS card_count,
  ROW_NUMBER() OVER (
    PARTITION BY w.church_id, w.template_key
    ORDER BY w.created_at ASC, w.id ASC
  )                                       AS keep_order
FROM public.workflows w
JOIN public.churches  c ON c.id = w.church_id
WHERE w.template_key IS NOT NULL
  AND (w.church_id, w.template_key) IN (
        SELECT church_id, template_key
        FROM public.workflows
        WHERE template_key IS NOT NULL
        GROUP BY church_id, template_key
        HAVING COUNT(*) > 1
      )
ORDER BY church_name, template_key, keep_order;


-- ────────────────────────────────────────────────────────────
-- STEP 2) 안전 정리
--   · 그룹별 첫 row(가장 오래된) 유지
--   · OFFSET 1 부터의 row 만 삭제 후보로 평가
--   · 카드 보유 시 [SKIP], 아니면 [DEL]
-- ────────────────────────────────────────────────────────────
DO $$
DECLARE
  group_rec      RECORD;
  dup_rec        RECORD;
  card_cnt       INT;
  groups_total   INT := 0;
  deleted_total  INT := 0;
  skipped_total  INT := 0;
BEGIN
  FOR group_rec IN
    SELECT
      w.church_id,
      w.template_key,
      COALESCE(c.name, '(이름없음)')  AS church_name,
      COUNT(*)                        AS cnt
    FROM public.workflows w
    LEFT JOIN public.churches c ON c.id = w.church_id
    WHERE w.template_key IS NOT NULL
    GROUP BY w.church_id, w.template_key, c.name
    HAVING COUNT(*) > 1
  LOOP
    groups_total := groups_total + 1;
    RAISE NOTICE '[group] % / % — % 건 발견',
      group_rec.church_name, group_rec.template_key, group_rec.cnt;

    FOR dup_rec IN
      SELECT id, name, created_at
      FROM public.workflows
      WHERE church_id   = group_rec.church_id
        AND template_key = group_rec.template_key
      ORDER BY created_at ASC, id ASC
      OFFSET 1
    LOOP
      SELECT COUNT(*) INTO card_cnt
      FROM public.workflow_cards
      WHERE workflow_id = dup_rec.id;

      IF card_cnt > 0 THEN
        RAISE WARNING '  [SKIP] workflow_id=% — 카드 %개 존재. 수동 처리 필요',
          dup_rec.id, card_cnt;
        skipped_total := skipped_total + 1;
      ELSE
        DELETE FROM public.workflows WHERE id = dup_rec.id;
        RAISE NOTICE '  [DEL ] workflow_id=% (created_at=%) 삭제',
          dup_rec.id, dup_rec.created_at;
        deleted_total := deleted_total + 1;
      END IF;
    END LOOP;
  END LOOP;

  RAISE NOTICE '==== 정리 결과 ====';
  RAISE NOTICE '  중복 그룹       : %', groups_total;
  RAISE NOTICE '  삭제된 workflow : %', deleted_total;
  RAISE NOTICE '  보존(카드 보유) : %', skipped_total;
END $$;


-- ────────────────────────────────────────────────────────────
-- STEP 3) (church_id, template_key) 부분 UNIQUE 인덱스 보장
--   · 기존 인덱스 정의가 다르면 드롭 후 재생성
--   · 중복이 남아있으면(=SKIP 발생) 인덱스 생성을 건너뛰고 경고만
-- ────────────────────────────────────────────────────────────
DO $$
DECLARE
  idx_def         TEXT;
  remaining_dups  INT;
BEGIN
  SELECT indexdef INTO idx_def
  FROM pg_indexes
  WHERE schemaname = 'public'
    AND indexname  = 'uq_workflows_church_template';

  IF idx_def IS NULL THEN
    RAISE NOTICE '[idx] uq_workflows_church_template 인덱스 없음 — 생성 시도';
  ELSIF idx_def ILIKE '%UNIQUE%'
    AND idx_def ILIKE '%(church_id, template_key)%'
    AND idx_def ILIKE '%WHERE%template_key IS NOT NULL%' THEN
    RAISE NOTICE '[idx] 이미 올바른 부분 UNIQUE 인덱스가 존재합니다 — 재생성 생략';
    RAISE NOTICE '[idx] 기존 정의: %', idx_def;
    RETURN;
  ELSE
    RAISE NOTICE '[idx] 잘못된 인덱스 정의 — 드롭 후 재생성';
    RAISE NOTICE '[idx] 기존 정의: %', idx_def;
    EXECUTE 'DROP INDEX public.uq_workflows_church_template';
  END IF;

  -- 인덱스 생성 전, 남은 중복 검사 (있으면 인덱스 생성이 실패하므로 사전 차단)
  SELECT COUNT(*) INTO remaining_dups
  FROM (
    SELECT church_id, template_key
    FROM public.workflows
    WHERE template_key IS NOT NULL
    GROUP BY church_id, template_key
    HAVING COUNT(*) > 1
  ) d;

  IF remaining_dups > 0 THEN
    RAISE WARNING '[idx] 중복 %개 그룹이 남아있어 UNIQUE 인덱스를 생성하지 않았습니다. STEP 2 의 [SKIP] 항목을 수동 처리 후 본 파일을 재실행하세요.',
      remaining_dups;
    RETURN;
  END IF;

  EXECUTE
    'CREATE UNIQUE INDEX uq_workflows_church_template
       ON public.workflows (church_id, template_key)
       WHERE template_key IS NOT NULL';

  RAISE NOTICE '[idx] UNIQUE 부분 인덱스 생성 완료 — 앞으로 중복 INSERT 차단됨';
END $$;


-- ────────────────────────────────────────────────────────────
-- STEP 4) 검증 — 정리 후 상태
-- ────────────────────────────────────────────────────────────
SELECT
  c.name           AS church_name,
  w.template_key,
  COUNT(*)         AS row_count
FROM public.workflows w
JOIN public.churches  c ON c.id = w.church_id
WHERE w.template_key IS NOT NULL
GROUP BY c.name, w.template_key
ORDER BY c.name, w.template_key;


-- STEP 4-1) 남은 중복 (정상이라면 0행)
SELECT
  c.name           AS church_name,
  w.template_key,
  COUNT(*)         AS still_dup_count
FROM public.workflows w
JOIN public.churches  c ON c.id = w.church_id
WHERE w.template_key IS NOT NULL
GROUP BY c.name, w.template_key
HAVING COUNT(*) > 1
ORDER BY c.name, w.template_key;


-- STEP 4-2) 부분 UNIQUE 인덱스 최종 상태 확인
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename  = 'workflows'
  AND indexname  = 'uq_workflows_church_template';


COMMIT;
-- 시범 실행 시: 위 COMMIT; 을 ROLLBACK; 으로 바꾸고 실행하면 변경 사항이 되돌려집니다.


-- ============================================================
-- 후속 처리 가이드 (STEP 2 에서 [SKIP] 이 발생한 경우)
-- ------------------------------------------------------------
-- 1) 해당 SKIP workflow 의 카드들을 같은 (church_id, template_key) 의
--    KEEP workflow 로 이관 (예시):
--
--      UPDATE public.workflow_cards
--         SET workflow_id    = '<keep_workflow_id>',
--             current_step_id = NULL  -- 단계 ID 가 달라지므로 일단 NULL
--       WHERE workflow_id    = '<skip_workflow_id>';
--
--    이후 단계 매핑이 필요하면 workflow_steps 의 sort_order 를 기준으로
--    수동 매칭하거나 보드에서 카드를 다음 단계로 옮겨주면 됩니다.
--
-- 2) 카드 이관이 끝나면 본 SQL 파일을 다시 실행해 SKIP 카운트가 0 임을
--    확인하고 부분 UNIQUE 인덱스 생성을 마무리합니다.
-- ============================================================
