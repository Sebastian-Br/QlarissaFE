import { LineChart, Settings } from "lucide-react";

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
}) {
  return (
    <div
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
