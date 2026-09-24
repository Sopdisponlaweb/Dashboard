import type { Affiliate, AffiliateStatus, AffiliationSource, CreditStatus, MemberDocument, PaymentStatus } from "./types";

const dateFormatter = new Intl.DateTimeFormat("es-CO", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

const currencyFormatter = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

const periodFormatter = new Intl.DateTimeFormat("es-CO", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

export const demoReferenceDate = Date.UTC(2026, 8, 11, 23, 59, 59);

// Internal keys stay as they are in the database; only the visible names change.
// inactive = 3 to 5 months in arrears, suspended = 6 or more (see refresh_membership_statuses).
export const statusLabels: Record<AffiliateStatus, string> = {
  active: "Activo",
  inactive: "Suspendido",
  suspended: "Retirado",
  deceased: "Fallecido",
};

export const statusPluralLabels: Record<AffiliateStatus, string> = {
  active: "Activos",
  inactive: "Suspendidos",
  suspended: "Retirados",
  deceased: "Fallecidos",
};

/** Membership statuses in the order every selector lists them. */
export const affiliateStatuses: AffiliateStatus[] = ["active", "inactive", "suspended", "deceased"];

/** Affiliation types in the order every selector lists them. */
export const affiliationSources: AffiliationSource[] = ["activo", "casur", "tegen", "particular", "inpec", "ordisponal"];

/** Police-related affiliation types: only these carry a police rank. */
export const policeRankSources: AffiliationSource[] = ["activo", "casur", "tegen"];

export function sourceUsesPoliceRank(source: string) {
  return (policeRankSources as string[]).includes(source);
}

export const sourceLabels: Record<AffiliationSource, string> = {
  particular: "PARTICULAR",
  activo: "PERSONAL ACTIVO",
  casur: "CASUR",
  tegen: "TEGEN",
  inpec: "INPEC",
  ordisponal: "ORDISPONAL",
};

export const paymentStatusLabels: Record<PaymentStatus, string> = {
  paid: "Pagado",
  pending: "Pendiente",
  reversed: "Reversado",
};

export const creditStatusLabels: Record<CreditStatus, string> = {
  active: "Activo",
  paid: "Pagado",
  refinanced: "Refinanciado",
  cancelled: "Cancelado",
  paused: "En pausa",
  forgiven: "Condonado",
};

export const documentKindLabels: Record<MemberDocument["kind"], string> = {
  resume: "Hoja de vida",
  identity: "Documento de identidad",
  support: "Soporte",
  other: "Otro",
};

// The legacy migration stored 1970-01-01 when the original record had no date.
const MIGRATION_PLACEHOLDER_DATE = "1970-01-01";

export function formatDate(value: string | null) {
  if (!value || value === MIGRATION_PLACEHOLDER_DATE) return "Sin registrar";
  return dateFormatter.format(new Date(`${value}T00:00:00Z`));
}

export function formatCurrency(value: number) {
  return currencyFormatter.format(value);
}

export function formatReceiptNumber(value: number) {
  return `RC-${String(value).padStart(6, "0")}`;
}

/** Credit interest rate stored as a fraction (0.1) shown as a percentage (10%). */
export function formatRate(rate: number) {
  return `${(rate * 100).toLocaleString("es-CO", { maximumFractionDigits: 2 })}%`;
}

/** Paz y salvo number, e.g. PS-000001. */
export function formatClearanceNumber(value: number) {
  return `PS-${String(value).padStart(6, "0")}`;
}

export function formatCreditReceiptNumber(value: number) {
  return `AB-${String(value).padStart(6, "0")}`;
}

export function formatPeriod(value: string) {
  return periodFormatter.format(new Date(`${value}-01T00:00:00Z`));
}

export function getFullName(affiliate: Pick<Affiliate, "firstNames" | "lastNames">) {
  return `${affiliate.firstNames} ${affiliate.lastNames}`.trim() || "Sin nombre registrado";
}

export function getInitials(person: Pick<Affiliate, "firstNames" | "lastNames">) {
  return `${person.firstNames.trim().charAt(0)}${person.lastNames.trim().charAt(0)}` || "?";
}

/** Today's calendar date in Colombia, as YYYY-MM-DD. */
export function todayInBogota() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date());
}

