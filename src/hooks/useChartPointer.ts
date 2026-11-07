import { useRef, useState, type PointerEvent } from "react";
import type { ChartViewportControls } from "./useChartViewport";

const CLICK_DISTANCE_PX = 5;

export function useChartPointer<H>({
  viewport,
  axisWidth,
  getHover,
  onTap,
}: {
  viewport: ChartViewportControls;
  axisWidth: number;
  getHover: (clientX: number, clientY: number) => H | null;
  onTap?: (hover: H | null) => void;
}) {
  const [hovered, setHovered] = useState<H | null>(null);
  const dragRef = useRef<{ x: number; pan: number } | null>(null);
  const { pointerPositionRef, setPan, pointCount, maxPan, pan } = viewport;

  const updateHover = (event: PointerEvent<HTMLDivElement>) => {
    pointerPositionRef.current = { x: event.clientX, y: event.clientY };
    const next = getHover(event.clientX, event.clientY);
    setHovered(next);
    return next;
  };

  return {
    hovered,
    setHovered,
    pointerHandlers: {
      onPointerLeave: () => {
        pointerPositionRef.current = null;
        setHovered(null);
      },
      onPointerMove: (event: PointerEvent<HTMLDivElement>) => {
        updateHover(event);
        if (!dragRef.current) return;
        const pointDelta = Math.round(
          ((event.clientX - dragRef.current.x) / axisWidth) * (pointCount - 1),
        );
        setPan(
          Math.max(0, Math.min(maxPan, dragRef.current.pan + pointDelta)),
        );
      },
      onPointerDown: (event: PointerEvent<HTMLDivElement>) => {
        event.preventDefault();
        updateHover(event);
        dragRef.current = { x: event.clientX, pan };
        event.currentTarget.setPointerCapture(event.pointerId);
      },
      onPointerUp: (event: PointerEvent<HTMLDivElement>) => {
        event.preventDefault();
        const next = updateHover(event);
        const wasClick =
          dragRef.current &&
          Math.abs(event.clientX - dragRef.current.x) < CLICK_DISTANCE_PX;
        dragRef.current = null;
        if (wasClick) onTap?.(next);
        event.currentTarget.releasePointerCapture(event.pointerId);
      },
    },
  };
}
