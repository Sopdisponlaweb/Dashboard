import type { Metadata } from "next";
import Link from "next/link";

import { DataSourceBadge } from "@/components/data-source-badge";
import { Icon } from "@/components/icons";
import { Pagination } from "@/components/pagination";
import { CoverageBadge, StatusBadge } from "@/features/affiliates/affiliate-badges";
import { affiliateStatuses, affiliationSources, formatDate, getCoverageState, getFullName, sourceLabels, statusPluralLabels } from "@/features/affiliates/format";
import { countAffiliates, getDashboardSummary, listAffiliates } from "@/features/affiliates/repository";
import type { AffiliateFilters, AffiliateStatus, AffiliationSource } from "@/features/affiliates/types";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export const metadata: Metadata = { title: "Afiliados" };

const validStatuses = new Set<AffiliateStatus>(["active", "inactive", "suspended", "deceased"]);
const validSources = new Set<AffiliationSource>(["particular", "activo", "casur", "tegen", "inpec", "ordisponal"]);
const PAGE_SIZE = 50;

type SearchParams = Promise<{
  q?: string | string[];
  status?: string | string[];
  source?: string | string[];
  sucesion?: string | string[];
  carencia?: string | string[];
  result?: string | string[];
  page?: string | string[];
}>;

// URL value → repository filter. Spanish slugs keep links readable and shareable.
const successionFilters = {
  pendiente: "pending",
  sucedidos: "succeeded",
  sucesores: "successor",
} as const;
const coverageFilters = {
  "en-carencia": "waiting",
  "cobertura-completa": "full",
} as const;
type SuccessionSlug = keyof typeof successionFilters;
type CoverageSlug = keyof typeof coverageFilters;

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

  // Older links used status=sucesion-pendiente; they now map to the succession filter.
  const legacyPending = rawStatus === "sucesion-pendiente";
  const rawSuccession = legacyPending ? "pendiente" : firstValue(params.sucesion) ?? "todas";
  const successionSlug = rawSuccession in successionFilters ? (rawSuccession as SuccessionSlug) : null;
  const succession = successionSlug ? successionFilters[successionSlug] : "all";
  const rawCoverage = firstValue(params.carencia) ?? "todos";
  const coverageSlug = rawCoverage in coverageFilters ? (rawCoverage as CoverageSlug) : null;
  const coverage = coverageSlug ? coverageFilters[coverageSlug] : "all";

  // Pending/succeeded successions are about deceased titulars, which the operational view hides.
  const needsDeceased = succession === "pending" || succession === "succeeded";
  const statusValue = legacyPending ? "operational" : rawStatus;
  const effectiveStatus = statusValue === "operational" ? "all" : status;
  const excludeDeceased = statusValue === "operational" && !needsDeceased;
  const filters: AffiliateFilters = { query, status: effectiveStatus, source, excludeDeceased, succession, coverage };

  const [affiliatesResult, totalCount, summary] = await Promise.all([
    listAffiliates({ ...filters, page, pageSize: PAGE_SIZE }),
    countAffiliates(filters),
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
        <article><span>Suspendidos</span><strong>{totals.inactive.toLocaleString("es-CO")}</strong></article>
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
            <select name="status" defaultValue={statusValue}>
              <option value="operational">Vista operativa</option>
              {affiliateStatuses.map((value) => <option key={value} value={value}>{statusPluralLabels[value]}{value === "deceased" ? " · histórico" : ""}</option>)}
              <option value="all">Todos</option>
            </select>
          </label>
          <label>
            <span>Tipo</span>
            <select name="source" defaultValue={source}>
              <option value="all">Todos</option>
              {affiliationSources.map((value) => <option key={value} value={value}>{sourceLabels[value]}</option>)}
            </select>
          </label>
          <label>
            <span>Sucesión</span>
            <select name="sucesion" defaultValue={successionSlug ?? "todas"}>
              <option value="todas">Todas</option>
              <option value="pendiente">Sucesión pendiente</option>
              <option value="sucedidos">Sucedidos</option>
              <option value="sucesores">Titulares por sucesión</option>
            </select>
          </label>
          <label>
            <span>Carencia</span>
            <select name="carencia" defaultValue={coverageSlug ?? "todos"}>
              <option value="todos">Todos</option>
              <option value="en-carencia">En carencia</option>
              <option value="cobertura-completa">Cobertura completa</option>
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
                      <td>
                        <div className="status-stack">
                          <StatusBadge status={affiliate.status} />
                          {affiliate.successionRole === "pending" ? <span className="succession-badge is-pending">Sucesión pendiente</span> : null}
                          {affiliate.successionRole === "succeeded" ? <span className="succession-badge is-registered">Sucedido</span> : null}
                          {affiliate.successionRole === "successor" ? <span className="succession-badge is-successor">Titular por sucesión</span> : null}
                          <CoverageBadge status={affiliate.status} fullCoverageOn={affiliate.fullCoverageOn} />
                        </div>
                      </td>
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
          searchParams={{
            q: query,
            status: statusValue,
            source,
            ...(successionSlug ? { sucesion: successionSlug } : {}),
            ...(coverageSlug ? { carencia: coverageSlug } : {}),
          }}
        />
      </section>
    </>
  );
}
