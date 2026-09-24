"use server";

import { revalidatePath } from "next/cache";

import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export type ArchiveActionState = {
  status: "idle" | "error" | "done";
  message?: string;
};

/** Archives the long-retired titulars (administrators only). Requires the confirmation checkbox. */
export async function archiveRetiredAffiliates(_previousState: ArchiveActionState, formData: FormData): Promise<ArchiveActionState> {
  if (formData.get("confirm") !== "on") {
    return { status: "error", message: "Marca la confirmación: esta acción elimina definitivamente pagos y beneficiarios." };
  }
  if (!isSupabaseConfigured()) return { status: "error", message: "Activa Supabase local para archivar." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("archive_retired_affiliates", { p_apply: true });
  if (error) {
    const message = error.code === "42501" || error.message.includes("insufficient_privilege")
      ? "Solo un administrador puede archivar retirados."
      : error.code === "57014"
        ? "La operación tardó demasiado. Intenta de nuevo o pide soporte para ejecutarla directamente en la base."
        : "No fue posible archivar los retirados.";
    return { status: "error", message };
  }

  const result = data as Record<string, number>;
  revalidatePath("/afiliados");
  revalidatePath("/afiliados/archivo");
  revalidatePath("/");
  return {
    status: "done",
    message: result.titulares
      ? `Se archivaron ${Number(result.titulares).toLocaleString("es-CO")} titulares y ${Number(result.beneficiarios).toLocaleString("es-CO")} beneficiarios; se eliminaron ${Number(result.pagos).toLocaleString("es-CO")} pagos.`
      : "No había retirados para archivar.",
  };
}
