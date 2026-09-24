export type CatalogFormState = {
  status: "idle" | "error" | "unavailable" | "created" | "updated";
  message?: string;
};

export const initialCatalogFormState: CatalogFormState = { status: "idle" };
