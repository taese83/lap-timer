import { describe, expect, it } from "vitest";
import { stampBars } from "./SignatureStamp";
import { ACHRO_BINS } from "@/shared/lib/laptime-engine/protocol";

const HUE = 24;

function sig(fill: (s: number[]) => void): number[] {
  const s = Array.from({ length: HUE * 2 + ACHRO_BINS }, () => 0);
  fill(s);
  return s;
}

describe("SignatureStamp 이퀄라이저 모델 (R16)", () => {
  it("지배색 막대가 최대 길이(t=1) + 글로우, 평면은 위/아래로 갈린다", () => {
    const blue = sig((s) => {
      s[14] = 0.4; // 어두운 남색 → 아래 방향 막대
      s[HUE + 14] = 0.2; // 밝은 하늘색 → 위 방향 막대
    });
    const { bars, planeBins, domHue } = stampBars(blue);
    expect(planeBins).toBe(24);
    expect(bars).toHaveLength(HUE * 2 + ACHRO_BINS);
    const down = bars.find((b) => b.col === 14 && !b.up)!;
    expect(down.t).toBe(1); // 최대 비중 = 길이 정규화 1
    expect(down.glow).toBe(true);
    expect(down.color).toContain("50%"); // 어두운 평면 명도 보조 인코딩(30+20t)
    const up = bars.find((b) => b.col === 14 && b.up)!;
    expect(up.t).toBeGreaterThan(0);
    expect(up.t).toBeLessThan(1);
    expect(domHue).not.toBeNull();
    const empty = bars.find((b) => b.col === 0 && b.up)!;
    expect(empty.t).toBe(0); // 빈 bin = 기준선 틱
    expect(empty.glow).toBe(false);
  });

  it("무채색 질량은 우측 열 막대에 실린다 (최명 = planeBins열 위 방향)", () => {
    const white = sig((s) => {
      s[HUE * 2 + 3] = 0.3; // 최명 무채색
    });
    const { bars, planeBins } = stampBars(white);
    const bright = bars.find((b) => b.col === planeBins && b.up)!;
    expect(bright.t).toBe(1);
    expect(bright.color).toContain("88%");
  });
});
