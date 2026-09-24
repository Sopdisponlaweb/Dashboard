import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

/** Identity left behind by a titular (or one of its beneficiaries) archived after retiring. */
export type ArchivedMember = {
  id: string;
  personType: "titular" | "beneficiario";
  documentType: string | null;
  documentNumber: string | null;
  name: string;
  relationship: string | null;
  titularDocumentNumber: string | null;
  titularName: string | null;
  lastPaymentOn: string | null;
  joinedOn: string | null;
  legacyMemberId: string | null;
  paymentsCount: number;
  archivedAt: string;
};

export type ArchivePreview = {
  cutoff: string;
  titulares: number;
  beneficiarios: number;
  pagos: number;
  notas: number;
  eventos: number;
  omitidos: number;
};

const select = `id, person_type, document_type, document_number, first_names, last_names, relationship,
  titular_document_number, titular_name, last_payment_on, joined_on, legacy_member_id, payments_count, archived_at`;

function mapRow(row: Record<string, unknown>): ArchivedMember {
  return {
    id: row.id as string,
    personType: row.person_type as ArchivedMember["personType"],
    documentType: (row.document_type as string | null) ?? null,
    documentNumber: (row.document_number as string | null) || null,
    name: `${(row.first_names as string) ?? ""} ${(row.last_names as string) ?? ""}`.trim() || "Sin nombre registrado",
    relationship: (row.relationship as string | null) ?? null,
    titularDocumentNumber: (row.titular_document_number as string | null) ?? null,
    titularName: (row.titular_name as string | null) ?? null,
    lastPaymentOn: (row.last_payment_on as string | null) ?? null,
    joinedOn: (row.joined_on as string | null) ?? null,
    legacyMemberId: (row.legacy_member_id as string | null) ?? null,
    paymentsCount: Number(row.payments_count ?? 0),
    archivedAt: row.archived_at as string,
  };
}

/**
 * A query that is mostly digits is a cédula: match it exactly (dots and spaces removed), as a
 * person's own document or as the titular of an archived beneficiary. Otherwise match the name.
 */
function searchFilter(query: string) {
  const trimmed = query.trim();
  const digits = trimmed.replace(/[^\d]/g, "");
  if (digits.length >= 5 && digits.length >= trimmed.replace(/[\s.]/g, "").length - 1) {
    return { kind: "document" as const, value: digits };
  }
  return { kind: "text" as const, value: trimmed.toLowerCase().replace(/[%_,()]/g, " ").replace(/\s+/g, " ").trim() };
}

/** Archived people matching a search, titulars first. Empty for short or empty queries. */
export async function searchArchivedMembers(query: string, limit = 5): Promise<ArchivedMember[]> {
  if (!isSupabaseConfigured() || query.trim().length < 3) return [];
  const filter = searchFilter(query);
  if (!filter.value) return [];

  const supabase = await createClient();
  let q = supabase.from("archived_members").select(select).order("person_type", { ascending: false }).limit(limit);
  q = filter.kind === "document"
    ? q.or(`document_number.eq.${filter.value},titular_document_number.eq.${filter.value}`)
    : q.ilike("search_text", `%${filter.value}%`);

  const { data, error } = await q;
  if (error) throw new Error(`No fue posible consultar el archivo de retirados: ${error.message}`);
  return ((data ?? []) as Record<string, unknown>[]).map(mapRow);
}

/** How many archived beneficiaries belonged to this archived titular. */
export async function countArchivedBeneficiaries(titularDocumentNumber: string) {
  if (!isSupabaseConfigured()) return 0;
  const supabase = await createClient();
  const { count } = await supabase
    .from("archived_members")
    .select("id", { count: "exact", head: true })
    .eq("person_type", "beneficiario")
    .eq("titular_document_number", titularDocumentNumber);
  return count ?? 0;
}

export async function listArchivedMembers({ query = "", personType = "all", page = 1, pageSize = 50 }: {
  query?: string;
  personType?: "all" | "titular" | "beneficiario";
  page?: number;
  pageSize?: number;
}) {
  if (!isSupabaseConfigured()) return { records: [] as ArchivedMember[], totalCount: 0 };

  const supabase = await createClient();
  let q = supabase
    .from("archived_members")
    .select(select, { count: "exact" })
    .order("last_names", { ascending: true })
    .order("first_names", { ascending: true });
  if (personType !== "all") q = q.eq("person_type", personType);
  if (query.trim()) {
    const filter = searchFilter(query);
    q = filter.kind === "document"
      ? q.or(`document_number.eq.${filter.value},titular_document_number.eq.${filter.value}`)
      : q.ilike("search_text", `%${filter.value}%`);
  }

  const { data, error, count } = await q.range((page - 1) * pageSize, page * pageSize - 1);
  if (error) throw new Error(`No fue posible cargar el archivo de retirados: ${error.message}`);
  return { records: ((data ?? []) as Record<string, unknown>[]).map(mapRow), totalCount: count ?? 0 };
}

export async function getArchiveStats() {
  if (!isSupabaseConfigured()) return { titulares: 0, beneficiarios: 0, lastArchivedAt: null as string | null };

  const supabase = await createClient();
  const count = (personType: string) =>
    supabase.from("archived_members").select("id", { count: "exact", head: true }).eq("person_type", personType);
  const [titulares, beneficiarios, last] = await Promise.all([
    count("titular"),
    count("beneficiario"),
    supabase.from("archived_members").select("archived_at").order("archived_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  return {
    titulares: titulares.count ?? 0,
    beneficiarios: beneficiarios.count ?? 0,
    lastArchivedAt: (last.data?.archived_at as string | undefined) ?? null,
  };
}

/** Archived titulars among these document numbers (import preview: a payment for someone archived). */
export async function findArchivedTitulars(documentNumbers: string[]) {
  const found = new Map<string, ArchivedMember>();
  if (!isSupabaseConfigured() || !documentNumbers.length) return found;

  const supabase = await createClient();
  for (let start = 0; start < documentNumbers.length; start += 500) {
    const chunk = documentNumbers.slice(start, start + 500);
    const { data, error } = await supabase.from("archived_members").select(select).eq("person_type", "titular").in("document_number", chunk);
    if (error) throw new Error(`No fue posible consultar el archivo de retirados: ${error.message}`);
    for (const row of (data ?? []) as Record<string, unknown>[]) {
      const member = mapRow(row);
      if (member.documentNumber) found.set(member.documentNumber, member);
    }
  }
  return found;
}

/** What archiving would do right now (dry run). Null for users who are not administrators. */
export async function previewArchive(): Promise<ArchivePreview | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("archive_retired_affiliates", { p_apply: false });
  if (error) return null;
  const row = data as Record<string, unknown>;
  return {
    cutoff: row.cutoff as string,
    titulares: Number(row.titulares ?? 0),
    beneficiarios: Number(row.beneficiarios ?? 0),
    pagos: Number(row.pagos ?? 0),
    notas: Number(row.notas ?? 0),
    eventos: Number(row.eventos ?? 0),
    omitidos: Number(row.omitidos ?? 0),
  };
}

/** URL of the old platform, if configured, so the notice can link to it. */
export function legacyPlatformUrl() {
  return process.env.NEXT_PUBLIC_LEGACY_PLATFORM_URL?.trim() || null;
}
