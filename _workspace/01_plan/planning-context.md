# Planning Context — minicar-laptime

Source: `_workspace/01_plan/project-brief.md`(v3, 확정). 이 문서는 brief를 재작성하지 않고, `planning-facilitation-contract.md`/`planning-readiness-contract.md` 형식으로 분해한 것이다.

## Current Planning Memo

- **대상 화면/기능**: 홈, 측정, 결과 3화면으로 구성된 client-only 랩타임 측정 SPA. 핵심 기능은 (1) 초근접 가림 기반 통과 감지, (2) 첫 통과 차 자동 타깃 등록, (3) HSV 색상 히스토그램 1-vs-rest 매칭으로 혼주(여러 차 동시 주행) 중 타깃 랩만 기록.
- **주 사용자와 목적**: 타미야 미니카 트랙에서 여러 대가 함께 도는 상황에서 자신의 차 랩타임을 셋업 없이 측정하려는 취미 레이서. 목표는 "폰을 레인 벽에 걸쳐두고 [측정 시작]만 누르면" 자신의 차 기록만 정확히 남는 것.
- **확인된 요구사항**: `requirements.md` 전체(brief §1~9에서 분해). 핵심 수용 기준은 성공 조건 3가지 — 조작 2탭 이내, 타깃 랩 누락 0·타차 랩 오기록 0(경계는 의심 배지), 오차 ≤ ±1프레임(60fps ±17ms).
- **빠진 상태·시나리오**: brief §7 리스크 대장(R1~R7)이 예외/엣지 상태 대부분을 이미 커버(유사색 오탐, burst 병합, 첫 통과 오인식, 진동 이중 트리거, 조명 드리프트, 저조도/미끄러짐, 저사양 기기). 이번 ingestion에서 추가로 확인한 빈틈은 `_workspace/00_source/gap-report.md`의 INFO 항목(카메라 권한 거부 UX 카피, 공유 텍스트 포맷, 저사양 강등 문구, 접근성 baseline) — 모두 구현을 막지 않는 수준이며 Phase2에서 구체화한다.
- **가정과 검증 방법**: `gap-report.md`의 ASSUMPTION 표 참조. 핵심 가정(첫 통과=내 차, minGap/랩주기/세션상한 수치, 단일 레인 기하)은 brief §8에서 이미 확정됐고, 이번 단계에서 추가된 가정(패키지 정확 버전, 라우팅 방식, 재무장 즉시실행 여부, 접근성 baseline)은 저~중위험이며 가역적이다.
- **상대 노력도**: 전체 `L`(다수 신규 도메인 로직 + 실기기 API 다수 + 정밀도 요구로 검증 범위 확대). 세부는 `feature-plan.md` 참조. 가장 노력이 큰 단위는 "타깃 등록/매칭(1-vs-rest)"(오판정 리스크가 제품 신뢰도에 직결).
- **다음 질문 또는 행동**: 없음(BLOCKER 0). Phase2(design)에서 색 칩/의심 배지/상태 배너의 시각 표현을 신규로 결정해야 하나, 이는 시각 디자인 결정이지 제품 결정이 아니므로 이번 ingestion 범위 밖이다.

## 대상 화면·기능

`_workspace/01_plan/ux-brief.md`의 화면 인벤토리 참조(홈/측정/결과, 3화면 고정).

## 사용자 업무

"트랙 도착 → 폰을 레인 벽에 다리처럼 거치(후면 카메라가 레인 바닥을 내려다봄) → [측정 시작] 탭 → (선택: 색 칩 확인 후 필요 시 재무장 1탭) → 주행 → [정지] → 결과 확인/공유." 사전 설정(게이트 긋기, 차량 수동 등록) 없음이 핵심 업무 전제다.

## 현재 pain

