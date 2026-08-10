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
  /** R6: soft 프레임 수(연속) — soft 전용 burst의 과도 판정에 사용 */
  softFrames: number;
  /** R6: occlusion 임계를 넘은 프레임이 하나라도 있었는가 — soft 전용 burst와 판정 규칙 분리 */
  hardSeen: boolean;
}

/** R6: soft 전용 burst가 이 프레임 수를 넘으면 통과(과도)가 아니라 지속 교란 — 기각 */
const SOFT_MAX_FRAMES = 5;
/** R6: soft 전용 burst 승인 최소 연속 프레임 수 — 단발 soft는 잡음일 수 있어 미승인 */
const SOFT_MIN_FRAMES = 2;

/* R8 시그니처 확장: hue 히스토그램을 **밝기 2평면**(어두운 톤/밝은 톤)으로 나눈다 —
 * 남색 vs 하늘색처럼 hue가 같고 밝기만 다른 차를 구분(레이아웃: [어두운 hue×N][밝은 hue×N][무채색 4]).
 * 밝기 기준은 luma가 아니라 **value(max RGB)** — 파랑 계열은 luma가 태생적으로 낮아
 * luma로는 밝은 파랑도 어두운 평면에 떨어진다. 경계 픽셀은 소프트 배분(ramp)으로 두 평면에
 * 나눠 담아, 노출 변화로 value가 경계를 넘나들 때 분포가 통째로 널뛰는 것을 막는다. */
const VALUE_RAMP_LO = 0.38; // 이 이하 = 전량 어두운 평면
const VALUE_RAMP_HI = 0.63; // 이 이상 = 전량 밝은 평면 (사이는 선형 배분)

export interface LaptimeEngine {
  /** 한 프레임 처리. burst가 끝나 통과가 확정되면 PassEvent 1건을 담아 반환(대개 []). */
  process(frame: EngineFrame): PassEvent[];
  /** 배경 모델·진행 중 burst·디바운스 상태를 폐기(측정 재시작·재무장 시). */
  reset(): void;
  /** 최신 프레임 변화율(0~1) — 진단 미터용(배경 시드 프레임은 0). */
  readonly lastChangeRatio: number;
  readonly options: EngineOptions;
}

