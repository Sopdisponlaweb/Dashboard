"use client";

import { useActionState } from "react";

import { Icon } from "@/components/icons";

import { initialDocumentUploadState, type DocumentUploadState } from "./form-state";

type UploadDocumentAction = (
  state: DocumentUploadState,
  formData: FormData,
) => Promise<DocumentUploadState>;

/** A person the file can belong to; value "" is the titular. */
export type DocumentOwnerOption = { value: string; label: string };

type UploadDocumentFormProps = {
  action: UploadDocumentAction;
  /** Shows a "Pertenece a" selector (titular and beneficiaries). */
  owners?: DocumentOwnerOption[];
  /** Fixes the owner to one beneficiary (no selector). */
  beneficiaryId?: string;
};

export function UploadDocumentForm({ action, owners, beneficiaryId }: UploadDocumentFormProps) {
  const [state, formAction, pending] = useActionState<DocumentUploadState, FormData>(action, initialDocumentUploadState);
  const showOwners = !beneficiaryId && owners && owners.length > 1;

  return (
    <form action={formAction} className="upload-document-form">
      {beneficiaryId ? <input type="hidden" name="beneficiaryId" value={beneficiaryId} /> : null}
      {showOwners ? (
        <label className="form-field form-field-compact">
          <span>Pertenece a <em>*</em></span>
          <select name="beneficiaryId" defaultValue={state.beneficiaryId ?? ""} key={state.beneficiaryId ?? ""}>
            {owners.map((owner) => <option key={owner.value} value={owner.value}>{owner.label}</option>)}
          </select>
        </label>
      ) : null}
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
        <span>Archivo <em>*</em></span>
        <input name="file" type="file" accept="application/pdf,.pdf,image/png,.png,image/jpeg,.jpg,.jpeg" required />
        <small>PDF, PNG o JPG. Máximo 15 MB.</small>
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
