# 사역흐름 시스템 검증 시나리오

> **목적**: Church Solutions 의 사역흐름(workflow) 시스템 전체 기능을 사용자 입장에서 **클릭만으로** 검증할 수 있도록 정리한 시나리오 모음.
> 각 항목은 *사전 조건 → 클릭 단계 → 예상 결과 → 검증 SQL → 실패 시 점검 포인트* 순서로 구성되어 있습니다.

---

## 0. 사전 준비

### 0-1. Supabase 마이그레이션·시드 실행 여부 확인

다음 SQL 파일들이 모두 한 번 이상 실행되어 있어야 합니다 (실행 순서 중요).

| 순서 | 파일 | 역할 |
|---|---|---|
| 1 | `supabase/workflow_system.sql` | 테이블 4종(workflows, workflow_steps, workflow_cards, workflow_card_notes) + RLS + 트리거 |
| 2 | `supabase/seeds/workflow_templates.sql` | 5종 기본 템플릿(교회당 5개) + 단계(교회당 23개) 시드 |
| 3 | `supabase/workflow_checklists.sql` | `checklist_items` / `checklist_state` JSONB 컬럼 + 4종 템플릿 체크리스트 시드 |
| 4 | `supabase/cascade_all_church_fks.sql` | 모든 자식 테이블 FK 를 `ON DELETE CASCADE` 로 통일 |

#### 검증 SQL

```sql
-- (1) 테이블 4종이 존재하는지
SELECT to_regclass('public.workflows'),
       to_regclass('public.workflow_steps'),
       to_regclass('public.workflow_cards'),
       to_regclass('public.workflow_card_notes');
-- 결과: 4개 모두 NULL 이 아니어야 함

-- (2) 활성 사역흐름 수 = 교회 수 × 5
SELECT COUNT(*) AS active_workflows,
       (SELECT COUNT(*) FROM public.churches) * 5 AS expected
  FROM public.workflows
 WHERE is_active = true;

-- (3) 체크리스트가 채워진 단계 수 = 교회 수 × 18 (new_family 제외 4+5+6+3)
SELECT COUNT(*) AS checklisted_steps,
       (SELECT COUNT(*) FROM public.churches) * 18 AS expected
  FROM public.workflow_steps s
  JOIN public.workflows w ON w.id = s.workflow_id
 WHERE w.template_key IN ('absentee_recovery','baptism','ordination','reactivation')
   AND s.checklist_items <> '[]'::jsonb;

-- (4) FK CASCADE 통일 확인 (church_id 참조 FK 중 NO ACTION 인 것)
SELECT tc.table_name, tc.constraint_name, rc.delete_rule
  FROM information_schema.referential_constraints rc
  JOIN information_schema.table_constraints tc
    ON tc.constraint_name = rc.constraint_name
 WHERE rc.unique_constraint_name LIKE '%churches%pkey%'
   AND rc.delete_rule <> 'CASCADE';
-- 결과: 0건이어야 함
```

### 0-2. 로그인·교회 소속 확인

- 활성 교회(예: **건강한교회** 또는 **그날미니스트리**) 소속 계정으로 로그인.
- localStorage 확인: `church_solution_church_id` 가 UUID 로 채워져 있어야 함.

```sql
-- 본인이 매핑된 교회·역할 한눈에 보기
SELECT cu.user_id, c.name AS church, cu.role
  FROM public.church_users cu
  JOIN public.churches c ON c.id = cu.church_id
 WHERE cu.user_id = auth.uid();
```

### 0-3. 권한 확인

다음 중 **하나 이상**을 보유해야 담당자 배정·중단 등 관리 액션이 가능합니다.

- `church_users.role = 'admin'`, **또는**
- `user_roles → roles.name ∈ ('담임목사', '부교역자', '담임', '부목사')`

```sql
-- 본인의 canManage 산정 근거
SELECT 'church_users.admin' AS source, COUNT(*) AS hit
  FROM public.church_users
 WHERE user_id = auth.uid() AND role = 'admin'
UNION ALL
SELECT 'user_roles.고위역할', COUNT(*)
  FROM public.user_roles ur
  JOIN public.roles r ON r.id = ur.role_id
 WHERE ur.user_id = auth.uid()
   AND r.name IN ('담임목사', '부교역자', '담임', '부목사');
```

`hit` 합계가 0 이면 사역흐름 보드는 보이지만 일부 버튼이 비활성화됩니다 (이는 정상 동작).

