import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const sourcePath = fileURLToPath(
  new URL("../src/lib/displaySettingsRegistry.ts", import.meta.url),
);
const source = await readFile(sourcePath, "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
  },
});
const registry = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`
);

test("registered display values follow their schemas for both device profiles", () => {
  assert.equal(registry.isDisplaySettingAllowedForProfile("chart.security.logScale", "desktop"), true);
  assert.equal(registry.isDisplaySettingAllowedForProfile("chart.security.logScale", "mobile"), true);
  assert.equal(registry.decodeDisplaySetting("chart.security.logScale", "true"), true);
  assert.equal(registry.isValidDisplaySettingValue("chart.security.cardDistance", 20), true);
  assert.equal(registry.isValidDisplaySettingValue("chart.security.cardDistance", 19), false);
  assert.equal(registry.isValidDisplaySettingValue("chart.security.hover.behavior", "dynamic"), true);
  assert.equal(registry.isValidDisplaySettingValue("chart.security.hover.behavior", "sometimes"), false);
});

test("unregistered keys and invalid stored values are rejected", () => {
  assert.equal(registry.isDisplaySettingAllowedForProfile("security/123/logScale", "desktop"), false);
  assert.equal(registry.decodeDisplaySetting("chart.security.logScale", "1"), null);
  assert.equal(registry.decodeDisplaySetting("chart.security.cardDistance", "49"), null);
  assert.throws(() =>
    registry.encodeDisplaySetting("chart.security.logScale", "true"),
  );
});
