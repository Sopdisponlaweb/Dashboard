import { affiliationSources } from "@/features/affiliates/format";
import type { AffiliationSource } from "@/features/affiliates/types";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export type Municipality = {
  id: string;
  daneCode: string | null;
  department: string;
  name: string;
  isActive: boolean;
};

export type OrganizationType = "company" | "compensation_fund" | "payer" | "other";

export type Organization = {
  id: string;
  name: string;
  organizationType: OrganizationType;
  isActive: boolean;
};

export const organizationTypeLabels: Record<OrganizationType, string> = {
  company: "Empresa",
  compensation_fund: "Caja de compensación",
  payer: "Tercero pagador",
  other: "Otro",
};

export async function listMunicipalities(): Promise<Municipality[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("municipalities")
    .select("id, dane_code, department, name, is_active")
    .order("department", { ascending: true })
    .order("name", { ascending: true });

  if (error) throw new Error(`No fue posible cargar los municipios: ${error.message}`);
  return (data ?? []).map((row) => ({
    id: row.id,
    daneCode: row.dane_code,
    department: row.department,
    name: row.name,
    isActive: row.is_active,
  }));
}

export async function listOrganizations(): Promise<Organization[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("organizations")
    .select("id, name, organization_type, is_active")
    .order("name", { ascending: true });

  if (error) throw new Error(`No fue posible cargar las entidades: ${error.message}`);
  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    organizationType: row.organization_type as OrganizationType,
    isActive: row.is_active,
  }));
}

export type PoliceRankCategory = "oficial_general" | "oficial_superior" | "oficial_subalterno" | "nivel_ejecutivo" | "historico";

export type PoliceRank = {
  id: string;
  name: string;
  abbreviation: string | null;
  category: PoliceRankCategory;
  sortOrder: number;
  isActive: boolean;
};

export const policeRankCategoryLabels: Record<PoliceRankCategory, string> = {
  oficial_general: "Oficial General",
  oficial_superior: "Oficial Superior",
  oficial_subalterno: "Oficial Subalterno",
  nivel_ejecutivo: "Nivel Ejecutivo",
  historico: "Histórico (fuera de uso)",
};

export async function listPoliceRanks(): Promise<PoliceRank[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("police_ranks")
    .select("id, name, abbreviation, category, sort_order, is_active")
    .order("sort_order", { ascending: true });

  if (error) throw new Error(`No fue posible cargar los rangos de policía: ${error.message}`);
  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    abbreviation: row.abbreviation,
    category: row.category as PoliceRankCategory,
    sortOrder: row.sort_order,
    isActive: row.is_active,
  }));
}

export type PaymentMethod = {
  id: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
};

export async function listPaymentMethods({ activeOnly = false } = {}): Promise<PaymentMethod[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();
  let query = supabase
    .from("payment_methods")
    .select("id, name, sort_order, is_active")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (activeOnly) query = query.eq("is_active", true);

  const { data, error } = await query;
  if (error) throw new Error(`No fue posible cargar los métodos de pago: ${error.message}`);
  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    sortOrder: row.sort_order,
    isActive: row.is_active,
  }));
}

export async function canManageSettings(): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("has_permission", { permission_key: "settings.manage" });
  if (error) return false;
  return Boolean(data);
}

export type AffiliationSourceUsage = { source: AffiliationSource; current: number; total: number };

/** Affiliates per affiliation type: current (not deceased) and all-time. */
export async function countAffiliatesBySource(): Promise<AffiliationSourceUsage[]> {
  if (!isSupabaseConfigured()) return affiliationSources.map((source) => ({ source, current: 0, total: 0 }));

  const supabase = await createClient();
  return Promise.all(affiliationSources.map(async (source) => {
    const [current, total] = await Promise.all([
      supabase.from("affiliates").select("id", { count: "exact", head: true }).eq("source", source).neq("status", "deceased"),
      supabase.from("affiliates").select("id", { count: "exact", head: true }).eq("source", source),
    ]);
    return { source, current: current.count ?? 0, total: total.count ?? 0 };
  }));
}
