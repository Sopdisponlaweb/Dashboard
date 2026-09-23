"use client";

import { useActionState } from "react";

import { Icon } from "@/components/icons";

import { initialDocumentUploadState, type DocumentUploadState } from "./form-state";

type UploadDocumentAction = (
  state: DocumentUploadState,
  formData: FormData,
) => Promise<DocumentUploadState>;

type UploadDocumentFormProps = {
  action: UploadDocumentAction;
};

export function UploadDocumentForm({ action }: UploadDocumentFormProps) {
  const [state, formAction, pending] = useActionState<DocumentUploadState, FormData>(action, initialDocumentUploadState);

  return (
    <form action={formAction} className="upload-document-form">
      <label className="form-field form-field-compact">
        <span>Tipo de documento <em>*</em></span>
        <select name="kind" defaultValue={state.kind ?? "support"} required>
          <option value="resume">Hoja de vida</option>
          <option value="identity">Documento de identidad</option>
          <option value="support">Soporte</option>
          <option value="other">Otro</option>
        </select>
      </label>
      <label className="form-field form-field-compact">
        <span>Título <em>*</em></span>
        <input name="title" defaultValue={state.title} placeholder="Ej. Copia de cédula" required />
      </label>
      <label className="form-field form-field-compact">
        <span>Archivo PDF <em>*</em></span>
        <input name="file" type="file" accept="application/pdf,.pdf" required />
        <small>Máximo 15 MB, solo PDF.</small>
      </label>

      {state.status === "error" && state.message ? (
        <div className="form-message message-error" role="alert"><Icon name="activity" size={16} /><span>{state.message}</span></div>
      ) : null}
      {state.status === "unavailable" && state.message ? (
        <div className="form-message message-unavailable" role="status"><Icon name="lock" size={16} /><span>{state.fileName} · {state.fileSizeLabel} — {state.message}</span></div>
      ) : null}
      {state.status === "uploaded" && state.message ? (
        <div className="form-message message-success" role="status"><Icon name="lock" size={16} /><span>{state.fileName} · {state.fileSizeLabel} — {state.message}</span></div>
      ) : null}

      <button className="secondary-button" type="submit" disabled={pending}>{pending ? "Cargando…" : "Cargar documento"}</button>
    </form>
  );
}
