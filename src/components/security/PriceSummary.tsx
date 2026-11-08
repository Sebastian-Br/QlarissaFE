import { RefreshCw } from "lucide-react";
import { formatDateTime, formatPrice } from "@/lib/formatting";
import type { Security } from "@/models/Security";

export function PriceSummary({
  security,
  livePrice,
  liveTimestamp,
  liveUpdatesUnavailable,
  isUpdating,
  onUpdate,
}: {
  security: Security;
  livePrice: number | null;
  liveTimestamp: string | null;
  liveUpdatesUnavailable: boolean;
  isUpdating: boolean;
  onUpdate: () => void;
}) {
  return (
    <div className="lg:text-right">
      <p className="text-3xl font-semibold text-white">
        {formatPrice(livePrice ?? security.price, security)}
      </p>
      {liveUpdatesUnavailable && (
        <p className="mt-1 text-xs text-slate-500">
          Live price updates are currently unavailable.
        </p>
      )}
      <p className="mt-2 text-xs text-slate-500">
        Updated {formatDateTime(liveTimestamp ?? security.priceLastUpdatedTime)}
      </p>
      <button
        type="button"
        onClick={onUpdate}
        disabled={isUpdating}
        className="mt-5 inline-flex items-center gap-2 rounded-xl border border-sky-300/35 bg-sky-400/10 px-4 py-2 text-sm font-semibold text-sky-100 shadow-sm transition-colors hover:bg-sky-400/20 hover:shadow-[0_0_14px_rgba(56,189,248,0.25)] focus-visible:border-sky-300 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <RefreshCw size={16} />
        Update
      </button>
    </div>
  );
}
