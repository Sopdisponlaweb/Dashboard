import {
  creditStatusLabels,
  documentKindLabels,
  formatCreditReceiptNumber,
  formatCurrency,
  formatDate,
  formatPeriod,
  formatRate,
  formatReceiptNumber,
  paymentStatusLabels,
  sourceLabels,
} from "@/features/affiliates/format";
import type { AffiliationSource, CreditStatus, MemberDocument, PaymentStatus } from "@/features/affiliates/types";
import { listMunicipalities, listOrganizations, listPaymentMethods, listPoliceRanks } from "@/features/catalogs/repository";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

import type { AffiliateHistoryEntry, HistoryCategory } from "./affiliate-history-types";
import { diffRecordHistoryRow, type AuditOperation, type HistoryLookups, type RecordChange } from "./repository";

type Row = Record<string, unknown>;
type Lookups = HistoryLookups & { paymentMethods: Map<string, string>; beneficiaryNames: Map<string, string> };

const categoryByTable: Record<string, HistoryCategory> = {
  affiliates: "datos",
  affiliate_successions: "sucesion",
  beneficiaries: "beneficiarios",
  payments: "pagos",
  payment_receipts: "pagos",
  credits: "creditos",
  credit_installments: "creditos",
  member_documents: "documentos",
  credit_clearances: "creditos",
  member_notes: "observaciones",
};

const text = (value: unknown) => (value === null || value === undefined ? "" : String(value));
const money = (value: unknown) => formatCurrency(Number(value ?? 0));
const period = (value: unknown) => formatPeriod(text(value).slice(0, 7));
const method = (row: Row, lookups: Lookups) => lookups.paymentMethods.get(text(row.payment_method_id)) ?? null;
const personName = (row: Row) => `${text(row.first_names)} ${text(row.last_names)}`.trim() || "Sin nombre registrado";
const truncate = (value: string, length: number) => (value.length > length ? `${value.slice(0, length - 1)}…` : value);
const joinParts = (...parts: (string | null | false | undefined)[]) => parts.filter(Boolean).join(" · ");

/** Field-level changes for payments and credits: only the fields people care about. */
const trackedFields: Record<"payments" | "credits", Record<string, string>> = {
  payments: {
    period_start: "Periodo",
    amount: "Valor",
    status: "Estado",
    paid_on: "Fecha de pago",
    source: "Tipo de afiliación",
    payment_method_id: "Método de pago",
    observations: "Observación",
  },
  credits: {
    status: "Estado",
    requested_on: "Fecha de solicitud",
    observations: "Observaciones",
  },
};

function formatTracked(table: "payments" | "credits", field: string, value: unknown, lookups: Lookups) {
  if (value === null || value === undefined || value === "") return "Sin registrar";
  if (field === "amount") return money(value);
  if (field === "period_start") return period(value);
  if (field === "paid_on" || field === "requested_on") return formatDate(text(value).slice(0, 10));
  if (field === "source") return sourceLabels[value as AffiliationSource] ?? text(value);
  if (field === "payment_method_id") return lookups.paymentMethods.get(text(value)) ?? text(value);
  if (field === "status") {
    return table === "payments"
      ? paymentStatusLabels[value as PaymentStatus] ?? text(value)
      : creditStatusLabels[value as CreditStatus] ?? text(value);
  }
  return text(value);
}

function diffTracked(table: "payments" | "credits", before: Row, after: Row, lookups: Lookups): RecordChange[] {
  return Object.entries(trackedFields[table])
    .filter(([field]) => JSON.stringify(before[field] ?? null) !== JSON.stringify(after[field] ?? null))
    .map(([field, label]) => ({
      field,
      label,
      before: formatTracked(table, field, before[field], lookups),
      after: formatTracked(table, field, after[field], lookups),
    }));
}

/** `generic` marks plain field-update entries, hidden when no tracked field changed. */
type Described = { title: string; detail: string | null; changes: RecordChange[]; generic?: boolean } | null;

