# features/session-history — 홈/결과 화면

지난 세션 목록·공유·삭제. `INDEX.md` 전역 결정 #4에 따라 `SessionSummaryCard` 제안을 `BestLapHighlight`(정보 위계 ①) + `SessionStatsRow`(secondary)로 분리한다.

## 컴포넌트 목록

| 컴포넌트 | 경로 | FEAT/TC | 화면 |
|---|---|---|---|
| `SessionHistoryList` | `features/session-history/ui/SessionHistoryList.tsx` | FEAT-008, FEAT-010 / TC-008-1, TC-010-2 | 홈 |
| `SessionListCard` | `features/session-history/ui/SessionListCard.tsx` | FEAT-008, FEAT-010 / TC-008-1, TC-010-2 | 홈 |
| `BestLapHighlight` | `features/session-history/ui/BestLapHighlight.tsx` | FEAT-007 / TC-007-1 | 결과 |
| `SessionStatsRow` | `features/session-history/ui/SessionStatsRow.tsx` | FEAT-007 / TC-007-1 | 결과 |
| `ShareSessionButton` | `features/session-history/ui/ShareSessionButton.tsx` | FEAT-007 | 결과 |
| `DeleteSessionButton` | `features/session-history/ui/DeleteSessionButton.tsx` | FEAT-005, FEAT-007, FEAT-008 / TC-005-4, TC-007-3 | 결과 |
| `EmptyLapsState` | `pages/result/ui/EmptyLapsState.tsx` | FEAT-007 / TC-007-2 | 결과 |
| `SessionLoadErrorState` | `pages/result/ui/SessionLoadErrorState.tsx` | FEAT-008 / TC-008-2 | 결과 |

## SessionHistoryList (홈 — 로딩/빈/에러/populated)

```ts
type SessionSummary = {
  sessionId: string;
  startedAt: number;
  lapCount: number;
  bestLapMs: number | null;
};

type SessionHistoryListState =
  | { status: 'loading' }
  | { status: 'empty' }
  | { status: 'error'; message: string; onRetry: () => void }
  | { status: 'populated'; sessions: SessionSummary[] };

interface SessionHistoryListProps {
  state: SessionHistoryListState;
  onOpenSession: (sessionId: string) => void;
}
```

- `loading`: `SessionListCard`와 동일 크기의 스켈레톤 2~3장(CLS 제로, `design-principles-interaction-controls.md` "스켈레톤은 실제 콘텐츠와 동일 크기"). idb 읽기가 100ms 넘게 걸리는 저사양 기기 대응(`INDEX.md` Assumptions) — 100ms 미만이면 스켈레톤 노출 없이 바로 populated로 스킵(깜빡임 방지).
- `empty`: `shared/ui/EmptyState`(title="아직 측정한 세션이 없어요", action 없음 — 이미 상위 `HomePage`가 `[측정 시작]` primary를 배치했으므로 중복 CTA 금지, `hierarchy-actions` 원칙).
- `error`: `shared/ui/ErrorState`(idb 접근 실패, actions=[{primary: 다시 시도}]).
- `populated`: `<ul>` + 세션별 `SessionListCard`, 최신순(`by_startedAt` desc, state-contract Persistence).

### SessionListCard

```ts
interface SessionListCardProps {
  sessionId: string;
  startedAt: number;
  lapCount: number;
  bestLapMs: number | null;   // null=0랩 세션(그래도 목록엔 표시, A-1 승계)
  onOpen: (sessionId: string) => void;
}
```

