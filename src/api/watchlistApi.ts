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
