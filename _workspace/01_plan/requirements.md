# Requirements — minicar-laptime

Source: `_workspace/01_plan/project-brief.md`(v3, 확정). 각 수용 기준(AC)에 `LOCAL_VERIFIABLE`(로컬 자동화로 검증 가능) 또는 `DEPLOY_ONLY`(실기기/실브라우저 필요, 로컬 자동화 불가) 라벨을 붙인다. 카메라/센서 경로는 원칙적으로 `DEPLOY_ONLY`다.

## 기능 요구사항 (Functional)

### FR 그룹 A — 세션 라이프사이클

- **FR-A1** 세션 시작 시 상태머신 `IDLE → LEARNING(~1.5s 배경학습) → ARMED`로 전이한다.
  - AC: LEARNING 종료 후 ARMED 진입을 합성 프레임 입력으로 검증. `[LOCAL_VERIFIABLE]`
- **FR-A2** LEARNING 중 흔들림 감지 시 재학습, 배경 급변 지속 시 재학습+안내 배너.
  - AC: 진동/배경급변 합성 fixture로 재학습 트리거 검증. `[LOCAL_VERIFIABLE]`
- **FR-A3** ARMED 상태에서 60초간 타깃 무통과 시 안내 배너를 표시한다.
  - AC: 타이머 로직 단위 테스트. `[LOCAL_VERIFIABLE]`
- **FR-A4** 세션 상한 30분(ASSUMPTION, brief §8) 도달 시 자동 종료 처리한다.
  - AC: 타이머 로직 단위 테스트. `[LOCAL_VERIFIABLE]`
- **FR-A5** 정지 조작 시 `SESSION_DONE`으로 전이하고 결과 화면으로 이동한다.
  - AC: 상태 전이 테스트 `[LOCAL_VERIFIABLE]`; 실제 카메라 트랙 정지(`getUserMedia` track stop) 확인 `[DEPLOY_ONLY]`

### FR 그룹 B — 통과 감지(초근접 가림)

- **FR-B1** 후면 카메라 60fps 320×240 스트림에서 전역 차분율 임계(40%)로 가림 burst를 검출한다.
  - AC: 카메라 스트림 획득/권한/실제 60fps `[DEPLOY_ONLY]`; 차분율 계산 로직은 합성 프레임 시퀀스로 `[LOCAL_VERIFIABLE]`
- **FR-B2** 통과 시각은 burst 시간 중심으로 계산하며 오차 ≤ ±1프레임(60fps 기준 ±17ms)이다.
  - AC: 합성 fixture로 결정론적 시각 계산 검증 `[LOCAL_VERIFIABLE]`; 실기기 60fps 안정성/`rVFC` 정확도 `[DEPLOY_ONLY]`
- **FR-B3** 가림(40%) vs 진동(<15%) 임계를 이원화해 트랙 진동으로 인한 이중 트리거(R4)를 방지한다.
  - AC: 합성 진동 fixture로 오탐 0 검증. `[LOCAL_VERIFIABLE]`
- **FR-B4** `minGap`(기본 0.3s, ASSUMPTION)로 통과 이벤트를 디바운스한다.
  - AC: 연속 이벤트 합성 fixture 테스트. `[LOCAL_VERIFIABLE]`
- **FR-B5** 바짝 붙은 추격으로 burst가 병합되면(단독 20–40ms vs 병합 60ms+) 의심 배지를 부여한다(R2).
  - AC: 병합 burst 합성 fixture. `[LOCAL_VERIFIABLE]`

### FR 그룹 C — 타깃 등록 및 확인(1-vs-rest)

- **FR-C1** 첫 통과 burst의 전경 픽셀 HSV 히스토그램으로 타깃 시그니처를 자동 등록한다(`ENROLLED`).
  - AC: 합성 컬러 프레임 fixture로 시그니처 생성 검증. `[LOCAL_VERIFIABLE]`
- **FR-C2** 등록 직후 타깃 색 견본 칩을 표시하고, 탭하면 `ARMED`로 재무장하며 이전 미확정 데이터를 폐기한다.
  - AC: 상호작용(2탭 이내) 및 상태 폐기 로직 `[LOCAL_VERIFIABLE]`(RTL/component test); 실기기 탭 지연/터치 정확도 `[DEPLOY_ONLY]`
