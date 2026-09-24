import { cache } from "react";

import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

import type { CreditDecision, Succession, SuccessorOrigin } from "./types";

const successionSelect = `
  id, deceased_affiliate_id, successor_affiliate_id, successor_name, successor_document, successor_origin,
  successor_created, succession_date, resolution_number, credit_id, credit_decision, transferred_beneficiaries,
  support_document_id, notes, created_at, annulled_at, annul_reason,
  deceased:affiliates!affiliate_successions_deceased_affiliate_id_fkey(first_names, last_names, document_type, document_number, deceased_at),
  creator:profiles!affiliate_successions_created_by_fkey(display_name),
  annuller:profiles!affiliate_successions_annulled_by_fkey(display_name)
`;

function mapSuccession(row: Record<string, unknown>): Succession {
  const deceased = row.deceased as Record<string, string | null> | null;
  return {
    id: row.id as string,
    deceasedId: row.deceased_affiliate_id as string,
    deceasedName: deceased ? `${deceased.first_names} ${deceased.last_names}`.trim() : "Sin nombre registrado",
    deceasedDocument: deceased ? `${deceased.document_type} ${deceased.document_number}` : "",
    deceasedOn: deceased?.deceased_at ? String(deceased.deceased_at).slice(0, 10) : null,
    successorId: (row.successor_affiliate_id as string | null) ?? null,
    successorName: row.successor_name as string,
    successorDocument: row.successor_document as string,
    origin: row.successor_origin as SuccessorOrigin,
    successorCreated: Boolean(row.successor_created),
    successionDate: row.succession_date as string,
    resolutionNumber: (row.resolution_number as string | null) ?? null,
    creditId: (row.credit_id as string | null) ?? null,
    creditDecision: row.credit_decision as CreditDecision,
    transferredBeneficiaries: Number(row.transferred_beneficiaries ?? 0),
    supportDocumentId: (row.support_document_id as string | null) ?? null,
    notes: (row.notes as string | null) ?? null,
    createdAt: row.created_at as string,
    createdByName: (row.creator as { display_name?: string } | null)?.display_name ?? null,
    annulledAt: (row.annulled_at as string | null) ?? null,
    annulledByName: (row.annuller as { display_name?: string } | null)?.display_name ?? null,
    annulReason: (row.annul_reason as string | null) ?? null,
  };
}

export type AffiliateSuccessions = {
  /** Current succession where this affiliate is the deceased. */
  asDeceased: Succession | null;
  /** Current successions where this affiliate is the successor (one per deceased). */
  asSuccessor: Succession[];
  /** Annulled successions of this deceased, newest first. */
  annulled: Succession[];
};

export const getAffiliateSuccessions = cache(async (affiliateId: string): Promise<AffiliateSuccessions> => {
  const empty: AffiliateSuccessions = { asDeceased: null, asSuccessor: [], annulled: [] };
  if (!isSupabaseConfigured()) return empty;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("affiliate_successions")
    .select(successionSelect)
    .or(`deceased_affiliate_id.eq.${affiliateId},successor_affiliate_id.eq.${affiliateId}`)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`No fue posible cargar la sucesión: ${error.message}`);

  const rows = ((data ?? []) as Record<string, unknown>[]).map(mapSuccession);
  return {
    asDeceased: rows.find((row) => row.deceasedId === affiliateId && !row.annulledAt) ?? null,
    asSuccessor: rows.filter((row) => row.successorId === affiliateId && !row.annulledAt),
    annulled: rows.filter((row) => row.deceasedId === affiliateId && row.annulledAt),
  };
});

export async function getSuccession(successionId: string): Promise<Succession | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.from("affiliate_successions").select(successionSelect).eq("id", successionId).maybeSingle();
  if (error || !data) return null;
  return mapSuccession(data as Record<string, unknown>);
}

export async function isAdministrator(): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("is_administrator");
  return !error && Boolean(data);
}
