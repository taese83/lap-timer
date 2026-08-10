# Design System — minicar-laptime

야외 트랙에서 폰을 레인 벽에 거치해 두고 힐끗 보는 랩타임 측정 앱의 디자인 토큰. UI 라이브러리 미지정(`tech-stack.md` — MUI 등 명시적 제외, 폼/서버통신 불요로 컴포넌트킷 없음) → 순수 CSS custom properties + TS 상수로 소비 가능한 형태로 정의한다. 모바일 세로 단일, 다크모드 필수(`ux-brief.md` Design Direction).

## 절 목록

| 절 | 파일 | 담당 범위 | 주 소비자 |
|---|---|---|---|
| 토큰 — 색 | `tokens.md` | 색 팔레트(neutral/primary/semantic), 타깃 색 칩 컨테이너 토큰, focus | design-preview-builder, layout-designer, component-designer, app-shell-builder |
| 토큰 — 타이포/레이아웃/모션 | `tokens-typography-layout-motion.md` | 타이포 스케일(hero-timer 포함), 간격, 터치 타깃, 반경, 그림자, 모션, 프리뷰 A/B 델타 | design-preview-builder, layout-designer, component-designer, app-shell-builder |
| 컴포넌트 인벤토리 | `components.md` | 화면 3개에 필요한 semantic 컴포넌트/슬롯 목록과 위치 | component-designer, layout-designer, design-preview-builder |
| 접근성 | `accessibility.md` | WCAG 대비 하한, focus, 터치 타깃, reduced-motion, forced-colors, 다크/고대비 상태 | design-reviewer, component-designer, app-shell-builder |
| 토큰 구현 코드 | `tokens.code.css` | CSS custom properties 전문(:root, [data-preview] 변형 포함) | app-shell-builder (Phase 3에서 `src/app/theme.css` 등으로 이관) |
| 모션/햅틱 상수 | `motion.code.ts` | JS에서 소비하는 지속시간·햅틱 패턴 TS 상수 | app-shell-builder, component-designer(측정 화면 피드백 로직) |

## 전역 결정

- **다크모드 단일**(라이트 테마 없음): `ux-brief.md` Design Direction의 잠긴 지시(다크모드 필수) — 원칙(라이트/다크 모두 제공)보다 명시적 사용 맥락 근거(직사광선 아래 거치 확인, R6/야외 눈부심)가 우선. `prefers-contrast: more`용 고대비 변형만 추가 제공.
- **타깃 색 칩은 팔레트 토큰이 아니다**: CV 엔진이 실측한 HSV 색이 그대로 칩 채움색이 된다(`project-brief.md` §2, "정확한 타깃 색 표시"는 기능 요구 FR-C2). 디자인 시스템은 칩의 **컨테이너**(링·그림자·크기·탭 어포던스)만 토큰화하고 채움 hue는 규정하지 않는다.
- **프리뷰 A/B**: `ux-brief.md`의 `ASSUMPTION(프리뷰 A/B)` 참조 무드(① 야외 스포츠 계측기류 ② 미니멀 다크 대시보드류)를 `tokens-typography-layout-motion.md`의 변형 A/B 델타로 준비했다. `design-preview-builder`는 두 변형을 각각 렌더링해 사용자 확인을 받는다.
- **색상 대비는 목표치이지 실측 확정값이 아니다**: OKLCH L 격차 기반 설계 목표(예: "AA 목표 ≥4.5:1")로 표기했다. `oklch()` → sRGB 변환 후 WCAG 상대휘도 공식으로의 실측 재검증은 `design-reviewer`/`design-preview-builder`가 구현 단계에서 수행한다.
- **DTCG/Figma 변수 매핑**: 해당 없음 — 외부 design token source·브랜드 가이드 없음(`ux-brief.md` "브랜드 제약: 없음").

## Assumptions and Blockers

- `ASSUMPTION`: 브랜드 hue 없음 → primary는 원칙 기본값(확신 없으면 파랑)을 채택했다.
- `ASSUMPTION`: Vibration API는 iOS Safari 미지원 — 타깃 통과의 1차 피드백 채널은 항상 시각(플래시), 햅틱은 지원 플랫폼(Android 등)에서의 강화 채널로 설계했다(`accessibility.md`, `motion.code.ts` 주석).
- `BLOCKER` 없음 — `tech-stack.md`(UI 라이브러리 미지정 확인)와 `ux-brief.md`(디자인 방향) 모두 존재, 필요한 입력 확보.
