// 분석 Worker 엔트리 — 메인 스레드 캡처 프레임을 받아 엔진을 돌리고 통과 이벤트만 돌려준다
// (REQ: 분석은 Worker에서). 엔진은 순수 모듈이라 이 엔트리는 메시지 배선만.
import { createLaptimeEngine, type LaptimeEngine } from "@/shared/lib/laptime-engine/engine";
import type { EngineRequest, EngineResponse } from "@/shared/lib/laptime-engine/protocol";

// DedicatedWorkerGlobalScope 타입은 DOM lib와 충돌하므로 쓰는 표면만 좁혀 선언.
interface WorkerScope {
  onmessage: ((event: MessageEvent<EngineRequest>) => void) | null;
  postMessage(message: EngineResponse): void;
}
const scope = self as unknown as WorkerScope;

let engine: LaptimeEngine | null = null;
// R2 진단 스탯 — 250ms 간격으로 현재/피크 변화율을 UI에 흘린다 (배치·조명 임계 도달 확인용)
const STATS_INTERVAL_MS = 250;
let statsPeak = 0;
let statsLastSentMs = -Infinity;
let framesTotal = 0;

scope.onmessage = (event) => {
  const msg = event.data;
  switch (msg.type) {
    case "configure":
      engine = createLaptimeEngine(msg.options);
      statsPeak = 0;
      statsLastSentMs = -Infinity;
      framesTotal = 0;
      scope.postMessage({ type: "ready" });
      break;
    case "frame":
      if (engine) {
        framesTotal += 1;
        for (const ev of engine.process(msg.frame)) scope.postMessage({ type: "pass", event: ev });
        statsPeak = Math.max(statsPeak, engine.lastChangeRatio);
        if (msg.frame.tMs - statsLastSentMs >= STATS_INTERVAL_MS) {
          scope.postMessage({
            type: "stats",
            stats: {
              ratio: engine.lastChangeRatio,
              peak: statsPeak,
              threshold: engine.options.occlusionThreshold,
              frames: framesTotal,
            },
          });
          statsPeak = 0;
          statsLastSentMs = msg.frame.tMs;
        }
      }
      break;
    case "reset":
      engine?.reset();
      statsPeak = 0;
      break;
  }
};
