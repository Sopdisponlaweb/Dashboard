// Copia exacta de normalizeDocumentNumber en src/features/affiliates/validation.ts.
// Ver nota de sincronización en ./calculations.ts.

export function normalizeDocumentNumber(value: string) {
  return value.replace(/[^\p{L}\p{N}]/gu, "").toLocaleUpperCase("es-CO");
}
