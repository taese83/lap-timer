# State Contract — minicar-laptime

Source: `feature-plan.md`(FEAT-005·TC-005-*·데이터 모델), `requirements.md`(NFR-5·FR-C2·FR-E1~E5), `project-brief.md` §5, `local-domain-state.md`. 2 aggregate(Session, Lap) — `artifact-sharding-contract.md` 분할 트리거(8개/20KB) 미만, 단일 파일 유지.

## Mode

LOCAL_DOMAIN_STATE_MODE: true

## State Ownership

| State | Authoritative Owner | Derived Views | Persistence |
|---|---|---|---|
| Session(root aggregate) | domain store `sessionStore`(Zustand) | 홈 목록(startedAt desc), 결과 화면 헤더, 상태 배너 근거(targetSig 유무) | IndexedDB `sessions` store |
| Lap(child aggregate, FK sessionId) | domain store `lapStore`(Zustand) | 결과 랩 테이블(n asc), best/avg/σ selector, 라이브 보드 현재/직전/best | IndexedDB `laps` store |
| 측정 phase(IDLE→LEARNING→ARMED→ENROLLED→RUNNING→SESSION_DONE) | 측정 화면 ephemeral 슬라이스(비영속) | 상태 배너, 색 칩 노출 여부 | 없음 — 새로고침 시 초기화 |
| pendingLap 타이머(t_start, 마지막 확정 통과 이후 경과) | ephemeral | "현재 랩 경과" 대형 타이머 | 없음 — Lap으로 완결되기 전엔 저장 안 함 |
| targetSig draft(등록 직후~확정 커밋 전) | ephemeral, commit 시 `enrollTarget`으로 Session.targetSig 승격 | 색 칩 미리보기 | commit 이후에만 idb 반영 |
| CV 엔진 내부 버퍼(프레임 차분율·burst 윈도우) | Worker 내부(도메인 스토어 밖) | 없음 — 도메인 계층에 노출되지 않음 | 없음 |

**경계 원칙**: 엔진(Worker)은 확정된 "통과 이벤트"(t, matchResult, distance, sig)만 도메인 스토어로 emit한다. 원시 프레임/차분율/burst 버퍼는 도메인 상태가 아니다. `pendingLap`은 다음 확정 통과가 발생해야 비로소 `recordLap`으로 영속화되는 완결 전 상태이며, 완결 전에는 idb에 쓰이지 않는다(재무장·세션종료 시 조용히 소멸해도 데이터 손실이 아님 — 애초에 저장된 적이 없음).

## Invariants

| ID | Aggregate | Invariant | Severity |
|---|---|---|---|
| INV-1 | Lap | 세션 내 `n`은 1부터 연속(gap·중복 없음), 생성 순서와 일치. 재무장 후에도 번호는 이어지며 1로 리셋되지 않음 | Critical (TC-005-1, NFR-5) |
| INV-2 | Lap | 생성 후 변경 가능 필드는 `suspect`뿐. `t`·`durationMs`·`n`·`sessionId`·`matchDistance`는 불변 | Critical (TC-005-2, FR-E2) |
| INV-3 | Session, Lap | 재무장(`rearmTarget`)은 `Session.targetSig`와 ephemeral `pendingLap` 타이머만 폐기한다. 이미 영속된 Lap 행과 `Session.quality` 누적치는 변경하지 않음 | Critical (TC-005-3, TC-003-5, FR-C2) |
| INV-4 | Session, Lap | `deleteSession`은 confirm 이후에만 실행되며 Session 행 + 해당 sessionId의 모든 Lap 행을 단일 idb 트랜잭션으로 원자적 삭제(부분 삭제 상태 관찰 불가) | Critical (TC-005-4, TC-007-3, FR-E3) |
| INV-5 | Lap | 모든 Lap.sessionId는 존재하는 Session.id를 참조. 어떤 커맨드 완료 후에도 orphan Lap 없음 | Critical |
| INV-6 | Session | `quality.{droppedFrames,relearnCount,otherPassCount}`는 세션 삭제 외에는 단조 증가만 가능 | High |
| INV-7 | Session | `targetSig`는 `enrollTarget` 전에는 null. 이후 갱신(`updateTargetSignature`)은 confirmed match에서만 발생하고 borderline/no-match에서는 금지(FR-C4) | Critical |
| INV-8 | Session, Lap | 정렬·필터·베스트/평균 등 derived selector는 원본 Lap/Session을 변경하지 않는다. 향후 필터 UI가 추가돼도 mutation 대상은 필터된 배열 index가 아닌 `(sessionId, n)` / `sessionId`로 해석 | Critical |

## Commands

