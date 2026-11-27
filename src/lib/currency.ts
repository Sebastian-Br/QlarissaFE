export function formatWatchlistPrice(value: number, currencySymbol?: string): string {
  const currency = currencySymbol?.trim();
  if (currency && /^[A-Za-z]{3}$/.test(currency)) {
    const code = currency.toUpperCase();
    const formatter = new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: code,
    });
    return formatter.formatToParts(value)
      .map((part) => code === "USD" && part.type === "currency" ? "$" : part.value)
      .join("");
  }
  const amount = new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
  return currency ? `${currency} ${amount}` : amount;
}