---

## 1. 사역흐름 보드 진입

### 시나리오
- 좌측 사이드바 **목양 → 사역흐름** 메뉴 클릭.

### 예상 결과
- 상단에 헤더("사역흐름") + `+ 카드 추가` 버튼.
- 가로 탭 4개(`new_family` 제외 — 결석자 회복 / 세례 신청 / 임직 절차 / 휴면 복귀).
- 4개의 요약 카드 (진행중 / 완료 / 보류 / 중단).
- 5개의 필터 칩 (전체 / 진행중 / 완료 / 보류 / 중단).
- 카드 0개면 "등록된 카드가 없습니다." + `+ 카드 추가` 버튼.

### 검증 SQL

```sql
-- 본 교회에서 사역흐름 보드에 노출되어야 할 사역흐름 (= 4개)
SELECT name, template_key
  FROM public.workflows
 WHERE church_id = (SELECT id FROM public.churches WHERE name = '건강한교회')
   AND is_active = true
   AND template_key <> 'new_family'
 ORDER BY template_key;
```

### 실패 시 점검
- 탭이 5개 나오면 → `WorkflowBoard.tsx` 의 `getVisibleWorkflows` 미적용. (작업 5 점검)
- 탭이 0개면 → `workflow_templates.sql` 시드 미실행 또는 `is_active=false`.

---

## 2. 카드 추가 모달 (수동 생성)

### 시나리오
1. 보드 상단 `+ 카드 추가` 클릭.
2. **사역흐름 선택** 드롭다운 → "세례 신청".
3. **대상 성도** 드롭다운(검색 가능) → 임의 성도 이름 검색 후 선택.
4. **우선순위** = 보통.
5. **마감일** = (선택) 캘린더에서 2주 뒤 날짜.
6. **초기 메모** = "테스트 카드".
7. `카드 시작` 클릭.

### 예상 결과
- 모달이 닫히고, 보드의 "전체" 필터에 새 카드 1개가 최상단(`created_at DESC`) 노출.
- 좌측 아바타 = 성도 이름 첫 글자, 중앙에 이름·시작일·담당·현재 단계 "신청 접수".
- 진행바 = 1/5 단계 (20%), 우측 상태 뱃지 = **진행중** (파란색).
- 토스트 "진행카드가 생성되었습니다."

### 검증 SQL

```sql
SELECT c.member_name, c.stage, s.name AS current_step, c.priority, c.due_date, c.source
  FROM public.workflow_cards c
  JOIN public.workflow_steps s ON s.id = c.current_step_id
 WHERE c.church_id = (SELECT id FROM public.churches WHERE name = '건강한교회')
   AND c.member_name = '<선택한 성도명>'
 ORDER BY c.created_at DESC LIMIT 1;
-- 결과: stage='open', current_step='신청 접수', priority='normal', source='manual'
```

### 실패 시 점검
- 멤버 드롭다운이 비어있음 → `useAppData().db.members` 가 비어있는 상태. 다른 페이지에서 멤버 로딩 확인.
- 카드 시작 후 카드가 안 보임 → Realtime 구독 미작동. F5 새로고침 시 보이면 Realtime 문제.

---

## 3. 카드 상세 모달 — 체크리스트·완료일·메모

### 시나리오
1. 보드에서 위에서 만든 카드 클릭.
2. 상단 헤더에서 이름·시작일·담당자 미배정 표시 확인.
3. 우측 `담당자 배정` 클릭 → 토스트 "담당자가 나로 변경되었습니다."
4. 첫 번째 단계 카드("신청 접수")에서:
   - 체크박스 4개 모두 체크.
   - **완료일** 캘린더에서 오늘 날짜 선택.
   - 메모 textarea 에 "신청서 접수 완료" 입력.
5. 푸터의 `저장` 클릭.

### 예상 결과
- 좌측 단계 번호 동그라미가 1 → ✓ (녹색) 으로 변경.
- current_step 이 자동으로 2단계 "교리 학습" 으로 전진.
- 토스트 "저장되었습니다.".
- 모달 닫지 않은 상태에서 헤더의 시작일·담당자가 갱신 반영.

### 검증 SQL

