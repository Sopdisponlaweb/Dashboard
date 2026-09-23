import { z } from "zod";

const isoDate = /^\d{4}-\d{2}-\d{2}$/;
const documentTypes = ["CC", "CE", "TI"] as const;
const beneficiaryStatuses = ["active", "inactive", "suspended", "deceased"] as const;

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

export const beneficiaryFormSchema = z.object({
  relationship: z.string().trim().min(2, "Indica el parentesco o relación.").max(80, "Máximo 80 caracteres."),
  documentType: z.enum(documentTypes, { error: "Selecciona un tipo de documento." }),
  documentNumber: z.string()
    .trim()
    .max(24, "Máximo 24 caracteres.")
    .regex(/^$|^[\p{L}\p{N}.\-\s]+$/u, "Usa solo letras, números, puntos o guiones."),
  documentIssuedOn: z.string(),
  firstNames: z.string().trim().min(2, "Ingresa los nombres.").max(100, "Máximo 100 caracteres."),
  lastNames: z.string().trim().min(2, "Ingresa los apellidos.").max(100, "Máximo 100 caracteres."),
  birthDate: z.string().refine(isValidIsoDate, "Ingresa una fecha de nacimiento válida."),
  phone: optionalText(30),
  email: z.union([
    z.literal(""),
    z.email("Ingresa un correo electrónico válido.").max(160, "Máximo 160 caracteres."),
  ]),
  joinedOn: z.string().refine(isValidIsoDate, "Ingresa una fecha de vinculación válida."),
  status: z.enum(beneficiaryStatuses, { error: "Selecciona un estado." }),
  deceasedOn: z.string(),
  deathMunicipalityId: optionalText(60),
  deathRegistryNumber: optionalText(40),
  deathNotary: optionalText(120),
  deathServiceProvided: optionalText(120),
  deathServiceAmount: optionalText(20),
  successorBank: optionalText(80),
  successorAccountNumber: optionalText(40),
  successorAccountType: z.enum(["", "ahorros", "corriente"]),
}).superRefine((values, context) => {
  const today = todayInBogota();

  if (values.birthDate > today) {
    context.addIssue({ code: "custom", path: ["birthDate"], message: "La fecha de nacimiento no puede estar en el futuro." });
  }
  if (values.documentIssuedOn && !isValidIsoDate(values.documentIssuedOn)) {
    context.addIssue({ code: "custom", path: ["documentIssuedOn"], message: "Ingresa una fecha de expedición válida." });
  }
  if (values.documentIssuedOn && values.documentIssuedOn > today) {
    context.addIssue({ code: "custom", path: ["documentIssuedOn"], message: "La expedición no puede estar en el futuro." });
  }
  if (values.documentIssuedOn && values.documentIssuedOn < values.birthDate) {
    context.addIssue({ code: "custom", path: ["documentIssuedOn"], message: "La expedición no puede ser anterior al nacimiento." });
  }
  if (values.joinedOn > today) {
    context.addIssue({ code: "custom", path: ["joinedOn"], message: "La vinculación no puede quedar en el futuro." });
  }
  if (values.status === "deceased" && values.deceasedOn && !isValidIsoDate(values.deceasedOn)) {
    context.addIssue({ code: "custom", path: ["deceasedOn"], message: "Ingresa una fecha de fallecimiento válida." });
  }
  if (values.status !== "deceased" && values.deceasedOn) {
    context.addIssue({ code: "custom", path: ["deceasedOn"], message: "La fecha solo aplica al estado fallecido." });
  }
  if (values.deceasedOn && values.deceasedOn > today) {
    context.addIssue({ code: "custom", path: ["deceasedOn"], message: "La fecha de fallecimiento no puede estar en el futuro." });
  }
  if (values.deathServiceAmount && (!/^\d+(\.\d{1,2})?$/.test(values.deathServiceAmount) || Number(values.deathServiceAmount) < 0)) {
    context.addIssue({ code: "custom", path: ["deathServiceAmount"], message: "Ingresa un valor numérico válido." });
  }
});

export type BeneficiaryFormValues = z.infer<typeof beneficiaryFormSchema>;
export type BeneficiaryFormField = keyof BeneficiaryFormValues;

export function normalizeDocumentNumber(value: string) {
  return value.replace(/[^\p{L}\p{N}]/gu, "").toLocaleUpperCase("es-CO");
}

export function beneficiaryValuesFromFormData(formData: FormData): BeneficiaryFormValues {
  const value = (name: BeneficiaryFormField) => String(formData.get(name) ?? "");

  return {
    relationship: value("relationship"),
    documentType: value("documentType") as BeneficiaryFormValues["documentType"],
    documentNumber: value("documentNumber"),
    documentIssuedOn: value("documentIssuedOn"),
    firstNames: value("firstNames"),
    lastNames: value("lastNames"),
    birthDate: value("birthDate"),
    phone: value("phone"),
    email: value("email"),
    joinedOn: value("joinedOn"),
    status: value("status") as BeneficiaryFormValues["status"],
    deceasedOn: value("deceasedOn"),
    deathMunicipalityId: value("deathMunicipalityId"),
    deathRegistryNumber: value("deathRegistryNumber"),
    deathNotary: value("deathNotary"),
    deathServiceProvided: value("deathServiceProvided"),
    deathServiceAmount: value("deathServiceAmount"),
    successorBank: value("successorBank"),
    successorAccountNumber: value("successorAccountNumber"),
    successorAccountType: value("successorAccountType") as BeneficiaryFormValues["successorAccountType"],
  };
}
