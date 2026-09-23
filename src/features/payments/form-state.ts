export type PaymentFormState = {
  status: "idle" | "error" | "unavailable";
  message?: string;
};

export const initialPaymentFormState: PaymentFormState = { status: "idle" };
