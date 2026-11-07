import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Info } from "lucide-react";
import { useChartPointer } from "@/hooks/useChartPointer";
import { useChartViewport } from "@/hooks/useChartViewport";
import {
  PLOT,
  clientToPlotX,
  clientToPlotY,
  hoverAnchor,
} from "@/lib/chart/plot";
import { createTimeAxis, dateToPlotX } from "@/lib/chart/timeAxis";
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
  type ChartSettingsLabels,
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
  const [showSettings, setShowSettings] = useState(false);
  const [selected, setSelected] = useState<PriceHover | null>(null);
  const [chartWidth, setChartWidth] = useState(0);
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const observer = new ResizeObserver(([entry]) =>
      setChartWidth(entry.contentRect.width),
    );
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
  const viewport = useChartViewport({ items: filteredHistory, chartRef });
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
  const { calendarStart, calendarRange, axisWidth, xForDate, yearTicks, tickLabels, showTimeHoverCard } =
    createTimeAxis({
      firstDate: visibleHistory[0]?.date,
      lastDate: visibleHistory.at(-1)?.date,
      chartWidth,
    });

  const x = (index: number) => {
    const point = visibleHistory[index];
    return point ? xForDate(point.date) : 54;
  };
  const y = (value: number) =>
    PLOT.top +
    ((max - (canUseLog ? Math.log10(value) : value)) / range) * PLOT.height;
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
          position: Math.max(PLOT.top, Math.min(PLOT.bottom, y(value))),
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

  const getHover = useCallback(
    (clientX: number, clientY: number): PriceHover | null => {
      const box = chartRef.current?.getBoundingClientRect();
      if (!box) return null;
      const chartX = clientToPlotX(box, clientX);
      const chartY = clientToPlotY(box, clientY);
      const index = Math.round(
        ((chartX - PLOT.left) / PLOT.width) * (visibleHistory.length - 1),
      );
      const point =
        visibleHistory[Math.max(0, Math.min(visibleHistory.length - 1, index))];
      if (!point) return null;
      const pointX = dateToPlotX(point.date, calendarStart, calendarRange);
      const value = canUseLog ? Math.log10(point.average) : point.average;
      const pointY = PLOT.top + ((max - value) / range) * PLOT.height;
      const distance = Math.hypot(
        (chartX - pointX) / 89,
        (chartY - pointY) / PLOT.height,
      );
      return distance <= 0.06
        ? { point, ...hoverAnchor(box, pointX, pointY) }
        : null;
    },
    [calendarRange, calendarStart, canUseLog, max, range, visibleHistory],
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

  const hoveredDate = hovered
    ? new Date(`${hovered.point.date}T00:00:00Z`)
    : null;

  return (
    <section>
      {visibleHistory.length > 1 ? (
        <ChartSurface chartRef={chartRef} handlers={pointerHandlers}>
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
            />
          )}
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            role="img"
            aria-label={`${security.name} price history chart`}
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
          <ChartAxisLabels
            yTicks={yTicks}
            yearTicks={yearTicks}
            tickLabels={tickLabels}
          />
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
