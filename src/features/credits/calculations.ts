function round2(value: number) {
  return Math.round(value * 100) / 100;
}

export type CreditTerms = {
  disbursedAmount: number;
  rolledOverCapital: number;
  rolledOverInterest: number;
  rate: number;
  termMonths: number;
};

export type CreditCalculation = {
  principalBase: number;
  interestAmount: number;
  totalAmount: number;
  installmentAmount: number;
};

export function calculateCredit({ disbursedAmount, rolledOverCapital, rolledOverInterest, rate, termMonths }: CreditTerms): CreditCalculation {
  const principalBase = round2(disbursedAmount + rolledOverCapital + rolledOverInterest);
  const interestAmount = round2(principalBase * rate);
  const totalAmount = round2(principalBase + interestAmount);
  const installmentAmount = termMonths > 0 ? round2(totalAmount / termMonths) : 0;
  return { principalBase, interestAmount, totalAmount, installmentAmount };
}

export type SplitPaymentInput = {
  principalBase: number;
  totalAmount: number;
  amount: number;
};

export function splitPayment({ principalBase, totalAmount, amount }: SplitPaymentInput) {
  if (totalAmount <= 0) return { capitalPortion: 0, interestPortion: 0 };
  const capitalPortion = round2(amount * (principalBase / totalAmount));
  const interestPortion = round2(amount - capitalPortion);
  return { capitalPortion, interestPortion };
}

export type BalanceCredit = {
  principalBase: number;
  interestAmount: number;
  totalAmount: number;
};

export type BalanceInstallment = {
  capitalPortion: number;
  interestPortion: number;
};

export function remainingBalance(credit: BalanceCredit, installments: BalanceInstallment[]) {
  const paidCapital = installments.reduce((sum, item) => sum + item.capitalPortion, 0);
  const paidInterest = installments.reduce((sum, item) => sum + item.interestPortion, 0);
  const remainingCapital = Math.max(round2(credit.principalBase - paidCapital), 0);
  const remainingInterest = Math.max(round2(credit.interestAmount - paidInterest), 0);
  return {
    remainingCapital,
    remainingInterest,
    remainingTotal: round2(remainingCapital + remainingInterest),
    paidCapital: round2(paidCapital),
    paidInterest: round2(paidInterest),
  };
}
