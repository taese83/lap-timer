import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// react-vite-spa · 클라이언트 온리(서버 없음). 분석은 전용 Worker에서(AD-11 계열).
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": new URL("./src", import.meta.url).pathname },
  },
  server: { host: "127.0.0.1", port: 8080 },
  preview: { host: "127.0.0.1", port: 4173, strictPort: true },
  worker: { format: "es" },
});
