import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
const axisNumberFormatter = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });
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
  const [selected, setSelected] = useState<{ point: DailyPrice; x: number; y: number } | null>(null);
  const chartRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ x: number; pan: number } | null>(null);

  useEffect(() => {
    setStartDate(history[0]?.date ?? "");
    setEndDate(history.at(-1)?.date ?? "");
    setZoom(1);
    setPan(0);
  }, [history]);

  const filteredHistory = useMemo(() => history.filter((price) => (!startDate || price.date >= startDate) && (!endDate || price.date <= endDate)), [endDate, history, startDate]);
  const pointCount = filteredHistory.length ? Math.min(filteredHistory.length, Math.max(2, Math.ceil(filteredHistory.length / zoom))) : 0;
  const maxPan = Math.max(0, filteredHistory.length - pointCount);
  const windowStart = Math.max(0, filteredHistory.length - pointCount - pan);
  const visibleHistory = filteredHistory.slice(windowStart, windowStart + pointCount);
  useEffect(() => {
    if (selected && !visibleHistory.some((point) => point.id === selected.point.id)) setSelected(null);
    if (hovered && !visibleHistory.some((point) => point.id === hovered.point.id)) setHovered(null);
  }, [hovered, selected, visibleHistory]);
  const values = visibleHistory.map((item) => item.average).filter((value) => Number.isFinite(value));
  const canUseLog = logScale && values.length > 0 && values.every((value) => value > 0);
  const minValue = values.length ? Math.min(...values) : 1;
  const maxValue = values.length ? Math.max(...values) : 1;
  const min = canUseLog ? Math.log10(minValue) : minValue;
  const max = canUseLog ? Math.log10(maxValue) : maxValue;
  const range = max - min || 1;
  const calendarStart = Date.parse(`${visibleHistory[0]?.date}T00:00:00Z`) || Date.now();
  const calendarEnd = Date.parse(`${visibleHistory.at(-1)?.date}T00:00:00Z`) || calendarStart + 86_400_000;
  const calendarRange = Math.max(1, calendarEnd - calendarStart);
  const x = (index: number) => visibleHistory.length < 2 ? 54 : xForDate(visibleHistory[index].date);
  const xForDate = (date: string) => 8 + ((Date.parse(`${date}T00:00:00Z`) - calendarStart) / calendarRange) * 89;
  const y = (value: number) => 10 + ((max - (canUseLog ? Math.log10(value) : value)) / range) * 76;
  const path = visibleHistory.map((point, index) => `${index === 0 ? "M" : "L"} ${x(index)} ${y(point.average)}`).join(" ");
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((ratio) => {
    const rawValue = canUseLog ? 10 ** (min + range * ratio) : min + range * ratio;
    const value = canUseLog ? Math.max(1, Math.round(rawValue)) : Math.round(rawValue);
    return { ratio, value, position: y(value) };
  });
  const firstYear = new Date(calendarStart).getUTCFullYear();
  const lastYear = new Date(calendarEnd).getUTCFullYear();
  const yearTicks = Array.from({ length: Math.max(1, lastYear - firstYear + 1) }, (_, index) => {
    const year = firstYear + index;
    const date = `${year}-01-01`;
    return { year, date, position: xForDate(date) };
  }).filter((tick) => tick.position >= 8 && tick.position <= 97);
  const getHover = (event: React.PointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const chartX = Math.max(8, Math.min(97, ((event.clientX - box.left) / box.width) * 100));
    const chartY = Math.max(10, Math.min(86, ((event.clientY - box.top) / box.height) * 100));
    const index = Math.round(((chartX - 8) / 89) * (visibleHistory.length - 1));
    const point = visibleHistory[Math.max(0, Math.min(visibleHistory.length - 1, index))];
    if (!point) return null;
    const pointX = x(index);
    const pointY = y(point.average);
    const distance = Math.hypot((chartX - pointX) / 89, (chartY - pointY) / 76);
    return distance <= 0.06 ? { point, x: event.clientX - box.left, y: event.clientY - box.top } : null;
  };
  const updateHover = (event: React.PointerEvent<HTMLDivElement>) => setHovered(getHover(event));
  const handleWheel = useCallback((event: WheelEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const factor = event.deltaY > 0 ? 0.75 : 1.33;
    setZoom((current) => Math.max(1, Math.min(32, current * factor)));
    setPan((current) => Math.min(current, Math.max(0, filteredHistory.length - Math.max(2, Math.ceil(filteredHistory.length / factor)))));
  }, [filteredHistory.length]);
  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    updateHover(event);
    if (!dragRef.current) return;
    const box = event.currentTarget.getBoundingClientRect();
    const pointDelta = Math.round(((event.clientX - dragRef.current.x) / box.width) * filteredHistory.length);
    setPan(Math.max(0, Math.min(maxPan, dragRef.current.pan + pointDelta)));
  };
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    chart.addEventListener("wheel", handleWheel, { passive: false });
    return () => chart.removeEventListener("wheel", handleWheel);
  }, [handleWheel]);

  return <section className="rounded-2xl border border-sky-200/15 bg-slate-900/60 p-5 shadow-xl shadow-slate-950/20 backdrop-blur-sm sm:p-7">
    <div className="flex flex-col justify-between gap-5 xl:flex-row xl:items-start"><div><div className="flex items-center gap-2"><span className="grid h-9 w-9 place-items-center rounded-xl bg-sky-400/15 text-sky-300"><LineChart size={19} /></span><div><h2 className="font-semibold text-white">Price history</h2><p className="text-sm text-slate-400">Scroll to zoom · drag to explore</p></div></div></div><div className="flex flex-wrap items-end gap-3"><label className="grid gap-1 text-xs font-medium text-slate-400">Start<input aria-label="Chart start date" type="date" value={startDate} min={history[0]?.date} max={endDate || undefined} onChange={(event) => { setStartDate(event.target.value); setPan(0); }} className="h-9 rounded-lg border border-sky-200/15 bg-[#08243d] px-2 text-sm text-slate-100 outline-none focus:border-sky-400" /></label><label className="grid gap-1 text-xs font-medium text-slate-400">End<input aria-label="Chart end date" type="date" value={endDate} min={startDate || undefined} max={history.at(-1)?.date} onChange={(event) => { setEndDate(event.target.value); setPan(0); }} className="h-9 rounded-lg border border-sky-200/15 bg-[#08243d] px-2 text-sm text-slate-100 outline-none focus:border-sky-400" /></label><button type="button" aria-label="Toggle logarithmic scale" aria-pressed={logScale} onClick={() => setLogScale((current) => !current)} className={`h-9 rounded-lg px-3 text-sm font-semibold transition-colors ${logScale ? "bg-sky-400 text-slate-950" : "border border-sky-200/15 text-slate-300 hover:bg-slate-800"}`}><LineChart size={15} />{logScale ? "Log" : "Linear"}</button></div></div>
    {visibleHistory.length > 1 ? <div ref={chartRef} className="relative mt-8 h-[390px] cursor-grab touch-none select-none rounded-xl border border-sky-200/10 bg-[#061d32] p-3 active:cursor-grabbing" onPointerLeave={() => setHovered(null)} onPointerMove={handlePointerMove} onPointerDown={(event) => { event.preventDefault(); setHovered(getHover(event)); dragRef.current = { x: event.clientX, pan }; event.currentTarget.setPointerCapture(event.pointerId); }} onPointerUp={(event) => { event.preventDefault(); const next = getHover(event); const wasClick = dragRef.current && Math.abs(event.clientX - dragRef.current.x) < 5; dragRef.current = null; setHovered(next); if (wasClick) setSelected((current) => !next ? null : current?.point.id === next.point.id ? null : next); event.currentTarget.releasePointerCapture(event.pointerId); }}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label={`${security.name} price history chart`} className="pointer-events-none h-full w-full overflow-visible">
        {yTicks.map(({ ratio, position }) => <line key={ratio} x1="8" x2="97" y1={position} y2={position} stroke="#7dd3fc" strokeOpacity="0.12" vectorEffect="non-scaling-stroke" />)}
        <line x1="8" x2="97" y1="86" y2="86" stroke="#7dd3fc" strokeOpacity="0.35" strokeWidth="0.4" vectorEffect="non-scaling-stroke" /><line x1="8" x2="8" y1="10" y2="86" stroke="#7dd3fc" strokeOpacity="0.35" strokeWidth="0.4" vectorEffect="non-scaling-stroke" /><path d={path} fill="none" stroke="#38bdf8" strokeWidth="0.75" vectorEffect="non-scaling-stroke" />{yearTicks.map((tick) => <line key={`tick-${tick.year}`} x1={tick.position} x2={tick.position} y1="86" y2="89" stroke="#7dd3fc" strokeOpacity="0.5" strokeWidth="0.4" vectorEffect="non-scaling-stroke" />)}{hovered && visibleHistory.some((point) => point.id === hovered.point.id) && <circle cx={x(visibleHistory.findIndex((point) => point.id === hovered.point.id))} cy={y(hovered.point.average)} r="1.35" fill="#38bdf8" style={{ filter: "drop-shadow(0 0 5px #38bdf8)" }} vectorEffect="non-scaling-stroke" />}{selected && visibleHistory.some((point) => point.id === selected.point.id) && <circle cx={x(visibleHistory.findIndex((point) => point.id === selected.point.id))} cy={y(selected.point.average)} r="1.55" fill="#7dd3fc" style={{ filter: "drop-shadow(0 0 8px #38bdf8)" }} vectorEffect="non-scaling-stroke" />}
      </svg><div className="pointer-events-none absolute bottom-[10%] left-0 top-[10%] w-[8%] text-right text-[10px] text-slate-500">{yTicks.map(({ value, ratio, position }) => <span key={ratio} className="absolute right-0 -translate-y-1/2" style={{ top: `${((position - 10) / 76) * 100}%` }}>{axisNumberFormatter.format(value)}</span>)}</div>
      <div className="pointer-events-none absolute bottom-[3%] left-[8%] right-[3%] text-[10px] text-slate-500">{yearTicks.map((tick) => <span key={tick.year} className="absolute -translate-x-1/2 text-center" style={{ left: `${((tick.position - 8) / 89) * 100}%` }}>{tick.year}</span>)}</div>
      {selected && <div className="pointer-events-none absolute z-10 min-w-[132px] -translate-x-1/2 -translate-y-full rounded-lg border border-sky-200/20 bg-[#08243d]/80 px-2.5 py-2 opacity-90 shadow-xl" style={{ left: selected.x, top: Math.max(76, selected.y - 8) }}><p className="text-[10px] text-slate-400">{formatDate(selected.point.date)}</p><p className="font-semibold text-white">{formatPrice(selected.point.average, security)}</p><p className="text-[10px] text-slate-400">High {formatPrice(selected.point.high, security)} · Low {formatPrice(selected.point.low, security)}</p></div>}
    </div> : <div className="mt-8 grid h-[360px] place-items-center rounded-xl border border-dashed border-sky-200/15 bg-[#061d32] text-center"><div><Info className="mx-auto text-sky-300" size={22} /><p className="mt-3 font-medium text-slate-200">Not enough price data</p><p className="mt-1 text-sm text-slate-500">At least two daily prices are needed to draw the chart.</p></div></div>}
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
