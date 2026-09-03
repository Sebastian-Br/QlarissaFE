import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ExternalLink, Info, LineChart, RefreshCw } from "lucide-react";
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
const dateTimeFormatter = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "medium", timeZone: "UTC" });
const numberFormatter = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });
const compactFormatter = new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 2 });

function formatDate(value: string) {
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : dateFormatter.format(date);
}

function formatPrice(value: number, security: PubliclyTradedSecurityBase) {
  const currency = security.currency?.symbol ?? "";
  return `${currency ? `${currency} ` : ""}${numberFormatter.format(value)}`;
}

function formatDateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : `${dateTimeFormatter.format(date)} UTC`;
}

function Chart({ security }: { security: PubliclyTradedSecurityBase }) {
  const history = useMemo(() => [...(security.priceHistory ?? [])].sort((a, b) => a.date.localeCompare(b.date)), [security.priceHistory]);
  const [startDate, setStartDate] = useState(history[0]?.date ?? "");
  const [endDate, setEndDate] = useState(history.at(-1)?.date ?? "");
  const [logScale, setLogScale] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState(0);
  const [hovered, setHovered] = useState<{ point: DailyPrice; x: number; y: number } | null>(null);
  const dragRef = useRef<{ x: number; pan: number } | null>(null);

  useEffect(() => {
    setStartDate(history[0]?.date ?? "");
    setEndDate(history.at(-1)?.date ?? "");
    setZoom(1);
    setPan(0);
  }, [history]);

  const filteredHistory = useMemo(() => history.filter((price) => (!startDate || price.date >= startDate) && (!endDate || price.date <= endDate)), [endDate, history, startDate]);
  const pointCount = Math.max(2, Math.ceil(filteredHistory.length / zoom));
  const maxPan = Math.max(0, filteredHistory.length - pointCount);
  const windowStart = Math.max(0, filteredHistory.length - pointCount - pan);
  const visibleHistory = filteredHistory.slice(windowStart, windowStart + pointCount);
  const values = visibleHistory.map((item) => item.average).filter((value) => Number.isFinite(value));
  const canUseLog = logScale && values.every((value) => value > 0);
  const transformedValues = values.map((value) => canUseLog ? Math.log10(value) : value);
  const min = Math.min(...transformedValues, 0);
  const max = Math.max(...transformedValues, 1);
  const range = max - min || 1;
  const x = (index: number) => visibleHistory.length < 2 ? 55 : 10 + (index / (visibleHistory.length - 1)) * 87;
  const y = (value: number) => 86 - (((canUseLog ? Math.log10(value) : value) - min) / range) * 76;
  const path = visibleHistory.map((point, index) => `${index === 0 ? "M" : "L"} ${x(index)} ${y(point.average)}`).join(" ");
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((ratio) => ({ ratio, value: canUseLog ? 10 ** (min + range * ratio) : min + range * ratio }));
  const updateHover = (event: React.PointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const chartX = Math.max(10, Math.min(97, ((event.clientX - box.left) / box.width) * 100));
    const index = Math.round(((chartX - 10) / 87) * (visibleHistory.length - 1));
    const point = visibleHistory[Math.max(0, Math.min(visibleHistory.length - 1, index))];
    setHovered({ point, x: event.clientX - box.left, y: event.clientY - box.top });
  };
  const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    setZoom((current) => Math.max(1, Math.min(32, current * (event.deltaY > 0 ? 0.75 : 1.33))));
    setPan((current) => Math.min(current, Math.max(0, filteredHistory.length - Math.max(2, Math.ceil(filteredHistory.length / (event.deltaY > 0 ? 0.75 : 1.33))))));
  };
  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    updateHover(event);
    if (!dragRef.current) return;
    const box = event.currentTarget.getBoundingClientRect();
    const pointDelta = Math.round(((event.clientX - dragRef.current.x) / box.width) * filteredHistory.length);
    setPan(Math.max(0, Math.min(maxPan, dragRef.current.pan + pointDelta)));
  };

  return <section className="rounded-2xl border border-sky-200/15 bg-slate-900/60 p-5 shadow-xl shadow-slate-950/20 backdrop-blur-sm sm:p-7">
    <div className="flex flex-col justify-between gap-5 xl:flex-row xl:items-start"><div><div className="flex items-center gap-2"><span className="grid h-9 w-9 place-items-center rounded-xl bg-sky-400/15 text-sky-300"><LineChart size={19} /></span><div><h2 className="font-semibold text-white">Price history</h2><p className="text-sm text-slate-400">Scroll to zoom · drag to explore</p></div></div></div><div className="flex flex-wrap items-end gap-3"><label className="grid gap-1 text-xs font-medium text-slate-400">Start<input aria-label="Chart start date" type="date" value={startDate} min={history[0]?.date} max={endDate || undefined} onChange={(event) => { setStartDate(event.target.value); setPan(0); }} className="h-9 rounded-lg border border-sky-200/15 bg-[#08243d] px-2 text-sm text-slate-100 outline-none focus:border-sky-400" /></label><label className="grid gap-1 text-xs font-medium text-slate-400">End<input aria-label="Chart end date" type="date" value={endDate} min={startDate || undefined} max={history.at(-1)?.date} onChange={(event) => { setEndDate(event.target.value); setPan(0); }} className="h-9 rounded-lg border border-sky-200/15 bg-[#08243d] px-2 text-sm text-slate-100 outline-none focus:border-sky-400" /></label><button type="button" aria-label="Toggle logarithmic scale" aria-pressed={logScale} onClick={() => setLogScale((current) => !current)} className={`h-9 rounded-lg px-3 text-sm font-semibold transition-colors ${logScale ? "bg-sky-400 text-slate-950" : "border border-sky-200/15 text-slate-300 hover:bg-slate-800"}`}>Log scale</button></div></div>
    {visibleHistory.length > 1 ? <div className="relative mt-8 h-[390px] cursor-grab touch-none rounded-xl border border-sky-200/10 bg-[#061d32] p-3 active:cursor-grabbing" onWheel={handleWheel} onPointerLeave={() => setHovered(null)} onPointerMove={handlePointerMove} onPointerDown={(event) => { dragRef.current = { x: event.clientX, pan }; event.currentTarget.setPointerCapture(event.pointerId); }} onPointerUp={(event) => { dragRef.current = null; event.currentTarget.releasePointerCapture(event.pointerId); }}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label={`${security.name} price history chart`} className="h-full w-full overflow-visible">
        {yTicks.map(({ ratio, value }) => <g key={ratio}><line x1="10" x2="97" y1={86 - ratio * 76} y2={86 - ratio * 76} stroke="#7dd3fc" strokeOpacity="0.12" vectorEffect="non-scaling-stroke" /><text x="8" y={86 - ratio * 76 + 1.5} textAnchor="end" fill="#94a3b8" fontSize="3" vectorEffect="non-scaling-stroke">{numberFormatter.format(value)}</text></g>)}
        <line x1="10" x2="97" y1="86" y2="86" stroke="#7dd3fc" strokeOpacity="0.35" strokeWidth="0.4" vectorEffect="non-scaling-stroke" /><line x1="10" x2="10" y1="10" y2="86" stroke="#7dd3fc" strokeOpacity="0.35" strokeWidth="0.4" vectorEffect="non-scaling-stroke" /><path d={path} fill="none" stroke="#38bdf8" strokeWidth="0.75" vectorEffect="non-scaling-stroke" />
        {[0, Math.floor((visibleHistory.length - 1) / 2), visibleHistory.length - 1].map((index) => <text key={index} x={x(index)} y="94" textAnchor={index === 0 ? "start" : index === visibleHistory.length - 1 ? "end" : "middle"} fill="#94a3b8" fontSize="3" vectorEffect="non-scaling-stroke">{formatDate(visibleHistory[index].date)}</text>)}
      </svg>
      {hovered && <div className="pointer-events-none absolute z-10 min-w-[132px] -translate-x-1/2 -translate-y-full rounded-lg border border-sky-200/20 bg-[#08243d]/95 px-2.5 py-2 shadow-xl" style={{ left: hovered.x, top: Math.max(76, hovered.y - 8) }}><p className="text-[10px] text-slate-400">{formatDate(hovered.point.date)}</p><p className="font-semibold text-white">{formatPrice(hovered.point.average, security)}</p><p className="text-[10px] text-slate-400">High {formatPrice(hovered.point.high, security)} · Low {formatPrice(hovered.point.low, security)}</p></div>}
    </div> : <div className="mt-8 grid h-[360px] place-items-center rounded-xl border border-dashed border-sky-200/15 bg-[#061d32] text-center"><div><Info className="mx-auto text-sky-300" size={22} /><p className="mt-3 font-medium text-slate-200">Not enough price data</p><p className="mt-1 text-sm text-slate-500">At least two daily prices are needed to draw the chart.</p></div></div>}
    <div className="mt-4 flex items-center justify-between text-xs text-slate-500"><span>{visibleHistory.length} of {filteredHistory.length} data points</span><span>{canUseLog ? "Logarithmic scale" : "Linear scale"}</span></div>
  </section>;
}

