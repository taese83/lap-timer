# shared/ui — 버튼 프리미티브 (minicar-laptime)

도메인 무관 프리미티브 1/3. 나머지: `shared-feedback.md`(Banner/Toast/ConfirmDialog), `shared-states.md`(EmptyState/ErrorState/MiniCameraPreview/OnboardingCard). 색·타이포·간격 토큰은 `design-system/tokens.md`, `tokens-typography-layout-motion.md` 참조 — 값을 재정의하지 않고 토큰명만 인용한다.

## 인터랙티브 요소 기본 5상태 계약 (모든 shared 컴포넌트 공통 하한)

`design-principles-interaction-controls.md` "모든 인터랙티브 요소는 5개 상태 정의" 준수. 아래를 baseline으로 삼고 각 컴포넌트는 자신만의 추가 상태만 절에 기재한다.

| 상태 | 시각 | 트리거 |
|---|---|---|
| default | 토큰 기본값 | — |
| hover | `--color-primary-solid-hover` 등 대응 hover 토큰(터치 전용 기기는 `@media (hover: hover)` 분기, 없으면 hover 스타일 생략) | 포인터 진입 |
| active/pressed | 100ms 이내 시각 반응(눌림 톤 다운 또는 scale 0.98) | 탭/클릭 시작 |
| focus-visible | `--color-focus-ring` 2px, offset 2px, `:focus-visible`에만(마우스 클릭 시 미노출) | 키보드/스위치 포커스 |
| disabled | `--color-text-disabled`, `aria-disabled` 또는 `disabled` 속성, 클릭 무시 | prop `disabled` |

## 컴포넌트 목록 (shared/ui 전체 9개)

| 컴포넌트 | 경로 | 절 |
|---|---|---|
| `SkipLink` | `shared/ui/SkipLink.tsx` | 본 파일 |
| `AppButton` | `shared/ui/AppButton.tsx` | 본 파일 |
| `IconButton` | `shared/ui/IconButton.tsx` | 본 파일 |
| `Banner` | `shared/ui/Banner.tsx` | `shared-feedback.md` |
| `Toast` | `shared/ui/Toast.tsx` | `shared-feedback.md` |
| `ConfirmDialog` | `shared/ui/ConfirmDialog.tsx` | `shared-feedback.md` |
| `EmptyState` | `shared/ui/EmptyState.tsx` | `shared-states.md` |
| `ErrorState` | `shared/ui/ErrorState.tsx` | `shared-states.md` |
| `MiniCameraPreview` | `shared/ui/MiniCameraPreview.tsx` | `shared-states.md` |
| `OnboardingCard` | `shared/ui/OnboardingCard.tsx` | `shared-states.md` |

## SkipLink

```ts
interface SkipLinkProps {
  targetId: string;
  label?: string;   // default "본문으로 건너뛰기"
}
```

`<a href={`#${targetId}`}>`, 포커스 시만 시각 노출(default 상태는 시각적으로 숨김, focus-visible에서만 나타남).

## AppButton

```ts
type AppButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'danger';

interface AppButtonProps {
  children: React.ReactNode;           // 라벨 텍스트, "동사+결과" (예: "측정 시작")
  onClick: () => void;
  variant?: AppButtonVariant;          // default 'primary'
  size?: 'cta' | 'standard';           // cta=56px([측정 시작]/[정지]/색 칩과 통일), standard=48px
  fullWidth?: boolean;
  disabled?: boolean;
  pending?: boolean;                   // 비동기 처리 중 — 라벨 유지 + 인라인 스피너 + aria-busy="true", 재클릭 방지
  type?: 'button' | 'submit';
}
```

- `variant='danger'`는 primary 스타일 재사용 금지(`design-principles-hierarchy-actions.md`) — `--color-error-solid` 전용, 삭제 confirm에서만 사용.
- 한 컨텍스트(다이얼로그·화면 영역)당 `variant='primary'`는 정확히 1개만 배치되도록 사용처에서 보장(컴포넌트 자체는 강제하지 않음, design-reviewer 체크 대상).

## IconButton

```ts
interface IconButtonProps {
  icon: React.ReactNode;
  'aria-label': string;                // 필수 — 시각 라벨 없음
  onClick: () => void;
  pressed?: boolean;                   // aria-pressed, 토글형(예: 토치)
  disabled?: boolean;
  disabledReason?: string;             // disabled일 때 인접 caption으로 노출("이 기기에서는 지원하지 않아요") — 이유 없는 비활성 금지
  size?: 'standard' | 'cta';           // 48 / 56
}
```
