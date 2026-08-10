// CV 엔진 계약 (confirmed-design.md "엔진 계약 = 통과 이벤트 스트림").
// 엔진은 프레임을 받아 **통과 이벤트만** emit한다 — 시작/정지/타깃 매칭 판정은 소비층(상태머신)이
// 한다. project-brief §10: 이 경계를 유지해 phase2(N대) 때 소비층만 교체.
// 순수 모듈(DOM/Worker 전역 접근 0) — 합성 fixture로 결정론 테스트.

export interface EngineOptions {
  /** ROI 다운스케일 폭·높이(px). 전역 차분은 이 해상도에서. */
  width: number;
  height: number;
  /** 가림 판정 임계 — 변한 픽셀 비율이 이 이상이면 통과 가림(brief R1: 40%). */
  occlusionThreshold: number;
  /** 진동 상한 — 이 아래 변화율은 트랙 진동으로 보고 무시(brief R1 임계 이원화, 15%). */
  vibrationThreshold: number;
  /** 픽셀 단위 luma 변화 임계(0~255) — 이 이상 달라진 픽셀만 "변함"으로 카운트. */
  pixelDeltaThreshold: number;
  /** 배경 EMA 학습률(비-가림 프레임에서만 적용). */
  bgLearnRate: number;
  /** 통과 이벤트 최소 간격(ms) — 이중 트리거 디바운스(brief minGap). */
  minGapMs: number;
  /**
   * burst 최대 지속(ms) — 초과 시 통과가 아니라 **장면 자체가 바뀐 것**(폰 이동·배경 어긋남)으로
   * 보고 burst를 폐기하고 배경을 현재 프레임으로 재시드한다(자가 복구). 차 통과는 실속에서
   * 수십 ms, 손 테스트도 1초 미만이므로 2초는 안전 여유가 크다.
   */
  maxBurstMs: number;
  /** 색 시그니처 hue 히스토그램 bin 수(1-vs-rest 매칭용). */
  hueBins: number;
}

/**
 * 무채색 시그니처 bin 수 — signature = hue 히스토그램(hueBins) 뒤에 붙는 밝기-대비 4 bin.
 * 검정/흰/은색 차는 채도 필터(s<0.12)로 hue 정보가 비므로, 전경 픽셀의 **배경 대비 luma 차
 * (Δ = luma − 배경EMA)** 를 [Δ<−2T, −2T≤Δ<0, 0<Δ≤+2T, Δ>+2T] (T=pixelDeltaThreshold)로
 * 분류해 재식별 정보를 만든다. 배경 상대값이라 자동노출 드리프트에 강하다(차·트랙이 같이
 * 밝아지면 Δ 유지). 검정 차→음(−) bin, 흰 차→양(+) bin, 은색→혼합으로 상호 구분된다.
 */
export const ACHRO_BINS = 4;

export const DEFAULT_ENGINE_OPTIONS: EngineOptions = {
  width: 64,
  height: 48,
  // R2 실기기(2026-08-10): 실속(30km/h급) 통과가 저속 등록과 달리 전혀 감지되지 않음(N=0).
  // 원인은 모션 블러 — 노출 시간 동안 차가 수 cm 이동해 픽셀마다 차·트랙이 섞이며 luma 대비가
  // 절반 이하로 희석된다. 저속 계약(가림 40%/픽셀 40)을 실속에 맞춰 30%/28로 완화한다.
  // 오탐 방어는 vibrationThreshold(15%)·minGap·1-vs-rest 매칭이 그대로 담당. 현장 재조정은
  // URL 오버라이드(camera.ts: ?occlusion=0.4&delta=40 등)로 배포 없이 가능.
  occlusionThreshold: 0.3,
  vibrationThreshold: 0.15,
  pixelDeltaThreshold: 28,
  bgLearnRate: 0.05,
  minGapMs: 300,
  maxBurstMs: 2000,
  hueBins: 24,
};

/** Worker → UI 진단 스탯 (throttled) — 배치·조명이 감지 임계를 넘는지 현장에서 확인용. */
export interface EngineStats {
  /** 최신 프레임 변화율(0~1) */
  ratio: number;
  /** 직전 스탯 이후 최대 변화율(0~1) — 통과 순간 포착용 */
  peak: number;
  /** 현재 적용 중인 가림 임계(오버라이드 반영) — UI가 도달 여부를 색으로 표시 */
  threshold: number;
  /** configure 이후 처리한 총 프레임 수 — 0에 머물면 카메라→워커 파이프가 죽은 것(R4 진단) */
  frames: number;
}

export interface EngineFrame {
  /** 프레임 타임스탬프 — 실제 앱에선 rVFC/rAF 콜백 시각(now). mediaTime은 iOS getUserMedia에서
   *  전진하지 않아 사용 금지(R5 실기기 확정 — 동결 시 minGap이 모든 후속 통과를 영구 억제). */
  tMs: number;
  /** ROI 그레이스케일 luma, 길이 = width*height. */
  luma: Uint8Array;
  /** ROI RGB(길이 = width*height*3) — 있으면 통과 시 색 시그니처 산출. 없으면 signature=null. */
  rgb?: Uint8Array;
}

export interface PassEvent {
  /** 통과 시각 = burst의 변화율-가중 시간 중심(서브프레임 근사). */
  tMs: number;
  /** burst 최대 변화율(0~1). */
  peakChangeRatio: number;
  /** burst 지속(ms) — 병합 감지(brief R2: 단독 20~40ms vs 병합 60ms+)에 소비층이 사용. */
  durationMs: number;
  /** 정규화 히스토그램(길이 hueBins+ACHRO_BINS, 합=1) 또는 rgb 미제공 시 null.
   *  앞 hueBins개 = 유채색 hue(채도 가중), 뒤 ACHRO_BINS개 = 무채색 밝기-대비 bin. */
  signature: number[] | null;
}

/** 엔진 워커 메시지 계약(configure|frame|reset ↔ ready|pass|error). */
export type EngineRequest =
  | { type: "configure"; options?: Partial<EngineOptions> }
  | { type: "frame"; frame: EngineFrame }
  | { type: "reset" };
export type EngineResponse =
  | { type: "ready" }
  | { type: "pass"; event: PassEvent }
  | { type: "stats"; stats: EngineStats }
  | { type: "error"; message: string };
