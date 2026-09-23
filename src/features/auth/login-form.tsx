"use client";

import { useActionState } from "react";

import { Icon } from "@/components/icons";

import { signIn } from "./actions";
import { initialLoginActionState } from "./form-state";

export function LoginForm({ redirectTo }: { redirectTo: string }) {
  const [state, formAction, pending] = useActionState(signIn, initialLoginActionState);

  return (
    <form action={formAction} className="login-form" noValidate>
      <input type="hidden" name="redirectTo" value={redirectTo} />
      <label className="form-field">
        <span>Correo electrónico</span>
        <input name="email" type="email" defaultValue={state.email} required autoComplete="email" placeholder="tu@correo.com" />
      </label>
      <label className="form-field">
        <span>Contraseña</span>
        <input name="password" type="password" required autoComplete="current-password" placeholder="••••••••" />
      </label>

      {state.status === "error" && state.message ? (
        <div className="form-message message-error" role="alert"><Icon name="activity" size={16} /><span>{state.message}</span></div>
      ) : null}

      <button className="primary-button login-submit" type="submit" disabled={pending}>
        {pending ? "Ingresando…" : "Ingresar"}
      </button>
    </form>
  );
}
