import type { Security } from "@/models/Security";
import { authenticatedFetch } from "./authenticatedFetch";
import { sharedRequest } from "./sharedRequest";

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

export function getSecurity(id: number, signal?: AbortSignal): Promise<Security> {
  return sharedRequest(
    `security:${id}`,
    async () => {
      const response = await authenticatedFetch(`${BASE_URL}/api/Security/Get?id=${encodeURIComponent(id)}`, {
        headers: { accept: "application/json" },
      });

      if (!response.ok) throw new Error("Unable to load security.");

      return response.json() as Promise<Security>;
    },
    signal,
  );
}

export async function updateSecurity(id: number): Promise<void> {
  const response = await authenticatedFetch(
    `${BASE_URL}/api/Security/Update?id=${encodeURIComponent(id)}`,
    {
      method: "POST",
      headers: {},
    },
  );

  if (response.status === 200) return;

  const message = (await response.text()).trim();
  throw new Error(message || "Unable to update security.");
}