```sql
SELECT c.member_name,
       s.name AS current_step,
       jsonb_pretty(c.checklist_state) AS state
  FROM public.workflow_cards c
  JOIN public.workflow_steps s ON s.id = c.current_step_id
 WHERE c.id = '<카드 id>';
-- 결과 예:
--   current_step = '교리 학습'
--   state.items.baptism_1_1..4 = true
--   state.step_dates."<step1 id>" = 오늘 날짜
--   state.step_notes."<step1 id>" = "신청서 접수 완료"
```

### 실패 시 점검
- `저장` 버튼이 회색(비활성)이면 → 변경사항이 dirty 로 감지 안 됨. 체크박스 한 번 더 클릭 후 재시도.
- `완료 처리` 가 활성화되지 않는 게 정상(아직 5단계 모두 done 아님).

---

## 4. 단계 자동 전진 & 완료 처리

### 시나리오
1. 같은 카드를 다시 열어 2~5단계의 체크박스·완료일을 모두 채운다 (메모는 선택).
2. 매번 `저장` 클릭 → 단계가 한 칸씩 자동 전진.
3. 5단계까지 모두 완료 후 `완료 처리` 버튼이 활성화되면 클릭.

### 예상 결과
- 토스트 "사역흐름을 완료 처리했습니다.".
- 모달 자동 닫힘.
- 보드 카드의 진행바 = **5/5 단계 (100%)**, 상태 뱃지 = **완료** (녹색).
- 요약 카드 "완료" 카운트 +1.

### 검증 SQL

```sql
SELECT stage, completed_at, current_step_id
  FROM public.workflow_cards
 WHERE id = '<카드 id>';
-- 결과: stage='completed', completed_at IS NOT NULL

-- 감사 로그 흐름 확인
SELECT created_at, action, details->>'kind' AS kind
  FROM public.audit_logs
 WHERE target_table = 'workflow_cards'
   AND target_id = '<카드 id>'
 ORDER BY created_at;
-- 결과: complete_with_checklist 가 마지막에 기록되어야 함
```

### 실패 시 점검
- `완료 처리` 가 끝까지 회색이면 → 어느 단계 1개라도 (체크 4/4 + 완료일) 조건이 빠진 것. UI 에서 각 단계 동그라미가 ✓ 로 바뀌었는지 확인.

---

## 5. 보류 / 중단 / 재개

### 시나리오 A — 보류
1. 새로운 진행중 카드의 모달을 연다.
2. 푸터 좌측의 `보류` 클릭.
3. 보드로 돌아가 "보류" 필터 칩 클릭.

### 예상 결과
- 카드 우측 뱃지 = **보류** (노란색).
- `workflow_cards.stage = 'snoozed'`, `snooze_until = 오늘+7일`.
- 모달 푸터에 `보류/중단` 대신 `재개` 버튼만 노출.

### 시나리오 B — 중단
1. 다른 카드의 모달에서 `중단` 클릭 → 확인 다이얼로그 → 확인.

### 예상 결과
- 모달 닫힘, 보드 "전체"에서 카드 보이지 않음, "중단" 필터에서는 보임.
- 우측 뱃지 = **중단** (빨간색).

### 시나리오 C — 재개
1. 보류 또는 중단된 카드를 열어 `재개` 클릭.

### 예상 결과
- `stage = 'open'`, `snooze_until = NULL` 로 되돌아가 진행중 필터에서 다시 보임.

### 검증 SQL

```sql
SELECT id, stage, snooze_until
  FROM public.workflow_cards
 WHERE id IN ('<보류 카드 id>', '<중단 카드 id>', '<재개 카드 id>');
```

---

## 6. 결석자 관리 → 회복 사역흐름 시작

### 시나리오
1. 좌측 사이드바 **출석 → 결석자 관리**.
2. 결석자 목록에서 임의의 1명 행의 우측 `회복 시작` 버튼 클릭.
3. (자동) `WorkflowTemplatePicker` 가 `결석자 회복` 템플릿 + 해당 성도 preset 상태로 열림.
4. 메모 입력 후 `카드 시작` 클릭.

### 예상 결과
- 모달 제목이 "**결석자 회복 카드 시작**" 으로 표시 (사역흐름 선택 영역 자체가 사라짐).
- 대상 영역은 성도 이름이 읽기 전용 박스로 표시.
- 카드 생성 후 picker 자동 닫힘 → **WorkflowCardModal 이 즉시 열림**.

### 시나리오 B — 중복 방지
1. 동일 성도에 대해 다시 `회복 시작` 클릭.

