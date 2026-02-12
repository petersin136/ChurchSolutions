-- =====================================================
-- 교회 관리 시스템 — Supabase 전체 스키마
-- 프로젝트: vuozcsivojxgashexgad
-- 생성일: 2026-02-12
-- =====================================================

-- ─── 1. settings ───
CREATE TABLE IF NOT EXISTS settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  church_name TEXT NOT NULL DEFAULT '',
  depts TEXT NOT NULL DEFAULT '유아부,유치부,유년부,초등부,중등부,고등부,청년부,장년부',
  fiscal_start TEXT NOT NULL DEFAULT '1',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 2. members ───
CREATE TABLE IF NOT EXISTS members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  dept TEXT,
  role TEXT,
  birth TEXT,         -- 'YYYY-MM-DD'
  gender TEXT,        -- 'M' | 'F'
  phone TEXT,
  address TEXT,
  family TEXT,
  status TEXT DEFAULT '새가족',
  source TEXT,
  prayer TEXT,
  memo TEXT,
  mokjang TEXT,       -- 목장 이름
  photo TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 3. attendance ───
CREATE TABLE IF NOT EXISTS attendance (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  week_num INTEGER NOT NULL,
  year INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_TIMESTAMP)::INTEGER,
  status TEXT CHECK (status IN ('p', 'a', 'l', 'n')) DEFAULT 'n',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(member_id, week_num, year)
);

-- ─── 4. notes ───
CREATE TABLE IF NOT EXISTS notes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  type TEXT CHECK (type IN ('memo', 'prayer', 'visit', 'event')) DEFAULT 'memo',
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 5. plans ───
CREATE TABLE IF NOT EXISTS plans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  date TEXT NOT NULL,
  time TEXT,
  cat TEXT,
  memo TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 6. sermons ───
CREATE TABLE IF NOT EXISTS sermons (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date TEXT NOT NULL,
  service TEXT,
  bible_text TEXT,
  title TEXT,
  core TEXT,
  status TEXT DEFAULT '구상중',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 7. visits ───
CREATE TABLE IF NOT EXISTS visits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date TEXT NOT NULL,
  member_id UUID REFERENCES members(id) ON DELETE SET NULL,
  type TEXT,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 8. income ───
CREATE TABLE IF NOT EXISTS income (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date TEXT NOT NULL,
  type TEXT NOT NULL,
  amount BIGINT NOT NULL DEFAULT 0,
  donor TEXT,
  method TEXT,
  memo TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 9. expense ───
CREATE TABLE IF NOT EXISTS expense (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date TEXT NOT NULL,
  category TEXT NOT NULL,
  item TEXT,
  amount BIGINT NOT NULL DEFAULT 0,
  resolution TEXT,
  memo TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── 10. budget ───
CREATE TABLE IF NOT EXISTS budget (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  category TEXT NOT NULL,
  amount BIGINT NOT NULL DEFAULT 0,
  year INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_TIMESTAMP)::INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(category, year)
);

-- ─── 11. checklist ───
CREATE TABLE IF NOT EXISTS checklist (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  week_key TEXT NOT NULL,     -- 예: '2026-W07'
  text TEXT NOT NULL,
  done BOOLEAN DEFAULT FALSE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 인덱스
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_members_dept ON members(dept);
CREATE INDEX IF NOT EXISTS idx_members_status ON members(status);
CREATE INDEX IF NOT EXISTS idx_members_mokjang ON members(mokjang);
CREATE INDEX IF NOT EXISTS idx_attendance_member ON attendance(member_id);
CREATE INDEX IF NOT EXISTS idx_attendance_week ON attendance(week_num, year);
CREATE INDEX IF NOT EXISTS idx_notes_member ON notes(member_id);
CREATE INDEX IF NOT EXISTS idx_notes_date ON notes(date);
CREATE INDEX IF NOT EXISTS idx_visits_member ON visits(member_id);
CREATE INDEX IF NOT EXISTS idx_visits_date ON visits(date);
CREATE INDEX IF NOT EXISTS idx_income_date ON income(date);
CREATE INDEX IF NOT EXISTS idx_expense_date ON expense(date);
CREATE INDEX IF NOT EXISTS idx_checklist_week ON checklist(week_key);

-- =====================================================
-- RLS (Row Level Security)
-- =====================================================
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE sermons ENABLE ROW LEVEL SECURITY;
ALTER TABLE visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE income ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist ENABLE ROW LEVEL SECURITY;

-- anon 키로 전체 CRUD 허용 (추후 인증 추가 시 정책 변경)
CREATE POLICY "allow_all_settings"   ON settings   FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_members"    ON members    FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_attendance" ON attendance FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_notes"      ON notes      FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_plans"      ON plans      FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_sermons"    ON sermons    FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_visits"     ON visits     FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_income"     ON income     FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_expense"    ON expense    FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_budget"     ON budget     FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_checklist"  ON checklist  FOR ALL USING (true) WITH CHECK (true);

-- =====================================================
-- updated_at 자동 갱신 트리거
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_settings_updated
  BEFORE UPDATE ON settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tr_members_updated
  BEFORE UPDATE ON members
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =====================================================
-- 초기 데이터: 교회 설정
-- =====================================================
INSERT INTO settings (church_name, depts, fiscal_start)
VALUES ('은혜교회', '유아부,유치부,유년부,초등부,중등부,고등부,청년부,장년부', '1')
ON CONFLICT DO NOTHING;
