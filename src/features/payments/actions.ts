"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { formatPeriod } from "@/features/affiliates/format";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

import type { PaymentFormState } from "./form-state";

const sourceValues = ["particular", "activo", "casur", "tegen", "inpec", "ordisponal"] as const;
const statusValues = ["paid", "pending", "reversed"] as const;
const maxSupportFileSizeBytes = 15 * 1024 * 1024;

const manualPaymentSchema = z.object({
  period: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Selecciona un periodo válido."),
  source: z.enum(sourceValues, { message: "Selecciona una fuente." }),
  amount: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, "Ingresa un valor numérico válido.")
    .refine((value) => Number(value) > 0, "El valor debe ser mayor a cero."),
  status: z.enum(statusValues, { message: "Selecciona un estado." }),
  paidOn: z.string().optional(),
  observation: z.string().max(500, "Máximo 500 caracteres.").optional(),
});

async function requireSession() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;
  if (error || !userId) return { ok: false as const };
  return { ok: true as const, supabase, userId: userId as string };
}

const combiningDiacriticsPattern = new RegExp("[\\u0300-\\u036f]", "g");

function sanitizeFileName(name: string) {
  const normalized = name
    .normalize("NFD")
    .replace(combiningDiacriticsPattern, "")
    .replace(/[^a-zA-Z0-9.-]+/g, "-");
  return normalized.length ? normalized : "soporte.pdf";
}

export async function createManualPayment(
  affiliateId: string,
  _previousState: PaymentFormState,
  formData: FormData,
): Promise<PaymentFormState> {
  const parsed = manualPaymentSchema.safeParse({
    period: String(formData.get("period") ?? ""),
    source: String(formData.get("source") ?? ""),
    amount: String(formData.get("amount") ?? "").trim(),
    status: String(formData.get("status") ?? ""),
    paidOn: String(formData.get("paidOn") ?? "") || undefined,
    observation: String(formData.get("observation") ?? "").trim() || undefined,
  });

  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Revisa los datos del pago." };
  }

  const file = formData.get("supportFile");
  const hasFile = file instanceof File && file.size > 0;
  if (hasFile) {
    if (file.type !== "application/pdf" && !/\.pdf$/i.test(file.name)) {
      return { status: "error", message: "El soporte debe ser un archivo PDF." };
    }
    if (file.size > maxSupportFileSizeBytes) {
      return { status: "error", message: "El soporte supera el tamaño máximo permitido (15 MB)." };
    }
  }

  if (!isSupabaseConfigured()) return { status: "unavailable", message: "Activa Supabase local para registrar pagos." };

  const auth = await requireSession();
  if (!auth.ok) return { status: "error", message: "Tu sesión no es válida o venció." };

  const { period, source, amount, status, paidOn, observation } = parsed.data;
  const periodStart = `${period}-01`;

  let supportDocumentId: string | null = null;
  let storagePath: string | null = null;

  if (hasFile && file instanceof File) {
    storagePath = `${affiliateId}/${randomUUID()}-${sanitizeFileName(file.name)}`;
    const uploadResult = await auth.supabase.storage
      .from("affiliate-files")
      .upload(storagePath, file, { contentType: "application/pdf", upsert: false });

    if (uploadResult.error) {
      return { status: "error", message: "No fue posible guardar el soporte en el almacenamiento privado." };
    }

    const documentInsert = await auth.supabase
      .from("member_documents")
      .insert({
        affiliate_id: affiliateId,
        kind: "support",
        title: `Soporte de pago · ${formatPeriod(period)}`,
        storage_path: storagePath,
        mime_type: "application/pdf",
        size_bytes: file.size,
        uploaded_by: auth.userId,
      })
      .select("id")
      .single();

    if (documentInsert.error || !documentInsert.data) {
      await auth.supabase.storage.from("affiliate-files").remove([storagePath]);
      return { status: "error", message: "No fue posible registrar el soporte del pago." };
    }

    supportDocumentId = documentInsert.data.id as string;
  }

  const { error } = await auth.supabase.from("payments").insert({
    affiliate_id: affiliateId,
    source,
    period_start: periodStart,
    amount: Number(amount),
    status,
    paid_on: status === "paid" ? (paidOn || periodStart) : (paidOn || null),
    observations: observation ?? null,
    support_document_id: supportDocumentId,
    created_by: auth.userId,
  });

  if (error) {
    if (supportDocumentId) {
      await auth.supabase.from("member_documents").delete().eq("id", supportDocumentId);
      if (storagePath) await auth.supabase.storage.from("affiliate-files").remove([storagePath]);
    }

    const message =
      error.code === "23505"
        ? "Ya existe un pago registrado para esa fuente y ese periodo."
        : error.code === "42501"
          ? "No tienes permiso para registrar pagos."
          : "No fue posible registrar el pago.";
    return { status: "error", message };
  }

  revalidatePath(`/afiliados/${affiliateId}`);
  revalidatePath(`/afiliados/${affiliateId}/editar`);
  revalidatePath("/pagos");
  return { status: "idle" };
}
