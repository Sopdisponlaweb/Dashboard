"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { formatPeriod } from "@/features/affiliates/format";
import { discardSupportDocument, readSupportFile, storeSupportDocument, type StoredSupport } from "@/features/member-documents/support-upload";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

import type { PaymentFormState } from "./form-state";
import { coveredPeriods, maxMonthsPerReceipt } from "./periods";

const sourceValues = ["particular", "activo", "casur", "tegen", "inpec", "ordisponal"] as const;
const statusValues = ["paid", "pending", "reversed"] as const;

const manualPaymentSchema = z.object({
  periodFrom: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Selecciona el mes inicial."),
  months: z.coerce
    .number({ message: "Selecciona la cantidad de meses." })
    .int()
    .min(1, "Selecciona al menos un mes.")
    .max(maxMonthsPerReceipt, `Máximo ${maxMonthsPerReceipt} meses por recibo.`),
  source: z.enum(sourceValues, { message: "Selecciona una fuente." }),
  paymentMethodId: z.string().uuid("Selecciona el método de pago."),
  monthlyAmount: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, "Ingresa un valor numérico válido.")
    .refine((value) => Number(value) > 0, "El valor debe ser mayor a cero."),
  status: z.enum(statusValues, { message: "Selecciona un estado." }),
  paidOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha de pago inválida.").optional(),
  observation: z.string().max(500, "Máximo 500 caracteres.").optional(),
});

async function requireSession() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;
  if (error || !userId) return { ok: false as const };
  return { ok: true as const, supabase, userId: userId as string };
}

function todayInBogota() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date());
}

export async function createManualPayment(
  affiliateId: string,
  _previousState: PaymentFormState,
  formData: FormData,
): Promise<PaymentFormState> {
  const parsed = manualPaymentSchema.safeParse({
    periodFrom: String(formData.get("periodFrom") ?? ""),
    months: String(formData.get("months") ?? ""),
    source: String(formData.get("source") ?? ""),
    paymentMethodId: String(formData.get("paymentMethodId") ?? ""),
    monthlyAmount: String(formData.get("monthlyAmount") ?? "").trim(),
    status: String(formData.get("status") ?? ""),
    paidOn: String(formData.get("paidOn") ?? "") || undefined,
    observation: String(formData.get("observation") ?? "").trim() || undefined,
  });

  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Revisa los datos del pago." };
  }

  const supportFile = readSupportFile(formData);
  if (supportFile.error) return { status: "error", message: supportFile.error };

  if (!isSupabaseConfigured()) return { status: "unavailable", message: "Activa Supabase local para registrar pagos." };

  const auth = await requireSession();
  if (!auth.ok) return { status: "error", message: "Tu sesión no es válida o venció." };

  const { periodFrom, months, source, paymentMethodId, monthlyAmount, status, paidOn, observation } = parsed.data;
  const periods = coveredPeriods(periodFrom, months);

  // Name the conflicting months up front instead of a generic unique-violation error.
  const { data: existing } = await auth.supabase
    .from("payments")
    .select("period_start")
    .eq("affiliate_id", affiliateId)
    .eq("source", source)
    .in("period_start", periods.map((period) => `${period}-01`));

  if (existing?.length) {
    const taken = existing
      .map((row) => (row.period_start as string).slice(0, 7))
      .sort()
      .map(formatPeriod)
      .join(", ");
    return { status: "error", message: `Ya hay pagos registrados con esa fuente para: ${taken}.` };
  }

  const rangeLabel = months === 1
    ? formatPeriod(periods[0])
    : `${formatPeriod(periods[0])} a ${formatPeriod(periods[periods.length - 1])}`;

  let support: StoredSupport | null = null;
  if (supportFile.file && supportFile.mime) {
    support = await storeSupportDocument(auth.supabase, {
      affiliateId,
      file: supportFile.file,
      mime: supportFile.mime,
      title: `Soporte de pago · ${rangeLabel}`,
      userId: auth.userId,
    });
    if (!support) return { status: "error", message: "No fue posible guardar el soporte del pago." };
  }

  const { data: receiptId, error } = await auth.supabase.rpc("create_payment_receipt", {
    p_affiliate_id: affiliateId,
    p_payment_method_id: paymentMethodId,
    p_source: source,
    p_period_from: `${periodFrom}-01`,
    p_months: months,
    p_monthly_amount: Number(monthlyAmount),
    p_status: status,
    p_paid_on: status === "paid" ? (paidOn ?? todayInBogota()) : (paidOn ?? null),
    p_observations: observation ?? "",
    p_support_document_id: support?.documentId ?? null,
  });

  if (error || !receiptId) {
    if (support) await discardSupportDocument(auth.supabase, support);

    const message =
      error?.code === "23505"
        ? "Uno de los meses ya tiene un pago registrado con esa fuente."
        : error?.code === "42501"
          ? "No tienes permiso para registrar pagos."
          : "No fue posible registrar el pago.";
    return { status: "error", message };
  }

  const { data: receipt } = await auth.supabase
    .from("payment_receipts")
    .select("receipt_number")
    .eq("id", receiptId)
    .single();

  revalidatePath(`/afiliados/${affiliateId}`);
  revalidatePath(`/afiliados/${affiliateId}/editar`);
  revalidatePath("/pagos");
  return {
    status: "created",
    message: `Pago registrado: ${rangeLabel} (${months} ${months === 1 ? "mes" : "meses"}).`,
    receiptId: receiptId as string,
    receiptNumber: (receipt?.receipt_number as number | undefined) ?? undefined,
  };
}
