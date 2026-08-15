# Feature Plan — minicar-laptime

Source: `_workspace/01_plan/project-brief.md`(v3, 확정). 준비도 리뷰(plan-review NEEDS_DECISION #2·#3) 대응으로 design-readiness §3 표준 형식 + `TC-NNN-N` test case로 승격. 새 기능 발명 없음 — 기존 기능의 형식 표준화 + 동작 명세.

## Feature List

| ID | 기능 | 사용자 가치 (1줄) | 우선순위 | 화면 | 이번 범위 |
|---|---|---|---|---|---|
| FEAT-001 | 세션 상태머신 | 올려두면 자동으로 학습→대기→계측 흐름이 진행 | Must | 전역/측정 | keep |
| FEAT-002 | 통과 감지(burst) | 손 스톱워치 없이 차 통과를 정확히 포착 | Must | 측정 | keep |
| FEAT-003 | 타깃 등록/매칭(1-vs-rest) | 혼주 중 내 차만 골라 랩 기록 | Must | 측정 | keep (HSV 임계 Phase3 확정) |
| FEAT-004 | burst 병합 방어 | 바짝 붙은 추격을 오기록 대신 의심 표시 | Should | 측정 | keep |
| FEAT-005 | 랩 기록/불변식 | 랩이 손실·오염 없이 신뢰되게 저장 | Must | 측정/결과 | keep |
| FEAT-006 | 라이브 보드 | 주행 중 현재 랩·best를 한눈에 | Must | 측정 | keep |
| FEAT-007 | 결과 화면 | 세션 후 랩 리스트·통계·공유 | Must | 결과 | keep |
| FEAT-008 | 세션 영속성(IndexedDB) | 지난 세션을 다시 열어봄 | Must | 홈/전역 | keep |
| FEAT-009 | 디바이스 기능(Wake Lock/토치/fps) | 화면 꺼짐·저조도·저사양 대응 | Should | 측정 | keep |
| FEAT-010 | 홈 화면 | 측정 시작·지난 세션·첫 방문 안내 | Must | 홈 | keep |
| FEAT-011 | 실촬영 회귀 | 실제 트랙 클립으로 엔진 검증 | Should | — | split (Phase 3 완료 기준과 분리, DEPLOY_ONLY) |

부가 메모(Effort/Driver): FEAT-003이 L(핵심 도메인·오판 리스크 R1 최고·fixture 최다), 001/002/006/007이 M, 나머지 S. 최소 가시 단위 = FEAT-003의 "타깃 단독 통과→등록→매칭 성공".

---

## 동작 명세 + Test Case

> UI·상태 로직은 결정론 TC로 확정. **HSV 매칭 임계값(FEAT-003)은 지금 수치를 확정하지 않는다**(gap-report B1) — 구조만 명세하고 파라미터는 Phase 3 첫 fixture 캘리브레이션에서 확정 후 이 문서에 write-back(증명 없는 수치 금지).

### FEAT-001 세션 상태머신
전이: `IDLE →[시작]→ LEARNING(배경 EMA ~1.5s) →(안정)→ ARMED →(첫 통과)→ ENROLLED(t0·타깃 시그니처) →(통과)→ 랩기록 →[정지]→ SESSION_DONE`. 예외: 재학습·무통과·배경급변.
- TC-001-1: Given LEARNING 진입, When 1.5s간 배경 안정, Then ARMED 전이 + "대기" 배너.
- TC-001-2: Given LEARNING 중, When 지속 흔들림, Then ARMED 안 감 + "폰이 흔들려요" 후 재학습(relearnCount+1).
- TC-001-3: Given ARMED, When 첫 유효 통과, Then ENROLLED(t0·타깃 시그니처 생성)·색 칩 표시.
- TC-001-4: Given RUNNING 중 타깃 60s 무통과, Then "차가 멈췄나요?" 배너(측정 유지, SESSION_DONE 아님).
- TC-001-5: Given RUNNING, When 배경 급변 지속(폰 이동/기울어짐), Then 자동 재학습 + 안내.

### FEAT-002 통과 감지(burst)
전역 차분율 이원화: 가림 ≥40%=통과 후보, 진동 <15%=무시. burst=상승교차~하강교차. 통과시각=burst 시간 중심(1–3프레임 가중). minGap(0.3s) 디바운스.
- TC-002-1: Given ARMED, When changeRatio 5%→55%→8% (2프레임 상승 후 하강), Then 통과 1건, 시각=burst 중심(±1프레임).
- TC-002-2: Given 통과 직후, When 12% 스파이크(진동), Then 통과로 세지 않음(오탐 0).
- TC-002-3: Given 통과 직후 minGap 내, When 2번째 가림 burst, Then 디바운스로 무시.
- TC-002-4: Given 드랍 프레임 포함, When 통과, Then rVFC mediaTime 기반 통과시각 오차 ≤±1프레임 유지 + droppedFrames 계측.
- TC-002-5: (R19 write-back) Given ARMED/RUNNING, When 그림자가 감지 구간을 지나감(밝기만 비율 감소·색 보존 — 진입·체류·이탈 전 과정), Then 통과로 세지 않음(타이머 미시작·랩 미기록, 오탐 0). 근거: engine.test.ts "R19 그림자" 4건, 판정=밝기비율 [0.4,0.93]+대립채널 k-스케일 보존, `?shadowMin/Max/Chroma=` 튜닝.
- TC-002-6: (R20 write-back) Given ARMED/RUNNING, When 원거리 사물이 화면을 1s 초과~2s 미만 느리게 가림(걸어가는 사람 등), Then 통과로 세지 않음 + 직후 정상 통과는 감지(디바운스 미오염). 근거: engine.test.ts "R20 지속시간 게이트" 2건, `maxPassDurationMs=1000`, `?maxPass=` 튜닝. 알려진 한계: 15cm 근접의 절대 판정은 단안 카메라로 불가 — 배치(카메라 하향)와 병용.

### FEAT-003 타깃 등록/매칭(1-vs-rest) — HSV 임계 Phase 3 write-back
첫 통과 burst 전경 픽셀로 타깃 HSV 히스토그램 생성. 통과마다 거리 계산 → match/borderline/no-match. 확신 match만 느린 EMA 갱신.
- TC-003-1: (구조·파라미터 placeholder) Given 타깃 시그니처 S, When 통과 거리 d를 `THR`와 비교, Then `d≤THR`→match(랩 확정) · `THR<d≤THR+MARGIN`→borderline(랩+의심) · `d>THR+MARGIN`→no-match(무시·otherPassCount+1). **`bin수·metric·THR·MARGIN`은 Phase 3 fixture 캘리브레이션 확정 후 write-back.**
- TC-003-2: Given 타깃 등록됨, When 색 상이 타차 통과, Then no-match(랩 미기록).
- TC-003-3: Given 타깃 등록됨, When 유사 색 타차 통과, Then borderline→랩+의심(조용히 버리지도 넣지도 않음).
- TC-003-4: Given 확신 match 연속, When 조명 서서히 드리프트, Then 느린 EMA 추종(borderline에선 갱신 금지).
- TC-003-5: Given 첫 통과가 내 차 아님, When 색 칩 탭(재무장), Then ENROLLED 폐기→ARMED, 미확정 데이터 폐기(FEAT-005 연동).

### FEAT-004 burst 병합 방어
- TC-004-1: Given 두 차 바짝 붙어 통과, When burst 길이 ≥60ms(단독 20–40ms 초과), Then 해당 랩 의심 배지.

### FEAT-005 랩 기록/불변식
- TC-005-1: 랩 번호 n은 세션 내 1부터 연속(누락/중복 없음).
- TC-005-2: Given 확정 랩, When suspect 토글, Then 확정↔의심만 바뀜(durationMs·t 불변).
- TC-005-3: Given 재무장, Then ENROLLED 이후 미확정 랩·타깃 시그니처 폐기(확정 랩 보존).
- TC-005-4: Given 세션, When 삭제, Then confirm 후에만 세션+소속 랩 제거.

### FEAT-006 라이브 보드
- TC-006-1: Given RUNNING, Then 현재 랩 경과·직전·best·랩수·타깃 색 칩 바인딩(정보 위계=ux-brief 측정 Primary 순서).
- TC-006-2: Given 타깃 통과, Then 플래시·햅틱(타차는 미세 틱만). [피드백 체감 DEPLOY_ONLY]

### FEAT-007 결과 화면
- TC-007-1: Given 랩 ≥1, Then 랩 테이블(best 하이라이트·의심 배지)·avg·σ·타차 통과 수·공유.
- TC-007-2: Given 0랩 종료, Then "기록된 랩 없음" empty(에러 아님).
- TC-007-3: Given 삭제 탭, Then confirm 후에만 삭제(TC-005-4).

### FEAT-008 세션 영속성(IndexedDB) [LOCAL_VERIFIABLE]
- TC-008-1: Given 세션 저장, When 홈 재진입, Then 지난 세션 목록 표시.
- TC-008-2: Given 스키마 v1, When 로드, Then 마이그레이션 버전 확인·무결 복원.

### FEAT-009 디바이스 기능 [일부 DEPLOY_ONLY]
- TC-009-1: Given 측정 시작, When Wake Lock 지원, Then 화면 유지(미지원은 안내 배너).
- TC-009-2: Given 토치 미지원(iOS), Then 토치 버튼 비활성(기능 게이트).
- TC-009-3: Given 30fps 기기, Then 정밀도 ±33ms 강등 표시(숨기지 않음).

### FEAT-010 홈 화면
- TC-010-1: Given 첫 방문, Then 거치 안내 1장 + [측정 시작].
- TC-010-2: Given 지난 세션 존재, Then 목록·탭하면 결과 상세.

### FEAT-011 실촬영 회귀 [DEPLOY_ONLY]
- TC-011-1: 실촬영 클립 2~3개(혼주 포함 1개) 회귀 — 실데이터 필요, 로컬 자동화 불가. Phase 3 완료 기준과 분리.

## Won't / Phase 2 (brief §3 OUT, §10 부록)

- N대 전원 동시 계측(전체 재식별) — 엔진 계약을 "통과 이벤트(시각+시그니처) 스트림"으로 설계해 소비층(단일 타깃 필터 vs 클러스터러)만 교체 가능하게 유지. MVP는 확장성만 유지, phase 2 UI/클러스터링 미구현.
- 스플릿 타임, 영상 리플레이, 서버/계정, tamiya-motor-lab 연동.

## 데이터 모델 (brief §5 승계, 요약)

- `Session { id, startedAt, fps, targetSig, quality{droppedFrames, relearnCount, otherPassCount} }`
- `Lap { sessionId, n, t, durationMs, suspect, matchDistance }`
- 불변식: 랩 번호 연속 / suspect만 사후 수동 토글 / 삭제는 세션 단위 confirm / 재무장 시 미확정 데이터 폐기. authoritative = `requirements.md` NFR-5·FR-E2/E3 + `project-brief.md` §5.

## Source Trace

| 절 | Source | Notes |
|---|---|---|
| Feature List (FEAT-NNN) | `project-brief.md` §2·§3·§4·§9 | 기존 기능을 design-readiness §3 표준으로 승격 |
| Test Case (TC-NNN-N) | `project-brief.md` §2 상태머신·§7 리스크·§9 fixture / `requirements.md` FR·NFR | UI·상태는 결정론 확정, HSV 임계는 write-back placeholder |
| Won't·데이터 모델 | `project-brief.md` §3 OUT·§5·§10 | |
