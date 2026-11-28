import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../src/api/settingsApi.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
});
const dataModule = (code) => `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`;
const api = await import(dataModule(outputText
  .replace('"./authenticatedFetch"', JSON.stringify(dataModule("export const authenticatedFetch = (...args) => globalThis.testSettingsFetch(...args);")))
  .replace('"./sharedRequest"', JSON.stringify(dataModule("export const sharedRequest = (_key, request) => request();")))));

test("updating graph settings sends only the camel-case dataSource", async () => {
  let request;
  globalThis.testSettingsFetch = async (url, options) => {
    request = { url, ...options };
    return new Response(null, { status: 200 });
  };
  const setting = { plotType: 1, asTotalReturn: true, bounds: null, dataSource: 0 };

  try {
    await api.updateGraphSetting(setting);
    assert.equal(request.method, "PUT");
    assert.deepEqual(JSON.parse(request.body), setting);
    assert.deepEqual(Object.keys(JSON.parse(request.body)).filter((key) => key.toLowerCase() === "datasource"), ["dataSource"]);
  } finally {
    delete globalThis.testSettingsFetch;
  }
});
