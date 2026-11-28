import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import ts from "typescript";

const compile = async (path) => ts.transpileModule(
  await readFile(new URL(path, import.meta.url), "utf8"),
  { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } },
).outputText;
const dataModule = (code) => `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`;
const shared = dataModule(await compile("../src/api/sharedRequest.ts"));
const auth = dataModule("export const authenticatedFetch = (...args) => globalThis.securityTestFetch(...args);");
const source = (await compile("../src/api/securityApi.ts"))
  .replace('"./authenticatedFetch"', JSON.stringify(auth))
  .replace('"./sharedRequest"', JSON.stringify(shared));
const { getSecurity } = await import(dataModule(source));

test("security request sends all current settings as nested query values", async () => {
  let requestUrl;
  globalThis.securityTestFetch = async (url) => {
    requestUrl = url;
    return Response.json({ id: 42 });
  };
  try {
    await getSecurity(42, {
      dataSource: 0,
      plotType: 3,
      asTotalReturn: false,
      bounds: { startDate: "2025-01-01", endDate: null, start: 0, end: 42.5 },
    });
    const query = new URL(requestUrl, "http://localhost").searchParams;
    assert.deepEqual(Object.fromEntries(query), {
      id: "42",
      "SecurityGraphSettings.DataSource": "0",
      "SecurityGraphSettings.PlotType": "3",
      "SecurityGraphSettings.AsTotalReturn": "false",
      "SecurityGraphSettings.Bounds.startDate": "2025-01-01",
      "SecurityGraphSettings.Bounds.start": "0",
      "SecurityGraphSettings.Bounds.end": "42.5",
    });
  } finally {
    delete globalThis.securityTestFetch;
  }
});

test("pending requests share only identical settings and detach aborted callers", async () => {
  const pending = [];
  globalThis.securityTestFetch = (url) => new Promise((resolve) => pending.push({ url, resolve }));
  const settings = { dataSource: 0, plotType: 0, asTotalReturn: true, bounds: null };
  const controller = new AbortController();
  try {
    const first = getSecurity(42, settings, controller.signal);
    const same = getSecurity(42, settings);
    const changed = getSecurity(42, { ...settings, bounds: {
      startDate: null, endDate: "2024-12-31", start: null, end: null,
    } });
    assert.equal(pending.length, 2);
    controller.abort();
    await assert.rejects(first, { name: "AbortError" });
    pending[1].resolve(Response.json({ id: 42, result: "bounded" }));
    pending[0].resolve(Response.json({ id: 42, result: "unbounded" }));
    assert.equal((await changed).result, "bounded");
    assert.equal((await same).result, "unbounded");
    const query = new URL(pending[1].url, "http://localhost").searchParams;
    assert.equal(query.get("SecurityGraphSettings.AsTotalReturn"), "true");
    assert.equal(query.get("SecurityGraphSettings.Bounds.endDate"), "2024-12-31");
    assert.equal(query.has("SecurityGraphSettings.Bounds.startDate"), false);
  } finally {
    delete globalThis.securityTestFetch;
  }
});

test("security requests surface unsuccessful responses", async () => {
  globalThis.securityTestFetch = async () => new Response(null, { status: 500 });
  try {
    await assert.rejects(getSecurity(42, {
      dataSource: 0, plotType: 0, asTotalReturn: false, bounds: null,
    }), /Unable to load security/);
  } finally {
    delete globalThis.securityTestFetch;
  }
});
