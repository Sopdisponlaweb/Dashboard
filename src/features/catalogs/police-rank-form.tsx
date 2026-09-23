"use client";

import { useActionState } from "react";

import { Icon } from "@/components/icons";

import { createPoliceRank } from "./actions";
import { initialCatalogFormState } from "./form-state";

const categoryOptions = [
  { value: "oficial_general", label: "Oficial General" },
  { value: "oficial_superior", label: "Oficial Superior" },
  { value: "oficial_subalterno", label: "Oficial Subalterno" },
  { value: "nivel_ejecutivo", label: "Nivel Ejecutivo" },
  { value: "historico", label: "Histórico (fuera de uso)" },
] as const;

export function PoliceRankForm() {
  const [state, formAction, pending] = useActionState(createPoliceRank, initialCatalogFormState);

  return (
    <form action={formAction} className="affiliate-form" noValidate>
      <div className="field-grid field-grid-three">
        <label className="form-field">
          <span>Nombre <em>*</em></span>
          <input name="name" required placeholder="Ej. Sargento Viceprimero" />
        </label>
        <label className="form-field">
          <span>Sigla</span>
          <input name="abbreviation" maxLength={10} placeholder="Ej. SV" />
        </label>
        <label className="form-field">
          <span>Categoría <em>*</em></span>
          <select name="category" defaultValue="nivel_ejecutivo" required>
            {categoryOptions.map((category) => (
              <option key={category.value} value={category.value}>{category.label}</option>
            ))}
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
        <p>Los rangos usados por afiliados no se pueden eliminar, solo inactivar.</p>
        <div><button className="primary-button" type="submit" disabled={pending}>{pending ? "Guardando…" : "Agregar rango"}</button></div>
      </footer>
    </form>
  );
}
