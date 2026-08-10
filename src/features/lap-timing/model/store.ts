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
 * 색 시그니처 매칭 임계(L1 거리). 합성 검증: 동일 색 ≈0, 상이 색 ≈2.0.
 *  d ≤ MATCH: 타깃 / MATCH<d≤BORDER: 경계(의심 랩) / d>BORDER: 타차(무시).
 *
 * R3 실기기(2026-08-10): BORDER 1.0 → 1.5 — 실속 모션 블러·자동노출 변화로 같은 차의
 * 통과 간 거리가 1.0을 넘어 복귀 통과가 "타차"로 버려짐(정지 안 됨의 직접 원인). 뚜렷이
 * 다른 색(빨강↔초록)은 L1 ≈ 1.8~2.0이라 1.5로도 구분 유지. 경계 구간은 의심 랩 라벨이
 * 오값 위험을 알린다. 현장 재조정: ?match=&border= URL 오버라이드.
 */
const SIG_MATCH = 0.7;
const SIG_BORDER = 1.5;
/** R3 현장 튜닝 — 배포 없이 매칭 임계 조정(camera.ts 엔진 오버라이드와 같은 패턴). */
function sigThresholds(): { match: number; border: number } {
  const search = globalThis.location?.search;
  const defaults = { match: SIG_MATCH, border: SIG_BORDER };
  if (typeof search !== "string" || search === "") return defaults;
  const params = new URLSearchParams(search);
  const num = (key: string, fallback: number): number => {
    const raw = params.get(key);
    if (raw === null) return fallback;
    const value = Number(raw);
    return Number.isFinite(value) ? value : fallback;
  };
  return { match: num("match", SIG_MATCH), border: num("border", SIG_BORDER) };
}

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
  /** R4 판정 로그(현장 진단) — 마지막 통과 이벤트에 대한 상태머신의 결정 1줄 */
  lastEvent: string | null;
  _learnTimer: ReturnType<typeof setTimeout> | null;
  /**
   * R10(사용자 확정 흐름) — 보류된 의심 통과. 의심(MATCH<d≤BORDER)이 오면 **시각만 기록하고
   * 타이머는 계속** 진행한다. 이후 확정 매치(d≤MATCH)가 오면 그것으로 정지하며 의심 기록은
   * 삭제, 확정 없이 버튼으로 정지하면 이 의심 시각을 랩타임으로 기재하고 의심 표시한다.
   * 최초 의심을 유지(뒤따르는 의심은 교체하지 않음 — 먼저 통과한 쪽이 결승 후보).
   */
  _pendingSuspect: { tMs: number; d: number } | null;

  hydrate: () => Promise<void>;
  startManual: () => void;
  startDetect: () => void;
  /** R4: 카메라 스트림 준비 완료 신호 — 이때부터 배경 학습(LEARN_MS)을 시작한다.
   *  종전에는 슬라이드 즉시 타이머가 돌아, 카메라가 늦게 켜지는 기기에서 스트림도 없는데
   *  armed로 넘어가고 첫 프레임(=배경 시드)이 주행 중인 차 위에서 찍히는 레이스가 있었다. */
  cameraReady: () => void;
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
  /** R10: 보류 의심 해제 — 정지(확정/버튼)·세션 이탈 모든 경로에서 호출 */
  function clearSuspect(): void {
    if (get()._pendingSuspect !== null) set({ _pendingSuspect: null });
  }

  function recordLap(stopEngineMs: number | null, suspect: boolean): void {
    clearSuspect();
    const { lapStart, laps, startedAt, otherPass } = get();
    if (!lapStart) return;
    const dur =
      lapStart.engineMs != null && stopEngineMs != null
        ? stopEngineMs - lapStart.engineMs
        : performance.now() - lapStart.perfMs;
    if (dur < MIN_LAP_MS) {
      set({ lastEvent: `통과 ${Math.round(dur)}ms — 랩 하한(${MIN_LAP_MS}ms) 미만 무시` });
      return; // 디바운스
    }
    const nextLaps = [...laps, { n: laps.length + 1, durationMs: dur, suspect }];
    set({
      laps: nextLaps,
      phase: "idle",
      lapStart: null,
      lastLapMs: dur,
      elapsedMs: dur,
      lastEvent: `정지 — 랩 ${(dur / 1000).toFixed(2)}s${suspect ? " (의심)" : ""}`,
    });
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
    lastEvent: null,
    _learnTimer: null,
    _pendingSuspect: null,

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
      // R3: 세션마다 타깃 재등록 — 카메라가 세션 단위로 새로 켜져(R2) 조명·노출이 달라지므로,
      // 이전 세션의 낡은 시그니처와 매칭을 강요하면 첫 통과가 "타차"로 거부돼 시작 자체가 안
      // 된다(실기기 증상). 세션 간 정체성은 "사용자가 자기 차를 먼저 출발시킨다"는 운영 규칙이
      // 담당하고, 시그니처 매칭은 **주행 중 타차 통과 무시**(1-vs-rest 본연의 역할)에 쓴다.
      // R4: LEARN 타이머는 여기서 돌리지 않는다 — cameraReady()가 스트림 확인 후 시작.
      set({ startMode: "detect", phase: "learning", _learnTimer: null, targetSig: null, lastEvent: null });
    },

    cameraReady: () => {
      const { phase, _learnTimer } = get();
      if (phase !== "learning" || _learnTimer !== null) return;
      const t = setTimeout(() => {
        if (get().phase === "learning") set({ phase: "armed", _learnTimer: null });
      }, LEARN_MS);
      set({ _learnTimer: t });
    },

    cancel: () => {
      clearSuspect();
      const { _learnTimer } = get();
      if (_learnTimer) clearTimeout(_learnTimer);
      set({ phase: "idle", lapStart: null, _learnTimer: null });
    },

    stopByButton: () => {
      const { phase, _pendingSuspect } = get();
      if (phase === "running") {
        // R10: 보류된 의심이 있으면 그 통과 시각으로 의심 랩 기재 — "확정 없이 정지하면
        // 의심 판단 정보를 그대로 랩타임에 기재"(사용자 확정). 의심이 랩 하한 미만이라
        // 기록되지 못하면 버튼 정지 본연의 동작(현재 시각)으로 마감한다.
        if (_pendingSuspect !== null) {
          recordLap(_pendingSuspect.tMs, true);
          if (get().phase === "running") recordLap(null, false);
        } else {
          recordLap(null, false);
        }
      } else if (phase === "learning" || phase === "armed") {
        get().cancel();
      }
    },

    handlePass: (event) => {
      const { phase, startMode, targetSig, otherPass } = get();
      if (phase === "idle" || phase === "learning") return;

      if (phase === "armed") {
        if (targetSig === null) {
          // 최초 통과 = 자동 타깃 등록 (세션마다, R3)
          set({ targetSig: event.signature ?? [], lastEvent: "출발 — 타깃 등록" });
        } else if (event.signature) {
          const d = signatureDistance(event.signature, targetSig);
          if (d > sigThresholds().border) {
            set({ otherPass: otherPass + 1, lastEvent: `대기 중 타차 d=${d.toFixed(2)} — 출발 아님` });
            return;
          }
          set({ lastEvent: `출발 d=${d.toFixed(2)}` });
        }
        set({ phase: "running", lapStart: { perfMs: performance.now(), engineMs: event.tMs }, elapsedMs: 0 });
        return;
      }

      // running → 정지 판정
      if (startMode === "detect") {
        const { match, border } = sigThresholds();
        const d = event.signature && targetSig ? signatureDistance(event.signature, targetSig) : 0;
        if (d > border) {
          set({ otherPass: otherPass + 1, lastEvent: `타차 통과 d=${d.toFixed(2)} 무시 (임계 ${border})` });
          return;
        }
        if (d <= match) {
          recordLap(event.tMs, false); // 확정 매치 — 즉시 정지, 보류 의심은 recordLap이 삭제
          return;
        }
        // R10(사용자 확정 흐름): 의심은 시각만 보류하고 타이머는 계속 — _pendingSuspect 주석 참조
        const pending = get()._pendingSuspect;
        if (pending === null) {
          set({
            _pendingSuspect: { tMs: event.tMs, d },
            lastEvent: `의심 통과 d=${d.toFixed(2)} 기록 — 계측 계속 (확정 시 대체, 정지 시 의심 랩)`,
          });
        } else {
          set({ lastEvent: `의심 통과 d=${d.toFixed(2)} — 최초 의심(${(pending.tMs / 1000).toFixed(2)}s) 유지` });
        }
      } else {
        recordLap(event.tMs, false); // 수동 모드: 아무 통과나 결승선
      }
    },

    rearm: () => {
      clearSuspect();
      const { _learnTimer } = get();
      if (_learnTimer) clearTimeout(_learnTimer);
      set({ targetSig: null, phase: "armed", lapStart: null, _learnTimer: null });
    },

    reset: () => {
      clearSuspect();
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
