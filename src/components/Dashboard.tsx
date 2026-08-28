import { useEffect, useRef, useState } from "react";
import { ArrowDownRight, ArrowUpRight, BarChart3, BriefcaseBusiness, ChevronDown, Eye, Search, TrendingUp } from "lucide-react";
import { searchSecuritiesExternally, searchSecuritiesInternally, type SearchResult } from "@/api/dashboardApi";

interface Mover {
  symbol: string;
  name: string;
  price: string;
  change: number;
}

const marketWinners: Mover[] = [
  { symbol: "NVDA", name: "NVIDIA Corporation", price: "$875.28", change: 4.82 },
  { symbol: "TSLA", name: "Tesla, Inc.", price: "$193.57", change: 3.46 },
  { symbol: "AMD", name: "Advanced Micro Devices", price: "$168.12", change: 2.91 },
  { symbol: "SHOP", name: "Shopify Inc.", price: "$76.84", change: 2.24 },
];

const marketLosers: Mover[] = [
  { symbol: "DIS", name: "The Walt Disney Company", price: "$111.36", change: -1.72 },
  { symbol: "PFE", name: "Pfizer Inc.", price: "$27.43", change: -2.18 },
  { symbol: "INTC", name: "Intel Corporation", price: "$42.19", change: -3.05 },
  { symbol: "BABA", name: "Alibaba Group", price: "$72.09", change: -4.41 },
];

const holdingWinners: Mover[] = [
  { symbol: "MSFT", name: "Microsoft Corporation", price: "$418.47", change: 2.31 },
  { symbol: "VOO", name: "Vanguard S&P 500 ETF", price: "$482.16", change: 1.15 },
  { symbol: "AAPL", name: "Apple Inc.", price: "$190.90", change: 0.82 },
  { symbol: "NESN", name: "Nestlé S.A.", price: "$105.40", change: 0.36 },
];

const holdingLosers: Mover[] = [
  { symbol: "V", name: "Visa Inc.", price: "$276.80", change: -0.48 },
  { symbol: "JNJ", name: "Johnson & Johnson", price: "$156.12", change: -0.91 },
  { symbol: "ENPH", name: "Enphase Energy", price: "$115.70", change: -1.73 },
  { symbol: "PYPL", name: "PayPal Holdings", price: "$63.55", change: -2.16 },
];

const holdingAllocation = [
  { name: "AAPL", value: 24, color: "#5eead4" },
  { name: "VOO", value: 22, color: "#60a5fa" },
  { name: "MSFT", value: 19, color: "#a78bfa" },
  { name: "NVDA", value: 15, color: "#fbbf24" },
  { name: "TSLA", value: 11, color: "#fb7185" },
  { name: "BTC", value: 9, color: "#c084fc" },
];

function uniqueBySymbol(results: SearchResult[]) {
  const seen = new Set<string>();
  return results.filter((result) => {
    const symbol = result.symbol.toUpperCase();
    if (seen.has(symbol)) return false;
    seen.add(symbol);
    return true;
  });
}

function securityTypeLabel(securityType: number) {
  return { 1: "Stock", 2: "ETF", 3: "Cryptocurrency", 4: "CurrencyPair" }[securityType] ?? "Security";
}

function SecurityResult({ result }: { result: SearchResult }) {
  return (
    <button className="w-full rounded-xl px-3 py-3 text-left transition-colors hover:bg-slate-800/80">
      <p className="min-w-0 truncate font-semibold text-slate-100">{result.name}</p>
      <div className="mt-1 flex flex-col items-end gap-0.5">
        <span className="text-xs text-slate-400">{result.exchangeShortName || result.exchange}</span>
        <div className="flex items-center gap-2">
          <span className="!text-[11px] font-medium text-slate-500">{result.symbol}</span>
          <span className="rounded-md bg-slate-700/70 px-1.5 py-0.5 !text-[9px] font-medium uppercase tracking-wide text-slate-300">{securityTypeLabel(result.securityType)}</span>
        </div>
      </div>
    </button>
  );
}

function MoversCard({ title, icon: Icon, winners, losers }: { title: string; icon: typeof TrendingUp; winners: Mover[]; losers: Mover[] }) {
  return (
    <section className="rounded-2xl border border-sky-200/10 bg-slate-900/60 p-5 shadow-xl shadow-slate-950/20 backdrop-blur-sm">
      <div className="mb-5 flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-sky-400/10 text-sky-300"><Icon size={20} /></span>
        <div><h2 className="font-semibold text-slate-100">{title}</h2><p className="text-sm text-slate-400">Today&apos;s movement</p></div>
      </div>
      <div className="space-y-1">
        {winners.map((mover) => <MoverRow key={mover.symbol} mover={mover} />)}
        <div className="my-3 border-t border-slate-700/70" />
        {losers.map((mover) => <MoverRow key={mover.symbol} mover={mover} />)}
      </div>
    </section>
  );
}

