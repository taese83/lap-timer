// 카메라 캡처 → ROI 다운스케일 → Worker 엔진. 타임스탬프는 rVFC mediaTime(정본, 미지원 시 rAF).
// getUserMedia는 secure context(HTTPS/localhost) + 권한 필요 — 실패는 호출자가 처리.
import type { EngineOptions, EngineRequest, EngineResponse, EngineStats, PassEvent } from "@/shared/lib/laptime-engine/protocol";

const ROI_W = 64;
const ROI_H = 48;

export interface CameraHandle {
  stop: () => void;
  /** 실측 캡처 fps(track.getSettings) — 미보고 기기는 null. 30km/h 인식 보장은 60fps 필요(조사 R1). */
  fps: number | null;
  /** R2: 엔진 배경·burst 상태 초기화 — 재무장(learning 진입) 시 호출해 배치된 장면으로 재시드 */
  resetEngine: () => void;
}

/**
 * R2 현장 튜닝 오버라이드(tamiya R53 방식) — 배포 없이 URL 쿼리로 엔진 임계를 조정한다.
 * 예: ?occlusion=0.4&vibration=0.15&delta=40&minGap=500&maxBurst=3000
 * 제품 기본 동작은 쿼리 없는 URL에서 불변. 진단 미터가 threshold를 함께 표시한다.
 */
function tuningFromQuery(): Partial<EngineOptions> {
  const overrides: Partial<EngineOptions> = {};
  const search = globalThis.location?.search;
  if (typeof search !== "string" || search === "") return overrides;
  const params = new URLSearchParams(search);
  const num = (key: string): number | null => {
    const raw = params.get(key);
    if (raw === null) return null;
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
  };
  const occlusion = num("occlusion");
  if (occlusion !== null) overrides.occlusionThreshold = occlusion;
  const vibration = num("vibration");
  if (vibration !== null) overrides.vibrationThreshold = vibration;
  const delta = num("delta");
  if (delta !== null) overrides.pixelDeltaThreshold = delta;
  const minGap = num("minGap");
  if (minGap !== null) overrides.minGapMs = minGap;
  const maxBurst = num("maxBurst");
  if (maxBurst !== null) overrides.maxBurstMs = maxBurst;
  return overrides;
}

type RVFCVideo = HTMLVideoElement & {
  requestVideoFrameCallback?: (cb: (now: number, meta: { mediaTime: number }) => void) => number;
};

export async function startCamera(
  video: HTMLVideoElement,
  onPass: (e: PassEvent) => void,
  onStats?: (s: EngineStats) => void,
): Promise<CameraHandle> {
  const worker = new Worker(new URL("./engine-worker.ts", import.meta.url), { type: "module" });
  worker.onmessage = (e: MessageEvent<EngineResponse>) => {
    if (e.data.type === "pass") onPass(e.data.event);
    else if (e.data.type === "stats") onStats?.(e.data.stats);
  };

  const stream = await navigator.mediaDevices.getUserMedia({
    // 60fps 요청(ideal — 하드 제약 아님): 30km/h 통과 창(~20ms)이 30fps 간격(33ms)보다 짧아
    // 60fps(16.7ms)여야 최소 1프레임이 물리적으로 보장된다. min을 걸면 지원 못 하는 기기에서
    // getUserMedia 자체가 실패하므로 ideal만 쓴다.
    video: { facingMode: "environment", width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 60 } },
    audio: false,
  });
  video.srcObject = stream;
  video.muted = true;
  video.playsInline = true;
  await video.play();
  const reported = stream.getVideoTracks()[0]?.getSettings().frameRate;
  const fps = typeof reported === "number" && Number.isFinite(reported) ? Math.round(reported) : null;

  worker.postMessage({ type: "configure", options: { width: ROI_W, height: ROI_H, ...tuningFromQuery() } } satisfies EngineRequest);

  const canvas = new OffscreenCanvas(ROI_W, ROI_H);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("2D context 생성 실패");
  const n = ROI_W * ROI_H;
  let stopped = false;

  const onFrame = (now: number, meta?: { mediaTime: number }) => {
    if (stopped) return;
    ctx.drawImage(video, 0, 0, ROI_W, ROI_H);
    const img = ctx.getImageData(0, 0, ROI_W, ROI_H).data;
    const luma = new Uint8Array(n);
    const rgb = new Uint8Array(n * 3);
    for (let i = 0; i < n; i++) {
      const r = img[i * 4]!;
      const g = img[i * 4 + 1]!;
      const b = img[i * 4 + 2]!;
      luma[i] = (r * 77 + g * 150 + b * 29) >> 8; // ≈ 0.299R+0.587G+0.114B
      rgb[i * 3] = r;
      rgb[i * 3 + 1] = g;
      rgb[i * 3 + 2] = b;
    }
    const tMs = meta ? meta.mediaTime * 1000 : now;
    worker.postMessage({ type: "frame", frame: { tMs, luma, rgb } } satisfies EngineRequest, [luma.buffer, rgb.buffer]);
    schedule();
  };

  const schedule = () => {
    const v = video as RVFCVideo;
    if (v.requestVideoFrameCallback) v.requestVideoFrameCallback(onFrame);
    else requestAnimationFrame((t) => onFrame(t));
  };
  schedule();

  return {
    fps,
    resetEngine: () => {
      if (!stopped) worker.postMessage({ type: "reset" } satisfies EngineRequest);
    },
    stop: () => {
      stopped = true;
      worker.postMessage({ type: "reset" } satisfies EngineRequest);
      worker.terminate();
      stream.getTracks().forEach((t) => t.stop());
      video.srcObject = null;
    },
  };
}
