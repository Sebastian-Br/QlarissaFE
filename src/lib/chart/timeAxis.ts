import { monthFormatter } from "@/lib/formatting";
import { PLOT } from "./plot";

const DAY_MS = 86_400_000;
const MIN_MONTH_SPACING_PX = 38;
const YEAR_LABEL_WIDTH_PX = 30;
const LABEL_GAP_PX = 4;

export interface MonthTick {
  date: string;
  month: number;
  position: number;
}

export interface AxisTick extends MonthTick {
  label: string;
  width: number;
}

export function dateToPlotX(
  date: string,
  calendarStart: number,
  calendarRange: number,
) {
  return (
    PLOT.left +
    ((Date.parse(`${date.slice(0, 10)}T00:00:00Z`) - calendarStart) /
      calendarRange) *
      PLOT.width
  );
}

export function createTimeAxis({
  firstDate,
  lastDate,
  chartWidth,
}: {
  firstDate: string | undefined;
  lastDate: string | undefined;
  chartWidth: number;
}) {
  const calendarStart =
    Date.parse(`${firstDate}T00:00:00Z`) || Date.now();
  const calendarEnd =
    Date.parse(`${lastDate}T00:00:00Z`) || calendarStart + DAY_MS;
  const calendarRange = Math.max(1, calendarEnd - calendarStart);
  const xForDate = (date: string) =>
    dateToPlotX(date, calendarStart, calendarRange);

  const firstYear = new Date(calendarStart).getUTCFullYear();
  const lastYear = new Date(calendarEnd).getUTCFullYear();
  const yearTicks = Array.from(
    { length: Math.max(1, lastYear - firstYear + 1) },
    (_, index) => {
      const year = firstYear + index;
      const date = `${year}-01-01`;
      return { year, date, position: xForDate(date) };
    },
  ).filter((tick) => tick.position >= PLOT.left && tick.position <= PLOT.right);

  const monthTicks: MonthTick[] = [];
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
    if (month > 0 && position >= PLOT.left && position <= PLOT.right)
      monthTicks.push({ date, month, position });
    monthCursor.setUTCMonth(month + 1);
  }

  const axisWidth = chartWidth * (PLOT.width / 100);
  const pixelOf = (position: number) =>
    ((position - PLOT.left) / PLOT.width) * axisWidth;
  const minMonthSpacing = monthTicks.slice(1).reduce(
    (spacing, tick, index) =>
      Math.min(
        spacing,
        (Math.abs(tick.position - monthTicks[index].position) / PLOT.width) *
          axisWidth,
      ),
    Number.POSITIVE_INFINITY,
  );
  const tickCandidates: AxisTick[] =
    minMonthSpacing >= MIN_MONTH_SPACING_PX
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

  const tickLabels: AxisTick[] = [];
  const labelIntervals = yearTicks.map((tick) => ({
    center: pixelOf(tick.position),
    width: YEAR_LABEL_WIDTH_PX,
  }));
  for (const tick of tickCandidates) {
    const center = pixelOf(tick.position);
    if (
      center < tick.width / 2 ||
      center > axisWidth - tick.width / 2 ||
      labelIntervals.some(
        (label) =>
          Math.abs(center - label.center) <
          (tick.width + label.width) / 2 + LABEL_GAP_PX,
      )
    )
      continue;
    tickLabels.push(tick);
    labelIntervals.push({ center, width: tick.width });
  }

  const allQuarterLabelsVisible = ["Q2", "Q3", "Q4"].every((label) =>
    tickLabels.some((tick) => tick.label === label),
  );
  const showTimeHoverCard =
    minMonthSpacing >= MIN_MONTH_SPACING_PX || allQuarterLabelsVisible;

  return {
    calendarStart,
    calendarRange,
    axisWidth,
    xForDate,
    yearTicks,
    tickLabels,
    showTimeHoverCard,
  };
}
