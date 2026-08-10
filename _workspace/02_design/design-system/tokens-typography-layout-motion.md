# 토큰 — 타이포·간격·반경·그림자·모션 (minicar-laptime)

색 토큰은 `tokens.md` 참조. 구현 코드: `tokens.code.css`(본 절 값 포함) · `motion.code.ts`(모션/햅틱 JS 상수).

## 타이포그래피

기본 스케일은 원칙(`design-principles-typography.md`) 4px 격자 실용 스케일을 따르되, **측정 화면 현재 랩 타이머는 원칙의 display 상한(48px)을 넘는 hero 단계를 별도로 추가한다** — 근거: `project-brief.md` §1 사용 시나리오(레인 벽에 거치한 폰을 원거리에서 힐끗 확인), 일반 UI 표시 계층보다 큰 시인성이 필요.

| 역할 | size / line-height | weight | letter-spacing | 용도 |
|---|---|---|---|---|
| `hero-timer` | `clamp(3.5rem, 16vw, 6rem)`(56~96px) / 1.05 | 700 | -0.02em | 측정 화면 현재 랩 경과(최우선 요소) |
| `display` | 32 / 1.15 | 600 | -0.02em | 결과 화면 best 랩 하이라이트 |
| `h2` | 24 / 1.25 | 600 | -0.01em | 섹션 제목("랩 테이블", "지난 세션") |
| `h3` | 20 / 1.3 | 600 | 0 | 상태 배너 라벨, 카드 제목 |
| `body` | 16 / 1.5 | 400 | 0 (한글 자간 보정 없음) | 배너 본문, 리스트 행, 안내문 |
| `body-compact` | 14 / 1.45 | 400 | 0 | avg·σ·타임스탬프·진단 카운트 |
| `label` | 14 / 1.4 | 500 | 0 | 버튼 라벨, 배지 텍스트 |
| `caption` | 12 / 1.35 | 400 | +0.02em | 각주, 진단 정보 |
| `overline` | 11 / 1.3 | 500 | +0.08em(caps) | 상태 배너 eyebrow("LEARNING", "ARMED") |

- **숫자는 항상 `font-variant-numeric: tabular-nums`** — hero-timer, display(best/직전 랩), 랩 테이블 시간 컬럼, avg/σ에 적용. 자릿수가 바뀌어도 폭이 고정돼 힐끗 볼 때 흔들리지 않는다.
- 폰트 스택: `"Pretendard Variable", Pretendard, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Apple SD Gothic Neo", "Noto Sans KR", "Malgun Gothic", sans-serif`(원칙 한글 표준 스택). Pretendard는 자간 보정 내장 — 한글 라벨에 추가 자간 금지.
- 텍스트 색 위계: `--color-text-primary`(87~100% 상당, hero-timer·본문) / `--color-text-secondary`(보조) / `--color-text-disabled`(38% 상당, 비활성만). 순백 대신 근백(`text-primary`) 사용으로 halation 완화(원칙 준수).

## 간격 (8pt scale, 원칙 그대로 채택)

| 토큰 | 값 |
|---|---|
| `--space-1` | 4px |
| `--space-2` | 8px |
| `--space-3` | 12px |
| `--space-4` | 16px |
| `--space-6` | 24px |
| `--space-8` | 32px |
| `--space-12` | 48px |
| `--space-16` | 64px |

**편차**: 측정 화면의 [정지]/[토치] 버튼 간격은 원칙 권장(16~24px) 대신 `--space-6`(24px) 고정 — 근거: 야외 급박 상황에서 오조작 시 세션 데이터 영향(정지=세션 종료 트리거)이 커 파괴적 액션에 준하는 간격을 적용.

## 터치 타깃

| 항목 | 값 | 근거 |
|---|---|---|
| 표준 타깃 | 48px | 원칙 실무 기준(Material 48dp) |
| 1차 CTA([측정 시작], [정지]) | 56px | **편차**: 원칙 44~48px 대신 확대 — 근거: 옥외·급박 상황, 장갑/땀 등 탭 정확도 저하 조건, Fitts's Law상 큰 타깃이 유리 |
| 타깃 색 칩 | 56px(`--size-chip-diameter`) | 탭 가능 요소이자 정보 표시 요소 — 표준 타깃과 통일 |
| 인접 타깃 간격 | 최소 `--space-4`(16px), 정지/토치는 `--space-6`(24px) | 상단 "간격" 편차 참조 |

## 반경 (Radius)

