import { Plus, Star } from "lucide-react";
import type { WatchlistMinimal } from "@/models/WatchlistMinimal";
import { IconToggleButton } from "./IconToggleButton";

export function AddToWatchlistMenu({
  watchlists,
  watchedIds,
  disabled,
  onToggle,
  onCreate,
}: {
  watchlists: WatchlistMinimal[];
  watchedIds: number[];
  disabled: boolean;
  onToggle: (watchlist: WatchlistMinimal) => void;
  onCreate: () => void;
}) {
  const otherWatchlists = watchlists.filter((watchlist) => !watchlist.isPrimary && !watchlist.isSecondary);

  return (
    <div className="group relative shrink-0">
      <button
        type="button"
        aria-label="Add security to another watchlist"
        disabled={disabled}
        className="rounded-full p-1 text-slate-500 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 disabled:cursor-not-allowed disabled:text-slate-700 enabled:hover:scale-110 enabled:hover:text-sky-300"
      >
        <Plus size={20} aria-hidden="true" />
      </button>
      <div className="absolute left-0 top-full z-20 hidden w-64 max-w-[calc(100vw-2rem)] pt-2 group-focus-within:block group-hover:block">
        <div className="rounded-xl border border-sky-200/15 bg-slate-900 p-2 text-sm shadow-xl shadow-slate-950/40">
          {otherWatchlists.length === 0 && (
            <p className="px-2 py-1.5 text-slate-400">No other watchlists</p>
          )}
          {otherWatchlists.map((watchlist) => {
            const pressed = watchedIds.includes(watchlist.id);
            return (
              <div
                key={watchlist.id}
                className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 hover:bg-slate-800/60"
              >
                <span className="truncate font-semibold text-white">{watchlist.name}</span>
                <IconToggleButton
                  label={
                    pressed
                      ? `Remove security from ${watchlist.name}`
                      : `Add security to ${watchlist.name}`
                  }
                  pressed={pressed}
                  disabled={disabled}
                  onClick={() => onToggle(watchlist)}
                  className="shrink-0"
                >
                  <Star size={16} fill={pressed ? "currentColor" : "none"} strokeWidth={2} aria-hidden="true" />
                </IconToggleButton>
              </div>
            );
          })}
          <button
            type="button"
            onClick={onCreate}
            disabled={disabled}
            className="mt-1 w-full rounded-lg border-t border-sky-200/10 px-2 pt-2.5 pb-1.5 text-left font-medium text-sky-300 transition-colors hover:text-sky-200 disabled:cursor-not-allowed disabled:text-slate-700"
          >
            Create watchlist
          </button>
        </div>
      </div>
    </div>
  );
}