### 예상 결과
- picker 가 **열리지 않고**, 토스트 "이미 진행 중인 회복 사역흐름이 있습니다.".
- 기존 카드의 상세 모달이 그대로 열림.

### 시나리오 C — 권한 없음
- `canManage = false` 인 계정으로 같은 버튼을 보면 회색·`disabled` 상태이며 hover 시 "권한이 없습니다" 툴팁.

### 검증 SQL

```sql
SELECT c.member_name, c.stage, c.source, c.source_ref
  FROM public.workflow_cards c
  JOIN public.workflows w ON w.id = c.workflow_id
 WHERE c.member_name = '<해당 성도명>'
   AND w.template_key = 'absentee_recovery'
 ORDER BY c.created_at DESC;
-- 결과: source='absentee_management' 로 기록되어야 함
```

### 실패 시 점검
- picker 가 아예 안 열림 → `workflows.template_key='absentee_recovery'` 시드 미실행. 토스트 메시지로 안내됨.
- 다른 교회의 성도가 검색됨 → RLS 미적용. `0-1` SQL 재확인.

---

## 7. 새가족 등록 → 정착 프로그램·사역흐름 자동화

### 시나리오 A — 성도 관리(`MemberForm`) 경로
1. **성도 관리 → 새 성도 추가** → 섹션 4 "새가족 정보" 의 **새가족** 체크박스 ON → 첫 방문일·이름 등 입력 → 저장.

### 예상 결과
- 토스트 2개:
  1. "저장되었습니다." (또는 기본 등록 토스트)
  2. **"정착 프로그램이 시작되었습니다 (4주 과정)"** (✨ 작업 B 결과)
- 목양 탭 > 새가족 관리에서 해당 성도가 4주 과정 카드로 표시됨.

### 시나리오 B — 목양 탭 등록 경로
1. **목양 → 성도** → 등록 모달에서 상태(`fStatus`)를 "새가족" 또는 "정착중" 으로 지정 후 저장.

### 예상 결과
- 로컬 state 에 `newFamilyPrograms` 행 추가 → 이후 `saveDb` 흐름에서 Supabase 반영.
- `ensureNewFamilyCard` 호출은 **제거됨** (작업 A). 사역흐름 보드에 카드 생성 안 됨 — 이는 의도된 동작 (UI 에서 `new_family` 숨김 처리와 정합).

### 검증 SQL

```sql
-- A 경로: 즉시 Supabase 반영
SELECT m.name, p.program_start_date, p.status
  FROM public.members m
  JOIN public.new_family_program p ON p.member_id = m.id
 WHERE m.name = '<MemberForm 으로 등록한 새가족 이름>'
 ORDER BY p.created_at DESC LIMIT 1;
-- 결과: 1행 — status='진행중', mentor_id IS NULL

-- 워크플로우 카드는 새가족용으로 자동 생성되지 않아야 함
SELECT count(*) AS new_family_cards
  FROM public.workflow_cards c
  JOIN public.workflows w ON w.id = c.workflow_id
 WHERE w.template_key = 'new_family'
   AND c.member_id = (SELECT id FROM public.members WHERE name='<위 이름>' LIMIT 1);
-- 결과: 0 이어야 함 (작업 A 효과)
```

### 실패 시 점검
- A 경로에서 "정착 프로그램…" 토스트가 안 뜸 → `is_new_family` 체크박스가 OFF 였거나, `new_family_program` 테이블에 INSERT 권한 없음(RLS). 콘솔에 `[MemberForm] new_family_program 자동 생성 실패` 경고가 찍힘.

---

## 8. `new_family` 템플릿이 UI 에서 숨겨지는지

### 시나리오
1. 보드 상단 가로 탭이 **4개**인지 확인 (5개가 아님).
2. `+ 카드 추가` 모달의 사역흐름 드롭다운에 "새가족 정착" 이 **없어야** 함.

### 검증 SQL

```sql
-- DB 상에는 5개가 살아있되, UI helper 가 4개만 노출
SELECT template_key, name, is_active
  FROM public.workflows
 WHERE church_id = (SELECT id FROM public.churches WHERE name='건강한교회')
 ORDER BY template_key;
-- 결과 5행, new_family 도 is_active=true 로 존재해야 함
```

UI 가 5개를 모두 보여주면 → `src/lib/workflow.ts` 의 `getVisibleWorkflows` 가 적용 안 된 컴포넌트가 있음.  
호출하는 컴포넌트는 `WorkflowBoard.tsx` / `WorkflowTemplatePicker.tsx` 두 곳뿐 (`presetTemplateKey` 가 있는 picker 호출은 우회 — 정상).

