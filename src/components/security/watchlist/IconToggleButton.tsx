import type { ReactNode } from "react";

export function IconToggleButton({
  label,
  pressed,
  disabled,
  onClick,
  className = "",
  children,
}: {
  label: string;
  pressed: boolean;
  disabled?: boolean;
  onClick: () => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      className={`${className} rounded-full p-1 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 disabled:cursor-not-allowed disabled:text-slate-700 enabled:hover:scale-110 enabled:hover:drop-shadow-[0_0_6px_rgba(125,211,252,0.7)] ${
        pressed ? "text-sky-300" : "text-slate-500 enabled:hover:text-sky-300"
      }`}
    >
      {children}
    </button>
  );
}
