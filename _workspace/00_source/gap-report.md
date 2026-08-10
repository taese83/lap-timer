# Gap Report — minicar-laptime

Source: `_workspace/01_plan/project-brief.md`(v3, 확정, `NEEDS_DECISION` 0).

## BLOCKER

없음(0건). brief §8이 "NEEDS_DECISION 없음"으로 명시했고, 이번 ingestion에서도 구현을 막는 필수 정보 누락을 발견하지 못했다.

## CONFLICT

없음(0건). 이번 ingestion이 참조한 원문은 `project-brief.md` 단일 문서뿐이라 상충 소스가 없다.

## ASSUMPTION — brief에서 승계(원문에 이미 명시)

| # | 내용 | 원문 |
|---|---|---|
| A1 | 첫 통과 차 = 사용자의 차(스펙 정의). 아니면 재무장 1탭으로 정정 | project-brief.md §8, L114 |
| A2 | minGap(통과 이벤트) 0.3s / 타깃 랩 최소 주기 2s / 세션 30분 상한 | project-brief.md §8, L115 |
| A3 | 트랙은 단일 레인 순차 통과 기하(타미야 표준) | project-brief.md §8, L116 |

## ASSUMPTION — 이번 분해 과정에서 신규 도입(개발 진행에 필요한 경미한 기본값)

| # | 내용 | 근거/영향 | 검증 방법 |
|---|---|---|---|
| B1 | HSV 히스토그램 bin 수·거리 metric(예: Bhattacharyya/chi-square)·match/borderline 정확 임계값·margin 수치는 brief에 "임계 이하/초과", "±margin"으로만 언급되고 구체 수치가 없음 → 하드코딩된 고정 수치로 명세하지 않고, brief §9 합성 fixture 캘리브레이션으로 구현 시 결정 | 저위험(알고리즘 파라미터, fixture로 조정 가능) | Vitest 합성 fixture(단독/교차/유사색/병합 등)로 결정론 검증 후 값 확정 |
| B2 | 3화면(홈/측정/결과) 간 전환을 URL 라우팅(react-router) 없이 in-app view state로 처리 — brief가 라우팅 방식을 명시하지 않음, 제로 셋업·단일 세션 앱 특성상 URL 공유 필요성 낮음 | 저위험, 가역적(필요 시 router 추가 가능) | UX 관점에서 "뒤로가기/새로고침 시 세션 복구 필요성"이 나오면 재검토 |
| B3 | UI 스타일링에 별도 컴포넌트 라이브러리(MUI 등)를 사용하지 않고 plain CSS/CSS module 채택 — 디자인 원문이 없어 이번 ingestion은 시각 디자인 결정을 새로 만들지 않음 | 02_design 산출물 자체를 생성하지 않는 근거이기도 함 | Phase2 web-design 단계에서 구체화 |
| B4 | 패키지 정확 semver는 brief가 라이브러리명만 지정(react-vite-spa, Zustand, idb, Vitest)하므로 하네스 canonical pin(`.claude/skills/project-init/assets/templates.md`)을 채택 — `idb`는 canonical pin 자체가 없어 구현 시 `latest` 조회 후 lockfile 고정 필요 | 저위험, 구현 시점에 확정 | `pnpm add idb@latest` 후 lockfile freeze |
| B5 | 배포(Vercel 정적)는 필수가 아닌 선택 사항으로 해석 — 상위 오케스트레이터 지시("deployment=Vercel 정적(선택)")를 brief §6(L98)보다 우선 적용 | 저위험 | 배포 시점에 확정, 로컬 개발은 HTTPS dev server로 진행 가능 |
| B6 | 재무장(re-arm) 탭은 즉시 실행(취소/undo 없음)으로 가정 — 제로 셋업 원칙상 확인 다이얼로그를 추가하지 않음 | 중위험(사용자가 실수로 재무장 시 직전 미확정 데이터 폐기) | Phase2 prototype에서 확인(ux-brief.md UX Check 참조) |
| B7 | 접근성(a11y) 요구 수준이 brief에 명시되지 않아 하네스 기본 baseline(axe-core critical 위반 0)을 적용 | 저위험, 표준 baseline | axe-core 자동 검사(NFR-8) |

## INFO (개발은 계속 진행 가능, 참고용 미결 항목)

| # | 내용 | 비고 |
|---|---|---|
| I1 | `_workspace/02_design/*`(design-system, layout-spec, component-spec, api-schema)는 이번 ingestion에서 생성하지 않음 | 원문에 디자인 산출물이 없고, 이번 spawn 지시가 요청한 정규화 산출물 목록에도 포함되지 않음. api-schema는 서버 자체가 없어 대상이 아님. 시각 디자인은 Phase2 web-design 단계에서 신규로 다뤄야 함(제품 결정이 아니라 시각 결정이므로 이 원칙 위반 아님) |
| I2 | 이전 버전(v1/v2) 기획 원문이 저장소에 없음 — brief는 "사용자 정정 2회 반영"이라고만 서술하고 이전 버전 diff는 없음 | planning-context.md의 "현재 pain" 절에서 추정 서술로 표시, 사실로 단정하지 않음 |
| I3 | 카메라 권한 거부/미지원 브라우저 시 안내 문구(카피)가 brief에 없음 | 기능 자체(에러 배너 표시)는 요구되나 정확 문구는 Phase2에서 확정 |
| I4 | 결과 화면 "텍스트 공유"의 정확한 포맷(템플릿)이 brief에 없음 | 기능은 확정(FR-E5), 포맷 세부는 구현 시 결정 |
| I5 | 저사양 기기 강등(30fps, ±33ms) 시 사용자 노출 문구가 brief에 없음 | 기능(정직 표시)은 확정(R7), 문구는 Phase2 |
| I6 | `idb` 라이브러리의 IndexedDB 단위 테스트 도구(예: fake-indexeddb)는 brief에 지정 없음 | 구현 시 선택, tech-stack.md에 ASSUMPTION으로 표시 |

## Source Trace

| 절 | Source |
|---|---|
| BLOCKER/CONFLICT 판정 근거 | project-brief.md §8(L112-116, "NEEDS_DECISION 없음") |
| ASSUMPTION 승계(A1-A3) | project-brief.md §8(L112-116) |
| ASSUMPTION 신규(B1-B7) | 이번 분해 과정에서 도출, 원문 직접 인용 없음(경미한 기본값) |
| INFO(I1-I6) | 원문 부재 확인(negative evidence) |
