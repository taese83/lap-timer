# 접근성 — minicar-laptime

WCAG 2.2 AA 하한은 협상 불가(`design-principles.md` 소비 규칙). 야외 가독 최우선 맥락이 접근성 하한을 완화하는 근거가 되지 않는다 — 오히려 고대비 요구가 하한을 상회하는 방향으로 작동한다.

## 대비 (Contrast)

값은 OKLCH L 격차 기반 **설계 목표치**다. 실측(oklch → sRGB 변환 후 WCAG 상대휘도 공식) 재검증은 구현 단계에서 `design-reviewer`가 수행한다(`tokens.md` 편차 노트와 동일 원칙 — 진실성: 계산하지 않은 값을 정밀 확정치로 주장하지 않는다).

| 페어 | 목표 | 근거 |
|---|---|---|
| `--color-text-primary` on `--color-bg-app` | ≥ 15:1(일반 텍스트 4.5:1 하한 상회) | L 0.97 vs 0.09, hero-timer 원거리 가독 요구 |
| `--color-text-secondary` on `--color-bg-app`/`--color-bg-surface` | ≥ 4.5:1 | 본문 하한 |
| `--color-primary-text-on-solid` on `--color-primary-solid` | ≥ 4.5:1 | L 0.15 vs 0.68, 버튼 라벨 |
| semantic `text` on 대응 `subtle-bg` | ≥ 4.5:1 | 배너/배지 본문 |
| `--color-border-strong` on `--color-bg-surface` | ≥ 3:1(비텍스트, SC 1.4.11) | 인풋·컴포넌트 경계 없음이지만 카드/타깃 색 칩 경계에 적용 |
| `--color-focus-ring` on 인접 배경 전체 | ≥ 3:1 | focus-visible 하한 |
| `--color-text-disabled` | 하한 예외(disabled만) | 원칙 disabled 예외 조항 |

**타깃 색 칩은 대비 표에서 제외** — 채움색이 실측 데이터라 통제 불가. 대신 `--color-chip-ring`(근백)과 `--color-chip-shadow`(반투명 흑)로 어떤 hue가 와도 배경과 최소 시인성을 확보한다(`tokens.md`).

## 색 단독 전달 금지 (WCAG 1.4.1)

- **의심 배지**: warning 색만이 아니라 아이콘(경고 삼각/물음표) + "의심" 텍스트 라벨 병행. 삭제와 혼동 방지(`ux-brief.md` UX Check #1)가 목적이므로 라벨 문구도 "오류"가 아닌 "의심"으로 고정.
- **타깃 색 칩 탭 어포던스**: 색 자체는 데이터이지 상태 신호가 아니므로, 탭 가능함은 아이콘(재설정 화살표 오버레이) + "탭하여 재설정" 텍스트로 전달한다. 색으로만 "이게 버튼이다"를 암시하지 않는다.
- **타깃 통과 vs 타차 통과**: 색(success 초록 vs 중립) 차이에 더해 위치·크기·지속시간·햅틱 유무까지 채널을 이중화한다(`tokens-typography-layout-motion.md` 모션 절, `ux-brief.md` UX Check #2 직결).
- **상태 배너**: semantic 색 + `overline`/`h3` 텍스트 라벨 병행, 아이콘 없이 색만 바뀌는 배너 없음.

## 포커스

- `focus-visible`에만 링 적용(마우스 클릭 시 미노출) — `--color-focus-ring` 2px, offset 2px.
- 다크 단일 테마라 포커스 링이 배경(`--color-bg-app` L 0.09)과 항상 대비되도록 링 색은 밝은 톤(`--color-primary-solid-hover`, L 0.74)으로 고정.
- 모바일 터치가 주 입력이지만 외부 키보드/스위치 접근을 배제하지 않는다 — 모든 인터랙티브 요소(버튼·칩·배지 토글·랩 행)에 포커스 스타일을 정의한다.

## 터치 타깃 (WCAG 2.2 SC 2.5.8)

| 항목 | 값 |
|---|---|
| 절대 하한 | 24×24 CSS px |
| 표준 타깃 | 48px |
| 1차 CTA([측정 시작][정지]) | 56px(`tokens-typography-layout-motion.md` 편차 — 옥외 급박 상황 보상) |
| 타깃 색 칩 | 56px |
| 인접 타깃 간격 | 표준 16px, [정지]/[토치]와 삭제 confirm 버튼 쌍은 24px 이상 |

랩 테이블의 의심 배지 수동 토글은 배지 자체가 탭 대상이므로 배지 히트 영역을 시각 크기(작음)와 분리해 최소 24px까지 투명 패딩으로 확장한다.

## Reduced Motion

`@media (prefers-reduced-motion: reduce)`:
- `PassFeedbackFlash`/`OtherCarTickIndicator`/`StatusBanner` crossfade의 애니메이션을 인스턴트 상태 전환으로 대체(지속시간 0, 최종 색상만 즉시 적용).
- 색 상태 변화(success/warning solid 전환)와 배지 텍스트는 애니메이션 제거와 무관하게 항상 유지 — 모션이 유일한 신호가 되지 않는다는 원칙과 일관.
- 햅틱(Vibration API)은 모션이 아니므로 reduced-motion 대상이 아니다. 단 iOS Safari는 Vibration API 자체를 지원하지 않아 시각 채널이 항상 1차다(`motion.code.ts` 주석 — 플랫폼 제약이지 접근성 우회가 아님).

## Forced Colors (OS 고대비 모드)

`@media (forced-colors: active)`:
- 타깃 색 칩·의심 배지처럼 커스텀 색이 의미를 담는 요소는 `border: 1px solid CanvasText`를 강제 추가해 시스템 팔레트 전환 후에도 형태가 남도록 한다(`forced-color-adjust: auto` 유지, 별도 override 최소화).
- 아이콘은 `currentColor` 기반으로 시스템 전경색을 자동 승계하게 하고, 배경색만으로 존재를 표시하는 요소(예: subtle-bg 배너)는 보더를 항상 병행해 forced-colors에서 배경이 사라져도 경계가 남게 한다.

## 다크/고대비 상태

| 상태 | 트리거 | 동작 |
|---|---|---|
| 기본(다크, 유일 테마) | 항상 | `tokens.code.css` `:root` 기본값 |
| 고대비 강화 | `prefers-contrast: more` | `--color-text-secondary` L을 0.75→0.88로, `--color-border-strong` L을 0.42→0.58로 상향, subtle-bg 배경 대신 solid 보더 우선 표시 |
| Forced Colors | `forced-colors: active` | 위 Forced Colors 절 |
| 라이트 테마 | 없음(의도적 부재) | `INDEX.md` 전역 결정 — 다크모드 필수가 잠긴 지시 |

## 검증 연결

- `@axe-core/playwright`(`tech-stack.md` 명시)로 대비·포커스·타깃 크기 자동 검증을 Phase 4 QA에서 수행.
- `design-reviewer`가 본 문서와 실제 렌더 결과의 대비 실측 차이를 검토한다.
