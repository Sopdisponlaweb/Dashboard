import { NextResponse } from "next/server";

import { formatReceiptNumber } from "@/features/affiliates/format";
import type { AffiliationSource, PaymentStatus } from "@/features/affiliates/types";
import { renderReceiptPdf } from "@/features/payments/receipt-pdf";
import { createClient } from "@/lib/supabase/server";

type RouteParams = { params: Promise<{ receiptId: string }> };

type ReceiptRow = {
  receipt_number: number;
  created_at: string;
  source: AffiliationSource;
  period_from: string;
  period_to: string;
  months_count: number;
  monthly_amount: number | string;
  total_amount: number | string;
  status: PaymentStatus;
  paid_on: string | null;
  observations: string | null;
  affiliate: {
    first_names: string;
    last_names: string;
    document_type: string;
    document_number: string;
    municipality: { name: string; department: string } | null;
  } | null;
  payment_method: { name: string } | null;
  creator: { display_name: string | null } | null;
};

export async function GET(_request: Request, { params }: RouteParams) {
  const { receiptId } = await params;
  const supabase = await createClient();

  // RLS limits this to users with payments.read.
  const { data, error } = await supabase
    .from("payment_receipts")
    .select(`
      receipt_number, created_at, source, period_from, period_to, months_count,
      monthly_amount, total_amount, status, paid_on, observations,
      affiliate:affiliates(first_names, last_names, document_type, document_number,
        municipality:municipalities!municipality_id(name, department)),
      payment_method:payment_methods(name),
      creator:profiles(display_name)
    `)
    .eq("id", receiptId)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ message: "Recibo no encontrado o sin permiso para consultarlo." }, { status: 404 });
  }

  const row = data as unknown as ReceiptRow;
  const affiliate = row.affiliate;
  const pdf = await renderReceiptPdf({
    receiptNumber: row.receipt_number,
    createdAt: row.created_at,
    affiliateName: affiliate ? `${affiliate.first_names} ${affiliate.last_names}`.trim() : "Sin nombre registrado",
    affiliateDocument: affiliate ? `${affiliate.document_type} ${affiliate.document_number}` : "Sin registrar",
    municipality: affiliate?.municipality ? `${affiliate.municipality.name}, ${affiliate.municipality.department}` : null,
    source: row.source,
    periodFrom: row.period_from.slice(0, 7),
    periodTo: row.period_to.slice(0, 7),
    monthsCount: row.months_count,
    monthlyAmount: Number(row.monthly_amount),
    totalAmount: Number(row.total_amount),
    status: row.status,
    paidOn: row.paid_on,
    paymentMethod: row.payment_method?.name ?? "Sin registrar",
    observations: row.observations,
    registeredBy: row.creator?.display_name ?? null,
  });

  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      // inline: opens in the browser's PDF viewer, ready to print or save.
      "Content-Disposition": `inline; filename="soporte-${formatReceiptNumber(row.receipt_number)}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
