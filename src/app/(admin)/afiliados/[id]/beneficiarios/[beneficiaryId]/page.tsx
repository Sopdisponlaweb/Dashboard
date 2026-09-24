import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Icon } from "@/components/icons";
import { CoverageBadge, StatusBadge } from "@/features/affiliates/affiliate-badges";
import {
  formatCurrency,
  formatDate,
  getCoverageState,
  getFullName,
  getInitials,
  getWaitingPeriodProgress,
  todayInBogota,
  WAITING_PERIOD_MONTHS,
} from "@/features/affiliates/format";
import { getBeneficiary } from "@/features/affiliates/repository";
import { getRecordHistory } from "@/features/audit/repository";
import { RecordHistoryPanel } from "@/features/audit/record-history-panel";
import { uploadMemberDocument } from "@/features/member-documents/actions";
import { DocumentList } from "@/features/member-documents/document-list";
import { UploadDocumentForm } from "@/features/member-documents/upload-document-form";
import { createBeneficiaryNote } from "@/features/member-notes/actions";
import { NotesPanel } from "@/features/member-notes/notes-panel";
import { listBeneficiaryNotes } from "@/features/member-notes/repository";
import { isSupabaseConfigured } from "@/lib/supabase/env";

type BeneficiaryTab = "resumen" | "documentos" | "observaciones" | "historial";
const validTabs = new Set<BeneficiaryTab>(["resumen", "documentos", "observaciones", "historial"]);

const resultMessages: Record<string, string> = {
  "beneficiary-created": "El beneficiario fue creado correctamente.",
  "beneficiary-updated": "Los datos del beneficiario fueron actualizados.",
};

type BeneficiaryPageProps = {
  params: Promise<{ id: string; beneficiaryId: string }>;
  searchParams: Promise<{ tab?: string | string[]; result?: string | string[] }>;
};

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

/** Whole years between a birth date and today; null when the date is missing or a migration placeholder. */
function ageFrom(birthDate: string, today: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate) || birthDate === "1970-01-01") return null;
  const [by, bm, bd] = birthDate.split("-").map(Number);
  const [ty, tm, td] = today.split("-").map(Number);
  return ty - by - (tm < bm || (tm === bm && td < bd) ? 1 : 0);
}

export async function generateMetadata({ params }: BeneficiaryPageProps): Promise<Metadata> {
  const { id, beneficiaryId } = await params;
  const record = await getBeneficiary(id, beneficiaryId);
  return { title: record ? `${getFullName(record.beneficiary)} · Beneficiario` : "Beneficiario no encontrado" };
}

