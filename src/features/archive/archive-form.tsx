"use client";

import { useActionState } from "react";

import { Icon } from "@/components/icons";

import { archiveRetiredAffiliates, type ArchiveActionState } from "./actions";

const initialState: ArchiveActionState = { status: "idle" };

/** Confirmation step before the irreversible archive. */
export function ArchiveForm({ titulares }: { titulares: number }) {
  const [state, formAction, pending] = useActionState(archiveRetiredAffiliates, initialState);

  if (state.status === "done") {
    return <div className="form-message message-success" role="status"><Icon name="check" size={16} /><span>{state.message}</span></div>;
  }

  return (
    <form action={formAction} className="archive-form">
      <label className="archive-confirm">
        <input type="checkbox" name="confirm" disabled={!titulares || pending} />
        <span>Entiendo que se eliminan definitivamente sus pagos, beneficiarios, observaciones e historial, y que solo queda su cédula y nombre en el archivo.</span>
      </label>
      {state.status === "error" && state.message ? (
        <div className="form-message message-error" role="alert"><Icon name="alert" size={16} /><span>{state.message}</span></div>
      ) : null}
      <button className="danger-button" type="submit" disabled={!titulares || pending}>
        <Icon name="lock" size={15} /> {pending ? "Archivando…" : `Archivar ${titulares.toLocaleString("es-CO")} retirados`}
      </button>
    </form>
  );
}
