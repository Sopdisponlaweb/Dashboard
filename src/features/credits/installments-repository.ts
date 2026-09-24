import { getAllAffiliates } from "@/features/affiliates/repository";
import { getFullName } from "@/features/affiliates/format";
import type { CreditStatus } from "@/features/affiliates/types";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

/** One abono in the "Pagos de créditos" directory. */
export type CreditInstallmentRecord = {
  id: string;
  creditId: string;
  paidOn: string;
  amount: number;
  capitalPortion: number;
  interestPortion: number;
  observation: string | null;
  receiptNumber: number | null;
  supportDocumentId: string | null;
  paymentMethod: string | null;
  creditStatus: CreditStatus;
  creditPrincipalBase: number;
  creditRequestedOn: string;
  affiliateId: string;
  affiliateName: string;
  affiliateDocument: string;
};

export type CreditInstallmentFilters = {
  query?: string;
  /** YYYY-MM */
  month?: string | "all";
  paymentMethodId?: string | "all";
  creditStatus?: CreditStatus | "all";
  /** Payment date range [from, to), YYYY-MM-DD. */
  paidFrom?: string;
  paidTo?: string;
  page?: number;
  pageSize?: number;
};

export type CreditInstallmentSummary = {
  count: number;
  amount: number;
  capital: number;
  interest: number;
  /** Every month with abonos, newest first (unfiltered, for the month selector). */
  months: string[];
};

const directorySelect = `
  id, credit_id, paid_on, amount, capital_portion, interest_portion, observation, receipt_number,
  support_document_id, payment_method_name, credit_status, credit_principal_base, credit_requested_on,
  affiliate_id, affiliate_first_names, affiliate_last_names, affiliate_document_type, affiliate_document_number
`;

function mapRow(row: Record<string, unknown>): CreditInstallmentRecord {
  return {
    id: row.id as string,
    creditId: row.credit_id as string,
    paidOn: row.paid_on as string,
    amount: Number(row.amount),
    capitalPortion: Number(row.capital_portion),
    interestPortion: Number(row.interest_portion),
    observation: (row.observation as string | null) ?? null,
    receiptNumber: row.receipt_number === null || row.receipt_number === undefined ? null : Number(row.receipt_number),
    supportDocumentId: (row.support_document_id as string | null) ?? null,
    paymentMethod: (row.payment_method_name as string | null) ?? null,
    creditStatus: row.credit_status as CreditStatus,
    creditPrincipalBase: Number(row.credit_principal_base),
    creditRequestedOn: row.credit_requested_on as string,
    affiliateId: row.affiliate_id as string,
    affiliateName: `${row.affiliate_first_names as string} ${row.affiliate_last_names as string}`,
    affiliateDocument: `${row.affiliate_document_type as string} ${row.affiliate_document_number as string}`,
  };
}

/** Demo mode (no Supabase): abonos flattened from the demo affiliates. */
async function demoRecords(): Promise<CreditInstallmentRecord[]> {
  const affiliates = await getAllAffiliates();
  return affiliates.flatMap((affiliate) => (affiliate.credits ?? []).flatMap((credit) => credit.installments.map((installment) => ({
    id: installment.id,
    creditId: credit.id,
    paidOn: installment.paidOn,
    amount: installment.amount,
    capitalPortion: installment.capitalPortion,
    interestPortion: installment.interestPortion,
    observation: installment.observation ?? null,
    receiptNumber: installment.receiptNumber ?? null,
    supportDocumentId: installment.supportDocumentId ?? null,
    paymentMethod: installment.paymentMethod ?? null,
    creditStatus: credit.status,
    creditPrincipalBase: credit.principalBase,
    creditRequestedOn: credit.requestedOn,
    affiliateId: affiliate.id,
    affiliateName: getFullName(affiliate),
    affiliateDocument: `${affiliate.documentType} ${affiliate.documentNumber}`,
  }))));
}

export async function listCreditInstallments(filters: CreditInstallmentFilters = {}) {
  const { query = "", month = "all", paymentMethodId = "all", creditStatus = "all", page = 1, pageSize = 50 } = filters;

  if (!isSupabaseConfigured()) {
    const records = (await demoRecords())
      .filter((record) => (!query || `${record.affiliateName} ${record.affiliateDocument}`.toLowerCase().includes(query.toLowerCase()))
        && (month === "all" || record.paidOn.startsWith(month))
        && (creditStatus === "all" || record.creditStatus === creditStatus))
      .sort((a, b) => b.paidOn.localeCompare(a.paidOn));
    return { records: records.slice((page - 1) * pageSize, page * pageSize), totalCount: records.length };
  }

  const supabase = await createClient();
  let q = supabase
    .from("credit_installment_directory")
    .select(directorySelect, { count: "exact" })
    .order("paid_on", { ascending: false })
    .order("receipt_number", { ascending: false, nullsFirst: false });

  if (query.trim()) q = q.ilike("search_text", `%${query.trim()}%`);
  if (month !== "all") q = q.eq("paid_month", month);
  if (paymentMethodId !== "all") q = q.eq("payment_method_id", paymentMethodId);
  if (creditStatus !== "all") q = q.eq("credit_status", creditStatus);
  if (filters.paidFrom) q = q.gte("paid_on", filters.paidFrom);
  if (filters.paidTo) q = q.lt("paid_on", filters.paidTo);

  const { data, error, count } = await q.range((page - 1) * pageSize, page * pageSize - 1);
  if (error) throw new Error(`No fue posible cargar los pagos de créditos: ${error.message}`);
  return { records: ((data ?? []) as Record<string, unknown>[]).map(mapRow), totalCount: count ?? 0 };
}

export async function getCreditInstallmentSummary(filters: CreditInstallmentFilters = {}): Promise<CreditInstallmentSummary> {
  const { query = "", month = "all", paymentMethodId = "all", creditStatus = "all" } = filters;

  if (!isSupabaseConfigured()) {
    const { records } = await listCreditInstallments({ ...filters, page: 1, pageSize: Number.MAX_SAFE_INTEGER });
    const all = await demoRecords();
    return {
      count: records.length,
      amount: records.reduce((total, record) => total + record.amount, 0),
      capital: records.reduce((total, record) => total + record.capitalPortion, 0),
      interest: records.reduce((total, record) => total + record.interestPortion, 0),
      months: [...new Set(all.map((record) => record.paidOn.slice(0, 7)))].sort().reverse(),
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_credit_installment_summary", {
    p_query: query.trim() || null,
    p_month: month === "all" ? null : month,
    p_payment_method_id: paymentMethodId === "all" ? null : paymentMethodId,
    p_credit_status: creditStatus === "all" ? null : creditStatus,
  });
  if (error) throw new Error(`No fue posible calcular el resumen de pagos de créditos: ${error.message}`);

  const summary = data as Record<string, unknown>;
  return {
    count: Number(summary.count ?? 0),
    amount: Number(summary.amount ?? 0),
    capital: Number(summary.capital ?? 0),
    interest: Number(summary.interest ?? 0),
    months: (summary.months as string[] | null) ?? [],
  };
}
