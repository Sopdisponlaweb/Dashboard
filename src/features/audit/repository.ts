import { sourceLabels, statusLabels } from "@/features/affiliates/format";
import { listMunicipalities, listOrganizations } from "@/features/catalogs/repository";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export type AuditOperation = "INSERT" | "UPDATE" | "DELETE";

export const auditTableLabels: Record<string, string> = {
  affiliates: "Afiliados",
  beneficiaries: "Beneficiarios",
  payments: "Pagos",
  payment_batches: "Lotes de pago",
  member_documents: "Documentos",
  announcements: "Avisos",
};

export type AuditEvent = {
  id: number;
  actorId: string | null;
  actorName: string | null;
  tableName: string;
  recordId: string | null;
  operation: AuditOperation;
  oldData: Record<string, unknown> | null;
  newData: Record<string, unknown> | null;
  occurredAt: string;
};

export type AuditFilters = {
  table?: string | "all";
  operation?: AuditOperation | "all";
  onlyHuman?: boolean;
  page?: number;
  pageSize?: number;
};

function mapAuditRow(row: Record<string, unknown>, actorNames: Map<string, string>): AuditEvent {
  const actorId = (row.actor_id as string | null) ?? null;
  return {
    id: row.id as number,
    actorId,
    actorName: actorId ? (actorNames.get(actorId) ?? null) : null,
    tableName: row.table_name as string,
    recordId: (row.record_id as string | null) ?? null,
    operation: row.operation as AuditOperation,
    oldData: (row.old_data as Record<string, unknown> | null) ?? null,
    newData: (row.new_data as Record<string, unknown> | null) ?? null,
    occurredAt: row.occurred_at as string,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyAuditFilters(query: any, filters: AuditFilters): any {
  const { table = "all", operation = "all", onlyHuman = true } = filters;
  let q = query;
  if (table !== "all") q = q.eq("table_name", table);
  if (operation !== "all") q = q.eq("operation", operation);
  if (onlyHuman) q = q.not("actor_id", "is", null);
  return q;
}

const auditSelect = "id, actor_id, table_name, record_id, operation, old_data, new_data, occurred_at";

export async function listAuditEvents(filters: AuditFilters = {}): Promise<AuditEvent[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();
  let query = supabase.from("audit_events").select(auditSelect).order("occurred_at", { ascending: false });
  query = applyAuditFilters(query, filters);

  const { page, pageSize = 50 } = filters;
  if (page) {
    const from = (page - 1) * pageSize;
    query = query.range(from, from + pageSize - 1);
  } else {
    query = query.limit(pageSize);
  }

  const { data, error } = await query;
  if (error) throw new Error(`No fue posible cargar la auditoría: ${error.message}`);
  const rows = (data ?? []) as unknown as Record<string, unknown>[];

  const actorIds = Array.from(new Set(rows.map((row) => row.actor_id as string | null).filter((id): id is string => Boolean(id))));
  const actorNames = new Map<string, string>();
  if (actorIds.length) {
    const { data: profiles } = await supabase.from("profiles").select("id, display_name").in("id", actorIds);
    for (const profile of profiles ?? []) actorNames.set(profile.id as string, profile.display_name as string);
  }

  return rows.map((row) => mapAuditRow(row, actorNames));
}

export async function countAuditEvents(filters: AuditFilters = {}): Promise<number> {
  if (!isSupabaseConfigured()) return 0;

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query: any = supabase.from("audit_events").select("id", { count: "exact", head: true });
  query = applyAuditFilters(query, filters);

  const { count, error } = await query;
  if (error) throw new Error(`No fue posible contar los eventos de auditoría: ${error.message}`);
  return count ?? 0;
}

export type RecordChange = { field: string; label: string; before: string; after: string };

export type RecordHistoryEntry = {
  id: number;
  actorName: string | null;
  operation: AuditOperation;
  occurredAt: string;
  changes: RecordChange[];
};

const recordHistoryIgnoredFields = new Set([
  "id",
  "affiliate_id",
  "created_by",
  "updated_by",
  "created_at",
  "updated_at",
  "full_coverage_on",
]);

const recordHistoryCommonLabels: Record<string, string> = {
  document_type: "Tipo de documento",
  document_number: "Número de documento",
  document_issued_on: "Fecha de expedición",
  first_names: "Nombres",
  last_names: "Apellidos",
  birth_date: "Fecha de nacimiento",
  phone: "Teléfono",
  email: "Correo",
  status: "Estado",
  joined_on: "Fecha de afiliación",
  deceased_at: "Fecha de fallecimiento",
  internal_notes: "Notas internas",
  death_municipality_id: "Municipio de fallecimiento",
  death_registry_number: "Registro de defunción",
  death_notary: "Notaría",
  death_service_provided: "Servicio prestado",
  death_service_amount: "Monto del servicio",
  successor_bank: "Banco del sucesor",
  successor_account_number: "Cuenta del sucesor",
  successor_account_type: "Tipo de cuenta",
};

const recordHistoryFieldLabelsByTable: Record<"affiliates" | "beneficiaries", Record<string, string>> = {
  affiliates: {
    ...recordHistoryCommonLabels,
    address: "Dirección",
    municipality_id: "Municipio",
    organization_id: "Entidad",
    source: "Fuente de afiliación",
    last_payment_on: "Último pago",
    successor_resolution_number: "N.º de resolución",
    successor_document_number: "Documento del sucesor",
    successor_first_names: "Nombres del sucesor",
    successor_last_names: "Apellidos del sucesor",
    successor_phone: "Teléfono del sucesor",
  },
  beneficiaries: {
    ...recordHistoryCommonLabels,
    relationship: "Parentesco",
  },
};

const recordHistoryDateFields = new Set([
  "document_issued_on",
  "birth_date",
  "joined_on",
  "last_payment_on",
  "deceased_at",
]);

const recordHistoryDateFormatter = new Intl.DateTimeFormat("es-CO", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

function formatRecordHistoryValue(
  field: string,
  value: unknown,
  lookups: { municipalities: Map<string, string>; organizations: Map<string, string> },
): string {
  if (value === null || value === undefined || value === "") return "Sin registrar";

  if (recordHistoryDateFields.has(field)) {
    const parsed = new Date(`${String(value).slice(0, 10)}T00:00:00Z`);
    return Number.isNaN(parsed.getTime()) ? String(value) : recordHistoryDateFormatter.format(parsed);
  }
  if (field === "death_service_amount") {
    const amount = Number(value);
    return Number.isNaN(amount) ? String(value) : amount.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
  }
  if (field === "status") return statusLabels[value as keyof typeof statusLabels] ?? String(value);
  if (field === "source") return sourceLabels[value as keyof typeof sourceLabels] ?? String(value);
  if (field === "successor_account_type") {
    return value === "ahorros" ? "Ahorros" : value === "corriente" ? "Corriente" : String(value);
  }
  if (field === "municipality_id" || field === "death_municipality_id") {
    return lookups.municipalities.get(String(value)) ?? String(value);
  }
  if (field === "organization_id") {
    return lookups.organizations.get(String(value)) ?? String(value);
  }
  if (typeof value === "boolean") return value ? "Sí" : "No";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function diffRecordHistoryRow(
  tableName: "affiliates" | "beneficiaries",
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  lookups: { municipalities: Map<string, string>; organizations: Map<string, string> },
): RecordChange[] {
  const labels = recordHistoryFieldLabelsByTable[tableName];
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const changes: RecordChange[] = [];

  for (const key of keys) {
    if (recordHistoryIgnoredFields.has(key)) continue;
    const beforeValue = before[key];
    const afterValue = after[key];
    if (JSON.stringify(beforeValue ?? null) === JSON.stringify(afterValue ?? null)) continue;

    changes.push({
      field: key,
      label: labels[key] ?? key,
      before: formatRecordHistoryValue(key, beforeValue, lookups),
      after: formatRecordHistoryValue(key, afterValue, lookups),
    });
  }

  return changes;
}

export async function getRecordHistory(tableName: "affiliates" | "beneficiaries", recordId: string): Promise<RecordHistoryEntry[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_record_history", { p_table_name: tableName, p_record_id: recordId });
  if (error) throw new Error(`No fue posible cargar el historial de cambios: ${error.message}`);

  const rows = (data ?? []) as unknown as Record<string, unknown>[];
  if (!rows.length) return [];

  const [municipalities, organizations] = await Promise.all([listMunicipalities(), listOrganizations()]);
  const lookups = {
    municipalities: new Map(municipalities.map((m) => [m.id, `${m.name}, ${m.department}`])),
    organizations: new Map(organizations.map((o) => [o.id, o.name])),
  };

  return rows.map((row) => {
    const operation = row.operation as AuditOperation;
    const before = (row.old_data as Record<string, unknown> | null) ?? {};
    const after = (row.new_data as Record<string, unknown> | null) ?? {};
    return {
      id: row.id as number,
      actorName: (row.actor_name as string | null) ?? null,
      operation,
      occurredAt: row.occurred_at as string,
      changes: operation === "UPDATE" ? diffRecordHistoryRow(tableName, before, after, lookups) : [],
    };
  });
}

export async function canReadAudit(): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("has_permission", { permission_key: "audit.read" });
  if (error) return false;
  return Boolean(data);
}
