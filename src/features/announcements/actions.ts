"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { z } from "zod";

import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

import type { AnnouncementActionState } from "./form-state";
import {
  announcementFormSchema,
  announcementValuesFromFormData,
  type AnnouncementFormValues,
} from "./validation";

function validationErrorState(values: AnnouncementFormValues, error: z.ZodError<AnnouncementFormValues>): AnnouncementActionState {
  return {
    status: "error",
    message: "Revisa los campos marcados antes de continuar.",
    fieldErrors: error.flatten().fieldErrors,
    values,
  };
}

export async function createAnnouncement(
  _previousState: AnnouncementActionState,
  formData: FormData,
): Promise<AnnouncementActionState> {
  const rawValues = announcementValuesFromFormData(formData);
  const parsed = announcementFormSchema.safeParse(rawValues);
  if (!parsed.success) return validationErrorState(rawValues, parsed.error);

  if (!isSupabaseConfigured()) {
    return {
      status: "unavailable",
      message: "El aviso es válido. Activa Supabase local para publicarlo; no se guardó ninguna información.",
      values: parsed.data,
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;

  if (error || !userId) {
    return {
      status: "error",
      message: "Tu sesión no es válida o venció. Inicia sesión nuevamente antes de guardar.",
      values: parsed.data,
    };
  }

  const result = await supabase
    .from("announcements")
    .insert({
      title: parsed.data.title,
      message: parsed.data.message,
      starts_at: `${parsed.data.startsOn}T00:00:00-05:00`,
      ends_at: `${parsed.data.endsOn}T23:59:59-05:00`,
      is_published: parsed.data.isPublished,
      created_by: userId,
    })
    .select("id")
    .single();

  if (result.error) {
    const message = result.error.code === "42501"
      ? "No tienes permiso para gestionar avisos."
      : "No fue posible guardar el aviso. Intenta de nuevo o informa al administrador.";
    return { status: "error", message, values: parsed.data };
  }

  revalidatePath("/avisos");
  revalidatePath("/");
  redirect("/avisos?result=created");
}

export async function toggleAnnouncementPublished(id: string, nextValue: boolean) {
  if (!isSupabaseConfigured()) return;

  const supabase = await createClient();
  await supabase.from("announcements").update({ is_published: nextValue }).eq("id", id);

  revalidatePath("/avisos");
  revalidatePath("/");
}
