// Shared by the server loader and the client panel; no server-only imports here.
import type { AuditOperation, RecordChange } from "./repository";

export type HistoryCategory = "datos" | "sucesion" | "beneficiarios" | "pagos" | "creditos" | "documentos" | "observaciones";

export const historyCategoryLabels: Record<HistoryCategory, string> = {
  datos: "Datos del afiliado",
  sucesion: "Sucesión",
  beneficiarios: "Beneficiarios",
  pagos: "Pagos",
  creditos: "Créditos",
  documentos: "Documentos",
  observaciones: "Observaciones",
};

export type AffiliateHistoryEntry = {
  id: number;
  category: HistoryCategory;
  operation: AuditOperation;
  title: string;
  detail: string | null;
  changes: RecordChange[];
  actorName: string | null;
  occurredAt: string;
};
