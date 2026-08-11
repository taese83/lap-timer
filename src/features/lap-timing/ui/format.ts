/** ms → "초.centi" (예: 12.17). tabular-nums로 표시. */
export function fmt(ms: number): string {
  const s = Math.floor(ms / 1000);
  const cs = Math.floor((ms % 1000) / 10);
  return `${String(s).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}

/** R13 히어로용 분해 — 초("12.")와 센티초("47")를 크기 분화해 렌더 */
export function fmtParts(ms: number): { main: string; cs: string } {
  const [main, cs] = fmt(ms).split(".");
  return { main: `${main}.`, cs: cs ?? "00" };
}

import { ACHRO_BINS } from "@/shared/lib/laptime-engine/protocol";

/** 무채색 bin(어두움→밝음) 대표 스와치 — 검정/짙은 회색/밝은 회색/흰색 차 표시용 */
const ACHRO_SWATCH = ["oklch(0.25 0 0)", "oklch(0.45 0 0)", "oklch(0.8 0 0)", "oklch(0.95 0 0)"] as const;

/** 타깃 시그니처(R8: [어두운 hue×N][밝은 hue×N][무채색 4]) → 대표(최빈) 색 oklch. 색 칩 채움. */
export function signatureColor(sig: number[] | null): string | null {
  if (!sig || sig.length === 0) return null;
  let peak = 0;
  let peakVal = 0;
  for (let i = 0; i < sig.length; i++) {
    if (sig[i]! > peakVal) {
      peakVal = sig[i]!;
      peak = i;
    }
  }
  if (peakVal <= 0) return null;
  const hueCount = Math.max(1, sig.length - ACHRO_BINS);
  if (peak >= hueCount) return ACHRO_SWATCH[Math.min(peak - hueCount, ACHRO_SWATCH.length - 1)]!;
  const planeBins = Math.max(1, Math.floor(hueCount / 2));
  const brightPlane = peak >= planeBins;
  const hueIdx = brightPlane ? peak - planeBins : peak;
  const hue = ((hueIdx + 0.5) / planeBins) * 360;
  // 어두운 톤 평면이면 명도 낮춰 표시 (남색 vs 하늘색이 칩에서도 구분되게)
  return `oklch(${brightPlane ? 0.7 : 0.45} 0.17 ${hue.toFixed(0)})`;
}
