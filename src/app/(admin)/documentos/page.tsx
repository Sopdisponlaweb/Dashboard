import type { Metadata } from "next";
import Link from "next/link";

import { DataSourceBadge } from "@/components/data-source-badge";
import { Icon } from "@/components/icons";
import { documentKindLabels, formatDate } from "@/features/affiliates/format";
import { listDocuments } from "@/features/affiliates/repository";
import type { MemberDocument } from "@/features/affiliates/types";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export const metadata: Metadata = { title: "Documentos" };

const validKinds = new Set<MemberDocument["kind"]>(["resume", "identity", "support", "other"]);

type SearchParams = Promise<{ q?: string | string[]; kind?: string | string[] }>;

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function DocumentsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const query = firstValue(params.q)?.trim() ?? "";
  const rawKind = firstValue(params.kind) ?? "all";
  const kind = validKinds.has(rawKind as MemberDocument["kind"]) ? (rawKind as MemberDocument["kind"]) : "all";

  const [documents, allDocuments] = await Promise.all([
    listDocuments({ query, kind }),
    listDocuments(),
  ]);

  const totals = {
    resume: allDocuments.filter((document) => document.kind === "resume").length,
    identity: allDocuments.filter((document) => document.kind === "identity").length,
    support: allDocuments.filter((document) => document.kind === "support").length,
    other: allDocuments.filter((document) => document.kind === "other").length,
  };

  return (
    <>
      <header className="page-heading directory-heading">
        <div>
          <p className="eyebrow">Archivo</p>
          <h1>Documentos</h1>
          <p>Consulta el expediente digital de cada titular y de sus beneficiarios. Los archivos se conservan en almacenamiento privado y solo se acceden con permiso.</p>
        </div>
        <DataSourceBadge connected={isSupabaseConfigured()} />
      </header>

      <section className="directory-summary" aria-label="Resumen de documentos">
        <article><span>{documentKindLabels.resume}</span><strong>{totals.resume.toLocaleString("es-CO")}</strong></article>
        <article><span>{documentKindLabels.identity}</span><strong>{totals.identity.toLocaleString("es-CO")}</strong></article>
        <article><span>{documentKindLabels.support}</span><strong>{totals.support.toLocaleString("es-CO")}</strong></article>
        <article><span>{documentKindLabels.other}</span><strong>{totals.other.toLocaleString("es-CO")}</strong></article>
      </section>

      <section className="directory-panel" aria-labelledby="documents-directory-title">
        <div className="directory-panel-header">
          <div>
            <h2 id="documents-directory-title">Expedientes digitales</h2>
            <p>{documents.length} archivos coinciden con los filtros actuales</p>
          </div>
        </div>

        <form className="filter-bar" method="get">
          <label className="filter-search">
            <span>Buscar</span>
            <span className="filter-input-wrap"><Icon name="search" size={17} /><input name="q" type="search" defaultValue={query} placeholder="Titular, beneficiario, cédula o título" /></span>
          </label>
          <label>
            <span>Tipo</span>
            <select name="kind" defaultValue={kind}>
              <option value="all">Todos</option>
              <option value="resume">Hoja de vida</option>
              <option value="identity">Documento de identidad</option>
              <option value="support">Soporte</option>
              <option value="other">Otro</option>
            </select>
          </label>
          <button className="primary-button" type="submit">Aplicar filtros</button>
          <Link className="secondary-button" href="/documentos">Limpiar</Link>
        </form>

        {documents.length ? (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead><tr><th>Titular</th><th>Pertenece a</th><th>Archivo</th><th>Tipo</th><th>Cargado</th><th>Tamaño</th><th><span className="sr-only">Acciones</span></th></tr></thead>
              <tbody>
                {documents.map((document) => (
                  <tr key={document.id}>
                    <td className="is-wrap">
                      <div className="document-owner-cell">
                        <Link className="row-action" href={`/afiliados/${document.affiliateId}`}>{document.affiliateName}</Link>
                        <span className="mono-value">{document.affiliateDocument}</span>
                      </div>
                    </td>
                    <td className="is-wrap">
                      {document.beneficiaryId ? (
                        <div className="document-owner-cell">
                          <strong><Link className="person-link" href={`/afiliados/${document.affiliateId}/beneficiarios/${document.beneficiaryId}`}>{document.beneficiaryName}</Link></strong>
                          <span>Beneficiario · {document.beneficiaryRelationship}</span>
                        </div>
                      ) : <span className="document-owner-titular">Titular</span>}
                    </td>
                    <td>{document.title}</td>
                    <td><span className="module-status">{documentKindLabels[document.kind]}</span></td>
                    <td>{formatDate(document.uploadedOn)}</td>
                    <td><span className="mono-value">{document.sizeLabel}</span></td>
                    <td>
                      <div className="row-actions-cell">
                        {isSupabaseConfigured() ? (
                          <Link className="row-action" href={`/afiliados/${document.affiliateId}/documentos/${document.id}`} target="_blank">Descargar</Link>
                        ) : null}
                        <Link className="row-action" href={`/afiliados/${document.affiliateId}`} aria-label={`Ver expediente de ${document.affiliateName}`}>Ver ficha <Icon name="arrow" size={15} /></Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state"><span><Icon name="file" size={26} /></span><h3>No encontramos documentos</h3><p>Prueba con otro titular, beneficiario o tipo de archivo.</p><Link href="/documentos">Restablecer búsqueda</Link></div>
        )}
      </section>
    </>
  );
}
