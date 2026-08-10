# entities — minicar-laptime

`INDEX.md` 전역 결정 #2: `SuspectBadge`는 Lap 엔티티 고유 필드 표시이므로 `entities/lap`에 둔다.

## entities/session

UI 컴포넌트 없음 — `sessionStore`(Zustand) selector만 노출(`state-contract.md` State Ownership). 화면에 필요한 Session 파생 표시(목록 카드·best 하이라이트)는 `features/session-history`가 selector를 소비해 조립한다(엔티티 레이어는 도메인 상태만, 표시는 feature 책임 — FSD 원칙).

## entities/lap

| 컴포넌트 | 경로 | FEAT/TC | 화면 |
|---|---|---|---|
| `LapTable` | `entities/lap/ui/LapTable.tsx` | FEAT-005, FEAT-007 / TC-005-1, TC-007-1 | 결과 |
| `LapRow` | `entities/lap/ui/LapRow.tsx` | FEAT-005 / TC-005-2 | 결과 |
| `SuspectBadge` | `entities/lap/ui/SuspectBadge.tsx` | FEAT-004, FEAT-005 / TC-004-1, TC-005-2 | 결과 |

### LapTable

```ts
interface LapRowData {
  sessionId: string;
  n: number;                 // canonical, 1부터 연속(INV-1)
  durationMs: number;
  suspect: boolean;
}

interface LapTableProps {
  laps: LapRowData[];        // n asc, canonical 전체 배열(현재 필터 UI 없음 — INV-8 선반영 가드)
  bestN: number | null;      // 하이라이트 대상 n, 랩 0건이면 null(ResultPage가 EmptyLapsState로 대체 렌더하므로 이 값 사실상 미도달)
  onToggleSuspect: (sessionId: string, n: number) => void;  // index 아님 — (sessionId, n) 안정 키만 사용(state-contract INV-8/A-2)
}
```

- `<table>` + `<caption className="sr-only">랩 기록</caption>`, 헤더 `<th scope="col">`(#, 시간, 배지). `durationMs` 컬럼 `font-variant-numeric: tabular-nums`.
- 행 높이 48px(`tokens-typography-layout-motion.md` 소비자용 리스트 기준, `layout-spec.md` §3.3).
- 정렬·필터가 향후 추가돼도 `onToggleSuspect`는 항상 `(sessionId, n)`만 받는다 — 화면에 보이는 배열 index를 인자로 넘기지 않는다(선반영 가드, state-contract Verification Matrix "filter/search × delete" 행과 동일 원칙을 suspect 토글에도 적용).

### LapRow

```ts
interface LapRowProps {
  n: number;
  durationMs: number;
  suspect: boolean;
  isBest: boolean;
  onToggleSuspect: () => void;   // 부모(LapTable)가 (sessionId, n)로 바인딩 완료한 콜백
}
```

`isBest` 행은 `--color-bg-surface` 대비 강조(테두리 또는 배경 톤 상향), 텍스트 라벨 없이 색만으로 전달하지 않도록 `aria-label`에 "베스트 랩" 접미(예: `n번째 랩, 00:10.9, 베스트 랩`).

### SuspectBadge

```ts
interface SuspectBadgeProps {
  suspect: boolean;
  onToggle: () => void;
  disabled?: boolean;
}
```

- **네이티브 `<button type="button">`**(원칙 #12 — 클릭 가능한 배지는 커스텀 div 금지), `aria-pressed={suspect}`.
- `suspect=true`: 아이콘(⚠) + "의심" 텍스트, `--color-warning-*` 토큰, `aria-label="랩 {n}, 의심 해제"`.
- `suspect=false`: 고스트/아웃라인 스타일 "의심으로 표시"(항상 토글 가능해야 TC-005-2 왕복 성립), `aria-label="랩 {n}, 의심으로 표시"`.
- 시각 크기는 작지만 히트 영역은 24px 이상까지 투명 패딩으로 확장(`accessibility.md` 터치 타깃 절).
- 키보드: `Tab`으로 포커스, `Enter`/`Space`로 토글(네이티브 button 시맨틱이 무료로 제공). `focus-visible` 링은 shared baseline 5상태 계약 그대로.
- 의심≠오류 원칙(`ux-brief.md` UX Check #1)을 라벨 문구에서 항상 유지 — "오류"/"삭제" 어휘 금지.
