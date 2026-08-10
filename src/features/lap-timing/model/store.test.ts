import { beforeEach, describe, expect, it } from "vitest";
import { useLapStore } from "./store";
import type { PassEvent } from "@/shared/lib/laptime-engine/protocol";

const S = () => useLapStore.getState();
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const sig = (peak: number): number[] => Array.from({ length: 12 }, (_, i) => (i === peak ? 1 : 0));
const green = sig(4);
const red = sig(0);
const pass = (tMs: number, signature: number[]): PassEvent => ({ tMs, peakChangeRatio: 1, durationMs: 30, signature });

beforeEach(() => {
  S().reset();
});

describe("lap store 상태머신", () => {
  it("수동: 탭 시작 → 정지 → 랩 기록(실측 지속)", async () => {
    S().startManual();
    expect(S().phase).toBe("running");
    await wait(850);
    S().stopByButton();
    expect(S().phase).toBe("idle");
    expect(S().laps).toHaveLength(1);
    expect(S().laps[0]!.durationMs).toBeGreaterThanOrEqual(800);
  });

  it("인식: 밀어서 시작 → learning→armed → 첫 통과 출발 → 복귀 정지(engine ms 델타)", async () => {
    S().startDetect();
    expect(S().phase).toBe("learning");
    await wait(1300);
    expect(S().phase).toBe("armed");
    S().handlePass(pass(1000, green));
    expect(S().phase).toBe("running");
    expect(S().targetSig).not.toBeNull();
    S().handlePass(pass(2000, green));
    expect(S().laps).toHaveLength(1);
    expect(Math.round(S().laps[0]!.durationMs)).toBe(1000);
    expect(S().phase).toBe("idle");
  });

  it("타차 통과 무시 + 랩 누적", async () => {
    S().startDetect();
    await wait(1300);
    S().handlePass(pass(5000, green)); // 출발
    S().handlePass(pass(6000, red)); // 타차 → 무시
    expect(S().phase).toBe("running");
    expect(S().otherPass).toBe(1);
    S().handlePass(pass(8000, green)); // 복귀 → 랩
    expect(S().laps).toHaveLength(1);
    expect(Math.round(S().laps[0]!.durationMs)).toBe(3000);
  });

  it("경계 색 매칭은 의심 랩", async () => {
    S().startDetect();
    await wait(1300);
    S().handlePass(pass(1000, green));
    const border = Array.from({ length: 12 }, (_, i) => (i === 4 ? 0.6 : i === 5 ? 0.4 : 0)); // green과 L1=0.8 ∈(0.7,1.0]
    S().handlePass(pass(3000, border));
    expect(S().laps).toHaveLength(1);
    expect(S().laps[0]!.suspect).toBe(true);
  });

  it("디바운스: 800ms 미만 랩은 기록 안 함", async () => {
    S().startDetect();
    await wait(1300);
    S().handlePass(pass(1000, green)); // 출발
    S().handlePass(pass(1200, green)); // 200ms → 디바운스
    expect(S().laps).toHaveLength(0);
    expect(S().phase).toBe("running");
  });
});
