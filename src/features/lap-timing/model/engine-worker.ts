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

scope.onmessage = (event) => {
  const msg = event.data;
  switch (msg.type) {
    case "configure":
      engine = createLaptimeEngine(msg.options);
      scope.postMessage({ type: "ready" });
      break;
    case "frame":
      if (engine) {
        for (const ev of engine.process(msg.frame)) scope.postMessage({ type: "pass", event: ev });
      }
      break;
    case "reset":
      engine?.reset();
      break;
  }
};
