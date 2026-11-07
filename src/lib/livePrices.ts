import type { DailyPrice } from "@/models/Security";

export interface LivePrice {
  symbol: string;
  timestamp: string;
  price: number;
  dayHigh?: number;
  dayLow?: number;
}

export function dateOnlyFromTimestamp(timestamp: string) {
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

function finiteOr(value: number | undefined, fallback: number) {
  return value !== undefined && Number.isFinite(value) ? value : fallback;
}

export function mergeLivePriceIntoHistory(
  history: DailyPrice[],
  update: LivePrice,
  date: string,
): DailyPrice[] {
  const pointIndex = history.findIndex((point) => point.date === date);
  if (pointIndex >= 0) {
    return history.map((point, index) =>
      index === pointIndex
        ? {
            ...point,
            average: update.price,
            close: update.price,
            high: finiteOr(update.dayHigh, point.high),
            low: finiteOr(update.dayLow, point.low),
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
      high: finiteOr(update.dayHigh, update.price),
      low: finiteOr(update.dayLow, update.price),
    },
  ];
}
