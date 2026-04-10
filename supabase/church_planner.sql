-- ============================================================
-- 교회 플래너 — DB 객체 이름
--   planner_departments, planner_places, planner_events, church_calendar
-- (앱 코드: supabase.from("planner_departments") 등)
-- Supabase SQL Editor에서 실행 (또는 마이그레이션으로 적용)
-- church_id는 TEXT (앱 localStorage의 교회 UUID 문자열과 동일)
-- ============================================================

-- ----- departments -----
CREATE TABLE IF NOT EXISTS public.planner_departments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  church_id TEXT NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#4A90D9',
  icon TEXT,
  leader_name TEXT,
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (church_id, name)
);

CREATE INDEX IF NOT EXISTS idx_planner_departments_church ON public.planner_departments(church_id);

-- ----- places -----
CREATE TABLE IF NOT EXISTS public.planner_places (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  church_id TEXT NOT NULL,
  name TEXT NOT NULL,
  capacity INT,
  equipment TEXT[],
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (church_id, name)
);

CREATE INDEX IF NOT EXISTS idx_planner_places_church ON public.planner_places(church_id);

-- ----- events -----
CREATE TABLE IF NOT EXISTS public.planner_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  church_id TEXT NOT NULL,
  title TEXT NOT NULL,
  department_id UUID REFERENCES public.planner_departments(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL DEFAULT 'event',
  start_date DATE NOT NULL,
  end_date DATE,
  start_time TIME,
  end_time TIME,
  is_all_day BOOLEAN DEFAULT false,
  place_id UUID REFERENCES public.planner_places(id) ON DELETE SET NULL,
  recurrence_rule TEXT,
  description TEXT,
  expected_people INT,
  created_by TEXT,
  is_public BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_planner_events_church ON public.planner_events(church_id);
CREATE INDEX IF NOT EXISTS idx_planner_events_start ON public.planner_events(church_id, start_date);

-- ----- church_calendar (절기 등) -----
CREATE TABLE IF NOT EXISTS public.church_calendar (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  church_id TEXT NOT NULL,
  year INT NOT NULL,
  name TEXT NOT NULL,
  date DATE NOT NULL,
  calendar_type TEXT NOT NULL DEFAULT 'holiday',
  color TEXT DEFAULT '#EF4444',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_church_calendar_church_year ON public.church_calendar(church_id, year);

-- updated_at은 앱에서 수정 시 갱신

-- ============================================================
-- RLS — 로그인 사용자는 소속 교회(church_users) 데이터만
-- ============================================================
ALTER TABLE public.planner_departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planner_places ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planner_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.church_calendar ENABLE ROW LEVEL SECURITY;

-- church_id 비교: church_users.church_id(uuid) → text
DROP POLICY IF EXISTS planner_departments_all ON public.planner_departments;
CREATE POLICY planner_departments_all ON public.planner_departments
  FOR ALL USING (
    church_id IN (SELECT cu.church_id::text FROM public.church_users cu WHERE cu.user_id = auth.uid())
  )
  WITH CHECK (
    church_id IN (SELECT cu.church_id::text FROM public.church_users cu WHERE cu.user_id = auth.uid())
  );

DROP POLICY IF EXISTS planner_places_all ON public.planner_places;
CREATE POLICY planner_places_all ON public.planner_places
  FOR ALL USING (
    church_id IN (SELECT cu.church_id::text FROM public.church_users cu WHERE cu.user_id = auth.uid())
  )
  WITH CHECK (
    church_id IN (SELECT cu.church_id::text FROM public.church_users cu WHERE cu.user_id = auth.uid())
  );

DROP POLICY IF EXISTS planner_events_all ON public.planner_events;
CREATE POLICY planner_events_all ON public.planner_events
  FOR ALL USING (
    church_id IN (SELECT cu.church_id::text FROM public.church_users cu WHERE cu.user_id = auth.uid())
  )
  WITH CHECK (
    church_id IN (SELECT cu.church_id::text FROM public.church_users cu WHERE cu.user_id = auth.uid())
  );

DROP POLICY IF EXISTS church_calendar_all ON public.church_calendar;
CREATE POLICY church_calendar_all ON public.church_calendar
  FOR ALL USING (
    church_id IN (SELECT cu.church_id::text FROM public.church_users cu WHERE cu.user_id = auth.uid())
  )
  WITH CHECK (
    church_id IN (SELECT cu.church_id::text FROM public.church_users cu WHERE cu.user_id = auth.uid())
  );

-- ============================================================
-- 기본 시드: 등록된 모든 교회에 대해 1회만 삽입
-- ============================================================
INSERT INTO public.planner_departments (church_id, name, color, sort_order)
SELECT c.id::text, v.name, v.color, v.ord
FROM public.churches c
CROSS JOIN (VALUES
  ('담임목사실', '#1B2A4A', 0),
  ('장로회', '#8B6914', 1),
  ('교육부', '#4A90D9', 2),
  ('청년부', '#6C5CE7', 3),
  ('찬양팀', '#A855F7', 4),
  ('선교부', '#22C55E', 5),
  ('봉사부', '#F59E0B', 6),
  ('여전도회', '#EC4899', 7),
  ('남선교회', '#3B82F6', 8),
  ('새가족부', '#14B8A6', 9),
  ('행정/재정', '#6B7280', 10)
) AS v(name, color, ord)
WHERE NOT EXISTS (
  SELECT 1 FROM public.planner_departments d WHERE d.church_id = c.id::text AND d.name = v.name
);

INSERT INTO public.planner_places (church_id, name, capacity, equipment, sort_order)
SELECT c.id::text, v.name, v.cap, v.eq::text[], v.ord
FROM public.churches c
CROSS JOIN (VALUES
  ('본당', 500, ARRAY['빔프로젝터','음향','영상']::text[], 0),
  ('소예배실', 80, ARRAY['빔프로젝터','음향']::text[], 1),
  ('교육관 1층', 60, ARRAY['빔프로젝터']::text[], 2),
  ('교육관 2층', 60, ARRAY['빔프로젝터']::text[], 3),
  ('친교실', 100, ARRAY[]::text[], 4),
  ('회의실', 20, ARRAY['모니터']::text[], 5)
) AS v(name, cap, eq, ord)
WHERE NOT EXISTS (
  SELECT 1 FROM public.planner_places p WHERE p.church_id = c.id::text AND p.name = v.name
);

-- 2026 절기·교회 일정 (고난주간은 기간 대표 1일 + 필요 시 별도 행 추가)
INSERT INTO public.church_calendar (church_id, year, name, date, calendar_type, color)
SELECT c.id::text, 2026, v.name, v.d::date, v.ct, v.col
FROM public.churches c
CROSS JOIN (VALUES
  ('사순절 시작', '2026-02-18', 'liturgical', '#EF4444'),
  ('종려주일', '2026-03-29', 'liturgical', '#EF4444'),
  ('고난주간', '2026-03-30', 'liturgical', '#DC2626'),
  ('부활절', '2026-04-05', 'liturgical', '#EF4444'),
  ('어린이주일', '2026-05-03', 'church', '#F59E0B'),
  ('어버이주일', '2026-05-10', 'church', '#EC4899'),
  ('맥추감사절', '2026-07-05', 'liturgical', '#22C55E'),
  ('추수감사절', '2026-11-15', 'liturgical', '#EA580C'),
  ('대림절 시작', '2026-11-29', 'liturgical', '#7C3AED'),
  ('성탄절', '2026-12-25', 'liturgical', '#EF4444')
) AS v(name, d, ct, col)
WHERE NOT EXISTS (
  SELECT 1 FROM public.church_calendar cal
  WHERE cal.church_id = c.id::text AND cal.year = 2026 AND cal.name = v.name AND cal.date = v.d::date
);
