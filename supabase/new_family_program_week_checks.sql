-- 정착 프로그램 주차별 개별 체크 4개 저장 (2주차 등 일부만 체크해도 저장되도록)
-- Supabase 대시보드 → SQL Editor에서 실행

ALTER TABLE new_family_program
  ADD COLUMN IF NOT EXISTS week1_checks text DEFAULT '[false,false,false,false]',
  ADD COLUMN IF NOT EXISTS week2_checks text DEFAULT '[false,false,false,false]',
  ADD COLUMN IF NOT EXISTS week3_checks text DEFAULT '[false,false,false,false]',
  ADD COLUMN IF NOT EXISTS week4_checks text DEFAULT '[false,false,false,false]';
