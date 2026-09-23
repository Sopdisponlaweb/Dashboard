"use client";

import { useActionState, useMemo, useState } from "react";

import { Icon } from "@/components/icons";
import { formatCurrency } from "@/features/affiliates/format";

import { calculateCredit } from "./calculations";
import { initialCreditFormState, type CreditFormState } from "./form-state";

type RequestCreditAction = (state: CreditFormState, formData: FormData) => Promise<CreditFormState>;

type ActiveCreditBalance = {
  remainingCapital: number;
  remainingInterest: number;
};

type RequestCreditFormProps = {
  createAction: RequestCreditAction;
  persistenceEnabled: boolean;
  activeCredit: ActiveCreditBalance | null;
};

export function RequestCreditForm({ createAction, persistenceEnabled, activeCredit }: RequestCreditFormProps) {
  const [state, formAction, pending] = useActionState(createAction, initialCreditFormState);
  const [disbursedAmount, setDisbursedAmount] = useState("");
  const [interestRatePercent, setInterestRatePercent] = useState("");
  const [termMonths, setTermMonths] = useState("");

  const preview = useMemo(() => {
    const amount = Number(disbursedAmount) || 0;
    const rate = (Number(interestRatePercent) || 0) / 100;
    const term = Number(termMonths) || 0;
    if (amount <= 0 || rate <= 0 || term <= 0) return null;

    return calculateCredit({
      disbursedAmount: amount,
      rolledOverCapital: activeCredit?.remainingCapital ?? 0,
      rolledOverInterest: activeCredit?.remainingInterest ?? 0,
      rate,
      termMonths: term,
    });
  }, [disbursedAmount, interestRatePercent, termMonths, activeCredit]);

  return (
    <details className="manual-payment">
      <summary><Icon name="plus" size={14} /> {activeCredit ? "Solicitar crédito nuevo (refinanciar)" : "Solicitar crédito"}</summary>
      <form action={formAction} className="manual-payment-form">
        <div className="field-grid field-grid-three">
          <label className="form-field">
            <span>Monto nuevo <em>*</em></span>
            <input type="text" inputMode="decimal" name="disbursedAmount" placeholder="Ej. 1500000" required
              value={disbursedAmount} onChange={(event) => setDisbursedAmount(event.target.value)} />
          </label>
          <label className="form-field">
            <span>Tasa (%) <em>*</em></span>
            <input type="text" inputMode="decimal" name="interestRatePercent" placeholder="Ej. 20" required
              value={interestRatePercent} onChange={(event) => setInterestRatePercent(event.target.value)} />
          </label>
          <label className="form-field">
            <span>Plazo (meses) <em>*</em></span>
            <input type="text" inputMode="numeric" name="termMonths" placeholder="Ej. 12" required
              value={termMonths} onChange={(event) => setTermMonths(event.target.value)} />
          </label>
          <label className="form-field field-span-two">
            <span>Observaciones</span>
            <input type="text" name="observations" maxLength={500} placeholder="Opcional" />
          </label>
        </div>

        {activeCredit ? (
          <div className="credit-rollover-notice">
            <Icon name="history" size={14} />
            <span>
              Se heredará el saldo pendiente del crédito activo: {formatCurrency(activeCredit.remainingCapital)} de capital
              {" "}+ {formatCurrency(activeCredit.remainingInterest)} de interés.
            </span>
          </div>
        ) : null}

        {preview ? (
          <div className="credit-preview">
            <article><span>Base del nuevo crédito</span><strong>{formatCurrency(preview.principalBase)}</strong></article>
            <article><span>Interés calculado</span><strong>{formatCurrency(preview.interestAmount)}</strong></article>
            <article><span>Total a pagar</span><strong>{formatCurrency(preview.totalAmount)}</strong></article>
            <article><span>Cuota mensual</span><strong>{formatCurrency(preview.installmentAmount)}</strong></article>
          </div>
        ) : null}

        {state.status === "error" && state.message ? (
          <div className="form-message message-error" role="alert"><Icon name="activity" size={14} /><span>{state.message}</span></div>
        ) : null}
        {state.status === "unavailable" && state.message ? (
          <div className="form-message message-unavailable" role="status"><Icon name="lock" size={14} /><span>{state.message}</span></div>
        ) : null}

        <button className="secondary-button" type="submit" disabled={pending || !persistenceEnabled}>
          {pending ? "Guardando…" : activeCredit ? "Confirmar refinanciación" : "Solicitar crédito"}
        </button>
      </form>
    </details>
  );
}
