import type { Currency } from "@/models/Currency"

const BASE_URL = import.meta.env.VITE_API_BASE_URL

export async function getCurrencies(signal?: AbortSignal): Promise<Currency[]> {
  const response = await fetch(`${BASE_URL}/api/Currency/GetCurrencies`, {
    signal,
    headers: { accept: "*/*" },
  })

  if (!response.ok) throw new Error("Could not load currencies")

  return response.json()
}
