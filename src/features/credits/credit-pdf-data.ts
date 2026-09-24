import type { AffiliationSource, CreditStatus } from "@/features/affiliates/types";

/** Affiliate and credit terms shared by the abono receipt and the credit statement. */
export type CreditPdfContext = {
  affiliateName: string;
  affiliateDocument: string;
  source: AffiliationSource;
  municipality: string | null;
  credit: {
    requestedOn: string;
    status: CreditStatus;
    disbursedAmount: number;
    rolledOverCapital: number;
    rolledOverInterest: number;
    principalBase: number;
    interestRate: number;
    termMonths: number;
    interestAmount: number;
    totalAmount: number;
    installmentAmount: number;
  };
};

export type CreditPdfInstallment = {
  receiptNumber: number | null;
  paidOn: string;
  amount: number;
  capitalPortion: number;
  interestPortion: number;
  method: string | null;
  observation: string | null;
};

type Ordered = Pick<CreditPdfInstallment, "paidOn" | "receiptNumber">;

/** Orders abonos the way balances accumulate: by date, then by registration order. */
export function byPaymentOrder(a: Ordered, b: Ordered) {
  return a.paidOn.localeCompare(b.paidOn) || (a.receiptNumber ?? 0) - (b.receiptNumber ?? 0);
}
