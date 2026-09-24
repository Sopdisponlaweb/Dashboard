"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { formatDate, statusLabels } from "@/features/affiliates/format";
import type { AffiliateStatus } from "@/features/affiliates/types";
import { discardSupportDocument, readSupportFile, storeSupportDocument, type StoredSupport } from "@/features/member-documents/support-upload";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

import type { SuccessionFormState, SuccessorCandidate } from "./types";

const sources = ["particular", "activo", "casur", "tegen", "inpec", "ordisponal"] as const;
const isoDate = /^\d{4}-\d{2}-\d{2}$/;

const successionSchema = z.object({
  mode: z.enum(["beneficiary", "existing", "new"], { message: "Elige quién será el sucesor." }),
  beneficiaryId: z.string().optional(),
  existingAffiliateId: z.string().optional(),
  documentType: z.enum(["CC", "CE", "TI"]).optional(),
  documentNumber: z.string().trim().max(20).optional(),
  firstNames: z.string().trim().max(120).optional(),
  lastNames: z.string().trim().max(120).optional(),
  phone: z.string().trim().max(40).optional(),
  email: z.string().trim().max(160).optional(),
  birthDate: z.string().optional(),
  source: z.enum(sources, { message: "Elige el tipo de afiliación del sucesor." }),
  successionDate: z.string().regex(isoDate, "Indica la fecha de la sucesión."),
  resolutionNumber: z.string().trim().max(80).optional(),
  creditDecision: z.enum(["inherited", "paused"]),
  notes: z.string().trim().max(1000).optional(),
}).superRefine((values, context) => {
  if (values.mode === "beneficiary" && !values.beneficiaryId) {
    context.addIssue({ code: "custom", path: ["beneficiaryId"], message: "Elige el beneficiario que será el nuevo titular." });
  }
  if (values.mode === "existing" && !values.existingAffiliateId) {
    context.addIssue({ code: "custom", path: ["existingAffiliateId"], message: "Busca y elige el afiliado sucesor." });
  }
  if (values.mode === "new" && (!values.documentNumber || !values.firstNames || !values.lastNames)) {
    context.addIssue({ code: "custom", path: ["documentNumber"], message: "Completa documento, nombres y apellidos del sucesor." });
  }
});

const errorMessages: Record<string, string> = {
  succession_exists: "Este afiliado ya tiene una sucesión registrada.",
  not_deceased: "Solo se puede registrar la sucesión de un afiliado fallecido.",
  invalid_succession_date: "La fecha de la sucesión no puede estar en el futuro.",
  invalid_successor: "El sucesor elegido no es válido (debe estar vivo y no ser el mismo fallecido).",
  successor_data_incomplete: "Falta el documento, los nombres o los apellidos del sucesor.",
  successor_document_exists: "Ya existe un afiliado con ese documento. Elige la opción «Afiliado existente».",
  successor_has_active_credit: "El sucesor ya tiene un crédito activo: deja el crédito del fallecido en pausa.",
  insufficient_privilege: "No tienes permiso para esta acción.",
  credit_not_paused: "El crédito ya no está en pausa.",
  no_succession: "Primero registra la sucesión del titular para poder heredar el crédito.",
  reason_required: "Escribe el motivo de la anulación.",
  succession_not_found: "La sucesión ya no está vigente.",
};

function messageFor(error: { message?: string; code?: string } | null, fallback: string) {
  if (!error) return fallback;
  if (error.message && errorMessages[error.message]) return errorMessages[error.message];
  if (error.code === "42501") return errorMessages.insufficient_privilege;
  if (error.message?.includes("beneficiaries_document_unique")) {
    return "El sucesor ya tiene un beneficiario con el mismo documento que uno de los que se transfieren. Desmárcalo e inténtalo de nuevo.";
  }
  return fallback;
}

async function requireSession() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;
  if (error || !userId) return { ok: false as const };
  return { ok: true as const, supabase, userId: userId as string };
}

