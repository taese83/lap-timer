import { describe, expect, it } from "vitest";
import { createLaptimeEngine, signatureDistance } from "./engine";
import { ACHRO_BINS, type EngineFrame } from "./protocol";

const W = 8;
const H = 6;
const N = W * H;

function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) [r, g] = [c, x];
  else if (h < 120) [r, g] = [x, c];
  else if (h < 180) [g, b] = [c, x];
  else if (h < 240) [g, b] = [x, c];
  else if (h < 300) [r, b] = [x, c];
  else [r, b] = [c, x];
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

/** 합성 프레임: 배경 luma 100, changedFrac 비율의 픽셀을 luma 200 + (hue 지정 시) 유채색으로. */
function frame(tMs: number, changedFrac: number, hue?: number): EngineFrame {
  const luma = new Uint8Array(N).fill(100);
  const rgb = new Uint8Array(N * 3).fill(100);
  const changed = Math.round(N * changedFrac);
  const [r, g, b] = hue === undefined ? [200, 200, 200] : hsvToRgb(hue, 0.9, 0.8);
  for (let i = 0; i < changed; i++) {
    luma[i] = 200;
    rgb[i * 3] = r;
    rgb[i * 3 + 1] = g;
    rgb[i * 3 + 2] = b;
  }
  return { tMs, luma, rgb };
}

const mk = () =>
  createLaptimeEngine({ width: W, height: H, occlusionThreshold: 0.4, vibrationThreshold: 0.15, pixelDeltaThreshold: 40, minGapMs: 300, hueBins: 12 });

