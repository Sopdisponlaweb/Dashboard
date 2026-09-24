import type { Metadata } from "next";
import Link from "next/link";

import { CoverageBadge, StatusBadge } from "@/features/affiliates/affiliate-badges";
import { affiliateStatuses, formatDate, getCoverageState, getFullName, getInitials, statusPluralLabels } from "@/features/affiliates/format";
import { countBeneficiaries, getDashboardSummary, listBeneficiaries, type BeneficiaryDirectoryFilters } from "@/features/affiliates/repository";
import type { AffiliateStatus } from "@/features/affiliates/types";
import { isSupabaseConfigured } from "@/lib/supabase/env";

import { DataSourceBadge } from "@/components/data-source-badge";
import { Icon } from "@/components/icons";
import { Pagination } from "@/components/pagination";

export const metadata: Metadata = { title: "Beneficiarios" };

const validStatuses = new Set<AffiliateStatus>(["active", "inactive", "suspended", "deceased"]);
const PAGE_SIZE = 50;

type SearchParams = Promise<{ q?: string | string[]; status?: string | string[]; carencia?: string | string[]; page?: string | string[] }>;

// Same URL slugs as the Afiliados filter.
const coverageFilters = {
  "en-carencia": "waiting",
  "cobertura-completa": "full",
} as const;
type CoverageSlug = keyof typeof coverageFilters;

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function BeneficiariesPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const query = firstValue(params.q)?.trim() ?? "";
  const rawStatus = firstValue(params.status) ?? "operational";
  const page = Math.max(1, Number(firstValue(params.page)) || 1);
  const status = validStatuses.has(rawStatus as AffiliateStatus) ? (rawStatus as AffiliateStatus) : "all";
  const effectiveStatus = rawStatus === "operational" ? "all" : status;
  const excludeDeceased = rawStatus === "operational";
  const rawCoverage = firstValue(params.carencia) ?? "todos";
  const coverageSlug = rawCoverage in coverageFilters ? (rawCoverage as CoverageSlug) : null;
  const coverage = coverageSlug ? coverageFilters[coverageSlug] : "all";
  const filters: BeneficiaryDirectoryFilters = { query, status: effectiveStatus, excludeDeceased, coverage };

  const [beneficiaries, totalCount, summary] = await Promise.all([
    listBeneficiaries({ ...filters, page, pageSize: PAGE_SIZE }),
    countBeneficiaries(filters),
    getDashboardSummary(),
  ]);

  const totals = {
    active: summary.beneficiaryStatusCounts.active,
    inactive: summary.beneficiaryStatusCounts.inactive + summary.beneficiaryStatusCounts.suspended,
    deceased: summary.beneficiaryStatusCounts.deceased,
    total: summary.beneficiaryStatusCounts.active + summary.beneficiaryStatusCounts.inactive
      + summary.beneficiaryStatusCounts.suspended + summary.beneficiaryStatusCounts.deceased,
  };

  return (
    <>
      <header className="page-heading directory-heading">
        <div>
          <p className="eyebrow">Personas</p>
          <h1>Beneficiarios</h1>
          <p>Consulta todas las personas vinculadas a un titular, su parentesco, estado y cobertura.</p>
        </div>
        <DataSourceBadge connected={isSupabaseConfigured()} />
      </header>

      <section className="directory-summary" aria-label="Resumen de beneficiarios">
        <article><span>Activos</span><strong>{totals.active.toLocaleString("es-CO")}</strong></article>
        <article className="summary-waiting"><span>Suspendidos / retirados</span><strong>{totals.inactive.toLocaleString("es-CO")}</strong></article>
        <article className="summary-history"><span>Histórico fallecidos</span><strong>{totals.deceased.toLocaleString("es-CO")}</strong></article>
        <article><span>Total</span><strong>{totals.total.toLocaleString("es-CO")}</strong></article>
      </section>

      <section className="directory-panel" aria-labelledby="beneficiaries-directory-title">
        <div className="directory-panel-header">
          <div>
            <h2 id="beneficiaries-directory-title">Directorio de beneficiarios</h2>
            <p>{totalCount.toLocaleString("es-CO")} registros coinciden con los filtros actuales</p>
          </div>
        </div>

        <form className="filter-bar" method="get">
          <label className="filter-search">
            <span>Buscar</span>
            <span className="filter-input-wrap"><Icon name="search" size={17} /><input name="q" type="search" defaultValue={query} placeholder="Nombre, documento o titular" /></span>
          </label>
          <label>
            <span>Estado</span>
            <select name="status" defaultValue={rawStatus}>
              <option value="operational">Vista operativa</option>
              {affiliateStatuses.map((value) => <option key={value} value={value}>{statusPluralLabels[value]}{value === "deceased" ? " · histórico" : ""}</option>)}
              <option value="all">Todos</option>
            </select>
          </label>
          <label>
            <span>Carencia</span>
            <select name="carencia" defaultValue={coverageSlug ?? "todos"}>
              <option value="todos">Todos</option>
              <option value="en-carencia">En carencia (primeros 6 meses)</option>
              <option value="cobertura-completa">Cobertura completa</option>
            </select>
          </label>
          <button className="primary-button" type="submit">Aplicar filtros</button>
          <Link className="secondary-button" href="/beneficiarios">Limpiar</Link>
        </form>

        {beneficiaries.length ? (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead><tr><th>Beneficiario</th><th>Documento</th><th>Parentesco</th><th>Titular</th><th>Estado</th><th>Vinculación</th><th><span className="sr-only">Acciones</span></th></tr></thead>
              <tbody>
                {beneficiaries.map((beneficiary) => {
                  const waiting = getCoverageState(beneficiary) === "waiting";
                  return (
                    <tr key={beneficiary.id} className={waiting ? "is-waiting" : undefined}>
                      <td>
                        <div className="person-cell"><span className="person-initials">{getInitials(beneficiary)}</span><span><strong><Link className="person-link" href={`/afiliados/${beneficiary.affiliateId}/beneficiarios/${beneficiary.id}`}>{getFullName(beneficiary)}</Link></strong>{waiting ? <em>Vinculación nueva</em> : null}</span></div>
                      </td>
                      <td><span className="mono-value">{beneficiary.documentNumber ?? "Sin registrar"}</span></td>
                      <td>{beneficiary.relationship}</td>
                      <td className="is-wrap titular-cell"><Link className="row-action" href={`/afiliados/${beneficiary.affiliateId}`}>{beneficiary.affiliateName}</Link></td>
                      <td>
                        <div className="status-stack">
                          <StatusBadge status={beneficiary.status} />
                          <CoverageBadge status={beneficiary.status} fullCoverageOn={beneficiary.fullCoverageOn} />
                        </div>
                      </td>
                      <td>{formatDate(beneficiary.joinedOn)}</td>
                      <td><Link className="row-action" href={`/afiliados/${beneficiary.affiliateId}/beneficiarios/${beneficiary.id}`}>Ver ficha <Icon name="arrow" size={15} /></Link></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state"><span><Icon name="heart" size={26} /></span><h3>No encontramos beneficiarios</h3><p>Prueba con otro nombre, documento o combinación de filtros.</p><Link href="/beneficiarios">Restablecer búsqueda</Link></div>
        )}

        <Pagination
          page={page}
          pageSize={PAGE_SIZE}
          totalCount={totalCount}
          basePath="/beneficiarios"
          searchParams={{ q: query, status: rawStatus, ...(coverageSlug ? { carencia: coverageSlug } : {}) }}
        />
      </section>
    </>
  );
}
