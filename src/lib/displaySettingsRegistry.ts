import type { DeviceProfile } from "@/models/DisplaySettings";

const allProfiles = ["desktop", "mobile"] as const satisfies readonly DeviceProfile[];

type BooleanSettingDefinition = {
  type: "boolean";
  defaultValue: boolean;
  profiles: readonly DeviceProfile[];
};

type IntegerSettingDefinition = {
  type: "integer";
  defaultValue: number;
  minimum: number;
  maximum: number;
  step?: number;
  profiles: readonly DeviceProfile[];
};

type EnumSettingDefinition = {
  type: "enum";
  defaultValue: string;
  values: readonly string[];
  profiles: readonly DeviceProfile[];
};

type SettingDefinition =
  | BooleanSettingDefinition
  | IntegerSettingDefinition
  | EnumSettingDefinition;

export const DISPLAY_SETTINGS_REGISTRY_VERSION = 1;

export const DISPLAY_SETTING_REGISTRY = {
  "chart.security.logScale": {
    type: "boolean",
    defaultValue: true,
    profiles: allProfiles,
  },
  "chart.security.cardDistance": {
    type: "integer",
    defaultValue: 20,
    minimum: 8,
    maximum: 48,
    step: 2,
    profiles: allProfiles,
  },
  "chart.security.hover.behavior": {
    type: "enum",
    defaultValue: "dynamic",
    values: ["never", "always", "dynamic"],
    profiles: allProfiles,
  },
  "chart.security.hover.dynamicRadius": {
    type: "integer",
    defaultValue: 2,
    minimum: 2,
    maximum: 30,
    profiles: allProfiles,
  },
  "chart.dividendPayouts.logScale": {
    type: "boolean",
    defaultValue: true,
    profiles: allProfiles,
  },
  "chart.dividendPayouts.cardDistance": {
    type: "integer",
    defaultValue: 10,
    minimum: 8,
    maximum: 48,
    step: 2,
    profiles: allProfiles,
  },
} as const satisfies Record<string, SettingDefinition>;

export type DisplaySettingKey = keyof typeof DISPLAY_SETTING_REGISTRY;
type SettingValue<Definition> = Definition extends BooleanSettingDefinition
  ? boolean
  : Definition extends IntegerSettingDefinition
    ? number
    : Definition extends EnumSettingDefinition
      ? Definition["values"][number]
      : never;
export type DisplaySettingValue<K extends DisplaySettingKey> = SettingValue<
  (typeof DISPLAY_SETTING_REGISTRY)[K]
>;

export function isDisplaySettingKey(key: string): key is DisplaySettingKey {
  return Object.prototype.hasOwnProperty.call(DISPLAY_SETTING_REGISTRY, key);
}

export function isDisplaySettingAllowedForProfile(
  key: string,
  profile: DeviceProfile,
): key is DisplaySettingKey {
  return (
    isDisplaySettingKey(key) &&
    DISPLAY_SETTING_REGISTRY[key].profiles.includes(profile)
  );
}

export function isValidDisplaySettingValue(
  key: string,
  value: unknown,
): value is string | number | boolean {
  if (!isDisplaySettingKey(key)) return false;
  const definition = DISPLAY_SETTING_REGISTRY[key];
  if (definition.type === "boolean") return typeof value === "boolean";
  if (definition.type === "integer") {
    return (
      typeof value === "number" &&
      Number.isInteger(value) &&
      value >= definition.minimum &&
      value <= definition.maximum &&
      (value - definition.minimum) %
        (("step" in definition ? definition.step : undefined) ?? 1) ===
        0
    );
  }
  return (
    typeof value === "string" &&
    (definition.values as readonly string[]).includes(value)
  );
}

export function encodeDisplaySetting<K extends DisplaySettingKey>(
  key: K,
  value: DisplaySettingValue<K>,
): string {
  if (!isValidDisplaySettingValue(key, value))
    throw new TypeError(`Invalid value for display setting "${key}".`);
  return String(value);
}

export function decodeDisplaySetting(
  key: string,
  value: string,
): string | number | boolean | null {
  if (!isDisplaySettingKey(key)) return null;
  const definition = DISPLAY_SETTING_REGISTRY[key];
  if (definition.type === "boolean") {
    if (value !== "true" && value !== "false") return null;
    return value === "true";
  }
  if (definition.type === "integer") {
    const parsed = Number(value);
    return isValidDisplaySettingValue(key, parsed) ? parsed : null;
  }
  return isValidDisplaySettingValue(key, value) ? value : null;
}

export function defaultDisplaySetting<K extends DisplaySettingKey>(
  key: K,
): DisplaySettingValue<K> {
  return DISPLAY_SETTING_REGISTRY[key].defaultValue as DisplaySettingValue<K>;
}
