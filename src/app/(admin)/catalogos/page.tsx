import type { Metadata } from "next";
import Link from "next/link";

import { DataSourceBadge } from "@/components/data-source-badge";
import { sourceLabels } from "@/features/affiliates/format";
import {
  deleteMunicipality,
  deleteOrganization,
  deletePaymentMethod,
  deletePoliceRank,
  toggleMunicipalityActive,
  toggleOrganizationActive,
  togglePaymentMethodActive,
  togglePoliceRankActive,
  updateMunicipality,
  updateOrganization,
  updatePaymentMethod,
  updatePoliceRank,
} from "@/features/catalogs/actions";
import { EditableCatalogTable, type CatalogColumn } from "@/features/catalogs/editable-catalog-table";
import { MunicipalityForm } from "@/features/catalogs/municipality-form";
import { OrganizationForm } from "@/features/catalogs/organization-form";
import { PaymentMethodForm } from "@/features/catalogs/payment-method-form";
import { PoliceRankForm } from "@/features/catalogs/police-rank-form";
import {
  canManageSettings,
  countAffiliatesBySource,
  listMunicipalities,
  listOrganizations,
  listPaymentMethods,
  listPoliceRanks,
  organizationTypeLabels,
  policeRankCategoryLabels,
} from "@/features/catalogs/repository";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export const metadata: Metadata = { title: "Catálogos" };

type CatalogTab = "municipios" | "entidades" | "rangos" | "metodos" | "fuentes";
const validTabs = new Set<CatalogTab>(["municipios", "entidades", "rangos", "metodos", "fuentes"]);

const tabs: { key: CatalogTab; label: string }[] = [
  { key: "municipios", label: "Municipios" },
  { key: "entidades", label: "Entidades" },
  { key: "rangos", label: "Rangos de policía" },
  { key: "metodos", label: "Métodos de pago" },
  { key: "fuentes", label: "Tipos de afiliación" },
];

const municipalityColumns: CatalogColumn[] = [
  { key: "department", label: "Departamento", required: true, maxLength: 120 },
  { key: "name", label: "Municipio", required: true, maxLength: 120, variant: "strong" },
  { key: "daneCode", label: "DANE", maxLength: 20, placeholder: "Opcional", variant: "mono" },
];

const organizationColumns: CatalogColumn[] = [
  { key: "name", label: "Nombre", required: true, maxLength: 160, variant: "strong" },
  {
    key: "organizationType",
    label: "Tipo",
    required: true,
    options: Object.entries(organizationTypeLabels).map(([value, label]) => ({ value, label })),
  },
];

const policeRankColumns: CatalogColumn[] = [
  { key: "name", label: "Nombre", required: true, maxLength: 80, variant: "strong" },
  { key: "abbreviation", label: "Sigla", maxLength: 10, placeholder: "Opcional" },
  {
    key: "category",
    label: "Categoría",
    required: true,
    options: Object.entries(policeRankCategoryLabels).map(([value, label]) => ({ value, label })),
  },
];

const paymentMethodColumns: CatalogColumn[] = [
  { key: "name", label: "Nombre", required: true, maxLength: 80, variant: "strong" },
];

