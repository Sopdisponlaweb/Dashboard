"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

import type { CatalogFormState } from "./form-state";

async function requireSettingsManage() {
  const supabase = await createClient();
  const { data: claims, error } = await supabase.auth.getClaims();
  if (error || !claims?.claims.sub) {
    return { ok: false as const, message: "Tu sesión no es válida o venció. Inicia sesión nuevamente." };
  }

  const { data: allowed, error: permError } = await supabase.rpc("has_permission", { permission_key: "settings.manage" });
  if (permError || !allowed) {
    return { ok: false as const, message: "No tienes permiso para administrar catálogos." };
  }

  return { ok: true as const, supabase };
}

const municipalitySchema = z.object({
  department: z.string().trim().min(2, "Escribe el departamento.").max(120),
  name: z.string().trim().min(2, "Escribe el municipio.").max(120),
  daneCode: z.string().trim().max(20).optional(),
});

export async function createMunicipality(
  _previousState: CatalogFormState,
  formData: FormData,
): Promise<CatalogFormState> {
  const parsed = municipalitySchema.safeParse({
    department: String(formData.get("department") ?? ""),
    name: String(formData.get("name") ?? ""),
    daneCode: String(formData.get("daneCode") ?? "").trim() || undefined,
  });

  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Revisa el formulario." };
  }

  if (!isSupabaseConfigured()) {
    return { status: "unavailable", message: "Activa Supabase local para administrar catálogos." };
  }

  const auth = await requireSettingsManage();
  if (!auth.ok) return { status: "error", message: auth.message };

  const { error } = await auth.supabase.from("municipalities").insert({
    department: parsed.data.department,
    name: parsed.data.name,
    dane_code: parsed.data.daneCode ?? null,
  });

  if (error) {
    const message = error.code === "23505"
      ? "Ya existe ese municipio en ese departamento."
      : "No fue posible guardar el municipio.";
    return { status: "error", message };
  }

  revalidatePath("/catalogos");
  return { status: "created", message: "Municipio agregado correctamente." };
}

export async function toggleMunicipalityActive(id: string, nextValue: boolean) {
  const auth = await requireSettingsManage();
  if (!auth.ok) return;

  await auth.supabase.from("municipalities").update({ is_active: nextValue }).eq("id", id);
  revalidatePath("/catalogos");
}

const organizationSchema = z.object({
  name: z.string().trim().min(2, "Escribe el nombre.").max(160),
  organizationType: z.enum(["company", "compensation_fund", "payer", "other"], { message: "Selecciona un tipo." }),
});

export async function createOrganization(
  _previousState: CatalogFormState,
  formData: FormData,
): Promise<CatalogFormState> {
  const parsed = organizationSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    organizationType: String(formData.get("organizationType") ?? ""),
  });

  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Revisa el formulario." };
  }

  if (!isSupabaseConfigured()) {
    return { status: "unavailable", message: "Activa Supabase local para administrar catálogos." };
  }

  const auth = await requireSettingsManage();
  if (!auth.ok) return { status: "error", message: auth.message };

  const { error } = await auth.supabase.from("organizations").insert({
    name: parsed.data.name,
    organization_type: parsed.data.organizationType,
  });

  if (error) {
    const message = error.code === "23505"
      ? "Ya existe una entidad con ese nombre."
      : "No fue posible guardar la entidad.";
    return { status: "error", message };
  }

  revalidatePath("/catalogos");
  return { status: "created", message: "Entidad agregada correctamente." };
}

export async function toggleOrganizationActive(id: string, nextValue: boolean) {
  const auth = await requireSettingsManage();
  if (!auth.ok) return;

  await auth.supabase.from("organizations").update({ is_active: nextValue }).eq("id", id);
  revalidatePath("/catalogos");
}

