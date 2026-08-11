// R16: 색 시그니처 이퀄라이저 — 52차원 분포를 중앙 미러 스펙트럼 바로(막대 1쌍 = hue bin 1개).
// 사용자 확정: 검출 강도를 **길이**로 인코딩(가장 강한 지각 채널). 기준선 위 = 밝은 톤,
// 아래 = 어두운 톤, 우측 2열 = 무채색(밝음↑/어두움↓). 빈 bin은 기준선 틱으로 축 유지,
// 명도·림 스트로크·지배 열 글로우(R15)는 보조 인코딩으로 유지.
import { ACHRO_BINS } from "@/shared/lib/laptime-engine/protocol";

export interface StampBar {
  col: number;
  /** 기준선 위(밝은 톤/밝은 무채색) 여부 */
  up: boolean;
  /** 정규화 강도 0~1 (빈 bin = 0) */
  t: number;
  color: string;
  stroke: string;
  alpha: number;
  glow: boolean;
}

/** 시그니처 → 막대 목록 (순수 — 테스트 대상). 무채색은 col = planeBins, planeBins+1. */
export function stampBars(sig: number[]): { bars: StampBar[]; planeBins: number; domHue: number | null } {
  const planeBins = Math.max(1, Math.floor((sig.length - ACHRO_BINS) / 2));
  let maxM = 0.001;
  for (let i = 0; i < sig.length; i++) maxM = Math.max(maxM, sig[i] ?? 0);
  const t = (m: number): number => (m > 0 ? Math.pow(m / maxM, 0.55) : 0);
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

  const bars: StampBar[] = [];
  const push = (col: number, up: boolean, m: number, hueDeg: number | null, tone?: number): void => {
    const tv = t(m);
    if (m <= 0) {
      bars.push({ col, up, t: 0, color: "hsl(222 14% 42%)", stroke: "none", alpha: 0.35, glow: false });
      return;
    }
    const alpha = 0.55 + 0.45 * tv;
    let color: string;
    let stroke: string;
    if (hueDeg !== null && up) {
      const L = Math.round(52 + 20 * tv);
      color = `hsl(${hueDeg} 90% ${L}%)`;
      stroke = `hsl(${hueDeg} 95% ${Math.min(96, L + 16)}%)`;
    } else if (hueDeg !== null) {
      const L = Math.round(30 + 20 * tv);
      color = `hsl(${hueDeg} 88% ${L}%)`;
      stroke = `hsl(${hueDeg} 92% ${Math.min(96, L + 14)}%)`;
    } else {
      color = `hsl(0 0% ${tone}%)`;
      stroke = `hsl(0 0% ${Math.min(100, (tone ?? 50) + 18)}%)`;
    }
    bars.push({ col, up, t: tv, color, stroke, alpha, glow: hueDeg !== null && col === dom });
  };

  for (let i = 0; i < planeBins; i++) {
    const h = Math.round(((i + 0.5) / planeBins) * 360);
    push(i, true, sig[planeBins + i] ?? 0, h);
    push(i, false, sig[i] ?? 0, h);
  }
  // 무채색: [최암, 암, 명, 최명] bin → 1열(최명↑/최암↓), 2열(명↑/암↓)
  const tone = [22, 45, 68, 88];
  push(planeBins, true, sig[planeBins * 2 + 3] ?? 0, null, tone[3]);
  push(planeBins, false, sig[planeBins * 2 + 0] ?? 0, null, tone[0]);
  push(planeBins + 1, true, sig[planeBins * 2 + 2] ?? 0, null, tone[2]);
  push(planeBins + 1, false, sig[planeBins * 2 + 1] ?? 0, null, tone[1]);
  return { bars, planeBins, domHue };
}

interface Props {
  sig: number[];
  /** 막대 폭(px) — 측정 화면 8, 기록 리스트 3.2 */
  cell?: number;
  /** 등록 순간 기준선에서 자라나는 애니메이션 (측정 화면 전용) */
  animate?: boolean;
}

let filterSeq = 0;

export function SignatureStamp({ sig, cell = 8, animate = false }: Props) {
  const { bars, planeBins, domHue } = stampBars(sig);
  const bw = cell;
  const gap = cell * 0.28;
  const rx = cell * 0.3;
  const maxLen = cell * 2.75;
  const minLen = cell * 0.5;
  const blockGap = gap * 3;
  const x = (col: number) => col * (bw + gap) + (col >= planeBins ? blockGap : 0);
  const gridW = x(planeBins + 1) + bw;
  const cy = maxLen + minLen + bw * 0.4;
  const pad = cell * 0.5;
  const w = gridW + pad * 2;
  const h = cy * 2;
  const fid = `stamp-glow-${filterSeq++}`;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label="타깃 색 시그니처">
      {domHue !== null && (
        <defs>
          <filter id={fid} x="-80%" y="-80%" width="260%" height="260%">
            <feDropShadow dx="0" dy="0" stdDeviation={cell * 0.25} floodColor={`hsl(${domHue} 90% 60%)`} floodOpacity="0.7" />
          </filter>
        </defs>
      )}
      <g transform={`translate(${pad},0)`}>
        {bars.map((b, i) => {
          if (b.t <= 0) {
            const tickH = Math.max(1.2, cell * 0.22);
            return (
              <rect
                key={i}
                x={x(b.col)}
                y={b.up ? cy - 0.4 - tickH : cy + 0.4}
                width={bw}
                height={tickH}
                rx={tickH / 2}
                fill={b.color}
                fillOpacity={b.alpha}
              />
            );
          }
          const len = minLen + b.t * maxLen;
          return (
            <rect
              key={i}
              x={x(b.col)}
              y={b.up ? cy - 0.6 - len : cy + 0.6}
              width={bw}
              height={len}
              rx={rx}
              fill={b.color}
              fillOpacity={b.alpha}
              stroke={b.stroke}
              strokeOpacity={0.5 * b.alpha}
              strokeWidth={Math.max(0.4, cell * 0.07)}
              filter={b.glow && domHue !== null ? `url(#${fid})` : undefined}
              className={animate ? (b.up ? "eq-bar eq-up" : "eq-bar eq-down") : undefined}
              style={animate ? { animationDelay: `${b.col * 14}ms` } : undefined}
            />
          );
        })}
      </g>
    </svg>
  );
}