/** Waiting period (carencia) before full coverage; full_coverage_on = joined_on + 6 months. */
export const WAITING_PERIOD_MONTHS = 6;

export function getCoverageState(affiliate: Pick<Affiliate, "status" | "fullCoverageOn">, today = todayInBogota()) {
  if (affiliate.status !== "active") return "not-applicable" as const;
  return affiliate.fullCoverageOn > today ? "waiting" : "full";
}

/** Adds whole months to a YYYY-MM-DD date the way Postgres does (Aug 31 + 6 months = Feb 28/29). */
export function addMonthsToIsoDate(isoDate: string, months: number) {
  const [year, month, day] = isoDate.split("-").map(Number);
  const index = year * 12 + (month - 1) + months;
  const targetYear = Math.floor(index / 12);
  const targetMonth = (index % 12) + 1;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth, 0)).getUTCDate();
  return `${targetYear}-${String(targetMonth).padStart(2, "0")}-${String(Math.min(day, lastDay)).padStart(2, "0")}`;
}

/** Whole months plus leftover days from `from` to a later `to` (both YYYY-MM-DD). */
function monthsAndDaysBetween(from: string, to: string) {
  const [fy, fm] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  let months = (ty - fy) * 12 + (tm - fm);
  if (addMonthsToIsoDate(from, months) > to) months -= 1;
  const days = Math.round((Date.parse(to) - Date.parse(addMonthsToIsoDate(from, months))) / 86_400_000);
  return { months, days };
}

/** "2 meses y 5 días", "1 mes", "12 días". */
function formatMonthsAndDays({ months, days }: { months: number; days: number }) {
  const parts: string[] = [];
  if (months) parts.push(`${months} ${months === 1 ? "mes" : "meses"}`);
  if (days || !months) parts.push(`${days} ${days === 1 ? "día" : "días"}`);
  return parts.join(" y ");
}

/** Month of the waiting period the person is in (1 to 6) and the exact time still to go. */
export function getWaitingPeriodProgress(fullCoverageOn: string, today = todayInBogota()) {
  const left = monthsAndDaysBetween(today, fullCoverageOn);
  // With exact months left the person is starting a new month; otherwise they are inside one.
  const month = WAITING_PERIOD_MONTHS - left.months + (left.days ? 0 : 1);
  return {
    month: Math.min(WAITING_PERIOD_MONTHS, Math.max(1, month)),
    timeLeft: formatMonthsAndDays(left),
    // More than 6 months to go means the affiliation date itself is in the future (bad migrated data).
    invalidDate: fullCoverageOn > addMonthsToIsoDate(today, WAITING_PERIOD_MONTHS),
  };
}

/** Form hint: when a person joining on `joinedOn` reaches full coverage. */
export function describeWaitingPeriod(joinedOn: string, today = todayInBogota()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(joinedOn)) return `La cobertura completa empieza ${WAITING_PERIOD_MONTHS} meses después de esta fecha.`;
  const fullCoverageOn = addMonthsToIsoDate(joinedOn, WAITING_PERIOD_MONTHS);
  if (fullCoverageOn <= today) return `Carencia cumplida: cobertura completa desde el ${formatDate(fullCoverageOn)}.`;
  if (joinedOn > today) return `Cobertura completa desde el ${formatDate(fullCoverageOn)}.`;
  const { timeLeft } = getWaitingPeriodProgress(fullCoverageOn, today);
  return `Carencia de ${WAITING_PERIOD_MONTHS} meses: cobertura completa desde el ${formatDate(fullCoverageOn)} (faltan ${timeLeft}).`;
}
