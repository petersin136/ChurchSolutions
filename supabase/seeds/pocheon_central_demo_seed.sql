-- =====================================================================
-- 포천중앙침례교회 데모 시드 (Pocheon Central Demo Church Seed)
-- =====================================================================
-- 목적   : 영업·시연용 풀세트 데이터 (성도 100명 + 직분 분포 + 1~2년치 사역/재정/일정)
-- 대상   : 사용자가 앱에서 이미 만들어 둔 "포천중앙침례교회" (churches.name LIKE '%포천%중앙%')
-- 규모   :
--   · 성도 100명 (장년 54 / 청년 18 / 학생 13 / 주일학교 15)
--   · 교역자 5명 (담임목사 1 + 부목사 1 + 전도사 3)
--   · 직분자 24명 (장로 4 + 안수집사 6 + 권사 12 + 집사 22)
--   · 가족 14가족 + 단신 30+ 명
--   · 새가족 정착 7명 (진행중 4 + 수료 3)
-- 데이터 :
--   · 출석 2년치 (2024-05 ~ 2026-05)
--   · 헌금/지출 2년치 + 2025·2026 예산
--   · 기도제목 60건 / 심방 35건 / 상담 25건
--   · 플래너 일정 24건 + 부서 6개 + 장소 4개
--   · 설교 50건 / 교역자 일정 80건
-- 안전장치:
--   1. 시작 시 "포천중앙" 교회가 없으면 ABORT
--   2. 이미 멤버 30명 이상이면 ABORT (rollback 안내)
--   3. 모든 INSERT는 단일 church_id 스코프, 트랜잭션 자동 롤백
-- =====================================================================

BEGIN;

DO $$
DECLARE
  v_church_id        UUID;
  v_church_name      TEXT := '포천중앙침례교회';
  v_existing         INT;

  v_pastor_id        UUID;
  v_assoc_pastor_id  UUID;
  v_evang1_id        UUID;
  v_evang2_id        UUID;
  v_evang3_id        UUID;
  v_family_id        UUID;
  v_member_id        UUID;
  v_org_id           UUID;
  v_mokjang_ids      UUID[];
  v_event_date       DATE;
  v_month            DATE;
  v_year             INT;
  v_week             INT;
  v_child_count      INT;
  i                  INT;
  j                  INT;

  v_start_date       DATE := '2024-05-01';
  v_end_date         DATE := '2026-05-31';

  -- 이름 풀
  v_last_names       TEXT[] := ARRAY['김','이','박','최','정','강','조','윤','장','임','한','오','서','신','권','황','안','송','전','홍','문','양','손','배','노','심','유','진','차'];
  v_first_m          TEXT[] := ARRAY['민준','서준','도윤','예준','시우','주원','하준','지호','지후','준우','준서','건우','현우','우진','선우','연우','정우','승우','승현','시윤','진우','지원','은우','민재','현준','수호','지훈','동현','성민','재민'];
  v_first_f          TEXT[] := ARRAY['서연','지우','서윤','지유','하윤','민서','윤서','채원','지민','수아','지아','다은','은서','예은','수빈','소율','예린','지원','시은','다인','시아','유나','연우','채은','지윤','소은','수민','지수','예원','하은'];
  v_first_senior_m   TEXT[] := ARRAY['충성','믿음','순종','의로','거룩','진실','정직','은혜','복희','경건','평강','소망'];
  v_first_senior_f   TEXT[] := ARRAY['은혜','순영','정자','복희','경옥','명자','순자','애숙','선희','정숙','옥자','경자','영자','금자','말순','순례','정순','명숙','경숙','애란'];

  v_member_statuses  TEXT[] := ARRAY['활동','활동','활동','활동','활동','활동','활동','활동','활동','휴적'];

  v_school_dept_names  TEXT[] := ARRAY['영아부','유치부','유년부','초등부','중등부','고등부','청년부','대학부'];
  v_school_age_ranges  TEXT[] := ARRAY['0-3세','4-6세','7-9세','10-12세','13-15세','16-18세','19-24세','25-29세'];

  v_prayer_topics    TEXT[] := ARRAY[
    '가정의 평안과 자녀들의 신앙 성장',
    '직장에서의 신앙 증거와 동료 전도',
    '어머니 무릎 수술 후 회복',
    '아버지 당뇨 관리와 건강',
    '큰아이 대학 진학과 진로 결정',
    '둘째 아이 학교 적응과 친구 관계',
    '사업 안정과 정직한 운영',
    '경제적 어려움 가운데 주님의 공급',
    '교회 부흥과 영혼 구원',
    '아내(남편)의 신앙 회복',
    '부모님의 영적 갈증과 회심',
    '자녀의 결혼 배우자 만남',
    '시험 합격과 평안',
    '이사 후 새 동네 적응',
    '교회 봉사에 헌신할 수 있는 마음',
    '말씀 묵상의 즐거움 회복',
    '새벽기도 헌신',
    '담임목사님과 교역자들 위해',
    '선교사님들의 영적·신체적 보호',
    '청년부 부흥과 새가족 정착',
    '주일학교 교사들의 사명감',
    '나라와 민족, 통일 한국 위해',
    '환난 가운데 있는 형제·자매를 위해',
    '회복이 더딘 영혼의 치유',
    '다음 세대 교회 출석의 회복',
    '결혼 30주년 감사와 노년 사역',
    '암 수술 후 회복기 평안',
    '취업 인터뷰 지혜와 평안',
    '부부 대화 회복과 화해',
    '교회 청년부 캠프 헌신'
  ];

  v_visit_types      TEXT[] := ARRAY['routine','sick','celebration','newfamily','prayer'];
  v_visit_contents   TEXT[] := ARRAY[
    '말씀 나눔과 가정의 기도제목 점검. 시편 23편 함께 묵상.',
    '병원 심방. 수술 후 회복 기도와 위로.',
    '결혼 축하 심방. 신혼 가정 축복 기도와 권면.',
    '새가족 환영 심방. 정착 정착반 및 목장 안내.',
    '돌잔치 가정 방문. 자녀 양육을 위한 권면과 기도.',
    '이사 후 새 가정 환영 방문. 가정 예배 권면.',
    '경제적 어려움 듣고 함께 기도. 십일조 회복 권면.',
    '자녀 진로 고민 상담 동반. 함께 기도.',
    '부모님 별세 후 위로 심방. 함께 슬픔 나눔.',
    '교회 봉사 권면 심방. 사역에 동참 권유.',
    '장기 결석 성도 심방. 영적 회복 권면.',
    '병환 중 가정 위로 심방. 시편 묵상과 기도.'
  ];

  v_counsel_types    TEXT[] := ARRAY['family','faith','career','health','finance','other'];
  v_counsel_summaries TEXT[] := ARRAY[
    '부부 갈등 상담. 대화 방식 회복과 화해의 기도 시간 함께함.',
    '자녀 양육 고민. 신앙 가정의 본을 위한 권면.',
    '직장 내 신앙 표현의 경계. 선한 영향력 권면.',
    '진로 결정 앞둔 청년. 하나님 뜻 구하는 기도 동반.',
    '부모 간병 피로 호소. 교회 지원 연결 약속.',
    '경제적 어려움. 십일조 회복과 예산 정리 안내.',
    '우울감 호소. 전문 상담 병행 권유.',
    '새가족 정착. 목장 연결과 정착반 참여 권유.',
    '교회 봉사 부담 호소. 사역 정리와 회복 시간 권면.',
    '결혼 준비 상담. 가정 예배 기초 안내.',
    '시댁/처가 갈등. 중보 기도와 화해의 계기 권면.',
    '청년 교제 상담. 신앙 동질성과 결혼관 권면.',
    '자녀 게임 중독 우려. 가정 규칙과 기도 권면.',
    '직장 이직 고민. 소명과 가족과의 우선순위 점검.',
    '신앙 정체기. 말씀 묵상 회복과 소그룹 권유.'
  ];

  v_baptism_types    TEXT[] := ARRAY['침례','입교','유아세례'];

