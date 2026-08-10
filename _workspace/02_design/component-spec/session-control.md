# features/session-control — 측정 화면 (최대 상세)

측정 시작/정지/토치/재무장/라이브 타이머/상태 배너. `layout-spec.md` §3.2가 이 화면을 "최대 상세"로 지정했으므로 상태 머신·모션·접근성 계약을 코드 수준으로 명세한다. 모션 수치는 `design-system/motion.code.ts`를 그대로 인용(중복 정의하지 않음).

## 컴포넌트 목록

| 컴포넌트 | 경로 | FEAT/TC | 상태 |
|---|---|---|---|
| `MeasurePage` | `pages/measure/ui/MeasurePage.tsx` | FEAT-001 전역 조립 | camera-bootstrap 상태 머신(하단) |
| `CameraPermissionPanel` | `features/session-control/ui/CameraPermissionPanel.tsx` | FEAT-001 / 권한 거부 | blocking |
| `StatusBanner` | `features/session-control/ui/StatusBanner.tsx` | FEAT-001, FEAT-009 / TC-001-1~5, TC-009-1, TC-009-3 | 8-state 우선순위 슬롯 |
| `LiveTimer` | `features/session-control/ui/LiveTimer.tsx` | FEAT-002, FEAT-006 / TC-002-*, TC-006-1 | frozen / running + feedback overlay |
| `TargetColorChip` | `features/session-control/ui/TargetColorChip.tsx` | FEAT-003 / TC-001-3, TC-003-5 | hidden / visible |
| `StatRow` | `features/session-control/ui/StatRow.tsx` | FEAT-006 / TC-006-1 | populated(0 포함) |
| `ActionBar` | `features/session-control/ui/ActionBar.tsx` | FEAT-009 / TC-009-2, TC-006-2(정지 경유) | torch enabled/disabled/active |
| `StartMeasureButton` | `features/session-control/ui/StartMeasureButton.tsx` | FEAT-010 / TC-010-1 | 홈 화면에서 사용(슬라이스는 session-control) |

## MeasurePage 최상위 상태 머신 (camera bootstrap)

측정 phase(state-contract ephemeral)보다 상위에 있는 게이트. 이 레벨이 `blocked`가 아니어야 하위 phase 머신이 존재한다.

| 상태 | 진입 조건 | 렌더 | 나가는 전이 |
|---|---|---|---|
| `camera-initializing` | MeasurePage 마운트 직후 | `MiniCameraPreview(state='initializing')` + `StatusBanner(state='camera-initializing')`, 타이머/칩 미노출 | 권한 승인→`ready`, 권한 거부→`permission-denied` |
| `permission-denied` | 카메라 권한 API reject | `CameraPermissionPanel`이 프리뷰·타이머·칩 영역 전체 대체(`layout-spec.md` §3.2.3) | [권한 다시 요청] 성공→`ready`, [홈으로]→pages 레벨 `onStop`/goHome 아님, App의 goHome 직접 호출 |
| `ready` | 권한 승인 | 하위 phase 상태 머신 활성(아래 §측정 phase) | [정지] 또는 phase→`SESSION_DONE`에서 `onStop(sessionId)` 호출로 뷰 자체가 언마운트 |

`CameraPermissionPanel` 진입 시 포커스는 h1("측정 중 – 미니카 랩타임")이 아니라 패널 자체의 `h2`("카메라 접근 필요")로 이동한다 — 콘텐츠가 구조적으로 대체됐으므로(`App.tsx`의 뷰 전환 포커스 관리와 별개로 `MeasurePage` 내부가 추가로 처리).

## 측정 phase 상태 머신 → StatusBanner / LiveTimer / TargetColorChip 매핑

`state-contract.md` ephemeral phase(IDLE→LEARNING→ARMED→ENROLLED→RUNNING→SESSION_DONE)를 화면 표시로 변환한다.