export async function registerSuccession(
  deceasedId: string,
  _previousState: SuccessionFormState,
  formData: FormData,
): Promise<SuccessionFormState> {
  const text = (name: string) => String(formData.get(name) ?? "").trim() || undefined;
  const parsed = successionSchema.safeParse({
    mode: text("mode"),
    beneficiaryId: text("beneficiaryId"),
    existingAffiliateId: text("existingAffiliateId"),
    documentType: text("documentType"),
    documentNumber: text("documentNumber"),
    firstNames: text("firstNames"),
    lastNames: text("lastNames"),
    phone: text("phone"),
    email: text("email"),
    birthDate: text("birthDate"),
    source: text("source"),
    successionDate: text("successionDate"),
    resolutionNumber: text("resolutionNumber"),
    creditDecision: text("creditDecision") ?? "paused",
    notes: text("notes"),
  });
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Revisa los datos de la sucesión." };

  const supportFile = readSupportFile(formData);
  if (supportFile.error) return { status: "error", message: supportFile.error };

  if (!isSupabaseConfigured()) return { status: "unavailable", message: "Activa Supabase local para registrar sucesiones." };
  const auth = await requireSession();
  if (!auth.ok) return { status: "error", message: "Tu sesión no es válida o venció." };

  const values = parsed.data;
  let support: StoredSupport | null = null;
  if (supportFile.file && supportFile.mime) {
    support = await storeSupportDocument(auth.supabase, {
      affiliateId: deceasedId,
      file: supportFile.file,
      mime: supportFile.mime,
      title: `Soporte de sucesión · ${formatDate(values.successionDate)}`,
      userId: auth.userId,
    });
    if (!support) return { status: "error", message: "No fue posible guardar el soporte de la sucesión." };
  }

  // Name, document and contact may also complete what a beneficiary's record lacks.
  const person = {
    document_type: values.documentType ?? "",
    document_number: values.documentNumber ?? "",
    first_names: values.firstNames ?? "",
    last_names: values.lastNames ?? "",
    phone: values.phone ?? "",
    email: values.email ?? "",
    birth_date: values.birthDate && isoDate.test(values.birthDate) ? values.birthDate : "",
  };

  const { data: successionId, error } = await auth.supabase.rpc("register_succession", {
    p_deceased_id: deceasedId,
    p_mode: values.mode,
    p_existing_affiliate_id: values.mode === "existing" ? values.existingAffiliateId : null,
    p_beneficiary_id: values.mode === "beneficiary" ? values.beneficiaryId : null,
    p_person: person,
    p_source: values.source,
    p_succession_date: values.successionDate,
    p_resolution_number: values.resolutionNumber ?? "",
    p_beneficiary_ids: formData.getAll("beneficiaryIds").map(String),
    p_credit_decision: values.creditDecision,
    p_notes: values.notes ?? "",
    p_support_document_id: support?.documentId ?? null,
  });

  if (error || !successionId) {
    if (support) await discardSupportDocument(auth.supabase, support);
    return { status: "error", message: messageFor(error, "No fue posible registrar la sucesión.") };
  }

  revalidatePath("/afiliados");
  revalidatePath("/beneficiarios");
  revalidatePath("/");
  redirect(`/afiliados/${deceasedId}?result=succession-created`);
}

/** Living affiliates matching a name or document, for the "existing affiliate" option. */
export async function searchSuccessorCandidates(deceasedId: string, query: string): Promise<SuccessorCandidate[]> {
  const term = query.trim();
  if (term.length < 3 || !isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const like = `%${term.replace(/[%,()]/g, " ")}%`;
  const { data } = await supabase
    .from("affiliates")
    .select("id, first_names, last_names, document_type, document_number, status")
    .neq("status", "deceased")
    .neq("id", deceasedId)
    .or(`first_names.ilike.${like},last_names.ilike.${like},document_number.ilike.${like}`)
    .order("last_names")
    .limit(8);
  return ((data ?? []) as Record<string, string>[]).map((row) => ({
    id: row.id,
    name: `${row.first_names} ${row.last_names}`.trim(),
    document: `${row.document_type} ${row.document_number}`,
    statusLabel: statusLabels[row.status as AffiliateStatus] ?? row.status,
  }));
}

export async function resolvePausedCredit(
  creditId: string,
  affiliateId: string,
  _previousState: SuccessionFormState,
  formData: FormData,
): Promise<SuccessionFormState> {
  const action = String(formData.get("action") ?? "");
  if (!["inherit", "forgive", "cancel"].includes(action)) return { status: "error", message: "Elige qué hacer con el crédito." };
  if (!isSupabaseConfigured()) return { status: "unavailable", message: "Activa Supabase local para gestionar créditos." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("resolve_paused_credit", {
    p_credit_id: creditId,
    p_action: action,
    p_note: String(formData.get("note") ?? "").trim(),
  });
  if (error) return { status: "error", message: messageFor(error, "No fue posible actualizar el crédito.") };

  revalidatePath("/afiliados", "layout");
  revalidatePath("/creditos");
  redirect(`/afiliados/${affiliateId}?tab=creditos&result=credit-${action}`);
}

export async function annulSuccession(
  successionId: string,
  deceasedId: string,
  _previousState: SuccessionFormState,
  formData: FormData,
): Promise<SuccessionFormState> {
  if (!isSupabaseConfigured()) return { status: "unavailable", message: "Activa Supabase local para anular sucesiones." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("annul_succession", {
    p_succession_id: successionId,
    p_reason: String(formData.get("reason") ?? "").trim(),
  });
  if (error) return { status: "error", message: messageFor(error, "No fue posible anular la sucesión.") };

  revalidatePath("/afiliados", "layout");
  revalidatePath("/beneficiarios");
  revalidatePath("/");
  redirect(`/afiliados/${deceasedId}?result=succession-annulled`);
}
