import type { DailyPrice } from "@/models/Security";

export function filterByDateBounds<T>(
  items: T[],
  getDate: (item: T) => string,
  startDate: string,
  endDate: string,
): T[] {
  return items.filter((item) => {
    const date = getDate(item).slice(0, 10);
    return (!startDate || date >= startDate) && (!endDate || date <= endDate);
  });
}

export function getPriceChartHistory(
  history: DailyPrice[],
  startDate: string,
  endDate: string,
): DailyPrice[] {
  return filterByDateBounds(history, (point) => point.date, startDate, endDate)
    .sort((a, b) => a.date.localeCompare(b.date));
}
