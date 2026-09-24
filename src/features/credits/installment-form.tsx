"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { Icon } from "@/components/icons";
import { formatCreditReceiptNumber, formatCurrency } from "@/features/affiliates/format";
import type { PaymentMethod } from "@/features/catalogs/repository";

import { splitPayment } from "./calculations";
import { initialCreditFormState, type CreditFormState } from "./form-state";

type RegisterInstallmentAction = (state: CreditFormState, formData: FormData) => Promise<CreditFormState>;

type InstallmentFormProps = {
  createAction: RegisterInstallmentAction;
  persistenceEnabled: boolean;
  paymentMethods: PaymentMethod[];
  principalBase: number;
  totalAmount: number;
  installmentAmount: number;
  remainingTotal: number;
  requestedOn: string;
  today: string;
};

export function InstallmentForm({
  createAction,
  persistenceEnabled,
  paymentMethods,
  principalBase,
  totalAmount,
  installmentAmount,
  remainingTotal,
  requestedOn,
  today,
}: InstallmentFormProps) {
  const [state, formAction, pending] = useActionState(createAction, initialCreditFormState);
  // Suggest the monthly installment, or the whole balance when less is left.
  const suggestedAmount = String(Math.min(installmentAmount, remainingTotal));
  const [amount, setAmount] = useState(suggestedAmount);

  const amountValue = Number(amount);
  const validAmount = Number.isFinite(amountValue) && amountValue > 0;
  const exceeds = validAmount && amountValue > remainingTotal + 0.001;
  // Preview only: the database settles the exact split (the final abono closes the balance to zero).
  const split = validAmount ? splitPayment({ principalBase, totalAmount, amount: amountValue }) : null;
  const noMethods = paymentMethods.length === 0;

  return (
    <details className="manual-payment" open={state.status === "created" || undefined}>
      <summary><Icon name="plus" size={14} /> Registrar abono</summary>
      <form action={formAction} className="manual-payment-form" onReset={() => setAmount(suggestedAmount)}>
        <div className="field-grid field-grid-three">
          <label className="form-field">
            <span>Valor del abono <em>*</em></span>
            <input
              type="text"
              inputMode="decimal"
              name="amount"
              defaultValue={suggestedAmount}
              required
              aria-invalid={exceeds || undefined}
              onChange={(event) => setAmount(event.target.value.trim())}
            />
            <small>Cuota mensual: {formatCurrency(installmentAmount)}</small>
          </label>
          <label className="form-field">
            <span>Fecha del abono <em>*</em></span>
            <input type="date" name="paidOn" required defaultValue={today} min={requestedOn} max={today} />
          </label>
          <label className="form-field">
            <span>Método de pago <em>*</em></span>
            <select name="paymentMethodId" defaultValue="" required disabled={noMethods}>
              <option value="" disabled>Selecciona…</option>
              {paymentMethods.map((method) => <option key={method.id} value={method.id}>{method.name}</option>)}
            </select>
            {noMethods ? <small>No hay métodos activos. Agrégalos en Catálogos › Métodos de pago.</small> : null}
          </label>
          <label className="form-field">
            <span>Observación</span>
            <input type="text" name="observation" maxLength={500} placeholder="Opcional" />
          </label>
          <label className="form-field field-span-two">
            <span>Soporte</span>
            <input type="file" name="supportFile" accept="application/pdf,.pdf,image/png,.png,image/jpeg,.jpg,.jpeg" />
            <small>Opcional. PDF, PNG o JPG, máximo 15 MB.</small>
          </label>
        </div>

        <div className="payment-range-summary" aria-live="polite">
          <div>
            <span>Saldo pendiente</span>
            <strong>{formatCurrency(remainingTotal)}</strong>
          </div>
          <div>
            <span>Capital / interés</span>
            <strong>{split ? `${formatCurrency(split.capitalPortion)} / ${formatCurrency(split.interestPortion)}` : "—"}</strong>
          </div>
          <div>
            <span>Saldo después del abono</span>
            <strong>{exceeds ? "Supera el saldo" : validAmount ? formatCurrency(Math.max(remainingTotal - amountValue, 0)) : "—"}</strong>
          </div>
        </div>

        {state.status === "error" && state.message ? (
          <div className="form-message message-error" role="alert"><Icon name="activity" size={14} /><span>{state.message}</span></div>
        ) : null}
        {state.status === "unavailable" && state.message ? (
          <div className="form-message message-unavailable" role="status"><Icon name="lock" size={14} /><span>{state.message}</span></div>
        ) : null}
        {state.status === "created" && state.message ? (
          <div className="form-message message-success" role="status">
            <Icon name="file" size={14} />
            <span>{state.message}</span>
            {state.installmentId ? (
              <Link className="panel-link" href={`/creditos/abonos/${state.installmentId}`} target="_blank">
                Descargar soporte PDF{state.receiptNumber ? ` · ${formatCreditReceiptNumber(state.receiptNumber)}` : ""}
              </Link>
            ) : null}
          </div>
        ) : null}

        <button className="primary-button" type="submit" disabled={pending || !persistenceEnabled || noMethods || exceeds}>
          {pending ? "Guardando…" : "Registrar abono"}
        </button>
      </form>
    </details>
  );
}
