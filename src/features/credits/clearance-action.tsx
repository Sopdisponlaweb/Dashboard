"use client";

import { useActionState } from "react";

import { Icon } from "@/components/icons";
import { formatClearanceNumber } from "@/features/affiliates/format";

import { initialClearanceFormState, type ClearanceFormState } from "./form-state";

type ClearanceAction = (state: ClearanceFormState, formData: FormData) => Promise<ClearanceFormState>;

/** Link to the credit's paz y salvo, or a button that issues it first. */
export function ClearanceAction({ action, pdfHref, issuedNumber }: { action: ClearanceAction; pdfHref: string; issuedNumber: number | null }) {
  const [state, formAction, pending] = useActionState(action, initialClearanceFormState);
  const number = issuedNumber ?? state.clearanceNumber ?? null;

  if (number) {
    return (
      <a className="panel-link clearance-link" href={pdfHref} target="_blank" rel="noopener">
        <Icon name="file" size={14} /> Paz y salvo {formatClearanceNumber(number)}
      </a>
    );
  }

  return (
    <form action={formAction} className="clearance-form">
      <button className="secondary-button" type="submit" disabled={pending}>
        <Icon name="file" size={15} /> {pending ? "Emitiendo…" : "Generar paz y salvo"}
      </button>
      {state.status === "error" && state.message ? <span className="field-error" role="alert">{state.message}</span> : null}
    </form>
  );
}
