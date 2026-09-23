import type { AffiliateFormField, AffiliateFormValues } from "./validation";

export type AffiliateActionState = {
  status: "idle" | "error" | "unavailable";
  message?: string;
  fieldErrors?: Partial<Record<AffiliateFormField, string[]>>;
  values?: AffiliateFormValues;
};

export const initialAffiliateActionState: AffiliateActionState = { status: "idle" };