/** Turns one audit event into a readable entry; null hides events already covered by another. */
function describe(table: string, operation: AuditOperation, before: Row, after: Row, lookups: Lookups): Described {
  const row = operation === "DELETE" ? before : after;
  const none = { detail: null, changes: [] as RecordChange[] };

  switch (table) {
    case "affiliates":
      if (operation === "INSERT") return { title: "Afiliado registrado", detail: joinParts(personName(row), sourceLabels[row.source as AffiliationSource]), changes: [] };
      if (operation === "DELETE") return { title: "Afiliado eliminado", ...none };
      return { title: "Datos actualizados", detail: null, changes: diffRecordHistoryRow("affiliates", before, after, lookups), generic: true };

    case "affiliate_successions": {
      if (operation === "INSERT") {
        return {
          title: "Sucesión registrada",
          detail: joinParts(
            `Sucesor: ${text(row.successor_name)} (${text(row.successor_document)})`,
            row.resolution_number ? `resolución ${text(row.resolution_number)}` : null,
            `fecha ${formatDate(text(row.succession_date))}`,
          ),
          changes: [],
        };
      }
      if (operation === "UPDATE" && !before.annulled_at && after.annulled_at) {
        return { title: "Sucesión anulada", detail: `Motivo: ${text(after.annul_reason)}`, changes: [] };
      }
      // The registration fills credit_decision in a second step of the same transaction; only later changes matter.
      if (operation === "UPDATE" && before.credit_decision !== "none" && before.credit_decision !== after.credit_decision) {
        return {
          title: after.credit_decision === "inherited" ? "Sucesión: crédito heredado" : "Sucesión: crédito en pausa",
          detail: joinParts(`Sucesor: ${text(row.successor_name)}`, `${text(after.transferred_beneficiaries)} beneficiario(s) transferido(s)`),
          changes: [],
        };
      }
      return null;
    }

    case "beneficiaries":
      // Moved to another titular by a succession: the event lands on the new titular.
      if (operation === "UPDATE" && before.affiliate_id !== after.affiliate_id) {
        return after.inherited_from_affiliate_id
          ? { title: "Beneficiario heredado por sucesión", detail: joinParts(personName(row), text(row.relationship)), changes: [] }
          : { title: "Beneficiario devuelto (sucesión anulada)", detail: joinParts(personName(row), text(row.relationship)), changes: [] };
      }
      if (operation === "UPDATE" && !before.promoted_to_affiliate_id && after.promoted_to_affiliate_id) {
        return { title: "Beneficiario promovido a titular", detail: personName(row), changes: [] };
      }
      if (operation === "INSERT") return { title: "Beneficiario agregado", detail: joinParts(personName(row), text(row.relationship)), changes: [] };
      if (operation === "DELETE") return { title: "Beneficiario eliminado", detail: personName(row), changes: [] };
      return { title: "Beneficiario actualizado", detail: personName(row), changes: diffRecordHistoryRow("beneficiaries", before, after, lookups), generic: true };

    case "payment_receipts": {
      const months = Number(row.months_count ?? 1);
      const range = months === 1 ? period(row.period_from) : `${period(row.period_from)} a ${period(row.period_to)}`;
      return {
        title: `Pago registrado · recibo ${formatReceiptNumber(Number(row.receipt_number))}`,
        detail: joinParts(range, `${months} ${months === 1 ? "mes" : "meses"}`, money(row.total_amount), method(row, lookups), sourceLabels[row.source as AffiliationSource]),
        changes: [],
      };
    }

    case "payments":
      // Months created by a receipt are summarised by the receipt entry.
      if (operation === "INSERT" && row.receipt_id) return null;
      if (operation === "INSERT") {
        return {
          title: "Pago registrado",
          detail: joinParts(period(row.period_start), money(row.amount), sourceLabels[row.source as AffiliationSource], paymentStatusLabels[row.status as PaymentStatus], method(row, lookups)),
          changes: [],
        };
      }
      if (operation === "DELETE") return { title: "Pago eliminado", detail: joinParts(period(row.period_start), money(row.amount)), changes: [] };
      return { title: "Pago actualizado", detail: period(row.period_start), changes: diffTracked("payments", before, after, lookups), generic: true };

    case "credits": {
      if (operation === "INSERT") {
        const rolled = Number(row.rolled_over_capital ?? 0) + Number(row.rolled_over_interest ?? 0);
        return {
          title: rolled > 0 ? "Crédito solicitado (refinanciación)" : "Crédito solicitado",
          detail: joinParts(
            `Desembolso ${money(row.disbursed_amount)}`,
            rolled > 0 && `saldo anterior ${money(rolled)}`,
            `${formatRate(Number(row.interest_rate))} · ${text(row.term_months)} meses`,
            `total ${money(row.total_amount)}`,
            `cuota ${money(row.installment_amount)}`,
          ),
          changes: [],
        };
      }
      if (operation === "DELETE") return { title: "Crédito eliminado", detail: `Total ${money(row.total_amount)}`, changes: [] };
      if (before.affiliate_id !== after.affiliate_id) {
        return after.inherited_from_affiliate_id
          ? { title: "Crédito heredado por sucesión", detail: `Total ${money(row.total_amount)}`, changes: diffTracked("credits", before, after, lookups) }
          : { title: "Crédito devuelto al titular fallecido", detail: `Total ${money(row.total_amount)}`, changes: diffTracked("credits", before, after, lookups) };
      }
      const changes = diffTracked("credits", before, after, lookups);
      const closed = before.status !== after.status ? creditStatusLabels[after.status as CreditStatus] : null;
      return { title: closed ? `Crédito ${closed.toLowerCase()}` : "Crédito actualizado", detail: `Total ${money(row.total_amount)}`, changes, generic: true };
    }

    case "credit_installments": {
      const receipt = row.receipt_number ? ` ${formatCreditReceiptNumber(Number(row.receipt_number))}` : "";
      if (operation === "DELETE") return { title: `Abono a crédito eliminado${receipt}`, detail: money(row.amount), changes: [] };
      return {
        title: `Abono a crédito${receipt}`,
        detail: joinParts(
          `${money(row.amount)} (capital ${money(row.capital_portion)} · interés ${money(row.interest_portion)})`,
          method(row, lookups),
          formatDate(text(row.paid_on)),
        ),
        changes: [],
      };
    }

    case "member_documents": {
      const kind = documentKindLabels[row.kind as MemberDocument["kind"]] ?? "Documento";
      const title = operation === "INSERT" ? "Documento cargado" : operation === "DELETE" ? "Documento eliminado" : "Documento actualizado";
      const owner = row.beneficiary_id ? lookups.beneficiaryNames.get(text(row.beneficiary_id)) ?? "un beneficiario" : null;
      return { title, detail: joinParts(text(row.title), kind, owner ? `De ${owner}` : null), changes: [] };
    }

    case "credit_clearances":
      return {
        title: "Paz y salvo emitido",
        detail: joinParts(
          `PS-${text(row.clearance_number).padStart(6, "0")}`,
          row.settlement === "forgiven" ? "Crédito condonado" : "Crédito pagado",
          `Total ${money(row.total_amount)}`,
        ),
        changes: [],
      };

    case "member_notes":
      return { title: operation === "DELETE" ? "Observación eliminada" : "Observación agregada", detail: truncate(text(row.body), 240), changes: [] };

    default:
      return { title: `${table} · ${operation}`, ...none };
  }
}

