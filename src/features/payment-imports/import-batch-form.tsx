"use client";

import { useActionState, useMemo, useState } from "react";

import { Icon } from "@/components/icons";
import { formatCurrency, formatPeriod, sourceLabels } from "@/features/affiliates/format";
import type { AffiliationSource } from "@/features/affiliates/types";

import { ColumnMappingForm } from "./column-mapping-form";
import { applyImportBatch, previewImportBatch } from "./actions";
import { initialApplyBatchState, initialImportBatchState, type ImportBatchState } from "./form-state";
import { importRowStatusLabel, type ImportRowStatus } from "./parse";

/** A YYYY-MM (or YYYY_MM, YYYYMM) in the file name, e.g. "Descuentos 2026-08.csv" → "2026-08". */
function periodInFileName(fileName: string | undefined) {
  const match = fileName?.match(/(20\d{2})[-_ .]?(0[1-9]|1[0-2])(?!\d)/);
  return match ? `${match[1]}-${match[2]}` : null;
}

const rowStatusTone: Record<ImportRowStatus, string> = {
  ready: "import-row-ready",
  duplicate: "import-row-warning",
  "not-found": "import-row-error",
  "invalid-amount": "import-row-error",
  "missing-document": "import-row-error",
  archived: "import-row-warning",
};

// Start with 10 rows so the table fits on screen; larger sizes stay one click away.
const PAGE_SIZE_OPTIONS = [10, 100, 500, 1000] as const;

type ImportBatchFormProps = {
  persistenceEnabled: boolean;
};

