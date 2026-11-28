import type {
  DeviceProfile,
  DisplaySettingChange,
  DisplaySettingsSnapshot,
} from "@/models/DisplaySettings";
import {
  GraphDataSource,
  type GraphSettings,
} from "@/models/GraphSettings";
import { authenticatedFetch } from "./authenticatedFetch";
import { sharedRequest } from "./sharedRequest";

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

export class SettingsApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "SettingsApiError";
  }
}

function authHeaders(json = false): HeadersInit {
  return {
    accept: "application/json",
    ...(json ? { "Content-Type": "application/json" } : {}),
  };
}

async function ensureOk(response: Response, fallback: string): Promise<void> {
  if (response.ok) return;
  const message = (await response.text()).trim();
  throw new SettingsApiError(message || fallback, response.status);
}

export function getGraphSettings(
  signal?: AbortSignal,
): Promise<GraphSettings[]> {
  return sharedRequest(
    "graph-settings",
    async () => {
      const response = await authenticatedFetch(`${BASE_URL}/api/Settings/GetGraphSettings`, {
        headers: authHeaders(),
      });
      await ensureOk(response, "Unable to load graph settings.");
      return response.json() as Promise<GraphSettings[]>;
    },
    signal,
  );
}

export async function getGraphSetting(
  dataSource: GraphDataSource,
  signal?: AbortSignal,
): Promise<GraphSettings> {
  const response = await authenticatedFetch(
    `${BASE_URL}/api/Settings/GetGraphSetting?graphSetting=${encodeURIComponent(dataSource)}`,
    {
      signal,
      headers: authHeaders(),
    },
  );
  await ensureOk(response, "Unable to load graph setting.");
  return response.json();
}

export async function updateGraphSetting(
  setting: GraphSettings,
): Promise<void> {
  const response = await authenticatedFetch(
    `${BASE_URL}/api/Settings/AddOrUpdateGraphSetting`,
    {
      method: "PUT",
      headers: authHeaders(true),
      body: JSON.stringify(setting),
    },
  );
  await ensureOk(response, "Unable to save graph settings.");
}

const deviceProfileValue: Record<DeviceProfile, number> = {
  desktop: 0,
  mobile: 1,
};

export async function getDisplaySettings(
  profile: DeviceProfile,
  expectedSubject?: string,
): Promise<DisplaySettingsSnapshot> {
  const response = await authenticatedFetch(
    `${BASE_URL}/api/Settings/GetDisplaySettings?deviceProfile=${deviceProfileValue[profile]}`,
    { headers: authHeaders() },
    expectedSubject,
  );
  await ensureOk(response, "Unable to load display settings.");
  return response.json();
}

export async function syncDisplaySettings(
  profile: DeviceProfile,
  changes: DisplaySettingChange[],
  expectedSubject?: string,
): Promise<void> {
  const response = await authenticatedFetch(
    `${BASE_URL}/api/Settings/SyncDisplaySettings`,
    {
      method: "PUT",
      headers: authHeaders(true),
      body: JSON.stringify({
        deviceProfile: deviceProfileValue[profile],
        changes,
      }),
    },
    expectedSubject,
  );
  await ensureOk(response, "Unable to save display settings.");
}
