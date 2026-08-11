import { useEffect } from "react";
import { useLapStore } from "@/features/lap-timing/model/store";
import { MeasureScreen } from "@/features/lap-timing/ui/MeasureScreen";
import { ResultScreen } from "@/features/lap-timing/ui/ResultScreen";
import "@/features/lap-timing/ui/styles.css";

export function App() {
  const view = useLapStore((s) => s.view);
  const hydrate = useLapStore((s) => s.hydrate);
  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  // R14: 기록 화면은 고정 레이아웃(헤더·통계·초기화 고정, 랩 리스트만 내부 스크롤)
  return <div className={`phone${view === "result" ? " fixed-height" : ""}`}>{view === "result" ? <ResultScreen /> : <MeasureScreen />}</div>;
}
