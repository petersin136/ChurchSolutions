-- 새가족 정착 프로그램 테이블 (4주 과정)
-- Supabase SQL 에디터에서 실행하세요.

CREATE TABLE IF NOT EXISTS new_family_program (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  mentor_id uuid REFERENCES members(id) ON DELETE SET NULL,
  program_start_date date NOT NULL,
  week1_completed boolean DEFAULT false,
  week1_date date,
  week1_note text,
  week2_completed boolean DEFAULT false,
  week2_date date,
  week2_note text,
  week3_completed boolean DEFAULT false,
  week3_date date,
  week3_note text,
  week4_completed boolean DEFAULT false,
  week4_date date,
  week4_note text,
  status text DEFAULT '진행중' CHECK (status IN ('진행중', '수료', '중단')),
  cell_group_assigned text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_new_family_program_member_id ON new_family_program(member_id);
CREATE INDEX IF NOT EXISTS idx_new_family_program_mentor_id ON new_family_program(mentor_id);
CREATE INDEX IF NOT EXISTS idx_new_family_program_status ON new_family_program(status);
