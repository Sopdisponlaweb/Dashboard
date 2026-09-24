export type CreditFormState = {
  status: "idle" | "error" | "unavailable" | "created";
  message?: string;
  installmentId?: string;
  receiptNumber?: number;
};

export const initialCreditFormState: CreditFormState = { status: "idle" };

export type ClearanceFormState = {
  status: "idle" | "error" | "issued";
  message?: string;
  clearanceNumber?: number;
};

export const initialClearanceFormState: ClearanceFormState = { status: "idle" };
