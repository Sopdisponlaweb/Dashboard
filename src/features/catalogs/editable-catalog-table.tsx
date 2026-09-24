"use client";

import { useActionState, useId, useMemo, useState } from "react";

import { Icon } from "@/components/icons";

import { initialCatalogFormState, type CatalogFormState } from "./form-state";

export type CatalogColumn = {
  /** Form field name and key into the row values. */
  key: string;
  label: string;
  required?: boolean;
  maxLength?: number;
  placeholder?: string;
  /** Renders a select instead of a text input. */
  options?: { value: string; label: string }[];
  /** Emphasises the value (first column) or shows it in the tabular font. */
  variant?: "strong" | "mono";
};

export type CatalogRow = {
  id: string;
  isActive: boolean;
  values: Record<string, string>;
};

type UpdateAction = (id: string, state: CatalogFormState, formData: FormData) => Promise<CatalogFormState>;
type ToggleAction = (id: string, nextValue: boolean) => Promise<void>;
type DeleteAction = (id: string) => Promise<CatalogFormState>;

type EditableCatalogTableProps = {
  rows: CatalogRow[];
  columns: CatalogColumn[];
  updateAction: UpdateAction;
  toggleAction: ToggleAction;
  deleteAction: DeleteAction;
  /** Status wording, e.g. ["Activa", "Inactiva"] for feminine nouns. */
  statusLabels?: [string, string];
  searchPlaceholder?: string;
  emptyMessage: string;
  /** Page size; omit to show every row. */
  pageSize?: number;
};

function displayValue(column: CatalogColumn, value: string) {
  if (!value) return "—";
  return column.options?.find((option) => option.value === value)?.label ?? value;
}

