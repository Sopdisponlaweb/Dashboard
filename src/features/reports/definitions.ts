// Server-only: every report's filters, columns and data, shared by the Reportes page
// (count + preview) and the CSV export, so what you preview is exactly what you download.
import type { IconName } from "@/components/icons";
import {
  affiliateStatuses,
  affiliationSources,
  creditStatusLabels,
  formatCurrency,
  formatDate,
  formatPeriod,
  formatClearanceNumber,
  formatCreditReceiptNumber,
  formatRate,
  formatReceiptNumber,
  paymentStatusLabels,
  sourceLabels,
  statusLabels,
  statusPluralLabels,
  todayInBogota,
} from "@/features/affiliates/format";
import {
  countAffiliates,
  countBeneficiaries,
  countCredits,
  countPayments,
  listAffiliates,
  listBeneficiaries,
  listCredits,
  listPayments,
} from "@/features/affiliates/repository";
import type { AffiliateStatus, AffiliationSource, CreditStatus, PaymentStatus } from "@/features/affiliates/types";
import { listPaymentMethods } from "@/features/catalogs/repository";
import { remainingBalance } from "@/features/credits/calculations";
import { listCreditInstallments } from "@/features/credits/installments-repository";

export const reportKeys = ["afiliados", "beneficiarios", "pagos", "creditos", "abonos"] as const;
export type ReportKey = (typeof reportKeys)[number];

export type FilterOption = { value: string; label: string };
export type ReportField = { name: string; label: string; kind: "search" | "select"; placeholder?: string; options?: FilterOption[] };

/** A cell: CSV gets the raw value (numbers without format, ISO dates), the preview the formatted one. */
type CellKind = "text" | "money" | "date" | "period" | "number" | "rate";
export type ReportColumn<T> = { header: string; kind?: CellKind; value: (row: T) => string | number | null | undefined };

export type ReportValues = Record<string, string>;

type ReportDefinition<T> = {
  key: ReportKey;
  title: string;
  description: string;
  icon: IconName;
  /** Label of the date the year/month filters apply to. */
  dateLabel: string;
  fields: () => Promise<ReportField[]>;
  columns: ReportColumn<T>[];
  count: (values: ReportValues) => Promise<number>;
  rows: (values: ReportValues, limit?: number) => Promise<T[]>;
};

const PREVIEW_ROWS = 10;
const EXPORT_PAGE_SIZE = 20000;

const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const monthOptions: FilterOption[] = monthNames.map((label, index) => ({ value: String(index + 1).padStart(2, "0"), label }));

function yearOptions(fromYear: number): FilterOption[] {
  const current = Number(todayInBogota().slice(0, 4));
  return Array.from({ length: current - fromYear + 1 }, (_, index) => String(current - index)).map((year) => ({ value: year, label: year }));
}

