export type NoteFormState = {
  status: "idle" | "error" | "unavailable";
  message?: string;
};

export const initialNoteFormState: NoteFormState = { status: "idle" };
