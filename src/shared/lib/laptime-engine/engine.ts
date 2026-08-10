// 통과 감지 엔진 — 초근접 가림(occlusion) 방식(confirmed-design.md 화면1 상태머신 근거).
// 전역 차분율(배경 EMA 대비 변한 픽셀 비율)로 가림 burst를 검출하고, burst의 시간 중심을
// 통과 시각으로 emit한다. 진동은 임계 이원화로 배제(brief R1). 순수·결정론 — 테스트 가능.

import { ACHRO_BINS, DEFAULT_ENGINE_OPTIONS, type EngineFrame, type EngineOptions, type PassEvent } from "./protocol";

interface Burst {
  startMs: number;
  lastMs: number;
  sumT: number; // Σ t·ratio
  sumW: number; // Σ ratio
  peak: number;
  sig: Float64Array; // 누적 hue 히스토그램
  sigWeight: number;
}

export interface LaptimeEngine {
  /** 한 프레임 처리. burst가 끝나 통과가 확정되면 PassEvent 1건을 담아 반환(대개 []). */
  process(frame: EngineFrame): PassEvent[];
  /** 배경 모델·진행 중 burst·디바운스 상태를 폐기(측정 재시작·재무장 시). */
  reset(): void;
  readonly options: EngineOptions;
}

export function createLaptimeEngine(partial: Partial<EngineOptions> = {}): LaptimeEngine {
  const options: EngineOptions = { ...DEFAULT_ENGINE_OPTIONS, ...partial };
  const n = options.width * options.height;
  let bg: Float32Array | null = null;
  let burst: Burst | null = null;
  let lastPassMs = -Infinity;

  function reset(): void {
    bg = null;
    burst = null;
    lastPassMs = -Infinity;
  }

  function changeRatio(luma: Uint8Array, background: Float32Array): number {
    let changed = 0;
    for (let i = 0; i < n; i++) {
      if (Math.abs(luma[i]! - background[i]!) > options.pixelDeltaThreshold) changed++;
    }
    return changed / n;
  }

  function accumulateSignature(frame: EngineFrame, background: Float32Array, into: Burst): void {
    const rgb = frame.rgb;
    if (!rgb) return;
    const luma = frame.luma;
    // 무채색 bin 경계 — 전경 필터가 |Δ|>T를 보장하므로 ±2T가 강/약 대비를 가른다
    const strongDelta = 2 * options.pixelDeltaThreshold;
    for (let i = 0; i < n; i++) {
      const delta = luma[i]! - background[i]!;
      // 전경(변한) 픽셀만 색 시그니처에 반영 — 배경 색 오염 배제
      if (Math.abs(delta) <= options.pixelDeltaThreshold) continue;
      const r = rgb[i * 3]! / 255;
      const g = rgb[i * 3 + 1]! / 255;
      const b = rgb[i * 3 + 2]! / 255;
      const { h, s } = rgbToHueSat(r, g, b);
      if (s < 0.12) {
        // 무채색(검정/흰/은색): hue 대신 배경 대비 밝기 bin — protocol.ACHRO_BINS 주석 참조.
        // 가중치는 대비 크기(|Δ|/255) — 같은 차는 통과마다 비슷한 대비를 내므로 자기 일관적.
        const idx = delta < 0 ? (delta < -strongDelta ? 0 : 1) : (delta > strongDelta ? 3 : 2);
        const w = Math.abs(delta) / 255;
        into.sig[options.hueBins + idx]! += w;
        into.sigWeight += w;
        continue;
      }
      const bin = Math.min(options.hueBins - 1, Math.floor((h / 360) * options.hueBins));
      into.sig[bin]! += s; // 채도 가중
      into.sigWeight += s;
    }
  }

  function finalizeSignature(b: Burst): number[] | null {
    if (b.sigWeight <= 0) return null;
    const len = options.hueBins + ACHRO_BINS;
    const out = new Array<number>(len);
    for (let i = 0; i < len; i++) out[i] = b.sig[i]! / b.sigWeight;
    return out;
  }

  function process(frame: EngineFrame): PassEvent[] {
    const { luma, tMs } = frame;
    if (luma.length !== n) throw new Error(`frame luma length ${luma.length} != ${n}`);
    if (bg === null) {
      bg = Float32Array.from(luma); // 첫 프레임 = 배경 시드
      return [];
    }
    const ratio = changeRatio(luma, bg);
    const events: PassEvent[] = [];

    if (ratio >= options.occlusionThreshold) {
      // 가림 burst 진행 — 배경 갱신 금지(차를 배경으로 학습하지 않음)
      if (burst === null) {
        burst = { startMs: tMs, lastMs: tMs, sumT: 0, sumW: 0, peak: 0, sig: new Float64Array(options.hueBins + ACHRO_BINS), sigWeight: 0 };
      }
      burst.lastMs = tMs;
      burst.sumT += tMs * ratio;
      burst.sumW += ratio;
      burst.peak = Math.max(burst.peak, ratio);
      accumulateSignature(frame, bg, burst);
      return events;
    }

    // 비-가림
    if (burst !== null) {
      const centerMs = burst.sumW > 0 ? burst.sumT / burst.sumW : burst.startMs;
      const durationMs = burst.lastMs - burst.startMs;
      if (centerMs - lastPassMs >= options.minGapMs) {
        lastPassMs = centerMs;
        events.push({ tMs: centerMs, peakChangeRatio: burst.peak, durationMs, signature: finalizeSignature(burst) });
      }
      burst = null;
    }
    // 진동(vibrationThreshold~occlusionThreshold 사이)은 통과도 아니고, 배경 학습 오염도 피한다.
    if (ratio < options.vibrationThreshold) {
      const a = options.bgLearnRate;
      for (let i = 0; i < n; i++) bg[i] = bg[i]! + a * (luma[i]! - bg[i]!);
    }
    return events;
  }

  return {
    process,
    reset,
    get options() {
      return options;
    },
  };
}

/** 두 hue 시그니처 거리(1-vs-rest 매칭용, 소비층에서 사용) — L1 거리(0~2, 작을수록 유사). */
export function signatureDistance(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length);
  let d = 0;
  for (let i = 0; i < len; i++) d += Math.abs(a[i]! - b[i]!);
  return d;
}

function rgbToHueSat(r: number, g: number, b: number): { h: number; s: number } {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  let h = 0;
  if (delta > 1e-6) {
    if (max === r) h = ((g - b) / delta) % 6;
    else if (max === g) h = (b - r) / delta + 2;
    else h = (r - g) / delta + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const s = max <= 1e-6 ? 0 : delta / max;
  return { h, s };
}
