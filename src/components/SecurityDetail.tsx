import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  HubConnectionBuilder,
  HubConnectionState,
  LogLevel,
  type HubConnection,
} from "@microsoft/signalr";
import {
  ArrowLeft,
  ChevronDown,
  ExternalLink,
  Info,
  LineChart,
  Pin,
  Plus,
  RefreshCw,
  Settings,
  Star,
} from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { getSecurity, updateSecurity } from "@/api/securityApi";
import {
  addWatchlist,
  getWatchlistIdsForSecurity,
  getWatchlistsMinimal,
  unwatchSecurity,
  updateWatchlist,
  watchSecurity,
} from "@/api/watchlistApi";
import type { WatchlistMinimal } from "@/models/WatchlistMinimal";
import {
  SecurityType,
  type DailyPrice,
  type DividendPayout,
  type ETF,
  type PubliclyTradedSecurityBase,
  type Security,
  type Stock,
} from "@/models/Security";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const typeNames: Record<SecurityType, string> = {
  [SecurityType.Stock]: "Stock",
  [SecurityType.ETF]: "ETF",
  [SecurityType.Cryptocurrency]: "Cryptocurrency",
  [SecurityType.CurrencyPair]: "Currency pair",
};

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  year: "numeric",
});
const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "medium",
  timeZone: "UTC",
});
const monthFormatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  timeZone: "UTC",
});
const numberFormatter = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 2,
});
const axisNumberFormatter = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 0,
});
const dividendAxisNumberFormatter = new Intl.NumberFormat(undefined, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const compactFormatter = new Intl.NumberFormat(undefined, {
  notation: "compact",
  maximumFractionDigits: 2,
});

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
  return Number.isNaN(date.getTime())
    ? value
    : `${dateTimeFormatter.format(date)} UTC`;
}

interface LivePrice {
  symbol: string;
  timestamp: string;
  price: number;
  dayHigh?: number;
  dayLow?: number;
}

