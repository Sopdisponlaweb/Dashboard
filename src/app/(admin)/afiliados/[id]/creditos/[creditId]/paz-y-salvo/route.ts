import { NextResponse } from "next/server";

import { getFullName } from "@/features/affiliates/format";
import { getAffiliateById } from "@/features/affiliates/repository";
import { renderCreditClearancePdf } from "@/features/credits/credit-clearance-pdf";
import { createClient } from "@/lib/supabase/server";

type RouteParams = { params: Promise<{ id: string; creditId: string }> };

/** PDF of an already issued paz y salvo. Issuing happens in issueCreditClearance, never on GET. */
export async function GET(_request: Request, { params }: RouteParams) {
  const { id, creditId } = await params;

  // RLS applies: without affiliates.read / credits.read nothing is visible.
  const supabase = await createClient();
  const [affiliate, { data: clearance }] = await Promise.all([
    getAffiliateById(id),
    supabase
      .from("credit_clearances")
      .select("clearance_number, settlement, settled_on, issued_on, total_paid")
      .eq("credit_id", creditId)
      .maybeSingle(),
  ]);
  const credit = affiliate?.credits?.find((item) => item.id === creditId);
  if (!affiliate || !credit || !clearance) {
    return NextResponse.json({ message: "Paz y salvo no encontrado o sin permiso para consultarlo." }, { status: 404 });
  }

  const pdf = await renderCreditClearancePdf({
    affiliateName: getFullName(affiliate),
    affiliateDocument: `${affiliate.documentType} ${affiliate.documentNumber}`,
    source: affiliate.source,
    municipality: affiliate.municipality || null,
    credit,
    clearance: {
      number: Number(clearance.clearance_number),
      settlement: clearance.settlement as "paid" | "forgiven",
      settledOn: clearance.settled_on as string,
      issuedOn: clearance.issued_on as string,
      totalPaid: Number(clearance.total_paid),
    },
    installments: credit.installments.map((installment) => ({
      receiptNumber: installment.receiptNumber ?? null,
      paidOn: installment.paidOn,
      amount: installment.amount,
      capitalPortion: installment.capitalPortion,
      interestPortion: installment.interestPortion,
      method: installment.paymentMethod ?? null,
      observation: installment.observation,
    })),
  });

  const fileName = `paz-y-salvo-${affiliate.documentNumber}-PS-${clearance.clearance_number}.pdf`.replace(/[^\w.-]+/g, "-");
  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${fileName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
