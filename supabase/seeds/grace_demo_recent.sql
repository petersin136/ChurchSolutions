-- =====================================================================
-- 은혜로교회 데모 — 최근(2026-04~05) visits/counsels/notes/income/expense 보충
-- church_id: a1b2c3d4-e5f6-7890-abcd-ef1234567890
-- =====================================================================
-- 목적: 심방·상담 대시보드 "이번 달", 후속 조치, 재정 등이 2026년 4~5월 기준으로 보이도록 보충
-- 규칙: INSERT only (행 UPDATE/DELETE 없음). 다른 교회 데이터 미사용.
-- 실행: Supabase SQL Editor에서 전체 선택 후 Run
-- =====================================================================

BEGIN;

DO $$
DECLARE
  v_church_id UUID := 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
  v_guard INT;
  v_has_visit_status BOOLEAN;
  v_has_visit_time BOOLEAN;
  v_has_visit_location BOOLEAN;
  v_visit_types TEXT[] := ARRAY['routine', 'sick', 'celebration', 'regular'];
  v_counsel_types TEXT[] := ARRAY['family', 'faith', 'career', 'health', 'finance', 'other'];
  v_counsel_summaries TEXT[] := ARRAY[
    '가정 예배 회복과 자녀 양육. 다음 달까지 말씀 묵상 계획 수립.',
    '직장 내 신앙 표현 고민. 선한 영향력과 경계선에 대해 나눔.',
    '부모님 간병 피로 호소. 교회 지원 연결 및 기도 약속.',
    '진로 결정 앞둔 청년. 하나님 뜻 구하는 기도 시간 권유.',
    '부부 갈등 상담. 대화 규칙과 화해의 기도 함께.',
    '재정 어려움. 십일조 회복과 예산 정리 안내.',
    '우울감 호소. 전문 상담 병행 및 정기 만남.',
    '새가족 적응. 목장 연결과 예배 참석 독려.'
  ];
  v_prayer_topics TEXT[] := ARRAY[
    '가정의 화목과 건강',
    '직장에서의 지혜와 평안',
    '자녀들의 신앙과 진로',
    '부모님 건강 회복',
    '선교와 구제 사역의 열매',
    '부부 관계 회복',
    '경제적 책임과 나눔',
    '청년부 부흥과 새가족 정착',
    '수술과 치료 과정의 은혜',
    '이웃 사랑 실천의 용기'
  ];
  i INT;
  v_d DATE;
  v_date TEXT;
  v_status TEXT;
  v_mid UUID;
  v_mname TEXT;
  v_note_member TEXT;
  v_type TEXT;
  v_time TEXT;
  v_loc TEXT;
  v_content TEXT;
