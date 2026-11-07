import {
  SecurityType,
  type CryptoCurrency,
  type CurrencyPair,
  type ETF,
  type Security,
  type Stock,
} from "@/models/Security";
import { CryptoDetails } from "./CryptoDetails";
import { CurrencyPairDetails } from "./CurrencyPairDetails";
import { EtfDetails } from "./EtfDetails";
import { StockDetails } from "./StockDetails";

export function TypeSpecificDetails({ security }: { security: Security }) {
  if (security.securityType === SecurityType.Stock)
    return <StockDetails stock={security as Stock} />;
  if (security.securityType === SecurityType.ETF)
    return <EtfDetails etf={security as ETF} />;
  if (security.securityType === SecurityType.Cryptocurrency)
    return <CryptoDetails crypto={security as CryptoCurrency} />;
  return <CurrencyPairDetails pair={security as CurrencyPair} />;
}
