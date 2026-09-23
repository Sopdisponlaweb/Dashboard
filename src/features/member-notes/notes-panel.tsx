"use client";

import { useActionState } from "react";

import { Icon } from "@/components/icons";

import { initialNoteFormState, type NoteFormState } from "./form-state";
import type { MemberNote } from "./repository";

type CreateNoteAction = (state: NoteFormState, formData: FormData) => Promise<NoteFormState>;

type NotesPanelProps = {
  notes: MemberNote[];
  createAction: CreateNoteAction;
  persistenceEnabled: boolean;
};

const dateTimeFormatter = new Intl.DateTimeFormat("es-CO", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "America/Bogota",
});

export function NotesPanel({ notes, createAction, persistenceEnabled }: NotesPanelProps) {
  const [state, formAction, pending] = useActionState(createAction, initialNoteFormState);

  return (
    <div className="member-notes">
      <form action={formAction} className="note-create-form">
        <textarea name="body" rows={3} placeholder="Escribe una nueva observación..." required maxLength={2000} />
        {state.status === "error" && state.message ? (
          <div className="form-message message-error" role="alert"><Icon name="activity" size={14} /><span>{state.message}</span></div>
        ) : null}
        {state.status === "unavailable" && state.message ? (
          <div className="form-message message-unavailable" role="status"><Icon name="lock" size={14} /><span>{state.message}</span></div>
        ) : null}
        <button className="secondary-button" type="submit" disabled={pending || !persistenceEnabled}>
          {pending ? "Guardando…" : "Agregar observación"}
        </button>
      </form>

      {notes.length ? (
        <ul className="notes-log">
          {notes.map((note) => (
            <li key={note.id}>
              <p>{note.body}</p>
              <div className="notes-log-meta">
                <span>{note.authorName ?? "Sistema"} · {dateTimeFormatter.format(new Date(note.createdAt))}</span>
              </div>
            </li>
          ))}
        </ul>
      ) : <p className="inline-empty">Aún no hay observaciones registradas.</p>}
    </div>
  );
}
