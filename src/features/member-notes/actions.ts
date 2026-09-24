"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

import type { NoteFormState } from "./form-state";

const bodySchema = z.string().trim().min(1, "Escribe una observación.").max(2000, "Máximo 2000 caracteres.");

async function requireSession() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;
  if (error || !userId) return { ok: false as const };
  return { ok: true as const, supabase, userId: userId as string };
}

export async function createAffiliateNote(
  affiliateId: string,
  _previousState: NoteFormState,
  formData: FormData,
): Promise<NoteFormState> {
  const parsed = bodySchema.safeParse(String(formData.get("body") ?? ""));
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Revisa el texto." };

  if (!isSupabaseConfigured()) return { status: "unavailable", message: "Activa Supabase local para guardar observaciones." };

  const auth = await requireSession();
  if (!auth.ok) return { status: "error", message: "Tu sesión no es válida o venció." };

  const { error } = await auth.supabase.from("member_notes").insert({
    affiliate_id: affiliateId,
    body: parsed.data,
    created_by: auth.userId,
  });

  if (error) {
    const message = error.code === "42501" ? "No tienes permiso para agregar observaciones." : "No fue posible guardar la observación.";
    return { status: "error", message };
  }

  revalidatePath(`/afiliados/${affiliateId}`);
  revalidatePath(`/afiliados/${affiliateId}/editar`);
  return { status: "idle" };
}

export async function createBeneficiaryNote(
  affiliateId: string,
  beneficiaryId: string,
  _previousState: NoteFormState,
  formData: FormData,
): Promise<NoteFormState> {
  const parsed = bodySchema.safeParse(String(formData.get("body") ?? ""));
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Revisa el texto." };

  if (!isSupabaseConfigured()) return { status: "unavailable", message: "Activa Supabase local para guardar observaciones." };

  const auth = await requireSession();
  if (!auth.ok) return { status: "error", message: "Tu sesión no es válida o venció." };

  const { error } = await auth.supabase.from("member_notes").insert({
    beneficiary_id: beneficiaryId,
    body: parsed.data,
    created_by: auth.userId,
  });

  if (error) {
    const message = error.code === "42501" ? "No tienes permiso para agregar observaciones." : "No fue posible guardar la observación.";
    return { status: "error", message };
  }

  revalidatePath(`/afiliados/${affiliateId}`);
  revalidatePath(`/afiliados/${affiliateId}/beneficiarios/${beneficiaryId}`);
  return { status: "idle" };
}
