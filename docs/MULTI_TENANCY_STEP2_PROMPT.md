# Cursor 프롬프트: 멀티테넌시 STEP 2

아래 내용을 Cursor 채팅에 복사해 붙여넣어 사용하세요.

---

## 멀티테넌시 적용 - STEP 2: 프론트엔드 코드에서 church_id 자동 포함

### 배경:
멀티테넌시 구조를 세팅했다. 모든 데이터 테이블에 church_id 컬럼이 추가되었고, 기존 데이터에는 이미 church_id가 할당되어 있다. 현재는 테스트 단계이므로 auth 로그인은 아직 없고, anon 키로 동작 중이다.

### 현재 문제:
프론트엔드 코드에서 supabase.from('테이블명').insert() 또는 .upsert()를 호출할 때 church_id를 포함하지 않고 있다. 새로 추가되는 데이터에 church_id가 NULL이 되면 나중에 교회별 데이터 격리가 안 된다.

### 수정 요청:

1. 프로젝트 전체에서 supabase.from()을 사용하는 모든 insert, upsert 호출을 찾아라.

2. 공통으로 사용할 church_id 값을 관리하는 방법을 만들어라. 지금은 테스트 단계이므로 환경변수나 설정 파일에 현재 교회 ID를 하드코딩해두는 방식으로 해라:
   - .env.local 파일에 NEXT_PUBLIC_CHURCH_ID=8096ed22-85db-435b-b80e-6fc17cae341d 추가
   - 코드에서 const churchId = process.env.NEXT_PUBLIC_CHURCH_ID 로 가져와서 사용

3. 모든 insert, upsert 호출에 church_id: churchId를 포함하도록 수정해라. 가능하면 각 파일마다 개별로 수정하지 말고, supabase 클라이언트를 래핑하는 헬퍼 함수를 만들거나, insert할 데이터에 church_id를 자동으로 추가하는 유틸 함수를 만들어서 한 곳에서 관리할 수 있도록 해라.

4. select 쿼리에도 .eq('church_id', churchId) 필터를 추가해라. 나중에 RLS가 이걸 자동으로 해주겠지만, 지금은 anon 키로 동작 중이라 RLS가 안 걸리므로 코드에서 직접 필터링해야 한다.

5. 수정 후 기존 기능(교인 등록, 출석 체크, 헌금 기록 등)이 정상 동작하는지 확인할 수 있도록, 어떤 파일의 어떤 함수를 수정했는지 목록을 정리해서 알려줘라.
