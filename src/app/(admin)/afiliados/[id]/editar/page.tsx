import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AffiliateForm } from "@/features/affiliates/affiliate-form";
import { updateAffiliate } from "@/features/affiliates/actions";
import { getFullName } from "@/features/affiliates/format";
import { getAffiliateById } from "@/features/affiliates/repository";
import type { AffiliateFormValues } from "@/features/affiliates/validation";
import { listMunicipalities, listPoliceRanks } from "@/features/catalogs/repository";
import { createAffiliateNote } from "@/features/member-notes/actions";
import { NotesPanel } from "@/features/member-notes/notes-panel";
import { listAffiliateNotes } from "@/features/member-notes/repository";
import { getRecordHistory } from "@/features/audit/repository";
import { RecordHistoryPanel } from "@/features/audit/record-history-panel";
import { isSupabaseConfigured } from "@/lib/supabase/env";

type EditAffiliatePageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: EditAffiliatePageProps): Promise<Metadata> {
  const { id } = await params;
  const affiliate = await getAffiliateById(id);
  return { title: affiliate ? `Editar ${getFullName(affiliate)}` : "Afiliado no encontrado" };
}

export default async function EditAffiliatePage({ params }: EditAffiliatePageProps) {
  const { id } = await params;
  const [affiliate, municipalities, policeRanks, notes, history] = await Promise.all([
    getAffiliateById(id),
    listMunicipalities(),
    listPoliceRanks(),
    listAffiliateNotes(id),
    getRecordHistory("affiliates", id),
  ]);
  if (!affiliate) notFound();

  const fullName = getFullName(affiliate);
  const initialValues: AffiliateFormValues = {
    documentType: affiliate.documentType,
    documentNumber: affiliate.documentNumber,
    documentIssuedOn: affiliate.documentIssuedOn,
    firstNames: affiliate.firstNames,
    lastNames: affiliate.lastNames,
    birthDate: affiliate.birthDate,
    phone: affiliate.phone,
    email: affiliate.email,
    address: affiliate.address,
    source: affiliate.source,
    status: affiliate.status,
    joinedOn: affiliate.joinedOn,
    deceasedOn: affiliate.deceasedOn ?? "",
    successorResolutionNumber: affiliate.successorResolutionNumber ?? "",
    successorDocumentNumber: affiliate.successorDocumentNumber ?? "",
    successorFirstNames: affiliate.successorFirstNames ?? "",
    successorLastNames: affiliate.successorLastNames ?? "",
    successorPhone: affiliate.successorPhone ?? "",
    deathMunicipalityId: affiliate.deathMunicipalityId ?? "",
    deathRegistryNumber: affiliate.deathRegistryNumber ?? "",
    deathNotary: affiliate.deathNotary ?? "",
    deathServiceProvided: affiliate.deathServiceProvided ?? "",
    deathServiceAmount: affiliate.deathServiceAmount !== null && affiliate.deathServiceAmount !== undefined ? String(affiliate.deathServiceAmount) : "",
    successorBank: affiliate.successorBank ?? "",
    successorAccountNumber: affiliate.successorAccountNumber ?? "",
    successorAccountType: affiliate.successorAccountType ?? "",
    policeRankId: affiliate.policeRankId ?? "",
  };
  const updateAction = updateAffiliate.bind(null, id);

  return (
    <>
      <nav className="breadcrumb" aria-label="Migas de pan">
        <Link href="/afiliados">Afiliados</Link><span>/</span>
        <Link href={`/afiliados/${id}`}>{fullName}</Link><span>/</span>
        <span aria-current="page">Editar</span>
      </nav>
      <header className="page-heading form-page-heading">
        <div>
          <p className="eyebrow">Actualización administrativa</p>
          <h1>Editar afiliado</h1>
          <p>Modifica la información principal de {fullName}. Los cambios persistidos quedarán protegidos por permisos y auditoría.</p>
        </div>
      </header>
      <AffiliateForm
        action={updateAction}
        initialValues={initialValues}
        mode="edit"
        persistenceEnabled={isSupabaseConfigured()}
        cancelHref={`/afiliados/${id}`}
        municipalities={municipalities}
        policeRanks={policeRanks}
      />

      <div className="edit-page-sections">
        <section className="detail-panel notes-panel" aria-labelledby="affiliate-edit-notes-title">
          <div className="aside-title"><div><h2 id="affiliate-edit-notes-title">Observaciones</h2><p>Historial de notas, con fecha, hora y autor.</p></div></div>
          <NotesPanel
            notes={notes}
            createAction={createAffiliateNote.bind(null, id)}
            persistenceEnabled={isSupabaseConfigured()}
          />
        </section>

        <section className="detail-panel" aria-labelledby="affiliate-edit-history-title">
          <div className="aside-title"><div><h2 id="affiliate-edit-history-title">Historial de cambios</h2><p>Fecha y usuario de cada modificación.</p></div></div>
          <RecordHistoryPanel entries={history} />
        </section>
      </div>
    </>
  );
}
