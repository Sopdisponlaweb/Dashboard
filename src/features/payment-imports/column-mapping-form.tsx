"use client";

import { useMemo, useState } from "react";

import { Icon } from "@/components/icons";

import { parseSpreadsheetFile, type SpreadsheetGrid } from "./spreadsheet";

type FieldKey = "document" | "amount" | "observation";

const fieldLabels: Record<FieldKey, string> = {
  document: "Documento",
  amount: "Valor",
  observation: "Observación",
};

const maxFileSizeBytes = 5 * 1024 * 1024;
const maxRows = 5000;
const PAGE_SIZE_OPTIONS = [100, 500, 1000] as const;

type ColumnMappingFormProps = {
  formAction: (formData: FormData) => void;
  pending: boolean;
  defaultSource?: string;
  defaultPeriod?: string;
  errorMessage?: string;
};

export function ColumnMappingForm({ formAction, pending, defaultSource, defaultPeriod, errorMessage }: ColumnMappingFormProps) {
  const [fileError, setFileError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [grid, setGrid] = useState<SpreadsheetGrid | null>(null);
  const [hasHeaderRow, setHasHeaderRow] = useState(true);
  const [mapping, setMapping] = useState<Record<number, FieldKey | "">>({});
  const [pageSize, setPageSize] = useState<number | "all">(100);
  const [page, setPage] = useState(1);

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setGrid(null);
    setMapping({});
    setFileError(null);
    setFileName(null);
    setPage(1);
    if (!file) return;

    if (!/\.(csv|xlsx|xls)$/i.test(file.name)) {
      setFileError("El archivo debe ser .csv, .xlsx o .xls.");
      return;
    }
    if (file.size > maxFileSizeBytes) {
      setFileError("El archivo supera el tamaño máximo permitido (5 MB).");
      return;
    }

    try {
      const parsed = await parseSpreadsheetFile(file);
      if (!parsed.rows.length) {
        setFileError("El archivo no contiene filas para procesar.");
        return;
      }
      if (parsed.rows.length > maxRows) {
        setFileError(`El archivo tiene ${parsed.rows.length.toLocaleString("es-CO")} filas; el máximo soportado es ${maxRows.toLocaleString("es-CO")}.`);
        return;
      }
      setGrid(parsed);
      setFileName(file.name);
    } catch {
      setFileError("No fue posible leer el archivo. Verifica que no esté dañado.");
    }
  }

  const columnLabels = useMemo(() => {
    if (!grid) return [];
    const firstRow = grid.rows[0] ?? [];
    return Array.from({ length: grid.columnCount }, (_, index) => {
      if (hasHeaderRow && firstRow[index]) return firstRow[index];
      return `Columna ${index + 1}`;
    });
  }, [grid, hasHeaderRow]);

  const dataRows = useMemo(() => {
    if (!grid) return [];
    return hasHeaderRow ? grid.rows.slice(1) : grid.rows;
  }, [grid, hasHeaderRow]);

  const effectivePageSize = pageSize === "all" ? Math.max(dataRows.length, 1) : pageSize;
  const pageCount = Math.max(1, Math.ceil(dataRows.length / effectivePageSize));
  const currentPage = Math.min(page, pageCount);
  const visibleRows = useMemo(() => {
    const start = (currentPage - 1) * effectivePageSize;
    return dataRows.slice(start, start + effectivePageSize);
  }, [dataRows, currentPage, effectivePageSize]);

  function handlePageSizeChange(value: string) {
    setPageSize(value === "all" ? "all" : Number(value));
    setPage(1);
  }

  function handleHeaderRowToggle(checked: boolean) {
    setHasHeaderRow(checked);
    setPage(1);
  }

  const documentColumn = useMemo(() => Object.entries(mapping).find(([, value]) => value === "document")?.[0], [mapping]);
  const amountColumn = useMemo(() => Object.entries(mapping).find(([, value]) => value === "amount")?.[0], [mapping]);
  const observationColumn = useMemo(() => Object.entries(mapping).find(([, value]) => value === "observation")?.[0], [mapping]);

  const canContinue = documentColumn !== undefined && amountColumn !== undefined && dataRows.length > 0;

  const mappedRowsJson = useMemo(() => {
    if (!canContinue) return "[]";
    const docIndex = Number(documentColumn);
    const amountIndex = Number(amountColumn);
    const observationIndex = observationColumn !== undefined ? Number(observationColumn) : null;

    return JSON.stringify(
      dataRows.map((row) => ({
        documentNumberRaw: row[docIndex] ?? "",
        amountRaw: row[amountIndex] ?? "",
        observation: observationIndex !== null ? (row[observationIndex] || null) : null,
      })),
    );
  }, [canContinue, dataRows, documentColumn, amountColumn, observationColumn]);

  function handleMappingChange(columnIndex: number, value: string) {
    setMapping((current) => {
      const next = { ...current };
      if (!value) {
        delete next[columnIndex];
        return next;
      }
      // Only one column can own a given field — clear it from any other column first.
      for (const key of Object.keys(next)) {
        if (next[Number(key)] === value) delete next[Number(key)];
      }
      next[columnIndex] = value as FieldKey;
      return next;
    });
  }

  return (
    <form action={formAction} className="affiliate-form" noValidate>
      <div className="field-grid field-grid-three">
        <label className="form-field">
          <span>Fuente <em>*</em></span>
          <select name="source" defaultValue={defaultSource ?? "activo"} required>
            <option value="activo">Activo</option>
            <option value="casur">CASUR</option>
            <option value="tegen">TEGEN</option>
            <option value="particular">Particular</option>
            <option value="inpec">INPEC</option>
            <option value="ordisponal">ORDISPONAL</option>
          </select>
        </label>
        <label className="form-field">
          <span>Periodo <em>*</em></span>
          <input name="period" type="month" defaultValue={defaultPeriod} required />
        </label>
        <label className="form-field">
          <span>Archivo <em>*</em></span>
          <input type="file" accept=".csv,.xlsx,.xls" onChange={handleFileChange} required />
          <small>CSV o Excel, máximo 5 MB.</small>
        </label>
      </div>

      {fileError ? (
        <div className="form-message message-error" role="alert"><Icon name="activity" size={18} /><span>{fileError}</span></div>
      ) : null}
      {errorMessage ? (
        <div className="form-message message-error" role="alert"><Icon name="activity" size={18} /><span>{errorMessage}</span></div>
      ) : null}

      {grid ? (
        <>
          <label className="checkbox-row">
            <input type="checkbox" checked={hasHeaderRow} onChange={(event) => handleHeaderRowToggle(event.target.checked)} />
            La primera fila es encabezado
          </label>

          <p className="inline-hint">Elige a qué campo corresponde cada columna. Las columnas sin mapear se ignoran.</p>

          <div className="data-table-wrap">
            <table className="data-table compact-table mapping-table">
              <thead>
                <tr>
                  {columnLabels.map((label, index) => (
                    <th key={index}>
                      <div className="mapping-column-head">
                        <span>{label}</span>
                        <select value={mapping[index] ?? ""} onChange={(event) => handleMappingChange(index, event.target.value)}>
                          <option value="">Ignorar</option>
                          {(Object.keys(fieldLabels) as FieldKey[]).map((field) => (
                            <option key={field} value={field}>{fieldLabels[field]}</option>
                          ))}
                        </select>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    {columnLabels.map((_, columnIndex) => <td key={columnIndex}>{row[columnIndex] || "—"}</td>)}
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

          <input type="hidden" name="fileName" value={fileName ?? ""} />
          <input type="hidden" name="mappedRows" value={mappedRowsJson} />

          <footer className="form-footer">
            <p>{dataRows.length.toLocaleString("es-CO")} filas detectadas. Se validarán contra el directorio de afiliados en el siguiente paso.</p>
            <div>
              <button className="primary-button" type="submit" disabled={pending || !canContinue}>
                {pending ? "Procesando…" : "Continuar"}
              </button>
            </div>
          </footer>
          {!canContinue ? <p className="inline-hint">Selecciona una columna de Documento y una de Valor para continuar.</p> : null}
        </>
      ) : null}
    </form>
  );
}
