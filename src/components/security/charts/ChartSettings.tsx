import type { ReactNode } from "react";
import { LineChart, Settings } from "lucide-react";

export type HoverBehavior = "never" | "always" | "dynamic";

export function HoverBehaviorSelector({
  behavior,
  dynamicRadius,
  onBehaviorChange,
  onDynamicRadiusChange,
}: {
  behavior: HoverBehavior;
  dynamicRadius: number;
  onBehaviorChange: (behavior: HoverBehavior) => void;
  onDynamicRadiusChange: (radius: number) => void;
}) {
  return (
    <div className="grid gap-1.5">
      <div className="text-xs font-medium text-slate-400">Hover behavior</div>
      <div className="grid overflow-hidden rounded-lg border border-sky-200/15 bg-[#061d32]">
        {(["never", "always"] as const).map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={behavior === option}
            onClick={() => onBehaviorChange(option)}
            className={`h-8 text-xs font-semibold capitalize transition-all ${
              behavior === option
                ? "bg-sky-400 text-slate-950"
                : "text-slate-300 hover:bg-sky-400/10 hover:text-sky-200"
            }`}
          >
            {option}
          </button>
        ))}
        <button
          type="button"
          aria-pressed={behavior === "dynamic"}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => onBehaviorChange("dynamic")}
          className={`relative block w-full overflow-hidden text-xs font-semibold transition-[height] duration-300 ease-out motion-reduce:transition-none active:scale-100 ${
            behavior === "dynamic"
              ? "h-14 bg-sky-400 text-slate-950"
              : "h-8 bg-[#061d32] text-slate-300 hover:bg-sky-400/10 hover:text-sky-200"
          }`}
        >
          <span className="absolute left-0 right-0 top-0 z-20 grid h-8 place-items-center text-xs font-semibold">
            Dynamic
          </span>
          {behavior === "dynamic" && (
            <div className="absolute bottom-0 left-2 right-2 top-4 grid content-center text-slate-950">
              <input
                aria-label="Dynamic circle radius"
                type="range"
                min="3"
                max="30"
                step="1"
                value={dynamicRadius}
                onChange={(event) =>
                  onDynamicRadiusChange(Number(event.target.value))
                }
                className="h-2 w-full cursor-pointer accent-[#08243d]"
              />
            </div>
          )}
        </button>
      </div>
    </div>
  );
}

export function ChartSettingsButton({
  label,
  expanded,
  onToggle,
}: {
  label: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-expanded={expanded}
      data-chart-overlay=""
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation();
        onToggle();
      }}
      className="pointer-events-auto absolute right-4 top-4 z-50 grid h-9 w-9 place-items-center rounded-lg border border-sky-200/15 bg-[#08243d]/80 text-slate-400 shadow-sm transition-colors hover:bg-slate-800 hover:text-slate-200 focus-visible:border-sky-400"
    >
      <Settings size={17} />
    </button>
  );
}

export interface ChartSettingsLabels {
  startDate: string;
  endDate: string;
  cardDistance: string;
  logScale: string;
}

export function ChartSettingsPanel({
  labels,
  startDate,
  endDate,
  minDate,
  maxDate,
  cardDistance,
  logScale,
  onStartDateChange,
  onEndDateChange,
  onCardDistanceChange,
  onLogScaleToggle,
  children,
}: {
  labels: ChartSettingsLabels;
  startDate: string;
  endDate: string;
  minDate: string | undefined;
  maxDate: string | undefined;
  cardDistance: number;
  logScale: boolean;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  onCardDistanceChange: (value: number) => void;
  onLogScaleToggle: () => void;
  children?: ReactNode;
}) {
  return (
    <div
      data-chart-overlay=""
      onPointerDown={(event) => event.stopPropagation()}
      className="absolute right-4 top-14 z-50 grid w-56 gap-3 rounded-xl border border-sky-200/20 bg-[#08243d]/95 p-4 shadow-2xl"
    >
      <label className="grid gap-1 text-xs font-medium text-slate-400">
        Start
        <input
          aria-label={labels.startDate}
          type="date"
          value={startDate}
          min={minDate}
          max={endDate || undefined}
          onChange={(event) => onStartDateChange(event.target.value)}
          className="h-9 rounded-lg border border-sky-200/15 bg-[#061d32] px-2 text-sm text-slate-100 outline-none focus:border-sky-400"
        />
      </label>
      <label className="grid gap-1 text-xs font-medium text-slate-400">
        End
        <input
          aria-label={labels.endDate}
          type="date"
          value={endDate}
          min={startDate || undefined}
          max={maxDate}
          onChange={(event) => onEndDateChange(event.target.value)}
          className="h-9 rounded-lg border border-sky-200/15 bg-[#061d32] px-2 text-sm text-slate-100 outline-none focus:border-sky-400"
        />
      </label>
      <label className="grid gap-1 text-xs font-medium text-slate-400">
        Price card distance ({cardDistance}px)
        <input
          aria-label={labels.cardDistance}
          type="range"
          min="8"
          max="48"
          step="2"
          value={cardDistance}
          onChange={(event) => onCardDistanceChange(Number(event.target.value))}
          className="h-2 cursor-pointer accent-sky-400"
        />
      </label>
      {children}
      <button
        type="button"
        aria-label={labels.logScale}
        aria-pressed={logScale}
        onClick={onLogScaleToggle}
        className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-sky-400 px-3 text-sm font-semibold text-slate-950"
      >
        <LineChart size={15} />
        {logScale ? "Log" : "Linear"}
      </button>
    </div>
  );
}
