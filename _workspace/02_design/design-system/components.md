# 컴포넌트 인벤토리 — minicar-laptime

화면 3개(홈/측정/결과, `ux-brief.md` 화면 인벤토리)를 구성하는 semantic 컴포넌트/슬롯. 위치는 FSD(feature-sliced design) 관례를 따른 제안 경로 — 최종 배치는 `layout-spec`/`component-spec`이 확정한다. 라우팅 없음(`tech-stack.md` — 3화면을 in-app view state로 처리)이므로 AppShell이 화면 전환을 담당한다.

| 컴포넌트 | 위치(제안) | 설명 | 주요 토큰 |
|---|---|---|---|
| `AppShell` | `app/AppShell.tsx` | 홈/측정/결과 3-view 전환 컨테이너(라우터 없음), Wake Lock 라이프사이클 보유 | `--color-bg-app` |
| `PrimaryButton` | `shared/ui/primary-button` | [측정 시작], [정지] — solid, 56px 높이 | `--color-primary-solid`, `--size-*-cta`(56px) |
| `IconButton` | `shared/ui/icon-button` | [토치] 등 — 48px 히트 영역, 24px 아이콘 | 표준 48px 타깃 |
| `StatusBanner` | `shared/ui/status-banner` | LEARNING/ARMED/재학습/60s 무통과/배경급변/권한거부/로드실패 — semantic variant(info/warning/error) | `--color-{primary,warning,error}-subtle-bg`, `overline` |
| `LapTimerDisplay` | `features/lap-measurement/ui/lap-timer-display` | 측정 화면 최우선 요소, 현재 랩 경과 대형 숫자 | `hero-timer`, tabular-nums |
| `TargetColorChip` | `features/lap-measurement/ui/target-color-chip` | 타깃 시그니처 색 표시(데이터 색) + 탭=재무장, 아이콘+라벨 병행 어포던스 | `--color-chip-ring`, `--color-chip-shadow`, `--size-chip-diameter` |
| `PassFeedbackFlash` | `features/lap-measurement/ui/pass-feedback-flash` | 타깃 통과 확정 시 강한 시각(+햅틱) 피드백, hero-timer halo | `--color-success-solid`, 모션 "타깃 통과" |
| `OtherCarTickIndicator` | `features/lap-measurement/ui/other-car-tick` | 타차 통과 미세 틱(모서리 소형 점), 진단 카운트 증가 | 모션 "타차 통과"(약한 채널) |
| `StatRow` | `features/lap-measurement/ui/stat-row` | 직전 랩·best·랩 수 소형 표시(측정 화면 secondary) | `body-compact`, tabular-nums |
| `LowLightWarningBanner` | `features/lap-measurement/ui/low-light-warning-banner` | 저조도·프레임 드랍 강등 경고(brief R5-R7) | `--color-warning-*` |
| `SessionSummaryCard` | `features/session-results/ui/session-summary-card` | 결과 화면 best 랩 하이라이트 + avg/σ | `display`, `--color-bg-surface` |
| `LapTable` / `LapRow` | `features/session-results/ui/lap-table` | 랩 순번·시간·의심 배지 리스트 | `--color-bg-surface`, `--color-border-subtle` |
| `SuspectBadge` | `shared/ui/suspect-badge` | "의심" 표시 — warning 토큰(error 아님), 아이콘+텍스트 병행, 사후 수동 토글 대상 | `--color-warning-*`, `label` |
| `EmptyState` | `shared/ui/empty-state` | 지난 세션 없음(홈) / 0랩 종료(결과) 안내 + 재측정 유도 | `body`, 가운데 정렬 3줄 이하 |
| `ErrorState` | `shared/ui/error-state` | 카메라 권한 거부 / 세션 로드 실패 — 안내 + 재시도·설정 이동 CTA | `--color-error-*` |
| `ConfirmDialog` | `shared/ui/confirm-dialog` | 세션 삭제 confirm — 파괴적 액션, 주 버튼과 24px+ 간격 | `--radius-lg`, `--color-bg-elevated` |
| `ShareAction` | `features/session-results/ui/share-action` | 텍스트 공유 트리거 | `IconButton` 변형 |
| `FirstVisitOnboardingCard` | `features/home/ui/onboarding-card` | 첫 방문 거치 안내 1장(재방문 시 생략) | `--color-bg-surface`, `body` |

## 미노출 컴포넌트(의도적 부재)

- 폼/입력 컨트롤 없음(수동 등록·게이트 없음, 제로 셋업 원칙) — 인풋 토큰 정의하지 않음.
- 전역 내비게이션/탭바 없음 — 3화면은 순차 플로우이며 라우팅 없이 AppShell view state로 전환.
- 라이트 테마 스위처 없음 — 다크모드 단일(`INDEX.md` 전역 결정).
