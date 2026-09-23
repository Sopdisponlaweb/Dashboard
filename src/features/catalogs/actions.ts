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