export function ImportBatchForm({ persistenceEnabled }: ImportBatchFormProps) {
  const [state, formAction, pending] = useActionState<ImportBatchState, FormData>(previewImportBatch, initialImportBatchState);
  const [applyState, applyFormAction, applyPending] = useActionState(applyImportBatch, initialApplyBatchState);
  const [checkedLines, setCheckedLines] = useState<Set<number>>(new Set());
  const [lastPreview, setLastPreview] = useState(state.preview);
  const [pageSize, setPageSize] = useState<number | "all">(PAGE_SIZE_OPTIONS[0]);
  const [page, setPage] = useState(1);

  if (state.preview !== lastPreview) {
    setLastPreview(state.preview);
    setCheckedLines(
      state.preview ? new Set(state.preview.rows.filter((row) => row.status === "ready").map((row) => row.line)) : new Set(),
    );
    setPage(1);
  }

  const readyRowsJson = useMemo(() => {
    if (state.status !== "preview" || !state.preview) return "[]";
    return JSON.stringify(
      state.preview.rows
        .filter((row) => row.status === "ready" && row.affiliateId && row.amount !== null && checkedLines.has(row.line))
        .map((row) => ({ affiliateId: row.affiliateId, amount: row.amount, observation: row.observation })),
    );
  }, [state, checkedLines]);

  const selectedCount = state.status === "preview" && state.preview
    ? state.preview.rows.filter((row) => row.status === "ready" && checkedLines.has(row.line)).length
    : 0;

  function toggleLine(line: number) {
    setCheckedLines((current) => {
      const next = new Set(current);
      if (next.has(line)) next.delete(line);
      else next.add(line);
      return next;
    });
  }

  function selectAllReady() {
    if (state.status !== "preview" || !state.preview) return;
    setCheckedLines(new Set(state.preview.rows.filter((row) => row.status === "ready").map((row) => row.line)));
  }

  function selectNone() {
    setCheckedLines(new Set());
  }

  const previewRows = useMemo(
    () => (state.status === "preview" && state.preview ? state.preview.rows : []),
    [state],
  );
  const effectivePageSize = pageSize === "all" ? Math.max(previewRows.length, 1) : pageSize;
  const pageCount = Math.max(1, Math.ceil(previewRows.length / effectivePageSize));
  const currentPage = Math.min(page, pageCount);
  const visibleRows = useMemo(() => {
    const start = (currentPage - 1) * effectivePageSize;
    return previewRows.slice(start, start + effectivePageSize);
  }, [previewRows, currentPage, effectivePageSize]);

  const batchPeriodLabel = state.period ? formatPeriod(state.period) : "Sin periodo";
  const batchSourceLabel = state.source ? sourceLabels[state.source as AffiliationSource] ?? state.source : "Sin fuente";
  const fileNamePeriod = periodInFileName(state.fileName);

  function handlePageSizeChange(value: string) {
    setPageSize(value === "all" ? "all" : Number(value));
    setPage(1);
  }

  return (
    <>
      <section className="detail-panel" aria-labelledby="import-upload-title">
        <div className="panel-header">
          <div>
            <h2 id="import-upload-title">Cargar archivo de pagos</h2>
            <p>Carga un CSV o Excel de cualquier entidad y define qué columna corresponde a cada campo.</p>
          </div>
        </div>

        <ColumnMappingForm
          formAction={formAction}
          pending={pending}
          defaultSource={state.source}
          defaultPeriod={state.period}
          errorMessage={state.status === "error" ? state.message : undefined}
        />
      </section>

      {state.status === "preview" && state.preview ? (
        <section className="detail-panel" aria-labelledby="import-preview-title">
          <div className="panel-header">
            <div>
              <h2 id="import-preview-title">Previsualización · {state.fileName}</h2>
              <p>Revisa cada fila y marca cuáles quieres aplicar. Ninguna información se ha guardado todavía.</p>
            </div>
            <span className="panel-tag">{state.preview.rows.length} filas</span>
          </div>

          <dl className="import-batch-meta" aria-label="Datos del lote">
            <div><dt>Periodo</dt><dd className="sentence-case">{batchPeriodLabel}</dd></div>
            <div><dt>Fuente</dt><dd>{batchSourceLabel}</dd></div>
            <div><dt>Archivo</dt><dd>{state.fileName ?? "—"}</dd></div>
          </dl>

          {fileNamePeriod && state.period && fileNamePeriod !== state.period ? (
            <div className="form-message message-unavailable" role="alert">
              <Icon name="calendar" size={16} />
              <span>
                El nombre del archivo indica <strong>{formatPeriod(fileNamePeriod)}</strong>, pero el periodo elegido es{" "}
                <strong>{batchPeriodLabel}</strong>. Revísalo antes de aplicar: los pagos quedarán registrados en el periodo elegido.
              </span>
            </div>
          ) : null}

          <section className="directory-summary" aria-label="Resumen del lote">
            <article><span>Listas para aplicar</span><strong>{state.preview.readyCount}</strong></article>
            <article><span>Seleccionadas</span><strong>{selectedCount}</strong></article>
            <article className="summary-waiting"><span>Con observaciones</span><strong>{state.preview.errorCount}</strong></article>
            <article><span>Valor total válido</span><strong>{formatCurrency(state.preview.totalAmount)}</strong></article>
          </section>

          <div className="import-select-controls">
            <button type="button" onClick={selectAllReady}>Seleccionar todas las listas</button>
            <button type="button" onClick={selectNone}>Deseleccionar todas</button>
          </div>

          <div className="data-table-wrap">
            <table className="data-table compact-table">
              <thead><tr><th className="import-row-select"></th><th>Línea</th><th>Documento</th><th>Titular</th><th>Valor</th><th>Observación</th><th>Estado</th></tr></thead>
              <tbody>
                {visibleRows.map((row) => (
                  <tr key={row.line}>
                    <td className="import-row-select">
                      {row.status === "ready" ? (
                        <input type="checkbox" checked={checkedLines.has(row.line)} onChange={() => toggleLine(row.line)} aria-label={`Incluir línea ${row.line}`} />
                      ) : null}
                    </td>
                    <td className="mono-value">{row.line}</td>
                    <td className="mono-value">{row.documentNumberRaw || "—"}</td>
                    <td>{row.affiliateName ?? "Sin coincidencia"}</td>
                    <td className="mono-value">{row.amount !== null ? formatCurrency(row.amount) : row.amountRaw || "—"}</td>
                    <td>{row.observation ?? "Sin observaciones"}</td>
                    <td><span className={`payment-badge ${rowStatusTone[row.status]}`}>{importRowStatusLabel(row.status)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="table-pagination">
            <label className="table-pagination-size">
              Mostrar
              <select value={pageSize} onChange={(event) => handlePageSizeChange(event.target.value)}>
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <option key={size} value={size}>{size}</option>
                ))}
                <option value="all">Todas</option>
              </select>
            </label>
            <div className="table-pagination-controls">
              <button type="button" className="secondary-button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={currentPage <= 1}>
                Anterior
              </button>
              <span>Página {currentPage} de {pageCount}</span>
              <button type="button" className="secondary-button" onClick={() => setPage((current) => Math.min(pageCount, current + 1))} disabled={currentPage >= pageCount}>
                Siguiente
              </button>
            </div>
          </div>

          {persistenceEnabled ? (
            <form action={applyFormAction} className="apply-import-form">
              <input type="hidden" name="source" value={state.source ?? ""} />
              <input type="hidden" name="period" value={state.period ?? ""} />
              <input type="hidden" name="fileName" value={state.fileName ?? ""} />
              <input type="hidden" name="rows" value={readyRowsJson} />

              {applyState.status === "error" && applyState.message ? (
                <div className="form-message message-error" role="alert"><Icon name="activity" size={18} /><span>{applyState.message}</span></div>
              ) : null}

              {applyState.status === "applied" && applyState.result ? (
                <div className="form-message message-success" role="status">
                  <Icon name="lock" size={18} />
                  <span>
                    Lote aplicado: {applyState.result.inserted} pagos registrados
                    {applyState.result.skippedAsDuplicate > 0 ? `, ${applyState.result.skippedAsDuplicate} omitidos por ya existir` : ""}.
                    Total {formatCurrency(applyState.result.totalAmount)}.
                  </span>
                </div>
              ) : (
                <div className="persistence-banner is-ready">
                  <span><Icon name="lock" size={18} /></span>
                  <div>
                    <strong>Conexión segura disponible</strong>
                    <p>
                      Se aplicarán {selectedCount} filas seleccionadas como pagos de <b>{batchPeriodLabel}</b>,
                      fuente <b>{batchSourceLabel}</b>.
                    </p>
                  </div>
                </div>
              )}

              <footer className="form-footer">
                <p>El estado de mora de los titulares se recalcula automáticamente después de aplicar el lote.</p>
                <div>
                  <button className="primary-button" type="submit" disabled={applyPending || selectedCount === 0}>
                    {applyPending ? "Aplicando…" : "Aplicar lote"}
                  </button>
                </div>
              </footer>
            </form>
          ) : (
            <div className="persistence-banner">
              <span><Icon name="activity" size={18} /></span>
              <div>
                <strong>Aplicación de lotes pendiente</strong>
                <p>Activa Supabase local para habilitar la aplicación y reversión de lotes. Por ahora solo se valida y previsualiza.</p>
              </div>
            </div>
          )}
        </section>
      ) : null}
    </>
  );
}
