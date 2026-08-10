# Layout Spec — minicar-laptime

Source: `_workspace/01_plan/ux-brief.md`(화면 인벤토리·화면별 정보 위계·사용자 플로우), `_workspace/01_plan/feature-plan.md`(FEAT 매핑), `_workspace/01_plan/tech-stack.md`(라우팅 결정). 3화면·15KB 내외 예상 → `artifact-sharding-contract.md` 기준 미분할 단일 파일.

## 0. 입력 확인 및 이탈 사항

- ux-brief `## 화면별 정보 위계` 표 확인됨(홈/측정/결과 3행, Primary 순서 포함) — 시각 위계 설계는 이 표의 순서를 그대로 근거로 사용한다. `BLOCKER` 없음.
- **라우팅 이탈(중요)**: 이 SKILL의 기본값은 `react-router` v8이나, `tech-stack.md`(ASSUMPTION B2)가 "3화면을 in-app view state로 처리, URL 라우팅 불요"로 이미 확정했다. Phase 1 기존 결정이 이 문서의 기본값을 이긴다(design-principles 소비 규칙과 동일 원칙 — 기존 결정 우선). 아래 §2는 `react-router` 대신 **App 레벨 view-state 스위치**로 라우팅 맵을 표현한다.
- **재무장 즉시 실행(무취소) 유지**: `design-principles-hierarchy-actions.md`는 되돌릴 수 없는 액션에 undo 토스트를 권장하지만, ux-brief ASSUMPTION B6("즉시 실행, 취소 없음")이 이미 상위에서 결정됨(제로 셋업 원칙). 이 문서는 원칙 대신 B6을 따르되, 오탭 방지를 위해 칩 터치 타깃 48px 이상 + 실행 즉시 명확한 시각 피드백(칩 리셋 애니메이션)으로 보완한다.
- **상시 노출 내비 없음**: `design-principles-navigation-ia.md`의 바텀탭 3~5개 규칙은 "허브형(임의 전환)" 앱에 적용된다. 이 앱은 홈→측정→결과→홈의 **단방향 선형 플로우**이므로 상시 내비게이션을 두지 않는다(원칙 대신 선형 플로우 판단 — 근거: ux-brief 사용자 플로우 §1~6에 임의 화면 전환 없음).

## 1. 글로벌 레이아웃

모바일 세로 단일(320~599px 주 타깃), 상시 사이드바/바텀탭 없음. 화면마다 최소한의 헤더 + 본문 + (측정 화면만) 하단 고정 액션 바.

```
┌────────────────────────────┐  320–599px, portrait 우선
│ [skip link, 포커스 시만 노출] │
├────────────────────────────┤
│ 헤더 (banner, ~56px)        │  ← 화면별 title, 결과 화면만 [← 홈] 포함
├────────────────────────────┤
│                             │
│  main (scrollable)          │
│                             │
├────────────────────────────┤
│ (측정 화면만) 하단 고정 액션 │  ~64px, safe-area-inset-bottom 포함
│ [토치]              [정지]  │
└────────────────────────────┘
```

- 컨테이너: `max-width: 560px; margin-inline: auto; padding-inline: 16px`(모바일 gutter 16px, `design-principles-spacing-layout.md`). 560px는 문서형 640~720px 원칙보다 좁다 — **이탈 근거**: 텍스트 읽기 컬럼이 아니라 대형 숫자 HUD이므로 더 좁은 컬럼이 시선 이동을 줄인다.
- 섹션 간 32px, 그룹 간 16~24px, 요소 간 4~8px(spacing 원칙 2배 규칙 준수).
- **뷰 전환 시 포커스·타이틀 수동 관리(필수)**: react-router 미사용이므로 브라우저의 기본 라우트 전환 포커스 리셋이 없다. `app/App.tsx`가 뷰 전환마다 ① `document.title` 갱신 ② 새 페이지 `<h1>`으로 programmatic focus 이동을 직접 수행한다(SPA 접근성 하한, navigation-ia "라벨=페이지 타이틀 일치" 준수).

## 2. 라우팅 맵 (view-state, react-router 미사용)

App은 단일 정적 shell(`/`)이며 화면 전환은 URL이 아니라 앱 상태(`view: 'home' | 'measure' | 'result'`)로 이뤄진다.

