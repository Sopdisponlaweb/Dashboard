import type { Metadata } from "next";
import Link from "next/link";

import { DataSourceBadge } from "@/components/data-source-badge";
import { Icon } from "@/components/icons";
import { Pagination } from "@/components/pagination";
import { creditStatusLabels, formatCreditReceiptNumber, formatCurrency, formatDate, formatPeriod } from "@/features/affiliates/format";
import type { CreditStatus } from "@/features/affiliates/types";
import { listPaymentMethods } from "@/features/catalogs/repository";
import { CreditsTabs } from "@/features/credits/credits-tabs";
import { getCreditInstallmentSummary, listCreditInstallments, type CreditInstallmentFilters } from "@/features/credits/installments-repository";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export const metadata: Metadata = { title: "Pagos de créditos" };

const creditStatuses: CreditStatus[] = ["active", "paused", "paid", "refinanced", "forgiven", "cancelled"];
const validStatuses = new Set<CreditStatus>(creditStatuses);
const PAGE_SIZE = 50;

type SearchParams = Promise<{
  q?: string | string[];
  month?: string | string[];
  method?: string | string[];
  status?: string | string[];
  page?: string | string[];
}>;

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function CreditPaymentsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const query = firstValue(params.q)?.trim() ?? "";
  const rawMonth = firstValue(params.month) ?? "all";
  const rawMethod = firstValue(params.method) ?? "all";
  const rawStatus = firstValue(params.status) ?? "all";
  const page = Math.max(1, Number(firstValue(params.page)) || 1);

  const paymentMethods = await listPaymentMethods();
  const month = /^\d{4}-\d{2}$/.test(rawMonth) ? rawMonth : "all";
  const paymentMethodId = paymentMethods.some((method) => method.id === rawMethod) ? rawMethod : "all";
  const creditStatus = validStatuses.has(rawStatus as CreditStatus) ? (rawStatus as CreditStatus) : "all";
  const filters: CreditInstallmentFilters = { query, month, paymentMethodId, creditStatus };

  const [{ records, totalCount }, summary] = await Promise.all([
    listCreditInstallments({ ...filters, page, pageSize: PAGE_SIZE }),
    getCreditInstallmentSummary(filters),
  ]);

  return (
    <>
      <header className="page-heading directory-heading">
        <div>
          <p className="eyebrow">Cartera</p>
          <h1>Créditos</h1>
          <p>Consulta los abonos registrados a los créditos de los afiliados, con su desglose de capital e interés, método y recibo.</p>
        </div>
        <div className="page-actions">
          <DataSourceBadge connected={isSupabaseConfigured()} />
        </div>
      </header>

      <CreditsTabs active="pagos" />

      <section className="directory-summary" aria-label="Resumen de pagos de créditos">
        <article><span>Total abonado</span><strong>{formatCurrency(summary.amount)}</strong></article>
        <article><span>Capital recaudado</span><strong>{formatCurrency(summary.capital)}</strong></article>
        <article className="summary-waiting"><span>Interés recaudado</span><strong>{formatCurrency(summary.interest)}</strong></article>
        <article><span>Abonos</span><strong>{summary.count.toLocaleString("es-CO")}</strong></article>
      </section>

      <section className="directory-panel" aria-labelledby="credit-payments-directory-title">
        <div className="directory-panel-header">
          <div>
            <h2 id="credit-payments-directory-title">Histórico de pagos de créditos</h2>
            <p>{totalCount.toLocaleString("es-CO")} abonos coinciden con los filtros actuales · los totales de arriba siguen los mismos filtros</p>
          </div>
        </div>

        <form className="filter-bar" method="get">
          <label className="filter-search">
            <span>Buscar</span>
            <span className="filter-input-wrap"><Icon name="search" size={17} /><input name="q" type="search" defaultValue={query} placeholder="Nombre o cédula del titular" /></span>
          </label>
          <label>
            <span>Mes</span>
            <select name="month" defaultValue={month}>
              <option value="all">Todos</option>
              {summary.months.map((value) => <option key={value} value={value}>{formatPeriod(value)}</option>)}
            </select>
          </label>
          <label>
            <span>Método de pago</span>
            <select name="method" defaultValue={paymentMethodId}>
              <option value="all">Todos</option>
              {paymentMethods.map((method) => <option key={method.id} value={method.id}>{method.name}</option>)}
            </select>
          </label>
          <label>
            <span>Estado del crédito</span>
            <select name="status" defaultValue={creditStatus}>
              <option value="all">Todos</option>
              {creditStatuses.map((value) => <option key={value} value={value}>{creditStatusLabels[value]}</option>)}
            </select>
          </label>
          <button className="primary-button" type="submit">Aplicar filtros</button>
          <Link className="secondary-button" href="/creditos/pagos">Limpiar</Link>
        </form>

        {records.length ? (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead><tr><th>Titular</th><th>Documento</th><th>Crédito</th><th>Fecha de pago</th><th>Valor</th><th>Capital</th><th>Interés</th><th>Método</th><th>Observación</th><th>Soporte</th><th>Recibo</th></tr></thead>
              <tbody>
                {records.map((record) => (
                  <tr key={record.id}>
                    <td><Link className="row-action" href={`/afiliados/${record.affiliateId}?tab=creditos`}>{record.affiliateName}</Link></td>
                    <td><span className="mono-value">{record.affiliateDocument}</span></td>
                    <td>
                      <div className="credit-ref-cell">
                        <span className="mono-value">{formatCurrency(record.creditPrincipalBase)}</span>
                        <span className={`payment-badge credit-${record.creditStatus}`}>{creditStatusLabels[record.creditStatus]}</span>
                      </div>
                    </td>
                    <td>{formatDate(record.paidOn)}</td>
                    <td className="mono-value">{formatCurrency(record.amount)}</td>
                    <td className="mono-value">{formatCurrency(record.capitalPortion)}</td>
                    <td className="mono-value">{formatCurrency(record.interestPortion)}</td>
                    <td>{record.paymentMethod ?? "—"}</td>
                    <td className="is-wrap">{record.observation ?? "Sin observaciones"}</td>
                    <td>
                      {record.supportDocumentId ? (
                        <Link className="row-action" href={`/afiliados/${record.affiliateId}/documentos/${record.supportDocumentId}`} target="_blank">Ver</Link>
                      ) : "—"}
                    </td>
                    <td>
                      {record.receiptNumber ? (
                        <Link className="row-action" href={`/creditos/abonos/${record.id}`} target="_blank">{formatCreditReceiptNumber(record.receiptNumber)}</Link>
                      ) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state"><span><Icon name="wallet" size={26} /></span><h3>No encontramos pagos de créditos</h3><p>Prueba con otro titular, mes, método o estado.</p><Link href="/creditos/pagos">Restablecer búsqueda</Link></div>
        )}

        <Pagination
          page={page}
          pageSize={PAGE_SIZE}
          totalCount={totalCount}
          basePath="/creditos/pagos"
          searchParams={{ q: query, month, method: paymentMethodId, status: creditStatus }}
        />
      </section>
    </>
  );
}
