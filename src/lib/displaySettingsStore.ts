import {
  getDisplaySettings,
  SettingsApiError,
  syncDisplaySettings,
} from "@/api/settingsApi";
import {
  AUTH_CHANGED_EVENT,
  accessTokenSubject,
  AuthenticatedAccountChangedError,
} from "@/api/authenticatedFetch";
import type {
  DeviceProfile,
  DisplaySettingChange,
  DisplaySettingsSnapshot,
} from "@/models/DisplaySettings";
import {
  decodeDisplaySetting,
  defaultDisplaySetting,
  DISPLAY_SETTINGS_REGISTRY_VERSION,
  encodeDisplaySetting,
  isDisplaySettingAllowedForProfile,
} from "./displaySettingsRegistry";
import type {
  DisplaySettingKey,
  DisplaySettingValue,
} from "./displaySettingsRegistry";

interface StoredDisplaySetting {
  ownerScope: string;
  profile: DeviceProfile;
  key: string;
  value: string | null;
  pending: boolean;
  revision: number;
  registryVersion: number;
  ownerSubject?: string;
}

const DATABASE_NAME = "qlarissa-display-settings";
const DATABASE_VERSION = 2;
const SETTINGS_STORE = "settings";
const METADATA_STORE = "metadata";

export function requiresLegacySettingsRemoval(oldVersion: number): boolean {
  return oldVersion < DATABASE_VERSION;
}

function rowId(ownerScope: string, profile: DeviceProfile, key: string): string {
  return `${ownerScope}\u0000${profile}\u0000${key}`;
}

function initializedId(ownerScope: string, profile: DeviceProfile): string {
  return `${ownerScope}\u0000${profile}`;
}

function containsControlCharacters(value: string): boolean {
  return Array.from(value).some((character) => {
    const code = character.charCodeAt(0);
    return code < 32 || (code >= 127 && code <= 159);
  });
}

