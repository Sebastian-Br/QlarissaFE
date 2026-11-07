import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { useChartPointer } from "@/hooks/useChartPointer";
import { useChartViewport } from "@/hooks/useChartViewport";
import {
  PLOT,
  clientToPlotX,
  hoverAnchor,
} from "@/lib/chart/plot";
import { createTimeAxis } from "@/lib/chart/timeAxis";
import {
  dividendAxisNumberFormatter,
  formatDate,
  numberFormatter,
} from "@/lib/formatting";
import type {
  DividendPayout,
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

const dividendChartLabels: ChartSettingsLabels = {
  startDate: "Dividend chart start date",
  endDate: "Dividend chart end date",
  cardDistance: "Dividend price card distance",
  logScale: "Toggle dividend chart logarithmic scale",
};

interface DividendHover extends HoverAnchor {
  payout: DividendPayout;
}

export function DividendPayoutChart({
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
  }, [isExpanded]);

  const filteredPayouts = useMemo(
    () =>
      history.filter((payout) => {
        const date = payout.payoutDate.slice(0, 10);
        return date >= startDate && date <= endDate;
      }),
    [endDate, history, startDate],
  );
  const viewport = useChartViewport({ items: filteredPayouts, chartRef });
  const { visibleItems: visiblePayouts, setPan } = viewport;

  const amounts = visiblePayouts.map((payout) => payout.payoutAmount);
  const positiveAmounts = amounts.filter((amount) => amount > 0);
  const useLogScale = logScale && positiveAmounts.length > 0;
  const minValue = amounts.length ? Math.min(...amounts) : 0;
  const maxValue = amounts.length ? Math.max(...amounts) : 0;
  const min = useLogScale ? Math.log10(Math.min(...positiveAmounts)) : 0;
  const max = useLogScale ? Math.log10(Math.max(...positiveAmounts)) : maxValue;
  const range = max - min || 1;
  const { calendarStart, calendarRange, axisWidth, xForDate, yearTicks, tickLabels, showTimeHoverCard } =
    createTimeAxis({
      firstDate: visiblePayouts[0]?.payoutDate.slice(0, 10),
      lastDate: visiblePayouts.at(-1)?.payoutDate.slice(0, 10),
      chartWidth,
    });

  const yForAmount = (amount: number) => {
    const value = useLogScale
      ? amount > 0
        ? Math.log10(amount)
        : min
      : amount;
    return PLOT.top + ((max - value) / range) * PLOT.height;
  };
  const yTicks = useLogScale
    ? [0, 0.33, 0.66, 1].map((ratio, index) => {
        const rawValue = 10 ** (min + (max - min) * ratio);
        const value = index === 0 ? minValue : Math.max(0, rawValue);
        return {
          ratio,
          label: dividendAxisNumberFormatter.format(value),
          position: Math.max(PLOT.top, Math.min(PLOT.bottom, yForAmount(value))),
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

  const getHover = (clientX: number): DividendHover | null => {
    const box = chartRef.current?.getBoundingClientRect();
    if (!box || !visiblePayouts.length) return null;
    const chartX = clientToPlotX(box, clientX);
    const hoveredTimestamp =
      calendarStart + ((chartX - PLOT.left) / PLOT.width) * calendarRange;
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
    return { payout, ...hoverAnchor(box, position, amountY) };
  };

  const { hovered, pointerHandlers } = useChartPointer<DividendHover>({
    viewport,
    axisWidth,
    getHover,
  });

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
        <ChartSurface chartRef={chartRef} handlers={pointerHandlers}>
          <ChartSettingsButton
            label="Toggle dividend chart settings"
            expanded={showSettings}
            onToggle={() => setShowSettings((current) => !current)}
          />
          {showSettings && (
            <ChartSettingsPanel
              labels={dividendChartLabels}
              startDate={startDate}
              endDate={endDate}
              minDate={history[0]?.payoutDate.slice(0, 10)}
              maxDate={history.at(-1)?.payoutDate.slice(0, 10)}
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
          {visiblePayouts.length > 0 ? (
            <>
              <svg
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                role="img"
                aria-label={`${security.name} dividend payouts chart`}
                className="pointer-events-none h-full w-full overflow-visible"
              >
                <ChartGridLines yTicks={yTicks} />
                {visiblePayouts.map((payout) => {
                  const isHovered = hovered?.payout.id === payout.id;
                  const position = xForDate(payout.payoutDate);
                  const width = Math.min(
                    1.25,
                    (60 / calendarRange) * PLOT.width * 86_400_000,
                  );
                  const amountY = yForAmount(payout.payoutAmount);
                  return (
                    <rect
                      key={payout.id}
                      x={position - width / 2}
                      y={amountY}
                      width={width}
                      height={PLOT.bottom - amountY}
                      rx="0.35"
                      fill={isHovered ? "#6ee7b7" : "#34d399"}
                      style={
                        isHovered
                          ? { filter: "drop-shadow(0 0 6px rgba(52, 211, 153, 0.9))" }
                          : undefined
                      }
                    >
                      <title>
                        {formatDate(payout.payoutDate)} · {numberFormatter.format(payout.payoutAmount)}
                      </title>
                    </rect>
                  );
                })}
                <ChartTimeTicks yearTicks={yearTicks} tickLabels={tickLabels} />
              </svg>
              {hovered &&
                visiblePayouts.some((payout) => payout.id === hovered.payout.id) && (
                  <ChartCrosshair anchor={hovered} />
                )}
              {hovered && hoveredDate && (
                <ChartHoverLabels
                  anchor={hovered}
                  date={hoveredDate}
                  valueLabel={numberFormatter.format(hovered.payout.payoutAmount)}
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
            </>
          ) : (
            <div className="grid h-full place-items-center text-sm text-slate-400">
              No dividend payouts in this date range.
            </div>
          )}
        </ChartSurface>
      )}
    </section>
  );
}