/** [from, to) for the chosen year, or year + month. The month alone is ignored: it needs a year. */
export function yearMonthRange(values: ReportValues) {
  const year = /^\d{4}$/.test(values.anio ?? "") ? Number(values.anio) : null;
  const month = /^(0[1-9]|1[0-2])$/.test(values.mes ?? "") ? Number(values.mes) : null;
  if (!year) return { from: undefined, to: undefined };
  if (!month) return { from: `${year}-01-01`, to: `${year + 1}-01-01` };
  const next = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, "0")}-01`;
  return { from: `${year}-${String(month).padStart(2, "0")}-01`, to: next };
}

const all = (label = "Todos"): FilterOption => ({ value: "all", label });
const pick = <T extends string>(value: string | undefined, allowed: readonly T[]): T | "all" => (allowed as readonly string[]).includes(value ?? "") ? (value as T) : "all";

const searchField = (placeholder: string): ReportField => ({ name: "q", label: "Cédula o nombre", kind: "search", placeholder });
const dateFields = (fromYear: number): ReportField[] => [
  { name: "anio", label: "Año", kind: "select", options: [all(), ...yearOptions(fromYear)] },
  { name: "mes", label: "Mes", kind: "select", options: [all(), ...monthOptions] },
];
const affiliateStatusField: ReportField = {
  name: "estado", label: "Estado", kind: "select",
  options: [all(), ...affiliateStatuses.map((status) => ({ value: status, label: statusPluralLabels[status] }))],
};
const coverageField: ReportField = {
  name: "carencia", label: "Carencia", kind: "select",
  options: [all(), { value: "waiting", label: "En carencia" }, { value: "full", label: "Cobertura completa" }],
};
const creditStatuses: CreditStatus[] = ["active", "paused", "paid", "refinanced", "forgiven", "cancelled"];
const creditStatusField = (label = "Estado del crédito"): ReportField => ({
  name: "estado", label, kind: "select",
  options: [all(), ...creditStatuses.map((status) => ({ value: status, label: creditStatusLabels[status] }))],
});
async function paymentMethodField(): Promise<ReportField> {
  const methods = await listPaymentMethods();
  return { name: "metodo", label: "Método de pago", kind: "select", options: [all(), ...methods.map((method) => ({ value: method.id, label: method.name }))] };
}
// Relationships as they appear in the data (mixed case there; the filter ignores case).
const relationships = [
  "ABUELA", "ABUELO", "AHIJADA", "AHIJADO", "AMIGA", "AMIGO", "BISABUELA", "BISNIETA", "BISNIETO", "COMPAÑERA", "COMPAÑERO",
  "CONCUÑADA", "CONCUÑADO", "CONSUEGRA", "CONSUEGRO", "CÓNYUGE", "CUÑADA", "CUÑADO", "ESPOSA", "ESPOSO", "EX-COMPAÑERA",
  "EX-COMPAÑERO", "EX-ESPOSA", "EX-ESPOSO", "HERMANA", "HERMANO", "HIJA", "HIJASTRA", "HIJASTRO", "HIJO", "MADRASTRA", "MADRE",
  "MADRINA", "NIETA", "NIETO", "NOVIA", "NOVIO", "NUERA", "OTRO", "PADRASTRO", "PADRE", "PADRINO", "PRIMA", "PRIMO", "SOBRINA",
  "SOBRINO", "SUEGRA", "SUEGRO", "TIA", "TIO", "YERNO", "DESCONOCIDO",
];

/** Fetches every row of a paged listing, EXPORT_PAGE_SIZE at a time, or just the first `limit`. */
async function collect<T>(fetchPage: (page: number, pageSize: number) => Promise<T[]>, limit?: number) {
  if (limit) return fetchPage(1, limit);
  const rows: T[] = [];
  for (let page = 1; ; page += 1) {
    const chunk = await fetchPage(page, EXPORT_PAGE_SIZE);
    rows.push(...chunk);
    if (chunk.length < EXPORT_PAGE_SIZE) return rows;
  }
}

// ---------- Afiliados ----------
type AffiliateRow = Awaited<ReturnType<typeof listAffiliates>>[number];
function affiliateFilters(values: ReportValues) {
  const range = yearMonthRange(values);
  return {
    query: values.q ?? "",
    status: pick<AffiliateStatus>(values.estado, affiliateStatuses),
    source: pick<AffiliationSource>(values.tipo, affiliationSources),
    coverage: pick(values.carencia, ["waiting", "full"] as const),
    succession: pick(values.sucesion, ["pending", "succeeded", "successor"] as const),
    joinedFrom: range.from,
    joinedTo: range.to,
  };
}
const affiliatesReport: ReportDefinition<AffiliateRow> = {
  key: "afiliados",
  title: "Afiliados",
  description: "Directorio de titulares con estado, cobertura, municipio y último pago.",
  icon: "users",
  dateLabel: "fecha de afiliación",
  fields: async () => [
    searchField("Cédula, nombres o apellidos"),
    affiliateStatusField,
    { name: "tipo", label: "Tipo de afiliación", kind: "select", options: [all(), ...affiliationSources.map((source) => ({ value: source, label: sourceLabels[source] }))] },
    ...dateFields(1985),
    coverageField,
    { name: "sucesion", label: "Sucesión", kind: "select", options: [all("Todas"), { value: "pending", label: "Sucesión pendiente" }, { value: "succeeded", label: "Sucedidos" }, { value: "successor", label: "Titulares por sucesión" }] },
  ],
  columns: [
    { header: "Documento", value: (a) => `${a.documentType} ${a.documentNumber}` },
    { header: "Nombres", value: (a) => a.firstNames },
    { header: "Apellidos", value: (a) => a.lastNames },
    { header: "Tipo de afiliación", value: (a) => sourceLabels[a.source] },
    { header: "Estado", value: (a) => statusLabels[a.status] },
    { header: "Municipio", value: (a) => a.municipality },
    { header: "Fecha de afiliación", kind: "date", value: (a) => a.joinedOn },
    { header: "Cobertura total", kind: "date", value: (a) => a.fullCoverageOn },
    { header: "Último pago", kind: "date", value: (a) => a.lastPaymentOn },
    { header: "Beneficiarios vigentes", kind: "number", value: (a) => a.beneficiaries.filter((b) => b.status !== "deceased").length },
  ],
  count: (values) => countAffiliates(affiliateFilters(values)),
  rows: (values, limit) => collect((page, pageSize) => listAffiliates({ ...affiliateFilters(values), page, pageSize }), limit),
};

// ---------- Beneficiarios ----------
type BeneficiaryRow = Awaited<ReturnType<typeof listBeneficiaries>>[number];
function beneficiaryFilters(values: ReportValues) {
  const range = yearMonthRange(values);
  return {
    query: values.q ?? "",
    status: pick<AffiliateStatus>(values.estado, affiliateStatuses),
    coverage: pick(values.carencia, ["waiting", "full"] as const),
    relationship: relationships.includes(values.parentesco ?? "") ? values.parentesco : undefined,
    joinedFrom: range.from,
    joinedTo: range.to,
  };
}
const beneficiariesReport: ReportDefinition<BeneficiaryRow> = {
  key: "beneficiarios",
  title: "Beneficiarios",
  description: "Personas vinculadas a cada titular, con parentesco, estado y cobertura.",
  icon: "heart",
  dateLabel: "fecha de vinculación",
  fields: async () => [
    searchField("Cédula o nombre del beneficiario"),
    affiliateStatusField,
    { name: "parentesco", label: "Parentesco", kind: "select", options: [all(), ...relationships.map((value) => ({ value, label: value.charAt(0) + value.slice(1).toLowerCase() }))] },
    ...dateFields(1985),
    coverageField,
  ],
  columns: [
    { header: "Beneficiario", value: (b) => `${b.firstNames} ${b.lastNames}` },
    { header: "Documento", value: (b) => b.documentNumber ?? "" },
    { header: "Parentesco", value: (b) => b.relationship },
    { header: "Titular", value: (b) => b.affiliateName },
    { header: "Documento del titular", value: (b) => b.affiliateDocument },
    { header: "Estado", value: (b) => statusLabels[b.status] },
    { header: "Fecha de vinculación", kind: "date", value: (b) => b.joinedOn },
    { header: "Cobertura total", kind: "date", value: (b) => b.fullCoverageOn },
  ],
  count: (values) => countBeneficiaries(beneficiaryFilters(values)),
  rows: (values, limit) => collect((page, pageSize) => listBeneficiaries({ ...beneficiaryFilters(values), page, pageSize }), limit),
};

// ---------- Pagos ----------
type PaymentRow = Awaited<ReturnType<typeof listPayments>>[number];
const paymentStatuses: PaymentStatus[] = ["paid", "pending", "reversed"];
function paymentFilters(values: ReportValues) {
  const range = yearMonthRange(values);
  return {
    query: values.q ?? "",
    status: pick<PaymentStatus>(values.estado, paymentStatuses),
    source: pick<AffiliationSource>(values.tipo, affiliationSources),
    paymentMethodId: values.metodo && values.metodo !== "all" ? values.metodo : "all",
    periodFrom: range.from,
    periodTo: range.to,
  };
}
const paymentsReport: ReportDefinition<PaymentRow> = {
  key: "pagos",
  title: "Pagos",
  description: "Pagos individuales de cada titular con periodo, fuente, método, valor y recibo.",
  icon: "wallet",
  dateLabel: "periodo pagado",
  fields: async () => [
    searchField("Cédula o nombre del titular"),
    ...dateFields(2002),
    { name: "estado", label: "Estado", kind: "select", options: [all(), ...paymentStatuses.map((status) => ({ value: status, label: paymentStatusLabels[status] }))] },
    { name: "tipo", label: "Fuente", kind: "select", options: [all("Todas"), ...affiliationSources.map((source) => ({ value: source, label: sourceLabels[source] }))] },
    await paymentMethodField(),
  ],
  columns: [
    { header: "Titular", value: (p) => p.affiliateName },
    { header: "Documento", value: (p) => p.affiliateDocument },
    { header: "Periodo", kind: "period", value: (p) => p.period },
    { header: "Fuente", value: (p) => sourceLabels[p.source] },
    { header: "Valor", kind: "money", value: (p) => p.amount },
    { header: "Método", value: (p) => p.paymentMethod ?? "" },
    { header: "Estado", value: (p) => paymentStatusLabels[p.status] },
    { header: "Fecha de pago", kind: "date", value: (p) => p.paidOn },
    { header: "Recibo", value: (p) => (p.receiptNumber ? formatReceiptNumber(p.receiptNumber) : "") },
    { header: "Observación", value: (p) => p.observation ?? "" },
  ],
  count: (values) => countPayments(paymentFilters(values)),
  rows: (values, limit) => collect((page, pageSize) => listPayments({ ...paymentFilters(values), page, pageSize }), limit),
};

// ---------- Créditos ----------
type CreditRow = Awaited<ReturnType<typeof listCredits>>[number];
function creditFilters(values: ReportValues) {
  const range = yearMonthRange(values);
  return {
    query: values.q ?? "",
    status: pick<CreditStatus>(values.estado, creditStatuses),
    clearance: pick(values.pazysalvo, ["issued", "none"] as const),
    requestedFrom: range.from,
    requestedTo: range.to,
  };
}
const creditsReport: ReportDefinition<CreditRow> = {
  key: "creditos",
  title: "Créditos",
  description: "Cartera de créditos con condiciones, abonado, saldo pendiente y paz y salvo.",
  icon: "creditCard",
  dateLabel: "fecha de solicitud",
  fields: async () => [
    searchField("Cédula o nombre del titular"),
    creditStatusField(),
    ...dateFields(2020),
    { name: "pazysalvo", label: "Paz y salvo", kind: "select", options: [all(), { value: "issued", label: "Emitido" }, { value: "none", label: "Sin emitir" }] },
  ],
  columns: [
    { header: "Titular", value: (c) => c.affiliateName },
    { header: "Documento", value: (c) => c.affiliateDocument },
    { header: "Fecha de solicitud", kind: "date", value: (c) => c.requestedOn },
    { header: "Estado", value: (c) => creditStatusLabels[c.status] },
    { header: "Desembolso", kind: "money", value: (c) => c.disbursedAmount },
    { header: "Saldo anterior refinanciado", kind: "money", value: (c) => c.rolledOverCapital + c.rolledOverInterest },
    { header: "Base", kind: "money", value: (c) => c.principalBase },
    { header: "Tasa", kind: "rate", value: (c) => c.interestRate },
    { header: "Plazo (meses)", kind: "number", value: (c) => c.termMonths },
    { header: "Interés", kind: "money", value: (c) => c.interestAmount },
    { header: "Total a pagar", kind: "money", value: (c) => c.totalAmount },
    { header: "Cuota", kind: "money", value: (c) => c.installmentAmount },
    { header: "Abonos", kind: "number", value: (c) => c.installments.length },
    { header: "Abonado", kind: "money", value: (c) => c.installments.reduce((total, installment) => total + installment.amount, 0) },
    { header: "Saldo pendiente", kind: "money", value: (c) => (c.status === "active" || c.status === "paused" ? remainingBalance(c, c.installments).remainingTotal : 0) },
    { header: "Último abono", kind: "date", value: (c) => c.installments.map((installment) => installment.paidOn).sort().at(-1) ?? null },
    { header: "Paz y salvo", value: (c) => (c.clearance ? formatClearanceNumber(c.clearance.number) : "") },
    { header: "Heredado de", value: (c) => c.inheritedFromName ?? "" },
  ],
  count: (values) => countCredits(creditFilters(values)),
  rows: (values, limit) => collect((page, pageSize) => listCredits({ ...creditFilters(values), page, pageSize }), limit),
};

// ---------- Abonos de créditos ----------
type InstallmentRow = Awaited<ReturnType<typeof listCreditInstallments>>["records"][number];
function installmentFilters(values: ReportValues) {
  const range = yearMonthRange(values);
  return {
    query: values.q ?? "",
    creditStatus: pick<CreditStatus>(values.estado, creditStatuses),
    paymentMethodId: values.metodo && values.metodo !== "all" ? values.metodo : "all",
    paidFrom: range.from,
    paidTo: range.to,
  };
}
const installmentsReport: ReportDefinition<InstallmentRow> = {
  key: "abonos",
  title: "Abonos de créditos",
  description: "Cada abono registrado a un crédito, con capital, interés, método y recibo.",
  icon: "wallet",
  dateLabel: "fecha del abono",
  fields: async () => [
    searchField("Cédula o nombre del titular"),
    ...dateFields(2020),
    await paymentMethodField(),
    creditStatusField(),
  ],
  columns: [
    { header: "Recibo", value: (i) => (i.receiptNumber ? formatCreditReceiptNumber(i.receiptNumber) : "") },
    { header: "Fecha del abono", kind: "date", value: (i) => i.paidOn },
    { header: "Titular", value: (i) => i.affiliateName },
    { header: "Documento", value: (i) => i.affiliateDocument },
    { header: "Valor", kind: "money", value: (i) => i.amount },
    { header: "Capital", kind: "money", value: (i) => i.capitalPortion },
    { header: "Interés", kind: "money", value: (i) => i.interestPortion },
    { header: "Método", value: (i) => i.paymentMethod ?? "" },
    { header: "Crédito solicitado el", kind: "date", value: (i) => i.creditRequestedOn },
    { header: "Estado del crédito", value: (i) => creditStatusLabels[i.creditStatus] },
    { header: "Observación", value: (i) => i.observation ?? "" },
  ],
  count: async (values) => (await listCreditInstallments({ ...installmentFilters(values), page: 1, pageSize: 1 })).totalCount,
  rows: (values, limit) => collect(async (page, pageSize) => (await listCreditInstallments({ ...installmentFilters(values), page, pageSize })).records, limit),
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const reports: Record<ReportKey, ReportDefinition<any>> = {
  afiliados: affiliatesReport,
  beneficiarios: beneficiariesReport,
  pagos: paymentsReport,
  creditos: creditsReport,
  abonos: installmentsReport,
};

export function isReportKey(value: string | undefined): value is ReportKey {
  return (reportKeys as readonly string[]).includes(value ?? "");
}

/** Only the filter values this report knows, taken from the URL. */
export async function readReportValues(key: ReportKey, params: Record<string, string | string[] | undefined>) {
  const fields = await reports[key].fields();
  const values: ReportValues = {};
  for (const field of fields) {
    const raw = params[field.name];
    const value = (Array.isArray(raw) ? raw[0] : raw)?.trim();
    if (value && value !== "all") values[field.name] = value;
  }
  return { fields, values };
}

// ISO dates stay ISO in the CSV so spreadsheets sort and filter them; money goes without symbols.
export function csvCell(kind: CellKind | undefined, value: string | number | null | undefined) {
  if (value === null || value === undefined) return "";
  if (kind === "money") return Math.round(Number(value));
  if (kind === "rate") return `${Math.round(Number(value) * 10000) / 100}%`;
  return value;
}

export function displayCell(kind: CellKind | undefined, value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return "—";
  if (kind === "money") return formatCurrency(Number(value));
  if (kind === "date") return formatDate(String(value));
  if (kind === "period") return formatPeriod(String(value));
  if (kind === "rate") return formatRate(Number(value));
  if (kind === "number") return Number(value).toLocaleString("es-CO");
  return String(value);
}

export { PREVIEW_ROWS };
