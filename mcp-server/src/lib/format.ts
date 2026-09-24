export function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return "Sin valor";
  return value.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "Sin registrar";
  const parsed = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("es-CO", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(parsed);
}

// Visible names used by the admin app. Database keys stay the same:
// inactive = Suspendido (3 to 5 months in arrears), suspended = Retirado (6 or more).
export const membershipStatusLabels: Record<string, string> = {
  active: "Activo",
  inactive: "Suspendido",
  suspended: "Retirado",
  deceased: "Fallecido",
};

export const affiliationSourceLabels: Record<string, string> = {
  activo: "PERSONAL ACTIVO",
  particular: "PARTICULAR",
  casur: "CASUR",
  tegen: "TEGEN",
  inpec: "INPEC",
  ordisponal: "ORDISPONAL",
};

export const statusLabel = (value: unknown) => membershipStatusLabels[String(value)] ?? String(value);
export const sourceLabel = (value: unknown) => affiliationSourceLabels[String(value)] ?? String(value);
