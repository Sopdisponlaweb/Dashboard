"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

import type { BeneficiaryActionState } from "./form-state";
import {
  beneficiaryFormSchema,
  beneficiaryValuesFromFormData,
  normalizeDocumentNumber,
  type BeneficiaryFormValues,
} from "./validation";

type VerifiedSupabaseContext =
  | { state: BeneficiaryActionState }
  | { supabase: Awaited<ReturnType<typeof createClient>>; userId: string };

function validationErrorState(values: BeneficiaryFormValues, error: z.ZodError<BeneficiaryFormValues>): BeneficiaryActionState {
  return {
    status: "error",
    message: "Revisa los campos marcados antes de continuar.",
    fieldErrors: error.flatten().fieldErrors,
    values,
  };
}

function databasePayload(affiliateId: string, values: BeneficiaryFormValues, userId: string) {
  return {
    affiliate_id: affiliateId,
    relationship: values.relationship,
    document_type: values.documentNumber ? values.documentType : null,
    document_number: values.documentNumber ? normalizeDocumentNumber(values.documentNumber) : null,
    document_issued_on: values.documentIssuedOn || null,
    first_names: values.firstNames,
    last_names: values.lastNames,
    birth_date: values.birthDate,
    phone: values.phone || null,
    email: values.email || null,
    status: values.status,
    joined_on: values.joinedOn,
    deceased_at: values.deceasedOn ? `${values.deceasedOn}T12:00:00-05:00` : null,
    death_municipality_id: values.deathMunicipalityId || null,
    death_registry_number: values.deathRegistryNumber || null,
    death_notary: values.deathNotary || null,
    death_service_provided: values.deathServiceProvided || null,
    death_service_amount: values.deathServiceAmount ? Number(values.deathServiceAmount) : null,
    successor_bank: values.successorBank || null,
    successor_account_number: values.successorAccountNumber || null,
    successor_account_type: values.successorAccountType || null,
    updated_by: userId,
  };
}

async function verifiedSupabaseClient(values: BeneficiaryFormValues): Promise<VerifiedSupabaseContext> {
  if (!isSupabaseConfigured()) {
    return {
      state: {
        status: "unavailable",
        message: "El formulario es válido. Activa Supabase local para guardar este beneficiario; no se realizó ninguna escritura.",
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
        status: "error",
        message: "Tu sesión no es válida o venció. Inicia sesión nuevamente antes de guardar.",
        values,
      },
    };
  }

  return { supabase, userId };
}

function duplicateDocumentState(values: BeneficiaryFormValues): BeneficiaryActionState {
  return {
    status: "error",
    message: "Ese documento ya está vinculado a este titular.",
    fieldErrors: { documentNumber: ["El número de documento ya está registrado para este titular."] },
    values,
  };
}

function mutationErrorState(values: BeneficiaryFormValues, code?: string): BeneficiaryActionState {
  if (code === "23505") return duplicateDocumentState(values);
  if (code === "23503") {
    return { status: "error", message: "El titular no existe o no está disponible para tu rol.", values };
  }
  if (code === "42501") {
    return { status: "error", message: "No tienes permiso para gestionar beneficiarios.", values };
  }
  return {
    status: "error",
    message: "No fue posible guardar el beneficiario. Intenta de nuevo o informa al administrador.",
    values,
  };
}

export async function createBeneficiary(
  affiliateId: string,
  _previousState: BeneficiaryActionState,
  formData: FormData,
): Promise<BeneficiaryActionState> {
  const rawValues = beneficiaryValuesFromFormData(formData);
  const parsed = beneficiaryFormSchema.safeParse(rawValues);
  if (!parsed.success) return validationErrorState(rawValues, parsed.error);

  const context = await verifiedSupabaseClient(parsed.data);
  if ("state" in context) return context.state;

  if (!z.uuid().safeParse(affiliateId).success) {
    return {
      status: "unavailable",
      message: "Esta ficha pertenece a los datos locales de demostración. La información fue validada, pero no se guardó.",
      values: parsed.data,
    };
  }

  if (parsed.data.documentNumber) {
    const duplicate = await context.supabase
      .from("beneficiaries")
      .select("id")
      .eq("affiliate_id", affiliateId)
      .eq("document_number", normalizeDocumentNumber(parsed.data.documentNumber))
      .maybeSingle();

    if (duplicate.error) return mutationErrorState(parsed.data, duplicate.error.code);
    if (duplicate.data) return duplicateDocumentState(parsed.data);
  }

  const result = await context.supabase
    .from("beneficiaries")
    .insert({ ...databasePayload(affiliateId, parsed.data, context.userId), created_by: context.userId })
    .select("id")
    .single();

  if (result.error) return mutationErrorState(parsed.data, result.error.code);

  revalidatePath(`/afiliados/${affiliateId}`);
  redirect(`/afiliados/${affiliateId}/beneficiarios/${result.data.id as string}?result=beneficiary-created`);
}

export async function updateBeneficiary(
  affiliateId: string,
  beneficiaryId: string,
  _previousState: BeneficiaryActionState,
  formData: FormData,
): Promise<BeneficiaryActionState> {
  const rawValues = beneficiaryValuesFromFormData(formData);
  const parsed = beneficiaryFormSchema.safeParse(rawValues);
  if (!parsed.success) return validationErrorState(rawValues, parsed.error);

  const context = await verifiedSupabaseClient(parsed.data);
  if ("state" in context) return context.state;

  if (!z.uuid().safeParse(affiliateId).success || !z.uuid().safeParse(beneficiaryId).success) {
    return {
      status: "unavailable",
      message: "Esta ficha pertenece a los datos locales de demostración. Los cambios fueron validados, pero no se guardaron.",
      values: parsed.data,
    };
  }

  if (parsed.data.documentNumber) {
    const duplicate = await context.supabase
      .from("beneficiaries")
      .select("id")
      .eq("affiliate_id", affiliateId)
      .eq("document_number", normalizeDocumentNumber(parsed.data.documentNumber))
      .neq("id", beneficiaryId)
      .maybeSingle();

    if (duplicate.error) return mutationErrorState(parsed.data, duplicate.error.code);
    if (duplicate.data) return duplicateDocumentState(parsed.data);
  }

  const result = await context.supabase
    .from("beneficiaries")
    .update(databasePayload(affiliateId, parsed.data, context.userId))
    .eq("id", beneficiaryId)
    .eq("affiliate_id", affiliateId)
    .select("id")
    .single();

  if (result.error) return mutationErrorState(parsed.data, result.error.code);

  revalidatePath(`/afiliados/${affiliateId}`);
  revalidatePath(`/afiliados/${affiliateId}/beneficiarios/${beneficiaryId}`);
  redirect(`/afiliados/${affiliateId}/beneficiarios/${beneficiaryId}?result=beneficiary-updated`);
}