- **FR-C3** 이후 통과마다 시그니처 거리 계산 후 match(랩 확정)/borderline(랩+의심 배지)/no-match(타차 무시)로 분기한다.
  - AC: 합성 fixture(타깃 단독/타깃+타차 교차/유사 색 타차) — 랩 오기록 0·누락 0. `[LOCAL_VERIFIABLE]`
- **FR-C4** 확신 매칭에서만 느린 EMA로 시그니처를 갱신한다(조명 드리프트 추종); 경계 매칭에서는 갱신을 금지한다(타차 오염 방지).
  - AC: 조명 드리프트 fixture로 EMA 갱신/미갱신 분기 검증. `[LOCAL_VERIFIABLE]`
- **FR-C5** 보조 신호(직전 랩 대비 ±60% 주기 이탈)는 의심 배지 가중에만 사용하고 판정 자체는 색상만이 정본이다(값 날조 금지 — 주기로 자동 배정하지 않음).
  - AC: 판정 로직이 색상 거리만으로 1차 분기함을 단위 테스트로 고정. `[LOCAL_VERIFIABLE]`

### FR 그룹 D — 랩 기록 및 라이브 보드

- **FR-D1** 타깃 랩 최소 주기(기본 2s, ASSUMPTION) 미만 재통과는 랩으로 확정하지 않는다.
  - AC: 합성 fixture. `[LOCAL_VERIFIABLE]`
- **FR-D2** 측정 화면은 현재 랩 경과, 직전 랩, best, 랩 수, 타깃 색 칩을 실시간 표시한다.
  - AC: 상태 바인딩 렌더 테스트 `[LOCAL_VERIFIABLE]`; 실제 60fps 갱신 부드러움 `[DEPLOY_ONLY]`
- **FR-D3** 타깃 통과는 플래시+햅틱 피드백, 타차 통과는 미세 틱으로 구분 표시한다.
  - AC: 이벤트→피드백 트리거 로직 `[LOCAL_VERIFIABLE]`; 실제 Vibration API/화면 플래시 체감 `[DEPLOY_ONLY]`

### FR 그룹 E — 결과 및 영속성

- **FR-E1** 결과 화면은 랩 테이블(best 하이라이트, 의심 배지), 타차 통과 수(진단), 공유, 삭제를 제공한다.
  - AC: 컴포넌트 렌더/데이터 바인딩 테스트. `[LOCAL_VERIFIABLE]`
- **FR-E2** suspect는 사후 수동 토글(확정↔의심)이 가능하다.
  - AC: 토글 상태 전이 단위 테스트. `[LOCAL_VERIFIABLE]`
- **FR-E3** 세션 삭제는 세션 단위이며 confirm 절차를 거친다.
  - AC: confirm 흐름 컴포넌트 테스트. `[LOCAL_VERIFIABLE]`
- **FR-E4** 세션은 IndexedDB(`LOCAL_DOMAIN_STATE_MODE`)에 저장되며 홈 화면에서 지난 세션을 조회한다.
  - AC: idb 저장/조회 로직 단위 테스트 `[LOCAL_VERIFIABLE]`; 실브라우저 IndexedDB quota/영속성 `[DEPLOY_ONLY]`
- **FR-E5** 랩 리스트를 텍스트로 공유한다.
  - AC: 포맷팅 로직 `[LOCAL_VERIFIABLE]`; 실제 OS 공유 시트/클립보드 동작 `[DEPLOY_ONLY]`

### FR 그룹 F — 디바이스 기능

- **FR-F1** Wake Lock으로 측정 중 화면 꺼짐을 방지한다.
  - AC: Wake Lock API 호출 로직 mock 테스트 `[LOCAL_VERIFIABLE]`; 실기기 지원 여부·유지 `[DEPLOY_ONLY]`
- **FR-F2** 토치(플래시) 옵션을 제공하며, 미지원 기기(iOS 등)에서는 기능 게이트를 정직하게 표시한다(R7).
  - AC: capability 감지→UI 게이트 로직 `[LOCAL_VERIFIABLE]`; 실기기 `ImageCapture` torch 지원 `[DEPLOY_ONLY]`
- **FR-F3** 저가폰 30fps 등 낮은 프레임레이트 감지 시 정밀도 강등(±33ms) 표시.
  - AC: fps 감지→배지 표시 로직 `[LOCAL_VERIFIABLE]`; 실기기 실측 fps `[DEPLOY_ONLY]`

