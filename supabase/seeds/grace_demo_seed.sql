-- =====================================================================
-- 은혜로교회 데모 시드 (Grace Demo Church Seed)
-- church_id: a1b2c3d4-e5f6-7890-abcd-ef1234567890
-- 기간: 2024-05-01 ~ 2026-04-30 (24개월)
-- 규모: 성도 100명 / 목장 12개 / 교회학교 8부서
-- =====================================================================
-- 안전장치:
--   1. 시작 시 동일 church_id 데이터가 있으면 ABORT (중복 시드 방지)
--   2. 모든 INSERT는 단일 church_id 스코프
--   3. 트랜잭션으로 묶음 (실패 시 자동 롤백)
-- =====================================================================

BEGIN;

DO $$
DECLARE
  v_church_id UUID := 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
  v_church_id_text TEXT := 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
  v_existing INT;
  v_member_id UUID;
  v_org_id UUID;
  v_family_id UUID;
  v_start_date DATE := '2024-05-01';
  v_end_date DATE := '2026-04-30';
  v_event_date DATE;
  v_month DATE;
  v_mokjang_ids UUID[];
  v_child_count INT;
  i INT;
  j INT;
  v_week INT;
  v_year INT;

  v_last_names TEXT[] := ARRAY['김','이','박','최','정','강','조','윤','장','임','한','오','서','신','권','황','안','송','전','홍','문','양','손','배','조'];
  v_first_names_m TEXT[] := ARRAY['민준','서준','도윤','예준','시우','주원','하준','지호','지후','준우','준서','건우','현우','우진','선우','연우','정우','승우','승현','시윤','진우','지원','은우','민재','현준','수호','지훈','동현','성민','재민'];
  v_first_names_f TEXT[] := ARRAY['서연','지우','서윤','지유','하윤','민서','윤서','채원','지민','수아','지아','다은','은서','예은','수빈','소율','예린','지원','시은','다인','시아','유나','연우','채은','지윤','소은','수민','지수','예원','하은'];
  v_school_dept_names TEXT[] := ARRAY['영아부','유치부','유년부','초등부','중등부','고등부','청년부','대학부'];
  v_school_age_ranges TEXT[] := ARRAY['0-3세','4-6세','7-9세','10-12세','13-15세','16-18세','19-24세','25-29세'];
  v_prayer_topics TEXT[] := ARRAY[
    '가정의 평안과 자녀 신앙 성장',
    '직장에서의 신앙 증거와 동료 전도',
    '건강 회복과 치유',
    '경제적 어려움 해결',
    '진로 결정과 지혜',
    '믿음의 성장',
    '교회 부흥과 영혼 구원',
    '부모님 신앙 회복',
    '자녀 결혼 문제',
    '시험 합격',
    '사업 번창과 정직한 운영',
    '새가족 정착',
    '선교사님 보호하심',
    '나라와 민족을 위해'
  ];
  v_visit_types TEXT[] := ARRAY['심방','상담','전도','새가족환영','기도'];
  v_member_statuses TEXT[] := ARRAY['활동','활동','활동','활동','활동','활동','활동','활동','휴적','은퇴'];
  v_pastor_id UUID;
  v_associate_pastor_id UUID;
