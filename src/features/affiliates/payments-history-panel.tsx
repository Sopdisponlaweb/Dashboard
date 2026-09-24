"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { computePaymentGaps } from "@/features/payments/gaps";

import { formatCurrency, formatPeriod, formatReceiptNumber, paymentStatusLabels, sourceLabels } from "./format";
import type { Payment } from "./types";

type HistoryRow = { kind: "payment"; key: string; period: string; payment: Payment } | { kind: "gap"; key: string; period: string; after: string; before: string };

const PAGE_SIZE_OPTIONS = [20, 50, 100] as const;

export function PaymentsHistoryPanel({ payments, affiliateId }: { payments: Payment[]; affiliateId: string }) {
  const [pageSize, setPageSize] = useState<number | "all">(20);
  const [page, setPage] = useState(1);
  const [onlyGaps, setOnlyGaps] = useState(false);

  // Payments plus one row per month without payment between two paid months, newest first.
  const { rows, missingCount } = useMemo(() => {
    const gaps = computePaymentGaps(payments);
    const gapRows: HistoryRow[] = gaps.flatMap((gap) => gap.missing.map((period) => ({ kind: "gap" as const, key: `gap-${period}`, period, after: gap.after, before: gap.before })));
    const paymentRows: HistoryRow[] = payments.map((payment) => ({ kind: "payment" as const, key: payment.id, period: payment.period, payment }));
    const merged = [...paymentRows, ...gapRows].sort((a, b) => b.period.localeCompare(a.period));
    return { rows: merged, missingCount: gapRows.length };
  }, [payments]);
  const shownRows = onlyGaps ? rows.filter((row) => row.kind === "gap") : rows;

  const summary = useMemo(() => {
    const paidPayments = payments.filter((payment) => payment.status === "paid");
    const totalPaid = paidPayments.reduce((sum, payment) => sum + payment.amount, 0);
    const lastPaidPeriod = paidPayments.reduce<string | null>(
      (latest, payment) => (!latest || payment.period > latest ? payment.period : latest),
      null,
    );
    return { totalPaid, count: payments.length, lastPaidPeriod };
  }, [payments]);

  const effectivePageSize = pageSize === "all" ? Math.max(shownRows.length, 1) : pageSize;
  const pageCount = Math.max(1, Math.ceil(shownRows.length / effectivePageSize));
  const currentPage = Math.min(page, pageCount);
  const start = (currentPage - 1) * effectivePageSize;
  const visible = shownRows.slice(start, start + effectivePageSize);

  function handlePageSizeChange(value: string) {
    setPageSize(value === "all" ? "all" : Number(value));
    setPage(1);
  }

  return (
    <>
      <div className="payments-summary" aria-label="Resumen de pagos">
        <article><span>Total abonado</span><strong>{formatCurrency(summary.totalPaid)}</strong></article>
        <article><span>Movimientos</span><strong>{summary.count.toLocaleString("es-CO")}</strong></article>
        <article><span>Último mes pagado</span><strong className="sentence-case">{summary.lastPaidPeriod ? formatPeriod(summary.lastPaidPeriod) : "Sin registrar"}</strong></article>
      </div>

      {missingCount ? (
        <div className="payments-gap-toolbar" role="status">
          <span>
            <strong>{missingCount} {missingCount === 1 ? "mes" : "meses"} sin pago registrado</strong> entre meses pagados en todo el historial.
            Pueden ser meses digitados mal o pagos pendientes.
          </span>
          <label>
            <input type="checkbox" checked={onlyGaps} onChange={(event) => { setOnlyGaps(event.target.checked); setPage(1); }} />
            Mostrar solo meses sin pago
          </label>
        </div>
      ) : null}

      {payments.length ? (
        <>
          <div className="data-table-wrap">
            <table className="data-table compact-table">
              <thead><tr><th>Periodo</th><th>Fuente</th><th>Valor</th><th>Método</th><th>Estado</th><th>Observación</th><th>Soporte</th><th>Recibo</th></tr></thead>
              <tbody>
                {visible.map((row) => row.kind === "gap" ? (
                  <tr key={row.key} className="payment-gap-row">
                    <td className="sentence-case payment-gap-label">{formatPeriod(row.period)}</td>
                    <td colSpan={7}>
                      <span className="payment-gap-label">Sin pago registrado</span>
                      {" "}· entre <span className="sentence-case">{formatPeriod(row.after)}</span> y <span className="sentence-case">{formatPeriod(row.before)}</span>. ¿Mes digitado mal o pendiente?
                    </td>
                  </tr>
                ) : (
                  <PaymentRow key={row.key} payment={row.payment} affiliateId={affiliateId} />
                ))}
              </tbody>
            </table>
          </div>

          <div className="table-pagination">
            <label className="table-pagination-size">
              Mostrar
              <select value={pageSize} onChange={(event) => handlePageSizeChange(event.target.value)}>
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <option key={size} value={size}>{size}</option>
                ))}
                <option value="all">Todos</option>
              </select>
            </label>
            <div className="table-pagination-controls">
              <button type="button" className="secondary-button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={currentPage <= 1}>
                Anterior
              </button>
              <span>Página {currentPage} de {pageCount}</span>
              <button type="button" className="secondary-button" onClick={() => setPage((current) => Math.min(pageCount, current + 1))} disabled={currentPage >= pageCount}>
                Siguiente
              </button>
            </div>
          </div>
        </>
      ) : <p className="inline-empty">No hay pagos registrados.</p>}
    </>
  );
}

function PaymentRow({ payment, affiliateId }: { payment: Payment; affiliateId: string }) {
  return (
    <tr>
      <td className="sentence-case">{formatPeriod(payment.period)}</td>
      <td>{sourceLabels[payment.source]}</td>
      <td className="mono-value">{formatCurrency(payment.amount)}</td>
      <td>{payment.paymentMethod ?? "—"}</td>
      <td><span className={`payment-badge payment-${payment.status}`}>{paymentStatusLabels[payment.status]}</span></td>
      <td>{payment.observation ?? "Sin observaciones"}</td>
      <td>
        {payment.supportDocumentId ? (
          <Link className="row-action" href={`/afiliados/${affiliateId}/documentos/${payment.supportDocumentId}`} target="_blank">Ver</Link>
        ) : "—"}
      </td>
      <td>
        {payment.receiptId && payment.receiptNumber ? (
          <Link className="row-action" href={`/pagos/recibos/${payment.receiptId}`} target="_blank">{formatReceiptNumber(payment.receiptNumber)}</Link>
        ) : "—"}
      </td>
    </tr>
  );
}
