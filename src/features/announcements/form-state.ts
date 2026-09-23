import type { AnnouncementFormField, AnnouncementFormValues } from "./validation";

export type AnnouncementActionState = {
  status: "idle" | "error" | "unavailable";
  message?: string;
  fieldErrors?: Partial<Record<AnnouncementFormField, string[]>>;
  values?: AnnouncementFormValues;
};

export const initialAnnouncementActionState: AnnouncementActionState = { status: "idle" };
