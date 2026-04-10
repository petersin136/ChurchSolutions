-- ============================================================
-- 교회 플래너 — 공개 테이블명: departments, places, events
-- (기존 planner_departments 등과 별도 — 새 프로젝트 또는 마이그레이션용)
-- church_id TEXT, RLS는 church_users 기준
-- ============================================================

CREATE TABLE IF NOT EXISTS public.departments (
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

CREATE INDEX IF NOT EXISTS idx_departments_church ON public.departments(church_id);

CREATE TABLE IF NOT EXISTS public.places (
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

CREATE INDEX IF NOT EXISTS idx_places_church ON public.places(church_id);

CREATE TABLE IF NOT EXISTS public.events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  church_id TEXT NOT NULL,
  title TEXT NOT NULL,
  department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL DEFAULT 'event',
  start_date DATE NOT NULL,
  end_date DATE,
  start_time TIME,
  end_time TIME,
  is_all_day BOOLEAN DEFAULT false,
  place_id UUID REFERENCES public.places(id) ON DELETE SET NULL,
  recurrence_rule TEXT,
  description TEXT,
  expected_people INT,
  created_by TEXT,
  is_public BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_events_church ON public.events(church_id);
CREATE INDEX IF NOT EXISTS idx_events_church_start ON public.events(church_id, start_date);
CREATE INDEX IF NOT EXISTS idx_events_place ON public.events(place_id);

ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.places ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS departments_church_access ON public.departments;
CREATE POLICY departments_church_access ON public.departments
  FOR ALL USING (
    church_id IN (SELECT cu.church_id::text FROM public.church_users cu WHERE cu.user_id = auth.uid())
  )
  WITH CHECK (
    church_id IN (SELECT cu.church_id::text FROM public.church_users cu WHERE cu.user_id = auth.uid())
  );

DROP POLICY IF EXISTS places_church_access ON public.places;
CREATE POLICY places_church_access ON public.places
  FOR ALL USING (
    church_id IN (SELECT cu.church_id::text FROM public.church_users cu WHERE cu.user_id = auth.uid())
  )
  WITH CHECK (
    church_id IN (SELECT cu.church_id::text FROM public.church_users cu WHERE cu.user_id = auth.uid())
  );

DROP POLICY IF EXISTS events_church_access ON public.events;
CREATE POLICY events_church_access ON public.events
  FOR ALL USING (
    church_id IN (SELECT cu.church_id::text FROM public.church_users cu WHERE cu.user_id = auth.uid())
  )
  WITH CHECK (
    church_id IN (SELECT cu.church_id::text FROM public.church_users cu WHERE cu.user_id = auth.uid())
  );
