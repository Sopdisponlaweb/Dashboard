import type { Metadata } from "next";
import Link from "next/link";

import { DataSourceBadge } from "@/components/data-source-badge";
import { Icon } from "@/components/icons";
import { Pagination } from "@/components/pagination";
import { StatusBadge } from "@/features/affiliates/affiliate-badges";
import { affiliateStatuses, formatPeriod, sourceLabels, statusPluralLabels, todayInBogota } from "@/features/affiliates/format";
import type { AffiliateStatus } from "@/features/affiliates/types";
import { gapWindowStart } from "@/features/payments/gaps";
import { getPaymentGapSummary, listPaymentGapAffiliates, type PaymentGapFilters } from "@/features/payments/gaps-repository";
import { PaymentsTabs } from "@/features/payments/payments-tabs";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export const metadata: Metadata = { title: "Continuidad de pagos" };

const PAGE_SIZE = 50;
const validStatuses = new Set<AffiliateStatus>(affiliateStatuses);
const windows = {
  "12m": { label: "Últimos 12 meses", years: 1 },
  "24m": { label: "Últimos 24 meses", years: 2 },
  todo: { label: "Todo el histórico", years: null },
} as const;
type WindowKey = keyof typeof windows;
const kinds = { all: "Todos los huecos", single: "De 1 mes (posible digitación)", multi: "De 2 meses o más" } as const;
type KindKey = keyof typeof kinds;
const MAX_LISTED_MONTHS = 4;

type SearchParams = Promise<{ q?: string | string[]; ventana?: string | string[]; tipo?: string | string[]; status?: string | string[]; page?: string | string[] }>;

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

/** YYYY-MM-01 of the window start, or null for the whole history. */
function windowSince(key: WindowKey) {
  const years = windows[key].years;
  if (!years) return null;
  const [year, month] = gapWindowStart(todayInBogota()).split("-").map(Number);
  return `${year - (years - 1)}-${String(month).padStart(2, "0")}-01`;
}

