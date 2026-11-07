import type { CurrencyPair } from "@/models/Security";
import { DetailCard, Metric } from "./DetailCard";

export function CurrencyPairDetails({ pair }: { pair: CurrencyPair }) {
  return (
    <DetailCard title="Currency pair">
      <Metric label="Base currency" value={pair.symbol} />
      <Metric label="Quote currency" value={pair.currency?.symbol ?? "—"} />
    </DetailCard>
  );
}
