import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ExternalLink, Info, LineChart, Minus, Plus, RefreshCw } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { getSecurity } from "@/api/securityApi";
import { SecurityType, type DailyPrice, type ETF, type PubliclyTradedSecurityBase, type Security, type Stock } from "@/models/Security";

const typeNames: Record<SecurityType, string> = {
  [SecurityType.Stock]: "Stock",
  [SecurityType.ETF]: "ETF",
  [SecurityType.Cryptocurrency]: "Cryptocurrency",
  [SecurityType.CurrencyPair]: "Currency pair",
};

const dateFormatter = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" });
const numberFormatter = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });
const compactFormatter = new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 2 });

function formatDate(value: string) {
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : dateFormatter.format(date);
}

function formatPrice(value: number, security: PubliclyTradedSecurityBase) {
  return `${security.currency?.symbol ?? ""}${numberFormatter.format(value)}`;
}

function Chart({ security }: { security: PubliclyTradedSecurityBase }) {
  const history = useMemo(() => [...(security.priceHistory ?? [])].sort((a, b) => a.date.localeCompare(b.date)), [security.priceHistory]);
  const [startDate, setStartDate] = useState(history[0]?.date ?? "");
  const [endDate, setEndDate] = useState(history.at(-1)?.date ?? "");
  const [logScale, setLogScale] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [hovered, setHovered] = useState<DailyPrice | null>(null);

  useEffect(() => {
    setStartDate(history[0]?.date ?? "");
    setEndDate(history.at(-1)?.date ?? "");
    setZoom(1);
  }, [history]);

  const filteredHistory = useMemo(() => history.filter((price) => (!startDate || price.date >= startDate) && (!endDate || price.date <= endDate)), [endDate, history, startDate]);
  const visibleHistory = useMemo(() => {
    const count = Math.max(2, Math.ceil(filteredHistory.length / zoom));
    return filteredHistory.slice(-count);
  }, [filteredHistory, zoom]);
  const values = visibleHistory.map((item) => item.average).filter((value) => Number.isFinite(value));
  const canUseLog = logScale && values.every((value) => value > 0);
  const transformedValues = values.map((value) => canUseLog ? Math.log10(value) : value);
  const min = Math.min(...transformedValues, 0);
  const max = Math.max(...transformedValues, 1);
  const range = max - min || 1;
  const x = (index: number) => visibleHistory.length < 2 ? 50 : (index / (visibleHistory.length - 1)) * 100;
  const y = (value: number) => 92 - (((canUseLog ? Math.log10(value) : value) - min) / range) * 82;
  const path = visibleHistory.map((point, index) => `${index === 0 ? "M" : "L"} ${x(index)} ${y(point.average)}`).join(" ");
  const hoverIndex = hovered ? visibleHistory.findIndex((point) => point.id === hovered.id) : -1;

  return <section className="rounded-2xl border border-sky-200/15 bg-slate-900/60 p-5 shadow-xl shadow-slate-950/20 backdrop-blur-sm sm:p-7">
    <div className="flex flex-col justify-between gap-5 xl:flex-row xl:items-start">
      <div><div className="flex items-center gap-2"><span className="grid h-9 w-9 place-items-center rounded-xl bg-sky-400/15 text-sky-300"><LineChart size={19} /></span><div><h2 className="font-semibold text-white">Price history</h2><p className="text-sm text-slate-400">Daily average price</p></div></div></div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="grid gap-1 text-xs font-medium text-slate-400">Start<input aria-label="Chart start date" type="date" value={startDate} min={history[0]?.date} max={endDate || undefined} onChange={(event) => setStartDate(event.target.value)} className="h-9 rounded-lg border border-sky-200/15 bg-[#08243d] px-2 text-sm text-slate-100 outline-none focus:border-sky-400" /></label>
        <label className="grid gap-1 text-xs font-medium text-slate-400">End<input aria-label="Chart end date" type="date" value={endDate} min={startDate || undefined} max={history.at(-1)?.date} onChange={(event) => setEndDate(event.target.value)} className="h-9 rounded-lg border border-sky-200/15 bg-[#08243d] px-2 text-sm text-slate-100 outline-none focus:border-sky-400" /></label>
        <button type="button" aria-label="Toggle logarithmic scale" aria-pressed={logScale} onClick={() => setLogScale((current) => !current)} className={`h-9 rounded-lg px-3 text-sm font-semibold transition-colors ${logScale ? "bg-sky-400 text-slate-950" : "border border-sky-200/15 text-slate-300 hover:bg-slate-800"}`}>Log scale</button>
        <div className="flex overflow-hidden rounded-lg border border-sky-200/15"><button type="button" aria-label="Zoom out" disabled={zoom === 1} onClick={() => setZoom((current) => Math.max(1, current / 2))} className="grid h-9 w-9 place-items-center text-slate-300 hover:bg-slate-800 disabled:cursor-not-allowed disabled:text-slate-600"><Minus size={17} /></button><button type="button" aria-label="Zoom in" disabled={zoom >= 16 || visibleHistory.length < 3} onClick={() => setZoom((current) => Math.min(16, current * 2))} className="grid h-9 w-9 place-items-center border-l border-sky-200/15 text-slate-300 hover:bg-slate-800 disabled:cursor-not-allowed disabled:text-slate-600"><Plus size={17} /></button></div>
      </div>
    </div>
    {visibleHistory.length > 1 ? <div className="relative mt-8 h-[360px] rounded-xl border border-sky-200/10 bg-[#061d32] p-3">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label={`${security.name} price history chart`} className="h-full w-full overflow-visible" onMouseLeave={() => setHovered(null)} onMouseMove={(event) => { const box = event.currentTarget.getBoundingClientRect(); const position = (event.clientX - box.left) / box.width; const index = Math.round(Math.max(0, Math.min(1, position)) * (visibleHistory.length - 1)); setHovered(visibleHistory[index]); }}>
        {[20, 40, 60, 80].map((line) => <line key={line} x1="0" x2="100" y1={line} y2={line} stroke="#7dd3fc" strokeOpacity="0.12" vectorEffect="non-scaling-stroke" />)}
        <path d={path} fill="none" stroke="#38bdf8" strokeWidth="0.75" vectorEffect="non-scaling-stroke" />
        {hoverIndex >= 0 && <><line x1={x(hoverIndex)} x2={x(hoverIndex)} y1="10" y2="92" stroke="#e0f2fe" strokeOpacity="0.45" strokeWidth="0.35" vectorEffect="non-scaling-stroke" /><circle cx={x(hoverIndex)} cy={y(hovered!.average)} r="1.35" fill="#e0f2fe" /></>}
      </svg>
      <div className="pointer-events-none absolute bottom-3 left-4 right-4 flex justify-between text-xs text-slate-500"><span>{formatDate(visibleHistory[0].date)}</span><span>{formatDate(visibleHistory.at(-1)!.date)}</span></div>
      {hovered && <div className="pointer-events-none absolute right-5 top-5 rounded-xl border border-sky-200/20 bg-[#08243d]/95 px-4 py-3 shadow-xl"><p className="text-xs text-slate-400">{formatDate(hovered.date)}</p><p className="mt-1 font-semibold text-white">{formatPrice(hovered.average, security)}</p><div className="mt-2 grid grid-cols-2 gap-x-5 gap-y-1 text-xs"><span className="text-slate-400">High <b className="ml-1 text-emerald-300">{formatPrice(hovered.high, security)}</b></span><span className="text-slate-400">Low <b className="ml-1 text-rose-300">{formatPrice(hovered.low, security)}</b></span></div></div>}
    </div> : <div className="mt-8 grid h-[360px] place-items-center rounded-xl border border-dashed border-sky-200/15 bg-[#061d32] text-center"><div><Info className="mx-auto text-sky-300" size={22} /><p className="mt-3 font-medium text-slate-200">Not enough price data</p><p className="mt-1 text-sm text-slate-500">At least two daily prices are needed to draw the chart.</p></div></div>}
    <div className="mt-4 flex items-center justify-between text-xs text-slate-500"><span>{visibleHistory.length} of {filteredHistory.length} data points</span><span>{canUseLog ? "Logarithmic scale" : "Linear scale"}</span></div>
  </section>;
}

