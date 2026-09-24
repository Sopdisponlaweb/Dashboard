// Continuity of an affiliate's payments, computed from the payments already loaded for the ficha.
// Same rule as the payment_gaps view: months with no paid payment between two paid months.

/** YYYY-MM of the month after `period` (YYYY-MM). */
export function nextPeriod(period: string) {
  const [year, month] = period.split("-").map(Number);
  return month === 12 ? `${year + 1}-01` : `${year}-${String(month + 1).padStart(2, "0")}`;
}

export type PaymentGap = {
  /** Last paid month before the gap. */
  after: string;
  /** Next paid month after the gap. */
  before: string;
  /** Missing months, oldest first (YYYY-MM). */
  missing: string[];
};

export function computePaymentGaps(payments: { period: string; status: string }[]): PaymentGap[] {
  const paid = [...new Set(payments.filter((payment) => payment.status === "paid").map((payment) => payment.period))].sort();
  const gaps: PaymentGap[] = [];
  for (let index = 1; index < paid.length; index += 1) {
    const missing: string[] = [];
    for (let period = nextPeriod(paid[index - 1]); period < paid[index]; period = nextPeriod(period)) missing.push(period);
    if (missing.length) gaps.push({ after: paid[index - 1], before: paid[index], missing });
  }
  return gaps;
}

/** Missing months between `since` and `until` (YYYY-MM, inclusive), newest first. */
export function recentMissingMonths(gaps: PaymentGap[], since: string, until: string) {
  return gaps.flatMap((gap) => gap.missing).filter((period) => period >= since && period <= until).sort().reverse();
}

/** First month of the recent window used by alerts: the same month one year ago. */
export function gapWindowStart(today: string) {
  const [year, month] = today.split("-").map(Number);
  return `${year - 1}-${String(month).padStart(2, "0")}`;
}
