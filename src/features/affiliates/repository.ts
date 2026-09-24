import { cache } from "react";

import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

import { demoAffiliates } from "./demo-data";
import { demoReferenceDate, getCoverageState, getFullName, todayInBogota } from "./format";
import type { Affiliate, AffiliateFilters, AffiliateStatus, AffiliationSource, Beneficiary, Credit, CreditInstallment, CreditStatus, MemberDocument, Payment, PaymentStatus } from "./types";

function sizeLabel(bytes: number) {
  const megabytes = bytes / (1024 * 1024);
  return megabytes >= 1 ? `${megabytes.toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function mapBeneficiaryRow(row: Record<string, unknown>): Beneficiary {
  const deathMunicipality = row.death_municipality as { name: string; department: string } | null;

  return {
    id: row.id as string,
    documentType: (row.document_type as Beneficiary["documentType"]) ?? null,
    documentNumber: (row.document_number as string | null) ?? null,
    documentIssuedOn: (row.document_issued_on as string | null) ?? null,
    firstNames: row.first_names as string,
    lastNames: row.last_names as string,
    relationship: row.relationship as string,
    birthDate: (row.birth_date as string | null) ?? "",
    phone: (row.phone as string | null) ?? null,
    email: (row.email as string | null) ?? null,
    joinedOn: row.joined_on as string,
    fullCoverageOn: row.full_coverage_on as string,
    status: row.status as AffiliateStatus,
    deceasedOn: row.deceased_at ? (row.deceased_at as string).slice(0, 10) : null,
    internalNotes: (row.internal_notes as string | null) ?? null,
    deathMunicipalityId: (row.death_municipality_id as string | null) ?? null,
    deathMunicipality: deathMunicipality ? `${deathMunicipality.name}, ${deathMunicipality.department}` : null,
    deathRegistryNumber: (row.death_registry_number as string | null) ?? null,
    deathNotary: (row.death_notary as string | null) ?? null,
    deathServiceProvided: (row.death_service_provided as string | null) ?? null,
    deathServiceAmount: row.death_service_amount !== null && row.death_service_amount !== undefined ? Number(row.death_service_amount) : null,
    successorBank: (row.successor_bank as string | null) ?? null,
    successorAccountNumber: (row.successor_account_number as string | null) ?? null,
    successorAccountType: (row.successor_account_type as Beneficiary["successorAccountType"]) ?? null,
    inheritedFromAffiliateId: (row.inherited_from_affiliate_id as string | null) ?? null,
    inheritedFromName: personNameOf(row.inherited_from),
    promotedToAffiliateId: (row.promoted_to_affiliate_id as string | null) ?? null,
    documents: ((row.member_documents as Record<string, unknown>[] | null) ?? []).map(mapDocumentRow),
  };
}

function personNameOf(value: unknown) {
  const person = value as { first_names?: string; last_names?: string } | null;
  return person ? `${person.first_names ?? ""} ${person.last_names ?? ""}`.trim() || null : null;
}

function mapPaymentRow(row: Record<string, unknown>): Payment {
  return {
    id: row.id as string,
    period: row.period_start ? (row.period_start as string).slice(0, 7) : "",
    paidOn: (row.paid_on as string | null) ?? null,
    amount: Number(row.amount),
    source: row.source as AffiliationSource,
    status: row.status as PaymentStatus,
    observation: (row.observations as string | null) ?? null,
    supportDocumentId: (row.support_document_id as string | null) ?? null,
    paymentMethod: ((row.payment_method as { name?: string } | null)?.name) ?? null,
    receiptId: (row.receipt_id as string | null) ?? null,
    receiptNumber: ((row.receipt as { receipt_number?: number } | null)?.receipt_number) ?? null,
  };
}

function mapInstallmentRow(row: Record<string, unknown>): CreditInstallment {
  return {
    id: row.id as string,
    paidOn: row.paid_on as string,
    amount: Number(row.amount),
    capitalPortion: Number(row.capital_portion),
    interestPortion: Number(row.interest_portion),
    observation: (row.observation as string | null) ?? null,
    paymentMethod: ((row.payment_method as { name?: string } | null)?.name) ?? null,
    receiptNumber: (row.receipt_number as number | null) ?? null,
    supportDocumentId: (row.support_document_id as string | null) ?? null,
  };
}

function mapClearance(value: unknown): Credit["clearance"] {
  // One-to-one (unique credit_id): PostgREST returns an object, or an array in older shapes.
  const row = (Array.isArray(value) ? value[0] : value) as Record<string, unknown> | null | undefined;
  return row ? { id: row.id as string, number: Number(row.clearance_number), issuedOn: row.issued_on as string } : null;
}

function mapCreditRow(row: Record<string, unknown>): Credit {
  return {
    clearance: mapClearance(row.credit_clearances),
    id: row.id as string,
    previousCreditId: (row.previous_credit_id as string | null) ?? null,
    disbursedAmount: Number(row.disbursed_amount),
    rolledOverCapital: Number(row.rolled_over_capital),
    rolledOverInterest: Number(row.rolled_over_interest),
    principalBase: Number(row.principal_base),
    interestRate: Number(row.interest_rate),
    termMonths: Number(row.term_months),
    interestAmount: Number(row.interest_amount),
    totalAmount: Number(row.total_amount),
    installmentAmount: Number(row.installment_amount),
    status: row.status as CreditStatus,
    requestedOn: row.requested_on as string,
    observations: (row.observations as string | null) ?? null,
    installments: ((row.credit_installments as Record<string, unknown>[] | null) ?? []).map(mapInstallmentRow),
    inheritedFromAffiliateId: (row.inherited_from_affiliate_id as string | null) ?? null,
    inheritedFromName: personNameOf(row.inherited_from),
  };
}

function mapDocumentRow(row: Record<string, unknown>): MemberDocument {
  return {
    id: row.id as string,
    title: row.title as string,
    kind: row.kind as MemberDocument["kind"],
    uploadedOn: row.uploaded_at ? (row.uploaded_at as string).slice(0, 10) : "",
    sizeLabel: sizeLabel(Number(row.size_bytes ?? 0)),
    storagePath: row.storage_path as string,
    mimeType: (row.mime_type as string | undefined) ?? undefined,
  };
}

type SuccessionLink = { id: string; annulled_at: string | null };

function successionRoleOf(row: Record<string, unknown>): Affiliate["successionRole"] {
  const current = (value: unknown) => ((value as SuccessionLink[] | null) ?? []).some((link) => !link.annulled_at);
  if (row.status === "deceased") return current(row.succession_as_deceased) ? "succeeded" : "pending";
  return current(row.succession_as_successor) ? "successor" : null;
}

function mapAffiliateRow(row: Record<string, unknown>): Affiliate {
  const municipality = row.municipality as { name: string; department: string } | null;
  const organization = row.organization as { name: string } | null;
  const deathMunicipality = row.death_municipality as { name: string; department: string } | null;
  const policeRank = row.police_rank as { name: string; abbreviation: string | null } | null;

  return {
    id: row.id as string,
    documentType: row.document_type as Affiliate["documentType"],
    documentNumber: row.document_number as string,
    documentIssuedOn: (row.document_issued_on as string | null) ?? "",
    firstNames: row.first_names as string,
    lastNames: row.last_names as string,
    birthDate: (row.birth_date as string | null) ?? "",
    phone: (row.phone as string | null) ?? "",
    email: (row.email as string | null) ?? "",
    address: (row.address as string | null) ?? "",
    municipality: municipality ? `${municipality.name}, ${municipality.department}` : "",
    organization: organization?.name ?? null,
    source: row.source as AffiliationSource,
    status: row.status as AffiliateStatus,
    joinedOn: row.joined_on as string,
    fullCoverageOn: row.full_coverage_on as string,
    lastPaymentOn: (row.last_payment_on as string | null) ?? null,
    deceasedOn: row.deceased_at ? (row.deceased_at as string).slice(0, 10) : null,
    internalNotes: (row.internal_notes as string | null) ?? null,
    successorResolutionNumber: (row.successor_resolution_number as string | null) ?? null,
    successorDocumentNumber: (row.successor_document_number as string | null) ?? null,
    successorFirstNames: (row.successor_first_names as string | null) ?? null,
    successorLastNames: (row.successor_last_names as string | null) ?? null,
    successorPhone: (row.successor_phone as string | null) ?? null,
    deathMunicipalityId: (row.death_municipality_id as string | null) ?? null,
    deathMunicipality: deathMunicipality ? `${deathMunicipality.name}, ${deathMunicipality.department}` : null,
    deathRegistryNumber: (row.death_registry_number as string | null) ?? null,
    deathNotary: (row.death_notary as string | null) ?? null,
    deathServiceProvided: (row.death_service_provided as string | null) ?? null,
    deathServiceAmount: row.death_service_amount !== null && row.death_service_amount !== undefined ? Number(row.death_service_amount) : null,
    successorBank: (row.successor_bank as string | null) ?? null,
    successorAccountNumber: (row.successor_account_number as string | null) ?? null,
    successorAccountType: (row.successor_account_type as Affiliate["successorAccountType"]) ?? null,
    policeRankId: (row.police_rank_id as string | null) ?? null,
    policeRank: policeRank ? (policeRank.abbreviation ? `${policeRank.name} (${policeRank.abbreviation})` : policeRank.name) : null,
    successionRole: successionRoleOf(row),
    beneficiaries: ((row.beneficiaries as Record<string, unknown>[] | null) ?? []).map(mapBeneficiaryRow),
    payments: ((row.payments as Record<string, unknown>[] | null) ?? []).map(mapPaymentRow),
    documents: ((row.member_documents as Record<string, unknown>[] | null) ?? []).map(mapDocumentRow),
    credits: ((row.credits as Record<string, unknown>[] | null) ?? [])
      .map(mapCreditRow)
      .sort((a, b) => (a.requestedOn < b.requestedOn ? 1 : -1)),
  };
}

const affiliateSelect = `
  id, document_type, document_number, document_issued_on, first_names, last_names,
  birth_date, phone, email, address, source, status, joined_on, full_coverage_on,
  last_payment_on, deceased_at, internal_notes,
  successor_resolution_number, successor_document_number, successor_first_names, successor_last_names,
  successor_phone, death_municipality_id, death_registry_number, death_notary, death_service_provided,
  death_service_amount, successor_bank, successor_account_number, successor_account_type, police_rank_id,
  municipality:municipalities!municipality_id(name, department),
  death_municipality:municipalities!death_municipality_id(name, department),
  organization:organizations(name),
  police_rank:police_ranks(name, abbreviation),
  succession_as_deceased:affiliate_successions!affiliate_successions_deceased_affiliate_id_fkey(id, annulled_at),
  succession_as_successor:affiliate_successions!affiliate_successions_successor_affiliate_id_fkey(id, annulled_at),
  beneficiaries!beneficiaries_affiliate_id_fkey(id, relationship, document_type, document_number, document_issued_on,
    first_names, last_names, birth_date, phone, email, status, joined_on,
    full_coverage_on, deceased_at, internal_notes,
    death_municipality_id, death_registry_number, death_notary, death_service_provided,
    death_service_amount, successor_bank, successor_account_number, successor_account_type,
    inherited_from_affiliate_id, promoted_to_affiliate_id,
    inherited_from:affiliates!beneficiaries_inherited_from_affiliate_id_fkey(first_names, last_names),
    death_municipality:municipalities!death_municipality_id(name, department),
    member_documents!member_documents_beneficiary_id_fkey(id, kind, title, uploaded_at, size_bytes, storage_path, mime_type)),
  payments(id, period_start, paid_on, amount, source, status, observations, support_document_id, receipt_id,
    payment_method:payment_methods(name), receipt:payment_receipts(receipt_number)),
  member_documents!member_documents_affiliate_id_fkey(id, kind, title, uploaded_at, size_bytes, storage_path, mime_type),
  credits!credits_affiliate_id_fkey(id, previous_credit_id, disbursed_amount, rolled_over_capital, rolled_over_interest,
    principal_base, interest_rate, term_months, interest_amount, total_amount, installment_amount,
    status, requested_on, observations, inherited_from_affiliate_id,
    inherited_from:affiliates!credits_inherited_from_affiliate_id_fkey(first_names, last_names),
    credit_clearances(id, clearance_number, issued_on),
    credit_installments(id, paid_on, amount, capital_portion, interest_portion, observation,
      receipt_number, support_document_id, payment_method:payment_methods(name)))
`;

const PAGE_SIZE = 20000;

export const getAllAffiliates = cache(async (): Promise<Affiliate[]> => {
  if (!isSupabaseConfigured()) return demoAffiliates;

  const supabase = await createClient();
  const rows: Record<string, unknown>[] = [];

  for (let page = 0; ; page += 1) {
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const { data, error } = await supabase
      .from("affiliates")
      .select(affiliateSelect)
      .order("last_names", { ascending: true })
      .range(from, to);

    if (error) throw new Error(`No fue posible cargar afiliados: ${error.message}`);

    const batch = (data ?? []) as unknown as Record<string, unknown>[];
    rows.push(...batch);

    if (batch.length < PAGE_SIZE) break;
  }

  return rows.map(mapAffiliateRow);
});

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-CO")
    .trim();
}

function matchesQuery(affiliate: Affiliate, query: string) {
  const searchValue = normalize(query);
  const searchable = [
    affiliate.firstNames,
    affiliate.lastNames,
    affiliate.documentNumber,
    affiliate.organization ?? "",
    affiliate.municipality,
    affiliate.source,
    ...affiliate.beneficiaries.flatMap((beneficiary) => [
      beneficiary.firstNames,
      beneficiary.lastNames,
      beneficiary.documentNumber ?? "",
    ]),
  ];

  return searchable.some((value) => normalize(value).includes(searchValue));
}

const affiliateListSelect = `
  id, document_type, document_number, document_issued_on, first_names, last_names,
  birth_date, phone, email, address, source, status, joined_on, full_coverage_on,
  last_payment_on, deceased_at, internal_notes,
  municipality:municipalities!municipality_id(name, department),
  organization:organizations(name),
  succession_as_deceased:affiliate_successions!affiliate_successions_deceased_affiliate_id_fkey(id, annulled_at),
  succession_as_successor:affiliate_successions!affiliate_successions_successor_affiliate_id_fkey(id, annulled_at),
  beneficiaries!beneficiaries_affiliate_id_fkey(id, status)
`;

/**
 * waiting: active and still inside the 6-month waiting period (carencia) · full: active with full coverage.
 * Works for titulars and beneficiaries; a joined date in the future is bad data, not a waiting period.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyCoverageFilter<Q extends { eq: any; gt: any; lte: any }>(q: Q, coverage: AffiliateFilters["coverage"] = "all"): Q {
  const today = todayInBogota();
  if (coverage === "waiting") return q.eq("status", "active").gt("full_coverage_on", today).lte("joined_on", today);
  if (coverage === "full") return q.eq("status", "active").lte("full_coverage_on", today);
  return q;
}

/** Date range [from, to) on a date column; both ends optional (YYYY-MM-DD). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyDateRange<Q extends { gte: any; lt: any }>(q: Q, column: string, from?: string, to?: string): Q {
  let next = q;
  if (from) next = next.gte(column, from);
  if (to) next = next.lt(column, to);
  return next;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyAffiliateFilters(query: any, filters: AffiliateFilters): any {
  const { status = "all", source = "all", query: search = "", excludeDeceased = false } = filters;
  let q = query;
  if (status !== "all") q = q.eq("status", status);
  else if (excludeDeceased) q = q.neq("status", "deceased");
  if (source !== "all") q = q.eq("source", source);
  // Succession filters work on the embedded successions, narrowed to current (not annulled) ones.
  if (filters.succession === "pending") {
    q = q.eq("status", "deceased").is("succession_as_deceased.annulled_at", null).is("succession_as_deceased", null);
  } else if (filters.succession === "succeeded") {
    q = q.eq("status", "deceased").is("succession_as_deceased.annulled_at", null).not("succession_as_deceased", "is", null);
  } else if (filters.succession === "successor") {
    q = q.is("succession_as_successor.annulled_at", null).not("succession_as_successor", "is", null);
  }
  // A future affiliation date is bad migrated data, not a waiting period.
  q = applyCoverageFilter(q, filters.coverage);
  q = applyDateRange(q, "joined_on", filters.joinedFrom, filters.joinedTo);
  if (search.trim()) {
    const like = `%${search.trim()}%`;
    q = q.or(`first_names.ilike.${like},last_names.ilike.${like},document_number.ilike.${like}`);
  }
  return q;
}

const INTERNAL_FETCH_ALL_PAGE_SIZE = 20000;

export async function listAffiliates(filters: AffiliateFilters = {}): Promise<Affiliate[]> {
  const { query = "", status = "all", source = "all", excludeDeceased = false, page, pageSize } = filters;

  if (!isSupabaseConfigured()) {
    const affiliates = await getAllAffiliates();
    return affiliates.filter((affiliate) => {
      const queryMatches = !query || matchesQuery(affiliate, query);
      const statusMatches = status === "all" || affiliate.status === status;
      const sourceMatches = source === "all" || affiliate.source === source;
      const deceasedMatches = status !== "all" || !excludeDeceased || affiliate.status !== "deceased";

      return queryMatches && statusMatches && sourceMatches && deceasedMatches;
    });
  }

  const supabase = await createClient();

  // Explicit page+pageSize: caller wants exactly that one page (a UI listing).
  if (page && pageSize) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let dbQuery: any = supabase.from("affiliates").select(affiliateListSelect).order("last_names", { ascending: true });
    dbQuery = applyAffiliateFilters(dbQuery, filters);
    dbQuery = dbQuery.range((page - 1) * pageSize, page * pageSize - 1);

    const { data, error } = await dbQuery;
    if (error) throw new Error(`No fue posible cargar afiliados: ${error.message}`);
    return ((data ?? []) as Record<string, unknown>[]).map(mapAffiliateRow);
  }

  // No pagination requested: caller wants every matching row (search, CSV export).
  const rows: Record<string, unknown>[] = [];
  for (let batch = 0; ; batch += 1) {
    const from = batch * INTERNAL_FETCH_ALL_PAGE_SIZE;
    const to = from + INTERNAL_FETCH_ALL_PAGE_SIZE - 1;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let dbQuery: any = supabase.from("affiliates").select(affiliateListSelect).order("last_names", { ascending: true });
    dbQuery = applyAffiliateFilters(dbQuery, filters).range(from, to);

    const { data, error } = await dbQuery;
    if (error) throw new Error(`No fue posible cargar afiliados: ${error.message}`);

    const chunk = (data ?? []) as Record<string, unknown>[];
    rows.push(...chunk);
    if (chunk.length < INTERNAL_FETCH_ALL_PAGE_SIZE) break;
  }

  return rows.map(mapAffiliateRow);
}

export async function countAffiliates(filters: AffiliateFilters = {}): Promise<number> {
  if (!isSupabaseConfigured()) {
    return (await listAffiliates(filters)).length;
  }

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let dbQuery: any = supabase
    .from("affiliates")
    .select(`id,
      succession_as_deceased:affiliate_successions!affiliate_successions_deceased_affiliate_id_fkey(id, annulled_at),
      succession_as_successor:affiliate_successions!affiliate_successions_successor_affiliate_id_fkey(id, annulled_at)`, { count: "exact", head: true });
  dbQuery = applyAffiliateFilters(dbQuery, filters);

  const { count, error } = await dbQuery;
  if (error) throw new Error(`No fue posible contar afiliados: ${error.message}`);
  return count ?? 0;
}

export const getAffiliateById = cache(async (id: string): Promise<Affiliate | null> => {
  if (!isSupabaseConfigured()) {
    const affiliates = await getAllAffiliates();
    return affiliates.find((affiliate) => affiliate.id === id) ?? null;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("affiliates")
    .select(affiliateSelect)
    .eq("id", id)
    .order("period_start", { foreignTable: "payments", ascending: false })
    .maybeSingle();

  if (error) throw new Error(`No fue posible cargar el afiliado: ${error.message}`);
  return data ? mapAffiliateRow(data as unknown as Record<string, unknown>) : null;
});

export const getBeneficiary = cache(async (affiliateId: string, beneficiaryId: string) => {
  const affiliate = await getAffiliateById(affiliateId);
  const beneficiary = affiliate?.beneficiaries.find((entry) => entry.id === beneficiaryId) ?? null;

  return affiliate && beneficiary ? { affiliate, beneficiary } : null;
});

export async function searchAffiliates(query: string) {
  if (!query.trim()) return [];
  return listAffiliates({ query });
}

export type PaymentRecord = Payment & {
  affiliateId: string;
  affiliateName: string;
  affiliateDocument: string;
};

export type PaymentFilters = {
  query?: string;
  period?: string | "all";
  /** Period range [from, to), YYYY-MM-01. */
  periodFrom?: string;
  periodTo?: string;
  paymentMethodId?: string | "all";
  source?: AffiliationSource | "all";
  status?: PaymentStatus | "all";
  page?: number;
  pageSize?: number;
};

async function allPaymentRecords(): Promise<PaymentRecord[]> {
  const affiliates = await getAllAffiliates();
  return affiliates.flatMap((affiliate) => affiliate.payments.map((payment) => ({
    ...payment,
    affiliateId: affiliate.id,
    affiliateName: getFullName(affiliate),
    affiliateDocument: `${affiliate.documentType} ${affiliate.documentNumber}`,
  })));
}

function mapPaymentListRow(row: Record<string, unknown>): PaymentRecord {
  const affiliate = row.affiliate as Record<string, unknown>;
  return {
    ...mapPaymentRow(row),
    affiliateId: affiliate.id as string,
    affiliateName: `${affiliate.first_names as string} ${affiliate.last_names as string}`,
    affiliateDocument: `${affiliate.document_type as string} ${affiliate.document_number as string}`,
  };
}

const paymentListSelect = `
  id, period_start, paid_on, amount, source, status, observations, support_document_id, receipt_id,
  payment_method:payment_methods(name), receipt:payment_receipts(receipt_number),
  affiliate:affiliates!inner(id, first_names, last_names, document_type, document_number)
`;

export async function listPayments(filters: PaymentFilters = {}): Promise<PaymentRecord[]> {
  const { query = "", period = "all", source = "all", status = "all", page, pageSize } = filters;

  if (!isSupabaseConfigured()) {
    const records = await allPaymentRecords();
    return records
      .filter((record) => {
        const queryMatches = !query || normalize(`${record.affiliateName} ${record.affiliateDocument}`).includes(normalize(query));
        const periodMatches = period === "all" || record.period === period;
        const sourceMatches = source === "all" || record.source === source;
        const statusMatches = status === "all" || record.status === status;

        return queryMatches && periodMatches && sourceMatches && statusMatches;
      })
      .sort((a, b) => ((a.paidOn ?? a.period) < (b.paidOn ?? b.period) ? 1 : -1));
  }

  const supabase = await createClient();

  function buildQuery() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q: any = supabase
      .from("payments")
      .select(paymentListSelect)
      .order("paid_on", { ascending: false, nullsFirst: false });

    if (status !== "all") q = q.eq("status", status);
    if (source !== "all") q = q.eq("source", source);
    if (period !== "all") q = q.eq("period_start", `${period}-01`);
    q = applyDateRange(q, "period_start", filters.periodFrom, filters.periodTo);
    if (filters.paymentMethodId && filters.paymentMethodId !== "all") q = q.eq("payment_method_id", filters.paymentMethodId);
    if (query.trim()) {
      const like = `%${query.trim()}%`;
      q = q.or(`first_names.ilike.${like},last_names.ilike.${like},document_number.ilike.${like}`, { foreignTable: "affiliates" });
    }
    return q;
  }

  if (page && pageSize) {
    const { data, error } = await buildQuery().range((page - 1) * pageSize, page * pageSize - 1);
    if (error) throw new Error(`No fue posible cargar pagos: ${error.message}`);
    return ((data ?? []) as Record<string, unknown>[]).map(mapPaymentListRow);
  }

  const rows: Record<string, unknown>[] = [];
  for (let batch = 0; ; batch += 1) {
    const from = batch * INTERNAL_FETCH_ALL_PAGE_SIZE;
    const to = from + INTERNAL_FETCH_ALL_PAGE_SIZE - 1;
    const { data, error } = await buildQuery().range(from, to);
    if (error) throw new Error(`No fue posible cargar pagos: ${error.message}`);

    const chunk = (data ?? []) as Record<string, unknown>[];
    rows.push(...chunk);
    if (chunk.length < INTERNAL_FETCH_ALL_PAGE_SIZE) break;
  }

  return rows.map(mapPaymentListRow);
}

export async function countPayments(filters: PaymentFilters = {}): Promise<number> {
  const { query = "", period = "all", source = "all", status = "all" } = filters;

  if (!isSupabaseConfigured()) {
    return (await listPayments(filters)).length;
  }

  const supabase = await createClient();
  let q = supabase
    .from("payments")
    .select("id, affiliates!inner(first_names,last_names,document_number)", { count: "exact", head: true });

  if (status !== "all") q = q.eq("status", status);
  if (source !== "all") q = q.eq("source", source);
  if (period !== "all") q = q.eq("period_start", `${period}-01`);
  q = applyDateRange(q, "period_start", filters.periodFrom, filters.periodTo);
  if (filters.paymentMethodId && filters.paymentMethodId !== "all") q = q.eq("payment_method_id", filters.paymentMethodId);
  if (query.trim()) {
    const like = `%${query.trim()}%`;
    q = q.or(`first_names.ilike.${like},last_names.ilike.${like},document_number.ilike.${like}`, { foreignTable: "affiliates" });
  }

  const { count, error } = await q;
  if (error) throw new Error(`No fue posible contar pagos: ${error.message}`);
  return count ?? 0;
}

export type PaymentTotals = { paid: number; pending: number; reversed: number; count: number };

export async function getPaymentTotals(): Promise<PaymentTotals> {
  if (!isSupabaseConfigured()) {
    const records = await allPaymentRecords();
    return {
      paid: records.filter((r) => r.status === "paid").reduce((sum, r) => sum + r.amount, 0),
      pending: records.filter((r) => r.status === "pending").reduce((sum, r) => sum + r.amount, 0),
      reversed: records.filter((r) => r.status === "reversed").reduce((sum, r) => sum + r.amount, 0),
      count: records.length,
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_payment_totals");
  if (error) throw new Error(`No fue posible calcular los totales de pagos: ${error.message}`);
  return data as PaymentTotals;
}

export async function listPaymentPeriods(): Promise<string[]> {
  if (!isSupabaseConfigured()) {
    const affiliates = await getAllAffiliates();
    const periods = new Set(affiliates.flatMap((affiliate) => affiliate.payments.map((payment) => payment.period)));
    return Array.from(periods).sort((a, b) => (a < b ? 1 : -1));
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_payment_periods");
  if (error) throw new Error(`No fue posible cargar los periodos de pago: ${error.message}`);
  return ((data ?? []) as string[]).map((period) => period.slice(0, 7));
}

export type CreditRecord = Credit & {
  affiliateId: string;
  affiliateName: string;
  affiliateDocument: string;
};

export type CreditFilters = {
  query?: string;
  status?: CreditStatus | "all";
  /** Request date range [from, to), YYYY-MM-DD. */
  requestedFrom?: string;
  requestedTo?: string;
  /** issued: has a paz y salvo · none: does not. */
  clearance?: "all" | "issued" | "none";
  page?: number;
  pageSize?: number;
};

function mapCreditListRow(row: Record<string, unknown>): CreditRecord {
  const affiliate = row.affiliate as Record<string, unknown>;
  return {
    ...mapCreditRow(row),
    affiliateId: affiliate.id as string,
    affiliateName: `${affiliate.first_names as string} ${affiliate.last_names as string}`,
    affiliateDocument: `${affiliate.document_type as string} ${affiliate.document_number as string}`,
  };
}

const creditListSelect = `
  id, previous_credit_id, disbursed_amount, rolled_over_capital, rolled_over_interest,
  principal_base, interest_rate, term_months, interest_amount, total_amount, installment_amount,
  status, requested_on, observations,
  credit_clearances(id, clearance_number, issued_on),
  credit_installments(id, paid_on, amount, capital_portion, interest_portion, observation,
      receipt_number, support_document_id, payment_method:payment_methods(name)),
  affiliate:affiliates!credits_affiliate_id_fkey!inner(id, first_names, last_names, document_type, document_number)
`;

async function allCreditRecords(): Promise<CreditRecord[]> {
  const affiliates = await getAllAffiliates();
  return affiliates.flatMap((affiliate) => (affiliate.credits ?? []).map((credit) => ({
    ...credit,
    affiliateId: affiliate.id,
    affiliateName: getFullName(affiliate),
    affiliateDocument: `${affiliate.documentType} ${affiliate.documentNumber}`,
  })));
}

export async function listCredits(filters: CreditFilters = {}): Promise<CreditRecord[]> {
  const { query = "", status = "all", page, pageSize } = filters;

  if (!isSupabaseConfigured()) {
    const records = await allCreditRecords();
    return records
      .filter((record) => {
        const queryMatches = !query || normalize(`${record.affiliateName} ${record.affiliateDocument}`).includes(normalize(query));
        const statusMatches = status === "all" || record.status === status;
        return queryMatches && statusMatches;
      })
      .sort((a, b) => (a.requestedOn < b.requestedOn ? 1 : -1));
  }

  const supabase = await createClient();

  function buildQuery() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q: any = supabase
      .from("credits")
      .select(creditListSelect)
      .order("requested_on", { ascending: false });

    if (status !== "all") q = q.eq("status", status);
    q = applyCreditReportFilters(q, filters);
    if (query.trim()) {
      const like = `%${query.trim()}%`;
      q = q.or(`first_names.ilike.${like},last_names.ilike.${like},document_number.ilike.${like}`, { foreignTable: "affiliates" });
    }
    return q;
  }

  if (page && pageSize) {
    const { data, error } = await buildQuery().range((page - 1) * pageSize, page * pageSize - 1);
    if (error) throw new Error(`No fue posible cargar créditos: ${error.message}`);
    return ((data ?? []) as Record<string, unknown>[]).map(mapCreditListRow);
  }

  const rows: Record<string, unknown>[] = [];
  for (let batch = 0; ; batch += 1) {
    const from = batch * INTERNAL_FETCH_ALL_PAGE_SIZE;
    const to = from + INTERNAL_FETCH_ALL_PAGE_SIZE - 1;
    const { data, error } = await buildQuery().range(from, to);
    if (error) throw new Error(`No fue posible cargar créditos: ${error.message}`);

    const chunk = (data ?? []) as Record<string, unknown>[];
    rows.push(...chunk);
    if (chunk.length < INTERNAL_FETCH_ALL_PAGE_SIZE) break;
  }

  return rows.map(mapCreditListRow);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyCreditReportFilters(query: any, filters: CreditFilters): any {
  let q = applyDateRange(query, "requested_on", filters.requestedFrom, filters.requestedTo);
  // The clearance is embedded in the select: filtering on the embed keeps or drops the credit.
  if (filters.clearance === "issued") q = q.not("credit_clearances", "is", null);
  else if (filters.clearance === "none") q = q.is("credit_clearances", null);
  return q;
}

export async function countCredits(filters: CreditFilters = {}): Promise<number> {
  const { query = "", status = "all" } = filters;

  if (!isSupabaseConfigured()) {
    return (await listCredits(filters)).length;
  }

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q: any = supabase
    .from("credits")
    .select("id, credit_clearances(id), affiliates!credits_affiliate_id_fkey!inner(first_names,last_names,document_number)", { count: "exact", head: true });

  if (status !== "all") q = q.eq("status", status);
  q = applyCreditReportFilters(q, filters);
  if (query.trim()) {
    const like = `%${query.trim()}%`;
    q = q.or(`first_names.ilike.${like},last_names.ilike.${like},document_number.ilike.${like}`, { foreignTable: "affiliates" });
  }

  const { count, error } = await q;
  if (error) throw new Error(`No fue posible contar créditos: ${error.message}`);
  return count ?? 0;
}

export type ApplyImportRow = { affiliateId: string; amount: number; observation: string | null };

export type ApplyImportResult = {
  batchId: string;
  submitted: number;
  inserted: number;
  skippedAsDuplicate: number;
  totalAmount: number;
};

export async function applyPaymentImport(params: {
  source: AffiliationSource;
  periodStart: string;
  periodEnd: string;
  originalFilename: string | null;
  rows: ApplyImportRow[];
}): Promise<ApplyImportResult> {
  if (!isSupabaseConfigured()) {
    throw new Error("La aplicación de lotes requiere una conexión activa a Supabase.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("apply_payment_import", {
    p_source: params.source,
    p_period_start: params.periodStart,
    p_period_end: params.periodEnd,
    p_original_filename: params.originalFilename,
    p_rows: params.rows,
  });

  if (error) throw new Error(`No fue posible aplicar el lote: ${error.message}`);
  return data as ApplyImportResult;
}

export type DocumentRecord = MemberDocument & {
  affiliateId: string;
  affiliateName: string;
  affiliateDocument: string;
  /** Set when the file belongs to a beneficiary of the titular. */
  beneficiaryId: string | null;
  beneficiaryName: string | null;
  beneficiaryRelationship: string | null;
};

export type DocumentFilters = {
  query?: string;
  kind?: MemberDocument["kind"] | "all";
};

function mapDocumentListRow(row: Record<string, unknown>): DocumentRecord {
  const beneficiaryId = (row.beneficiary_id as string | null) ?? null;
  return {
    ...mapDocumentRow(row),
    affiliateId: row.affiliate_id as string,
    affiliateName: `${row.affiliate_first_names as string} ${row.affiliate_last_names as string}`,
    affiliateDocument: `${row.affiliate_document_type as string} ${row.affiliate_document_number as string}`,
    beneficiaryId,
    beneficiaryName: beneficiaryId ? `${row.beneficiary_first_names as string} ${row.beneficiary_last_names as string}`.trim() : null,
    beneficiaryRelationship: (row.beneficiary_relationship as string | null) ?? null,
  };
}

export async function listDocuments(filters: DocumentFilters = {}): Promise<DocumentRecord[]> {
  const { query = "", kind = "all" } = filters;

  if (!isSupabaseConfigured()) {
    const affiliates = await getAllAffiliates();
    const records: DocumentRecord[] = affiliates.flatMap((affiliate) => {
      const owner = { affiliateId: affiliate.id, affiliateName: getFullName(affiliate), affiliateDocument: `${affiliate.documentType} ${affiliate.documentNumber}` };
      return [
        ...affiliate.documents.map((document) => ({ ...document, ...owner, beneficiaryId: null, beneficiaryName: null, beneficiaryRelationship: null })),
        ...affiliate.beneficiaries.flatMap((beneficiary) => (beneficiary.documents ?? []).map((document) => ({
          ...document,
          ...owner,
          beneficiaryId: beneficiary.id,
          beneficiaryName: getFullName(beneficiary),
          beneficiaryRelationship: beneficiary.relationship,
        }))),
      ];
    });

    return records
      .filter((record) => {
        const queryMatches = !query || normalize(`${record.affiliateName} ${record.affiliateDocument} ${record.beneficiaryName ?? ""} ${record.title}`).includes(normalize(query));
        const kindMatches = kind === "all" || record.kind === kind;

        return queryMatches && kindMatches;
      })
      .sort((a, b) => (a.uploadedOn < b.uploadedOn ? 1 : -1));
  }

  const supabase = await createClient();
  // The view resolves each file's titular, also for beneficiary files, and one search text for both people.
  let q = supabase
    .from("member_document_directory")
    .select(`
      id, kind, title, uploaded_at, size_bytes, storage_path, mime_type,
      affiliate_id, affiliate_first_names, affiliate_last_names, affiliate_document_type, affiliate_document_number,
      beneficiary_id, beneficiary_first_names, beneficiary_last_names, beneficiary_relationship
    `)
    .order("uploaded_at", { ascending: false })
    .limit(500);

  if (kind !== "all") q = q.eq("kind", kind);
  if (query.trim()) q = q.ilike("search_text", `%${query.trim()}%`);

  const { data, error } = await q;
  if (error) throw new Error(`No fue posible cargar documentos: ${error.message}`);

  return ((data ?? []) as unknown as Record<string, unknown>[]).map(mapDocumentListRow);
}

export type BeneficiaryRecord = Beneficiary & {
  affiliateId: string;
  affiliateName: string;
  affiliateDocument: string;
};

export type BeneficiaryDirectoryFilters = {
  query?: string;
  status?: AffiliateStatus | "all";
  excludeDeceased?: boolean;
  coverage?: AffiliateFilters["coverage"];
  /** Join date range [from, to), YYYY-MM-DD. */
  joinedFrom?: string;
  joinedTo?: string;
  /** Case-insensitive exact relationship (the data mixes "HIJO" and "Hijo"). */
  relationship?: string;
  page?: number;
  pageSize?: number;
};

function mapBeneficiaryListRow(row: Record<string, unknown>): BeneficiaryRecord {
  const affiliate = row.affiliate as Record<string, unknown>;
  return {
    ...mapBeneficiaryRow(row),
    affiliateId: affiliate.id as string,
    affiliateName: `${affiliate.first_names as string} ${affiliate.last_names as string}`,
    affiliateDocument: `${affiliate.document_type as string} ${affiliate.document_number as string}`,
  };
}

const beneficiaryListSelect = `
  id, relationship, document_type, document_number, document_issued_on, first_names, last_names,
  birth_date, phone, email, status, joined_on, full_coverage_on, deceased_at, internal_notes,
  inherited_from_affiliate_id, promoted_to_affiliate_id,
  inherited_from:affiliates!beneficiaries_inherited_from_affiliate_id_fkey(first_names, last_names),
  affiliate:affiliates!beneficiaries_affiliate_id_fkey!inner(id, first_names, last_names, document_type, document_number)
`;

export async function listBeneficiaries(filters: BeneficiaryDirectoryFilters = {}): Promise<BeneficiaryRecord[]> {
  const { query = "", status = "all", excludeDeceased = false, coverage = "all", page, pageSize } = filters;

  if (!isSupabaseConfigured()) {
    const affiliates = await getAllAffiliates();
    const records: BeneficiaryRecord[] = affiliates.flatMap((affiliate) => affiliate.beneficiaries.map((beneficiary) => ({
      ...beneficiary,
      affiliateId: affiliate.id,
      affiliateName: getFullName(affiliate),
      affiliateDocument: `${affiliate.documentType} ${affiliate.documentNumber}`,
    })));

    return records
      .filter((record) => {
        const queryMatches = !query || normalize(`${record.firstNames} ${record.lastNames} ${record.documentNumber ?? ""} ${record.affiliateName}`).includes(normalize(query));
        const statusMatches = status === "all" || record.status === status;
        const deceasedMatches = status !== "all" || !excludeDeceased || record.status !== "deceased";
        const coverageMatches = coverage === "all" || getCoverageState(record) === coverage;

        return queryMatches && statusMatches && deceasedMatches && coverageMatches;
      })
      .sort((a, b) => (a.lastNames < b.lastNames ? -1 : 1));
  }

  const supabase = await createClient();

  function buildQuery() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q: any = supabase.from("beneficiaries").select(beneficiaryListSelect).order("last_names", { ascending: true });
    if (status !== "all") q = q.eq("status", status);
    else if (excludeDeceased) q = q.neq("status", "deceased");
    // A beneficiary promoted to titular by a succession is counted as titular now.
    if (excludeDeceased) q = q.is("promoted_to_affiliate_id", null);
    q = applyCoverageFilter(q, coverage);
    q = applyBeneficiaryReportFilters(q, filters);
    if (query.trim()) {
      const like = `%${query.trim()}%`;
      q = q.or(`first_names.ilike.${like},last_names.ilike.${like},document_number.ilike.${like}`);
    }
    return q;
  }

  if (page && pageSize) {
    const { data, error } = await buildQuery().range((page - 1) * pageSize, page * pageSize - 1);
    if (error) throw new Error(`No fue posible cargar beneficiarios: ${error.message}`);
    return ((data ?? []) as Record<string, unknown>[]).map(mapBeneficiaryListRow);
  }

  const rows: Record<string, unknown>[] = [];
  for (let batch = 0; ; batch += 1) {
    const from = batch * INTERNAL_FETCH_ALL_PAGE_SIZE;
    const to = from + INTERNAL_FETCH_ALL_PAGE_SIZE - 1;
    const { data, error } = await buildQuery().range(from, to);
    if (error) throw new Error(`No fue posible cargar beneficiarios: ${error.message}`);

    const chunk = (data ?? []) as Record<string, unknown>[];
    rows.push(...chunk);
    if (chunk.length < INTERNAL_FETCH_ALL_PAGE_SIZE) break;
  }

  return rows.map(mapBeneficiaryListRow);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyBeneficiaryReportFilters(query: any, filters: BeneficiaryDirectoryFilters): any {
  let q = applyDateRange(query, "joined_on", filters.joinedFrom, filters.joinedTo);
  if (filters.relationship?.trim()) q = q.ilike("relationship", filters.relationship.trim());
  return q;
}

export async function countBeneficiaries(filters: BeneficiaryDirectoryFilters = {}): Promise<number> {
  const { query = "", status = "all", excludeDeceased = false, coverage = "all" } = filters;

  if (!isSupabaseConfigured()) {
    return (await listBeneficiaries(filters)).length;
  }

  const supabase = await createClient();
  let q = supabase
    .from("beneficiaries")
    .select("id, affiliates!beneficiaries_affiliate_id_fkey!inner(first_names,last_names,document_number)", { count: "exact", head: true });

  if (status !== "all") q = q.eq("status", status);
  else if (excludeDeceased) q = q.neq("status", "deceased");
  if (excludeDeceased) q = q.is("promoted_to_affiliate_id", null);
  q = applyCoverageFilter(q, coverage);
  q = applyBeneficiaryReportFilters(q, filters);
  if (query.trim()) {
    const like = `%${query.trim()}%`;
    q = q.or(`first_names.ilike.${like},last_names.ilike.${like},document_number.ilike.${like}`);
  }

  const { count, error } = await q;
  if (error) throw new Error(`No fue posible contar beneficiarios: ${error.message}`);
  return count ?? 0;
}

export type DashboardSummary = {
  operationalTotal: number;
  holderStatusCounts: Record<AffiliateStatus, number>;
  /** Deceased titulars without a current succession (Supabase only). */
  pendingSuccessionCount?: number;
  waitingCoverageCount: number;
  upcomingCoverageCount: number;
  beneficiaryStatusCounts: Record<AffiliateStatus, number>;
  monthlyPayments: { period: string; amount: number }[];
  totalCollected: number;
  collectedChangePercent: number | null;
  sourceDistribution: { source: AffiliationSource; count: number }[];
  recentPayments: { affiliateId: string; affiliateName: string; period: string; amount: number; paidOn: string }[];
  moraAlerts: { affiliateId: string; affiliateName: string; status: AffiliateStatus; lastPaymentOn: string | null }[];
};

function isWithinNextDays(isoDate: string, days: number) {
  const target = new Date(`${isoDate}T23:59:59Z`).getTime();
  const diff = target - demoReferenceDate;
  return diff >= 0 && diff <= days * 24 * 60 * 60 * 1000;
}

export const getDashboardSummary = cache(async (): Promise<DashboardSummary> => {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("get_dashboard_summary");
    if (error) throw new Error(`No fue posible calcular el resumen: ${error.message}`);
    return data as DashboardSummary;
  }

  return computeDashboardSummaryFromDemoData();
});

async function computeDashboardSummaryFromDemoData(): Promise<DashboardSummary> {
  const affiliates = await getAllAffiliates();
  const emptyStatusCounts = (): Record<AffiliateStatus, number> => ({ active: 0, inactive: 0, suspended: 0, deceased: 0 });

  const holderStatusCounts = emptyStatusCounts();
  const beneficiaryStatusCounts = emptyStatusCounts();
  let waitingCoverageCount = 0;
  let upcomingCoverageCount = 0;

  const paymentsByPeriod = new Map<string, number>();
  const recentPayments: DashboardSummary["recentPayments"] = [];
  const sourceCounts = new Map<AffiliationSource, number>();

  for (const affiliate of affiliates) {
    holderStatusCounts[affiliate.status] += 1;

    if (affiliate.status === "active") {
      sourceCounts.set(affiliate.source, (sourceCounts.get(affiliate.source) ?? 0) + 1);
      if (getCoverageState(affiliate) === "waiting") {
        waitingCoverageCount += 1;
        if (isWithinNextDays(affiliate.fullCoverageOn, 30)) upcomingCoverageCount += 1;
      }
    }

    for (const beneficiary of affiliate.beneficiaries) {
      beneficiaryStatusCounts[beneficiary.status] += 1;
    }

    for (const payment of affiliate.payments) {
      if (payment.status !== "paid" || !payment.paidOn) continue;
      paymentsByPeriod.set(payment.period, (paymentsByPeriod.get(payment.period) ?? 0) + payment.amount);
      recentPayments.push({
        affiliateId: affiliate.id,
        affiliateName: getFullName(affiliate),
        period: payment.period,
        amount: payment.amount,
        paidOn: payment.paidOn,
      });
    }
  }

  const monthlyPayments = Array.from(paymentsByPeriod.entries())
    .sort(([periodA], [periodB]) => (periodA < periodB ? -1 : 1))
    .slice(-7)
    .map(([period, amount]) => ({ period, amount }));

  const totalCollected = monthlyPayments.reduce((sum, entry) => sum + entry.amount, 0);
  const previousMonth = monthlyPayments.at(-2);
  const lastMonth = monthlyPayments.at(-1);
  const collectedChangePercent = previousMonth && lastMonth && previousMonth.amount > 0
    ? Math.round(((lastMonth.amount - previousMonth.amount) / previousMonth.amount) * 1000) / 10
    : null;

  const moraAlerts = affiliates
    .filter((affiliate) => affiliate.status === "inactive" || affiliate.status === "suspended")
    .sort((a, b) => (a.lastPaymentOn ?? "") < (b.lastPaymentOn ?? "") ? 1 : -1)
    .slice(0, 4)
    .map((affiliate) => ({
      affiliateId: affiliate.id,
      affiliateName: getFullName(affiliate),
      status: affiliate.status,
      lastPaymentOn: affiliate.lastPaymentOn,
    }));

  return {
    operationalTotal: affiliates.filter((affiliate) => affiliate.status !== "deceased").length,
    holderStatusCounts,
    waitingCoverageCount,
    upcomingCoverageCount,
    beneficiaryStatusCounts,
    monthlyPayments,
    totalCollected,
    collectedChangePercent,
    sourceDistribution: Array.from(sourceCounts.entries()).map(([source, count]) => ({ source, count })),
    recentPayments: recentPayments.sort((a, b) => (a.paidOn < b.paidOn ? 1 : -1)).slice(0, 4),
    moraAlerts,
  };
}
