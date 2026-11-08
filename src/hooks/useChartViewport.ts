import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from "react";

export interface ChartViewportControls {
  pan: number;
  setPan: Dispatch<SetStateAction<number>>;
  pointCount: number;
  maxPan: number;
  pointerPositionRef: RefObject<{ x: number; y: number } | null>;
}

export function useChartViewport<T>({
  items,
  chartRef,
}: {
  items: T[];
  chartRef: RefObject<HTMLDivElement | null>;
}): ChartViewportControls & { visibleItems: T[] } {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState(0);
  const pointerPositionRef = useRef<{ x: number; y: number } | null>(null);
  const pointCount = items.length
    ? Math.min(items.length, Math.max(2, Math.ceil(items.length / zoom)))
    : 0;
  const maxPan = Math.max(0, items.length - pointCount);
  const windowStart = Math.max(0, items.length - pointCount - pan);
  const visibleItems = useMemo(
    () => items.slice(windowStart, windowStart + pointCount),
    [items, pointCount, windowStart],
  );

  const handleWheel = useCallback(
    (event: WheelEvent) => {
      event.preventDefault();
      event.stopPropagation();
      if (!items.length) return;
      pointerPositionRef.current = { x: event.clientX, y: event.clientY };
      const factor = event.deltaY > 0 ? 0.75 : 1.33;
      const nextZoom = Math.max(1, Math.min(32, zoom * factor));
      const nextCount = Math.min(
        items.length,
        Math.max(2, Math.ceil(items.length / nextZoom)),
      );
      const box = chartRef.current?.getBoundingClientRect();
      const pointerRatio = box
        ? Math.max(0, Math.min(1, (event.clientX - box.left) / box.width))
        : 0.5;
      const currentIndex =
        windowStart + Math.round(pointerRatio * Math.max(0, pointCount - 1));
      const nextStart = Math.max(
        0,
        Math.min(
          items.length - nextCount,
          Math.round(currentIndex - pointerRatio * (nextCount - 1)),
        ),
      );
      setZoom(nextZoom);
      setPan(items.length - nextCount - nextStart);
    },
    [chartRef, items.length, pointCount, windowStart, zoom],
  );

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    chart.addEventListener("wheel", handleWheel, { passive: false });
    return () => chart.removeEventListener("wheel", handleWheel);
  }, [chartRef, handleWheel]);

  return {
    visibleItems,
    pan,
    setPan,
    pointCount,
    maxPan,
    pointerPositionRef,
  };
}
