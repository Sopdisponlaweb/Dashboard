import type { BeneficiaryFormField, BeneficiaryFormValues } from "./validation";

export type BeneficiaryActionState = {
  status: "idle" | "error" | "unavailable";
  message?: string;
  fieldErrors?: Partial<Record<BeneficiaryFormField, string[]>>;
  values?: BeneficiaryFormValues;
};

export const initialBeneficiaryActionState: BeneficiaryActionState = { status: "idle" };
