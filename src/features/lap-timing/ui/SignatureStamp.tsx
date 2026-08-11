// R13/R15: 색 시그니처 히트맵 스탬프 — 52차원 분포를 라운드 정사각 격자로(셀 1개 = bin 1개).
// 레이아웃: [hue 24열 × 밝은/어두운 2행] + 우측 [무채색 2×2 블록(상: 밝음, 하: 어두움)].
// R15 가시성(→ R15-d 사용자 확정: 트레이 없는 개선 1안): 비중을 투명도가 아니라 **명도로
// 인코딩**해 검은 배경에서도 대비를 유지하고, 활성 셀에 동일 색 림 스트로크, 지배 열에만
// 글로우. 빈 셀은 꺼진 LED 격자.
import { ACHRO_BINS } from "@/shared/lib/laptime-engine/protocol";

export interface StampCell {
  col: number;
  row: number;
  color: string;
  stroke: string;
  alpha: number;
  /** 지배 열(최대 비중 hue) 활성 셀 — 글로우 대상 */
  glow: boolean;
}

/** 시그니처 → 셀 목록 (순수 — 테스트 대상). 무채색 블록은 col = planeBins, planeBins+1. */
export function stampCells(sig: number[]): { cells: StampCell[]; planeBins: number; domHue: number | null } {
  const planeBins = Math.max(1, Math.floor((sig.length - ACHRO_BINS) / 2));
  let maxM = 0.001;
  for (let i = 0; i < sig.length; i++) maxM = Math.max(maxM, sig[i] ?? 0);
  const t = (m: number): number => Math.pow(Math.max(0, m) / maxM, 0.55);
  // 지배 hue 열 (유채색 질량 기준) — 유채색이 전무하면 글로우 없음
  let dom = -1;
  let domMass = 0;
  for (let i = 0; i < planeBins; i++) {
    const m = (sig[i] ?? 0) + (sig[planeBins + i] ?? 0);
    if (m > domMass) {
      domMass = m;
      dom = i;
    }
  }
  const domHue = dom >= 0 && domMass > 0 ? Math.round(((dom + 0.5) / planeBins) * 360) : null;

  const cells: StampCell[] = [];
  const push = (col: number, row: number, m: number, hueDeg: number | null, plane: "b" | "d" | "a", tone?: number): void => {
    if (m <= 0) {
      // 꺼진 LED — 격자 존재감은 유지하되 조용하게
      cells.push({ col, row, color: "hsl(222 14% 40%)", stroke: "none", alpha: 0.16, glow: false });
      return;
    }
    const tv = t(m);
    const alpha = 0.45 + 0.55 * tv;
    let color: string;
    let stroke: string;
    if (plane === "b") {
      const L = Math.round(52 + 20 * tv);
      color = `hsl(${hueDeg} 90% ${L}%)`;
      stroke = `hsl(${hueDeg} 95% ${Math.min(96, L + 16)}%)`;
    } else if (plane === "d") {
      const L = Math.round(30 + 20 * tv);
      color = `hsl(${hueDeg} 88% ${L}%)`;
      stroke = `hsl(${hueDeg} 92% ${Math.min(96, L + 14)}%)`;
    } else {
      color = `hsl(0 0% ${tone}%)`;
      stroke = `hsl(0 0% ${Math.min(100, (tone ?? 50) + 18)}%)`;
    }
    cells.push({ col, row, color, stroke, alpha, glow: plane !== "a" && col === dom });
  };

  for (let i = 0; i < planeBins; i++) {
    const h = Math.round(((i + 0.5) / planeBins) * 360);
    push(i, 0, sig[planeBins + i] ?? 0, h, "b");
    push(i, 1, sig[i] ?? 0, h, "d");
  }
  // 무채색 2×2: [최명, 명 / 암, 최암] — achro bin 순서는 [최암, 암, 명, 최명](엔진 delta 부호 기준)
  const tone = [22, 45, 68, 88];
  const layout: [number, number, number][] = [
    [planeBins, 0, 3],
    [planeBins + 1, 0, 2],
    [planeBins, 1, 1],
    [planeBins + 1, 1, 0],
  ];
  for (const [col, row, k] of layout) push(col, row, sig[planeBins * 2 + k] ?? 0, null, "a", tone[k]);
  return { cells, planeBins, domHue };
}

interface Props {
  sig: number[];
  /** 셀 한 변(px) — 측정 화면 8, 기록 리스트 4 */
  cell?: number;
  /** 등록 순간 스캔 애니메이션 (측정 화면 전용) */
  animate?: boolean;
}

let filterSeq = 0;

export function SignatureStamp({ sig, cell = 8, animate = false }: Props) {
  const { cells, planeBins, domHue } = stampCells(sig);
  const gap = cell * 0.25;
  const rx = cell * 0.3;
  const blockGap = gap * 3; // hue 격자와 무채색 블록 사이
  const x = (col: number) => col * (cell + gap) + (col >= planeBins ? blockGap : 0);
  const gridW = x(planeBins + 1) + cell;
  const gridH = cell * 2 + gap;
  // R15-d(사용자): 트레이 제거 — 명도 인코딩·림·글로우만으로 배경 대비 확보(개선 1안).
  // 패딩은 지배 셀 글로우가 잘리지 않을 만큼만.
  const pad = cell * 0.5;
  const w = gridW + pad * 2;
  const h = gridH + pad * 2;
  const fid = `stamp-glow-${filterSeq++}`;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label="타깃 색 시그니처" >
      {domHue !== null && (
        <defs>
          <filter id={fid} x="-80%" y="-80%" width="260%" height="260%">
            <feDropShadow dx="0" dy="0" stdDeviation={cell * 0.28} floodColor={`hsl(${domHue} 90% 60%)`} floodOpacity="0.75" />
          </filter>
        </defs>
      )}
      <g transform={`translate(${pad},${pad})`}>
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
            stroke={c.stroke === "none" ? undefined : c.stroke}
            strokeOpacity={c.stroke === "none" ? undefined : 0.5 * c.alpha}
            strokeWidth={c.stroke === "none" ? undefined : Math.max(0.4, cell * 0.075)}
            filter={c.glow && domHue !== null ? `url(#${fid})` : undefined}
            className={animate ? "stamp-cell" : undefined}
            style={animate ? { animationDelay: `${c.col * 14}ms` } : undefined}
          />
        ))}
      </g>
    </svg>
  );
}