/** Every audited change that concerns the affiliate, newest first. */
export async function getAffiliateHistory(affiliateId: string, limit = 300): Promise<AffiliateHistoryEntry[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_affiliate_history", { p_affiliate_id: affiliateId, p_limit: limit });
  if (error) throw new Error(`No fue posible cargar el historial del afiliado: ${error.message}`);

  const rows = (data ?? []) as Row[];
  if (!rows.length) return [];

  // Beneficiary files name their owner; fetch just the beneficiaries those rows mention.
  const beneficiaryIds = [...new Set(rows
    .filter((row) => row.table_name === "member_documents")
    .map((row) => text(((row.new_data ?? row.old_data) as Row | null)?.beneficiary_id))
    .filter(Boolean))];
  const [municipalities, organizations, policeRanks, paymentMethods, beneficiaryRows] = await Promise.all([
    listMunicipalities(),
    listOrganizations(),
    listPoliceRanks(),
    listPaymentMethods(),
    beneficiaryIds.length
      ? supabase.from("beneficiaries").select("id, first_names, last_names").in("id", beneficiaryIds).then(({ data }) => (data ?? []) as Row[])
      : Promise.resolve([] as Row[]),
  ]);
  const lookups: Lookups = {
    municipalities: new Map(municipalities.map((m) => [m.id, `${m.name}, ${m.department}`])),
    organizations: new Map(organizations.map((o) => [o.id, o.name])),
    policeRanks: new Map(policeRanks.map((r) => [r.id, r.name])),
    paymentMethods: new Map(paymentMethods.map((m) => [m.id, m.name])),
    beneficiaryNames: new Map(beneficiaryRows.map((b) => [text(b.id), personName(b)])),
  };

  return rows.flatMap((row) => {
    const table = text(row.table_name);
    const operation = row.operation as AuditOperation;
    const described = describe(table, operation, (row.old_data as Row | null) ?? {}, (row.new_data as Row | null) ?? {}, lookups);
    // An update whose only changes are technical fields (timestamps, ids) says nothing.
    if (!described || (described.generic && !described.changes.length)) return [];
    return [{
      id: Number(row.id),
      category: categoryByTable[table] ?? "datos",
      operation,
      title: described.title,
      detail: described.detail,
      changes: described.changes,
      actorName: (row.actor_name as string | null) ?? null,
      occurredAt: text(row.occurred_at),
    }];
  });
}