| phase (ephemeral) | `StatusBanner.state` | `LiveTimer.running` | `TargetColorChip.visible` | 근거 TC |
|---|---|---|---|---|
| LEARNING(안정) | `'learning'` | false(00:00 고정) | false | TC-001-1 |
| LEARNING(흔들림 재학습) | `'learning-relearn-shake'` | false | false | TC-001-2 |
| ARMED | `'armed'` | false | false | TC-001-3 진입 전 |
| ENROLLED/RUNNING(정상) | `'enrolled-running'` | true | true | TC-001-3, TC-006-1 |
| RUNNING + 60s 무통과 | `'stall-60s'` | true(유지) | true | TC-001-4 |
| RUNNING + 배경 급변 재학습 | `'background-relearn'` | true(유지) | true | TC-001-5 |
| RUNNING + 저조도/fps 강등 | `'low-light-degraded'` | true | true | TC-009-3 |

**동시 발생 우선순위**(`layout-spec.md` §3.2.1, 단일 슬롯): `learning-relearn-shake`/`background-relearn` > `stall-60s` > `low-light-degraded` > 그 외 일반 상태. `StatusBanner`는 이 우선순위로 계산된 단일 `state` 값만 prop으로 받는다 — 우선순위 계산 자체는 `MeasurePage`(또는 상위 훅 `useMeasurePhase`)의 책임이며 컴포넌트는 계산하지 않는다.

## StatusBanner

```ts
type MeasureBannerState =
  | 'camera-initializing'
  | 'learning'
  | 'learning-relearn-shake'
  | 'armed'
  | 'enrolled-running'
  | 'stall-60s'
  | 'background-relearn'
  | 'low-light-degraded';

interface StatusBannerProps {
  state: MeasureBannerState;
}
```

