import type { CapacitorConfig } from "@capacitor/cli";

// 하이브리드 셸(R-hybrid-1) — 웹앱(dist)을 WebView에 담는다. 웹 배포(Vercel)와 공존.
const config: CapacitorConfig = {
  appId: "dev.taese83.laptime",
  appName: "랩타임",
  webDir: "dist",
  ios: {
    // 카메라 스트림·미터 UI가 상태바 영역까지 쓰므로 풀스크린 WebView
    contentInset: "never",
  },
};

export default config;
