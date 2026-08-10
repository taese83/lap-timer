// 카메라 캡처 → ROI 다운스케일 → Worker 엔진. 타임스탬프는 rVFC/rAF 콜백 시각(now) — R5:
// getUserMedia 스트림의 mediaTime은 iOS에서 벽시계처럼 전진하지 않아 정본으로 쓰지 않는다.
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
  const softOcclusion = num("soft");
  if (softOcclusion !== null) overrides.softOcclusionThreshold = softOcclusion;
  const vibration = num("vibration");
  if (vibration !== null) overrides.vibrationThreshold = vibration;
  const delta = num("delta");
  if (delta !== null) overrides.pixelDeltaThreshold = delta;
  const chromaDelta = num("chromaDelta");
  if (chromaDelta !== null) overrides.chromaDeltaThreshold = chromaDelta;
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
    // R6: 120fps 요청(ideal — 하드 제약 아님, 미지원 기기는 60/30으로 자동 하향). 30km/h 통과
    // 창(~20ms)에 60fps는 1~2프레임, 120fps는 2~4프레임 — 피크 포착·타이밍(±4ms)·물리 보장
    // 상한(35→70km/h)이 개선된다. 실효 콜백 수는 디스플레이 주사율에도 묶이므로(ProMotion
    // 120Hz에서 최대 효과) 캡션의 실측 fps로 확인한다.
    video: { facingMode: "environment", width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 120 } },
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

  const onFrame = (now: number) => {
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
    // R5(실기기 iOS 확정): getUserMedia 스트림에서 rVFC meta.mediaTime이 벽시계처럼 전진하지
    // 않는다(f1 고정 실측 — 프레임은 흐르는데 스탯·minGap·maxBurst의 시간 게이트가 전부 동결).
    // 첫 통과만 성공(-∞ 기준)하고 이후 통과가 영구 디바운스되던 "정지 안 됨"의 근본 원인.
    // 콜백 시각 now(DOMHighResTimeStamp, vsync 정렬 — 60fps에서 ±8ms)를 정본으로 쓴다.
    const tMs = now;
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
