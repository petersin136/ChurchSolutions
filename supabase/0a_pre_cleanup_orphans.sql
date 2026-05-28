-- =====================================================================
-- 0a_pre_cleanup_orphans.sql  (Phase A 사전 정리)
-- ---------------------------------------------------------------------
-- 목적
--   0a_church_id_type_unification.sql (Phase A) 실행 전, churches 에
--   더 이상 존재하지 않는 church_id 를 참조하는 orphan 행을 안전하게
--   삭제한다. orphan 이 남아 있으면 Phase A 의 Pre-flight 검증(B)
--   단계에서 RAISE EXCEPTION 으로 ROLLBACK 된다.
--
-- 배경
--   과거 테스트 교회 삭제 시 FK CASCADE 가 없어서 다음 자식 행이
--   고아 상태로 남아있다 (감사 결과 기준):
--     - public.departments : 22 행
--     - public.places      : 12 행
--   * public.church_calendar / public.events 는 orphan 0 건이므로
--     본 파일에서 대상으로 삼지 않는다.
--
-- 영향 범위
--   - public.departments  (51 → 29 행 예상)
--   - public.places       (30 → 18 행 예상)
--   다른 테이블은 손대지 않는다.
--
-- 안전장치
--   - BEGIN … COMMIT 트랜잭션으로 감싸 실패 시 자동 ROLLBACK.
--   - Pre-check : 작업 전 orphan 건수 출력 + 0 건이면 "정리 불필요"
--     안내 (실패 아님 — 멱등성 확보).
--   - Post-check: 정리 후 orphan 이 잔존하면 RAISE EXCEPTION 으로
--     트랜잭션 전체 ROLLBACK.
--   - DELETE WHERE church_id::uuid NOT IN (…) 패턴 사용.
--       · church_id 가 NULL 인 행은 NOT IN 의 SQL semantics 상
--         삭제 대상이 아니다 (의도된 동작 — 다른 종류의 문제이므로
--         별도 처리 필요).
--       · church_id 가 UUID 형식이 아닌 텍스트면 ::uuid 캐스트가
--         실패하여 트랜잭션 전체가 ROLLBACK 된다 (의도된 안전장치).
--
-- 멱등성
--   - 재실행해도 안전: orphan 이 이미 0 건이면 Pre-check 가 알리고,
--     DELETE 는 0 행을 지우고, Post-check 가 통과한다.
--
-- 롤백
--   - 트랜잭션 도중 실패 시 자동 ROLLBACK.
--   - COMMIT 완료 후 되돌리려면 백업으로부터 복원이 필요하다.
--     (DELETE 된 행은 본 파일만으로 복구 불가)
-- =====================================================================


BEGIN;


-- =====================================================================
-- Pre-check
-- ---------------------------------------------------------------------
-- departments / places 각각의 orphan 건수를 측정하고 RAISE NOTICE 로
-- 출력한다. 이미 0 건이면 "정리 불필요" 안내만 출력하고 진행한다
-- (실패가 아니라 정상 흐름).
-- =====================================================================
DO $$
DECLARE
    dept_orphan_count   INTEGER;
    place_orphan_count  INTEGER;
BEGIN
    SELECT count(*)
    INTO   dept_orphan_count
    FROM   public.departments d
    WHERE  d.church_id IS NOT NULL
      AND  d.church_id::uuid NOT IN (SELECT id FROM public.churches);

    SELECT count(*)
    INTO   place_orphan_count
    FROM   public.places p
    WHERE  p.church_id IS NOT NULL
      AND  p.church_id::uuid NOT IN (SELECT id FROM public.churches);

    RAISE NOTICE '[pre-check] departments orphan = % 행', dept_orphan_count;
    RAISE NOTICE '[pre-check] places      orphan = % 행', place_orphan_count;

    IF dept_orphan_count = 0 AND place_orphan_count = 0 THEN
        RAISE NOTICE '[ok] orphan 0 건. 정리 불필요 — 멱등성으로 그대로 진행합니다.';
    ELSE
        RAISE NOTICE '[plan] 위 orphan 행을 즉시 삭제합니다.';
    END IF;
