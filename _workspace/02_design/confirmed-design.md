# 확정 설계 (Design Approved) — minicar-laptime

> 2026-08-05 · 사용자 "확정". 디자인 프리뷰 루프(4+라운드)로 확정된 **최종 모델·흐름·UI**.
> 이 문서가 Phase 3 구현의 authoritative source다 — 프리뷰 루프에서 원래 spec(project-brief
> v3·component-spec·layout-spec)과 달라진 부분을 여기서 override한다. 살아있는 참조 프로토타입:
> `_workspace/02_design/preview/index.html` (모든 동작 실측 검증됨).

## 원래 spec 대비 확정 변경 (override)

| 항목 | 원래 spec | **확정** |
|---|---|---|
| 홈 화면 | 홈(시작/지난세션) 별도 | **제거 — 랩타임(측정) 화면이 첫 화면** |
| 화면 수 | 3 (홈/측정/결과) | **2 (측정 / 기록)** |
| 측정 모델 | 연속 랩(통과마다 랩) | **단일 랩(출발→복귀 시 정지) + 누적** |
| 다중 차량 | 1-vs-rest 색상 재식별 | 유지(인식 모드) — 단, 시작이 수동/인식 **선택형** |
| 시작 | 자동/버튼 | **하단 단일 컨트롤: 탭=수동 즉시 시작 · 밀기(슬라이드)=인식 시작** |
| 정지 | — | **버튼 [정지] + 차 인식(복귀 통과) 둘 다** |
| 결과 화면 | 홈 버튼·공유·삭제 | **← 뒤로 + [초기화] 단일** (공유 제거) |
| 제목 | "미니카 랩타임" | **"랩타임"** |
| 스타일 | 테두리 있음 | **테두리 전면 제거** — 배경 명도차(app→surface→elevated)+s4 여백으로 위계 |

## 화면 1 — 랩타임 (측정, 첫 화면)

위→아래: **header(`랩타임` + 우측 `기록 N →` 흰색, 랩 있을 때만)** · 카메라 프리뷰(게이트
스트립) · 상태 배너(IDLE 준비/LEARNING/ARMED/RUNNING) · **대형 타이머**(tabular-nums, hero
스케일) · 타깃 색 칩(인식 모드 등록 후, 탭=새 타깃) · statrow(직전/Best/랩) · **하단 시작
컨트롤**.

**하단 시작 컨트롤 (단일 위젯, 두 제스처)**:
- 넓은 "시작" thumb(좌) + "밀어서 인식 시작 →" 힌트(우측 빈 공간 중앙 정렬, thumb와 비겹침).
- **탭** → 수동 시작(startMode=button): 타이머 즉시 시작.
- **슬라이드 끝까지** → 인식 시작(startMode=detect): LEARNING(~1.5s)→ARMED, 첫 통과에 출발.
- 시작 후 컨트롤 → **[정지]** 버튼(error 색). 정지 = 버튼 탭 **또는** 차 복귀 통과.
- thumb 라운드는 트랙과 동심원(트랙 r-lg 20 − 인셋 4 = 16).

**측정 상태머신**(엔진 계약과 연결): `IDLE → (탭)RUNNING(button) | (슬라이드)LEARNING→ARMED →
(첫 통과)RUNNING(detect) → (복귀 통과 또는 정지)LAP 기록 → IDLE(다음 랩 대기)`. 랩 누적.
인식 모드: 타차 통과 무시(otherPass 카운트), 경계 매칭 랩은 의심 배지. 디바운스 minGap.

## 화면 2 — 기록 (결과)

측정 화면과 **동일 디자인 언어**: header(`← 기록`(흰색) + 우측 `N랩`) · statrow 스타일 요약
(Best/평균/편차 σ) · "랩 기록" overline · **랩 리스트(좌우 s4 inset된 둥근 행, best 하이라이트,
의심 배지, tabular-nums)** · "다른 차 통과 N회 무시됨" 캡션 · 하단 **[초기화]**(error 틴트,
confirm). ← = 측정 화면 복귀. 초기화 = 세션 리셋.

## 디자인 토큰 (design-system 확정 소비)

다크 단일 팔레트(OKLCH), 배경 3단(app 0.09 / surface 0.15 / elevated 0.21), primary hue 250,
semantic success(랩 하이라이트)·warning(의심/경고)·error(정지/초기화). hero 타이머 타이포
`clamp(3.5rem,17vw,6.5rem)` tabular-nums. **테두리 미사용** — 필/배경/여백으로 구분. s4(16px)
수평 리듬. `tokens.code.css` 값 그대로 Phase 3 theme로 이관.

## Phase 3 구현 계약 (핵심)

- **엔진 계약 = "통과 이벤트 스트림"**: CV 엔진(순수 TS Worker)은 `{t(rVFC mediaTime), kind,
  signature?}` 통과 이벤트만 emit. 소비층(단일 타깃 필터/상태머신)이 UI와 분리. project-brief
  §10대로 phase2(N대) 대비 이 경계 유지.
- 실제 카메라: getUserMedia(후면) → rVFC → 전역 차분율 가림 burst 검출(임계 이원화) → 인식
  모드는 HSV 히스토그램 1-vs-rest. 타임스탬프 rVFC mediaTime.
- 상태·영속: state-contract.md의 Session/Lap 불변식(랩 연속·의심 토글·재무장 폐기·삭제 confirm)
  IndexedDB(idb). 라이브 상태(phase/타이머)는 ephemeral.
- **프로토타입의 통과 시뮬(게이트 탭·시뮬 버튼)은 구현에서 제거** — CV 엔진 자동 발화로 대체.
- 검증: 엔진 합성 fixture(feature-plan TC + brief §9) 결정론 유닛 + 상태 불변식 + browser QA.

## 승인

design-approval: 사용자 "확정"(2026-08-05). 승인 baseline = preview/index.html(프리뷰 루프
4라운드 반영본). 이후 UI 변경은 이 문서·프로토타입 갱신 후 재확인.

## R-camera-reid (2026-08-10) — 30km/h 인식 조사 반영

- **60fps**: 30km/h 통과 창(~20ms) < 30fps 간격(33ms) → 인식이 확률화. `frameRate:{ideal:60}` 요청 +
  실측 fps를 카메라 게이트 캡션에 표시(50 미만 경고색). 60fps 물리 보장 상한 ≈ 35km/h.
- **배치 계약**: 폰 높이 7cm(확정) — 레인 하나가 화면을 채워 가림율 희석 없음. 초점 불요(전역 차분).
- **무채색 시그니처**: signature = hue(24) + 무채색 밝기-대비 4 bin(Δ=luma−배경EMA, ±2T 경계).
  검정/흰/은색 차 재식별 가능. 색 칩은 무채색 peak 시 그레이스케일 스와치.
- **운영 안내**: 동일 무채색 2대는 구분 불가(원리 한계) → 유채색 스티커 권장, suspect 랩 강등 유지.
- NFC 검토 기각: 30km/h 체류(~8ms) < 트랜잭션(10~30ms), iOS Web NFC 부재, 안테나-카메라 위치 충돌.