function EditableRow({
  row,
  columns,
  updateAction,
  toggleAction,
  deleteAction,
  statusLabels,
}: {
  row: CatalogRow;
  columns: CatalogColumn[];
  updateAction: UpdateAction;
  toggleAction: ToggleAction;
  deleteAction: DeleteAction;
  statusLabels: [string, string];
}) {
  const [editing, setEditing] = useState(false);
  // Controlled so a failed save keeps what was typed (React resets form fields after an action).
  const [draft, setDraft] = useState(row.values);
  const formId = useId();
  const [state, formAction, pending] = useActionState(async (previous: CatalogFormState, formData: FormData) => {
    const result = await updateAction(row.id, previous, formData);
    if (result.status === "updated") setEditing(false);
    return result;
  }, initialCatalogFormState);
  const [deleteState, deleteFormAction, deleting] = useActionState(() => deleteAction(row.id), initialCatalogFormState);
  const rowName = row.values[columns[0].key] || "este registro";

  const statusBadge = (
    <span className={`payment-badge ${row.isActive ? "payment-paid" : "payment-reversed"}`}>
      {row.isActive ? statusLabels[0] : statusLabels[1]}
    </span>
  );

  if (!editing) {
    return (
      <tr>
        {columns.map((column) => {
          const text = displayValue(column, row.values[column.key] ?? "");
          return (
            <td key={column.key} className={column.variant === "mono" ? "mono-value" : undefined}>
              {column.variant === "strong" ? <strong>{text}</strong> : text}
            </td>
          );
        })}
        <td>{statusBadge}</td>
        <td>
          <div className="row-actions-cell">
            <button
              className="row-action"
              type="button"
              onClick={() => {
                setDraft(row.values);
                setEditing(true);
              }}
            >
              <Icon name="edit" size={14} /> Editar
            </button>
            <form action={toggleAction.bind(null, row.id, !row.isActive)}>
              <button className="row-action row-action-muted" type="submit">{row.isActive ? "Inactivar" : "Activar"}</button>
            </form>
            <form
              action={deleteFormAction}
              onSubmit={(event) => {
                if (!window.confirm(`¿Eliminar "${rowName}"? Esta acción no se puede deshacer.`)) event.preventDefault();
              }}
            >
              <button className="row-action row-action-danger" type="submit" disabled={deleting}>
                {deleting ? "Eliminando…" : "Eliminar"}
              </button>
            </form>
          </div>
          {deleteState.status === "error" || deleteState.status === "unavailable" ? (
            <p className="row-error" role="alert">{deleteState.message}</p>
          ) : null}
        </td>
      </tr>
    );
  }

  return (
    <tr className="is-editing">
      {columns.map((column) => (
        <td key={column.key}>
          {column.options ? (
            <select
              className="table-input"
              name={column.key}
              form={formId}
              value={draft[column.key] ?? ""}
              onChange={(event) => setDraft((current) => ({ ...current, [column.key]: event.target.value }))}
              required={column.required}
              aria-label={column.label}
            >
              {column.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          ) : (
            <input
              className="table-input"
              name={column.key}
              form={formId}
              value={draft[column.key] ?? ""}
              onChange={(event) => setDraft((current) => ({ ...current, [column.key]: event.target.value }))}
              required={column.required}
              maxLength={column.maxLength}
              placeholder={column.placeholder}
              aria-label={column.label}
              autoFocus={column === columns[0]}
            />
          )}
        </td>
      ))}
      <td>{statusBadge}</td>
      <td>
        <form id={formId} action={formAction} className="row-actions-cell">
          <button className="row-action" type="submit" disabled={pending}>{pending ? "Guardando…" : "Guardar"}</button>
          <button className="row-action row-action-muted" type="button" onClick={() => setEditing(false)} disabled={pending}>Cancelar</button>
        </form>
        {state.status === "error" || state.status === "unavailable" ? (
          <p className="row-error" role="alert">{state.message}</p>
        ) : null}
      </td>
    </tr>
  );
}

const combiningDiacriticsPattern = new RegExp("[\\u0300-\\u036f]", "g");

function normalize(value: string) {
  return value.normalize("NFD").replace(combiningDiacriticsPattern, "").toLowerCase();
}

export function EditableCatalogTable({
  rows,
  columns,
  updateAction,
  toggleAction,
  deleteAction,
  statusLabels = ["Activo", "Inactivo"],
  searchPlaceholder = "Buscar…",
  emptyMessage,
  pageSize,
}: EditableCatalogTableProps) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const needle = normalize(query.trim());
    if (!needle) return rows;
    return rows.filter((row) => columns.some((column) => normalize(displayValue(column, row.values[column.key] ?? "")).includes(needle)));
  }, [rows, columns, query]);

  const pageCount = pageSize ? Math.max(1, Math.ceil(filtered.length / pageSize)) : 1;
  const currentPage = Math.min(page, pageCount);
  const visible = pageSize ? filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize) : filtered;

  if (!rows.length) return <p className="inline-empty">{emptyMessage}</p>;

  return (
    <>
      <div className="catalog-toolbar">
        <label className="filter-input-wrap catalog-search">
          <span className="sr-only">Buscar en el catálogo</span>
          <Icon name="search" size={16} />
          <input
            type="search"
            value={query}
            placeholder={searchPlaceholder}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
          />
        </label>
        <span className="catalog-count">
          {filtered.length === rows.length ? `${rows.length} registros` : `${filtered.length} de ${rows.length} registros`}
        </span>
      </div>

      <div className="data-table-wrap">
        <table className="data-table compact-table catalog-table">
          <thead>
            <tr>
              {columns.map((column) => <th key={column.key}>{column.label}</th>)}
              <th>Estado</th>
              <th><span className="sr-only">Acciones</span></th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <EditableRow
                key={row.id}
                row={row}
                columns={columns}
                updateAction={updateAction}
                toggleAction={toggleAction}
                deleteAction={deleteAction}
                statusLabels={statusLabels}
              />
            ))}
          </tbody>
        </table>
      </div>
      {!filtered.length ? <p className="inline-empty">Ningún registro coincide con “{query}”.</p> : null}

      {pageSize && pageCount > 1 ? (
        <div className="table-pagination">
          <span className="pagination-status">Página {currentPage} de {pageCount}</span>
          <div className="table-pagination-controls">
            <button type="button" className="secondary-button" onClick={() => setPage(currentPage - 1)} disabled={currentPage <= 1}>Anterior</button>
            <button type="button" className="secondary-button" onClick={() => setPage(currentPage + 1)} disabled={currentPage >= pageCount}>Siguiente</button>
          </div>
        </div>
      ) : null}
    </>
  );
}
