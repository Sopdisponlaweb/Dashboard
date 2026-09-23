import type { Metadata } from "next";
import Link from "next/link";

import { DataSourceBadge } from "@/components/data-source-badge";
import { sourceLabels } from "@/features/affiliates/format";
import type { AffiliationSource } from "@/features/affiliates/types";
import { toggleOrganizationActive, togglePoliceRankActive } from "@/features/catalogs/actions";
import { MunicipalityForm } from "@/features/catalogs/municipality-form";
import { MunicipalityTable } from "@/features/catalogs/municipality-table";
import { OrganizationForm } from "@/features/catalogs/organization-form";
import { PoliceRankForm } from "@/features/catalogs/police-rank-form";
import {
  canManageSettings,
  listMunicipalities,
  listOrganizations,
  listPoliceRanks,
  organizationTypeLabels,
  policeRankCategoryLabels,
} from "@/features/catalogs/repository";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export const metadata: Metadata = { title: "Catálogos" };

const affiliationSources: AffiliationSource[] = ["particular", "activo", "casur", "tegen", "inpec", "ordisponal"];

type CatalogTab = "municipios" | "entidades" | "rangos" | "fuentes";
const validTabs = new Set<CatalogTab>(["municipios", "entidades", "rangos", "fuentes"]);

type SearchParams = Promise<{ tab?: string | string[] }>;

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function CatalogsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const rawTab = firstValue(params.tab) ?? "municipios";
  const tab: CatalogTab = validTabs.has(rawTab as CatalogTab) ? (rawTab as CatalogTab) : "municipios";

  const persistenceEnabled = isSupabaseConfigured();
  const hasAccess = persistenceEnabled ? await canManageSettings() : false;

  const municipalities = hasAccess && tab === "municipios" ? await listMunicipalities() : [];
  const organizations = hasAccess && tab === "entidades" ? await listOrganizations() : [];
  const policeRanks = hasAccess && tab === "rangos" ? await listPoliceRanks() : [];

  return (
    <>
      <header className="page-heading directory-heading">
        <div>
          <p className="eyebrow">Configuración</p>
          <h1>Catálogos</h1>
          <p>Centraliza municipios y entidades (empresas, cajas de compensación y terceros pagadores) usadas en afiliados y pagos.</p>
        </div>
        <DataSourceBadge connected={persistenceEnabled} connectedLabel="Conectado a Supabase local" disconnectedLabel="Requiere conexión a Supabase" />
      </header>

      {!persistenceEnabled ? (
        <p className="empty-hint">Esta sección requiere una conexión activa a Supabase.</p>
      ) : !hasAccess ? (
        <p className="empty-hint">No tienes el permiso &quot;settings.manage&quot; para administrar catálogos.</p>
      ) : (
        <>
          <nav className="tab-bar" aria-label="Catálogos">
            <Link className={`tab-link${tab === "municipios" ? " is-active" : ""}`} href="/catalogos?tab=municipios">Municipios</Link>
            <Link className={`tab-link${tab === "entidades" ? " is-active" : ""}`} href="/catalogos?tab=entidades">Entidades</Link>
            <Link className={`tab-link${tab === "rangos" ? " is-active" : ""}`} href="/catalogos?tab=rangos">Rangos de policía</Link>
            <Link className={`tab-link${tab === "fuentes" ? " is-active" : ""}`} href="/catalogos?tab=fuentes">Tipos de afiliación</Link>
          </nav>

          <div className="tab-panel">
            {tab === "municipios" ? (
              <section className="detail-panel" aria-labelledby="municipalities-title">
                <div className="panel-header">
                  <div>
                    <h2 id="municipalities-title">Municipios ({municipalities.length})</h2>
                    <p>Se usan en la ficha del afiliado. Los ya usados no se pueden eliminar, solo inactivar.</p>
                  </div>
                </div>
                <MunicipalityForm />
                <MunicipalityTable municipalities={municipalities} />
              </section>
            ) : tab === "entidades" ? (
              <section className="detail-panel" aria-labelledby="organizations-title">
                <div className="panel-header">
                  <div>
                    <h2 id="organizations-title">Entidades ({organizations.length})</h2>
                    <p>Empresas, cajas de compensación y terceros pagadores vinculados a afiliados.</p>
                  </div>
                </div>
                <OrganizationForm />
                <div className="data-table-wrap">
                  <table className="data-table compact-table">
                    <thead><tr><th>Nombre</th><th>Tipo</th><th>Estado</th><th><span className="sr-only">Acciones</span></th></tr></thead>
                    <tbody>
                      {organizations.map((organization) => (
                        <tr key={organization.id}>
                          <td><strong>{organization.name}</strong></td>
                          <td>{organizationTypeLabels[organization.organizationType]}</td>
                          <td><span className={`payment-badge ${organization.isActive ? "payment-paid" : "payment-reversed"}`}>{organization.isActive ? "Activa" : "Inactiva"}</span></td>
                          <td>
                            <form action={toggleOrganizationActive.bind(null, organization.id, !organization.isActive)}>
                              <button className="row-action" type="submit">{organization.isActive ? "Inactivar" : "Activar"}</button>
                            </form>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ) : tab === "rangos" ? (
              <section className="detail-panel" aria-labelledby="police-ranks-title">
                <div className="panel-header">
                  <div>
                    <h2 id="police-ranks-title">Rangos de policía ({policeRanks.length})</h2>
                    <p>Grados de la Policía Nacional, incluidos los históricos usados por afiliados retirados.</p>
                  </div>
                </div>
                <PoliceRankForm />
                <div className="data-table-wrap">
                  <table className="data-table compact-table">
                    <thead><tr><th>Nombre</th><th>Sigla</th><th>Categoría</th><th>Estado</th><th><span className="sr-only">Acciones</span></th></tr></thead>
                    <tbody>
                      {policeRanks.map((rank) => (
                        <tr key={rank.id}>
                          <td><strong>{rank.name}</strong></td>
                          <td>{rank.abbreviation ?? "—"}</td>
                          <td>{policeRankCategoryLabels[rank.category]}</td>
                          <td><span className={`payment-badge ${rank.isActive ? "payment-paid" : "payment-reversed"}`}>{rank.isActive ? "Activo" : "Inactivo"}</span></td>
                          <td>
                            <form action={togglePoliceRankActive.bind(null, rank.id, !rank.isActive)}>
                              <button className="row-action" type="submit">{rank.isActive ? "Inactivar" : "Activar"}</button>
                            </form>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ) : (
              <section className="detail-panel" aria-labelledby="sources-title">
                <div className="panel-header">
                  <div>
                    <h2 id="sources-title">Tipos de afiliación</h2>
                    <p>Catálogo fijo del sistema; agregar uno nuevo requiere un cambio de esquema, no solo de datos.</p>
                  </div>
                </div>
                <div className="source-pill-list">
                  {affiliationSources.map((source) => (
                    <span className={`source-label source-${source}`} key={source}>{sourceLabels[source]}</span>
                  ))}
                </div>
              </section>
            )}
          </div>
        </>
      )}
    </>
  );
}
