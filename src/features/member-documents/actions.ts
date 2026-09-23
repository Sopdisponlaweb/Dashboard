"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";

import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

import type { DocumentUploadState } from "./form-state";

const maxFileSizeBytes = 15 * 1024 * 1024;
const validKinds = new Set(["resume", "identity", "support", "other"]);

function sizeLabel(bytes: number) {
  const megabytes = bytes / (1024 * 1024);
  return megabytes >= 1 ? `${megabytes.toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

const combiningDiacriticsPattern = new RegExp("[\\u0300-\\u036f]", "g");

function sanitizeFileName(name: string) {
  const normalized = name
    .normalize("NFD")
    .replace(combiningDiacriticsPattern, "")
    .replace(/[^a-zA-Z0-9.-]+/g, "-");
  return normalized.length ? normalized : "documento.pdf";
}

export async function uploadMemberDocument(
  affiliateId: string,
  _previousState: DocumentUploadState,
  formData: FormData,
): Promise<DocumentUploadState> {
  const file = formData.get("file");
  const kind = String(formData.get("kind") ?? "");
  const title = String(formData.get("title") ?? "").trim();

  if (!validKinds.has(kind)) {
    return { status: "error", message: "Selecciona un tipo de documento.", kind, title };
  }
  if (!title) {
    return { status: "error", message: "Escribe un título para el documento.", kind, title };
  }
  if (title.length > 120) {
    return { status: "error", message: "El título no puede superar 120 caracteres.", kind, title };
  }
  if (!(file instanceof File) || file.size === 0) {
    return { status: "error", message: "Selecciona un archivo PDF.", kind, title };
  }
  if (file.type !== "application/pdf" && !/\.pdf$/i.test(file.name)) {
    return { status: "error", message: "Solo se permiten archivos en formato PDF.", kind, title };
  }
  if (file.size > maxFileSizeBytes) {
    return { status: "error", message: "El archivo supera el tamaño máximo permitido (15 MB).", kind, title };
  }

  if (!isSupabaseConfigured()) {
    return {
      status: "unavailable",
      message: "El documento es válido. Activa Supabase local para guardarlo en el almacenamiento privado; por ahora no se guardó ningún archivo.",
      fileName: file.name,
      fileSizeLabel: sizeLabel(file.size),
      kind,
      title,
    };
  }

  const supabase = await createClient();
  const { data: claims, error: authError } = await supabase.auth.getClaims();
  const userId = claims?.claims.sub;
  if (authError || !userId) {
    return { status: "error", message: "Tu sesión no es válida o venció. Inicia sesión nuevamente antes de cargar el documento.", kind, title };
  }

  const storagePath = `${affiliateId}/${randomUUID()}-${sanitizeFileName(file.name)}`;
  const uploadResult = await supabase.storage
    .from("affiliate-files")
    .upload(storagePath, file, { contentType: "application/pdf", upsert: false });

  if (uploadResult.error) {
    return { status: "error", message: "No fue posible guardar el archivo en el almacenamiento privado. Intenta de nuevo.", kind, title };
  }

  const insertResult = await supabase.from("member_documents").insert({
    affiliate_id: affiliateId,
    kind,
    title,
    storage_path: storagePath,
    mime_type: "application/pdf",
    size_bytes: file.size,
    uploaded_by: userId,
  });

  if (insertResult.error) {
    await supabase.storage.from("affiliate-files").remove([storagePath]);
    const message = insertResult.error.code === "42501"
      ? "No tienes permiso para cargar documentos."
      : "No fue posible registrar el documento. Intenta de nuevo.";
    return { status: "error", message, kind, title };
  }

  revalidatePath(`/afiliados/${affiliateId}`);
  revalidatePath("/documentos");

  return {
    status: "uploaded",
    message: "El documento se guardó en el almacenamiento privado.",
    fileName: file.name,
    fileSizeLabel: sizeLabel(file.size),
  };
}
