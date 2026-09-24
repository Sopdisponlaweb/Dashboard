import { NextResponse } from "next/server";

import { getFullName } from "@/features/affiliates/format";
import { getAffiliateById } from "@/features/affiliates/repository";
import { remainingBalance } from "@/features/credits/calculations";
import { renderSuccessionCertificatePdf } from "@/features/successions/certificate-pdf";
import { getAffiliateSuccessions } from "@/features/successions/repository";
import { createClient } from "@/lib/supabase/server";

type RouteParams = { params: Promise<{ id: string }> };

/** Certificate of the current succession of the deceased affiliate `id`. */
export async function GET(_request: Request, { params }: RouteParams) {
  const { id } = await params;
  const [deceased, successions] = await Promise.all([getAffiliateById(id), getAffiliateSuccessions(id)]);
  const succession = successions.asDeceased;
  if (!deceased || !succession) {
    return NextResponse.json({ message: "No hay una sucesión vigente para este afiliado." }, { status: 404 });
  }

  const supabase = await createClient();
  const [{ data: transferred }, successor, creditOwner] = await Promise.all([
    supabase
      .from("beneficiaries")
      .select("first_names, last_names, relationship, document_type, document_number, joined_on")
      .eq("succession_id", succession.id)
      .eq("inherited_from_affiliate_id", id)
      .order("last_names"),
    succession.successorId ? getAffiliateById(succession.successorId) : Promise.resolve(null),
    // An inherited credit now belongs to the successor; a paused one stays with the deceased.
    succession.creditDecision === "inherited" && succession.successorId ? getAffiliateById(succession.successorId) : Promise.resolve(deceased),
  ]);

  const credit = succession.creditId ? creditOwner?.credits?.find((item) => item.id === succession.creditId) ?? null : null;
  const paid = deceased.payments.filter((payment) => payment.status === "paid");

  const pdf = await renderSuccessionCertificatePdf({
    succession,
    deceased: {
      name: getFullName(deceased),
      document: `${deceased.documentType} ${deceased.documentNumber}`,
      source: deceased.source,
      joinedOn: deceased.joinedOn,
      deceasedOn: deceased.deceasedOn,
      lastPaymentOn: deceased.lastPaymentOn,
      paymentsCount: deceased.payments.length,
      totalPaid: paid.reduce((sum, payment) => sum + payment.amount, 0),
    },
    successorSource: successor?.source ?? null,
    beneficiaries: ((transferred ?? []) as Record<string, string | null>[]).map((row) => ({
      name: `${row.first_names ?? ""} ${row.last_names ?? ""}`.trim() || "Sin nombre registrado",
      relationship: row.relationship ?? "",
      document: row.document_number ? `${row.document_type ?? "CC"} ${row.document_number}` : "Sin registrar",
      joinedOn: row.joined_on ?? "",
    })),
    credit: credit ? { totalAmount: credit.totalAmount, remainingTotal: remainingBalance(credit, credit.installments).remainingTotal } : null,
  });

  const fileName = `constancia-sucesion-${deceased.documentNumber}.pdf`.replace(/[^\w.-]+/g, "-");
  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${fileName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
