# Plan Review — minicar-laptime

대상: `_workspace/01_plan/{project-brief,planning-context,requirements,ux-brief,feature-plan,tech-stack}.md`, `_workspace/00_source/gap-report.md`

## 준비도 판정: NEEDS_DECISION

BLOCKER/CONFLICT 0건. 제품 결정(성공 조건·상태머신·리스크 대응·데이터 전략·LOCAL_DOMAIN_STATE 불변식)은 명확하고 brief traceability도 견고. 다만 Phase 2 design agent가 계약대로 BLOCKER를 낼 형식 갭 3건 → 착수 전 해소 권고(전부 기존 정보를 표준 형식으로 이동, 저비용).

## NEEDS_DECISION (3)

1. **design-readiness 필수 절 누락** — ux-brief에 `화면별 정보 위계` 표 없음, `Design Direction` 6필드 미기입(절 자체가 빔), feature-plan이 `FEAT-NNN` 표준 형식(우선순위 Must/Should·화면 매핑) 아님 → layout-designer/design-system-architect가 BLOCKER 보고 위험. 권고: ux-brief 정보위계 표(홈/측정/결과 3행) + Design Direction을 ASSUMPTION(프리뷰 A/B)로 채움 + feature-plan FEAT-001..N ID·우선순위·화면열 부여.

2. **핵심 매칭 로직 test case/임계값 미정(B1)** — HSV bin 수·거리 metric·match/borderline threshold·margin 미정. R1(false accept)이 최고 리스크인데 결정론 TC 부재. 권고: 수치를 지금 임의 확정 말고, Phase 3 착수 첫 devloop("타깃 단독 통과→등록→매칭")의 fixture 캘리브레이션으로 확정 후 requirements/feature-plan에 write-back — "언제·어디에 기록"을 지금 고정.

3. **Plan history 인프라** — decision-log.md 없음, 안정 ID 체계 미적용. 권고: 항목1의 FEAT-NNN 부여와 함께 decision-log.md 생성 + PC-001(v3 브리프 기반 Phase1 초기 ingestion, BLOCKER 0) baseline 기록.

## 양호 (결정 불요)

- 전 FR/NFR에 LOCAL_VERIFIABLE|DEPLOY_ONLY 라벨 일관, 카메라/센서 전부 DEPLOY_ONLY로 정직 분리.
- R1~R5 방어책이 FR-B3/B5/C3/C4에 1:1 매핑, "값 날조 금지"(FR-C5 주기는 배지 가중만·판정은 색상 정본) 일관.
- LOCAL_DOMAIN_STATE 불변식(재무장 폐기·suspect 토글·세션 삭제 confirm) 데이터 손실 정의 명확.
- MVP/Phase2(N대 계측 Won't) 경계 명확 + 엔진 계약("통과 이벤트 스트림")만 확장 가능하게 설계.

SPAWN_RESULT: complete · SELF_CHECK: NEEDS_DECISION — 형식 갭 3건 해소 후 Phase 2 진입 권고, BLOCKER 0.