## 비기능 요구사항 (Non-Functional)

- **NFR-1 정밀도**: 통과 시각 오차 ≤ ±1프레임(60fps 기준 ±17ms), 랩 길이(5–30s) 대비 0.06–0.3%.
  `[LOCAL_VERIFIABLE]`(합성 fixture 결정론 검증) + `[DEPLOY_ONLY]`(실기기 60fps 안정성 확인)
- **NFR-2 정확도**: 혼주 상황에서 타깃 랩 누락 0, 타차 랩 오기록 0(경계는 의심 배지로 정직 표시).
  `[LOCAL_VERIFIABLE]`(brief §9 합성 fixture 스위트 전체)
- **NFR-3 성능**: 프레임당 CV 처리 <2ms(Worker), 히스토그램은 burst 프레임(1–3장)에서만 계산.
  `[LOCAL_VERIFIABLE]`(Vitest 벤치마크, 합성 프레임) + `[DEPLOY_ONLY]`(실기기 Worker 스케줄링 하 실측)
- **NFR-4 제로 셋업**: 조작 2탭 이내(측정 시작 탭, 필요 시 재무장 탭)로 완결.
  `[LOCAL_VERIFIABLE]`(상호작용 시퀀스 테스트) + `[DEPLOY_ONLY]`(실기기 터치 체감)
- **NFR-5 상태 불변식**: 랩 번호 연속, suspect만 사후 토글 가능, 삭제는 세션 단위 confirm, 재무장 시 이전 미확정 데이터 폐기.
  `[LOCAL_VERIFIABLE]`(상태 저장소 단위 테스트)
- **NFR-6 보안 컨텍스트**: `getUserMedia`는 secure context(HTTPS) 필수. 배포는 선택(ASSUMPTION), 로컬 개발은 HTTPS dev server 또는 `localhost` 예외 사용.
  `[DEPLOY_ONLY]`
- **NFR-7 클라이언트 온리**: 서버/계정 없음, 외부 API 호출 없음(AI_MODE=false와 일관).
  `[LOCAL_VERIFIABLE]`(번들/네트워크 호출 부재 정적 검사)
- **NFR-8 접근성 baseline**(ASSUMPTION — brief에 명시 없음, 하네스 기본값 적용): 핵심 컨트롤(시작/정지/토치/재무장/삭제)에 axe-core 기준 critical 위반 0.
  `[LOCAL_VERIFIABLE]`(axe-core 자동 검사)

## Won't (Phase 2, brief §3 OUT / §10 부록)

- N대 전원 동시 계측(전체 재식별) — 단, 엔진 계약을 "통과 이벤트(시각+시그니처) 스트림"으로 설계해 향후 확장 가능하게 유지(brief §10).
- 스플릿 타임
- 영상 리플레이
- 서버/계정
- tamiya-motor-lab 연동

## Source Trace

| 절 | Source | Notes |
|---|---|---|
| FR 그룹 A | `project-brief.md` §2 상태머신(L57-64), §8(L115 세션 30분) | 상태머신 그대로 승계 |
| FR 그룹 B | `project-brief.md` §2 파이프라인(L47-55), §7 R2/R4(L105,107) | |
| FR 그룹 C | `project-brief.md` §2 타깃 확인(L34-46) | |
| FR 그룹 D | `project-brief.md` §4 측정 화면(L83-84), §8(L115 minGap) | |
| FR 그룹 E | `project-brief.md` §3 MVP IN(L72-74), §5 도메인 상태(L87-92) | |
| FR 그룹 F | `project-brief.md` §3 MVP IN(L74), §7 R6/R7(L109-110) | |
| NFR-1~3 | `project-brief.md` §1 성공조건(L23-24), §2 정밀도·성능(L66-68) | |
| NFR-4 | `project-brief.md` §1(L23) | |
| NFR-5 | `project-brief.md` §5 불변식(L91-92) | |
| NFR-6, NFR-7 | `project-brief.md` §0(L9-13), §6(L94-98) | |
| NFR-8 | 없음 — ASSUMPTION(하네스 기본 baseline) | `_workspace/00_source/gap-report.md` B7 참조 |
| Won't | `project-brief.md` §3 OUT(L76-77), §10(L126-132) | |