const policeRankSchema = z.object({
  name: z.string().trim().min(2, "Escribe el nombre del rango.").max(80),
  abbreviation: z.string().trim().max(10).optional(),
  category: z.enum(["oficial_general", "oficial_superior", "oficial_subalterno", "nivel_ejecutivo", "historico"], {
    message: "Selecciona una categoría.",
  }),
});

export async function createPoliceRank(
  _previousState: CatalogFormState,
  formData: FormData,
): Promise<CatalogFormState> {
  const parsed = policeRankSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    abbreviation: String(formData.get("abbreviation") ?? "").trim() || undefined,
    category: String(formData.get("category") ?? ""),
  });

  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Revisa el formulario." };
  }

  if (!isSupabaseConfigured()) {
    return { status: "unavailable", message: "Activa Supabase local para administrar catálogos." };
  }

  const auth = await requireSettingsManage();
  if (!auth.ok) return { status: "error", message: auth.message };

  const { error } = await auth.supabase.from("police_ranks").insert({
    name: parsed.data.name,
    abbreviation: parsed.data.abbreviation?.toUpperCase() ?? null,
    category: parsed.data.category,
  });

  if (error) {
    const message = error.code === "23505"
      ? "Ya existe un rango con ese nombre."
      : "No fue posible guardar el rango.";
    return { status: "error", message };
  }

  revalidatePath("/catalogos");
  return { status: "created", message: "Rango agregado correctamente." };
}

export async function togglePoliceRankActive(id: string, nextValue: boolean) {
  const auth = await requireSettingsManage();
  if (!auth.ok) return;

  await auth.supabase.from("police_ranks").update({ is_active: nextValue }).eq("id", id);
  revalidatePath("/catalogos");
}

const paymentMethodSchema = z.object({
  name: z.string().trim().min(2, "Escribe el nombre del método.").max(80),
});

export async function createPaymentMethod(
  _previousState: CatalogFormState,
  formData: FormData,
): Promise<CatalogFormState> {
  const parsed = paymentMethodSchema.safeParse({ name: String(formData.get("name") ?? "") });

  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Revisa el formulario." };
  }

  if (!isSupabaseConfigured()) {
    return { status: "unavailable", message: "Activa Supabase local para administrar catálogos." };
  }

  const auth = await requireSettingsManage();
  if (!auth.ok) return { status: "error", message: auth.message };

  // New methods go to the end of the list; the seeded ones use steps of 10.
  const { data: last } = await auth.supabase
    .from("payment_methods")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await auth.supabase.from("payment_methods").insert({
    name: parsed.data.name,
    sort_order: (last?.sort_order ?? 0) + 10,
  });

  if (error) {
    const message = error.code === "23505"
      ? "Ya existe un método de pago con ese nombre."
      : "No fue posible guardar el método de pago.";
    return { status: "error", message };
  }

  revalidatePath("/catalogos");
  return { status: "created", message: "Método de pago agregado correctamente." };
}

export async function togglePaymentMethodActive(id: string, nextValue: boolean) {
  const auth = await requireSettingsManage();
  if (!auth.ok) return;

  await auth.supabase.from("payment_methods").update({ is_active: nextValue }).eq("id", id);
  revalidatePath("/catalogos");
}

// Updates. Each reuses its create schema; unique violations mean a duplicate name.

type TableName = "municipalities" | "organizations" | "police_ranks" | "payment_methods";

async function updateCatalogRow(
  table: TableName,
  id: string,
  values: Record<string, string | null>,
  duplicateMessage: string,
): Promise<CatalogFormState> {
  if (!isSupabaseConfigured()) {
    return { status: "unavailable", message: "Activa Supabase local para administrar catálogos." };
  }

  const auth = await requireSettingsManage();
  if (!auth.ok) return { status: "error", message: auth.message };

  const { data, error } = await auth.supabase.from(table).update(values).eq("id", id).select("id");
  if (error) {
    return { status: "error", message: error.code === "23505" ? duplicateMessage : "No fue posible guardar los cambios." };
  }
  if (!data?.length) return { status: "error", message: "No encontramos el registro o no tienes permiso para editarlo." };

  revalidatePath("/catalogos");
  return { status: "updated", message: "Cambios guardados." };
}

