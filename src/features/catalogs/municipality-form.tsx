"use client";

import { useActionState } from "react";

import { Icon } from "@/components/icons";

import { createMunicipality } from "./actions";
import { initialCatalogFormState } from "./form-state";

export function MunicipalityForm() {
  const [state, formAction, pending] = useActionState(createMunicipality, initialCatalogFormState);

  return (
    <form action={formAction} className="affiliate-form" noValidate>
      <div className="field-grid field-grid-three">
        <label className="form-field">
          <span>Departamento <em>*</em></span>
          <input name="department" required placeholder="Ej. Atlántico" />
        </label>
        <label className="form-field">
          <span>Municipio <em>*</em></span>
          <input name="name" required placeholder="Ej. Soledad" />
        </label>
        <label className="form-field">
          <span>Código DANE</span>
          <input name="daneCode" placeholder="Opcional" />
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
        <p>Los municipios usados por afiliados no se pueden eliminar, solo inactivar.</p>
        <div><button className="primary-button" type="submit" disabled={pending}>{pending ? "Guardando…" : "Agregar municipio"}</button></div>
      </footer>
    </form>
  );
}