END
$$;


-- =====================================================================
-- 1) departments orphan 삭제
-- ---------------------------------------------------------------------
-- churches.id 에 존재하지 않는 church_id 를 가진 departments 행을
-- 삭제하고 삭제 행 수를 출력한다.
-- =====================================================================
DO $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM public.departments
    WHERE  church_id IS NOT NULL
      AND  church_id::uuid NOT IN (SELECT id FROM public.churches);

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE '[step] departments orphan 삭제: % 행', deleted_count;
END
$$;


-- =====================================================================
-- 2) places orphan 삭제
-- ---------------------------------------------------------------------
-- churches.id 에 존재하지 않는 church_id 를 가진 places 행을 삭제하고
-- 삭제 행 수를 출력한다.
-- =====================================================================
DO $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM public.places
    WHERE  church_id IS NOT NULL
      AND  church_id::uuid NOT IN (SELECT id FROM public.churches);

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE '[step] places      orphan 삭제: % 행', deleted_count;
END
$$;


-- =====================================================================
-- Post-check
-- ---------------------------------------------------------------------
-- 정리 후 orphan 이 0 건인지 재확인. 0 건이 아니라면 의도치 못한
-- 동시성/조건으로 잔존한 것이므로 RAISE EXCEPTION → 트랜잭션 전체
-- ROLLBACK.
-- =====================================================================
DO $$
DECLARE
    dept_remaining   INTEGER;
    place_remaining  INTEGER;
BEGIN
    SELECT count(*)
    INTO   dept_remaining
    FROM   public.departments d
    WHERE  d.church_id IS NOT NULL
      AND  d.church_id::uuid NOT IN (SELECT id FROM public.churches);

    SELECT count(*)
    INTO   place_remaining
    FROM   public.places p
    WHERE  p.church_id IS NOT NULL
      AND  p.church_id::uuid NOT IN (SELECT id FROM public.churches);

    IF dept_remaining > 0 OR place_remaining > 0 THEN
        RAISE EXCEPTION
          '[abort] 정리 후에도 orphan 잔존 (departments=%, places=%). ROLLBACK 합니다.',
          dept_remaining, place_remaining;
    END IF;

    RAISE NOTICE '[ok] Post-check 통과 — orphan 0 행. COMMIT 진행.';
END
$$;


COMMIT;


-- =====================================================================
-- 검증 쿼리 (트랜잭션 외부, READ-ONLY)
-- ---------------------------------------------------------------------
-- COMMIT 이후 아래 SELECT 를 차례로 실행해 결과를 눈으로 확인.
-- =====================================================================

-- (V1) departments / places 의 현재 행 수
--      기대(스냅샷 기준):
--        departments : 51 → 29
--        places      : 30 → 18
SELECT 'departments' AS table_name, count(*) AS row_count FROM public.departments
UNION ALL
SELECT 'places',                    count(*)               FROM public.places
ORDER BY table_name;

-- (V2) orphan 재검증
--      기대: 0 행 반환 (orphan 없음)
SELECT 'departments' AS table_name, church_id
FROM   public.departments d
WHERE  d.church_id IS NOT NULL
  AND  d.church_id::uuid NOT IN (SELECT id FROM public.churches)
UNION ALL
SELECT 'places',                    church_id
FROM   public.places p
WHERE  p.church_id IS NOT NULL
  AND  p.church_id::uuid NOT IN (SELECT id FROM public.churches)
ORDER BY table_name, church_id;


-- =====================================================================
-- 다음 단계 안내
-- ---------------------------------------------------------------------
-- 이 파일 실행 완료 후 0a_church_id_type_unification.sql 을 재실행
-- 하면 Pre-flight 검증을 통과하게 됩니다.
-- =====================================================================
