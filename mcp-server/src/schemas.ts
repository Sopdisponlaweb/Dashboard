import { z } from "zod";

// Estos esquemas reflejan las mismas reglas que ya validan
// src/features/payments/actions.ts, src/features/credits/actions.ts y la confirmación
// de identidad en src/features/ai-extraction/actions.ts. No se importan directamente
// porque esos archivos son "use server" y arrastran next/headers, incompatible con un
// proceso Node independiente — ver nota en lib/calculations.ts.

export const sourceValues = ["particular", "activo", "casur", "tegen", "inpec", "ordisponal"] as const;
export const paymentStatusValues = ["paid", "pending", "reversed"] as const;
export const documentTypeValues = ["CC", "CE", "TI"] as const;

const amountString = z
  .string()
  .regex(/^\d+(\.\d{1,2})?$/, "Ingresa un valor numérico válido (ej. 10000 o 10000.50).");

export const registerPaymentSchema = z.object({
  affiliateId: z.string().uuid("El id del afiliado debe ser un uuid válido."),
  period: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "El periodo debe tener formato YYYY-MM."),
  source: z.enum(sourceValues),
  amount: amountString.refine((value) => Number(value) > 0, "El valor debe ser mayor a cero."),
  status: z.enum(paymentStatusValues).default("paid"),
  paidOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  observation: z.string().max(500).optional(),
});

export const requestCreditSchema = z.object({
  affiliateId: z.string().uuid("El id del afiliado debe ser un uuid válido."),
  disbursedAmount: amountString.refine((value) => Number(value) > 0, "El monto debe ser mayor a cero."),
  interestRatePercent: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, "Ingresa una tasa numérica válida.")
    .refine((value) => Number(value) > 0 && Number(value) <= 100, "La tasa debe estar entre 0 y 100%."),
  termMonths: z
    .string()
    .regex(/^\d+$/, "Ingresa un plazo en meses válido.")
    .refine((value) => Number(value) > 0, "El plazo debe ser mayor a cero."),
  observations: z.string().max(500).optional(),
});

export const registerCreditInstallmentSchema = z.object({
  affiliateId: z.string().uuid("El id del afiliado debe ser un uuid válido."),
  creditId: z.string().uuid("El id del crédito debe ser un uuid válido."),
  paidOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha debe tener formato YYYY-MM-DD."),
  amount: amountString.refine((value) => Number(value) > 0, "El valor debe ser mayor a cero."),
  observation: z.string().max(500).optional(),
});

export const updateAffiliateIdentitySchema = z.object({
  affiliateId: z.string().uuid("El id del afiliado debe ser un uuid válido."),
  documentType: z.enum(documentTypeValues),
  documentNumber: z.string().trim().min(5, "Documento inválido.").max(24)
    .regex(/^[\p{L}\p{N}.\-\s]+$/u, "Usa solo letras, números, puntos o guiones."),
  firstNames: z.string().trim().min(2).max(100),
  lastNames: z.string().trim().min(2).max(100),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  documentIssuedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});
