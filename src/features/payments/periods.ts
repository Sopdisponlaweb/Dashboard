export const maxMonthsPerReceipt = 36;

/** Month counts offered in the payment form. */
export const monthCountOptions = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 18, 24, 36] as const;

/** Returns the YYYY-MM periods covered by a receipt that starts at `periodFrom`, in order. */
export function coveredPeriods(periodFrom: string, months: number) {
  const [year, month] = periodFrom.split("-").map(Number);
  return Array.from({ length: months }, (_, offset) => {
    const date = new Date(Date.UTC(year, month - 1 + offset, 1));
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
  });
}
