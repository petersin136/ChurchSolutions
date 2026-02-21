# Storage 설정 (프로필 사진 403 해결)

프로필 사진 URL이 403 Forbidden이 나오면 아래를 순서대로 확인하세요.

## 1. 버킷 공개 여부

**Supabase 대시보드 → Storage → `member-photos` 버킷**

- 버킷 선택 후 **설정(톱니바퀴)** 또는 **Bucket settings** 이동
- **Public bucket** 이 체크되어 있는지 확인
- Private이면 **Public**으로 변경 (또는 아래 RLS 정책만으로 읽기 허용 가능)

## 2. RLS 정책 추가

Public으로 바꿔도 403이면, Storage에 읽기 정책이 없을 수 있습니다.

**Supabase 대시보드 → SQL Editor** 에서 아래 파일 내용 실행:

- `supabase/member_photos_storage_policy.sql`

또는 직접 실행:

```sql
DROP POLICY IF EXISTS "Public read access for member-photos" ON storage.objects;

CREATE POLICY "Public read access for member-photos"
ON storage.objects
FOR SELECT
TO anon, authenticated
USING (bucket_id = 'member-photos');
```

## 3. 참고

- **MemberForm** (성도 수정): 클라이언트에서 업로드 후 **signed URL**을 DB에 저장 (만료 1년). Signed URL은 버킷이 Private이어도 동작합니다.
- **PastoralPage** 등 `/api/upload-photo` 사용처: **public URL**을 반환하므로, 위 1·2가 적용되어 있어야 브라우저에서 이미지가 보입니다.
