// Server-side only: uses node:crypto and a session-bound Supabase client.
import { randomUUID } from "node:crypto";

import type { createClient } from "@/lib/supabase/server";

// Payment and credit supports may be a PDF or a photo/scan of the voucher.
const supportFileTypes = [
  { mime: "application/pdf", extension: /\.pdf$/i },
  { mime: "image/png", extension: /\.png$/i },
  { mime: "image/jpeg", extension: /\.jpe?g$/i },
];
const maxSupportFileSizeBytes = 15 * 1024 * 1024;
const combiningDiacriticsPattern = new RegExp("[\\u0300-\\u036f]", "g");

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export function sanitizeFileName(name: string) {
  const normalized = name
    .normalize("NFD")
    .replace(combiningDiacriticsPattern, "")
    .replace(/[^a-zA-Z0-9.-]+/g, "-");
  return normalized.length ? normalized : "soporte";
}

/** Returns the optional support file from a form, or an error message if it is not acceptable. */
export function readSupportFile(formData: FormData, field = "supportFile", noun = "El soporte") {
  const file = formData.get(field);
  if (!(file instanceof File) || file.size === 0) return { file: null, mime: null, error: null };

  const mime = supportFileTypes.find((type) => file.type === type.mime || type.extension.test(file.name))?.mime ?? null;
  if (!mime) return { file: null, mime: null, error: `${noun} debe ser PDF, PNG o JPG.` };
  if (file.size > maxSupportFileSizeBytes) {
    return { file: null, mime: null, error: `${noun} supera el tamaño máximo permitido (15 MB).` };
  }
  return { file, mime, error: null };
}

export type StoredSupport = { documentId: string; storagePath: string };

/** Uploads the file to the affiliate's private folder and registers it as a support document. */
export async function storeSupportDocument(
  supabase: SupabaseServerClient,
  { affiliateId, file, mime, title, userId }: { affiliateId: string; file: File; mime: string; title: string; userId: string },
): Promise<StoredSupport | null> {
  const storagePath = `${affiliateId}/${randomUUID()}-${sanitizeFileName(file.name)}`;
  const upload = await supabase.storage.from("affiliate-files").upload(storagePath, file, { contentType: mime, upsert: false });
  if (upload.error) return null;

  const { data, error } = await supabase
    .from("member_documents")
    .insert({
      affiliate_id: affiliateId,
      kind: "support",
      title,
      storage_path: storagePath,
      mime_type: mime,
      size_bytes: file.size,
      uploaded_by: userId,
    })
    .select("id")
    .single();

  if (error || !data) {
    await supabase.storage.from("affiliate-files").remove([storagePath]);
    return null;
  }
  return { documentId: data.id as string, storagePath };
}

/** Undoes storeSupportDocument when the record it belonged to could not be saved. */
export async function discardSupportDocument(supabase: SupabaseServerClient, support: StoredSupport) {
  await supabase.from("member_documents").delete().eq("id", support.documentId);
  await supabase.storage.from("affiliate-files").remove([support.storagePath]);
}
