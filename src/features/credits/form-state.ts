export type CreditFormState = {
  status: "idle" | "error" | "unavailable" | "created";
  message?: string;
  installmentId?: string;
  receiptNumber?: number;
};

export const initialCreditFormState: CreditFormState = { status: "idle" };
