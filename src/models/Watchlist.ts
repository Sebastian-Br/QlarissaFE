import type { WatchlistMinimal } from "./WatchlistMinimal";

export interface WatchedSecurity {
  securityId: number;
  name: string;
  symbol: string;
  currencySymbol?: string;
  previousClosePrice: number;
}

export interface Watchlist extends WatchlistMinimal {
  watchedSecurities: WatchedSecurity[];
}
