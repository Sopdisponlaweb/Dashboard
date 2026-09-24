import { NextResponse } from "next/server";

import { formatCreditReceiptNumber } from "@/features/affiliates/format";
import type { AffiliationSource, CreditStatus } from "@/features/affiliates/types";
import { byPaymentOrder, type CreditPdfInstallment } from "@/features/credits/credit-pdf-data";
import { renderCreditReceiptPdf } from "@/features/credits/credit-receipt-pdf";
import { createClient } from "@/lib/supabase/server";

type RouteParams = { params: Promise<{ installmentId: string }> };

type InstallmentRow = {
  id: string;
  receipt_number: number;
  created_at: string;
  paid_on: string;
  amount: number | string;
  capital_portion: number | string;
  interest_portion: number | string;
  observation: string | null;
  payment_method: { name: string } | null;
  creator: { display_name: string | null } | null;
  credit: {
    requested_on: string;
    status: CreditStatus;
    disbursed_amount: number | string;
    rolled_over_capital: number | string;
    rolled_over_interest: number | string;
    principal_base: number | string;
    interest_rate: number | string;
    term_months: number;
    interest_amount: number | string;
    total_amount: number | string;
    installment_amount: number | string;
    credit_installments: { id: string; receipt_number: number; paid_on: string; amount: number | string }[];
    affiliate: {
      first_names: string;
      last_names: string;
      document_type: string;
      document_number: string;
      source: AffiliationSource;
      municipality: { name: string; department: string } | null;
    } | null;
  } | null;
};

export async function GET(_request: Request, { params }: RouteParams) {
  const { installmentId } = await params;
  const supabase = await createClient();

  // RLS limits this to users with credits.read.
  const { data, error } = await supabase
    .from("credit_installments")
    .select(`
      id, receipt_number, created_at, paid_on, amount, capital_portion, interest_portion, observation,
      payment_method:payment_methods(name),
      creator:profiles(display_name),
      credit:credits(requested_on, status, disbursed_amount, rolled_over_capital, rolled_over_interest,
        principal_base, interest_rate, term_months, interest_amount, total_amount, installment_amount,
        credit_installments(id, receipt_number, paid_on, amount),
        affiliate:affiliates!credits_affiliate_id_fkey(first_names, last_names, document_type, document_number, source,
          municipality:municipalities!municipality_id(name, department)))
    `)
    .eq("id", installmentId)
    .maybeSingle();

  const row = data as unknown as InstallmentRow | null;
  if (error || !row?.credit?.affiliate) {
    return NextResponse.json({ message: "Abono no encontrado o sin permiso para consultarlo." }, { status: 404 });
  }

  const { credit } = row;
  const affiliate = credit.affiliate!;
  const current: CreditPdfInstallment & { receiptNumber: number } = {
    receiptNumber: row.receipt_number,
    paidOn: row.paid_on,
    amount: Number(row.amount),
    capitalPortion: Number(row.capital_portion),
    interestPortion: Number(row.interest_portion),
    method: row.payment_method?.name ?? null,
    observation: row.observation,
  };

  // Balance right after this abono: total minus every abono up to and including it.
  const ordered = credit.credit_installments
    .map((item) => ({ id: item.id, amount: Number(item.amount), receiptNumber: item.receipt_number, paidOn: item.paid_on }))
    .sort(byPaymentOrder);
  const position = ordered.findIndex((item) => item.id === row.id);
  const paidThrough = ordered.slice(0, position + 1).reduce((sum, item) => sum + item.amount, 0);
  const totalAmount = Number(credit.total_amount);
  const balanceAfter = Math.max(Math.round((totalAmount - paidThrough) * 100) / 100, 0);

  const pdf = await renderCreditReceiptPdf({
    affiliateName: `${affiliate.first_names} ${affiliate.last_names}`.trim() || "Sin nombre registrado",
    affiliateDocument: `${affiliate.document_type} ${affiliate.document_number}`,
    source: affiliate.source,
    municipality: affiliate.municipality ? `${affiliate.municipality.name}, ${affiliate.municipality.department}` : null,
    credit: {
      requestedOn: credit.requested_on,
      status: credit.status,
      disbursedAmount: Number(credit.disbursed_amount),
      rolledOverCapital: Number(credit.rolled_over_capital),
      rolledOverInterest: Number(credit.rolled_over_interest),
      principalBase: Number(credit.principal_base),
      interestRate: Number(credit.interest_rate),
      termMonths: credit.term_months,
      interestAmount: Number(credit.interest_amount),
      totalAmount,
      installmentAmount: Number(credit.installment_amount),
    },
    createdAt: row.created_at,
    installment: current,
    registeredBy: row.creator?.display_name ?? null,
    balanceBefore: Math.round((balanceAfter + current.amount) * 100) / 100,
    balanceAfter,
  });

  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="soporte-${formatCreditReceiptNumber(row.receipt_number)}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
