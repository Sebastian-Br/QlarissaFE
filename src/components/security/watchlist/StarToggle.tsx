import { useRef, useState } from "react";
import { Pin, Star } from "lucide-react";
import type { WatchlistMinimal } from "@/models/WatchlistMinimal";
import { IconToggleButton } from "./IconToggleButton";
import { TrackedDurationInput } from "./TrackedDurationInput";
import { trackedDurationHelpText } from "./trackedDurationHelp";

export function StarToggle({
  label,
  size,
  pressed,
  onToggle,
  watchlist,
  disabled,
  saving,
  onSave,
  loadError,
}: {
  label: string;
  size: number;
  pressed: boolean;
  onToggle: () => void;
  watchlist: WatchlistMinimal | undefined;
  disabled: boolean;
  saving: boolean;
  onSave: (watchlist: WatchlistMinimal, changes: Partial<WatchlistMinimal>) => Promise<boolean>;
  loadError: boolean;
}) {
  const durationInputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [isDurationTipOpen, setIsDurationTipOpen] = useState(false);

  const commitName = async (current: WatchlistMinimal, input: HTMLInputElement) => {
    const name = input.value.trim();
    if (!name || name === current.name) {
      input.value = current.name;
      return;
    }
    const saved = await onSave(current, { name });
    if (!saved) input.value = current.name;
  };

  const commitDuration = async (current: WatchlistMinimal, input: HTMLInputElement) => {
    const days = input.valueAsNumber;
    if (!Number.isInteger(days) || days < 1 || days === current.trackedChangeDurationTradingDays) {
      input.value = String(current.trackedChangeDurationTradingDays);
      return;
    }
    const saved = await onSave(current, { trackedChangeDurationTradingDays: days });
    if (!saved) input.value = String(current.trackedChangeDurationTradingDays);
  };

  const blurFocusedField = () => {
    const active = document.activeElement;
    if (active instanceof HTMLInputElement && wrapperRef.current?.contains(active)) active.blur();
  };

  return (
    <div ref={wrapperRef} className="group relative shrink-0" onMouseLeave={blurFocusedField}>
      <IconToggleButton
        label={label}
        pressed={pressed}
        disabled={disabled || !watchlist}
        onClick={onToggle}
      >
        <Star
          size={size}
          fill={pressed ? "currentColor" : "none"}
          strokeWidth={2}
          aria-hidden="true"
        />
      </IconToggleButton>
      {loadError && (
        <div className="absolute left-0 top-full z-20 hidden w-64 max-w-[calc(100vw-2rem)] pt-2 group-hover:block">
          <div className="rounded-xl border border-sky-200/15 bg-slate-900 p-4 text-sm text-slate-400 shadow-xl shadow-slate-950/40">
            Could not load watchlists
          </div>
        </div>
      )}
      {watchlist && (
        <div className="absolute left-0 top-full z-20 hidden w-64 max-w-[calc(100vw-2rem)] pt-2 group-hover:block">
          <div className="rounded-xl border border-sky-200/15 bg-slate-900 p-4 text-sm shadow-xl shadow-slate-950/40">
            <div className="flex items-center gap-3">
              <input
                key={watchlist.name}
                type="text"
                defaultValue={watchlist.name}
                aria-label="Watchlist name"
                disabled={saving}
                onBlur={(event) => commitName(watchlist, event.currentTarget)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") event.currentTarget.blur();
                }}
                className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-1 py-0.5 font-semibold text-white transition-colors duration-200 hover:border-sky-200/15 focus-visible:border-sky-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 disabled:cursor-not-allowed disabled:opacity-50"
              />
              <IconToggleButton
                label={watchlist.isPinned ? "Unpin watchlist" : "Pin watchlist"}
                pressed={watchlist.isPinned}
                disabled={saving}
                onClick={() => onSave(watchlist, { isPinned: !watchlist.isPinned })}
                className="shrink-0"
              >
                <Pin
                  size={16}
                  fill={watchlist.isPinned ? "currentColor" : "none"}
                  aria-hidden="true"
                />
              </IconToggleButton>
            </div>
            <div className="mt-3 flex items-center justify-between gap-3 text-slate-400">
              <span
                onMouseEnter={() => setIsDurationTipOpen(true)}
                onMouseLeave={() => setIsDurationTipOpen(false)}
                className="cursor-help underline decoration-dotted decoration-slate-500 underline-offset-4"
              >
                Tracked change duration (days)
              </span>
              <TrackedDurationInput
                key={watchlist.trackedChangeDurationTradingDays}
                inputRef={durationInputRef}
                defaultValue={watchlist.trackedChangeDurationTradingDays}
                disabled={saving}
                onCommit={(input) => commitDuration(watchlist, input)}
              />
            </div>
          </div>
          {isDurationTipOpen && (
            <div
              role="tooltip"
              className="pointer-events-none absolute left-0 top-full z-30 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-lg border border-sky-200/15 bg-slate-800 px-3 py-2 text-xs leading-relaxed text-slate-100 shadow-xl"
            >
              {trackedDurationHelpText}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
