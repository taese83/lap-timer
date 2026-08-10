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

  return <div className="phone">{view === "result" ? <ResultScreen /> : <MeasureScreen />}</div>;
}
