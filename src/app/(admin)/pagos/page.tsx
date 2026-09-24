import type { Metadata } from "next";
import Link from "next/link";

import { DataSourceBadge } from "@/components/data-source-badge";
import { Icon } from "@/components/icons";
import { Pagination } from "@/components/pagination";
import { affiliationSources, formatCurrency, formatDate, formatPeriod, formatReceiptNumber, paymentStatusLabels, sourceLabels } from "@/features/affiliates/format";
import { countPayments, getPaymentTotals, listPaymentPeriods, listPayments } from "@/features/affiliates/repository";
import type { AffiliationSource, PaymentStatus } from "@/features/affiliates/types";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export const metadata: Metadata = { title: "Pagos" };

const validSources = new Set<AffiliationSource>(["particular", "activo", "casur", "tegen", "inpec", "ordisponal"]);
const validStatuses = new Set<PaymentStatus>(["paid", "pending", "reversed"]);
const PAGE_SIZE = 50;

type SearchParams = Promise<{
  q?: string | string[];
  period?: string | string[];
  source?: string | string[];
  status?: string | string[];
  page?: string | string[];
}>;

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function PaymentsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const query = firstValue(params.q)?.trim() ?? "";
  const rawPeriod = firstValue(params.period) ?? "all";
  const rawSource = firstValue(params.source) ?? "all";
  const rawStatus = firstValue(params.status) ?? "all";
  const page = Math.max(1, Number(firstValue(params.page)) || 1);
  const source = validSources.has(rawSource as AffiliationSource) ? (rawSource as AffiliationSource) : "all";
  const status = validStatuses.has(rawStatus as PaymentStatus) ? (rawStatus as PaymentStatus) : "all";

  const [periods, totals] = await Promise.all([listPaymentPeriods(), getPaymentTotals()]);
  const period = periods.includes(rawPeriod) ? rawPeriod : "all";

  const [payments, totalCount] = await Promise.all([
    listPayments({ query, period, source, status, page, pageSize: PAGE_SIZE }),
    countPayments({ query, period, source, status }),
  ]);

  return (
    <>
      <header className="page-heading directory-heading">
        <div>
          <p className="eyebrow">Recaudo</p>
          <h1>Pagos</h1>
          <p>Consulta el histórico de pagos individuales de cada titular, con su fuente, estado y observación.</p>
        </div>
        <div className="page-actions">
          <DataSourceBadge connected={isSupabaseConfigured()} />
          <Link className="primary-button" href="/importaciones"><Icon name="upload" size={16} /> Cargar lote de pagos</Link>
        </div>
      </header>

      <section className="directory-summary" aria-label="Resumen de pagos">
        <article><span>Pagados</span><strong>{formatCurrency(totals.paid)}</strong></article>
        <article className="summary-waiting"><span>Pendientes</span><strong>{formatCurrency(totals.pending)}</strong></article>
        <article className="summary-history"><span>Reversados</span><strong>{formatCurrency(totals.reversed)}</strong></article>
        <article><span>Movimientos</span><strong>{totals.count.toLocaleString("es-CO")}</strong></article>
      </section>

      <section className="directory-panel" aria-labelledby="payments-directory-title">
        <div className="directory-panel-header">
          <div>
            <h2 id="payments-directory-title">Histórico de pagos</h2>
            <p>{totalCount.toLocaleString("es-CO")} registros coinciden con los filtros actuales</p>
          </div>
        </div>

        <form className="filter-bar" method="get">
          <label className="filter-search">
            <span>Buscar</span>
            <span className="filter-input-wrap"><Icon name="search" size={17} /><input name="q" type="search" defaultValue={query} placeholder="Nombre o cédula del titular" /></span>
          </label>
          <label>
            <span>Periodo</span>
            <select name="period" defaultValue={period}>
              <option value="all">Todos</option>
              {periods.map((value) => <option key={value} value={value}>{formatPeriod(value)}</option>)}
            </select>
          </label>
          <label>
            <span>Fuente</span>
            <select name="source" defaultValue={source}>
              <option value="all">Todas</option>
              {affiliationSources.map((value) => <option key={value} value={value}>{sourceLabels[value]}</option>)}
            </select>
          </label>
          <label>
            <span>Estado</span>
            <select name="status" defaultValue={status}>
              <option value="all">Todos</option>
              <option value="paid">Pagado</option>
              <option value="pending">Pendiente</option>
              <option value="reversed">Reversado</option>
            </select>
          </label>
          <button className="primary-button" type="submit">Aplicar filtros</button>
          <Link className="secondary-button" href="/pagos">Limpiar</Link>
        </form>

        {payments.length ? (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead><tr><th>Titular</th><th>Documento</th><th>Periodo</th><th>Fuente</th><th>Valor</th><th>Método</th><th>Estado</th><th>Fecha de pago</th><th>Observación</th><th>Soporte</th><th>Recibo</th></tr></thead>
              <tbody>
                {payments.map((payment) => (
                  <tr key={payment.id}>
                    <td><Link className="row-action" href={`/afiliados/${payment.affiliateId}`}>{payment.affiliateName}</Link></td>
                    <td><span className="mono-value">{payment.affiliateDocument}</span></td>
                    <td className="sentence-case">{formatPeriod(payment.period)}</td>
                    <td><span className={`source-label source-${payment.source}`}>{sourceLabels[payment.source]}</span></td>
                    <td className="mono-value">{formatCurrency(payment.amount)}</td>
                    <td>{payment.paymentMethod ?? "—"}</td>
                    <td><span className={`payment-badge payment-${payment.status}`}>{paymentStatusLabels[payment.status]}</span></td>
                    <td>{formatDate(payment.paidOn)}</td>
                    <td>{payment.observation ?? "Sin observaciones"}</td>
                    <td>
                      {payment.supportDocumentId ? (
                        <Link className="row-action" href={`/afiliados/${payment.affiliateId}/documentos/${payment.supportDocumentId}`} target="_blank">Ver</Link>
                      ) : "—"}
                    </td>
                    <td>
                      {payment.receiptId && payment.receiptNumber ? (
                        <Link className="row-action" href={`/pagos/recibos/${payment.receiptId}`} target="_blank">{formatReceiptNumber(payment.receiptNumber)}</Link>
                      ) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state"><span><Icon name="wallet" size={26} /></span><h3>No encontramos pagos</h3><p>Prueba con otro titular, periodo, fuente o estado.</p><Link href="/pagos">Restablecer búsqueda</Link></div>
        )}

        <Pagination
          page={page}
          pageSize={PAGE_SIZE}
          totalCount={totalCount}
          basePath="/pagos"
          searchParams={{ q: query, period, source, status }}
        />
      </section>
    </>
  );
}
