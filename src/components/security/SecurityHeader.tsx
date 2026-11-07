import { ExternalLink } from "lucide-react";
import type { SecurityWatchlists } from "@/hooks/useSecurityWatchlists";
import { securityTypeNames } from "@/lib/formatting";
import { SecurityType, type Security } from "@/models/Security";
import { BusinessSummary } from "./BusinessSummary";
import { WatchlistControls } from "./watchlist/WatchlistControls";

export function SecurityHeader({
  security,
  watchlists,
}: {
  security: Security;
  watchlists: SecurityWatchlists;
}) {
  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <span className="rounded-lg bg-sky-400/15 px-2.5 py-1 text-xs font-semibold uppercase tracking-wider text-sky-300">
          {securityTypeNames[security.securityType]}
        </span>
        <span className="text-sm text-slate-400">
          {security.exchangeName || security.exchangeShortName || "—"}
        </span>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          {security.name}
        </h1>
        <WatchlistControls state={watchlists} />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        <p className="text-lg text-slate-400">
          {security.symbol} · {security.shortName}
        </p>
        {security.securityType === SecurityType.Stock &&
          security.investorRelationsURL && (
            <a
              href={security.investorRelationsURL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-sky-300 transition-colors hover:text-sky-200"
            >
              Investor relations <ExternalLink size={14} />
            </a>
          )}
      </div>
      {security.securityType === SecurityType.Stock &&
        security.businessSummary && (
          <BusinessSummary summary={security.businessSummary} />
        )}
    </>
  );
}
