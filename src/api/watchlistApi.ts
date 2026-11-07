import type { WatchlistMinimal } from "@/models/WatchlistMinimal";

const BASE_URL = import.meta.env.VITE_API_BASE_URL;

export async function getWatchlistsMinimal(): Promise<WatchlistMinimal[]> {
  const token = localStorage.getItem("jwt");
  const response = await fetch(`${BASE_URL}/api/Watchlist/GetWatchlistsMinimal`, {
    headers: {
      accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) throw new Error("Unable to load watchlists.");

  return response.json();
}

export async function updateWatchlist(watchlist: WatchlistMinimal): Promise<WatchlistMinimal> {
  const token = localStorage.getItem("jwt");
  const response = await fetch(`${BASE_URL}/api/Watchlist/UpdateWatchlist`, {
    method: "PUT",
    headers: {
      accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(watchlist),
  });

  if (!response.ok) throw new Error("Unable to update watchlist.");

  return response.json();
}

export async function addWatchlist(watchlist: WatchlistMinimal): Promise<WatchlistMinimal> {
  const token = localStorage.getItem("jwt");
  const response = await fetch(`${BASE_URL}/api/Watchlist/AddWatchlist`, {
    method: "POST",
    headers: {
      accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
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
  const token = localStorage.getItem("jwt");
  const response = await fetch(
    `${BASE_URL}/api/Watchlist/GetWatchlistIdsForSecurity?securityId=${encodeURIComponent(securityId)}`,
    {
      signal,
      headers: {
        accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
    },
  );

  if (!response.ok) throw new Error("Unable to load watchlist membership.");

  return response.json();
}

export async function watchSecurity(watchlistId: number, securityId: number): Promise<void> {
  const token = localStorage.getItem("jwt");
  const response = await fetch(
    `${BASE_URL}/api/Watchlist/WatchSecurity?watchlistId=${encodeURIComponent(watchlistId)}&securityId=${encodeURIComponent(securityId)}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  if (!response.ok) throw new Error("Unable to add security to watchlist.");
}

export async function unwatchSecurity(watchlistId: number, securityId: number): Promise<void> {
  const token = localStorage.getItem("jwt");
  const response = await fetch(
    `${BASE_URL}/api/Watchlist/UnwatchSecurity?watchlistId=${encodeURIComponent(watchlistId)}&securityId=${encodeURIComponent(securityId)}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  if (!response.ok) throw new Error("Unable to remove security from watchlist.");
}