BEGIN
  -- ============================================================
  -- 0. 가드: 교회 조회 + 중복 시드 방지
  -- ============================================================
  SELECT id INTO v_church_id
  FROM churches
  WHERE name ILIKE '%포천%중앙%' OR name ILIKE '%pocheon%central%'
  ORDER BY created_at
  LIMIT 1;

  IF v_church_id IS NULL THEN
    RAISE EXCEPTION
      '포천중앙침례교회를 찾지 못했습니다. 앱에서 먼저 교회를 생성해 주세요. (churches.name 에 ''포천''과 ''중앙''이 모두 포함되어야 합니다)';
  END IF;

  SELECT COUNT(*) INTO v_existing FROM members WHERE church_id = v_church_id;
  IF v_existing > 30 THEN
    RAISE EXCEPTION
      '포천중앙침례교회(church_id=%)에 이미 %명의 성도가 있습니다. 먼저 pocheon_central_demo_rollback.sql 을 실행해 주세요.',
      v_church_id, v_existing;
  END IF;

  RAISE NOTICE '포천중앙침례교회 시드 시작 · church_id=% · 기존 멤버=%', v_church_id, v_existing;

  -- ============================================================
  -- 1. settings (있으면 UPDATE, 없으면 INSERT — unique constraint 가정 X)
  -- ============================================================
  IF EXISTS (SELECT 1 FROM settings WHERE church_id = v_church_id) THEN
    UPDATE settings SET
      church_name  = v_church_name,
      depts        = '장년부,청년부,학생부,초등부,유년부,유치부,영아부',
      fiscal_start = '1',
      address      = '경기도 포천시 호국로 1234',
      pastor       = '김복음',
      denomination = '기독교한국침례회'
    WHERE church_id = v_church_id;
  ELSE
    INSERT INTO settings (church_id, church_name, depts, fiscal_start, address, pastor, denomination)
    VALUES (
      v_church_id, v_church_name,
      '장년부,청년부,학생부,초등부,유년부,유치부,영아부',
      '1',
      '경기도 포천시 호국로 1234',
      '김복음',
      '기독교한국침례회'
    );
  END IF;

  -- ============================================================
  -- 2. 교역자 5명 (담임목사 1 + 부목사 1 + 전도사 3)
  -- ============================================================
  INSERT INTO members (church_id, name, role, gender, birth, phone, address, email,
                       status, member_status, dept, registered_date, baptism_date, baptism_type,
                       photo, prayer)
  VALUES (v_church_id, '김복음', '담임목사', '남', '1965-04-12', '010-7001-1001', '경기 포천시 호국로 1200',
          'pastor@pccbc.kr',
          '재적', '활동', '장년부', '2008-03-01', '1992-12-25', '침례',
          'https://api.dicebear.com/7.x/avataaars/svg?seed=pccbc-' || md5('김복음남'),
          '포천중앙침례교회 부흥과 다음세대 영혼 구원')
  RETURNING id INTO v_pastor_id;

  INSERT INTO members (church_id, name, role, gender, birth, phone, address, email,
                       status, member_status, dept, registered_date, baptism_date, baptism_type,
                       photo, prayer)
  VALUES (v_church_id, '박은혜', '부목사', '남', '1978-09-03', '010-7001-1002', '경기 포천시 평화로 88',
          'assoc.pastor@pccbc.kr',
          '재적', '활동', '장년부', '2017-06-01', '2001-04-20', '침례',
          'https://api.dicebear.com/7.x/avataaars/svg?seed=pccbc-' || md5('박은혜남'),
          '교구 심방 사역과 청년부 동역')
  RETURNING id INTO v_assoc_pastor_id;

  INSERT INTO members (church_id, name, role, gender, birth, phone, address,
                       status, member_status, dept, registered_date, baptism_date, baptism_type,
                       photo, prayer)
  VALUES (v_church_id, '이축복', '전도사', '남', '1986-02-18', '010-7001-1003', '경기 포천시 충혼로 22',
          '재적', '활동', '학생부', '2020-02-01', '2003-08-10', '침례',
          'https://api.dicebear.com/7.x/avataaars/svg?seed=pccbc-' || md5('이축복남'),
          '중·고등부 영혼 구원')
  RETURNING id INTO v_evang1_id;

  INSERT INTO members (church_id, name, role, gender, birth, phone, address,
                       status, member_status, dept, registered_date, baptism_date, baptism_type,
                       photo, prayer)
  VALUES (v_church_id, '정새벽', '전도사', '여', '1989-11-25', '010-7001-1004', '경기 포천시 군내로 7',
          '재적', '활동', '청년부', '2021-03-01', '2007-05-04', '침례',
          'https://api.dicebear.com/7.x/avataaars/svg?seed=pccbc-' || md5('정새벽여'),
          '청년부 부흥과 새가족 정착')
  RETURNING id INTO v_evang2_id;

  INSERT INTO members (church_id, name, role, gender, birth, phone, address,
                       status, member_status, dept, registered_date, baptism_date, baptism_type,
                       photo, prayer)
  VALUES (v_church_id, '윤소망', '전도사', '여', '1992-06-08', '010-7001-1005', '경기 포천시 신읍로 33',
          '재적', '활동', '초등부', '2022-09-01', '2010-09-12', '침례',
          'https://api.dicebear.com/7.x/avataaars/svg?seed=pccbc-' || md5('윤소망여'),
          '교회학교 다음세대 신앙 양육')
  RETURNING id INTO v_evang3_id;

  -- ============================================================
  -- 3. 장로 4명
  -- ============================================================
  FOR i IN 1..4 LOOP
    INSERT INTO members (church_id, name, role, gender, birth, phone, address,
                         status, member_status, dept, registered_date, baptism_date, baptism_type,
                         photo, prayer)
    VALUES (
      v_church_id,
      (ARRAY['김의로','박충성','이성결','정거룩'])[i],
      '장로', '남',
      ((1953 + i)::TEXT) || '-0' || (3 + i)::TEXT || '-' || LPAD((5 + i * 4)::TEXT, 2, '0'),
      '010-7002-' || LPAD((1000 + i)::TEXT, 4, '0'),
      '경기 포천시 장로로 ' || (i * 12),
      '재적', '활동', '장년부',
      ('2010-03-01'::DATE + (i || ' months')::INTERVAL)::DATE,
      ('1985-06-15'::DATE + (i || ' months')::INTERVAL)::DATE,
      '침례',
      'https://api.dicebear.com/7.x/avataaars/svg?seed=pccbc-elder-' || i,
      v_prayer_topics[((i + 17) % array_length(v_prayer_topics, 1)) + 1]
    );
  END LOOP;

  -- ============================================================
  -- 4. 안수집사 6명
  -- ============================================================
  FOR i IN 1..6 LOOP
    INSERT INTO members (church_id, name, role, gender, birth, phone, address,
                         status, member_status, dept, registered_date, baptism_date, baptism_type,
                         photo, prayer)
    VALUES (
      v_church_id,
      (ARRAY['김믿음','박순종','이충성','정의로','윤성결','최선한'])[i],
      '안수집사', '남',
      ((1962 + i)::TEXT) || '-0' || (1 + (i % 9))::TEXT || '-' || LPAD((10 + i * 3)::TEXT, 2, '0'),
      '010-7003-' || LPAD((1000 + i)::TEXT, 4, '0'),
      '경기 포천시 집사로 ' || (i * 8),
      '재적', '활동', '장년부',
      ('2012-05-01'::DATE + (i || ' months')::INTERVAL)::DATE,
      ('1992-08-15'::DATE + (i || ' months')::INTERVAL)::DATE,
      '침례',
      'https://api.dicebear.com/7.x/avataaars/svg?seed=pccbc-adn-' || i,
      v_prayer_topics[((i + 5) % array_length(v_prayer_topics, 1)) + 1]
    );
  END LOOP;

  -- ============================================================
  -- 5. 권사 12명
  -- ============================================================
  FOR i IN 1..12 LOOP
    INSERT INTO members (church_id, name, role, gender, birth, phone, address,
                         status, member_status, dept, registered_date, baptism_date, baptism_type,
                         photo, prayer)
    VALUES (
      v_church_id,
      (ARRAY['최은혜','정사랑','윤축복','한미경','오평강','문기쁨','임은총','강소망','조복희','홍순영','배순자','신정자'])[i],
      '권사', '여',
      ((1955 + (i % 12))::TEXT) || '-0' || (1 + ((i + 2) % 9))::TEXT || '-' || LPAD((5 + i * 2)::TEXT, 2, '0'),
      '010-7004-' || LPAD((1000 + i)::TEXT, 4, '0'),
      '경기 포천시 권사로 ' || (i * 5),
      '재적', '활동', '장년부',
      ('2009-04-01'::DATE + (i || ' months')::INTERVAL)::DATE,
      ('1988-05-08'::DATE + (i || ' months')::INTERVAL)::DATE,
      CASE WHEN i % 4 = 0 THEN '입교' ELSE '침례' END,
      'https://api.dicebear.com/7.x/avataaars/svg?seed=pccbc-kw-' || i,
      v_prayer_topics[((i + 9) % array_length(v_prayer_topics, 1)) + 1]
    );
  END LOOP;

  -- ============================================================
  -- 6. 가족 14가족 → 부부 28 + 자녀 약 33명 (자녀는 학생/주일학교/청년 자동 배정)
  --    + 평신도 집사 일부 가족장 역할
  -- ============================================================
  FOR i IN 1..14 LOOP
    INSERT INTO families (church_id, family_name)
    VALUES (v_church_id, v_last_names[((i - 1) % array_length(v_last_names, 1)) + 1] || '씨 가정 #' || i)
    RETURNING id INTO v_family_id;

    -- 가장 (남편) — 집사 또는 평신도
    INSERT INTO members (church_id, name, role, gender, birth, phone, address, email,
                         status, member_status, dept, family_id, family_relation,
                         registered_date, baptism_date, baptism_type, photo,
                         mokjang, prayer)
    VALUES (
      v_church_id,
      v_last_names[((i - 1) % array_length(v_last_names, 1)) + 1]
        || v_first_m[((i - 1) % array_length(v_first_m, 1)) + 1],
      CASE WHEN i <= 10 THEN '집사' ELSE NULL END,
      '남',
      (1972 + (i % 18))::TEXT || '-' || LPAD(((1 + (i % 12))::TEXT), 2, '0') || '-' || LPAD(((1 + (i % 28))::TEXT), 2, '0'),
      '010-7100-' || LPAD((1000 + i)::TEXT, 4, '0'),
      '경기 포천시 가족로 ' || (i * 12),
      'family' || i || '@example.com',
      '재적',
      v_member_statuses[((i - 1) % array_length(v_member_statuses, 1)) + 1],
      '장년부',
      v_family_id,
      '본인',
      ('2014-01-01'::DATE + (i || ' months')::INTERVAL)::DATE,
      ('1998-04-15'::DATE + (i || ' months')::INTERVAL)::DATE,
      CASE WHEN i % 3 = 0 THEN '입교' WHEN i % 3 = 1 THEN '침례' ELSE '유아세례' END,
      'https://api.dicebear.com/7.x/avataaars/svg?seed=pccbc-fhead-' || i,
      '제' || (((i - 1) % 8) + 1) || '목장',
      CASE WHEN i % 3 = 0 THEN v_prayer_topics[((i - 1) % array_length(v_prayer_topics, 1)) + 1] ELSE NULL END
    );

    -- 아내
    INSERT INTO members (church_id, name, role, gender, birth, phone, address, email,
                         status, member_status, dept, family_id, family_relation,
                         registered_date, baptism_date, baptism_type, photo,
                         mokjang, prayer)
    VALUES (
      v_church_id,
      v_last_names[((i + 4) % array_length(v_last_names, 1)) + 1]
        || v_first_f[((i - 1) % array_length(v_first_f, 1)) + 1],
      CASE WHEN i <= 8 THEN '집사' ELSE NULL END,
      '여',
      (1974 + (i % 17))::TEXT || '-' || LPAD(((1 + ((i + 3) % 12))::TEXT), 2, '0') || '-' || LPAD(((1 + ((i + 5) % 28))::TEXT), 2, '0'),
      '010-7200-' || LPAD((1000 + i)::TEXT, 4, '0'),
      '경기 포천시 가족로 ' || (i * 12),
      'family' || i || '-w@example.com',
      '재적', '활동', '장년부',
      v_family_id, '배우자',
      ('2014-01-01'::DATE + (i || ' months')::INTERVAL)::DATE,
      ('1999-05-08'::DATE + (i || ' months')::INTERVAL)::DATE,
      '침례',
      'https://api.dicebear.com/7.x/avataaars/svg?seed=pccbc-fwife-' || i,
      '제' || (((i - 1) % 8) + 1) || '목장',
      CASE WHEN i % 4 = 0 THEN v_prayer_topics[((i + 6) % array_length(v_prayer_topics, 1)) + 1] ELSE NULL END
    );

    -- 자녀 수 (앞쪽 가정은 자녀 많이, 뒤쪽은 1명)
    v_child_count := CASE WHEN i <= 4 THEN 3 WHEN i <= 10 THEN 2 ELSE 1 END;
    FOR j IN 1..v_child_count LOOP
      INSERT INTO members (church_id, name, gender, birth, phone, address,
                           status, member_status, dept, family_id, family_relation,
                           registered_date, photo)
      VALUES (
        v_church_id,
        v_last_names[((i - 1) % array_length(v_last_names, 1)) + 1]
          || CASE WHEN j % 2 = 0
                  THEN v_first_f[((i * j - 1) % array_length(v_first_f, 1)) + 1]
                  ELSE v_first_m[((i * j - 1) % array_length(v_first_m, 1)) + 1]
             END,
        CASE WHEN j % 2 = 0 THEN '여' ELSE '남' END,
        (2004 + (j * 3) + (i % 6))::TEXT || '-' || LPAD(((1 + ((i + j) % 12))::TEXT), 2, '0') || '-' || LPAD(((1 + ((i + j) % 28))::TEXT), 2, '0'),
        NULL,
        '경기 포천시 가족로 ' || (i * 12),
        '재적', '활동',
        CASE
          WHEN 2026 - (2004 + (j * 3) + (i % 6)) < 4  THEN '영아부'
          WHEN 2026 - (2004 + (j * 3) + (i % 6)) < 7  THEN '유치부'
          WHEN 2026 - (2004 + (j * 3) + (i % 6)) < 10 THEN '유년부'
          WHEN 2026 - (2004 + (j * 3) + (i % 6)) < 13 THEN '초등부'
          WHEN 2026 - (2004 + (j * 3) + (i % 6)) < 16 THEN '중등부'
          WHEN 2026 - (2004 + (j * 3) + (i % 6)) < 19 THEN '고등부'
          ELSE '청년부'
        END,
        v_family_id, '자녀',
        ('2014-01-01'::DATE + (i || ' months')::INTERVAL)::DATE,
        'https://api.dicebear.com/7.x/avataaars/svg?seed=pccbc-child-' || i || '-' || j
      );
    END LOOP;
  END LOOP;

  -- ============================================================
  -- 7. 추가 단신 집사 (남) - 가족에 묶이지 않은 청장년 집사
  --    교역자5 + 장로4 + 안수6 + 권사12 + 가족장(집사) 10 = 37
  --    추가 단신 집사 12명 → 직분자 합 49명, 활동 장년 약 54명
  -- ============================================================
  FOR i IN 1..12 LOOP
    INSERT INTO members (church_id, name, role, gender, birth, phone, address,
                         status, member_status, dept, registered_date,
                         baptism_date, baptism_type, photo, mokjang, prayer)
    VALUES (
      v_church_id,
      v_last_names[((i + 8) % array_length(v_last_names, 1)) + 1]
        || v_first_m[((i + 13) % array_length(v_first_m, 1)) + 1],
      '집사', '남',
      (1975 + (i % 15))::TEXT || '-0' || (1 + (i % 9))::TEXT || '-' || LPAD((3 + i * 2)::TEXT, 2, '0'),
      '010-7300-' || LPAD((1000 + i)::TEXT, 4, '0'),
      '경기 포천시 신앙로 ' || (i * 6),
      '재적', '활동', '장년부',
      ('2016-02-01'::DATE + (i || ' months')::INTERVAL)::DATE,
      ('2000-06-15'::DATE + (i || ' months')::INTERVAL)::DATE,
      '침례',
      'https://api.dicebear.com/7.x/avataaars/svg?seed=pccbc-dx-' || i,
      '제' || (((i + 3) % 8) + 1) || '목장',
      CASE WHEN i % 4 = 0 THEN v_prayer_topics[((i + 11) % array_length(v_prayer_topics, 1)) + 1] ELSE NULL END
    );
  END LOOP;

  -- ============================================================
  -- 8. 청년부 추가 단신 12명 (가족 묶음 외)
  -- ============================================================
  FOR i IN 1..12 LOOP
    INSERT INTO members (church_id, name, role, gender, birth, phone, address,
                         status, member_status, dept, registered_date,
                         baptism_date, baptism_type, photo, small_group, prayer)
    VALUES (
      v_church_id,
      v_last_names[((i + 1) % array_length(v_last_names, 1)) + 1]
        || (CASE WHEN i % 2 = 0
                 THEN v_first_m[((i + 7) % array_length(v_first_m, 1)) + 1]
                 ELSE v_first_f[((i + 4) % array_length(v_first_f, 1)) + 1] END),
      NULL,
      CASE WHEN i % 2 = 0 THEN '남' ELSE '여' END,
      (1996 + (i % 9))::TEXT || '-0' || (1 + (i % 9))::TEXT || '-' || LPAD((2 + i)::TEXT, 2, '0'),
      '010-7400-' || LPAD((1000 + i)::TEXT, 4, '0'),
      '경기 포천시 청년로 ' || (i * 4),
      '재적', '활동', '청년부',
      ('2020-03-01'::DATE + (i || ' months')::INTERVAL)::DATE,
      ('2014-09-10'::DATE + (i || ' months')::INTERVAL)::DATE,
      CASE WHEN i % 3 = 0 THEN '입교' ELSE '침례' END,
      'https://api.dicebear.com/7.x/avataaars/svg?seed=pccbc-y-' || i,
      '청년 ' || (((i - 1) % 4) + 1) || '소그룹',
      v_prayer_topics[((i + 14) % array_length(v_prayer_topics, 1)) + 1]
    );
  END LOOP;

  -- ============================================================
  -- 9. 학생부 추가 단신 5명 (가족 묶음 외 중·고생)
  -- ============================================================
  FOR i IN 1..5 LOOP
    INSERT INTO members (church_id, name, gender, birth, phone, address,
                         status, member_status, dept, registered_date, photo, small_group)
    VALUES (
      v_church_id,
      v_last_names[((i + 11) % array_length(v_last_names, 1)) + 1]
        || (CASE WHEN i % 2 = 0
                 THEN v_first_m[((i + 18) % array_length(v_first_m, 1)) + 1]
                 ELSE v_first_f[((i + 14) % array_length(v_first_f, 1)) + 1] END),
      CASE WHEN i % 2 = 0 THEN '남' ELSE '여' END,
      (2009 + (i % 5))::TEXT || '-0' || (1 + (i % 9))::TEXT || '-' || LPAD((4 + i)::TEXT, 2, '0'),
      NULL,
      '경기 포천시 학생로 ' || (i * 3),
      '재적', '활동',
      CASE WHEN i <= 2 THEN '고등부' ELSE '중등부' END,
      ('2022-03-01'::DATE + (i || ' months')::INTERVAL)::DATE,
      'https://api.dicebear.com/7.x/avataaars/svg?seed=pccbc-s-' || i,
      CASE WHEN i <= 2 THEN '고등 1반' ELSE '중등 2반' END
    );
  END LOOP;

  RAISE NOTICE '성도 100명 생성 완료';

  -- ============================================================
  -- 10. 새가족 정착 - 7명 (진행중 4 + 수료 3) — 별도 신규 멤버
  -- ============================================================
  FOR i IN 1..7 LOOP
    INSERT INTO members (id, church_id, name, gender, birth, phone, address,
                         status, member_status, dept, registered_date,
                         first_visit_date, is_new_family, visit_path,
                         baptism_type, photo, prayer)
    VALUES (
      gen_random_uuid(), v_church_id,
      '새' || v_first_f[((i - 1) % array_length(v_first_f, 1)) + 1] || i,
      CASE WHEN i % 2 = 0 THEN '남' ELSE '여' END,
      (1988 + i * 2)::TEXT || '-0' || (3 + (i % 9))::TEXT || '-' || LPAD((10 + i * 2)::TEXT, 2, '0'),
      '010-7900-' || LPAD((1000 + i)::TEXT, 4, '0'),
      '경기 포천시 새소망로 ' || (i * 5),
      '재적', '활동', '장년부',
      (NOW() - ((45 - i * 5) || ' days')::INTERVAL)::DATE,
      (NOW() - ((45 - i * 5) || ' days')::INTERVAL)::DATE,
      true,
      (ARRAY['지인소개','전도','자진방문','이전교회'])[((i - 1) % 4) + 1],
      '미세례',
      'https://api.dicebear.com/7.x/avataaars/svg?seed=pccbc-new-' || i,
      '신앙의 뿌리를 깊이 내리며 정착할 수 있도록'
    )
    RETURNING id INTO v_member_id;

    IF to_regclass('public.new_family_program') IS NOT NULL THEN
      INSERT INTO new_family_program (
        church_id, member_id, mentor_id, program_start_date,
        week1_completed, week1_date, week1_note,
        week2_completed, week2_date, week2_note,
        week3_completed, week3_date, week3_note,
        week4_completed, week4_date, week4_note,
        status, cell_group_assigned
      ) VALUES (
        v_church_id, v_member_id,
        CASE WHEN i % 2 = 0 THEN v_pastor_id ELSE v_assoc_pastor_id END,
        (NOW() - ((45 - i * 5) || ' days')::INTERVAL)::DATE,
        i >= 1, CASE WHEN i >= 1 THEN (NOW() - ((38 - i * 5) || ' days')::INTERVAL)::DATE ELSE NULL END,
        CASE WHEN i >= 1 THEN '주차 1: 교회 소개와 구원의 확신. 적응 점검.' ELSE NULL END,
        i >= 2, CASE WHEN i >= 2 THEN (NOW() - ((31 - i * 5) || ' days')::INTERVAL)::DATE ELSE NULL END,
        CASE WHEN i >= 2 THEN '주차 2: 교회의 사역과 부서 소개. 봉사 안내.' ELSE NULL END,
        i >= 3, CASE WHEN i >= 3 THEN (NOW() - ((24 - i * 5) || ' days')::INTERVAL)::DATE ELSE NULL END,
        CASE WHEN i >= 3 THEN '주차 3: 침례교 신앙 기초. QT 안내.' ELSE NULL END,
        i >= 4, CASE WHEN i >= 4 THEN (NOW() - ((17 - i * 5) || ' days')::INTERVAL)::DATE ELSE NULL END,
        CASE WHEN i >= 4 THEN '주차 4: 정착 마무리 + 목장 배정.' ELSE NULL END,
        CASE WHEN i <= 3 THEN '수료' ELSE '진행중' END,
        '제' || (((i - 1) % 8) + 1) || '목장'
      );
    END IF;
  END LOOP;

  RAISE NOTICE '새가족 정착 7명 등록';

  -- ============================================================
  -- 11. 목장 8개 + 배정
  -- ============================================================
  v_mokjang_ids := ARRAY[]::UUID[];
  IF to_regclass('public.organizations') IS NOT NULL THEN
    FOR i IN 1..8 LOOP
      INSERT INTO organizations (church_id, name, type, leader_name, sort_order, is_active)
      VALUES (
        v_church_id,
        '제' || i || '목장',
        '목장',
        v_last_names[((i + 2) % array_length(v_last_names, 1)) + 1] || v_first_m[((i + 5) % array_length(v_first_m, 1)) + 1],
        i, true
      )
      RETURNING id INTO v_org_id;
      v_mokjang_ids := array_append(v_mokjang_ids, v_org_id);
    END LOOP;

    IF to_regclass('public.organization_members') IS NOT NULL THEN
      WITH allocated AS (
        SELECT id,
               name,
               ((ROW_NUMBER() OVER (ORDER BY name) - 1)::INT % 8) + 1 AS group_no
        FROM members
        WHERE church_id = v_church_id AND dept = '장년부' AND member_status = '활동'
      ),
      ranked AS (
        SELECT id,
               group_no,
               ROW_NUMBER() OVER (PARTITION BY group_no ORDER BY name) AS rn
        FROM allocated
      )
      INSERT INTO organization_members (church_id, organization_id, member_id, role_in_org, is_active)
      SELECT v_church_id,
             v_mokjang_ids[group_no],
             id,
             CASE WHEN rn = 1 THEN '목자' ELSE '구성원' END,
             true
      FROM ranked;
    END IF;
  END IF;

  -- ============================================================
  -- 12. 교회학교 부서 + 등록
  -- ============================================================
  IF to_regclass('public.school_departments') IS NOT NULL THEN
    FOR i IN 1..array_length(v_school_dept_names, 1) LOOP
      INSERT INTO school_departments (church_id, name, age_range, leader_name, sort_order, is_active)
      VALUES (
        v_church_id,
        v_school_dept_names[i],
        v_school_age_ranges[i],
        v_last_names[((i - 1) % array_length(v_last_names, 1)) + 1] || '교사',
        i, true
      );
    END LOOP;

    IF to_regclass('public.school_enrollments') IS NOT NULL THEN
      INSERT INTO school_enrollments (church_id, member_id, department_id, role, is_active)
      SELECT v_church_id, m.id, sd.id, '학생', true
      FROM members m
      JOIN school_departments sd ON sd.church_id = v_church_id AND sd.name = m.dept
      WHERE m.church_id = v_church_id AND m.dept = ANY(v_school_dept_names);
    END IF;
  END IF;

  RAISE NOTICE '목장·교회학교 구성 완료';

  -- ============================================================
  -- 13. attendance — 2년치 주일예배 출석 (활동 멤버 전원)
  -- ============================================================
  FOR v_event_date IN
    SELECT generate_series(v_start_date, v_end_date, INTERVAL '1 week')::DATE
  LOOP
    v_year := EXTRACT(YEAR FROM v_event_date)::INT;
    v_week := EXTRACT(WEEK FROM v_event_date)::INT;

    INSERT INTO attendance (church_id, member_id, week_num, year, status, date, service_type)
    SELECT
      v_church_id, m.id, v_week, v_year,
      CASE
        WHEN r.seed < 0.78 THEN 'p'
        WHEN r.seed < 0.86 THEN 'o'
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
  -- 14. income — 2년치 헌금 (주일헌금 + 십일조 + 감사·절기 등)
  -- ============================================================
  FOR v_event_date IN
    SELECT generate_series(v_start_date, v_end_date, INTERVAL '1 week')::DATE
  LOOP
    v_year := EXTRACT(YEAR FROM v_event_date)::INT;

    -- (1) 주일헌금 (매주)
    INSERT INTO income (church_id, date, type, amount, payment_method, fiscal_year, month)
    VALUES (
      v_church_id,
      TO_CHAR(v_event_date, 'YYYY-MM-DD'),
      '주일헌금',
      (1200000 + (random() * 800000)::BIGINT),
      CASE WHEN random() < 0.5 THEN '현금' ELSE '계좌이체' END,
      v_year::TEXT,
      EXTRACT(MONTH FROM v_event_date)::INT
    );

    -- (2) 십일조 (매주 8명, 장년부 중 활동)
    INSERT INTO income (church_id, date, type, amount, donor, member_id, payment_method, fiscal_year, month)
    SELECT
      v_church_id,
      TO_CHAR(v_event_date, 'YYYY-MM-DD'),
      '십일조',
      (180000 + (random() * 720000)::BIGINT),
      m.name, m.id,
      CASE WHEN random() < 0.75 THEN '계좌이체' ELSE '현금' END,
      v_year::TEXT,
      EXTRACT(MONTH FROM v_event_date)::INT
    FROM (
      SELECT id, name FROM members
      WHERE church_id = v_church_id AND dept = '장년부' AND member_status = '활동'
      ORDER BY random() LIMIT 8
    ) m;

    -- (3) 첫째주에 감사헌금 2건
    IF EXTRACT(DAY FROM v_event_date)::INT <= 7 THEN
      INSERT INTO income (church_id, date, type, amount, donor, member_id, payment_method, fiscal_year, month)
      SELECT
        v_church_id,
        TO_CHAR(v_event_date, 'YYYY-MM-DD'),
        '감사헌금',
        (80000 + (random() * 320000)::BIGINT),
        m.name, m.id, '현금',
        v_year::TEXT,
        EXTRACT(MONTH FROM v_event_date)::INT
      FROM (
        SELECT id, name FROM members
        WHERE church_id = v_church_id AND member_status = '활동'
        ORDER BY random() LIMIT 2
      ) m;
    END IF;
  END LOOP;

  -- (4) 절기/특별헌금 (부활절, 추수감사, 성탄절, 어버이주일 등)
  INSERT INTO income (church_id, date, type, amount, payment_method, fiscal_year, month, memo)
  VALUES
    (v_church_id, '2024-05-12', '어버이주일헌금', 1850000, '계좌이체', '2024',  5, '어버이주일 감사헌금'),
    (v_church_id, '2024-11-17', '추수감사헌금',   2750000, '계좌이체', '2024', 11, '추수감사주일'),
    (v_church_id, '2024-12-22', '성탄절헌금',     3100000, '계좌이체', '2024', 12, '성탄절 감사헌금'),
    (v_church_id, '2025-04-20', '부활절헌금',     2400000, '계좌이체', '2025',  4, '부활주일'),
    (v_church_id, '2025-05-11', '어버이주일헌금', 1980000, '계좌이체', '2025',  5, '어버이주일 감사헌금'),
    (v_church_id, '2025-11-16', '추수감사헌금',   2950000, '계좌이체', '2025', 11, '추수감사주일'),
    (v_church_id, '2025-12-21', '성탄절헌금',     3380000, '계좌이체', '2025', 12, '성탄절 감사헌금'),
    (v_church_id, '2026-04-05', '부활절헌금',     2560000, '계좌이체', '2026',  4, '부활주일'),
    (v_church_id, '2026-05-10', '어버이주일헌금', 2120000, '계좌이체', '2026',  5, '어버이주일 감사헌금');

  RAISE NOTICE '헌금 2년치 생성 완료';

  -- ============================================================
  -- 15. expense — 2년치 월별 지출
  -- ============================================================
  FOR v_month IN
    SELECT generate_series(date_trunc('month', v_start_date)::DATE, date_trunc('month', v_end_date)::DATE, INTERVAL '1 month')::DATE
  LOOP
    v_year := EXTRACT(YEAR FROM v_month)::INT;
    i := EXTRACT(MONTH FROM v_month)::INT;

    -- 인건비
    INSERT INTO expense (church_id, date, category, item, amount, payment_method, fiscal_year, month, memo)
    VALUES (
      v_church_id,
      TO_CHAR(v_month + INTERVAL '24 days', 'YYYY-MM-DD'),
      '인건비', '교역자 사례비 (전체)',
      9800000 + (random() * 1700000)::BIGINT,
      '계좌이체', v_year::TEXT, i,
      v_year || '년 ' || i || '월 교역자 5인 사례비'
    );

    -- 관리비/사역비/선교비 기본 셋
    INSERT INTO expense (church_id, date, category, item, amount, payment_method, fiscal_year, month)
    VALUES
      (v_church_id, TO_CHAR(v_month + INTERVAL '9 days',  'YYYY-MM-DD'), '관리비', '전기/수도/가스',         620000 + (random() * 280000)::BIGINT, '계좌이체', v_year::TEXT, i),
      (v_church_id, TO_CHAR(v_month + INTERVAL '14 days', 'YYYY-MM-DD'), '관리비', '청소/방역',              250000 + (random() *  90000)::BIGINT, '계좌이체', v_year::TEXT, i),
      (v_church_id, TO_CHAR(v_month + INTERVAL '14 days', 'YYYY-MM-DD'), '관리비', '교회 운영비(통신·소모품)', 180000 + (random() *  80000)::BIGINT, '카드',     v_year::TEXT, i),
      (v_church_id, TO_CHAR(v_month + INTERVAL '19 days', 'YYYY-MM-DD'), '사역비', '예배 물품·주보',          210000 + (random() * 180000)::BIGINT, '카드',     v_year::TEXT, i),
      (v_church_id, TO_CHAR(v_month + INTERVAL '21 days', 'YYYY-MM-DD'), '사역비', '교회학교 교재',           160000 + (random() * 140000)::BIGINT, '카드',     v_year::TEXT, i),
      (v_church_id, TO_CHAR(v_month + INTERVAL '27 days', 'YYYY-MM-DD'), '선교비', '국내·해외 선교사 후원',   1250000 + (random() * 480000)::BIGINT, '계좌이체', v_year::TEXT, i),
      (v_church_id, TO_CHAR(v_month + INTERVAL '5 days',  'YYYY-MM-DD'), '구제비', '어려운 이웃 도움',         300000 + (random() * 250000)::BIGINT, '계좌이체', v_year::TEXT, i);

    -- 분기별 특별 지출
    IF i IN (3, 6, 9, 12) THEN
      INSERT INTO expense (church_id, date, category, item, amount, payment_method, fiscal_year, month, memo)
      VALUES (
        v_church_id,
        TO_CHAR(v_month + INTERVAL '16 days', 'YYYY-MM-DD'),
        '행사비',
        CASE i WHEN 3 THEN '부활절 행사비' WHEN 6 THEN '하계 수련회 준비비' WHEN 9 THEN '추수감사주일 준비비' ELSE '성탄절 행사·구제비' END,
        650000 + (random() * 950000)::BIGINT,
        '계좌이체', v_year::TEXT, i,
        '분기 정기 행사 집행'
      );
    END IF;
  END LOOP;

  RAISE NOTICE '지출 2년치 생성 완료';

  -- ============================================================
  -- 16. budget — 2025·2026 연간 예산 (수입/지출)
  -- ============================================================
  IF to_regclass('public.budget') IS NOT NULL THEN
    -- 2025
    INSERT INTO budget (church_id, fiscal_year, category_type, category, monthly_amounts, annual_total) VALUES
      (v_church_id, '2025', '수입', '주일헌금',
       jsonb_build_object('1',6500000,'2',6500000,'3',7000000,'4',7000000,'5',7500000,'6',7000000,'7',7000000,'8',7000000,'9',7000000,'10',7200000,'11',7500000,'12',8500000),
       85700000),
      (v_church_id, '2025', '수입', '십일조',
       jsonb_build_object('1',12000000,'2',12000000,'3',12000000,'4',12000000,'5',12500000,'6',12000000,'7',12000000,'8',12000000,'9',12000000,'10',12000000,'11',12500000,'12',14000000),
       147000000),
      (v_church_id, '2025', '수입', '감사·절기헌금',
       jsonb_build_object('1',900000,'2',900000,'3',900000,'4',2400000,'5',2980000,'6',900000,'7',900000,'8',900000,'9',900000,'10',900000,'11',2950000,'12',3380000),
       19910000),
      (v_church_id, '2025', '지출', '인건비',
       jsonb_build_object('1',10500000,'2',10500000,'3',10500000,'4',10500000,'5',10500000,'6',10500000,'7',10500000,'8',10500000,'9',10500000,'10',10500000,'11',10500000,'12',14000000),
       129500000),
      (v_church_id, '2025', '지출', '관리비',
       jsonb_build_object('1',1100000,'2',1100000,'3',1100000,'4',1100000,'5',1100000,'6',1200000,'7',1300000,'8',1300000,'9',1100000,'10',1100000,'11',1100000,'12',1300000),
       13900000),
      (v_church_id, '2025', '지출', '사역비',
       jsonb_build_object('1',450000,'2',450000,'3',650000,'4',450000,'5',450000,'6',650000,'7',450000,'8',450000,'9',650000,'10',450000,'11',450000,'12',650000),
       6200000),
      (v_church_id, '2025', '지출', '선교비',
       jsonb_build_object('1',1500000,'2',1500000,'3',1500000,'4',1500000,'5',1500000,'6',1500000,'7',1500000,'8',1500000,'9',1500000,'10',1500000,'11',1500000,'12',2000000),
       18500000),
      (v_church_id, '2025', '지출', '구제비',
       jsonb_build_object('1',400000,'2',400000,'3',400000,'4',400000,'5',400000,'6',400000,'7',400000,'8',400000,'9',400000,'10',400000,'11',400000,'12',600000),
       5000000),
      (v_church_id, '2025', '지출', '행사비',
       jsonb_build_object('3',1200000,'6',1500000,'9',900000,'12',2000000),
       5600000);

    -- 2026 (전년 대비 5% 인상 가정)
    INSERT INTO budget (church_id, fiscal_year, category_type, category, monthly_amounts, annual_total) VALUES
      (v_church_id, '2026', '수입', '주일헌금',
       jsonb_build_object('1',6800000,'2',6800000,'3',7300000,'4',7300000,'5',7900000,'6',7300000,'7',7300000,'8',7300000,'9',7300000,'10',7600000,'11',7900000,'12',8900000),
       89700000),
      (v_church_id, '2026', '수입', '십일조',
       jsonb_build_object('1',12500000,'2',12500000,'3',12500000,'4',12500000,'5',13000000,'6',12500000,'7',12500000,'8',12500000,'9',12500000,'10',12500000,'11',13000000,'12',14500000),
       153000000),
      (v_church_id, '2026', '수입', '감사·절기헌금',
       jsonb_build_object('1',950000,'2',950000,'3',950000,'4',2560000,'5',3120000,'6',950000,'7',950000,'8',950000,'9',950000,'10',950000,'11',3090000,'12',3550000),
       21020000),
      (v_church_id, '2026', '지출', '인건비',
       jsonb_build_object('1',11000000,'2',11000000,'3',11000000,'4',11000000,'5',11000000,'6',11000000,'7',11000000,'8',11000000,'9',11000000,'10',11000000,'11',11000000,'12',14600000),
       135600000),
      (v_church_id, '2026', '지출', '관리비',
       jsonb_build_object('1',1150000,'2',1150000,'3',1150000,'4',1150000,'5',1150000,'6',1300000,'7',1400000,'8',1400000,'9',1150000,'10',1150000,'11',1150000,'12',1350000),
       14650000),
      (v_church_id, '2026', '지출', '사역비',
       jsonb_build_object('1',500000,'2',500000,'3',700000,'4',500000,'5',500000,'6',700000,'7',500000,'8',500000,'9',700000,'10',500000,'11',500000,'12',700000),
       6800000),
      (v_church_id, '2026', '지출', '선교비',
       jsonb_build_object('1',1600000,'2',1600000,'3',1600000,'4',1600000,'5',1600000,'6',1600000,'7',1600000,'8',1600000,'9',1600000,'10',1600000,'11',1600000,'12',2100000),
       19700000),
      (v_church_id, '2026', '지출', '구제비',
       jsonb_build_object('1',450000,'2',450000,'3',450000,'4',450000,'5',450000,'6',450000,'7',450000,'8',450000,'9',450000,'10',450000,'11',450000,'12',650000),
       5600000),
      (v_church_id, '2026', '지출', '행사비',
       jsonb_build_object('3',1300000,'6',1600000,'9',950000,'12',2100000),
       5950000);

    RAISE NOTICE '예산(2025·2026) 생성 완료';
  END IF;

  -- ============================================================
  -- 17. notes — 기도제목·메모·심방 60건 (2개월 분)
  -- ============================================================
  FOR i IN 1..60 LOOP
    INSERT INTO notes (church_id, member_id, date, type, content, answered, answered_at)
    SELECT
      v_church_id,
      m.id::TEXT,
      TO_CHAR(NOW() - (i || ' days')::INTERVAL, 'YYYY-MM-DD'),
      CASE WHEN i % 4 = 0 THEN 'memo'
           WHEN i % 4 = 1 THEN 'prayer'
           WHEN i % 4 = 2 THEN 'visit'
           ELSE 'prayer' END,
      v_prayer_topics[((i - 1) % array_length(v_prayer_topics, 1)) + 1],
      CASE WHEN i % 8 = 0 THEN true ELSE false END,
      CASE WHEN i % 8 = 0 THEN (NOW() - ((i - 3) || ' days')::INTERVAL)::DATE ELSE NULL END
    FROM members m
    WHERE m.church_id = v_church_id AND m.member_status = '활동'
    ORDER BY random() LIMIT 1;
  END LOOP;

  -- 교회 전체 기도제목 5건
  FOR i IN 1..5 LOOP
    INSERT INTO notes (church_id, member_id, date, type, content, answered)
    VALUES (
      v_church_id,
      'church-wide',
      TO_CHAR(NOW() - (i * 7 || ' days')::INTERVAL, 'YYYY-MM-DD'),
      'prayer',
      '[교회 전체] ' || v_prayer_topics[((i + 16) % array_length(v_prayer_topics, 1)) + 1],
      false
    );
  END LOOP;

  RAISE NOTICE '기도·메모 65건 생성 완료';

  -- ============================================================
  -- 18. visits — 심방 35건 (2개월 분)
  -- ============================================================
  FOR i IN 1..35 LOOP
    INSERT INTO visits (church_id, date, member_id, type, content)
    SELECT
      v_church_id,
      TO_CHAR(NOW() - (i * 2 || ' days')::INTERVAL, 'YYYY-MM-DD'),
      m.id,
      v_visit_types[((i - 1) % array_length(v_visit_types, 1)) + 1],
      v_visit_contents[((i - 1) % array_length(v_visit_contents, 1)) + 1] || ' (' || m.name || ' 가정)'
    FROM members m
    WHERE m.church_id = v_church_id
      AND m.dept = '장년부'
      AND m.member_status = '활동'
    ORDER BY random() LIMIT 1;
  END LOOP;

  -- visits 추가 컬럼 옵셔널 (status/time/location 등은 앱 코드가 채워줌)

  RAISE NOTICE '심방 35건 생성 완료';

  -- ============================================================
  -- 19. counsels — 상담 25건 (테이블 존재 시)
  -- ============================================================
  IF to_regclass('public.counsels') IS NOT NULL THEN
    FOR i IN 1..25 LOOP
      INSERT INTO counsels (
        church_id, member_id, type, date, summary, confidential,
        follow_up_date, follow_up_note, follow_up_done
      )
      SELECT
        v_church_id,
        m.id,
        v_counsel_types[((i - 1) % array_length(v_counsel_types, 1)) + 1],
        TO_CHAR(NOW() - (i * 3 || ' days')::INTERVAL, 'YYYY-MM-DD'),
        v_counsel_summaries[((i - 1) % array_length(v_counsel_summaries, 1)) + 1],
        (i % 6 = 0),
        CASE WHEN i % 4 = 0 THEN TO_CHAR((NOW() - (i * 3 || ' days')::INTERVAL)::DATE + 14, 'YYYY-MM-DD') ELSE NULL END,
        CASE WHEN i % 4 = 0 THEN '다음 상담 시 진행 상황 확인 + 중보 기도' ELSE NULL END,
        (i % 10 < 4)
      FROM members m
      WHERE m.church_id = v_church_id AND m.member_status = '활동'
      ORDER BY random() LIMIT 1;
    END LOOP;
    RAISE NOTICE '상담 25건 생성 완료';
  END IF;

  -- ============================================================
  -- 20. plans — 교역자 일정 80건 (전후 4개월)
  -- ============================================================
  FOR i IN 1..80 LOOP
    INSERT INTO plans (church_id, title, date, time, cat, memo)
    VALUES (
      v_church_id,
      CASE i % 8
        WHEN 0 THEN '교역자 회의'
        WHEN 1 THEN '제직회'
        WHEN 2 THEN '구역장 모임'
        WHEN 3 THEN '심방 일정'
        WHEN 4 THEN '설교 본문 연구'
        WHEN 5 THEN '청년부 리더 모임'
        WHEN 6 THEN '새가족반 진행'
        ELSE '특별 새벽기도회'
      END,
      TO_CHAR(NOW() + ((i - 40) || ' days')::INTERVAL, 'YYYY-MM-DD'),
      CASE i % 5 WHEN 0 THEN '05:30' WHEN 1 THEN '10:00' WHEN 2 THEN '14:00' WHEN 3 THEN '19:30' ELSE '20:00' END,
      CASE i % 4 WHEN 0 THEN '회의' WHEN 1 THEN '사역' WHEN 2 THEN '심방' ELSE '교육' END,
      CASE WHEN i % 3 = 0 THEN '담임목사 + 부목사 참석' ELSE NULL END
    );
  END LOOP;

  -- ============================================================
  -- 21. sermons — 설교 50건 (지난 1년치 주일·수요예배)
  -- ============================================================
  FOR i IN 1..50 LOOP
    INSERT INTO sermons (church_id, date, service, bible_text, title, core, status)
    VALUES (
      v_church_id,
      TO_CHAR(NOW() - (i * 7 || ' days')::INTERVAL, 'YYYY-MM-DD'),
      CASE i % 4 WHEN 0 THEN '수요 기도회' WHEN 1 THEN '주일 1부 예배' WHEN 2 THEN '주일 2부 예배' ELSE '주일 오후 예배' END,
      CASE i % 6
        WHEN 0 THEN '요한복음 ' || (1 + i % 21) || ':' || (1 + i % 30)
        WHEN 1 THEN '시편 ' || (1 + i % 150) || '편 ' || (1 + i % 20) || '-' || (3 + i % 20) || '절'
        WHEN 2 THEN '로마서 ' || (1 + i % 16) || ':' || (1 + i % 30)
        WHEN 3 THEN '마태복음 ' || (1 + i % 28) || ':' || (1 + i % 30)
        WHEN 4 THEN '에베소서 ' || (1 + i % 6) || ':' || (1 + i % 20)
        ELSE '베드로전서 ' || (1 + i % 5) || ':' || (1 + i % 20)
      END,
      CASE i % 8
        WHEN 0 THEN '하나님의 사랑'
        WHEN 1 THEN '믿음의 길'
        WHEN 2 THEN '은혜로 받은 구원'
        WHEN 3 THEN '기도의 능력'
        WHEN 4 THEN '말씀 위에 서는 삶'
        WHEN 5 THEN '함께 가는 신앙'
        WHEN 6 THEN '주의 인도하심'
        ELSE '거룩한 백성'
      END,
      '말씀을 통한 변화된 삶과 공동체의 회복',
      CASE
        WHEN i <= 3  THEN '구상중'
        WHEN i <= 7  THEN '본문연구'
        WHEN i <= 12 THEN '초고작성'
        ELSE '완료'
      END
    );
  END LOOP;

  RAISE NOTICE '교역자 일정·설교 생성 완료';

  -- ============================================================
  -- 22. Church Planner — 부서/장소/일정 (church_id TEXT)
  -- ============================================================
  IF to_regclass('public.departments') IS NOT NULL THEN
    INSERT INTO departments (church_id, name, color, icon, sort_order, is_active)
    VALUES
      (v_church_id::TEXT, '담임목사실', '#1B2A4A', 'cross',  0, true),
      (v_church_id::TEXT, '교육부',     '#4A90D9', 'book',   1, true),
      (v_church_id::TEXT, '청년부',     '#6C5CE7', 'users',  2, true),
      (v_church_id::TEXT, '찬양팀',     '#A855F7', 'music',  3, true),
      (v_church_id::TEXT, '선교부',     '#22C55E', 'globe',  4, true),
      (v_church_id::TEXT, '봉사부',     '#F59E0B', 'heart',  5, true);
  END IF;

  IF to_regclass('public.places') IS NOT NULL THEN
    INSERT INTO places (church_id, name, capacity, equipment, sort_order, is_active)
    VALUES
      (v_church_id::TEXT, '본당',        450, ARRAY['빔프로젝터','음향','영상중계'], 0, true),
      (v_church_id::TEXT, '소예배실',     80, ARRAY['빔프로젝터','음향'],          1, true),
      (v_church_id::TEXT, '교육관 1층',   60, ARRAY['빔프로젝터'],                 2, true),
      (v_church_id::TEXT, '친교실',      120, ARRAY[]::TEXT[],                      3, true),
      (v_church_id::TEXT, '교회학교 본관', 200, ARRAY['빔프로젝터','음향'],          4, true);
  END IF;

  IF to_regclass('public.events') IS NOT NULL THEN
    -- 정기 일정
    INSERT INTO events (church_id, title, event_type, start_date, start_time, is_all_day, description, expected_people, is_public)
    VALUES
      (v_church_id::TEXT, '주일 1부 예배',      'service', DATE_TRUNC('week', CURRENT_DATE)::DATE - 1 + INTERVAL '7 days', '09:00'::TIME, false, '주일 1부 예배', 180, true),
      (v_church_id::TEXT, '주일 2부 예배',      'service', DATE_TRUNC('week', CURRENT_DATE)::DATE - 1 + INTERVAL '7 days', '11:00'::TIME, false, '주일 2부 예배', 200, true),
      (v_church_id::TEXT, '수요 기도회',        'service', DATE_TRUNC('week', CURRENT_DATE)::DATE + INTERVAL '2 days',    '19:30'::TIME, false, '수요 저녁 기도회',  90, true),
      (v_church_id::TEXT, '금요 기도회',        'service', DATE_TRUNC('week', CURRENT_DATE)::DATE + INTERVAL '4 days',    '20:00'::TIME, false, '금요 철야 기도회',  70, true),
      (v_church_id::TEXT, '새벽기도회',         'service', CURRENT_DATE + INTERVAL '1 day',                                '05:30'::TIME, false, '월~토 매일 새벽기도회', 40, true);

    -- 분기·연간 행사
    FOR i IN 1..18 LOOP
      INSERT INTO events (church_id, title, event_type, start_date, start_time, is_all_day, description, expected_people, is_public)
      VALUES (
        v_church_id::TEXT,
        CASE i % 9
          WHEN 0 THEN '월삭 새벽기도회'
          WHEN 1 THEN '제직 헌신예배'
          WHEN 2 THEN '청년부 금요 모임'
          WHEN 3 THEN '목장 리더 모임'
          WHEN 4 THEN '새가족 환영회'
          WHEN 5 THEN '교회학교 교사 기도회'
          WHEN 6 THEN '구제 사역 봉사'
          WHEN 7 THEN '선교 보고회'
          ELSE '주일 오후 찬양집회'
        END,
        'event',
        (DATE '2025-06-01' + (i * 18)),
        (CASE i % 4 WHEN 0 THEN '06:00' WHEN 1 THEN '14:00' WHEN 2 THEN '19:30' ELSE '15:00' END)::TIME,
        false,
        '포천중앙침례교회 정기 사역 일정',
        20 + (i * 4),
        true
      );
    END LOOP;

    -- 절기 행사
    INSERT INTO events (church_id, title, event_type, start_date, start_time, is_all_day, description, expected_people, is_public)
    VALUES
      (v_church_id::TEXT, '부활주일',         'event', '2026-04-05', '11:00'::TIME, false, '부활주일 연합예배 + 점심 친교',  280, true),
      (v_church_id::TEXT, '어버이주일',       'event', '2026-05-10', '11:00'::TIME, false, '어버이주일 감사예배 + 카네이션', 260, true),
      (v_church_id::TEXT, '하계 수련회',      'event', '2026-08-07', '09:00'::TIME, true,  '전 교인 하계 수련회 (2박3일)',    150, true),
      (v_church_id::TEXT, '추수감사주일',     'event', '2026-11-15', '11:00'::TIME, false, '추수감사주일',                     300, true),
      (v_church_id::TEXT, '성탄절 연합예배',  'event', '2026-12-25', '11:00'::TIME, false, '성탄절 연합예배 + 구제',           320, true);
  END IF;

  RAISE NOTICE '플래너 부서·장소·일정 생성 완료';
  RAISE NOTICE '✅ 포천중앙침례교회 시드 완료 · church_id = %', v_church_id;
