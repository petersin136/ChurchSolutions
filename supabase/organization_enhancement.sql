-- ============================================
-- 권한/조직 설정 Phase 4: 조직 구조 + 역할 기반 권한 + 작업 이력
-- Supabase SQL Editor에서 실행
-- ============================================

-- ============================================
-- 1) 조직 구조 테이블
-- ============================================
CREATE TABLE IF NOT EXISTS organizations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  church_id uuid,
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('교구','구역','목장','속','전도회','선교회','부서','기타')),
  parent_id uuid REFERENCES organizations(id) ON DELETE SET NULL,
  leader_id uuid REFERENCES members(id) ON DELETE SET NULL,
  leader_name text,
  description text,
  sort_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_org_type ON organizations(type);
CREATE INDEX IF NOT EXISTS idx_org_parent ON organizations(parent_id);

-- ============================================
-- 2) 조직-교인 매핑 테이블
-- ============================================
CREATE TABLE IF NOT EXISTS organization_members (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  member_id uuid REFERENCES members(id) ON DELETE CASCADE NOT NULL,
  role_in_org text,
  joined_at date DEFAULT CURRENT_DATE,
  left_at date,
  is_active boolean DEFAULT true,
  UNIQUE(organization_id, member_id)
);

CREATE INDEX IF NOT EXISTS idx_orgmember_org ON organization_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_orgmember_member ON organization_members(member_id);

-- ============================================
-- 3) 역할/권한 테이블
-- ============================================
CREATE TABLE IF NOT EXISTS roles (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  church_id uuid,
  name text NOT NULL,
  description text,
  permissions jsonb DEFAULT '{}'::jsonb,
  is_system boolean DEFAULT false,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_roles_name ON roles(name);

INSERT INTO roles (name, description, permissions, is_system, sort_order) VALUES
  ('담임목사', '모든 권한', '{"members":{"read":true,"write":true,"delete":true},"finance":{"read":true,"write":true,"delete":true},"attendance":{"read":true,"write":true,"delete":true},"reports":{"read":true},"settings":{"read":true,"write":true},"donation_receipt":{"read":true,"write":true}}'::jsonb, true, 1),
  ('부교역자', '교적·출결 전체, 재정 읽기', '{"members":{"read":true,"write":true,"delete":false},"finance":{"read":true,"write":false,"delete":false},"attendance":{"read":true,"write":true,"delete":false},"reports":{"read":true},"settings":{"read":true,"write":false},"donation_receipt":{"read":false,"write":false}}'::jsonb, true, 2),
  ('행정간사', '교적·재정·출결 전체', '{"members":{"read":true,"write":true,"delete":false},"finance":{"read":true,"write":true,"delete":false},"attendance":{"read":true,"write":true,"delete":false},"reports":{"read":true},"settings":{"read":true,"write":false},"donation_receipt":{"read":true,"write":true}}'::jsonb, true, 3),
  ('재정담당', '재정만 전체', '{"members":{"read":true,"write":false,"delete":false},"finance":{"read":true,"write":true,"delete":true},"attendance":{"read":false,"write":false,"delete":false},"reports":{"read":true},"settings":{"read":false,"write":false},"donation_receipt":{"read":true,"write":true}}'::jsonb, true, 4),
  ('교구장', '담당 교구 교적·출결', '{"members":{"read":true,"write":true,"delete":false},"finance":{"read":false,"write":false,"delete":false},"attendance":{"read":true,"write":true,"delete":false},"reports":{"read":true},"settings":{"read":false,"write":false},"donation_receipt":{"read":false,"write":false}}'::jsonb, true, 5),
  ('구역장', '담당 구역 교적·출결', '{"members":{"read":true,"write":false,"delete":false},"finance":{"read":false,"write":false,"delete":false},"attendance":{"read":true,"write":true,"delete":false},"reports":{"read":false},"settings":{"read":false,"write":false},"donation_receipt":{"read":false,"write":false}}'::jsonb, true, 6),
  ('일반성도', '읽기만 (본인 정보)', '{"members":{"read":false,"write":false,"delete":false},"finance":{"read":false,"write":false,"delete":false},"attendance":{"read":false,"write":false,"delete":false},"reports":{"read":false},"settings":{"read":false,"write":false},"donation_receipt":{"read":false,"write":false}}'::jsonb, true, 7)
ON CONFLICT (name) DO NOTHING;

-- ============================================
-- 4) 사용자-역할 매핑
-- ============================================
CREATE TABLE IF NOT EXISTS user_roles (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  role_id uuid REFERENCES roles(id) ON DELETE CASCADE NOT NULL,
  member_id uuid REFERENCES members(id) ON DELETE SET NULL,
  assigned_organizations jsonb DEFAULT '[]'::jsonb,
  assigned_at timestamptz DEFAULT now(),
  assigned_by uuid,
  UNIQUE(user_id, role_id)
);

CREATE INDEX IF NOT EXISTS idx_userrole_user ON user_roles(user_id);

-- ============================================
-- 5) 작업 이력 (감사 로그)
-- ============================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid,
  user_name text,
  action text NOT NULL,
  target_table text,
  target_id text,
  target_name text,
  details jsonb,
  ip_address text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_table ON audit_logs(target_table);
CREATE INDEX IF NOT EXISTS idx_audit_date ON audit_logs(created_at);

-- ============================================
-- 6) 커스텀 필드 정의
-- ============================================
CREATE TABLE IF NOT EXISTS custom_fields (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  church_id uuid,
  target_table text NOT NULL,
  field_name text NOT NULL,
  field_label text NOT NULL,
  field_type text NOT NULL CHECK (field_type IN ('text','number','date','select','checkbox','textarea')),
  options jsonb,
  is_required boolean DEFAULT false,
  sort_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- ============================================
-- 7) 명칭 커스터마이징
-- ============================================
CREATE TABLE IF NOT EXISTS custom_labels (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  church_id uuid,
  default_label text NOT NULL,
  custom_label text NOT NULL,
  category text,
  UNIQUE(church_id, default_label)
);

-- ============================================
-- 8) members/income/expense 커스텀 데이터 (jsonb)
-- ============================================
ALTER TABLE members ADD COLUMN IF NOT EXISTS custom_data jsonb DEFAULT '{}';
ALTER TABLE income ADD COLUMN IF NOT EXISTS custom_data jsonb DEFAULT '{}';
ALTER TABLE expense ADD COLUMN IF NOT EXISTS custom_data jsonb DEFAULT '{}';

-- ============================================
-- 9) RLS
-- ============================================
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_labels ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Auth organizations" ON organizations;
CREATE POLICY "Auth organizations" ON organizations FOR ALL USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Auth organization_members" ON organization_members;
CREATE POLICY "Auth organization_members" ON organization_members FOR ALL USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Auth roles" ON roles;
CREATE POLICY "Auth roles" ON roles FOR ALL USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Auth user_roles" ON user_roles;
CREATE POLICY "Auth user_roles" ON user_roles FOR ALL USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Auth audit_logs" ON audit_logs;
CREATE POLICY "Auth audit_logs" ON audit_logs FOR ALL USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Auth custom_fields" ON custom_fields;
CREATE POLICY "Auth custom_fields" ON custom_fields FOR ALL USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Auth custom_labels" ON custom_labels;
CREATE POLICY "Auth custom_labels" ON custom_labels FOR ALL USING (auth.uid() IS NOT NULL);
