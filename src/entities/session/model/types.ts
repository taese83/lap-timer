// 도메인 타입 (state-contract.md 승계). 단일 랩 + 누적 모델(confirmed-design.md).
export type LapPhase = "idle" | "learning" | "armed" | "running";
export type StartMode = "manual" | "detect";

export interface Lap {
  /** 1부터 연속 */
  n: number;
  durationMs: number;
  /** 경계 매칭(색 애매)·병합 의심 랩 */
  suspect: boolean;
  /**
   * R10-c: 의심 통과가 여러 번이었을 때의 후보 랩타임 전부(시간순, durationMs=첫 항목).
   * 확정 없이 정지한 세션에서 어느 통과가 내 차였는지 사용자가 판단할 근거. additive optional —
   * 구 레코드·확정 랩은 부재.
   */
  candidatesMs?: number[];
}

export interface SessionRecord {
  id: string;
  startedAt: number;
  laps: Lap[];
  /** 인식 모드에서 타깃 아님으로 무시된 통과 수 */
  otherPass: number;
}
