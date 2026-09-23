import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export type MemberNote = {
  id: string;
  body: string;
  authorName: string | null;
  createdAt: string;
};

function mapNoteRow(row: Record<string, unknown>): MemberNote {
  const author = row.author as { display_name: string } | null;
  return {
    id: row.id as string,
    body: row.body as string,
    authorName: author?.display_name ?? null,
    createdAt: row.created_at as string,
  };
}

async function listNotes(filter: { affiliateId?: string; beneficiaryId?: string }): Promise<MemberNote[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();
  let query = supabase
    .from("member_notes")
    .select("id, body, created_at, author:profiles(display_name)")
    .order("created_at", { ascending: false });

  if (filter.affiliateId) query = query.eq("affiliate_id", filter.affiliateId);
  if (filter.beneficiaryId) query = query.eq("beneficiary_id", filter.beneficiaryId);

  const { data, error } = await query;
  if (error) throw new Error(`No fue posible cargar las observaciones: ${error.message}`);
  return ((data ?? []) as unknown as Record<string, unknown>[]).map(mapNoteRow);
}

export async function listAffiliateNotes(affiliateId: string): Promise<MemberNote[]> {
  return listNotes({ affiliateId });
}

export async function listBeneficiaryNotes(beneficiaryId: string): Promise<MemberNote[]> {
  return listNotes({ beneficiaryId });
}
