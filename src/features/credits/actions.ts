"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { formatCurrency, formatDate } from "@/features/affiliates/format";
import { discardSupportDocument, readSupportFile, storeSupportDocument, type StoredSupport } from "@/features/member-documents/support-upload";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

import type { CreditFormState } from "./form-state";

const amountSchema = z
  .string()
  .regex(/^\d+(\.\d{1,2})?$/, "Ingresa un valor numérico válido.")
  .refine((value) => Number(value) >= 0, "El valor no puede ser negativo.");

const requestCreditSchema = z.object({
  disbursedAmount: amountSchema.refine((value) => Number(value) > 0, "El monto debe ser mayor a cero."),
  interestRatePercent: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, "Ingresa una tasa numérica válida.")
    .refine((value) => Number(value) > 0 && Number(value) <= 100, "La tasa debe estar entre 0 y 100%."),
  termMonths: z
    .string()
    .regex(/^\d+$/, "Ingresa un plazo en meses válido.")
    .refine((value) => Number(value) > 0, "El plazo debe ser mayor a cero."),
  observations: z.string().max(500, "Máximo 500 caracteres.").optional(),
});

const registerInstallmentSchema = z.object({
  paidOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Selecciona la fecha del abono."),
  amount: amountSchema.refine((value) => Number(value) > 0, "El valor debe ser mayor a cero."),
  paymentMethodId: z.string().uuid("Selecciona el método de pago."),
  observation: z.string().max(500, "Máximo 500 caracteres.").optional(),
});

async function requireSession() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;
  if (error || !userId) return { ok: false as const };
  return { ok: true as const, supabase, userId: userId as string };
}

function revalidateCreditPaths(affiliateId: string) {
  revalidatePath(`/afiliados/${affiliateId}`);
  revalidatePath("/creditos");
}

export async function requestCredit(
  affiliateId: string,
  _previousState: CreditFormState,
  formData: FormData,
): Promise<CreditFormState> {
  const parsed = requestCreditSchema.safeParse({
    disbursedAmount: String(formData.get("disbursedAmount") ?? "").trim(),
    interestRatePercent: String(formData.get("interestRatePercent") ?? "").trim(),
    termMonths: String(formData.get("termMonths") ?? "").trim(),
    observations: String(formData.get("observations") ?? "").trim() || undefined,
  });

  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Revisa los datos del crédito." };
  }

  if (!isSupabaseConfigured()) return { status: "unavailable", message: "Activa Supabase local para solicitar créditos." };

  const auth = await requireSession();
  if (!auth.ok) return { status: "error", message: "Tu sesión no es válida o venció." };

  const { disbursedAmount, interestRatePercent, termMonths, observations } = parsed.data;

  const { error } = await auth.supabase.rpc("request_credit", {
    p_affiliate_id: affiliateId,
    p_disbursed_amount: Number(disbursedAmount),
    p_interest_rate: Number(interestRatePercent) / 100,
    p_term_months: Number(termMonths),
    p_observations: observations ?? "",
  });

  if (error) {
    const message =
      error.code === "42501"
        ? "No tienes permiso para solicitar créditos."
        : error.code === "22023"
          ? "Revisa el monto, la tasa o el plazo del crédito."
          : "No fue posible registrar el crédito.";
    return { status: "error", message };
  }

  revalidateCreditPaths(affiliateId);
  return { status: "idle" };
}

export async function registerCreditInstallment(
  creditId: string,
  affiliateId: string,
  _previousState: CreditFormState,
  formData: FormData,
): Promise<CreditFormState> {
  const parsed = registerInstallmentSchema.safeParse({
    paidOn: String(formData.get("paidOn") ?? "").trim(),
    amount: String(formData.get("amount") ?? "").trim(),
    paymentMethodId: String(formData.get("paymentMethodId") ?? ""),
    observation: String(formData.get("observation") ?? "").trim() || undefined,
  });

  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Revisa los datos del abono." };
  }

  const supportFile = readSupportFile(formData);
  if (supportFile.error) return { status: "error", message: supportFile.error };

  if (!isSupabaseConfigured()) return { status: "unavailable", message: "Activa Supabase local para registrar abonos." };

  const auth = await requireSession();
  if (!auth.ok) return { status: "error", message: "Tu sesión no es válida o venció." };

  const { paidOn, amount, paymentMethodId, observation } = parsed.data;

  let support: StoredSupport | null = null;
  if (supportFile.file && supportFile.mime) {
    support = await storeSupportDocument(auth.supabase, {
      affiliateId,
      file: supportFile.file,
      mime: supportFile.mime,
      title: `Soporte de abono a crédito · ${formatDate(paidOn)}`,
      userId: auth.userId,
    });
    if (!support) return { status: "error", message: "No fue posible guardar el soporte del abono." };
  }

  // The function locks the credit, validates balance and date, and splits capital/interest.
  const { data: installmentId, error } = await auth.supabase.rpc("register_credit_installment", {
    p_credit_id: creditId,
    p_amount: Number(amount),
    p_paid_on: paidOn,
    p_payment_method_id: paymentMethodId,
    p_observation: observation ?? "",
    p_support_document_id: support?.documentId ?? null,
  });

  if (error || !installmentId) {
    if (support) await discardSupportDocument(auth.supabase, support);

    const message =
      error?.message === "amount_exceeds_balance"
        ? `El abono supera el saldo pendiente (${formatCurrency(Number(error.details))}).`
        : error?.message === "credit_not_active"
          ? "Este crédito ya no está activo."
          : error?.message === "invalid_paid_on"
            ? "La fecha del abono debe estar entre la fecha del crédito y hoy."
            : error?.code === "42501"
              ? "No tienes permiso para registrar abonos."
              : "No fue posible registrar el abono.";
    return { status: "error", message };
  }

  const { data: installment } = await auth.supabase
    .from("credit_installments")
    .select("receipt_number")
    .eq("id", installmentId)
    .single();

  revalidateCreditPaths(affiliateId);
  return {
    status: "created",
    message: `Abono de ${formatCurrency(Number(amount))} registrado.`,
    installmentId: installmentId as string,
    receiptNumber: (installment?.receipt_number as number | undefined) ?? undefined,
  };
}