export default async function BeneficiaryPage({ params, searchParams }: BeneficiaryPageProps) {
  const { id, beneficiaryId } = await params;
  const query = await searchParams;
  const rawTab = firstValue(query.tab) as BeneficiaryTab | undefined;
  const tab: BeneficiaryTab = rawTab && validTabs.has(rawTab) ? rawTab : "resumen";

  const [record, notes, history] = await Promise.all([
    getBeneficiary(id, beneficiaryId),
    listBeneficiaryNotes(beneficiaryId),
    tab === "historial" ? getRecordHistory("beneficiaries", beneficiaryId) : Promise.resolve([]),
  ]);
  if (!record) notFound();

  const { affiliate, beneficiary } = record;
  const affiliateName = getFullName(affiliate);
  const name = getFullName(beneficiary);
  const documents = beneficiary.documents ?? [];
  const today = todayInBogota();
  const age = ageFrom(beneficiary.birthDate, today);
  const waitingProgress = getWaitingPeriodProgress(beneficiary.fullCoverageOn, today);
  const waiting = getCoverageState(beneficiary, today) === "waiting" && !waitingProgress.invalidDate;
  const promoted = Boolean(beneficiary.promotedToAffiliateId);
  const resultMessage = resultMessages[firstValue(query.result) ?? ""];
  const base = `/afiliados/${id}/beneficiarios/${beneficiaryId}`;
  const editHref = `${base}/editar`;
  const tabClass = (value: BeneficiaryTab) => `tab-link${tab === value ? " is-active" : ""}`;

  return (
    <>
      <nav className="breadcrumb" aria-label="Migas de pan">
        <Link href="/beneficiarios">Beneficiarios</Link><span>/</span>
        <Link href={`/afiliados/${id}?tab=beneficiarios`}>{affiliateName}</Link><span>/</span>
        <span aria-current="page">{name}</span>
      </nav>

      {resultMessage ? (
        <div className="success-banner" role="status"><Icon name="lock" size={18} /><span>{resultMessage}</span></div>
      ) : null}

      <header className={`member-profile-header${waiting ? " is-waiting" : ""}`} data-status={beneficiary.status}>
        <div className="member-identity">
          <span className="person-initials profile-initials">{getInitials(beneficiary)}</span>
          <div>
            <p className="eyebrow">Ficha del beneficiario</p>
            <h1>{name}</h1>
            <p>{beneficiary.documentNumber ? `${beneficiary.documentType ?? "CC"} ${beneficiary.documentNumber}` : "Documento pendiente"} · {beneficiary.relationship}</p>
          </div>
        </div>
        <div className="member-actions">
          <div className="member-state">
            <StatusBadge status={beneficiary.status} />
            {promoted ? <span className="succession-badge is-successor">Ahora es titular</span> : null}
            <CoverageBadge status={beneficiary.status} fullCoverageOn={beneficiary.fullCoverageOn} />
          </div>
          {promoted ? (
            <Link className="secondary-button" href={`/afiliados/${beneficiary.promotedToAffiliateId}`}>Ver ficha como titular <Icon name="arrow" size={15} /></Link>
          ) : (
            <Link className="secondary-button" href={editHref}>Editar datos <Icon name="edit" size={15} /></Link>
          )}
        </div>
      </header>

      {beneficiary.inheritedFromAffiliateId ? (
        <p className="inherited-tag beneficiary-inherited">
          Heredado de <Link href={`/afiliados/${beneficiary.inheritedFromAffiliateId}`}>{beneficiary.inheritedFromName ?? "titular fallecido"}</Link> por sucesión
        </p>
      ) : null}

      {waiting ? (
        <section className="coverage-notice" aria-label="Periodo inicial de cobertura">
          <span><Icon name="calendar" size={21} /></span>
          <div>
            <strong>En carencia · mes {waitingProgress.month} de {WAITING_PERIOD_MONTHS}</strong>
            <p>Faltan {waitingProgress.timeLeft}: tendrá el 100 % del servicio a partir del {formatDate(beneficiary.fullCoverageOn)}.</p>
          </div>
        </section>
      ) : null}

      <section className="member-facts" aria-label="Resumen del beneficiario">
        <article><span>Titular</span><strong><Link className="row-action" href={`/afiliados/${id}`}>{affiliateName}</Link></strong></article>
        <article><span>Parentesco</span><strong>{beneficiary.relationship}</strong></article>
        <article><span>Fecha de vinculación</span><strong>{formatDate(beneficiary.joinedOn)}</strong></article>
        <article><span>Documentos</span><strong>{documents.length}</strong></article>
      </section>

      <nav className="tab-bar" aria-label="Secciones del beneficiario">
        <Link className={tabClass("resumen")} href={`${base}?tab=resumen`}>Resumen</Link>
        <Link className={tabClass("documentos")} href={`${base}?tab=documentos`}>Documentos ({documents.length})</Link>
        <Link className={tabClass("observaciones")} href={`${base}?tab=observaciones`}>Observaciones ({notes.length})</Link>
        <Link className={tabClass("historial")} href={`${base}?tab=historial`}>Historial</Link>
      </nav>

      <div className="tab-panel">
        {tab === "resumen" ? (
          <div className="edit-page-sections">
            <section className="detail-panel" aria-labelledby="beneficiary-personal-title">
              <div className="panel-header">
                <div><h2 id="beneficiary-personal-title">Datos personales</h2><p>Identificación y contacto</p></div>
                {!promoted ? <Link className="panel-link" href={editHref}><Icon name="edit" size={14} /> Editar información</Link> : null}
              </div>
              <dl className="detail-grid">
                <div><dt>Nombres</dt><dd>{beneficiary.firstNames || "Sin registrar"}</dd></div>
                <div><dt>Apellidos</dt><dd>{beneficiary.lastNames || "Sin registrar"}</dd></div>
                <div><dt>Documento</dt><dd>{beneficiary.documentNumber ? `${beneficiary.documentType ?? "CC"} ${beneficiary.documentNumber}` : "Sin registrar"}</dd></div>
                <div><dt>Expedición del documento</dt><dd>{formatDate(beneficiary.documentIssuedOn ?? null)}</dd></div>
                <div><dt>Fecha de nacimiento</dt><dd>{formatDate(beneficiary.birthDate || null)}{age !== null ? ` · ${age} años` : ""}</dd></div>
                <div><dt>Parentesco</dt><dd>{beneficiary.relationship}</dd></div>
                <div><dt>Teléfono</dt><dd>{beneficiary.phone || "Sin registrar"}</dd></div>
                <div><dt>Correo</dt><dd>{beneficiary.email || "Sin registrar"}</dd></div>
              </dl>
            </section>

            <section className="detail-panel" aria-labelledby="beneficiary-link-title">
              <div className="panel-header"><div><h2 id="beneficiary-link-title">Vínculo y cobertura</h2><p>Titular al que pertenece y vigencia</p></div></div>
              <dl className="detail-grid">
                <div><dt>Titular</dt><dd><Link className="row-action" href={`/afiliados/${id}`}>{affiliateName}</Link></dd></div>
                <div><dt>Documento del titular</dt><dd>{affiliate.documentType} {affiliate.documentNumber}</dd></div>
                <div><dt>Estado</dt><dd><StatusBadge status={beneficiary.status} /></dd></div>
                <div><dt>Fecha de vinculación</dt><dd>{formatDate(beneficiary.joinedOn)}</dd></div>
                <div><dt>Cobertura completa desde</dt><dd>{formatDate(beneficiary.fullCoverageOn)}</dd></div>
                <div><dt>Cobertura</dt><dd><CoverageBadge status={beneficiary.status} fullCoverageOn={beneficiary.fullCoverageOn} /></dd></div>
                {beneficiary.inheritedFromAffiliateId ? (
                  <div className="detail-span"><dt>Origen</dt><dd>Heredado de <Link className="row-action" href={`/afiliados/${beneficiary.inheritedFromAffiliateId}`}>{beneficiary.inheritedFromName ?? "titular fallecido"}</Link> por sucesión</dd></div>
                ) : null}
                {beneficiary.internalNotes ? (
                  <div className="detail-span"><dt>Notas internas</dt><dd>{beneficiary.internalNotes}</dd></div>
                ) : null}
              </dl>
            </section>

            {beneficiary.status === "deceased" ? (
              <section className="detail-panel" aria-labelledby="beneficiary-death-title">
                <div className="panel-header"><div><h2 id="beneficiary-death-title">Fallecimiento</h2><p>Registrado el {formatDate(beneficiary.deceasedOn)}</p></div></div>
                <dl className="detail-grid">
                  <div><dt>Fecha de fallecimiento</dt><dd>{formatDate(beneficiary.deceasedOn)}</dd></div>
                  <div><dt>Municipio</dt><dd>{beneficiary.deathMunicipality ?? "Sin registrar"}</dd></div>
                  <div><dt>Registro civil de defunción</dt><dd>{beneficiary.deathRegistryNumber || "Sin registrar"}</dd></div>
                  <div><dt>Notaría</dt><dd>{beneficiary.deathNotary || "Sin registrar"}</dd></div>
                  <div><dt>Servicio prestado</dt><dd>{beneficiary.deathServiceProvided || "Sin registrar"}</dd></div>
                  <div><dt>Valor del servicio</dt><dd>{beneficiary.deathServiceAmount ? formatCurrency(beneficiary.deathServiceAmount) : "Sin registrar"}</dd></div>
                  <div className="detail-span">
                    <dt>Cuenta del beneficiario del pago</dt>
                    <dd>
                      {beneficiary.successorBank
                        ? `${beneficiary.successorBank} · ${beneficiary.successorAccountType === "corriente" ? "Corriente" : beneficiary.successorAccountType === "ahorros" ? "Ahorros" : "sin tipo"} ${beneficiary.successorAccountNumber ?? ""}`
                        : "Sin registrar"}
                    </dd>
                  </div>
                </dl>
              </section>
            ) : null}
          </div>
        ) : tab === "documentos" ? (
          <section className="detail-panel" aria-labelledby="beneficiary-documents-title">
            <div className="aside-title">
              <span><Icon name="file" size={18} /></span>
              <div><h2 id="beneficiary-documents-title">Documentos</h2><p>Archivos privados de {name}: identidad, registros civiles, soportes.</p></div>
            </div>
            <DocumentList documents={documents} affiliateId={id} emptyText="Aún no hay documentos cargados para este beneficiario." />
            <UploadDocumentForm action={uploadMemberDocument.bind(null, id)} beneficiaryId={beneficiaryId} />
          </section>
        ) : tab === "observaciones" ? (
          <section className="detail-panel notes-panel" aria-labelledby="beneficiary-notes-title">
            <div className="aside-title"><div><h2 id="beneficiary-notes-title">Observaciones</h2><p>Historial de notas, con fecha, hora y autor.</p></div></div>
            <NotesPanel notes={notes} createAction={createBeneficiaryNote.bind(null, id, beneficiaryId)} persistenceEnabled={isSupabaseConfigured()} />
          </section>
        ) : (
          <section className="detail-panel" aria-labelledby="beneficiary-history-title">
            <div className="aside-title"><div><h2 id="beneficiary-history-title">Historial de cambios</h2><p>Fecha y usuario de cada modificación.</p></div></div>
            <RecordHistoryPanel entries={history} />
          </section>
        )}
      </div>
    </>
  );
}
