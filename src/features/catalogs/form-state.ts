export type CatalogFormState = {
  status: "idle" | "error" | "unavailable" | "created";
  message?: string;
};

export const initialCatalogFormState: CatalogFormState = { status: "idle" };
