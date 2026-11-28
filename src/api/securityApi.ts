import type { Security } from "@/models/Security";
import type { SecurityGraphSettings } from "@/models/GraphSettings";
import { authenticatedFetch } from "./authenticatedFetch";
import { sharedRequest } from "./sharedRequest";

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

export function getSecurity(
  id: number,
  settings: SecurityGraphSettings,
  signal?: AbortSignal,
): Promise<Security> {
  const query = new URLSearchParams({
    id: String(id),
    "SecurityGraphSettings.DataSource": String(settings.dataSource),
    "SecurityGraphSettings.PlotType": String(settings.plotType),
    "SecurityGraphSettings.AsTotalReturn": String(settings.asTotalReturn),
  });
  if (settings.bounds) {
    for (const [key, value] of Object.entries(settings.bounds)) {
      if (value !== null)
        query.set(`SecurityGraphSettings.Bounds.${key}`, String(value));
    }
  }
  const url = `${BASE_URL}/api/Security/Get?${query}`;
  return sharedRequest(
    `security:${query}`,
    async () => {
      const response = await authenticatedFetch(url, {
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
