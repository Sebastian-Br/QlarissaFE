import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { webcrypto } from "node:crypto";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = new URL("../src/", import.meta.url);

function dataUrl(source) {
  return `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
}

function encodeModule(source) {
  return ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
}

function createToken(subject) {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "none" })}.${encode({ sub: subject })}.signature`;
}

function installBrowser(token) {
  const values = new Map([["jwt", token]]);
  const listeners = new Map();
  globalThis.localStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
  globalThis.window = {
    addEventListener(type, listener) {
      const current = listeners.get(type) ?? [];
      current.push(listener);
      listeners.set(type, current);
    },
    dispatchEvent(event) {
      listeners.get(event.type)?.forEach((listener) => listener(event));
      return true;
    },
  };
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { onLine: true },
  });
  Object.defineProperty(globalThis, "crypto", {
    configurable: true,
    value: webcrypto,
  });
}

async function loadDisplayStore(api) {
  globalThis.__displaySettingsApi = api;
  const [storeSource, registrySource] = await Promise.all([
    readFile(fileURLToPath(new URL("lib/displaySettingsStore.ts", root)), "utf8"),
    readFile(fileURLToPath(new URL("lib/displaySettingsRegistry.ts", root)), "utf8"),
  ]);
  const apiModule = dataUrl(`
    export class SettingsApiError extends Error {
      constructor(message, status) { super(message); this.status = status; }
    }
    export const getDisplaySettings = (...args) => globalThis.__displaySettingsApi.getDisplaySettings(...args);
    export const syncDisplaySettings = (...args) => globalThis.__displaySettingsApi.syncDisplaySettings(...args);
  `);
  const authModule = dataUrl(`
    export const AUTH_CHANGED_EVENT = "qlarissa:access-token-changed";
    export function accessTokenSubject(token) {
      try {
        const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString());
        return typeof payload.sub === "string" ? payload.sub : null;
      } catch { return null; }
    }
    export class AuthenticatedAccountChangedError extends Error {}
  `);
  const registryModule = dataUrl(encodeModule(registrySource));
  const compiledStore = encodeModule(storeSource)
    .replaceAll('"@/api/settingsApi"', `"${apiModule}"`)
    .replaceAll('"@/api/authenticatedFetch"', `"${authModule}"`)
    .replaceAll('"./displaySettingsRegistry"', `"${registryModule}"`);
  return import(dataUrl(`${compiledStore}\n// ${Math.random()}`));
}

async function waitFor(predicate) {
  const deadline = Date.now() + 2000;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 2));
  }
  assert.fail("Timed out waiting for display settings store state.");
}

function clearStoreTimers(store) {
  for (const timer of store.syncTimers.values()) clearTimeout(timer);
  store.syncTimers.clear();
}

test("failed display-setting sync remains pending for a later retry", async () => {
  installBrowser(createToken("stable-user"));
  const originalConsoleError = console.error;
  console.error = () => {};
  let syncCalls = 0;
  const api = {
    getDisplaySettings: async () => ({
      syncDebounceMilliseconds: 0,
      maxChangedKeysPerRequest: 100,
      settings: [],
    }),
    syncDisplaySettings: async () => {
      syncCalls++;
      throw new (class extends Error {
        constructor() { super("temporary failure"); this.status = 500; }
      })();
    },
  };
  const { displaySettingsStore: store } = await loadDisplayStore(api);
  store.initialize("desktop");
  await waitFor(() => Boolean(store.activeOwnerScope));

  store.set("desktop", "chart.security.logScale", true);
  await waitFor(() => syncCalls === 1);
  const pending = [...store.records.values()].find(
    (record) => record.key === "chart.security.logScale",
  );
  assert.equal(pending?.pending, true);
  assert.equal(store.getRaw("desktop", "chart.security.logScale"), "true");
  clearStoreTimers(store);
  console.error = originalConsoleError;
});

test("same-account token rotation preserves local settings; account switch isolates them", async () => {
  installBrowser(createToken("account-a"));
  const api = {
    getDisplaySettings: async (_profile, subject) => ({
      syncDebounceMilliseconds: 10_000,
      maxChangedKeysPerRequest: 100,
      settings: subject === "account-a"
        ? [{ key: "chart.security.logScale", value: "false" }]
        : [],
    }),
    syncDisplaySettings: async () => {},
  };
  const { displaySettingsStore: store } = await loadDisplayStore(api);
  store.initialize("desktop");
  await waitFor(() => store.getRaw("desktop", "chart.security.logScale") === "false");

  localStorage.setItem("jwt", createToken("account-a"));
  window.dispatchEvent(new Event("qlarissa:access-token-changed"));
  assert.equal(store.getRaw("desktop", "chart.security.logScale"), "false");

  localStorage.setItem("jwt", createToken("account-b"));
  window.dispatchEvent(new Event("qlarissa:access-token-changed"));
  assert.equal(store.getRaw("desktop", "chart.security.logScale"), "true");
  store.initialize("desktop");
  await waitFor(() => store.activeSubject === "account-b" && store.initializedProfiles.has(`${store.activeOwnerScope}\u0000desktop`));
  assert.equal(store.getRaw("desktop", "chart.security.logScale"), "true");
  clearStoreTimers(store);
});

test("settings are cleared from view when another tab switches accounts", async () => {
  installBrowser(createToken("account-a"));
  const api = {
    getDisplaySettings: async (_profile, subject) => ({
      syncDebounceMilliseconds: 10_000,
      maxChangedKeysPerRequest: 100,
      settings: subject === "account-a"
        ? [{ key: "chart.security.logScale", value: "false" }]
        : [],
    }),
    syncDisplaySettings: async () => {},
  };
  const { displaySettingsStore: store } = await loadDisplayStore(api);
  store.initialize("desktop");
  await waitFor(() => store.getRaw("desktop", "chart.security.logScale") === "false");

  localStorage.setItem("jwt", createToken("account-b"));
  window.dispatchEvent({ type: "storage", key: "jwt" });

  assert.equal(store.getRaw("desktop", "chart.security.logScale"), "true");
  await waitFor(() =>
    store.activeSubject === "account-b" &&
    store.initializedProfiles.has(`${store.activeOwnerScope}\u0000desktop`),
  );
  assert.equal(store.getRaw("desktop", "chart.security.logScale"), "true");
  clearStoreTimers(store);
});

test("legacy token-hash schema is explicitly discarded during database upgrade", async () => {
  installBrowser(createToken("stable-user"));
  const api = {
    getDisplaySettings: async () => ({
      syncDebounceMilliseconds: 0,
      maxChangedKeysPerRequest: 100,
      settings: [],
    }),
    syncDisplaySettings: async () => {},
  };
  const { requiresLegacySettingsRemoval } = await loadDisplayStore(api);

  assert.equal(requiresLegacySettingsRemoval(1), true);
  assert.equal(requiresLegacySettingsRemoval(2), false);
});
