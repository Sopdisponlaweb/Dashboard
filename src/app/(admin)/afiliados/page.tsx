import type { Metadata } from "next";
import Link from "next/link";

import { DataSourceBadge } from "@/components/data-source-badge";
import { Icon } from "@/components/icons";
import { Pagination } from "@/components/pagination";
import { CoverageBadge, StatusBadge } from "@/features/affiliates/affiliate-badges";
import { formatDate, getCoverageState, getFullName, sourceLabels } from "@/features/affiliates/format";
import { countAffiliates, getDashboardSummary, listAffiliates } from "@/features/affiliates/repository";
import type { AffiliateStatus, AffiliationSource } from "@/features/affiliates/types";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export const metadata: Metadata = { title: "Afiliados" };

const validStatuses = new Set<AffiliateStatus>(["active", "inactive", "suspended", "deceased"]);
const validSources = new Set<AffiliationSource>(["particular", "activo", "casur", "tegen", "inpec", "ordisponal"]);
const PAGE_SIZE = 50;

type SearchParams = Promise<{
  q?: string | string[];
  status?: string | string[];
  source?: string | string[];
  result?: string | string[];
  page?: string | string[];
}>;

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AffiliatesPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const query = firstValue(params.q)?.trim() ?? "";
  const rawStatus = firstValue(params.status) ?? "operational";
  const rawSource = firstValue(params.source) ?? "all";
  const result = firstValue(params.result);
  const page = Math.max(1, Number(firstValue(params.page)) || 1);
  const status = validStatuses.has(rawStatus as AffiliateStatus) ? rawStatus as AffiliateStatus : "all";
  const source = validSources.has(rawSource as AffiliationSource) ? rawSource as AffiliationSource : "all";

  const effectiveStatus = rawStatus === "operational" ? "all" : status;
  const excludeDeceased = rawStatus === "operational";

  const [affiliatesResult, totalCount, summary] = await Promise.all([
    listAffiliates({ query, status: effectiveStatus, source, excludeDeceased, page, pageSize: PAGE_SIZE }),
    countAffiliates({ query, status: effectiveStatus, source, excludeDeceased }),
    getDashboardSummary(),
  ]);

  const totals = {
    active: summary.holderStatusCounts.active,
    waiting: summary.waitingCoverageCount,
    inactive: summary.holderStatusCounts.inactive,
    historical: summary.holderStatusCounts.deceased,
  };

  return (
    <>
      <header className="page-heading directory-heading">
        <div>
          <p className="eyebrow">Personas</p>
          <h1>Afiliados</h1>
          <p>Consulta titulares, cobertura, estado de pago y beneficiarios desde un directorio único.</p>
        </div>
        <div className="page-actions">
          <DataSourceBadge connected={isSupabaseConfigured()} />
          <Link className="primary-button" href="/afiliados/nuevo"><Icon name="users" size={16} /> Nuevo afiliado</Link>
        </div>
      </header>

      {result === "created" || result === "updated" ? (
        <div className="success-banner" role="status">
          <Icon name="lock" size={18} />
          <span>{result === "created" ? "El afiliado fue creado correctamente." : "Los datos del afiliado fueron actualizados."}</span>
        </div>
      ) : null}

      <section className="directory-summary" aria-label="Resumen de afiliados">
        <article><span>Activos</span><strong>{totals.active.toLocaleString("es-CO")}</strong></article>
        <article className="summary-waiting"><span>En carencia</span><strong>{totals.waiting.toLocaleString("es-CO")}</strong></article>
        <article><span>Inactivos</span><strong>{totals.inactive.toLocaleString("es-CO")}</strong></article>
        <article className="summary-history"><span>Histórico fallecidos</span><strong>{totals.historical.toLocaleString("es-CO")}</strong></article>
      </section>

      <section className="directory-panel" aria-labelledby="directory-title">
        <div className="directory-panel-header">
          <div>
            <h2 id="directory-title">Directorio de titulares</h2>
            <p>{totalCount.toLocaleString("es-CO")} registros coinciden con los filtros actuales</p>
          </div>
          <div className="directory-actions">
            <Link className="text-action" href="/consulta"><Icon name="search" size={16} /> Consulta integral</Link>
            <Link className="text-action" href="/afiliados/nuevo"><Icon name="users" size={16} /> Crear registro</Link>
          </div>
        </div>

        <form className="filter-bar" method="get">
          <label className="filter-search">
            <span>Buscar</span>
            <span className="filter-input-wrap"><Icon name="search" size={17} /><input name="q" type="search" defaultValue={query} placeholder="Nombre o cédula" /></span>
          </label>
          <label>
            <span>Estado</span>
            <select name="status" defaultValue={rawStatus}>
              <option value="operational">Vista operativa</option>
              <option value="active">Activos</option>
              <option value="inactive">Inactivos</option>
              <option value="suspended">Suspendidos</option>
              <option value="deceased">Fallecidos · histórico</option>
              <option value="all">Todos</option>
            </select>
          </label>
          <label>
            <span>Tipo</span>
            <select name="source" defaultValue={source}>
              <option value="all">Todos</option>
              <option value="activo">Activo</option>
              <option value="casur">CASUR</option>
              <option value="tegen">TEGEN</option>
              <option value="particular">Particular</option>
              <option value="inpec">INPEC</option>
              <option value="ordisponal">ORDISPONAL</option>
            </select>
          </label>
          <button className="primary-button" type="submit">Aplicar filtros</button>
          <Link className="secondary-button" href="/afiliados">Limpiar</Link>
        </form>

        {affiliatesResult.length ? (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead><tr><th>Afiliado</th><th>Documento</th><th>Tipo</th><th>Estado</th><th>Último pago</th><th>Beneficiarios</th><th><span className="sr-only">Acciones</span></th></tr></thead>
              <tbody>
                {affiliatesResult.map((affiliate) => {
                  const waiting = getCoverageState(affiliate) === "waiting";
                  const activeBeneficiaries = affiliate.beneficiaries.filter((beneficiary) => beneficiary.status !== "deceased").length;
                  return (
                    <tr key={affiliate.id} className={waiting ? "is-waiting" : undefined}>
                      <td>
                        <div className="person-cell"><span className="person-initials">{affiliate.firstNames[0]}{affiliate.lastNames[0]}</span><span><strong>{getFullName(affiliate)}</strong><small>{affiliate.municipality}</small>{waiting ? <em>Afiliación nueva</em> : null}</span></div>
                      </td>
                      <td><span className="mono-value">{affiliate.documentType} {affiliate.documentNumber}</span></td>
                      <td><span className={`source-label source-${affiliate.source}`}>{sourceLabels[affiliate.source]}</span></td>
                      <td><div className="status-stack"><StatusBadge status={affiliate.status} /><CoverageBadge status={affiliate.status} fullCoverageOn={affiliate.fullCoverageOn} /></div></td>
                      <td>{formatDate(affiliate.lastPaymentOn)}</td>
                      <td><span className="mono-value">{activeBeneficiaries}</span></td>
                      <td><Link className="row-action" href={`/afiliados/${affiliate.id}`} aria-label={`Ver ficha de ${getFullName(affiliate)}`}>Ver ficha <Icon name="arrow" size={15} /></Link></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state"><span><Icon name="search" size={26} /></span><h3>No encontramos afiliados</h3><p>Prueba con otra cédula, nombre o combinación de filtros.</p><Link href="/afiliados">Restablecer búsqueda</Link></div>
        )}

        <Pagination
          page={page}
          pageSize={PAGE_SIZE}
          totalCount={totalCount}
          basePath="/afiliados"
          searchParams={{ q: query, status: rawStatus, source }}
        />
      </section>
    </>
  );
}