---

## 9. 담당자 배정 권한 분리

### 시나리오
1. `canManage = false` 계정(일반 성도 또는 매핑 없는 계정)으로 로그인.
2. 카드 상세 모달을 연다.

### 예상 결과
- `담당자 배정` 버튼이 회색·`disabled`, hover 시 "권한 없음 (관리자/담임/부교역자만)" 툴팁.
- 체크리스트 입력·저장은 **가능** (canEdit = true 이므로).

### 검증 SQL

```sql
-- 담당자 변경 직전/직후 audit_logs 비교
SELECT * FROM public.audit_logs
 WHERE target_table = 'workflow_cards'
   AND details->>'kind' = 'reassign'
   AND target_id = '<카드 id>'
 ORDER BY created_at DESC LIMIT 5;
```

### 실패 시 점검
- 권한 없는 계정에서도 담당자가 변경되면 → RLS 미적용 또는 `useWorkflowPermissions` 훅 결과 잘못. 9-1 권한 SQL 결과 재확인.

---

## 10. Realtime 동기화 (멀티 탭)

### 시나리오
1. 같은 브라우저의 두 탭에서 동일 사역흐름 보드 페이지를 연다.
2. **탭 A**: 새 카드를 생성.
3. **탭 B**: 새로고침 없이 잠시 대기.

### 예상 결과
- 탭 B 의 보드에 **자동으로** 카드가 추가됨 (1~3초 이내).
- 요약 카드 카운트도 함께 갱신됨.

### 검증 절차
- 브라우저 콘솔에서 `[AppData] realtime change: workflow_cards` 로그가 탭 B 에 찍히는지 확인.

### 실패 시 점검
- `AppDataContext.tsx` 의 `WATCHED_TABLES` 에 `workflow_cards`, `workflows`, `workflow_steps` 가 포함되어 있어야 함.

---

## 11. 멀티 테넌시 격리 (다른 교회 데이터 미노출)

### 시나리오
1. 교회 A 의 사역흐름 카드 ID 를 임의로 복사.
2. 교회 B 계정으로 로그인 후 URL 또는 API 직접 호출로 그 ID 카드를 조회 시도.

### 예상 결과
- 카드 모달 열림 → 본문이 비어있고 즉시 닫힘 (`card == null` 분기).
- Supabase 응답에 데이터 없음(`data: []`) → RLS 가 차단.

### 검증 SQL

```sql
-- A 교회의 카드 1개 id 를 복사 후, B 교회 계정에서:
SELECT * FROM public.workflow_cards WHERE id = '<A 교회 카드 id>';
-- 결과: 0행
```

### 실패 시 점검
- 결과가 1행 나오면 RLS 가 무력화된 상태. `workflow_system.sql` 의 `ALTER TABLE … ENABLE ROW LEVEL SECURITY` 블록 재실행.

---

## 12. 감사 로그 (`audit_logs`)

### 시나리오
하루 동안 사역흐름에서 일어난 모든 액션을 한 화면에서 확인.

### 검증 SQL

```sql
SELECT created_at,
       action,
       details->>'kind' AS kind,
       target_name AS member,
       user_name
  FROM public.audit_logs
 WHERE target_table = 'workflow_cards'
   AND created_at >= now() - interval '1 day'
 ORDER BY created_at DESC;
```

### 기대 kind 값

| kind | 발생 시점 |
|---|---|
| (action=CREATE) | 카드 생성 (`createCard`) |
| `move` | 단계 이동 (`moveCardToStep`) |
| `complete` | 단계 푸시 또는 모달의 직접 완료 |
| `complete_with_checklist` | 모달 "완료 처리" |
| `save_checklist` | 모달 "저장" (완료 아님) |
| `snooze` | 보류 |
| `reopen` | 재개 |
| `drop` | 중단 |
| `reassign` | 담당자 변경 |

---

## 부록 A. 자주 쓰는 검증 SQL 모음

