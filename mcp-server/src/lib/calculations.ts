// Copia exacta de src/features/credits/calculations.ts (módulo puro, sin dependencias de Next.js).
// Este servidor MCP corre como proceso Node independiente y no puede importar código
// acoplado a Next.js (server actions, cookies), así que las funciones puras se copian
// aquí verbatim. Si cambia la fórmula de interés/cuota en la app, replicar el cambio aquí.

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
