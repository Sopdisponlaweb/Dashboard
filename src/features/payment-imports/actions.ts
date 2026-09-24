"use server";

import { revalidatePath } from "next/cache";

import { applyPaymentImport, listAffiliates, type ApplyImportRow } from "@/features/affiliates/repository";
import type { AffiliationSource } from "@/features/affiliates/types";
import { normalizeDocumentNumber } from "@/features/affiliates/validation";
import { findArchivedTitulars } from "@/features/archive/repository";

import type { ApplyBatchState, ImportBatchState } from "./form-state";
import { matchImportRows, type MappedImportRow } from "./parse";

function lastDayOfMonth(period: string): string {
  const [year, month] = period.split("-").map(Number);
  const end = new Date(Date.UTC(year, month, 0));
  return end.toISOString().slice(0, 10);
}

export async function previewImportBatch(
  _previousState: ImportBatchState,
  formData: FormData,
): Promise<ImportBatchState> {
  const source = String(formData.get("source") ?? "");
  const period = String(formData.get("period") ?? "");
  const fileName = String(formData.get("fileName") ?? "");
  const mappedRowsRaw = String(formData.get("mappedRows") ?? "[]");

  if (!period) {
    return { status: "error", message: "Indica el periodo (mes) del lote." };
  }

  let mappedRows: MappedImportRow[];
  try {
    const parsed = JSON.parse(mappedRowsRaw);
    if (!Array.isArray(parsed)) throw new Error("invalid");
    mappedRows = parsed;
  } catch {
    return { status: "error", message: "No fue posible leer las filas mapeadas del archivo.", source, period };
  }

  if (!mappedRows.length) {
    return { status: "error", message: "El archivo no contiene filas para procesar.", source, period, fileName };
  }

  const affiliates = await listAffiliates();
  // Documents with no titular here may belong to someone archived after retiring.
  const known = new Set(affiliates.map((affiliate) => normalizeDocumentNumber(affiliate.documentNumber)));
  const unknown = [...new Set(mappedRows.map((row) => normalizeDocumentNumber(row.documentNumberRaw)).filter((document) => document && !known.has(document)))];
  const archived = await findArchivedTitulars(unknown);
  const archivedNames = new Map([...archived].map(([document, member]) => [document, member.name]));
  const preview = matchImportRows(mappedRows, affiliates, archivedNames);

  return { status: "preview", preview, source, period, fileName };
}

export async function applyImportBatch(
  _previousState: ApplyBatchState,
  formData: FormData,
): Promise<ApplyBatchState> {
  const source = String(formData.get("source") ?? "");
  const period = String(formData.get("period") ?? "");
  const fileName = String(formData.get("fileName") ?? "");
  const rowsRaw = String(formData.get("rows") ?? "[]");

  if (!source || !period) {
    return { status: "error", message: "Falta la fuente o el periodo del lote." };
  }

  let rows: ApplyImportRow[];
  try {
    const parsed = JSON.parse(rowsRaw);
    if (!Array.isArray(parsed)) throw new Error("invalid");
    rows = parsed;
  } catch {
    return { status: "error", message: "No fue posible leer las filas del lote." };
  }

  if (!rows.length) {
    return { status: "error", message: "No hay filas listas para aplicar en este lote." };
  }

  try {
    const result = await applyPaymentImport({
      source: source as AffiliationSource,
      periodStart: `${period}-01`,
      periodEnd: lastDayOfMonth(period),
      originalFilename: fileName || null,
      rows,
    });

    revalidatePath("/pagos");
    revalidatePath("/");
    revalidatePath("/afiliados");
    revalidatePath("/importaciones");

    return { status: "applied", result };
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "No fue posible aplicar el lote." };
  }
}