| 뷰 | 진입 조건 | 컴포넌트 | 설명 |
|---|---|---|---|
| `home` | 최초 마운트 / 측정 [정지]→결과 확인 후 홈 복귀 / 결과 화면 [← 홈] | `src/pages/home/ui/HomePage.tsx` | 측정 시작, 지난 세션 목록 |
| `measure` | 홈에서 [측정 시작] 탭 | `src/pages/measure/ui/MeasurePage.tsx` | 실시간 랩 계측(카메라 권한 프롬프트 발생 지점) |
| `result` | 측정 [정지] 자동 전환 / 홈에서 지난 세션 카드 탭 | `src/pages/result/ui/ResultPage.tsx` | `sessionId` 필요(신규 세션 or 과거 세션 id) |

전이: `home --[측정 시작]--> measure --[정지]--> result --[홈]--> home`, `home --[세션 카드 탭]--> result --[홈]--> home`. `measure`는 `result`를 거치지 않고 `home`으로 직접 돌아가지 않는다(정지=필수 경유, brief §4).

```tsx
// app/App.tsx — view-state 스위치 (라우터 대체, ~45줄)
type View =
  | { name: 'home' }
  | { name: 'measure' }
  | { name: 'result'; sessionId: string };

const TITLES: Record<View['name'], string> = {
  home: '미니카 랩타임',
  measure: '측정 중 – 미니카 랩타임',
  result: '세션 결과 – 미니카 랩타임',
};

export function App() {
  const [view, setView] = useState<View>({ name: 'home' });
  const mainHeadingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    document.title = TITLES[view.name];
    // 라우터 없이 수동 포커스 이동 — SPA 접근성 하한
    mainHeadingRef.current?.focus();
  }, [view.name]);

  const goHome = () => setView({ name: 'home' });
  const goMeasure = () => setView({ name: 'measure' });
  const goResult = (sessionId: string) => setView({ name: 'result', sessionId });

  return (
    <>
      <SkipLink targetId="main-content" />
      {view.name === 'home' && (
        <HomePage onStartMeasure={goMeasure} onOpenSession={goResult} headingRef={mainHeadingRef} />
      )}
      {view.name === 'measure' && (
        <MeasurePage onStop={goResult} headingRef={mainHeadingRef} />
      )}
      {view.name === 'result' && (
        <ResultPage sessionId={view.sessionId} onHome={goHome} headingRef={mainHeadingRef} />
      )}
    </>
  );
}
```

### 2.1 404/403/공개 route

해당 없음 — SPA shell이 단일 URL(`/`)만 서빙하고 하위 URL sub-route가 없다(view-state는 URL에 반영되지 않음, §0 이탈 사항). 인증·권한(403) 개념 없음(계정/서버 없음, tech-stack 확정). 정적 배포(Vercel)이므로 존재하지 않는 정적 자산 요청은 호스팅 기본 404로 처리되며 앱 라우트 자체의 404 화면은 불필요 — 단 `vercel.json`에 SPA catch-all rewrite(`/(.*) → /index.html`)가 필요하다(CI/tooling 담당 항목으로만 기록, 이 문서에서 구현하지 않음).

## 3. 페이지별 레이아웃

공통 접근성 계약: 모든 페이지 `role="banner"`(헤더) + `role="main"`(`id="main-content"`, `tabIndex={-1}`로 programmatic focus 대상) + skip link("본문으로 건너뛰기"). 텍스트는 `rem` 기반이라 200% 텍스트 확대에 컨테이너가 세로로 늘어나며 잘리지 않는다(고정 `height` 대신 `min-height` 사용). 320px 폭까지 가로 스크롤 없이 1열 유지, 400% 확대(≈320 CSS px 유효 뷰포트) 동일 스택 구조로 대응 — 그리드가 아니라 처음부터 1열이므로 별도 reflow 분기 불필요.

### 3.1 홈 (`view: home`)

정보 위계(ux-brief): ① [측정 시작] CTA ② 지난 세션 유무·요약, secondary=첫 방문 안내.

```
┌────────────────────────────┐
│ header (banner) "미니카 랩타임" h1│
├────────────────────────────┤
│ [첫 방문 전용] 거치 안내 카드 │ 재방문 시 미노출(로컬 플래그)
│ "폰을 레인 벽에 걸쳐 두세요" │
├────────────────────────────┤
│ ┌─────────────────────────┐│
│ │      측정 시작            ││ primary filled, full-width, 56px 높이
│ └─────────────────────────┘│
│                             │ 32px
│ 지난 세션 (h2)               │
│ ┌─────────────────────────┐│
│ │ 8/5 · 12랩 · best 00:10.9 ││ 탭 가능 카드 → result
│ └─────────────────────────┘│
│ ┌─────────────────────────┐│
│ │ 8/4 · 9랩 · best 00:11.3  ││
│ └─────────────────────────┘│
└────────────────────────────┘
```

