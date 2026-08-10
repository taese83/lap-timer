# 토큰 — 색 (minicar-laptime)

구현 코드: `tokens.code.css`(CSS custom properties 전문, 본 절 값 포함). 타이포·간격·반경·그림자·모션·프리뷰 A/B 토큰은 `tokens-typography-layout-motion.md` 참조 — 15KB 절 예산(`artifact-sharding-contract.md`) 준수를 위해 색 토큰과 분리했다.

## 색 — 다크 기반 단일 팔레트

원칙(`design-principles-color.md`) 적용: neutral 90% + primary 1 + semantic 4, OKLCH, L 균등 간격·chroma 종모양. **편차**: 원칙의 다크 배경 기본값 `#121212`(L≈0.17) 대신 더 어두운 L 0.09를 채택 — 근거: `ux-brief.md` Design Direction "고대비·저휘도"(직사광선 아래 거치 확인 맥락), 배경-텍스트 격차를 최대화해 원거리 힐끗보기 가독성을 확보한다.

neutral에 chroma 0.005~0.008·hue 250(파랑 계열)의 미량 색조를 섞어 primary와 톤을 통일했다(원칙: "회색에 브랜드 hue 미량 섞기").

### Neutral (배경/표면/보더/비강조 텍스트)

| 토큰 | 값(OKLCH) | 용도 |
|---|---|---|
| `--color-bg-app` | `oklch(0.09 0.005 250)` | 앱 배경(최하위) |
| `--color-bg-surface` | `oklch(0.15 0.006 250)` | 카드·상태 배너·랩 테이블 행 |
| `--color-bg-elevated` | `oklch(0.21 0.007 250)` | 모달·삭제 confirm 시트·바텀시트 |
| `--color-border-subtle` | `oklch(0.30 0.008 250)` | 카드/테이블 구분선 |
| `--color-border-strong` | `oklch(0.42 0.008 250)` | 인풋·컴포넌트 경계(비텍스트 3:1 목표) |
| `--color-text-disabled` | `oklch(0.55 0.006 250)` | 비활성 텍스트/아이콘(하한 예외) |
| `--color-text-secondary` | `oklch(0.75 0.005 250)` | 보조 텍스트(avg·σ·타임스탬프) — bg-app 대비 AA 목표 ≥4.5:1 |
| `--color-text-primary` | `oklch(0.97 0.003 250)` | 본문·랩 타이머 숫자 — 순백 대신 근백(halation 완화), bg-app 대비 목표 ≥15:1 |

### Primary/Action (파랑, hue 250) — 액센트 10% 이내

원칙 "확신 없으면 primary는 파랑"(브랜드 제약 없음, `ux-brief.md`) 채택.

| 토큰 | 값 | 용도 |
|---|---|---|
| `--color-primary-solid` | `oklch(0.68 0.17 250)` | [측정 시작] 등 solid 버튼 배경 |
| `--color-primary-solid-hover` | `oklch(0.74 0.16 250)` | hover/active, focus ring 재사용 |
| `--color-primary-text-on-solid` | `oklch(0.15 0.02 250)` | solid 버튼 위 텍스트(근흑, L 격차 0.53로 AA 목표 확보) |
| `--color-primary-text` | `oklch(0.80 0.14 250)` | 링크/보조 액션 텍스트(bg-app 위 직접 사용) |
| `--color-primary-subtle-bg` | `oklch(0.20 0.05 250)` | 정보성 배너(예: LEARNING/ARMED 상태) 배경 |
| `--color-primary-border` | `oklch(0.45 0.10 250)` | 정보 배너 보더 |

### Semantic — success / warning / error (4토큰: subtle-bg / border / solid / text)

| Semantic | subtle-bg | border | solid | text | 용도 |
|---|---|---|---|---|---|
| success (hue 150) | `oklch(0.22 0.05 150)` | `oklch(0.45 0.09 150)` | `oklch(0.62 0.14 150)` | `oklch(0.82 0.13 150)` | 타깃 통과 확정 플래시, 저장/공유 성공 |
| warning (hue 75) | `oklch(0.24 0.05 75)` | `oklch(0.50 0.10 75)` | `oklch(0.75 0.15 75)` | `oklch(0.85 0.14 75)` | 저조도 경고, 60s 무통과 배너, 배경급변 재학습, 프레임 드랍 강등, 의심 배지 |
| error (hue 25) | `oklch(0.22 0.06 25)` | `oklch(0.48 0.14 25)` | `oklch(0.60 0.19 25)` | `oklch(0.80 0.13 25)` | 카메라 권한 거부, 세션 로드 실패, 삭제(destructive) |

의심 배지는 "오류가 아니다"(`ux-brief.md` UX Check #1) — **error가 아니라 warning 토큰**을 쓴다. 이 구분 자체가 의심≠오류 원칙의 토큰 레벨 구현이다.

### 타깃 색 칩 — 데이터 색(팔레트 토큰 아님)

칩의 채움색은 CV 엔진이 실측한 타깃 시그니처 hue(임의값)를 그대로 렌더링한다(FR-C2). 디자인 시스템은 **컨테이너만** 토큰화해 어떤 hue가 와도 식별 가능하게 만든다.

| 토큰 | 값 | 용도 |
|---|---|---|
| `--color-chip-ring` | `var(--color-text-primary)` | 채움색과 무관한 고대비 외곽 링(2px) — 어두운 hue도 배경과 분리 |
| `--color-chip-shadow` | `oklch(0 0 0 / 0.55)` | 링 바깥 halo — 밝은 hue가 배경에 번지지 않게 |
| `--size-chip-diameter` | `56px` | 터치 타깃 하한(48px) 이상 확보 |

칩 탭(재무장) 어포던스는 색으로 전달하지 않는다 — 아이콘(재설정 화살표) 오버레이 + "탭하여 재설정" 텍스트 라벨 병행(`components.md` TargetColorChip, WCAG 1.4.1).

### Focus

| 토큰 | 값 |
|---|---|
| `--color-focus-ring` | `var(--color-primary-solid-hover)` |
| `--size-focus-ring-width` | `2px` |
| `--size-focus-ring-offset` | `2px` |

primary(hue 250)·success(150)·warning(75)·error(25)와 hue 간격이 충분해 focus ring이 semantic 색과 혼동되지 않는다.

타이포그래피·간격·터치 타깃·반경·그림자·모션·프리뷰 A/B 토큰은 `tokens-typography-layout-motion.md`에 이어서 정의한다.
