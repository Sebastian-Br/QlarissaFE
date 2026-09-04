import type { Security } from "@/models/Security";

const BASE_URL = import.meta.env.VITE_API_BASE_URL;

export async function getSecurity(id: number, signal?: AbortSignal): Promise<Security> {
  const token = localStorage.getItem("jwt");
  const response = await fetch(`${BASE_URL}/api/Security/Get?id=${encodeURIComponent(id)}`, {
    signal,
    headers: {
      accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) throw new Error("Unable to load security.");

  return response.json();
}