| 토큰 | 기본값 | 용도 |
|---|---|---|
| `--radius-sm` | 8px | 배지, 칩 라벨 |
| `--radius-md` | 12px | 카드, 상태 배너 |
| `--radius-lg` | 20px | 바텀시트, 삭제 confirm 다이얼로그 |
| `--radius-full` | 999px | 타깃 색 칩(원형), pill 배지 |

기능적 톤(`ux-brief.md` 용어·톤: 기능적·간결체)에 맞춰 과도한 둥글림(플레이풀) 없이 중간 반경을 기본값으로 채택.

## 그림자/Elevation

원칙: "다크 배경에서 그림자는 보이지 않는다 — elevation은 표면 밝기로." `--color-bg-app → --color-bg-surface → --color-bg-elevated`의 명도 단계가 1차 elevation 신호다. 부가 그림자는 최소한만:

| 토큰 | 값 | 용도 |
|---|---|---|
| `--shadow-floating` | `0 4px 16px oklch(0 0 0 / 0.5)` | 하단 고정 액션 바([정지][토치]), 모달 |

**편차**: 그림자를 elevation 1차 수단으로 쓰지 않는 이유 외에, 야외 직사광선 하에서는 미세 그림자가 아예 지각되지 않는다는 사용 맥락도 추가 근거 — 표면 명도 + 1px 보더(`--color-border-subtle`)를 elevation의 실질 신호로 병행한다.

## 모션 (통과 피드백 중심)

값·상수 전문은 `motion.code.ts`. 설계 원칙만 요약:

| 이벤트 | 시각 | 지속시간 | 채널 폭 |
|---|---|---|---|
| 타깃 통과(확정) | hero-timer 테두리 halo + success-solid 플래시(전체 타이머 영역) | in 120ms / hold 60ms / out 220ms | 강 — 위치(중앙 대형)+크기+색+햅틱(지원 기기) |
| 타깃 통과(경계/의심) | 위와 동일 + warning-border 1회 pulse(의심 배지 예고) | 동일 | 강, warning 톤 병행 |
| 타차 통과 | 화면 모서리 소형 점(dot) opacity pulse | 80ms | 약 — 위치(모서리 소형)만, 햅틱 없음 |
| 상태 배너 전환(LEARNING→ARMED 등) | crossfade | 150ms | — |

`ux-brief.md` UX Check #2(타차 미세 틱과 타깃 피드백 오인 위험) 대응: 두 피드백은 **위치·크기·지속시간·햅틱 유무**가 모두 달라 색만으로 구분하지 않는다.

`prefers-reduced-motion: reduce`: 모든 애니메이션(halo/pulse/crossfade)을 인스턴트 상태 전환으로 대체하되 색 상태 변화와 배지 텍스트는 유지. 햅틱은 모션이 아니므로 축소 대상이 아니다(단, iOS Safari는 Vibration API 자체 미지원 — `motion.code.ts` 참고).

## 프리뷰 변형 A/B (`ux-brief.md` ASSUMPTION 프리뷰 A/B)

두 참조 무드를 위 공통 토큰의 **델타**로만 정의한다. 색 팔레트(hue·semantic)는 공유하고 반경·보더 굵기·채도·타이포 굵기·밀도·모션 속도만 변형한다.

| 축 | A. 야외 스포츠 계측기 | B. 미니멀 다크 대시보드 |
|---|---|---|
| 반경 | sm 4 / md 8 / lg 12(각진, 계측기 인상) | sm 8 / md 14 / lg 24(부드러움) |
| 보더 굵기(`--size-border-strong-width`) | 2px(베젤感) | 1px(헤어라인) |
| 채도(semantic/primary chroma) | 기준값 +0.02~0.03(에너지) | 기준값 그대로(차분함) |
| hero-timer weight | 800 | 700 |
| 상태 라벨 | `overline`(전대문자) 적극 사용 | `body`/`h3` 문장형 사용 |
| 측정 화면 밀도 | 최소 3수치만 노출(타이머·best·랩 수), 나머지는 탭해야 노출 | 타이머 아래 avg/σ 소형 텍스트 상시 노출 |
| 모션 속도 | 더 스냅(in 90ms/out 150ms) | 더 부드러움(in 160ms/out 280ms, ease) |

`design-preview-builder`는 `tokens.code.css`의 `[data-preview="a"]`/`[data-preview="b"]` 어트리뷰트 오버라이드를 사용해 두 시안을 동일 마크업에서 렌더링한다.