- brief 자체가 "사용자 정정 2회 반영"된 v3 확정본이며 이전 버전 원문(pain point 서술)은 저장소에 없다 — 이전 버전이 무엇을 어려워했는지는 추정하지 않는다(`gap-report.md` INFO I2).
- brief가 명시적으로 서술한 핵심 기술적 pain은 하나다: 혼주(여러 차 동시 주행) 상황에서 "내 차만" 구분해 랩을 기록해야 하는 것(§2). 이를 게이트·수동 등록 없이 색상 1-vs-rest 확인으로 해결하는 것이 이 기획의 핵심 결정이다.

## 관찰 가능한 성공 조건 (brief §1 그대로 승계)

1. 조작 2탭 이내.
2. 혼주 중 타깃 랩 누락 0·타차 랩 오기록 0(경계 사례는 의심 배지로 정직 표시).
3. 오차 ≤ ±1프레임(60fps ±17ms).

## 데이터 전략

- CV/통과감지/매칭 로직: `mock` — brief §9의 합성 fixture(타깃 단독 통과, 타깃+타차 교차 통과, 유사 색 타차 borderline, 바짝 붙은 병합 burst, 진동 스파이크, 드랍 프레임, 조명 드리프트)로 normal/경계/예외 상태를 결정론적으로 검토한다.
- 세션 데이터 저장: `LOCAL_DOMAIN_STATE_MODE`(IndexedDB), 서버 없음 — production mutation 이슈 자체가 존재하지 않는다(client 로컬 저장뿐).
- 실기기 검증(카메라 스트림/토치/Wake Lock/실촬영 회귀): `production-integration-later`에 준함 — 합성 fixture 기반 mock 검증을 Phase3 완료 기준으로 먼저 통과시키고, 실기기·실촬영 회귀(brief §9, tamiya real-motors 패턴 2~3개)는 별도 단계로 분리한다.

## 노력 트레이드오프

- Effort driver: 신규 도메인 로직(HSV 히스토그램/burst 검출/1-vs-rest 매칭) 다수, 실기기 API(camera/torch/wakelock/vibration) 다수, 정밀도 요구(±1프레임)로 인한 검증 범위 확대.
- 권고: `invest` — 핵심 판정 로직(타깃 매칭)은 리스크(R1 false accept — 잘못된 랩 기록)가 제품 신뢰도에 직결되므로 축소 대신 합성 fixture 스위트에 투자한다.
- 가장 작은 가시적 검토 단위: "타깃 단독 통과 1건 → 등록 → 같은 색으로 재통과 → 매칭 성공"(brief §9 fixture 목록의 첫 항목)을 최소 devloop으로 먼저 통과시키는 것.
- Mock 검토 노력 vs production 통합 노력: 합성 fixture 스위트(자동화 가능, 대부분의 정확도 요구를 커버)와 실기기·실트랙 촬영 회귀(사람이 트랙에서 촬영해야 하는 별도 노력)를 분리해 다룬다. 후자를 Phase3 완료 기준에 섞지 않는다.

## UX Check

`_workspace/01_plan/ux-brief.md`의 `## UX Check` 참조. 측정/결과 화면이 정보 밀도가 높고(다중 상태 배지), 삭제(destructive)·suspect 수동 토글(부분 상태 정정)이 있어 자동 UX Check 트리거가 적용된다.

## Source Trace

| 절 | Source | Notes |
|---|---|---|
| 대상/사용자/업무/성공조건 | `project-brief.md` §1(L15-24) | 그대로 승계 |
| 데이터 전략 | `project-brief.md` §0(L9-13), §9(L118-124) | mock/DEPLOY_ONLY 구분 근거 |
| 빠진 상태·시나리오 | `project-brief.md` §7(L100-110) | 리스크 대장을 상태 커버리지로 재해석 |
| 노력 트레이드오프 | `project-brief.md` §2 전체, §7(L100-110) | 판단 근거, planning-readiness-contract 형식 적용 |
| 현재 pain | `project-brief.md` §2(L28-33) | 유일하게 명시된 pain(혼주 구분 문제) |
| UX Check | `_workspace/01_plan/ux-brief.md`(2차 산출물) | 원 출처는 `project-brief.md` §1/§5/§7 |
