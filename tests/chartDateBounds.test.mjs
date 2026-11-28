import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../src/lib/chart/dateBounds.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
});
const { filterByDateBounds, getPriceChartHistory } = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`
);
const liveSource = await readFile(new URL("../src/lib/livePrices.ts", import.meta.url), "utf8");
const liveOutput = ts.transpileModule(liveSource, {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { mergeLivePriceIntoHistory } = await import(
  `data:text/javascript;base64,${Buffer.from(liveOutput).toString("base64")}`
);

test("date bounds are optional and inclusive, including timestamp dates", () => {
  const payouts = [
    { date: "2024-01-01T10:00:00Z" },
    { date: "2024-01-02T10:00:00Z" },
    { date: "2024-01-03T10:00:00Z" },
  ];
  const dates = (start, end) =>
    filterByDateBounds(payouts, (payout) => payout.date, start, end).map((payout) => payout.date.slice(0, 10));
  assert.deepEqual(dates("", ""), ["2024-01-01", "2024-01-02", "2024-01-03"]);
  assert.deepEqual(dates("2024-01-02", ""), ["2024-01-02", "2024-01-03"]);
  assert.deepEqual(dates("", "2024-01-02"), ["2024-01-01", "2024-01-02"]);
  assert.deepEqual(dates("2024-01-02", "2024-01-02"), ["2024-01-02"]);
  assert.deepEqual(dates("2025-01-01", ""), []);
});

test("live price updates remain visible inside date bounds", () => {
  const history = [
    { id: 1, date: "2024-01-01", open: 1, close: 1, high: 1, low: 1, average: 1 },
    { id: 2, date: "2024-01-02", open: 2, close: 2, high: 2, low: 2, average: 2 },
  ];
  const updated = mergeLivePriceIntoHistory(
    history, { symbol: "TEST", timestamp: "2024-01-02T12:00:00Z", price: 3 }, "2024-01-02",
  );
  assert.equal(getPriceChartHistory(updated, "2024-01-02", "")[0].average, 3);
  assert.equal(getPriceChartHistory(updated, "", "2024-01-02")[1].average, 3);
  assert.equal(getPriceChartHistory(updated, "2024-01-02", "2024-01-02")[0].average, 3);
  assert.deepEqual(getPriceChartHistory(updated, "", "2024-01-01"), [history[0]]);
  assert.equal(getPriceChartHistory(updated, "", "")[1].average, 3);
});
