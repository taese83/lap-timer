/** ms → "초.centi" (예: 12.17). tabular-nums로 표시. */
export function fmt(ms: number): string {
  const s = Math.floor(ms / 1000);
  const cs = Math.floor((ms % 1000) / 10);
  return `${String(s).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}

import { ACHRO_BINS } from "@/shared/lib/laptime-engine/protocol";

/** 무채색 bin(어두움→밝음) 대표 스와치 — 검정/짙은 회색/밝은 회색/흰색 차 표시용 */
const ACHRO_SWATCH = ["oklch(0.25 0 0)", "oklch(0.45 0 0)", "oklch(0.8 0 0)", "oklch(0.95 0 0)"] as const;

/** 타깃 시그니처(hue + 무채색 bin) → 대표(최빈) 색 oklch. 색 칩 채움. */
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
  const hue = ((peak + 0.5) / hueCount) * 360;
  return `oklch(0.62 0.19 ${hue.toFixed(0)})`;
}
