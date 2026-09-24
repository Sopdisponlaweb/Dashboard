export type PaymentFormState = {
  status: "idle" | "error" | "unavailable" | "created";
  message?: string;
  receiptId?: string;
  receiptNumber?: number;
};

export const initialPaymentFormState: PaymentFormState = { status: "idle" };
