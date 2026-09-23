"use client";

import { useActionState } from "react";

import { Icon } from "@/components/icons";

import { createOrganization } from "./actions";
import { initialCatalogFormState } from "./form-state";

export function OrganizationForm() {
  const [state, formAction, pending] = useActionState(createOrganization, initialCatalogFormState);

  return (
    <form action={formAction} className="affiliate-form" noValidate>
      <div className="field-grid field-grid-three">
        <label className="form-field">
          <span>Nombre <em>*</em></span>
          <input name="name" required placeholder="Ej. Cajas de compensación del Atlántico" />
        </label>
        <label className="form-field">
          <span>Tipo <em>*</em></span>
          <select name="organizationType" defaultValue="company" required>
            <option value="company">Empresa</option>
            <option value="compensation_fund">Caja de compensación</option>
            <option value="payer">Tercero pagador</option>
            <option value="other">Otro</option>
          </select>
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
        <p>Las entidades usadas por afiliados no se pueden eliminar, solo inactivar.</p>
        <div><button className="primary-button" type="submit" disabled={pending}>{pending ? "Guardando…" : "Agregar entidad"}</button></div>
      </footer>
    </form>
  );
}