`<li><button type="button" onClick={() => onOpen(sessionId)}>...</button></li>` — 카드 전체가 탭 대상(네이티브 button, 원칙 #12). 시각: "8/5 · 12랩 · best 00:10.9"(`body`, tabular-nums 시간 부분만).

## BestLapHighlight / SessionStatsRow (결과 — 정보 위계 ①/②)

```ts
interface BestLapHighlightProps {
  bestLapMs: number;   // ResultPage가 0랩이면 EmptyLapsState로 대체 렌더하므로 이 컴포넌트엔 항상 값 존재
  bestLapN: number;
}

interface SessionStatsRowProps {
  avgMs: number;
  stdDevMs: number;
  otherPassCount: number;
}
```

`BestLapHighlight`는 `display` 토큰(32px)으로 화면 유일의 강조 요소(`hierarchy-actions` "화면당 primary 강조 1개" — 시각 위계에도 적용, 버튼이 아니어도 대비 강도는 1개만). `SessionStatsRow`는 `body-compact`, 3개 값 모두 tabular-nums.

## ShareSessionButton

```ts
interface ShareSessionButtonProps {
  onShare: () => void;
  pending?: boolean;
  disabled?: boolean;
}
```

`AppButton(variant='secondary')` — 결과 화면 시각 강조는 이미 `BestLapHighlight`가 가져갔으므로 공유/삭제 모두 secondary 위계(공유=outlined, 삭제=danger, 어느 쪽도 filled/primary 아님 — 나란한 두 액션이 동급이면 둘 다 outlined+danger로 구분, `hierarchy-actions` 원칙).

## DeleteSessionButton — 파괴적 액션 상태 머신

```ts
interface DeleteSessionButtonProps {
  sessionId: string;
  onDeleted: () => void;                          // 성공 시 호출부가 goHome 수행
  onDeleteRejected?: (errorCode: string) => void;  // 텔레메트리/로깅 훅(선택)
}
```

내부 상태(컴포넌트 소유, 외부에 노출하지 않음):

| 상태 | 트리거 | UI |
|---|---|---|
| `idle` | 초기 | `AppButton(variant='danger')` "삭제" |
| `confirm-open` | idle에서 클릭 | `shared/ui/ConfirmDialog(destructive=true)` open. **다이얼로그를 열기 직전 `sessionId`로 스토어를 재조회**해 `startedAt`/`lapCount`를 다이얼로그 본문에 표시(state-contract "confirm 모달은 id로 재조회한 실제 세션을 표시" — 카드 렌더 시점의 stale prop이 아니라 재조회값 사용) |
| `pending` | confirm-open에서 확인 클릭 | `ConfirmDialog(pending=true)`, 두 버튼 disabled, 확인 버튼 spinner(`aria-busy`) |
| `rejected` | 스토어 reject(`E_SESSION_NOT_FOUND` 등) | `ConfirmDialog.errorMessage`에 인라인 표시(role="alert"), `[다시 시도]`/`[취소]` 유지 — 다이얼로그 닫지 않음(사용자가 상태 파악 후 재시도/포기 선택) |
| `success` | 스토어 resolve | 다이얼로그 close, `Toast(variant='success', message='세션이 삭제되었습니다')`, `onDeleted()` 호출(호출부가 홈으로 전환) |

- Cascade 삭제(Session + 소속 Lap 전량, INV-4)는 스토어 책임 — 컴포넌트는 `deleteSession(sessionId, {confirmed:true})` 호출만 담당.
- Undo 없음(`state-contract.md` A-4) — 대신 삭제 전 2단계 confirm(탭→모달)과 성공 토스트로 실행 사실을 명확히 인지시킨다.
- 삭제 대상은 항상 `session.id`이며 향후 홈/결과에 필터·검색이 추가돼도 화면상 배열 index를 인자로 넘기지 않는다(state-contract 선반영 가드 승계).

## EmptyLapsState / SessionLoadErrorState

```ts
interface EmptyLapsStateProps {
  onGoHome: () => void;
}
interface SessionLoadErrorStateProps {
  onRetry: () => void;
}
```

각각 `shared/ui/EmptyState`("기록된 랩 없음" + action=다시 측정하기→홈), `shared/ui/ErrorState`("세션을 불러오지 못했어요" + actions=[다시 시도]) 래퍼. 빈 테이블만 렌더링하지 않음(`layout-spec.md` §3.3 navigation-ia 원칙 승계).

## Page 조립

- `pages/home/ui/HomePage.tsx`: `[첫 방문] OnboardingCard` → `StartMeasureButton`(session-control 슬라이스 재사용) → `h2` "지난 세션" → `SessionHistoryList`. 포커스 순서는 `layout-spec.md` §3.1 그대로.
- `pages/result/ui/ResultPage.tsx`: 로드 상태에 따라 `SessionLoadErrorState` | (0랩)`EmptyLapsState` | (populated) `BestLapHighlight` → `h2` "랩 기록" → `entities/lap/ui/LapTable` → `SessionStatsRow` → `ShareSessionButton`/`DeleteSessionButton`. 삭제 confirm 모달은 포커스 트랩(`ConfirmDialog` 계약), 닫히면 삭제 트리거 버튼으로 포커스 복귀(`layout-spec.md` §3.3).

## Interaction Matrix — 홈/결과 화면

| View State | Action | Canonical Target | UI Result | Browser Scenario |
|---|---|---|---|---|
| 홈, `populated` | 세션 카드 탭 | `session.id` | `view→result`(해당 sessionId) | 지난 세션 카드 탭 → 결과 화면 진입, h1 "세션 결과" 포커스 |
| 홈, `empty` | (액션 없음, CTA는 상위 StartMeasureButton) | — | empty 안내만 노출 | 신규 사용자 진입 → "아직 측정한 세션이 없어요" + [측정 시작] 1개만 노출(중복 CTA 없음) 확인 |
| 결과, populated | 랩 행 의심 배지 탭 | `(sessionId, n)` | `toggleLapSuspect` — 해당 행만 즉시 토글, 나머지 필드 불변(INV-2) | 랩 2 의심 토글 → 다른 랩 값 diff 없음 확인 |
| 결과, populated | `[삭제]` 탭 → 확인 | `session.id` | confirm-open→pending→success, cascade 삭제 후 홈 이동 | 삭제 확인 → laps/sessions 0건 확인(idb) |
| 결과, populated | `[삭제]` 탭 → 확인 → 스토어 reject | `session.id` | `rejected` 상태, 인라인 에러 유지, 데이터 잔존 | 이미 삭제된 세션에 재시도 mock → 에러 문구 노출 + 데이터 잔존 확인 |
| 결과, populated | `[취소]`(다이얼로그) | — | 다이얼로그 close, 데이터 잔존, 포커스 `[삭제]` 버튼 복귀 | 취소 클릭 → 랩 테이블 값 불변 |
| (선반영) 홈 목록 필터/검색 추가 시 | 카드 탭·삭제 | `session.id`(배열 index 아님) | 현재 UI엔 필터 없어 미해당 — 컴포넌트 시그니처가 이미 id 기반이라 필터 추가가 이 계약을 깨지 않음 | 자동화 대상 아님, 코드 리뷰 게이트 항목(state-contract Verification Matrix 승계) |
