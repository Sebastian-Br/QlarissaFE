import type { LivePrice } from "./livePrices";
import type { Watchlist } from "@/models/Watchlist";

export interface WatchlistMover {
  securityId: number;
  name: string;
  symbol: string;
  currencySymbol?: string;
  price: number;
  change: number;
}

export function sortPinnedWatchlists(watchlists: Watchlist[]): Watchlist[] {
  return [...watchlists].sort(
    (left, right) =>
      left.pinPosition - right.pinPosition || left.id - right.id,
  );
}

export function getPinnedWatchlistSymbols(watchlists: Watchlist[]): string[] {
  return [
    ...new Set(
      watchlists.flatMap((watchlist) =>
        watchlist.watchedSecurities
          .map((security) => security.symbol.trim().toUpperCase())
          .filter(Boolean),
      ),
    ),
  ];
}

export function rankWatchlistMovers(
  watchlist: Watchlist,
  prices: ReadonlyMap<string, LivePrice>,
  limit: number,
): { winners: WatchlistMover[]; losers: WatchlistMover[]; validPriceCount: number; hasMissingLivePrices: boolean } {
  let hasMissingLivePrices = false;
  const movers = watchlist.watchedSecurities.flatMap((security) => {
    const previousClose = security.previousClosePrice;
    const currentPrice = prices.get(security.symbol.trim().toUpperCase())?.price;
    if (currentPrice === undefined || !Number.isFinite(currentPrice) || currentPrice <= 0) {
      hasMissingLivePrices = true;
      return [];
    }
    if (
      !Number.isFinite(previousClose) ||
      previousClose <= 0
    ) {
      return [];
    }

    return [{
      securityId: security.securityId,
      name: security.name,
      symbol: security.symbol,
      currencySymbol: security.currencySymbol,
      price: currentPrice,
      change: ((currentPrice - previousClose) / previousClose) * 100,
    }];
  });

  const winners = movers
    .filter((mover) => mover.change > 0)
    .sort((left, right) => right.change - left.change)
    .slice(0, limit);
  const losers = movers
    .filter((mover) => mover.change < 0)
    .sort((left, right) => left.change - right.change)
    .slice(0, limit)
    .reverse();

  return { winners, losers, validPriceCount: movers.length, hasMissingLivePrices };
}

export function movePinnedWatchlist(
  watchlists: Watchlist[],
  watchlistId: number,
  targetIndex: number,
): Watchlist[] {
  const sourceIndex = watchlists.findIndex((watchlist) => watchlist.id === watchlistId);
  if (
    sourceIndex < 0 ||
    targetIndex < 0 ||
    targetIndex >= watchlists.length ||
    sourceIndex === targetIndex
  ) {
    return watchlists;
  }

  const reordered = [...watchlists];
  const [moved] = reordered.splice(sourceIndex, 1);
  reordered.splice(targetIndex, 0, moved);
  return reordered.map((watchlist, index) => ({
    ...watchlist,
    pinPosition: index + 1,
  }));
}
