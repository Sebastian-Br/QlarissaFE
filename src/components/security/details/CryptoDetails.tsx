import { formatPrice, formatWhenPresent } from "@/lib/formatting";
import type { CryptoCurrency } from "@/models/Security";
import { DetailCard, Metric } from "./DetailCard";

export function CryptoDetails({ crypto }: { crypto: CryptoCurrency }) {
  return (
    <DetailCard title="Cryptocurrency metrics">
      <Metric
        label="Market capitalization"
        value={formatWhenPresent(crypto.marketCapitalization, (marketCap) =>
          formatPrice(marketCap, crypto),
        )}
      />
    </DetailCard>
  );
}