function DetailCard({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="rounded-2xl border border-sky-200/15 bg-slate-900/60 p-5 shadow-xl shadow-slate-950/20 backdrop-blur-sm"><h2 className="text-sm font-semibold uppercase tracking-wider text-sky-300">{title}</h2><div className="mt-4">{children}</div></section>;
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
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
  if (security.securityType === SecurityType.Cryptocurrency) { const crypto = security as Extract<Security, { securityType: typeof SecurityType.Cryptocurrency }>; return <DetailCard title="Cryptocurrency metrics"><Metric label="Market capitalization" value={crypto.marketCapitalization ? formatPrice(crypto.marketCapitalization, crypto) : "—"} /></DetailCard>; }
  return <DetailCard title="Currency pair"><Metric label="Base currency" value={security.symbol} /><Metric label="Quote currency" value={security.currency?.symbol ?? "—"} /></DetailCard>;
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

  return <main className="min-h-screen bg-[#02182c] text-slate-100"><div className="mx-auto w-full max-w-[1500px] px-5 py-6 sm:px-8 lg:px-12"><header className="flex items-center justify-between border-b border-sky-100/10 pb-6"><Link to="/dashboard" className="text-2xl font-bold tracking-tight text-white">Qlarissa<span className="text-sky-400">.</span></Link><Link to="/dashboard" className="inline-flex items-center gap-2 rounded-xl border border-sky-200/15 px-3 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"><ArrowLeft size={16} />Dashboard</Link></header>{!security && !error && <div className="grid min-h-[65vh] place-items-center"><div className="text-center"><RefreshCw className="mx-auto animate-spin text-sky-300" size={26} /><p className="mt-4 text-slate-400">Loading security…</p></div></div>}{error && <div className="grid min-h-[65vh] place-items-center text-center"><div><Info className="mx-auto text-rose-300" size={28} /><h1 className="mt-4 text-xl font-semibold text-white">Security unavailable</h1><p className="mt-2 text-slate-400">This security could not be loaded. Please return to the dashboard and try again.</p></div></div>}{security && <div className="py-8"><section className="flex flex-col justify-between gap-6 rounded-2xl border border-sky-200/15 bg-gradient-to-br from-slate-900/80 to-[#08243d] p-6 shadow-xl shadow-slate-950/20 sm:p-8 lg:flex-row lg:items-end"><div><div className="flex flex-wrap items-center gap-3"><span className="rounded-lg bg-sky-400/15 px-2.5 py-1 text-xs font-semibold uppercase tracking-wider text-sky-300">{typeNames[security.securityType]}</span><span className="text-sm text-slate-400">{security.exchangeName || security.exchangeShortName || "—"}</span></div><h1 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">{security.name}</h1><p className="mt-2 text-lg text-slate-400">{security.symbol} · {security.shortName}</p></div><div className="lg:text-right"><p className="text-3xl font-semibold text-white">{formatPrice(security.price, security)}</p><p className="mt-2 text-xs text-slate-500">Updated {formatDateTime(security.priceLastUpdatedTime)}</p></div></section><div className="mt-6"><Chart security={security} /></div><div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1fr]"><div className="grid content-start gap-6"><DetailCard title="Market details"><Metric label="Exchange" value={security.exchangeName || "—"} /><Metric label="Currency" value={<span title={security.currency?.name || undefined}>{security.currency?.symbol ?? "—"}</span>} /><Metric label="Data last updated" value={<span title="All timestamps are UTC">{formatDateTime(security.lastCompleteUpdateTime)}</span>} /></DetailCard></div><div className="grid content-start gap-6"><TypeSpecificDetails security={security} /></div></div></div>}</div></main>;
}
