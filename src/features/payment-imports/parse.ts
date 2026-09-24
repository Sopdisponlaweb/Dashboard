import { normalizeDocumentNumber } from "@/features/affiliates/validation";

export type ImportRowStatus = "ready" | "duplicate" | "not-found" | "archived" | "invalid-amount" | "missing-document";

export type ParsedImportRow = {
  line: number;
  documentNumberRaw: string;
  amountRaw: string;
  amount: number | null;
  observation: string | null;
  status: ImportRowStatus;
  affiliateId: string | null;
  affiliateName: string | null;
};

export type ImportPreview = {
  rows: ParsedImportRow[];
  readyCount: number;
  errorCount: number;
  totalAmount: number;
};

export type ImportableAffiliate = {
  id: string;
  documentNumber: string;
  firstNames: string;
  lastNames: string;
};

const rowStatusLabels: Record<ImportRowStatus, string> = {
  ready: "Lista para aplicar",
  duplicate: "Documento duplicado en el archivo",
  "not-found": "Titular no encontrado",
  archived: "Retirado archivado · ver plataforma antigua",
  "invalid-amount": "Valor inválido",
  "missing-document": "Falta el número de documento",
};

export function importRowStatusLabel(status: ImportRowStatus) {
  return rowStatusLabels[status];
}

export function parseAmount(raw: string) {
  const digitsOnly = raw.replace(/[.\s]/g, "").replace(",", ".");
  if (!digitsOnly || !/^\d+(\.\d+)?$/.test(digitsOnly)) return null;
  const amount = Number(digitsOnly);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

export type MappedImportRow = {
  documentNumberRaw: string;
  amountRaw: string;
  observation: string | null;
};

/** `archivedNames`: document → name of titulars archived after retiring (not payable here). */
export function matchImportRows(mappedRows: MappedImportRow[], affiliates: ImportableAffiliate[], archivedNames = new Map<string, string>()): ImportPreview {
  const affiliateIndex = new Map(affiliates.map((affiliate) => [normalizeDocumentNumber(affiliate.documentNumber), affiliate]));
  const seenDocuments = new Set<string>();

  const rows: ParsedImportRow[] = mappedRows.map((mappedRow, index) => {
    const { documentNumberRaw, amountRaw, observation } = mappedRow;
    const documentNumber = normalizeDocumentNumber(documentNumberRaw);
    const amount = parseAmount(amountRaw);
    const affiliate = documentNumber ? affiliateIndex.get(documentNumber) : undefined;
    const isDuplicate = Boolean(documentNumber) && seenDocuments.has(documentNumber);
    if (documentNumber) seenDocuments.add(documentNumber);

    let status: ImportRowStatus;
    if (!documentNumber) status = "missing-document";
    else if (isDuplicate) status = "duplicate";
    else if (!affiliate) status = archivedNames.has(documentNumber) ? "archived" : "not-found";
    else if (amount === null) status = "invalid-amount";
    else status = "ready";

    return {
      line: index + 1,
      documentNumberRaw,
      amountRaw,
      amount,
      observation,
      status,
      affiliateId: affiliate?.id ?? null,
      affiliateName: affiliate ? `${affiliate.firstNames} ${affiliate.lastNames}` : archivedNames.get(documentNumber) ?? null,
    };
  });

  const readyRows = rows.filter((row) => row.status === "ready");

  return {
    rows,
    readyCount: readyRows.length,
    errorCount: rows.length - readyRows.length,
    totalAmount: readyRows.reduce((sum, row) => sum + (row.amount ?? 0), 0),
  };
}
