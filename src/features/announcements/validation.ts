import { z } from "zod";

const isoDate = /^\d{4}-\d{2}-\d{2}$/;

function isValidIsoDate(value: string) {
  if (!isoDate.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

export const announcementFormSchema = z.object({
  title: z.string().trim().min(3, "Escribe un título.").max(140, "Máximo 140 caracteres."),
  message: z.string().trim().min(10, "Escribe el mensaje del aviso.").max(600, "Máximo 600 caracteres."),
  startsOn: z.string().refine(isValidIsoDate, "Ingresa una fecha de inicio válida."),
  endsOn: z.string().refine(isValidIsoDate, "Ingresa una fecha de cierre válida."),
  isPublished: z.boolean(),
}).superRefine((values, context) => {
  if (values.endsOn <= values.startsOn) {
    context.addIssue({ code: "custom", path: ["endsOn"], message: "La fecha de cierre debe ser posterior al inicio." });
  }
});

export type AnnouncementFormValues = z.infer<typeof announcementFormSchema>;
export type AnnouncementFormField = keyof AnnouncementFormValues;

export function announcementValuesFromFormData(formData: FormData): AnnouncementFormValues {
  return {
    title: String(formData.get("title") ?? ""),
    message: String(formData.get("message") ?? ""),
    startsOn: String(formData.get("startsOn") ?? ""),
    endsOn: String(formData.get("endsOn") ?? ""),
    isPublished: formData.get("isPublished") === "on",
  };
}
