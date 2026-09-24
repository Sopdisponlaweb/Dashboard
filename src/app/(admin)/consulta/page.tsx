import type { Metadata } from "next";
import Link from "next/link";

import { Icon } from "@/components/icons";
import { Pagination } from "@/components/pagination";
import { CoverageBadge, StatusBadge } from "@/features/affiliates/affiliate-badges";
import { getFullName, getInitials, sourceLabels } from "@/features/affiliates/format";
import { countAffiliates, listAffiliates } from "@/features/affiliates/repository";
import { ArchivedMatches } from "@/features/archive/archived-notice";

export const metadata: Metadata = { title: "Consulta integral" };

type SearchParams = Promise<{ q?: string | string[]; page?: string | string[] }>;

// A one-letter query matched ~22.000 people and rendered all of them in one page.
const PAGE_SIZE = 25;

export default async function SearchPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const rawQuery = Array.isArray(params.q) ? params.q[0] : params.q;
  const query = rawQuery?.trim() ?? "";
  const rawPage = Array.isArray(params.page) ? params.page[0] : params.page;
  const page = Math.max(1, Number(rawPage) || 1);
  const [affiliates, totalCount] = query
    ? await Promise.all([listAffiliates({ query, page, pageSize: PAGE_SIZE }), countAffiliates({ query })])
    : [[], 0];

  return (
    <>
      <section className="search-hero">
        <div>
          <p className="eyebrow">Consulta interna</p>
          <h1>Encuentra una persona y toda su historia</h1>
          <p>Busca titulares o beneficiarios por nombre, cédula, entidad o municipio.</p>
        </div>
        <form className="search-command" method="get" role="search">
          <Icon name="search" size={21} />
          <label className="sr-only" htmlFor="member-query">Buscar persona</label>
          <input id="member-query" name="q" type="search" defaultValue={query} placeholder="Escribe un nombre o número de documento" autoFocus />
          <button type="submit">Buscar</button>
        </form>
      </section>

      {query ? <ArchivedMatches query={query} /> : null}

      {!query ? (
        <section className="search-empty" aria-label="Ayuda de búsqueda">
          <span className="search-empty-icon"><Icon name="search" size={28} /></span>
          <div><h2>Consulta integral preparada</h2><p>La búsqueda incluye datos del titular y de sus beneficiarios. Los registros fallecidos solo aparecen dentro del entorno administrativo.</p></div>
        </section>
      ) : affiliates.length ? (
        <section className="search-results" aria-labelledby="search-results-title">
          <div className="section-heading"><h2 id="search-results-title">Resultados para “{query}”</h2><span>{totalCount.toLocaleString("es-CO")} {totalCount === 1 ? "coincidencia" : "coincidencias"}</span></div>
          <div className="result-list">
            {affiliates.map((affiliate) => (
              <article className="result-card" key={affiliate.id}>
                <div className="result-person"><span className="person-initials person-initials-large">{getInitials(affiliate)}</span><div><h3>{getFullName(affiliate)}</h3><p>{affiliate.documentType} {affiliate.documentNumber} · {sourceLabels[affiliate.source]}</p></div></div>
                <div className="result-status"><StatusBadge status={affiliate.status} /><CoverageBadge status={affiliate.status} fullCoverageOn={affiliate.fullCoverageOn} /></div>
                <dl className="result-meta"><div><dt>Municipio</dt><dd>{affiliate.municipality}</dd></div><div><dt>Beneficiarios vigentes</dt><dd>{affiliate.beneficiaries.filter((beneficiary) => beneficiary.status !== "deceased").length}</dd></div></dl>
                <Link className="primary-button" href={`/afiliados/${affiliate.id}`}>Abrir ficha <Icon name="arrow" size={16} /></Link>
              </article>
            ))}
          </div>
          <Pagination page={page} pageSize={PAGE_SIZE} totalCount={totalCount} basePath="/consulta" searchParams={{ q: query }} />
        </section>
      ) : (
        <section className="empty-state search-no-results"><span><Icon name="search" size={26} /></span><h2>No hay coincidencias para “{query}”</h2><p>Verifica la escritura o utiliza solo una parte del nombre o documento.</p><Link href="/consulta">Nueva búsqueda</Link></section>
      )}
    </>
  );
}
