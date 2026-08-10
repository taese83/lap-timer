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
    // R10-d: 수동 모드 버튼 정지는 클릭 시점 기록 — 의심 결산 경로를 타지 않는다
    expect(S().laps[0]!.suspect).toBe(false);
    expect(S().laps[0]!.candidatesMs).toBeUndefined();
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

  it("R10: 의심 통과는 시각만 보류하고 타이머 계속 — 버튼 정지 시 의심 시각으로 의심 랩", async () => {
    S().startDetect();
    S().cameraReady();
    await wait(1300);
    S().handlePass(pass(1000, green)); // 출발
    const border = Array.from({ length: 12 }, (_, i) => (i === 4 ? 0.6 : i === 5 ? 0.4 : 0)); // green과 L1=0.8 ∈(0.7,1.5]
    S().handlePass(pass(3000, border)); // 의심 — 기록만, 정지 없음
    expect(S().phase).toBe("running"); // 타이머 계속
    expect(S().laps).toHaveLength(0);
    S().stopByButton(); // 확정 없이 정지 → 의심 판단 정보를 그대로 기재
    expect(S().laps).toHaveLength(1);
    expect(S().laps[0]!.suspect).toBe(true);
    expect(Math.round(S().laps[0]!.durationMs)).toBe(2000); // 의심 통과 시각(3000) 기준, 버튼 누른 시각 아님
  });

  it("R10: 이후 확정 매치가 오면 그것으로 정지하고 의심 기록은 삭제", async () => {
    S().startDetect();
    S().cameraReady();
    await wait(1300);
    S().handlePass(pass(1000, green)); // 출발
    const border = Array.from({ length: 12 }, (_, i) => (i === 4 ? 0.6 : i === 5 ? 0.4 : 0));
    S().handlePass(pass(3000, border)); // 비슷한 타차 — 의심 보류
    expect(S().phase).toBe("running");
    S().handlePass(pass(5000, green)); // 내 차 확정 매치 — 즉시 정지, 의심 폐기
    expect(S().laps).toHaveLength(1);
    expect(S().laps[0]!.suspect).toBe(false);
    expect(Math.round(S().laps[0]!.durationMs)).toBe(4000); // 확정 통과 시각 기준
  });

  it("R10-c: 여러 의심은 전부 시간순 후보로 랩에 실린다 (채택값 = 최초 의심)", async () => {
    S().startDetect();
    S().cameraReady();
    await wait(1300);
    S().handlePass(pass(1000, green));
    const border = Array.from({ length: 12 }, (_, i) => (i === 4 ? 0.6 : i === 5 ? 0.4 : 0));
    S().handlePass(pass(3000, border)); // 의심 1
    S().handlePass(pass(4500, border)); // 의심 2
    S().handlePass(pass(6200, border)); // 의심 3
    S().stopByButton();
    expect(S().laps).toHaveLength(1);
    const lap = S().laps[0]!;
    expect(lap.suspect).toBe(true);
    expect(Math.round(lap.durationMs)).toBe(2000); // 채택값 = 최초 의심(3000) 기준
    expect(lap.candidatesMs?.map((ms) => Math.round(ms))).toEqual([2000, 3500, 5200]); // 시간순 전부
  });

  it("R10-c: 의심이 1건이면 후보 목록 없이 기록, 확정 정지 랩에도 후보 없음", async () => {
    S().startDetect();
    S().cameraReady();
    await wait(1300);
    S().handlePass(pass(1000, green));
    const border = Array.from({ length: 12 }, (_, i) => (i === 4 ? 0.6 : i === 5 ? 0.4 : 0));
    S().handlePass(pass(3000, border)); // 의심 1건
    S().stopByButton();
    expect(S().laps[0]!.candidatesMs).toBeUndefined();
    // 두 번째 세션: 의심 후 확정 — 후보 없음
    S().startDetect();
    S().cameraReady();
    await wait(1300);
    S().handlePass(pass(10000, green));
    S().handlePass(pass(12000, border));
    S().handlePass(pass(14000, green)); // 확정 — 의심 폐기
    expect(S().laps).toHaveLength(2);
    expect(S().laps[1]!.suspect).toBe(false);
    expect(S().laps[1]!.candidatesMs).toBeUndefined();
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

  it("R11: 시작 직후 정지 버튼은 씹히지 않는다 — 기록 없이 즉시 종료 (수동/감지 공통)", async () => {
    // 수동: 탭 시작 → 즉시 정지 (800ms 하한 안쪽)
    S().startManual();
    S().stopByButton();
    expect(S().phase).toBe("idle"); // 버튼은 항상 반응
    expect(S().laps).toHaveLength(0); // 하한 미만 — 기록 없음(취소 시맨틱)
    // 감지: 출발 통과 → 즉시 정지
    S().startDetect();
    S().cameraReady();
    await wait(1300);
    S().handlePass(pass(1000, green)); // 출발
    S().stopByButton(); // 시작 직후(하한 안쪽) 정지
    expect(S().phase).toBe("idle");
    expect(S().laps).toHaveLength(0);
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
