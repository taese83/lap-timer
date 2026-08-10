// 하단 단일 컨트롤: 탭 = 수동 시작 / 밀기 = 인식 시작 (confirmed-design.md).
import { useRef, type PointerEvent as ReactPointerEvent } from "react";

interface Props {
  onTap: () => void;
  onSlide: () => void;
}

export function SlideToStart({ onTap, onSlide }: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const fillRef = useRef<HTMLDivElement>(null);
  const drag = useRef({ active: false, base: 0, x: 0, moved: 0 });

  const max = () => {
    const t = trackRef.current;
    const th = thumbRef.current;
    return t && th ? t.clientWidth - th.clientWidth - 8 : 0;
  };
  const setX = (v: number) => {
    const th = thumbRef.current;
    const f = fillRef.current;
    const x = Math.max(0, Math.min(max(), v));
    drag.current.x = x;
    if (th) th.style.transform = `translateX(${x}px)`;
    if (f && th) f.style.width = `${x + th.clientWidth + 4}px`;
  };

  const down = (e: ReactPointerEvent) => {
    drag.current = { active: true, base: e.clientX - drag.current.x, x: drag.current.x, moved: 0 };
    if (thumbRef.current) thumbRef.current.style.transition = "";
    trackRef.current?.setPointerCapture(e.pointerId);
  };
  const move = (e: ReactPointerEvent) => {
    if (!drag.current.active) return;
    const nx = e.clientX - drag.current.base;
    drag.current.moved = Math.max(drag.current.moved, Math.abs(nx - drag.current.x));
    setX(nx);
  };
  const up = () => {
    if (!drag.current.active) return;
    drag.current.active = false;
    if (drag.current.x >= max() * 0.85) onSlide();
    else if (drag.current.moved < 8) onTap();
    else {
      const th = thumbRef.current;
      if (th) th.style.transition = "transform .16s";
      setX(0);
    }
  };

  return (
    <div
      className="slider"
      ref={trackRef}
      role="button"
      aria-label="탭하면 수동 시작, 밀면 인식 시작"
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
    >
      <div className="slider-fill" ref={fillRef} />
      <span className="slider-label">
        <span className="slider-hint">밀어서 인식 시작 →</span>
      </span>
      <div className="slider-thumb" ref={thumbRef}>
        시작
      </div>
    </div>
  );
}