async function getOwnerScope(subject: string): Promise<string | null> {
  if (!globalThis.crypto?.subtle) return null;
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(subject),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

class DisplaySettingsStore {
  private readonly records = new Map<string, StoredDisplaySetting>();
  private readonly cache = new Map<string, string>();
  private readonly listeners = new Set<() => void>();
  private readonly initializedProfiles = new Set<string>();
  private readonly initializationPromises = new Map<string, Promise<void>>();
  private readonly requestedProfiles = new Set<DeviceProfile>();
  private readonly syncTimers = new Map<DeviceProfile, ReturnType<typeof setTimeout>>();
  private databasePromise: Promise<IDBDatabase | null> | null = null;
  private activeOwnerScope: string | null = null;
  private activeSubject: string | null = null;
  private activeToken: string | null = null;
  private debounceMilliseconds = 500;
  private maxChangedKeysPerRequest = 100;
  private revision = 0;
  private syncInProgress = false;
  private retryCount = 0;
  private onlineListenerRegistered = false;

  constructor() {
    if (typeof window !== "undefined") {
      const handleAuthChanged = () => {
        const token = localStorage.getItem("jwt");
        const subject = token ? accessTokenSubject(token) : null;
        this.activeToken = token;
        if (subject !== this.activeSubject) {
          this.activeSubject = subject;
          this.activeOwnerScope = null;
          this.notify();
        }
        for (const profile of this.requestedProfiles)
          this.initialize(profile);
      };
      window.addEventListener(AUTH_CHANGED_EVENT, handleAuthChanged);
      window.addEventListener("storage", (event) => {
        if (event.key === "jwt") handleAuthChanged();
      });
    }
  }

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getRaw(profile: DeviceProfile, key: DisplaySettingKey): string {
    if (!this.activeOwnerScope)
      return encodeDisplaySetting(key, defaultDisplaySetting(key));
    return (
      this.cache.get(rowId(this.activeOwnerScope, profile, key)) ??
      encodeDisplaySetting(key, defaultDisplaySetting(key))
    );
  }

  initialize(profile: DeviceProfile): void {
    this.requestedProfiles.add(profile);
    let token: string | null;
    try {
      token = localStorage.getItem("jwt");
    } catch (error) {
      console.warn("Unable to read the current display settings account.", error);
      return;
    }

    if (!token) {
      this.activeToken = null;
      this.activeSubject = null;
      this.activeOwnerScope = null;
      this.notify();
      return;
    }

    const subject = accessTokenSubject(token);
    if (!subject) {
      this.activeToken = token;
      this.activeSubject = null;
      this.activeOwnerScope = null;
      this.notify();
      return;
    }
    if (subject !== this.activeSubject) {
      this.activeSubject = subject;
      this.activeOwnerScope = null;
      this.notify();
    }
    this.activeToken = token;

    const activeId = this.activeOwnerScope
      ? initializedId(this.activeOwnerScope, profile)
      : null;
    if (activeId && this.initializedProfiles.has(activeId)) return;

    const initializationId = `${profile}\u0000${token}`;
    if (this.initializationPromises.has(initializationId)) return;
    const promise = this.initializeProfile(profile, token, subject)
      .catch((error: unknown) => {
        console.error("Unable to initialize display settings.", error);
      })
      .finally(() => {
        if (this.initializationPromises.get(initializationId) === promise)
          this.initializationPromises.delete(initializationId);
      });
    this.initializationPromises.set(initializationId, promise);
  }

  set<K extends DisplaySettingKey>(
    profile: DeviceProfile,
    key: K,
    value: DisplaySettingValue<K>,
  ): void {
    if (!isDisplaySettingAllowedForProfile(key, profile))
      throw new TypeError(`Display setting "${key}" is not owned by ${profile}.`);

    const encoded = encodeDisplaySetting(key, value);
    const ownerScope = this.activeOwnerScope ?? "";
    const next: StoredDisplaySetting = {
      ownerScope,
      ownerSubject: ownerScope ? undefined : this.activeSubject ?? undefined,
      profile,
      key,
      value: encoded,
      pending: true,
      revision: ++this.revision,
      registryVersion: DISPLAY_SETTINGS_REGISTRY_VERSION,
    };
    const id = rowId(ownerScope, profile, key);
    this.records.set(id, next);
    this.cache.set(id, encoded);
    this.notify();
    void this.persist(next);
    this.scheduleSync(profile, this.debounceMilliseconds);
  }

  private notify(): void {
    for (const listener of this.listeners) listener();
  }

  private async database(): Promise<IDBDatabase | null> {
    if (typeof indexedDB === "undefined") return null;
    if (!this.databasePromise) {
      this.databasePromise = new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
        request.onupgradeneeded = (event) => {
          const database = request.result;
          if (requiresLegacySettingsRemoval(event.oldVersion)) {
            if (database.objectStoreNames.contains(SETTINGS_STORE))
              database.deleteObjectStore(SETTINGS_STORE);
            if (database.objectStoreNames.contains(METADATA_STORE))
              database.deleteObjectStore(METADATA_STORE);
            const settings = database.createObjectStore(SETTINGS_STORE, {
              keyPath: ["ownerScope", "profile", "key"],
            });
            settings.createIndex("profileKey", ["profile", "key"]);
            settings.createIndex("ownerProfile", ["ownerScope", "profile"]);
          }
        };
        request.onsuccess = () => {
          request.result.onversionchange = () => request.result.close();
          resolve(request.result);
        };
        request.onerror = () => reject(request.error);
        request.onblocked = () =>
          reject(new Error("Display settings database is blocked."));
      }).catch((error: unknown) => {
        this.databasePromise = null;
        throw error;
      });
    }

    try {
      return await this.databasePromise;
    } catch (error) {
      console.warn("IndexedDB display settings are unavailable.", error);
      return null;
    }
  }

  private async loadRows(ownerScope: string): Promise<StoredDisplaySetting[]> {
    const database = await this.database();
    if (!database) return [];
    return new Promise((resolve, reject) => {
      const request = database
        .transaction(SETTINGS_STORE, "readonly")
        .objectStore(SETTINGS_STORE)
        .index("ownerProfile")
        .getAll(IDBKeyRange.bound([ownerScope, ""], [ownerScope, "\uffff"]));
      request.onsuccess = () => resolve(request.result as StoredDisplaySetting[]);
      request.onerror = () => reject(request.error);
    });
  }

  private async persist(setting: StoredDisplaySetting): Promise<void> {
    if (!setting.ownerScope) return;
    const database = await this.database();
    if (!database) return;
    const persisted = { ...setting };
    delete persisted.ownerSubject;
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(SETTINGS_STORE, "readwrite");
      transaction.objectStore(SETTINGS_STORE).put(persisted);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    }).catch((error: unknown) => {
      console.warn("Unable to persist a display setting locally.", error);
    });
  }

  private async removeLocal(
    ownerScope: string,
    profile: DeviceProfile,
    key: string,
  ): Promise<void> {
    const database = await this.database();
    if (!database) return;
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(SETTINGS_STORE, "readwrite");
      transaction
        .objectStore(SETTINGS_STORE)
        .delete([ownerScope, profile, key]);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    }).catch((error: unknown) => {
      console.warn("Unable to remove an obsolete local display setting.", error);
    });
  }

  private async initializeProfile(
    profile: DeviceProfile,
    token: string,
    subject: string,
  ): Promise<void> {
    let ownerScope: string | null = null;
    try {
      ownerScope = await getOwnerScope(subject);
    } catch (error) {
      console.warn("Unable to establish a local display settings account scope.", error);
    }
    if (this.activeToken !== token || this.activeSubject !== subject) return;
    if (!ownerScope) {
      console.warn("Web Crypto is unavailable; display settings will remain in memory only.");
    } else {
      this.activeOwnerScope = ownerScope;
      this.adoptUnscopedPendingEdits(ownerScope, subject);
      this.notify();
      try {
        const localRows = await this.loadRows(ownerScope);
        if (this.activeToken !== token || this.activeSubject !== subject) return;
        for (const row of localRows) {
          if (row.profile !== profile) continue;
          const id = rowId(ownerScope, profile, row.key);
          if (!isDisplaySettingAllowedForProfile(row.key, profile)) {
            if (
              row.key.length > 128 ||
              row.key.trim().length === 0 ||
              containsControlCharacters(row.key)
            ) {
              this.records.delete(id);
              this.cache.delete(id);
              void this.removeLocal(ownerScope, profile, row.key);
              continue;
            }
            const tombstone: StoredDisplaySetting = {
              ...row,
              value: null,
              pending: true,
              revision: ++this.revision,
              registryVersion: DISPLAY_SETTINGS_REGISTRY_VERSION,
            };
            this.records.set(id, tombstone);
            void this.persist(tombstone);
            continue;
          }
          if (row.value !== null && decodeDisplaySetting(row.key, row.value) === null) {
            this.records.delete(id);
            this.cache.delete(id);
            void this.removeLocal(ownerScope, profile, row.key);
            continue;
          }

          const current: StoredDisplaySetting = {
            ...row,
            registryVersion: DISPLAY_SETTINGS_REGISTRY_VERSION,
          };
          this.records.set(id, current);
          if (current.value === null) this.cache.delete(id);
          else this.cache.set(id, current.value);
          if (current.revision > this.revision) this.revision = current.revision;
          if (row.registryVersion !== DISPLAY_SETTINGS_REGISTRY_VERSION)
            void this.persist(current);
        }
        this.notify();
      } catch (error) {
        console.warn("Unable to read local display settings.", error);
      }
    }

    this.registerOnlineListener();
    try {
      const snapshot = await getDisplaySettings(profile, subject);
      if (this.activeToken !== token || this.activeSubject !== subject) return;
      this.applySnapshot(profile, ownerScope, subject, snapshot);
    } catch (error) {
      console.warn("Unable to load display settings from the server.", error);
      if (this.activeSubject === subject)
        this.scheduleSync(profile, this.debounceMilliseconds);
    }
    this.initializedProfiles.add(initializedId(ownerScope ?? "", profile));
  }

  private adoptUnscopedPendingEdits(ownerScope: string, subject: string): void {
    for (const [id, setting] of this.records) {
      if (
        setting.ownerScope !== "" ||
        !setting.pending ||
        setting.ownerSubject !== subject
      ) {
        continue;
      }
      this.records.delete(id);
      const scoped = { ...setting, ownerScope, ownerSubject: undefined };
      const scopedId = rowId(ownerScope, setting.profile, setting.key);
      this.records.set(scopedId, scoped);
      if (scoped.value === null) this.cache.delete(id);
      else this.cache.delete(id);
      if (scoped.value !== null) this.cache.set(scopedId, scoped.value);
      void this.persist(scoped);
    }
  }

  private applySnapshot(
    profile: DeviceProfile,
    ownerScope: string | null,
    subject: string,
    snapshot: DisplaySettingsSnapshot,
  ): void {
    this.debounceMilliseconds = Math.max(0, snapshot.syncDebounceMilliseconds);
    this.maxChangedKeysPerRequest = Math.max(1, snapshot.maxChangedKeysPerRequest);
    const serverKeys = new Set<string>();

    for (const setting of snapshot.settings) {
      const id = rowId(ownerScope ?? "", profile, setting.key);
      const local = this.records.get(id);
      serverKeys.add(setting.key);
      if (local?.pending) continue;

      const value = isDisplaySettingAllowedForProfile(setting.key, profile)
        ? decodeDisplaySetting(setting.key, setting.value)
        : null;
      if (value === null) {
        if (ownerScope) this.queueRemoval(ownerScope, profile, setting.key);
        continue;
      }

      const row: StoredDisplaySetting = {
        ownerScope: ownerScope ?? "",
        profile,
        key: setting.key,
        value: setting.value,
        pending: false,
        revision: ++this.revision,
        registryVersion: DISPLAY_SETTINGS_REGISTRY_VERSION,
      };
      this.records.set(id, row);
      this.cache.set(id, setting.value);
      void this.persist(row);
    }

    for (const [id, row] of this.records) {
      if (
        row.ownerScope === (ownerScope ?? "") &&
        row.profile === profile &&
        !row.pending &&
        !serverKeys.has(row.key)
      ) {
        this.records.delete(id);
        this.cache.delete(id);
        if (ownerScope) void this.removeLocal(ownerScope, profile, row.key);
      }
    }

    this.notify();
    this.retryCount = 0;
    this.scheduleSync(profile, this.debounceMilliseconds);
    void subject;
  }

  private queueRemoval(ownerScope: string, profile: DeviceProfile, key: string): void {
    const row: StoredDisplaySetting = {
      ownerScope,
      profile,
      key,
      value: null,
      pending: true,
      revision: ++this.revision,
      registryVersion: DISPLAY_SETTINGS_REGISTRY_VERSION,
    };
    const id = rowId(ownerScope, profile, key);
    this.records.set(id, row);
    this.cache.delete(id);
    void this.persist(row);
  }

  private scheduleSync(profile: DeviceProfile, delay: number): void {
    const existing = this.syncTimers.get(profile);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => {
      this.syncTimers.delete(profile);
      void this.sync(profile);
    }, delay);
    this.syncTimers.set(profile, timer);
  }

  private async sync(profile: DeviceProfile): Promise<void> {
    if (typeof navigator !== "undefined" && !navigator.onLine) return;
    const ownerScope = this.activeOwnerScope;
    const subject = this.activeSubject;
    if (!ownerScope || !subject || this.syncInProgress) return;

    const batch = [...this.records.values()]
      .filter(
        (record) =>
          record.ownerScope === ownerScope &&
          record.profile === profile &&
          record.pending,
      )
      .slice(0, this.maxChangedKeysPerRequest);
    if (batch.length === 0) return;

    this.syncInProgress = true;
    let failed = false;
    let retryAfterFailure = false;
    const changes: DisplaySettingChange[] = batch.map(({ key, value }) => ({
      key,
      value,
    }));
    try {
      await syncDisplaySettings(profile, changes, subject);
      for (const sent of batch) {
        const id = rowId(ownerScope, profile, sent.key);
        const current = this.records.get(id);
        if (!current || current.revision !== sent.revision) continue;
        if (sent.value === null) {
          this.records.delete(id);
          this.cache.delete(id);
          void this.removeLocal(ownerScope, profile, sent.key);
        } else {
          const accepted = { ...current, pending: false };
          this.records.set(id, accepted);
          void this.persist(accepted);
        }
      }
      this.retryCount = 0;
      this.notify();
    } catch (error) {
      failed = true;
      console.error("Unable to sync display settings.", error);
      if (error instanceof AuthenticatedAccountChangedError) {
        retryAfterFailure = false;
      } else if (!(error instanceof SettingsApiError) || error.status >= 500 || error.status === 429) {
        this.retryCount = Math.min(this.retryCount + 1, 6);
        retryAfterFailure = true;
      } else {
        this.retryCount = 0;
      }
    } finally {
      this.syncInProgress = false;
      if (this.activeOwnerScope === ownerScope && this.activeSubject === subject) {
        const pendingProfiles = new Set(
          [...this.records.values()]
            .filter((record) => record.ownerScope === ownerScope && record.pending)
            .map((record) => record.profile),
        );
        for (const pendingProfile of pendingProfiles) {
          if (!failed) {
            this.scheduleSync(pendingProfile, 0);
          } else if (retryAfterFailure) {
            this.scheduleSync(
              pendingProfile,
              Math.min(1000 * 2 ** (this.retryCount - 1), 30000),
            );
          }
        }
      }
    }
  }

  private registerOnlineListener(): void {
    if (this.onlineListenerRegistered) return;
    this.onlineListenerRegistered = true;
    window.addEventListener("online", () => {
      if (!this.activeOwnerScope) return;
      for (const profile of ["desktop", "mobile"] as const) {
        if (
          this.initializedProfiles.has(
            initializedId(this.activeOwnerScope, profile),
          )
        ) {
          void this.refresh(profile);
          this.scheduleSync(profile, 0);
        }
      }
    });
  }

  private async refresh(profile: DeviceProfile): Promise<void> {
    const subject = this.activeSubject;
    const ownerScope = this.activeOwnerScope;
    if (!subject || !ownerScope) return;
    try {
      const snapshot = await getDisplaySettings(profile, subject);
      if (this.activeSubject !== subject || this.activeOwnerScope !== ownerScope)
        return;
      this.applySnapshot(profile, ownerScope, subject, snapshot);
    } catch (error) {
      console.warn("Unable to refresh display settings.", error);
    }
  }
}

export const displaySettingsStore = new DisplaySettingsStore();
