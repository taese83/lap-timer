// 측정 화면(첫 화면). 카메라 시작 → 통과 이벤트를 store로. 라이브 타이머 tick. 하단 시작/정지.
import { useEffect, useRef, useState } from "react";
import { useLapStore } from "../model/store";
import { startCamera, type CameraHandle } from "../model/camera";
import { SlideToStart } from "./SlideToStart";
import { fmt, signatureColor } from "./format";
import type { LapPhase } from "@/entities/session/model/types";
import type { EngineStats } from "@/shared/lib/laptime-engine/protocol";

function bannerFor(phase: LapPhase, laps: number): { e: string; m: string; v: "info" | "warning" } {
  switch (phase) {
    case "idle":
      return laps
        ? { e: "대기", m: "다음 랩 — 아래로 밀어서 시작", v: "info" }
        : { e: "준비", m: "밀어서 시작하면 차 첫 통과를 기다립니다", v: "info" };
    case "learning":
      return { e: "LEARNING", m: "배경 학습 중…", v: "info" };
    case "armed":
      return { e: "ARMED", m: "차 첫 통과를 기다립니다", v: "info" };
    case "running":
      return { e: "RUNNING", m: "계측 중 — 복귀 통과 또는 정지", v: "info" };
  }
}

export function MeasureScreen() {
  const s = useLapStore();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [fps, setFps] = useState<number | null>(null);
  const [stats, setStats] = useState<EngineStats | null>(null);
  const handleRef = useRef<CameraHandle | null>(null);

  // R2(사용자): 카메라는 **밀어서 시작한 감지 세션 동안만** 켠다 — 세션마다 워커·엔진·배경이
  // 새로 만들어져 stale 배경 고착(실기기 감지 전멸 원인)이 구조적으로 사라지고, 대기 중 배터리·
  // 권한 노출도 없다. 수동(탭) 계측은 카메라 없이 버튼 정지 전용.
  const detectSession = s.startMode === "detect" && s.phase !== "idle";
  const [camError, setCamError] = useState<string | null>(null);
  useEffect(() => {
    if (!detectSession) return;
    const v = videoRef.current;
    if (!v) return;
    let cancelled = false;
    startCamera(
      v,
      (e) => useLapStore.getState().handlePass(e),
      (st) => setStats(st),
    )
      .then((h) => {
        if (cancelled) {
          h.stop();
          return;
        }
        handleRef.current = h;
        setFps(h.fps);
        // R4: 스트림이 실제로 선 뒤에야 배경 학습 타이머 시작 (카메라 늦게 켜지는 기기 레이스 제거)
        useLapStore.getState().cameraReady();
      })
      .catch((err: unknown) => {
        // R4: 침묵 삼킴 금지 — 실패 사유를 캡션에 그대로 노출해 현장 진단 가능하게
        setCamError(err instanceof Error ? `${err.name}: ${err.message}` : String(err));
      });
    return () => {
      cancelled = true;
      handleRef.current?.stop();
      handleRef.current = null;
      setFps(null);
      setStats(null);
      setCamError(null);
    };
  }, [detectSession]);

  // R2: learning 진입 시 엔진 배경 재시드 — 카메라가 이미 켜져 있는 경로의 안전망(없으면 no-op)
  useEffect(() => {
    if (s.phase === "learning") handleRef.current?.resetEngine();
  }, [s.phase]);

  useEffect(() => {
    if (s.phase !== "running") return;
    let id = 0;
    const loop = () => {
      useLapStore.getState().tick();
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, [s.phase]);

  const running = s.phase === "running";
  const arming = s.phase === "learning" || s.phase === "armed";
  const last = s.laps.at(-1) ?? null;
  const best = s.laps.length ? Math.min(...s.laps.map((l) => l.durationMs)) : null;
  const banner = bannerFor(s.phase, s.laps.length);
  const chipColor = signatureColor(s.targetSig);
  const timerText = running ? fmt(s.elapsedMs) : last ? fmt(last.durationMs) : "00.00";

  return (
    <>
      {/* R7: 카메라 = 전체 배경 — 감지 세션 중에만 보임(스크림이 가독성 확보). 캡처 ROI는
          비디오 원본에서 그리므로 표시 크기와 무관(엔진 영향 없음). */}
      <video ref={videoRef} className={`cam-bg${detectSession && fps !== null ? " on" : ""}`} playsInline muted />
      <div className="cam-scrim" />
      <header className="bar">
        <h1>랩타임</h1>
        {s.laps.length > 0 && (
          <button className="iconbtn" onClick={s.openResult}>
            기록 {s.laps.length} →
          </button>
        )}
      </header>
      <div className="lens-line">
        {!detectSession ? (
          <>◉ 카메라 — 밀어서 시작하면 켜짐</>
        ) : camError !== null ? (
          <span style={{ color: "var(--warning, #f0b429)" }}>⚠ 카메라 실패 · {camError}</span>
        ) : fps === null ? (
          <>◉ 카메라 켜는 중…</>
        ) : (
          <>
            ◉
            {/* 30km/h 인식 보장은 60fps 필요(조사 R1) — 50 미만이면 경고색 */}
            <span style={fps < 50 ? { color: "var(--warning, #f0b429)" } : undefined}> {fps}fps</span>
            {stats !== null && (
              // R2 진단 미터: 피크 변화율(임계 도달 시 라임) + 누적 프레임(0 고착 = 파이프 사망)
              <span style={{ color: stats.peak >= stats.threshold ? "var(--lime, #a3e635)" : undefined }}>
                {" "}· 피크 {Math.round(stats.peak * 100)}%/{Math.round(stats.threshold * 100)}% · f{stats.frames}
              </span>
            )}
          </>
        )}
      </div>
      <div className={`banner ${banner.v}`}>
        <span className="eyebrow">{banner.e}</span>
        <span>{s.phase === "learning" && fps === null && camError === null ? "카메라 켜는 중…" : banner.m}</span>
        {s.lastEvent !== null && (
          // R4 판정 로그 — 마지막 통과에 대한 결정(출발/정지/타차/디바운스)을 그대로 노출
          <span className="caption" style={{ display: "block", opacity: 0.85 }}>
            {s.lastEvent}
          </span>
        )}
      </div>
      <div className="timer-wrap">
        <div className="overline">{running ? "현재 랩" : last ? "직전 랩" : "랩타임"}</div>
        <div className={`timer tnum${running ? "" : " frozen"}`}>{timerText}</div>
        <div className="chip-wrap">
          {chipColor ? (
            <button className="chip" style={{ background: chipColor }} onClick={s.rearm} title="새 타깃" aria-label="새 타깃으로 재무장" />
          ) : (
            <span className="caption">&nbsp;</span>
          )}
        </div>
      </div>
      <div className="statrow">
        <div className="stat">
          <div className="overline">직전</div>
          <div className="v tnum">{last ? fmt(last.durationMs) : "—"}</div>
        </div>
        <div className="stat">
          <div className="overline">Best</div>
          <div className="v tnum">{best != null ? fmt(best) : "—"}</div>
        </div>
        <div className="stat">
          <div className="overline">랩</div>
          <div className="v tnum">{s.laps.length}</div>
        </div>
      </div>
      <div className="grow" />
      <div className="bottom-cta">
        {running || arming ? (
          <button className="btn-primary btn-stop" onClick={s.stopByButton}>
            정지
          </button>
        ) : (
          <SlideToStart onTap={s.startManual} onSlide={s.startDetect} />
        )}
      </div>
    </>
  );
}