BEGIN
  -- ============================================================
  -- 0. 중복 시드 방지
  -- ============================================================
  SELECT COUNT(*) INTO v_existing FROM churches WHERE id = v_church_id;
  IF v_existing > 0 THEN
    RAISE EXCEPTION '이미 은혜로교회(church_id=%) 가 존재합니다. 먼저 grace_demo_rollback.sql 을 실행하세요.', v_church_id;
  END IF;

  RAISE NOTICE '은혜로교회 시드 시작: church_id=%', v_church_id;

  -- ============================================================
  -- 1. churches 본체
  -- ============================================================
  INSERT INTO churches (id, name, plan, is_active, created_at)
  VALUES (v_church_id, '은혜로교회', 'pro', true, NOW() - INTERVAL '2 years');

  -- ============================================================
  -- 2. settings
  -- ============================================================
  INSERT INTO settings (church_id, church_name, depts, fiscal_start, address, pastor, denomination)
  VALUES (
    v_church_id,
    '은혜로교회',
    '영아부,유치부,유년부,초등부,중등부,고등부,청년부,대학부',
    '1',
    '서울특별시 강남구 은혜로 100',
    '김은혜',
    '대한예수교장로회(통합)'
  );

  -- ============================================================
  -- 3. members - 핵심 인물 5명
  -- ============================================================
  INSERT INTO members (id, church_id, name, role, gender, birth, phone, address, status, member_status, dept, registered_date, baptism_date, baptism_type, prayer)
  VALUES (gen_random_uuid(), v_church_id, '김은혜', '담임목사', '남', '1968-03-15', '010-1000-0001', '서울 강남구 은혜로 100', '재적', '활동', '장년부', '2010-01-01', '1990-12-25', '세례', '교회 부흥과 성도들의 영적 성장')
  RETURNING id INTO v_pastor_id;

  INSERT INTO members (id, church_id, name, role, gender, birth, phone, address, status, member_status, dept, registered_date, baptism_date, baptism_type, prayer)
  VALUES (gen_random_uuid(), v_church_id, '박소망', '부목사', '남', '1978-07-22', '010-1000-0002', '서울 강남구 소망로 22', '재적', '활동', '장년부', '2015-03-01', '2000-04-16', '세례', '청년사역의 부흥')
  RETURNING id INTO v_associate_pastor_id;

  INSERT INTO members (church_id, name, role, gender, birth, phone, status, member_status, dept, registered_date, prayer)
  VALUES (v_church_id, '이믿음', '교육전도사', '여', '1988-11-10', '010-1000-0003', '재적', '활동', '청년부', '2018-02-01', '청년부 영혼 구원');

  INSERT INTO members (church_id, name, role, gender, birth, phone, status, member_status, dept, registered_date, baptism_date, baptism_type)
  VALUES (v_church_id, '최충성', '장로', '남', '1958-05-30', '010-1000-0004', '재적', '활동', '장년부', '2008-06-01', '1985-09-15', '세례');

  INSERT INTO members (church_id, name, role, gender, birth, phone, status, member_status, dept, registered_date, baptism_date, baptism_type, prayer)
  VALUES (v_church_id, '윤사랑', '권사', '여', '1962-09-08', '010-1000-0005', '재적', '활동', '장년부', '2009-04-01', '1988-05-08', '세례', '자녀들의 신앙 회복');

  -- ============================================================
  -- 4. members - 일반 성도 90명
  --    22가족 85명 + 단신 청년 5명 = 90명
  -- ============================================================
  FOR i IN 1..22 LOOP
    INSERT INTO families (church_id, family_name)
    VALUES (v_church_id, v_last_names[((i - 1) % array_length(v_last_names, 1)) + 1] || '씨 가족 #' || i)
    RETURNING id INTO v_family_id;

    INSERT INTO members (church_id, name, gender, birth, phone, address, status, member_status, dept, family_id, family_relation, registered_date, baptism_type, prayer)
    VALUES (
      v_church_id,
      v_last_names[((i - 1) % array_length(v_last_names, 1)) + 1] || v_first_names_m[((i - 1) % array_length(v_first_names_m, 1)) + 1],
      '남',
      (1965 + (i % 20))::TEXT || '-' || LPAD(((1 + (i % 12))::TEXT), 2, '0') || '-' || LPAD(((1 + (i % 28))::TEXT), 2, '0'),
      '010-' || LPAD((2000 + i)::TEXT, 4, '0') || '-' || LPAD((1000 + i)::TEXT, 4, '0'),
      '서울 강남구 은혜로 ' || (i * 10),
      '재적',
      v_member_statuses[((i - 1) % array_length(v_member_statuses, 1)) + 1],
      '장년부',
      v_family_id,
      '본인',
      ('2015-01-01'::DATE + (i || ' months')::INTERVAL)::DATE,
      CASE WHEN i % 3 = 0 THEN '세례' WHEN i % 3 = 1 THEN '입교' ELSE '유아세례' END,
      CASE WHEN i % 5 = 0 THEN v_prayer_topics[((i - 1) % array_length(v_prayer_topics, 1)) + 1] ELSE NULL END
    );

    INSERT INTO members (church_id, name, gender, birth, phone, address, status, member_status, dept, family_id, family_relation, registered_date, baptism_type, prayer)
    VALUES (
      v_church_id,
      v_last_names[((i + 4) % array_length(v_last_names, 1)) + 1] || v_first_names_f[((i - 1) % array_length(v_first_names_f, 1)) + 1],
      '여',
      (1967 + (i % 20))::TEXT || '-' || LPAD(((1 + ((i + 3) % 12))::TEXT), 2, '0') || '-' || LPAD(((1 + ((i + 5) % 28))::TEXT), 2, '0'),
      '010-' || LPAD((2000 + i)::TEXT, 4, '0') || '-' || LPAD((2000 + i)::TEXT, 4, '0'),
      '서울 강남구 은혜로 ' || (i * 10),
      '재적',
      '활동',
      '장년부',
      v_family_id,
      '배우자',
      ('2015-01-01'::DATE + (i || ' months')::INTERVAL)::DATE,
      '세례',
      CASE WHEN i % 4 = 0 THEN v_prayer_topics[((i - 1) % array_length(v_prayer_topics, 1)) + 1] ELSE NULL END
    );

    v_child_count := CASE WHEN i <= 5 THEN 3 WHEN i <= 14 THEN 2 ELSE 1 END;
    FOR j IN 1..v_child_count LOOP
      INSERT INTO members (church_id, name, gender, birth, phone, address, status, member_status, dept, family_id, family_relation, registered_date)
      VALUES (
        v_church_id,
        v_last_names[((i - 1) % array_length(v_last_names, 1)) + 1] || CASE WHEN j % 2 = 0 THEN v_first_names_f[((i * j - 1) % array_length(v_first_names_f, 1)) + 1] ELSE v_first_names_m[((i * j - 1) % array_length(v_first_names_m, 1)) + 1] END,
        CASE WHEN j % 2 = 0 THEN '여' ELSE '남' END,
        (2005 + (j * 3) + (i % 5))::TEXT || '-' || LPAD(((1 + ((i + j) % 12))::TEXT), 2, '0') || '-' || LPAD(((1 + ((i + j) % 28))::TEXT), 2, '0'),
        NULL,
        '서울 강남구 은혜로 ' || (i * 10),
        '재적',
        '활동',
        CASE
          WHEN 2026 - (2005 + (j * 3) + (i % 5)) < 4 THEN '영아부'
          WHEN 2026 - (2005 + (j * 3) + (i % 5)) < 7 THEN '유치부'
          WHEN 2026 - (2005 + (j * 3) + (i % 5)) < 10 THEN '유년부'
          WHEN 2026 - (2005 + (j * 3) + (i % 5)) < 13 THEN '초등부'
          WHEN 2026 - (2005 + (j * 3) + (i % 5)) < 16 THEN '중등부'
          WHEN 2026 - (2005 + (j * 3) + (i % 5)) < 19 THEN '고등부'
          ELSE '청년부'
        END,
        v_family_id,
        '자녀',
        ('2015-01-01'::DATE + (i || ' months')::INTERVAL)::DATE
      );
    END LOOP;
  END LOOP;

  FOR i IN 1..5 LOOP
    INSERT INTO members (church_id, name, gender, birth, phone, address, status, member_status, dept, registered_date, baptism_type, prayer)
    VALUES (
      v_church_id,
      v_last_names[((i - 1) % array_length(v_last_names, 1)) + 1] || v_first_names_f[((i + 9) % array_length(v_first_names_f, 1)) + 1],
      CASE WHEN i % 2 = 0 THEN '남' ELSE '여' END,
      (1995 + i)::TEXT || '-' || LPAD((1 + i)::TEXT, 2, '0') || '-15',
      '010-3000-' || LPAD((i * 111)::TEXT, 4, '0'),
      '서울 강남구 청년로 ' || (i * 5),
      '재적',
      '활동',
      '청년부',
      ('2020-01-01'::DATE + (i || ' months')::INTERVAL)::DATE,
      CASE WHEN i % 2 = 0 THEN '입교' ELSE '세례' END,
      v_prayer_topics[((i + 4) % array_length(v_prayer_topics, 1)) + 1]
    );
  END LOOP;

  -- ============================================================
  -- 5. new_family_program - 새가족 5명
  -- ============================================================
  FOR i IN 1..5 LOOP
    INSERT INTO members (id, church_id, name, gender, birth, phone, address, status, member_status, dept, registered_date, first_visit_date, is_new_family, visit_path, prayer)
    VALUES (
      gen_random_uuid(),
      v_church_id,
      '새' || v_first_names_f[i] || i,
      CASE WHEN i % 2 = 0 THEN '남' ELSE '여' END,
      (1985 + i * 3)::TEXT || '-' || LPAD((3 + i)::TEXT, 2, '0') || '-' || LPAD((10 + i * 2)::TEXT, 2, '0'),
      '010-9000-' || LPAD((i * 1234)::TEXT, 4, '0'),
      '서울 강남구 새소망로 ' || (i * 7),
      '재적',
      '활동',
      '새가족부',
      (NOW() - ((30 - i * 5) || ' days')::INTERVAL)::DATE,
      (NOW() - ((30 - i * 5) || ' days')::INTERVAL)::DATE,
      true,
      CASE i % 3 WHEN 0 THEN '지인소개' WHEN 1 THEN '전도' ELSE '자진방문' END,
      '신앙의 뿌리를 깊이 내리도록'
    )
    RETURNING id INTO v_member_id;

    INSERT INTO new_family_program (
      church_id, member_id, mentor_id, program_start_date,
      week1_completed, week1_date,
      week2_completed, week2_date,
      week3_completed, week3_date,
      week4_completed, week4_date,
      status, cell_group_assigned
    ) VALUES (
      v_church_id, v_member_id, v_pastor_id,
      (NOW() - ((30 - i * 5) || ' days')::INTERVAL)::DATE,
      i >= 1, CASE WHEN i >= 1 THEN (NOW() - ((23 - i * 5) || ' days')::INTERVAL)::DATE ELSE NULL END,
      i >= 2, CASE WHEN i >= 2 THEN (NOW() - ((16 - i * 5) || ' days')::INTERVAL)::DATE ELSE NULL END,
      i >= 3, CASE WHEN i >= 3 THEN (NOW() - ((9 - i * 5) || ' days')::INTERVAL)::DATE ELSE NULL END,
      i >= 4, CASE WHEN i >= 4 THEN (NOW() - ((2 - i * 5) || ' days')::INTERVAL)::DATE ELSE NULL END,
      CASE WHEN i = 5 THEN '수료' ELSE '진행중' END,
      '제' || (1 + i) || '목장'
    );
  END LOOP;

  RAISE NOTICE '성도 100명 생성 완료';

  -- ============================================================
  -- 6. organizations - 목장 12개
  -- ============================================================
  v_mokjang_ids := ARRAY[]::UUID[];
  FOR i IN 1..12 LOOP
    INSERT INTO organizations (church_id, name, type, leader_name, sort_order, is_active)
    VALUES (
      v_church_id,
      '제' || i || '목장',
      '목장',
      v_last_names[((i - 1) % array_length(v_last_names, 1)) + 1] || v_first_names_m[((i - 1) % array_length(v_first_names_m, 1)) + 1],
      i,
      true
    )
    RETURNING id INTO v_org_id;
    v_mokjang_ids := array_append(v_mokjang_ids, v_org_id);
  END LOOP;

  WITH adult_members AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY name) AS rn
    FROM members
    WHERE church_id = v_church_id
      AND dept = '장년부'
      AND member_status = '활동'
  )
  UPDATE members m
  SET mokjang = '제' || (((am.rn - 1) % 12) + 1) || '목장'
  FROM adult_members am
  WHERE m.id = am.id;

  WITH allocated AS (
    SELECT
      id,
      name,
      ((ROW_NUMBER() OVER (ORDER BY name) - 1)::INT % 12) + 1 AS group_no
    FROM members
    WHERE church_id = v_church_id AND dept = '장년부' AND member_status = '활동'
  ),
  ranked AS (
    SELECT
      id,
      group_no,
      ROW_NUMBER() OVER (PARTITION BY group_no ORDER BY name) AS rn_in_group
    FROM allocated
  )
  INSERT INTO organization_members (church_id, organization_id, member_id, role_in_org, is_active)
  SELECT
    v_church_id,
    v_mokjang_ids[group_no],
    id,
    CASE WHEN rn_in_group = 1 THEN '목자' ELSE '구성원' END,
    true
  FROM ranked;

  RAISE NOTICE '목장 12개 생성 + 배정 완료';

  -- ============================================================
  -- 7. school_departments - 교회학교 8부서
  -- ============================================================
  FOR i IN 1..array_length(v_school_dept_names, 1) LOOP
    INSERT INTO school_departments (church_id, name, age_range, leader_name, sort_order, is_active)
    VALUES (
      v_church_id,
      v_school_dept_names[i],
      v_school_age_ranges[i],
      v_last_names[((i - 1) % array_length(v_last_names, 1)) + 1] || '교사',
      i,
      true
    );
  END LOOP;

  INSERT INTO school_enrollments (church_id, member_id, department_id, role, is_active)
  SELECT
    v_church_id,
    m.id,
    sd.id,
    '학생',
    true
  FROM members m
  JOIN school_departments sd ON sd.church_id = v_church_id AND sd.name = m.dept
  WHERE m.church_id = v_church_id AND m.family_relation = '자녀';

  RAISE NOTICE '교회학교 8부서 + 등록 완료';

  -- ============================================================
  -- 8. attendance - 2년치 주일예배 출석
  -- ============================================================
  FOR v_event_date IN
    SELECT generate_series(v_start_date, v_end_date, INTERVAL '1 week')::DATE
  LOOP
    v_year := EXTRACT(YEAR FROM v_event_date)::INT;
    v_week := EXTRACT(WEEK FROM v_event_date)::INT;

    INSERT INTO attendance (church_id, member_id, week_num, year, status, date, service_type)
    SELECT
      v_church_id,
      m.id,
      v_week,
      v_year,
      CASE
        WHEN r.seed < 0.80 THEN 'p'
        WHEN r.seed < 0.85 THEN 'o'
        WHEN r.seed < 0.97 THEN 'a'
        ELSE 'n'
      END,
      v_event_date,
      '주일예배'
    FROM members m
    CROSS JOIN LATERAL (SELECT random() AS seed WHERE m.id IS NOT NULL) r
    WHERE m.church_id = v_church_id
      AND m.member_status = '활동';
  END LOOP;

  RAISE NOTICE '출석 2년치 생성 완료';

  -- ============================================================
  -- 9. income - 2년치 헌금
  -- ============================================================
  FOR v_event_date IN
    SELECT generate_series(v_start_date, v_end_date, INTERVAL '1 week')::DATE
  LOOP
    v_year := EXTRACT(YEAR FROM v_event_date)::INT;

    INSERT INTO income (church_id, date, type, amount, payment_method, fiscal_year, month)
    VALUES (
      v_church_id,
      TO_CHAR(v_event_date, 'YYYY-MM-DD'),
      '주일헌금',
      (300000 + (random() * 500000)::BIGINT),
      '현금',
      v_year::TEXT,
      EXTRACT(MONTH FROM v_event_date)::INT
    );

    INSERT INTO income (church_id, date, type, amount, donor, member_id, payment_method, fiscal_year, month)
    SELECT
      v_church_id,
      TO_CHAR(v_event_date, 'YYYY-MM-DD'),
      '십일조',
      (200000 + (random() * 800000)::BIGINT),
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
        (100000 + (random() * 300000)::BIGINT),
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

  RAISE NOTICE '헌금 2년치 생성 완료';

  -- ============================================================
  -- 10. expense - 2년치 월별 지출
  -- ============================================================
  FOR v_month IN
    SELECT generate_series(date_trunc('month', v_start_date)::DATE, date_trunc('month', v_end_date)::DATE, INTERVAL '1 month')::DATE
  LOOP
    v_year := EXTRACT(YEAR FROM v_month)::INT;
    i := EXTRACT(MONTH FROM v_month)::INT;

    INSERT INTO expense (church_id, date, category, item, amount, payment_method, fiscal_year, month, memo)
    VALUES (
      v_church_id,
      TO_CHAR(v_month + INTERVAL '24 days', 'YYYY-MM-DD'),
      '인건비',
      '교역자 사례비',
      8000000 + (random() * 2000000)::BIGINT,
      '계좌이체',
      v_year::TEXT,
      i,
      v_year || '년 ' || i || '월 사례비'
    );

    INSERT INTO expense (church_id, date, category, item, amount, payment_method, fiscal_year, month)
    VALUES
      (v_church_id, TO_CHAR(v_month + INTERVAL '9 days', 'YYYY-MM-DD'), '관리비', '전기/수도/가스', 500000 + (random() * 300000)::BIGINT, '계좌이체', v_year::TEXT, i),
      (v_church_id, TO_CHAR(v_month + INTERVAL '14 days', 'YYYY-MM-DD'), '관리비', '청소/방역', 200000 + (random() * 100000)::BIGINT, '계좌이체', v_year::TEXT, i),
      (v_church_id, TO_CHAR(v_month + INTERVAL '19 days', 'YYYY-MM-DD'), '사역비', '예배 물품', 150000 + (random() * 200000)::BIGINT, '카드', v_year::TEXT, i),
      (v_church_id, TO_CHAR(v_month + INTERVAL '27 days', 'YYYY-MM-DD'), '선교비', '국내외 선교사 후원', 1000000 + (random() * 500000)::BIGINT, '계좌이체', v_year::TEXT, i);
  END LOOP;

  RAISE NOTICE '지출 2년치 생성 완료';

  -- ============================================================
  -- 11. notes - 기도제목/메모 55건
  -- ============================================================
  FOR i IN 1..50 LOOP
    INSERT INTO notes (church_id, member_id, date, type, content, answered, answered_at)
    SELECT
      v_church_id,
      m.id::TEXT,
      TO_CHAR(NOW() - (i || ' days')::INTERVAL, 'YYYY-MM-DD'),
      CASE WHEN i % 3 = 0 THEN 'memo' WHEN i % 3 = 1 THEN 'prayer' ELSE 'visit' END,
      v_prayer_topics[((i - 1) % array_length(v_prayer_topics, 1)) + 1],
      CASE WHEN i % 7 = 0 THEN true ELSE false END,
      CASE WHEN i % 7 = 0 THEN (NOW() - ((i - 2) || ' days')::INTERVAL)::DATE ELSE NULL END
    FROM members m
    WHERE m.church_id = v_church_id AND m.member_status = '활동'
    ORDER BY random()
    LIMIT 1;
  END LOOP;

  FOR i IN 1..5 LOOP
    INSERT INTO notes (church_id, member_id, date, type, content, answered)
    VALUES (
      v_church_id,
      'church-wide',
      TO_CHAR(NOW() - (i * 7 || ' days')::INTERVAL, 'YYYY-MM-DD'),
      'prayer',
      '[교회 전체] ' || v_prayer_topics[((i + 9) % array_length(v_prayer_topics, 1)) + 1],
      false
    );
  END LOOP;

  RAISE NOTICE '기도/메모 55건 생성 완료';

  -- ============================================================
  -- 12. visits - 심방 30건
  -- ============================================================
  FOR i IN 1..30 LOOP
    INSERT INTO visits (church_id, date, member_id, type, content)
    SELECT
      v_church_id,
      TO_CHAR(NOW() - (i * 3 || ' days')::INTERVAL, 'YYYY-MM-DD'),
      m.id,
      v_visit_types[((i - 1) % array_length(v_visit_types, 1)) + 1],
      m.name || ' 가정 ' || v_visit_types[((i - 1) % array_length(v_visit_types, 1)) + 1] || ' 진행 - 말씀 나눔과 기도'
    FROM members m
    WHERE m.church_id = v_church_id AND m.dept = '장년부' AND m.member_status = '활동'
    ORDER BY random()
    LIMIT 1;
  END LOOP;

  RAISE NOTICE '심방 30건 생성 완료';

  -- ============================================================
  -- 13. plans - 교역자 일정 60건
  -- ============================================================
  FOR i IN 1..60 LOOP
    INSERT INTO plans (church_id, title, date, time, cat, memo)
    VALUES (
      v_church_id,
      CASE i % 6
        WHEN 0 THEN '교역자 회의'
        WHEN 1 THEN '제직회'
        WHEN 2 THEN '심방 일정'
        WHEN 3 THEN '설교 준비'
        WHEN 4 THEN '청년부 모임'
        ELSE '특별 새벽기도회'
      END,
      TO_CHAR(NOW() + ((i - 30) || ' days')::INTERVAL, 'YYYY-MM-DD'),
      CASE i % 4 WHEN 0 THEN '06:00' WHEN 1 THEN '10:00' WHEN 2 THEN '14:00' ELSE '19:30' END,
      CASE i % 3 WHEN 0 THEN '회의' WHEN 1 THEN '사역' ELSE '교육' END,
      '담임목사 + 부목사 참석'
    );
  END LOOP;

  -- ============================================================
  -- 14. sermons - 설교 40건
  -- ============================================================
  FOR i IN 1..40 LOOP
    INSERT INTO sermons (church_id, date, service, bible_text, title, core, status)
    VALUES (
      v_church_id,
      TO_CHAR(NOW() - (i * 7 || ' days')::INTERVAL, 'YYYY-MM-DD'),
      '주일 1부 예배',
      CASE i % 5
        WHEN 0 THEN '요한복음 ' || (1 + i % 21) || ':' || (1 + i % 30)
        WHEN 1 THEN '시편 ' || (1 + i % 150) || '편'
        WHEN 2 THEN '로마서 ' || (1 + i % 16) || ':' || (1 + i % 30)
        WHEN 3 THEN '마태복음 ' || (1 + i % 28) || ':' || (1 + i % 30)
        ELSE '에베소서 ' || (1 + i % 6) || ':' || (1 + i % 20)
      END,
      CASE i % 6
        WHEN 0 THEN '하나님의 사랑'
        WHEN 1 THEN '믿음의 길'
        WHEN 2 THEN '은혜로 받은 구원'
        WHEN 3 THEN '기도의 능력'
        WHEN 4 THEN '말씀 위에 서는 삶'
        ELSE '함께 가는 신앙'
      END,
      '말씀을 통한 변화된 삶',
      CASE
        WHEN i <= 5 THEN '구상중'
        WHEN i <= 10 THEN '본문연구'
        WHEN i <= 15 THEN '초고작성'
        ELSE '완료'
      END
    );
  END LOOP;

  RAISE NOTICE '설교/일정 생성 완료';

  -- ============================================================
  -- 15. budget - 2025년 예산
  -- ============================================================
  INSERT INTO budget (church_id, fiscal_year, category_type, category, monthly_amounts, annual_total)
  VALUES
    (v_church_id, '2025', '수입', '주일헌금', '{"1":15000000,"2":15000000,"3":15000000,"4":15000000,"5":15000000,"6":15000000,"7":15000000,"8":15000000,"9":15000000,"10":15000000,"11":15000000,"12":18000000}'::jsonb, 198000000),
    (v_church_id, '2025', '수입', '십일조', '{"1":30000000,"2":30000000,"3":30000000,"4":30000000,"5":30000000,"6":30000000,"7":30000000,"8":30000000,"9":30000000,"10":30000000,"11":30000000,"12":35000000}'::jsonb, 395000000),
    (v_church_id, '2025', '지출', '인건비', '{"1":9000000,"2":9000000,"3":9000000,"4":9000000,"5":9000000,"6":9000000,"7":9000000,"8":9000000,"9":9000000,"10":9000000,"11":9000000,"12":13000000}'::jsonb, 112000000),
    (v_church_id, '2025', '지출', '선교비', '{"1":1500000,"2":1500000,"3":1500000,"4":1500000,"5":1500000,"6":1500000,"7":1500000,"8":1500000,"9":1500000,"10":1500000,"11":1500000,"12":2000000}'::jsonb, 18500000);

  RAISE NOTICE '예산 생성 완료';

  -- ============================================================
  -- 16. Church Planner public tables - 장소/부서/행사
  -- ============================================================
  IF to_regclass('public.departments') IS NOT NULL THEN
    INSERT INTO departments (church_id, name, color, icon, sort_order, is_active)
    VALUES
      (v_church_id_text, '담임목사실', '#1B2A4A', 'cross', 0, true),
      (v_church_id_text, '교육부', '#4A90D9', 'book', 1, true),
      (v_church_id_text, '청년부', '#6C5CE7', 'users', 2, true),
      (v_church_id_text, '찬양팀', '#A855F7', 'music', 3, true),
      (v_church_id_text, '선교부', '#22C55E', 'globe', 4, true),
      (v_church_id_text, '봉사부', '#F59E0B', 'heart', 5, true);
  END IF;

  IF to_regclass('public.places') IS NOT NULL THEN
    INSERT INTO places (church_id, name, capacity, equipment, sort_order, is_active)
    VALUES
      (v_church_id_text, '본당', 500, ARRAY['빔프로젝터','음향','영상'], 0, true),
      (v_church_id_text, '소예배실', 80, ARRAY['빔프로젝터','음향'], 1, true),
      (v_church_id_text, '교육관 1층', 60, ARRAY['빔프로젝터'], 2, true),
      (v_church_id_text, '친교실', 100, ARRAY[]::TEXT[], 3, true);
  END IF;

  IF to_regclass('public.events') IS NOT NULL THEN
    FOR i IN 1..24 LOOP
      INSERT INTO events (church_id, title, event_type, start_date, start_time, is_all_day, description, expected_people, is_public)
      VALUES (
        v_church_id_text,
        CASE i % 6
          WHEN 0 THEN '월삭 새벽기도회'
          WHEN 1 THEN '제직 헌신예배'
          WHEN 2 THEN '청년부 금요모임'
          WHEN 3 THEN '목장 리더 모임'
          WHEN 4 THEN '새가족 환영회'
          ELSE '교회학교 교사 기도회'
        END,
        'event',
        (DATE '2025-01-01' + (i * 14)),
        (CASE i % 3 WHEN 0 THEN '06:00' WHEN 1 THEN '14:00' ELSE '19:30' END)::time,
        false,
        '은혜로교회 데모 일정',
        20 + (i * 3),
        true
      );
    END LOOP;
  END IF;

  RAISE NOTICE '✅ 은혜로교회 시드 완료. church_id = %', v_church_id;
