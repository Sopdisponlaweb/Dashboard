import { NextResponse, type NextRequest } from "next/server";

import { getFullName } from "@/features/affiliates/format";
import { getAffiliateById } from "@/features/affiliates/repository";
import { renderAccountStatementPdf } from "@/features/payments/account-statement-pdf";

type RouteParams = { params: Promise<{ id: string }> };

const periodPattern = /^\d{4}-(0[1-9]|1[0-2])$/;

function monthIndex(period: string) {
  const [year, month] = period.split("-").map(Number);
  return year * 12 + (month - 1);
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const rawFrom = request.nextUrl.searchParams.get("desde") ?? "";
  const rawTo = request.nextUrl.searchParams.get("hasta") ?? "";
  let rangeFrom = periodPattern.test(rawFrom) ? rawFrom : null;
  let rangeTo = periodPattern.test(rawTo) ? rawTo : null;
  if (rangeFrom && rangeTo && rangeFrom > rangeTo) [rangeFrom, rangeTo] = [rangeTo, rangeFrom];

  // RLS applies: without affiliates.read / payments.read this returns nothing.
  const affiliate = await getAffiliateById(id);
  if (!affiliate) {
    return NextResponse.json({ message: "Afiliado no encontrado o sin permiso para consultarlo." }, { status: 404 });
  }

  const payments = affiliate.payments
    .filter((payment) => (!rangeFrom || payment.period >= rangeFrom) && (!rangeTo || payment.period <= rangeTo))
    .sort((a, b) => a.period.localeCompare(b.period) || a.source.localeCompare(b.source));

  const lastPaidPeriod = affiliate.payments
    .filter((payment) => payment.status === "paid")
    .reduce<string | null>((latest, payment) => (!latest || payment.period > latest ? payment.period : latest), null);

  // Same measure as private.refresh_membership_statuses: months elapsed since the
  // last paid month (or the affiliation month), so 3 = inactive and 6 = suspended.
  const generatedAt = new Date();
  const currentPeriod = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(generatedAt).slice(0, 7);
  const arrearsBase = lastPaidPeriod ?? affiliate.joinedOn?.slice(0, 7) ?? null;
  const monthsInArrears = arrearsBase ? Math.max(0, monthIndex(currentPeriod) - monthIndex(arrearsBase)) : null;

  const pdf = await renderAccountStatementPdf({
    generatedAt,
    affiliateName: getFullName(affiliate),
    affiliateDocument: `${affiliate.documentType} ${affiliate.documentNumber}`,
    source: affiliate.source,
    status: affiliate.status,
    joinedOn: affiliate.joinedOn,
    municipality: affiliate.municipality || null,
    rangeFrom,
    rangeTo,
    payments: payments.map((payment) => ({
      period: payment.period,
      source: payment.source,
      method: payment.paymentMethod ?? null,
      status: payment.status,
      paidOn: payment.paidOn,
      amount: payment.amount,
      receiptNumber: payment.receiptNumber ?? null,
    })),
    lastPaidPeriod,
    monthsInArrears,
  });

  const fileName = `estado-de-cuenta-${affiliate.documentNumber}.pdf`.replace(/[^\w.-]+/g, "-");
  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      // inline: opens in the browser's PDF viewer, ready to print or save.
      "Content-Disposition": `inline; filename="${fileName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
