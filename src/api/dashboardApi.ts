const BASE_URL = import.meta.env.VITE_API_BASE_URL;

export interface SearchResult {
  Name: string;
  Symbol: string;
  SecurityType: string | number;
  Exchange: string;
  ExchangeShortName: string;
}

async function search(endpoint: string, userQuery: string, signal: AbortSignal): Promise<SearchResult[]> {
  const token = localStorage.getItem("jwt");
  const response = await fetch(`${BASE_URL}${endpoint}?userQuery=${encodeURIComponent(userQuery)}`, {
    method: "GET",
    signal,
    headers: {
      accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error("Unable to search securities.");
  }

  return response.json();
}

export function searchSecuritiesInternally(userQuery: string, signal: AbortSignal) {
  return search("/api/SearchBar/SearchSecuritiesInternally", userQuery, signal);
}

export function searchSecuritiesExternally(userQuery: string, signal: AbortSignal) {
  return search("/api/SearchBar/SearchSecuritiesExternally", userQuery, signal);
}
