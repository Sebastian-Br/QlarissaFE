import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const sourcePath = fileURLToPath(
  new URL("../src/lib/pinnedWatchlists.ts", import.meta.url),
);
const source = await readFile(sourcePath, "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
  },
});
const pinnedWatchlists = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`
);
const currencySource = await readFile(new URL("../src/lib/currency.ts", import.meta.url), "utf8");
const currencyOutput = ts.transpileModule(currencySource, {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { formatWatchlistPrice } = await import(
  `data:text/javascript;base64,${Buffer.from(currencyOutput).toString("base64")}`
);

function createWatchlist(id, pinPosition, watchedSecurities) {
  return {
    id,
    name: `List ${id}`,
    isPrimary: false,
    isSecondary: false,
    isPinned: true,
    pinPosition,
    trackedChangeDurationTradingDays: 1,
    watchedSecurities,
  };
}

test("pinned watchlists sort by position and union duplicate symbols", () => {
  const second = createWatchlist(2, 2, [
    { securityId: 3, symbol: "abc", name: "ABC", previousClosePrice: 10 },
  ]);
  const first = createWatchlist(1, 1, [
    { securityId: 4, symbol: " ABC ", name: "ABC", previousClosePrice: 10 },
    { securityId: 5, symbol: "XYZ", name: "XYZ", previousClosePrice: 20 },
  ]);

  assert.deepEqual(
    pinnedWatchlists.sortPinnedWatchlists([second, first]).map(({ id }) => id),
    [1, 2],
  );
  assert.deepEqual(
    pinnedWatchlists.getPinnedWatchlistSymbols([first, second]),
    ["ABC", "XYZ"],
  );
});

test("movers rank live percentage change and ignore invalid prices or baselines", () => {
  const watchlist = createWatchlist(1, 1, [
    { securityId: 1, symbol: "WIN", name: "Winner", currencySymbol: "USD", previousClosePrice: 100 },
    { securityId: 2, symbol: "LOSE", name: "Loser", previousClosePrice: 50 },
    { securityId: 3, symbol: "ZERO", name: "Invalid baseline", previousClosePrice: 0 },
    { securityId: 4, symbol: "MISSING", name: "Missing live price", previousClosePrice: 10 },
  ]);
  const prices = new Map([
    ["WIN", { symbol: "WIN", timestamp: "", price: 110 }],
    ["LOSE", { symbol: "LOSE", timestamp: "", price: 45 }],
    ["ZERO", { symbol: "ZERO", timestamp: "", price: 20 }],
  ]);

  const movers = pinnedWatchlists.rankWatchlistMovers(watchlist, prices, 5);

  assert.equal(movers.winners[0].change, 10);
  assert.equal(movers.winners[0].currencySymbol, "USD");
  assert.equal(movers.losers[0].change, -10);
  assert.equal(movers.validPriceCount, 2);
  assert.deepEqual(
    [...movers.winners, ...movers.losers].map(({ securityId }) => securityId),
    [1, 2],
  );
});

test("watchlist prices show their currency and do not invent one when absent", () => {
  const usd = new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" })
    .formatToParts(123.45).map((part) => part.type === "currency" ? "$" : part.value).join("");
  const eur = new Intl.NumberFormat(undefined, { style: "currency", currency: "EUR" }).format(123.45);
  const jpy = new Intl.NumberFormat(undefined, { style: "currency", currency: "JPY" }).format(123.45);
  const amount = new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(123.45);
  assert.equal(formatWatchlistPrice(123.45, "USD"), usd);
  assert.ok(formatWatchlistPrice(123.45, "USD").includes("$"));
  assert.ok(!formatWatchlistPrice(123.45, "USD").includes("US$"));
  assert.equal(formatWatchlistPrice(123.45, "EUR"), eur);
  assert.equal(formatWatchlistPrice(123.45, "JPY"), jpy);
  assert.equal(formatWatchlistPrice(123.45), amount);
  assert.equal(formatWatchlistPrice(123.45, "€"), `€ ${amount}`);
});

test("valid unchanged and one-sided prices are distinct from unavailable prices", () => {
  const watchlist = createWatchlist(1, 1, [
    { securityId: 1, symbol: "SAME", name: "Unchanged", previousClosePrice: 100 },
    { securityId: 2, symbol: "DOWN", name: "Down", previousClosePrice: 100 },
  ]);
  const prices = new Map([
    ["SAME", { symbol: "SAME", timestamp: "", price: 100 }],
    ["DOWN", { symbol: "DOWN", timestamp: "", price: 90 }],
  ]);

  const movers = pinnedWatchlists.rankWatchlistMovers(watchlist, prices, 5);
  assert.equal(movers.validPriceCount, 2);
  assert.equal(movers.winners.length, 0);
  assert.equal(movers.losers.length, 1);
  assert.equal(pinnedWatchlists.rankWatchlistMovers(watchlist, new Map(), 5).validPriceCount, 0);
});

test("missing live price indicator excludes other reasons securities are hidden", () => {
  const watchlist = createWatchlist(1, 1, [
    { securityId: 1, symbol: " SAME ", name: "Unchanged", previousClosePrice: 100 },
    { securityId: 2, symbol: "BASE", name: "Invalid baseline", previousClosePrice: 0 },
    { securityId: 3, symbol: "MISS", name: "Missing live price", previousClosePrice: 100 },
  ]);
  const prices = new Map([
    ["SAME", { symbol: "SAME", timestamp: "", price: 100 }],
    ["BASE", { symbol: "BASE", timestamp: "", price: 110 }],
  ]);

  assert.equal(pinnedWatchlists.rankWatchlistMovers(watchlist, prices, 5).hasMissingLivePrices, true);
  prices.set("MISS", { symbol: "MISS", timestamp: "", price: 0 });
  assert.equal(pinnedWatchlists.rankWatchlistMovers(watchlist, prices, 5).hasMissingLivePrices, true);
  prices.set("MISS", { symbol: "MISS", timestamp: "", price: 110 });
  assert.equal(pinnedWatchlists.rankWatchlistMovers(watchlist, prices, 0).hasMissingLivePrices, false);
  assert.equal(pinnedWatchlists.rankWatchlistMovers(createWatchlist(2, 2, []), prices, 5).hasMissingLivePrices, false);
});

test("movers retain the five strongest results in each direction", () => {
  const securities = Array.from({ length: 12 }, (_, index) => ({
    securityId: index,
    symbol: `S${index}`,
    name: `Security ${index}`,
    previousClosePrice: 100,
  }));
  const prices = new Map(securities.map((security, index) => [
    security.symbol,
    { symbol: security.symbol, timestamp: "", price: index < 6 ? 101 + index : 99 - (index - 6) },
  ]));

  const { winners, losers } = pinnedWatchlists.rankWatchlistMovers(
    createWatchlist(1, 1, securities), prices, 5,
  );
  assert.deepEqual(winners.map(({ securityId }) => securityId), [5, 4, 3, 2, 1]);
  assert.deepEqual(losers.map(({ securityId }) => securityId), [7, 8, 9, 10, 11]);
});

test("drag reordering returns consecutive positions without mutating input", () => {
  const items = [
    createWatchlist(1, 1, []),
    createWatchlist(2, 2, []),
    createWatchlist(3, 3, []),
  ];

  const reordered = pinnedWatchlists.movePinnedWatchlist(items, 3, 0);

  assert.deepEqual(reordered.map(({ id, pinPosition }) => [id, pinPosition]), [
    [3, 1],
    [1, 2],
    [2, 3],
  ]);
  assert.deepEqual(items.map(({ id }) => id), [1, 2, 3]);
});
