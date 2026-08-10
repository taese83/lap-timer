// 측정 상태머신 + 랩 누적 (confirmed-design.md 화면1). CV 엔진의 통과 이벤트를 소비해
// 시작/정지/타깃 매칭을 판정한다(엔진은 판정하지 않음 — 관심사 분리).
import { create } from "zustand";
import { signatureDistance } from "@/shared/lib/laptime-engine/engine";
import type { PassEvent } from "@/shared/lib/laptime-engine/protocol";
import { clearCurrent, loadCurrent, saveCurrent } from "@/shared/lib/persistence/db";
import type { Lap, LapPhase, StartMode } from "@/entities/session/model/types";

/** 배경 학습(인식 시작) 대기 ms. */
const LEARN_MS = 1200;
/** 랩 하한 — 출발 직후 재감지·이중 트리거 무시(brief 디바운스). */
const MIN_LAP_MS = 800;
/**
 * 색 시그니처 매칭 임계(L1 거리). **provisional — QA 첫 fixture 캘리브레이션에서 확정 후
 * write-back**(feature-plan HSV TC). 합성 검증: 동일 색 ≈0, 상이 색 ≈2.0.
 *  d ≤ MATCH: 타깃 / MATCH<d≤BORDER: 경계(의심 랩) / d>BORDER: 타차(무시).
 */
const SIG_MATCH = 0.7;
const SIG_BORDER = 1.0;

export type View = "measure" | "result";

interface LapStart {
  perfMs: number;
  engineMs: number | null;
}

interface LapState {
  view: View;
  phase: LapPhase;
  startMode: StartMode | null;
  targetSig: number[] | null;
  lapStart: LapStart | null;
  laps: Lap[];
  otherPass: number;
  lastLapMs: number | null;
  elapsedMs: number;
  startedAt: number;
  _learnTimer: ReturnType<typeof setTimeout> | null;

  hydrate: () => Promise<void>;
  startManual: () => void;
  startDetect: () => void;
  cancel: () => void;
  stopByButton: () => void;
  handlePass: (event: PassEvent) => void;
  rearm: () => void;
  reset: () => void;
  tick: () => void;
  openResult: () => void;
  back: () => void;
}

function persist(s: Pick<LapState, "startedAt" | "laps" | "otherPass">): void {
  void saveCurrent({ startedAt: s.startedAt, laps: s.laps, otherPass: s.otherPass });
}

export const useLapStore = create<LapState>((set, get) => {
  function recordLap(stopEngineMs: number | null, suspect: boolean): void {
    const { lapStart, laps, startedAt, otherPass } = get();
    if (!lapStart) return;
    const dur =
      lapStart.engineMs != null && stopEngineMs != null
        ? stopEngineMs - lapStart.engineMs
        : performance.now() - lapStart.perfMs;
    if (dur < MIN_LAP_MS) return; // 디바운스
    const nextLaps = [...laps, { n: laps.length + 1, durationMs: dur, suspect }];
    set({ laps: nextLaps, phase: "idle", lapStart: null, lastLapMs: dur, elapsedMs: dur });
    persist({ startedAt, laps: nextLaps, otherPass });
  }

  return {
    view: "measure",
    phase: "idle",
    startMode: null,
    targetSig: null,
    lapStart: null,
    laps: [],
    otherPass: 0,
    lastLapMs: null,
    elapsedMs: 0,
    startedAt: Date.now(),
    _learnTimer: null,

    hydrate: async () => {
      const cur = await loadCurrent();
      if (cur) set({ laps: cur.laps, otherPass: cur.otherPass, startedAt: cur.startedAt, lastLapMs: cur.laps.at(-1)?.durationMs ?? null });
    },

    startManual: () => {
      if (get().phase !== "idle") return;
      set({ startMode: "manual", phase: "running", lapStart: { perfMs: performance.now(), engineMs: null }, elapsedMs: 0 });
    },

    startDetect: () => {
      if (get().phase !== "idle") return;
      const t = setTimeout(() => {
        if (get().phase === "learning") set({ phase: "armed", _learnTimer: null });
      }, LEARN_MS);
      set({ startMode: "detect", phase: "learning", _learnTimer: t });
    },

    cancel: () => {
      const { _learnTimer } = get();
      if (_learnTimer) clearTimeout(_learnTimer);
      set({ phase: "idle", lapStart: null, _learnTimer: null });
    },

    stopByButton: () => {
      const { phase } = get();
      if (phase === "running") recordLap(null, false);
      else if (phase === "learning" || phase === "armed") get().cancel();
    },

    handlePass: (event) => {
      const { phase, startMode, targetSig, otherPass } = get();
      if (phase === "idle" || phase === "learning") return;

      if (phase === "armed") {
        if (targetSig === null) {
          set({ targetSig: event.signature ?? [] }); // 최초 통과 = 자동 타깃 등록
        } else if (event.signature) {
          if (signatureDistance(event.signature, targetSig) > SIG_BORDER) {
            set({ otherPass: otherPass + 1 }); // 다른 차 — 출발 아님
            return;
          }
        }
        set({ phase: "running", lapStart: { perfMs: performance.now(), engineMs: event.tMs }, elapsedMs: 0 });
        return;
      }

      // running → 정지 판정
      if (startMode === "detect") {
        const d = event.signature && targetSig ? signatureDistance(event.signature, targetSig) : 0;
        if (d > SIG_BORDER) {
          set({ otherPass: otherPass + 1 }); // 타차 통과 무시
          return;
        }
        recordLap(event.tMs, d > SIG_MATCH); // 경계면 의심 랩
      } else {
        recordLap(event.tMs, false); // 수동 모드: 아무 통과나 결승선
      }
    },

    rearm: () => {
      const { _learnTimer } = get();
      if (_learnTimer) clearTimeout(_learnTimer);
      set({ targetSig: null, phase: "armed", lapStart: null, _learnTimer: null });
    },

    reset: () => {
      const { _learnTimer } = get();
      if (_learnTimer) clearTimeout(_learnTimer);
      void clearCurrent();
      set({
        view: "measure",
        phase: "idle",
        startMode: null,
        targetSig: null,
        lapStart: null,
        laps: [],
        otherPass: 0,
        lastLapMs: null,
        elapsedMs: 0,
        startedAt: Date.now(),
        _learnTimer: null,
      });
    },

    tick: () => {
      const { phase, lapStart } = get();
      if (phase === "running" && lapStart) set({ elapsedMs: performance.now() - lapStart.perfMs });
    },

    openResult: () => set({ view: "result" }),
    back: () => set({ view: "measure" }),
  };
});
