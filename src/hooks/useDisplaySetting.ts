import { useEffect, useState, useSyncExternalStore } from "react";
import type { DeviceProfile } from "@/models/DisplaySettings";
import {
  defaultDisplaySetting,
  encodeDisplaySetting,
} from "@/lib/displaySettingsRegistry";
import type {
  DisplaySettingKey,
  DisplaySettingValue,
} from "@/lib/displaySettingsRegistry";
import { displaySettingsStore } from "@/lib/displaySettingsStore";

export function useDeviceProfile(): DeviceProfile {
  const [profile, setProfile] = useState<DeviceProfile>("desktop");

  useEffect(() => {
    const query = window.matchMedia("(max-width: 767px)");
    const updateProfile = () =>
      setProfile(query.matches ? "mobile" : "desktop");
    updateProfile();
    query.addEventListener("change", updateProfile);
    return () => query.removeEventListener("change", updateProfile);
  }, []);

  return profile;
}

export function useDisplaySetting<K extends DisplaySettingKey>(
  profile: DeviceProfile,
  key: K,
): [DisplaySettingValue<K>, (value: DisplaySettingValue<K>) => void] {
  const defaultValue = defaultDisplaySetting(key);
  const raw = useSyncExternalStore(
    displaySettingsStore.subscribe,
    () => displaySettingsStore.getRaw(profile, key),
    () => encodeDisplaySetting(key, defaultValue),
  );
  useEffect(() => displaySettingsStore.initialize(profile), [profile]);

  let value: DisplaySettingValue<K>;
  if (typeof defaultValue === "boolean") {
    value = (raw === "true") as DisplaySettingValue<K>;
  } else if (typeof defaultValue === "number") {
    value = Number(raw) as DisplaySettingValue<K>;
  } else {
    value = raw as DisplaySettingValue<K>;
  }

  return [
    value,
    (nextValue) => displaySettingsStore.set(profile, key, nextValue),
  ];
}
