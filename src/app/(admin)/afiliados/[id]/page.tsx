import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Icon } from "@/components/icons";
import { CoverageBadge, StatusBadge } from "@/features/affiliates/affiliate-badges";
import { documentKindLabels, formatCurrency, formatDate, getCoverageState, getFullName, getInitials, getWaitingPeriodProgress, WAITING_PERIOD_MONTHS, sourceLabels } from "@/features/affiliates/format";
import { getAffiliateById } from "@/features/affiliates/repository";
import { PaymentsHistoryPanel } from "@/features/affiliates/payments-history-panel";
import { uploadMemberDocument } from "@/features/member-documents/actions";
import { UploadDocumentForm } from "@/features/member-documents/upload-document-form";
import { createAffiliateNote } from "@/features/member-notes/actions";
import { NotesPanel } from "@/features/member-notes/notes-panel";
import { listAffiliateNotes } from "@/features/member-notes/repository";
import { getAffiliateHistory } from "@/features/audit/affiliate-history";
import { AffiliateHistoryPanel } from "@/features/audit/affiliate-history-panel";
import { listPaymentMethods } from "@/features/catalogs/repository";
import { AccountStatementForm } from "@/features/payments/account-statement-form";
import { createManualPayment } from "@/features/payments/actions";
import { coveredPeriods } from "@/features/payments/periods";
import { ManualPaymentForm } from "@/features/payments/manual-payment-form";
import { registerCreditInstallment, requestCredit } from "@/features/credits/actions";
import { remainingBalance } from "@/features/credits/calculations";
import { CreditHistoryPanel } from "@/features/credits/credit-history-panel";
import { InstallmentForm } from "@/features/credits/installment-form";
import { RequestCreditForm } from "@/features/credits/request-credit-form";
import { resolvePausedCredit } from "@/features/successions/actions";
import { PausedCreditCard } from "@/features/successions/paused-credit-card";
import { getAffiliateSuccessions, isAdministrator } from "@/features/successions/repository";
import { SuccessionBanner } from "@/features/successions/succession-banner";
import { isSupabaseConfigured } from "@/lib/supabase/env";

type AffiliatePageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ result?: string | string[]; tab?: string | string[] }>;
};

export async function generateMetadata({ params }: AffiliatePageProps): Promise<Metadata> {
  const { id } = await params;
  const affiliate = await getAffiliateById(id);
  return { title: affiliate ? getFullName(affiliate) : "Afiliado no encontrado" };
}

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

const beneficiaryResultMessages: Record<string, string> = {
  "beneficiary-created": "El beneficiario fue creado correctamente.",
  "beneficiary-updated": "Los datos del beneficiario fueron actualizados.",
  "succession-created": "La sucesión quedó registrada. Los beneficiarios y el crédito elegidos pasaron al sucesor.",
  "succession-annulled": "La sucesión fue anulada y lo transferido volvió al fallecido.",
  "credit-inherit": "El crédito en pausa pasó al sucesor y quedó activo.",
  "credit-forgive": "El crédito fue condonado.",
  "credit-cancel": "El crédito fue cancelado.",
};

type AffiliateTab = "resumen" | "beneficiarios" | "pagos" | "creditos" | "documentos" | "observaciones" | "historial";
const HISTORY_LIMIT = 300;
const validTabs = new Set<AffiliateTab>(["resumen", "beneficiarios", "pagos", "creditos", "documentos", "observaciones", "historial"]);