BEGIN
  -- ============================================================
  -- 0. 중복 실행 방지 (2026-05-01 이후 심방이 이미 30건 이상이면 중단)
  -- ============================================================
  SELECT COUNT(*)::INT INTO v_guard
  FROM visits
  WHERE church_id = v_church_id
    AND date IS NOT NULL
    AND date >= '2026-05-01';

  IF v_guard >= 30 THEN
    RAISE EXCEPTION 'grace_demo_recent: 2026-05-01 이후 visits가 이미 %건입니다. 중복 실행을 중단합니다.', v_guard;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM churches WHERE id = v_church_id) THEN
    RAISE EXCEPTION '은혜로교회(church_id=%)가 없습니다. 먼저 grace_demo_seed.sql을 실행하세요.', v_church_id;
  END IF;

  IF to_regclass('public.counsels') IS NULL THEN
    RAISE EXCEPTION 'counsels 테이블이 없습니다.';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'visits' AND column_name = 'status'
  ) INTO v_has_visit_status;
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'visits' AND column_name = 'time'
  ) INTO v_has_visit_time;
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'visits' AND column_name = 'location'
  ) INTO v_has_visit_location;

  RAISE NOTICE 'grace_demo_recent: visits optional columns status=%, time=%, location=%',
    v_has_visit_status, v_has_visit_time, v_has_visit_location;

  -- ============================================================
  -- 1. visits — 60건 (2026-04-01 ~ 2026-05-30, 하루 1건 연속)
  -- ============================================================
  FOR i IN 1..60 LOOP
    v_d := DATE '2026-04-01' + (i - 1);
    v_date := TO_CHAR(v_d, 'YYYY-MM-DD');
    v_type := v_visit_types[((i - 1) % array_length(v_visit_types, 1)) + 1];

    v_status := CASE
      WHEN v_d >= DATE '2026-05-20' THEN 'scheduled'
      WHEN (i % 20) IN (0, 1, 2, 3, 4, 5) THEN 'scheduled'
      WHEN (i % 20) BETWEEN 6 AND 17 THEN 'completed'
      WHEN (i % 20) = 18 THEN 'pending'
      ELSE 'cancelled'
    END;

    v_time := to_char(9 + (i % 8), 'FM00') || ':00';
    v_loc := (ARRAY['자택', '교회 면담실', '카페'])[((i - 1) % 3) + 1];

    SELECT m.id, COALESCE(m.name, '(이름없음)') INTO v_mid, v_mname
    FROM members m
    WHERE m.church_id = v_church_id
      AND m.member_status = '활동'
    ORDER BY random()
    LIMIT 1;

    v_content := v_mname || ' 가정 심방(2026 Q2 보충). 유형: ' || v_type || '. 말씀 나눔·기도·돌봄 필요 사항 점검.';

    IF v_has_visit_status AND v_has_visit_time AND v_has_visit_location THEN
      INSERT INTO visits (church_id, date, member_id, type, content, status, time, location)
      VALUES (v_church_id, v_date, v_mid, v_type, v_content, v_status, v_time, v_loc);
    ELSIF v_has_visit_status THEN
      INSERT INTO visits (church_id, date, member_id, type, content, status)
      VALUES (v_church_id, v_date, v_mid, v_type, v_content, v_status);
    ELSE
      INSERT INTO visits (church_id, date, member_id, type, content)
      VALUES (v_church_id, v_date, v_mid, v_type, v_content);
    END IF;
  END LOOP;

  RAISE NOTICE 'grace_demo_recent: visits 60건 삽입 완료';

  -- ============================================================
  -- 2. counsels — 30건 (2026-04-01 ~ 2026-05-30 분산)
  -- ============================================================
  FOR i IN 1..30 LOOP
    v_d := DATE '2026-04-01' + LEAST((FLOOR(((i - 1)::NUMERIC * 60) / 29))::INT, 60);
    v_date := TO_CHAR(v_d, 'YYYY-MM-DD');

    SELECT m.id INTO v_mid
    FROM members m
    WHERE m.church_id = v_church_id
      AND m.member_status = '활동'
    ORDER BY random()
    LIMIT 1;

    INSERT INTO counsels (
      church_id, member_id, type, date, summary, confidential,
      follow_up_date, follow_up_note, follow_up_done
    )
    VALUES (
      v_church_id,
      v_mid,
      v_counsel_types[((i - 1) % array_length(v_counsel_types, 1)) + 1],
      v_date,
      v_counsel_summaries[((i - 1) % array_length(v_counsel_summaries, 1)) + 1],
      (i % 5 = 0),
      CASE WHEN i % 3 = 0 THEN TO_CHAR(v_d + 14, 'YYYY-MM-DD') ELSE NULL END,
      CASE WHEN i % 3 = 0 THEN '다음 상담 시 진행 상황 확인' ELSE NULL END,
      (i % 10 < 3)
    );
  END LOOP;

  RAISE NOTICE 'grace_demo_recent: counsels 30건 삽입 완료';

  -- ============================================================
  -- 3. notes — 기도 25건 (type=prayer, answered 5건 true)
  -- ============================================================
  FOR i IN 1..25 LOOP
    v_d := DATE '2026-04-01' + LEAST((FLOOR(((i - 1)::NUMERIC * 60) / 24))::INT, 60);
    v_date := TO_CHAR(v_d, 'YYYY-MM-DD');

    SELECT m.id::TEXT INTO v_note_member
    FROM members m
    WHERE m.church_id = v_church_id
      AND m.member_status = '활동'
    ORDER BY random()
    LIMIT 1;

    IF i <= 5 THEN
      INSERT INTO notes (church_id, member_id, date, type, content, answered, answered_at)
      VALUES (
        v_church_id,
        v_note_member,
        v_date,
        'prayer',
        '[2026 Q2 보충] ' || v_prayer_topics[((i - 1) % array_length(v_prayer_topics, 1)) + 1],
        true,
        (v_d + 3)::DATE
      );
    ELSE
      INSERT INTO notes (church_id, member_id, date, type, content, answered)
      VALUES (
        v_church_id,
        v_note_member,
        v_date,
        'prayer',
        '[2026 Q2 보충] ' || v_prayer_topics[((i - 1) % array_length(v_prayer_topics, 1)) + 1],
        false
      );
    END IF;
  END LOOP;

  RAISE NOTICE 'grace_demo_recent: notes(prayer) 25건 삽입 완료';

  -- ============================================================
  -- 4. income — 2026년 5월만 (주일헌금 8회 + 십일조 5회)
  -- ============================================================
  INSERT INTO income (church_id, date, type, amount, payment_method, fiscal_year, month)
  VALUES
    (v_church_id, '2026-05-03', '주일헌금', (380000 + (random() * 520000)::BIGINT), '현금', '2026', 5),
    (v_church_id, '2026-05-07', '주일헌금', (400000 + (random() * 480000)::BIGINT), '계좌이체', '2026', 5),
    (v_church_id, '2026-05-10', '주일헌금', (390000 + (random() * 510000)::BIGINT), '현금', '2026', 5),
    (v_church_id, '2026-05-14', '주일헌금', (410000 + (random() * 490000)::BIGINT), '카드', '2026', 5),
    (v_church_id, '2026-05-17', '주일헌금', (395000 + (random() * 505000)::BIGINT), '현금', '2026', 5),
    (v_church_id, '2026-05-21', '주일헌금', (420000 + (random() * 460000)::BIGINT), '계좌이체', '2026', 5),
    (v_church_id, '2026-05-24', '주일헌금', (385000 + (random() * 530000)::BIGINT), '현금', '2026', 5),
    (v_church_id, '2026-05-28', '주일헌금', (405000 + (random() * 495000)::BIGINT), '계좌이체', '2026', 5);

  INSERT INTO income (church_id, date, type, amount, donor, member_id, payment_method, fiscal_year, month)
  SELECT
    v_church_id,
    s.d,
    '십일조',
    (220000 + (random() * 780000)::BIGINT),
    m.name,
    m.id,
    CASE WHEN random() < 0.65 THEN '계좌이체' ELSE '현금' END,
    '2026',
    5
  FROM (
    VALUES
      ('2026-05-03'::TEXT),
      ('2026-05-10'::TEXT),
      ('2026-05-17'::TEXT),
      ('2026-05-24'::TEXT),
      ('2026-05-31'::TEXT)
  ) AS s(d)
  CROSS JOIN LATERAL (
    SELECT id, name
    FROM members
    WHERE church_id = v_church_id
      AND member_status = '활동'
    ORDER BY random()
    LIMIT 1
  ) m;

  RAISE NOTICE 'grace_demo_recent: income(2026-05) 주일헌금 8 + 십일조 5 삽입 완료';

  -- ============================================================
  -- 5. expense — 2026년 5월 4건
  -- ============================================================
  INSERT INTO expense (church_id, date, category, item, amount, payment_method, fiscal_year, month)
  VALUES
    (v_church_id, '2026-05-05', '인건비', '교역자 사례비(5월)', 8200000 + (random() * 1800000)::BIGINT, '계좌이체', '2026', 5),
    (v_church_id, '2026-05-12', '관리비', '전기/수도/가스(5월)', 520000 + (random() * 280000)::BIGINT, '계좌이체', '2026', 5),
    (v_church_id, '2026-05-19', '사역비', '예배 물품·인쇄(5월)', 180000 + (random() * 220000)::BIGINT, '카드', '2026', 5),
    (v_church_id, '2026-05-26', '선교비', '국내외 선교사 후원(5월)', 1100000 + (random() * 480000)::BIGINT, '계좌이체', '2026', 5);

  RAISE NOTICE 'grace_demo_recent: expense(2026-05) 4건 삽입 완료';
  RAISE NOTICE '✅ grace_demo_recent 완료';
END $$;

COMMIT;

-- =====================================================================
-- 검증: 2026-04-01 ~ 2026-05-31 기간 카운트
-- =====================================================================
SELECT 'visits_2026_04_05' AS slice,
  COUNT(*) AS cnt
FROM visits
WHERE church_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
  AND date >= '2026-04-01'
  AND date <= '2026-05-31'
UNION ALL
SELECT 'counsels_2026_04_05', COUNT(*)
FROM counsels
WHERE church_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
  AND date >= '2026-04-01'
  AND date <= '2026-05-31'
UNION ALL
SELECT 'notes_prayer_2026_04_05', COUNT(*)
FROM notes
WHERE church_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
  AND type = 'prayer'
  AND date >= '2026-04-01'
  AND date <= '2026-05-31'
UNION ALL
SELECT 'income_2026_04_05', COUNT(*)
FROM income
WHERE church_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
  AND date >= '2026-04-01'
  AND date <= '2026-05-31'
UNION ALL
SELECT 'expense_2026_04_05', COUNT(*)
FROM expense
WHERE church_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
  AND date >= '2026-04-01'
  AND date <= '2026-05-31'
ORDER BY slice;
