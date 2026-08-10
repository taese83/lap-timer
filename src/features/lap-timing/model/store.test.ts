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
    S().cameraReady();
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
    S().cameraReady();
    await wait(1300);
    S().handlePass(pass(5000, green)); // 출발
    S().handlePass(pass(6000, red)); // 타차 → 무시
    expect(S().phase).toBe("running");
    expect(S().otherPass).toBe(1);
    S().handlePass(pass(8000, green)); // 복귀 → 랩
    expect(S().laps).toHaveLength(1);
    expect(Math.round(S().laps[0]!.durationMs)).toBe(3000);
  });

  it("경계 색 매칭은 즉시 멈추지 않고(R10 유예) 만료 후 의심 랩으로 기록", async () => {
    S().startDetect();
    S().cameraReady();
    await wait(1300);
    S().handlePass(pass(1000, green));
    const border = Array.from({ length: 12 }, (_, i) => (i === 4 ? 0.6 : i === 5 ? 0.4 : 0)); // green과 L1=0.8 ∈(0.7,1.5]
    S().handlePass(pass(3000, border));
    expect(S().phase).toBe("running"); // R10: 의심은 즉시 정지 아님 — 확정 대기
    expect(S().laps).toHaveLength(0);
    await wait(2200); // 유예(2s) 만료
    expect(S().laps).toHaveLength(1);
    expect(S().laps[0]!.suspect).toBe(true);
    expect(Math.round(S().laps[0]!.durationMs)).toBe(2000); // 의심 통과의 원래 시각(3000) 기준
  });

  it("R10: 유예 중 확정 매치가 오면 그것으로 정지 — 의심은 타차였던 것", async () => {
    S().startDetect();
    S().cameraReady();
    await wait(1300);
    S().handlePass(pass(1000, green)); // 출발
    const border = Array.from({ length: 12 }, (_, i) => (i === 4 ? 0.6 : i === 5 ? 0.4 : 0));
    S().handlePass(pass(3000, border)); // 비슷한 타차 — 의심, 유예 시작
    expect(S().phase).toBe("running");
    S().handlePass(pass(3500, green)); // 내 차 확정 매치 — 즉시 정지
    expect(S().laps).toHaveLength(1);
    expect(S().laps[0]!.suspect).toBe(false);
    expect(Math.round(S().laps[0]!.durationMs)).toBe(2500); // 확정 통과 시각 기준
    await wait(2200); // 남은 유예 타이머가 이중 기록을 만들지 않는다
    expect(S().laps).toHaveLength(1);
  });

  it("R3: 새 감지 세션은 타깃을 재등록한다 — 이전 세션 시그니처가 시작을 막지 않음", async () => {
    // 세션 1: 초록 차 등록 → 복귀로 랩 1
    S().startDetect();
    S().cameraReady();
    await wait(1300);
    S().handlePass(pass(1000, green));
    S().handlePass(pass(3000, green));
    expect(S().laps).toHaveLength(1);
    expect(S().phase).toBe("idle");
    // 세션 2: 조명·노출이 바뀌어 첫 통과가 빨강처럼 보여도(이전 타깃과 원거리) 시작돼야 한다
    S().startDetect();
    S().cameraReady();
    expect(S().targetSig).toBeNull(); // 세션 진입 시 타깃 초기화
    await wait(1300);
    S().handlePass(pass(10000, red));
    expect(S().phase).toBe("running"); // 거부되지 않고 새 타깃으로 등록·출발
    S().handlePass(pass(13000, red));
    expect(S().laps).toHaveLength(2); // 복귀 정지도 새 타깃 기준으로 성립
  });

  it("R4: 카메라 준비 전에는 armed로 넘어가지 않는다 (learning 유지)", async () => {
    S().startDetect(); // cameraReady 없음 — 스트림이 안 선 상황
    await wait(1400);
    expect(S().phase).toBe("learning");
    S().cameraReady(); // 스트림 확립 → 이제부터 학습
    await wait(1300);
    expect(S().phase).toBe("armed");
  });

  it("디바운스: 800ms 미만 랩은 기록 안 함", async () => {
    S().startDetect();
    S().cameraReady();
    await wait(1300);
    S().handlePass(pass(1000, green)); // 출발
    S().handlePass(pass(1200, green)); // 200ms → 디바운스
    expect(S().laps).toHaveLength(0);
    expect(S().phase).toBe("running");
  });
});
