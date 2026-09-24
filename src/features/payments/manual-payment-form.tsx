"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { Icon } from "@/components/icons";
import { affiliationSources, formatCurrency, formatPeriod, formatReceiptNumber, paymentStatusLabels, sourceLabels } from "@/features/affiliates/format";
import type { AffiliationSource, PaymentStatus } from "@/features/affiliates/types";
import type { PaymentMethod } from "@/features/catalogs/repository";

import { initialPaymentFormState, type PaymentFormState } from "./form-state";
import { coveredPeriods, monthCountOptions } from "./periods";

type CreatePaymentAction = (state: PaymentFormState, formData: FormData) => Promise<PaymentFormState>;

type ManualPaymentFormProps = {
  createAction: CreatePaymentAction;
  persistenceEnabled: boolean;
  defaultSource: AffiliationSource;
  paymentMethods: PaymentMethod[];
  /** Month after the last one paid, as YYYY-MM. */
  suggestedPeriodFrom: string;
  /** Amount of the last payment, used as the default monthly value. */
  suggestedMonthlyAmount: number | null;
  today: string;
};

const statusOptions: PaymentStatus[] = ["paid", "pending", "reversed"];

export function ManualPaymentForm({
  createAction,
  persistenceEnabled,
  defaultSource,
  paymentMethods,
  suggestedPeriodFrom,
  suggestedMonthlyAmount,
  today,
}: ManualPaymentFormProps) {
  const [state, formAction, pending] = useActionState(createAction, initialPaymentFormState);
  const defaults = {
    periodFrom: suggestedPeriodFrom,
    months: 1,
    monthlyAmount: suggestedMonthlyAmount ? String(suggestedMonthlyAmount) : "",
  };
  const [preview, setPreview] = useState(defaults);

  const periods = /^\d{4}-\d{2}$/.test(preview.periodFrom) ? coveredPeriods(preview.periodFrom, preview.months) : [];
  const monthlyAmount = Number(preview.monthlyAmount);
  const total = Number.isFinite(monthlyAmount) && monthlyAmount > 0 ? monthlyAmount * preview.months : null;
  const noMethods = paymentMethods.length === 0;

  return (
    <details className="manual-payment" open={state.status === "created" || undefined}>
      <summary><Icon name="plus" size={14} /> Registrar pago manual</summary>
      <form
        action={formAction}
        className="manual-payment-form"
        onReset={() => setPreview(defaults)}
      >
        <div className="field-grid field-grid-three">
          <label className="form-field">
            <span>Desde (mes) <em>*</em></span>
            <input
              type="month"
              name="periodFrom"
              defaultValue={defaults.periodFrom}
              required
              onChange={(event) => setPreview((current) => ({ ...current, periodFrom: event.target.value }))}
            />
          </label>
          <label className="form-field">
            <span>Cantidad de meses <em>*</em></span>
            <select
              name="months"
              defaultValue={defaults.months}
              required
              onChange={(event) => setPreview((current) => ({ ...current, months: Number(event.target.value) }))}
            >
              {monthCountOptions.map((count) => (
                <option key={count} value={count}>{count} {count === 1 ? "mes" : "meses"}</option>
              ))}
            </select>
          </label>
          <label className="form-field">
            <span>Valor por mes <em>*</em></span>
            <input
              type="text"
              inputMode="decimal"
              name="monthlyAmount"
              defaultValue={defaults.monthlyAmount}
              placeholder="Ej. 18000"
              required
              onChange={(event) => setPreview((current) => ({ ...current, monthlyAmount: event.target.value.trim() }))}
            />
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
            <span>Fuente <em>*</em></span>
            <select name="source" defaultValue={defaultSource} required>
              {affiliationSources.map((value) => <option key={value} value={value}>{sourceLabels[value]}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Estado <em>*</em></span>
            <select name="status" defaultValue="paid" required>
              {statusOptions.map((value) => <option key={value} value={value}>{paymentStatusLabels[value]}</option>)}
            </select>
          </label>
          <label className="form-field">
            <span>Fecha de pago</span>
            <input type="date" name="paidOn" defaultValue={today} max={today} />
          </label>
          <label className="form-field">
            <span>Observación</span>
            <input type="text" name="observation" maxLength={500} placeholder="Opcional" />
          </label>
          <label className="form-field">
            <span>Soporte</span>
            <input type="file" name="supportFile" accept="application/pdf,.pdf,image/png,.png,image/jpeg,.jpg,.jpeg" />
            <small>Opcional. PDF, PNG o JPG, máximo 15 MB.</small>
          </label>
        </div>

        {periods.length ? (
          <div className="payment-range-summary" aria-live="polite">
            <div>
              <span>Periodo cubierto</span>
              <strong className="sentence-case">
                {periods.length === 1 ? formatPeriod(periods[0]) : `${formatPeriod(periods[0])} a ${formatPeriod(periods[periods.length - 1])}`}
              </strong>
            </div>
            <div>
              <span>Meses</span>
              <strong>{periods.length}</strong>
            </div>
            <div>
              <span>Total</span>
              <strong>{total ? formatCurrency(total) : "—"}</strong>
            </div>
          </div>
        ) : null}

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
            {state.receiptId ? (
              <Link className="panel-link" href={`/pagos/recibos/${state.receiptId}`} target="_blank">
                Descargar soporte PDF{state.receiptNumber ? ` · ${formatReceiptNumber(state.receiptNumber)}` : ""}
              </Link>
            ) : null}
          </div>
        ) : null}

        <button className="primary-button" type="submit" disabled={pending || !persistenceEnabled || noMethods}>
          {pending ? "Guardando…" : preview.months > 1 ? `Registrar ${preview.months} meses` : "Registrar pago"}
        </button>
      </form>
    </details>
  );
}