내부적으로 `shared/ui/Banner`를 합성한다(`INDEX.md` 전역 결정 #1). 매핑 표:

| state | eyebrow | message | Banner.variant | Banner.role |
|---|---|---|---|---|
| `camera-initializing` | — | "카메라 준비 중…" | info | status |
| `learning` | LEARNING | "배경 학습 중…" | info | status |
| `learning-relearn-shake` | LEARNING | "폰이 흔들려요, 다시 학습할게요" | warning | alert |
| `armed` | ARMED | "타깃 대기 중" | info | status |
| `enrolled-running` | RUNNING | "계측 중" | info | status |
| `stall-60s` | RUNNING | "차가 멈췄나요?" | warning | alert |
| `background-relearn` | RUNNING | "배경이 바뀌었어요, 다시 학습할게요" | warning | alert |
| `low-light-degraded` | RUNNING | "정밀도가 낮아졌어요(±33ms)" | warning | alert |

전환 애니메이션: crossfade `--motion-banner-crossfade`(150ms, `motion.code.ts` `bannerCrossfadeMs`). `prefers-reduced-motion`이면 0ms 인스턴트(색·텍스트는 항상 즉시 반영, `accessibility.md` Reduced Motion). 권한 거부는 이 컴포넌트가 다루지 않는다(`CameraPermissionPanel` 별도 블로킹 패널).

## LiveTimer

```ts
interface LiveTimerProps {
  elapsedMs: number;                 // pendingLap 경과, rVFC 기반 갱신(FEAT-002)
  running: boolean;                  // false면 "00:00" 고정 표시
  feedback: 'none' | 'target-pass' | 'target-borderline-pass';
  precisionDegraded?: boolean;       // TC-009-3 → "±33ms" caption
  reducedMotion: boolean;
  lastConfirmedLap: { n: number; durationMs: number } | null;  // 값이 바뀔 때만 1회 announce
}
```

- 숫자 표시(`hero-timer` 토큰, tabular-nums)는 **`aria-hidden="true"`** — 매 프레임 갱신을 그대로 live-announce하면 스팸이 되므로(`layout-spec.md` §3.2.4). 대신 시각적으로 숨긴 `<div aria-live="polite" className="sr-only">`가 `lastConfirmedLap.n` 변경 시에만 "랩 {n} 확정, {mm:ss.d}" 안내(이 동작을 위해 컴포넌트 내부가 `lastConfirmedLap`의 이전 값을 기억해 중복 announce를 막는다).
- `feedback` 변화 시 내부 `PassFeedbackFlash` 오버레이(halo)를 트리거:
  - `'target-pass'` → success 톤, `motion.code.ts` `passFeedbackMotion.target`(in 120ms/hold 60ms/out 220ms) + `hapticPatternMs.targetPass`([40])
  - `'target-borderline-pass'` → success 톤 + warning 1회 pulse(`passFeedbackMotion.targetBorderline.warningPulseMs` 200ms) + `hapticPatternMs.targetBorderlinePass`
  - `'none'` → 오버레이 비노출
- 햅틱 호출은 `"vibrate" in navigator` best-effort(iOS Safari 미지원 시 무해하게 실패, 시각 채널이 항상 1차 — `motion.code.ts` 주석, `accessibility.md` Reduced Motion 절 승계).
- `reducedMotion=true`면 `resolveMotion()`으로 모든 지속시간 0 치환, 색 상태 전환은 유지.
- 오버레이 자체는 `aria-hidden="true"`(장식 채널 — 통과 확정 정보는 이미 live-region과 `StatRow` 갱신으로 별도 전달되므로 중복 정보 아님).

### PassFeedbackFlash (LiveTimer 내부 합성, 파일 분리)

```ts
interface PassFeedbackFlashProps {
  active: 'none' | 'target' | 'target-borderline';
  reducedMotion: boolean;
  onAnimationEnd?: () => void;   // out phase 종료 후 부모가 feedback='none'으로 리셋
}
```

### OtherCarTickIndicator

```ts
interface OtherCarTickIndicatorProps {
  pulseKey: number;    // 타차 통과마다 증가 — 값 변경이 CSS 애니메이션 재트리거(key 패턴)
  reducedMotion: boolean;
}
```

모서리 소형 dot opacity pulse(80ms, `motion.code.ts` `otherCar.tickPulseMs`), 햅틱 없음(약한 채널 유지). `aria-hidden="true"` — 정보 결과(otherPassCount 증가)는 사용자 액션에 영향을 주지 않는 진단 카운트이며 대체 텍스트 채널을 요구하지 않는다(`ux-brief.md` UX Check #2: 타깃/타차 구분은 시각·촉각 채널 강도 차이가 목적이지 SR 안내 대상 아님).

## TargetColorChip

```ts
interface TargetColorChipProps {
  fillColor: string;          // CV 엔진 실측 hue, opaque(state-contract A-7) — 팔레트 토큰 아님
  colorNameApprox: string;    // "오렌지 계열" 등, FR-C2 + WCAG 1.4.1
  visible: boolean;           // ARMED 이전 미노출(ux-brief 명시)
  onRearm: () => void;        // 탭 즉시 실행, confirm 없음(state-contract Destructive Actions, ux-brief B6)
  disabled?: boolean;
}
```

- **네이티브 `<button type="button">`**(원칙 #12), 56px 원형(`--size-chip-diameter`), 링=`--color-chip-ring`·그림자=`--color-chip-shadow`(어떤 hue든 배경과 분리, `tokens.md`).
- 시각: 색 스와치 + 텍스트 라벨 "타깃: {colorNameApprox}" + "탭하여 재설정" caption 병행(색 단독 전달 금지, `accessibility.md`).
- 접근성 이름: `aria-label="타깃: {colorNameApprox}. 탭하여 재설정"`. 키보드 `Enter`/`Space`로 `onRearm` — 네이티브 button이라 별도 keydown 핸들러 불요.
- 탭 결과: `rearmTarget(sessionId)` 즉시 실행 + 칩 리셋 애니메이션(크로스페이드, `--motion-banner-crossfade` 재사용) + `shared/ui/Toast(variant='neutral', message='재무장됨')` 노출(`state-contract.md` Destructive Actions "비차단 토스트로 폐기 사실을 인지시킬 것"). Undo 없음 — 토스트는 정보 전달용이지 액션 트리거가 아니다.
- `enrolled-running`이 아닌 phase(ARMED 등)에서는 `visible=false`이므로 렌더되지 않음 → 재무장은 항상 확보된 타깃에 대해서만 발생.

## StatRow

```ts
interface StatRowProps {
  previousLapMs: number | null;   // 첫 확정 랩 이전 null
  bestLapMs: number | null;
  lapCount: number;               // 0부터 시작
}
```

정적 텍스트 갱신(`body-compact`, tabular-nums), `aria-live` 없음 — 동일 정보가 `LiveTimer`의 live-region으로 이미 1회 announce되므로 중복 안내 방지.

## ActionBar

```ts
interface ActionBarProps {
  torch: {
    supported: boolean;    // false=iOS 등 미지원(TC-009-2)
    active: boolean;
    onToggle: () => void;
  };
  onStop: () => void;
  stopPending?: boolean;   // endSession 비동기 처리 중
}
```

- `[토치]` = `IconButton`(`pressed={torch.active}`, `disabled={!torch.supported}`, `disabledReason="이 기기에서는 지원하지 않아요"`).
- `[정지]` = `AppButton(variant='primary', size='cta', pending={stopPending})` — 플로우를 완결하는 액션이므로 filled(`hierarchy-actions` 원칙). 데이터를 삭제하지 않아 confirm 불필요(이미 기록된 랩은 보존, endSession 후 결과 화면에서 확인 가능).
- 두 버튼 간격 `--space-6`(24px, 원칙 16~24px 대신 편차 — `tokens-typography-layout-motion.md`에 근거 기재됨, 여기서 재인용만).

## CameraPermissionPanel

```ts
interface CameraPermissionPanelProps {
  onRetryPermission: () => void;
  onOpenSettings: () => void;
  onGoHome: () => void;
}
```

`shared/ui/ErrorState` 합성, `actions=[{primary: 권한 다시 요청}, {secondary: 설정으로 이동}, {tertiary: 홈으로}]`, 하단 1/3(엄지 존) 배치(`layout-spec.md` §3.2.3). 정확 카피는 placeholder(`INDEX.md` Assumptions).

## StartMeasureButton

```ts
interface StartMeasureButtonProps {
  onClick: () => void;   // 카메라 권한 프롬프트(DEPLOY_ONLY) 트리거 후 MeasurePage 마운트
  disabled?: boolean;
}
```

`AppButton(variant='primary', size='cta', fullWidth=true)` 래퍼. 홈 화면의 유일한 primary(`hierarchy-actions` "화면당 primary 강조 1개").

## Interaction Matrix — 측정 화면

| View State | Action | Canonical Target | UI Result | Browser Scenario |
|---|---|---|---|---|
| `enrolled-running`, 칩 노출 | 색 칩 탭 | `sessionId`(재무장은 세션 단위, 랩 index 아님) | phase→ARMED, 칩 즉시 미노출, Toast "재무장됨", 이미 영속된 Lap 불변(INV-3) | 색 칩 탭 → 배너가 "타깃 대기 중"으로 즉시 전환 + 토스트 노출 + 이전 랩 테이블 값(측정 종료 후 확인) 불변 확인 |
| `ready`(모든 phase) | `[토치]` 탭, `supported=false` | — | 버튼은 이미 disabled이므로 탭 무반응(브라우저 기본 disabled 동작), `disabledReason` caption 상시 노출 | iOS 기기에서 토치 버튼 tap → 아무 동작 없음 + "지원하지 않아요" 문구 확인 |
| `ready`(모든 phase) | `[정지]` 탭 | `sessionId` | `endSession(sessionId)` 호출, `stopPending=true`(버튼 스피너) → 성공 시 결과 화면 자동 전환(`onStop(sessionId)`) | 정지 탭 → 버튼 스피너 짧게 노출 → 결과 화면으로 전환, 포커스 결과 h1 이동 |
| `permission-denied` | `[권한 다시 요청]` 탭 | — | 권한 API 재호출, 승인 시 `camera-initializing`→`ready` | 권한 거부 후 재요청 탭 → 승인 mock → 정상 측정 화면 렌더 |
| `learning-relearn-shake` × 저조도 동시 발생 | (자동, 사용자 액션 없음) | — | 우선순위 표에 따라 `learning-relearn-shake`만 노출(저조도는 억제) | 두 예외 동시 트리거 fixture → 배너 텍스트가 흔들림 재학습 문구만 표시됨을 assert |
