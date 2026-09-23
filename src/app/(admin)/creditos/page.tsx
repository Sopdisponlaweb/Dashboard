import type { Metadata } from "next";
import Link from "next/link";

import { DataSourceBadge } from "@/components/data-source-badge";
import { Icon } from "@/components/icons";
import { Pagination } from "@/components/pagination";
import { formatCurrency, formatDate } from "@/features/affiliates/format";
import { countCredits, listCredits } from "@/features/affiliates/repository";
import type { CreditStatus } from "@/features/affiliates/types";
import { creditStatusLabels } from "@/features/credits/credit-history-panel";
import { remainingBalance } from "@/features/credits/calculations";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export const metadata: Metadata = { title: "Créditos" };

const validStatuses = new Set<CreditStatus>(["active", "paid", "refinanced", "cancelled"]);
const PAGE_SIZE = 50;

type SearchParams = Promise<{ q?: string | string[]; status?: string | string[]; page?: string | string[] }>;

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function formatRate(rate: number) {
  return `${(rate * 100).toLocaleString("es-CO", { maximumFractionDigits: 2 })}%`;
}

export default async function CreditsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const query = firstValue(params.q)?.trim() ?? "";
  const rawStatus = firstValue(params.status) ?? "all";
  const page = Math.max(1, Number(firstValue(params.page)) || 1);
  const status = validStatuses.has(rawStatus as CreditStatus) ? (rawStatus as CreditStatus) : "all";

  const [credits, totalCount] = await Promise.all([
    listCredits({ query, status, page, pageSize: PAGE_SIZE }),
    countCredits({ query, status }),
  ]);

  return (
    <>
      <header className="page-heading directory-heading">
        <div>
          <p className="eyebrow">Cartera</p>
          <h1>Créditos</h1>
          <p>Consulta los créditos de los afiliados, su desglose de capital/interés y el saldo pendiente.</p>
        </div>
        <div className="page-actions">
          <DataSourceBadge connected={isSupabaseConfigured()} />
        </div>
      </header>

      <section className="directory-panel" aria-labelledby="credits-directory-title">
        <div className="directory-panel-header">
          <div>
            <h2 id="credits-directory-title">Histórico de créditos</h2>
            <p>{totalCount.toLocaleString("es-CO")} registros coinciden con los filtros actuales</p>
          </div>
        </div>

        <form className="filter-bar" method="get">
          <label className="filter-search">
            <span>Buscar</span>
            <span className="filter-input-wrap"><Icon name="search" size={17} /><input name="q" type="search" defaultValue={query} placeholder="Nombre o cédula del titular" /></span>
          </label>
          <label>
            <span>Estado</span>
            <select name="status" defaultValue={status}>
              <option value="all">Todos</option>
              <option value="active">Activo</option>
              <option value="paid">Pagado</option>
              <option value="refinanced">Refinanciado</option>
              <option value="cancelled">Cancelado</option>
            </select>
          </label>
          <button className="primary-button" type="submit">Aplicar filtros</button>
          <Link className="secondary-button" href="/creditos">Limpiar</Link>
        </form>

        {credits.length ? (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead><tr><th>Titular</th><th>Documento</th><th>Base</th><th>Tasa</th><th>Plazo</th><th>Cuota</th><th>Saldo pendiente</th><th>Estado</th><th>Fecha solicitud</th></tr></thead>
              <tbody>
                {credits.map((credit) => {
                  const balance = remainingBalance(credit, credit.installments);
                  return (
                    <tr key={credit.id}>
                      <td><Link className="row-action" href={`/afiliados/${credit.affiliateId}?tab=creditos`}>{credit.affiliateName}</Link></td>
                      <td><span className="mono-value">{credit.affiliateDocument}</span></td>
                      <td className="mono-value">{formatCurrency(credit.principalBase)}</td>
                      <td>{formatRate(credit.interestRate)}</td>
                      <td>{credit.termMonths} meses</td>
                      <td className="mono-value">{formatCurrency(credit.installmentAmount)}</td>
                      <td className="mono-value">{formatCurrency(balance.remainingTotal)}</td>
                      <td><span className={`payment-badge credit-${credit.status}`}>{creditStatusLabels[credit.status]}</span></td>
                      <td>{formatDate(credit.requestedOn)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state"><span><Icon name="creditCard" size={26} /></span><h3>No encontramos créditos</h3><p>Prueba con otro titular o estado.</p><Link href="/creditos">Restablecer búsqueda</Link></div>
        )}

        <Pagination
          page={page}
          pageSize={PAGE_SIZE}
          totalCount={totalCount}
          basePath="/creditos"
          searchParams={{ q: query, status }}
        />
      </section>
    </>
  );
}
