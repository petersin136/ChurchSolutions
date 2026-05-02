-- =====================================================================
-- 은혜로교회 데모 누락 데이터 보충 (Grace Demo Gap Fill)
-- church_id: a1b2c3d4-e5f6-7890-abcd-ef1234567890
-- 목적:
--   1. 2021년 1~17주 출석/헌금 데이터 보충
--   2. 2021년 1~4월 지출 데이터 보충
--   3. 2025년 1~52주 출석/헌금 데이터 보충
--   4. 2025년 1~12월 지출 데이터 보충
-- =====================================================================
-- 안전장치:
--   1. 2025년 attendance가 이미 1000행 이상이면 ABORT
--   2. 기존 데이터 수정/삭제 없음 (INSERT only)
--   3. 모든 INSERT는 단일 church_id 스코프
--   4. 트랜잭션으로 묶음
-- =====================================================================

BEGIN;

DO $$
DECLARE
  v_church_id UUID := 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
  v_existing_2025_attendance INT;
  v_year INT;
  v_week INT;
  v_month INT;
  v_event_date DATE;
  v_attendance_rate FLOAT;
  v_offering_factor FLOAT;
  v_expense_factor FLOAT;
BEGIN
  -- ============================================================
  -- 0. 가드
  -- ============================================================
  SELECT COUNT(*) INTO v_existing_2025_attendance
  FROM attendance
  WHERE church_id = v_church_id
    AND year = 2025;

  IF v_existing_2025_attendance >= 1000 THEN
    RAISE EXCEPTION '2025년 attendance가 이미 %행 존재합니다. 중복 보충 방지를 위해 중단합니다.', v_existing_2025_attendance;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM churches WHERE id = v_church_id) THEN
    RAISE EXCEPTION '은혜로교회(church_id=%)가 없습니다. 먼저 grace_demo_seed.sql을 실행하세요.', v_church_id;
  END IF;

  RAISE NOTICE '은혜로교회 누락 데이터 보충 시작';

  -- ============================================================
  -- 1. attendance 보충 - 2021년 1~17주, 2025년 1~52주
  -- ============================================================
  FOR v_year IN 2021..2025 LOOP
    IF v_year NOT IN (2021, 2025) THEN
      CONTINUE;
    END IF;

    v_attendance_rate := CASE v_year
      WHEN 2021 THEN 0.65
      ELSE 0.78
    END;

    FOR v_week IN 1..(CASE WHEN v_year = 2021 THEN 17 ELSE 52 END) LOOP
      v_event_date := make_date(v_year, 1, 1) + ((v_week - 1) * 7);

      INSERT INTO attendance (church_id, member_id, week_num, year, status, date, service_type)
      SELECT
        v_church_id,
        m.id,
        v_week,
        v_year,
        CASE
          WHEN r.seed < v_attendance_rate THEN 'p'
          WHEN r.seed < v_attendance_rate + 0.10 THEN 'o'
          WHEN r.seed < v_attendance_rate + 0.15 THEN 'l'
          WHEN r.seed < v_attendance_rate + 0.25 THEN 'a'
          ELSE 'n'
        END,
        v_event_date,
        '주일예배'
      FROM members m
      CROSS JOIN LATERAL (SELECT random() AS seed WHERE m.id IS NOT NULL) r
      WHERE m.church_id = v_church_id
        AND m.member_status = '활동';
    END LOOP;
  END LOOP;

  RAISE NOTICE '출석 누락분 보충 완료';

  -- ============================================================
  -- 2. income 보충 - 2021년 1~17주, 2025년 1~52주
  -- ============================================================
  FOR v_year IN 2021..2025 LOOP
    IF v_year NOT IN (2021, 2025) THEN
      CONTINUE;
    END IF;

    v_offering_factor := CASE v_year
      WHEN 2021 THEN 0.70
      ELSE 0.97
    END;

    FOR v_week IN 1..(CASE WHEN v_year = 2021 THEN 17 ELSE 52 END) LOOP
      v_event_date := make_date(v_year, 1, 1) + ((v_week - 1) * 7);

      INSERT INTO income (church_id, date, type, amount, payment_method, fiscal_year, month)
      VALUES (
        v_church_id,
        TO_CHAR(v_event_date, 'YYYY-MM-DD'),
        '주일헌금',
        ((300000 + (random() * 500000)::BIGINT) * v_offering_factor)::BIGINT,
        '현금',
        v_year::TEXT,
        EXTRACT(MONTH FROM v_event_date)::INT
      );

      INSERT INTO income (church_id, date, type, amount, donor, member_id, payment_method, fiscal_year, month)
      SELECT
        v_church_id,
        TO_CHAR(v_event_date, 'YYYY-MM-DD'),
        '십일조',
        ((200000 + (random() * 800000)::BIGINT) * v_offering_factor)::BIGINT,
        m.name,
        m.id,
        CASE WHEN random() < 0.7 THEN '계좌이체' ELSE '현금' END,
        v_year::TEXT,
        EXTRACT(MONTH FROM v_event_date)::INT
      FROM (
        SELECT id, name
        FROM members
        WHERE church_id = v_church_id
          AND dept = '장년부'
          AND member_status = '활동'
        ORDER BY random()
        LIMIT 8
      ) m;

      IF EXTRACT(DAY FROM v_event_date)::INT <= 7 THEN
        INSERT INTO income (church_id, date, type, amount, donor, member_id, payment_method, fiscal_year, month)
        SELECT
          v_church_id,
          TO_CHAR(v_event_date, 'YYYY-MM-DD'),
          '감사헌금',
          ((100000 + (random() * 300000)::BIGINT) * v_offering_factor)::BIGINT,
          m.name,
          m.id,
          '현금',
          v_year::TEXT,
          EXTRACT(MONTH FROM v_event_date)::INT
        FROM (
          SELECT id, name
          FROM members
          WHERE church_id = v_church_id
            AND member_status = '활동'
          ORDER BY random()
          LIMIT 2
        ) m;
      END IF;
    END LOOP;
  END LOOP;

  RAISE NOTICE '헌금 누락분 보충 완료';

  -- ============================================================
  -- 3. expense 보충 - 2021년 1~4월, 2025년 1~12월
  -- ============================================================
  FOR v_year IN 2021..2025 LOOP
    IF v_year NOT IN (2021, 2025) THEN
      CONTINUE;
    END IF;

    v_expense_factor := CASE v_year
      WHEN 2021 THEN 0.75
      ELSE 0.95
    END;

    FOR v_month IN 1..(CASE WHEN v_year = 2021 THEN 4 ELSE 12 END) LOOP
      INSERT INTO expense (church_id, date, category, item, amount, payment_method, fiscal_year, month)
      VALUES (
        v_church_id,
        v_year || '-' || LPAD(v_month::TEXT, 2, '0') || '-25',
        '인건비',
        '교역자 사례비',
        ((8000000 + (random() * 2000000)::BIGINT) * v_expense_factor)::BIGINT,
        '계좌이체',
        v_year::TEXT,
        v_month
      );

      INSERT INTO expense (church_id, date, category, item, amount, payment_method, fiscal_year, month)
      VALUES
        (v_church_id, v_year || '-' || LPAD(v_month::TEXT, 2, '0') || '-10', '관리비', '전기/수도/가스', ((500000 + (random() * 300000)::BIGINT) * v_expense_factor)::BIGINT, '계좌이체', v_year::TEXT, v_month),
        (v_church_id, v_year || '-' || LPAD(v_month::TEXT, 2, '0') || '-15', '관리비', '청소/방역', ((200000 + (random() * 100000)::BIGINT) * v_expense_factor)::BIGINT, '계좌이체', v_year::TEXT, v_month),
        (v_church_id, v_year || '-' || LPAD(v_month::TEXT, 2, '0') || '-20', '사역비', '예배 물품', ((150000 + (random() * 200000)::BIGINT) * v_expense_factor)::BIGINT, '카드', v_year::TEXT, v_month),
        (v_church_id, v_year || '-' || LPAD(v_month::TEXT, 2, '0') || '-28', '선교비', '국내외 선교사 후원', ((1000000 + (random() * 500000)::BIGINT) * v_expense_factor)::BIGINT, '계좌이체', v_year::TEXT, v_month);
    END LOOP;
  END LOOP;

  RAISE NOTICE '지출 누락분 보충 완료';
  RAISE NOTICE '✅ 은혜로교회 누락 데이터 보충 완료';
END $$;

COMMIT;

-- =====================================================================
-- 검증: year별 attendance, income, expense 카운트
-- =====================================================================
SELECT 'attendance' AS table_name, year::TEXT AS year, COUNT(*) AS row_count
FROM attendance
WHERE church_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
GROUP BY year
UNION ALL
SELECT 'income' AS table_name, fiscal_year AS year, COUNT(*) AS row_count
FROM income
WHERE church_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
GROUP BY fiscal_year
UNION ALL
SELECT 'expense' AS table_name, fiscal_year AS year, COUNT(*) AS row_count
FROM expense
WHERE church_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
GROUP BY fiscal_year
ORDER BY table_name, year;
