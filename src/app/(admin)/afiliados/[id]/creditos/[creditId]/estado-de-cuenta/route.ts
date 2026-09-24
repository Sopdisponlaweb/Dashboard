import { NextResponse } from "next/server";

import { getFullName } from "@/features/affiliates/format";
import { getAffiliateById } from "@/features/affiliates/repository";
import { renderCreditStatementPdf } from "@/features/credits/credit-statement-pdf";

type RouteParams = { params: Promise<{ id: string; creditId: string }> };

export async function GET(_request: Request, { params }: RouteParams) {
  const { id, creditId } = await params;

  // RLS applies: without affiliates.read / credits.read the credit is not visible.
  const affiliate = await getAffiliateById(id);
  const credit = affiliate?.credits?.find((item) => item.id === creditId);
  if (!affiliate || !credit) {
    return NextResponse.json({ message: "Crédito no encontrado o sin permiso para consultarlo." }, { status: 404 });
  }

  const pdf = await renderCreditStatementPdf({
    generatedAt: new Date(),
    affiliateName: getFullName(affiliate),
    affiliateDocument: `${affiliate.documentType} ${affiliate.documentNumber}`,
    source: affiliate.source,
    municipality: affiliate.municipality || null,
    credit,
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

  const fileName = `estado-de-cuenta-credito-${affiliate.documentNumber}-${credit.requestedOn}.pdf`.replace(/[^\w.-]+/g, "-");
  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${fileName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