function DetailCard({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="rounded-2xl border border-sky-200/15 bg-slate-900/60 p-5 shadow-xl shadow-slate-950/20 backdrop-blur-sm"><h2 className="text-sm font-semibold uppercase tracking-wider text-sky-300">{title}</h2><div className="mt-4">{children}</div></section>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="flex items-baseline justify-between gap-3 border-b border-slate-700/50 py-2.5 last:border-0"><span className="text-sm text-slate-400">{label}</span><span className="text-right text-sm font-medium text-slate-100">{value}</span></div>;
}

function TypeSpecificDetails({ security }: { security: Security }) {
  if (security.securityType === SecurityType.Stock) {
    const stock = security as Stock;
    return <><DetailCard title="Stock metrics"><Metric label="ISIN" value={stock.isin || "—"} /><Metric label="Shares outstanding" value={stock.sharesOutstanding ? compactFormatter.format(stock.sharesOutstanding) : "—"} /><Metric label="Dividend rate" value={stock.dividendRate ? formatPrice(stock.dividendRate, stock) : "—"} /><Metric label="Target mean price" value={stock.targetMeanPrice ? formatPrice(stock.targetMeanPrice, stock) : "—"} /><Metric label="Recommendation mean" value={stock.recommendationMean ? numberFormatter.format(stock.recommendationMean) : "—"} /></DetailCard>{stock.businessSummary && <DetailCard title="Business summary"><p className="text-sm leading-7 text-slate-300">{stock.businessSummary}</p>{stock.investorRelationsURL && <a href={stock.investorRelationsURL} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-sky-300 hover:text-sky-200">Investor relations <ExternalLink size={14} /></a>}</DetailCard>}<Events title="Dividend payouts" events={stock.dividendPayouts} security={stock} /><Splits splits={stock.splits} /></>;
  }
  if (security.securityType === SecurityType.ETF) {
    const etf = security as ETF;
    return <><DetailCard title="ETF metrics"><Metric label="ISIN" value={etf.isin || "—"} /><Metric label="Net expense ratio" value={etf.netExpenseRatio ? `${numberFormatter.format(etf.netExpenseRatio)}%` : "—"} /><Metric label="Dividend yield" value={etf.dividendYield ? `${numberFormatter.format(etf.dividendYield)}%` : "—"} /></DetailCard><Events title="Distribution events" events={etf.distributionEvents} security={etf} /><Splits splits={etf.splits} /></>;
  }
  if (security.securityType === SecurityType.Cryptocurrency) return <DetailCard title="Cryptocurrency metrics"><Metric label="Market capitalization" value={security.marketCapitalization ? formatPrice(security.marketCapitalization, security) : "—"} /></DetailCard>;
  return <DetailCard title="Currency pair"><Metric label="Base currency" value={security.symbol} /><Metric label="Quote currency" value={security.currency?.name ?? security.currency?.symbol ?? "—"} /></DetailCard>;
}

function Events({ title, events, security }: { title: string; events: { id: number; payoutDate: string; payoutAmount: number }[]; security: PubliclyTradedSecurityBase }) {
  if (!events?.length) return null;
  return <DetailCard title={title}><div className="space-y-2">{events.map((event) => <div key={event.id} className="flex items-center justify-between text-sm"><span className="text-slate-400">{formatDate(event.payoutDate)}</span><span className="font-medium text-emerald-300">{formatPrice(event.payoutAmount, security)}</span></div>)}</div></DetailCard>;
}

function Splits({ splits }: { splits: { id: number; date: string; splitRatio: number }[] }) {
  if (!splits?.length) return null;
  return <DetailCard title="Splits"><div className="space-y-2">{splits.map((split) => <div key={split.id} className="flex items-center justify-between text-sm"><span className="text-slate-400">{formatDate(split.date)}</span><span className="font-medium text-slate-100">{numberFormatter.format(split.splitRatio)}:1</span></div>)}</div></DetailCard>;
}

export default function SecurityDetail() {
  const { id } = useParams();
  const securityId = Number(id);
  const [security, setSecurity] = useState<Security | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!Number.isInteger(securityId) || securityId < 1) { setError(true); return; }
    const controller = new AbortController();
    setSecurity(null); setError(false);
    getSecurity(securityId, controller.signal).then(setSecurity).catch((cause) => { if (!(cause instanceof DOMException && cause.name === "AbortError")) setError(true); });
    return () => controller.abort();
  }, [securityId]);

  return <main className="min-h-screen bg-[#02182c] text-slate-100"><div className="mx-auto w-full max-w-[1500px] px-5 py-6 sm:px-8 lg:px-12"><header className="flex items-center justify-between border-b border-sky-100/10 pb-6"><Link to="/dashboard" className="text-2xl font-bold tracking-tight text-white">Qlarissa<span className="text-sky-400">.</span></Link><Link to="/dashboard" className="inline-flex items-center gap-2 rounded-xl border border-sky-200/15 px-3 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"><ArrowLeft size={16} />Dashboard</Link></header>{!security && !error && <div className="grid min-h-[65vh] place-items-center"><div className="text-center"><RefreshCw className="mx-auto animate-spin text-sky-300" size={26} /><p className="mt-4 text-slate-400">Loading security…</p></div></div>}{error && <div className="grid min-h-[65vh] place-items-center text-center"><div><Info className="mx-auto text-rose-300" size={28} /><h1 className="mt-4 text-xl font-semibold text-white">Security unavailable</h1><p className="mt-2 text-slate-400">This security could not be loaded. Please return to the dashboard and try again.</p></div></div>}{security && <div className="py-8"><section className="flex flex-col justify-between gap-6 rounded-2xl border border-sky-200/15 bg-gradient-to-br from-slate-900/80 to-[#08243d] p-6 shadow-xl shadow-slate-950/20 sm:p-8 lg:flex-row lg:items-end"><div><div className="flex flex-wrap items-center gap-3"><span className="rounded-lg bg-sky-400/15 px-2.5 py-1 text-xs font-semibold uppercase tracking-wider text-sky-300">{typeNames[security.securityType]}</span><span className="text-sm text-slate-400">{security.exchangeShortName || security.exchangeName || "—"}</span></div><h1 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">{security.name}</h1><p className="mt-2 text-lg text-slate-400">{security.symbol} · {security.shortName}</p></div><div className="lg:text-right"><p className="text-sm text-slate-400">Current price</p><p className="mt-1 text-3xl font-semibold text-white">{formatPrice(security.price, security)}</p><p className="mt-2 text-xs text-slate-500">Updated {formatDate(security.priceLastUpdatedTime)}</p></div></section><div className="mt-6"><Chart security={security} /></div><div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1fr]"><div className="grid content-start gap-6"><DetailCard title="Market details"><Metric label="Symbol" value={security.symbol} /><Metric label="Exchange" value={security.exchangeName || "—"} /><Metric label="Currency" value={security.currency?.name ?? security.currency?.symbol ?? "—"} /><Metric label="Data last updated" value={formatDate(security.lastCompleteUpdateTime)} /></DetailCard></div><div className="grid content-start gap-6"><TypeSpecificDetails security={security} /></div></div></div>}</div></main>;
}