export default async function PaymentContinuityPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const query = firstValue(params.q)?.trim() ?? "";
  const rawWindow = firstValue(params.ventana) ?? "12m";
  const windowKey: WindowKey = rawWindow in windows ? (rawWindow as WindowKey) : "12m";
  const rawKind = firstValue(params.tipo) ?? "all";
  const kind: KindKey = rawKind in kinds ? (rawKind as KindKey) : "all";
  const rawStatus = firstValue(params.status) ?? "all";
  const status = validStatuses.has(rawStatus as AffiliateStatus) ? (rawStatus as AffiliateStatus) : "all";
  const page = Math.max(1, Number(firstValue(params.page)) || 1);
  const since = windowSince(windowKey);

  const filters: PaymentGapFilters = { since, query, kind, status };
  const [{ records, totalCount }, summary] = await Promise.all([
    listPaymentGapAffiliates({ ...filters, page, pageSize: PAGE_SIZE }),
    getPaymentGapSummary(since),
  ]);

  return (
    <>
      <header className="page-heading directory-heading">
        <div>
          <p className="eyebrow">Recaudo</p>
          <h1>Pagos</h1>
          <p>Titulares con meses sin pago registrado entre dos meses pagados. Puede ser un mes digitado mal o un pago pendiente.</p>
        </div>
        <div className="page-actions">
          <DataSourceBadge connected={isSupabaseConfigured()} />
        </div>
      </header>

      <PaymentsTabs active="continuidad" />

      <section className="directory-summary" aria-label="Resumen de continuidad de pagos">
        <article className="summary-waiting"><span>Titulares con huecos</span><strong>{summary.affiliates.toLocaleString("es-CO")}</strong></article>
        <article><span>Meses sin pago</span><strong>{summary.missingMonths.toLocaleString("es-CO")}</strong></article>
        <article className="summary-waiting"><span>Huecos de 1 mes</span><strong>{summary.singleMonthGaps.toLocaleString("es-CO")}</strong></article>
        <article className="summary-history"><span>Con huecos en todo el histórico</span><strong>{summary.allTimeAffiliates.toLocaleString("es-CO")}</strong></article>
      </section>

      <section className="directory-panel" aria-labelledby="gaps-directory-title">
        <div className="directory-panel-header">
          <div>
            <h2 id="gaps-directory-title">Pagos sin continuidad · {windows[windowKey].label.toLowerCase()}</h2>
            <p>
              {totalCount.toLocaleString("es-CO")} titulares coinciden con los filtros · los totales de arriba corresponden al periodo elegido
              {since ? ` (desde ${formatPeriod(since.slice(0, 7))})` : ""}
            </p>
          </div>
        </div>

        <form className="filter-bar" method="get">
          <label className="filter-search">
            <span>Buscar</span>
            <span className="filter-input-wrap"><Icon name="search" size={17} /><input name="q" type="search" defaultValue={query} placeholder="Nombre o cédula del titular" /></span>
          </label>
          <label>
            <span>Periodo</span>
            <select name="ventana" defaultValue={windowKey}>
              {Object.entries(windows).map(([value, option]) => <option key={value} value={value}>{option.label}</option>)}
            </select>
          </label>
          <label>
            <span>Tipo de hueco</span>
            <select name="tipo" defaultValue={kind}>
              {Object.entries(kinds).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label>
            <span>Estado</span>
            <select name="status" defaultValue={status}>
              <option value="all">Todos</option>
              {affiliateStatuses.map((value) => <option key={value} value={value}>{statusPluralLabels[value]}</option>)}
            </select>
          </label>
          <button className="primary-button" type="submit">Aplicar filtros</button>
          <Link className="secondary-button" href="/pagos/continuidad">Limpiar</Link>
        </form>

        {records.length ? (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead><tr><th>Titular</th><th>Documento</th><th>Tipo</th><th>Estado</th><th>Meses sin pago</th><th>Huecos</th><th>Meses</th><th><span className="sr-only">Acciones</span></th></tr></thead>
              <tbody>
                {records.map((record) => {
                  const extra = record.missingMonths - Math.min(record.missingList.length, MAX_LISTED_MONTHS);
                  return (
                    <tr key={record.affiliateId} className={record.missingMonths === 1 ? "is-waiting" : undefined}>
                      <td className="is-wrap"><Link className="row-action" href={`/afiliados/${record.affiliateId}?tab=pagos`}>{record.name}</Link></td>
                      <td><span className="mono-value">{record.document}</span></td>
                      <td><span className={`source-label source-${record.source}`}>{sourceLabels[record.source]}</span></td>
                      <td><StatusBadge status={record.status} /></td>
                      <td className="is-wrap">
                        <div className="gap-months">
                          {record.missingList.slice(0, MAX_LISTED_MONTHS).map((period) => (
                            <span className="gap-month sentence-case" key={period}>{formatPeriod(period)}</span>
                          ))}
                          {extra > 0 ? <span className="gap-month-more">+{extra} más</span> : null}
                        </div>
                      </td>
                      <td className="mono-value">{record.gapCount}</td>
                      <td className="mono-value">{record.missingMonths}</td>
                      <td><Link className="row-action" href={`/afiliados/${record.affiliateId}?tab=pagos`}>Revisar <Icon name="arrow" size={15} /></Link></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state"><span><Icon name="wallet" size={26} /></span><h3>No hay pagos sin continuidad</h3><p>Ningún titular tiene meses sin pago con estos filtros.</p><Link href="/pagos/continuidad">Restablecer búsqueda</Link></div>
        )}

        <Pagination
          page={page}
          pageSize={PAGE_SIZE}
          totalCount={totalCount}
          basePath="/pagos/continuidad"
          searchParams={{ q: query, ventana: windowKey, tipo: kind, status }}
        />
      </section>
    </>
  );
}