function MoverRow({ mover }: { mover: Mover }) {
  const positive = mover.change > 0;
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl px-2 py-2.5 hover:bg-slate-800/50">
      <p className="min-w-0 truncate font-medium text-slate-100">{mover.name}</p>
      <div className="flex shrink-0 items-center gap-4 text-right"><p className="text-sm text-slate-300">{mover.price}</p><span className={`flex min-w-18 items-center justify-end gap-0.5 text-sm font-semibold ${positive ? "text-emerald-400" : "text-rose-400"}`}>{positive ? <ArrowUpRight size={15} /> : <ArrowDownRight size={15} />}{Math.abs(mover.change).toFixed(2)}%</span></div>
    </div>
  );
}

export default function Dashboard() {
  const [query, setQuery] = useState("");
  const [known, setKnown] = useState<SearchResult[]>([]);
  const [unknown, setUnknown] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const [includeUnknown, setIncludeUnknown] = useState(true);
  const [hoveredColumn, setHoveredColumn] = useState<"known" | "unknown" | null>(null);
  const requestRef = useRef(0);

  useEffect(() => {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      setKnown([]); setUnknown([]); setIsSearching(false); setSearchError(false);
      return;
    }

    const controller = new AbortController();
    const requestId = ++requestRef.current;
    const timer = window.setTimeout(async () => {
      setIsSearching(true); setSearchError(false);
      try {
        const [internal, external] = await Promise.all([
          searchSecuritiesInternally(trimmedQuery, controller.signal),
          includeUnknown ? searchSecuritiesExternally(trimmedQuery, controller.signal) : Promise.resolve([]),
        ]);
        if (requestId !== requestRef.current) return;
        const uniqueKnown = uniqueBySymbol(internal);
        const knownSymbols = new Set(uniqueKnown.map((result) => result.symbol.toUpperCase()));
        setKnown(uniqueKnown);
        setUnknown(uniqueBySymbol(external).filter((result) => !knownSymbols.has(result.symbol.toUpperCase())));
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        if (requestId === requestRef.current) { setKnown([]); setUnknown([]); setSearchError(true); }
      } finally {
        if (requestId === requestRef.current) setIsSearching(false);
      }
    }, 300);

    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [query, includeUnknown]);

  const hasSearchContent = query.trim().length > 0;
  let chartStart = 0;
  const chartStops = holdingAllocation.map((holding) => {
    const chartEnd = chartStart + holding.value * 3.6;
    const stop = `${holding.color} ${chartStart}deg ${chartEnd}deg`;
    chartStart = chartEnd;
    return stop;
  }).join(", ");
  const activeColumn = includeUnknown ? hoveredColumn : "known";

  return (
    <main className="min-h-screen bg-[#02182c] text-slate-100">
      <div className="mx-auto w-full max-w-[1440px] px-5 pb-12 pt-6 sm:px-8 lg:px-10">
        <header className="relative z-20 flex flex-col gap-5 border-b border-sky-100/10 pb-6 lg:grid lg:grid-cols-[minmax(150px,1fr)_minmax(620px,2.4fr)_minmax(150px,1fr)] lg:items-center">
          <a href="/dashboard" className="text-2xl font-bold tracking-tight text-white">Qlarissa<span className="text-sky-400">.</span></a>
          <div className="relative">
            <div className="flex items-center gap-3 rounded-xl border border-sky-200/15 bg-slate-900/70 px-4 shadow-lg shadow-slate-950/20 focus-within:border-sky-400/60">
              <Search size={19} className="shrink-0 text-sky-300" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} className="h-12 w-full bg-transparent text-base text-white outline-none placeholder:text-slate-500" placeholder="Search securities by name or symbol" aria-label="Search securities" />
              {isSearching && <span className="h-4 w-4 animate-spin rounded-full border-2 border-sky-300 border-t-transparent" />}
              <span className="group relative shrink-0">
                <button type="button" aria-label="Toggle search for unknown securities" aria-pressed={includeUnknown} onClick={() => { setIncludeUnknown((enabled) => !enabled); setHoveredColumn(null); }} className={`grid h-8 w-8 place-items-center rounded-lg transition-colors ${includeUnknown ? "bg-sky-400/15 text-sky-300 hover:bg-sky-400/25" : "text-slate-500 hover:bg-slate-800 hover:text-slate-300"}`}>
                  <Eye size={18} fill={includeUnknown ? "currentColor" : "none"} />
                </button>
                <span role="tooltip" className="pointer-events-none absolute right-0 top-full z-30 mt-2 w-56 rounded-lg border border-sky-200/15 bg-[#08243d] px-3 py-2 text-center !text-xs leading-relaxed text-slate-300 opacity-0 shadow-xl transition-opacity group-hover:opacity-100">Search securities not currently part of Qlarissa&apos;s database</span>
              </span>
            </div>
            {hasSearchContent && (
              <div className="absolute left-0 right-0 top-[calc(100%+10px)] overflow-hidden rounded-2xl border border-sky-200/15 bg-[#08243d] shadow-2xl shadow-slate-950/50">
                {searchError ? <p className="p-5 text-center text-sm text-slate-400">Search is temporarily unavailable. Please try again.</p> : <div className="relative flex flex-col divide-y divide-slate-700/60 sm:flex-row sm:divide-x sm:divide-y-0" onMouseLeave={() => setHoveredColumn(null)}>
                  <div className={`min-w-0 overflow-hidden p-3 transition-[width] duration-700 ease-in-out ${activeColumn === "known" ? "sm:w-full" : activeColumn === "unknown" ? "sm:w-0" : "sm:w-1/2"}`} onMouseEnter={() => setHoveredColumn("known")}><p className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-sky-300">Securities</p>{known.length ? known.map((result) => <SecurityResult key={`${result.symbol}-${result.exchangeShortName}`} result={result} />) : !isSearching && <p className="px-3 py-5 text-sm text-slate-500">No securities found.</p>}</div>
                  {includeUnknown && <div className={`min-w-0 overflow-hidden p-3 transition-[width] duration-700 ease-in-out ${activeColumn === "unknown" ? "sm:w-full" : activeColumn === "known" ? "sm:w-0" : "sm:w-1/2"}`} onMouseEnter={() => setHoveredColumn("unknown")}><p className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-violet-300">Unknown Securities</p>{unknown.length ? unknown.map((result) => <SecurityResult key={`${result.symbol}-${result.exchangeShortName}`} result={result} />) : !isSearching && <p className="px-3 py-5 text-sm text-slate-500">No additional securities found.</p>}</div>}
                  {includeUnknown && hoveredColumn === null && <div className="pointer-events-auto absolute left-1/2 top-0 hidden h-full w-16 -translate-x-1/2 sm:block" onMouseEnter={() => setHoveredColumn(null)} aria-hidden="true" />}
                </div>}
              </div>
            )}
          </div>
          <div className="flex items-center justify-start gap-3 lg:justify-end"><span className="hidden text-sm text-slate-400 sm:block">Your portfolio</span><button className="flex items-center gap-2 rounded-xl border border-sky-200/15 bg-slate-900/60 px-3 py-2 text-sm font-medium hover:bg-slate-800"><span className="grid h-7 w-7 place-items-center rounded-lg bg-sky-400/15 text-xs text-sky-200">SB</span><ChevronDown size={16} className="text-slate-400" /></button></div>
        </header>

        <section className="grid gap-5 py-8 xl:grid-cols-[1fr_1fr_1.45fr]">
          <MoversCard title="Daily watch list" icon={BarChart3} winners={marketWinners} losers={marketLosers} />
          <MoversCard title="Your holdings" icon={BriefcaseBusiness} winners={holdingWinners} losers={holdingLosers} />
          <section className="rounded-2xl border border-sky-200/10 bg-slate-900/60 p-6 shadow-xl shadow-slate-950/20 xl:row-span-1"><div><h2 className="font-semibold text-slate-100">Holdings allocation</h2><p className="mt-1 text-sm text-slate-400">Portfolio by individual security</p></div><div className="relative mx-auto my-8 grid h-64 w-64 place-items-center rounded-full" style={{ background: `conic-gradient(${chartStops})` }}><div className="grid h-44 w-44 place-items-center rounded-full bg-[#08243d] text-center"><div><p className="!text-xs text-slate-400">Portfolio value</p><p className="mt-1 text-2xl font-semibold text-white">$24,860.40</p><p className="mt-2 flex items-center justify-center gap-1 !text-xs font-medium text-emerald-400"><ArrowUpRight size={14} />$438.20 (1.79%)</p></div></div></div><div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">{holdingAllocation.map((holding) => <div key={holding.name} className="flex items-center gap-2 text-xs text-slate-400"><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: holding.color }} /><span>{holding.name}</span><span className="ml-auto text-slate-200">{holding.value}%</span></div>)}</div></section>
        </section>
      </div>
    </main>
  );
}
