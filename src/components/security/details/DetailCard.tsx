import type { ReactNode } from "react";

export function DetailCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-sky-200/15 bg-slate-900/60 p-5 shadow-xl shadow-slate-950/20 backdrop-blur-sm">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-sky-300">
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function Metric({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-slate-700/50 py-2.5 last:border-0">
      <span className="text-sm text-slate-400">{label}</span>
      <span className="text-right text-sm font-medium text-slate-100">
        {value}
      </span>
    </div>
  );
}
