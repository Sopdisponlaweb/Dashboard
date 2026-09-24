"use client";

import { useState } from "react";

import { historyCategoryLabels, type AffiliateHistoryEntry, type HistoryCategory } from "./affiliate-history-types";

const dateTimeFormatter = new Intl.DateTimeFormat("es-CO", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "America/Bogota",
});

const categoryOrder: HistoryCategory[] = ["datos", "sucesion", "beneficiarios", "pagos", "creditos", "documentos", "observaciones"];

export function AffiliateHistoryPanel({ entries, limitReached }: { entries: AffiliateHistoryEntry[]; limitReached: boolean }) {
  const [filter, setFilter] = useState<HistoryCategory | "todos">("todos");

  if (!entries.length) {
    return <p className="inline-empty">Sin cambios registrados todavía.</p>;
  }

  const counts = new Map<HistoryCategory, number>();
  for (const entry of entries) counts.set(entry.category, (counts.get(entry.category) ?? 0) + 1);
  const visible = filter === "todos" ? entries : entries.filter((entry) => entry.category === filter);

  return (
    <>
      <div className="history-filters" role="group" aria-label="Filtrar historial">
        <button type="button" className="history-filter" aria-pressed={filter === "todos"} onClick={() => setFilter("todos")}>
          Todo <span>{entries.length}</span>
        </button>
        {categoryOrder.filter((category) => counts.has(category)).map((category) => (
          <button key={category} type="button" className="history-filter" aria-pressed={filter === category} onClick={() => setFilter(category)}>
            {historyCategoryLabels[category]} <span>{counts.get(category)}</span>
          </button>
        ))}
      </div>

      <ul className="history-log">
        {visible.map((entry) => (
          <li key={entry.id} className={`history-entry history-${entry.category}`}>
            <div className="history-log-head">
              <div>
                <span className="history-category">{historyCategoryLabels[entry.category]}</span>
                <strong>{entry.title}</strong>
              </div>
              <span>{entry.actorName ?? "Sistema"} · {dateTimeFormatter.format(new Date(entry.occurredAt))}</span>
            </div>
            {entry.detail ? <p className="history-detail">{entry.detail}</p> : null}
            {entry.changes.length ? (
              <ul className="history-changes">
                {entry.changes.map((change) => (
                  <li key={change.field}>
                    <strong>{change.label}:</strong> {change.before} → {change.after}
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        ))}
      </ul>

      {limitReached ? <p className="inline-hint">Se muestran los {entries.length} movimientos más recientes.</p> : null}
    </>
  );
}
