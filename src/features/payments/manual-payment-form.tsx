"use client";

import { useActionState } from "react";

import { Icon } from "@/components/icons";
import { paymentStatusLabels, sourceLabels } from "@/features/affiliates/format";
import type { AffiliationSource, PaymentStatus } from "@/features/affiliates/types";

import { initialPaymentFormState, type PaymentFormState } from "./form-state";

type CreatePaymentAction = (state: PaymentFormState, formData: FormData) => Promise<PaymentFormState>;

type ManualPaymentFormProps = {
  createAction: CreatePaymentAction;
  persistenceEnabled: boolean;
  defaultSource: AffiliationSource;
};

const sourceOptions: AffiliationSource[] = ["particular", "activo", "casur", "tegen", "inpec", "ordisponal"];
const statusOptions: PaymentStatus[] = ["paid", "pending", "reversed"];

export function ManualPaymentForm({ createAction, persistenceEnabled, defaultSource }: ManualPaymentFormProps) {
  const [state, formAction, pending] = useActionState(createAction, initialPaymentFormState);

  return (
    <details className="manual-payment">
      <summary><Icon name="plus" size={14} /> Registrar pago manual</summary>
      <form action={formAction} className="manual-payment-form">
        <div className="field-grid field-grid-three">
          <label className="form-field">
            <span>Periodo <em>*</em></span>
            <input type="month" name="period" required />
          </label>
          <label className="form-field">
            <span>Fuente <em>*</em></span>
            <select name="source" defaultValue={defaultSource} required>
              {sourceOptions.map((value) => <option key={value} value={value}>{sourceLabels[value]}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Valor <em>*</em></span>
            <input type="text" inputMode="decimal" name="amount" placeholder="Ej. 10000" required />
          </label>
          <label className="form-field">
            <span>Estado <em>*</em></span>
            <select name="status" defaultValue="paid" required>
              {statusOptions.map((value) => <option key={value} value={value}>{paymentStatusLabels[value]}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Fecha de pago</span>
            <input type="date" name="paidOn" />
            <small>Si se deja vacía, se usa el primer día del periodo.</small>
          </label>
          <label className="form-field">
            <span>Observación</span>
            <input type="text" name="observation" maxLength={500} placeholder="Opcional" />
          </label>
          <label className="form-field">
            <span>Soporte</span>
            <input type="file" name="supportFile" accept="application/pdf,.pdf" />
            <small>Opcional. Solo PDF, máximo 15 MB.</small>
          </label>
        </div>

        {state.status === "error" && state.message ? (
          <div className="form-message message-error" role="alert"><Icon name="activity" size={14} /><span>{state.message}</span></div>
        ) : null}
        {state.status === "unavailable" && state.message ? (
          <div className="form-message message-unavailable" role="status"><Icon name="lock" size={14} /><span>{state.message}</span></div>
        ) : null}

        <button className="secondary-button" type="submit" disabled={pending || !persistenceEnabled}>
          {pending ? "Guardando…" : "Agregar pago"}
        </button>
      </form>
    </details>
  );
}
