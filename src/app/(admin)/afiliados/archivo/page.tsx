import type { Metadata } from "next";
import Link from "next/link";

import { DataSourceBadge } from "@/components/data-source-badge";
import { Icon } from "@/components/icons";
import { Pagination } from "@/components/pagination";
import { formatDate, formatPeriod } from "@/features/affiliates/format";
import { ArchiveForm } from "@/features/archive/archive-form";
import { getArchiveStats, legacyPlatformUrl, listArchivedMembers, previewArchive } from "@/features/archive/repository";
import { isAdministrator } from "@/features/successions/repository";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export const metadata: Metadata = { title: "Archivo de retirados" };

const PAGE_SIZE = 50;
const types = { all: "Todos", titular: "Titulares", beneficiario: "Beneficiarios" } as const;
type TypeKey = keyof typeof types;

type SearchParams = Promise<{ q?: string | string[]; tipo?: string | string[]; page?: string | string[] }>;

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ArchivePage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const query = firstValue(params.q)?.trim() ?? "";
  const rawType = firstValue(params.tipo) ?? "all";
  const personType: TypeKey = rawType in types ? (rawType as TypeKey) : "all";
  const page = Math.max(1, Number(firstValue(params.page)) || 1);

  const [stats, { records, totalCount }, admin] = await Promise.all([
    getArchiveStats(),
    listArchivedMembers({ query, personType, page, pageSize: PAGE_SIZE }),
    isAdministrator(),
  ]);
  const preview = admin ? await previewArchive() : null;
  const url = legacyPlatformUrl();

  return (
    <>
      <nav className="breadcrumb" aria-label="Migas de pan"><Link href="/afiliados">Afiliados</Link><span>/</span><span aria-current="page">Archivo de retirados</span></nav>

      <header className="page-heading directory-heading">
        <div>
          <p className="eyebrow">Histórico</p>
          <h1>Archivo de retirados</h1>
          <p>
            Titulares retirados hace más de 12 meses y sus beneficiarios. Aquí solo queda su cédula y nombre; sus pagos,
            beneficiarios e historial se consultan en la {url ? <a href={url} target="_blank" rel="noopener noreferrer">plataforma antigua</a> : "plataforma antigua"}.
          </p>
        </div>
        <DataSourceBadge connected={isSupabaseConfigured()} />
      </header>

      <section className="directory-summary" aria-label="Resumen del archivo">
        <article className="summary-history"><span>Titulares archivados</span><strong>{stats.titulares.toLocaleString("es-CO")}</strong></article>
        <article><span>Beneficiarios archivados</span><strong>{stats.beneficiarios.toLocaleString("es-CO")}</strong></article>
        <article><span>Último archivo</span><strong className="summary-date">{stats.lastArchivedAt ? formatDate(stats.lastArchivedAt.slice(0, 10)) : "—"}</strong></article>
        <article className="summary-waiting"><span>Pendientes por archivar</span><strong>{preview ? preview.titulares.toLocaleString("es-CO") : "—"}</strong></article>
      </section>

      {admin && preview ? (
        <section className="detail-panel archive-panel" aria-labelledby="archive-run-title">
          <div className="panel-header">
            <div>
              <h2 id="archive-run-title">Archivar retirados</h2>
              <p>
                Titulares en estado Retirado sin pagos desde antes de {formatPeriod(preview.cutoff.slice(0, 7))}. Solo administradores.
                Los retirados con créditos, recibos, documentos o sucesiones no se archivan.
              </p>
            </div>
          </div>
          {preview.titulares ? (
            <>
              <dl className="archive-impact">
                <div><dt>Titulares</dt><dd>{preview.titulares.toLocaleString("es-CO")}</dd></div>
                <div><dt>Beneficiarios</dt><dd>{preview.beneficiarios.toLocaleString("es-CO")}</dd></div>
                <div><dt>Pagos que se eliminan</dt><dd>{preview.pagos.toLocaleString("es-CO")}</dd></div>
                <div><dt>Observaciones</dt><dd>{preview.notas.toLocaleString("es-CO")}</dd></div>
              </dl>
              {preview.omitidos ? <p className="archive-note">{preview.omitidos.toLocaleString("es-CO")} retirados no se archivan porque tienen créditos, documentos o sucesiones.</p> : null}
              <ArchiveForm titulares={preview.titulares} />
            </>
          ) : (
            <p className="attention-clear"><Icon name="check" size={18} /> No hay retirados pendientes por archivar.</p>
          )}
        </section>
      ) : null}

      <section className="directory-panel" aria-labelledby="archive-list-title">
        <div className="directory-panel-header">
          <div>
            <h2 id="archive-list-title">Personas archivadas</h2>
            <p>{totalCount.toLocaleString("es-CO")} registros coinciden con la búsqueda</p>
          </div>
        </div>

        <form className="filter-bar" method="get">
          <label className="filter-search">
            <span>Buscar</span>
            <span className="filter-input-wrap"><Icon name="search" size={17} /><input name="q" type="search" defaultValue={query} placeholder="Cédula o nombre" /></span>
          </label>
          <label>
            <span>Tipo</span>
            <select name="tipo" defaultValue={personType}>
              {Object.entries(types).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <button className="primary-button" type="submit">Buscar</button>
          <Link className="secondary-button" href="/afiliados/archivo">Limpiar</Link>
        </form>

        {records.length ? (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead><tr><th>Persona</th><th>Documento</th><th>Tipo</th><th>Titular</th><th>Último pago</th><th>Pagos</th><th>ID plataforma antigua</th><th>Archivado</th></tr></thead>
              <tbody>
                {records.map((member) => (
                  <tr key={member.id}>
                    <td className="is-wrap"><strong className="archive-name">{member.name}</strong></td>
                    <td><span className="mono-value">{member.documentNumber ? `${member.documentType ?? "CC"} ${member.documentNumber}` : "Sin registrar"}</span></td>
                    <td>{member.personType === "titular" ? "Titular" : `Beneficiario · ${member.relationship?.toLowerCase() ?? "—"}`}</td>
                    <td className="is-wrap">{member.personType === "beneficiario" ? `${member.titularName ?? "—"}${member.titularDocumentNumber ? ` · ${member.titularDocumentNumber}` : ""}` : "—"}</td>
                    <td>{member.personType === "titular" ? formatDate(member.lastPaymentOn) : "—"}</td>
                    <td className="mono-value">{member.personType === "titular" ? member.paymentsCount.toLocaleString("es-CO") : "—"}</td>
                    <td className="mono-value">{member.legacyMemberId ?? "—"}</td>
                    <td>{formatDate(member.archivedAt.slice(0, 10))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state"><span><Icon name="lock" size={26} /></span><h3>No hay personas archivadas con esa búsqueda</h3><p>Prueba con la cédula completa o parte del nombre.</p><Link href="/afiliados/archivo">Restablecer búsqueda</Link></div>
        )}

        <Pagination page={page} pageSize={PAGE_SIZE} totalCount={totalCount} basePath="/afiliados/archivo" searchParams={{ q: query, tipo: personType }} />
      </section>
    </>
  );
}
