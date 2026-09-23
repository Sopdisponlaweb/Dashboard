import type { RecordHistoryEntry } from "./repository";

const operationLabels: Record<string, string> = {
  INSERT: "Creación",
  UPDATE: "Actualización",
  DELETE: "Eliminación",
};

const dateTimeFormatter = new Intl.DateTimeFormat("es-CO", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "America/Bogota",
});

export function RecordHistoryPanel({ entries }: { entries: RecordHistoryEntry[] }) {
  if (!entries.length) {
    return <p className="inline-empty">Sin cambios registrados todavía.</p>;
  }

  return (
    <ul className="history-log">
      {entries.map((entry) => (
        <li key={entry.id}>
          <div className="history-log-head">
            <strong>{operationLabels[entry.operation] ?? entry.operation}</strong>
            <span>{entry.actorName ?? "Sistema"} · {dateTimeFormatter.format(new Date(entry.occurredAt))}</span>
          </div>
          {entry.changes.length ? (
            <ul className="history-changes">
              {entry.changes.map((change) => (
                <li key={change.field}>
                  <strong>{change.label}:</strong> {change.before} → {change.after}
                </li>
              ))}
            </ul>
          ) : entry.operation === "INSERT" ? (
            <p className="history-changes-empty">Registro creado.</p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