- **empty(지난 세션 없음)**: 리스트 대신 "아직 측정한 세션이 없어요" + 위 CTA 강조(온보딩 empty state, navigation-ia 원칙). 별도 CTA 중복 배치 안 함 — 화면당 primary 1개 유지.
- **랜드마크/헤딩**: `h1`="미니카 랩타임"(헤더), `h2`="지난 세션". 첫 방문 안내 카드는 `role="note"`, 닫기 컨트롤 없음(재방문 시 자동 미노출).
- **포커스 순서**: skip link → (첫 방문 카드는 정적, 탭 스톱 없음) → [측정 시작] 버튼 → 세션 카드 목록(각 `<button>`, 최신순).
- **컴포넌트**:
  - `src/pages/home/ui/HomePage.tsx` — 레이아웃 조립, `mainHeadingRef` 수신
  - `src/features/session-control/ui/StartMeasureButton.tsx` — CTA
  - `src/features/session-history/ui/SessionListCard.tsx` — 세션 카드(탭→`onOpenSession(id)`)
  - `src/shared/ui/OnboardingCard.tsx` — 첫 방문 안내(재사용 가능한 정적 카드)

### 3.2 측정 (`view: measure`) — 최대 상세

정보 위계(ux-brief): ① 현재 랩 타이머(대형) ② 상태 배너 ③ 타깃 색 칩. secondary=직전/best/랩수, 토치/정지.

```
┌────────────────────────────┐
│ 미니 카메라 프리뷰 (~80px)   │ role="img" aria-label="카메라 미리보기(레인 정렬 확인용)"
├────────────────────────────┤
│ 상태 배너 (role=status/alert)│ 아이콘+텍스트, 배경색+텍스트 이중 신호
│ "타깃 대기 중" / "계측 중" 등│
├────────────────────────────┤
│                             │
│         00:12.4              │ 대형 표시 영역, 폭 ~70%, 최소 높이 120px
│                             │   (정확 font-size는 design-system 타이포 최상위 토큰)
├────────────────────────────┤
│ ┌───────────────────────┐  │
│ │ ● 타깃: 오렌지  (탭=재무장)│ 48px+ 터치 타깃, 색+텍스트 라벨(색 단독 금지)
│ └───────────────────────┘  │   ENROLLED 이전(ARMED)에는 미노출
├────────────────────────────┤
│ 직전 00:11.8 · best 00:10.9 · 랩 5 │ secondary row, 요소 간 8px
├────────────────────────────┤
│ [조건부] 예외 배너            │ role="alert", 상태 배너 슬롯 재사용(우선순위 §3.2.2)
├────────────────────────────┤
│ [🔦 토치]         [■ 정지]  │ 하단 고정, 각 56px+ 높이, 간격 16px 이상
└────────────────────────────┘
```

#### 3.2.1 상태별 레이아웃

| 상태 | 배너 텍스트 예 | 타이머 | 색 칩 | 비고 |
|---|---|---|---|---|
| 카메라 초기화(로딩) | "카메라 준비 중…" | 미노출(스피너) | 미노출 | LEARNING 진입 전 짧은 과도 상태 |
| LEARNING | "배경 학습 중…" | 00:00 고정 | 미노출 | ~1.5s |
| LEARNING 흔들림 재학습 | "폰이 흔들려요, 다시 학습할게요" | 00:00 | 미노출 | TC-001-2 |
| ARMED(타깃 대기) | "타깃 대기 중" | 00:00 | **미노출**(ux-brief 명시) | 랩 수치 0 |
| ENROLLED/RUNNING(정상) | "계측 중" | 진행 중 갱신 | 노출 | 통과 시 플래시(칩 영역), 타차는 미세 틱(칩 옆 작은 인디케이터, 별도 배너 아님) |
| 60초 무통과 | "차가 멈췄나요?" | 계속 진행(세션 유지) | 노출 유지 | TC-001-4, SESSION_DONE 아님 |
| 배경 급변 재학습 | "배경이 바뀌었어요, 다시 학습할게요" | 유지 | 유지 | TC-001-5 |
| 저조도/fps 강등 | "정밀도가 낮아졌어요(±33ms)" | 유지 | 유지 | 숨기지 않고 정직 표시(TC-009-3) |
| 카메라 권한 거부 | 전체 콘텐츠 대체(§3.2.3) | — | — | blocking |

