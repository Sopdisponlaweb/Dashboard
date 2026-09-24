"use client";

import { useActionState } from "react";

import { Icon } from "@/components/icons";

import { initialSuccessionFormState, type SuccessionFormState } from "./types";

type AnnulAction = (state: SuccessionFormState, formData: FormData) => Promise<SuccessionFormState>;

/** Administrator-only: undoes the succession after a written reason. */
export function AnnulSuccessionForm({ action, deceasedName }: { action: AnnulAction; deceasedName: string }) {
  const [state, formAction, pending] = useActionState(action, initialSuccessionFormState);

  return (
    <details className="annul-succession">
      <summary><Icon name="history" size={14} /> Anular sucesión</summary>
      <form
        action={formAction}
        onSubmit={(event) => {
          if (!window.confirm(`¿Anular la sucesión de ${deceasedName}? Los beneficiarios y el crédito vuelven al fallecido.`)) event.preventDefault();
        }}
      >
        <p>
          Los beneficiarios transferidos y el crédito heredado vuelven al fallecido (el crédito queda en pausa). Si el sucesor se creó con
          esta sucesión y no tiene pagos ni otros registros propios, se elimina. Queda constancia en la auditoría.
        </p>
        <label className="form-field">
          <span>Motivo de la anulación <em>*</em></span>
          <textarea name="reason" rows={2} maxLength={500} required placeholder="Ej. Se registró un sucesor equivocado." />
        </label>
        {state.status !== "idle" && state.message ? (
          <div className="form-message message-error" role="alert"><Icon name="activity" size={14} /><span>{state.message}</span></div>
        ) : null}
        <button className="danger-button" type="submit" disabled={pending}>{pending ? "Anulando…" : "Anular sucesión"}</button>
      </form>
    </details>
  );
}
