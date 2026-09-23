"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { formatCurrency, formatPeriod, paymentStatusLabels, sourceLabels } from "./format";
import type { Payment } from "./types";

const PAGE_SIZE_OPTIONS = [20, 50, 100] as const;

export function PaymentsHistoryPanel({ payments, affiliateId }: { payments: Payment[]; affiliateId: string }) {
  const [pageSize, setPageSize] = useState<number | "all">(20);
  const [page, setPage] = useState(1);

  const summary = useMemo(() => {
    const paidPayments = payments.filter((payment) => payment.status === "paid");
    const totalPaid = paidPayments.reduce((sum, payment) => sum + payment.amount, 0);
    const lastPaidPeriod = paidPayments.reduce<string | null>(
      (latest, payment) => (!latest || payment.period > latest ? payment.period : latest),
      null,
    );
    return { totalPaid, count: payments.length, lastPaidPeriod };
  }, [payments]);

  const effectivePageSize = pageSize === "all" ? Math.max(payments.length, 1) : pageSize;
  const pageCount = Math.max(1, Math.ceil(payments.length / effectivePageSize));
  const currentPage = Math.min(page, pageCount);
  const start = (currentPage - 1) * effectivePageSize;
  const visible = payments.slice(start, start + effectivePageSize);

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

      {payments.length ? (
        <>
          <div className="data-table-wrap">
            <table className="data-table compact-table">
              <thead><tr><th>Periodo</th><th>Fuente</th><th>Valor</th><th>Estado</th><th>Observación</th><th>Soporte</th></tr></thead>
              <tbody>
                {visible.map((payment) => (
                  <tr key={payment.id}>
                    <td className="sentence-case">{formatPeriod(payment.period)}</td>
                    <td>{sourceLabels[payment.source]}</td>
                    <td className="mono-value">{formatCurrency(payment.amount)}</td>
                    <td><span className={`payment-badge payment-${payment.status}`}>{paymentStatusLabels[payment.status]}</span></td>
                    <td>{payment.observation ?? "Sin observaciones"}</td>
                    <td>
                      {payment.supportDocumentId ? (
                        <Link className="row-action" href={`/afiliados/${affiliateId}/documentos/${payment.supportDocumentId}`} target="_blank">Ver</Link>
                      ) : "—"}
                    </td>
                  </tr>
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
