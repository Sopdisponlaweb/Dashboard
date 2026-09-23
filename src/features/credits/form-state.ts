export type CreditFormState = {
  status: "idle" | "error" | "unavailable";
  message?: string;
};

export const initialCreditFormState: CreditFormState = { status: "idle" };
