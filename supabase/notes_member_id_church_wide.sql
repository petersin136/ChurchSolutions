-- 교회 전체 메모/기도: member_id에 "__church__" 같은 비-UUID 값을 저장하려면
-- FK 제거 후 컬럼 타입을 text로 넓혀야 합니다(FK만 제거하면 uuid 컬럼에 문자열을 넣을 수 없음).

ALTER TABLE public.notes DROP CONSTRAINT IF EXISTS notes_member_id_fkey;

ALTER TABLE public.notes
  ALTER COLUMN member_id TYPE text USING member_id::text;
