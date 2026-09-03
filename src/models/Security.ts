import type { Currency } from "./Currency";

export const SecurityType = {
  Stock: 1,
  ETF: 2,
  Cryptocurrency: 3,
  CurrencyPair: 4,
} as const;

export type SecurityType = typeof SecurityType[keyof typeof SecurityType];

export interface SecurityBase {
  id: number;
  name: string;
  shortName: string;
  currency: Currency;
  securityType: SecurityType;
}

export interface DailyPrice {
  id: number;
  open: number;
  close: number;
  high: number;
  low: number;
  average: number;
  date: string;
}

export interface DividendPayout {
  id: number;
  payoutDate: string;
  payoutAmount: number;
}

export interface Split {
  id: number;
  date: string;
  splitRatio: number;
}

export interface PubliclyTradedSecurityBase extends SecurityBase {
  exchangeName: string;
  exchangeShortName: string;
  symbol: string;
  priceHistory: DailyPrice[];
  price: number;
  priceLastUpdatedTime: string;
  lastCompleteUpdateTime: string;
}

export interface Stock extends PubliclyTradedSecurityBase {
  securityType: typeof SecurityType.Stock;
  isin: string;
  investorRelationsURL: string;
  businessSummary: string;
  sharesOutstanding: number;
  dividendRate: number;
  targetMeanPrice: number;
  recommendationMean: number;
  dividendPayouts: DividendPayout[];
  splits: Split[];
}

export interface ETF extends PubliclyTradedSecurityBase {
  securityType: typeof SecurityType.ETF;
  isin: string;
  distributionEvents: DividendPayout[];
  splits: Split[];
  netExpenseRatio: number;
  dividendYield: number;
}

export interface CryptoCurrency extends PubliclyTradedSecurityBase {
  securityType: typeof SecurityType.Cryptocurrency;
  marketCapitalization: number;
}

export interface CurrencyPair extends PubliclyTradedSecurityBase {
  securityType: typeof SecurityType.CurrencyPair;
}

export type Security = Stock | ETF | CryptoCurrency | CurrencyPair;
