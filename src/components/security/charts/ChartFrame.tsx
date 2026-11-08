import type { PointerEventHandler, ReactNode, RefObject } from "react";
import { PLOT } from "@/lib/chart/plot";

export interface ChartPointerHandlers {
  onPointerLeave: () => void;
  onPointerMove: PointerEventHandler<HTMLDivElement>;
  onPointerDown: PointerEventHandler<HTMLDivElement>;
  onPointerUp: PointerEventHandler<HTMLDivElement>;
}

export function ChartSurface({
  chartRef,
  handlers,
  children,
}: {
  chartRef: RefObject<HTMLDivElement | null>;
  handlers: ChartPointerHandlers;
  children: ReactNode;
}) {
  return (
    <div
      ref={chartRef}
      className="relative h-[clamp(20rem,55vw,33.75rem)] cursor-default touch-none select-none rounded-xl border border-sky-200/10 bg-[#061d32] p-3"
      {...handlers}
    >
      {children}
    </div>
  );
}

export function ChartGridLines({
  yTicks,
}: {
  yTicks: { ratio: number; position: number }[];
}) {
  return (
    <>
      {yTicks.map(({ ratio, position }) => (
        <line
          key={ratio}
          x1={PLOT.left}
          x2={PLOT.right}
          y1={position}
          y2={position}
          stroke="#7dd3fc"
          strokeOpacity="0.12"
          strokeDasharray="1.5 2"
          vectorEffect="non-scaling-stroke"
        />
      ))}
      <line
        x1={PLOT.left}
        x2={PLOT.right}
        y1={PLOT.bottom}
        y2={PLOT.bottom}
        stroke="#7dd3fc"
        strokeOpacity="0.35"
        strokeWidth="0.4"
        vectorEffect="non-scaling-stroke"
      />
      <line
        x1={PLOT.left}
        x2={PLOT.left}
        y1={PLOT.top}
        y2={PLOT.bottom}
        stroke="#7dd3fc"
        strokeOpacity="0.35"
        strokeWidth="0.4"
        vectorEffect="non-scaling-stroke"
      />
    </>
  );
}

export function ChartTimeTicks({
  yearTicks,
  tickLabels,
}: {
  yearTicks: { year: number; position: number }[];
  tickLabels: { date: string; position: number }[];
}) {
  return (
    <>
      {yearTicks.map((tick) => (
        <line
          key={`year-${tick.year}`}
          x1={tick.position}
          x2={tick.position}
          y1={PLOT.bottom}
          y2={PLOT.bottom + 3}
          stroke="#7dd3fc"
          strokeOpacity="0.5"
          strokeWidth="0.4"
          vectorEffect="non-scaling-stroke"
        />
      ))}
      {tickLabels.map((tick) => (
        <line
          key={`period-${tick.date}`}
          x1={tick.position}
          x2={tick.position}
          y1={PLOT.bottom}
          y2={PLOT.bottom + 2}
          stroke="#7dd3fc"
          strokeOpacity="0.35"
          strokeWidth="0.35"
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </>
  );
}

export function ChartAxisLabels({
  yTicks,
  yearTicks,
  tickLabels,
}: {
  yTicks: { ratio: number; label: string; position: number }[];
  yearTicks: { year: number; position: number }[];
  tickLabels: { date: string; label: string; position: number }[];
}) {
  return (
    <>
      <div className="pointer-events-none absolute inset-y-3 left-1 w-[5%] text-right text-slate-400">
        {yTicks.map(({ label, ratio, position }) => (
          <span
            key={ratio}
            className="absolute right-0 -translate-y-1/2 text-xs font-medium"
            style={{ top: `${position}%` }}
          >
            {label}
          </span>
        ))}
      </div>
      <div className="pointer-events-none absolute bottom-[8%] left-[6%] right-[3%] text-[10px] text-slate-500">
        {yearTicks.map((tick) => (
          <span
            key={tick.year}
            className="absolute -translate-x-1/2 text-center text-xs font-medium text-slate-400"
            style={{ left: `${((tick.position - PLOT.left) / PLOT.width) * 100}%` }}
          >
            {tick.year}
          </span>
        ))}
        {tickLabels.map((tick) => (
          <span
            key={tick.date}
            className="absolute -translate-x-1/2 whitespace-nowrap text-center"
            style={{ left: `${((tick.position - PLOT.left) / PLOT.width) * 100}%` }}
          >
            {tick.label}
          </span>
        ))}
      </div>
    </>
  );
}
