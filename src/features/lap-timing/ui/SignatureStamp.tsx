// R13: 색 시그니처 히트맵 스탬프 — 대표색 원 대신 52차원 분포 전체를 라운드 정사각 격자로.
// 레이아웃: [hue 24열 × 밝은/어두운 2행] + 우측 [무채색 2×2 블록(상: 밝음, 하: 어두움)].
// 셀 발광 강도 = 비중(최대 대비 정규화, pow 0.55 지각 보정), 빈 셀은 희미한 격자 유지.
import { ACHRO_BINS } from "@/shared/lib/laptime-engine/protocol";

export interface StampCell {
  col: number;
  row: number;
  color: string;
  alpha: number;
}

/** 시그니처 → 셀 목록 (순수 — 테스트 대상). 무채색 블록은 col = planeBins, planeBins+1. */
export function stampCells(sig: number[]): { cells: StampCell[]; planeBins: number } {
  const planeBins = Math.max(1, Math.floor((sig.length - ACHRO_BINS) / 2));
  const masses: number[] = [];
  let maxM = 0.001;
  for (let i = 0; i < planeBins * 2; i++) maxM = Math.max(maxM, sig[i] ?? 0);
  for (let k = 0; k < ACHRO_BINS; k++) maxM = Math.max(maxM, sig[planeBins * 2 + k] ?? 0);
  void masses;
  const alphaOf = (m: number): number => (m > 0 ? Math.max(0.12, Math.pow(m / maxM, 0.55)) : 0.05);
  const cells: StampCell[] = [];
  for (let i = 0; i < planeBins; i++) {
    const h = Math.round(((i + 0.5) / planeBins) * 360);
    const bright = sig[planeBins + i] ?? 0;
    const dark = sig[i] ?? 0;
    cells.push({ col: i, row: 0, color: bright > 0 ? `hsl(${h} 85% 62%)` : "hsl(220 15% 30%)", alpha: alphaOf(bright) });
    cells.push({ col: i, row: 1, color: dark > 0 ? `hsl(${h} 85% 36%)` : "hsl(220 15% 30%)", alpha: alphaOf(dark) });
  }
  // 무채색 2×2: [최명, 명 / 암, 최암] — achro bin 순서는 [최암, 암, 명, 최명](엔진 delta 부호 기준)
  const tone = [22, 45, 68, 88];
  const layout: [number, number, number][] = [
    [planeBins, 0, 3],
    [planeBins + 1, 0, 2],
    [planeBins, 1, 1],
    [planeBins + 1, 1, 0],
  ];
  for (const [col, row, k] of layout) {
    const m = sig[planeBins * 2 + k] ?? 0;
    cells.push({ col, row, color: `hsl(0 0% ${tone[k]}%)`, alpha: alphaOf(m) });
  }
  return { cells, planeBins };
}

interface Props {
  sig: number[];
  /** 셀 한 변(px) — 측정 화면 8, 기록 리스트 4 */
  cell?: number;
  /** 등록 순간 스캔 애니메이션 (측정 화면 전용) */
  animate?: boolean;
}

export function SignatureStamp({ sig, cell = 8, animate = false }: Props) {
  const { cells, planeBins } = stampCells(sig);
  const gap = cell * 0.25;
  const rx = cell * 0.3;
  const blockGap = gap * 3; // hue 격자와 무채색 블록 사이
  const x = (col: number) => col * (cell + gap) + (col >= planeBins ? blockGap : 0);
  const w = x(planeBins + 1) + cell;
  const h = cell * 2 + gap;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label="타깃 색 시그니처" className={animate ? "stamp-anim" : undefined}>
      {cells.map((c, i) => (
        <rect
          key={i}
          x={x(c.col)}
          y={c.row * (cell + gap)}
          width={cell}
          height={cell}
          rx={rx}
          fill={c.color}
          fillOpacity={c.alpha}
          className={animate ? "stamp-cell" : undefined}
          style={animate ? { animationDelay: `${c.col * 14}ms` } : undefined}
        />
      ))}
    </svg>
  );
}
