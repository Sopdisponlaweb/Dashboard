"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

import { splitPayment } from "./calculations";
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
  paidOn: z.string().min(1, "Selecciona la fecha del abono."),
  amount: amountSchema.refine((value) => Number(value) > 0, "El valor debe ser mayor a cero."),
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
    observation: String(formData.get("observation") ?? "").trim() || undefined,
  });

  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Revisa los datos del abono." };
  }

  if (!isSupabaseConfigured()) return { status: "unavailable", message: "Activa Supabase local para registrar abonos." };

  const auth = await requireSession();
  if (!auth.ok) return { status: "error", message: "Tu sesión no es válida o venció." };

  const { paidOn, amount, observation } = parsed.data;

  const { data: credit, error: creditError } = await auth.supabase
    .from("credits")
    .select("status, principal_base, total_amount, credit_installments(amount)")
    .eq("id", creditId)
    .maybeSingle();

  if (creditError || !credit) {
    return { status: "error", message: "No fue posible encontrar el crédito." };
  }
  if (credit.status !== "active") {
    return { status: "error", message: "Este crédito ya no está activo." };
  }

  const alreadyPaid = ((credit.credit_installments as { amount: number }[] | null) ?? [])
    .reduce((sum, item) => sum + Number(item.amount), 0);
  const remainingTotal = Number(credit.total_amount) - alreadyPaid;
  const amountValue = Number(amount);

  if (amountValue > remainingTotal + 0.01) {
    return { status: "error", message: `El abono supera el saldo pendiente ($${remainingTotal.toLocaleString("es-CO")}).` };
  }

  const { capitalPortion, interestPortion } = splitPayment({
    principalBase: Number(credit.principal_base),
    totalAmount: Number(credit.total_amount),
    amount: amountValue,
  });

  const { error } = await auth.supabase.from("credit_installments").insert({
    credit_id: creditId,
    paid_on: paidOn,
    amount: amountValue,
    capital_portion: capitalPortion,
    interest_portion: interestPortion,
    observation: observation ?? null,
    created_by: auth.userId,
  });

  if (error) {
    const message = error.code === "42501" ? "No tienes permiso para registrar abonos." : "No fue posible registrar el abono.";
    return { status: "error", message };
  }

  revalidateCreditPaths(affiliateId);
  return { status: "idle" };
}
