// 측정 화면(첫 화면). 카메라 시작 → 통과 이벤트를 store로. 라이브 타이머 tick. 하단 시작/정지.
import { useEffect, useRef, useState } from "react";
import { useLapStore } from "../model/store";
import { startCamera, type CameraHandle } from "../model/camera";
import { SlideToStart } from "./SlideToStart";
import { fmt, signatureColor } from "./format";
import type { LapPhase } from "@/entities/session/model/types";

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

  useEffect(() => {
    let handle: CameraHandle | null = null;
    const v = videoRef.current;
    if (v) {
      startCamera(v, (e) => useLapStore.getState().handlePass(e))
        .then((h) => {
          handle = h;
          setFps(h.fps);
        })
        .catch(() => {
          /* 카메라 불가(권한/비-secure) — 수동 계측은 여전히 가능 */
        });
    }
    return () => handle?.stop();
  }, []);

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
      <header className="bar">
        <h1>랩타임</h1>
        {s.laps.length > 0 && (
          <button className="iconbtn" onClick={s.openResult}>
            기록 {s.laps.length} →
          </button>
        )}
      </header>
      <div className="preview-strip">
        <video ref={videoRef} className="preview-video" playsInline muted />
        <span className="lens">
          ◉ 카메라 게이트 (레인 내려봄)
          {fps !== null && (
            // 30km/h 인식 보장은 60fps 필요(조사 R1) — 50 미만이면 경고색
            <span style={fps < 50 ? { color: "var(--warning, #f0b429)" } : undefined}> · {fps}fps</span>
          )}
        </span>
      </div>
      <div className={`banner ${banner.v}`}>
        <span className="eyebrow">{banner.e}</span>
        <span>{banner.m}</span>
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
