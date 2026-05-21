-- ─────────────────────────────────────────────────────────────────────────
--  Ceremony Templates Extension Seed
--
--  기존 시드(장례·추도·심방·명절·성찬식)에 더해, 자주 사용되는 표준 식순을
--  추가한다. 각 템플릿은 시스템 템플릿(church_id NULL, is_system TRUE)으로
--  등록되어 모든 교회에서 공통으로 사용 가능.
--
--  추가 카테고리/식순:
--    - wedding      결혼예식
--    - baptism      성인 세례식 / 유아세례식 / 침례식
--    - ordination   장로 임직식 / 안수집사 임직식 / 권사 취임식
--    - newyear      송구영신예배
--    - thanksgiving 추수감사주일 예배 (기타 탭에서 노출)
--
--  멱등성: 모든 INSERT 는 (is_system, category, name) 으로 사전 존재 여부를
--  확인한 뒤 실행되므로 여러 번 실행해도 중복이 생기지 않는다.
--
--  실행: psql -f supabase/seeds/ceremony_templates_extension.sql
--        또는 Supabase SQL editor 에 붙여넣기.
-- ─────────────────────────────────────────────────────────────────────────

BEGIN;

-- ───── helper: 템플릿 멱등 INSERT (DO 블록으로 한 트랜잭션 처리) ─────
DO $$
DECLARE
  v_template_id uuid;
  v_existing uuid;