export default async function AffiliateDetailPage({ params, searchParams }: AffiliatePageProps) {
  const [{ id }, { result, tab: rawTabParam }] = await Promise.all([params, searchParams]);
  const affiliate = await getAffiliateById(id);
  if (!affiliate) notFound();
  const rawTab = firstValue(rawTabParam) ?? "resumen";
  const tab: AffiliateTab = validTabs.has(rawTab as AffiliateTab) ? (rawTab as AffiliateTab) : "resumen";

  // The history spans every related table; only load it when its tab is open.
  const successions = await getAffiliateSuccessions(id);
  const [isAdmin, inheritedFrom] = await Promise.all([
    successions.asDeceased ? isAdministrator() : Promise.resolve(false),
    // The successor sees the deceased's payments without moving them.
    tab === "pagos" ? Promise.all(successions.asSuccessor.map((succession) => getAffiliateById(succession.deceasedId))) : Promise.resolve([]),
  ]);
  const [notes, history, paymentMethods] = await Promise.all([
    listAffiliateNotes(id),
    tab === "historial" ? getAffiliateHistory(id, HISTORY_LIMIT) : Promise.resolve([]),
    isSupabaseConfigured() ? listPaymentMethods({ activeOnly: true }) : Promise.resolve([]),
  ]);

  // Payments come newest period first; suggest the month after the last one paid.
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date());
  const lastPaid = affiliate.payments.find((payment) => payment.status === "paid");
  const suggestedPeriodFrom = lastPaid ? coveredPeriods(lastPaid.period, 2)[1] : today.slice(0, 7);


  const fullName = getFullName(affiliate);
  const activeCredit = (affiliate.credits ?? []).find((credit) => credit.status === "active") ?? null;
  const activeCreditBalance = activeCredit ? remainingBalance(activeCredit, activeCredit.installments) : null;
  const waitingProgress = getWaitingPeriodProgress(affiliate.fullCoverageOn);
  // An affiliation date in the future is bad data, not a real waiting period.
  const waiting = getCoverageState(affiliate) === "waiting" && !waitingProgress.invalidDate;
  // A beneficiary promoted to titular by the succession stays here, flagged, but no longer counts.
  const promotedBeneficiaries = affiliate.beneficiaries.filter((beneficiary) => beneficiary.promotedToAffiliateId);
  const currentBeneficiaries = affiliate.beneficiaries.filter((beneficiary) => beneficiary.status !== "deceased" && !beneficiary.promotedToAffiliateId);
  const pausedCredits = (affiliate.credits ?? []).filter((credit) => credit.status === "paused");
  const successorForCredits = successions.asDeceased?.successorId
    ? { id: successions.asDeceased.successorId, name: successions.asDeceased.successorName }
    : null;
  const historicalBeneficiaries = affiliate.beneficiaries.filter((beneficiary) => beneficiary.status === "deceased");
  const resultMessage = beneficiaryResultMessages[firstValue(result) ?? ""];

  function tabHref(nextTab: AffiliateTab) {
    return `/afiliados/${id}?tab=${nextTab}`;
  }
  function tabClass(thisTab: AffiliateTab) {
    return `tab-link${tab === thisTab ? " is-active" : ""}`;
  }

  return (
    <>
      <nav className="breadcrumb" aria-label="Migas de pan">
        <Link href="/afiliados">Afiliados</Link><span>/</span><span aria-current="page">{fullName}</span>
      </nav>

      {resultMessage ? (
        <div className="success-banner" role="status">
          <Icon name="lock" size={18} />
          <span>{resultMessage}</span>
        </div>
      ) : null}

      <header className={`member-profile-header${waiting ? " is-waiting" : ""}`} data-status={affiliate.status}>
        <div className="member-identity">
          <span className="person-initials profile-initials">{affiliate.firstNames[0]}{affiliate.lastNames[0]}</span>
          <div><p className="eyebrow">Ficha integral</p><h1>{fullName}</h1><p>{affiliate.documentType} {affiliate.documentNumber} · {sourceLabels[affiliate.source]}</p></div>
        </div>
        <div className="member-actions">
          <div className="member-state">
            <StatusBadge status={affiliate.status} />
            {affiliate.status === "deceased" ? (
              successions.asDeceased
                ? <span className="succession-badge is-registered">Sucedido</span>
                : <span className="succession-badge is-pending">Sucesión pendiente</span>
            ) : null}
            {successions.asSuccessor.length ? <span className="succession-badge is-successor">Titular por sucesión</span> : null}
            <CoverageBadge status={affiliate.status} fullCoverageOn={affiliate.fullCoverageOn} />
          </div>
          <Link className="secondary-button" href={`/afiliados/${affiliate.id}/editar`}>Editar datos <Icon name="arrow" size={15} /></Link>
        </div>
      </header>

      <SuccessionBanner affiliateId={affiliate.id} isDeceased={affiliate.status === "deceased"} successions={successions} isAdmin={isAdmin} />

      {waiting ? (
        <section className="coverage-notice" aria-label="Periodo inicial de cobertura">
          <span><Icon name="calendar" size={21} /></span>
          <div>
            <strong>En carencia · mes {waitingProgress.month} de {WAITING_PERIOD_MONTHS}</strong>
            <p>
              Faltan {waitingProgress.timeLeft}: tendrá el 100 % del servicio a partir del{" "}
              {formatDate(affiliate.fullCoverageOn)}.
            </p>
          </div>
        </section>
      ) : null}

      <section className="member-facts" aria-label="Resumen del afiliado">
        <article><span>Fecha de afiliación</span><strong>{formatDate(affiliate.joinedOn)}</strong></article>
        <article><span>Último pago</span><strong>{formatDate(affiliate.lastPaymentOn)}</strong></article>
        <article><span>Beneficiarios vigentes</span><strong>{currentBeneficiaries.length}</strong></article>
        <article><span>Documentos</span><strong>{affiliate.documents.length}</strong></article>
      </section>

      <nav className="tab-bar" aria-label="Secciones del afiliado">
        <Link className={tabClass("resumen")} href={tabHref("resumen")}>Resumen</Link>
        <Link className={tabClass("beneficiarios")} href={tabHref("beneficiarios")}>Beneficiarios ({currentBeneficiaries.length})</Link>
        <Link className={tabClass("pagos")} href={tabHref("pagos")}>Pagos ({affiliate.payments.length})</Link>
        <Link className={tabClass("creditos")} href={tabHref("creditos")}>Créditos</Link>
        <Link className={tabClass("documentos")} href={tabHref("documentos")}>Documentos ({affiliate.documents.length})</Link>
        <Link className={tabClass("observaciones")} href={tabHref("observaciones")}>Observaciones ({notes.length})</Link>
        <Link className={tabClass("historial")} href={tabHref("historial")}>Historial</Link>
      </nav>

      <div className="tab-panel">
        {tab === "resumen" ? (
          <div className="edit-page-sections">
            <section className="detail-panel" aria-labelledby="personal-data-title">
              <div className="panel-header"><div><h2 id="personal-data-title">Datos personales</h2><p>Información de identificación y contacto</p></div><Link className="panel-link" href={`/afiliados/${affiliate.id}/editar`}>Editar información</Link></div>
              <dl className="detail-grid">
                <div><dt>Nombres</dt><dd>{affiliate.firstNames}</dd></div>
                <div><dt>Apellidos</dt><dd>{affiliate.lastNames}</dd></div>
                <div><dt>Documento</dt><dd>{affiliate.documentType} {affiliate.documentNumber}</dd></div>
                <div><dt>Expedición de cédula</dt><dd>{formatDate(affiliate.documentIssuedOn)}</dd></div>
                <div><dt>Fecha de nacimiento</dt><dd>{formatDate(affiliate.birthDate)}</dd></div>
                <div><dt>Teléfono</dt><dd>{affiliate.phone || "Sin registrar"}</dd></div>
                <div><dt>Correo</dt><dd>{affiliate.email || "Sin registrar"}</dd></div>
                <div><dt>Municipio</dt><dd>{affiliate.municipality}</dd></div>
                <div className="detail-span"><dt>Dirección</dt><dd>{affiliate.address || "Sin registrar"}</dd></div>
              </dl>
            </section>

            <section className="detail-panel">
              <div className="aside-title"><span><Icon name="layers" size={18} /></span><div><h2>Afiliación</h2><p>Clasificación operativa</p></div></div>
              <dl className="aside-list"><div><dt>Tipo</dt><dd>{sourceLabels[affiliate.source]}</dd></div><div><dt>Entidad</dt><dd>{affiliate.organization ?? "Particular"}</dd></div><div><dt>Cobertura total</dt><dd>{formatDate(affiliate.fullCoverageOn)}</dd></div><div><dt>Rango de policía</dt><dd>{affiliate.policeRank ?? "Sin registrar"}</dd></div></dl>
            </section>

            {affiliate.status === "deceased" ? (
              <section className="detail-panel" aria-labelledby="death-info-title">
                <div className="panel-header"><div><h2 id="death-info-title">Fallecimiento y sucesión</h2><p>Registrado el {formatDate(affiliate.deceasedOn)}</p></div></div>
                <dl className="detail-grid">
                  <div><dt>Sucesor</dt><dd>{[affiliate.successorFirstNames, affiliate.successorLastNames].filter(Boolean).join(" ") || "Sin registrar"}</dd></div>
                  <div><dt>Documento del sucesor</dt><dd>{affiliate.successorDocumentNumber || "Sin registrar"}</dd></div>
                  <div><dt>Teléfono del sucesor</dt><dd>{affiliate.successorPhone || "Sin registrar"}</dd></div>
                  <div><dt>Número de resolución</dt><dd>{affiliate.successorResolutionNumber || "Sin registrar"}</dd></div>
                  <div><dt>Municipio de fallecimiento</dt><dd>{affiliate.deathMunicipality || "Sin registrar"}</dd></div>
                  <div><dt>Registro de defunción</dt><dd>{affiliate.deathRegistryNumber || "Sin registrar"}</dd></div>
                  <div><dt>Notaría que expide</dt><dd>{affiliate.deathNotary || "Sin registrar"}</dd></div>
                  <div><dt>Servicio prestado</dt><dd>{affiliate.deathServiceProvided || "Sin registrar"}</dd></div>
                  <div><dt>Monto del servicio</dt><dd>{affiliate.deathServiceAmount ? formatCurrency(affiliate.deathServiceAmount) : "Sin registrar"}</dd></div>
                  <div><dt>Banco</dt><dd>{affiliate.successorBank || "Sin registrar"}</dd></div>
                  <div><dt>Cuenta</dt><dd>{affiliate.successorAccountNumber ? `${affiliate.successorAccountNumber} (${affiliate.successorAccountType === "corriente" ? "Corriente" : affiliate.successorAccountType === "ahorros" ? "Ahorros" : "Sin tipo"})` : "Sin registrar"}</dd></div>
                </dl>
              </section>
            ) : null}
          </div>
        ) : tab === "beneficiarios" ? (
          <section className="detail-panel" aria-labelledby="beneficiaries-title">
            <div className="panel-header"><div><h2 id="beneficiaries-title">Beneficiarios vigentes</h2><p>Personas vinculadas actualmente al titular</p></div><div className="panel-header-actions"><span className="panel-tag">{currentBeneficiaries.length} {currentBeneficiaries.length === 1 ? "registro" : "registros"}</span><Link className="panel-link" href={`/afiliados/${affiliate.id}/beneficiarios/nuevo`}><Icon name="heart" size={14} /> Agregar</Link></div></div>
            {currentBeneficiaries.length ? (
              <div className="beneficiary-list">
                {currentBeneficiaries.map((beneficiary) => (
                  <article
                    className={`beneficiary-row${getCoverageState(beneficiary) === "waiting" ? " is-waiting" : ""}`}
                    data-status={beneficiary.status}
                    key={beneficiary.id}
                  >
                    <span className="person-initials">{getInitials(beneficiary)}</span>
                    <div>
                      <strong>{getFullName(beneficiary)}</strong>
                      <span>{beneficiary.relationship} · {beneficiary.documentNumber ?? "Documento pendiente"}</span>
                      {beneficiary.inheritedFromAffiliateId ? (
                        <span className="inherited-tag">
                          Heredado de <Link href={`/afiliados/${beneficiary.inheritedFromAffiliateId}`}>{beneficiary.inheritedFromName ?? "titular fallecido"}</Link>
                        </span>
                      ) : null}
                    </div>
                    <p className="beneficiary-badges">
                      <StatusBadge status={beneficiary.status} />
                      <CoverageBadge status={beneficiary.status} fullCoverageOn={beneficiary.fullCoverageOn} />
                    </p>
                    <Link className="row-action" href={`/afiliados/${affiliate.id}/beneficiarios/${beneficiary.id}/editar`} aria-label={`Editar a ${beneficiary.firstNames} ${beneficiary.lastNames}`}>Editar</Link>
                  </article>
                ))}
              </div>
            ) : <p className="inline-empty">Este titular no tiene beneficiarios vigentes.</p>}

            {promotedBeneficiaries.map((beneficiary) => (
              <article className="beneficiary-row is-promoted" key={beneficiary.id}>
                <span className="person-initials">{getInitials(beneficiary)}</span>
                <div><strong>{getFullName(beneficiary)}</strong><span>{beneficiary.relationship} · pasó a ser titular por sucesión</span></div>
                <span className="succession-badge is-successor">Ahora titular</span>
                <Link className="row-action" href={`/afiliados/${beneficiary.promotedToAffiliateId}`}>Ver ficha <Icon name="arrow" size={15} /></Link>
              </article>
            ))}

            {historicalBeneficiaries.length ? (
              <details className="historical-records" data-status="deceased">
                <summary><Icon name="lock" size={16} /> Histórico reservado · {historicalBeneficiaries.length}</summary>
                <div>
                  {historicalBeneficiaries.map((beneficiary) => {
                    const hasDeathDetails = beneficiary.deathMunicipality || beneficiary.deathRegistryNumber || beneficiary.deathNotary
                      || beneficiary.deathServiceProvided || beneficiary.deathServiceAmount || beneficiary.successorBank || beneficiary.successorAccountNumber;
                    return (
                      <p key={beneficiary.id}>
                        <strong>{beneficiary.firstNames} {beneficiary.lastNames}</strong>
                        <span>{beneficiary.relationship} · Fallecimiento: {formatDate(beneficiary.deceasedOn)}</span>
                        {hasDeathDetails ? (
                          <span className="historical-death-details">
                            {beneficiary.deathMunicipality ? `Municipio: ${beneficiary.deathMunicipality}. ` : ""}
                            {beneficiary.deathRegistryNumber ? `Registro: ${beneficiary.deathRegistryNumber}. ` : ""}
                            {beneficiary.deathNotary ? `Notaría: ${beneficiary.deathNotary}. ` : ""}
                            {beneficiary.deathServiceProvided ? `Servicio: ${beneficiary.deathServiceProvided}. ` : ""}
                            {beneficiary.deathServiceAmount ? `Monto: ${formatCurrency(beneficiary.deathServiceAmount)}. ` : ""}
                            {beneficiary.successorBank ? `Banco: ${beneficiary.successorBank} · Cuenta ${beneficiary.successorAccountNumber ?? "—"} (${beneficiary.successorAccountType === "corriente" ? "Corriente" : beneficiary.successorAccountType === "ahorros" ? "Ahorros" : "sin tipo"}).` : ""}
                          </span>
                        ) : null}
                      </p>
                    );
                  })}
                </div>
              </details>
            ) : null}
          </section>
        ) : tab === "pagos" ? (
          <section className="detail-panel" aria-labelledby="payments-title">
            <div className="panel-header"><div><h2 id="payments-title">Histórico de pagos</h2><p>Aportes registrados y observaciones del proceso</p></div><span className="panel-tag">{affiliate.payments.length} {affiliate.payments.length === 1 ? "movimiento" : "movimientos"}</span></div>
            {affiliate.payments.length ? (
              <AccountStatementForm
                affiliateId={affiliate.id}
                firstPeriod={affiliate.payments[affiliate.payments.length - 1].period}
                lastPeriod={affiliate.payments[0].period}
              />
            ) : null}
            <ManualPaymentForm
              createAction={createManualPayment.bind(null, affiliate.id)}
              persistenceEnabled={isSupabaseConfigured()}
              defaultSource={affiliate.source}
              paymentMethods={paymentMethods}
              suggestedPeriodFrom={suggestedPeriodFrom}
              suggestedMonthlyAmount={lastPaid?.amount ?? null}
              today={today}
            />
            <PaymentsHistoryPanel payments={affiliate.payments} affiliateId={affiliate.id} />

            {inheritedFrom.map((deceased) => deceased ? (
              <section key={deceased.id} className="inherited-payments" aria-label={`Pagos heredados de ${getFullName(deceased)}`}>
                <div className="panel-header">
                  <div>
                    <h3>Pagos heredados de {getFullName(deceased)}</h3>
                    <p>Historial del titular fallecido, solo de consulta. Los pagos siguen a su nombre.</p>
                  </div>
                  <div className="panel-header-actions">
                    <span className="panel-tag">{deceased.payments.length} movimientos</span>
                    <Link className="panel-link" href={`/afiliados/${deceased.id}/estado-de-cuenta`} target="_blank"><Icon name="file" size={14} /> Estado de cuenta PDF</Link>
                  </div>
                </div>
                <PaymentsHistoryPanel payments={deceased.payments} affiliateId={deceased.id} />
              </section>
            ) : null)}
          </section>
        ) : tab === "creditos" ? (
          <section className="detail-panel" aria-labelledby="credits-title">
            <div className="panel-header"><div><h2 id="credits-title">Créditos</h2><p>Cartera de crédito del afiliado</p></div><span className="panel-tag">{(affiliate.credits ?? []).length} {(affiliate.credits ?? []).length === 1 ? "crédito" : "créditos"}</span></div>
            <RequestCreditForm
              createAction={requestCredit.bind(null, affiliate.id)}
              persistenceEnabled={isSupabaseConfigured()}
              activeCredit={activeCreditBalance ? { remainingCapital: activeCreditBalance.remainingCapital, remainingInterest: activeCreditBalance.remainingInterest } : null}
            />
            {activeCredit ? (
              <InstallmentForm
                createAction={registerCreditInstallment.bind(null, activeCredit.id, affiliate.id)}
                persistenceEnabled={isSupabaseConfigured()}
                paymentMethods={paymentMethods}
                principalBase={activeCredit.principalBase}
                totalAmount={activeCredit.totalAmount}
                installmentAmount={activeCredit.installmentAmount}
                remainingTotal={activeCreditBalance?.remainingTotal ?? activeCredit.totalAmount}
                requestedOn={activeCredit.requestedOn}
                today={today}
              />
            ) : null}
            {pausedCredits.map((credit) => (
              <PausedCreditCard
                key={credit.id}
                action={resolvePausedCredit.bind(null, credit.id, affiliate.id)}
                affiliateId={affiliate.id}
                credit={credit}
                remainingTotal={remainingBalance(credit, credit.installments).remainingTotal}
                successor={successorForCredits}
              />
            ))}
            <CreditHistoryPanel credits={(affiliate.credits ?? []).filter((credit) => credit.status !== "paused")} affiliateId={affiliate.id} />
          </section>
        ) : tab === "documentos" ? (
          <section className="detail-panel">
            <div className="aside-title"><span><Icon name="file" size={18} /></span><div><h2>Expediente PDF</h2><p>Archivos privados del afiliado</p></div></div>
            {affiliate.documents.length ? (
              <ul className="document-list">
                {affiliate.documents.map((document) => (
                  <li key={document.id}>
                    <span><Icon name="file" size={17} /></span>
                    <div><strong>{document.title}</strong><small>{documentKindLabels[document.kind]} · {formatDate(document.uploadedOn)} · {document.sizeLabel}</small></div>
                    {isSupabaseConfigured() ? (
                      <Link className="row-action" href={`/afiliados/${affiliate.id}/documentos/${document.id}`} target="_blank">Ver</Link>
                    ) : <em>Local</em>}
                  </li>
                ))}
              </ul>
            ) : <p className="inline-empty">Aún no hay documentos cargados.</p>}
            <UploadDocumentForm action={uploadMemberDocument.bind(null, affiliate.id)} />
          </section>
        ) : tab === "observaciones" ? (
          <section className="detail-panel notes-panel">
            <div className="aside-title"><span><Icon name="message" size={18} /></span><div><h2>Observaciones</h2><p>Historial de notas administrativas, con fecha, hora y autor</p></div></div>
            <NotesPanel
              notes={notes}
              createAction={createAffiliateNote.bind(null, affiliate.id)}
              persistenceEnabled={isSupabaseConfigured()}
            />
          </section>
        ) : (
          <section className="detail-panel">
            <div className="aside-title"><span><Icon name="history" size={18} /></span><div><h2>Historial del afiliado</h2><p>Datos, beneficiarios, pagos, créditos, documentos y observaciones, con fecha y usuario</p></div></div>
            <AffiliateHistoryPanel entries={history} limitReached={history.length >= HISTORY_LIMIT} />
          </section>
        )}
      </div>
    </>
  );
}
