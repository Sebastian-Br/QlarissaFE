import {
  compactFormatter,
  formatDateTime,
  formatPrice,
  formatWhenPresent,
  numberFormatter,
} from "@/lib/formatting";
import type { Stock } from "@/models/Security";
import { DetailCard, Metric } from "./DetailCard";
import { SplitsCard } from "./DetailList";

export function StockDetails({ stock }: { stock: Stock }) {
  return (
    <>
      <DetailCard title="Stock metrics">
        <Metric label="ISIN" value={stock.isin || "—"} />
        <Metric
          label="Shares outstanding"
          value={formatWhenPresent(stock.sharesOutstanding, (shares) =>
            compactFormatter.format(shares),
          )}
        />
        <Metric
          label="Dividend rate"
          value={formatWhenPresent(stock.dividendRate, (rate) =>
            formatPrice(rate, stock),
          )}
        />
        <Metric
          label="Target mean price"
          value={formatWhenPresent(stock.targetMeanPrice, (price) =>
            formatPrice(price, stock),
          )}
        />
        <Metric
          label="Recommendation mean"
          value={formatWhenPresent(stock.recommendationMean, (mean) =>
            numberFormatter.format(mean),
          )}
        />
        <Metric
          label="Data last updated"
          value={
            <span title="All timestamps are UTC">
              {formatDateTime(stock.lastCompleteUpdateTime)}
            </span>
          }
        />
      </DetailCard>
      <SplitsCard splits={stock.splits} />
    </>
  );
}
