-- =====================================================================
-- 은혜로교회 데모 시드 확장 (Grace Demo Church Extension)
-- 기존 2년치(2024-05~2026-04) + 추가 3년치(2021-05~2024-04) = 총 5년
-- 추가로 counsels 100건 신규 생성
-- church_id: a1b2c3d4-e5f6-7890-abcd-ef1234567890
-- =====================================================================
-- 안전장치:
--   1. 기존 데이터 절대 수정/삭제 안 함 (INSERT only)
--   2. 단일 church_id 스코프 유지
--   3. 트랜잭션 보장
--   4. 중복 확장 방지 (이미 2021년 데이터가 있으면 ABORT)
-- =====================================================================

BEGIN;

DO $$
DECLARE
  v_church_id UUID := 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
  v_existing_2021 INT;
  v_year INT;
  v_month INT;
  v_week INT;
  v_attendance_rate FLOAT;
  v_offering_factor FLOAT;
  v_event_date DATE;
  v_expense_month DATE;
  i INT;
  v_pastor_id UUID;
  v_counsel_types TEXT[] := ARRAY['family','family','family','faith','faith','faith','career','career','health','health','finance','other'];
  v_visit_types TEXT[] := ARRAY['심방','상담','전도','새가족환영','기도','병문안'];
  v_prayer_topics_extended TEXT[] := ARRAY[
    '가정 화목과 부부 관계 회복',
    '자녀 입시 합격',
    '직장 내 신앙 증거',
    '암 투병 회복',
    '사업 정상화와 직원들의 마음',
    '부모님 신앙 결단',
    '우울증 치유',
    '경제적 회복',
    '결혼 상대 만남',
    '시댁 갈등 해결',
    '교회 청년부 부흥',
    '선교지 영혼 구원',
    '교회당 건축 헌금 채움',
    '믿음의 가정 세움',
    '자녀 진로 결정',
    '치매 부모님 돌봄',
    '실직 후 새 직장',
    '건강 회복과 수술 잘 마침',
    '자녀들의 영적 성장',
    '교회 화합과 일치'
  ];
  v_counsel_summaries TEXT[] := ARRAY[
    '부부 관계 갈등 상담. 서로의 입장 이해하고 기도로 회복하기로 결단.',
    '자녀 양육 고민. 청소년기 자녀와의 소통 방법 안내. 추가 상담 필요.',
    '직장 스트레스와 신앙 갈등. 말씀과 기도 시간 회복 권면.',
    '경제적 어려움 호소. 교회 차원의 도움 검토. 비밀 유지 약속.',
    '진로 결정 기로. 하나님의 뜻을 분별하는 기도 시간 권유.',
    '시댁/처가 갈등. 양가 부모님 위한 중보기도 결단.',
    '믿음 회의 시기. 말씀 묵상 일정 함께 세움.',
    '병중 가족 케어 부담. 교회 공동체의 지원 연결.',
    '자녀 입시 스트레스. 부모-자녀 함께 기도하는 시간 약속.',
    '이혼 위기 상담. 부부 동반 상담 약속. 비밀 유지 절대.',
    '직장 내 따돌림. 신앙으로 견디며 지혜롭게 대처 권면.',
    '우울감 호소. 전문 상담 병행 권유. 정기 만남 약속.',
    '재정 회복 계획. 십일조 회복부터 시작하기로 결단.',
    '신앙 성숙 갈망. 제자훈련 참여 안내.',
    '가족 중 불신자 전도. 삶으로 보여주는 신앙 권면.'
  ];
