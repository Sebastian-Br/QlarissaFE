import type { WatchlistMinimal } from "@/models/WatchlistMinimal";
import type { Watchlist } from "@/models/Watchlist";
import { authenticatedFetch } from "./authenticatedFetch";

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

export async function getWatchlistsMinimal(): Promise<WatchlistMinimal[]> {
  const response = await authenticatedFetch(`${BASE_URL}/api/Watchlist/GetWatchlistsMinimal`, {
    headers: {
      accept: "application/json",
    },
  });

  if (!response.ok) throw new Error("Unable to load watchlists.");

  return response.json();
}

export async function getPinnedWatchlists(
  signal?: AbortSignal,
  expectedSubject?: string,
): Promise<Watchlist[]> {
  const response = await authenticatedFetch(
    `${BASE_URL}/api/Watchlist/GetPinnedWatchlists`,
    {
      signal,
      headers: {
        accept: "application/json",
      },
    },
    expectedSubject,
  );

  if (!response.ok) throw new Error("Unable to load pinned watchlists.");

  return response.json();
}

export async function updatePinnedWatchlistOrder(
  orderedIds: number[],
  expectedSubject?: string,
): Promise<void> {
  const response = await authenticatedFetch(
    `${BASE_URL}/api/Watchlist/UpdatePinnedWatchlistOrder`,
    {
      method: "PUT",
      headers: {
        accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(orderedIds),
    },
    expectedSubject,
  );

  if (!response.ok) throw new Error("Unable to save pinned watchlist order.");
}

export async function updateWatchlist(watchlist: WatchlistMinimal): Promise<WatchlistMinimal> {
  const response = await authenticatedFetch(`${BASE_URL}/api/Watchlist/UpdateWatchlist`, {
    method: "PUT",
    headers: {
      accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(watchlist),
  });

  if (!response.ok) throw new Error("Unable to update watchlist.");

  return response.json();
}

export async function addWatchlist(watchlist: WatchlistMinimal): Promise<WatchlistMinimal> {
  const response = await authenticatedFetch(`${BASE_URL}/api/Watchlist/AddWatchlist`, {
    method: "POST",
    headers: {
      accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(watchlist),
  });

  if (!response.ok) throw new Error("Unable to create watchlist.");

  return response.json();
}

export async function getWatchlistIdsForSecurity(
  securityId: number,
  signal?: AbortSignal,
): Promise<number[]> {
  const response = await authenticatedFetch(
    `${BASE_URL}/api/Watchlist/GetWatchlistIdsForSecurity?securityId=${encodeURIComponent(securityId)}`,
    {
      signal,
      headers: {
        accept: "application/json",
      },
    },
  );

  if (!response.ok) throw new Error("Unable to load watchlist membership.");

  return response.json();
}

export async function watchSecurity(watchlistId: number, securityId: number): Promise<void> {
  const response = await authenticatedFetch(
    `${BASE_URL}/api/Watchlist/WatchSecurity?watchlistId=${encodeURIComponent(watchlistId)}&securityId=${encodeURIComponent(securityId)}`,
    {
      method: "POST",
      headers: {
      },
    },
  );

  if (!response.ok) throw new Error("Unable to add security to watchlist.");
}

export async function unwatchSecurity(watchlistId: number, securityId: number): Promise<void> {
  const response = await authenticatedFetch(
    `${BASE_URL}/api/Watchlist/UnwatchSecurity?watchlistId=${encodeURIComponent(watchlistId)}&securityId=${encodeURIComponent(securityId)}`,
    {
      method: "DELETE",
      headers: {
      },
    },
  );

  if (!response.ok) throw new Error("Unable to remove security from watchlist.");
}
