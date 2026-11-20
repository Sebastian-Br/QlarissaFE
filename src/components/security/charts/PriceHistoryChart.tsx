import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
} from "react";
import { Info } from "lucide-react";
import { useChartPointer } from "@/hooks/useChartPointer";
import { useChartViewport } from "@/hooks/useChartViewport";
import {
  PLOT,
  clientToPlotX,
  clientToPlotY,
  findHoveredPlotIndex,
  fullPlotHoverPath,
  hoverAnchor,
  hoverBandPath,
  hoverBasePath,
  isInsidePlot,
} from "@/lib/chart/plot";
import {
  createTimeAxis,
  dateToPlotX,
  nearestDateIndexAtPlotX,
} from "@/lib/chart/timeAxis";
import {
  axisNumberFormatter,
  formatDate,
  formatPrice,
  numberFormatter,
} from "@/lib/formatting";
import type {
  DailyPrice,
  PubliclyTradedSecurityBase,
} from "@/models/Security";
import {
  ChartAxisLabels,
  ChartGridLines,
  ChartSurface,
  ChartTimeTicks,
} from "./ChartFrame";
import {
  ChartCrosshair,
  ChartHoverLabels,
  type HoverAnchor,
} from "./ChartHover";
import {
  ChartSettingsButton,
  ChartSettingsPanel,
  HoverBehaviorSelector,
  type ChartSettingsLabels,
  type HoverBehavior,
} from "./ChartSettings";

const priceChartLabels: ChartSettingsLabels = {
  startDate: "Chart start date",
  endDate: "Chart end date",
  cardDistance: "Price card distance",
  logScale: "Toggle logarithmic scale",
};

interface PriceHover extends HoverAnchor {
  point: DailyPrice;
}

interface PlotPoint {
  point: DailyPrice;
  x: number;
  y: number;
}

type TimeAxis = ReturnType<typeof createTimeAxis>;

const isChartOverlay = (target: EventTarget) =>
  target instanceof Element && target.closest("[data-chart-overlay]") !== null;

const PriceSeries = memo(function PriceSeries({
  name,
  path,
  triggerPath,
  yTicks,
  yearTicks,
  tickLabels,
  selected,
}: {
  name: string;
  path: string;
  triggerPath: string;
  yTicks: { ratio: number; position: number }[];
  yearTicks: TimeAxis["yearTicks"];
  tickLabels: TimeAxis["tickLabels"];
  selected: { x: number; y: number } | null;
}) {
  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      role="img"
      aria-label={`${name} price history chart`}
      className="pointer-events-none h-full w-full overflow-visible"
    >
      <ChartGridLines yTicks={yTicks} />
      <path
        d={path}
        fill="none"
        stroke="#38bdf8"
        strokeWidth="0.75"
        vectorEffect="non-scaling-stroke"
      />
      <ChartTimeTicks yearTicks={yearTicks} tickLabels={tickLabels} />
      {triggerPath && <path d={triggerPath} fill="#22c55e" fillOpacity="0.10" />}
      {selected && (
        <circle
          cx={selected.x}
          cy={selected.y}
          r="1.55"
          fill="#7dd3fc"
          style={{ filter: "drop-shadow(0 0 8px #38bdf8)" }}
          vectorEffect="non-scaling-stroke"
        />
      )}
    </svg>
  );
});

