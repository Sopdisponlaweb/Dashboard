"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

import type { NotificationFormState } from "./form-state";

const notificationSchema = z.object({
  title: z.string().trim().min(3, "Escribe un título.").max(140, "Máximo 140 caracteres."),
  message: z.string().trim().min(5, "Escribe el mensaje.").max(500, "Máximo 500 caracteres."),
  level: z.enum(["info", "success", "warning", "critical"]),
  recipientId: z.string(),
});

export async function sendNotification(
  _previousState: NotificationFormState,
  formData: FormData,
): Promise<NotificationFormState> {
  const parsed = notificationSchema.safeParse({
    title: String(formData.get("title") ?? ""),
    message: String(formData.get("message") ?? ""),
    level: String(formData.get("level") ?? "info"),
    recipientId: String(formData.get("recipientId") ?? ""),
  });

  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Revisa el formulario." };
  }

  if (!isSupabaseConfigured()) {
    return { status: "unavailable", message: "Activa Supabase local para enviar notificaciones." };
  }

  const supabase = await createClient();
  const result = await supabase.from("notifications").insert({
    recipient_id: parsed.data.recipientId || null,
    level: parsed.data.level,
    event_key: "manual.broadcast",
    title: parsed.data.title,
    message: parsed.data.message,
  });

  if (result.error) {
    const message = result.error.code === "42501"
      ? "No tienes permiso para enviar notificaciones."
      : "No fue posible enviar la notificación. Intenta de nuevo.";
    return { status: "error", message };
  }

  revalidatePath("/notificaciones");
  return { status: "sent", message: "Notificación enviada." };
}

export async function markNotificationRead(id: string) {
  if (!isSupabaseConfigured()) return;

  const supabase = await createClient();
  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .is("read_at", null);

  revalidatePath("/notificaciones");
}
