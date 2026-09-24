import Link from "next/link";

import { Icon } from "@/components/icons";
import { creditStatusLabels, formatClearanceNumber, formatCreditReceiptNumber, formatCurrency, formatDate, formatRate } from "@/features/affiliates/format";
import type { Credit } from "@/features/affiliates/types";

import { issueCreditClearance } from "./actions";
import { remainingBalance } from "./calculations";
import { ClearanceAction } from "./clearance-action";

/** A paz y salvo only certifies a settled obligation: paid in full or forgiven. */
const clearableStatuses = new Set<Credit["status"]>(["paid", "forgiven"]);

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

type Movement = {
  key: string;
  date: string | null;
  label: string;
  detail?: string;
  charge?: number;
  credit?: number;
  balance: number;
  installmentId?: string;
  receiptNumber?: number | null;
};

/** Everything that moved the credit's balance, oldest first, with the balance after each step. */
function creditMovements(credit: Credit, successor: Credit | null): Movement[] {
  const movements: Movement[] = [{
    key: "granted",
    date: credit.requestedOn,
    label: "Crédito otorgado",
    detail: `Base ${formatCurrency(credit.principalBase)} + interés ${formatCurrency(credit.interestAmount)}`,
    charge: credit.totalAmount,
    balance: credit.totalAmount,
  }];

  let balance = credit.totalAmount;
  const installments = [...credit.installments].sort((a, b) => a.paidOn.localeCompare(b.paidOn) || (a.receiptNumber ?? 0) - (b.receiptNumber ?? 0));
  for (const installment of installments) {
    balance = Math.max(0, Math.round((balance - installment.amount) * 100) / 100);
    movements.push({
      key: installment.id,
      date: installment.paidOn,
      label: "Abono",
      detail: [`Capital ${formatCurrency(installment.capitalPortion)} · interés ${formatCurrency(installment.interestPortion)}`, installment.paymentMethod, installment.observation]
        .filter(Boolean).join(" · "),
      credit: installment.amount,
      balance,
      installmentId: installment.id,
      receiptNumber: installment.receiptNumber,
    });
  }

  // How the credit closed. Refinancing moves the pending balance into the new credit.
  if (credit.status === "refinanced") {
    const moved = successor ? successor.rolledOverCapital + successor.rolledOverInterest : balance;
    movements.push({
      key: "closed",
      date: successor?.requestedOn ?? null,
      label: "Saldo trasladado al crédito nuevo",
      detail: successor
        ? `Capital ${formatCurrency(successor.rolledOverCapital)} + interés ${formatCurrency(successor.rolledOverInterest)} pasan a la base del crédito del ${formatDate(successor.requestedOn)}`
        : "Refinanciado",
      credit: moved,
      balance: Math.max(0, Math.round((balance - moved) * 100) / 100),
    });
  } else if (credit.status === "forgiven" || credit.status === "cancelled") {
    movements.push({
      key: "closed",
      date: null,
      label: credit.status === "forgiven" ? "Saldo condonado" : "Crédito cancelado",
      credit: balance,
      balance: 0,
    });
  } else if (credit.status === "paid") {
    movements.push({ key: "closed", date: installments.at(-1)?.paidOn ?? null, label: "Crédito pagado", balance: 0 });
  }
  return movements;
}

/** What happened to the balance left when the credit closed. */
const closingBalanceLabels: Partial<Record<Credit["status"], string>> = {
  refinanced: "Saldo refinanciado",
  forgiven: "Saldo condonado",
  cancelled: "Saldo cancelado",
};

function PreviousCreditCard({ credit, successor, affiliateId }: { credit: Credit; successor: Credit | null; affiliateId: string }) {
  const paid = credit.installments.reduce((total, installment) => total + installment.amount, 0);
  const movements = creditMovements(credit, successor);
  const abonos = credit.installments.length;

  return (
    <details className="previous-credit">
      <summary>
        <span className="previous-credit-title">
          <strong>{formatCurrency(credit.totalAmount)}</strong>
          <span className={`payment-badge credit-${credit.status}`}>{creditStatusLabels[credit.status]}</span>
        </span>
        <span className="previous-credit-meta">
          Solicitado {formatDate(credit.requestedOn)} · {credit.termMonths} meses · {formatRate(credit.interestRate)} · {abonos} {abonos === 1 ? "abono" : "abonos"}
          {credit.clearance ? <span className="clearance-tag">Paz y salvo {formatClearanceNumber(credit.clearance.number)}</span> : null}
        </span>
        <span className="previous-credit-toggle">Ver movimientos</span>
      </summary>

      <div className="previous-credit-body">
        <dl className="previous-credit-figures">
          <div><dt>Base</dt><dd>{formatCurrency(credit.principalBase)}</dd></div>
          <div><dt>Interés</dt><dd>{formatCurrency(credit.interestAmount)}</dd></div>
          <div><dt>Total a pagar</dt><dd>{formatCurrency(credit.totalAmount)}</dd></div>
          <div><dt>Abonado</dt><dd>{formatCurrency(paid)}</dd></div>
          <div><dt>{closingBalanceLabels[credit.status] ?? "Saldo pendiente"}</dt><dd>{formatCurrency(Math.max(0, credit.totalAmount - paid))}</dd></div>
        </dl>

        <div className="data-table-wrap">
          <table className="data-table compact-table">
            <thead><tr><th>Fecha</th><th>Movimiento</th><th>Cargo</th><th>Abono</th><th>Saldo</th><th>Recibo</th></tr></thead>
            <tbody>
              {movements.map((movement) => (
                <tr key={movement.key}>
                  <td>{movement.date ? formatDate(movement.date) : "—"}</td>
                  <td className="is-wrap">
                    <div className="movement-cell"><strong>{movement.label}</strong>{movement.detail ? <span>{movement.detail}</span> : null}</div>
                  </td>
                  <td className="mono-value">{movement.charge ? formatCurrency(movement.charge) : "—"}</td>
                  <td className="mono-value">{movement.credit ? formatCurrency(movement.credit) : "—"}</td>
                  <td className="mono-value">{formatCurrency(movement.balance)}</td>
                  <td>
                    {movement.installmentId && movement.receiptNumber ? (
                      <Link className="row-action" href={`/creditos/abonos/${movement.installmentId}`} target="_blank">{formatCreditReceiptNumber(movement.receiptNumber)}</Link>
                    ) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="previous-credit-actions">
          <StatementLink affiliateId={affiliateId} creditId={credit.id} />
          {clearableStatuses.has(credit.status) ? (
            <ClearanceAction
              action={issueCreditClearance.bind(null, affiliateId, credit.id)}
              pdfHref={`/afiliados/${affiliateId}/creditos/${credit.id}/paz-y-salvo`}
              issuedNumber={credit.clearance?.number ?? null}
            />
          ) : null}
        </div>
      </div>
    </details>
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
          <div className="previous-credit-list">
            {others.map((credit) => (
              <PreviousCreditCard
                key={credit.id}
                credit={credit}
                successor={credits.find((candidate) => candidate.previousCreditId === credit.id) ?? null}
                affiliateId={affiliateId}
              />
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}
