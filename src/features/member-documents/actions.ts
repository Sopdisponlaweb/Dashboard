"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";

import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

import type { DocumentUploadState } from "./form-state";
import { readSupportFile, sanitizeFileName } from "./support-upload";

const validKinds = new Set(["resume", "identity", "support", "other"]);

function sizeLabel(bytes: number) {
  const megabytes = bytes / (1024 * 1024);
  return megabytes >= 1 ? `${megabytes.toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/**
 * Uploads a file to the titular's record or, when the form sends a beneficiaryId,
 * to that beneficiary's own record (it must belong to this titular).
 */
export async function uploadMemberDocument(
  affiliateId: string,
  _previousState: DocumentUploadState,
  formData: FormData,
): Promise<DocumentUploadState> {
  const kind = String(formData.get("kind") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const beneficiaryId = String(formData.get("beneficiaryId") ?? "").trim() || null;
  const keep = { kind, title, beneficiaryId: beneficiaryId ?? "" };

  if (!validKinds.has(kind)) {
    return { status: "error", message: "Selecciona un tipo de documento.", ...keep };
  }
  if (!title) {
    return { status: "error", message: "Escribe un título para el documento.", ...keep };
  }
  if (title.length > 120) {
    return { status: "error", message: "El título no puede superar 120 caracteres.", ...keep };
  }
  const { file, mime, error: fileError } = readSupportFile(formData, "file", "El documento");
  if (fileError) return { status: "error", message: fileError, ...keep };
  if (!file || !mime) return { status: "error", message: "Selecciona un archivo PDF, PNG o JPG.", ...keep };

  if (!isSupabaseConfigured()) {
    return {
      status: "unavailable",
      message: "El documento es válido. Activa Supabase local para guardarlo en el almacenamiento privado; por ahora no se guardó ningún archivo.",
      fileName: file.name,
      fileSizeLabel: sizeLabel(file.size),
      ...keep,
    };
  }

  const supabase = await createClient();
  const { data: claims, error: authError } = await supabase.auth.getClaims();
  const userId = claims?.claims.sub;
  if (authError || !userId) {
    return { status: "error", message: "Tu sesión no es válida o venció. Inicia sesión nuevamente antes de cargar el documento.", ...keep };
  }

  if (beneficiaryId) {
    const { data: beneficiary } = await supabase
      .from("beneficiaries")
      .select("id")
      .eq("id", beneficiaryId)
      .eq("affiliate_id", affiliateId)
      .maybeSingle();
    if (!beneficiary) {
      return { status: "error", message: "El beneficiario elegido no pertenece a este titular.", ...keep };
    }
  }

  // Beneficiary files live in their own folder, so they stay put if the beneficiary changes titular.
  const folder = beneficiaryId ? `beneficiarios/${beneficiaryId}` : affiliateId;
  const storagePath = `${folder}/${randomUUID()}-${sanitizeFileName(file.name)}`;
  const uploadResult = await supabase.storage
    .from("affiliate-files")
    .upload(storagePath, file, { contentType: mime, upsert: false });

  if (uploadResult.error) {
    return { status: "error", message: "No fue posible guardar el archivo en el almacenamiento privado. Intenta de nuevo.", ...keep };
  }

  const insertResult = await supabase.from("member_documents").insert({
    // A document belongs to exactly one person (member_documents_owner).
    affiliate_id: beneficiaryId ? null : affiliateId,
    beneficiary_id: beneficiaryId,
    kind,
    title,
    storage_path: storagePath,
    mime_type: mime,
    size_bytes: file.size,
    uploaded_by: userId,
  });

  if (insertResult.error) {
    await supabase.storage.from("affiliate-files").remove([storagePath]);
    const message = insertResult.error.code === "42501"
      ? "No tienes permiso para cargar documentos."
      : "No fue posible registrar el documento. Intenta de nuevo.";
    return { status: "error", message, ...keep };
  }

  revalidatePath(`/afiliados/${affiliateId}`);
  if (beneficiaryId) revalidatePath(`/afiliados/${affiliateId}/beneficiarios/${beneficiaryId}`);
  revalidatePath("/documentos");

  return {
    status: "uploaded",
    message: "El documento se guardó en el almacenamiento privado.",
    fileName: file.name,
    fileSizeLabel: sizeLabel(file.size),
    beneficiaryId: beneficiaryId ?? "",
  };
}
