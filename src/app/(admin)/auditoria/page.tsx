import type { Metadata } from "next";

import { Pagination } from "@/components/pagination";
import { DataSourceBadge } from "@/components/data-source-badge";
import { Icon } from "@/components/icons";
import {
  auditTableLabels,
  canReadAudit,
  countAuditEvents,
  listAuditEvents,
  type AuditEvent,
  type AuditOperation,
} from "@/features/audit/repository";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export const metadata: Metadata = { title: "Auditoría" };

const PAGE_SIZE = 50;

const operationLabels: Record<AuditOperation, string> = {
  INSERT: "Creación",
  UPDATE: "Actualización",
  DELETE: "Eliminación",
};

const operationTone: Record<AuditOperation, string> = {
  INSERT: "payment-paid",
  UPDATE: "level-info",
  DELETE: "payment-reversed",
};

const dateTimeFormatter = new Intl.DateTimeFormat("es-CO", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "America/Bogota",
});

function formatDateTime(value: string) {
  return dateTimeFormatter.format(new Date(value));
}

function diffFields(event: AuditEvent) {
  const before = event.oldData ?? {};
  const after = event.newData ?? {};
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const changes: { field: string; before: unknown; after: unknown }[] = [];

  for (const key of keys) {
    if (key === "updated_at" || key === "created_at") continue;
    const beforeValue = before[key];
    const afterValue = after[key];
    if (JSON.stringify(beforeValue) !== JSON.stringify(afterValue)) {
      changes.push({ field: key, before: beforeValue, after: afterValue });
    }
  }

  return changes;
}

function renderValue(value: unknown) {
  if (value === null || value === undefined) return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

type SearchParams = Promise<{ table?: string | string[]; operation?: string | string[]; system?: string | string[]; page?: string | string[] }>;

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AuditPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const persistenceEnabled = isSupabaseConfigured();
  const table = firstValue(params.table) ?? "all";
  const rawOperation = firstValue(params.operation) ?? "all";
  const operation: AuditOperation | "all" = (["INSERT", "UPDATE", "DELETE"] as const).includes(rawOperation as AuditOperation)
    ? (rawOperation as AuditOperation)
    : "all";
  const includeSystem = firstValue(params.system) === "1";
  const page = Math.max(1, Number(firstValue(params.page)) || 1);

  const hasAccess = persistenceEnabled ? await canReadAudit() : false;

  const filters = { table, operation, onlyHuman: !includeSystem, page, pageSize: PAGE_SIZE };
  const [events, totalCount] = hasAccess
    ? await Promise.all([listAuditEvents(filters), countAuditEvents(filters)])
    : [[] as AuditEvent[], 0];

  return (
    <>
      <header className="page-heading directory-heading">
        <div>
          <p className="eyebrow">Control</p>
          <h1>Auditoría</h1>
          <p>Quién consultó o modificó información y qué cambió en cada operación sensible.</p>
        </div>
        <DataSourceBadge connected={persistenceEnabled} connectedLabel="Conectado a Supabase local" disconnectedLabel="Requiere conexión a Supabase" />
      </header>

      {!persistenceEnabled ? (
        <p className="empty-hint">La auditoría requiere una conexión activa a Supabase.</p>
      ) : !hasAccess ? (
        <p className="empty-hint">No tienes el permiso &quot;audit.read&quot; para consultar el historial de auditoría.</p>
      ) : (
        <section className="directory-panel" aria-labelledby="audit-title">
          <div className="directory-panel-header">
            <div>
              <h2 id="audit-title">Historial de cambios</h2>
              <p>{totalCount.toLocaleString("es-CO")} eventos coinciden con los filtros actuales</p>
            </div>
          </div>

          <form className="filter-bar" method="get">
            <label>
              <span>Tabla</span>
              <select name="table" defaultValue={table}>
                <option value="all">Todas</option>
                {Object.entries(auditTableLabels).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Operación</span>
              <select name="operation" defaultValue={operation}>
                <option value="all">Todas</option>
                <option value="INSERT">Creación</option>
                <option value="UPDATE">Actualización</option>
                <option value="DELETE">Eliminación</option>
              </select>
            </label>
            <label className="form-field-checkbox">
              <span>Origen</span>
              <span className="checkbox-row"><input name="system" type="checkbox" value="1" defaultChecked={includeSystem} /> Incluir procesos automáticos (mora, importaciones)</span>
            </label>
            <button className="primary-button" type="submit">Aplicar filtros</button>
          </form>

          {events.length ? (
            <div className="data-table-wrap">
              <table className="data-table compact-table">
                <thead><tr><th>Fecha</th><th>Usuario</th><th>Tabla</th><th>Operación</th><th>Registro</th><th>Cambios</th></tr></thead>
                <tbody>
                  {events.map((event) => {
                    const changes = diffFields(event);
                    return (
                      <tr key={event.id}>
                        <td>{formatDateTime(event.occurredAt)}</td>
                        <td>{event.actorName ?? "Sistema"}</td>
                        <td>{auditTableLabels[event.tableName] ?? event.tableName}</td>
                        <td><span className={`payment-badge ${operationTone[event.operation]}`}>{operationLabels[event.operation]}</span></td>
                        <td className="mono-value">{event.recordId?.slice(0, 8) ?? "—"}</td>
                        <td>
                          {changes.length ? (
                            <details>
                              <summary>{changes.length} {changes.length === 1 ? "campo" : "campos"}</summary>
                              <div className="audit-diff">
                                {changes.map((change) => (
                                  <p key={change.field}><strong>{change.field}</strong>: {renderValue(change.before)} → {renderValue(change.after)}</p>
                                ))}
                              </div>
                            </details>
                          ) : "Sin cambios de campo"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : <div className="empty-state"><span><Icon name="history" size={26} /></span><h3>No encontramos eventos</h3><p>Prueba con otros filtros.</p></div>}

          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            totalCount={totalCount}
            basePath="/auditoria"
            searchParams={{ table, operation, system: includeSystem ? "1" : "" }}
          />
        </section>
      )}
    </>
  );
}
