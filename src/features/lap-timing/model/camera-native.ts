// R-hybrid-2: 네이티브(HighFpsCamera 플러그인) 캡처 어댑터 — 웹 startCamera와 동일한
// CameraHandle 계약. 네이티브가 240fps 캡처 + 노출/AWB 잠금 + 64×48 다운스케일을 수행하고,
// 이 어댑터는 배치 프레임을 풀어 기존 Worker 엔진에 그대로 흘린다(엔진·상태머신 무수정).
// 프리뷰는 네이티브 레이어(WebView 아래) — video 엘리먼트는 사용하지 않는다.
import { registerPlugin, type PluginListenerHandle } from "@capacitor/core";
import type { EngineRequest, EngineResponse, EngineStats, PassEvent } from "@/shared/lib/laptime-engine/protocol";
import { ROI_W, ROI_H, tuningFromQuery, type CameraHandle } from "./camera";

interface NativeFrame {
  /** 하드웨어 프레젠테이션 타임스탬프(ms) — 웹 R5의 now 대체, 더 정확 */
  t: number;
  /** luma base64 (ROI_W×ROI_H) */
  l: string;
  /** rgb base64 (ROI_W×ROI_H×3) */
  c: string;
}

interface HighFpsCameraPlugin {
  start(options: { fps?: number }): Promise<{ fps: number }>;
  stop(): Promise<void>;
  addListener(event: "frames", cb: (data: { frames: NativeFrame[] }) => void): Promise<PluginListenerHandle>;
}

const HighFpsCamera = registerPlugin<HighFpsCameraPlugin>("HighFpsCamera");

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function startNativeCamera(
  _video: HTMLVideoElement,
  onPass: (e: PassEvent) => void,
  onStats?: (s: EngineStats) => void,
): Promise<CameraHandle> {
  const worker = new Worker(new URL("./engine-worker.ts", import.meta.url), { type: "module" });
  worker.onmessage = (e: MessageEvent<EngineResponse>) => {
    if (e.data.type === "pass") onPass(e.data.event);
    else if (e.data.type === "stats") onStats?.(e.data.stats);
  };
  worker.postMessage({ type: "configure", options: { width: ROI_W, height: ROI_H, ...tuningFromQuery() } } satisfies EngineRequest);

  let stopped = false;
  const listener = await HighFpsCamera.addListener("frames", ({ frames }) => {
    if (stopped) return;
    for (const f of frames) {
      const luma = b64ToBytes(f.l);
      const rgb = b64ToBytes(f.c);
      worker.postMessage({ type: "frame", frame: { tMs: f.t, luma, rgb } } satisfies EngineRequest, [luma.buffer, rgb.buffer]);
    }
  });

  try {
    const { fps } = await HighFpsCamera.start({ fps: 240 });
    return {
      fps,
      resetEngine: () => {
        if (!stopped) worker.postMessage({ type: "reset" } satisfies EngineRequest);
      },
      stop: () => {
        stopped = true;
        void listener.remove();
        void HighFpsCamera.stop();
        worker.terminate();
      },
    };
  } catch (err) {
    void listener.remove();
    worker.terminate();
    throw err;
  }
}
