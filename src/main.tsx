import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
// R13: 히어로 숫자 전용 서체 (Space Grotesk Light/Regular — 오프라인 번들, Capacitor 포함)
import "@fontsource/space-grotesk/300.css";
import { App } from "./app/App";
import "./app/theme.css";
import { useLapStore } from "./features/lap-timing/model/store";

// DEV 전용 디버그 훅 — 브라우저 콘솔에서 상태머신 직접 조작(실기기·프리뷰 진단에 반복 사용)
if (import.meta.env.DEV) {
  (window as unknown as Record<string, unknown>).__lap = useLapStore;
}

const root = document.getElementById("root");
if (!root) throw new Error("#root not found");
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
