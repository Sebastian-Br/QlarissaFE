import { SecurityType, type PubliclyTradedSecurityBase } from "@/models/Security";

export const securityTypeNames: Record<SecurityType, string> = {
  [SecurityType.Stock]: "Stock",
  [SecurityType.ETF]: "ETF",
  [SecurityType.Cryptocurrency]: "Cryptocurrency",
  [SecurityType.CurrencyPair]: "Currency pair",
};

export const dateFormatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  year: "numeric",
});
export const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "medium",
  timeZone: "UTC",
});
export const monthFormatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  timeZone: "UTC",
});
export const numberFormatter = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 2,
});
export const axisNumberFormatter = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 0,
});
export const dividendAxisNumberFormatter = new Intl.NumberFormat(undefined, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
export const compactFormatter = new Intl.NumberFormat(undefined, {
  notation: "compact",
  maximumFractionDigits: 2,
});

export function formatDate(value: string) {
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : dateFormatter.format(date);
}

export function formatPrice(value: number, security: PubliclyTradedSecurityBase) {
  const currency = security.currency?.symbol ?? "";
  return `${currency ? `${currency} ` : ""}${numberFormatter.format(value)}`;
}

export function formatDateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : `${dateTimeFormatter.format(date)} UTC`;
}

export function formatWhenPresent<T>(
  value: T | null | undefined,
  format: (value: T) => string,
) {
  return value ? format(value) : "—";
}