```sql
-- A1. 본 교회의 진행 중 카드 한눈에 보기 (요약)
SELECT w.name AS workflow,
       s.name AS step,
       c.stage,
       c.member_name,
       c.assignee_name,
       c.created_at::date AS started
  FROM public.workflow_cards c
  JOIN public.workflows      w ON w.id = c.workflow_id
  LEFT JOIN public.workflow_steps s ON s.id = c.current_step_id
 WHERE c.church_id = (SELECT id FROM public.churches WHERE name='건강한교회')
 ORDER BY c.created_at DESC;

-- A2. 단계별 평균 체류 시간 (overdue 분석용)
SELECT s.name,
       s.expected_days,
       round(avg(EXTRACT(EPOCH FROM now() - c.moved_to_step_at)/86400)::numeric, 1) AS avg_days
  FROM public.workflow_cards c
  JOIN public.workflow_steps s ON s.id = c.current_step_id
 WHERE c.stage = 'open'
 GROUP BY s.id, s.name, s.expected_days
 ORDER BY avg_days DESC NULLS LAST;

-- A3. 담당자별 진행 카드 부하
SELECT coalesce(assignee_name, '(미배정)') AS assignee, count(*) AS open_cards
  FROM public.workflow_cards
 WHERE stage IN ('open','snoozed')
 GROUP BY assignee_name
 ORDER BY open_cards DESC;

-- A4. 체크리스트 항목 정의 확인 (template_key + step 명)
SELECT w.template_key, s.sort_order, s.name AS step,
       jsonb_array_length(s.checklist_items) AS items
  FROM public.workflow_steps s
  JOIN public.workflows w ON w.id = s.workflow_id
 WHERE w.church_id = (SELECT id FROM public.churches WHERE name='건강한교회')
 ORDER BY w.template_key, s.sort_order;
```

---

## 부록 B. 트러블슈팅

| 증상 | 의심 원인 | 해결 |
|---|---|---|
| 보드 탭이 비어있음 | `workflow_templates.sql` 미실행, 또는 `is_active=false` | 시드 재실행, `UPDATE workflows SET is_active=true` |
| 같은 템플릿이 같은 교회에서 중복 표시 | `(church_id, template_key)` UNIQUE 인덱스 누락 | `supabase/fix_duplicate_workflows.sql` 실행 |
| 카드 모달의 체크박스가 안 보임 | `workflow_checklists.sql` 미실행 또는 잘못된 template_key | A4 SQL 로 items > 0 확인 |
| 보드에 "활성화된 사역흐름이 없습니다" | 본 교회용 시드가 안 생성되어 있음 (회원 가입 직후 등) | `workflow_templates.sql` 재실행 (멱등) |
| 결석자 회복 카드 생성 후 모달이 안 뜸 | `onCreated` 콜백 미연결 | `AbsenteeManagement.tsx` 에서 `handleCardCreated` 가 `setCardModalId` 호출하는지 점검 |
| `new_family` 템플릿이 보드 탭에 표시됨 | `getVisibleWorkflows` 미적용 | `WorkflowBoard.tsx` / `WorkflowTemplatePicker.tsx` 에서 헬퍼 사용 여부 확인 |
| Realtime 으로 카드가 갱신되지 않음 | `WATCHED_TABLES` 에 누락 / Supabase Realtime 비활성화 | `AppDataContext.tsx` 점검, Supabase 대시보드 → Database → Replication 활성화 확인 |
| 다른 교회의 카드가 보임 | RLS 미적용 | `workflow_system.sql` 의 RLS 블록 재실행 |

---

## 부록 C. 정합성 빠른 체크 (한 줄)

전체 카드 수 / 단계별 카운트 / 최근 1시간 활동을 한 번에:

```sql
WITH stats AS (
  SELECT
    (SELECT count(*) FROM public.workflows WHERE is_active=true)              AS active_workflows,
    (SELECT count(*) FROM public.workflow_steps)                              AS steps,
    (SELECT count(*) FROM public.workflow_steps WHERE checklist_items<>'[]') AS checklisted_steps,
    (SELECT count(*) FROM public.workflow_cards)                              AS total_cards,
    (SELECT count(*) FROM public.workflow_cards WHERE stage='open')           AS open_cards,
    (SELECT count(*) FROM public.workflow_cards WHERE stage='completed')      AS completed_cards,
    (SELECT count(*) FROM public.workflow_cards WHERE stage='snoozed')        AS snoozed_cards,
    (SELECT count(*) FROM public.workflow_cards WHERE stage='dropped')        AS dropped_cards,
    (SELECT count(*) FROM public.audit_logs
       WHERE target_table='workflow_cards' AND created_at >= now() - interval '1 hour') AS recent_actions
)
SELECT * FROM stats;
```