export function PriceHistoryChart({
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
  const [hoverDistance, setHoverDistance] = useState(5);
  const [hoverEasing, setHoverEasing] = useState(5);
  const [hoverBehavior, setHoverBehavior] =
    useState<HoverBehavior>("dynamic");
  const [previewHoverBehavior, setPreviewHoverBehavior] =
    useState<HoverBehavior | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [selected, setSelected] = useState<PriceHover | null>(null);
  const [chartWidth, setChartWidth] = useState(0);
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const observer = new ResizeObserver(([entry]) => {
      setChartWidth(entry.contentRect.width);
    });
    observer.observe(chart);
    return () => observer.disconnect();
  }, []);

  const filteredHistory = useMemo(
    () =>
      history.filter(
        (price) =>
          (!startDate || price.date >= startDate) &&
          (!endDate || price.date <= endDate),
      ),
    [endDate, history, startDate],
  );
  const indexAtPlotX = useCallback(
    (plotX: number, items: DailyPrice[]) =>
      nearestDateIndexAtPlotX(items, plotX),
    [],
  );
  const viewport = useChartViewport({
    items: filteredHistory,
    chartRef,
    indexAtPlotX,
  });
  const { visibleItems: visibleHistory, setPan } = viewport;

  useEffect(() => {
    if (livePriceDate && livePriceDate > endDate) {
      setEndDate(livePriceDate);
      setPan(0);
    }
  }, [endDate, livePriceDate, setPan]);

  useEffect(() => {
    if (
      selected &&
      !visibleHistory.some((point) => point.id === selected.point.id)
    )
      setSelected(null);
  }, [selected, visibleHistory]);

  const visibleIds = useMemo(
    () => new Set(visibleHistory.map((point) => point.id)),
    [visibleHistory],
  );

  const scale = useMemo(() => {
    const values = visibleHistory
      .map((item) => item.average)
      .filter((value) => Number.isFinite(value));
    const canUseLog =
      logScale && values.length > 0 && values.every((value) => value > 0);
    const minValue = values.length ? Math.min(...values) : 1;
    const maxValue = values.length ? Math.max(...values) : 1;
    const min = canUseLog ? Math.log(minValue) : 0;
    const max = canUseLog ? Math.log(maxValue) : maxValue;
    const range = max - min || 1;
    const toY = (value: number) =>
      PLOT.top +
      ((max - (canUseLog ? Math.log(value) : value)) / range) * PLOT.height;
    return { canUseLog, minValue, min, max, toY };
  }, [logScale, visibleHistory]);

  const timeAxis = useMemo(
    () =>
      createTimeAxis({
        firstDate: visibleHistory[0]?.date,
        lastDate: visibleHistory.at(-1)?.date,
        chartWidth,
      }),
    [chartWidth, visibleHistory],
  );
  const { calendarStart, calendarRange, axisWidth, yearTicks, tickLabels, showTimeHoverCard } =
    timeAxis;

  const plotPoints = useMemo<PlotPoint[]>(
    () =>
      visibleHistory.map((point) => ({
        point,
        x: dateToPlotX(point.date, calendarStart, calendarRange),
        y: scale.toY(point.average),
      })),
    [calendarRange, calendarStart, scale, visibleHistory],
  );

  const path = useMemo(
    () =>
      plotPoints
        .map(({ x, y }, index) => `${index === 0 ? "M" : "L"} ${x} ${y}`)
        .join(" "),
    [plotPoints],
  );

  const yTicks = useMemo(() => {
    const { canUseLog, minValue, min, max, toY } = scale;
    return canUseLog
      ? [0, 0.33, 0.66, 1].map((ratio, index) => {
          const rawValue = Math.exp(min + (max - min) * ratio);
          const value =
            index === 0 ? minValue : Math.max(1, Math.round(rawValue));
          return {
            ratio,
            value,
            label:
              index === 0
                ? numberFormatter.format(value)
                : axisNumberFormatter.format(value),
            position: Math.max(PLOT.top, Math.min(PLOT.bottom, toY(value))),
          };
        })
      : [0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const value = Math.round(max * ratio);
          return {
            ratio,
            value,
            label: axisNumberFormatter.format(value),
            position: toY(value),
          };
        });
  }, [scale]);

  const horizontalReach = (PLOT.width * hoverEasing) / 100;
  const effectiveHoverBehavior =
    previewHoverBehavior ?? hoverBehavior;

  const triggerPath = useMemo(() => {
    if (!showSettings) return "";
    if (effectiveHoverBehavior === "never") return "";
    if (effectiveHoverBehavior === "always") return fullPlotHoverPath();
    const base = hoverBasePath(plotPoints, hoverDistance);
    const bands =
      horizontalReach > 0
        ? hoverBandPath(plotPoints, horizontalReach, hoverDistance)
        : "";
    return `${base} ${bands}`;
  }, [
    effectiveHoverBehavior,
    horizontalReach,
    hoverDistance,
    plotPoints,
    showSettings,
  ]);

  const selectedPoint = useMemo(() => {
    if (!selected) return null;
    const plot = plotPoints.find((item) => item.point.id === selected.point.id);
    return plot ? { x: plot.x, y: plot.y } : null;
  }, [plotPoints, selected]);

  const getHover = useCallback(
    (clientX: number, clientY: number): PriceHover | null => {
      const box = chartRef.current?.getBoundingClientRect();
      if (!box || !plotPoints.length) return null;
      if (hoverBehavior === "never") return null;
      if (!isInsidePlot(box, clientX, clientY)) return null;
      const plotIndex = findHoveredPlotIndex(
        plotPoints,
        clientToPlotX(box, clientX),
        clientToPlotY(box, clientY),
        horizontalReach,
        hoverDistance,
        hoverBehavior === "always",
      );
      if (plotIndex < 0) return null;
      const plot = plotPoints[plotIndex];
      return { point: plot.point, ...hoverAnchor(box, plot.x, plot.y) };
    },
    [hoverBehavior, horizontalReach, hoverDistance, plotPoints],
  );

  const { hovered, setHovered, pointerHandlers } = useChartPointer<PriceHover>({
    viewport,
    axisWidth,
    getHover,
    onTap: (next) =>
      setSelected((current) =>
        !next
          ? null
          : current?.point.id === next.point.id
            ? null
            : next,
      ),
  });

  useEffect(() => {
    const pointerPosition = viewport.pointerPositionRef.current;
    if (pointerPosition)
      setHovered(getHover(pointerPosition.x, pointerPosition.y));
  }, [getHover, setHovered, viewport.pointerPositionRef]);

  const surfaceHandlers = {
    ...pointerHandlers,
    onPointerMove: (event: PointerEvent<HTMLDivElement>) => {
      if (isChartOverlay(event.target)) {
        viewport.pointerPositionRef.current = null;
        setHovered(null);
        return;
      }
      pointerHandlers.onPointerMove(event);
    },
  };

  const hoveredDateKey = hovered?.point.date;
  const hoveredDate = useMemo(
    () => (hoveredDateKey ? new Date(`${hoveredDateKey}T00:00:00Z`) : null),
    [hoveredDateKey],
  );

  const axisLabels = useMemo(
    () => (
      <ChartAxisLabels
        yTicks={yTicks}
        yearTicks={yearTicks}
        tickLabels={tickLabels}
      />
    ),
    [tickLabels, yTicks, yearTicks],
  );

  return (
    <section>
      {visibleHistory.length > 1 ? (
        <ChartSurface chartRef={chartRef} handlers={surfaceHandlers}>
          <ChartSettingsButton
            label="Toggle chart settings"
            expanded={showSettings}
            onToggle={() => setShowSettings((current) => !current)}
          />
          {showSettings && (
            <ChartSettingsPanel
              labels={priceChartLabels}
              startDate={startDate}
              endDate={endDate}
              minDate={history[0]?.date}
              maxDate={history.at(-1)?.date}
              cardDistance={cardDistance}
              logScale={logScale}
              onStartDateChange={(value) => {
                setStartDate(value);
                setPan(0);
              }}
              onEndDateChange={(value) => {
                setEndDate(value);
                setPan(0);
              }}
              onCardDistanceChange={setCardDistance}
              onLogScaleToggle={() => setLogScale((current) => !current)}
            >
              <HoverBehaviorSelector
                behavior={hoverBehavior}
                verticalDistance={hoverDistance}
                horizontalEase={hoverEasing}
                onBehaviorChange={setHoverBehavior}
                onVerticalDistanceChange={setHoverDistance}
                onHorizontalEaseChange={setHoverEasing}
                onPreviewBehavior={setPreviewHoverBehavior}
              />
            </ChartSettingsPanel>
          )}
          <PriceSeries
            name={security.name}
            path={path}
            triggerPath={triggerPath}
            yTicks={yTicks}
            yearTicks={yearTicks}
            tickLabels={tickLabels}
            selected={selectedPoint}
          />
          {hovered && visibleIds.has(hovered.point.id) && (
            <ChartCrosshair anchor={hovered} showMarker />
          )}
          {hovered && hoveredDate && (
            <ChartHoverLabels
              anchor={hovered}
              date={hoveredDate}
              valueLabel={numberFormatter.format(hovered.point.average)}
              showTimeHoverCard={showTimeHoverCard}
              chartWidth={chartWidth}
              cardDistance={cardDistance}
            />
          )}
          {axisLabels}
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
        </ChartSurface>
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