END $$;

COMMIT;

-- =====================================================================
-- 검증: 카운트
-- =====================================================================
SELECT '=== 포천중앙침례교회 시드 결과 ===' AS info;

WITH ch AS (
  SELECT id FROM churches WHERE name ILIKE '%포천%중앙%' OR name ILIKE '%pocheon%central%' ORDER BY created_at LIMIT 1
)
SELECT t.table_name, t.row_count
FROM (
  SELECT 'members'              AS table_name, COUNT(*)::INT AS row_count FROM members              WHERE church_id = (SELECT id FROM ch)
  UNION ALL SELECT 'families',                COUNT(*)::INT FROM families                          WHERE church_id = (SELECT id FROM ch)
  UNION ALL SELECT 'organizations',           COALESCE((SELECT COUNT(*)::INT FROM organizations           WHERE church_id = (SELECT id FROM ch)), 0)
  UNION ALL SELECT 'organization_members',    COALESCE((SELECT COUNT(*)::INT FROM organization_members    WHERE church_id = (SELECT id FROM ch)), 0)
  UNION ALL SELECT 'school_departments',      COALESCE((SELECT COUNT(*)::INT FROM school_departments      WHERE church_id = (SELECT id FROM ch)), 0)
  UNION ALL SELECT 'school_enrollments',      COALESCE((SELECT COUNT(*)::INT FROM school_enrollments      WHERE church_id = (SELECT id FROM ch)), 0)
  UNION ALL SELECT 'attendance',              COUNT(*)::INT FROM attendance                        WHERE church_id = (SELECT id FROM ch)
  UNION ALL SELECT 'income',                  COUNT(*)::INT FROM income                            WHERE church_id = (SELECT id FROM ch)
  UNION ALL SELECT 'expense',                 COUNT(*)::INT FROM expense                           WHERE church_id = (SELECT id FROM ch)
  UNION ALL SELECT 'budget',                  COALESCE((SELECT COUNT(*)::INT FROM budget                  WHERE church_id = (SELECT id FROM ch)), 0)
  UNION ALL SELECT 'notes',                   COUNT(*)::INT FROM notes                             WHERE church_id = (SELECT id FROM ch)
  UNION ALL SELECT 'visits',                  COUNT(*)::INT FROM visits                            WHERE church_id = (SELECT id FROM ch)
  UNION ALL SELECT 'counsels',                COALESCE((SELECT COUNT(*)::INT FROM counsels                WHERE church_id = (SELECT id FROM ch)), 0)
  UNION ALL SELECT 'plans',                   COUNT(*)::INT FROM plans                             WHERE church_id = (SELECT id FROM ch)
  UNION ALL SELECT 'sermons',                 COUNT(*)::INT FROM sermons                           WHERE church_id = (SELECT id FROM ch)
  UNION ALL SELECT 'new_family_program',      COALESCE((SELECT COUNT(*)::INT FROM new_family_program      WHERE church_id = (SELECT id FROM ch)), 0)
  UNION ALL SELECT 'departments (planner)',   COALESCE((SELECT COUNT(*)::INT FROM departments             WHERE church_id = (SELECT id::TEXT FROM ch)), 0)
  UNION ALL SELECT 'places',                  COALESCE((SELECT COUNT(*)::INT FROM places                  WHERE church_id = (SELECT id::TEXT FROM ch)), 0)
  UNION ALL SELECT 'events',                  COALESCE((SELECT COUNT(*)::INT FROM events                  WHERE church_id = (SELECT id::TEXT FROM ch)), 0)
) t
ORDER BY table_name;
