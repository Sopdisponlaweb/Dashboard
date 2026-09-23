"use client";

import { useActionState } from "react";

import { Icon } from "@/components/icons";

import { resetUserPassword } from "./actions";
import { initialResetPasswordState } from "./form-state";

export function ResetPasswordButton({ userId }: { userId: string }) {
  const [state, formAction, pending] = useActionState(resetUserPassword.bind(null, userId), initialResetPasswordState);

  if (state.status === "done" && state.temporaryPassword) {
    return (
      <div className="reset-password-result">
        <span className="mono-value">{state.temporaryPassword}</span>
        <small>{state.message}</small>
      </div>
    );
  }

  return (
    <form action={formAction}>
      {state.status === "error" && state.message ? (
        <span className="field-error">{state.message}</span>
      ) : null}
      <button className="row-action" type="submit" disabled={pending}>
        <Icon name="lock" size={14} /> {pending ? "Restableciendo…" : "Restablecer contraseña"}
      </button>
    </form>
  );
}
