"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

import type { AffiliateActionState } from "./form-state";
import {
  affiliateFormSchema,
  affiliateValuesFromFormData,
  normalizeDocumentNumber,
  type AffiliateFormValues,
} from "./validation";

type VerifiedSupabaseContext =
  | { state: AffiliateActionState }
  | { supabase: Awaited<ReturnType<typeof createClient>>; userId: string };

function validationErrorState(values: AffiliateFormValues, error: z.ZodError<AffiliateFormValues>): AffiliateActionState {
  return {
    status: "error",
    message: "Revisa los campos marcados antes de continuar.",
    fieldErrors: error.flatten().fieldErrors,
    values,
  };
}

function databasePayload(values: AffiliateFormValues, userId: string) {
  return {
    document_type: values.documentType,
    document_number: normalizeDocumentNumber(values.documentNumber),
    document_issued_on: values.documentIssuedOn || null,
    first_names: values.firstNames,
    last_names: values.lastNames,
    birth_date: values.birthDate || null,
    phone: values.phone || null,
    email: values.email || null,
    address: values.address || null,
    source: values.source,
    status: values.status,
    joined_on: values.joinedOn,
    deceased_at: values.deceasedOn ? `${values.deceasedOn}T12:00:00-05:00` : null,
    successor_resolution_number: values.successorResolutionNumber || null,
    successor_document_number: values.successorDocumentNumber || null,
    successor_first_names: values.successorFirstNames || null,
    successor_last_names: values.successorLastNames || null,
    successor_phone: values.successorPhone || null,
    death_municipality_id: values.deathMunicipalityId || null,
    death_registry_number: values.deathRegistryNumber || null,
    death_notary: values.deathNotary || null,
    death_service_provided: values.deathServiceProvided || null,
    death_service_amount: values.deathServiceAmount ? Number(values.deathServiceAmount) : null,
    successor_bank: values.successorBank || null,
    successor_account_number: values.successorAccountNumber || null,
    successor_account_type: values.successorAccountType || null,
    police_rank_id: values.policeRankId || null,
    updated_by: userId,
  };
}

async function verifiedSupabaseClient(values: AffiliateFormValues): Promise<VerifiedSupabaseContext> {
  if (!isSupabaseConfigured()) {
    return {
      state: {
        status: "unavailable" as const,
        message: "El formulario es válido. Activa Supabase local para guardar este registro; no se realizó ninguna escritura.",
        values,
      },
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;

  if (error || !userId) {
    return {
      state: {
        status: "error" as const,
        message: "Tu sesión no es válida o venció. Inicia sesión nuevamente antes de guardar.",
        values,
      },
    };
  }

  return { supabase, userId };
}

function duplicateDocumentState(values: AffiliateFormValues): AffiliateActionState {
  return {
    status: "error",
    message: "Ya existe un afiliado con ese documento.",
    fieldErrors: { documentNumber: ["El número de documento ya está registrado."] },
    values,
  };
}

function mutationErrorState(values: AffiliateFormValues, code?: string): AffiliateActionState {
  if (code === "23505") return duplicateDocumentState(values);
  if (code === "42501") {
    return { status: "error", message: "No tienes permiso para gestionar afiliados.", values };
  }
  return {
    status: "error",
    message: "No fue posible guardar el registro. Intenta de nuevo o informa al administrador.",
    values,
  };
}

export async function createAffiliate(
  _previousState: AffiliateActionState,
  formData: FormData,
): Promise<AffiliateActionState> {
  const rawValues = affiliateValuesFromFormData(formData);
  const parsed = affiliateFormSchema.safeParse(rawValues);
  if (!parsed.success) return validationErrorState(rawValues, parsed.error);

  const context = await verifiedSupabaseClient(parsed.data);
  if ("state" in context) return context.state;

  const documentNumber = normalizeDocumentNumber(parsed.data.documentNumber);
  const duplicate = await context.supabase
    .from("affiliates")
    .select("id")
    .eq("document_number", documentNumber)
    .maybeSingle();

  if (duplicate.error) return mutationErrorState(parsed.data, duplicate.error.code);
  if (duplicate.data) return duplicateDocumentState(parsed.data);

  const result = await context.supabase
    .from("affiliates")
    .insert({ ...databasePayload(parsed.data, context.userId), created_by: context.userId })
    .select("id")
    .single();

  if (result.error) return mutationErrorState(parsed.data, result.error.code);

  revalidatePath("/afiliados");
  redirect("/afiliados?result=created");
}

export async function updateAffiliate(
  affiliateId: string,
  _previousState: AffiliateActionState,
  formData: FormData,
): Promise<AffiliateActionState> {
  const rawValues = affiliateValuesFromFormData(formData);
  const parsed = affiliateFormSchema.safeParse(rawValues);
  if (!parsed.success) return validationErrorState(rawValues, parsed.error);

  const context = await verifiedSupabaseClient(parsed.data);
  if ("state" in context) return context.state;

  if (!z.uuid().safeParse(affiliateId).success) {
    return {
      status: "unavailable",
      message: "Esta ficha pertenece a los datos locales de demostración. Los cambios fueron validados, pero no se guardaron.",
      values: parsed.data,
    };
  }

  const documentNumber = normalizeDocumentNumber(parsed.data.documentNumber);
  const duplicate = await context.supabase
    .from("affiliates")
    .select("id")
    .eq("document_number", documentNumber)
    .neq("id", affiliateId)
    .maybeSingle();

  if (duplicate.error) return mutationErrorState(parsed.data, duplicate.error.code);
  if (duplicate.data) return duplicateDocumentState(parsed.data);

  const result = await context.supabase
    .from("affiliates")
    .update(databasePayload(parsed.data, context.userId))
    .eq("id", affiliateId)
    .select("id")
    .single();

  if (result.error) return mutationErrorState(parsed.data, result.error.code);

  revalidatePath("/afiliados");
  revalidatePath(`/afiliados/${affiliateId}`);
  redirect("/afiliados?result=updated");
}