BEGIN

  -- ════════════════════════════════════════════════════════════════════
  -- 1) 결혼예식 (wedding)
  -- ════════════════════════════════════════════════════════════════════
  SELECT id INTO v_existing FROM ceremony_templates
   WHERE is_system = TRUE AND category = 'wedding' AND name = '결혼예식';
  IF v_existing IS NULL THEN
    INSERT INTO ceremony_templates
      (church_id, is_system, parent_template_id, is_customized,
       denomination, category, subtype, name, description,
       sort_order, is_active)
    VALUES
      (NULL, TRUE, NULL, FALSE,
       'common', 'wedding', NULL, '결혼예식',
       '신랑·신부의 결혼을 하나님 앞에서 언약하는 예식. 입장·서약·반지교환·축도까지 표준 11단계로 진행됩니다.',
       10, TRUE)
    RETURNING id INTO v_template_id;

    INSERT INTO ceremony_steps (template_id, step_order, title, duration_minutes, content, is_optional) VALUES
      (v_template_id, 1, '개식 선언',          1,
       jsonb_build_object(
         'leader_script', '지금부터 ○○○ 형제와 ○○○ 자매의 결혼예식을 시작하겠습니다. 모두 자리에 앉아 주시기 바랍니다.',
         'tips', '주례자가 맡습니다. 호명 후 박수가 자연스러울 수 있도록 잠시 기다린 뒤 진행.'
       ), FALSE),
      (v_template_id, 2, '신랑·신부 입장',     5,
       jsonb_build_object(
         'leader_script', '신랑 입장이 있겠습니다. (이어) 신부 입장이 있겠습니다. 모두 일어서서 두 사람을 맞아주시기 바랍니다.',
         'tips', '음악 큐는 음향팀과 사전 동선 점검. 신랑은 어머니/주례 측에서, 신부는 아버지 손을 잡고 입장하는 것이 보편적.'
       ), FALSE),
      (v_template_id, 3, '찬송',               3,
       jsonb_build_object(
         'hymn_numbers', ARRAY[604, 605]::int[],
         'tips', '604장 「주여 복을 주옵소서」 또는 605장 「오 신실하신 주」 가 보편적.'
       ), FALSE),
      (v_template_id, 4, '기도',               2,
       jsonb_build_object(
         'prayer_examples', ARRAY[
           '거룩하신 하나님, 오늘 ○○○ 형제와 ○○○ 자매를 부부로 하나 되게 하시려는 이 자리를 주께 감사드립니다. 두 사람이 평생 한 몸으로 사랑하며 주의 영광을 드러내는 가정 되게 하옵소서. 예수님의 이름으로 기도합니다. 아멘.'
         ]
       ), FALSE),
      (v_template_id, 5, '성경 봉독',          2,
       jsonb_build_object(
         'scriptures', jsonb_build_array(
           jsonb_build_object('ref', '창세기 2:24'),
           jsonb_build_object('ref', '에베소서 5:22-33'),
           jsonb_build_object('ref', '고린도전서 13:4-7')
         )
       ), FALSE),
      (v_template_id, 6, '주례 말씀',          10,
       jsonb_build_object(
         'tips', '결혼의 의미·언약·가정의 사명을 7~10분 이내로. 친근한 호칭과 한두 가지 권면.'
       ), FALSE),
      (v_template_id, 7, '혼인서약',           3,
       jsonb_build_object(
         'leader_script', '신랑 ○○○ 형제는 ○○○ 자매를 아내로 맞이하여 어떠한 형편에서도 사랑하고 존중하며, 하나님이 주신 가정을 신실하게 지킬 것을 서약합니까? — 예.\n신부 ○○○ 자매는 ○○○ 형제를 남편으로 맞이하여 어떠한 형편에서도 사랑하고 존중하며, 하나님이 주신 가정을 신실하게 지킬 것을 서약합니까? — 예.',
         'tips', '한 문장씩 끊어 또박또박 — 응답이 분명히 들리도록.'
       ), FALSE),
      (v_template_id, 8, '예물 교환 (반지)',   2,
       jsonb_build_object(
         'leader_script', '두 사람은 서로를 향한 변치 않는 사랑의 징표로 반지를 교환하겠습니다.',
         'tips', '신랑이 먼저 신부의 약지에, 다음 신부가 신랑의 약지에. 반지보관자(증인) 미리 확인.'
       ), FALSE),
      (v_template_id, 9, '성혼 선포',          1,
       jsonb_build_object(
         'leader_script', '이제 본인은 하나님의 말씀과 대한민국의 법에 따라 ○○○ 형제와 ○○○ 자매가 부부 되었음을 엄숙히 선포합니다.'
       ), FALSE),
      (v_template_id, 10,'축가 / 양가 인사',   5,
       jsonb_build_object(
         'tips', '축가 후 양가 부모님께 큰절 또는 정중한 인사.'
       ), TRUE),
      (v_template_id, 11,'축도',               2,
       jsonb_build_object(
         'leader_script', '우리 주 예수 그리스도의 은혜와 하나님의 사랑과 성령의 교통하심이 두 사람과 양가 위에 영원토록 함께 있을지어다. 아멘.'
       ), FALSE);
  END IF;

  -- ════════════════════════════════════════════════════════════════════
  -- 2) 성인 세례식 (baptism — 살수)
  -- ════════════════════════════════════════════════════════════════════
  SELECT id INTO v_existing FROM ceremony_templates
   WHERE is_system = TRUE AND category = 'baptism' AND name = '성인 세례식';
  IF v_existing IS NULL THEN
    INSERT INTO ceremony_templates
      (church_id, is_system, parent_template_id, is_customized,
       denomination, category, subtype, name, description,
       sort_order, is_active)
    VALUES
      (NULL, TRUE, NULL, FALSE,
       'common', 'baptism', 'adult_sprinkling', '성인 세례식',
       '예수 그리스도를 영접한 성도가 공적으로 신앙을 고백하고 살수(撒水)로 세례를 받는 예식. 사도신경·신앙고백 후 집례.',
       20, TRUE)
    RETURNING id INTO v_template_id;

    INSERT INTO ceremony_steps (template_id, step_order, title, duration_minutes, content, is_optional) VALUES
      (v_template_id, 1, '개식 선언',          1,
       jsonb_build_object(
         'leader_script', '지금부터 ○○○○년 ○월 ○일 ○○교회의 세례식을 거행하겠습니다.'
       ), FALSE),
      (v_template_id, 2, '찬송',               3,
       jsonb_build_object(
         'hymn_numbers', ARRAY[286, 290]::int[],
         'tips', '「주 예수 내가 알기 전」(286장) 또는 「우리는 주님을 늘 배반하나」(290장).'
       ), FALSE),
      (v_template_id, 3, '신앙고백 (사도신경)', 2,
       jsonb_build_object(
         'leader_script', '함께 사도신경으로 우리의 믿음을 고백하겠습니다.'
       ), FALSE),
      (v_template_id, 4, '성경 봉독',          2,
       jsonb_build_object(
         'scriptures', jsonb_build_array(
           jsonb_build_object('ref', '마태복음 28:18-20'),
           jsonb_build_object('ref', '사도행전 2:38-39'),
           jsonb_build_object('ref', '로마서 6:3-4')
         )
       ), FALSE),
      (v_template_id, 5, '말씀',               7,
       jsonb_build_object(
         'tips', '세례의 의미 — 옛 사람의 죽음과 새 사람의 부활, 그리스도와의 연합, 교회의 한 지체 됨.'
       ), FALSE),
      (v_template_id, 6, '수세자 호명·서약',   5,
       jsonb_build_object(
         'leader_script', '○○○ 형제(자매)는 예수 그리스도를 자신의 구주와 주로 영접하고 평생 그분을 따라 살기로 서약합니까? — 예.\n○○○ 형제(자매)는 ○○교회의 신앙고백을 받아들이고 한 지체로서 충성하기로 서약합니까? — 예.',
         'tips', '수세자가 여럿이면 한 명씩 호명 후 일괄 응답으로 진행. 명단·순서 사전 점검.'
       ), FALSE),
      (v_template_id, 7, '세례 집례 (살수)',   8,
       jsonb_build_object(
         'leader_script', '내가 성부와 성자와 성령의 이름으로 ○○○에게 세례를 베푸노라.',
         'tips', '집례자는 수세자의 머리에 세 번 물을 살수. 손수건/타월 미리 준비.'
       ), FALSE),
      (v_template_id, 8, '회중 환영',          2,
       jsonb_build_object(
         'leader_script', '온 회중은 새 가족을 마음 다해 환영해 주시기 바랍니다. (박수)'
       ), FALSE),
      (v_template_id, 9, '축도',               2,
       jsonb_build_object(
         'leader_script', '우리 주 예수 그리스도의 은혜와 하나님의 사랑과 성령의 교통하심이 세례 받은 모든 형제자매들과 우리 모두 위에 영원토록 함께 있을지어다. 아멘.'
       ), FALSE);
  END IF;

  -- ════════════════════════════════════════════════════════════════════
  -- 3) 유아세례식 (baptism — infant)
  -- ════════════════════════════════════════════════════════════════════
  SELECT id INTO v_existing FROM ceremony_templates
   WHERE is_system = TRUE AND category = 'baptism' AND name = '유아세례식';
  IF v_existing IS NULL THEN
    INSERT INTO ceremony_templates
      (church_id, is_system, parent_template_id, is_customized,
       denomination, category, subtype, name, description,
       sort_order, is_active)
    VALUES
      (NULL, TRUE, NULL, FALSE,
       'presbyterian_unified', 'baptism', 'infant', '유아세례식',
       '신앙 가정에서 자라는 유아가 부모의 서약 위에 받는 세례. 부모가 자녀를 주의 교훈과 훈계로 양육할 것을 서약합니다.',
       21, TRUE)
    RETURNING id INTO v_template_id;

    INSERT INTO ceremony_steps (template_id, step_order, title, duration_minutes, content, is_optional) VALUES
      (v_template_id, 1, '개식 선언',          1,
       jsonb_build_object(
         'leader_script', '지금부터 ○○○ 부모 자녀 ○○○의 유아세례식을 거행하겠습니다.'
       ), FALSE),
      (v_template_id, 2, '찬송',               3,
       jsonb_build_object(
         'hymn_numbers', ARRAY[563]::int[],
         'tips', '「예수 사랑하심은」(563장) 어린이도 함께 부를 수 있는 친숙한 곡 권장.'
       ), FALSE),
      (v_template_id, 3, '성경 봉독',          2,
       jsonb_build_object(
         'scriptures', jsonb_build_array(
           jsonb_build_object('ref', '마가복음 10:13-16'),
           jsonb_build_object('ref', '신명기 6:4-9')
         )
       ), FALSE),
      (v_template_id, 4, '말씀 (짧게)',        5,
       jsonb_build_object(
         'tips', '유아세례의 의미 — 언약의 자손, 부모의 책임, 교회의 양육 책임.'
       ), FALSE),
      (v_template_id, 5, '부모 서약',          4,
       jsonb_build_object(
         'leader_script', '부모 ○○○ 형제·자매는 이 자녀를 주의 교훈과 훈계로 양육하고, 신앙의 본을 보이며, 교회와 함께 그리스도의 제자로 자라도록 기르기를 서약합니까? — 예.',
         'tips', '부모가 함께 답하도록 안내.'
       ), FALSE),
      (v_template_id, 6, '세례 집례',          4,
       jsonb_build_object(
         'leader_script', '내가 성부와 성자와 성령의 이름으로 ○○○에게 세례를 베푸노라.',
         'tips', '집례자는 유아의 이마에 세 번 살수. 부모가 자녀를 안고 앞으로 모셔옴.'
       ), FALSE),
      (v_template_id, 7, '회중 서약',          2,
       jsonb_build_object(
         'leader_script', '온 회중은 이 어린 생명이 주 안에서 잘 자라도록 사랑과 기도로 함께 양육할 것을 서약합니까? — 예.'
       ), FALSE),
      (v_template_id, 8, '축복 기도',          2,
       jsonb_build_object(
         'prayer_examples', ARRAY[
           '사랑의 하나님, 오늘 ○○○를 주의 자녀로 받아 주심을 감사드립니다. 이 아이의 가는 길에 주의 빛이 비추게 하시고, 부모와 교회의 손을 통해 주의 사랑을 풍성히 경험하게 하옵소서. 예수님의 이름으로 기도합니다. 아멘.'
         ]
       ), FALSE),
      (v_template_id, 9, '축도',               2,
       jsonb_build_object(
         'leader_script', '주의 은혜와 평강이 이 아이와 가정 위에 영원토록 함께하시기를 축원합니다. 아멘.'
       ), FALSE);
  END IF;

  -- ════════════════════════════════════════════════════════════════════
  -- 4) 침례식 (baptism — immersion, baptist)
  -- ════════════════════════════════════════════════════════════════════
  SELECT id INTO v_existing FROM ceremony_templates
   WHERE is_system = TRUE AND category = 'baptism' AND name = '침례식';
  IF v_existing IS NULL THEN
    INSERT INTO ceremony_templates
      (church_id, is_system, parent_template_id, is_customized,
       denomination, category, subtype, name, description,
       sort_order, is_active)
    VALUES
      (NULL, TRUE, NULL, FALSE,
       'baptist', 'baptism', 'adult_immersion', '침례식',
       '침례교회 전통에 따라 수침자가 침례탕에 온전히 잠겼다가 일어나는 침수 침례식.',
       22, TRUE)
    RETURNING id INTO v_template_id;

    INSERT INTO ceremony_steps (template_id, step_order, title, duration_minutes, content, is_optional) VALUES
      (v_template_id, 1, '개식 선언',          1,
       jsonb_build_object('leader_script', '지금부터 ○○○○년 ○월 ○일 ○○교회의 침례식을 시작하겠습니다.'),
       FALSE),
      (v_template_id, 2, '찬송',               3,
       jsonb_build_object(
         'hymn_numbers', ARRAY[286]::int[]
       ), FALSE),
      (v_template_id, 3, '성경 봉독',          2,
       jsonb_build_object(
         'scriptures', jsonb_build_array(
           jsonb_build_object('ref', '마태복음 3:13-17'),
           jsonb_build_object('ref', '로마서 6:3-5')
         )
       ), FALSE),
      (v_template_id, 4, '말씀',               7,
       jsonb_build_object(
         'tips', '침례 — 옛 사람과 함께 장사되고 새 사람으로 일어남. 그리스도의 죽음·부활과의 연합.'
       ), FALSE),
      (v_template_id, 5, '수침자 신앙 고백',   4,
       jsonb_build_object(
         'leader_script', '○○○ 형제(자매)는 예수 그리스도를 자신의 구주로 영접하고 평생 그분을 따를 것을 고백합니까? — 예.',
         'tips', '여러 명일 경우 한 명씩 호명·응답 후 일제히 침례탕으로 이동.'
       ), FALSE),
      (v_template_id, 6, '침례 집례',          10,
       jsonb_build_object(
         'leader_script', '내가 성부와 성자와 성령의 이름으로 ○○○에게 침례를 베푸노라.',
         'tips', '집례자가 수침자의 입과 코를 가리고 뒤로 한 번 잠금. 안전·동선·온도 사전 점검.'
       ), FALSE),
      (v_template_id, 7, '회중 환영',          2,
       jsonb_build_object('leader_script', '온 교회는 새 가족을 사랑으로 맞이해 주시기 바랍니다.'),
       FALSE),
      (v_template_id, 8, '축도',               2,
       jsonb_build_object(
         'leader_script', '우리 주 예수 그리스도의 은혜와 하나님의 사랑과 성령의 교통하심이 수침한 모든 형제자매와 우리 모두 위에 영원토록 함께하시기를 축원합니다. 아멘.'
       ), FALSE);
  END IF;

  -- ════════════════════════════════════════════════════════════════════
  -- 5) 장로 임직식 (ordination — elder)
  -- ════════════════════════════════════════════════════════════════════
  SELECT id INTO v_existing FROM ceremony_templates
   WHERE is_system = TRUE AND category = 'ordination' AND name = '장로 임직식';
  IF v_existing IS NULL THEN
    INSERT INTO ceremony_templates
      (church_id, is_system, parent_template_id, is_customized,
       denomination, category, subtype, name, description,
       sort_order, is_active)
    VALUES
      (NULL, TRUE, NULL, FALSE,
       'presbyterian_unified', 'ordination', 'elder', '장로 임직식',
       '교회의 치리회 직분인 장로 임직 예식. 노회 위원이 참여하며 안수 기도로 위임합니다.',
       30, TRUE)
    RETURNING id INTO v_template_id;

    INSERT INTO ceremony_steps (template_id, step_order, title, duration_minutes, content, is_optional) VALUES
      (v_template_id, 1, '개식 선언',          1,
       jsonb_build_object('leader_script', '지금부터 ○○교회 장로 임직식을 시작하겠습니다.'),
       FALSE),
      (v_template_id, 2, '찬송',               3,
       jsonb_build_object('hymn_numbers', ARRAY[323]::int[],
         'tips', '「부름 받아 나선 이 몸」(323장)'), FALSE),
      (v_template_id, 3, '기도',               2, jsonb_build_object(), FALSE),
      (v_template_id, 4, '성경 봉독',          2,
       jsonb_build_object(
         'scriptures', jsonb_build_array(
           jsonb_build_object('ref', '디모데전서 3:1-7'),
           jsonb_build_object('ref', '베드로전서 5:1-4')
         )
       ), FALSE),
      (v_template_id, 5, '말씀',              10,
       jsonb_build_object('tips', '장로의 직분 — 양 떼를 돌보는 자, 본이 되는 자, 자원하는 마음으로 섬기는 자.'),
       FALSE),
      (v_template_id, 6, '직분자 호명·약속',   5,
       jsonb_build_object(
         'leader_script', '장로로 세움받은 ○○○ 형제는 하나님의 부르심에 응답하여 평생 양 떼를 돌보고 교회를 신실하게 섬길 것을 약속합니까? — 예.',
         'tips', '여러 명일 경우 한 명씩 호명 후 일제히 응답 / 다 함께 응답.'
       ), FALSE),
      (v_template_id, 7, '안수 기도',          8,
       jsonb_build_object(
         'tips', '노회 위원·당회원이 함께 안수. 안수 기도 인도자 1인이 대표 기도. 안수 시간 동안 회중은 묵상 기도.'
       ), FALSE),
      (v_template_id, 8, '권면',               3,
       jsonb_build_object('tips', '당회장이 짧게 직분의 권면.'), FALSE),
      (v_template_id, 9, '임직자 인사',        2, jsonb_build_object(), TRUE),
      (v_template_id, 10,'축도',               2,
       jsonb_build_object(
         'leader_script', '우리 주 예수 그리스도의 은혜와 하나님의 사랑과 성령의 교통하심이 임직된 장로들과 ○○교회 위에 영원토록 함께하시기를 축원합니다. 아멘.'
       ), FALSE);
  END IF;

  -- ════════════════════════════════════════════════════════════════════
  -- 6) 안수집사 임직식 (ordination — deacon)
  -- ════════════════════════════════════════════════════════════════════
  SELECT id INTO v_existing FROM ceremony_templates
   WHERE is_system = TRUE AND category = 'ordination' AND name = '안수집사 임직식';
  IF v_existing IS NULL THEN
    INSERT INTO ceremony_templates
      (church_id, is_system, parent_template_id, is_customized,
       denomination, category, subtype, name, description,
       sort_order, is_active)
    VALUES
      (NULL, TRUE, NULL, FALSE,
       'common', 'ordination', 'deacon', '안수집사 임직식',
       '교회의 봉사 직분인 안수집사 임직 예식. 안수 기도로 직분을 위임합니다.',
       31, TRUE)
    RETURNING id INTO v_template_id;

    INSERT INTO ceremony_steps (template_id, step_order, title, duration_minutes, content, is_optional) VALUES
      (v_template_id, 1, '개식 선언',          1, jsonb_build_object('leader_script', '지금부터 ○○교회 안수집사 임직식을 시작하겠습니다.'), FALSE),
      (v_template_id, 2, '찬송',               3,
       jsonb_build_object('hymn_numbers', ARRAY[323]::int[]), FALSE),
      (v_template_id, 3, '기도',               2, jsonb_build_object(), FALSE),
      (v_template_id, 4, '성경 봉독',          2,
       jsonb_build_object(
         'scriptures', jsonb_build_array(
           jsonb_build_object('ref', '사도행전 6:1-7'),
           jsonb_build_object('ref', '디모데전서 3:8-13')
         )
       ), FALSE),
      (v_template_id, 5, '말씀',               7,
       jsonb_build_object('tips', '집사의 직분 — 섬기는 자, 교회의 손과 발이 되어 봉사하는 자.'),
       FALSE),
      (v_template_id, 6, '직분자 호명·약속',   4,
       jsonb_build_object(
         'leader_script', '안수집사로 세움받은 ○○○ 형제(자매)는 교회와 형제자매를 신실하게 섬기기로 약속합니까? — 예.'
       ), FALSE),
      (v_template_id, 7, '안수 기도',          6,
       jsonb_build_object('tips', '당회원·노회 위원이 함께 안수, 한 명이 대표 기도.'), FALSE),
      (v_template_id, 8, '권면',               3, jsonb_build_object(), FALSE),
      (v_template_id, 9, '축도',               2,
       jsonb_build_object(
         'leader_script', '주의 은혜와 평강이 임직된 모든 안수집사와 가정과 ○○교회 위에 영원토록 함께하시기를 축원합니다. 아멘.'
       ), FALSE);
  END IF;

  -- ════════════════════════════════════════════════════════════════════
  -- 7) 권사 취임식 (ordination — woman deaconess)
  -- ════════════════════════════════════════════════════════════════════
  SELECT id INTO v_existing FROM ceremony_templates
   WHERE is_system = TRUE AND category = 'ordination' AND name = '권사 취임식';
  IF v_existing IS NULL THEN
    INSERT INTO ceremony_templates
      (church_id, is_system, parent_template_id, is_customized,
       denomination, category, subtype, name, description,
       sort_order, is_active)
    VALUES
      (NULL, TRUE, NULL, FALSE,
       'common', 'ordination', 'kwonsa', '권사 취임식',
       '교회 여성 직분인 권사 취임식. 권면 기도로 직분을 위임합니다.',
       32, TRUE)
    RETURNING id INTO v_template_id;

    INSERT INTO ceremony_steps (template_id, step_order, title, duration_minutes, content, is_optional) VALUES
      (v_template_id, 1, '개식 선언',          1, jsonb_build_object('leader_script', '지금부터 ○○교회 권사 취임식을 시작하겠습니다.'), FALSE),
      (v_template_id, 2, '찬송',               3,
       jsonb_build_object('hymn_numbers', ARRAY[323]::int[]), FALSE),
      (v_template_id, 3, '기도',               2, jsonb_build_object(), FALSE),
      (v_template_id, 4, '성경 봉독',          2,
       jsonb_build_object(
         'scriptures', jsonb_build_array(
           jsonb_build_object('ref', '로마서 16:1-2'),
           jsonb_build_object('ref', '디모데전서 5:9-10')
         )
       ), FALSE),
      (v_template_id, 5, '말씀',               7,
       jsonb_build_object('tips', '권사의 직분 — 기도와 심방으로 교회를 돕는 자.'), FALSE),
      (v_template_id, 6, '직분자 호명·약속',   4,
       jsonb_build_object(
         'leader_script', '권사로 세움받은 ○○○ 자매는 평생 기도와 섬김으로 교회를 돕기로 약속합니까? — 예.'
       ), FALSE),
      (v_template_id, 7, '권면 기도',          4,
       jsonb_build_object('tips', '담임목사 또는 당회장이 대표 기도.'), FALSE),
      (v_template_id, 8, '권면',               3, jsonb_build_object(), FALSE),
      (v_template_id, 9, '축도',               2,
       jsonb_build_object(
         'leader_script', '주의 은혜와 평강이 권사로 취임한 모든 자매들과 가정 위에 영원토록 함께하시기를 축원합니다. 아멘.'
       ), FALSE);
  END IF;

  -- ════════════════════════════════════════════════════════════════════
  -- 8) 송구영신예배 (newyear)
  -- ════════════════════════════════════════════════════════════════════
  SELECT id INTO v_existing FROM ceremony_templates
   WHERE is_system = TRUE AND category = 'newyear' AND name = '송구영신예배';
  IF v_existing IS NULL THEN
    INSERT INTO ceremony_templates
      (church_id, is_system, parent_template_id, is_customized,
       denomination, category, subtype, name, description,
       sort_order, is_active)
    VALUES
      (NULL, TRUE, NULL, FALSE,
       'common', 'newyear', NULL, '송구영신예배',
       '12월 31일 자정에 한 해를 정리하고 새해를 맞이하는 감사·결단의 예배.',
       40, TRUE)
    RETURNING id INTO v_template_id;

    INSERT INTO ceremony_steps (template_id, step_order, title, duration_minutes, content, is_optional) VALUES
      (v_template_id, 1, '개식·묵도',          2, jsonb_build_object(), FALSE),
      (v_template_id, 2, '찬송',               3,
       jsonb_build_object('hymn_numbers', ARRAY[549]::int[],
         'tips', '「내 영혼이 은총 입어」(549장) 등 한 해 감사 분위기.'), FALSE),
      (v_template_id, 3, '감사기도 (지난 한 해)', 3,
       jsonb_build_object(
         'prayer_examples', ARRAY[
           '한 해를 돌아보며 인도하신 하나님의 은혜를 감사드립니다. 모자랐던 부분, 죄악 된 부분 모두 주의 보혈로 덮어 주시고, 새해를 더욱 신실하게 살게 하옵소서. 아멘.'
         ]
       ), FALSE),
      (v_template_id, 4, '성경 봉독',          2,
       jsonb_build_object(
         'scriptures', jsonb_build_array(
           jsonb_build_object('ref', '시편 90:1-12'),
           jsonb_build_object('ref', '빌립보서 3:13-14')
         )
       ), FALSE),
      (v_template_id, 5, '말씀',              15,
       jsonb_build_object('tips', '지난 한 해 감사 + 새해 비전·말씀(예: 성구 카드 배부).'),
       FALSE),
      (v_template_id, 6, '회개·결단의 시간',   5,
       jsonb_build_object('tips', '잔잔한 음악과 함께 침묵 기도. 회중 각자 작은 메모 카드에 결단을 적도록.'), TRUE),
      (v_template_id, 7, '신년 축복 기도 (자정)', 5,
       jsonb_build_object(
         'leader_script', '○○○○년의 마지막 종을 보내고, ○○○○년의 첫 시간을 주님께 드립니다.',
         'tips', '자정 시각에 맞춰 카운트다운 → 새해 축복 기도.'
       ), FALSE),
      (v_template_id, 8, '신년 찬송',          3,
       jsonb_build_object('hymn_numbers', ARRAY[558]::int[],
         'tips', '「미더워라 주의 가정」(558장) 또는 「만복의 근원 하나님」(1장).'), FALSE),
      (v_template_id, 9, '축도',               2,
       jsonb_build_object(
         'leader_script', '새해 주의 은혜와 평강이 우리 모두와 가정과 ○○교회 위에 풍성하시기를 축원합니다. 아멘.'
       ), FALSE);
  END IF;

  -- ════════════════════════════════════════════════════════════════════
  -- 9) 추수감사주일 예배 (thanksgiving — 기타 탭에 노출됨)
  -- ════════════════════════════════════════════════════════════════════
  SELECT id INTO v_existing FROM ceremony_templates
   WHERE is_system = TRUE AND category = 'thanksgiving' AND name = '추수감사주일 예배';
  IF v_existing IS NULL THEN
    INSERT INTO ceremony_templates
      (church_id, is_system, parent_template_id, is_customized,
       denomination, category, subtype, name, description,
       sort_order, is_active)
    VALUES
      (NULL, TRUE, NULL, FALSE,
       'common', 'thanksgiving', NULL, '추수감사주일 예배',
       '한 해 동안 베푸신 은혜와 수확을 감사하는 추수감사주일 예배.',
       50, TRUE)
    RETURNING id INTO v_template_id;

    INSERT INTO ceremony_steps (template_id, step_order, title, duration_minutes, content, is_optional) VALUES
      (v_template_id, 1, '개식·묵도',          2, jsonb_build_object(), FALSE),
      (v_template_id, 2, '찬송',               3,
       jsonb_build_object('hymn_numbers', ARRAY[592]::int[],
         'tips', '「산마다 불이 탄다」(592장) 등 추수감사 찬송.'), FALSE),
      (v_template_id, 3, '대표 감사기도',      3,
       jsonb_build_object('tips', '장로 또는 안수집사가 한 해 감사 기도를 인도.'), FALSE),
      (v_template_id, 4, '성경 봉독',          2,
       jsonb_build_object(
         'scriptures', jsonb_build_array(
           jsonb_build_object('ref', '신명기 8:7-18'),
           jsonb_build_object('ref', '시편 100편'),
           jsonb_build_object('ref', '데살로니가전서 5:16-18')
         )
       ), FALSE),
      (v_template_id, 5, '말씀',              15, jsonb_build_object(), FALSE),
      (v_template_id, 6, '감사헌금 봉헌',      3,
       jsonb_build_object('tips', '추수감사주일은 헌금 봉헌이 강조됨 — 봉헌송 함께.'), FALSE),
      (v_template_id, 7, '봉헌기도',           2, jsonb_build_object(), FALSE),
      (v_template_id, 8, '광고·환영',          3, jsonb_build_object(), TRUE),
      (v_template_id, 9, '축도',               2,
       jsonb_build_object(
         'leader_script', '주의 은혜와 평강이 추수감사로 모인 우리 모두와 ○○교회 위에 영원토록 함께하시기를 축원합니다. 아멘.'
       ), FALSE);
  END IF;

END $$;

COMMIT;

-- ─────────────────────────────────────────────────────────────────────────
-- 실행 후 확인 쿼리:
--
--   SELECT category, name, is_system, sort_order
--     FROM ceremony_templates
--    WHERE is_system = TRUE
--    ORDER BY category, sort_order;
--
--   SELECT t.name, COUNT(s.id) AS step_count
--     FROM ceremony_templates t
--     LEFT JOIN ceremony_steps s ON s.template_id = t.id
--    WHERE t.is_system = TRUE AND t.category IN
--          ('wedding','baptism','ordination','newyear','thanksgiving')
--    GROUP BY t.id, t.name, t.sort_order
--    ORDER BY t.sort_order;
-- ─────────────────────────────────────────────────────────────────────────
