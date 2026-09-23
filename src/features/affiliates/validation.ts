import { z } from "zod";

const isoDate = /^\d{4}-\d{2}-\d{2}$/;
const documentTypes = ["CC", "CE", "TI"] as const;
const affiliationSources = ["particular", "activo", "casur", "tegen", "inpec", "ordisponal"] as const;
const affiliateStatuses = ["active", "inactive", "suspended", "deceased"] as const;

function optionalText(maxLength: number) {
  return z.string().trim().max(maxLength, `Máximo ${maxLength} caracteres.`);
}

function isValidIsoDate(value: string) {
  if (!isoDate.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

function todayInBogota() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export const affiliateFormSchema = z.object({
  documentType: z.enum(documentTypes, { error: "Selecciona un tipo de documento." }),
  documentNumber: z.string()
    .trim()
    .min(5, "Ingresa un documento válido.")
    .max(24, "Máximo 24 caracteres.")
    .regex(/^[\p{L}\p{N}.\-\s]+$/u, "Usa solo letras, números, puntos o guiones."),
  documentIssuedOn: z.string(),
  firstNames: z.string().trim().min(2, "Ingresa los nombres.").max(100, "Máximo 100 caracteres."),
  lastNames: z.string().trim().min(2, "Ingresa los apellidos.").max(100, "Máximo 100 caracteres."),
  birthDate: z.string(),
  phone: optionalText(30),
  email: z.union([
    z.literal(""),
    z.email("Ingresa un correo electrónico válido.").max(160, "Máximo 160 caracteres."),
  ]),
  address: optionalText(180),
  source: z.enum(affiliationSources, { error: "Selecciona el tipo de afiliación." }),
  status: z.enum(affiliateStatuses, { error: "Selecciona un estado." }),
  joinedOn: z.string().refine(isValidIsoDate, "Ingresa una fecha de afiliación válida."),
  deceasedOn: z.string(),
  successorResolutionNumber: optionalText(30),
  successorDocumentNumber: optionalText(24),
  successorFirstNames: optionalText(100),
  successorLastNames: optionalText(100),
  successorPhone: optionalText(30),
  deathMunicipalityId: optionalText(60),
  deathRegistryNumber: optionalText(40),
  deathNotary: optionalText(120),
  deathServiceProvided: optionalText(120),
  deathServiceAmount: optionalText(20),
  successorBank: optionalText(80),
  successorAccountNumber: optionalText(40),
  successorAccountType: z.enum(["", "ahorros", "corriente"]),
  policeRankId: optionalText(60),
}).superRefine((values, context) => {
  const today = todayInBogota();

  if (values.birthDate && !isValidIsoDate(values.birthDate)) {
    context.addIssue({ code: "custom", path: ["birthDate"], message: "Ingresa una fecha de nacimiento válida." });
  } else if (values.birthDate > today) {
    context.addIssue({ code: "custom", path: ["birthDate"], message: "La fecha de nacimiento no puede estar en el futuro." });
  }
  if (values.documentIssuedOn && !isValidIsoDate(values.documentIssuedOn)) {
    context.addIssue({ code: "custom", path: ["documentIssuedOn"], message: "Ingresa una fecha de expedición válida." });
  } else if (values.documentIssuedOn > today) {
    context.addIssue({ code: "custom", path: ["documentIssuedOn"], message: "La expedición no puede estar en el futuro." });
  } else if (values.documentIssuedOn && values.birthDate && values.documentIssuedOn < values.birthDate) {
    context.addIssue({ code: "custom", path: ["documentIssuedOn"], message: "La expedición no puede ser anterior al nacimiento." });
  }
  if (values.joinedOn > today) {
    context.addIssue({ code: "custom", path: ["joinedOn"], message: "La afiliación no puede quedar en el futuro." });
  }
  if (values.deathServiceAmount && (!/^\d+(\.\d{1,2})?$/.test(values.deathServiceAmount) || Number(values.deathServiceAmount) < 0)) {
    context.addIssue({ code: "custom", path: ["deathServiceAmount"], message: "Ingresa un valor numérico válido." });
  }
  if (values.status === "deceased" && !isValidIsoDate(values.deceasedOn)) {
    context.addIssue({ code: "custom", path: ["deceasedOn"], message: "Registra la fecha de fallecimiento." });
  }
  if (values.status !== "deceased" && values.deceasedOn) {
    context.addIssue({ code: "custom", path: ["deceasedOn"], message: "La fecha solo aplica al estado fallecido." });
  }
  if (values.deceasedOn && values.deceasedOn > today) {
    context.addIssue({ code: "custom", path: ["deceasedOn"], message: "La fecha de fallecimiento no puede estar en el futuro." });
  }
});

export type AffiliateFormValues = z.infer<typeof affiliateFormSchema>;
export type AffiliateFormField = keyof AffiliateFormValues;

export function normalizeDocumentNumber(value: string) {
  return value.replace(/[^\p{L}\p{N}]/gu, "").toLocaleUpperCase("es-CO");
}

export function affiliateValuesFromFormData(formData: FormData): AffiliateFormValues {
  const value = (name: AffiliateFormField) => String(formData.get(name) ?? "");

  return {
    documentType: value("documentType") as AffiliateFormValues["documentType"],
    documentNumber: value("documentNumber"),
    documentIssuedOn: value("documentIssuedOn"),
    firstNames: value("firstNames"),
    lastNames: value("lastNames"),
    birthDate: value("birthDate"),
    phone: value("phone"),
    email: value("email"),
    address: value("address"),
    source: value("source") as AffiliateFormValues["source"],
    status: value("status") as AffiliateFormValues["status"],
    joinedOn: value("joinedOn"),
    deceasedOn: value("deceasedOn"),
    successorResolutionNumber: value("successorResolutionNumber"),
    successorDocumentNumber: value("successorDocumentNumber"),
    successorFirstNames: value("successorFirstNames"),
    successorLastNames: value("successorLastNames"),
    successorPhone: value("successorPhone"),
    deathMunicipalityId: value("deathMunicipalityId"),
    deathRegistryNumber: value("deathRegistryNumber"),
    deathNotary: value("deathNotary"),
    deathServiceProvided: value("deathServiceProvided"),
    deathServiceAmount: value("deathServiceAmount"),
    successorBank: value("successorBank"),
    successorAccountNumber: value("successorAccountNumber"),
    successorAccountType: value("successorAccountType") as AffiliateFormValues["successorAccountType"],
    policeRankId: value("policeRankId"),
  };
}
