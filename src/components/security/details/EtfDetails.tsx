import {
  formatDate,
  formatPrice,
  formatWhenPresent,
  numberFormatter,
} from "@/lib/formatting";
import type { ETF } from "@/models/Security";
import { DetailCard, Metric } from "./DetailCard";
import { DetailList, SplitsCard } from "./DetailList";

export function EtfDetails({ etf }: { etf: ETF }) {
  return (
    <>
      <DetailCard title="ETF metrics">
        <Metric label="ISIN" value={etf.isin || "—"} />
        <Metric
          label="Net expense ratio"
          value={formatWhenPresent(
            etf.netExpenseRatio,
            (ratio) => `${numberFormatter.format(ratio)}%`,
          )}
        />
        <Metric
          label="Dividend yield"
          value={formatWhenPresent(
            etf.dividendYield,
            (yieldValue) => `${numberFormatter.format(yieldValue)}%`,
          )}
        />
      </DetailCard>
      <DetailList
        title="Distribution events"
        items={etf.distributionEvents?.map((event) => ({
          id: event.id,
          label: formatDate(event.payoutDate),
          value: formatPrice(event.payoutAmount, etf),
        }))}
        valueClassName="text-emerald-300"
      />
      <SplitsCard splits={etf.splits} />
    </>
  );
}
