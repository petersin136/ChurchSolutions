-- 기도제목 응답 상태/일자 컬럼 추가 (notes 테이블)
-- Supabase SQL 에디터에서 실행 후, 앱에서 응답 체크 시 동기화됩니다.

ALTER TABLE notes
  ADD COLUMN IF NOT EXISTS answered boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS answered_at date;

COMMENT ON COLUMN notes.answered IS '기도 응답 여부';
COMMENT ON COLUMN notes.answered_at IS '기도 응답 일자 (YYYY-MM-DD)';
