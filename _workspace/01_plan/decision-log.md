# Decision Log — minicar-laptime

append-only. 기획 레벨 변경(planning-change)을 안정 ID로 기록한다.

## PC-001 — Phase 1 초기 ingestion + 준비도 보강 (2026-08-05)

- **결정**: project-brief v3(사용자 3회 정정 확정 — 혼주 트랙·폰 트랙 위 거치·첫 통과 자동 타깃·1-vs-rest 색상 확인)를 source of truth로 Plan 산출물 정규화. BLOCKER 0, CONFLICT 0.
- **준비도 보강**(plan-review NEEDS_DECISION #1~#3 대응):
  - ux-brief에 `화면별 정보 위계`(홈/측정/결과 3행) + `Design Direction`(6필드, 불확실 4개 ASSUMPTION 프리뷰 A/B) 추가 — `ux-researcher` 재스폰(complete).
  - feature-plan을 FEAT-001~011 표준 표 + `TC-NNN-N` 동작 명세로 승격 — `feature-planner` **2회 API 크래시**로 오케스트레이터가 직접 완결(execution-contract "subagent 실패 시 현재 에이전트가 같은 계약으로 완결" 적용).
- **의도적 유보(ASSUMPTION B1, 최고 리스크 R1 연동)**: HSV bin수·거리 metric·match/borderline threshold·margin은 **지금 확정하지 않는다**. Phase 3 첫 fixture 캘리브레이션("타깃 단독 통과→등록→매칭")에서 확정 후 feature-plan `TC-003-1`에 write-back. 증명 없는 수치 금지 원칙.
- **적용 원칙**: 카메라/센서 경로는 전부 DEPLOY_ONLY, 엔진은 합성 fixture로 로컬 결정론 검증, "값 날조 금지"(의심 배지) 일관.
- **ASSUMPTION 대장**: A1~A3(brief 승계) + B1~B7(정규화 신규) — gap-report.md 참조.

## PC-002 — 디자인 확정 (2026-08-05)
프리뷰 루프 4라운드 반영 후 사용자 "확정". 승인 baseline: preview/index.html (sha256:f86a49087949).
확정 델타는 02_design/confirmed-design.md — 원래 spec 대비 홈 제거·단일랩+누적·탭/슬라이드 시작 컨트롤·정지 이원화·무테두리 override. Phase 3는 이 문서를 authoritative source로 사용.