구조 변경(ID/참조/시퀀스)과 일반 필드 편집을 분리한다. 모든 커맨드는 `Partial<Entity>`를 받지 않고 명시적 인자만 받는다.

| Command | Preconditions | Atomic Updates | Postconditions | Failure |
|---|---|---|---|---|
| `createSession({fps})` [구조] | phase=IDLE, 진행 중 라이브 세션 없음 | `sessions` insert {id: uuid, startedAt: now, fps, targetSig: null, quality: zeros} | 세션 영속, phase→LEARNING(ephemeral) | `E_SESSION_ALREADY_ACTIVE` |
| `enrollTarget(sessionId, sig)` [구조, 1회성] | 세션 존재, `targetSig===null`, phase=ARMED(첫 유효 통과) | `sessions.targetSig` 단일 필드 set | phase→ENROLLED, ephemeral t0/pendingLap 시작 | `E_SESSION_NOT_FOUND`, `E_ALREADY_ENROLLED` |
| `rearmTarget(sessionId)` [구조, 폐기] | 세션 존재, phase ∈ {ENROLLED, RUNNING} | `sessions.targetSig` set null; ephemeral pendingLap/t0 discard | phase→ARMED. Lap 행·quality 불변(INV-3) | `E_SESSION_NOT_FOUND`, `E_NOT_ENROLLED` |
| `recordLap(sessionId, {n, t, durationMs, suspect, matchDistance})` [구조, append-only] | 세션 존재, `targetSig!==null`, `n === maxN(sessionId)+1`(없으면 1), `durationMs>0` | `laps` insert keyed `[sessionId, n]` | Lap 영속(INV-1 유지), live 파생뷰 재계산 | `E_SEQUENCE_GAP`, `E_SESSION_NOT_FOUND`, `E_NOT_ENROLLED` |
| `updateTargetSignature(sessionId, newSig, {confirmed: true})` [필드 편집] | 세션 존재, `targetSig!==null`, 호출자가 confirmed match임을 명시 | `sessions.targetSig` set | 시그니처 EMA 갱신, INV-7 유지 | `E_SESSION_NOT_FOUND`, `E_NOT_ENROLLED`, `E_BORDERLINE_UPDATE_REJECTED` |
| `recordOtherPass(sessionId)` [필드 편집] | 세션 존재 | `sessions.quality.otherPassCount += 1` | 단조 증가(INV-6) | `E_SESSION_NOT_FOUND` |
| `recordRelearn(sessionId)` [필드 편집] | 세션 존재 | `sessions.quality.relearnCount += 1` | 단조 증가 | `E_SESSION_NOT_FOUND` |
| `recordDroppedFrames(sessionId, count)` [필드 편집, batched] | 세션 존재, count≥0 | `sessions.quality.droppedFrames += count` | 단조 증가(프레임별 아닌 배치 flush, NFR-3 예산 보호) | `E_SESSION_NOT_FOUND` |
| `toggleLapSuspect(sessionId, n)` [필드 편집] | `Lap(sessionId,n)` 존재 | `laps[...].suspect = !suspect` (해당 필드만) | `t`/`durationMs`/`matchDistance`/`n` 불변(INV-2) | `E_LAP_NOT_FOUND` |
| `endSession(sessionId)` [구조, phase 전이] | 세션 존재, phase ∈ {ARMED, ENROLLED, RUNNING} | 버퍼된 quality 최종 flush(quality 필드들) | phase→SESSION_DONE(ephemeral 전용, 영속 status 필드 없음 — A-1). 미완결 pendingLap은 폐기(당연 — 아직 Lap이 아니었음) | `E_SESSION_NOT_FOUND`, `E_NO_ACTIVE_SESSION` |
| `deleteSession(sessionId, {confirmed: true})` [구조, destructive] | 세션 존재, 호출자가 명시적 confirm 플래그 전달(UI confirm만으로 store가 신뢰하지 않음) | 단일 idb 트랜잭션: `sessions` delete id + `laps` delete range `[sessionId,*]` | Session·해당 Lap 전량 제거, orphan 없음(INV-5). 삭제 대상이 현재 라이브 세션이면 ephemeral phase→IDLE | `E_SESSION_NOT_FOUND`, `E_CONFIRM_REQUIRED` |

## Destructive Actions

