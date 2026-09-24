// Client-safe helpers and types for the dashboard (no server imports: the chart runs in the browser).

export type MonthlyCollection = { period: string; amount: number; payments: number; payers: number };

/** "$ 44,9 M", "$ 720 mil", "$ 25.000": short money for axes and tiles. */
export function formatCompactCurrency(value: number) {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `$ ${(value / 1_000_000).toLocaleString("es-CO", { maximumFractionDigits: abs >= 10_000_000 ? 1 : 2 })} M`;
  if (abs >= 100_000) return `$ ${Math.round(value / 1000).toLocaleString("es-CO")} mil`;
  return `$ ${Math.round(value).toLocaleString("es-CO")}`;
}

/** Percent change from `previous` to `current`, one decimal; null when there is no base. */
export function percentChange(current: number, previous: number) {
  if (!previous) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}
