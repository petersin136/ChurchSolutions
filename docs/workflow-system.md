# 사역흐름(Workflow) 시스템 — 도입 가이드 & 테스트 시나리오

> Planning Center People의 Workflow/WorkflowStep/WorkflowCard 컨셉을 한국 교회 운영에 맞게 재구성한 목양 자동화 시스템.

## 1. 한국식 용어 매핑

| Planning Center | Church Solutions | DB 테이블 |
|---|---|---|
| Workflow         | 사역흐름        | `workflows`           |
| Workflow Step    | 단계            | `workflow_steps`      |
| Workflow Card    | 진행카드        | `workflow_cards`      |
| Assignee         | 담당자          | `workflow_cards.assignee_id` |
| Note (per card)  | 카드 메모       | `workflow_card_notes` |

## 2. 설치 순서

1. **마이그레이션 적용** (Supabase SQL Editor 또는 CLI)
   ```bash
   psql ... -f supabase/workflow_system.sql
   ```
2. **시드 템플릿 적용**
   ```bash
   psql ... -f supabase/seeds/workflow_templates.sql
   ```
3. **앱 재시작** — `AppDataContext` 의 Realtime 구독이 `workflow_cards` 변경을 자동 반영.

## 3. 기본 템플릿 5종

| template_key          | 이름         | 단계 수 | 단계 |
|-----------------------|--------------|--------|------|
| `new_family`          | 새가족 정착  | 5 | 환영 인사 → 안내 통화 → 가정 심방 → 양육반 배정 → 정착 완료 |
| `absentee_recovery`   | 결석자 회복  | 4 | 1차 연락 → 안부 확인 → 심방 진행 → 출석 회복 |
| `baptism`             | 세례 신청    | 5 | 신청 접수 → 교리 학습 → 문답 면담 → 예식 준비 → 세례 완료 |
| `ordination`          | 임직 절차    | 6 | 후보 추천 → 자격 심사 → 교육 이수 → 시험·면접 → 공동의회 → 임직식 |
| `reactivation`        | 휴면 복귀    | 3 | 1차 연락 → 만남 → 복귀 확정 |

## 4. 권한 모델

`useWorkflowPermissions()` (src/lib/permissions.ts) 가 **canManage** 를 계산:

- `church_users.role = 'admin'` 인 사용자, **또는**
- `user_roles → roles.name ∈ ('담임목사', '부교역자', '담임', '부목사')`

`canManage = false` 인 사용자는 카드 보기·메모 작성·단계 이동은 가능하지만 **담당자 변경은 차단**됩니다.

## 5. 자동 카드 생성

| 트리거                                    | 함수                              | 출처(source)         |
|-------------------------------------------|------------------------------------|----------------------|
| 새가족 등록 (status ∈ "새가족"/"정착중")  | `ensureNewFamilyCard()`           | `auto_new_family`    |
| 결석자 행에서 "회복" 버튼 클릭            | `ensureAbsenteeRecoveryCard()`    | `auto_absentee`      |
| 사역흐름 보드의 "카드 시작" 버튼          | `createCard()`                    | `manual`             |

자동 생성은 **(member_id, workflow_id)** 의 open/snoozed 카드가 이미 있으면 **건너뜁니다** (멱등).

## 6. 감사 로그

`audit_logs.target_table = 'workflow_cards'` 에 다음 액션이 기록됩니다.

| action | details.kind | 발생 시점 |
|--------|---------------|----------|
| CREATE | -             | 카드 생성 |
| UPDATE | `move`        | 단계 이동 |
| UPDATE | `complete`    | 카드 완료 |
| UPDATE | `reopen`      | 완료 카드 재개 |
| UPDATE | `snooze`      | 보류 처리 |
| UPDATE | `reassign`    | 담당자 변경 |
| UPDATE | `drop`        | 카드 중단 |

---

## 7. 테스트 시나리오

각 항목은 *Given / When / Then* 형식. 모든 시나리오는 로그인된 상태(`authenticated`)에서 수행.

### TC-1. 마이그레이션 & RLS 동작

- **Given** `workflow_system.sql` 적용 직후
- **When** 다른 교회 사용자가 다른 church_id 의 workflow를 SELECT
- **Then** 0건 반환 (RLS `tenant_select_workflows` 가 필터링)
- **Verify**
  ```sql
  SELECT policyname FROM pg_policies
   WHERE tablename IN ('workflows','workflow_steps','workflow_cards','workflow_card_notes')
   ORDER BY tablename, policyname;
  -- 각 테이블에 tenant_(select|insert|update|delete)_* 4개씩, anon_* 0개
  ```

### TC-2. 시드 멱등성

- **Given** `workflow_templates.sql` 을 2회 연속 실행
- **Then** 각 교회당 `template_key` 기준 정확히 5개 워크플로우 + 23개 단계 (5+4+5+6+3)
- **Verify**
  ```sql
  SELECT w.name, count(s.id) FROM workflows w
  LEFT JOIN workflow_steps s ON s.workflow_id=w.id
  WHERE w.church_id = '<your church id>'
  GROUP BY w.id, w.name ORDER BY w.name;
  ```

### TC-3. 새가족 등록 → 자동 카드 생성

- **Given** "새가족 정착" 템플릿이 존재
- **When** 목양 > 성도 관리 에서 신규 멤버를 status="새가족" 으로 등록
- **Then**
  - `members` 테이블에 row INSERT
  - `workflow_cards` 에 source=`auto_new_family`, stage=`open`, current_step_id=첫 단계(환영 인사) 인 카드 1개 INSERT
  - Toast "새가족 사역흐름 카드가 생성되었습니다" 표시
  - 목양 > **사역흐름** 탭의 "새가족 정착" 보드의 첫 컬럼에 카드 노출