| Action | Hidden Data Policy | Confirm/Undo | Cascade |
|---|---|---|---|
| `deleteSession` | 홈/결과 목록에 향후 필터·검색이 추가돼도 삭제 대상은 필터된 배열 index가 아닌 `session.id`로 해석(선반영 가드, 현재 UI엔 필터 없음). confirm 모달은 id로 재조회한 실제 세션(시작시각·랩 수)을 표시 | 2단계 confirm(삭제 탭 → 모달 확인, FR-E3/TC-005-4/TC-007-3). Undo 없음(ASSUMPTION A-4) | Session + 소속 전체 Lap 원자적 cascade(INV-4) |
| `rearmTarget`(색 칩 탭) | 필터 무관(단일 라이브 세션) | confirm 없음, 즉시 실행. Undo 없음(ux-brief B6 승계, ASSUMPTION A-4). 대신 비차단 토스트("재무장됨")로 폐기 사실을 인지시킬 것(ux-brief 실수 지점 #3 대응, UI 설계 노트) | ephemeral `targetSig`/`pendingLap`만 폐기. 이미 영속된 Lap·quality는 보존(INV-3) |
| `toggleLapSuspect` | 비파괴적 토글, 정책 대상 아님 | confirm/undo 불필요(즉시 반대 토글로 되돌릴 수 있음) | 없음. 커맨드 시그니처 자체가 `(sessionId, n)`만 받아 다른 필드 변경 경로 원천 차단 |

## Persistence

- **DB**: `minicar-laptime`(IndexedDB), version 1.
- **stores**:
  - `sessions` — keyPath `id`, index `by_startedAt`(startedAt, non-unique) — 홈 목록 desc 정렬용.
  - `laps` — keyPath `['sessionId','n']`(compound) — session별 오름차순 조회와 cascade 삭제 range query(`IDBKeyRange.bound([sessionId,-Infinity],[sessionId,+Infinity])`)를 동일 기본키로 처리, 별도 보조 인덱스 불필요.
  - `meta` — keyPath `key`, 단일 레코드 `{key:'schemaVersion', value:1}`(A-6 — Session/Lap 레코드 자체엔 버전 필드 없음).
- **runtime schema**(zod 또는 동등 validator, idb read마다 적용 — TS 캐스팅만으로 rehydrate 금지):
  - `SessionSchema`: `id:string(uuid)`, `startedAt:number>0`, `fps:number>0`, `targetSig: number[]|null`(A-7, bin 구조 Phase3 확정 전 opaque), `quality:{droppedFrames:number>=0, relearnCount:number>=0, otherPassCount:number>=0}`.
  - `LapSchema`: `sessionId:string`, `n:number(int>=1)`, `t:number>=0`, `durationMs:number>0`, `suspect:boolean`, `matchDistance:number>=0`.
- **migration**: `idb.upgrade(db, oldVersion, newVersion, tx)` 콜백. v1→v2(향후)는 가능하면 additive(신규 optional 필드 default 채움)만 허용, breaking 변경은 upgrade 트랜잭션 내 1회 transform pass. transform 실패 시 트랜잭션 abort(idb 기본 동작) → invalid-state recovery 경로로.
- **invalid-state recovery**: `meta.schemaVersion` 불일치(알려진 마이그레이션 경로 밖) 또는 개별 레코드 schema validation 실패 시 해당 레코드만 quarantine(목록·selector에서 제외, 전체 로드 crash 금지) + 복구 배너("일부 데이터를 불러오지 못했습니다") + [손상 데이터 원본 JSON 내보내기] / [손상 세션만 삭제] 선택지 제공. 전체 DB 초기화는 별도의 명시적 "전체 초기화" 액션(자체 confirm 필요)에서만, 파싱 실패로 자동 트리거되지 않음.
- **quota/size/count budget**:
  - 세션당 Lap 상한: soft 360(30분 세션 ÷ 최소 랩 5s, NFR-1) — max fixture로 사용. 초과 자체를 막지 않음(짧은 랩 다수는 정상 시나리오), 500+ 시 진단 경고만.
  - 세션 개수 상한: 앱 레벨 하드 캡 없음(ASSUMPTION A-5) — 브라우저 IndexedDB quota(`navigator.storage.estimate()`)에 위임, `usage/quota>0.8` 시 홈 화면 경고 배너(임계값 임의 설정, ASSUMPTION).
  - 레코드 크기: `targetSig` 히스토그램(bin 수 Phase3 확정 전) 외 나머지 필드는 수 바이트 수준 — quota 대비 무시 가능.

## Verification Matrix

| Requirement | Scenario | Test Level | Evidence |
|---|---|---|---|
| NFR-5 / TC-005-1 | `recordLap` 연속 호출(n=1..k) → `laps.map(n)===[1..k]`; 비순차 n 입력 시 거부 | unit(store) | Vitest: 정상 시퀀스 통과 + `E_SEQUENCE_GAP` 케이스 |
| FR-E2 / NFR-5 / TC-005-2 | 확정 Lap `toggleLapSuspect` 반복 호출 후 `t`/`durationMs`/`matchDistance` diff 없음 | unit(store) | Vitest: toggle 전후 필드 스냅샷 비교 |
| FR-C2 / NFR-5 / TC-005-3 / TC-003-5 | ENROLLED에서 Lap 1건 이상 기록 → `rearmTarget` → `targetSig=null`, 기존 Lap·quality 불변 확인 | unit(store) + integration(측정 화면) | Vitest store test + RTL: 색 칩 탭 후 랩 테이블 값 불변, 토스트 노출 |
| FR-E3 / NFR-5 / TC-005-4 / TC-007-3 | confirm 없이 `deleteSession` 호출 시 `E_CONFIRM_REQUIRED`; confirm 후 cascade 삭제 | unit(store) + component(결과 화면 confirm 모달) | Vitest + RTL: 모달 취소 시 데이터 잔존, 확인 후 `sessions`/`laps` 0건(INV-4·INV-5) |
| FR-E4 / TC-008-1 | 세션 저장 후 홈 재조회 시 목록 표시(startedAt desc) | integration | idb-fake 기반 store round-trip |
| FR-E4 / TC-008-2 | v0/손상 레코드 rehydrate 시 마이그레이션 또는 quarantine 배너 | integration | 고정 손상 JSON fixture로 `upgrade()`/validator 경로 검증 |
| FR-E1 / FR-E5 | 결과 화면 best/avg/σ/otherPassCount selector가 원본 Lap/Session 참조를 변경하지 않음(INV-8) | unit(selector) | 동일 laps 배열 반복 selector 호출 후 원본 참조 동일성(불변) 검증 |
| INV-3 경계 | RUNNING 중 pendingLap은 idb write 호출을 발생시키지 않음(확정 Lap만 write) | unit(store) + integration | mock timer로 pass 이벤트 시퀀스 재생, idb write 호출 횟수/시점 assert |
| max fixture | 360랩 세션에서 `recordLap` 반복 + best/avg selector 재계산 | perf(unit) | Vitest: 360건 삽입 후 selector 재계산이 NFR-3 프레임 예산을 저해하지 않는 정성 확인(수치 상한은 ASSUMPTION, 별도 하드 넘버 미고정) |
| filter/search × delete(선반영 가드) | 홈 목록에 필터 추가 시 삭제 대상이 필터 index가 아닌 `session.id`로 해석 | 설계 원칙 체크리스트 | 현재 필터 UI 부재로 자동 테스트 대상 아님 — 코드 리뷰 게이트 항목으로 등록 |

## Assumptions and Blockers

- `ASSUMPTION` A-1: 데이터 모델(`Session`)에 명시적 status/done 필드가 없다(project-brief §5 원문). `SESSION_DONE`은 순수 ephemeral 상태로 취급하고, 영속 레코드는 완료 여부를 별도 저장하지 않는다. 새로고침/크래시로 라이브 상태가 유실돼도 이미 저장된 세션은 그대로 열람 가능(암묵적 완료). 필요 시 Phase3에서 `status` 필드 추가 검토.
- `ASSUMPTION` A-2: `Lap`에 고유 `id` 필드가 데이터 모델에 없다. `(sessionId, n)` 복합키를 canonical reference로 채택(idb 기본키와 동일).
- `ASSUMPTION` A-3: `Lap.t`의 의미를 "해당 랩을 완결시키는 통과 이벤트의 타임스탬프"로 해석했다(brief 원문에 명시적 정의 없음).
- `ASSUMPTION` A-4: 세션 삭제·재무장 모두 undo 없음(ux-brief B6 승계). 재무장은 비차단 토스트로 폐기 사실만 인지시킨다.
- `ASSUMPTION` A-5: 세션 개수 앱 레벨 하드 캡 없음, 브라우저 quota에 위임하고 0.8 임계 경고 배너는 임의 설정.
- `ASSUMPTION` A-6: 스키마 버전을 레코드별이 아닌 `meta` 스토어 단일 키로 관리(데이터 모델에 version 필드 없음, TC-008-2 요구 충족을 위한 최소 설계).
- `ASSUMPTION` A-7: `targetSig`(HSV 히스토그램) bin 수·metric은 FEAT-003 Phase3 캘리브레이션 확정 전까지 저장 형식을 opaque `number[]`로만 고정한다(feature-plan.md 기존 open item과 정합).
- `ASSUMPTION` A-8: cross-tab 동기화·import/export 요구 없음(모바일 단일 탭 사용 시나리오, brief에 언급 없음) — 범위 외로 처리.
- `BLOCKER`: 없음. 위 항목 모두 설계 진행을 막지 않는 합리적 기본값으로 해결했다.
