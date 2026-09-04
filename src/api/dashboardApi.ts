const BASE_URL = import.meta.env.VITE_API_BASE_URL;

export interface SearchResult {
  id?: number | null;
  name: string;
  symbol: string;
  securityType: number;
  exchange: string;
  exchangeShortName: string;
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

  const results: Array<Partial<SearchResult>> = await response.json();
  return results.map((result) => ({
    id: result.id ?? null,
    name: result.name ?? "",
    symbol: result.symbol ?? "",
    securityType: result.securityType ?? 1,
    exchange: result.exchange ?? "",
    exchangeShortName: result.exchangeShortName ?? "",
  }));
}

export function searchSecuritiesInternally(userQuery: string, signal: AbortSignal) {
  return search("/api/SearchBar/SearchSecuritiesInternally", userQuery, signal);
}

export function searchSecuritiesExternally(userQuery: string, signal: AbortSignal) {
  return search("/api/SearchBar/SearchSecuritiesExternally", userQuery, signal);
}

export async function addSecurity(tickerSymbol: string, signal: AbortSignal): Promise<string> {
  const token = localStorage.getItem("jwt");
  const response = await fetch(`${BASE_URL}/api/Security/Add?tickerSymbol=${encodeURIComponent(tickerSymbol)}`, {
    method: "POST",
    signal,
    headers: {
      accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error("Unable to add security.");
  }

  return response.text();
}
