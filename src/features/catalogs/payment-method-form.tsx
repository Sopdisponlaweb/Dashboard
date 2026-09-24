"use client";

import { useActionState } from "react";

import { Icon } from "@/components/icons";

import { createPaymentMethod } from "./actions";
import { initialCatalogFormState } from "./form-state";

export function PaymentMethodForm() {
  const [state, formAction, pending] = useActionState(createPaymentMethod, initialCatalogFormState);

  return (
    <form action={formAction} className="affiliate-form" noValidate>
      <div className="field-grid field-grid-three">
        <label className="form-field">
          <span>Nombre <em>*</em></span>
          <input name="name" required maxLength={80} placeholder="Ej. PSE" />
        </label>
      </div>

      {state.status === "error" && state.message ? (
        <div className="form-message message-error" role="alert"><Icon name="activity" size={16} /><span>{state.message}</span></div>
      ) : null}
      {state.status === "unavailable" && state.message ? (
        <div className="form-message message-unavailable" role="status"><Icon name="lock" size={16} /><span>{state.message}</span></div>
      ) : null}
      {state.status === "created" && state.message ? (
        <div className="form-message message-success" role="status"><Icon name="lock" size={16} /><span>{state.message}</span></div>
      ) : null}

      <footer className="form-footer">
        <p>Los métodos usados en pagos no se pueden eliminar, solo inactivar.</p>
        <div><button className="primary-button" type="submit" disabled={pending}>{pending ? "Guardando…" : "Agregar método"}</button></div>
      </footer>
    </form>
  );
}
