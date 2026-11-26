export type DeviceProfile = "desktop" | "mobile";

export interface DisplaySettingItem {
  key: string;
  value: string;
}

export interface DisplaySettingsSnapshot {
  syncDebounceMilliseconds: number;
  maxChangedKeysPerRequest: number;
  settings: DisplaySettingItem[];
}

export interface DisplaySettingChange {
  key: string;
  value: string | null;
}