type SearchParams = Promise<{ tab?: string | string[] }>;

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function CatalogPanel({ id, title, description, children }: { id: string; title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="detail-panel" aria-labelledby={id}>
      <div className="panel-header">
        <div>
          <h2 id={id}>{title}</h2>
          <p>{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

export default async function CatalogsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const rawTab = firstValue(params.tab) ?? "municipios";
  const tab: CatalogTab = validTabs.has(rawTab as CatalogTab) ? (rawTab as CatalogTab) : "municipios";

  const persistenceEnabled = isSupabaseConfigured();
  const hasAccess = persistenceEnabled ? await canManageSettings() : false;

  const [municipalities, organizations, policeRanks, paymentMethods, sourceUsage] = await Promise.all([
    hasAccess && tab === "municipios" ? listMunicipalities() : [],
    hasAccess && tab === "entidades" ? listOrganizations() : [],
    hasAccess && tab === "rangos" ? listPoliceRanks() : [],
    hasAccess && tab === "metodos" ? listPaymentMethods() : [],
    hasAccess && tab === "fuentes" ? countAffiliatesBySource() : [],
  ]);

  return (
    <>
      <header className="page-heading directory-heading">
        <div>
          <p className="eyebrow">Configuración</p>
          <h1>Catálogos</h1>
          <p>Centraliza municipios, entidades, rangos y métodos de pago usados en afiliados y pagos.</p>
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
            {tabs.map((item) => (
              <Link
                key={item.key}
                className={`tab-link${tab === item.key ? " is-active" : ""}`}
                href={`/catalogos?tab=${item.key}`}
                aria-current={tab === item.key ? "page" : undefined}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="tab-panel">
            {tab === "municipios" ? (
              <CatalogPanel id="municipalities-title" title="Municipios" description="Se usan en la ficha del afiliado. Los ya usados no se pueden eliminar, solo inactivar.">
                <MunicipalityForm />
                <EditableCatalogTable
                  rows={municipalities.map((item) => ({
                    id: item.id,
                    isActive: item.isActive,
                    values: { department: item.department, name: item.name, daneCode: item.daneCode ?? "" },
                  }))}
                  columns={municipalityColumns}
                  updateAction={updateMunicipality}
                  toggleAction={toggleMunicipalityActive}
                  deleteAction={deleteMunicipality}
                  searchPlaceholder="Buscar municipio, departamento o código DANE"
                  emptyMessage="No hay municipios registrados."
                  pageSize={50}
                />
              </CatalogPanel>
            ) : tab === "entidades" ? (
              <CatalogPanel id="organizations-title" title="Entidades" description="Empresas, cajas de compensación y terceros pagadores vinculados a afiliados.">
                <OrganizationForm />
                <EditableCatalogTable
                  rows={organizations.map((item) => ({
                    id: item.id,
                    isActive: item.isActive,
                    values: { name: item.name, organizationType: item.organizationType },
                  }))}
                  columns={organizationColumns}
                  updateAction={updateOrganization}
                  toggleAction={toggleOrganizationActive}
                  deleteAction={deleteOrganization}
                  statusLabels={["Activa", "Inactiva"]}
                  searchPlaceholder="Buscar entidad"
                  emptyMessage="No hay entidades registradas."
                />
              </CatalogPanel>
            ) : tab === "rangos" ? (
              <CatalogPanel id="police-ranks-title" title="Rangos de policía" description="Grados de la Policía Nacional, incluidos los históricos usados por afiliados retirados.">
                <PoliceRankForm />
                <EditableCatalogTable
                  rows={policeRanks.map((item) => ({
                    id: item.id,
                    isActive: item.isActive,
                    values: { name: item.name, abbreviation: item.abbreviation ?? "", category: item.category },
                  }))}
                  columns={policeRankColumns}
                  updateAction={updatePoliceRank}
                  toggleAction={togglePoliceRankActive}
                  deleteAction={deletePoliceRank}
                  searchPlaceholder="Buscar rango, sigla o categoría"
                  emptyMessage="No hay rangos registrados."
                />
              </CatalogPanel>
            ) : tab === "metodos" ? (
              <CatalogPanel id="payment-methods-title" title="Métodos de pago" description="Formas en que el afiliado entrega su aporte o abono. Solo los activos aparecen al registrar un pago.">
                <PaymentMethodForm />
                <EditableCatalogTable
                  rows={paymentMethods.map((item) => ({ id: item.id, isActive: item.isActive, values: { name: item.name } }))}
                  columns={paymentMethodColumns}
                  updateAction={updatePaymentMethod}
                  toggleAction={togglePaymentMethodActive}
                  deleteAction={deletePaymentMethod}
                  searchPlaceholder="Buscar método de pago"
                  emptyMessage="No hay métodos de pago registrados."
                />
              </CatalogPanel>
            ) : (
              <CatalogPanel id="sources-title" title="Tipos de afiliación" description="Clasifican a cada titular y a sus pagos. Son parte de la estructura de la base de datos: los nombres visibles se definen en el sistema y agregar un tipo nuevo requiere un cambio técnico.">
                <div className="data-table-wrap">
                  <table className="data-table compact-table catalog-table">
                    <thead>
                      <tr><th>Tipo</th><th>Clave interna</th><th>Titulares vigentes</th><th>Titulares en total</th><th>Estado</th></tr>
                    </thead>
                    <tbody>
                      {sourceUsage.map((item) => (
                        <tr key={item.source}>
                          <td><span className={`source-label source-${item.source}`}>{sourceLabels[item.source]}</span></td>
                          <td className="mono-value">{item.source}</td>
                          <td className="mono-value">{item.current.toLocaleString("es-CO")}</td>
                          <td className="mono-value">{item.total.toLocaleString("es-CO")}</td>
                          <td><span className="payment-badge payment-paid">Activo</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CatalogPanel>
            )}
          </div>
        </>
      )}
    </>
  );
}