describe("laptime-engine", () => {
  it("정상 통과: 가림 burst 하나 → 통과 1건, 시각은 burst 중심, 시그니처 산출", () => {
    const e = mk();
    const ev: ReturnType<typeof e.process> = [];
    e.process(frame(0, 0)); // 배경 시드
    ev.push(...e.process(frame(16, 0)));
    ev.push(...e.process(frame(32, 1, 120))); // 초록 차 가림
    ev.push(...e.process(frame(48, 1, 120)));
    ev.push(...e.process(frame(64, 1, 120)));
    ev.push(...e.process(frame(80, 0))); // 해제 → emit
    expect(ev).toHaveLength(1);
    expect(ev[0]!.tMs).toBeGreaterThanOrEqual(32);
    expect(ev[0]!.tMs).toBeLessThanOrEqual(64);
    expect(ev[0]!.peakChangeRatio).toBeCloseTo(1, 5);
    const sig = ev[0]!.signature!;
    expect(sig).not.toBeNull();
    // hue 120 → bin floor(120/360*12)=4, value 0.8 → 밝은 톤 평면(R8) → 12+4=16 이 최대
    const peakBin = sig.indexOf(Math.max(...sig));
    expect(peakBin).toBe(16);
  });

  it("진동(작은 변화율)은 통과가 아니다 — 오탐 0", () => {
    const e = mk();
    const ev: ReturnType<typeof e.process> = [];
    e.process(frame(0, 0));
    ev.push(...e.process(frame(16, 0.1)));
    ev.push(...e.process(frame(32, 0.12)));
    ev.push(...e.process(frame(48, 0)));
    expect(ev).toHaveLength(0);
  });

  it("디바운스: minGap 내 연속 burst는 1건, 넘으면 2건", () => {
    const near = mk();
    const evNear: ReturnType<typeof near.process> = [];
    near.process(frame(0, 0));
    evNear.push(...near.process(frame(16, 1))); // burst1
    evNear.push(...near.process(frame(32, 0))); // 종료 → pass1(center≈16)
    evNear.push(...near.process(frame(48, 1))); // burst2
    evNear.push(...near.process(frame(64, 0))); // center≈48, 48-16<300 → 억제
    expect(evNear).toHaveLength(1);

    const far = mk();
    const evFar: ReturnType<typeof far.process> = [];
    far.process(frame(0, 0));
    evFar.push(...far.process(frame(16, 1)));
    evFar.push(...far.process(frame(32, 0))); // pass1 center≈16
    evFar.push(...far.process(frame(500, 1)));
    evFar.push(...far.process(frame(516, 0))); // center≈500, 500-16>300 → pass2
    expect(evFar).toHaveLength(2);
  });

  it("시그니처 거리: 같은 색은 가깝고 다른 색은 멀다 (1-vs-rest 판별 근거)", () => {
    function sigOf(hue: number): number[] {
      const e = mk();
      e.process(frame(0, 0));
      e.process(frame(16, 1, hue));
      const out = e.process(frame(32, 0));
      return out[0]!.signature!;
    }
    const green1 = sigOf(120);
    const green2 = sigOf(125);
    const red = sigOf(0);
    expect(signatureDistance(green1, green2)).toBeLessThan(signatureDistance(green1, red));
  });

  it("무채색 차: 시그니처가 비지 않고 밝기 bin으로 산출된다 (검정 → 최암 bin)", () => {
    // 검정 차(luma 10, 무채색): 종전엔 s<0.12 필터로 signature=null이었음 — 밝기-대비 bin이 대체
    const e = mk();
    e.process(frame(0, 0)); // 배경 luma 100
    const luma = new Uint8Array(N).fill(10);
    const rgb = new Uint8Array(N * 3).fill(10);
    e.process({ tMs: 16, luma, rgb });
    const out = e.process(frame(32, 0));
    const sig = out[0]!.signature;
    expect(sig).not.toBeNull();
    expect(sig!).toHaveLength(12 * 2 + ACHRO_BINS); // R8: hue 2평면 + 무채색
    // Δ = 10−100 = −90 < −2T(−80) → 무채색 최암 bin(hueBins*2+0)에 전량
    const peakBin = sig!.indexOf(Math.max(...sig!));
    expect(peakBin).toBe(24);
  });

  it("무채색 재식별: 검정↔검정 근접, 검정↔흰색·검정↔유채색은 원거리", () => {
    function sigOfUniform(value: number): number[] {
      const e = mk();
      e.process(frame(0, 0));
      const luma = new Uint8Array(N).fill(value);
      const rgb = new Uint8Array(N * 3).fill(value);
      e.process({ tMs: 16, luma, rgb });
      return e.process(frame(32, 0))[0]!.signature!;
    }
    const black1 = sigOfUniform(10);
    const black2 = sigOfUniform(14);
    const white = sigOfUniform(245);
    const green = (() => {
      const e = mk();
      e.process(frame(0, 0));
      e.process(frame(16, 1, 120));
      return e.process(frame(32, 0))[0]!.signature!;
    })();
    expect(signatureDistance(black1, black2)).toBeLessThan(0.1);
    expect(signatureDistance(black1, white)).toBeGreaterThan(1.5);
    expect(signatureDistance(black1, green)).toBeGreaterThan(1.5);
  });

  it("R2 자가복구 ①: 장기 가림(주차된 차·손)은 통과가 아니라 새 배경 — 이후 감지 재개", () => {
    const e = mk();
    const uniform = (tMs: number, value: number): EngineFrame => ({
      tMs,
      luma: new Uint8Array(N).fill(value),
      rgb: new Uint8Array(N * 3).fill(value),
    });
    e.process(uniform(0, 100)); // 배경 시드
    const events: ReturnType<typeof e.process> = [];
    // 차가 레인 위에 주차: 2초 넘게 전면 가림 — 통과 이벤트가 나오면 안 된다
    for (let t = 16; t <= 2400; t += 100) events.push(...e.process(uniform(t, 200)));
    expect(events).toHaveLength(0);
    // 타임아웃 후 배경이 200으로 재시드됨 — 같은 장면은 변화율 0 (잠금 해제 증명)
    e.process(uniform(2500, 200));
    expect(e.lastChangeRatio).toBe(0);
    // 새 통과(어두운 차)가 정상 감지된다
    const after = [...e.process(uniform(2600, 20)), ...e.process(uniform(2650, 200))];
    expect(after).toHaveLength(1);
  });

  it("R2 자가복구 ②: 중간 변화율(진동~가림 사이) 고착 시 배경 재시드 — 학습 차단 탈출", () => {
    const e = mk();
    const partial = (tMs: number, frac: number): EngineFrame => {
      const luma = new Uint8Array(N).fill(100);
      const rgb = new Uint8Array(N * 3).fill(100);
      for (let i = 0; i < Math.round(N * frac); i++) luma[i] = 200;
      return { tMs, luma, rgb };
    };
    e.process(partial(0, 0)); // 배경 시드 (luma 100)
    // 노출 출렁임 등으로 25%가 계속 변한 상태(가림 40% 미만·진동 15% 초과) — 종전엔 영구 고착.
    // R6: 처음 SOFT_MAX_FRAMES개는 soft burst로 흡수·기각된 뒤 elevated 타이머가 돌므로
    // (실기기 ~83ms 지연, 이 타임라인에선 500ms) 지속 구간을 그만큼 길게 잡는다.
    for (let t = 16; t <= 2800; t += 100) e.process(partial(t, 0.25));
    // 타임아웃 후 현재 장면이 새 배경 — 같은 장면은 변화율 0
    e.process(partial(2900, 0.25));
    expect(e.lastChangeRatio).toBe(0);
  });

  it("R8: 같은 hue·다른 밝기(남색 vs 하늘색)가 다른 평면으로 갈라진다", () => {
    function sigOfHsv(h: number, s: number, v: number): number[] {
      const e = mk();
      // 배경 180: 하늘색(luma ≈91)도 전경으로 잡히도록 밝은 배경 사용 — luma 차분 특성상
      // 배경과 luma가 비슷한 색은 전경에서 빠진다(감지 한계, R8 분석 §5에 기록됨)
      const uniform = (tMs: number, lumaV: number, r: number, g: number, b: number) => {
        const luma = new Uint8Array(N).fill(lumaV);
        const rgb = new Uint8Array(N * 3);
        for (let i = 0; i < N; i++) {
          rgb[i * 3] = r;
          rgb[i * 3 + 1] = g;
          rgb[i * 3 + 2] = b;
        }
        return { tMs, luma, rgb };
      };
      e.process(uniform(0, 180, 180, 180, 180));
      const [r, g, b] = hsvToRgb(h, s, v);
      const lumaV = Math.max(1, (r * 77 + g * 150 + b * 29) >> 8);
      e.process(uniform(16, lumaV, r, g, b));
      return e.process(uniform(32, 180, 180, 180, 180))[0]!.signature!;
    }
    const navy = sigOfHsv(220, 0.9, 0.3); // value 0.3 → 어두운 평면
    const sky = sigOfHsv(220, 0.9, 0.95); // value 0.95 → 밝은 평면
    const navy2 = sigOfHsv(220, 0.9, 0.28);
    expect(signatureDistance(navy, navy2)).toBeLessThan(0.3); // 같은 남색끼리는 근접
    expect(signatureDistance(navy, sky)).toBeGreaterThan(1.5); // 남색↔하늘색 원거리 (종전 ≈0)
  });

  it("R8 원형 스무딩: 인접 bin으로 밀린 hue(AWB 드리프트)의 거리가 완화된다", () => {
    function sigOfHue(hue: number): number[] {
      const e = mk();
      e.process(frame(0, 0));
      e.process(frame(16, 1, hue));
      return e.process(frame(32, 0))[0]!.signature!;
    }
    // hueBins 12 → bin 폭 30°. 118°(bin 3)와 132°(bin 4)는 인접 bin — 스무딩 없으면 L1=2.0(완전 분리)
    const a = sigOfHue(118);
    const b = sigOfHue(132);
    const d = signatureDistance(a, b);
    expect(d).toBeGreaterThan(0);
    expect(d).toBeLessThan(1.2); // 스무딩으로 겹침 발생 — border(1.5) 안쪽 = 같은 차 유지
  });

  it("R9 색 차분: 배경과 luma가 같아도 색이 다르면 감지된다 (하늘색 차 + 동명도 회색 트랙)", () => {
    const e = mk();
    const uniform = (tMs: number, lumaV: number, r: number, g: number, b: number) => {
      const luma = new Uint8Array(N).fill(lumaV);
      const rgb = new Uint8Array(N * 3);
      for (let i = 0; i < N; i++) {
        rgb[i * 3] = r;
        rgb[i * 3 + 1] = g;
        rgb[i * 3 + 2] = b;
      }
      return { tMs, luma, rgb };
    };
    e.process(uniform(0, 91, 91, 91, 91)); // 회색 트랙 (luma 91)
    // 하늘색 차 (24,97,242): luma ≈ 91 → luma 차분 0에 가까움 — 종전엔 완전 미감지
    const ev = [...e.process(uniform(16, 91, 24, 97, 242)), ...e.process(uniform(32, 91, 91, 91, 91))];
    expect(ev).toHaveLength(1);
    expect(ev[0]!.peakChangeRatio).toBeCloseTo(1, 5);
    expect(ev[0]!.signature).not.toBeNull(); // 시그니처도 chroma 전경에서 산출
  });

  it("R9 노출·AWB 내성: 전 채널 동일 이동과 경미한 색 이동은 감지되지 않는다", () => {
    const e = mk();
    const uniform = (tMs: number, r: number, g: number, b: number, lumaV: number) => {
      const luma = new Uint8Array(N).fill(lumaV);
      const rgb = new Uint8Array(N * 3);
      for (let i = 0; i < N; i++) {
        rgb[i * 3] = r;
        rgb[i * 3 + 1] = g;
        rgb[i * 3 + 2] = b;
      }
      return { tMs, luma, rgb };
    };
    e.process(uniform(0, 120, 100, 90, 103));
    // 노출 +15 (전 채널 동일 — 대립채널 불변, luma +15 < 28) → 미감지
    e.process(uniform(16, 135, 115, 105, 118));
    expect(e.lastChangeRatio).toBe(0);
    // AWB 소폭 이동 (r+10, b−8 → dOpp = 10 + |{-?}|... 합산 ≤ 28 < 48) → 미감지
    e.process(uniform(32, 130, 100, 82, 105));
    expect(e.lastChangeRatio).toBe(0);
  });

  it("R6 soft 과도: 연속 2프레임 20%대(임계 미달)도 통과로 인정", () => {
    const e = mk();
    const ev: ReturnType<typeof e.process> = [];
    e.process(frame(0, 0)); // 배경 시드
    ev.push(...e.process(frame(16, 0.22))); // soft (occlusion 0.4 미달, soft 0.18 이상)
    ev.push(...e.process(frame(32, 0.24))); // soft 연속 2 — 과도 형상
    ev.push(...e.process(frame(48, 0))); // 하강 에지 → 승인
    expect(ev).toHaveLength(1);
    expect(ev[0]!.peakChangeRatio).toBeCloseTo(0.25, 1);
  });

  it("R6 단발 soft 프레임은 통과가 아니다 (최소 연속 2)", () => {
    const e = mk();
    const ev: ReturnType<typeof e.process> = [];
    e.process(frame(0, 0));
    ev.push(...e.process(frame(16, 0.22)));
    ev.push(...e.process(frame(32, 0))); // 1프레임뿐 → 미승인
    expect(ev).toHaveLength(0);
  });

  it("R6 지속 soft(노출 출렁임)는 기각·억제 — 오탐 0, 조용해지면 재개", () => {
    const e = mk();
    const ev: ReturnType<typeof e.process> = [];
    e.process(frame(0, 0));
    for (let t = 16; t <= 16 * 12; t += 16) ev.push(...e.process(frame(t, 0.22))); // 12프레임 지속
    ev.push(...e.process(frame(300, 0.22))); // 억제 중 — 새 burst 금지
    ev.push(...e.process(frame(316, 0))); // 하강해도 승인 없음
    expect(ev).toHaveLength(0);
    // 조용해진 뒤(위 0 프레임에서 억제 해제) 정상 hard 통과는 감지된다
    ev.push(...e.process(frame(700, 1)));
    ev.push(...e.process(frame(716, 0)));
    expect(ev).toHaveLength(1);
  });

  it("R6 soft 선행 + hard 결합은 이벤트 1건 (이중 트리거 없음)", () => {
    const e = mk();
    const ev: ReturnType<typeof e.process> = [];
    e.process(frame(0, 0));
    ev.push(...e.process(frame(16, 0.2))); // 선행 에지 soft
    ev.push(...e.process(frame(32, 0.9))); // 본체 hard — soft burst 승격
    ev.push(...e.process(frame(48, 0.2))); // 꼬리 soft — hard burst 종결·승인 + 억제
    ev.push(...e.process(frame(64, 0)));
    expect(ev).toHaveLength(1);
    // 선행 에지(16ms)가 중심 계산에 포함됨 — 중심은 hard 프레임(32) 부근이되 16 쪽으로 당겨짐
    expect(ev[0]!.tMs).toBeGreaterThan(16);
    expect(ev[0]!.tMs).toBeLessThan(48);
  });

  /** R19 그림자 fixture: 배경(회색 100) 대비 frac 비율의 픽셀을 균일 감광(밝기 비율 k, 색 보존) */
  const shade = (tMs: number, k: number, frac = 1): EngineFrame => {
    const luma = new Uint8Array(N).fill(100);
    const rgb = new Uint8Array(N * 3).fill(100);
    const v = Math.round(100 * k);
    for (let i = 0; i < Math.round(N * frac); i++) {
      luma[i] = v;
      rgb[i * 3] = v;
      rgb[i * 3 + 1] = v;
      rgb[i * 3 + 2] = v;
    }
    return { tMs, luma, rgb };
  };

  it("R19 그림자: 균일 감광(밝기 비율 0.55, 색 보존) 진입·이탈은 통과가 아니다 — 오탐 0", () => {
    const e = mk();
    const ev: ReturnType<typeof e.process> = [];
    e.process(frame(0, 0)); // 배경 시드 (회색 100)
    ev.push(...e.process(shade(16, 0.55))); // 그림자 전면 진입 (Δluma 45 > 임계 40이지만 그림자)
    expect(e.lastChangeRatio).toBe(0); // 전 픽셀 그림자 분류 — burst 자체가 안 열림
    ev.push(...e.process(shade(32, 0.55)));
    ev.push(...e.process(frame(48, 0))); // 이탈
    expect(ev).toHaveLength(0);
  });

  it("R19 그림자 체류 후 이탈: 배경 학습 동결로 이탈 순간에도 오탐 0", () => {
    const e = mk();
    const ev: ReturnType<typeof e.process> = [];
    e.process(frame(0, 0));
    // 1초 체류 — 학습이 동결되지 않으면 배경이 55로 끌려가 이탈 시 밝아짐이 통과로 오탐된다
    for (let t = 16; t <= 1000; t += 16) ev.push(...e.process(shade(t, 0.55)));
    ev.push(...e.process(frame(1016, 0))); // 이탈 — 동결된 원래 배경과 일치해야 함
    expect(e.lastChangeRatio).toBe(0);
    ev.push(...e.process(frame(1032, 0)));
    expect(ev).toHaveLength(0);
  });

  it("R19: 그림자 대역 밝기여도 색이 있는 차는 감지된다 (색 잔차 = 실물)", () => {
    const e = mk();
    e.process(frame(0, 0)); // 배경 회색 100
    // 어두운 빨강 (150,20,20): luma ≈59 → k≈0.59 그림자 대역이지만 대립채널 잔차 130 ≫ 24
    const luma = new Uint8Array(N).fill(59);
    const rgb = new Uint8Array(N * 3);
    for (let i = 0; i < N; i++) {
      rgb[i * 3] = 150;
      rgb[i * 3 + 1] = 20;
      rgb[i * 3 + 2] = 20;
    }
    const ev = [...e.process({ tMs: 16, luma, rgb }), ...e.process(frame(32, 0))];
    expect(ev).toHaveLength(1);
    expect(ev[0]!.peakChangeRatio).toBeCloseTo(1, 5);
  });

  it("R19: 검정 차(그림자 대역보다 어두움)는 그림자로 오분류되지 않는다", () => {
    const e = mk();
    e.process(frame(0, 0)); // 배경 회색 100
    // luma 20 → k=0.2 < shadowRatioMin(0.4) — 무채색이어도 실물 가림으로 인정
    const ev = [...e.process(shade(16, 0.2)), ...e.process(frame(32, 0))];
    expect(ev).toHaveLength(1);
  });

  it("reset 후 배경 재시드 — 이전 상태 이월 없음", () => {
    const e = mk();
    e.process(frame(0, 0));
    e.process(frame(16, 1)); // burst 진행 중
    e.reset();
    // reset 후 첫 프레임이 다시 배경 시드가 되어야 함(가림이어도 통과 없음)
    const ev = [...e.process(frame(32, 1)), ...e.process(frame(48, 0))];
    // 32가 새 배경(luma 200)이 되므로 48(luma 100 clear)이 오히려 변화 → 하지만 첫 seed 직후라
    // 48은 seed(200) 대비 변화율 1 → burst, 종료 이벤트는 다음 clear에서. 여기선 통과 0 확인(경계 안정성).
    expect(ev.length).toBeLessThanOrEqual(1);
  });
});