- **재시도 시(같은 멤버 다시 저장 X — 가입 자체가 안됨)**: 멱등성은 결석자 시나리오에서 확인.

### TC-4. 결석자 → 회복 사역흐름

- **Given** N주 이상 결석한 활동 성도 1명
- **When** 목양 > 출석부 > 결석자 관리 행의 보라 테두리 **"회복"** 버튼 클릭
- **Then**
  - `workflow_cards` 에 source=`auto_absentee`, priority=(`high` if 연속≥4 else `normal`), source_ref=`consecutive_weeks=N` 카드 1개 INSERT
  - Toast `{이름} 회복 사역흐름이 시작되었습니다` 표시
- **재클릭 시**
  - 동일 카드가 open/snoozed 상태로 살아있으므로 새 카드 생성 X
  - Toast "이미 진행 중이거나 템플릿이 없습니다" 표시

### TC-5. 단계 이동(Promote)

- **Given** 사역흐름 보드에서 카드 1개 클릭 → 모달 오픈
- **When** "다음 단계 →" 클릭
- **Then**
  - `current_step_id` 이 sort_order 다음 단계로 UPDATE
  - **트리거** `trg_workflow_cards_transitions` 가 `moved_to_step_at = now()` 자동 갱신
  - `audit_logs` 에 action=UPDATE, details.kind=`move` 기록
  - 보드 화면에서 카드가 다음 컬럼으로 이동
- **Verify (DB)**
  ```sql
  SELECT id, current_step_id, moved_to_step_at FROM workflow_cards WHERE id='<card-id>';
  SELECT action, details FROM audit_logs WHERE target_id='<card-id>' ORDER BY created_at DESC LIMIT 3;
  ```

### TC-6. 마지막 단계 완료(Auto-complete)

- **Given** 카드의 current step 이 sort_order = 마지막-1 단계
- **When** "다음 단계 →" 클릭 (다음 단계가 `is_terminal=true` 일 때)
- **Then**
  - `current_step_id` 이 마지막 단계로 이동 후 즉시
  - `stage = 'completed'` 로 UPDATE
  - **트리거**가 `completed_at = now()` 자동 설정
  - 보드에서 (showCompleted 체크 시) 마지막 컬럼에 ✓ 완료 표시

### TC-7. 보류(Snooze)

- **Given** 모달 열린 카드
- **When** 날짜 선택 후 "보류" 클릭
- **Then**
  - `stage='snoozed'`, `snooze_until=<선택일>`
  - 보드 카드에 노란색 "보류" 뱃지 노출

### TC-8. 담당자 변경 권한 게이팅

- **Given (관리자)** church_users.role=`admin` 사용자가 카드 모달 열기
- **Then** "나에게 배정" 버튼 활성, 클릭 시 assignee 변경 + Toast OK
- **Given (일반 사용자)** role 이 admin/담임/부교역자 아님
- **When** "나에게 배정" 클릭 시도
- **Then** 버튼 disabled (hover title="권한 없음...")

### TC-9. 메모 추가 & 카드 메모 RLS

- **When** 모달 하단 textarea 에 메모 입력 → "추가" 클릭
- **Then**
  - `workflow_card_notes` row INSERT (author_id=현재 user, step_id=current_step_id)
  - 모달 메모 리스트 최상단에 즉시 추가
- **RLS 확인**
  ```sql
  -- 다른 교회 사용자로 로그인 후
  SELECT * FROM workflow_card_notes WHERE card_id='<other-church-card-id>';  -- 0건
  ```

### TC-10. Realtime 반영

- **Given** 두 브라우저 창에서 같은 교회로 로그인, 둘 다 사역흐름 보드 열기
- **When** 한쪽에서 카드 단계 이동
- **Then** 다른 쪽 보드가 자동 새로고침되어 카드 위치 갱신 (디바운스 500ms)

### TC-11. anon-all 정책 없음 확인

```sql
SELECT count(*) FROM pg_policies
 WHERE tablename IN ('workflows','workflow_steps','workflow_cards','workflow_card_notes')
   AND roles && ARRAY['anon']::name[];
-- 결과: 0
```

### TC-12. church_id 누락 INSERT 차단

```sql
-- 일반 사용자가 직접 SQL 으로 church_id 없이 INSERT 시도
INSERT INTO workflow_cards (workflow_id, member_name, stage, priority)
VALUES ('<wf>', '테스트', 'open', 'normal');
-- ERROR: null value in column "church_id" of relation "workflow_cards" violates not-null constraint
```

### TC-13. 클라이언트 helper 의 church_id 자동 주입

`createCard()` → `withChurchId({...})` 로 자동 주입되므로 호출부에서 누락 시에도 안전.

```ts
// 호출 시 church_id 를 넘기지 않는다.
await createCard({
  workflowId, member: { id, name }, source: "manual",
});
// → INSERT 시 church_id 가 localStorage 기반으로 자동 채워짐.
```

---

## 8. 알려진 한계 / 후속 작업

- 드래그 앤 드롭 미지원 (현재는 모달 내 버튼으로 단계 이동) — react-dnd 통합은 다음 단계.
- `auto_promote_days` 자동 진행은 스키마만 준비. 실제 자동 진행은 추후 Cron(예: Supabase Edge Function) 으로 구현.
- 알림 연동(카카오톡/문자) 미구현. `MessageSender`/`messaging` 모듈과 결합 가능.
- 권한 UI는 일단 "차단" 까지만. 권한 신청·승인 UX는 별도 작업.
