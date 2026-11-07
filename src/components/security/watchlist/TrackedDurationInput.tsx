const durationSteps = [
  { delta: 1, label: "Increase tracked change duration", points: "0,6 10,6 5,0" },
  { delta: -1, label: "Decrease tracked change duration", points: "0,0 10,0 5,6" },
];

export function TrackedDurationInput({
  inputRef,
  defaultValue,
  disabled,
  onCommit,
}: {
  inputRef: { current: HTMLInputElement | null };
  defaultValue: number;
  disabled: boolean;
  onCommit?: (input: HTMLInputElement) => void;
}) {
  const step = (delta: number) => {
    const input = inputRef.current;
    if (!input) return;
    const current = Number.isInteger(input.valueAsNumber) ? input.valueAsNumber : 0;
    input.value = String(Math.max(1, current + delta));
    input.focus();
  };

  return (
    <div className="flex items-center gap-1">
      <input
        ref={inputRef}
        type="number"
        min={1}
        step={1}
        defaultValue={defaultValue}
        aria-label="Tracked change duration (days)"
        disabled={disabled}
        onBlur={(event) => onCommit?.(event.currentTarget)}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
        }}
        className="w-16 rounded-md border border-sky-200/15 bg-slate-950 px-2 py-1 text-right font-medium text-white transition-colors duration-200 [appearance:textfield] hover:border-sky-300/40 focus-visible:border-sky-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 disabled:cursor-not-allowed disabled:opacity-50 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      <div className="flex flex-col">
        {durationSteps.map(({ delta, label, points }) => (
          <button
            key={delta}
            type="button"
            aria-label={label}
            disabled={disabled}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => step(delta)}
            className="flex h-3.5 w-5 items-center justify-center rounded-sm text-slate-500 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 enabled:hover:text-sky-300 disabled:cursor-not-allowed disabled:text-slate-700"
          >
            <svg width="10" height="6" viewBox="0 0 10 6" aria-hidden="true">
              <polygon points={points} fill="currentColor" />
            </svg>
          </button>
        ))}
      </div>
    </div>
  );
}
