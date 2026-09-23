"use client";

import { useActionState } from "react";

import { Icon } from "@/components/icons";

import { initialCreditFormState, type CreditFormState } from "./form-state";

type RegisterInstallmentAction = (state: CreditFormState, formData: FormData) => Promise<CreditFormState>;

type InstallmentFormProps = {
  createAction: RegisterInstallmentAction;
  persistenceEnabled: boolean;
};

export function InstallmentForm({ createAction, persistenceEnabled }: InstallmentFormProps) {
  const [state, formAction, pending] = useActionState(createAction, initialCreditFormState);

  return (
    <details className="manual-payment">
      <summary><Icon name="plus" size={14} /> Registrar abono</summary>
      <form action={formAction} className="manual-payment-form">
        <div className="field-grid field-grid-three">
          <label className="form-field">
            <span>Fecha <em>*</em></span>
            <input type="date" name="paidOn" required defaultValue={new Date().toISOString().slice(0, 10)} />
          </label>
          <label className="form-field">
            <span>Valor <em>*</em></span>
            <input type="text" inputMode="decimal" name="amount" placeholder="Ej. 100000" required />
          </label>
          <label className="form-field">
            <span>Observación</span>
            <input type="text" name="observation" maxLength={500} placeholder="Opcional" />
          </label>
        </div>

        {state.status === "error" && state.message ? (
          <div className="form-message message-error" role="alert"><Icon name="activity" size={14} /><span>{state.message}</span></div>
        ) : null}
        {state.status === "unavailable" && state.message ? (
          <div className="form-message message-unavailable" role="status"><Icon name="lock" size={14} /><span>{state.message}</span></div>
        ) : null}

        <button className="secondary-button" type="submit" disabled={pending || !persistenceEnabled}>
          {pending ? "Guardando…" : "Registrar abono"}
        </button>
      </form>
    </details>
  );
}