배너는 **단일 슬롯**(동시에 2개 노출 안 함) — 동시 발생 시 우선순위: 권한 오류 > LEARNING 흔들림/배경급변 재학습 > 60초 무통과 > 저조도·fps 강등 > 일반 상태. `ASSUMPTION`(ux-brief에 동시발생 우선순위 명시 없음, 안전 관련 배너를 상위로 하는 합리적 합성 — Phase2 리뷰에서 확인).

타깃/타차 피드백 구분(brief 핵심 인터랙션): 타깃 통과=화면 플래시(전체 또는 칩 영역) + 햅틱(강), 타차 통과=칩 옆 미세 틱 인디케이터만(시각적으로 명확히 다른 강도 — 정확 애니메이션/듀레이션은 component-spec 담당).

#### 3.2.2 색/의심 배지 — 색 단독 전달 금지 대응

- 타깃 색 칩: 색상 스와치 + **근사 색상명 텍스트**("오렌지 계열") 필수 표기. 정확 색상 산출 로직은 CV 엔진 담당(state-contract), 레이아웃 계약은 텍스트 슬롯 존재만 명세.
- 의심 배지(결과 화면과 공유 컴포넌트): 배경색만이 아니라 아이콘(⚠) + "의심" 텍스트 라벨 동반.

#### 3.2.3 카메라 권한 거부(blocking)

미니 프리뷰·타이머·칩 영역을 전부 대체하는 단일 패널:

```
┌────────────────────────────┐
│ header (동일)               │
├────────────────────────────┤
│      (아이콘) 카메라 접근 필요 │ h2
│  측정을 시작하려면 카메라     │
│  권한이 필요합니다.           │
│                             │
│ [ 권한 다시 요청 ]           │ primary
│ [ 설정으로 이동 ]            │ secondary(outlined)
│ [ 홈으로 ]                  │ tertiary(text)
└────────────────────────────┘
```

정확 문구는 Phase2에서 확정(ux-brief I3 미결) — 위는 구조 placeholder. 액션 3개 세로 스택, 하단 1/3(엄지 존)에 배치.

#### 3.2.4 포커스 순서 및 컴포넌트

- **포커스 순서**: skip link → main(h1, programmatic focus) → (프리뷰는 탭 스톱 아님) → (상태 배너는 `aria-live`로 자동 안내, 탭 스톱 아님) → 타깃 색 칩(`<button>`, ENROLLED 이후만 tab 순서에 등장) → 토치 버튼 → 정지 버튼. 타이머 자체는 인터랙티브 요소가 아니므로 탭 스톱 없음 — 랩 확정 시 `aria-live="polite"` 전용 안내 영역(시각적으로 숨김)에 "랩 5 확정, 00:11.2" 형태로 알림(연속 갱신되는 타이머 숫자를 그대로 live-announce하면 스팸이 되므로 분리).
- **컴포넌트**:
  - `src/pages/measure/ui/MeasurePage.tsx` — 레이아웃 조립·상태 배너 슬롯 우선순위 적용
  - `src/features/session-control/ui/LiveTimer.tsx` — 대형 타이머 + 랩 확정 live-region
  - `src/features/session-control/ui/StatusBanner.tsx` — 단일 슬롯 배너(우선순위 표 §3.2.1 구현)
  - `src/features/session-control/ui/TargetColorChip.tsx` — 재무장 탭 컨트롤
  - `src/features/session-control/ui/ActionBar.tsx` — 하단 고정 [토치][정지]
  - `src/features/session-control/ui/CameraPermissionPanel.tsx` — §3.2.3
  - `src/shared/ui/MiniCameraPreview.tsx`

### 3.3 결과 (`view: result`)

정보 위계(ux-brief): ① best 랩 하이라이트 ② 랩 테이블(순번·시간·의심 배지). secondary=avg·σ·타차 통과 수, 공유·삭제.

