import { describe, expect, it } from "vitest";
import { stampCells } from "./SignatureStamp";
import { ACHRO_BINS } from "@/shared/lib/laptime-engine/protocol";

const HUE = 24;

function sig(fill: (s: number[]) => void): number[] {
  const s = Array.from({ length: HUE * 2 + ACHRO_BINS }, () => 0);
  fill(s);
  return s;
}

describe("SignatureStamp 모델", () => {
  it("지배색 셀이 최대 발광(명도 인코딩) + 글로우, 빈 셀은 꺼진 LED 격자", () => {
    const blue = sig((s) => {
      s[14] = 0.4; // 어두운 남색 (col 14, row 1)
      s[HUE + 14] = 0.2; // 밝은 하늘색 (col 14, row 0)
    });
    const { cells, planeBins, domHue } = stampCells(blue);
    expect(planeBins).toBe(24);
    const dom = cells.find((c) => c.col === 14 && c.row === 1)!;
    expect(dom.alpha).toBe(1); // 최대 비중 = 정규화 1
    expect(dom.color).toContain("50%"); // R15: 비중 → 명도 인코딩 (어두운 평면 30+20·t)
    expect(dom.glow).toBe(true); // 지배 열 글로우
    expect(dom.stroke).not.toBe("none"); // 림 스트로크
    expect(domHue).not.toBeNull();
    const empty = cells.find((c) => c.col === 0 && c.row === 0)!;
    expect(empty.alpha).toBeCloseTo(0.16, 2); // 꺼진 LED 격자
    expect(empty.glow).toBe(false);
    expect(cells).toHaveLength(HUE * 2 + ACHRO_BINS);
  });

  it("무채색 질량은 2×2 블록 셀에 실린다 (최명 = 우상단 아님 — 좌상단)", () => {
    const white = sig((s) => {
      s[HUE * 2 + 3] = 0.3; // 최명 무채색
    });
    const { cells, planeBins } = stampCells(white);
    const bright = cells.find((c) => c.col === planeBins && c.row === 0)!; // 레이아웃상 최명 위치
    expect(bright.alpha).toBe(1);
    expect(bright.color).toContain("88%");
  });
});
