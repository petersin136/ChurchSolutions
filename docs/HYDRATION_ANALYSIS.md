# Hydration 에러 원인 분석

## 에러 메시지
- "Expected server HTML to contain a matching `<div>` in `<body>`"
- 컴포넌트 트리: `RootLayout` → `html` → `body` → `Providers` → `div`(기대)

## 정확한 원인

1. **`app/(auth)/login/page.tsx`**와 **`app/(auth)/register/page.tsx`**에서:
   - `dynamic(LoginForm, { ssr: false })` / `dynamic(RegisterForm, { ssr: false })` 사용
   - **`loading` 옵션을 지정하지 않음**

2. **서버 렌더 시:**
   - `ssr: false`이므로 서버는 LoginForm/RegisterForm을 **전혀 그리지 않음**
   - 대신 넣을 `loading`이 없어서 해당 자리는 **null(빈 자리)** 로 나감
   - 결과: `body` → `Providers` → `AuthProvider` → (auth layout) → **아무 DOM 없음**

3. **클라이언트 첫 렌더(hydration 시점):**
   - dynamic 청크가 아직 안 불러와졌을 때 Next/React가 **기본 placeholder**를 그리거나,
   - 곧바로 폼 컴포넌트가 그려지면서 **최상위가 `<div>`** 가 됨
   - 결과: 클라이언트는 `body` 아래에 **`<div>`가 있어야 한다**고 기대

4. **불일치:**
   - 서버 HTML: `body` 직하위에 우리가 그린 **div 없음**(null 자리)
   - 클라이언트 기대: `body` 직하위에 **일치하는 `<div>` 있음**
   - → "Expected server HTML to contain a matching `<div>` in `<body>`" 발생

## 해결
- (auth) 로그인/회원가입 페이지의 dynamic import에 **항상 같은 `loading`** 을 지정한다.
- `loading: () => <div style={{ minHeight: '100vh' }} />` 처럼 **서버·클라이언트 모두 같은 div**를 그리면, 그 자리는 Hydration 시 항상 일치한다.