```
┌────────────────────────────┐
│ header: [← 홈]  세션 결과 h1 │
├────────────────────────────┤
│ best 랩 하이라이트 카드      │ 화면당 primary 강조 1개(가장 큰 시각 대비)
│  00:10.9  (Lap 3)           │
├────────────────────────────┤
│ 랩 기록 (h2)                 │
│ ┌───┬────────┬──────────┐  │
│ │ # │ 시간    │ 배지      │  │ 테이블 행 48px(소비자용 리스트 기준)
│ ├───┼────────┼──────────┤  │
│ │ 1 │ 00:11.2│          │  │
│ │ 2 │ 00:12.0│ ⚠ 의심   │  │ 탭=의심 토글(TC-005-2)
│ └───┴────────┴──────────┘  │
├────────────────────────────┤
│ avg 00:11.5 · σ 0.4 · 타차 3 │ secondary, 작게
├────────────────────────────┤
│ [ 공유 ]        [ 삭제 ]     │ 삭제는 danger, 16px+ 간격 분리
└────────────────────────────┘
```

- **empty(0랩 종료)**: 테이블 대신 "기록된 랩 없음" + [다시 측정하기](홈으로) — 빈 테이블만 렌더링하지 않음(navigation-ia 원칙).
- **로드 에러(IndexedDB 접근 실패)**: 카드/테이블 영역 전체를 대체하는 에러 패널 "세션을 불러오지 못했어요" + [다시 시도].
- **삭제 confirm**: 모달 다이얼로그, "세션을 삭제할까요? 되돌릴 수 없습니다" — 버튼 우측 정렬(웹 관례) `[취소(기본 포커스)] [삭제(danger)]`, 색+거리 이중 분리. 열릴 때 포커스는 "취소"로 이동(안전한 선택 기본값), `Esc`로 닫힘, 닫히면 포커스는 삭제 트리거 버튼으로 복귀.
- **랜드마크/헤딩**: `h1`="세션 결과", `h2`="랩 기록". 헤더의 [← 홈]은 `aria-label="홈으로"`.
- **포커스 순서**: skip link → main(h1) → [← 홈](헤더 내, DOM 순서상 h1 앞) → best 카드(정적) → 랩 테이블 행(의심 토글 가능한 행만 탭 스톱) → secondary 통계(정적) → [공유] → [삭제]. 삭제 confirm 모달은 포커스 트랩.
- **컴포넌트**:
  - `src/pages/result/ui/ResultPage.tsx`
  - `src/entities/lap/ui/LapTable.tsx`, `src/entities/lap/ui/SuspectBadge.tsx`
  - `src/features/session-history/ui/BestLapHighlight.tsx`
  - `src/features/session-history/ui/ShareSessionButton.tsx`
  - `src/features/session-history/ui/DeleteSessionButton.tsx` + `src/shared/ui/ConfirmDialog.tsx`
  - `src/pages/result/ui/EmptyLapsState.tsx`, `src/pages/result/ui/SessionLoadErrorState.tsx`

## 4. FSD 디렉토리 구조

라우팅·페이지 레벨 스켈레톤만 확정한다(feature/entity 세부 슬라이스는 component-spec/state-contract가 정련). widgets 레이어는 사용하지 않는다 — cross-cutting UI 클러스터가 3개 이상 화면에서 반복되지 않는다(상시 내비 없음, §1 근거).

```
src/
  app/
    App.tsx                 # view-state 스위치, document.title/포커스 관리
  pages/
    home/ui/HomePage.tsx
    measure/ui/MeasurePage.tsx
    result/ui/ResultPage.tsx
  features/
    session-control/ui/     # 측정 시작/정지/토치/재무장/라이브 타이머/상태 배너
    session-history/ui/     # 지난 세션 목록/공유/삭제
  entities/
    session/                # Session 도메인 상태(FEAT-001, FEAT-008)
    lap/                    # Lap 도메인 상태·테이블·의심 배지(FEAT-005)
    target/                 # 타깃 시그니처(FEAT-003)
  shared/
    ui/                     # Button/Card/ConfirmDialog/SkipLink/MiniCameraPreview
    lib/                    # device(wake-lock/torch/fps), cv-worker 인터페이스(FEAT-002/004/009)
    config/
```

## 5. Assumptions and Blockers

- `ASSUMPTION`: 측정 화면 예외 배너 동시발생 우선순위(§3.2.1 표) — ux-brief에 명시 없어 안전 우선 합성. Phase2 프로토타입/리뷰에서 확인.
- `ASSUMPTION`: 카메라 권한 거부 화면 정확 문구는 placeholder(ux-brief I3 미결 승계) — 구조만 확정.
- 라우팅은 `react-router` 대신 view-state로 확정(§0) — Phase 3 `route-builder`는 이 문서의 §2 코드를 기준으로 `src/app/App.tsx`를 생성한다.
- `BLOCKER` 없음.
