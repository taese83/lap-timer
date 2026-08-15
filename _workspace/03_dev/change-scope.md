# Change Scope

## R19 — 그림자 오탐 필터 (2026-08-15)

CHANGE_MODE: existing-change
REQUEST: 그림자가 지나가도 타이머가 시작되는 오탐 제거 — 실물 가림만 통과로 인정
OBSERVED_BASELINE: engine.ts isForeground가 luma 차분 OR chroma 차분으로 전경 판정.
그림자는 넓은 영역의 luma를 한꺼번에 낮춰 luma 경로로 변화율이 occlusionThreshold(30%)를
넘고 hard burst → 통과 이벤트 오발행. owner: shared/lib/laptime-engine.
TARGET_BEHAVIOR: 전경 판정을 통과한 픽셀 중 "배경의 어두운 버전"(밝기 비율 k가
그림자 대역에 있고 색(대립채널)이 k-스케일로 보존)은 그림자로 분류해
(a) 변화율 카운트 제외 (b) 색 시그니처 축적 제외 (c) 배경 EMA 학습 동결(이탈 오탐 방지).
합성 fixture: 균일 감광 진입·체류·이탈 모두 통과 0, 유채색·검정 차는 기존대로 감지.
ALLOWED_PATHS:
- src/shared/lib/laptime-engine/protocol.ts (옵션 3종 + 기본값)
- src/shared/lib/laptime-engine/engine.ts (그림자 분류 + 3개 소비처 연결)
- src/shared/lib/laptime-engine/engine.test.ts (그림자 fixture 테스트)
- src/features/lap-timing/model/camera.ts (URL 튜닝 오버라이드 3종)
PUBLIC_CONTRACTS_TO_PRESERVE:
- 엔진 계약 "통과 이벤트 스트림"(PassEvent 형태·emit 시점 규칙) 불변
- EngineOptions 기존 필드·기본값 불변(추가만), Partial 병합이라 워커 계약 불변
- 기존 감지 대역: 유채색 차(R9 chroma), 검정/흰색 차(무채색 시그니처), soft 과도(R6),
  자가복구 2종(R2) 회귀 없음 — 기존 테스트 전부 green 유지
NON_GOALS: 근접(15cm) 게이팅(별도 리서치), 진단 스탯 확장(그림자 비율 표시), 텍스처/기하 기반
그림자 판별, 네이티브 플러그인 변경
CHANGE_BUDGET: 4개 파일, 신규 의존성 0
TEST_EVIDENCE: 변경 전 — 균일 감광 fixture가 통과 이벤트를 발행함(그림자 오탐 재현).
변경 후 — 신규 테스트 4건 green + 기존 엔진/스토어 테스트 green + typecheck/lint/build.
CAPABILITY_ESCALATION: none (클라이언트 순수 모듈 내부 변경)
DOCS_TO_UPDATE: none (엔진 이벤트 계약·화면 계약과 충돌 없음 — 내부 판정 강화)
