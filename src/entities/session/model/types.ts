// 도메인 타입 (state-contract.md 승계). 단일 랩 + 누적 모델(confirmed-design.md).
export type LapPhase = "idle" | "learning" | "armed" | "running";
export type StartMode = "manual" | "detect";

export interface Lap {
  /** 1부터 연속 */
  n: number;
  durationMs: number;
  /** 경계 매칭(색 애매)·병합 의심 랩 */
  suspect: boolean;
}

export interface SessionRecord {
  id: string;
  startedAt: number;
  laps: Lap[];
  /** 인식 모드에서 타깃 아님으로 무시된 통과 수 */
  otherPass: number;
}
