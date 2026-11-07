import { useEffect, useState } from "react";
import { ArrowLeft, Info, RefreshCw } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { getSecurity, updateSecurity } from "@/api/securityApi";
import { DividendPayoutChart } from "@/components/security/charts/DividendPayoutChart";
import { PriceHistoryChart } from "@/components/security/charts/PriceHistoryChart";
import { TypeSpecificDetails } from "@/components/security/details/TypeSpecificDetails";
import { PriceSummary } from "@/components/security/PriceSummary";
import { SecurityHeader } from "@/components/security/SecurityHeader";
import { UpdatingOverlay } from "@/components/security/UpdatingOverlay";
import { useLivePrices } from "@/hooks/useLivePrices";
import { useSecurityWatchlists } from "@/hooks/useSecurityWatchlists";
import { dateOnlyFromTimestamp } from "@/lib/livePrices";
import {
  SecurityType,
  type DailyPrice,
  type Security,
} from "@/models/Security";

export default function SecurityDetail() {
  const { id } = useParams();
  const securityId = Number(id);
  const [security, setSecurity] = useState<Security | null>(null);
  const [graphHistory, setGraphHistory] = useState<DailyPrice[]>([]);
  const [error, setError] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const watchlists = useSecurityWatchlists(securityId);
  const { livePrice, liveTimestamp, liveUpdatesUnavailable } = useLivePrices({
    security,
    securityId,
    setGraphHistory,
  });

  useEffect(() => {
    if (!Number.isInteger(securityId) || securityId < 1) {
      setError(true);
      return;
    }
    const controller = new AbortController();
    setSecurity(null);
    setGraphHistory([]);
    setError(false);
    getSecurity(securityId, controller.signal)
      .then((loadedSecurity) => {
        setSecurity(loadedSecurity);
        setGraphHistory(loadedSecurity.priceHistory ?? []);
      })
      .catch((cause) => {
        if (!(cause instanceof DOMException && cause.name === "AbortError"))
          setError(true);
      });
    return () => controller.abort();
  }, [securityId]);

  const handleUpdate = async () => {
    if (isUpdating) return;

    setIsUpdating(true);
    setUpdateError(null);
    try {
      await updateSecurity(securityId);
      window.location.reload();
    } catch (cause) {
      setUpdateError(
        cause instanceof Error ? cause.message : "Unable to update security.",
      );
      setIsUpdating(false);
    }
  };

  return (
    <main
      className="min-h-screen bg-[#02182c] text-slate-100"
      aria-busy={isUpdating}
    >
      <div
        className="mx-auto w-full max-w-[1500px] px-5 py-6 sm:px-8 lg:px-12"
        inert={isUpdating || undefined}
      >
        <header className="flex items-center justify-between border-b border-sky-100/10 pb-6">
          <Link
            to="/dashboard"
            className="text-2xl font-bold tracking-tight text-white"
          >
            Qlarissa<span className="text-sky-400">.</span>
          </Link>
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 rounded-xl border border-sky-200/15 px-3 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
          >
            <ArrowLeft size={16} />
            Dashboard
          </Link>
        </header>
        {!security && !error && (
          <div className="grid min-h-[65vh] place-items-center">
            <div className="text-center">
              <RefreshCw
                className="mx-auto animate-spin text-sky-300"
                size={26}
              />
              <p className="mt-4 text-slate-400">Loading security…</p>
            </div>
          </div>
        )}
        {error && (
          <div className="grid min-h-[65vh] place-items-center text-center">
            <div>
              <Info className="mx-auto text-rose-300" size={28} />
              <h1 className="mt-4 text-xl font-semibold text-white">
                Security unavailable
              </h1>
              <p className="mt-2 text-slate-400">
                This security could not be loaded. Please return to the
                dashboard and try again.
              </p>
            </div>
          </div>
        )}
        {security && (
          <div className="py-8">
            {updateError && (
              <div
                role="alert"
                className="mb-6 flex items-start gap-3 rounded-xl border border-rose-300/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-100"
              >
                <Info className="mt-0.5 shrink-0 text-rose-300" size={18} />
                <p>{updateError}</p>
              </div>
            )}
            <section className="flex flex-col justify-between gap-6 rounded-t-2xl rounded-b-none border border-b-0 border-sky-200/15 bg-gradient-to-br from-slate-900/80 to-[#08243d] p-6 shadow-xl shadow-slate-950/20 sm:p-8 lg:flex-row lg:items-start">
              <div className="min-w-0 flex-1">
                <SecurityHeader security={security} watchlists={watchlists} />
              </div>
              <PriceSummary
                security={security}
                livePrice={livePrice}
                liveTimestamp={liveTimestamp}
                liveUpdatesUnavailable={liveUpdatesUnavailable}
                isUpdating={isUpdating}
                onUpdate={handleUpdate}
              />
            </section>
            <PriceHistoryChart
              security={security}
              priceHistory={graphHistory}
              livePriceDate={
                liveTimestamp ? dateOnlyFromTimestamp(liveTimestamp) : null
              }
            />
            {security.securityType === SecurityType.Stock &&
              security.dividendPayouts?.length > 0 && (
                <DividendPayoutChart
                  payouts={security.dividendPayouts}
                  security={security}
                />
              )}
            <div className="mt-6">
              <div className="grid content-start gap-6">
                <TypeSpecificDetails security={security} />
              </div>
            </div>
          </div>
        )}
      </div>
      {isUpdating && <UpdatingOverlay />}
    </main>
  );
}
