# Component Spec — minicar-laptime

Source: `design-system/INDEX.md`(토큰/컴포넌트 인벤토리/접근성), `layout-spec.md`(화면 레이아웃·FSD 스켈레톤·포커스 순서), `state-contract.md`(LOCAL_DOMAIN_STATE_MODE, Command/Invariant), `feature-plan.md`(FEAT-NNN/TC), `ux-brief.md`(정보 위계·핵심 인터랙션). 예상 규모가 커 처음부터 분할한다(`artifact-sharding-contract.md`).

## 절 목록

| 절 | 파일 | 담당 범위 | 주 소비자 |
|---|---|---|---|
| shared | `shared.md` | `shared/ui/*` 공용 프리미티브(버튼·배너·다이얼로그·토스트·상태 패널 등), 인터랙티브 요소 기본 5상태 계약 | component-builder, app-shell-builder, design-preview-builder |
| entities | `entities.md` | `entities/lap/*`(LapTable/LapRow/SuspectBadge), `entities/session` 데이터 전용 슬라이스 노트 | component-builder |
| features — session-control | `session-control.md` | 측정 화면(`features/session-control/ui/*`) — 타이머·상태 배너·색 칩·피드백·액션바·권한 패널, MeasurePage 상태 머신 | component-builder, design-preview-builder, design-reviewer |
| features — session-history | `session-history.md` | 홈/결과 화면(`features/session-history/ui/*`) — 세션 목록·best 하이라이트·공유·삭제, HomePage/ResultPage 조립 | component-builder, design-preview-builder |

## FSD 소유 요약

| 레이어 | 슬라이스 | 비고 |
|---|---|---|
| `shared/ui` | 없음(슬라이스 아님) | 도메인 무관 프리미티브만. 폼 인풋 없음(제로 셋업, `components.md` 미노출 컴포넌트) |
| `entities` | `session`(데이터만, UI 없음), `lap`(LapTable/LapRow/SuspectBadge) | Session은 selector만 노출, 전용 표시 컴포넌트 불요(요약은 features가 조립) |
| `features` | `session-control`(측정 상호작용 전체), `session-history`(목록·결과·삭제·공유) | `widgets` 레이어 미사용(`layout-spec.md` §4 — cross-cutting UI 클러스터 없음) |
| `pages` | `home`/`measure`/`result` | 각 3~10줄 조립 컴포넌트, 상세는 해당 feature 절의 "Page 조립" 하위절 |

## 전역 결정 (design-system.md / layout-spec.md 명명 불일치 해소)

두 상류 문서가 같은 컴포넌트를 다르게 배치한 지점이 있다. `artifact-sharding-contract.md`·`layout-spec.md` §4가 "feature/entity 세부 슬라이스는 component-spec이 정련"이라 위임했으므로 아래로 확정한다:

1. **StatusBanner 분리**: `design-system/components.md`는 `shared/ui/status-banner`(제네릭 semantic variant)로, `layout-spec.md` §3.2.4는 `features/session-control/ui/StatusBanner.tsx`(우선순위 로직 포함)로 서로 다르게 배치했다. → `shared/ui/Banner.tsx`(순수 표시 셸, variant/icon/message)와 `features/session-control/ui/StatusBanner.tsx`(측정 화면 전용 우선순위 계산 + Banner 합성)로 나눈다. 재사용 가능한 시각 셸은 shared, 도메인 우선순위 로직은 feature 소유라는 FSD 원칙에 부합.
2. **SuspectBadge는 entities/lap**: `design-system/components.md`는 `shared/ui/suspect-badge`로 제안했지만 `layout-spec.md` §3.3은 이미 `entities/lap/ui/SuspectBadge.tsx`로 구체 배치했다. `suspect`는 Lap 엔티티 고유 필드이고 다른 엔티티에 재사용되지 않으므로 layout-spec의 배치(entities)를 채택한다.
3. **LowLightWarningBanner는 별도 컴포넌트가 아니라 StatusBanner의 한 상태**: layout-spec §3.2.1이 "배너는 단일 슬롯(동시에 2개 노출 안 함)"을 명시했으므로 design-system 인벤토리의 개별 컴포넌트 제안을 상태 값(`low-light-degraded`)으로 흡수한다.
4. **SessionSummaryCard → BestLapHighlight + SessionStatsRow 2분할**: layout-spec §3.3 ASCII가 best 카드와 avg/σ/타차 secondary row를 시각적으로 분리했으므로 design-system의 단일 카드 제안 대신 2개 컴포넌트로 나눈다(정보 위계 ①/② 구분 유지, `hierarchy-actions` 원칙 — 화면당 primary 강조 1개).
5. **Toast 신규 추가**: `state-contract.md` Destructive Actions가 재무장·삭제 성공에 "비차단 토스트"를 요구하지만 어느 상류 문서에도 Toast 컴포넌트가 없었다. `shared/ui/Toast.tsx`를 신설한다(근거: `design-principles-interaction-controls.md` "확인만 하면 되는 성공=toast 3~5초").
6. **LiveTimer/PassFeedbackFlash는 `features/session-control` 유지**(design-system의 `lap-measurement` 슬라이스 제안 대신): layout-spec §4가 이미 FSD 스켈레톤에서 `features/session-control`만 정의했고 §3.2.4가 `LiveTimer.tsx`를 그 안에 배치했다 — 상위 문서가 이미 확정한 디렉토리 스켈레톤을 따른다.

## Assumptions and Blockers

- `ASSUMPTION`: Toast 자동 소멸 지속시간 4000ms(`design-principles-interaction-controls.md` "3~5초" 범위 채택, 상류 문서에 수치 없음).
- `ASSUMPTION`: 홈 화면 세션 목록 초기 로드에 스켈레톤 상태(`SessionHistoryList` loading)를 추가했다 — `layout-spec.md`/`ux-brief.md`엔 명시 없으나 IndexedDB 읽기가 비동기이므로 loading state 부재 시 빈 상태와 혼동 위험(`design-principles-interaction-controls.md` 로딩 원칙).
- `ASSUMPTION`: 카메라 권한 거부 패널 정확 문구는 placeholder(`layout-spec.md` §3.2.3 승계, `ux-brief.md` I3 미결).
- `BLOCKER` 없음 — 4개 입력 문서 모두 확인됨.