function dateOnlyFromTimestamp(timestamp: string) {
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

function Chart({
  security,
  priceHistory,
  livePriceDate,
}: {
  security: PubliclyTradedSecurityBase;
  priceHistory: DailyPrice[];
  livePriceDate: string | null;
}) {
  const history = useMemo(
    () => [...priceHistory].sort((a, b) => a.date.localeCompare(b.date)),
    [priceHistory],
  );
  const [startDate, setStartDate] = useState(history[0]?.date ?? "");
  const [endDate, setEndDate] = useState(history.at(-1)?.date ?? "");
  const [logScale, setLogScale] = useState(true);
  const [cardDistance, setCardDistance] = useState(20);
  const [showSettings, setShowSettings] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState(0);
  const [hovered, setHovered] = useState<{
    point: DailyPrice;
    x: number;
    y: number;
    axisX: number;
    axisY: number;
  } | null>(null);
  const [selected, setSelected] = useState<{
    point: DailyPrice;
    x: number;
    y: number;
  } | null>(null);
  const chartRef = useRef<HTMLDivElement>(null);
  const pointerPositionRef = useRef<{ x: number; y: number } | null>(null);
  const dragRef = useRef<{ x: number; pan: number } | null>(null);
  const [chartWidth, setChartWidth] = useState(0);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const observer = new ResizeObserver(([entry]) =>
      setChartWidth(entry.contentRect.width),
    );
    observer.observe(chart);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (livePriceDate && livePriceDate > endDate) {
      setEndDate(livePriceDate);
      setPan(0);
    }
  }, [endDate, livePriceDate]);

  const filteredHistory = useMemo(
    () =>
      history.filter(
        (price) =>
          (!startDate || price.date >= startDate) &&
          (!endDate || price.date <= endDate),
      ),
    [endDate, history, startDate],
  );
  const pointCount = filteredHistory.length
    ? Math.min(
        filteredHistory.length,
        Math.max(2, Math.ceil(filteredHistory.length / zoom)),
      )
    : 0;
  const maxPan = Math.max(0, filteredHistory.length - pointCount);
  const windowStart = Math.max(0, filteredHistory.length - pointCount - pan);
  const visibleHistory = useMemo(
    () => filteredHistory.slice(windowStart, windowStart + pointCount),
    [filteredHistory, pointCount, windowStart],
  );
  useEffect(() => {
    if (
      selected &&
      !visibleHistory.some((point) => point.id === selected.point.id)
    )
      setSelected(null);
  }, [selected, visibleHistory]);
  const values = visibleHistory
    .map((item) => item.average)
    .filter((value) => Number.isFinite(value));
  const canUseLog =
    logScale && values.length > 0 && values.every((value) => value > 0);
  const minValue = values.length ? Math.min(...values) : 1;
  const maxValue = values.length ? Math.max(...values) : 1;
  const min = canUseLog ? Math.log10(minValue) : 0;
  const max = canUseLog ? Math.log10(maxValue) : maxValue;
  const range = max - min || 1;
  const calendarStart =
    Date.parse(`${visibleHistory[0]?.date}T00:00:00Z`) || Date.now();
  const calendarEnd =
    Date.parse(`${visibleHistory.at(-1)?.date}T00:00:00Z`) ||
    calendarStart + 86_400_000;
  const calendarRange = Math.max(1, calendarEnd - calendarStart);
  const x = (index: number) => {
    const point = visibleHistory[index];
    return point ? xForDate(point.date) : 54;
  };
  const xForDate = (date: string) =>
    6 +
    ((Date.parse(`${date}T00:00:00Z`) - calendarStart) / calendarRange) * 91;
  const y = (value: number) =>
    10 + ((max - (canUseLog ? Math.log10(value) : value)) / range) * 76;
  const path = visibleHistory
    .map(
      (point, index) =>
        `${index === 0 ? "M" : "L"} ${x(index)} ${y(point.average)}`,
    )
    .join(" ");
  const yTicks = canUseLog
    ? [0, 0.33, 0.66, 1].map((ratio, index) => {
        const rawValue = 10 ** (min + (max - min) * ratio);
        const value =
          index === 0 ? minValue : Math.max(1, Math.round(rawValue));
        return {
          ratio,
          value,
          label:
            index === 0
              ? numberFormatter.format(value)
              : axisNumberFormatter.format(value),
          position: Math.max(10, Math.min(86, y(value))),
        };
      })
    : [0, 0.25, 0.5, 0.75, 1].map((ratio) => {
        const value = Math.round(max * ratio);
        return {
          ratio,
          value,
          label: axisNumberFormatter.format(value),
          position: y(value),
        };
      });
  const firstYear = new Date(calendarStart).getUTCFullYear();
  const lastYear = new Date(calendarEnd).getUTCFullYear();
  const yearTicks = Array.from(
    { length: Math.max(1, lastYear - firstYear + 1) },
    (_, index) => {
      const year = firstYear + index;
      const date = `${year}-01-01`;
      return { year, date, position: xForDate(date) };
    },
  ).filter((tick) => tick.position >= 6 && tick.position <= 97);
  const monthTicks: { date: string; month: number; position: number }[] = [];
  const monthCursor = new Date(
    Date.UTC(new Date(calendarStart).getUTCFullYear(), new Date(calendarStart).getUTCMonth(), 1),
  );
  while (monthCursor.getTime() <= calendarEnd) {
    const month = monthCursor.getUTCMonth();
    const date = monthCursor.toISOString().slice(0, 10);
    const position = xForDate(date);
    if (month > 0 && position >= 6 && position <= 97)
      monthTicks.push({ date, month, position });
    monthCursor.setUTCMonth(month + 1);
  }
  const axisWidth = chartWidth * 0.91;
  const minMonthSpacing = monthTicks.slice(1).reduce(
    (spacing, tick, index) =>
      Math.min(
        spacing,
        (Math.abs(tick.position - monthTicks[index].position) / 91) * axisWidth,
      ),
    Number.POSITIVE_INFINITY,
  );
  const tickCandidates =
    minMonthSpacing >= 38
      ? monthTicks.map((tick) => ({
          ...tick,
          label: monthFormatter.format(new Date(`${tick.date}T00:00:00Z`)),
          width: 26,
        }))
      : monthTicks
          .filter((tick) => tick.month % 3 === 0)
          .map((tick) => ({
            ...tick,
            label: `Q${Math.floor(tick.month / 3) + 1}`,
            width: 20,
          }));
  const tickLabels: typeof tickCandidates = [];
  const labelIntervals = yearTicks.map((tick) => ({
    center: ((tick.position - 6) / 91) * axisWidth,
    width: 30,
  }));
  for (const tick of tickCandidates) {
    const center = ((tick.position - 6) / 91) * axisWidth;
    if (
      center < tick.width / 2 ||
      center > axisWidth - tick.width / 2 ||
      labelIntervals.some(
        (label) =>
          Math.abs(center - label.center) < (tick.width + label.width) / 2 + 4,
      )
    )
      continue;
    tickLabels.push(tick);
    labelIntervals.push({ center, width: tick.width });
  }
  const allQuarterLabelsVisible = ["Q2", "Q3", "Q4"].every((label) =>
    tickLabels.some((tick) => tick.label === label),
  );
  const showTimeHoverCard = minMonthSpacing >= 38 || allQuarterLabelsVisible;
  const getHover = useCallback(
    (clientX: number, clientY: number) => {
      const box = chartRef.current?.getBoundingClientRect();
      if (!box) return null;
      const chartX = Math.max(
        6,
        Math.min(97, ((clientX - box.left) / box.width) * 100),
      );
      const chartY = Math.max(
        10,
        Math.min(86, ((clientY - box.top) / box.height) * 100),
      );
      const index = Math.round(
        ((chartX - 6) / 91) * (visibleHistory.length - 1),
      );
      const point =
        visibleHistory[Math.max(0, Math.min(visibleHistory.length - 1, index))];
      if (!point) return null;
      const pointX =
        6 +
        ((Date.parse(`${point.date}T00:00:00Z`) - calendarStart) /
          calendarRange) *
          91;
      const value = canUseLog ? Math.log10(point.average) : point.average;
      const pointY = 10 + ((max - value) / range) * 76;
      const distance = Math.hypot(
        (chartX - pointX) / 89,
        (chartY - pointY) / 76,
      );
      return distance <= 0.06
        ? {
            point,
            x: 12 + ((box.width - 24) * pointX) / 100,
            y: 12 + ((box.height - 24) * pointY) / 100,
            axisX: 12 + ((box.width - 24) * 6) / 100,
            axisY: 12 + ((box.height - 24) * 86) / 100,
          }
        : null;
    },
    [calendarRange, calendarStart, canUseLog, max, range, visibleHistory],
  );
  const updateHover = (event: React.PointerEvent<HTMLDivElement>) => {
    pointerPositionRef.current = { x: event.clientX, y: event.clientY };
    const next = getHover(event.clientX, event.clientY);
    setHovered(next);
    return next;
  };
  useEffect(() => {
    const pointerPosition = pointerPositionRef.current;
    if (pointerPosition)
      setHovered(getHover(pointerPosition.x, pointerPosition.y));
  }, [getHover]);
  const handleWheel = useCallback(
    (event: WheelEvent) => {
      event.preventDefault();
      event.stopPropagation();
      if (!filteredHistory.length) return;
      pointerPositionRef.current = { x: event.clientX, y: event.clientY };
      const factor = event.deltaY > 0 ? 0.75 : 1.33;
      const nextZoom = Math.max(1, Math.min(32, zoom * factor));
      const nextCount = Math.min(
        filteredHistory.length,
        Math.max(2, Math.ceil(filteredHistory.length / nextZoom)),
      );
      const box = chartRef.current?.getBoundingClientRect();
      const pointerRatio = box
        ? Math.max(0, Math.min(1, (event.clientX - box.left) / box.width))
        : 0.5;
      const currentIndex =
        windowStart + Math.round(pointerRatio * Math.max(0, pointCount - 1));
      const nextStart = Math.max(
        0,
        Math.min(
          filteredHistory.length - nextCount,
          Math.round(currentIndex - pointerRatio * (nextCount - 1)),
        ),
      );
      setZoom(nextZoom);
      setPan(filteredHistory.length - nextCount - nextStart);
    },
    [filteredHistory.length, pointCount, windowStart, zoom],
  );
  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    updateHover(event);
    if (!dragRef.current) return;
    const pointDelta = Math.round(
      ((event.clientX - dragRef.current.x) / axisWidth) * (pointCount - 1),
    );
    setPan(Math.max(0, Math.min(maxPan, dragRef.current.pan + pointDelta)));
  };
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    chart.addEventListener("wheel", handleWheel, { passive: false });
    return () => chart.removeEventListener("wheel", handleWheel);
  }, [handleWheel]);
  const hoveredDate = hovered
    ? new Date(`${hovered.point.date}T00:00:00Z`)
    : null;

  return (
    <section className="p-0">
      <div className="flex flex-col justify-between gap-5 xl:flex-row xl:items-start">
        <div>
          <div className="flex items-center gap-2">
            <span className="hidden grid h-9 w-9 place-items-center rounded-xl bg-sky-400/15 text-sky-300">
              <LineChart size={19} />
            </span>
            <div className="hidden">
              <h2 className="font-semibold text-white">Price history</h2>
              <p className="text-sm text-slate-400">
                Scroll to zoom · drag to explore
              </p>
            </div>
            <button
              type="button"
              aria-label="Toggle chart settings"
              aria-expanded={showSettings}
              onClick={() => setShowSettings((current) => !current)}
              className={`hidden ml-2 grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-sky-200/15 transition-colors ${showSettings ? "bg-sky-400/20 text-sky-300" : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"}`}
            >
              <Settings size={17} />
            </button>
          </div>
        </div>
        <div className="hidden">
          <label className="grid gap-1 text-xs font-medium text-slate-400">
            Start
            <input
              aria-label="Chart start date"
              type="date"
              value={startDate}
              min={history[0]?.date}
              max={endDate || undefined}
              onChange={(event) => {
                setStartDate(event.target.value);
                setPan(0);
              }}
              className="h-9 rounded-lg border border-sky-200/15 bg-[#08243d] px-2 text-sm text-slate-100 outline-none focus:border-sky-400"
            />
          </label>
          <label className="grid gap-1 text-xs font-medium text-slate-400">
            End
            <input
              aria-label="Chart end date"
              type="date"
              value={endDate}
              min={startDate || undefined}
              max={history.at(-1)?.date}
              onChange={(event) => {
                setEndDate(event.target.value);
                setPan(0);
              }}
              className="h-9 rounded-lg border border-sky-200/15 bg-[#08243d] px-2 text-sm text-slate-100 outline-none focus:border-sky-400"
            />
          </label>
          <button
            type="button"
            aria-label="Toggle logarithmic scale"
            aria-pressed={logScale}
            onClick={() => setLogScale((current) => !current)}
            className={`h-9 rounded-lg px-3 text-sm font-semibold transition-colors ${logScale ? "bg-sky-400 text-slate-950" : "border border-sky-200/15 text-slate-300 hover:bg-slate-800"}`}
          >
            <LineChart size={15} />
            {logScale ? "Log" : "Linear"}
          </button>
        </div>
      </div>
      {visibleHistory.length > 1 ? (
        <div
          ref={chartRef}
          className="relative mt-0 h-[clamp(20rem,55vw,33.75rem)] cursor-default touch-none select-none rounded-xl border border-sky-200/10 bg-[#061d32] p-3"
          onPointerLeave={() => {
            pointerPositionRef.current = null;
            setHovered(null);
          }}
          onPointerMove={handlePointerMove}
          onPointerDown={(event) => {
            event.preventDefault();
            updateHover(event);
            dragRef.current = { x: event.clientX, pan };
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerUp={(event) => {
            event.preventDefault();
            const next = updateHover(event);
            const wasClick =
              dragRef.current &&
              Math.abs(event.clientX - dragRef.current.x) < 5;
            dragRef.current = null;
            setHovered(next);
            if (wasClick)
              setSelected((current) =>
                !next
                  ? null
                  : current?.point.id === next.point.id
                    ? null
                    : next,
              );
            event.currentTarget.releasePointerCapture(event.pointerId);
          }}
        >
          <button
            type="button"
            aria-label="Toggle chart settings"
            aria-expanded={showSettings}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              setShowSettings((current) => !current);
            }}
            className="pointer-events-auto absolute right-4 top-4 z-50 grid h-9 w-9 place-items-center rounded-lg border border-sky-200/15 bg-[#08243d]/80 text-slate-400 shadow-sm transition-colors hover:bg-slate-800 hover:text-slate-200 focus-visible:border-sky-400"
          >
            <Settings size={17} />
          </button>
          {showSettings && (
            <div
              onPointerDown={(event) => event.stopPropagation()}
              className="absolute right-4 top-14 z-50 grid w-56 gap-3 rounded-xl border border-sky-200/20 bg-[#08243d]/95 p-4 shadow-2xl"
            >
              <label className="grid gap-1 text-xs font-medium text-slate-400">
                Start
                <input
                  aria-label="Chart start date"
                  type="date"
                  value={startDate}
                  min={history[0]?.date}
                  max={endDate || undefined}
                  onChange={(event) => {
                    setStartDate(event.target.value);
                    setPan(0);
                  }}
                  className="h-9 rounded-lg border border-sky-200/15 bg-[#061d32] px-2 text-sm text-slate-100 outline-none focus:border-sky-400"
                />
              </label>
              <label className="grid gap-1 text-xs font-medium text-slate-400">
                End
                <input
                  aria-label="Chart end date"
                  type="date"
                  value={endDate}
                  min={startDate || undefined}
                  max={history.at(-1)?.date}
                  onChange={(event) => {
                    setEndDate(event.target.value);
                    setPan(0);
                  }}
                  className="h-9 rounded-lg border border-sky-200/15 bg-[#061d32] px-2 text-sm text-slate-100 outline-none focus:border-sky-400"
                />
              </label>
              <label className="grid gap-1 text-xs font-medium text-slate-400">
                Price card distance ({cardDistance}px)
                <input
                  aria-label="Price card distance"
                  type="range"
                  min="8"
                  max="48"
                  step="2"
                  value={cardDistance}
                  onChange={(event) => setCardDistance(Number(event.target.value))}
                  className="h-2 cursor-pointer accent-sky-400"
                />
              </label>
              <button
                type="button"
                aria-label="Toggle logarithmic scale"
                aria-pressed={logScale}
                onClick={() => setLogScale((current) => !current)}
                className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-sky-400 px-3 text-sm font-semibold text-slate-950"
              >
                <LineChart size={15} />
                {logScale ? "Log" : "Linear"}
              </button>
            </div>
          )}
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            role="img"
            aria-label={`${security.name} price history chart`}
            className="pointer-events-none h-full w-full overflow-visible"
          >
            {yTicks.map(({ ratio, position }) => (
              <line
                key={ratio}
                x1="6"
                x2="97"
                y1={position}
                y2={position}
                stroke="#7dd3fc"
                strokeOpacity="0.12"
                strokeDasharray="1.5 2"
                vectorEffect="non-scaling-stroke"
              />
            ))}
            <line
              x1="6"
              x2="97"
              y1="86"
              y2="86"
              stroke="#7dd3fc"
              strokeOpacity="0.35"
              strokeWidth="0.4"
              vectorEffect="non-scaling-stroke"
            />
            <line
              x1="6"
              x2="6"
              y1="10"
              y2="86"
              stroke="#7dd3fc"
              strokeOpacity="0.35"
              strokeWidth="0.4"
              vectorEffect="non-scaling-stroke"
            />
            <path
              d={path}
              fill="none"
              stroke="#38bdf8"
              strokeWidth="0.75"
              vectorEffect="non-scaling-stroke"
            />
            {yearTicks.map((tick) => (
              <line
                key={`year-${tick.year}`}
                x1={tick.position}
                x2={tick.position}
                y1="86"
                y2="89"
                stroke="#7dd3fc"
                strokeOpacity="0.5"
                strokeWidth="0.4"
                vectorEffect="non-scaling-stroke"
              />
            ))}
            {tickLabels.map((tick) => (
              <line
                key={`period-${tick.date}`}
                x1={tick.position}
                x2={tick.position}
                y1="86"
                y2="88"
                stroke="#7dd3fc"
                strokeOpacity="0.35"
                strokeWidth="0.35"
                vectorEffect="non-scaling-stroke"
              />
            ))}
            {selected &&
              visibleHistory.some(
                (point) => point.id === selected.point.id,
              ) && (
                <circle
                  cx={x(
                    visibleHistory.findIndex(
                      (point) => point.id === selected.point.id,
                    ),
                  )}
                  cy={y(selected.point.average)}
                  r="1.55"
                  fill="#7dd3fc"
                  style={{ filter: "drop-shadow(0 0 8px #38bdf8)" }}
                  vectorEffect="non-scaling-stroke"
                />
              )}
          </svg>
          {hovered &&
            visibleHistory.some((point) => point.id === hovered.point.id) && (
              <>
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute z-10 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-sky-100 bg-sky-300 shadow-[0_0_10px_3px_rgba(56,189,248,0.75)]"
                  style={{ left: hovered.x, top: hovered.y }}
                />
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute z-10 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-sky-300/35"
                  style={{ left: hovered.x, top: hovered.axisY }}
                />
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute z-10 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-sky-300/35"
                  style={{ left: hovered.axisX, top: hovered.y }}
                />
              </>
            )}
          {hovered && hoveredDate && (
            <>
              {showTimeHoverCard && (
                <div
                  className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-md border border-sky-200/20 bg-[#08243d]/80 px-2 py-1 text-xs font-semibold text-white shadow-lg"
                  style={{
                    left: Math.min(chartWidth - 48, Math.max(54, hovered.x)),
                    top: "88%",
                  }}
                >
                  {monthFormatter.format(hoveredDate)} {hoveredDate.getUTCDate()}
                </div>
              )}
              <div
                className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md border border-sky-200/20 bg-[#08243d]/80 px-2 py-1 text-xs font-semibold text-white shadow-lg"
                style={{
                  left: Math.min(chartWidth - 48, Math.max(54, hovered.x)),
                  top: Math.max(18, hovered.y - cardDistance),
                }}
              >
                {numberFormatter.format(hovered.point.average)}
              </div>
            </>
          )}
          <div className="pointer-events-none absolute inset-y-3 left-1 w-[5%] text-right text-slate-400">
            {yTicks.map(({ label, ratio, position }) => (
              <span
                key={ratio}
                className="absolute right-0 -translate-y-1/2 text-xs font-medium"
                style={{ top: `${position}%` }}
              >
                {label}
              </span>
            ))}
          </div>
          <div className="pointer-events-none absolute bottom-[8%] left-[6%] right-[3%] text-[10px] text-slate-500">
            {yearTicks.map((tick) => (
              <span
                key={tick.year}
                className="absolute -translate-x-1/2 text-center text-xs font-medium text-slate-400"
                style={{ left: `${((tick.position - 6) / 91) * 100}%` }}
              >
                {tick.year}
              </span>
            ))}
            {tickLabels.map((tick) => (
              <span
                key={tick.date}
                className="absolute -translate-x-1/2 whitespace-nowrap text-center"
                style={{ left: `${((tick.position - 6) / 91) * 100}%` }}
              >
                {tick.label}
              </span>
            ))}
          </div>
          {selected && (
            <div
              className="pointer-events-none absolute z-10 min-w-[132px] -translate-x-1/2 -translate-y-full rounded-lg border border-sky-200/20 bg-[#08243d]/80 px-2.5 py-2 opacity-90 shadow-xl"
              style={{ left: selected.x, top: Math.max(76, selected.y - 8) }}
            >
              <p className="text-[10px] text-slate-400">
                {formatDate(selected.point.date)}
              </p>
              <p className="font-semibold text-white">
                {formatPrice(selected.point.average, security)}
              </p>
              <p className="text-[10px] text-slate-400">
                High {formatPrice(selected.point.high, security)} · Low{" "}
                {formatPrice(selected.point.low, security)}
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="mt-8 grid min-h-[20rem] place-items-center rounded-xl border border-dashed border-sky-200/15 bg-[#061d32] p-6 text-center sm:min-h-[29.375rem]">
          <div>
            <Info className="mx-auto text-sky-300" size={22} />
            <p className="mt-3 font-medium text-slate-200">
              Not enough price data
            </p>
            <p className="mt-1 text-sm text-slate-500">
              At least two daily prices are needed to draw the chart.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}

function DividendChart({
  payouts,
  security,
}: {
  payouts: DividendPayout[];
  security: PubliclyTradedSecurityBase;
}) {
  const history = useMemo(
    () => [...payouts].sort((a, b) => a.payoutDate.localeCompare(b.payoutDate)),
    [payouts],
  );
  const [isExpanded, setIsExpanded] = useState(false);
  const [startDate, setStartDate] = useState(
    history[0]?.payoutDate.slice(0, 10) ?? "",
  );
  const [endDate, setEndDate] = useState(
    history.at(-1)?.payoutDate.slice(0, 10) ?? "",
  );
  const [logScale, setLogScale] = useState(true);
  const [cardDistance, setCardDistance] = useState(10);
  const [showSettings, setShowSettings] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState(0);
  const [chartWidth, setChartWidth] = useState(0);
  const [hovered, setHovered] = useState<{
    payout: DividendPayout;
    x: number;
    y: number;
    axisX: number;
    axisY: number;
  } | null>(null);
  const chartRef = useRef<HTMLDivElement>(null);
  const pointerPositionRef = useRef<{ x: number; y: number } | null>(null);
  const dragRef = useRef<{ x: number; pan: number } | null>(null);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const observer = new ResizeObserver(([entry]) =>
      setChartWidth(entry.contentRect.width),
    );
    observer.observe(chart);
    return () => observer.disconnect();
  }, [isExpanded]);

  const filteredPayouts = useMemo(
    () =>
      history.filter((payout) => {
        const date = payout.payoutDate.slice(0, 10);
        return date >= startDate && date <= endDate;
      }),
    [endDate, history, startDate],
  );
  const pointCount = filteredPayouts.length
    ? Math.min(
        filteredPayouts.length,
        Math.max(2, Math.ceil(filteredPayouts.length / zoom)),
      )
    : 0;
  const maxPan = Math.max(0, filteredPayouts.length - pointCount);
  const windowStart = Math.max(0, filteredPayouts.length - pointCount - pan);
  const visiblePayouts = useMemo(
    () => filteredPayouts.slice(windowStart, windowStart + pointCount),
    [filteredPayouts, pointCount, windowStart],
  );
  const amounts = visiblePayouts.map((payout) => payout.payoutAmount);
  const positiveAmounts = amounts.filter((amount) => amount > 0);
  const useLogScale = logScale && positiveAmounts.length > 0;
  const minValue = amounts.length ? Math.min(...amounts) : 0;
  const maxValue = amounts.length ? Math.max(...amounts) : 0;
  const min = useLogScale ? Math.log10(Math.min(...positiveAmounts)) : 0;
  const max = useLogScale ? Math.log10(Math.max(...positiveAmounts)) : maxValue;
  const range = max - min || 1;
  const calendarStart =
    Date.parse(`${visiblePayouts[0]?.payoutDate.slice(0, 10)}T00:00:00Z`) ||
    Date.now();
  const calendarEnd =
    Date.parse(
      `${visiblePayouts.at(-1)?.payoutDate.slice(0, 10)}T00:00:00Z`,
    ) || calendarStart + 86_400_000;
  const calendarRange = Math.max(1, calendarEnd - calendarStart);
  const xForDate = (date: string) =>
    6 +
    ((Date.parse(`${date.slice(0, 10)}T00:00:00Z`) - calendarStart) /
      calendarRange) *
      91;
  const yForAmount = (amount: number) => {
    const value = useLogScale
      ? amount > 0
        ? Math.log10(amount)
        : min
      : amount;
    return 10 + ((max - value) / range) * 76;
  };
  const yTicks = useLogScale
    ? [0, 0.33, 0.66, 1].map((ratio, index) => {
        const rawValue = 10 ** (min + (max - min) * ratio);
        const value = index === 0 ? minValue : Math.max(0, rawValue);
        return {
          ratio,
          label: dividendAxisNumberFormatter.format(value),
          position: Math.max(10, Math.min(86, yForAmount(value))),
        };
      })
    : [0, 0.25, 0.5, 0.75, 1].map((ratio) => {
        const value = max * ratio;
        return {
          ratio,
          label: dividendAxisNumberFormatter.format(value),
          position: yForAmount(value),
        };
      });
  const firstYear = new Date(calendarStart).getUTCFullYear();
  const lastYear = new Date(calendarEnd).getUTCFullYear();
  const yearTicks = Array.from(
    { length: Math.max(1, lastYear - firstYear + 1) },
    (_, index) => {
      const year = firstYear + index;
      const date = `${year}-01-01`;
      return { year, date, position: xForDate(date) };
    },
  ).filter((tick) => tick.position >= 6 && tick.position <= 97);
  const monthTicks: { date: string; month: number; position: number }[] = [];
  const monthCursor = new Date(
    Date.UTC(
      new Date(calendarStart).getUTCFullYear(),
      new Date(calendarStart).getUTCMonth(),
      1,
    ),
  );
  while (monthCursor.getTime() <= calendarEnd) {
    const month = monthCursor.getUTCMonth();
    const date = monthCursor.toISOString().slice(0, 10);
    const position = xForDate(date);
    if (month > 0 && position >= 6 && position <= 97)
      monthTicks.push({ date, month, position });
    monthCursor.setUTCMonth(month + 1);
  }
  const axisWidth = chartWidth * 0.91;
  const minMonthSpacing = monthTicks.slice(1).reduce(
    (spacing, tick, index) =>
      Math.min(
        spacing,
        (Math.abs(tick.position - monthTicks[index].position) / 91) * axisWidth,
      ),
    Number.POSITIVE_INFINITY,
  );
  const tickCandidates =
    minMonthSpacing >= 38
      ? monthTicks.map((tick) => ({
          ...tick,
          label: monthFormatter.format(new Date(`${tick.date}T00:00:00Z`)),
          width: 26,
        }))
      : monthTicks
          .filter((tick) => tick.month % 3 === 0)
          .map((tick) => ({
            ...tick,
            label: `Q${Math.floor(tick.month / 3) + 1}`,
            width: 20,
          }));
  const tickLabels: typeof tickCandidates = [];
  const labelIntervals = yearTicks.map((tick) => ({
    center: ((tick.position - 6) / 91) * axisWidth,
    width: 30,
  }));
  for (const tick of tickCandidates) {
    const center = ((tick.position - 6) / 91) * axisWidth;
    if (
      center < tick.width / 2 ||
      center > axisWidth - tick.width / 2 ||
      labelIntervals.some(
        (label) =>
          Math.abs(center - label.center) < (tick.width + label.width) / 2 + 4,
      )
    )
      continue;
    tickLabels.push(tick);
    labelIntervals.push({ center, width: tick.width });
  }
  const allQuarterLabelsVisible = ["Q2", "Q3", "Q4"].every((label) =>
    tickLabels.some((tick) => tick.label === label),
  );
  const showTimeHoverCard = minMonthSpacing >= 38 || allQuarterLabelsVisible;
  const getHover = useCallback(
    (clientX: number) => {
      const box = chartRef.current?.getBoundingClientRect();
      if (!box || !visiblePayouts.length) return null;
      const chartX = Math.max(
        6,
        Math.min(97, ((clientX - box.left) / box.width) * 100),
      );
      const hoveredTimestamp =
        calendarStart + ((chartX - 6) / 91) * calendarRange;
      const payout = visiblePayouts.reduce((closest, candidate) =>
        Math.abs(
          Date.parse(`${candidate.payoutDate.slice(0, 10)}T00:00:00Z`) -
            hoveredTimestamp,
        ) <
        Math.abs(
          Date.parse(`${closest.payoutDate.slice(0, 10)}T00:00:00Z`) -
            hoveredTimestamp,
        )
          ? candidate
          : closest,
      );
      const position = xForDate(payout.payoutDate);
      const amountY = yForAmount(payout.payoutAmount);
      return {
        payout,
        x: 12 + ((box.width - 24) * position) / 100,
        y: 12 + ((box.height - 24) * amountY) / 100,
        axisX: 12 + ((box.width - 24) * 6) / 100,
        axisY: 12 + ((box.height - 24) * 86) / 100,
      };
    },
    [calendarRange, calendarStart, visiblePayouts, xForDate, yForAmount],
  );
  const updateHover = (event: React.PointerEvent<HTMLDivElement>) => {
    pointerPositionRef.current = { x: event.clientX, y: event.clientY };
    const next = getHover(event.clientX);
    setHovered(next);
    return next;
  };
  const handleWheel = useCallback(
    (event: WheelEvent) => {
      event.preventDefault();
      event.stopPropagation();
      if (!filteredPayouts.length) return;
      const factor = event.deltaY > 0 ? 0.75 : 1.33;
      const nextZoom = Math.max(1, Math.min(32, zoom * factor));
      const nextCount = Math.min(
        filteredPayouts.length,
        Math.max(2, Math.ceil(filteredPayouts.length / nextZoom)),
      );
      const box = chartRef.current?.getBoundingClientRect();
      const pointerRatio = box
        ? Math.max(0, Math.min(1, (event.clientX - box.left) / box.width))
        : 0.5;
      const currentIndex =
        windowStart + Math.round(pointerRatio * Math.max(0, pointCount - 1));
      const nextStart = Math.max(
        0,
        Math.min(
          filteredPayouts.length - nextCount,
          Math.round(currentIndex - pointerRatio * (nextCount - 1)),
        ),
      );
      setZoom(nextZoom);
      setPan(filteredPayouts.length - nextCount - nextStart);
    },
    [filteredPayouts.length, pointCount, windowStart, zoom],
  );
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    chart.addEventListener("wheel", handleWheel, { passive: false });
    return () => chart.removeEventListener("wheel", handleWheel);
  }, [handleWheel]);
  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    updateHover(event);
    if (!dragRef.current) return;
    const pointDelta = Math.round(
      ((event.clientX - dragRef.current.x) / axisWidth) * (pointCount - 1),
    );
    setPan(Math.max(0, Math.min(maxPan, dragRef.current.pan + pointDelta)));
  };
  const hoveredDate = hovered
    ? new Date(`${hovered.payout.payoutDate.slice(0, 10)}T00:00:00Z`)
    : null;

  return (
    <section className="mt-6">
      <button
        type="button"
        aria-expanded={isExpanded}
        onClick={() => setIsExpanded((expanded) => !expanded)}
        className="mb-3 flex w-full items-center justify-between gap-4 text-left text-sm font-semibold uppercase tracking-wider text-sky-300 transition-colors hover:text-sky-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
      >
        Dividend payouts
        <ChevronDown
          size={18}
          className={`shrink-0 text-slate-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
        />
      </button>
      {isExpanded && (
        <div
          ref={chartRef}
          className="relative h-[clamp(20rem,55vw,33.75rem)] cursor-default touch-none select-none rounded-xl border border-sky-200/10 bg-[#061d32] p-3"
          onPointerLeave={() => {
            pointerPositionRef.current = null;
            setHovered(null);
          }}
          onPointerMove={handlePointerMove}
          onPointerDown={(event) => {
            event.preventDefault();
            updateHover(event);
            dragRef.current = { x: event.clientX, pan };
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerUp={(event) => {
            event.preventDefault();
            updateHover(event);
            dragRef.current = null;
            event.currentTarget.releasePointerCapture(event.pointerId);
          }}
        >
          <button
            type="button"
            aria-label="Toggle dividend chart settings"
            aria-expanded={showSettings}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              setShowSettings((current) => !current);
            }}
            className="pointer-events-auto absolute right-4 top-4 z-50 grid h-9 w-9 place-items-center rounded-lg border border-sky-200/15 bg-[#08243d]/80 text-slate-400 shadow-sm transition-colors hover:bg-slate-800 hover:text-slate-200 focus-visible:border-sky-400"
          >
            <Settings size={17} />
          </button>
          {showSettings && (
            <div
              onPointerDown={(event) => event.stopPropagation()}
              className="absolute right-4 top-14 z-50 grid w-56 gap-3 rounded-xl border border-sky-200/20 bg-[#08243d]/95 p-4 shadow-2xl"
            >
              <label className="grid gap-1 text-xs font-medium text-slate-400">
                Start
                <input
                  aria-label="Dividend chart start date"
                  type="date"
                  value={startDate}
                  min={history[0]?.payoutDate.slice(0, 10)}
                  max={endDate || undefined}
                  onChange={(event) => {
                    setStartDate(event.target.value);
                    setPan(0);
                  }}
                  className="h-9 rounded-lg border border-sky-200/15 bg-[#061d32] px-2 text-sm text-slate-100 outline-none focus:border-sky-400"
                />
              </label>
              <label className="grid gap-1 text-xs font-medium text-slate-400">
                End
                <input
                  aria-label="Dividend chart end date"
                  type="date"
                  value={endDate}
                  min={startDate || undefined}
                  max={history.at(-1)?.payoutDate.slice(0, 10)}
                  onChange={(event) => {
                    setEndDate(event.target.value);
                    setPan(0);
                  }}
                  className="h-9 rounded-lg border border-sky-200/15 bg-[#061d32] px-2 text-sm text-slate-100 outline-none focus:border-sky-400"
                />
              </label>
              <label className="grid gap-1 text-xs font-medium text-slate-400">
                Price card distance ({cardDistance}px)
                <input
                  aria-label="Dividend price card distance"
                  type="range"
                  min="8"
                  max="48"
                  step="2"
                  value={cardDistance}
                  onChange={(event) => setCardDistance(Number(event.target.value))}
                  className="h-2 cursor-pointer accent-sky-400"
                />
              </label>
              <button
                type="button"
                aria-label="Toggle dividend chart logarithmic scale"
                aria-pressed={logScale}
                onClick={() => setLogScale((current) => !current)}
                className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-sky-400 px-3 text-sm font-semibold text-slate-950"
              >
                <LineChart size={15} />
                {logScale ? "Log" : "Linear"}
              </button>
            </div>
          )}
          {visiblePayouts.length > 0 ? (
            <>
              <svg
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                role="img"
                aria-label={`${security.name} dividend payouts chart`}
                className="pointer-events-none h-full w-full overflow-visible"
              >
                {yTicks.map(({ ratio, position }) => (
                  <line
                    key={ratio}
                    x1="6"
                    x2="97"
                    y1={position}
                    y2={position}
                    stroke="#7dd3fc"
                    strokeOpacity="0.12"
                    strokeDasharray="1.5 2"
                    vectorEffect="non-scaling-stroke"
                  />
                ))}
                <line x1="6" x2="97" y1="86" y2="86" stroke="#7dd3fc" strokeOpacity="0.35" strokeWidth="0.4" vectorEffect="non-scaling-stroke" />
                <line x1="6" x2="6" y1="10" y2="86" stroke="#7dd3fc" strokeOpacity="0.35" strokeWidth="0.4" vectorEffect="non-scaling-stroke" />
                {visiblePayouts.map((payout) => {
                  const isHovered = hovered?.payout.id === payout.id;
                  const position = xForDate(payout.payoutDate);
                  const width = Math.min(1.25, 60 / calendarRange * 91 * 86_400_000);
                  const amountY = yForAmount(payout.payoutAmount);
                  return (
                    <rect
                      key={payout.id}
                      x={position - width / 2}
                      y={amountY}
                      width={width}
                      height={86 - amountY}
                      rx="0.35"
                      fill={isHovered ? "#6ee7b7" : "#34d399"}
                      style={
                        isHovered
                          ? { filter: "drop-shadow(0 0 6px rgba(52, 211, 153, 0.9))" }
                          : undefined
                      }
                    >
                      <title>{formatDate(payout.payoutDate)} · {numberFormatter.format(payout.payoutAmount)}</title>
                    </rect>
                  );
                })}
                {yearTicks.map((tick) => (
                  <line key={`year-${tick.year}`} x1={tick.position} x2={tick.position} y1="86" y2="89" stroke="#7dd3fc" strokeOpacity="0.5" strokeWidth="0.4" vectorEffect="non-scaling-stroke" />
                ))}
                {tickLabels.map((tick) => (
                  <line key={`period-${tick.date}`} x1={tick.position} x2={tick.position} y1="86" y2="88" stroke="#7dd3fc" strokeOpacity="0.35" strokeWidth="0.35" vectorEffect="non-scaling-stroke" />
                ))}
              </svg>
              {hovered && visiblePayouts.some((payout) => payout.id === hovered.payout.id) && (
                <>
                  <div aria-hidden="true" className="pointer-events-none absolute z-10 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-sky-300/35" style={{ left: hovered.x, top: hovered.axisY }} />
                  <div aria-hidden="true" className="pointer-events-none absolute z-10 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-sky-300/35" style={{ left: hovered.axisX, top: hovered.y }} />
                </>
              )}
              {hovered && hoveredDate && (
                <>
                  {showTimeHoverCard && (
                    <div className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-md border border-sky-200/20 bg-[#08243d]/80 px-2 py-1 text-xs font-semibold text-white shadow-lg" style={{ left: Math.min(chartWidth - 48, Math.max(54, hovered.x)), top: "88%" }}>
                      {monthFormatter.format(hoveredDate)} {hoveredDate.getUTCDate()}
                    </div>
                  )}
                  <div className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md border border-sky-200/20 bg-[#08243d]/80 px-2 py-1 text-xs font-semibold text-white shadow-lg" style={{ left: Math.min(chartWidth - 48, Math.max(54, hovered.x)), top: Math.max(18, hovered.y - cardDistance) }}>
                    {numberFormatter.format(hovered.payout.payoutAmount)}
                  </div>
                </>
              )}
              <div className="pointer-events-none absolute inset-y-3 left-1 w-[5%] text-right text-slate-400">
                {yTicks.map(({ label, ratio, position }) => (
                  <span key={ratio} className="absolute right-0 -translate-y-1/2 text-xs font-medium" style={{ top: `${position}%` }}>{label}</span>
                ))}
              </div>
              <div className="pointer-events-none absolute bottom-[8%] left-[6%] right-[3%] text-[10px] text-slate-500">
                {yearTicks.map((tick) => (
                  <span key={tick.year} className="absolute -translate-x-1/2 text-center text-xs font-medium text-slate-400" style={{ left: `${((tick.position - 6) / 91) * 100}%` }}>{tick.year}</span>
                ))}
                {tickLabels.map((tick) => (
                  <span key={tick.date} className="absolute -translate-x-1/2 whitespace-nowrap text-center" style={{ left: `${((tick.position - 6) / 91) * 100}%` }}>{tick.label}</span>
                ))}
              </div>
            </>
          ) : (
            <div className="grid h-full place-items-center text-sm text-slate-400">No dividend payouts in this date range.</div>
          )}
        </div>
      )}
    </section>
  );
}
function DetailCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-sky-200/15 bg-slate-900/60 p-5 shadow-xl shadow-slate-950/20 backdrop-blur-sm">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-sky-300">
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-slate-700/50 py-2.5 last:border-0">
      <span className="text-sm text-slate-400">{label}</span>
      <span className="text-right text-sm font-medium text-slate-100">
        {value}
      </span>
    </div>
  );
}

function TypeSpecificDetails({ security }: { security: Security }) {
  if (security.securityType === SecurityType.Stock) {
    const stock = security as Stock;
    return (
      <>
        <DetailCard title="Stock metrics">
          <Metric label="ISIN" value={stock.isin || "—"} />
          <Metric
            label="Shares outstanding"
            value={
              stock.sharesOutstanding
                ? compactFormatter.format(stock.sharesOutstanding)
                : "—"
            }
          />
          <Metric
            label="Dividend rate"
            value={
              stock.dividendRate ? formatPrice(stock.dividendRate, stock) : "—"
            }
          />
          <Metric
            label="Target mean price"
            value={
              stock.targetMeanPrice
                ? formatPrice(stock.targetMeanPrice, stock)
                : "—"
            }
          />
          <Metric
            label="Recommendation mean"
            value={
              stock.recommendationMean
                ? numberFormatter.format(stock.recommendationMean)
                : "—"
            }
          />
          <Metric
            label="Data last updated"
            value={
              <span title="All timestamps are UTC">
                {formatDateTime(stock.lastCompleteUpdateTime)}
              </span>
            }
          />
        </DetailCard>
        <Splits splits={stock.splits} />
      </>
    );
  }
  if (security.securityType === SecurityType.ETF) {
    const etf = security as ETF;
    return (
      <>
        <DetailCard title="ETF metrics">
          <Metric label="ISIN" value={etf.isin || "—"} />
          <Metric
            label="Net expense ratio"
            value={
              etf.netExpenseRatio
                ? `${numberFormatter.format(etf.netExpenseRatio)}%`
                : "—"
            }
          />
          <Metric
            label="Dividend yield"
            value={
              etf.dividendYield
                ? `${numberFormatter.format(etf.dividendYield)}%`
                : "—"
            }
          />
        </DetailCard>
        <Events
          title="Distribution events"
          events={etf.distributionEvents}
          security={etf}
        />
        <Splits splits={etf.splits} />
      </>
    );
  }
  if (security.securityType === SecurityType.Cryptocurrency) {
    const crypto = security as Extract<
      Security,
      { securityType: typeof SecurityType.Cryptocurrency }
    >;
    return (
      <DetailCard title="Cryptocurrency metrics">
        <Metric
          label="Market capitalization"
          value={
            crypto.marketCapitalization
              ? formatPrice(crypto.marketCapitalization, crypto)
              : "—"
          }
        />
      </DetailCard>
    );
  }
  return (
    <DetailCard title="Currency pair">
      <Metric label="Base currency" value={security.symbol} />
      <Metric label="Quote currency" value={security.currency?.symbol ?? "—"} />
    </DetailCard>
  );
}

function Events({
  title,
  events,
  security,
}: {
  title: string;
  events: { id: number; payoutDate: string; payoutAmount: number }[];
  security: PubliclyTradedSecurityBase;
}) {
  if (!events?.length) return null;
  return (
    <DetailCard title={title}>
      <div className="space-y-2">
        {events.map((event) => (
          <div
            key={event.id}
            className="flex items-center justify-between text-sm"
          >
            <span className="text-slate-400">
              {formatDate(event.payoutDate)}
            </span>
            <span className="font-medium text-emerald-300">
              {formatPrice(event.payoutAmount, security)}
            </span>
          </div>
        ))}
      </div>
    </DetailCard>
  );
}

function Splits({
  splits,
}: {
  splits: { id: number; date: string; splitRatio: number }[];
}) {
  if (!splits?.length) return null;
  return (
    <DetailCard title="Splits">
      <div className="space-y-2">
        {splits.map((split) => (
          <div
            key={split.id}
            className="flex items-center justify-between text-sm"
          >
            <span className="text-slate-400">{formatDate(split.date)}</span>
            <span className="font-medium text-slate-100">
              {numberFormatter.format(split.splitRatio)}:1
            </span>
          </div>
        ))}
      </div>
    </DetailCard>
  );
}

const durationSteps = [
  { delta: 1, label: "Increase tracked change duration", points: "0,6 10,6 5,0" },
  { delta: -1, label: "Decrease tracked change duration", points: "0,0 10,0 5,6" },
];

function TrackedDurationInput({
  inputRef,
  defaultValue,
  disabled,
  onCommit,
}: {
  inputRef: { current: HTMLInputElement | null };
  defaultValue: number;
  disabled: boolean;
  onCommit?: (input: HTMLInputElement) => void;
}) {
  const step = (delta: number) => {
    const input = inputRef.current;
    if (!input) return;
    const current = Number.isInteger(input.valueAsNumber) ? input.valueAsNumber : 0;
    input.value = String(Math.max(1, current + delta));
    input.focus();
  };

  return (
    <div className="flex items-center gap-1">
      <input
        ref={inputRef}
        type="number"
        min={1}
        step={1}
        defaultValue={defaultValue}
        aria-label="Tracked change duration (days)"
        disabled={disabled}
        onBlur={(event) => onCommit?.(event.currentTarget)}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
        }}
        className="w-16 rounded-md border border-sky-200/15 bg-slate-950 px-2 py-1 text-right font-medium text-white transition-colors duration-200 [appearance:textfield] hover:border-sky-300/40 focus-visible:border-sky-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 disabled:cursor-not-allowed disabled:opacity-50 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      <div className="flex flex-col">
        {durationSteps.map(({ delta, label, points }) => (
          <button
            key={delta}
            type="button"
            aria-label={label}
            disabled={disabled}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => step(delta)}
            className="flex h-3.5 w-5 items-center justify-center rounded-sm text-slate-500 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 enabled:hover:text-sky-300 disabled:cursor-not-allowed disabled:text-slate-700"
          >
            <svg width="10" height="6" viewBox="0 0 10 6" aria-hidden="true">
              <polygon points={points} fill="currentColor" />
            </svg>
          </button>
        ))}
      </div>
    </div>
  );
}

function AddToWatchlistMenu({
  watchlists,
  watchedIds,
  disabled,
  onToggle,
  onCreate,
}: {
  watchlists: WatchlistMinimal[];
  watchedIds: number[];
  disabled: boolean;
  onToggle: (watchlist: WatchlistMinimal) => void;
  onCreate: () => void;
}) {
  const otherWatchlists = watchlists.filter((watchlist) => !watchlist.isPrimary && !watchlist.isSecondary);

  return (
    <div className="group relative shrink-0">
      <button
        type="button"
        aria-label="Add security to another watchlist"
        disabled={disabled}
        className="rounded-full p-1 text-slate-500 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 disabled:cursor-not-allowed disabled:text-slate-700 enabled:hover:scale-110 enabled:hover:text-sky-300"
      >
        <Plus size={20} aria-hidden="true" />
      </button>
      <div className="absolute left-0 top-full z-20 hidden w-64 max-w-[calc(100vw-2rem)] pt-2 group-focus-within:block group-hover:block">
        <div className="rounded-xl border border-sky-200/15 bg-slate-900 p-2 text-sm shadow-xl shadow-slate-950/40">
          {otherWatchlists.length === 0 && (
            <p className="px-2 py-1.5 text-slate-400">No other watchlists</p>
          )}
          {otherWatchlists.map((watchlist) => {
            const pressed = watchedIds.includes(watchlist.id);
            return (
              <div
                key={watchlist.id}
                className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 hover:bg-slate-800/60"
              >
                <span className="truncate font-semibold text-white">{watchlist.name}</span>
                <button
                  type="button"
                  aria-label={
                    pressed
                      ? `Remove security from ${watchlist.name}`
                      : `Add security to ${watchlist.name}`
                  }
                  aria-pressed={pressed}
                  disabled={disabled}
                  onClick={() => onToggle(watchlist)}
                  className={`shrink-0 rounded-full p-1 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 disabled:cursor-not-allowed disabled:text-slate-700 enabled:hover:scale-110 enabled:hover:drop-shadow-[0_0_6px_rgba(125,211,252,0.7)] ${
                    pressed ? "text-sky-300" : "text-slate-500 enabled:hover:text-sky-300"
                  }`}
                >
                  <Star size={16} fill={pressed ? "currentColor" : "none"} strokeWidth={2} aria-hidden="true" />
                </button>
              </div>
            );
          })}
          <button
            type="button"
            onClick={onCreate}
            disabled={disabled}
            className="mt-1 w-full rounded-lg border-t border-sky-200/10 px-2 pt-2.5 pb-1.5 text-left font-medium text-sky-300 transition-colors hover:text-sky-200 disabled:cursor-not-allowed disabled:text-slate-700"
          >
            Create watchlist
          </button>
        </div>
      </div>
    </div>
  );
}

type WatchlistKind = "none" | "primary" | "secondary";

function CreateWatchlistDialog({
  hasPrimary,
  hasSecondary,
  onClose,
  onCreated,
}: {
  hasPrimary: boolean;
  hasSecondary: boolean;
  onClose: () => void;
  onCreated: (watchlist: WatchlistMinimal) => void;
}) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState<WatchlistKind>("none");
  const [isPinned, setIsPinned] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const durationInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = name.trim();
    const days = durationInputRef.current?.valueAsNumber ?? Number.NaN;
    if (!trimmedName) {
      setError("Enter a name for the watchlist.");
      return;
    }
    if (!Number.isInteger(days) || days < 1) {
      setError("Tracked change duration must be a whole number of at least 1.");
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      const created = await addWatchlist({
        id: 0,
        name: trimmedName,
        isPrimary: kind === "primary",
        isSecondary: kind === "secondary",
        isPinned,
        pinPosition: 0,
        trackedChangeDurationTradingDays: days,
      });
      onCreated(created);
    } catch {
      setError("Unable to create watchlist.");
      setSubmitting(false);
    }
  };

  const kindOptions: {
    value: WatchlistKind;
    label: string;
    disabled: boolean;
    disabledReason: string;
  }[] = [
    { value: "none", label: "Default", disabled: false, disabledReason: "" },
    {
      value: "primary",
      label: "Primary",
      disabled: hasPrimary,
      disabledReason: "A primary watchlist already exists. Only one can exist at a time.",
    },
    {
      value: "secondary",
      label: "Secondary",
      disabled: hasSecondary,
      disabledReason: "A secondary watchlist already exists. Only one can exist at a time.",
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-watchlist-title"
        className="w-full max-w-md rounded-2xl border border-sky-200/15 bg-slate-900 p-6 shadow-2xl shadow-slate-950/60"
      >
        <h2 id="create-watchlist-title" className="text-lg font-semibold text-white">
          Create watchlist
        </h2>
        <form onSubmit={submit} className="mt-5 flex flex-col gap-5">
          <label className="flex flex-col gap-2 text-sm text-slate-400">
            Name
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={submitting}
              autoFocus
              className="rounded-md border border-sky-200/15 bg-slate-950 px-3 py-2 text-white transition-colors hover:border-sky-300/40 focus-visible:border-sky-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </label>

          <fieldset className="flex flex-col gap-2 text-sm text-slate-400">
            <legend className="mb-2">Type</legend>
            <div className="flex flex-wrap gap-2">
              {kindOptions.map((option) => (
                <Tooltip key={option.value}>
                  <TooltipTrigger asChild>
                    <label
                      className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 transition-colors ${
                        option.disabled
                          ? "cursor-not-allowed border-sky-200/10 text-slate-600"
                          : kind === option.value
                            ? "cursor-pointer border-sky-300 bg-sky-400/15 text-sky-200"
                            : "cursor-pointer border-sky-200/15 text-slate-300 hover:border-sky-300/40"
                      }`}
                    >
                      <input
                        type="radio"
                        name="watchlist-kind"
                        value={option.value}
                        checked={kind === option.value}
                        disabled={option.disabled || submitting}
                        onChange={() => setKind(option.value)}
                        className="accent-sky-300"
                      />
                      {option.label}
                    </label>
                  </TooltipTrigger>
                  {option.disabled && (
                    <TooltipContent
                      side="top"
                      className="max-w-64 border border-sky-200/15 bg-slate-800 text-slate-100 shadow-xl"
                    >
                      {option.disabledReason}
                    </TooltipContent>
                  )}
                </Tooltip>
              ))}
            </div>
          </fieldset>

          <div className="flex items-center justify-between gap-3 text-sm text-slate-400">
            <span>Pin to dashboard</span>
            <button
              type="button"
              aria-label="Pin watchlist"
              aria-pressed={isPinned}
              disabled={submitting}
              onClick={() => setIsPinned((pinned) => !pinned)}
              className={`rounded-full p-1 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 disabled:cursor-not-allowed disabled:text-slate-700 enabled:hover:scale-110 enabled:hover:drop-shadow-[0_0_6px_rgba(125,211,252,0.7)] ${
                isPinned ? "text-sky-300" : "text-slate-500 enabled:hover:text-sky-300"
              }`}
            >
              <Pin size={16} fill={isPinned ? "currentColor" : "none"} aria-hidden="true" />
            </button>
          </div>

          <div className="flex items-center justify-between gap-3 text-sm text-slate-400">
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="cursor-help underline decoration-dotted decoration-slate-500 underline-offset-4">
                  Tracked change duration (days)
                </span>
              </TooltipTrigger>
              <TooltipContent
                side="top"
                className="max-w-72 border border-sky-200/15 bg-slate-800 text-slate-100 shadow-xl"
              >
                Set this to 1 to create a daily watchlist, or to 5 for a weekly one. Qlarissa will track
                changes to the security price over this period when displaying your watchlist!
              </TooltipContent>
            </Tooltip>
            <TrackedDurationInput
              inputRef={durationInputRef}
              defaultValue={1}
              disabled={submitting}
            />
          </div>

          {error && (
            <p role="alert" className="text-sm text-rose-300">
              {error}
            </p>
          )}

          <div className="mt-1 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-lg border border-sky-200/15 px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:border-sky-300/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-sky-400/20 px-4 py-2 text-sm font-semibold text-sky-200 transition-colors hover:bg-sky-400/30 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? "Creating…" : "Create watchlist"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function StarToggle({
  label,
  size,
  pressed,
  onToggle,
  watchlist,
  disabled,
  saving,
  onSave,
  loadError,
}: {
  label: string;
  size: number;
  pressed: boolean;
  onToggle: () => void;
  watchlist: WatchlistMinimal | undefined;
  disabled: boolean;
  saving: boolean;
  onSave: (watchlist: WatchlistMinimal, changes: Partial<WatchlistMinimal>) => Promise<boolean>;
  loadError: boolean;
}) {
  const durationInputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [isDurationTipOpen, setIsDurationTipOpen] = useState(false);

  const commitName = async (current: WatchlistMinimal, input: HTMLInputElement) => {
    const name = input.value.trim();
    if (!name || name === current.name) {
      input.value = current.name;
      return;
    }
    const saved = await onSave(current, { name });
    if (!saved) input.value = current.name;
  };

  const commitDuration = async (current: WatchlistMinimal, input: HTMLInputElement) => {
    const days = input.valueAsNumber;
    if (!Number.isInteger(days) || days < 1 || days === current.trackedChangeDurationTradingDays) {
      input.value = String(current.trackedChangeDurationTradingDays);
      return;
    }
    const saved = await onSave(current, { trackedChangeDurationTradingDays: days });
    if (!saved) input.value = String(current.trackedChangeDurationTradingDays);
  };

  const blurFocusedField = () => {
    const active = document.activeElement;
    if (active instanceof HTMLInputElement && wrapperRef.current?.contains(active)) active.blur();
  };

  return (
    <div ref={wrapperRef} className="group relative shrink-0" onMouseLeave={blurFocusedField}>
      <button
        type="button"
        aria-label={label}
        aria-pressed={pressed}
        disabled={disabled || !watchlist}
        onClick={onToggle}
        className={`rounded-full p-1 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 disabled:cursor-not-allowed disabled:text-slate-700 enabled:hover:scale-110 enabled:hover:drop-shadow-[0_0_6px_rgba(125,211,252,0.7)] ${
          pressed ? "text-sky-300" : "text-slate-500 enabled:hover:text-sky-300"
        }`}
      >
        <Star
          size={size}
          fill={pressed ? "currentColor" : "none"}
          strokeWidth={2}
          aria-hidden="true"
        />
      </button>
      {loadError && (
        <div className="absolute left-0 top-full z-20 hidden w-64 max-w-[calc(100vw-2rem)] pt-2 group-hover:block">
          <div className="rounded-xl border border-sky-200/15 bg-slate-900 p-4 text-sm text-slate-400 shadow-xl shadow-slate-950/40">
            Could not load watchlists
          </div>
        </div>
      )}
      {watchlist && (
        <div className="absolute left-0 top-full z-20 hidden w-64 max-w-[calc(100vw-2rem)] pt-2 group-hover:block">
          <div className="rounded-xl border border-sky-200/15 bg-slate-900 p-4 text-sm shadow-xl shadow-slate-950/40">
            <div className="flex items-center gap-3">
              <input
                key={watchlist.name}
                type="text"
                defaultValue={watchlist.name}
                aria-label="Watchlist name"
                disabled={saving}
                onBlur={(event) => commitName(watchlist, event.currentTarget)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") event.currentTarget.blur();
                }}
                className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-1 py-0.5 font-semibold text-white transition-colors duration-200 hover:border-sky-200/15 focus-visible:border-sky-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 disabled:cursor-not-allowed disabled:opacity-50"
              />
              <button
                type="button"
                aria-label={watchlist.isPinned ? "Unpin watchlist" : "Pin watchlist"}
                aria-pressed={watchlist.isPinned}
                disabled={saving}
                onClick={() => onSave(watchlist, { isPinned: !watchlist.isPinned })}
                className={`shrink-0 rounded-full p-1 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 disabled:cursor-not-allowed disabled:text-slate-700 enabled:hover:scale-110 enabled:hover:drop-shadow-[0_0_6px_rgba(125,211,252,0.7)] ${
                  watchlist.isPinned ? "text-sky-300" : "text-slate-500 enabled:hover:text-sky-300"
                }`}
              >
                <Pin
                  size={16}
                  fill={watchlist.isPinned ? "currentColor" : "none"}
                  aria-hidden="true"
                />
              </button>
            </div>
            <div className="mt-3 flex items-center justify-between gap-3 text-slate-400">
              <span
                onMouseEnter={() => setIsDurationTipOpen(true)}
                onMouseLeave={() => setIsDurationTipOpen(false)}
                className="cursor-help underline decoration-dotted decoration-slate-500 underline-offset-4"
              >
                Tracked change duration (days)
              </span>
              <TrackedDurationInput
                key={watchlist.trackedChangeDurationTradingDays}
                inputRef={durationInputRef}
                defaultValue={watchlist.trackedChangeDurationTradingDays}
                disabled={saving}
                onCommit={(input) => commitDuration(watchlist, input)}
              />
            </div>
          </div>
          {isDurationTipOpen && (
            <div
              role="tooltip"
              className="pointer-events-none absolute left-0 top-full z-30 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-lg border border-sky-200/15 bg-slate-800 px-3 py-2 text-xs leading-relaxed text-slate-100 shadow-xl"
            >
              Set this to 1 to create a daily watchlist, or to 5 for a weekly one. Qlarissa will track
              changes to the security price over this period when displaying your watchlist!
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function SecurityDetail() {
  const { id } = useParams();
  const securityId = Number(id);
  const [security, setSecurity] = useState<Security | null>(null);
  const [graphHistory, setGraphHistory] = useState<DailyPrice[]>([]);
  const [livePrice, setLivePrice] = useState<number | null>(null);
  const [liveTimestamp, setLiveTimestamp] = useState<string | null>(null);
  const [liveUpdatesUnavailable, setLiveUpdatesUnavailable] = useState(false);
  const [error, setError] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [isBusinessSummaryExpanded, setIsBusinessSummaryExpanded] = useState(false);
  const [watchlists, setWatchlists] = useState<WatchlistMinimal[] | null>(null);
  const [watchedWatchlistIds, setWatchedWatchlistIds] = useState<number[] | null>(null);
  const [togglingWatchlistId, setTogglingWatchlistId] = useState<number | null>(null);
  const [savingWatchlistId, setSavingWatchlistId] = useState<number | null>(null);
  const [watchlistsFailed, setWatchlistsFailed] = useState(false);
  const [isCreateWatchlistOpen, setIsCreateWatchlistOpen] = useState(false);
  const primaryWatchlist = watchlists?.find((watchlist) => watchlist.isPrimary);
  const secondaryWatchlist = watchlists?.find((watchlist) => watchlist.isSecondary);
  const starsReady = watchlists !== null && watchedWatchlistIds !== null;
  const isStarredLarge =
    !!primaryWatchlist && !!watchedWatchlistIds?.includes(primaryWatchlist.id);
  const isStarredSmall =
    !!secondaryWatchlist && !!watchedWatchlistIds?.includes(secondaryWatchlist.id);
  const businessSummaryRef = useRef<HTMLParagraphElement>(null);
  const unavailableTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!Number.isInteger(securityId) || securityId < 1) {
      setError(true);
      return;
    }
    const controller = new AbortController();
    setSecurity(null);
    setGraphHistory([]);
    setLivePrice(null);
    setLiveTimestamp(null);
    setIsBusinessSummaryExpanded(false);
    setError(false);
    setWatchlists(null);
    setWatchedWatchlistIds(null);
    setWatchlistsFailed(false);
    getSecurity(securityId, controller.signal)
      .then((loadedSecurity) => {
        setSecurity(loadedSecurity);
        setGraphHistory(loadedSecurity.priceHistory ?? []);
      })
      .catch((cause) => {
        if (!(cause instanceof DOMException && cause.name === "AbortError"))
          setError(true);
      });
    getWatchlistsMinimal()
      .then(setWatchlists)
      .catch(() => setWatchlistsFailed(true));
    getWatchlistIdsForSecurity(securityId, controller.signal)
      .then(setWatchedWatchlistIds)
      .catch((cause) => {
        if (!(cause instanceof DOMException && cause.name === "AbortError"))
          setWatchlistsFailed(true);
      });
    return () => controller.abort();
  }, [securityId]);

  const toggleWatchlist = async (watchlist: WatchlistMinimal) => {
    const isWatched = watchedWatchlistIds?.includes(watchlist.id) ?? false;
    setTogglingWatchlistId(watchlist.id);
    try {
      if (isWatched) await unwatchSecurity(watchlist.id, securityId);
      else await watchSecurity(watchlist.id, securityId);
      setWatchedWatchlistIds((ids) => {
        const current = ids ?? [];
        return isWatched
          ? current.filter((id) => id !== watchlist.id)
          : [...current, watchlist.id];
      });
    } catch {
      // A failed request leaves the star in its last server-confirmed state.
    } finally {
      setTogglingWatchlistId(null);
    }
  };

  const saveWatchlist = async (
    watchlist: WatchlistMinimal,
    changes: Partial<WatchlistMinimal>,
  ): Promise<boolean> => {
    setSavingWatchlistId(watchlist.id);
    try {
      const updated = await updateWatchlist({ ...watchlist, ...changes });
      setWatchlists(
        (current) => current?.map((item) => (item.id === updated.id ? updated : item)) ?? null,
      );
      return true;
    } catch {
      return false;
    } finally {
      setSavingWatchlistId(null);
    }
  };

  const handleUpdate = async () => {
    if (isUpdating) return;

    setIsUpdating(true);
    setUpdateError(null);
    try {
      await updateSecurity(securityId);
      window.location.reload();
    } catch (cause) {
      setUpdateError(
        cause instanceof Error ? cause.message : "Unable to update security.",
      );
      setIsUpdating(false);
    }
  };

  useEffect(() => {
    if (!security) return;

    const symbol = security.symbol;
    const normalizedSymbol = symbol.toUpperCase();
    let disposed = false;
    let connection: HubConnection | null = null;

    const startUnavailableTimer = () => {
      if (unavailableTimerRef.current) clearTimeout(unavailableTimerRef.current);
      unavailableTimerRef.current = setTimeout(() => {
        if (!disposed) setLiveUpdatesUnavailable(true);
      }, 30_000);
    };

    const applyLivePrice = (update: LivePrice) => {
      if (
        disposed ||
        update.symbol.toUpperCase() !== normalizedSymbol ||
        !Number.isFinite(update.price)
      ) {
        return;
      }

      const date = dateOnlyFromTimestamp(update.timestamp);
      if (!date) return;

      setLivePrice(update.price);
      setLiveTimestamp(update.timestamp);
      setLiveUpdatesUnavailable(false);
      startUnavailableTimer();
      setGraphHistory((history) => {
        const pointIndex = history.findIndex((point) => point.date === date);
        if (pointIndex >= 0) {
          return history.map((point, index) =>
            index === pointIndex
              ? {
                  ...point,
                  average: update.price,
                  close: update.price,
                  high:
                    update.dayHigh !== undefined && Number.isFinite(update.dayHigh)
                      ? update.dayHigh
                      : point.high,
                  low:
                    update.dayLow !== undefined && Number.isFinite(update.dayLow)
                      ? update.dayLow
                      : point.low,
                }
              : point,
          );
        }

        const latestDate = history.reduce(
          (latest, point) => (point.date > latest ? point.date : latest),
          "",
        );
        if (date <= latestDate) return history;

        return [
          ...history,
          {
            id: Date.parse(`${date}T00:00:00Z`),
            date,
            open: update.price,
            close: update.price,
            average: update.price,
            high:
              update.dayHigh !== undefined && Number.isFinite(update.dayHigh)
                ? update.dayHigh
                : update.price,
            low:
              update.dayLow !== undefined && Number.isFinite(update.dayLow)
                ? update.dayLow
                : update.price,
          },
        ];
      });
    };

    const handleSnapshot = (updates: LivePrice[]) => {
      const update = updates[0];
      if (update) applyLivePrice(update);
    };
    const handleBatch = (updates: LivePrice[]) => {
      const update = updates.find(
        (item) => item.symbol.toUpperCase() === normalizedSymbol,
      );
      if (update) applyLivePrice(update);
    };
    const subscribe = async () => {
      if (connection?.state === HubConnectionState.Connected) {
        await connection.invoke("Subscribe", [symbol]);
      }
    };

    startUnavailableTimer();
    connection = new HubConnectionBuilder()
      .withUrl(`${import.meta.env.VITE_API_BASE_URL}/hubs/live-prices`, {
        accessTokenFactory: () => localStorage.getItem("jwt") ?? "",
      })
      .withAutomaticReconnect()
      .configureLogging(LogLevel.Warning)
      .build();
    connection.on("PriceSnapshot", handleSnapshot);
    connection.on("PriceBatch", handleBatch);
    connection.onreconnected(() => {
      void subscribe().catch(() => undefined);
    });
    void connection
      .start()
      .then(subscribe)
      .catch(() => undefined);

    return () => {
      disposed = true;
      if (unavailableTimerRef.current) clearTimeout(unavailableTimerRef.current);
      connection?.off("PriceSnapshot", handleSnapshot);
      connection?.off("PriceBatch", handleBatch);
      void (async () => {
        if (connection?.state === HubConnectionState.Connected) {
          await connection.invoke("Unsubscribe", [symbol]).catch(() => undefined);
        }
        await connection?.stop();
      })();
    };
  }, [security]);

  return (
    <main
      className="min-h-screen bg-[#02182c] text-slate-100"
      aria-busy={isUpdating}
    >
      <div
        className="mx-auto w-full max-w-[1500px] px-5 py-6 sm:px-8 lg:px-12"
        inert={isUpdating || undefined}
      >
        <header className="flex items-center justify-between border-b border-sky-100/10 pb-6">
          <Link
            to="/dashboard"
            className="text-2xl font-bold tracking-tight text-white"
          >
            Qlarissa<span className="text-sky-400">.</span>
          </Link>
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 rounded-xl border border-sky-200/15 px-3 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
          >
            <ArrowLeft size={16} />
            Dashboard
          </Link>
        </header>
        {!security && !error && (
          <div className="grid min-h-[65vh] place-items-center">
            <div className="text-center">
              <RefreshCw
                className="mx-auto animate-spin text-sky-300"
                size={26}
              />
              <p className="mt-4 text-slate-400">Loading security…</p>
            </div>
          </div>
        )}
        {error && (
          <div className="grid min-h-[65vh] place-items-center text-center">
            <div>
              <Info className="mx-auto text-rose-300" size={28} />
              <h1 className="mt-4 text-xl font-semibold text-white">
                Security unavailable
              </h1>
              <p className="mt-2 text-slate-400">
                This security could not be loaded. Please return to the
                dashboard and try again.
              </p>
            </div>
          </div>
        )}
        {security && (
          <div className="py-8">
            {updateError && (
              <div
                role="alert"
                className="mb-6 flex items-start gap-3 rounded-xl border border-rose-300/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-100"
              >
                <Info className="mt-0.5 shrink-0 text-rose-300" size={18} />
                <p>{updateError}</p>
              </div>
            )}
            <section className="flex flex-col justify-between gap-6 rounded-t-2xl rounded-b-none border border-b-0 border-sky-200/15 bg-gradient-to-br from-slate-900/80 to-[#08243d] p-6 shadow-xl shadow-slate-950/20 sm:p-8 lg:flex-row lg:items-start">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="rounded-lg bg-sky-400/15 px-2.5 py-1 text-xs font-semibold uppercase tracking-wider text-sky-300">
                    {typeNames[security.securityType]}
                  </span>
                  <span className="text-sm text-slate-400">
                    {security.exchangeName || security.exchangeShortName || "—"}
                  </span>
                </div>
                <div className="mt-4 flex items-center gap-3">
                  <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                    {security.name}
                  </h1>
                  <StarToggle
                    label="Star security"
                    size={28}
                    pressed={isStarredLarge}
                    onToggle={() => primaryWatchlist && toggleWatchlist(primaryWatchlist)}
                    watchlist={primaryWatchlist}
                    disabled={!starsReady || togglingWatchlistId !== null}
                    saving={savingWatchlistId !== null}
                    onSave={saveWatchlist}
                    loadError={watchlistsFailed}
                  />
                  <StarToggle
                    label="Star security (secondary)"
                    size={20}
                    pressed={isStarredSmall}
                    onToggle={() => secondaryWatchlist && toggleWatchlist(secondaryWatchlist)}
                    watchlist={secondaryWatchlist}
                    disabled={!starsReady || togglingWatchlistId !== null}
                    saving={savingWatchlistId !== null}
                    onSave={saveWatchlist}
                    loadError={watchlistsFailed}
                  />
                  <AddToWatchlistMenu
                    watchlists={watchlists ?? []}
                    watchedIds={watchedWatchlistIds ?? []}
                    disabled={!starsReady || togglingWatchlistId !== null}
                    onToggle={toggleWatchlist}
                    onCreate={() => setIsCreateWatchlistOpen(true)}
                  />
                  {isCreateWatchlistOpen && (
                    <CreateWatchlistDialog
                      hasPrimary={!!primaryWatchlist}
                      hasSecondary={!!secondaryWatchlist}
                      onClose={() => setIsCreateWatchlistOpen(false)}
                      onCreated={(created) => {
                        setWatchlists((current) => [...(current ?? []), created]);
                        setIsCreateWatchlistOpen(false);
                      }}
                    />
                  )}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <p className="text-lg text-slate-400">
                    {security.symbol} · {security.shortName}
                  </p>
                  {security.securityType === SecurityType.Stock &&
                    security.investorRelationsURL && (
                      <a
                        href={security.investorRelationsURL}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-sm font-medium text-sky-300 transition-colors hover:text-sky-200"
                      >
                        Investor relations <ExternalLink size={14} />
                      </a>
                    )}
                </div>
                {security.securityType === SecurityType.Stock &&
                  security.businessSummary && (
                    <div className="mt-3 w-full max-w-4xl">
                      <p
                        id="business-summary"
                        ref={businessSummaryRef}
                        style={{
                          maxHeight: isBusinessSummaryExpanded
                            ? `${businessSummaryRef.current?.scrollHeight ?? 72}px`
                            : "72px",
                          maskImage: isBusinessSummaryExpanded
                            ? "none"
                            : "linear-gradient(to bottom, #000 0px, #000 24px, rgb(0 0 0 / 0.55) 48px, rgb(0 0 0 / 0.2) 72px)",
                          WebkitMaskImage: isBusinessSummaryExpanded
                            ? "none"
                            : "linear-gradient(to bottom, #000 0px, #000 24px, rgb(0 0 0 / 0.55) 48px, rgb(0 0 0 / 0.2) 72px)",
                        }}
                        className="overflow-hidden text-sm leading-6 text-slate-300 transition-[max-height] duration-300 ease-in-out motion-reduce:transition-none"
                      >
                        {security.businessSummary}
                      </p>
                      <button
                        type="button"
                        aria-label={
                          isBusinessSummaryExpanded
                            ? "Collapse business summary"
                            : "Expand business summary"
                        }
                        aria-controls="business-summary"
                        aria-expanded={isBusinessSummaryExpanded}
                        onClick={() =>
                          setIsBusinessSummaryExpanded((expanded) => !expanded)
                        }
                        className="mt-1 flex h-7 w-full items-center justify-center rounded-lg border border-sky-300/20 bg-slate-900/70 text-sky-300 transition-colors hover:bg-sky-400/15 hover:text-sky-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/70"
                      >
                        <ChevronDown
                          size={16}
                          className={`transition-transform duration-300 ease-in-out motion-reduce:transition-none ${
                            isBusinessSummaryExpanded ? "rotate-180" : ""
                          }`}
                        />
                      </button>
                    </div>
                  )}
              </div>
              <div className="lg:text-right">
                <p className="text-3xl font-semibold text-white">
                  {formatPrice(livePrice ?? security.price, security)}
                </p>
                {liveUpdatesUnavailable && (
                  <p className="mt-1 text-xs text-slate-500">
                    Live price updates are currently unavailable.
                  </p>
                )}
                <p className="mt-2 text-xs text-slate-500">
                  Updated {formatDateTime(liveTimestamp ?? security.priceLastUpdatedTime)}
                </p>
                <button
                  type="button"
                  onClick={handleUpdate}
                  disabled={isUpdating}
                  className="mt-5 inline-flex items-center gap-2 rounded-xl border border-sky-300/35 bg-sky-400/10 px-4 py-2 text-sm font-semibold text-sky-100 shadow-sm transition-colors hover:bg-sky-400/20 hover:shadow-[0_0_14px_rgba(56,189,248,0.25)] focus-visible:border-sky-300 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <RefreshCw size={16} />
                  Update
                </button>
              </div>
            </section>
            <div>
              <Chart
                security={security}
                priceHistory={graphHistory}
                livePriceDate={
                  liveTimestamp ? dateOnlyFromTimestamp(liveTimestamp) : null
                }
              />
            </div>
            {security.securityType === SecurityType.Stock &&
              security.dividendPayouts?.length > 0 && (
                <DividendChart
                  payouts={security.dividendPayouts}
                  security={security}
                />
              )}
            <div className="mt-6">
              <div className="grid content-start gap-6">
                <TypeSpecificDetails security={security} />
              </div>
            </div>
          </div>
        )}
      </div>
      {isUpdating && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-[#02182c]/85 px-5 backdrop-blur-sm"
          role="status"
          aria-live="assertive"
        >
          <div className="text-center">
            <RefreshCw className="mx-auto animate-spin text-sky-300" size={32} />
            <p className="mt-4 font-medium text-white">Updating security…</p>
            <p className="mt-2 text-sm text-slate-300">
              This may take a moment. Please wait.
            </p>
          </div>
        </div>
      )}
    </main>
  );
}