export async function updateMunicipality(id: string, _previousState: CatalogFormState, formData: FormData): Promise<CatalogFormState> {
  const parsed = municipalitySchema.safeParse({
    department: String(formData.get("department") ?? ""),
    name: String(formData.get("name") ?? ""),
    daneCode: String(formData.get("daneCode") ?? "").trim() || undefined,
  });
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Revisa los datos." };

  return updateCatalogRow("municipalities", id, {
    department: parsed.data.department,
    name: parsed.data.name,
    dane_code: parsed.data.daneCode ?? null,
  }, "Ya existe ese municipio en ese departamento o ese código DANE.");
}

export async function updateOrganization(id: string, _previousState: CatalogFormState, formData: FormData): Promise<CatalogFormState> {
  const parsed = organizationSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    organizationType: String(formData.get("organizationType") ?? ""),
  });
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Revisa los datos." };

  return updateCatalogRow("organizations", id, {
    name: parsed.data.name,
    organization_type: parsed.data.organizationType,
  }, "Ya existe una entidad con ese nombre.");
}

export async function updatePoliceRank(id: string, _previousState: CatalogFormState, formData: FormData): Promise<CatalogFormState> {
  const parsed = policeRankSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    abbreviation: String(formData.get("abbreviation") ?? "").trim() || undefined,
    category: String(formData.get("category") ?? ""),
  });
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Revisa los datos." };

  return updateCatalogRow("police_ranks", id, {
    name: parsed.data.name,
    abbreviation: parsed.data.abbreviation?.toUpperCase() ?? null,
    category: parsed.data.category,
  }, "Ya existe un rango con ese nombre.");
}

export async function updatePaymentMethod(id: string, _previousState: CatalogFormState, formData: FormData): Promise<CatalogFormState> {
  const parsed = paymentMethodSchema.safeParse({ name: String(formData.get("name") ?? "") });
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Revisa los datos." };

  return updateCatalogRow("payment_methods", id, { name: parsed.data.name }, "Ya existe un método de pago con ese nombre.");
}

// Deletes. Entries still referenced (FKs are ON DELETE RESTRICT) cannot be removed.

async function deleteCatalogRow(table: TableName, id: string, inUseMessage: string): Promise<CatalogFormState> {
  if (!isSupabaseConfigured()) {
    return { status: "unavailable", message: "Activa Supabase local para administrar catálogos." };
  }

  const auth = await requireSettingsManage();
  if (!auth.ok) return { status: "error", message: auth.message };

  const { data, error } = await auth.supabase.from(table).delete().eq("id", id).select("id");
  if (error) {
    return { status: "error", message: error.code === "23503" ? inUseMessage : "No fue posible eliminar el registro." };
  }
  if (!data?.length) return { status: "error", message: "No encontramos el registro o no tienes permiso para eliminarlo." };

  revalidatePath("/catalogos");
  return { status: "updated", message: "Registro eliminado." };
}

export async function deleteMunicipality(id: string): Promise<CatalogFormState> {
  return deleteCatalogRow("municipalities", id, "No se puede eliminar: hay afiliados o beneficiarios con este municipio. Puedes inactivarlo.");
}

export async function deleteOrganization(id: string): Promise<CatalogFormState> {
  return deleteCatalogRow("organizations", id, "No se puede eliminar: hay afiliados vinculados a esta entidad. Puedes inactivarla.");
}

export async function deletePoliceRank(id: string): Promise<CatalogFormState> {
  return deleteCatalogRow("police_ranks", id, "No se puede eliminar: hay afiliados con este rango. Puedes inactivarlo.");
}

export async function deletePaymentMethod(id: string): Promise<CatalogFormState> {
  return deleteCatalogRow("payment_methods", id, "No se puede eliminar: hay pagos o abonos registrados con este método. Puedes inactivarlo.");
}
