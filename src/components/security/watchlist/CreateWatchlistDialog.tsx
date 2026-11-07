import { useEffect, useRef, useState, type FormEvent } from "react";
import { Pin } from "lucide-react";
import { addWatchlist } from "@/api/watchlistApi";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { WatchlistMinimal } from "@/models/WatchlistMinimal";
import { IconToggleButton } from "./IconToggleButton";
import { TrackedDurationInput } from "./TrackedDurationInput";
import { trackedDurationHelpText } from "./trackedDurationHelp";

type WatchlistKind = "none" | "primary" | "secondary";

export function CreateWatchlistDialog({
  hasPrimary,
  hasSecondary,
  onClose,
  onCreated,
}: {
  hasPrimary: boolean;
  hasSecondary: boolean;
  onClose: () => void;
  onCreated: (watchlist: WatchlistMinimal) => void;
}) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState<WatchlistKind>("none");
  const [isPinned, setIsPinned] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const durationInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = name.trim();
    const days = durationInputRef.current?.valueAsNumber ?? Number.NaN;
    if (!trimmedName) {
      setError("Enter a name for the watchlist.");
      return;
    }
    if (!Number.isInteger(days) || days < 1) {
      setError("Tracked change duration must be a whole number of at least 1.");
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      const created = await addWatchlist({
        id: 0,
        name: trimmedName,
        isPrimary: kind === "primary",
        isSecondary: kind === "secondary",
        isPinned,
        pinPosition: 0,
        trackedChangeDurationTradingDays: days,
      });
      onCreated(created);
    } catch {
      setError("Unable to create watchlist.");
      setSubmitting(false);
    }
  };

  const kindOptions: {
    value: WatchlistKind;
    label: string;
    disabled: boolean;
    disabledReason: string;
  }[] = [
    { value: "none", label: "Default", disabled: false, disabledReason: "" },
    {
      value: "primary",
      label: "Primary",
      disabled: hasPrimary,
      disabledReason: "A primary watchlist already exists. Only one can exist at a time.",
    },
    {
      value: "secondary",
      label: "Secondary",
      disabled: hasSecondary,
      disabledReason: "A secondary watchlist already exists. Only one can exist at a time.",
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-watchlist-title"
        className="w-full max-w-md rounded-2xl border border-sky-200/15 bg-slate-900 p-6 shadow-2xl shadow-slate-950/60"
      >
        <h2 id="create-watchlist-title" className="text-lg font-semibold text-white">
          Create watchlist
        </h2>
        <form onSubmit={submit} className="mt-5 flex flex-col gap-5">
          <label className="flex flex-col gap-2 text-sm text-slate-400">
            Name
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={submitting}
              autoFocus
              className="rounded-md border border-sky-200/15 bg-slate-950 px-3 py-2 text-white transition-colors hover:border-sky-300/40 focus-visible:border-sky-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </label>

          <fieldset className="flex flex-col gap-2 text-sm text-slate-400">
            <legend className="mb-2">Type</legend>
            <div className="flex flex-wrap gap-2">
              {kindOptions.map((option) => (
                <Tooltip key={option.value}>
                  <TooltipTrigger asChild>
                    <label
                      className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 transition-colors ${
                        option.disabled
                          ? "cursor-not-allowed border-sky-200/10 text-slate-600"
                          : kind === option.value
                            ? "cursor-pointer border-sky-300 bg-sky-400/15 text-sky-200"
                            : "cursor-pointer border-sky-200/15 text-slate-300 hover:border-sky-300/40"
                      }`}
                    >
                      <input
                        type="radio"
                        name="watchlist-kind"
                        value={option.value}
                        checked={kind === option.value}
                        disabled={option.disabled || submitting}
                        onChange={() => setKind(option.value)}
                        className="accent-sky-300"
                      />
                      {option.label}
                    </label>
                  </TooltipTrigger>
                  {option.disabled && (
                    <TooltipContent
                      side="top"
                      className="max-w-64 border border-sky-200/15 bg-slate-800 text-slate-100 shadow-xl"
                    >
                      {option.disabledReason}
                    </TooltipContent>
                  )}
                </Tooltip>
              ))}
            </div>
          </fieldset>

          <div className="flex items-center justify-between gap-3 text-sm text-slate-400">
            <span>Pin to dashboard</span>
            <IconToggleButton
              label="Pin watchlist"
              pressed={isPinned}
              disabled={submitting}
              onClick={() => setIsPinned((pinned) => !pinned)}
            >
              <Pin size={16} fill={isPinned ? "currentColor" : "none"} aria-hidden="true" />
            </IconToggleButton>
          </div>

          <div className="flex items-center justify-between gap-3 text-sm text-slate-400">
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="cursor-help underline decoration-dotted decoration-slate-500 underline-offset-4">
                  Tracked change duration (days)
                </span>
              </TooltipTrigger>
              <TooltipContent
                side="top"
                className="max-w-72 border border-sky-200/15 bg-slate-800 text-slate-100 shadow-xl"
              >
                {trackedDurationHelpText}
              </TooltipContent>
            </Tooltip>
            <TrackedDurationInput
              inputRef={durationInputRef}
              defaultValue={1}
              disabled={submitting}
            />
          </div>

          {error && (
            <p role="alert" className="text-sm text-rose-300">
              {error}
            </p>
          )}

          <div className="mt-1 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-lg border border-sky-200/15 px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:border-sky-300/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-sky-400/20 px-4 py-2 text-sm font-semibold text-sky-200 transition-colors hover:bg-sky-400/30 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? "Creating…" : "Create watchlist"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
