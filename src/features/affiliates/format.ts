import type { Affiliate, AffiliateStatus, AffiliationSource, MemberDocument, PaymentStatus } from "./types";

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

export const statusLabels: Record<AffiliateStatus, string> = {
  active: "Activo",
  inactive: "Inactivo",
  suspended: "Suspendido",
  deceased: "Fallecido",
};

export const sourceLabels: Record<AffiliationSource, string> = {
  particular: "Particular",
  activo: "Activo",
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

export const documentKindLabels: Record<MemberDocument["kind"], string> = {
  resume: "Hoja de vida",
  identity: "Documento de identidad",
  support: "Soporte",
  other: "Otro",
};

export function formatDate(value: string | null) {
  if (!value) return "Sin registrar";
  return dateFormatter.format(new Date(`${value}T00:00:00Z`));
}

export function formatCurrency(value: number) {
  return currencyFormatter.format(value);
}

export function formatPeriod(value: string) {
  return periodFormatter.format(new Date(`${value}-01T00:00:00Z`));
}

export function getFullName(affiliate: Pick<Affiliate, "firstNames" | "lastNames">) {
  return `${affiliate.firstNames} ${affiliate.lastNames}`;
}

export function getCoverageState(affiliate: Pick<Affiliate, "status" | "fullCoverageOn">) {
  if (affiliate.status !== "active") return "not-applicable" as const;
  return new Date(`${affiliate.fullCoverageOn}T23:59:59Z`).getTime() > demoReferenceDate
    ? "waiting"
    : "full";
}
