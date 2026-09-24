import Link from "next/link";

import { Icon } from "@/components/icons";
import { creditStatusLabels, formatCreditReceiptNumber, formatCurrency, formatDate, formatRate } from "@/features/affiliates/format";
import type { Credit } from "@/features/affiliates/types";

import { remainingBalance } from "./calculations";

function StatementLink({ affiliateId, creditId }: { affiliateId: string; creditId: string }) {
  return (
    <Link className="panel-link" href={`/afiliados/${affiliateId}/creditos/${creditId}/estado-de-cuenta`} target="_blank">
      <Icon name="file" size={14} /> Estado de cuenta PDF
    </Link>
  );
}

function ActiveCreditCard({ credit, affiliateId }: { credit: Credit; affiliateId: string }) {
  const balance = remainingBalance(credit, credit.installments);
  const installments = [...credit.installments].sort((a, b) => b.paidOn.localeCompare(a.paidOn) || (b.receiptNumber ?? 0) - (a.receiptNumber ?? 0));
  const hasRollover = credit.rolledOverCapital > 0 || credit.rolledOverInterest > 0;

  return (
    <div className="active-credit-card">
      <div className="active-credit-head">
        <span className={`payment-badge credit-${credit.status}`}>{creditStatusLabels[credit.status]}</span>
        {credit.inheritedFromAffiliateId ? (
          <span className="inherited-tag">Heredado de <Link href={`/afiliados/${credit.inheritedFromAffiliateId}`}>{credit.inheritedFromName ?? "titular fallecido"}</Link></span>
        ) : null}
        <span>Solicitado {formatDate(credit.requestedOn)} · {credit.termMonths} meses · {formatRate(credit.interestRate)}</span>
        <StatementLink affiliateId={affiliateId} creditId={credit.id} />
      </div>

      {hasRollover ? (
        <p className="credit-rollover-detail">
          Este crédito refinancia el anterior: <strong>{formatCurrency(credit.disbursedAmount)}</strong> nuevo
          {" "}+ <strong>{formatCurrency(credit.rolledOverCapital)}</strong> capital anterior
          {" "}+ <strong>{formatCurrency(credit.rolledOverInterest)}</strong> interés anterior
          {" "}= <strong>{formatCurrency(credit.principalBase)}</strong> base.
        </p>
      ) : null}

      <dl className="detail-grid">
        <div><dt>Base del crédito</dt><dd>{formatCurrency(credit.principalBase)}</dd></div>
        <div><dt>Interés total</dt><dd>{formatCurrency(credit.interestAmount)}</dd></div>
        <div><dt>Total a pagar</dt><dd>{formatCurrency(credit.totalAmount)}</dd></div>
        <div><dt>Cuota mensual</dt><dd>{formatCurrency(credit.installmentAmount)}</dd></div>
        <div><dt>Saldo pendiente (capital)</dt><dd>{formatCurrency(balance.remainingCapital)}</dd></div>
        <div><dt>Saldo pendiente (interés)</dt><dd>{formatCurrency(balance.remainingInterest)}</dd></div>
        <div className="detail-span"><dt>Saldo total pendiente</dt><dd><strong>{formatCurrency(balance.remainingTotal)}</strong></dd></div>
      </dl>

      {installments.length ? (
        <div className="data-table-wrap">
          <table className="data-table compact-table">
            <thead><tr><th>Fecha</th><th>Valor</th><th>Capital</th><th>Interés</th><th>Método</th><th>Observación</th><th>Soporte</th><th>Recibo</th></tr></thead>
            <tbody>
              {installments.map((installment) => (
                <tr key={installment.id}>
                  <td>{formatDate(installment.paidOn)}</td>
                  <td className="mono-value">{formatCurrency(installment.amount)}</td>
                  <td className="mono-value">{formatCurrency(installment.capitalPortion)}</td>
                  <td className="mono-value">{formatCurrency(installment.interestPortion)}</td>
                  <td>{installment.paymentMethod ?? "—"}</td>
                  <td>{installment.observation ?? "—"}</td>
                  <td>
                    {installment.supportDocumentId ? (
                      <Link className="row-action" href={`/afiliados/${affiliateId}/documentos/${installment.supportDocumentId}`} target="_blank">Ver</Link>
                    ) : "—"}
                  </td>
                  <td>
                    {installment.receiptNumber ? (
                      <Link className="row-action" href={`/creditos/abonos/${installment.id}`} target="_blank">{formatCreditReceiptNumber(installment.receiptNumber)}</Link>
                    ) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p className="inline-empty">Aún no hay abonos registrados para este crédito.</p>}
    </div>
  );
}

export function CreditHistoryPanel({ credits, affiliateId }: { credits: Credit[]; affiliateId: string }) {
  if (!credits.length) {
    return <p className="inline-empty">Este afiliado no tiene créditos registrados.</p>;
  }

  const active = credits.find((credit) => credit.status === "active") ?? null;
  const others = credits.filter((credit) => credit.id !== active?.id);

  return (
    <div className="credit-history">
      {active ? <ActiveCreditCard credit={active} affiliateId={affiliateId} /> : <p className="inline-empty">No hay un crédito activo actualmente.</p>}

      {others.length ? (
        <details className="historical-records">
          <summary><Icon name="history" size={16} /> Créditos anteriores · {others.length}</summary>
          <div>
            {others.map((credit) => (
              <p key={credit.id}>
                <strong>{formatCurrency(credit.totalAmount)} · {creditStatusLabels[credit.status]}</strong>
                <span>Solicitado {formatDate(credit.requestedOn)} · {credit.termMonths} meses · {formatRate(credit.interestRate)}</span>
                <StatementLink affiliateId={affiliateId} creditId={credit.id} />
              </p>
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}