BEGIN
  -- ============================================================
  -- 0. 중복 확장 방지
  -- ============================================================
  SELECT COUNT(*) INTO v_existing_2021
  FROM attendance
  WHERE church_id = v_church_id AND year = 2021;

  IF v_existing_2021 > 0 THEN
    RAISE EXCEPTION '이미 2021년 확장 데이터가 존재합니다. 중복 실행 금지. 필요 시 grace_demo_rollback.sql 후 처음부터 다시 실행하세요.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM churches WHERE id = v_church_id) THEN
    RAISE EXCEPTION '은혜로교회(church_id=%)가 없습니다. 먼저 grace_demo_seed.sql을 실행하세요.', v_church_id;
  END IF;

  IF to_regclass('public.counsels') IS NULL THEN
    RAISE EXCEPTION 'counsels 테이블이 없습니다. 상담 100건 생성을 위해 counsels 테이블을 먼저 준비하세요.';
  END IF;

  SELECT id INTO v_pastor_id
  FROM members
  WHERE church_id = v_church_id AND role = '담임목사'
  LIMIT 1;

  RAISE NOTICE '은혜로교회 5년치 확장 시작';

  -- ============================================================
  -- 1. attendance 확장 - 2021-05 ~ 2024-04 (3년)
  -- ============================================================
  FOR v_event_date IN
    SELECT generate_series(DATE '2021-05-01', DATE '2024-04-30', INTERVAL '1 week')::DATE
  LOOP
    v_year := EXTRACT(YEAR FROM v_event_date)::INT;
    v_week := EXTRACT(WEEK FROM v_event_date)::INT;
    v_attendance_rate := CASE v_year
      WHEN 2021 THEN 0.65
      WHEN 2022 THEN 0.70
      WHEN 2023 THEN 0.75
      ELSE 0.78
    END;

    INSERT INTO attendance (church_id, member_id, week_num, year, status, date, service_type)
    SELECT
      v_church_id,
      m.id,
      v_week,
      v_year,
      CASE
        WHEN r.seed < v_attendance_rate THEN 'p'
        WHEN r.seed < v_attendance_rate + 0.05 THEN 'o'
        WHEN r.seed < 0.97 THEN 'a'
        ELSE 'n'
      END,
      v_event_date,
      '주일예배'
    FROM members m
    CROSS JOIN LATERAL (SELECT random() AS seed WHERE m.id IS NOT NULL) r
    WHERE m.church_id = v_church_id
      AND m.member_status = '활동'
      AND (m.registered_date IS NULL OR m.registered_date::DATE <= v_event_date);
  END LOOP;

  RAISE NOTICE '출석 3년치 확장 완료';

  -- ============================================================
  -- 2. income 확장 - 2021-05 ~ 2024-04
  -- ============================================================
  FOR v_event_date IN
    SELECT generate_series(DATE '2021-05-01', DATE '2024-04-30', INTERVAL '1 week')::DATE
  LOOP
    v_year := EXTRACT(YEAR FROM v_event_date)::INT;
    v_offering_factor := CASE v_year
      WHEN 2021 THEN 0.70
      WHEN 2022 THEN 0.80
      WHEN 2023 THEN 0.90
      ELSE 0.95
    END;

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
        AND (registered_date IS NULL OR registered_date::DATE <= v_event_date)
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
          AND (registered_date IS NULL OR registered_date::DATE <= v_event_date)
        ORDER BY random()
        LIMIT 2
      ) m;
    END IF;
  END LOOP;

  RAISE NOTICE '헌금 3년치 확장 완료';

  -- ============================================================
  -- 3. expense 확장 - 2021-05 ~ 2024-04
  -- ============================================================
  FOR v_expense_month IN
    SELECT generate_series(DATE '2021-05-01', DATE '2024-04-01', INTERVAL '1 month')::DATE
  LOOP
    v_year := EXTRACT(YEAR FROM v_expense_month)::INT;
    v_month := EXTRACT(MONTH FROM v_expense_month)::INT;
    v_offering_factor := CASE v_year
      WHEN 2021 THEN 0.75
      WHEN 2022 THEN 0.82
      WHEN 2023 THEN 0.90
      ELSE 0.95
    END;

    INSERT INTO expense (church_id, date, category, item, amount, payment_method, fiscal_year, month)
    VALUES (
      v_church_id,
      TO_CHAR(v_expense_month + INTERVAL '24 days', 'YYYY-MM-DD'),
      '인건비',
      '교역자 사례비',
      ((8000000 + (random() * 2000000)::BIGINT) * v_offering_factor)::BIGINT,
      '계좌이체',
      v_year::TEXT,
      v_month
    );

    INSERT INTO expense (church_id, date, category, item, amount, payment_method, fiscal_year, month)
    VALUES
      (v_church_id, TO_CHAR(v_expense_month + INTERVAL '9 days', 'YYYY-MM-DD'), '관리비', '전기/수도/가스', ((500000 + (random() * 300000)::BIGINT) * v_offering_factor)::BIGINT, '계좌이체', v_year::TEXT, v_month),
      (v_church_id, TO_CHAR(v_expense_month + INTERVAL '14 days', 'YYYY-MM-DD'), '관리비', '청소/방역', ((200000 + (random() * 100000)::BIGINT) * v_offering_factor)::BIGINT, '계좌이체', v_year::TEXT, v_month),
      (v_church_id, TO_CHAR(v_expense_month + INTERVAL '19 days', 'YYYY-MM-DD'), '사역비', '예배 물품', ((150000 + (random() * 200000)::BIGINT) * v_offering_factor)::BIGINT, '카드', v_year::TEXT, v_month),
      (v_church_id, TO_CHAR(v_expense_month + INTERVAL '27 days', 'YYYY-MM-DD'), '선교비', '국내외 선교사 후원', ((1000000 + (random() * 500000)::BIGINT) * v_offering_factor)::BIGINT, '계좌이체', v_year::TEXT, v_month);
  END LOOP;

  RAISE NOTICE '지출 3년치 확장 완료';

  -- ============================================================
  -- 4. counsels - 100건 신규 (5년 분산)
  -- ============================================================
  FOR i IN 1..100 LOOP
    INSERT INTO counsels (church_id, member_id, type, date, summary, confidential, follow_up_date, follow_up_note, follow_up_done)
    SELECT
      v_church_id,
      m.id,
      v_counsel_types[((i - 1) % array_length(v_counsel_types, 1)) + 1],
      TO_CHAR((DATE '2021-05-01' + ((random() * 1825)::INT * INTERVAL '1 day'))::DATE, 'YYYY-MM-DD'),
      v_counsel_summaries[((i - 1) % array_length(v_counsel_summaries, 1)) + 1],
      (i % 5 = 0),
      CASE WHEN i % 4 = 0 THEN TO_CHAR((DATE '2021-05-01' + (((random() * 1825)::INT + 14) * INTERVAL '1 day'))::DATE, 'YYYY-MM-DD') ELSE NULL END,
      CASE WHEN i % 4 = 0 THEN '추가 상담 필요. 정기 만남 진행 중.' ELSE NULL END,
      (i % 3 = 0)
    FROM members m
    WHERE m.church_id = v_church_id
      AND m.member_status = '활동'
      AND m.dept = '장년부'
    ORDER BY random()
    LIMIT 1;
  END LOOP;

  RAISE NOTICE '상담 100건 생성 완료';

  -- ============================================================
  -- 5. visits 확장 - 추가 200건 (5년 분산)
  -- ============================================================
  FOR i IN 1..200 LOOP
    INSERT INTO visits (church_id, date, member_id, type, content)
    SELECT
      v_church_id,
      TO_CHAR((DATE '2021-05-01' + ((random() * 1825)::INT * INTERVAL '1 day'))::DATE, 'YYYY-MM-DD'),
      m.id,
      v_visit_types[((i - 1) % array_length(v_visit_types, 1)) + 1],
      m.name || ' 가정 ' || v_visit_types[((i - 1) % array_length(v_visit_types, 1)) + 1] || ' 진행. 가정 형편과 신앙 점검. 함께 기도하고 격려.'
    FROM members m
    WHERE m.church_id = v_church_id
      AND m.member_status = '활동'
    ORDER BY random()
    LIMIT 1;
  END LOOP;

  RAISE NOTICE '심방 200건 추가 완료';

  -- ============================================================
  -- 6. notes 확장 - 추가 150건 + 교회 전체 15건
  -- ============================================================
  FOR i IN 1..150 LOOP
    INSERT INTO notes (church_id, member_id, date, type, content, answered, answered_at)
    SELECT
      v_church_id,
      m.id::TEXT,
      TO_CHAR((DATE '2021-05-01' + ((random() * 1825)::INT * INTERVAL '1 day'))::DATE, 'YYYY-MM-DD'),
      CASE i % 4
        WHEN 0 THEN 'memo'
        WHEN 1 THEN 'prayer'
        WHEN 2 THEN 'visit'
        ELSE 'event'
      END,
      v_prayer_topics_extended[((i - 1) % array_length(v_prayer_topics_extended, 1)) + 1],
      (i % 5 = 0),
      CASE WHEN i % 5 = 0 THEN (NOW() - ((random() * 365)::INT || ' days')::INTERVAL)::DATE ELSE NULL END
    FROM members m
    WHERE m.church_id = v_church_id AND m.member_status = '활동'
    ORDER BY random()
    LIMIT 1;
  END LOOP;

  FOR i IN 1..15 LOOP
    INSERT INTO notes (church_id, member_id, date, type, content, answered)
    VALUES (
      v_church_id,
      'church-wide',
      TO_CHAR((DATE '2021-05-01' + ((random() * 1825)::INT * INTERVAL '1 day'))::DATE, 'YYYY-MM-DD'),
      'prayer',
      '[교회 전체] ' || v_prayer_topics_extended[((i + 4) % array_length(v_prayer_topics_extended, 1)) + 1],
      (i % 4 = 0)
    );
  END LOOP;

  RAISE NOTICE '기도/메모 165건 추가 완료';

  -- ============================================================
  -- 7. sermons 확장 - 추가 200건
  -- ============================================================
  FOR i IN 1..200 LOOP
    INSERT INTO sermons (church_id, date, service, bible_text, title, core, status)
    VALUES (
      v_church_id,
      TO_CHAR((DATE '2021-05-01' + (i * 7) * INTERVAL '1 day')::DATE, 'YYYY-MM-DD'),
      CASE i % 3 WHEN 0 THEN '주일 1부 예배' WHEN 1 THEN '주일 2부 예배' ELSE '수요예배' END,
      CASE i % 7
        WHEN 0 THEN '요한복음 ' || (1 + i % 21) || ':' || (1 + i % 30)
        WHEN 1 THEN '시편 ' || (1 + i % 150) || '편'
        WHEN 2 THEN '로마서 ' || (1 + i % 16) || ':' || (1 + i % 30)
        WHEN 3 THEN '마태복음 ' || (1 + i % 28) || ':' || (1 + i % 30)
        WHEN 4 THEN '에베소서 ' || (1 + i % 6) || ':' || (1 + i % 20)
        WHEN 5 THEN '창세기 ' || (1 + i % 50) || ':' || (1 + i % 30)
        ELSE '잠언 ' || (1 + i % 31) || '장'
      END,
      CASE i % 10
        WHEN 0 THEN '하나님의 사랑' WHEN 1 THEN '믿음의 길' WHEN 2 THEN '은혜로 받은 구원'
        WHEN 3 THEN '기도의 능력' WHEN 4 THEN '말씀 위에 서는 삶' WHEN 5 THEN '함께 가는 신앙'
        WHEN 6 THEN '소망의 닻' WHEN 7 THEN '제자의 길' WHEN 8 THEN '섬김의 본'
        ELSE '깨어있는 신앙'
      END,
      '말씀을 통한 변화된 삶과 공동체',
      '완료'
    );
  END LOOP;

  RAISE NOTICE '설교 200건 추가 완료';

  RAISE NOTICE '✅ 은혜로교회 5년치 확장 완료';
END $$;

COMMIT;

-- =====================================================================
-- 검증: 확장 후 카운트
-- =====================================================================
SELECT 'attendance' AS table_name, COUNT(*) AS row_count FROM attendance WHERE church_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
UNION ALL SELECT 'income', COUNT(*) FROM income WHERE church_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
UNION ALL SELECT 'expense', COUNT(*) FROM expense WHERE church_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
UNION ALL SELECT 'counsels', COUNT(*) FROM counsels WHERE church_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
UNION ALL SELECT 'visits', COUNT(*) FROM visits WHERE church_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
UNION ALL SELECT 'notes', COUNT(*) FROM notes WHERE church_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
UNION ALL SELECT 'sermons', COUNT(*) FROM sermons WHERE church_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
ORDER BY table_name;
