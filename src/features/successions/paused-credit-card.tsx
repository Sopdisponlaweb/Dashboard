"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Icon } from "@/components/icons";
import { formatCurrency, formatDate, formatRate } from "@/features/affiliates/format";

import { initialSuccessionFormState, type SuccessionFormState } from "./types";

type ResolveAction = (state: SuccessionFormState, formData: FormData) => Promise<SuccessionFormState>;

type PausedCreditCardProps = {
  action: ResolveAction;
  affiliateId: string;
  credit: { id: string; requestedOn: string; termMonths: number; interestRate: number; totalAmount: number };
  remainingTotal: number;
  /** Successor that can inherit it; null while the succession is pending. */
  successor: { id: string; name: string } | null;
};

const confirmations: Record<string, string> = {
  inherit: "¿Heredar el crédito al sucesor? Pasa activo con su saldo y abonos.",
  forgive: "¿Condonar el saldo pendiente de este crédito? Esta acción no se puede deshacer.",
  cancel: "¿Cancelar este crédito? Esta acción no se puede deshacer.",
};

/** A paused credit of a deceased titular: inherit it, forgive it or cancel it. */
export function PausedCreditCard({ action, affiliateId, credit, remainingTotal, successor }: PausedCreditCardProps) {
  const [state, formAction, pending] = useActionState(action, initialSuccessionFormState);

  return (
    <div className="paused-credit">
      <div className="active-credit-head">
        <span className="payment-badge credit-paused">En pausa</span>
        <span>Solicitado {formatDate(credit.requestedOn)} · {credit.termMonths} meses · {formatRate(credit.interestRate)}</span>
        <Link className="panel-link" href={`/afiliados/${affiliateId}/creditos/${credit.id}/estado-de-cuenta`} target="_blank">
          <Icon name="file" size={14} /> Estado de cuenta PDF
        </Link>
      </div>
      <p className="paused-credit-copy">
        El titular falleció y el crédito quedó en pausa con un saldo de <strong>{formatCurrency(remainingTotal)}</strong> de{" "}
        {formatCurrency(credit.totalAmount)}. No admite abonos hasta que se resuelva.
      </p>
      <form
        action={formAction}
        className="paused-credit-form"
        onSubmit={(event) => {
          const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
          if (!window.confirm(confirmations[submitter?.value ?? ""] ?? "¿Continuar?")) event.preventDefault();
        }}
      >
        <label className="form-field">
          <span>Observación</span>
          <input name="note" maxLength={300} placeholder="Opcional: motivo o referencia de la decisión" />
        </label>
        <div className="paused-credit-actions">
          <button className="primary-button" type="submit" name="action" value="inherit" disabled={pending || !successor}>
            {successor ? `Heredar a ${successor.name}` : "Heredar (requiere sucesión)"}
          </button>
          <button className="secondary-button" type="submit" name="action" value="forgive" disabled={pending}>Condonar</button>
          <button className="secondary-button" type="submit" name="action" value="cancel" disabled={pending}>Cancelar crédito</button>
        </div>
        {state.status !== "idle" && state.message ? (
          <div className="form-message message-error" role="alert"><Icon name="activity" size={14} /><span>{state.message}</span></div>
        ) : null}
      </form>
    </div>
  );
}
