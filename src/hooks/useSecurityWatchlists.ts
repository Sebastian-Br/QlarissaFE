import { useEffect, useState } from "react";
import {
  getWatchlistIdsForSecurity,
  getWatchlistsMinimal,
  unwatchSecurity,
  updateWatchlist,
  watchSecurity,
} from "@/api/watchlistApi";
import type { WatchlistMinimal } from "@/models/WatchlistMinimal";

export function useSecurityWatchlists(securityId: number) {
  const [watchlists, setWatchlists] = useState<WatchlistMinimal[] | null>(null);
  const [watchedWatchlistIds, setWatchedWatchlistIds] = useState<number[] | null>(null);
  const [togglingWatchlistId, setTogglingWatchlistId] = useState<number | null>(null);
  const [savingWatchlistId, setSavingWatchlistId] = useState<number | null>(null);
  const [watchlistsFailed, setWatchlistsFailed] = useState(false);
  const [isCreateWatchlistOpen, setIsCreateWatchlistOpen] = useState(false);
  const primaryWatchlist = watchlists?.find((watchlist) => watchlist.isPrimary);
  const secondaryWatchlist = watchlists?.find((watchlist) => watchlist.isSecondary);
  const starsReady = watchlists !== null && watchedWatchlistIds !== null;
  const isStarredLarge =
    !!primaryWatchlist && !!watchedWatchlistIds?.includes(primaryWatchlist.id);
  const isStarredSmall =
    !!secondaryWatchlist && !!watchedWatchlistIds?.includes(secondaryWatchlist.id);

  useEffect(() => {
    if (!Number.isInteger(securityId) || securityId < 1) return;
    const controller = new AbortController();
    setWatchlists(null);
    setWatchedWatchlistIds(null);
    setWatchlistsFailed(false);
    getWatchlistsMinimal()
      .then(setWatchlists)
      .catch(() => setWatchlistsFailed(true));
    getWatchlistIdsForSecurity(securityId, controller.signal)
      .then(setWatchedWatchlistIds)
      .catch((cause) => {
        if (!(cause instanceof DOMException && cause.name === "AbortError"))
          setWatchlistsFailed(true);
      });
    return () => controller.abort();
  }, [securityId]);

  const toggleWatchlist = async (watchlist: WatchlistMinimal) => {
    const isWatched = watchedWatchlistIds?.includes(watchlist.id) ?? false;
    setTogglingWatchlistId(watchlist.id);
    try {
      if (isWatched) await unwatchSecurity(watchlist.id, securityId);
      else await watchSecurity(watchlist.id, securityId);
      setWatchedWatchlistIds((ids) => {
        const current = ids ?? [];
        return isWatched
          ? current.filter((id) => id !== watchlist.id)
          : [...current, watchlist.id];
      });
    } catch {
      // A failed request leaves the star in its last server-confirmed state.
    } finally {
      setTogglingWatchlistId(null);
    }
  };

  const saveWatchlist = async (
    watchlist: WatchlistMinimal,
    changes: Partial<WatchlistMinimal>,
  ): Promise<boolean> => {
    setSavingWatchlistId(watchlist.id);
    try {
      const updated = await updateWatchlist({ ...watchlist, ...changes });
      setWatchlists(
        (current) => current?.map((item) => (item.id === updated.id ? updated : item)) ?? null,
      );
      return true;
    } catch {
      return false;
    } finally {
      setSavingWatchlistId(null);
    }
  };

  const handleWatchlistCreated = (created: WatchlistMinimal) => {
    setWatchlists((current) => [...(current ?? []), created]);
    setIsCreateWatchlistOpen(false);
  };

  return {
    watchlists,
    watchedWatchlistIds,
    togglingWatchlistId,
    savingWatchlistId,
    watchlistsFailed,
    isCreateWatchlistOpen,
    setIsCreateWatchlistOpen,
    primaryWatchlist,
    secondaryWatchlist,
    starsReady,
    isStarredLarge,
    isStarredSmall,
    toggleWatchlist,
    saveWatchlist,
    handleWatchlistCreated,
  };
}

export type SecurityWatchlists = ReturnType<typeof useSecurityWatchlists>;