export function createLaptimeEngine(partial: Partial<EngineOptions> = {}): LaptimeEngine {
  const options: EngineOptions = { ...DEFAULT_ENGINE_OPTIONS, ...partial };
  const n = options.width * options.height;
  let bg: Float32Array | null = null;
  let burst: Burst | null = null;
  let lastPassMs = -Infinity;
  let lastRatio = 0;
  /** R2: 변화율이 vibration 이상(=배경 학습 차단 상태)로 연속된 시작 시각 — 자가 복구 판정용 */
  let elevatedSinceMs: number | null = null;
  /** R6: soft burst 기각(지속 교란) 후 재개 억제 — vibration 미만으로 조용해져야 해제 */
  let softSuppressed = false;

  function reset(): void {
    bg = null;
    burst = null;
    lastPassMs = -Infinity;
    lastRatio = 0;
    elevatedSinceMs = null;
    softSuppressed = false;
  }

  function openBurst(tMs: number, hardSeen: boolean): Burst {
    return {
      startMs: tMs,
      lastMs: tMs,
      sumT: 0,
      sumW: 0,
      peak: 0,
      sig: new Float64Array(options.hueBins * 2 + ACHRO_BINS),
      sigWeight: 0,
      softFrames: hardSeen ? 0 : 1,
      hardSeen,
    };
  }

  function extendBurst(b: Burst, frame: EngineFrame, background: Float32Array, tMs: number, ratio: number): void {
    b.lastMs = tMs;
    b.sumT += tMs * ratio;
    b.sumW += ratio;
    b.peak = Math.max(b.peak, ratio);
    accumulateSignature(frame, background, b);
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
      const { h, s, v } = rgbToHueSat(r, g, b);
      if (s < 0.12) {
        // 무채색(검정/흰/은색): hue 대신 배경 대비 밝기 bin — protocol.ACHRO_BINS 주석 참조.
        // 가중치는 대비 크기(|Δ|/255) — 같은 차는 통과마다 비슷한 대비를 내므로 자기 일관적.
        const idx = delta < 0 ? (delta < -strongDelta ? 0 : 1) : (delta > strongDelta ? 3 : 2);
        const w = Math.abs(delta) / 255;
        into.sig[options.hueBins * 2 + idx]! += w;
        into.sigWeight += w;
        continue;
      }
      const bin = Math.min(options.hueBins - 1, Math.floor((h / 360) * options.hueBins));
      // R8: value ramp로 어두운/밝은 평면에 소프트 배분 (경계 널뛰기 방지 — 파일 상단 주석)
      const bright = Math.min(1, Math.max(0, (v - VALUE_RAMP_LO) / (VALUE_RAMP_HI - VALUE_RAMP_LO)));
      into.sig[bin]! += s * (1 - bright); // 어두운 톤 평면
      into.sig[options.hueBins + bin]! += s * bright; // 밝은 톤 평면
      into.sigWeight += s;
    }
  }

  function finalizeSignature(b: Burst): number[] | null {
    if (b.sigWeight <= 0) return null;
    const planeBins = options.hueBins;
    const len = planeBins * 2 + ACHRO_BINS;
    const out = new Array<number>(len);
    // R8 원형 hue 스무딩 [0.25, 0.5, 0.25] — 자동 화이트밸런스가 색조를 살짝 밀면 경계 픽셀이
    // 옆 bin으로 이동해 같은 차의 L1 거리가 튄다(인접 bin 완전 분리 시 2.0). 평면별로 번지면
    // 인접 bin 이동의 거리 비용이 절반으로 줄어 드리프트에 둔감해진다. 커널 합=1이라 질량 보존.
    for (let plane = 0; plane < 2; plane++) {
      const base = plane * planeBins;
      for (let i = 0; i < planeBins; i++) {
        const prev = b.sig[base + ((i + planeBins - 1) % planeBins)]!;
        const cur = b.sig[base + i]!;
        const next = b.sig[base + ((i + 1) % planeBins)]!;
        out[base + i] = (0.25 * prev + 0.5 * cur + 0.25 * next) / b.sigWeight;
      }
    }
    // 무채색 bin은 순서형(최암→최명)이라 원형 아님 — 스무딩 없이 그대로
    for (let k = 0; k < ACHRO_BINS; k++) {
      out[planeBins * 2 + k] = b.sig[planeBins * 2 + k]! / b.sigWeight;
    }
    return out;
  }

  function process(frame: EngineFrame): PassEvent[] {
    const { luma, tMs } = frame;
    if (luma.length !== n) throw new Error(`frame luma length ${luma.length} != ${n}`);
    if (bg === null) {
      bg = Float32Array.from(luma); // 첫 프레임 = 배경 시드
      lastRatio = 0;
      return [];
    }
    const ratio = changeRatio(luma, bg);
    lastRatio = ratio;
    const events: PassEvent[] = [];

    if (ratio >= options.occlusionThreshold) {
      // 가림 burst 진행 — 배경 갱신 금지(차를 배경으로 학습하지 않음).
      // soft 선행 프레임이 쌓여 있으면 그 burst에 합류(hardSeen 승격) — 선행 에지의 시각
      // 기여가 통과 중심에 포함된다.
      if (burst === null) burst = openBurst(tMs, true);
      else burst.hardSeen = true;
      extendBurst(burst, frame, bg, tMs, ratio);
      // R2 자가 복구(실기기: 정지 후 차·손이 레인 위에 머물면 burst가 영구 미종결 → 이후 감지
      // 전멸): 통과라기엔 너무 긴 가림은 장면 전환(폰 이동·주차된 차)이다 — burst 폐기 +
      // 배경을 현재 프레임으로 재시드해 잠금을 푼다. 통과 이벤트는 내지 않는다(차 통과 아님).
      if (tMs - burst.startMs > options.maxBurstMs) {
        burst = null;
        bg = Float32Array.from(luma);
        lastRatio = 0;
        elevatedSinceMs = null;
      }
      return events;
    }

    // R6 soft 구간(soft ≤ ratio < occlusion) — 짧은 과도만 통과 후보로 축적
    const soft = ratio >= options.softOcclusionThreshold;
    if (soft && burst !== null && !burst.hardSeen && burst.softFrames < SOFT_MAX_FRAMES) {
      burst.softFrames += 1;
      extendBurst(burst, frame, bg, tMs, ratio);
      return events;
    }
    if (soft && burst === null) {
      if (!softSuppressed) {
        burst = openBurst(tMs, false);
        extendBurst(burst, frame, bg, tMs, ratio);
      }
      // 억제 중이면 아래 elevated 자가복구 로직으로 흘려보낸다 (지속 교란 → 2s 후 배경 재시드)
      if (burst !== null) return events;
    }

    // burst 종결 판정 — hard는 기존 규칙(minGap), soft 전용은 "짧은 과도 형상"일 때만 통과
    if (burst !== null) {
      const softOnly = !burst.hardSeen;
      if (softOnly && soft) {
        // soft가 이어지는데 연장 한도(SOFT_MAX_FRAMES) 초과로 여기 도달 = 지속 교란 — 기각·억제
        burst = null;
        softSuppressed = true;
      } else {
        const accepted = !softOnly || burst.softFrames >= SOFT_MIN_FRAMES;
        const centerMs = burst.sumW > 0 ? burst.sumT / burst.sumW : burst.startMs;
        const durationMs = burst.lastMs - burst.startMs;
        if (accepted && centerMs - lastPassMs >= options.minGapMs) {
          lastPassMs = centerMs;
          events.push({ tMs: centerMs, peakChangeRatio: burst.peak, durationMs, signature: finalizeSignature(burst) });
        }
        burst = null;
        // hard burst가 soft 꼬리로 닫힌 경우 — 같은 차의 잔상이 새 soft burst를 열지 않게 억제
        if (soft) softSuppressed = true;
      }
    }
    // 진동(vibrationThreshold~occlusionThreshold 사이)은 통과도 아니고, 배경 학습 오염도 피한다.
    if (ratio < options.vibrationThreshold) {
      const a = options.bgLearnRate;
      for (let i = 0; i < n; i++) bg[i] = bg[i]! + a * (luma[i]! - bg[i]!);
      elevatedSinceMs = null;
      softSuppressed = false; // R6: 조용해지면 soft 감지 재개
    } else {
      // R2 자가 복구 2(실기기: 통과 직후 자동노출 출렁임 등으로 변화율이 vibration~occlusion
      // 사이에 갇히면 배경 학습이 영구 차단 → 이후 감지 전멸): 이 중간 구간이 maxBurstMs 이상
      // 이어지면 순간 사건이 아니라 장면·노출이 바뀐 것이다 — 배경을 현재 프레임으로 재시드.
      if (elevatedSinceMs === null) elevatedSinceMs = tMs;
      else if (tMs - elevatedSinceMs > options.maxBurstMs) {
        bg = Float32Array.from(luma);
        lastRatio = 0;
        elevatedSinceMs = null;
      }
    }
    return events;
  }

  return {
    process,
    reset,
    get lastChangeRatio() {
      return lastRatio;
    },
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

function rgbToHueSat(r: number, g: number, b: number): { h: number; s: number; v: number } {
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
  return { h, s, v: max };
}
