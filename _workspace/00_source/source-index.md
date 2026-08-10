# Source Index — minicar-laptime

## Consumed Sources

| Source | Type | Status | Notes |
|---|---|---|---|
| `_workspace/01_plan/project-brief.md` | Product planning (압축 기획 v3) | read-only source of truth | 사용자 정정 2회 반영, `NEEDS_DECISION` 0으로 확정 |

원문 파일은 수정·이동·삭제하지 않는다(원칙 3). 이 문서를 포함한 `_workspace/00_source`, `_workspace/01_plan`의 다른 파일은 모두 이 원문을 분해·정규화한 산출물이다.

## Section Mapping

| Brief 절 | 원문 라인 | 정규화 대상 |
|---|---|---|
| §0 모드/프로파일 | L9-13 | `tech-stack.md`(WEB_PROFILE), `planning-context.md`(모드 요약) |
| §1 제품 정의 | L15-24 | `planning-context.md`, `requirements.md`(성공조건) |
| §2 측정 설계 | L26-68 | `requirements.md`(기능/비기능), `feature-plan.md`(CV 엔진 단위) |
| §3 MVP 범위 | L70-77 | `feature-plan.md`(IN/OUT), `requirements.md`(Won't) |
| §4 화면 흐름 | L79-85 | `ux-brief.md` |
| §5 도메인 상태 | L87-92 | `requirements.md`(상태 불변식), `feature-plan.md`(데이터 모델) |
| §6 기술 스택 | L94-98 | `tech-stack.md` |
| §7 리스크 대장 | L100-110 | `planning-context.md`(빠진 상태/리스크), `requirements.md`(예외 처리), `ux-brief.md`(UX Check) |
| §8 ASSUMPTION | L112-116 | `gap-report.md`(source-carried ASSUMPTION), `requirements.md` |
| §9 검증 계획 씨앗 | L118-124 | `feature-plan.md`(완료 기준), `tech-stack.md`(테스트 전략) |
| §10 부록 Phase2 | L126-132 | `feature-plan.md`(OUT/Phase2 note) |

## Not Consumed (원문 부재)

- 디자인 원문(토큰, 화면 mockup, 컴포넌트 스펙) — 없음. 이번 ingestion에서 `_workspace/02_design/*`는 생성하지 않는다(`gap-report.md` 참조, Phase2 web-design 단계 소관).
- API/OpenAPI 원문 — 없음. brief §0·§6이 서버 없음(client-only)을 명시하므로 `api-schema.md` 대상 자체가 없다.

## Source Trace

이 문서 자체가 source index이므로 별도 trace 표는 생략한다(위 Section Mapping이 trace 역할을 겸한다).
