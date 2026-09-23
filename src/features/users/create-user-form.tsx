"use client";

import { useActionState } from "react";

import { Icon } from "@/components/icons";

import { createUser } from "./actions";
import { initialCreateUserFormState } from "./form-state";
import type { RoleRecord } from "./repository";

export function CreateUserForm({ roles }: { roles: RoleRecord[] }) {
  const [state, formAction, pending] = useActionState(createUser, initialCreateUserFormState);

  return (
    <form action={formAction} className="affiliate-form" noValidate>
      <div className="field-grid field-grid-three">
        <label className="form-field">
          <span>Nombre completo <em>*</em></span>
          <input name="displayName" required placeholder="Ej. María Camargo" />
        </label>
        <label className="form-field">
          <span>Correo <em>*</em></span>
          <input name="email" type="email" required placeholder="usuario@sopdisponal.org" />
        </label>
        <label className="form-field">
          <span>Rol <em>*</em></span>
          <select name="roleKey" defaultValue="operator" required>
            {roles.map((role) => (
              <option key={role.id} value={role.key}>{role.name}</option>
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
        <p>Se genera una contraseña temporal; pídele al usuario que la cambie al ingresar.</p>
        <div><button className="primary-button" type="submit" disabled={pending}>{pending ? "Creando…" : "Crear usuario"}</button></div>
      </footer>
    </form>
  );
}