END $$;

COMMIT;

-- =====================================================================
-- 검증: 생성된 데이터 카운트
-- =====================================================================
SELECT '=== 은혜로교회 시드 결과 ===' AS info;
SELECT 'members' AS table_name, COUNT(*) AS row_count FROM members WHERE church_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
UNION ALL SELECT 'organizations', COUNT(*) FROM organizations WHERE church_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
UNION ALL SELECT 'organization_members', COUNT(*) FROM organization_members WHERE church_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
UNION ALL SELECT 'school_departments', COUNT(*) FROM school_departments WHERE church_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
UNION ALL SELECT 'school_enrollments', COUNT(*) FROM school_enrollments WHERE church_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
UNION ALL SELECT 'attendance', COUNT(*) FROM attendance WHERE church_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
UNION ALL SELECT 'income', COUNT(*) FROM income WHERE church_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
UNION ALL SELECT 'expense', COUNT(*) FROM expense WHERE church_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
UNION ALL SELECT 'notes', COUNT(*) FROM notes WHERE church_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
UNION ALL SELECT 'visits', COUNT(*) FROM visits WHERE church_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
UNION ALL SELECT 'plans', COUNT(*) FROM plans WHERE church_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
UNION ALL SELECT 'sermons', COUNT(*) FROM sermons WHERE church_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
UNION ALL SELECT 'new_family_program', COUNT(*) FROM new_family_program WHERE church_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
UNION ALL SELECT 'families', COUNT(*) FROM families WHERE church_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
UNION ALL SELECT 'budget', COUNT(*) FROM budget WHERE church_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
ORDER BY table_name;
