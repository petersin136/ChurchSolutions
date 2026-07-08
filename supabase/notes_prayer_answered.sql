-- 기도제목 응답 상태/일자/응답내용 컬럼 (notes 테이블)
-- Supabase SQL 에디터에서 실행 후, 앱에서 응답 체크·응답 내용이 DB에 저장됩니다.

ALTER TABLE notes
  ADD COLUMN IF NOT EXISTS answered boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS answered_at date,
  ADD COLUMN IF NOT EXISTS answered_comment text;

COMMENT ON COLUMN notes.answered IS '기도 응답 여부';
COMMENT ON COLUMN notes.answered_at IS '기도 응답 일자 (YYYY-MM-DD)';
COMMENT ON COLUMN notes.answered_comment IS '기도 응답 내용 (어떻게 응답되었는지)';

-- (선택) 기도 응답 조회용 — church_id 필터와 함께 사용
CREATE INDEX IF NOT EXISTS idx_notes_church_prayer_answered
  ON notes (church_id, member_id)
  WHERE type = 'prayer' AND answered = true;
